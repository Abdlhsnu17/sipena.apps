'use client'

import { buildLoginRedirectUrl } from "@/services/auth-utils"
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
    Wrench,
    XCircle
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import MaintenanceForm from "@/components/maintenance-form"
import MaintenanceHistoryList from "@/components/maintenance-history-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
import { canCreateMaintenanceRole, canManageMaintenanceStatusRole, isAdminOrLeaderRole, isTechnicianRole } from "@/utils/role"
import { matchesSearchKeyword } from "@/utils/search-keyword"

type MaintenanceExportColumn = TableExportColumn<Maintenance> & {
  defaultSelected?: boolean
}

const SectionHeader = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
    {label}
  </div>
)

type InfoRowProps = {
  label: string
  children: ReactNode
}

const InfoRow = ({ label, children }: InfoRowProps) => (
  <div className="detail-labeled-row border-b border-slate-200 last:border-b-0">
    <span className="font-medium text-slate-600">
      {label}
    </span>
    <span className="font-medium text-slate-900 leading-snug">{children}</span>
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

const isBorrowingLockRecord = (record: { status: string; returnValidatedAt?: string | null }) =>
  ["pending", "approved", "borrowed", "overdue"].includes(record.status) ||
  (record.status === "returned" && !record.returnValidatedAt)

const MAINTENANCE_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["validated", "in_progress"],
  validated: [],
  cancelled: [],
}

const getSelectableStatuses = (currentStatus: string) => [
  currentStatus,
  ...(MAINTENANCE_STATUS_TRANSITIONS[currentStatus] || []),
]

export default function MaintenancePage() {
  const router = useRouter()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const activeMaintenanceStatuses = useMemo(
    () => new Set(["scheduled", "in_progress", "completed"]),
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
  const [isMaintenanceMinimized, setIsMaintenanceMinimized] = useState(false)
  const [isHistoryMinimized, setIsHistoryMinimized] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    maintenanceId: number | string
    previousStatus: string
    cancellationReason: string
  } | null>(null)

  // 1. Cek Autentikasi Pengguna
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
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
        if (!isBorrowingLockRecord(record)) return

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
  }, [])

  // Cek hak akses peran
  const hasFullAccess = isAdminOrLeaderRole(currentUser?.role)
  const isTechnician = isTechnicianRole(currentUser?.role)
  const canCreateMaintenance = canCreateMaintenanceRole(currentUser?.role)
  const canEditMaintenance = hasFullAccess || isTechnician
  const canManageAdvancedStatuses = canManageMaintenanceStatusRole(currentUser?.role)

  const handleStatusSelection = (id: string | number, newStatus: string) => {
    if (newStatus === "cancelled") {
      const currentRecord = maintenance.find((item) => String(item.id) === String(id))
      setPendingStatusChange({
        maintenanceId: id,
        previousStatus: currentRecord?.status ?? "scheduled",
        cancellationReason: currentRecord?.cancellationReason ?? "",
      })
      return
    }

    void handleUpdateStatus(id, newStatus)
  }

  const handleCancelStatusChange = () => {
    setPendingStatusChange(null)
  }

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusChange || !currentUser) return

    const cancellationReason = pendingStatusChange.cancellationReason.trim()
    if (!cancellationReason) {
      alert("Alasan pembatalan wajib diisi")
      return
    }

    try {
      const response = await maintenanceService.update(String(pendingStatusChange.maintenanceId), {
        status: "cancelled",
        cancellationReason,
      })

      if (!response.success) {
        alert(response.message || "Gagal memperbarui status pemeliharaan")
        return
      }

      await loadMaintenance()
      await loadAssets()
      toast({
        title: "Pemeliharaan sarana dibatalkan",
        description: "Status pemeliharaan sudah diperbarui menjadi dibatalkan.",
      })
    } catch (error: any) {
      alert(error?.message || "Gagal memperbarui status pemeliharaan")
    } finally {
      setPendingStatusChange(null)
    }
  }

  const handlePendingReasonChange = (value: string) => {
    if (!pendingStatusChange) return
    setPendingStatusChange({ ...pendingStatusChange, cancellationReason: value })
  }

  const handleSaveMaintenance = async (data: any) => {
    if (!currentUser) {
      alert("Anda harus login terlebih dahulu")
      return
    }
    if (!data.assetId || !data.scheduledDate) {
      alert("Mohon lengkapi data pemeliharaan")
      return
    }

    try {
      const isEditing = Boolean(editingMaintenance)

      if (isEditing) {
        if (!canEditMaintenance) {
          alert("Anda tidak memiliki izin untuk mengedit jadwal pemeliharaan")
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
          cancellationReason: data.cancellationReason?.trim() || undefined,
        }

        console.log("SELECTED ASSET ID (UPDATE):", updatePayload.assetId, updatePayload.assetDetailId)
        console.log("PAYLOAD (UPDATE):", updatePayload)
        const currentMaintenance = editingMaintenance
        if (!currentMaintenance) {
          return
        }
        const response = await maintenanceService.update(currentMaintenance.id, updatePayload)
        if (!response.success) {
          alert(response.message || "Gagal memperbarui jadwal pemeliharaan")
          return
        }
      } else {
        if (!canCreateMaintenance) {
          alert("Hanya Admin, Leader, Staff PJ, dan Staff Pelayanan yang dapat menambah pemelirahaan sarana")
          return
        }

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
          cancellationReason: data.cancellationReason?.trim() || undefined,
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
          alert(response.message || "Gagal menambah pemelirahaan sarana")
          return
        }
      }

      await loadMaintenance()
      await loadAssets()
      setShowForm(false)
      setEditingMaintenance(null)
      window.scrollTo(0, 500)

      if (!isEditing) {
        toast({
          title: "Pemelirahaan sarana berhasil ditambahkan",
          description: "Data pemelirahaan sarana sudah tersimpan.",
        })
      }
    } catch (error: any) {
      // strip any accidental hostnames from the message before showing to user
      let msg = error?.message || "Gagal menyimpan pemelirahaan sarana";
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
    if (!canEditMaintenance) {
      alert("Anda tidak memiliki izin untuk mengedit jadwal pemeliharaan")
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
    if (!currentRecord) {
      alert("Data pemeliharaan tidak ditemukan")
      return
    }

    if (["validated", "cancelled"].includes(currentRecord.status)) {
      alert("Status pemeliharaan yang sudah selesai final atau dibatalkan tidak dapat diubah lagi")
      return
    }

    if (!canManageAdvancedStatuses) {
      alert("Hanya Admin/Leader/Teknisi yang dapat mengubah alur status pemeliharaan")
      return
    }

    if (newStatus === currentRecord.status) {
      return
    }

    const allowedTransitions = MAINTENANCE_STATUS_TRANSITIONS[currentRecord.status] || []
    if (!allowedTransitions.includes(newStatus)) {
      alert("Transisi status tidak valid untuk tahap pemeliharaan saat ini")
      return
    }

    try {
      if (newStatus === "completed") {
        const response = await maintenanceService.complete(String(id), undefined, undefined, Number(currentUser.id))
        if (!response.success) {
          alert(response.message || "Gagal menyelesaikan pemeliharaan")
          return
        }
      } else if (["requested", "scheduled", "in_progress", "validated", "cancelled"].includes(newStatus)) {
        const response = await maintenanceService.update(String(id), {
          status: newStatus as "requested" | "scheduled" | "in_progress" | "validated" | "cancelled",
        })
        if (!response.success) {
          alert(response.message || "Gagal memperbarui status pemeliharaan")
          return
        }
      }

      await loadMaintenance()
      await loadAssets()
      window.dispatchEvent(new Event("inventory-refresh"))

      if (newStatus === "scheduled") {
        toast({
          title: "Pemeliharaan disetujui",
          description: "Pengajuan pemeliharaan sudah masuk ke tahap persetujuan.",
        })
      } else if (newStatus === "in_progress") {
        toast({
          title: "Pemeliharaan sarana di proses",
          description: "Status pemeliharaan sudah diubah ke tahap di proses.",
        })
      } else if (newStatus === "completed") {
        toast({
          title: "Perbaikan selesai",
          description: "Status pemeliharaan sudah masuk ke tahap menunggu validasi.",
        })
      } else if (newStatus === "validated") {
        toast({
          title: "Pemeliharaan selesai final",
          description: "Pemeliharaan telah lolos validasi akhir.",
        })
      } else if (newStatus === "cancelled") {
        toast({
          title: "Pemelirahaan sarana ditolak",
          description: "Status pemeliharaan sudah diperbarui menjadi ditolak atau dibatalkan.",
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

  const submissionCount = useMemo(
    () => maintenance.filter((m) => ["requested", "scheduled"].includes(m.status)).length,
    [maintenance]
  )
  const inProgressCount = useMemo(
    () => maintenance.filter((m) => m.status === "in_progress").length,
    [maintenance]
  )
  const awaitingValidationCount = useMemo(
    () => maintenance.filter((m) => m.status === "completed").length,
    [maintenance]
  )
  const completedCount = useMemo(
    () => maintenance.filter((m) => m.status === "validated").length,
    [maintenance]
  )
  const cancelledCount = useMemo(
    () => maintenance.filter((m) => m.status === "cancelled").length,
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
        sections.push({ title: "Detail Pemelirahaan Sarana", lines: details })
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
      exportMaintenanceTable(format, [item], `pemelirahaan-sarana-${item.id}`, "Daftar Pemelirahaan Sarana")
      return
    }

    const columnKeys =
      maintenanceColumnsForExport.length > 0
        ? maintenanceColumnsForExport.map((column) => column.key)
        : maintenanceExportColumnDefinitions.map((column) => column.key)

    void exportNarrativeReport(format, {
      title: "Daftar Pemelirahaan Sarana",
      subtitle: "LAPORAN PEMELIHARAAN",
      entries: [item],
      filePrefix: `jadwal-pemeliharaan-${item.id}`,
      buildSections: buildMaintenanceNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada pemelirahaan sarana yang dipilih.",
    })
  }

  const handleExport = async (format: ExportFormat) => {
    if (!maintenanceRowsToExport.length) return
    if (format === "excel") {
      exportMaintenanceTable(format, maintenanceRowsToExport, "pemelirahaan-sarana", "Daftar Pemelirahaan Sarana")
      return
    }

    const columnKeys =
      maintenanceColumnsForExport.length > 0
        ? maintenanceColumnsForExport.map((column) => column.key)
        : maintenanceExportColumnDefinitions.map((column) => column.key)

    void exportNarrativeReport(format, {
      title: "Daftar Pemelirahaan Sarana",
      subtitle: "LAPORAN PEMELIHARAAN",
      entries: maintenanceRowsToExport,
      filePrefix: "jadwal-pemeliharaan",
      buildSections: buildMaintenanceNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada pemelirahaan sarana yang dipilih.",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "requested":
        return "outline"
      case "scheduled":
        return "secondary"
      case "in_progress":
        return "secondary"
      case "completed":
        return "outline"
      case "validated":
        return "default"
      case "cancelled":
        return "destructive"
      default:
        return "default"
    }
  }

  return (
    <main
      className="min-h-full bg-linear-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}
      data-maintenance-page
    >
      <div className="p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5 items-center">
                <div className="p-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Pemelirahaan Sarana</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Monitoring jadwal, proses perbaikan, dan validasi pemeliharaan.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-200 text-[11px]">
                      Pemeliharaan aktif
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {canCreateMaintenance && (
                  <Button
                    size="sm"
                    className="rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700"
                    onClick={() => {
                      setEditingMaintenance(null)
                      setShowForm(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah Pemeliharaan
                  </Button>
                )}
              </div>
            </div>
          </section>

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70" data-maintenance-summary>
            <CardContent className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50/70 dark:bg-slate-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Diajukan / Disetujui</p>
                    <p className="text-xl font-semibold text-slate-700 mt-1">{submissionCount.toLocaleString("id-ID")}</p>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-slate-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Di Proses</p>
                    <p className="text-xl font-semibold text-teal-600 mt-1">{inProgressCount.toLocaleString("id-ID")}</p>
                  </div>
                  <Wrench className="h-4 w-4 text-teal-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Sedang Dalam Pengerjaan</p>
                    <p className="text-xl font-semibold text-foreground mt-1">{awaitingValidationCount.toLocaleString("id-ID")}</p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 p-3">
                    <div>
                      <p className="text-[12px] text-muted-foreground">Selesai Pemeliharaan Sarana</p>
                      <p className="text-xl font-semibold text-foreground mt-1">{completedCount.toLocaleString("id-ID")}</p>
                    </div>
                    <UserCheck className="h-4 w-4 text-indigo-500 shrink-0" />
                  </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Ditolak / Dibatalkan</p>
                    <p className="text-xl font-semibold text-rose-600 mt-1">{cancelledCount.toLocaleString("id-ID")}</p>
                  </div>
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
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

        <Card className="rounded-3xl border border-slate-200 bg-white/70 shadow-xl dark:border-slate-700 dark:bg-slate-900/70" data-maintenance-list>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Daftar Pemelirahaan Sarana</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Total: {filteredMaintenance.length} jadwal
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMaintenanceMinimized((prev) => !prev)}
                  className="rounded-2xl px-3"
                >
                  {isMaintenanceMinimized ? (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Tampilkan
                    </>
                  ) : (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Sembunyikan
                    </>
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-2xl px-3">
                      <Download className="mr-2 h-4 w-4" />
                      Ekspor
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-[min(92vw,13rem)]">
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
          </CardHeader>
          <CardContent className="px-0">
            {isMaintenanceMinimized ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900">
                Section jadwal pemeliharaan disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px] px-6 pb-3">
                  <div>
                    <label className="sr-only">Cari jadwal pemeliharaan</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Cari No ID, inventaris, atau kode..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                      />
                    </div>
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-xl border border-border/80 bg-background px-4 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                  >
                    <option>Semua</option>
                    <option value="requested">Diajukan</option>
                    <option value="scheduled">Disetujui</option>
                    <option value="in_progress">Diproses</option>
                    <option value="completed">Sedang Dalam Pengerjaan</option>
                    <option value="validated">Selesai</option>
                    <option value="cancelled">Ditolak / Dibatalkan</option>
                  </select>
                </div>
                {filteredMaintenance.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-[13px]">Belum ada jadwal pemeliharaan</p>
                ) : (
                  <div className="max-h-180 overflow-y-auto px-3 pb-4 pr-2 sm:px-4 sm:pb-6">
                    <div className="space-y-4">
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
                const cancellationReasonLabel = m.cancellationReason || "-"

                const isExpanded = expandedMaintenanceIds.has(m.id)

                return (
                  <div
                    key={String(m.id)}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                      <span>Informasi Dasar Alat</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 rounded-lg p-0 text-slate-700 hover:bg-slate-200"
                          onClick={() => toggleCardCollapse(m.id)}
                          aria-label={isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>

                    {!isExpanded && (
                      <div className="space-y-2.5 bg-white px-3 py-3 sm:px-3 sm:py-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{inventoryName}</p>
                            <p className="text-[12px] font-medium text-slate-700">{codeLabel}</p>
                            <div className="mt-1.5 space-y-1.5">
                              <p className="text-[11px] text-muted-foreground">No ID: {maintenanceNoId}</p>
                              <p className="text-[11px] text-muted-foreground">
                                Identitas Karyawan: <span className="font-medium text-slate-700">{m.requesterName || "-"} / {m.requesterNip || "-"}</span>
                              </p>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <Badge variant="outline" className="text-[10px]">
                                {inventoryTypeLabel}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {roomNameLabel}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Jadwal Pemeliharaan</span>
                              <span className="text-[13px] font-semibold text-foreground">{scheduledLabel}</span>
                            </div>
                            <div>
                              <Badge variant={getStatusColor(m.status)} className="text-[12px]">
                                {maintenanceStatusLabel(m.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {isExpanded && (
                      <div className="space-y-3 bg-white px-3 py-3 sm:px-3 sm:py-3">
                        <div className="columns-1 gap-3 lg:columns-2">
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Informasi Dasar Alat" />
                            <div className="rounded-xl border border-slate-200 bg-white">
                              <InfoRow label="Jenis Inventaris">{inventoryTypeLabel}</InfoRow>
                              <InfoRow label="No ID Jadwal">{maintenanceNoId}</InfoRow>
                              <InfoRow label="Nama Alat">{inventoryName}</InfoRow>
                              <InfoRow label="Kode Alat">{codeLabel}</InfoRow>
                              <InfoRow label="Nama Ruangan Alat">{roomNameLabel}</InfoRow>
                              <InfoRow label="Merek / Model">{brandModel}</InfoRow>
                            </div>
                          </div>
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Detail Administrasi" />
                            <div className="rounded-xl border border-slate-200 bg-white">
                              <InfoRow label="Nama Pengirim">{m.requesterName || "-"}</InfoRow>
                              <InfoRow label="NIP Pengirim">{m.requesterNip || "-"}</InfoRow>
                              <InfoRow label="Jadwal Pemelirahaan Sarana">{scheduledLabel}</InfoRow>
                              <InfoRow label="Catatan Pendaftaran">{registrationNote}</InfoRow>
                            </div>
                          </div>
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Pelaksanaan & Biaya" />
                            <div className="rounded-xl border border-slate-200 bg-white">
                              <InfoRow label="Teknisi Pelaksana">{m.technician || "-"}</InfoRow>
                              <InfoRow label="Waktu Selesai">{completionLabel}</InfoRow>
                              <InfoRow label="Biaya Pemeliharaan">{costLabel}</InfoRow>
                              <InfoRow label="Catatan (After)">{afterNotesLabel}</InfoRow>
                              {m.status === "cancelled" && (
                                <InfoRow label="Alasan Pembatalan">{cancellationReasonLabel}</InfoRow>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 border-t border-slate-200 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:pb-3">
                      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={selectedMaintenanceIds.has(m.id)}
                          onChange={() => toggleMaintenanceSelection(m.id)}
                          className="h-4 w-4 rounded border border-slate-300 bg-white text-slate-700"
                          aria-label={`Pilih jadwal pemeliharaan ${m.assetDetailName || m.assetName || ""}`}
                        />
                        Pilih kartu
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        {canManageAdvancedStatuses && getSelectableStatuses(m.status).length > 1 ? (
                          <select
                            value={m.status}
                            onChange={(e) => handleStatusSelection(m.id, e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-border bg-slate-50 text-[14px]"
                          >
                            {getSelectableStatuses(m.status).map((status) => (
                              <option key={`${m.id}-${status}`} value={status}>
                                {maintenanceStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : null}

                        <div className="flex items-center gap-1">
                          {canEditMaintenance ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-lg p-0"
                                onClick={() => handleEditMaintenance(m)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              {hasFullAccess && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                    className="h-8 w-8 rounded-lg p-0 text-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteMaintenance(m.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
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
          </>
        )}
          </CardContent>
        </Card>

        {/* Riwayat Pemeliharaan Sarana */}
        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700 dark:bg-slate-900/70" data-maintenance-history>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Riwayat Pemeliharaan Sarana</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Riwayat lengkap pemeliharaan yang telah selesai dan divalidasi
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsHistoryMinimized((prev) => !prev)}
                className="rounded-2xl px-3"
              >
                {isHistoryMinimized ? (
                  <>
                    <ChevronDown className="mr-2 h-4 w-4" />
                    Tampilkan
                  </>
                ) : (
                  <>
                    <ChevronUp className="mr-2 h-4 w-4" />
                    Sembunyikan
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {isHistoryMinimized ? (
              <div className="rounded-2xl border border-green-100 bg-green-50/80 px-4 py-4 text-center text-[14px] text-green-900">
                Section riwayat pemeliharaan disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
                {currentUser ? (
                  <MaintenanceHistoryList
                    user={currentUser}
                    assets={assets}
                    maintenance={maintenance}
                    onRefresh={loadMaintenance}
                    disableWrapper={true}
                  />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Memuat data pengguna...
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(pendingStatusChange)} onOpenChange={(open) => !open && setPendingStatusChange(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Alasan Pembatalan</DialogTitle>
              <DialogDescription>
                Masukkan alasan pembatalan pemeliharaan agar perubahan status tercatat dengan jelas.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Alasan Pembatalan</label>
                <Input
                  value={pendingStatusChange?.cancellationReason ?? ""}
                  onChange={(event) => handlePendingReasonChange(event.target.value)}
                  placeholder="Contoh: Salah input, Jadwal berubah, Alat masih layak pakai"
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={handleCancelStatusChange} type="button">
                  Batal
                </Button>
                <Button onClick={handleConfirmStatusChange} type="button">
                  Simpan Pembatalan
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan Sistem Informasi Inventaris dan Pemeliharaan Sarana
            Prasarana Peminjaman
          </p>
	        </div>
	      </div>
	    </div>

      {canCreateMaintenance && !showForm && (
        <div className="fab-safe-area fixed z-40 xl:hidden">
          <Button
            size="sm"
            className="h-11 rounded-full bg-teal-600 px-4 text-white shadow-xl hover:bg-teal-700"
            onClick={() => {
              setEditingMaintenance(null)
              setShowForm(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pemelirahaan
          </Button>
        </div>
      )}
	    </main>
  )
}
