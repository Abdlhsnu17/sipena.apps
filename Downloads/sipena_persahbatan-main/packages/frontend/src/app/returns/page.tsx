"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/services/auth-utils"
import { borrowingService, type Borrowing as ApiBorrowing } from "@/services/borrowing.service"
import type { User } from "@/types/auth-types"
import {
  assetSourceLabel,
  borrowingStatusLabel,
  deriveAssetSource,
  type AssetSourceKey,
} from "@/utils/api-mappers"
import { formatBracketedDateTime, formatDateId } from "@/utils/format"

import { assetService } from "@/services/asset.service"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import {
  AlertCircle,
  CheckCircle,
  Download,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  ExportFormat,
  appendLine,
  exportNarrativeReport,
  SectionBuilder,
  type DocumentSection,
  type SectionLine,
} from "@/utils/export-table"

type ReturnExportColumn = {
  key: string
  label: string
  getValue: (borrowing: ApiBorrowing) => string
}


export default function ReturnsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [borrowings, setBorrowings] = useState<ApiBorrowing[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSource, setFilterSource] = useState<AssetSourceKey>("Semua")
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [selectedBorrowing, setSelectedBorrowing] = useState<ApiBorrowing | null>(null)
  const [returnNotes, setReturnNotes] = useState("")
  const [returnCondition, setReturnCondition] = useState("Baik")
  const [validatingReturnId, setValidatingReturnId] = useState<number | null>(null)
  const [inventoryDetails, setInventoryDetails] = useState<DetailInventoryItem[]>([])
  const [returnEditOpen, setReturnEditOpen] = useState(false)
  const [editingReturn, setEditingReturn] = useState<ApiBorrowing | null>(null)
  const [returnEditData, setReturnEditData] = useState({
    returnCondition: "Baik",
    returnNotes: "",
  })
  const [returnEditSubmitting, setReturnEditSubmitting] = useState(false)
  const [selectedActiveReturnIds, setSelectedActiveReturnIds] = useState<Set<number>>(() => new Set())
  const [selectedHistoryReturnIds, setSelectedHistoryReturnIds] = useState<Set<number>>(() => new Set())
  const activeReturnDefaultColumns = [
    "jenisInventaris",
    "alat",
    "peminjam",
    "nip",
    "tanggalPinjam",
    "ruanganPeminjam",
    "status",
  ]
  const historyReturnDefaultColumns = [
    "jenisInventaris",
    "alat",
    "peminjam",
    "nip",
    "catatan",
    "waktuKembali",
    "validasi",
    "kondisi",
  ]
  const [activeSelectedReturnColumns, setActiveSelectedReturnColumns] = useState<string[]>(() =>
    activeReturnDefaultColumns
  )
  const [historySelectedReturnColumns, setHistorySelectedReturnColumns] = useState<string[]>(() =>
    historyReturnDefaultColumns
  )

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
    } else {
      setCurrentUser(user)
    }
  }, [router])

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
    } catch (error) {
      console.error("Error loading inventory details:", error)
    }
  }

  useEffect(() => {
    loadBorrowings()
  }, [])

  useEffect(() => {
    void loadAssets()
  }, [])

  const handleOpenReturn = (borrowing: ApiBorrowing) => {
    setSelectedBorrowing(borrowing)
    setReturnNotes("")
    setReturnCondition("Baik")
    setShowReturnModal(true)
  }

  const handleConfirmReturn = async () => {
    if (!selectedBorrowing) return

    try {
      const response = await borrowingService.return(
        selectedBorrowing.id,
        returnCondition,
        returnNotes
      )

      if (!response.success) {
        alert(response.message || "Gagal memproses pengembalian")
        return
      }

      await loadBorrowings()
      setShowReturnModal(false)
      setSelectedBorrowing(null)
      setReturnNotes("")
    } catch (error: any) {
      alert(error.message || "Gagal memproses pengembalian")
    }
  }

  const handleValidateReturn = async (borrowingId: number) => {
    try {
      setValidatingReturnId(borrowingId)
      const response = await borrowingService.validateReturn(borrowingId)
      if (!response.success) {
        alert(response.message || "Gagal memvalidasi pengembalian")
        return
      }
      await loadBorrowings()
    } catch (error: any) {
      alert(error.message || "Gagal memvalidasi pengembalian")
    } finally {
      setValidatingReturnId(null)
    }
  }

  const handleDeleteReturn = async (borrowing: ApiBorrowing) => {
    if (!canValidateReturns) {
      alert("Hanya Admin/Leader yang dapat menghapus data pengembalian")
      return
    }
    if (!confirm("Apakah Anda yakin ingin menghapus data pengembalian ini?")) return
    try {
      const response = await borrowingService.delete(borrowing.id)
      if (!response.success) {
        alert(response.message || "Gagal menghapus pengembalian")
        return
      }
      await loadBorrowings()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus pengembalian")
    }
  }

  const openReturnEditDialog = (borrowing: ApiBorrowing) => {
    setEditingReturn(borrowing)
    setReturnEditData({
      returnCondition: borrowing.returnCondition || "Baik",
      returnNotes: borrowing.returnNotes || "",
    })
    setReturnEditOpen(true)
  }

  const handleReturnEditClose = () => {
    setReturnEditOpen(false)
    setEditingReturn(null)
    setReturnEditData({
      returnCondition: "Baik",
      returnNotes: "",
    })
  }

  const handleReturnEditSave = async () => {
    if (!editingReturn) return
    setReturnEditSubmitting(true)
    try {
      const payload = {
        returnCondition: returnEditData.returnCondition,
        returnNotes: returnEditData.returnNotes.trim() || undefined,
      }
      const result = await borrowingService.update(editingReturn.id, payload)
      if (!result.success) {
        alert(result.message || "Gagal menyimpan perubahan")
        return
      }
      await loadBorrowings()
      handleReturnEditClose()
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan perubahan")
    } finally {
      setReturnEditSubmitting(false)
    }
  }

  // Filter only active borrowings (not yet returned)
  const activeBorrowings = borrowings.filter((b) => ["approved", "borrowed", "overdue"].includes(b.status))
  const returnedBorrowings = borrowings.filter((b) => b.status === "returned")

  const filteredActiveBorrowings = activeBorrowings.filter((b) => {
    const assetName = b.assetDetailName || b.assetName || ""
    const borrowerName = b.userName || ""
    const matchesSearch =
      assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrowerName.toLowerCase().includes(searchTerm.toLowerCase())
    const assetSource = deriveAssetSource(b.assetType, b.assetCode)
    const matchesSource = filterSource === "Semua" || assetSource === filterSource
    return matchesSearch && matchesSource
  })

  const canValidateReturns = currentUser?.role === "admin" || currentUser?.role === "leader"

  const filteredReturnedBorrowings = returnedBorrowings.filter((b) => {
    const assetName = b.assetDetailName || b.assetName || ""
    const borrowerName = b.userName || ""
    const matchesSearch =
      assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      borrowerName.toLowerCase().includes(searchTerm.toLowerCase())
    const assetSource = deriveAssetSource(b.assetType, b.assetCode)
    const matchesSource = filterSource === "Semua" || assetSource === filterSource
    return matchesSearch && matchesSource
  })

  const activeReturnSelectedRows = filteredActiveBorrowings.filter((b) =>
    selectedActiveReturnIds.has(b.id)
  )
  const historyReturnSelectedRows = filteredReturnedBorrowings.filter((b) =>
    selectedHistoryReturnIds.has(b.id)
  )

  const activeAllSelected =
    filteredActiveBorrowings.length > 0 &&
    filteredActiveBorrowings.every((b) => selectedActiveReturnIds.has(b.id))
  const historyAllSelected =
    filteredReturnedBorrowings.length > 0 &&
    filteredReturnedBorrowings.every((b) => selectedHistoryReturnIds.has(b.id))

  const toggleActiveReturnSelection = (id: number) => {
    setSelectedActiveReturnIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleHistoryReturnSelection = (id: number) => {
    setSelectedHistoryReturnIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleActiveSelectAll = () => {
    if (activeAllSelected) {
      setSelectedActiveReturnIds(new Set())
      return
    }
    setSelectedActiveReturnIds(new Set(filteredActiveBorrowings.map((b) => b.id)))
  }

  const handleHistorySelectAll = () => {
    if (historyAllSelected) {
      setSelectedHistoryReturnIds(new Set())
      return
    }
    setSelectedHistoryReturnIds(new Set(filteredReturnedBorrowings.map((b) => b.id)))
  }

  const detailLookup = useMemo(() => {
    const lookup = new Map<string, DetailInventoryItem>()
    for (const detail of inventoryDetails) {
      if (detail.detailId) lookup.set(detail.detailId, detail)
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

  const returnExportColumnDefinitions = useMemo<ReturnExportColumn[]>(
    () => [
      {
        key: "jenisInventaris",
        label: "Jenis Inventaris",
        getValue: (borrowing) => assetSourceLabel(deriveAssetSource(borrowing.assetType, borrowing.assetCode)),
      },
      {
        key: "alat",
        label: "Alat",
        getValue: (borrowing) => borrowing.assetDetailName || borrowing.assetName || "-",
      },
      {
        key: "kode",
        label: "Kode",
        getValue: (borrowing) => borrowing.assetDetailCode || borrowing.assetCode || "-",
      },
      {
        key: "ruanganAlat",
        label: "Ruangan Alat",
        getValue: (borrowing) => resolveDetailForBorrowing(borrowing)?.assetLocation || borrowing.assetLocation || "-",
      },
      {
        key: "peminjam",
        label: "Peminjam",
        getValue: (borrowing) => borrowing.userName || "-",
      },
      {
        key: "nip",
        label: "NIP",
        getValue: (borrowing) => borrowing.userNip || "-",
      },
      {
        key: "tanggalPinjam",
        label: "Tanggal Pinjam",
        getValue: (borrowing) => new Date(borrowing.borrowDate).toLocaleDateString("id-ID"),
      },
      {
        key: "ruanganPeminjam",
        label: "Ruangan Peminjaman",
        getValue: (borrowing) => borrowing.purpose || "-",
      },
      {
        key: "catatan",
        label: "Catatan Pengembalian",
        getValue: (borrowing) => borrowing.returnNotes || borrowing.notes || "-",
      },
      {
        key: "waktuKembali",
        label: "Waktu Kembali",
        getValue: (borrowing) =>
          borrowing.returnDate ? new Date(borrowing.returnDate).toLocaleString("id-ID") : "-",
      },
      {
        key: "validasi",
        label: "Validasi",
        getValue: (borrowing) =>
          borrowing.returnValidatorName || borrowing.returnValidatorNip
            ? `${borrowing.returnValidatorName || ""} ${borrowing.returnValidatorNip || ""}`.trim()
            : "Menunggu",
      },
      {
        key: "kondisi",
        label: "Kondisi Pengembalian",
        getValue: (borrowing) => borrowing.returnCondition || "-",
      },
      {
        key: "status",
        label: "Status",
        getValue: (borrowing) => borrowingStatusLabel(borrowing.status),
      },
    ],
    [deriveAssetSource, resolveDetailForBorrowing]
  )

  const getReturnValidatorLabel = (borrowing: ApiBorrowing) => {
    const name = borrowing.returnValidatorName?.trim()
    const nip = borrowing.returnValidatorNip?.trim()
    if (name || nip) {
      const displayName = name || "Validator"
      const nipSegment = nip ? ` (NIP: ${nip})` : ""
      return `${displayName}${nipSegment}`
    }
    return "Menunggu Validasi"
  }

  const formatReturnDateTimeLabel = (value?: string) => {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    const dateLabel = date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    const timeLabel = date
      .toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(/:/g, ".")
    return `${dateLabel}, ${timeLabel}`
  }

  const getReturnAssetRoom = (detail: DetailInventoryItem | undefined, fallbackLocation?: string) => {
    return (
      detail?.assetLocation ||
      detail?.roomName ||
      detail?.assetName ||
      fallbackLocation ||
      "INSTALASI GAWAT DARURAT (IGD)"
    )
  }

  const getNarrativeStatusLabel = (status?: string) => {
    return borrowingStatusLabel(status ?? "unknown")
  }

  const buildReturnNarrativeSections = (columnKeys: string[]): SectionBuilder<ApiBorrowing> => {
    const columnSet = new Set(columnKeys)
    return (borrowing) => {
      const detail = resolveDetailForBorrowing(borrowing)
      const assetTypeLabel = borrowing.assetType
        ? assetSourceLabel(deriveAssetSource(borrowing.assetType, borrowing.assetCode))
        : "-"
      const assetName =
        borrowing.assetDetailName || detail?.detailInventoryName || detail?.detailName || borrowing.assetName || "-"
      const assetCode = borrowing.assetDetailCode || detail?.detailCode || borrowing.assetCode || "-"
      const assetRoom = getReturnAssetRoom(detail, borrowing.assetLocation)
      const borrowerName = borrowing.userName || "-"
      const borrowerNip = borrowing.userNip || "-"
      const borrowRoom = borrowing.purpose || "-"
      const borrowDateLabel = formatDateId(borrowing.borrowDate)
      const returnDateTimeLabel = formatReturnDateTimeLabel(borrowing.returnDate)
      const validationTimeLabel = formatReturnDateTimeLabel(borrowing.returnValidatedAt)
      const returnConditionLabel = borrowing.returnCondition || "-"
      const returnNotesLabel = borrowing.returnNotes || borrowing.notes || "-"
      const validatorLabel = getReturnValidatorLabel(borrowing)
      const statusLabel = `[ ${getNarrativeStatusLabel(borrowing.status).toUpperCase()} ]`

      const identities: SectionLine[] = []
      if (columnSet.has("jenisInventaris")) {
        appendLine(identities, "Jenis Inventaris", assetTypeLabel)
      }
      if (columnSet.has("alat")) {
        appendLine(identities, "Nama Alat", assetName)
      }
      if (columnSet.has("kode")) {
        appendLine(identities, "Kode Alat", assetCode)
      }
      if (columnSet.has("ruanganAlat")) {
        appendLine(identities, "Ruangan Alat", assetRoom)
      }

      const details: SectionLine[] = []
      if (columnSet.has("peminjam")) {
        appendLine(details, "Nama Peminjam", borrowerName)
      }
      if (columnSet.has("nip")) {
        appendLine(details, "NIP Peminjam", borrowerNip)
      }
      if (columnSet.has("ruanganPeminjam")) {
        appendLine(details, "Ruangan Peminjaman", borrowRoom)
      }
      if (columnSet.has("tanggalPinjam")) {
        appendLine(details, "Tanggal Pinjam", borrowDateLabel)
      }

      const logLines: SectionLine[] = []
      if (columnSet.has("waktuKembali")) {
        appendLine(logLines, "Waktu Kembali", returnDateTimeLabel)
      }
      if (columnSet.has("kondisi")) {
        appendLine(logLines, "Kondisi Pengembalian", returnConditionLabel)
      }
      if (columnSet.has("catatan")) {
        appendLine(logLines, "Catatan Pengembalian", returnNotesLabel)
      }
      if (columnSet.has("validasi")) {
        appendLine(logLines, "Validator", validatorLabel)
        if (validationTimeLabel !== "-") {
          appendLine(logLines, "Waktu Validasi", validationTimeLabel)
        }
      }
      const statusLines: SectionLine[] = []
      if (columnSet.has("status")) {
        appendLine(statusLines, "Status Akhir", statusLabel)
      }

      const sections: DocumentSection[] = []
      if (identities.length) {
        sections.push({ title: "INFORMASI DASAR ALAT", lines: identities })
      }
      if (details.length) {
        sections.push({ title: "DETAIL PEMINJAMAN", lines: details })
      }
      if (logLines.length) {
        sections.push({ title: "LOG PENGEMBALIAN & VALIDASI", lines: logLines })
      }
      if (statusLines.length) {
        sections.push({ title: "STATUS AKHIR", lines: statusLines })
      }
      return sections
    }
  }

  const exportSingleReturnNarrative = async (
    format: ExportFormat,
    borrowing: ApiBorrowing,
    sectionLabel: string
  ) => {
    const columnKeys = returnExportColumnDefinitions.map((column) => column.key)
    const slug = sectionLabel.toLowerCase().replace(/\s+/g, "-")
    void exportNarrativeReport(format, {
      title: sectionLabel,
      subtitle: "LAPORAN OPERASIONAL PENGEMBALIAN",
      entries: [borrowing],
      filePrefix: `${slug}-${borrowing.id}`,
      buildSections: buildReturnNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada data pengembalian yang dipilih.",
    })
  }


  const toggleActiveReturnColumn = (columnKey: string) => {
    setActiveSelectedReturnColumns((previous) => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous
        return previous.filter((item) => item !== columnKey)
      }
      return [...previous, columnKey]
    })
  }

  const toggleHistoryReturnColumn = (columnKey: string) => {
    setHistorySelectedReturnColumns((previous) => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous
        return previous.filter((item) => item !== columnKey)
      }
      return [...previous, columnKey]
    })
  }

  const activeReturnRowsToExport =
    activeReturnSelectedRows.length > 0 ? activeReturnSelectedRows : filteredActiveBorrowings
  const historyReturnRowsToExport =
    historyReturnSelectedRows.length > 0 ? historyReturnSelectedRows : filteredReturnedBorrowings

  const handleActiveExport = (format: ExportFormat) => {
    if (!activeReturnRowsToExport.length) return
    void exportNarrativeReport(format, {
      title: "Daftar Pengembalian Alat (Aktif)",
      subtitle: "LAPORAN PENGEMBALIAN AKTIF",
      entries: activeReturnRowsToExport,
      filePrefix: "pengembalian-aktif",
      buildSections: buildReturnNarrativeSections(activeSelectedReturnColumns),
      emptyMessage: "Tidak ada pengembalian aktif yang dipilih.",
    })
  }

  const handleHistoryExport = (format: ExportFormat) => {
    if (!historyReturnRowsToExport.length) return
    void exportNarrativeReport(format, {
      title: "Riwayat Pengembalian Alat",
      subtitle: "LAPORAN PENGEMBALIAN",
      entries: historyReturnRowsToExport,
      filePrefix: "riwayat-pengembalian",
      buildSections: buildReturnNarrativeSections(historySelectedReturnColumns),
      emptyMessage: "Tidak ada riwayat pengembalian yang dipilih.",
    })
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

  return (
    <main className="min-h-full bg-gradient-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40">
      <div className="py-8 px-4 lg:px-10">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <section className="rounded-3xl border border-teal-100/80 bg-white/90 p-6 shadow-2xl backdrop-blur-sm dark:border-teal-800/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-lg">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-500 dark:text-teal-300">
                    
                  </p>
                  <h1 className="text-3xl font-bold text-foreground">Pengembalian Alat</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Menyederhanakan alur pengembalian sesuai dokumentasi sehingga validasi
                    dan pengecekan kondisi alat bisa langsung dilihat oleh admin/leader.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-200"
                    >
                      
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                    >

                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border border-teal-100/70 bg-white/90 shadow-lg dark:border-teal-900/60 dark:bg-slate-900/70">
              <CardContent className="space-y-2 px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Dipinjam</p>
                    <p className="text-3xl font-semibold text-foreground">{activeBorrowings.length}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Jumlah alat yang masih perlu dikonfirmasi kembali dalam satu tampilan tersusun.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-red-100/80 bg-white/90 shadow-lg dark:border-red-900/50 dark:bg-slate-900/70">
              <CardContent className="space-y-2 px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Terlambat</p>
                    <p className="text-3xl font-semibold text-red-600">
                      {activeBorrowings.filter((b) => b.status === "overdue").length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Fokus pada peminjaman yang perlu dihubungi atau dijadwalkan ulang.
                </p>
              </CardContent>
            </Card>
            <Card className="rounded-3xl border border-teal-100/70 bg-white/90 shadow-lg dark:border-teal-900/60 dark:bg-slate-900/70">
              <CardContent className="space-y-2 px-5 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Sudah dikembalikan
                    </p>
                    <p className="text-3xl font-semibold text-teal-600">{returnedBorrowings.length}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-teal-500" />
                </div>
                <p className="text-xs text-muted-foreground">Validasi sudah dilakukan untuk aset yang kembali.</p>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-3xl border border-slate-200 bg-white/70 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Cari & Filter</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Sesuaikan daftar pengembalian dengan aset, peminjam, dan sumber inventaris.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="lg:col-span-2">
                  <label className="sr-only">Cari aset atau peminjam</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cari aset atau peminjam..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-background px-11 py-2 text-sm text-foreground transition focus:border-teal-500"
                    />
                  </div>
                </div>
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as AssetSourceKey)}
                  className="rounded-2xl border border-border/80 bg-background px-4 py-2 text-sm transition focus:border-teal-500"
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
                <CardTitle className="text-lg">Alat yang Perlu Dikembalikan</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Total: {filteredActiveBorrowings.length} peminjaman aktif
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
                    <div className="max-h-44 overflow-y-auto">
                      {returnExportColumnDefinitions.map((column) => (
                        <DropdownMenuCheckboxItem
                          key={`active-column-${column.key}`}
                          checked={activeSelectedReturnColumns.includes(column.key)}
                          onCheckedChange={() => toggleActiveReturnColumn(column.key)}
                        >
                          {column.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Ekspor daftar</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void handleActiveExport("pdf")}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleActiveExport("word")}>Word</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleActiveExport("excel")}>Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-xs text-muted-foreground">
                  {activeReturnSelectedRows.length
                    ? `${activeReturnSelectedRows.length} baris dipilih`
                    : `Semua ${filteredActiveBorrowings.length} baris`}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {filteredActiveBorrowings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">Tidak ada alat yang perlu dikembalikan</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <input
                            aria-label="Pilih semua peminjaman aktif"
                            type="checkbox"
                            className="h-4 w-4"
                            checked={activeAllSelected}
                            onChange={handleActiveSelectAll}
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
                          Ruangan Peminjaman
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Catatan
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Waktu Kembali
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
                      {filteredActiveBorrowings.map((b) => {
                        const detailInfo = resolveDetailForBorrowing(b)
                        const brandModelLabel =
                          detailInfo?.detailBrandModel ||
                          detailInfo?.detailName ||
                          b.assetDetailName ||
                          b.assetName ||
                          "-"
                        return (
                          <tr key={b.id} className="border-b border-border/70 bg-white/70 hover:bg-muted/60 dark:bg-slate-900/60">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedActiveReturnIds.has(b.id)}
                                onChange={() => toggleActiveReturnSelection(b.id)}
                                className="h-4 w-4"
                                aria-label={`Pilih pengembalian aktif ${b.assetDetailName || b.assetName || ""}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-xs">
                                {assetSourceLabel(deriveAssetSource(b.assetType, b.assetCode))}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              <div className="flex flex-col gap-0.5">
                                <span>{b.assetDetailName || b.assetName || "-"}</span>
                                {(b.assetDetailCode || b.assetCode) && (
                                  <span className="text-[11px] text-muted-foreground">{b.assetDetailCode || b.assetCode}</span>
                                )}
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
                            <td className="px-3 py-2 text-muted-foreground">{b.purpose || "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[12rem] break-words whitespace-pre-line">
                              {b.notes || "-"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {b.returnDate ? new Date(b.returnDate).toLocaleString("id-ID") : "Belum dikembalikan"}
                            </td>
                            <td className="px-3 py-2">{getStatusBadge(b.status)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenReturn(b)}
                                  className="h-8 text-xs bg-teal-600 hover:bg-teal-700"
                                >
                                  Kembalikan
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("pdf", b, "Pengembalian Alat")}>
                                      PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("word", b, "Pengembalian Alat")}>
                                      Word
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("excel", b, "Pengembalian Alat")}>
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

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
            <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Riwayat Pengembalian</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Admin/leader dapat memverifikasi dan melihat detail konfirmasi pengembalian.
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
                      {returnExportColumnDefinitions.map((column) => (
                        <DropdownMenuCheckboxItem
                          key={`history-column-${column.key}`}
                          checked={historySelectedReturnColumns.includes(column.key)}
                          onCheckedChange={() => toggleHistoryReturnColumn(column.key)}
                        >
                          {column.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Ekspor daftar</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void handleHistoryExport("pdf")}>PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleHistoryExport("word")}>Word</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void handleHistoryExport("excel")}>Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-xs text-muted-foreground">
                  {historyReturnSelectedRows.length
                    ? `${historyReturnSelectedRows.length} baris dipilih`
                    : `Semua ${filteredReturnedBorrowings.length} baris`}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {filteredReturnedBorrowings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">Belum ada riwayat pengembalian</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <input
                            type="checkbox"
                            aria-label="Pilih semua riwayat pengembalian"
                            className="h-4 w-4"
                            checked={historyAllSelected}
                            onChange={handleHistorySelectAll}
                          />
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jenis Inventaris</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alat</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ruangan Alat</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Merek/Model</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nama / NIP</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ruangan Peminjaman</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catatan Pengembalian</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Waktu Kembali
                        </th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Validasi</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReturnedBorrowings.map((b) => {
                        const detailInfo = resolveDetailForBorrowing(b)
                        const brandModelLabel =
                          detailInfo?.detailBrandModel ||
                          detailInfo?.detailName ||
                          b.assetDetailName ||
                          b.assetName ||
                          "-"
                        const validationTimestamp = formatBracketedDateTime(b.returnValidatedAt)
                        return (
                          <tr key={b.id} className="border-b border-border/70 bg-white/70 hover:bg-muted/60 dark:bg-slate-900/60">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedHistoryReturnIds.has(b.id)}
                                onChange={() => toggleHistoryReturnSelection(b.id)}
                                className="h-4 w-4"
                                aria-label={`Pilih riwayat pengembalian ${b.assetDetailName || b.assetName || ""}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-xs">
                                {assetSourceLabel(deriveAssetSource(b.assetType, b.assetCode))}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-foreground">
                              <div className="flex flex-col gap-0.5">
                                <span>{b.assetDetailName || b.assetName || "-"}</span>
                                {(b.assetDetailCode || b.assetCode) && (
                                  <span className="text-[11px] text-muted-foreground">{b.assetDetailCode || b.assetCode}</span>
                                )}
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
                            <td className="px-3 py-2 text-muted-foreground">{b.purpose || "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground max-w-[12rem] break-words whitespace-pre-line">
                              {b.returnNotes || b.notes || "-"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {b.returnDate ? (
                                <div className="flex flex-col gap-0.5">
                                  {b.returnedByName && (
                                    <span className="text-sm text-foreground">{b.returnedByName}</span>
                                  )}
                                  {b.returnedByNip && (
                                    <span className="text-[11px] text-muted-foreground">{b.returnedByNip}</span>
                                  )}
                                  {formatBracketedDateTime(b.returnDate) && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {formatBracketedDateTime(b.returnDate)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {b.returnValidatorName || b.returnValidatorNip ? (
                                <div className="flex flex-col gap-0.5">
                                  {b.returnValidatorName && (
                                    <p className="text-sm text-foreground">{b.returnValidatorName}</p>
                                  )}
                                  {b.returnValidatorNip && (
                                    <p className="text-xs text-muted-foreground">{b.returnValidatorNip}</p>
                                  )}
                                  {validationTimestamp && (
                                    <p className="text-[11px] text-muted-foreground">{validationTimestamp}</p>
                                  )}
                                </div>
                              ) : canValidateReturns ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleValidateReturn(b.id)}
                                  disabled={validatingReturnId === b.id}
                                >
                                  {validatingReturnId === b.id ? "Memvalidasi..." : "Validasi"}
                                </Button>
                              ) : (
                                <Badge variant="secondary">Menunggu Validasi</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {canValidateReturns ? (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                                      onClick={() => openReturnEditDialog(b)}
                                      title="Edit pengembalian"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteReturn(b)}
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
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
                                    <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("pdf", b, "Riwayat Pengembalian")}>
                                      PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("word", b, "Riwayat Pengembalian")}>
                                      Word
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("excel", b, "Riwayat Pengembalian")}>
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

          {showReturnModal && selectedBorrowing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-black/50 to-black/80 px-4">
              <Card className="w-full max-w-md rounded-3xl border border-black/10 bg-white/95 dark:border-slate-800 dark:bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="text-lg">Konfirmasi Pengembalian</CardTitle>
                  <CardDescription>
                    Pengembalian alat: {selectedBorrowing.assetDetailName || selectedBorrowing.assetName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/50 p-4 text-sm dark:bg-slate-800">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Peminjam:</span>
                      <span className="font-medium">{selectedBorrowing.userName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NIP:</span>
                      <span className="font-medium">{selectedBorrowing.userNip || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tanggal Pinjam:</span>
                      <span className="font-medium">
                        {new Date(selectedBorrowing.borrowDate).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waktu Kembali:</span>
                      <span className="font-medium text-right">
                        Dicatat saat konfirmasi (termasuk jam & tanggal)
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Kondisi Saat Dikembalikan</label>
                    <select
                      value={returnCondition}
                      onChange={(e) => setReturnCondition(e.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus:border-teal-500"
                    >
                      <option>Baik</option>
                      <option>Cukup</option>
                      <option>Rusak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Catatan Pengembalian</label>
                    <textarea
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus:border-teal-500"
                      rows={3}
                      placeholder="Catatan kondisi alat saat dikembalikan (opsional)"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleConfirmReturn} className="flex-1 rounded-2xl bg-teal-600 text-sm font-semibold hover:bg-teal-700">
                      Konfirmasi Pengembalian
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl text-sm"
                      onClick={() => {
                        setShowReturnModal(false)
                        setSelectedBorrowing(null)
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Dialog
            open={returnEditOpen}
            onOpenChange={(open) => {
              if (open) {
                setReturnEditOpen(true)
                return
              }
              handleReturnEditClose()
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Perbarui Catatan Pengembalian</DialogTitle>
                <DialogDescription>
                  Koreksi kondisi atau catatan pengembalian sebelum validasi akhir.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Kondisi Saat Dikembalikan</label>
                  <select
                    className="mt-1 w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground focus:border-teal-500"
                    value={returnEditData.returnCondition}
                    onChange={(event) =>
                      setReturnEditData((prev) => ({
                        ...prev,
                        returnCondition: event.target.value,
                      }))
                    }
                  >
                    <option>Baik</option>
                    <option>Cukup</option>
                    <option>Rusak</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Catatan Pengembalian</label>
                  <Textarea
                    rows={3}
                    value={returnEditData.returnNotes}
                    onChange={(event) =>
                      setReturnEditData((prev) => ({ ...prev, returnNotes: event.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter className="mt-4 flex gap-2">
                <Button variant="outline" onClick={handleReturnEditClose} type="button">
                  Batal
                </Button>
                <Button
                  onClick={handleReturnEditSave}
                  type="button"
                  disabled={returnEditSubmitting}
                >
                  {returnEditSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
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
