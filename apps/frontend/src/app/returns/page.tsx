"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DeleteReasonDialog from "@/components/delete-reason-dialog";
import { NotificationSummary } from "@/components/notification-summary";
import { SummaryResultBody, SummaryResultCard, SummaryResultFooter } from "@/components/summary-result-card";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import { borrowingService, type Borrowing as ApiBorrowing } from "@/services/borrowing.service";
import deletionRequestService from "@/services/deletion-request.service";
import type { User } from "@/types/auth-types";
import {
    assetSourceBadgeClass,
    assetSourceLabel,
    borrowingStatusLabel,
    deriveAssetSource,
    locationBadgeClass,
    type AssetSourceKey,
} from "@/utils/api-mappers";
import { formatDayTimeLabel } from "@/utils/format";
import { isAdminOrLeaderRole, isAdminRole, isStaffPjRole, isTechnicianRole } from "@/utils/role";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { assetService } from "@/services/asset.service";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import {
    appendLine,
    ExportFormat,
    exportNarrativeReport,
    SectionBuilder,
    type DocumentSection,
    type SectionLine,
    type TableExportColumn,
} from "@/utils/export-table";
import { formatNoId } from "@/utils/record-id";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import {
    AlertCircle,
    CheckCheck,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Download,
    Eye,
    History,
    MapPin,
    Pencil,
    RotateCcw,
    Search,
    Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ReturnExportColumn = TableExportColumn<ApiBorrowing>

const RETURN_ROWS_PER_PAGE = 2

const buildVisiblePageItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right)

  return sortedPages.flatMap((page, index) => {
    const previousPage = sortedPages[index - 1]
    if (index > 0 && previousPage && page - previousPage > 1) {
      return [`ellipsis-${previousPage}-${page}`, page]
    }
    return [page]
  })
}

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
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [borrowings, setBorrowings] = useState<ApiBorrowing[]>([])
  const [activeSearchTerm, setActiveSearchTerm] = useState("")
  const [linkedBorrowingFilter, setLinkedBorrowingFilter] = useState("")
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
  const [pendingDeleteReturn, setPendingDeleteReturn] = useState<ApiBorrowing | null>(null)
  const [pendingArchiveReturnRequest, setPendingArchiveReturnRequest] = useState<ApiBorrowing | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [isDeletingReturn, setIsDeletingReturn] = useState(false)
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
    "pemilikAlat",
    "nipPemilikAlat",
    "jabatanPemilikAlat",
    "unitPemilikAlat",
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
    "nipPemilikAlat",
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
  const [isActiveSectionMinimized, setIsActiveSectionMinimized] = useState(false)
  const [isHistorySectionMinimized, setIsHistorySectionMinimized] = useState(false)
  const [activeReturnPage, setActiveReturnPage] = useState(1)
  const [historyReturnPage, setHistoryReturnPage] = useState(1)
  const [returnView, setReturnView] = useState<"active" | "history">("active")

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
    } else if (isTechnicianRole(user.role)) {
      router.replace("/")
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

  useEffect(() => {
    if (typeof window === "undefined") return

    const borrowingId = new URLSearchParams(window.location.search).get("borrowingId")?.trim()
    if (!borrowingId) return

    setActiveSearchTerm(borrowingId)
    setLinkedBorrowingFilter(borrowingId)
    setIsActiveSectionMinimized(false)
  }, [])

  const handleOpenReturn = (borrowing: ApiBorrowing) => {
    const accessMessage = getReturnAccessMessage(borrowing)
    if (accessMessage) {
      toast({
        title: "Pengembalian tidak tersedia",
        description: accessMessage,
        variant: "destructive",
      })
      return
    }

    setSelectedBorrowing(borrowing)
    setReturnNotes("")
    setReturnCondition("Baik")
    setShowReturnModal(true)
  }

  const handleConfirmReturn = async () => {
    if (!selectedBorrowing) return
    const accessMessage = getReturnAccessMessage(selectedBorrowing)
    if (accessMessage) {
      toast({
        title: "Pengembalian tidak tersedia",
        description: accessMessage,
        variant: "destructive",
      })
      return
    }

    try {
      const response = await borrowingService.return(
        selectedBorrowing.id,
        returnCondition,
        returnNotes
      )

      if (!response.success) {
        toast({
          title: "Pengembalian belum tersimpan",
          description: response.message || "Data pengembalian alat belum dapat diproses.",
          variant: "destructive",
        })
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
      console.error("Error confirming return:", error)
      toast({
        title: "Pengembalian belum tersimpan",
        description: "Terjadi kesalahan saat memproses pengembalian alat.",
        variant: "destructive",
      })
    }
  }

  const handleValidateReturn = async (borrowingId: number) => {
    try {
      setValidatingReturnId(borrowingId)
      const response = await borrowingService.validateReturn(borrowingId)
      if (!response.success) {
        toast({
          title: "Validasi belum tersimpan",
          description: response.message || "Data pengembalian belum dapat divalidasi.",
          variant: "destructive",
        })
        return
      }
      await loadBorrowings()
      window.dispatchEvent(new Event("inventory-refresh"))
      toast({
        title: "Validasi pengembalian berhasil",
        description: "Data pengembalian telah divalidasi.",
      })
    } catch (error: any) {
      console.error("Error validating return:", error)
      toast({
        title: "Validasi belum tersimpan",
        description: "Terjadi kesalahan saat memvalidasi pengembalian.",
        variant: "destructive",
      })
    } finally {
      setValidatingReturnId(null)
    }
  }

  const handleDeleteReturn = (borrowing: ApiBorrowing) => {
    if (!canDeleteReturns) {
      toast({
        title: "Akses ditolak",
        description: "Hanya Admin yang dapat menghapus data pengembalian.",
        variant: "destructive",
      })
      return
    }
    setPendingDeleteReturn(borrowing)
    setDeleteReason("")
  }

  const confirmDeleteReturn = async () => {
    if (!pendingDeleteReturn) return
    const reason = deleteReason.trim()
    if (!reason) {
      toast({
        title: "Alasan wajib diisi",
        description: "Isi alasan penghapusan sebelum melanjutkan.",
        variant: "destructive",
      })
      return
    }
    setIsDeletingReturn(true)
    try {
      const response = await borrowingService.delete(pendingDeleteReturn.id, reason)
      if (!response.success) {
        toast({
          title: "Pengembalian belum terhapus",
          description: response.message || "Data pengembalian belum dapat dihapus.",
          variant: "destructive",
        })
        return
      }
      setPendingDeleteReturn(null)
      setDeleteReason("")
      await loadBorrowings()
    } catch (error: any) {
      console.error("Error deleting return:", error)
      toast({
        title: "Pengembalian belum terhapus",
        description: "Terjadi kesalahan saat menghapus data pengembalian.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingReturn(false)
    }
  }

  const handleRequestDeleteReturn = (borrowing: ApiBorrowing) => {
    setPendingArchiveReturnRequest(borrowing)
    setDeleteReason("")
  }

  const confirmRequestDeleteReturn = async () => {
    if (!pendingArchiveReturnRequest) return
    const reason = deleteReason.trim()
    if (!reason) {
      toast({
        title: "Alasan wajib diisi",
        description: "Isi alasan penghapusan sebelum mengirim permintaan.",
        variant: "destructive",
      })
      return
    }
    setIsDeletingReturn(true)
    try {
      const response = await deletionRequestService.create({
        targetType: "return",
        targetId: Number(pendingArchiveReturnRequest.id),
        targetLabel: pendingArchiveReturnRequest.assetDetailName || pendingArchiveReturnRequest.assetName || pendingArchiveReturnRequest.borrowingCode || `Pengembalian #${pendingArchiveReturnRequest.id}`,
        reason,
      })
      if (!response.success) {
        toast({
          title: "Permintaan belum terkirim",
          description: response.message || "Permintaan penghapusan pengembalian belum dapat dikirim.",
          variant: "destructive",
        })
        return
      }
      setPendingArchiveReturnRequest(null)
      setDeleteReason("")
      toast({ title: "Permintaan penghapusan diajukan" })
    } catch (error: any) {
      console.error("Error requesting return deletion:", error)
      toast({
        title: "Permintaan belum terkirim",
        description: "Terjadi kesalahan saat mengirim permintaan penghapusan pengembalian.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingReturn(false)
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
        toast({
          title: "Perubahan belum tersimpan",
          description: result.message || "Data pengembalian belum dapat diperbarui.",
          variant: "destructive",
        })
        return
      }
      await loadBorrowings()
      toast({
        title: "Perubahan pengembalian tersimpan",
        description: "Data pengembalian berhasil diperbarui.",
      })
      handleReturnEditClose()
    } catch (error: any) {
      console.error("Error editing return:", error)
      toast({
        title: "Perubahan belum tersimpan",
        description: "Terjadi kesalahan saat menyimpan perubahan pengembalian.",
        variant: "destructive",
      })
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
      b.id,
      b.borrowingCode,
      assetName,
      borrowerName,
      b.borrowerPosition,
      b.borrowerWorkUnit,
      b.ownerName,
      b.ownerNip,
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

  const canManageReturnRecords = isAdminOrLeaderRole(currentUser?.role)
  const canValidateReturns = canManageReturnRecords || isStaffPjRole(currentUser?.role)
  const canDeleteReturns = isAdminRole(currentUser?.role)
  const canRequestDeleteReturns = isAdminOrLeaderRole(currentUser?.role) && !canDeleteReturns

  const normalizeWorkUnit = (value?: string | null) => value?.trim().replace(/\s+/g, " ").toLowerCase() || ""

  const getReturnAccessMessage = (borrowing: ApiBorrowing) => {
    const isBorrower = currentUser && String(borrowing.userId) === String(currentUser.id)
    if (isBorrower || canManageReturnRecords) {
      return ""
    }
    if (isStaffPjRole(currentUser?.role)) {
      const actorWorkUnit = normalizeWorkUnit(currentUser?.workUnit)
      if (!actorWorkUnit) {
        return "Staff PJ wajib mengisi Unit Kerja / Instalasi di pengaturan akun sebelum mengembalikan peminjaman."
      }

      const borrowerWorkUnit = normalizeWorkUnit(borrowing.borrowerWorkUnit || borrowing.borrowerCurrentWorkUnit)
      if (!borrowerWorkUnit) {
        return "Instalasi peminjam belum terisi, sehingga Staff PJ belum dapat mengembalikan peminjaman ini."
      }

      if (actorWorkUnit !== borrowerWorkUnit) {
        return "Staff PJ hanya dapat mengembalikan peminjaman dari instalasi yang sama."
      }

      return ""
    }

    return "Pengembalian hanya dapat dilakukan oleh admin, leader, Staff PJ satu instalasi, atau pengguna pemilik peminjaman."
  }

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
      b.ownerNip,
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

  useEffect(() => {
    setActiveReturnPage(1)
  }, [activeBorrowings.length, activeFilterSource, activeSearchTerm])

  useEffect(() => {
    setHistoryReturnPage(1)
  }, [
    historyFilterCondition,
    historyFilterSource,
    historyFilterValidation,
    historySearchTerm,
    returnedBorrowings.length,
  ])

  const totalActiveReturnPages = Math.max(1, Math.ceil(filteredActiveBorrowings.length / RETURN_ROWS_PER_PAGE))
  const currentActiveReturnPage = Math.min(activeReturnPage, totalActiveReturnPages)
  const activeReturnStartIndex = (currentActiveReturnPage - 1) * RETURN_ROWS_PER_PAGE
  const paginatedActiveBorrowings = filteredActiveBorrowings.slice(activeReturnStartIndex, activeReturnStartIndex + RETURN_ROWS_PER_PAGE)
  const visibleActiveReturnPages = buildVisiblePageItems(currentActiveReturnPage, totalActiveReturnPages)
  const goToActiveReturnPage = (page: number) => {
    setActiveReturnPage(Math.min(totalActiveReturnPages, Math.max(1, page)))
  }

  const totalHistoryReturnPages = Math.max(1, Math.ceil(filteredReturnedBorrowings.length / RETURN_ROWS_PER_PAGE))
  const currentHistoryReturnPage = Math.min(historyReturnPage, totalHistoryReturnPages)
  const historyReturnStartIndex = (currentHistoryReturnPage - 1) * RETURN_ROWS_PER_PAGE
  const paginatedReturnedBorrowings = filteredReturnedBorrowings.slice(historyReturnStartIndex, historyReturnStartIndex + RETURN_ROWS_PER_PAGE)
  const visibleHistoryReturnPages = buildVisiblePageItems(currentHistoryReturnPage, totalHistoryReturnPages)
  const goToHistoryReturnPage = (page: number) => {
    setHistoryReturnPage(Math.min(totalHistoryReturnPages, Math.max(1, page)))
  }

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
        getValue: (borrowing) => {
          const detail = resolveDetailForBorrowing(borrowing)
          return detail?.detailInventoryName || detail?.detailName || borrowing.assetDetailName || borrowing.assetName || "-"
        },
      },
      {
        key: "kode",
        label: "Kode",
        getValue: (borrowing) => {
          const detail = resolveDetailForBorrowing(borrowing)
          return detail?.detailCode || borrowing.assetDetailCode || borrowing.assetCode || "-"
        },
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
        key: "nipPemilikAlat",
        label: "NIP Pemilik / PJ",
        getValue: (borrowing) => borrowing.ownerNip || "-",
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
            : "Menunggu Validasi",
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
      const ownerNip = borrowing.ownerNip || "-"
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
      if (columnSet.has("nipPemilikAlat")) {
        appendLine(ownerLines, "NIP Pemilik / PJ", ownerNip)
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
        sections.push({ title: "Pengembalian", lines: returnLogLines })
      }
      if (validationLines.length) {
        sections.push({ title: "Validasi Pengembalian", lines: validationLines })
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
    sectionLabel: string,
    columnKeys: string[]
  ) => {
    const slug = sectionLabel.toLowerCase().replace(/\s+/g, "-")
    void exportNarrativeReport(format, {
      title: sectionLabel,
      subtitle: "LAPORAN OPERASIONAL PENGEMBALIAN",
      entries: [borrowing],
      filePrefix: `${slug}-${borrowing.id}`,
      buildSections: buildReturnNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada data pengembalian yang dipilih.",
      showEntryHeader: false,
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
      title: "Daftar Pengembalian (Aktif)",
      subtitle: "LAPORAN PENGEMBALIAN AKTIF",
      entries: activeReturnRowsToExport,
      filePrefix: "pengembalian-aktif",
      buildSections: buildReturnNarrativeSections(activeSelectedReturnColumns),
      emptyMessage: "Tidak ada pengembalian aktif yang dipilih.",
      showEntryHeader: false,
    })
  }

  const handleHistoryExport = (format: ExportFormat) => {
    if (!historyReturnRowsToExport.length) return
    void exportNarrativeReport(format, {
      title: "Riwayat Pengembalian",
      subtitle: "LAPORAN PENGEMBALIAN",
      entries: historyReturnRowsToExport,
      filePrefix: "riwayat-pengembalian",
      buildSections: buildReturnNarrativeSections(historySelectedReturnColumns),
      emptyMessage: "Tidak ada riwayat pengembalian yang dipilih.",
      showEntryHeader: false,
    })
  }

  const getStatusBadge = (borrowing: Pick<ApiBorrowing, "status" | "returnValidatedAt">) => {
    const { status } = borrowing
    if (status === "overdue") {
      return <Badge variant="destructive">Terlambat</Badge>
    }
    if (status === "returned") {
      if (!borrowing.returnValidatedAt) {
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
            Menunggu validasi pengembalian
          </Badge>
        )
      }
      return <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300">Dikembalikan</Badge>
    }
    if (status === "pending") {
      return <Badge variant="secondary">Menunggu Persetujuan</Badge>
    }
    if (status === "rejected") {
      return <Badge variant="destructive">Ditolak</Badge>
    }
    if (status === "approved") {
      return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-400/10 dark:text-sky-300 dark:hover:bg-sky-400/10">Disetujui</Badge>
    }
    if (status === "borrowed") {
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/10">Sedang Dipinjam</Badge>
    }
    return <Badge variant="secondary">{borrowingStatusLabel(status)}</Badge>
  }

  const getBorrowingRestrictionBadge = (status: string) => {
    if (status !== "overdue") return null

    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-50 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/10">
        Diblokir meminjam
      </Badge>
    )
  }

  const isDamagedReturnCondition = (condition?: string | null) => {
    const normalized = String(condition || "").trim().toLowerCase()
    return normalized.includes("rusak") || normalized.includes("damaged") || normalized.includes("broken")
  }

  return (
    <main
      className="min-h-full min-w-0"
      style={{ fontFamily: "Arial, sans-serif", fontSize: "14px" }}
    >
      <div>
        <div className="w-full space-y-5">
          <section className="rounded-3xl border border-teal-100/80 bg-white/90 panel-gutter shadow-2xl backdrop-blur-sm dark:border-teal-800/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-5">
                <div className="rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-[18px] font-bold text-foreground">Pengembalian</h1>
                </div>
              </div>
            </div>
          </section>

          <NotificationSummary
            ariaLabel="Pemberitahuan pengembalian"
            items={[
              { label: "Perlu Dikembalikan", value: activeBorrowings.length, icon: AlertCircle, tone: "amber" },
              {
                label: "Terlambat",
                value: activeBorrowings.filter((b) => b.status === "overdue").length,
                icon: AlertCircle,
                tone: "rose",
              },
              { label: "Sudah Dikembalikan", value: returnedBorrowings.length, icon: RotateCcw, tone: "teal" },
            ]}
          />

          <div
            role="tablist"
            aria-label="Daftar pengembalian"
            className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm dark:border-slate-700/35 dark:bg-slate-900/70 sm:p-2"
          >
            <button
              type="button"
              role="tab"
              aria-selected={returnView === "active"}
              aria-controls="active-returns-panel"
              id="active-returns-tab"
              onClick={() => setReturnView("active")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-[13px] font-semibold transition sm:min-h-12 sm:px-4 sm:text-sm ${
                returnView === "active"
                  ? "bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <RotateCcw className="h-5 w-5 shrink-0" />
              <span>Alat yang Perlu Dikembalikan</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={returnView === "history"}
              aria-controls="return-history-panel"
              id="return-history-tab"
              onClick={() => setReturnView("history")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-[13px] font-semibold transition sm:min-h-12 sm:px-4 sm:text-sm ${
                returnView === "history"
                  ? "bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <History className="h-5 w-5 shrink-0" />
              <span>Riwayat Pengembalian</span>
            </button>
          </div>

          {returnView === "active" && (
          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700/35 dark:bg-slate-900/70">
            <div
              id="active-returns-panel"
              role="tabpanel"
              aria-labelledby="active-returns-tab"
            >
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Alat yang Perlu Dikembalikan</CardTitle>
                  <CardDescription className="text-[13px] text-muted-foreground">
                    Total: {filteredActiveBorrowings.length} peminjaman aktif
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsActiveSectionMinimized((prev) => !prev)}
                    className="w-full rounded-2xl px-3 sm:w-auto"
                  >
                    {isActiveSectionMinimized ? (
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
                      <Button variant="outline" size="sm" className="w-full rounded-2xl px-3 sm:w-auto">
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <span className="text-[12px] text-muted-foreground sm:text-right sm:text-[13px]">
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
                      onChange={(e) => {
                        setActiveSearchTerm(e.target.value)
                        setLinkedBorrowingFilter("")
                      }}
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
              {linkedBorrowingFilter && (
                <div className="flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
                  <span>Daftar difilter dari log Penggunaan untuk peminjaman #{linkedBorrowingFilter}.</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-xl border-blue-200 bg-white px-3 text-[12px] text-blue-700 hover:bg-blue-50 dark:border-blue-400/30 dark:bg-transparent dark:text-blue-200"
                    onClick={() => {
                      setActiveSearchTerm("")
                      setLinkedBorrowingFilter("")
                    }}
                  >
                    Tampilkan semua
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-0">
              {isActiveSectionMinimized ? (
                <div className="rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 text-center text-sm text-teal-900 dark:border-teal-400/20 dark:bg-teal-400/5 dark:text-teal-200">
                  Section alat yang perlu dikembalikan disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
                </div>
              ) : filteredActiveBorrowings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-[13px]">Tidak ada alat yang perlu dikembalikan</p>
              ) : (
                <div className="px-3 pb-4 sm:px-4 sm:pb-4">
                  <div className="space-y-4 py-3">
                    {paginatedActiveBorrowings.map((b) => {
                      const detailInfo = resolveDetailForBorrowing(b)
                      const assetName =
                        detailInfo?.detailInventoryName || detailInfo?.detailName || b.assetDetailName || b.assetName || "-"
                      const codeLabel = detailInfo?.detailCode || b.assetDetailCode || b.assetCode || "-"
                      const roomLabel = detailInfo?.roomName || detailInfo?.assetLocation || b.assetLocation || "-"
                      const returnNoId = getReturnNoId(b)
                      const assetSource = deriveAssetSource(b.assetType, b.assetDetailCode || b.assetCode)
                      const assetTypeLabel = assetSourceLabel(assetSource)
                      const dueDateLabel = b.dueDate ? formatDayTimeLabel(b.dueDate) : "Belum dijadwalkan"
                      const isExpanded = expandedActiveReturnIds.has(b.id)
                      const activeSections = buildReturnNarrativeSections(activeSelectedReturnColumns)(b)

                      return (
                        <SummaryResultCard
                          key={`active-return-${b.id}`}
                          title="Informasi Dasar Inventaris"
                          footer={(
                            <SummaryResultFooter
                              selected={selectedActiveReturnIds.has(b.id)}
                              onSelectedChange={() => toggleActiveReturnSelection(b.id)}
                              selectionLabel={`Pilih pengembalian aktif ${assetName}`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                onClick={() => toggleActiveCardCollapse(b.id)}
                                title={isExpanded ? "Sembunyikan detail pengembalian" : "Lihat detail pengembalian"}
                              >
                                <Eye className="h-4 w-4" />
                                Lihat
                              </Button>
                              {(() => {
                                const accessMessage = getReturnAccessMessage(b)
                                return !accessMessage ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenReturn(b)}
                                    title="Kembalikan peminjaman"
                                    className="h-7 gap-1 rounded-full bg-teal-600 px-2.5 text-[11px] font-semibold text-white hover:bg-teal-700"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Kembalikan
                                  </Button>
                                ) : null
                              })()}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                  >
                                    <Download className="h-4 w-4" />
                                    Unduh
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("pdf", b, "Pengembalian", activeSelectedReturnColumns)}>
                                    PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("word", b, "Pengembalian", activeSelectedReturnColumns)}>
                                    Word
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </SummaryResultFooter>
                          )}
                        >
                          {!isExpanded && (
                            <SummaryResultBody
                              assetName={assetName}
                              assetCode={codeLabel}
                              noId={returnNoId}
                              personValue={`${b.userName || "-"} • ${b.userNip || "-"}`}
                              unitValue={b.borrowerWorkUnit || "-"}
                              unitExtra={[b.destinationRoom, formatBorrowingPurposeType(b.purposeType)].filter(Boolean).join(" • ")}
                              timeLabel="Batas Pengembalian"
                              timeValue={dueDateLabel}
                              badges={(
                                <>
                                  <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${assetSourceBadgeClass(assetSource)}`}>
                                    {assetTypeLabel}
                                  </Badge>
                                  <Badge className={`gap-1 rounded-full border px-2 py-0.5 text-[11px] ${locationBadgeClass}`}>
                                    <MapPin className="h-3 w-3" />
                                    Lokasi alat: {roomLabel}
                                  </Badge>
                                </>
                              )}
                              statusBadges={(
                                <>
                                  {getStatusBadge(b)}
                                  {getBorrowingRestrictionBadge(b.status)}
                                </>
                              )}
                            />
                          )}
                          {isExpanded && (
                          <div className="space-y-3 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-3 sm:py-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge className={`border text-[11px] ${assetSourceBadgeClass(assetSource)}`}>
                                {assetTypeLabel}
                              </Badge>
                              <Badge className={`gap-1 border text-[11px] ${locationBadgeClass}`}>
                                <MapPin className="h-3 w-3" />
                                Lokasi alat: {roomLabel}
                              </Badge>
                              {getBorrowingRestrictionBadge(b.status)}
                            </div>
                            {activeSections.length ? (
                              <div className="columns-1 gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 lg:columns-2">
                                {activeSections.map((section) => (
                                  <div key={section.title} className="mb-3 break-inside-avoid space-y-1.5">
                                    <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                      {section.title}
                                    </div>
                                    <div className="divide-y divide-slate-200 dark:divide-slate-800/35 rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                                      {section.lines.map((line) => (
                                        <div
                                          key={`${section.title}-${line.label}`}
                                          className="detail-labeled-row"
                                        >
                                          <span className="font-medium text-slate-600 dark:text-slate-300">
                                            {line.label}
                                          </span>
                                          <span className="font-medium text-slate-900 dark:text-slate-100">{line.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 px-4 py-2.5 text-center text-[13px] text-slate-700 dark:text-slate-300">
                                Aktifkan minimal satu kolom untuk melihat detail pengembalian.
                              </div>
                            )}
                          </div>
                        )}
                        </SummaryResultCard>
                      )
                    })}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Menampilkan {activeReturnStartIndex + 1}-{Math.min(activeReturnStartIndex + RETURN_ROWS_PER_PAGE, filteredActiveBorrowings.length)} dari {filteredActiveBorrowings.length} peminjaman aktif
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentActiveReturnPage === 1}
                        onClick={() => setActiveReturnPage((page) => Math.max(1, page - 1))}
                        aria-label="Halaman alat dikembalikan sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {visibleActiveReturnPages.map((page) => (
                        typeof page === "number" ? (
                          <Button
                            key={page}
                            type="button"
                            variant={page === currentActiveReturnPage ? "default" : "outline"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToActiveReturnPage(page)}
                            aria-label={`Halaman alat dikembalikan ${page}`}
                            aria-current={page === currentActiveReturnPage ? "page" : undefined}
                          >
                            {page}
                          </Button>
                        ) : (
                          <span key={page} className="flex h-8 w-8 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                            ...
                          </span>
                        )
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentActiveReturnPage === totalActiveReturnPages}
                        onClick={() => setActiveReturnPage((page) => Math.min(totalActiveReturnPages, page + 1))}
                        aria-label="Halaman alat dikembalikan berikutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            </div>
          </Card>
          )}

          {returnView === "history" && (
          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700/35 dark:bg-slate-900/70">
            <div
              id="return-history-panel"
              role="tabpanel"
              aria-labelledby="return-history-tab"
            >
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Riwayat Pengembalian</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Total: {filteredReturnedBorrowings.length} riwayat
                </CardDescription>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 text-[13px] text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
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
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full rounded-2xl px-3 sm:w-auto">
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
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsHistorySectionMinimized((prev) => !prev)}
                  className="w-full rounded-2xl px-3 sm:w-auto"
                >
                  {isHistorySectionMinimized ? (
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
                <span className="text-[12px] text-muted-foreground sm:text-right sm:text-[13px]">
                  {historyReturnSelectedRows.length
                    ? `${historyReturnSelectedRows.length} baris dipilih`
                    : `Semua ${filteredReturnedBorrowings.length} baris`}
                </span>
              </div>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {isHistorySectionMinimized ? (
                <div className="rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 text-center text-sm text-teal-900 dark:border-teal-400/20 dark:bg-teal-400/5 dark:text-teal-200">
                  Section riwayat pengembalian disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
                </div>
              ) : (
                <>
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
                    <div className="px-3 pb-4 sm:px-4 sm:pb-4">
                      <div className="space-y-4 py-3">
                        {paginatedReturnedBorrowings.map((b) => {
                    const detailInfo = resolveDetailForBorrowing(b)
                    const historyDetailColumns = historySelectedReturnColumns.includes("tanggalPinjam")
                      ? historySelectedReturnColumns
                      : [...historySelectedReturnColumns, "tanggalPinjam"]
                    const historySections = buildReturnNarrativeSections(historyDetailColumns)(b)
                    const assetName =
                      detailInfo?.detailInventoryName || detailInfo?.detailName || b.assetDetailName || b.assetName || "-"
                    const codeLabel = detailInfo?.detailCode || b.assetDetailCode || b.assetCode || "-"
                    const roomNameLabel = detailInfo?.roomName || detailInfo?.assetLocation || b.assetLocation || "-"
                    const assetSource = deriveAssetSource(b.assetType, b.assetDetailCode || b.assetCode)
                    const assetTypeLabel = assetSourceLabel(assetSource)
                    const returnNoId = getReturnNoId(b)
                    const borrowerName = b.userName || "-"
                    const returnDateLabel = b.returnDate ? formatDayTimeLabel(b.returnDate) : "Belum dikembalikan"
                    const isExpanded = expandedHistoryReturnIds.has(b.id)
                    const showDamagedNotice =
                      b.status === "returned" && isDamagedReturnCondition(b.returnCondition)
                    return (
                        <SummaryResultCard
                          key={`history-card-${b.id}`}
                          title="Informasi Dasar Inventaris"
                          footer={(
                            <SummaryResultFooter
                              selected={selectedHistoryReturnIds.has(b.id)}
                              onSelectedChange={() => toggleHistoryReturnSelection(b.id)}
                              selectionLabel={`Pilih riwayat pengembalian ${assetName}`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                onClick={() => toggleHistoryCardCollapse(b.id)}
                                title={isExpanded ? "Sembunyikan detail riwayat pengembalian" : "Lihat detail riwayat pengembalian"}
                              >
                                <Eye className="h-4 w-4" />
                                Lihat
                              </Button>
                              {canManageReturnRecords ? (
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                                    onClick={() => openReturnEditDialog(b)}
                                    title="Edit pengembalian"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {canDeleteReturns && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                                      onClick={() => handleDeleteReturn(b)}
                                      title="Hapus"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canRequestDeleteReturns && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                                      onClick={() => handleRequestDeleteReturn(b)}
                                      title="Ajukan hapus"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                !canValidateReturns ? <span className="text-[12px] text-muted-foreground">Aksi terbatas</span> : null
                              )}
                              {canValidateReturns && b.status === "returned" &&
                                (b.returnValidatedAt ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-full border-border/60 px-2.5 text-[11px] text-muted-foreground"
                                    disabled
                                  >
                                    Tervalidasi
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 rounded-full border-green-600 px-2.5 text-[11px] text-green-700 hover:bg-green-50"
                                    onClick={() => handleValidateReturn(b.id)}
                                    disabled={validatingReturnId === b.id}
                                  >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    {validatingReturnId === b.id ? "Memvalidasi..." : "Validasi"}
                                  </Button>
                                ))}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                  >
                                    <Download className="h-4 w-4" />
                                    Unduh
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("pdf", b, "Riwayat Pengembalian", historySelectedReturnColumns)}>
                                    PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void exportSingleReturnNarrative("word", b, "Riwayat Pengembalian", historySelectedReturnColumns)}>
                                    Word
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </SummaryResultFooter>
                          )}
                        >
                          {!isExpanded && (
                            <SummaryResultBody
                              assetName={assetName}
                              assetCode={codeLabel}
                              noId={returnNoId}
                              personValue={`${borrowerName} / ${b.userNip || "-"}`}
                              unitValue={b.borrowerWorkUnit || "-"}
                              unitExtra={[b.destinationRoom, formatBorrowingPurposeType(b.purposeType)].filter(Boolean).join(" • ")}
                              timeLabel="Waktu Kembali"
                              timeValue={returnDateLabel}
                              badges={(
                                <>
                                  <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${assetSourceBadgeClass(assetSource)}`}>
                                    {assetTypeLabel}
                                  </Badge>
                                  <Badge className={`gap-1 rounded-full border px-2 py-0.5 text-[11px] ${locationBadgeClass}`}>
                                    <MapPin className="h-3 w-3" />
                                    Lokasi alat: {roomNameLabel}
                                  </Badge>
                                </>
                              )}
                              statusBadges={(
                                <>
                                  {getStatusBadge(b)}
                                  {showDamagedNotice && (
                                    <Badge className="rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-800 sm:text-[12px] dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300">
                                      Alat rusak
                                    </Badge>
                                  )}
                                </>
                              )}
                            />
                          )}
                          {isExpanded && (
                            <div className="space-y-3 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-3 sm:py-3">
                              {historySections.length ? (
                                <div className="columns-1 gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 lg:columns-2">
                                  {historySections.map((section) => (
                                    <div key={section.title} className="mb-3 break-inside-avoid space-y-1.5">
                                      <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                        {section.title}
                                      </div>
                                      <div className="divide-y divide-slate-200 dark:divide-slate-800/35 rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                                        {section.lines.map((line) => (
                                          <div
                                            key={`${section.title}-${line.label}`}
                                            className="detail-labeled-row"
                                          >
                                            <span className="font-medium text-slate-600 dark:text-slate-300">
                                              {line.label}
                                            </span>
                                            <span className="font-medium text-slate-900 dark:text-slate-100">{line.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 px-4 py-2.5 text-center text-[13px] text-slate-700 dark:text-slate-300">
                                  Aktifkan minimal satu kolom untuk melihat detail riwayat.
                                </div>
                              )}
                            </div>
                          )}
                        </SummaryResultCard>
                    )
                  })}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Menampilkan {historyReturnStartIndex + 1}-{Math.min(historyReturnStartIndex + RETURN_ROWS_PER_PAGE, filteredReturnedBorrowings.length)} dari {filteredReturnedBorrowings.length} riwayat
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentHistoryReturnPage === 1}
                        onClick={() => setHistoryReturnPage((page) => Math.max(1, page - 1))}
                        aria-label="Halaman riwayat pengembalian sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {visibleHistoryReturnPages.map((page) => (
                        typeof page === "number" ? (
                          <Button
                            key={page}
                            type="button"
                            variant={page === currentHistoryReturnPage ? "default" : "outline"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToHistoryReturnPage(page)}
                            aria-label={`Halaman riwayat pengembalian ${page}`}
                            aria-current={page === currentHistoryReturnPage ? "page" : undefined}
                          >
                            {page}
                          </Button>
                        ) : (
                          <span key={page} className="flex h-8 w-8 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                            ...
                          </span>
                        )
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentHistoryReturnPage === totalHistoryReturnPages}
                        onClick={() => setHistoryReturnPage((page) => Math.min(totalHistoryReturnPages, page + 1))}
                        aria-label="Halaman riwayat pengembalian berikutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                    </div>
                  )}
                </>
              )}
          </CardContent>
            </div>
          </Card>
          )}

          {showReturnModal && selectedBorrowing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-linear-to-br from-black/50 to-black/80 px-4">
              <Card className="max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-black/10 bg-white/95 dark:border-slate-800/35 dark:bg-slate-900/90">
                <CardHeader>
                  <CardTitle className="text-lg">Konfirmasi Pengembalian</CardTitle>
                  <CardDescription>
                    {(() => {
                      const detail = resolveDetailForBorrowing(selectedBorrowing)
                      const assetName =
                        detail?.detailInventoryName ||
                        detail?.detailName ||
                        selectedBorrowing.assetDetailName ||
                        selectedBorrowing.assetName ||
                        "-"
                      return `Pengembalian: ${assetName}`
                    })()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

              <div className="mt-8 pt-6 border-t border-border text-center">
                <p className="text-[13px] text-muted-foreground">
                  Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
                </p>
              </div>
        </div>
      </div>
      <DeleteReasonDialog
        open={Boolean(pendingDeleteReturn)}
        title="Arsipkan data pengembalian?"
        description={`Data pengembalian ${pendingDeleteReturn?.assetDetailName || pendingDeleteReturn?.assetName || "ini"} akan disembunyikan dari daftar utama, tetapi tetap tersimpan sebagai arsip Admin.`}
        value={deleteReason}
        isSubmitting={isDeletingReturn}
        onValueChange={setDeleteReason}
        onCancel={() => {
          if (isDeletingReturn) return
          setPendingDeleteReturn(null)
          setDeleteReason("")
        }}
        onConfirm={confirmDeleteReturn}
      />
      <DeleteReasonDialog
        open={Boolean(pendingArchiveReturnRequest)}
        title="Ajukan penghapusan pengembalian?"
        description={`Permintaan penghapusan ${pendingArchiveReturnRequest?.assetDetailName || pendingArchiveReturnRequest?.assetName || "pengembalian ini"} akan dikirim ke Admin untuk ditinjau.`}
        value={deleteReason}
        isSubmitting={isDeletingReturn}
        confirmLabel="Ajukan"
        submittingLabel="Mengajukan..."
        onValueChange={setDeleteReason}
        onCancel={() => {
          if (isDeletingReturn) return
          setPendingArchiveReturnRequest(null)
          setDeleteReason("")
        }}
        onConfirm={confirmRequestDeleteReturn}
      />
    </main>
  )
}
