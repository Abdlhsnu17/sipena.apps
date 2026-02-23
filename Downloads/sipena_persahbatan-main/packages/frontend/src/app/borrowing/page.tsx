"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { assetService } from "@/services/asset.service"
import { getCurrentUser } from "@/services/auth-utils"
import { borrowingService, type Borrowing as ApiBorrowing } from "@/services/borrowing.service"
import type { User } from "@/types/auth-types"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import {
  assetSourceLabel,
  borrowingStatusLabel,
  deriveAssetSource,
  type AssetSourceKey,
} from "@/utils/api-mappers"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import { formatBracketedDateTime, formatDateId } from "@/utils/format"
import { buildInventorySearchKey } from "@/utils/inventory-search"

import InventoryPicker from "@/components/inventory-picker"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, Download, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ExportFormat,
  appendLine,
  exportNarrativeReport,
  SectionBuilder,
  type DocumentSection,
  type SectionLine,
} from "@/utils/export-table"

type BorrowableAsset = DetailInventoryItem

type BorrowingExportColumn = {
  key: string
  label: string
  getValue: (borrowing: ApiBorrowing) => string
  defaultSelected?: boolean
}

const borrowingExportColumnDefinitions: BorrowingExportColumn[] = [
  {
    key: "jenisInventaris",
    label: "Jenis Inventaris",
    getValue: (borrowing) =>
      borrowing.assetType === "medical"
        ? "Medis"
        : borrowing.assetType === "non_medical"
          ? "Non-Medis"
          : "-",
    defaultSelected: true,
  },
  {
    key: "namaAlat",
    label: "Nama Alat",
    getValue: (borrowing) => borrowing.assetDetailName || borrowing.assetName || "-",
    defaultSelected: true,
  },
  {
    key: "kode",
    label: "Kode",
    getValue: (borrowing) => borrowing.assetDetailCode || borrowing.assetCode || "-",
    defaultSelected: true,
  },
  {
    key: "peminjam",
    label: "Peminjam",
    getValue: (borrowing) => borrowing.userName || "-",
    defaultSelected: true,
  },
  {
    key: "nip",
    label: "NIP",
    getValue: (borrowing) => borrowing.userNip || "-",
    defaultSelected: true,
  },
  {
    key: "tanggalPinjam",
    label: "Tanggal Pinjam",
    getValue: (borrowing) => new Date(borrowing.borrowDate).toLocaleDateString("id-ID"),
    defaultSelected: true,
  },
  {
    key: "tanggalKembali",
    label: "Tanggal Kembali",
    getValue: (borrowing) =>
      borrowing.returnDate ? new Date(borrowing.returnDate).toLocaleDateString("id-ID") : "-",
    defaultSelected: true,
  },
  {
    key: "ruangan",
    label: "Ruangan Peminjaman",
    getValue: (borrowing) => borrowing.purpose || "-",
    defaultSelected: true,
  },
  {
    key: "catatan",
    label: "Catatan",
    getValue: (borrowing) => borrowing.notes || "-",
    defaultSelected: true,
  },
  {
    key: "status",
    label: "Status",
    getValue: (borrowing) => borrowingStatusLabel(borrowing.status),
    defaultSelected: true,
  },
]

export default function BorrowingPage() {
    const handleValidateReturn = async (borrowing: ApiBorrowing) => {
      if (!borrowing.id) return
      try {
        const result = await borrowingService.validateReturn(borrowing.id)
        if (result.success) {
          alert('Validasi pengembalian berhasil!')
          loadBorrowings()
        } else {
          alert(result.message || 'Validasi gagal')
        }
      } catch (error) {
        alert('Terjadi kesalahan saat validasi pengembalian')
      }
    }
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [borrowings, setBorrowings] = useState<ApiBorrowing[]>([])
  const [availableAssets, setAvailableAssets] = useState<BorrowableAsset[]>([])
  const [inventoryDetails, setInventoryDetails] = useState<DetailInventoryItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("Semua")
  const [filterSource, setFilterSource] = useState<AssetSourceKey>("Semua")
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)
  const [selectedBorrowingIds, setSelectedBorrowingIds] = useState<Set<number>>(() => new Set())
  const [selectedBorrowingExportColumns, setSelectedBorrowingExportColumns] = useState<string[]>(() =>
    borrowingExportColumnDefinitions.map((column) => column.key)
  )

  const [formData, setFormData] = useState({
    assetId: "",
    assetType: "medical" as "medical" | "non_medical",
    assetDetailId: "",
    assetDetailName: "",
    assetDetailCode: "",
    borrowDate: new Date().toISOString().split("T")[0],
    room: "",
    notes: "",
  })
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingBorrowing, setEditingBorrowing] = useState<ApiBorrowing | null>(null)
  const [editForm, setEditForm] = useState({
    borrowDate: "",
    dueDate: "",
    purpose: "",
    notes: "",
  })
  const [editSubmitting, setEditSubmitting] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
    } else {
      setCurrentUser(user)
    }
  }, [router])

  const hasFullAccess = currentUser?.role === "admin" || currentUser?.role === "leader"

  const loadAssets = async () => {
    try {
      const [medicalResponse, nonMedicalResponse] = await Promise.all([
        assetService.getMedicalAssets({ page: 1, limit: 1000 }),
        assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
      ])

      const detailItems = flattenDetailInventories(
        [
          ...(medicalResponse.success ? medicalResponse.data : []),
          ...(nonMedicalResponse.success ? nonMedicalResponse.data : []),
        ],
        { includeAssetFallback: true }
      )

      setInventoryDetails(detailItems)

      const availableItems = detailItems.filter((item) => {
        const assetStatus = item.assetStatus ?? "available"
        const isAssetFallback = item.detailId === `asset-${item.assetId}`
        if (assetStatus === "disposed") return false
        if (isAssetFallback) return assetStatus === "available"
        return item.availability === "available"
      })

      setAvailableAssets(availableItems)
    } catch (error) {
      console.error("Error loading assets:", error)
    }
  }

  const loadBorrowings = async () => {
    try {
      const response = await borrowingService.getAll({ page: 1, limit: 1000 })
      if (response.success) {
        setBorrowings(response.data)
      }
    } catch (error) {
      console.error("Error loading borrowings:", error)
    }
  }

  useEffect(() => {
    if (currentUser) {
      loadAssets()
      loadBorrowings()
    }
  }, [currentUser])

  const detailLookup = useMemo(() => {
    const lookup = new Map<string, DetailInventoryItem>()
    for (const detail of inventoryDetails) {
      if (detail.detailId) {
        lookup.set(detail.detailId, detail)
      }
    }
    return lookup
  }, [inventoryDetails])

  const resolveDetailForBorrowing = (borrowing: ApiBorrowing) => {
    if (borrowing.assetDetailId) {
      const detail = detailLookup.get(borrowing.assetDetailId)
      if (detail) return detail
    }
    if (borrowing.assetDetailCode) {
      const fallbackByCode = inventoryDetails.find(
        (item) => item.assetId === borrowing.assetId && item.detailCode === borrowing.assetDetailCode
      )
      if (fallbackByCode) return fallbackByCode
    }
    if (borrowing.assetDetailName) {
      const fallbackByName = inventoryDetails.find(
        (item) => item.assetId === borrowing.assetId && item.detailName === borrowing.assetDetailName
      )
      if (fallbackByName) return fallbackByName
    }
    return inventoryDetails.find((item) => item.assetId === borrowing.assetId)
  }

  const handleSaveBorrowing = async () => {
    if (!formData.assetDetailId || !formData.room) {
      alert("Mohon lengkapi semua field yang diperlukan")
      return
    }

    const selectedAsset = availableAssets.find((a) => a.detailId === formData.assetDetailId)
    if (!selectedAsset) {
      alert("Aset tidak ditemukan")
      return
    }

    try {
      const created = await borrowingService.create({
        assetId: selectedAsset.assetId,
        assetType: selectedAsset.assetType,
        assetDetailId: selectedAsset.detailId,
        assetDetailName: selectedAsset.detailName,
        assetDetailCode: selectedAsset.detailCode,
        borrowDate: formData.borrowDate,
        purpose: formData.room,
        notes: formData.notes,
      })

      if (!created.success || !created.data) {
        alert(created.message || "Gagal membuat peminjaman")
        return
      }

      if (created.data.id) {
        await borrowingService.approve(created.data.id)
      }

      await loadBorrowings()
      await loadAssets()

      setShowForm(false)
      setFormData({
        assetId: "",
        assetType: "medical",
        assetDetailId: "",
        assetDetailName: "",
        assetDetailCode: "",
        borrowDate: new Date().toISOString().split("T")[0],
        room: "",
        notes: "",
      })
    } catch (error: any) {
      alert(error.message || "Gagal membuat peminjaman")
    }
  }

  const handleDeleteBorrowing = async (borrowing: ApiBorrowing) => {
    if (!hasFullAccess) {
      alert("Hanya Admin/Leader yang dapat menghapus data peminjaman")
      return
    }
    if (!confirm("Apakah Anda yakin ingin menghapus data peminjaman ini?")) return
    try {
      const response = await borrowingService.delete(borrowing.id)
      if (!response.success) {
        alert(response.message || "Gagal menghapus peminjaman")
        return
      }
      await loadBorrowings()
      await loadAssets()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus peminjaman")
    }
  }

  const formatDateField = (value?: string) =>
    value ? new Date(value).toISOString().split("T")[0] : ""

  const openEditDialog = (borrowing: ApiBorrowing) => {
    setEditingBorrowing(borrowing)
    setEditForm({
      borrowDate: formatDateField(borrowing.borrowDate),
      dueDate: formatDateField(borrowing.dueDate),
      purpose: borrowing.purpose || "",
      notes: borrowing.notes || "",
    })
    setEditModalOpen(true)
  }

  const handleEditDialogClose = () => {
    setEditModalOpen(false)
    setEditingBorrowing(null)
    setEditForm({
      borrowDate: "",
      dueDate: "",
      purpose: "",
      notes: "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingBorrowing) return
    if (!editForm.purpose.trim()) {
      alert("Tujuan peminjaman wajib diisi")
      return
    }
    setEditSubmitting(true)
    try {
      const payload = {
        borrowDate: editForm.borrowDate || undefined,
        dueDate: editForm.dueDate || undefined,
        purpose: editForm.purpose.trim(),
        notes: editForm.notes.trim() || undefined,
      }
      const result = await borrowingService.update(editingBorrowing.id, payload)
      if (!result.success) {
        alert(result.message || "Gagal menyimpan perubahan")
        return
      }
      await loadBorrowings()
      handleEditDialogClose()
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan perubahan")
    } finally {
      setEditSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === "overdue") {
      return <Badge variant="destructive">Terlambat</Badge>
    }
    if (status === "returned") {
      return <Badge className="bg-teal-100 text-teal-800">Dikembalikan</Badge>
    }
    if (status === "pending") {
      return <Badge variant="secondary">Menunggu</Badge>
    }
    if (status === "rejected") {
      return <Badge variant="destructive">Ditolak</Badge>
    }
    return <Badge variant="secondary">{borrowingStatusLabel(status)}</Badge>
  }

  const filteredBorrowings = borrowings.filter((b) => {
    const assetName = b.assetDetailName || b.assetName || ""
    const borrowerName = b.userName || ""
    const matchesSearch =
      assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrowerName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      filterStatus === "Semua" ||
      (filterStatus === "Dipinjam" && ["approved", "borrowed"].includes(b.status)) ||
      (filterStatus === "Dikembalikan" && b.status === "returned") ||
      (filterStatus === "Terlambat" && b.status === "overdue") ||
      (filterStatus === "Menunggu" && b.status === "pending") ||
      (filterStatus === "Ditolak" && b.status === "rejected")

    const assetSource = deriveAssetSource(b.assetType, b.assetCode)
    const matchesSource = filterSource === "Semua" || assetSource === filterSource
    return matchesSearch && matchesStatus && matchesSource
  })

  const selectedBorrowings = filteredBorrowings.filter((b) => selectedBorrowingIds.has(b.id))
  const getAssetRoom = (detail?: DetailInventoryItem, fallback?: string) => {
    return (
      detail?.assetLocation ||
      detail?.roomName ||
      detail?.assetName ||
      fallback ||
      "INSTALASI GAWAT DARURAT (IGD)"
    )
  }

  const getPeriodLabel = (dateStr?: string) => {
    if (!dateStr) return "-"
    return formatDateId(dateStr)
  }
  const getValidatorDisplay = (borrowing: ApiBorrowing) => {
    if (borrowing.returnValidatorName || borrowing.returnValidatorNip) {
      return `${borrowing.returnValidatorName || ""} ${borrowing.returnValidatorNip || ""}`.trim()
    }
    return "Menunggu Validasi"
  }

  const getBorrowingStatusLabel = (status?: string) => {
    return borrowingStatusLabel(status ?? "unknown")
  }

  const formatDueDate = (date?: string) => {
    if (!date) return "-"
    return formatDateId(date)
  }

  const buildBorrowingNarrativeSections = (columnKeys: string[]): SectionBuilder<ApiBorrowing> => {
    const columnSet = new Set(columnKeys)
    return (borrowing) => {
      const detail = resolveDetailForBorrowing(borrowing)
      const assetTypeLabel = borrowing.assetType
        ? assetSourceLabel(borrowing.assetType === "medical" ? "medis" : "non_medis")
        : "-"
      const assetName =
        borrowing.assetDetailName || detail?.detailInventoryName || detail?.detailName || borrowing.assetName || "-"
      const assetCode = borrowing.assetDetailCode || detail?.detailCode || borrowing.assetCode || "-"
      const assetRoom = getAssetRoom(detail, borrowing.assetLocation)
      const borrowerName = borrowing.userName || "-"
      const borrowerNip = borrowing.userNip || "-"
      const borrowRoom = borrowing.purpose || "-"
      const borrowDateLabel = formatDateId(borrowing.borrowDate)
      const dueDateLabel = formatDueDate(borrowing.dueDate)
      const notesLabel = borrowing.notes || "-"
      const validatorLabel = getValidatorDisplay(borrowing)
      const statusLabel = `[ ${getBorrowingStatusLabel(borrowing.status).toUpperCase()} ]`

      const identities: SectionLine[] = []
      if (columnSet.has("jenisInventaris")) {
        appendLine(identities, "Jenis Inventaris", assetTypeLabel)
      }
      if (columnSet.has("namaAlat")) {
        appendLine(identities, "Nama Alat", assetName)
      }
      if (columnSet.has("kode")) {
        appendLine(identities, "Kode Alat", assetCode)
      }
      if (columnSet.has("ruanganAlat")) {
        appendLine(identities, "Ruangan Asal Alat", assetRoom)
      }

      const details: SectionLine[] = []
      if (columnSet.has("peminjam")) {
        appendLine(details, "Nama Peminjam", borrowerName)
      }
      if (columnSet.has("nip")) {
        appendLine(details, "NIP Peminjam", borrowerNip)
      }
      if (columnSet.has("ruangan")) {
        appendLine(details, "Ruangan Peminjaman", borrowRoom)
      }
      if (columnSet.has("tanggalPinjam")) {
        appendLine(details, "Tanggal Pinjam", borrowDateLabel)
      }
      if (columnSet.has("tanggalKembali")) {
        appendLine(details, "Batas Pengembalian", dueDateLabel)
      }

      const logLines: SectionLine[] = []
      if (columnSet.has("catatan")) {
        appendLine(logLines, "Catatan", notesLabel)
      }
      appendLine(logLines, "Validator", validatorLabel)

      const validation: SectionLine[] = []
      if (columnSet.has("status")) {
        appendLine(validation, "Status Akhir", statusLabel)
      }

      const sections: DocumentSection[] = []
      if (identities.length) {
        sections.push({ title: "INFORMASI DASAR ALAT", lines: identities })
      }
      if (details.length) {
        sections.push({ title: "DETAIL PEMINJAMAN", lines: details })
      }
      if (logLines.length) {
        sections.push({ title: "LOG PEMINJAMAN & VALIDASI", lines: logLines })
      }
      if (validation.length) {
        sections.push({ title: "STATUS AKHIR", lines: validation })
      }
      return sections
    }
  }

  const handleExport = (format: ExportFormat) => {
    const rowsToExport = selectedBorrowings.length ? selectedBorrowings : filteredBorrowings
    if (!rowsToExport.length) return
    void exportNarrativeReport(format, {
      title: "Daftar Peminjaman Alat",
      subtitle: "LAPORAN OPERASIONAL PEMINJAMAN",
      entries: rowsToExport,
      filePrefix: "daftar-peminjaman",
      buildSections: buildBorrowingNarrativeSections(selectedBorrowingExportColumns),
      emptyMessage: "Tidak ada data peminjaman yang dipilih.",
    })
  }

  const exportSingleBorrowingNarrative = async (format: ExportFormat, borrowing: ApiBorrowing) => {
    void exportNarrativeReport(format, {
      title: "Daftar Peminjaman Alat",
      subtitle: "LAPORAN OPERASIONAL PEMINJAMAN",
      entries: [borrowing],
      filePrefix: `daftar-peminjaman-${borrowing.id}`,
      buildSections: buildBorrowingNarrativeSections(
        borrowingExportColumnDefinitions.map((column) => column.key)
      ),
      emptyMessage: "Tidak ada data peminjaman yang dipilih.",
    })
  }

  const toggleBorrowingSelection = (id: number) => {
    setSelectedBorrowingIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const allBorrowingsSelected =
    filteredBorrowings.length > 0 && filteredBorrowings.every((b) => selectedBorrowingIds.has(b.id))

  const handleSelectAllBorrowings = () => {
    if (allBorrowingsSelected) {
      setSelectedBorrowingIds(new Set())
      return
    }
    setSelectedBorrowingIds(new Set(filteredBorrowings.map((b) => b.id)))
  }

  const handleBorrowingExportColumnToggle = (columnKey: string) => {
    setSelectedBorrowingExportColumns((previous) => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous
        return previous.filter((item) => item !== columnKey)
      }
      return [...previous, columnKey]
    })
  }


  const filteredAvailableAssets = availableAssets.filter((asset) => {
    if (hasFullAccess) return true
    if (currentUser?.staffAccessType === "medis") return asset.source === "medis"
    if (currentUser?.staffAccessType === "non-medis") return asset.source === "non_medis"
    return true
  })

  const pendingCount = borrowings.filter((b) => b.status === "pending").length
  const returnedCount = borrowings.filter((b) => b.status === "returned").length

  const activeBorrowings = borrowings.filter((b) =>
    ["pending", "approved", "borrowed", "overdue"].includes(b.status)
  )
  const activeBorrowedDetailIds = new Set(
    activeBorrowings.map((b) => b.assetDetailId).filter((id): id is string => Boolean(id))
  )
  const activeBorrowedAssetIds = new Set(
    activeBorrowings.filter((b) => !b.assetDetailId).map((b) => String(b.assetId))
  )

  const borrowableAssets = filteredAvailableAssets.filter((asset) => {
    if (activeBorrowedAssetIds.has(String(asset.assetId))) return false
    if (activeBorrowedDetailIds.has(asset.detailId)) return false
    return true
  })

  const medicalAvailableAssets = borrowableAssets.filter((asset) => asset.source === "medis")
  const nonMedicalAvailableAssets = borrowableAssets.filter((asset) => asset.source === "non_medis")

  const formatInventoryLabel = (asset: BorrowableAsset) => {
    const baseName = asset.detailInventoryName || asset.detailName || asset.assetName || "Inventaris"
    const brandSegment = asset.detailBrandModel ? ` (${asset.detailBrandModel})` : ""
    const codeSegment = asset.detailCode ? ` - ${asset.detailCode}` : ""
    return `${baseName}${brandSegment}${codeSegment}`.trim()
  }

  const formatInventoryDisplayLabel = (asset: BorrowableAsset) => {
    const baseLabel = formatInventoryLabel(asset)
    return asset.assetLocation ? `${baseLabel} (${asset.assetLocation})` : baseLabel
  }

  const getBorrowableAssetKey = (asset: BorrowableAsset, index?: number) => {
    const segments = [
      asset.detailId,
      asset.detailCode,
      asset.detailName,
      asset.assetLocation,
      asset.assetId ? String(asset.assetId) : undefined,
    ].filter(Boolean)
    const baseKey = segments.join("|")
    if (!baseKey) {
      return index !== undefined ? `asset-${index}` : `asset-${asset.assetId ?? "unknown"}`
    }
    return index !== undefined ? `${baseKey}-${index}` : baseKey
  }

  const selectedBorrowableAsset = borrowableAssets.find(
    (asset) => asset.detailId === formData.assetDetailId
  )

  const handleSelectBorrowableAsset = (asset: BorrowableAsset) => {
    setFormData((prev) => ({
      ...prev,
      assetId: String(asset.assetId),
      assetType: asset.assetType,
      assetDetailId: asset.detailId,
      assetDetailName: asset.detailName,
      assetDetailCode: asset.detailCode,
    }))
  }

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (
        searchDropdownOpen &&
        target &&
        !searchInputRef.current?.contains(target) &&
        !searchDropdownRef.current?.contains(target)
      ) {
        setSearchDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
    }
  }, [searchDropdownOpen])

  const assetSearchResults = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase()
    if (!normalizedQuery) {
      return borrowableAssets
    }
    return borrowableAssets.filter((asset) =>
      formatInventoryLabel(asset).toLowerCase().includes(normalizedQuery)
    )
  }, [borrowableAssets, searchTerm])

  return (
    <main className="min-h-full bg-gradient-to-br from-slate-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/40">
      <div className="py-8 px-4 lg:px-10">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <section className="rounded-3xl border border-amber-100/80 bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:border-amber-900/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5 items-center">

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500 dark:text-amber-300">
                    
                  </p>
                  <h1 className="text-3xl font-bold text-foreground">Peminjaman Alat</h1>
                  <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                    Proses peminjaman disusun agar selaras dokumentasi, audit, validasi, dan monitoring
                    status alat bisa dilakukan dari satu halaman.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-200">
                      
                    </Badge>
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300">

                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  className="rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700"
                  onClick={() => setShowForm(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah Peminjaman
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
              <CardContent className="space-y-2 px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Menunggu</p>
                    <p className="text-3xl font-semibold text-amber-600">{pendingCount}</p>
                  </div>
                  <Search className="h-8 w-8 text-amber-500" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Permintaan pinjam yang masih menunggu persetujuan admin/leader.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-teal-100/70 bg-white/90 shadow-lg dark:border-teal-900/60 dark:bg-slate-900/70">
              <CardContent className="space-y-2 px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sedang Dipinjam</p>
                    <p className="text-3xl font-semibold text-foreground">{activeBorrowings.length}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total aset yang berada di tangan peminjam, termasuk yang telat kembali.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-teal-100/70 bg-white/90 shadow-lg dark:border-teal-900/60 dark:bg-slate-900/70">
              <CardContent className="space-y-2 px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Sudah Dikembalikan</p>
                    <p className="text-3xl font-semibold text-teal-600">{returnedCount}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-teal-500" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Peminjaman yang sudah selesai dan menunggu validasi akhir.
                </p>
              </CardContent>
            </Card>
          </section>

          {showForm && (
            <Card className="rounded-3xl border border-slate-200 bg-white/80 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Form Peminjaman Baru</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Pastikan detail inventaris dan tanggal pinjam sesuai rencana pengguna.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Pilih Inventaris</label>
                  <InventoryPicker
                    assets={borrowableAssets}
                    selectedAsset={selectedBorrowableAsset}
                    onSelect={handleSelectBorrowableAsset}
                    formatLabel={formatInventoryDisplayLabel}
                    getItemKey={getBorrowableAssetKey}
                    searchValue={buildInventorySearchKey}
                    placeholder="Cari inventaris..."
                    buttonLabel="Pilih inventaris"
                    ariaLabel="Pilih inventaris"
                    noResultsLabel="Tidak ada inventaris tersedia"
                    selectedAssetLabel={formatInventoryDisplayLabel}
                    renderItemMeta={(asset) => asset.roomName || asset.assetLocation}
                  />
                </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tanggal Pinjam</label>
                    <input
                      type="date"
                      value={formData.borrowDate}
                      onChange={(e) => setFormData({ ...formData, borrowDate: e.target.value })}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus:border-teal-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Ruangan Peminjaman</label>
                    <input
                      type="text"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus:border-teal-500"
                      placeholder="Contoh: Ruangan IGD Lt 4 Dewasa"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Catatan</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus:border-teal-500"
                      rows={2}
                      placeholder="Catatan tambahan (opsional)"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button onClick={handleSaveBorrowing} size="sm" className="rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700">
                    Simpan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-2xl px-4 text-sm"
                    onClick={() => setShowForm(false)}
                  >
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-3xl border border-slate-200 bg-white/70 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Cari & Filter</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Cari cepat dan filter status serta sumber inventaris agar daftar sesuai kebutuhan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <label className="sr-only">Cari aset atau peminjam</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Cari aset atau peminjam..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() => setSearchDropdownOpen(true)}
                      className="w-full rounded-2xl border border-border/80 bg-background px-11 py-2 text-sm text-foreground transition focus:border-teal-500"
                    />
                  {searchDropdownOpen && (
                    <div
                      ref={searchDropdownRef}
                      className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xl"
                    >
                      <ScrollArea className="h-[280px] w-full rounded-b-2xl">
                        <div className="space-y-1 px-3 py-3">
                          {assetSearchResults.length === 0 ? (
                            <p className="py-2 text-center text-sm text-muted-foreground">
                              Tidak ada inventaris
                            </p>
                          ) : (
                            assetSearchResults.map((asset, index) => (
                              <button
                                key={getBorrowableAssetKey(asset, index)}
                                type="button"
                                className="w-full rounded-xl px-2 py-2 text-left text-sm text-foreground transition hover:bg-border"
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  const label = formatInventoryLabel(asset)
                                  setSearchTerm(label)
                                  setSearchDropdownOpen(false)
                                }}
                              >
                                <div className="font-medium">{formatInventoryLabel(asset)}</div>
                                <p className="text-xs text-muted-foreground">
                                  {asset.assetLocation || "Lokasi tidak tersedia"}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
            </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-2xl border border-border/80 bg-background px-4 py-2 text-sm text-foreground transition focus:border-teal-500"
                >
                  <option>Semua</option>
                  <option>Menunggu</option>
                  <option>Dipinjam</option>
                  <option>Dikembalikan</option>
                  <option>Terlambat</option>
                  <option>Ditolak</option>
                </select>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as AssetSourceKey)}
                  className="rounded-2xl border border-border/80 bg-background px-4 py-2 text-sm text-foreground transition focus:border-teal-500"
                >
                  <option value="Semua">Semua Sumber</option>
                  <option value="medis">Inventaris Medis</option>
                  <option value="non_medis">Inventaris Non-Medis</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
            <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Daftar Peminjaman</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Total: {filteredBorrowings.length} peminjaman
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-2xl px-3">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-48">
                    <DropdownMenuLabel>Pilih kolom</DropdownMenuLabel>
                    {borrowingExportColumnDefinitions.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={selectedBorrowingExportColumns.includes(column.key)}
                        onCheckedChange={() => handleBorrowingExportColumnToggle(column.key)}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Ekspor daftar</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void handleExport("pdf")}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExport("word")}>Word</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleExport("excel")}>Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-xs text-muted-foreground">
                  {selectedBorrowings.length
                    ? `${selectedBorrowings.length} baris dipilih`
                    : `Semua ${filteredBorrowings.length} baris siap cetak`}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {filteredBorrowings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">Belum ada data peminjaman</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <input
                          aria-label="Pilih semua peminjaman"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={allBorrowingsSelected}
                          onChange={handleSelectAllBorrowings}
                        />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Jenis Inventaris
                      </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Alat
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Ruangan Alat
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Merek/Model
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Nama / NIP
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Tgl Pinjam
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Waktu Kembali
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Ruangan Peminjam
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Catatan
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBorrowings.map((b) => {
                        const detailInfo = resolveDetailForBorrowing(b)
                        const brandModelLabel =
                          detailInfo?.detailBrandModel ||
                          detailInfo?.detailName ||
                          b.assetDetailName ||
                          b.assetName ||
                          "-"
                        const returnTimestamp = formatBracketedDateTime(b.returnDate)

                        return (
                            <tr key={b.id} className="border-b border-border/70 bg-white/70 hover:bg-muted/60 dark:bg-slate-900/60">
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedBorrowingIds.has(b.id)}
                                  onChange={() => toggleBorrowingSelection(b.id)}
                                  className="h-4 w-4"
                                  aria-label={`Pilih peminjaman ${b.assetDetailName || b.assetName || ""}`}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="text-xs">
                                {b.assetType === "medical"
                                  ? "Medis"
                                  : b.assetType === "non_medical"
                                    ? "Non-Medis"
                                    : "-"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm">{b.assetDetailName || b.assetName || "-"}</span>
                                <span className="text-xs text-muted-foreground">{b.assetDetailCode || b.assetCode || "—"}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{detailInfo?.assetLocation || b.assetLocation || "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{brandModelLabel}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              <div className="flex flex-col gap-0.5">
                                <span>{b.userName || "-"}</span>
                                <span className="text-[11px] text-muted-foreground">{b.userNip || "-"}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(b.borrowDate).toLocaleDateString("id-ID")}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {returnTimestamp || "-"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{b.purpose || "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[12rem] break-words whitespace-pre-line">
                              {b.notes || "-"}
                            </td>
                            <td className="px-3 py-2">{getStatusBadge(b.status)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {hasFullAccess ? (
                                  <div className="flex gap-2">
                                    {["pending", "approved"].includes(b.status) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                                        onClick={() => openEditDialog(b)}
                                        title="Edit"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteBorrowing(b)}
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                    {b.status === "returned" && !b.returnValidatedBy && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-xs text-green-700 border-green-600 hover:bg-green-50"
                                        onClick={() => handleValidateReturn(b)}
                                        title="Validasi Pengembalian"
                                      >
                                        Validasi
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => void exportSingleBorrowingNarrative("pdf", b)}>
                                      PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void exportSingleBorrowingNarrative("word", b)}>
                                      Word
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void exportSingleBorrowingNarrative("excel", b)}>
                                      Excel
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={editModalOpen}
            onOpenChange={(open) => {
              if (open) {
                setEditModalOpen(true)
                return
              }
              handleEditDialogClose()
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ubah Data Peminjaman</DialogTitle>
                <DialogDescription>
                  Perbarui tanggal, tujuan, atau catatan peminjaman sebelum statusnya final.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tanggal Pinjam</label>
                  <Input
                    type="date"
                    value={editForm.borrowDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, borrowDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Target Tanggal Kembali</label>
                  <Input
                    type="date"
                    value={editForm.dueDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ruangan Peminjaman</label>
                  <Input
                    value={editForm.purpose}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, purpose: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Catatan Tambahan</label>
                  <Textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4 flex gap-2">
                <Button variant="outline" onClick={handleEditDialogClose} type="button">
                  Batal
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  type="button"
                  disabled={editSubmitting || !editForm.purpose.trim()}
                >
                  {editSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="text-center text-xs font-medium tracking-wider text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan<br />
            Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman
          </div>
        </div>
      </div>
    </main>
  )
}
