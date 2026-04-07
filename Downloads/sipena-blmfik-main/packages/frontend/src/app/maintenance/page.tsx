'use client'

import {
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Download,
    Edit2,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    UserCheck,
    Wrench
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import MaintenanceForm from "@/components/maintenance-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    appendLine,
    buildTableExportRows,
    DocumentSection,
    ExportFormat,
    exportNarrativeReport,
    exportTableData,
    SectionBuilder,
    SectionLine,
    TableExportColumn,
} from "@/utils/export-table"

import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { assetService } from "@/services/asset.service"
import { getCurrentUser } from "@/services/auth-utils"
import { borrowingService } from "@/services/borrowing.service"
import { maintenanceService, type Maintenance } from "@/services/maintenance.service"
import type { User } from "@/types/auth-types"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { assetSourceLabel, deriveAssetSource, maintenanceStatusLabel } from "@/utils/api-mappers"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import { formatDayTimeLabel } from "@/utils/format"
import { formatNoId } from "@/utils/record-id"
import { canManageMaintenanceStatusRole, isAdminOrLeaderRole, isTechnicianRole } from "@/utils/role"
import { matchesSearchKeyword } from "@/utils/search-keyword"

type MaintenanceExportColumn = TableExportColumn<Maintenance> & {
  defaultSelected?: boolean
}

const SectionHeader = ({ label }: { label: string }) => (
  <div className="rounded-2xl bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white">
    {label}
  </div>
)

type InfoRowProps = {
  label: string
  children: ReactNode
}

const InfoRow = ({ label, children }: InfoRowProps) => (
  <div className="grid grid-cols-1 gap-1 border-b border-blue-200/60 px-4 py-3 text-[14px] last:border-b-0 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-3">
    <span className="text-[13px] font-medium text-blue-900 sm:text-[14px]">
      {label}
    </span>
    <span className="text-[14px] font-normal text-foreground leading-snug">{children}</span>
  </div>
)

const getInventoryLockKey = (assetType: string | undefined, assetId: number, detailId?: string | null) => {
  const normalizedAssetType = assetType === "non_medical" ? "non_medical" : "medical"
  const baseKey = `${normalizedAssetType}|${assetId}`
  const normalizedDetailId = String(detailId || "").trim()
  return normalizedDetailId ? `${baseKey}|${normalizedDetailId}` : baseKey
}

const isAssetFallbackDetailId = (
  detailId: string | undefined | null,
  assetId: number,
  assetType?: string
) => {
  const normalizedDetailId = String(detailId || "").trim()
  if (!normalizedDetailId) return false
  const normalizedAssetType = assetType === "non_medical" ? "non_medical" : "medical"
  return (
    normalizedDetailId === `asset-${assetId}` ||
    normalizedDetailId === `asset-${normalizedAssetType}-${assetId}`
  )
}

export default function MaintenancePage() {
  const router = useRouter()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const activeMaintenanceStatuses = useMemo(
    () => new Set(["requested", "scheduled", "in_progress"]),
    []
  )
  const activeBorrowingStatuses = useMemo(
    () => new Set(["pending", "approved", "borrowed", "overdue"]),
    []
  )

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [assets, setAssets] = useState<DetailInventoryItem[]>([])
  const [activeBorrowingLocks, setActiveBorrowingLocks] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("Semua")

  // 1. Cek Autentikasi Pengguna
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
    } else {
      setCurrentUser(user)
    }
  }, [router])

  const loadMaintenance = async () => {
    try {
      const response = await maintenanceService.getAll({ page: 1, limit: 1000 })
      if (response.success) setMaintenance(response.data)
    } catch (error) {
      console.error("Error loading maintenance:", error)
    }
  }

  const loadAssets = async () => {
    try {
      const [medicalResponse, nonMedicalResponse] = await Promise.all([
        assetService.getMedicalAssets({ page: 1, limit: 1000 }),
        assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
      ])

      const combinedAssets = [
        ...(medicalResponse.success ? medicalResponse.data : []),
        ...(nonMedicalResponse.success ? nonMedicalResponse.data : []),
      ]

      const detailItems = flattenDetailInventories(combinedAssets, { includeAssetFallback: true })
      setAssets(detailItems)
    } catch (error) {
      console.error("Error loading assets:", error)
    }
  }

  const loadActiveBorrowingLocks = async () => {
    try {
      const response = await borrowingService.getAll({ page: 1, limit: 1000 })
      if (!response.success) {
        setActiveBorrowingLocks(new Set())
        return
      }

      const nextLocks = new Set<string>()
      response.data.forEach((record) => {
        if (!activeBorrowingStatuses.has(record.status)) return

        const assetId = Number(record.assetId)
        if (!Number.isFinite(assetId) || assetId <= 0) return

        if (
          record.assetDetailId &&
          !isAssetFallbackDetailId(record.assetDetailId, assetId, record.assetType)
        ) {
          nextLocks.add(
            getInventoryLockKey(record.assetType, assetId, record.assetDetailId)
          )
          return
        }

        nextLocks.add(getInventoryLockKey(record.assetType, assetId))
      })

      setActiveBorrowingLocks(nextLocks)
    } catch (error) {
      console.error("Error loading active borrowing locks:", error)
      setActiveBorrowingLocks(new Set())
    }
  }

  // 2. Muat Data Pemeliharaan dan Aset dari API
  useEffect(() => {
    let isMounted = true
    
    const loadAllData = async () => {
      if (!isMounted) return
      await Promise.all([
        loadMaintenance(),
        loadAssets(),
        loadActiveBorrowingLocks()
      ])
    }
    
    loadAllData()
    
    return () => {
      isMounted = false
    }
  }, [activeBorrowingStatuses])

  // Cek hak akses peran
  const hasFullAccess = isAdminOrLeaderRole(currentUser?.role)
  const isTechnician = isTechnicianRole(currentUser?.role)
  const canManageAdvancedStatuses = canManageMaintenanceStatusRole(currentUser?.role)

  const handleSaveMaintenance = async (data: any) => {
    if (!currentUser) {
      alert("Anda harus login terlebih dahulu")
      return
    }
    if (isTechnician) {
      alert("Role teknisi hanya dapat memperbarui status pemeliharaan")
      return
    }
    if (!data.assetId || !data.scheduledDate) {
      alert("Mohon lengkapi data pemeliharaan")
      return
    }

    try {
      const isEditing = Boolean(editingMaintenance)

      if (isEditing) {
        if (!hasFullAccess) {
          alert("Hanya Admin/Leader yang dapat mengedit jadwal pemeliharaan")
          return
        }

        const updatePayload: any = {
          assetId: Number(data.assetId),
          assetType: data.assetType,
          assetDetailId: data.assetDetailId,
          assetDetailName: data.assetDetailName,
          assetDetailCode: data.assetDetailCode,
          type: data.type,
          scheduledDate: data.scheduledDate,
          description: data.description || '',
          technician: data.technician || undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          status: data.status,
        }

        console.log("SELECTED ASSET ID (UPDATE):", updatePayload.assetId, updatePayload.assetDetailId)
        console.log("PAYLOAD (UPDATE):", updatePayload)
        const response = await maintenanceService.update(editingMaintenance.id, updatePayload)
        if (!response.success) {
          alert(response.message || "Gagal memperbarui jadwal pemeliharaan")
          return
        }
      } else {
        const newPayload = {
          assetId: Number(data.assetId),
          assetType: data.assetType,
          type: data.type,
          status: data.status,
          scheduledDate: data.scheduledDate,
          description: data.description || '',
          technician: data.technician || undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          createdBy: Number(currentUser.id),
        }
        console.log("SELECTED ASSET ID (CREATE):", newPayload.assetId, data.assetDetailId)
        console.log("PAYLOAD (CREATE):", { ...newPayload, assetDetailId: data.assetDetailId, assetDetailName: data.assetDetailName, assetDetailCode: data.assetDetailCode, assetLocation: data.assetLocation })

        const response = await maintenanceService.create({
          ...newPayload,
          assetDetailId: data.assetDetailId,
          assetDetailName: data.assetDetailName,
          assetDetailCode: data.assetDetailCode,
          assetLocation: data.assetLocation,
        })

        if (!response.success) {
          alert(response.message || "Gagal menambah jadwal pemeliharaan")
          return
        }
      }

      await loadMaintenance()
      await loadAssets()
      setShowForm(false)
      setEditingMaintenance(null)

      if (!isEditing) {
        toast({
          title: "Jadwal pemeliharaan berhasil ditambahkan",
          description: "Data jadwal pemeliharaan sudah tersimpan.",
        })
      }
    } catch (error: any) {
      // strip any accidental hostnames from the message before showing to user
      let msg = error?.message || "Gagal menyimpan jadwal pemeliharaan";
      msg = msg.replace(/https?:\/\/[\w.:-]+/g, '');
      alert(msg);
    }
  }

  const handleDeleteMaintenance = async (id: string | number) => {
    if (!hasFullAccess) {
      alert("Hanya Admin/Leader yang dapat menghapus jadwal pemeliharaan")
      return
    }
    const isConfirmed = await confirm({
      title: "Hapus jadwal pemeliharaan",
      description: "Apakah Anda yakin ingin menghapus jadwal ini?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return

    try {
      const response = await maintenanceService.delete(String(id))
      if (!response.success) {
        alert(response.message || "Gagal menghapus jadwal pemeliharaan")
        return
      }
      await loadMaintenance()
      await loadAssets()
    } catch (error: any) {
      alert(error?.message || "Gagal menghapus jadwal pemeliharaan")
    }
  }

  const handleEditMaintenance = (data: Maintenance) => {
    if (!hasFullAccess) {
      alert("Hanya Admin/Leader yang dapat mengedit jadwal pemeliharaan")
      return
    }
    setEditingMaintenance(data)
    setShowForm(true)
  }

  const handleUpdateStatus = async (id: string | number, newStatus: string) => {
    if (!currentUser) {
      alert("Anda harus login terlebih dahulu")
      return
    }

    const currentRecord = maintenance.find((item) => String(item.id) === String(id))
    if (currentRecord && ["completed", "cancelled"].includes(currentRecord.status)) {
      alert("Status pemeliharaan yang sudah Selesai atau Dibatalkan tidak dapat diubah lagi")
      return
    }

    if (!canManageAdvancedStatuses && newStatus === "cancelled") {
      alert("Hanya Admin/Leader/Teknisi yang dapat membatalkan pemeliharaan")
      return
    }

    if (!canManageAdvancedStatuses && newStatus === "completed") {
      alert("Hanya Admin/Leader/Teknisi yang dapat menandai pemeliharaan sebagai Selesai")
      return
    }

    try {
      if (newStatus === "completed") {
        const response = await maintenanceService.complete(String(id), undefined, undefined, Number(currentUser.id))
        if (!response.success) {
          alert(response.message || "Gagal menyelesaikan pemeliharaan")
          return
        }
      } else {
        const response = await maintenanceService.update(String(id), { status: newStatus as "scheduled" | "in_progress" | "completed" | "cancelled" })
        if (!response.success) {
          alert(response.message || "Gagal memperbarui status pemeliharaan")
          return
        }
      }

      await loadMaintenance()
      await loadAssets()

      if (newStatus === "in_progress") {
        toast({
          title: "Pemeliharaan sedang diproses",
          description: "Status pemeliharaan sudah diubah ke proses.",
        })
      } else if (newStatus === "completed") {
        toast({
          title: "Pemeliharaan selesai",
          description: "Status pemeliharaan sudah diperbarui menjadi selesai.",
        })
      } else if (newStatus === "cancelled") {
        toast({
          title: "Pemeliharaan ditolak",
          description: "Status pemeliharaan sudah diperbarui menjadi ditolak.",
        })
      }
    } catch (error: any) {
      alert(error?.message || "Gagal memperbarui status pemeliharaan")
    }
  }

  const detailLookup = useMemo(() => {
    const lookup = new Map<string, DetailInventoryItem>()
    for (const item of assets) {
      if (item.detailId) lookup.set(item.detailId, item)
    }
    return lookup
  }, [assets])

  const availableAssetsForForm = useMemo(() => {
    const lockedAssetKeys = new Set<string>()
    const lockedDetailKeys = new Set<string>()

    maintenance.forEach((record) => {
      if (!activeMaintenanceStatuses.has(record.status)) return

      const assetType = record.assetType === "non_medical" ? "non_medical" : "medical"
      const assetId = Number(record.assetId)
      if (!Number.isFinite(assetId) || assetId <= 0) return

      const baseKey = `${assetType}|${assetId}`
      if (record.assetDetailId && String(record.assetDetailId).trim()) {
        lockedDetailKeys.add(`${baseKey}|${String(record.assetDetailId)}`)
        return
      }

      lockedAssetKeys.add(baseKey)
    })

    return assets.filter((item) => {
      const baseKey = `${item.assetType}|${item.assetId}`
      if (lockedAssetKeys.has(baseKey)) return false
      if (lockedDetailKeys.has(`${baseKey}|${String(item.detailId)}`)) return false
      if (activeBorrowingLocks.has(baseKey)) return false
      return !activeBorrowingLocks.has(`${baseKey}|${String(item.detailId)}`)
    })
  }, [activeBorrowingLocks, activeMaintenanceStatuses, assets, maintenance])

  const resolveDetailForMaintenance = useCallback(
    (m: Maintenance) => {
      if (m.assetDetailId) {
        const detail = detailLookup.get(m.assetDetailId)
        if (detail) return detail
      }
      const fallbackByCode = assets.find((a) => a.assetId === m.assetId && a.detailCode === m.assetDetailCode)
      if (fallbackByCode) return fallbackByCode
      return assets.find((a) => a.assetId === m.assetId)
    },
    [assets, detailLookup]
  )

  const maintenanceFormAssets = useMemo(() => {
    if (!editingMaintenance) return availableAssetsForForm

    const allowedByDetailId = new Set(availableAssetsForForm.map((item) => item.detailId))
    const currentDetailId = editingMaintenance.assetDetailId

    if (currentDetailId && allowedByDetailId.has(currentDetailId)) {
      return availableAssetsForForm
    }

    const currentAsset = resolveDetailForMaintenance(editingMaintenance)
    if (!currentAsset) return availableAssetsForForm

    if (allowedByDetailId.has(currentAsset.detailId)) {
      return availableAssetsForForm
    }

    return [...availableAssetsForForm, currentAsset]
  }, [availableAssetsForForm, editingMaintenance, resolveDetailForMaintenance])

  const maintenanceExportColumnDefinitions = useMemo<MaintenanceExportColumn[]>(
    () => [
      {
        key: "noId",
        label: "No ID",
        getValue: (item) => getMaintenanceNoId(item),
        defaultSelected: true,
      },
      {
        key: "jenisInventaris",
        label: "Jenis Inventaris",
        getValue: (item) => {
          const detail = resolveDetailForMaintenance(item)
          const source = deriveAssetSource(detail?.assetType ?? item.assetType, detail?.detailCode ?? item.assetCode)
          return assetSourceLabel(source)
        },
        defaultSelected: true,
      },
      {
        key: "namaAlat",
        label: "Nama Alat",
        getValue: (item) => {
          const detail = resolveDetailForMaintenance(item)
          return (
            item.assetDetailName ||
            detail?.detailInventoryName ||
            detail?.detailName ||
            item.assetName ||
            "-"
          )
        },
        defaultSelected: true,
      },
      {
        key: "kode",
        label: "Kode",
        getValue: (item) => {
          const detail = resolveDetailForMaintenance(item)
          return item.assetDetailCode || detail?.detailCode || item.assetCode || "-"
        },
        defaultSelected: true,
      },
      {
        key: "peminjam",
        label: "Peminjam",
        getValue: (item) => item.requesterName || "-",
        defaultSelected: true,
      },
      {
        key: "nip",
        label: "NIP",
        getValue: (item) => item.requesterNip || "-",
        defaultSelected: true,
      },
      {
        key: "tanggalPinjam",
        label: "Tanggal Pinjam",
        getValue: (item) => formatDayTimeLabel(item.scheduledDate),
        defaultSelected: true,
      },
      {
        key: "tanggalKembali",
        label: "Tanggal Kembali",
        getValue: (item) =>
          item.completedDate ? new Date(item.completedDate).toLocaleDateString("id-ID") : "-",
        defaultSelected: true,
      },
      {
        key: "ruangan",
        label: "Nama Ruangan Alat",
        getValue: (item) => {
          const detail = resolveDetailForMaintenance(item)
          return detail?.roomName || detail?.assetLocation || item.assetLocation || "-"
        },
        defaultSelected: true,
      },
      {
        key: "catatan",
        label: "Catatan",
        getValue: (item) => item.description || item.notes || "-",
        defaultSelected: true,
      },
      {
        key: "status",
        label: "Status",
        getValue: (item) => maintenanceStatusLabel(item.status),
        defaultSelected: true,
      },
    ],
    [resolveDetailForMaintenance]
  )

  const [selectedMaintenanceColumns, setSelectedMaintenanceColumns] = useState<string[]>(() =>
    maintenanceExportColumnDefinitions.filter((column) => column.defaultSelected ?? true).map((column) => column.key)
  )
  const [selectedMaintenanceIds, setSelectedMaintenanceIds] = useState<Set<number>>(() => new Set())
  const [expandedMaintenanceIds, setExpandedMaintenanceIds] = useState<Set<number>>(() => new Set())

  const toggleCardCollapse = (id: number) => {
    setExpandedMaintenanceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const pendingCount = useMemo(
    () => maintenance.filter((m) => m.status === "scheduled" || m.status === "in_progress").length,
    [maintenance]
  )
  const getMaintenanceNoId = (item: Maintenance) => formatNoId("JDW", item.id, item.maintenanceCode)

  const filteredMaintenance = maintenance.filter((m) => {
    const detailInfo = resolveDetailForMaintenance(m)
    const searchableValues = [
      getMaintenanceNoId(m),
      m.maintenanceCode,
      formatNoId("AST", m.assetId),
      m.assetName,
      m.assetCode,
      m.assetDetailName,
      m.assetDetailCode,
      m.requesterName,
      m.requesterNip,
      detailInfo?.detailInventoryName,
      detailInfo?.detailName,
      detailInfo?.detailBrandModel,
      detailInfo?.detailCode,
      detailInfo?.assetName,
      detailInfo?.assetCode,
    ]
    const matchesSearch = matchesSearchKeyword(searchTerm, searchableValues)
    const matchesStatus = filterStatus === "Semua" || m.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const selectedMaintenanceRows = filteredMaintenance.filter((item) => selectedMaintenanceIds.has(item.id))
  const maintenanceRowsToExport =
    selectedMaintenanceRows.length > 0 ? selectedMaintenanceRows : filteredMaintenance

  const allMaintenanceSelected =
    filteredMaintenance.length > 0 && filteredMaintenance.every((item) => selectedMaintenanceIds.has(item.id))

  const handleSelectAllMaintenance = () => {
    if (allMaintenanceSelected) {
      setSelectedMaintenanceIds(new Set())
      return
    }
    setSelectedMaintenanceIds(new Set(filteredMaintenance.map((item) => item.id)))
  }

  const toggleMaintenanceSelection = (id: number) => {
    setSelectedMaintenanceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const maintenanceColumnsForExport = maintenanceExportColumnDefinitions.filter((column) =>
    selectedMaintenanceColumns.includes(column.key)
  )

  const exportMaintenanceTable = (
    format: ExportFormat,
    entries: Maintenance[],
    filePrefix: string,
    title: string
  ) => {
    if (!maintenanceColumnsForExport.length) return false
    const columns = maintenanceColumnsForExport.map((column) => column.label)
    const rows = buildTableExportRows(maintenanceColumnsForExport, entries)
    void exportTableData(format, {
      title,
      columns,
      rows,
      filePrefix,
    })
    return true
  }

  const handleMaintenanceExportColumnToggle = (columnKey: string) => {
    setSelectedMaintenanceColumns((previous) => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous
        return previous.filter((item) => item !== columnKey)
      }
      return [...previous, columnKey]
    })
  }

  const buildMaintenanceNarrativeSections = (columnKeys: string[]): SectionBuilder<Maintenance> => {
    const columnSet = new Set(columnKeys)
    return (item) => {
      const detail = resolveDetailForMaintenance(item)
      const maintenanceNoId = getMaintenanceNoId(item)
      const assetSource = deriveAssetSource(detail?.assetType ?? item.assetType, detail?.detailCode ?? item.assetCode)
      const assetTypeLabel = assetSourceLabel(assetSource)
      const assetName =
        item.assetDetailName || detail?.detailInventoryName || detail?.detailName || item.assetName || "-"
      const assetCode = item.assetDetailCode || detail?.detailCode || item.assetCode || "-"
      const scheduledLabel = formatDayTimeLabel(item.scheduledDate)
      const completedLabel = item.completedDate
        ? new Date(item.completedDate).toLocaleDateString("id-ID")
        : "-"
      const notesLabel = item.description || item.notes || "-"
      const statusLabel = maintenanceStatusLabel(item.status)
      const locationLabel = detail?.roomName || detail?.assetLocation || item.assetLocation || "-"

      const identities: SectionLine[] = []
      if (columnSet.has("noId")) {
        appendLine(identities, "No ID Jadwal", maintenanceNoId)
      }
      if (columnSet.has("jenisInventaris")) {
        appendLine(identities, "Jenis Inventaris", assetTypeLabel)
      }
      if (columnSet.has("namaAlat")) {
        appendLine(identities, "Nama Alat", assetName)
      }
      if (columnSet.has("kode")) {
        appendLine(identities, "Kode Alat", assetCode)
      }
      if (columnSet.has("ruangan")) {
        appendLine(identities, "Nama Ruangan Alat", locationLabel)
      }

      const details: SectionLine[] = []
      if (columnSet.has("tanggalPinjam")) {
        appendLine(details, "Tanggal Pinjam", scheduledLabel)
      }
      if (columnSet.has("tanggalKembali")) {
        appendLine(details, "Tanggal Kembali", completedLabel)
      }

      const logLines: SectionLine[] = []
      if (columnSet.has("peminjam")) {
        appendLine(logLines, "Peminjam", item.requesterName || "-")
      }
      if (columnSet.has("nip")) {
        appendLine(logLines, "NIP", item.requesterNip || "-")
      }
      if (columnSet.has("catatan")) {
        appendLine(logLines, "Catatan", notesLabel)
      }

      const statusLines: SectionLine[] = []
      if (columnSet.has("status")) {
        appendLine(statusLines, "Status", statusLabel)
      }

      const sections: DocumentSection[] = []
      if (identities.length) {
        sections.push({ title: "Informasi Dasar Alat", lines: identities })
      }
      if (details.length) {
        sections.push({ title: "Detail Pemeliharaan", lines: details })
      }
      if (logLines.length) {
        sections.push({ title: "Log Pelaksanaan & Validasi", lines: logLines })
      }
      if (statusLines.length) {
        sections.push({ title: "Status Akhir", lines: statusLines })
      }
      return sections
    }
  }

  const exportSingleNarrative = async (format: ExportFormat, item: Maintenance) => {
    if (format === "excel") {
      exportMaintenanceTable(format, [item], `jadwal-pemeliharaan-${item.id}`, "Daftar Jadwal Pemeliharaan")
      return
    }

    const columnKeys =
      maintenanceColumnsForExport.length > 0
        ? maintenanceColumnsForExport.map((column) => column.key)
        : maintenanceExportColumnDefinitions.map((column) => column.key)

    void exportNarrativeReport(format, {
      title: "Daftar Jadwal Pemeliharaan",
      subtitle: "LAPORAN PEMELIHARAAN",
      entries: [item],
      filePrefix: `jadwal-pemeliharaan-${item.id}`,
      buildSections: buildMaintenanceNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada jadwal pemeliharaan yang dipilih.",
    })
  }

  const handleExport = async (format: ExportFormat) => {
    if (!maintenanceRowsToExport.length) return
    if (format === "excel") {
      exportMaintenanceTable(format, maintenanceRowsToExport, "jadwal-pemeliharaan", "Daftar Jadwal Pemeliharaan")
      return
    }

    const columnKeys =
      maintenanceColumnsForExport.length > 0
        ? maintenanceColumnsForExport.map((column) => column.key)
        : maintenanceExportColumnDefinitions.map((column) => column.key)

    void exportNarrativeReport(format, {
      title: "Daftar Jadwal Pemeliharaan",
      subtitle: "LAPORAN PEMELIHARAAN",
      entries: maintenanceRowsToExport,
      filePrefix: "jadwal-pemeliharaan",
      buildSections: buildMaintenanceNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada jadwal pemeliharaan yang dipilih.",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "destructive"
      case "in_progress":
        return "secondary"
      case "completed":
        return "default"
      case "cancelled":
        return "secondary"
      default:
        return "default"
    }
  }

  return (
    <main
      className="min-h-full bg-linear-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}
    >
      <div className="py-6 px-4 lg:px-10">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <section className="rounded-3xl border border-teal-100/80 bg-white/95 p-4 shadow-2xl backdrop-blur-sm dark:border-teal-900/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5 items-center">
                <div className="p-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Jadwal Pemeliharaan</h1>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    & validasi pemeliharaan sesuai dokumentasi Monitor jadwal
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-200 text-[11px]">
                      
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!isTechnician && (
                  <Button
                    size="sm"
                    className="rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700"
                    onClick={() => {
                      setEditingMaintenance(null)
                      setShowForm(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah Jadwal
                  </Button>
                )}
              </div>
            </div>
          </section>

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Sedang Berjalan</p>
                    <p className="text-xl font-semibold text-teal-600 mt-1">{pendingCount.toLocaleString("id-ID")}</p>
                  </div>
                  <Wrench className="h-4 w-4 text-teal-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Validasi & Akses</p>
                    <p className="text-[13px] text-foreground mt-1">
                      {canManageAdvancedStatuses
                        ? "Ubah status hingga selesai"
                        : "Hanya lihat & kirim progress"}
                    </p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Mode Akses</p>
                    <p className="text-[13px] text-foreground mt-1">
                      {isTechnician ? "Teknisi" : hasFullAccess ? "Admin/Leader" : "Terbatas"}
                    </p>
                  </div>
                  <UserCheck className="h-4 w-4 text-indigo-500 shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>

        {showForm && (
          <MaintenanceForm
            maintenance={editingMaintenance}
            assets={maintenanceFormAssets}
            onSave={handleSaveMaintenance}
            onCancel={() => {
              setShowForm(false)
              setEditingMaintenance(null)
            }}
          />
        )}

        <Card className="rounded-3xl border border-slate-200 bg-white/70 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Daftar Pemeliharaan</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Total: {filteredMaintenance.length} jadwal
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-2xl px-3">
                      <Download className="mr-2 h-4 w-4" />
                      Ekspor
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-52">
                    <DropdownMenuLabel>Pilih kolom</DropdownMenuLabel>
                    <div className="max-h-52 overflow-y-auto">
                      {maintenanceExportColumnDefinitions.map((column) => (
                        <DropdownMenuCheckboxItem
                          key={`maintenance-column-${column.key}`}
                          checked={selectedMaintenanceColumns.includes(column.key)}
                          onCheckedChange={() => handleMaintenanceExportColumnToggle(column.key)}
                        >
                          {column.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Ekspor daftar</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void handleExport("pdf")}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExport("word")}>Word</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExport("excel")}>Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-2xl px-3 text-[14px] font-semibold"
                  onClick={handleSelectAllMaintenance}
                >
                  {allMaintenanceSelected ? "Batal pilih semua" : "Pilih semua"}
                </Button>
                <span className="text-[13px] text-muted-foreground">
                  {selectedMaintenanceRows.length
                    ? `${selectedMaintenanceRows.length} baris dipilih`
                    : `Semua ${filteredMaintenance.length} baris siap cetak`}
                </span>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
              <div>
                <label className="sr-only">Cari jadwal pemeliharaan</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cari No ID, inventaris, atau kode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-border/80 bg-background px-11 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                  />
                </div>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-2xl border border-border/80 bg-background px-4 py-2 text-[14px] text-foreground transition focus:border-teal-500"
              >
                <option>Semua</option>
                <option value="scheduled">Tertunda</option>
                <option value="in_progress">Proses</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="px-0">
          {filteredMaintenance.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-[13px]">Belum ada jadwal pemeliharaan</p>
          ) : (
            <div className="max-h-180 overflow-y-auto px-4 pb-6 pr-2">
              <div className="space-y-6">
                {filteredMaintenance.map((m) => {
                const detailInfo = resolveDetailForMaintenance(m)

                const inventoryTypeSource = deriveAssetSource(
                  detailInfo?.assetType ?? m.assetType,
                  detailInfo?.detailCode ?? m.assetCode
                )

                const inventoryTypeLabel = assetSourceLabel(inventoryTypeSource)

                const inventoryName =
                  m.assetDetailName ||
                  detailInfo?.detailInventoryName ||
                  detailInfo?.detailName ||
                  m.assetName ||
                  "-"
                const maintenanceNoId = getMaintenanceNoId(m)

                const codeLabel = m.assetDetailCode || detailInfo?.detailCode || m.assetCode || "-"
                const roomNameLabel = detailInfo?.roomName || detailInfo?.assetLocation || m.assetLocation || "-"

                const brandModel =
                  detailInfo?.detailBrandModel ||
                  detailInfo?.detailName ||
                  m.description ||
                  "-"

                const scheduledLabel = formatDayTimeLabel(m.scheduledDate, { showWeekday: true })
                const completionLabel = m.completedDate
                  ? formatDayTimeLabel(m.completedDate, { showWeekday: true })
                  : "-"

                const costNumber =
                  typeof m.cost === "number"
                    ? m.cost
                    : m.cost
                      ? Number(m.cost)
                      : undefined
                const costLabel = costNumber ? `Rp ${costNumber.toLocaleString("id-ID")}` : "-"

                const registrationNote = m.description || "-"
                const afterNotesLabel = m.notes || "-"

                const isExpanded = expandedMaintenanceIds.has(m.id)

                  return (
                    <div
                      key={String(m.id)}
                      className="overflow-hidden rounded-4xl border border-blue-100/80 bg-linear-to-b from-white via-white to-slate-50 shadow-xl shadow-blue-100"
                    >
                    <div className="flex items-center justify-between gap-3 rounded-t-4xl bg-linear-to-r from-blue-600 to-sky-800 px-6 py-3 text-[14px] font-semibold text-white">
                      <span>Informasi Dasar Alat</span>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-white hover:bg-blue-500/60"
                          onClick={() => toggleCardCollapse(m.id)}
                          aria-label={isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-5 bg-white/80 px-6 py-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[14px] font-normal text-slate-900 dark:text-slate-100 truncate">{inventoryName}</p>
                          <p className="text-[13px] text-muted-foreground">{codeLabel}</p>
                          <p className="text-[13px] text-muted-foreground">No ID: {maintenanceNoId}</p>
                          <p className="text-[13px] text-muted-foreground">
                            Identitas: {m.requesterName || "-"} / {m.requesterNip || "-"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[12px]">
                              {inventoryTypeLabel}
                            </Badge>
                            <Badge variant="outline" className="text-[12px]">
                              {roomNameLabel}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 sm:items-end">
                          <span className="text-[13px] text-muted-foreground">Jadwal Pemeliharaan</span>
                          <span className="text-[14px] font-normal text-foreground">{scheduledLabel}</span>
                          <div>
                            <Badge variant={getStatusColor(m.status)} className="text-[14px]">
                              {maintenanceStatusLabel(m.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="space-y-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-3">
                              <SectionHeader label="Informasi Dasar Alat" />
                              <div className="rounded-[28px] border border-blue-100 bg-blue-50/80">
                                <InfoRow label="Jenis Inventaris" >{inventoryTypeLabel}</InfoRow>
                                <InfoRow label="No ID Jadwal" >{maintenanceNoId}</InfoRow>
                                <InfoRow label="Nama Alat" >{inventoryName}</InfoRow>
                                <InfoRow label="Kode Alat" >{codeLabel}</InfoRow>
                                <InfoRow label="Nama Ruangan Alat" >{roomNameLabel}</InfoRow>
                                <InfoRow label="Merek / Model" >{brandModel}</InfoRow>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <SectionHeader label="Detail Administrasi" />
                              <div className="rounded-[28px] border border-blue-100 bg-blue-50/80">
                                <InfoRow label="Nama Pengirim">{m.requesterName || "-"}</InfoRow>
                                <InfoRow label="NIP Pengirim">{m.requesterNip || "-"}</InfoRow>
                                <InfoRow label="Jadwal Pemeliharaan">{scheduledLabel}</InfoRow>
                                <InfoRow label="Catatan Pendaftaran">{registrationNote}</InfoRow>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <SectionHeader label="Pelaksanaan & Biaya" />
                              <div className="rounded-[28px] border border-blue-100 bg-blue-50/80">
                                <InfoRow label="Teknisi Pelaksana">{m.technician || "-"}</InfoRow>
                                <InfoRow label="Waktu Selesai">{completionLabel}</InfoRow>
                                <InfoRow label="Biaya Pemeliharaan">{costLabel}</InfoRow>
                                <InfoRow label="Catatan (After)">{afterNotesLabel}</InfoRow>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900">
                          Tekan panah untuk membuka detail pemeliharaan.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-blue-100 px-6 pb-5 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={selectedMaintenanceIds.has(m.id)}
                          onChange={() => toggleMaintenanceSelection(m.id)}
                          className="h-4 w-4 rounded border border-blue-300 bg-white text-blue-600"
                          aria-label={`Pilih jadwal pemeliharaan ${m.assetDetailName || m.assetName || ""}`}
                        />
                        Pilih kartu
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        {!(["completed", "cancelled"].includes(m.status)) ? (
                          <select
                            value={m.status}
                            onChange={(e) => handleUpdateStatus(m.id, e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-border bg-slate-50 text-[14px]"
                          >
                            <option value="scheduled">Tertunda</option>
                            <option value="in_progress">Proses</option>
                            {canManageAdvancedStatuses && <option value="completed">Selesai</option>}
                            {canManageAdvancedStatuses && <option value="cancelled">Dibatalkan</option>}
                          </select>
                        ) : (
                          <Badge variant={getStatusColor(m.status)} className="text-[14px]">
                            {maintenanceStatusLabel(m.status)}
                          </Badge>
                        )}

                        <div className="flex items-center gap-1">
                          {hasFullAccess ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleEditMaintenance(m)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteMaintenance(m.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-[13px] text-muted-foreground">-</span>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Download className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void exportSingleNarrative("pdf", m)}>
                              PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void exportSingleNarrative("word", m)}>
                              Word
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void exportSingleNarrative("excel", m)}>
                              Excel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
	        </CardContent>
        </Card>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan Sistem Informasi Inventaris dan Pemeliharaan Sarana
            Prasarana Peminjaman
          </p>
	        </div>
	      </div>
	    </div>
	    </main>
  )
}
