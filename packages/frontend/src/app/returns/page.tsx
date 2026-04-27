"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import { borrowingService, type Borrowing as ApiBorrowing } from "@/services/borrowing.service"
import type { User } from "@/types/auth-types"
import {
    assetSourceLabel,
    borrowingStatusLabel,
    deriveAssetSource,
    type AssetSourceKey,
} from "@/utils/api-mappers"
import { formatDayTimeLabel } from "@/utils/format"
import { isAdminOrLeaderRole, isAdminRole } from "@/utils/role"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { assetService } from "@/services/asset.service"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import {
    appendLine,
    ExportFormat,
    exportNarrativeReport,
    SectionBuilder,
    type DocumentSection,
    type SectionLine,
    type TableExportColumn,
} from "@/utils/export-table"
import { formatNoId } from "@/utils/record-id"
import { matchesSearchKeyword } from "@/utils/search-keyword"
import {
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Download,
    Pencil,
    RotateCcw,
    Search,
    Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type ReturnExportColumn = TableExportColumn<ApiBorrowing>

const borrowingPurposeTypeLabels = {
  inside_hospital: "Penggunaan di dalam Rumah Sakit",
  outside_hospital: "Penggunaan di luar Rumah Sakit",
} as const

const borrowingDurationUnitLabels = {
  day: "Hari",
  month: "Bulan",
  year: "Tahun",
} as const

const formatBorrowingPurposeType = (value?: keyof typeof borrowingPurposeTypeLabels | null) =>
  value ? borrowingPurposeTypeLabels[value] ?? "-" : "-"

const formatBorrowingDuration = (
  value?: number | null,
  unit?: keyof typeof borrowingDurationUnitLabels | null
) => {
  if (!value || !unit) return "-"
  const label = borrowingDurationUnitLabels[unit]
  return label ? `${value} ${label}` : String(value)
}

export default function ReturnsPage() {
  const router = useRouter()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [borrowings, setBorrowings] = useState<ApiBorrowing[]>([])
  const [activeSearchTerm, setActiveSearchTerm] = useState("")
  const [activeFilterSource, setActiveFilterSource] = useState<AssetSourceKey>("Semua")
  const [historySearchTerm, setHistorySearchTerm] = useState("")
  const [historyFilterSource, setHistoryFilterSource] = useState<AssetSourceKey>("Semua")
  const [historyFilterCondition, setHistoryFilterCondition] = useState("Semua")
  const [historyFilterValidation, setHistoryFilterValidation] = useState("Semua")
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
    "noId",
    "jenisInventaris",
    "alat",
    "kode",
    "ruanganAlat",
    "merek",
    "peminjam",
    "jabatanPeminjam",
    "unitKerjaPeminjam",
    "pengembali",
    "nip",
    "tanggalPinjam",
    "jenisKeperluan",
    "tujuanPeminjaman",
    "keperluanPeminjaman",
    "durasiPeminjaman",
    "jumlahPeminjaman",
    "waktuKembali",
    "validasi",
    "validatorNip",
    "status",
  ]
  const historyReturnDefaultColumns = [
    "noId",
    "jenisInventaris",
    "alat",
    "kode",
    "merek",
    "ruanganAlat",
    "pengembali",
    "nipPengembali",
    "validasi",
    "validatorNip",
    "peminjam",
    "jabatanPeminjam",
    "unitKerjaPeminjam",
    "pemilikAlat",
    "jabatanPemilikAlat",
    "unitPemilikAlat",
    "nip",
    "tanggalPinjam",
    "jenisKeperluan",
    "tujuanPeminjaman",
    "keperluanPeminjaman",
    "durasiPeminjaman",
    "jumlahPeminjaman",
    "catatanPeminjaman",
    "catatanPengembalian",
    "waktuKembali",
    "kondisi",
    "status",
  ]
  const [activeSelectedReturnColumns, setActiveSelectedReturnColumns] = useState<string[]>(() =>
    activeReturnDefaultColumns
  )
  const [historySelectedReturnColumns, setHistorySelectedReturnColumns] = useState<string[]>(() =>
    historyReturnDefaultColumns
  )
  const [expandedActiveReturnIds, setExpandedActiveReturnIds] = useState<Set<number>>(() => new Set())
  const [expandedHistoryReturnIds, setExpandedHistoryReturnIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
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
    let isMounted = true
    
    const loadAllData = async () => {
      if (!isMounted) return
      await Promise.all([
        loadBorrowings(),
        loadAssets()
      ])
    }
    
    loadAllData()
    
    return () => {
      isMounted = false
    }
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
      window.dispatchEvent(new Event("inventory-refresh"))
      setShowReturnModal(false)
      setSelectedBorrowing(null)
      setReturnNotes("")
      toast({
        title: "Pengembalian berhasil dicatat",
        description: "Data pengembalian alat sudah tersimpan.",
      })
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
      window.dispatchEvent(new Event("inventory-refresh"))
      toast({
        title: "Validasi pengembalian berhasil",
        description: "Data pengembalian telah divalidasi.",
      })
    } catch (error: any) {
      alert(error.message || "Gagal memvalidasi pengembalian")
    } finally {
      setValidatingReturnId(null)
    }
  }

  const handleDeleteReturn = async (borrowing: ApiBorrowing) => {
    if (!canDeleteReturns) {
      alert("Hanya Admin yang dapat menghapus data pengembalian")
      return
    }
    const isConfirmed = await confirm({
      title: "Hapus data pengembalian",
      description: "Apakah Anda yakin ingin menghapus data pengembalian ini?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return
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
      toast({
        title: "Perubahan pengembalian tersimpan",
        description: "Data pengembalian berhasil diperbarui.",
      })
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
  const getReturnNoId = (borrowing: ApiBorrowing) =>
    formatNoId("PGB", borrowing.id, borrowing.borrowingCode)

  const filteredActiveBorrowings = activeBorrowings.filter((b) => {
    const assetName = b.assetDetailName || b.assetName || ""
    const borrowerName = b.userName || ""
    const assetSource = deriveAssetSource(b.assetType, b.assetCode)
    const matchesSearch = matchesSearchKeyword(activeSearchTerm, [
      getReturnNoId(b),
      b.borrowingCode,
      assetName,
      borrowerName,
      b.borrowerPosition,
      b.borrowerWorkUnit,
      b.ownerName,
      b.ownerPosition,
      b.ownerWorkUnit,
      assetSource,
      assetSourceLabel(assetSource),
      b.userNip,
      b.assetDetailCode,
      b.assetCode,
      b.purpose,
      b.destinationRoom,
      b.purposeType,
      b.notes,
      b.returnNotes,
    ])
    const matchesSource = activeFilterSource === "Semua" || assetSource === activeFilterSource
    return matchesSearch && matchesSource
  })

  const canValidateReturns = isAdminOrLeaderRole(currentUser?.role)
  const canDeleteReturns = isAdminRole(currentUser?.role)

  const filteredReturnedBorrowings = returnedBorrowings.filter((b) => {
    const assetName = b.assetDetailName || b.assetName || ""
    const borrowerName = b.userName || ""
    const assetSource = deriveAssetSource(b.assetType, b.assetCode)
    const matchesSearch = matchesSearchKeyword(historySearchTerm, [
      getReturnNoId(b),
      b.borrowingCode,
      assetName,
      borrowerName,
      b.borrowerPosition,
      b.borrowerWorkUnit,
      b.ownerName,
      b.ownerPosition,
      b.ownerWorkUnit,
      assetSource,
      assetSourceLabel(assetSource),
      b.userNip,
      b.assetDetailCode,
      b.assetCode,
      b.purpose,
      b.destinationRoom,
      b.purposeType,
      b.notes,
      b.returnNotes,
      b.returnValidatorName,
      b.returnValidatorNip,
      b.returnCondition,
      b.returnedByName,
      b.returnedByNip,
    ])

    const matchesSource = historyFilterSource === "Semua" || assetSource === historyFilterSource

    const returnConditionNormalized = (b.returnCondition || "").trim().toLowerCase()
    const targetHistoryCondition = historyFilterCondition.trim().toLowerCase()
    const matchesCondition =
      historyFilterCondition === "Semua" || returnConditionNormalized === targetHistoryCondition

    const isValidated = Boolean(b.returnValidatedAt || b.returnValidatorName || b.returnValidatorNip)
    const matchesValidation =
      historyFilterValidation === "Semua" ||
      (historyFilterValidation === "Tervalidasi" ? isValidated : !isValidated)

    return matchesSearch && matchesSource && matchesCondition && matchesValidation
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

  const toggleActiveCardCollapse = (id: number) => {
    setExpandedActiveReturnIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleHistoryCardCollapse = (id: number) => {
    setExpandedHistoryReturnIds((prev) => {
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
        key: "noId",
        label: "No ID",
        getValue: (borrowing) => getReturnNoId(borrowing),
      },
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
        label: "Nama Ruangan Alat",
        getValue: (borrowing) => resolveDetailForBorrowing(borrowing)?.assetLocation || borrowing.assetLocation || "-",
      },
      {
        key: "merek",
        label: "Merek / Model",
        getValue: (borrowing) => {
          const detail = resolveDetailForBorrowing(borrowing)
          return detail?.detailBrandModel || detail?.detailName || "-"
        },
      },
      {
        key: "peminjam",
        label: "Peminjam",
        getValue: (borrowing) => borrowing.userName || "-",
      },
      {
        key: "jabatanPeminjam",
        label: "Jabatan Peminjam",
        getValue: (borrowing) => borrowing.borrowerPosition || "-",
      },
      {
        key: "unitKerjaPeminjam",
        label: "Unit Kerja Peminjam",
        getValue: (borrowing) => borrowing.borrowerWorkUnit || "-",
      },
      {
        key: "pengembali",
        label: "Nama Pengembali",
        getValue: (borrowing) => borrowing.returnedByName || "-",
      },
      {
        key: "nipPengembali",
        label: "NIP Pengembali",
        getValue: (borrowing) => borrowing.returnedByNip || "-",
      },
      {
        key: "nip",
        label: "NIP",
        getValue: (borrowing) => borrowing.userNip || "-",
      },
      {
        key: "tanggalPinjam",
        label: "Tanggal Pinjam",
        getValue: (borrowing) => formatDayTimeLabel(borrowing.borrowDate),
      },
      {
        key: "pemilikAlat",
        label: "Pemilik / PJ Inventaris",
        getValue: (borrowing) => borrowing.ownerName || "-",
      },
      {
        key: "jabatanPemilikAlat",
        label: "Jabatan Pemilik / PJ",
        getValue: (borrowing) => borrowing.ownerPosition || "-",
      },
      {
        key: "unitPemilikAlat",
        label: "Unit Pemilik / PJ",
        getValue: (borrowing) => borrowing.ownerWorkUnit || "-",
      },
      {
        key: "jenisKeperluan",
        label: "Jenis Keperluan",
        getValue: (borrowing) => formatBorrowingPurposeType(borrowing.purposeType),
      },
      {
        key: "tujuanPeminjaman",
        label: "Ruang / Tujuan",
        getValue: (borrowing) => borrowing.destinationRoom || "-",
      },
      {
        key: "keperluanPeminjaman",
        label: "Keperluan Peminjaman",
        getValue: (borrowing) => borrowing.purpose || "-",
      },
      {
        key: "durasiPeminjaman",
        label: "Lama Peminjaman",
        getValue: (borrowing) => formatBorrowingDuration(borrowing.loanDurationValue, borrowing.loanDurationUnit),
      },
      {
        key: "jumlahPeminjaman",
        label: "Jumlah",
        getValue: (borrowing) => String(borrowing.quantity || 1),
      },
      {
        key: "catatanPeminjaman",
        label: "Catatan Peminjaman",
        getValue: (borrowing) => borrowing.notes || "-",
      },
      {
        key: "catatanPengembalian",
        label: "Catatan Pengembalian",
        getValue: (borrowing) => borrowing.returnNotes || "-",
      },
      {
        key: "waktuKembali",
        label: "Waktu Kembali",
        getValue: (borrowing) => formatDayTimeLabel(borrowing.returnDate),
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
        key: "validatorNip",
        label: "NIP Validator",
        getValue: (borrowing) => borrowing.returnValidatorNip || "-",
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
    if (name) return name
    return "Menunggu Validasi"
  }

  const getReturnAssetRoom = (detail: DetailInventoryItem | undefined, fallbackLocation?: string) => {
    return (
      detail?.roomName ||
      detail?.assetLocation ||
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
      const borrowerPosition = borrowing.borrowerPosition || "-"
      const borrowerWorkUnit = borrowing.borrowerWorkUnit || "-"
      const ownerName = borrowing.ownerName || "-"
      const ownerPosition = borrowing.ownerPosition || "-"
      const ownerWorkUnit = borrowing.ownerWorkUnit || "-"
      const borrowPurposeType = formatBorrowingPurposeType(borrowing.purposeType)
      const borrowDestination = borrowing.destinationRoom || "-"
      const borrowPurpose = borrowing.purpose || "-"
      const borrowDuration = formatBorrowingDuration(borrowing.loanDurationValue, borrowing.loanDurationUnit)
      const borrowQuantity = String(borrowing.quantity || 1)
      const borrowDateLabel = formatDayTimeLabel(borrowing.borrowDate)
      const returnDateTimeLabel = formatDayTimeLabel(borrowing.returnDate)
      const validationTimeLabel = formatDayTimeLabel(borrowing.returnValidatedAt)
      const returnConditionLabel = borrowing.returnCondition || "-"
      const borrowNotesLabel = borrowing.notes || "-"
      const returnNotesLabel = borrowing.returnNotes || "-"
      const validatorLabel = getReturnValidatorLabel(borrowing)
      const statusLabel = getNarrativeStatusLabel(borrowing.status)

      const identities: SectionLine[] = []
      if (columnSet.has("noId")) {
        appendLine(identities, "No ID Pengembalian", getReturnNoId(borrowing))
      }
      if (columnSet.has("jenisInventaris")) {
        appendLine(identities, "Jenis Inventaris", assetTypeLabel)
      }
      if (columnSet.has("alat")) {
        appendLine(identities, "Nama Alat", assetName)
      }
      if (columnSet.has("kode")) {
        appendLine(identities, "Kode Alat", assetCode)
      }
      if (columnSet.has("merek")) {
        const brandModel = detail?.detailBrandModel || detail?.detailName || ""
        if (brandModel) {
          appendLine(identities, "Merek / Model", brandModel)
        }
      }
      if (columnSet.has("ruanganAlat")) {
        appendLine(identities, "Nama Ruangan Alat", assetRoom)
      }

      const details: SectionLine[] = []
      if (columnSet.has("peminjam")) {
        appendLine(details, "Nama Peminjam", borrowerName)
      }
      if (columnSet.has("jabatanPeminjam")) {
        appendLine(details, "Jabatan Peminjam", borrowerPosition)
      }
      if (columnSet.has("unitKerjaPeminjam")) {
        appendLine(details, "Unit Kerja Peminjam", borrowerWorkUnit)
      }
      if (columnSet.has("nip")) {
        appendLine(details, "NIP Peminjam", borrowerNip)
      }
      if (columnSet.has("jenisKeperluan")) {
        appendLine(details, "Jenis Keperluan", borrowPurposeType)
      }
      if (columnSet.has("tujuanPeminjaman")) {
        appendLine(details, "Ruang / Tujuan", borrowDestination)
      }
      if (columnSet.has("keperluanPeminjaman")) {
        appendLine(details, "Keperluan Peminjaman", borrowPurpose)
      }
      if (columnSet.has("durasiPeminjaman")) {
        appendLine(details, "Lama Peminjaman", borrowDuration)
      }
      if (columnSet.has("jumlahPeminjaman")) {
        appendLine(details, "Jumlah", borrowQuantity)
      }
      if (columnSet.has("tanggalPinjam")) {
        appendLine(details, "Tanggal Pinjam", borrowDateLabel)
      }
      if (columnSet.has("catatanPeminjaman")) {
        appendLine(details, "Catatan Peminjaman", borrowNotesLabel)
      }

      const ownerLines: SectionLine[] = []
      if (columnSet.has("pemilikAlat")) {
        appendLine(ownerLines, "Nama Pemilik / PJ", ownerName)
      }
      if (columnSet.has("jabatanPemilikAlat")) {
        appendLine(ownerLines, "Jabatan Pemilik / PJ", ownerPosition)
      }
      if (columnSet.has("unitPemilikAlat")) {
        appendLine(ownerLines, "Unit Pemilik / PJ", ownerWorkUnit)
      }

      const returnLogLines: SectionLine[] = []
      if (columnSet.has("pengembali")) {
        appendLine(returnLogLines, "Nama Pengembali", borrowing.returnedByName || "-")
      }
      if (columnSet.has("nipPengembali")) {
        appendLine(returnLogLines, "NIP Pengembali", borrowing.returnedByNip || "-")
      }
      if (columnSet.has("waktuKembali")) {
        appendLine(returnLogLines, "Waktu Kembali", returnDateTimeLabel)
      }
      if (columnSet.has("kondisi")) {
        appendLine(returnLogLines, "Kondisi Pengembalian", returnConditionLabel)
      }
      if (columnSet.has("catatanPengembalian")) {
        appendLine(returnLogLines, "Catatan Pengembalian", returnNotesLabel)
      }

      const validationLines: SectionLine[] = []
      if (columnSet.has("validasi")) {
        appendLine(validationLines, "Validator", validatorLabel)
      }
      if (columnSet.has("validatorNip")) {
        appendLine(validationLines, "NIP Validator", borrowing.returnValidatorNip || "-")
      }
      if (columnSet.has("validasi") && validationTimeLabel !== "-") {
        appendLine(validationLines, "Waktu Validasi", validationTimeLabel)
      }
      const statusLines: SectionLine[] = []
      if (columnSet.has("status")) {
        appendLine(statusLines, "Status Akhir", statusLabel)
      }

      const sections: DocumentSection[] = []
      if (identities.length) {
        sections.push({ title: "Informasi Dasar Alat", lines: identities })
      }
      if (details.length) {
        sections.push({ title: "Detail Peminjaman Alat", lines: details })
      }
      if (ownerLines.length) {
        sections.push({ title: "Pemilik / PJ Inventaris", lines: ownerLines })
      }
      if (returnLogLines.length) {
        sections.push({ title: "Pengembalian Alat", lines: returnLogLines })
      }
      if (validationLines.length) {
        sections.push({ title: "Validasi Pengembalian Alat", lines: validationLines })
      }
      if (statusLines.length) {
        sections.push({ title: "Status Akhir Alat", lines: statusLines })
      }
      return sections
    }
  }

  const exportSingleReturnNarrative = async (
    format: ExportFormat,
    borrowing: ApiBorrowing,
    sectionLabel: string
  ) => {
    const slug = sectionLabel.toLowerCase().replace(/\s+/g, "-")
    const columnKeys = returnExportColumnDefinitions.map((column) => column.key)
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

  const isDamagedReturnCondition = (condition?: string | null) => {
    const normalized = String(condition || "").trim().toLowerCase()
    return normalized.includes("rusak") || normalized.includes("damaged") || normalized.includes("broken")
  }

  return (
    <div
      className="mx-auto w-full max-w-7xl min-h-full space-y-4 bg-linear-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40"
      style={{ fontFamily: "Arial, sans-serif", fontSize: "14px" }}
    >
          <section className="rounded-3xl border border-teal-100/80 bg-white/90 p-4 shadow-2xl backdrop-blur-sm dark:border-teal-800/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5 items-center">
                <div className="p-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-lg">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Pengembalian Alat</h1>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Validasi dan pengecekan kondisi alat dapat dilihat oleh admin/leader.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-200 text-[11px]"
                    >
                      
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Dipinjam</p>
                    <p className="text-xl font-semibold text-foreground mt-1">{activeBorrowings.length}</p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50/50 dark:bg-red-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Terlambat</p>
                    <p className="text-xl font-semibold text-red-600 mt-1">
                      {activeBorrowings.filter((b) => b.status === "overdue").length}
                    </p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Sudah dikembalikan</p>
                    <p className="text-xl font-semibold text-teal-600 mt-1">{returnedBorrowings.length}</p>
                  </div>
                  <RotateCcw className="h-4 w-4 text-teal-500 shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Alat yang Perlu Dikembalikan</CardTitle>
                  <CardDescription className="text-[13px] text-muted-foreground">
                    Total: {filteredActiveBorrowings.length} peminjaman aktif
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua peminjaman aktif"
                      className="h-4 w-4 accent-blue-600"
                      checked={activeAllSelected}
                      onChange={handleActiveSelectAll}
                    />
                    Pilih semua
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-2xl px-3">
                        <Download className="mr-2 h-4 w-4" />
                        Ekspor
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} className="w-[min(92vw,13rem)]">
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
                  <span className="text-[13px] text-muted-foreground">
                    {activeReturnSelectedRows.length
                      ? `${activeReturnSelectedRows.length} baris dipilih`
                      : `Semua ${filteredActiveBorrowings.length} baris`}
                  </span>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <label className="sr-only">Cari aset atau peminjam</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cari No ID, aset, atau peminjam..."
                      value={activeSearchTerm}
                      onChange={(e) => setActiveSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                    />
                  </div>
                </div>
                <select
                  value={activeFilterSource}
                  onChange={(e) => setActiveFilterSource(e.target.value as AssetSourceKey)}
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-[13px] transition focus:border-teal-500"
                >
                  <option value="Semua">Semua Sumber</option>
                  <option value="medis">Inventaris Medis</option>
                  <option value="non_medis">Inventaris Non-Medis</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {filteredActiveBorrowings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-[13px]">Tidak ada alat yang perlu dikembalikan</p>
              ) : (
                <div className="overflow-visible px-3 pb-4 pr-2 sm:px-4 sm:pb-6 lg:max-h-180 lg:overflow-y-scroll lg:[scrollbar-gutter:stable]">
                  <div className="space-y-4">
                    {filteredActiveBorrowings.map((b) => {
                      const detailInfo = resolveDetailForBorrowing(b)
                      const assetName = b.assetDetailName || b.assetName || "-"
                      const codeLabel = b.assetDetailCode || b.assetCode || "-"
                      const roomLabel = detailInfo?.roomName || detailInfo?.assetLocation || b.assetLocation || "-"
                      const returnNoId = getReturnNoId(b)
                      const assetTypeLabel = assetSourceLabel(
                        deriveAssetSource(b.assetType, b.assetDetailCode || b.assetCode),
                      )
                      const dueDateLabel = b.dueDate ? formatDayTimeLabel(b.dueDate) : "Belum dijadwalkan"
                      const isExpanded = expandedActiveReturnIds.has(b.id)
                      const activeSections = buildReturnNarrativeSections(activeSelectedReturnColumns)(b)

                      return (
                        <div
                          key={`active-return-${b.id}`}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                            <span>Informasi Dasar Inventaris</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-lg p-0 text-slate-700 hover:bg-slate-200"
                                onClick={() => toggleActiveCardCollapse(b.id)}
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          {!isExpanded && (
                          <div className="space-y-2.5 bg-white px-3 py-3 sm:px-3 sm:py-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">{assetName}</p>
                                <p className="text-[12px] font-medium text-slate-700">{codeLabel}</p>
                                <div className="mt-1.5 space-y-1.5">
                                  <p className="text-[11px] text-muted-foreground">No ID: {returnNoId}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Identitas Karyawan: <span className="font-medium text-slate-700">{b.userName || "-"} / {b.userNip || "-"}</span>
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Unit kerja: <span className="font-medium text-slate-700">{b.borrowerWorkUnit || "-"}</span> • {formatBorrowingPurposeType(b.purposeType)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Batas Pengembalian</span>
                                  <span className="text-[13px] font-semibold text-foreground">{dueDateLabel}</span>
                                </div>
                                <div>{getStatusBadge(b.status)}</div>
                              </div>
                            </div>
                          </div>
                          )}
                          {isExpanded && (
                          <div className="space-y-3 bg-white px-3 py-3 sm:px-3 sm:py-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline" className="text-[11px]">
                                {assetTypeLabel}
                              </Badge>
                              <Badge variant="outline" className="text-[11px]">
                                {b.destinationRoom || roomLabel}
                              </Badge>
                            </div>
                            {activeSections.length ? (
                              <div className="columns-1 gap-3 border-t border-slate-200 pt-3 lg:columns-2">
                                {activeSections.map((section) => (
                                  <div key={section.title} className="mb-3 break-inside-avoid space-y-1.5">
                                    <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                                      {section.title}
                                    </div>
                                    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                                      {section.lines.map((line) => (
                                        <div
                                          key={`${section.title}-${line.label}`}
                                          className="detail-labeled-row"
                                        >
                                          <span className="font-medium text-slate-600">
                                            {line.label}
                                          </span>
                                          <span className="font-medium text-slate-900">{line.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-[13px] text-slate-700">
                                Aktifkan minimal satu kolom untuk melihat detail pengembalian.
                              </div>
                            )}
                          </div>
                        )}
                            <div className="flex flex-col gap-1.5 border-t border-slate-200 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:pb-3">
                              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={selectedActiveReturnIds.has(b.id)}
                                  onChange={() => toggleActiveReturnSelection(b.id)}
                                  className="h-4 w-4 rounded border border-slate-300 bg-white text-slate-700"
                                  aria-label={`Pilih pengembalian aktif ${b.assetDetailName || b.assetName || ""}`}
                                />
                                Pilih kartu
                              </label>
                              <div className="flex flex-wrap items-center gap-1">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenReturn(b)}
                                  className="h-6 rounded-full bg-teal-600 px-3 text-[12px] font-semibold text-white hover:bg-teal-700"
                                >
                                  Kembalikan
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 rounded-lg p-0">
                                      <Download className="w-3 h-3" />
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
                            </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Riwayat Pengembalian</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Total: {filteredReturnedBorrowings.length} riwayat
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua riwayat pengembalian"
                    className="h-4 w-4"
                    checked={historyAllSelected}
                    onChange={handleHistorySelectAll}
                  />
                  Pilih semua
                </label>
                <div className="flex items-center gap-2">
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
                <span className="text-[13px] text-muted-foreground">
                  {historyReturnSelectedRows.length
                    ? `${historyReturnSelectedRows.length} baris dipilih`
                    : `Semua ${filteredReturnedBorrowings.length} baris`}
                </span>
              </div>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="px-4 pb-4">
                <div className="rounded-2xl border border-border/70 bg-slate-50/60 p-3 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-muted-foreground">
                      Cari & Filter Riwayat
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[14px]"
                      onClick={() => {
                        setHistorySearchTerm("")
                        setHistoryFilterSource("Semua")
                        setHistoryFilterCondition("Semua")
                        setHistoryFilterValidation("Semua")
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                      <label className="sr-only">Cari riwayat pengembalian</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Cari No ID, alat, peminjam, validator..."
                          value={historySearchTerm}
                          onChange={(event) => setHistorySearchTerm(event.target.value)}
                          className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                        />
                      </div>
                    </div>
                    <select
                      value={historyFilterSource}
                      onChange={(event) => setHistoryFilterSource(event.target.value as AssetSourceKey)}
                      className="rounded-xl border border-border/80 bg-background px-3 py-2 text-[13px] transition focus:border-teal-500"
                    >
                      <option value="Semua">Semua Sumber</option>
                      <option value="medis">Inventaris Medis</option>
                      <option value="non_medis">Inventaris Non-Medis</option>
                    </select>
                    <select
                      value={historyFilterCondition}
                      onChange={(event) => setHistoryFilterCondition(event.target.value)}
                      className="rounded-xl border border-border/80 bg-background px-3 py-2 text-[13px] transition focus:border-teal-500"
                    >
                      <option value="Semua">Semua Kondisi</option>
                      <option value="Baik">Baik</option>
                      <option value="Cukup">Cukup</option>
                      <option value="Rusak">Rusak</option>
                    </select>
                    <select
                      value={historyFilterValidation}
                      onChange={(event) => setHistoryFilterValidation(event.target.value)}
                      className="rounded-xl border border-border/80 bg-background px-3 py-2 text-[13px] transition focus:border-teal-500"
                    >
                      <option value="Semua">Semua Validasi</option>
                      <option value="Tervalidasi">Tervalidasi</option>
                      <option value="Belum Tervalidasi">Belum Tervalidasi</option>
                    </select>
                  </div>
                </div>
              </div>
              {filteredReturnedBorrowings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-[13px]">
                  Tidak ada riwayat pengembalian yang sesuai pencarian/filter.
                </p>
              ) : (
                <div className="overflow-visible px-3 pb-4 pr-2 sm:px-4 sm:pb-6 lg:max-h-180 lg:overflow-y-scroll lg:[scrollbar-gutter:stable]">
                  <div className="space-y-4">
                    {filteredReturnedBorrowings.map((b) => {
                    const detailInfo = resolveDetailForBorrowing(b)
                    const historyDetailColumns = historySelectedReturnColumns.includes("tanggalPinjam")
                      ? historySelectedReturnColumns
                      : [...historySelectedReturnColumns, "tanggalPinjam"]
                    const historySections = buildReturnNarrativeSections(historyDetailColumns)(b)
                    const assetName = b.assetDetailName || b.assetName || "-"
                    const codeLabel = b.assetDetailCode || b.assetCode || "-"
                    const roomNameLabel = detailInfo?.roomName || detailInfo?.assetLocation || b.assetLocation || "-"
                    const assetTypeLabel = assetSourceLabel(
                      deriveAssetSource(b.assetType, b.assetDetailCode || b.assetCode),
                    )
                    const returnNoId = getReturnNoId(b)
                    const borrowerName = b.userName || "-"
                    const returnDateLabel = b.returnDate ? formatDayTimeLabel(b.returnDate) : "Belum dikembalikan"
                    const isExpanded = expandedHistoryReturnIds.has(b.id)
                    const showDamagedNotice =
                      b.status === "returned" && isDamagedReturnCondition(b.returnCondition)
                    return (
                        <div
                          key={`history-card-${b.id}`}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                            <span>Informasi Dasar Inventaris</span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-lg p-0 text-slate-700 hover:bg-slate-200"
                                onClick={() => toggleHistoryCardCollapse(b.id)}
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          {!isExpanded && (
                            <div className="space-y-2.5 bg-white px-3 py-3 sm:px-3 sm:py-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{assetName}</p>
                                  <p className="text-[12px] font-medium text-slate-700">{codeLabel}</p>
                                  <div className="mt-1.5 space-y-1.5">
                                    <p className="text-[11px] text-muted-foreground">No ID: {returnNoId}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Identitas Karyawan: <span className="font-medium text-slate-700">{borrowerName} / {b.userNip || "-"}</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Unit kerja: <span className="font-medium text-slate-700">{b.borrowerWorkUnit || "-"}</span> • {formatBorrowingPurposeType(b.purposeType)}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <Badge variant="outline" className="text-[10px]">
                                      {assetTypeLabel}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                      {b.destinationRoom || roomNameLabel}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Waktu Kembali</span>
                                    <span className="text-[13px] font-semibold text-foreground">{returnDateLabel}</span>
                                  </div>
                                  <div className="flex flex-col items-start gap-1 sm:items-end">
                                    {getStatusBadge(b.status)}
                                    {showDamagedNotice && (
                                      <span className="text-[11px] font-semibold text-red-600">Alat rusak</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {isExpanded && (
                            <div className="space-y-3 bg-white px-3 py-3 sm:px-3 sm:py-3">
                              {historySections.length ? (
                                <div className="columns-1 gap-3 border-t border-slate-200 pt-3 lg:columns-2">
                                  {historySections.map((section) => (
                                    <div key={section.title} className="mb-3 break-inside-avoid space-y-1.5">
                                      <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                                        {section.title}
                                      </div>
                                      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                                        {section.lines.map((line) => (
                                          <div
                                            key={`${section.title}-${line.label}`}
                                            className="detail-labeled-row"
                                          >
                                            <span className="font-medium text-slate-600">
                                              {line.label}
                                            </span>
                                            <span className="font-medium text-slate-900">{line.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-[13px] text-slate-700">
                                  Aktifkan minimal satu kolom untuk melihat detail riwayat.
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex flex-col gap-1.5 border-t border-slate-200 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:pb-3">
                            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={selectedHistoryReturnIds.has(b.id)}
                                onChange={() => toggleHistoryReturnSelection(b.id)}
                                className="h-4 w-4 rounded border border-slate-300 bg-white text-slate-700"
                                aria-label={`Pilih riwayat pengembalian ${b.assetDetailName || b.assetName || ""}`}
                              />
                              Pilih kartu
                            </label>
                            <div className="flex flex-wrap items-center gap-1 text-[12px] text-slate-600">
                              {canValidateReturns ? (
                                <div className="flex flex-wrap gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded-lg p-0 text-emerald-600 hover:bg-emerald-50"
                                    onClick={() => openReturnEditDialog(b)}
                                    title="Edit pengembalian"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  {canDeleteReturns && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 rounded-lg p-0 text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteReturn(b)}
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                  {b.status === "returned" &&
                                    (b.returnValidatedAt ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 border-border/60 text-[13px] text-muted-foreground"
                                        disabled
                                      >
                                        Tervalidasi
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 border-green-600 text-[14px] text-green-700 hover:bg-green-50"
                                        onClick={() => handleValidateReturn(b.id)}
                                        disabled={validatingReturnId === b.id}
                                      >
                                        {validatingReturnId === b.id ? "Memvalidasi..." : "Validasi"}
                                      </Button>
                                    ))}
                                </div>
                              ) : (
                                <span className="text-[13px] text-muted-foreground">Aksi terbatas</span>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0">
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
                          </div>
                        </div>
                    )
                  })}
                  </div>
                </div>
              )}
          </CardContent>
          </Card>

          {showReturnModal && selectedBorrowing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-linear-to-br from-black/50 to-black/80 px-4">
              <Card className="w-full max-w-md rounded-3xl border border-black/10 bg-white/95 dark:border-slate-800 dark:bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="text-lg">Konfirmasi Pengembalian</CardTitle>
                  <CardDescription>
                    Pengembalian alat: {selectedBorrowing.assetDetailName || selectedBorrowing.assetName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/50 p-4 text-[14px] dark:bg-slate-800">
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
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Tujuan:</span>
                      <span className="font-medium text-right">
                        {selectedBorrowing.destinationRoom || selectedBorrowing.purpose || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Lama / Jumlah:</span>
                      <span className="font-medium text-right">
                        {formatBorrowingDuration(
                          selectedBorrowing.loanDurationValue,
                          selectedBorrowing.loanDurationUnit
                        )} / {selectedBorrowing.quantity || 1}
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
                    <label className="block text-[14px] font-medium mb-1">Kondisi Saat Dikembalikan</label>
                    <select
                      value={returnCondition}
                      onChange={(e) => setReturnCondition(e.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                    >
                      <option>Baik</option>
                      <option>Cukup</option>
                      <option>Rusak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[14px] font-medium mb-1">Catatan Pengembalian</label>
                    <textarea
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                      rows={3}
                      placeholder="Catatan kondisi alat saat dikembalikan (opsional)"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleConfirmReturn} className="flex-1 rounded-2xl bg-teal-600 text-[14px] font-semibold hover:bg-teal-700">
                      Konfirmasi Pengembalian
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl text-[14px]"
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
                  <label className="text-[13px] font-medium text-muted-foreground">Kondisi Saat Dikembalikan</label>
                  <select
                    className="mt-1 w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground focus:border-teal-500"
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
                  <label className="text-[13px] font-medium text-muted-foreground">Catatan Pengembalian</label>
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

          <div className="text-center text-[13px] font-medium tracking-wider text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan<br />
            Sistem Inventaris & Peminjaman Serta Pemeliharaan Sarana
          </div>
    </div>
  )
}
