"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { assetUsageService } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import { borrowingService, type Borrowing as ApiBorrowing } from "@/services/borrowing.service";
import deletionRequestService from "@/services/deletion-request.service";
import { maintenanceService } from "@/services/maintenance.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import {
    assetSourceLabel,
    borrowingStatusLabel,
    deriveAssetSource,
    type AssetSourceKey,
} from "@/utils/api-mappers";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import {
    formatDayTimeLabel,
    parseServerDateTimeValue,
    toLocalDateTimeString,
} from "@/utils/format";
import { buildInventorySearchKey } from "@/utils/inventory-search";
import { formatNoId } from "@/utils/record-id";
import { getUserRoleLabel, isAdminOrLeaderRole, isAdminRole, isStaffPjRole, isTechnicianRole } from "@/utils/role";
import { matchesSearchKeyword } from "@/utils/search-keyword";

import InventoryPicker from "@/components/inventory-picker";
import DeleteReasonDialog from "@/components/delete-reason-dialog";
import { SummaryResultBody, SummaryResultCard, SummaryResultFooter } from "@/components/summary-result-card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import {
    appendLine,
    ExportFormat,
    exportFormularReport,
    exportNarrativeReport,
    SectionBuilder,
    TableExportColumn,
    type DocumentSection,
    type FormularData,
    type SectionLine,
} from "@/utils/export-table";
import { AlertTriangle, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, HandHelping, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type BorrowableAsset = DetailInventoryItem

type BorrowingExportColumn = TableExportColumn<ApiBorrowing> & {
  defaultSelected?: boolean
}

const INVENTORY_REFRESH_EVENT = "inventory-refresh"
const BORROWING_REFRESH_SOURCE = "borrowing-page"

const BORROWING_ROWS_PER_PAGE = 2

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

const toDateTimeLocalInputValue = (value?: string | Date | null) => {
  const date = parseServerDateTimeValue(value)
  if (!date) return ""
  const offsetMs = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offsetMs)
  return localDate.toISOString().slice(0, 16)
}

const toLocalInputValue = (value?: string | Date | null): string => {
  if (!value) return ""
  const result = toLocalDateTimeString(value)
  if (result) return result
  // If toLocalDateTimeString fails, convert Date to string if needed
  if (value instanceof Date) {
    const offsetMs = value.getTimezoneOffset() * 60000
    const localDate = new Date(value.getTime() - offsetMs)
    return localDate.toISOString().slice(0, 16)
  }
  return String(value)
}

const parseLocalDateTimeInput = (value?: string | null): Date | null => {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null

  const matched = raw.match(/^((\d{4})-(\d{2})-(\d{2}))[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!matched) {
    const fallback = new Date(raw)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const [, , year, month, day, hour, minute, second = "0"] = matched
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getRecommendedExtensionDateValue = (borrowing?: Pick<ApiBorrowing, "dueDate"> | null) => {
  const now = new Date()
  const currentDueDate = parseServerDateTimeValue(borrowing?.dueDate)
  const base = currentDueDate && currentDueDate > now ? currentDueDate : now
  const recommended = new Date(base)

  recommended.setDate(recommended.getDate() + 1)
  recommended.setSeconds(0, 0)

  return toDateTimeLocalInputValue(recommended)
}

const formatDurationDiff = (diffMs: number): string => {
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "0 menit"

  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / (24 * 60 * 60))
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} hari`)
  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0) parts.push(`${minutes} menit`)
  if (seconds > 0 && days === 0) parts.push(`${seconds} detik`)

  return parts.length > 0 ? parts.join(" ") : "0 menit"
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

const normalizeDetailIdentifier = (value?: string | number | null) => {
  if (value === undefined || value === null) return ""
  return String(value).trim()
}

const getAssetFallbackDetailIds = (
  assetId: number,
  assetType: "medical" | "non_medical"
) => [`asset-${assetId}`, `asset-${assetType}-${assetId}`]

const isAssetFallbackDetailId = (
  detailId?: string | null,
  assetId?: number,
  assetType?: "medical" | "non_medical"
) => {
  if (!detailId || !assetId || !assetType) return false
  return getAssetFallbackDetailIds(assetId, assetType).includes(normalizeDetailIdentifier(detailId))
}

const isBorrowingLockRecord = (borrowing: Pick<ApiBorrowing, "status" | "returnValidatedAt">) =>
  ["pending", "approved", "borrowed", "overdue"].includes(borrowing.status) ||
  (borrowing.status === "returned" && !borrowing.returnValidatedAt)

const resolveOwnerWorkUnitForAsset = (asset?: BorrowableAsset | null) =>
  asset?.roomName || asset?.assetLocation || asset?.assetName || ""

const resolveDefaultDestinationRoom = (currentUser?: User | null) => {
  const subWorkUnit = currentUser?.subWorkUnit?.trim()
  if (subWorkUnit) return subWorkUnit
  const workUnit = currentUser?.workUnit?.trim()
  return workUnit || ""
}

const getDefaultFormData = (currentUser?: User | null) => ({
  assetId: "",
  assetType: "medical" as "medical" | "non_medical",
  assetDetailId: "",
  assetDetailName: "",
  assetDetailCode: "",
  borrowDate: "",
  dueDate: "",
  durationValue: "1",
  durationType: "day" as "day" | "month" | "year",
  borrowerPosition: currentUser ? getUserRoleLabel(currentUser.role) : "",
  borrowerWorkUnit: currentUser?.workUnit ?? "",
  ownerName: "",
  ownerPosition: "",
  ownerWorkUnit: "",
  purposeType: "inside_hospital" as "inside_hospital" | "outside_hospital",
  destinationRoom: resolveDefaultDestinationRoom(currentUser),
  purpose: "",
  quantity: "1",
  notes: "",
})
 
const borrowingExportColumnDefinitions: BorrowingExportColumn[] = [
  {
    key: "noId",
    label: "No ID",
    getValue: (borrowing) => formatNoId("PMJ", borrowing.id, borrowing.borrowingCode),
    defaultSelected: true,
  },
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
    label: "Nama Inventaris",
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
    key: "merek",
    label: "Merek / Model",
    getValue: (borrowing) => borrowing.assetDetailName || borrowing.assetName || "-",
    defaultSelected: true,
  },
  {
    key: "ruanganAlat",
    label: "Nama Ruangan Inventaris",
    getValue: (borrowing) => borrowing.assetLocation || "-",
    defaultSelected: true,
  },
  {
    key: "peminjam",
    label: "Peminjam",
    getValue: (borrowing) => borrowing.userName || "-",
    defaultSelected: true,
  },
  {
    key: "jabatanPeminjam",
    label: "Jabatan Peminjam",
    getValue: (borrowing) => borrowing.borrowerPosition || "-",
    defaultSelected: true,
  },
  {
    key: "unitKerjaPeminjam",
    label: "Unit Kerja Peminjam",
    getValue: (borrowing) => borrowing.borrowerWorkUnit || "-",
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
    getValue: (borrowing) => formatDayTimeLabel(borrowing.borrowDate, { showWeekday: false }),
    defaultSelected: true,
  },
  {
    key: "tanggalKembali",
    label: "Batas Pengembalian",
    getValue: (borrowing) =>
      borrowing.dueDate ? formatDayTimeLabel(borrowing.dueDate, { showWeekday: false }) : "-",
    defaultSelected: true,
  },
  {
    key: "pemilikAlat",
    label: "Pemilik Inventaris",
    getValue: (borrowing) => borrowing.ownerName || "-",
    defaultSelected: true,
  },
  {
    key: "jabatanPemilikAlat",
    label: "Jabatan Pemilik Inventaris",
    getValue: (borrowing) => borrowing.ownerPosition || "-",
    defaultSelected: true,
  },
  {
    key: "unitPemilikAlat",
    label: "Unit Pemilik Inventaris",
    getValue: (borrowing) => borrowing.ownerWorkUnit || "-",
    defaultSelected: true,
  },
  {
    key: "jenisKeperluan",
    label: "Jenis Keperluan",
    getValue: (borrowing) => formatBorrowingPurposeType(borrowing.purposeType),
    defaultSelected: true,
  },
  {
    key: "keperluan",
    label: "Keperluan",
    getValue: (borrowing) => borrowing.purpose || "-",
    defaultSelected: true,
  },
  {
    key: "tujuan",
    label: "Ruang / Instalasi Tujuan",
    getValue: (borrowing) => borrowing.destinationRoom || "-",
    defaultSelected: true,
  },
  {
    key: "jumlah",
    label: "Jumlah",
    getValue: (borrowing) => String(borrowing.quantity || 1),
    defaultSelected: true,
  },
  {
    key: "durasi",
    label: "Lama Peminjaman",
    getValue: (borrowing) => formatBorrowingDuration(borrowing.loanDurationValue, borrowing.loanDurationUnit),
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
          await refreshOperationalDataAndNotify()
          toast({
            title: "Pengembalian berhasil divalidasi",
            description: "Data pengembalian sudah diperbarui.",
          })
        } else {
          toast({
            title: "Validasi pengembalian gagal",
            description: result.message || "Proses validasi pengembalian gagal.",
            variant: "destructive",
          })
        }
      } catch {
        toast({
          title: "Validasi pengembalian gagal",
          description: "Terjadi kesalahan saat validasi pengembalian.",
          variant: "destructive",
        })
      }
    }
  const router = useRouter()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [borrowings, setBorrowings] = useState<ApiBorrowing[]>([])
  const [activeUsageLocks, setActiveUsageLocks] = useState<Set<string>>(new Set())
  const [activeMaintenanceLocks, setActiveMaintenanceLocks] = useState<Set<string>>(new Set())
  const [availableAssets, setAvailableAssets] = useState<BorrowableAsset[]>([])
  const [inventoryDetails, setInventoryDetails] = useState<DetailInventoryItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSource, setFilterSource] = useState<AssetSourceKey>("Semua")
  const [isBorrowingListMinimized, setIsBorrowingListMinimized] = useState(false)
  const [borrowingPage, setBorrowingPage] = useState(1)
  const [selectedBorrowingIds, setSelectedBorrowingIds] = useState<Set<number>>(() => new Set())
  const [selectedBorrowingExportColumns, setSelectedBorrowingExportColumns] = useState<string[]>(() =>
    borrowingExportColumnDefinitions.map((column) => column.key)
  )
  const [expandedBorrowingIds, setExpandedBorrowingIds] = useState<Set<number>>(() => new Set())
  const [selectedBorrowableAssetIds, setSelectedBorrowableAssetIds] = useState<string[]>([])

  const [formData, setFormData] = useState(() => getDefaultFormData())
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingBorrowing, setEditingBorrowing] = useState<ApiBorrowing | null>(null)
  const [pendingRejectBorrowing, setPendingRejectBorrowing] = useState<ApiBorrowing | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [approvalSubmittingId, setApprovalSubmittingId] = useState<number | null>(null)
  const [isRejectSubmitting, setIsRejectSubmitting] = useState(false)
  const [pendingDeleteBorrowing, setPendingDeleteBorrowing] = useState<ApiBorrowing | null>(null)
  const [pendingArchiveBorrowingRequest, setPendingArchiveBorrowingRequest] = useState<ApiBorrowing | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [isDeletingBorrowing, setIsDeletingBorrowing] = useState(false)
  const [editForm, setEditForm] = useState({
    borrowDate: "",
    dueDate: "",
    purpose: "",
    borrowerPosition: "",
    borrowerWorkUnit: "",
    ownerName: "",
    ownerPosition: "",
    ownerWorkUnit: "",
    purposeType: "inside_hospital" as "inside_hospital" | "outside_hospital",
    destinationRoom: "",
    loanDurationValue: "1",
    loanDurationUnit: "day" as "day" | "month" | "year",
    quantity: "1",
    notes: "",
  })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [extendModalOpen, setExtendModalOpen] = useState(false)
  const [extendingBorrowing, setExtendingBorrowing] = useState<ApiBorrowing | null>(null)
  const [extensionForm, setExtensionForm] = useState({
    newDueDate: "",
    extensionNotes: "",
  })
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [countdownTime, setCountdownTime] = useState<string>("")
  const [selectedDurationPreview, setSelectedDurationPreview] = useState<string>("")

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

  useEffect(() => {
    if (!currentUser) return
    setFormData((prev) => ({
      ...prev,
      borrowerPosition: prev.borrowerPosition || getUserRoleLabel(currentUser.role),
      borrowerWorkUnit: prev.borrowerWorkUnit || currentUser.workUnit || "",
      destinationRoom:
        prev.purposeType === "inside_hospital"
          ? prev.destinationRoom || resolveDefaultDestinationRoom(currentUser)
          : prev.destinationRoom,
    }))
  }, [currentUser])

  // Calculate due date based on borrow date and duration
  useEffect(() => {
    if (!formData.borrowDate) {
      setFormData(prev => ({ ...prev, dueDate: "" }))
      setSelectedDurationPreview("")
      return
    }

    const borrowDate = parseLocalDateTimeInput(formData.borrowDate)
    if (!borrowDate) {
      setFormData(prev => ({ ...prev, dueDate: "" }))
      setSelectedDurationPreview("")
      return
    }

    const dueDate = new Date(borrowDate)
    
    const duration = parseInt(formData.durationValue, 10) || 0
    if (formData.durationType === "day") {
      dueDate.setDate(dueDate.getDate() + duration)
    } else if (formData.durationType === "month") {
      dueDate.setMonth(dueDate.getMonth() + duration)
    } else if (formData.durationType === "year") {
      dueDate.setFullYear(dueDate.getFullYear() + duration)
    }

    const dueDateString = toDateTimeLocalInputValue(dueDate)
    const selectedDiff = dueDate.getTime() - borrowDate.getTime()
    setSelectedDurationPreview(formatDurationDiff(selectedDiff))
    setFormData(prev => ({ ...prev, dueDate: dueDateString }))
  }, [formData.borrowDate, formData.durationValue, formData.durationType])

  // Countdown timer effect
  useEffect(() => {
    if (!formData.dueDate || !showForm) {
      setCountdownTime("")
      return
    }

    const calculateCountdown = () => {
      try {
        const dueDate = parseLocalDateTimeInput(formData.dueDate)
        if (!dueDate) {
          setCountdownTime("")
          return
        }
        const now = new Date()
        const diff = dueDate.getTime() - now.getTime()

        if (diff <= 0) {
          setCountdownTime("Waktu habis")
          return
        }

        setCountdownTime(formatDurationDiff(diff))
      } catch {
        // Prevent error if date parsing fails
      }
    }

    calculateCountdown()
    const interval = setInterval(calculateCountdown, 1000)
    return () => clearInterval(interval)
  }, [formData.dueDate, showForm])

  const hasFullAccess = isAdminOrLeaderRole(currentUser?.role)
  const canValidateBorrowing = hasFullAccess || isStaffPjRole(currentUser?.role)
  const canDeleteBorrowing = isAdminRole(currentUser?.role)
  const canRequestDeleteBorrowing = currentUser?.role === "leader"
  const currentUserId = Number(currentUser?.id)

  const isBorrowingOwner = (borrowing: ApiBorrowing) =>
    Number.isFinite(currentUserId) && currentUserId > 0 && Number(borrowing.userId) === currentUserId

  const normalizeWorkUnit = (value?: string | null) => value?.trim().replace(/\s+/g, " ").toLowerCase() || ""

  const getStaffPjInstallationAccessMessage = (borrowing: ApiBorrowing) => {
    if (!isStaffPjRole(currentUser?.role)) return ""

    const actorWorkUnit = normalizeWorkUnit(currentUser?.workUnit)
    if (!actorWorkUnit) {
      return "Staff PJ wajib mengisi Unit Kerja / Instalasi di pengaturan akun sebelum memperpanjang peminjaman."
    }

    const borrowerWorkUnit = normalizeWorkUnit(borrowing.borrowerWorkUnit || borrowing.borrowerCurrentWorkUnit)
    if (!borrowerWorkUnit) {
      return "Instalasi peminjam belum terisi, sehingga Staff PJ belum dapat memperpanjang peminjaman ini."
    }

    if (actorWorkUnit !== borrowerWorkUnit) {
      return "Staff PJ hanya dapat memperpanjang peminjaman dari instalasi yang sama."
    }

    return ""
  }

  const canManageBorrowingExtension = (borrowing: ApiBorrowing) => {
    const staffPjAccessMessage = getStaffPjInstallationAccessMessage(borrowing)
    if (staffPjAccessMessage) return false
    if (!isBorrowingOwner(borrowing) && !isAdminOrLeaderRole(currentUser?.role) && !isStaffPjRole(currentUser?.role)) return false
    if (borrowing.status !== "overdue") return false
    if (borrowing.isExtensionBlocked) return false
    if ((borrowing.extensionCount || 0) >= 3) return false
    return true
  }

  const getBorrowingExtensionLimitMessage = (borrowing: ApiBorrowing) => {
    const staffPjAccessMessage = getStaffPjInstallationAccessMessage(borrowing)
    if (staffPjAccessMessage) return staffPjAccessMessage

    if (!isBorrowingOwner(borrowing) && !isAdminOrLeaderRole(currentUser?.role) && !isStaffPjRole(currentUser?.role)) {
      return "Perpanjangan hanya dapat diajukan oleh user peminjam sendiri, Staff PJ satu instalasi, leader, atau admin."
    }

    if (borrowing.isExtensionBlocked) {
      return "Perpanjangan telah dikunci. Alat harus segera dikembalikan."
    }

    if ((borrowing.extensionCount || 0) >= 3) {
      return "Batas maksimal perpanjangan 3 kali sudah tercapai."
    }

    return ""
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

      const availableItems = detailItems.filter((item) => {
        if (item.assetStatus === "disposed" || item.availability === "disposed") return false
        if (item.condition === "damaged") return false
        return true
      })

      setAvailableAssets(availableItems)
    } catch (error) {
      console.error("Error loading assets:", error)
    }
  }

  const loadActiveUsageLocks = async () => {
    try {
      const response = await assetUsageService.getAll({ page: 1, limit: 1000 })
      if (!response.success) {
        setActiveUsageLocks(new Set())
        return
      }

      const nextLocks = new Set<string>()
      response.data.forEach((record) => {
        if (record.endedAt) return

        const assetType = record.assetType === "non_medical" ? "non_medical" : "medical"
        const assetId = Number(record.assetId)
        if (!Number.isFinite(assetId) || assetId <= 0) return

        const baseKey = `${assetType}|${assetId}`
        const detailId = normalizeDetailIdentifier(record.assetDetailId)

        if (detailId && !isAssetFallbackDetailId(detailId, assetId, assetType)) {
          nextLocks.add(`${baseKey}|${detailId}`)
          return
        }

        nextLocks.add(baseKey)
      })

      setActiveUsageLocks(nextLocks)
    } catch (error) {
      console.error("Error loading active usage locks:", error)
      setActiveUsageLocks(new Set())
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

  const loadActiveMaintenanceLocks = async () => {
    try {
      const response = await maintenanceService.getAll({ page: 1, limit: 1000 })
      if (!response.success) {
        setActiveMaintenanceLocks(new Set())
        return
      }

      const nextLocks = new Set<string>()
      response.data.forEach((record) => {
        if (!["requested", "scheduled", "in_progress", "completed"].includes(record.status)) return

        const assetType = record.assetType === "non_medical" ? "non_medical" : "medical"
        const assetId = Number(record.assetId)
        if (!Number.isFinite(assetId) || assetId <= 0) return

        const baseKey = `${assetType}|${assetId}`
        const detailId = normalizeDetailIdentifier(record.assetDetailId)
        if (detailId) {
          if (isAssetFallbackDetailId(detailId, assetId, assetType)) {
            nextLocks.add(baseKey)
            return
          }
          nextLocks.add(`${baseKey}|${detailId}`)
          return
        }

        nextLocks.add(baseKey)
      })

      setActiveMaintenanceLocks(nextLocks)
    } catch (error) {
      console.error("Error loading active maintenance locks:", error)
      setActiveMaintenanceLocks(new Set())
    }
  }

  const dispatchInventoryRefresh = () => {
    window.dispatchEvent(new CustomEvent(INVENTORY_REFRESH_EVENT, { detail: { source: BORROWING_REFRESH_SOURCE } }))
  }

  const refreshOperationalData = async () => {
    await Promise.all([
      loadAssets(),
      loadBorrowings(),
      loadActiveUsageLocks(),
      loadActiveMaintenanceLocks(),
    ])
  }

  const refreshOperationalDataAndNotify = async () => {
    await refreshOperationalData()
    dispatchInventoryRefresh()
  }

  useEffect(() => {
    if (currentUser) {
      // Load data only once when component mounts
      let isMounted = true
      
      const loadAllData = async () => {
        if (!isMounted) return
        await Promise.all([
          loadAssets(),
          loadBorrowings(),
          loadActiveUsageLocks(),
          loadActiveMaintenanceLocks()
        ])
      }
      
      loadAllData()
      
      return () => {
        isMounted = false
      }
    }
  }, [currentUser])

  useEffect(() => {
    const handleInventoryRefresh = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.source === BORROWING_REFRESH_SOURCE) return
      void refreshOperationalData()
    }

    window.addEventListener(INVENTORY_REFRESH_EVENT, handleInventoryRefresh)
    return () => window.removeEventListener(INVENTORY_REFRESH_EVENT, handleInventoryRefresh)
  }, [])

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
    if (hasBorrowingOverdueBlock) {
      toast({
        title: "Peminjaman diblokir sementara",
        description: overdueBorrowingBlockMessage,
        variant: "destructive",
      })
      return
    }

    const effectiveOwnerWorkUnit = (derivedOwnerWorkUnitLabel || formData.ownerWorkUnit).trim()
    const missingRequiredFields = [
      selectedBorrowableAssets.length === 0 ? "Inventaris" : "",
      !formData.borrowDate ? "Tanggal Pinjam" : "",
      !formData.borrowerPosition.trim() ? "Jabatan Peminjam" : "",
      !formData.borrowerWorkUnit.trim() ? "Unit Kerja Peminjam" : "",
      !formData.ownerName.trim() ? "Nama Pemilik Inventaris" : "",
      !formData.ownerPosition.trim() ? "Jabatan Pemilik Inventaris" : "",
      !effectiveOwnerWorkUnit ? "Unit Kerja Pemilik Inventaris" : "",
      !formData.destinationRoom.trim()
        ? formData.purposeType === "inside_hospital"
          ? "Ruang / Instalasi Tujuan"
          : "Tujuan Pelayanan"
        : "",
      !formData.purpose.trim() ? "Keperluan Peminjaman" : "",
    ].filter(Boolean)

    if (missingRequiredFields.length > 0) {
      alert(`Mohon lengkapi field berikut: ${missingRequiredFields.join(", ")}`)
      return
    }

    try {
      const usageChecks = await Promise.all(
        selectedBorrowableAssets.map(async (asset) => {
          const response = await assetUsageService.getAll({
            page: 1,
            limit: 50,
            assetId: String(asset.assetId),
            assetType: asset.assetType,
          })
          const hasActiveUsage = Array.isArray(response.data) && response.data.some((usage) => {
            const matchesDetail = !asset.detailId || !usage.assetDetailId || usage.assetDetailId === asset.detailId
            return matchesDetail && !usage.endedAt
          })
          return { asset, hasActiveUsage }
        })
      )

      const blockedAsset = usageChecks.find((item) => item.hasActiveUsage)
      if (blockedAsset) {
        alert(`Aset ${formatInventoryLabel(blockedAsset.asset)} sedang dalam penggunaan aktif dan belum dapat dipinjam.`)
        return
      }
    } catch (usageError) {
      console.error("Failed to check asset usage before borrowing create:", usageError)
    }

    try {
      const successLabels: string[] = []
      const failedAssets: BorrowableAsset[] = []
      const failureMessages: string[] = []

      for (const selectedAsset of selectedBorrowableAssets) {
        try {
          const result = await borrowingService.create({
            assetId: selectedAsset.assetId,
            assetType: selectedAsset.assetType,
            assetDetailId: selectedAsset.detailId,
            assetDetailName: selectedAsset.detailName,
            assetDetailCode: selectedAsset.detailCode,
            borrowDate: toLocalInputValue(formData.borrowDate),
            dueDate: toLocalInputValue(formData.dueDate),
            borrowerPosition: formData.borrowerPosition.trim(),
            borrowerWorkUnit: formData.borrowerWorkUnit.trim(),
            ownerName: formData.ownerName.trim(),
            ownerPosition: formData.ownerPosition.trim(),
            ownerWorkUnit: resolveOwnerWorkUnitForAsset(selectedAsset) || effectiveOwnerWorkUnit,
            purposeType: formData.purposeType,
            destinationRoom: formData.destinationRoom.trim(),
            purpose: formData.purpose.trim(),
            loanDurationValue: Number.parseInt(formData.durationValue, 10) || undefined,
            loanDurationUnit: formData.durationType,
            quantity: Number.parseInt(formData.quantity, 10) || 1,
            notes: formData.notes || undefined,
          })

          if (!result.success) {
            throw new Error(result.message || "Gagal dibuat")
          }

          successLabels.push(formatInventoryLabel(selectedAsset))
        } catch (error: any) {
          failedAssets.push(selectedAsset)
          failureMessages.push(`${formatInventoryLabel(selectedAsset)}: ${error.message || "Gagal dibuat"}`)
        }
      }

      await refreshOperationalDataAndNotify()

      const successMessage =
        successLabels.length === 1
          ? "Berhasil membuat 1 peminjaman."
          : `Berhasil membuat ${successLabels.length} peminjaman.`

      if (failedAssets.length === 0) {
        setShowForm(false)
        setFormData(getDefaultFormData(currentUser))
        setSelectedBorrowableAssetIds([])
        window.scrollTo(0, 500)
        toast({
          title: "Berhasil",
          description: successMessage,
        })
        return
      }

      setSelectedBorrowableAssetIds(failedAssets.map((asset) => asset.detailId))
      if (successLabels.length > 0) {
        toast({
          title: "Sebagian berhasil",
          description: `${successMessage} ${failedAssets.length} gagal. ${failureMessages.join(" ")}`,
        })
        return
      }

      toast({
        title: "Gagal",
        description: failureMessages.join("\n"),
        variant: "destructive",
      })
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal membuat peminjaman",
        variant: "destructive",
      })
    }
  }

  const handleDeleteBorrowing = async (borrowing: ApiBorrowing) => {
    if (!canDeleteBorrowing) {
      alert("Hanya Admin yang dapat menghapus data peminjaman")
      return
    }
    const isConfirmed = await confirm({
      title: "Hapus data peminjaman",
      description: "Apakah Anda yakin ingin menghapus data peminjaman ini?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return
    setPendingDeleteBorrowing(borrowing)
    setDeleteReason("")
  }

  const confirmDeleteBorrowing = async () => {
    if (!pendingDeleteBorrowing) return
    const reason = deleteReason.trim()
    if (!reason) {
      alert("Alasan penghapusan wajib diisi")
      return
    }
    setIsDeletingBorrowing(true)
    try {
      const response = await borrowingService.delete(pendingDeleteBorrowing.id, reason)
      if (!response.success) {
        alert(response.message || "Gagal menghapus peminjaman")
        return
      }
      setPendingDeleteBorrowing(null)
      setDeleteReason("")
      await refreshOperationalDataAndNotify()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus peminjaman")
    } finally {
      setIsDeletingBorrowing(false)
    }
  }

  const handleRequestDeleteBorrowing = (borrowing: ApiBorrowing) => {
    setPendingArchiveBorrowingRequest(borrowing)
    setDeleteReason("")
  }

  const handleApproveBorrowing = async (borrowing: ApiBorrowing) => {
    if (!canValidateBorrowing) {
      toast({
        title: "Akses ditolak",
        description: "Hanya Admin, Leader, atau Staff PJ yang dapat menyetujui peminjaman.",
        variant: "destructive",
      })
      return
    }

    if (borrowing.status !== "pending") return

    const isConfirmed = await confirm({
      title: "Setujui peminjaman?",
      description: `Peminjaman ${borrowing.assetDetailName || borrowing.assetName || borrowing.borrowingCode || `#${borrowing.id}`} akan disetujui.`,
      confirmText: "Setujui",
    })
    if (!isConfirmed) return

    setApprovalSubmittingId(borrowing.id)
    try {
      const result = await borrowingService.approve(borrowing.id)
      if (!result.success) {
        toast({
          title: "Persetujuan gagal",
          description: result.message || "Gagal menyetujui peminjaman.",
          variant: "destructive",
        })
        return
      }

      await refreshOperationalDataAndNotify()

      toast({
        title: "Peminjaman disetujui",
        description: "Status peminjaman sudah diperbarui.",
      })
    } catch (error: any) {
      toast({
        title: "Persetujuan gagal",
        description: error.message || "Gagal menyetujui peminjaman.",
        variant: "destructive",
      })
    } finally {
      setApprovalSubmittingId(null)
    }
  }

  const openRejectBorrowingDialog = (borrowing: ApiBorrowing) => {
    if (!canValidateBorrowing) {
      toast({
        title: "Akses ditolak",
        description: "Hanya Admin, Leader, atau Staff PJ yang dapat menolak peminjaman.",
        variant: "destructive",
      })
      return
    }

    if (borrowing.status !== "pending") return
    setPendingRejectBorrowing(borrowing)
    setRejectReason("")
  }

  const handleRejectDialogClose = () => {
    if (isRejectSubmitting) return
    setPendingRejectBorrowing(null)
    setRejectReason("")
  }

  const confirmRejectBorrowing = async () => {
    if (!pendingRejectBorrowing) return

    const reason = rejectReason.trim()
    if (!reason) {
      toast({
        title: "Alasan wajib diisi",
        description: "Isi alasan penolakan sebelum menolak peminjaman.",
        variant: "destructive",
      })
      return
    }

    setIsRejectSubmitting(true)
    setApprovalSubmittingId(pendingRejectBorrowing.id)
    try {
      const result = await borrowingService.reject(pendingRejectBorrowing.id, reason)
      if (!result.success) {
        toast({
          title: "Penolakan gagal",
          description: result.message || "Gagal menolak peminjaman.",
          variant: "destructive",
        })
        return
      }

      await refreshOperationalDataAndNotify()

      setPendingRejectBorrowing(null)
      setRejectReason("")
      toast({
        title: "Peminjaman ditolak",
        description: "Status peminjaman sudah diperbarui.",
      })
    } catch (error: any) {
      toast({
        title: "Penolakan gagal",
        description: error.message || "Gagal menolak peminjaman.",
        variant: "destructive",
      })
    } finally {
      setIsRejectSubmitting(false)
      setApprovalSubmittingId(null)
    }
  }

  const confirmRequestDeleteBorrowing = async () => {
    if (!pendingArchiveBorrowingRequest) return
    const reason = deleteReason.trim()
    if (!reason) {
      alert("Alasan penghapusan wajib diisi")
      return
    }
    setIsDeletingBorrowing(true)
    try {
      const response = await deletionRequestService.create({
        targetType: "borrowing",
        targetId: Number(pendingArchiveBorrowingRequest.id),
        targetLabel: pendingArchiveBorrowingRequest.assetDetailName || pendingArchiveBorrowingRequest.assetName || pendingArchiveBorrowingRequest.borrowingCode || `Peminjaman #${pendingArchiveBorrowingRequest.id}`,
        reason,
      })
      if (!response.success) {
        alert(response.message || "Gagal mengajukan penghapusan peminjaman")
        return
      }
      setPendingArchiveBorrowingRequest(null)
      setDeleteReason("")
      toast({ title: "Permintaan penghapusan diajukan" })
    } catch (error: any) {
      alert(error.message || "Gagal mengajukan penghapusan peminjaman")
    } finally {
      setIsDeletingBorrowing(false)
    }
  }

  const openEditDialog = (borrowing: ApiBorrowing) => {
    setEditingBorrowing(borrowing)
    setEditForm({
      borrowDate: toDateTimeLocalInputValue(borrowing.borrowDate),
      dueDate: toDateTimeLocalInputValue(borrowing.dueDate),
      purpose: borrowing.purpose || "",
      borrowerPosition: borrowing.borrowerPosition || "",
      borrowerWorkUnit: borrowing.borrowerWorkUnit || "",
      ownerName: borrowing.ownerName || "",
      ownerPosition: borrowing.ownerPosition || "",
      ownerWorkUnit: borrowing.ownerWorkUnit || "",
      purposeType: borrowing.purposeType || "inside_hospital",
      destinationRoom: borrowing.destinationRoom || "",
      loanDurationValue: String(borrowing.loanDurationValue || 1),
      loanDurationUnit: borrowing.loanDurationUnit || "day",
      quantity: String(borrowing.quantity || 1),
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
      borrowerPosition: "",
      borrowerWorkUnit: "",
      ownerName: "",
      ownerPosition: "",
      ownerWorkUnit: "",
      purposeType: "inside_hospital",
      destinationRoom: "",
      loanDurationValue: "1",
      loanDurationUnit: "day",
      quantity: "1",
      notes: "",
    })
  }

  const handleSaveEdit = async () => {
    if (!editingBorrowing) return
    if (
      !editForm.purpose.trim() ||
      !editForm.borrowerPosition.trim() ||
      !editForm.borrowerWorkUnit.trim() ||
      !editForm.ownerName.trim() ||
      !editForm.ownerPosition.trim() ||
      !editForm.ownerWorkUnit.trim() ||
      !editForm.destinationRoom.trim()
    ) {
      alert("Lengkapi field formulir yang wajib diisi")
      return
    }
    setEditSubmitting(true)
    try {
      const payload = {
        borrowDate: editForm.borrowDate ? toLocalInputValue(editForm.borrowDate) : undefined,
        dueDate: editForm.dueDate ? toLocalInputValue(editForm.dueDate) : undefined,
        purpose: editForm.purpose.trim(),
        borrowerPosition: editForm.borrowerPosition.trim(),
        borrowerWorkUnit: editForm.borrowerWorkUnit.trim(),
        ownerName: editForm.ownerName.trim(),
        ownerPosition: editForm.ownerPosition.trim(),
        ownerWorkUnit: editForm.ownerWorkUnit.trim(),
        purposeType: editForm.purposeType,
        destinationRoom: editForm.destinationRoom.trim(),
        loanDurationValue: Number.parseInt(editForm.loanDurationValue, 10) || undefined,
        loanDurationUnit: editForm.loanDurationUnit,
        quantity: Number.parseInt(editForm.quantity, 10) || 1,
        notes: editForm.notes.trim() || undefined,
      }
      const result = await borrowingService.update(editingBorrowing.id, payload)
      if (!result.success) {
        alert(result.message || "Gagal menyimpan perubahan")
        return
      }
      await refreshOperationalDataAndNotify()
      handleEditDialogClose()
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan perubahan")
    } finally {
      setEditSubmitting(false)
    }
  }

  const openExtendDialog = (borrowing: ApiBorrowing) => {
    setExtendingBorrowing(borrowing)
    setExtensionForm({
      newDueDate: getRecommendedExtensionDateValue(borrowing),
      extensionNotes: borrowing.extensionNotes || "",
    })
    setExtendModalOpen(true)
  }

  const handleExtendDialogClose = () => {
    setExtendModalOpen(false)
    setExtendingBorrowing(null)
    setExtensionForm({
      newDueDate: "",
      extensionNotes: "",
    })
  }

  const handleSaveExtension = async () => {
    if (!extendingBorrowing) return

    if (!canManageBorrowingExtension(extendingBorrowing)) {
      toast({
        title: "Perpanjangan tidak tersedia",
        description: getBorrowingExtensionLimitMessage(extendingBorrowing) || "Anda tidak memiliki akses untuk memperpanjang peminjaman ini.",
        variant: "destructive",
      })
      return
    }

    const parsedNewDueDate = parseLocalDateTimeInput(extensionForm.newDueDate)
    if (!parsedNewDueDate) {
      toast({
        title: "Tanggal belum valid",
        description: "Pilih tanggal jatuh tempo baru yang valid.",
        variant: "destructive",
      })
      return
    }

    if (parsedNewDueDate.getTime() <= Date.now()) {
      toast({
        title: "Tanggal belum valid",
        description: "Tanggal jatuh tempo baru harus lebih besar dari waktu saat ini.",
        variant: "destructive",
      })
      return
    }

    setExtendSubmitting(true)
    try {
      const result = await borrowingService.extend(
        extendingBorrowing.id,
        toLocalInputValue(extensionForm.newDueDate),
        extensionForm.extensionNotes.trim() || undefined
      )

      if (!result.success) {
        toast({
          title: "Perpanjangan gagal",
          description: result.message || "Gagal memperpanjang waktu peminjaman.",
          variant: "destructive",
        })
        return
      }

      await refreshOperationalDataAndNotify()

      handleExtendDialogClose()
      toast({
        title: "Perpanjangan berhasil",
        description: "Batas waktu peminjaman sudah diperbarui.",
      })
    } catch (error: any) {
      toast({
        title: "Perpanjangan gagal",
        description: error.message || "Gagal memperpanjang waktu peminjaman.",
        variant: "destructive",
      })
    } finally {
      setExtendSubmitting(false)
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

  const getBorrowingRestrictionBadge = (status: string) => {
    if (status !== "overdue") return null

    return (
      <Badge className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
        Diblokir meminjam
      </Badge>
    )
  }

  const getBorrowingNoId = (borrowing: ApiBorrowing) =>
    formatNoId("PMJ", borrowing.id, borrowing.borrowingCode)

  const visibleBorrowings = borrowings.filter((b) => isBorrowingLockRecord(b))

  const filteredBorrowings = visibleBorrowings.filter((b) => {
    const assetName = b.assetDetailName || b.assetName || ""
    const borrowerName = b.userName || ""
    const matchesSearch = matchesSearchKeyword(searchTerm, [
      getBorrowingNoId(b),
      b.borrowingCode,
      assetName,
      borrowerName,
      b.userNip,
      b.borrowerPosition,
      b.borrowerWorkUnit,
      b.ownerName,
      b.ownerWorkUnit,
      b.assetDetailCode,
      b.assetCode,
      b.purpose,
      b.destinationRoom,
      b.notes,
    ])

    const assetSource = deriveAssetSource(b.assetType, b.assetCode)
    const matchesSource = filterSource === "Semua" || assetSource === filterSource
    return matchesSearch && matchesSource
  })

  const selectedBorrowings = filteredBorrowings.filter((b) => selectedBorrowingIds.has(b.id))

  useEffect(() => {
    setBorrowingPage(1)
  }, [visibleBorrowings.length, filterSource, searchTerm])

  const totalBorrowingPages = Math.max(1, Math.ceil(filteredBorrowings.length / BORROWING_ROWS_PER_PAGE))
  const currentBorrowingPage = Math.min(borrowingPage, totalBorrowingPages)
  const borrowingStartIndex = (currentBorrowingPage - 1) * BORROWING_ROWS_PER_PAGE
  const paginatedBorrowings = filteredBorrowings.slice(
    borrowingStartIndex,
    borrowingStartIndex + BORROWING_ROWS_PER_PAGE,
  )
  const visibleBorrowingPages = buildVisiblePageItems(currentBorrowingPage, totalBorrowingPages)
  const goToBorrowingPage = (page: number) => {
    setBorrowingPage(Math.min(totalBorrowingPages, Math.max(1, page)))
  }

  const getAssetRoom = (detail?: DetailInventoryItem, fallback?: string) => {
    return (
      detail?.roomName ||
      detail?.assetLocation ||
      fallback ||
      "INSTALASI GAWAT DARURAT (IGD)"
    )
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
      const borrowerPosition = borrowing.borrowerPosition || "-"
      const borrowerWorkUnit = borrowing.borrowerWorkUnit || "-"
      const ownerName = borrowing.ownerName || "-"
      const ownerPosition = borrowing.ownerPosition || "-"
      const ownerWorkUnit = borrowing.ownerWorkUnit || "-"
      const purposeTypeLabel = formatBorrowingPurposeType(borrowing.purposeType)
      const destinationRoom = borrowing.destinationRoom || "-"
      const durationLabel = formatBorrowingDuration(borrowing.loanDurationValue, borrowing.loanDurationUnit)
      const quantityLabel = String(borrowing.quantity || 1)
      const borrowPurpose = borrowing.purpose || "-"
      const borrowDateLabel = formatDayTimeLabel(borrowing.borrowDate, { showWeekday: false })
      const dueDateLabel = formatDayTimeLabel(borrowing.dueDate, { showWeekday: false })
      const notesLabel = borrowing.notes || "-"
      const validatorLabel = getValidatorDisplay(borrowing)
      const statusLabel = getBorrowingStatusLabel(borrowing.status)
      const borrowingNoId = getBorrowingNoId(borrowing)

      const identities: SectionLine[] = []
      if (columnSet.has("noId")) {
        appendLine(identities, "No ID Peminjaman", borrowingNoId)
      }
      if (columnSet.has("jenisInventaris")) {
        appendLine(identities, "Jenis Inventaris", assetTypeLabel)
      }
      if (columnSet.has("namaAlat")) {
        appendLine(identities, "Nama Inventaris", assetName)
      }
      if (columnSet.has("kode")) {
        appendLine(identities, "Kode Inventaris", assetCode)
      }
      if (columnSet.has("merek")) {
        const brandModel = detail?.detailBrandModel || detail?.detailName || ""
        if (brandModel) {
          appendLine(identities, "Merek / Model", brandModel)
        }
      }
      if (columnSet.has("ruanganAlat")) {
        appendLine(identities, "Nama Ruangan Inventaris", assetRoom)
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
        appendLine(details, "Jenis Keperluan", purposeTypeLabel)
      }
      if (columnSet.has("keperluan")) {
        appendLine(details, "Keperluan", borrowPurpose)
      }
      if (columnSet.has("tujuan")) {
        appendLine(details, "Ruang / Instalasi Tujuan", destinationRoom)
      }
      if (columnSet.has("jumlah")) {
        appendLine(details, "Jumlah", quantityLabel)
      }
      if (columnSet.has("durasi")) {
        appendLine(details, "Lama Peminjaman", durationLabel)
      }
      if (columnSet.has("tanggalPinjam")) {
        appendLine(details, "Tanggal Pinjam", borrowDateLabel)
      }
      if (columnSet.has("tanggalKembali")) {
        appendLine(details, "Batas Pengembalian", dueDateLabel)
      }

      const ownerLines: SectionLine[] = []
      if (columnSet.has("pemilikAlat")) {
        appendLine(ownerLines, "Nama Pemilik Inventaris", ownerName)
      }
      if (columnSet.has("jabatanPemilikAlat") && ownerPosition !== "-") {
        appendLine(ownerLines, "Jabatan Pemilik Inventaris", ownerPosition)
      }
      if (columnSet.has("unitPemilikAlat")) {
        appendLine(ownerLines, "Unit Pemilik Inventaris", ownerWorkUnit)
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
        sections.push({ title: "Informasi Dasar Inventaris", lines: identities })
      }
      if (details.length) {
        sections.push({ title: "Detail Peminjaman", lines: details })
      }
      if (ownerLines.length) {
        sections.push({ title: "Identitas Pemilik / PJ Inventaris", lines: ownerLines })
      }
      if (logLines.length) {
        sections.push({ title: "Log Peminjaman & Validasi", lines: logLines })
      }
      if (validation.length) {
        sections.push({ title: "Status Akhir", lines: validation })
      }
      return sections
    }
  }

  const buildBorrowingFormular = (borrowing: ApiBorrowing): FormularData => {
    const detail = resolveDetailForBorrowing(borrowing)
    const assetName = borrowing.assetDetailName || detail?.detailInventoryName || detail?.detailName || borrowing.assetName || "-"
    const assetCode = borrowing.assetDetailCode || detail?.detailCode || borrowing.assetCode || "-"
    const brandModel = detail?.detailBrandModel || detail?.detailName || "-"
    const assetRoom = getAssetRoom(detail, borrowing.assetLocation)
    const borrowingNoId = getBorrowingNoId(borrowing)
    const borrowDate = formatDayTimeLabel(borrowing.borrowDate, { showWeekday: false })
    const dueDate = formatDayTimeLabel(borrowing.dueDate, { showWeekday: false })
    const duration = formatBorrowingDuration(borrowing.loanDurationValue, borrowing.loanDurationUnit)
    return {
      formTitle: "FORMULIR PEMINJAMAN ALAT MEDIS",
      formNo: borrowingNoId,
      introText: "Saya yang bertanda tangan di bawah ini:",
      sections: [
        {
          numeral: "I",
          title: "Identitas Peminjam",
          fields: [
            { label: "Nama", value: borrowing.userName || "-" },
            { label: "NIP", value: borrowing.userNip || "-" },
            { label: "Jabatan", value: borrowing.borrowerPosition || "-" },
            { label: "Unit Kerja", value: borrowing.borrowerWorkUnit || "-" },
          ],
        },
        {
          numeral: "II",
          title: "Identitas Pemilik Alat",
          fields: [
            { label: "Nama", value: borrowing.ownerName || "-" },
            { label: "Jabatan", value: borrowing.ownerPosition || "-" },
            { label: "Unit Kerja", value: borrowing.ownerWorkUnit || "-" },
          ],
        },
        {
          numeral: "III",
          title: "Keperluan Peminjaman",
          fields: [
            { label: "Jenis Keperluan", value: formatBorrowingPurposeType(borrowing.purposeType) },
            { label: "Uraian Keperluan", value: borrowing.purpose || "-" },
            { label: "Ruang / Instalasi Tujuan", value: borrowing.destinationRoom || "-" },
          ],
        },
        {
          numeral: "IV",
          title: "Lama Peminjaman",
          fields: [
            { label: "Durasi", value: duration },
            { label: "Tanggal Pinjam", value: borrowDate },
            { label: "Batas Pengembalian", value: dueDate },
            { label: "Ruangan Alat", value: assetRoom },
          ],
        },
      ],
      assetsNumeral: "V",
      assetsTitle: "Alat Yang Dipinjam",
      assets: [
        {
          name: assetName,
          spec: assetCode,
          brand: brandModel,
          qty: String(borrowing.quantity || 1),
        },
      ],
      signatureDate: `Jakarta, ..................... 20.....`,
      signatureLeft: { title: "Yang Menyerahkan", name: borrowing.ownerName || "(.....)" },
      signatureRight: { title: "Yang Menerima", name: borrowing.userName || "(.....)" },
      approverLabel: "MENGETAHUI",
      approverLeft: { title: "Kepala Unit (Pemilik Alat)", name: borrowing.ownerName || "(.....)" },
      approverRight: { title: "Kepala Unit (Peminjam Alat)", name: borrowing.userName || "(.....)" },
      notes: ["Formulir ini wajib diisi lengkap sebelum alat dipinjam.", "Peminjam bertanggung jawab atas keselamatan alat selama masa peminjaman."],
    }
  }

  const handleExport = (format: ExportFormat) => {
    const rowsToExport = selectedBorrowings.length ? selectedBorrowings : filteredBorrowings
    if (!rowsToExport.length) return
    if (format === 'excel') {
      void exportNarrativeReport(format, {
        title: "Daftar Peminjaman",
        subtitle: "LAPORAN OPERASIONAL PEMINJAMAN",
        entries: rowsToExport,
        filePrefix: "daftar-peminjaman",
        buildSections: buildBorrowingNarrativeSections(selectedBorrowingExportColumns),
        emptyMessage: "Tidak ada data peminjaman yang dipilih.",
      })
    } else {
      void exportFormularReport(format, {
        entries: rowsToExport,
        filePrefix: "formulir-peminjaman",
        buildFormular: buildBorrowingFormular,
      })
    }
  }

  const _exportSingleBorrowingNarrative = async (format: ExportFormat, borrowing: ApiBorrowing) => {
    void exportFormularReport(format, {
      entries: [borrowing],
      filePrefix: `formulir-peminjaman-${borrowing.id}`,
      buildFormular: buildBorrowingFormular,
    })
  }

  const toggleBorrowingSummary = (id: number) => {
    setExpandedBorrowingIds((prev) => {
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

  const currentUserOverdueBorrowings = useMemo(() => {
    if (!Number.isFinite(currentUserId) || currentUserId <= 0) return []

    return borrowings.filter(
      (borrowing) =>
        Number(borrowing.userId) === currentUserId &&
        borrowing.status === "overdue"
    )
  }, [borrowings, currentUser?.id])

  const hasBorrowingOverdueBlock = currentUserOverdueBorrowings.length > 0
  const overdueBorrowingBlockMessage = hasBorrowingOverdueBlock
    ? `Anda masih memiliki peminjaman yang sudah melewati batas waktu. Kembalikan alat tersebut terlebih dahulu, atau perbarui batas waktu peminjaman bila alat masih digunakan.`
    : ""

  const pendingCount = visibleBorrowings.filter((b) => b.status === "pending").length
  const pendingValidationCount = visibleBorrowings.filter(
    (b) => b.status === "returned" && !b.returnValidatedAt
  ).length
  const activeBorrowings = visibleBorrowings.filter((b) =>
    ["approved", "borrowed", "overdue"].includes(b.status)
  )
  const activeBorrowingAssetLocks = new Set<string>()
  const activeBorrowingDetailLocks = new Set<string>()

  activeBorrowings.forEach((borrowing) => {
    const assetType = borrowing.assetType === "non_medical" ? "non_medical" : "medical"
    const baseLockKey = `${assetType}|${borrowing.assetId}`
    const detailId = normalizeDetailIdentifier(borrowing.assetDetailId)

    if (!detailId || isAssetFallbackDetailId(detailId, borrowing.assetId, assetType)) {
      activeBorrowingAssetLocks.add(baseLockKey)
      return
    }

    activeBorrowingDetailLocks.add(`${baseLockKey}|${detailId}`)
  })

  const isMaintenanceLockedAsset = (asset: BorrowableAsset) => {
    const baseLockKey = `${asset.assetType}|${asset.assetId}`
    return (
      activeMaintenanceLocks.has(baseLockKey) ||
      activeMaintenanceLocks.has(`${baseLockKey}|${asset.detailId}`)
    )
  }

  const isBorrowingLockedAsset = (asset: BorrowableAsset) => {
    const baseLockKey = `${asset.assetType}|${asset.assetId}`
    return (
      activeBorrowingAssetLocks.has(baseLockKey) ||
      activeBorrowingDetailLocks.has(`${baseLockKey}|${asset.detailId}`)
    )
  }

  const getEffectiveAvailability = (asset: BorrowableAsset) => {
    const isFallbackAssetItem = isAssetFallbackDetailId(asset.detailId, asset.assetId, asset.assetType)
    const baseLockKey = `${asset.assetType}|${asset.assetId}`
    const detailLockKey = `${baseLockKey}|${asset.detailId}`

    if (asset.availability === "disposed") return "disposed"
    if (activeUsageLocks.has(baseLockKey) || activeUsageLocks.has(detailLockKey)) {
      return "in_use"
    }
    if (asset.availability === "maintenance" || isMaintenanceLockedAsset(asset)) {
      return "maintenance"
    }
    if (asset.availability === "in_use") return "in_use"
    if (isBorrowingLockedAsset(asset)) {
      return "borrowed"
    }
    if (isFallbackAssetItem) {
      if (asset.assetStatus === "disposed") return "disposed"
      if (asset.assetStatus === "maintenance") return "maintenance"
      if (asset.assetStatus === "in_use") return "in_use"
      if (asset.assetStatus === "borrowed") return "borrowed"
    }
    return "available"
  }

  const getEffectiveAvailabilityLabel = (asset: BorrowableAsset) => {
    const effectiveAvailability = getEffectiveAvailability(asset)
    if (effectiveAvailability === "maintenance") return "Dalam Perbaikan"
    if (effectiveAvailability === "in_use") return "Sedang Digunakan"
    if (effectiveAvailability === "borrowed") return "Dipinjam"
    if (effectiveAvailability === "disposed") return "Nonaktif"
    return "Tersedia"
  }

  const getConditionLabel = (asset: BorrowableAsset) => {
    if (asset.condition === "damaged") return "Rusak"
    if (asset.condition === "poor") return "Kurang"
    if (asset.condition === "fair") return "Cukup"
    return "Baik"
  }

  const borrowableAssets = filteredAvailableAssets.filter((asset) => {
    if (getEffectiveAvailability(asset) !== "available") return false
    if (asset.condition === "damaged") return false

    return true
  })

  const formatInventoryLabel = (asset: BorrowableAsset) => {
    const baseName = asset.detailInventoryName || asset.detailName || asset.assetName || "Inventaris"
    const brandSegment = asset.detailBrandModel ? ` (${asset.detailBrandModel})` : ""
    const codeSegment = asset.detailCode ? ` - ${asset.detailCode}` : ""
    return `${baseName}${brandSegment}${codeSegment}`.trim()
  }

  const formatInventoryDisplayLabel = (asset: BorrowableAsset) => {
    const baseLabel = formatInventoryLabel(asset)
    return asset.serialNumber ? `${baseLabel} (${asset.serialNumber})` : baseLabel
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

  const selectedBorrowableAssets = borrowableAssets.filter((asset) =>
    selectedBorrowableAssetIds.includes(asset.detailId)
  )

  const derivedOwnerWorkUnitLabel = useMemo(() => {
    if (selectedBorrowableAssets.length === 0) {
      return formData.ownerWorkUnit
    }

    const labels = Array.from(
      new Set(
        selectedBorrowableAssets
          .map((asset) => resolveOwnerWorkUnitForAsset(asset))
          .filter(Boolean)
      )
    )

    if (labels.length === 0) {
      return formData.ownerWorkUnit
    }

    if (labels.length === 1) {
      return labels[0]
    }

    return "Mengikuti ruangan masing-masing inventaris terpilih"
  }, [formData.ownerWorkUnit, selectedBorrowableAssets])

  const handleToggleBorrowableAsset = (asset: BorrowableAsset) => {
    const isSelectingAsset = !selectedBorrowableAssetIds.includes(asset.detailId)

    setSelectedBorrowableAssetIds((prev) =>
      prev.includes(asset.detailId)
        ? prev.filter((item) => item !== asset.detailId)
        : [...prev, asset.detailId]
    )

    setFormData((prev) => ({
      ...prev,
      ownerWorkUnit: resolveOwnerWorkUnitForAsset(asset) || prev.ownerWorkUnit,
    }))

    if (!isSelectingAsset) {
      return
    }

    window.setTimeout(() => {
      const borrowDateInput = borrowDateInputRef.current
      if (!borrowDateInput) return

      const rect = borrowDateInput.getBoundingClientRect()
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight

      if (!isVisible) {
        borrowDateInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
      }

      borrowDateInput.focus({ preventScroll: true })
    }, 120)
  }

  const borrowingFormRef = useRef<HTMLDivElement | null>(null)
  const borrowingAssetPickerRef = useRef<HTMLDivElement | null>(null)
  const borrowDateInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!showForm) return

    window.requestAnimationFrame(() => {
      borrowingFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      })

      const pickerButton = borrowingAssetPickerRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-label="Pilih satu atau lebih inventaris"]'
      )
      pickerButton?.focus({ preventScroll: true })
    })
  }, [showForm])

  const blockedBorrowingLabels = currentUserOverdueBorrowings.slice(0, 3).map((borrowing) => {
    const noId = getBorrowingNoId(borrowing)
    const itemName = borrowing.assetDetailName || borrowing.assetName || "Inventaris"
    return `${noId} - ${itemName}`
  })

  return (
    <main
      className="min-h-full"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}
    >
      <div>
        <div className="w-full space-y-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-5">
                <div className="rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
                  <HandHelping className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-[18px] font-bold text-foreground">Peminjaman</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  className="w-full rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700 sm:w-auto"
                  disabled={hasBorrowingOverdueBlock}
                  onClick={() => {
                    if (hasBorrowingOverdueBlock) {
                      toast({
                        title: "Peminjaman diblokir sementara",
                        description: overdueBorrowingBlockMessage,
                        variant: "destructive",
                      })
                      return
                    }
                    setFormData(getDefaultFormData(currentUser))
                    setSelectedBorrowableAssetIds([])
                    setShowForm(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah Peminjaman
                </Button>
              </div>
            </div>
          </section>

          {hasBorrowingOverdueBlock ? (
            <Alert variant="destructive" className="rounded-2xl border-red-200 bg-red-50/90">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Peminjaman baru dikunci sementara</AlertTitle>
              <AlertDescription>
                <p>{overdueBorrowingBlockMessage}</p>
                {blockedBorrowingLabels.length > 0 ? (
                  <p>{`Data terlambat: ${blockedBorrowingLabels.join(", ")}`}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentUserOverdueBorrowings.map((borrowing) => {
                    const canExtend = canManageBorrowingExtension(borrowing)
                    return (
                      <Button
                        key={borrowing.id}
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-red-300 bg-white px-3 text-red-700 hover:bg-red-100"
                        disabled={!canExtend}
                        onClick={() => openExtendDialog(borrowing)}
                        title={canExtend ? "Perpanjang waktu peminjaman" : getBorrowingExtensionLimitMessage(borrowing)}
                      >
                        {canExtend ? `Perpanjang ${getBorrowingNoId(borrowing)}` : `${getBorrowingNoId(borrowing)} terkunci`}
                      </Button>
                    )
                  })}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Menunggu</p>
                    <p className="text-xl font-semibold text-amber-600 mt-1">{pendingCount}</p>
                  </div>
                  <Search className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Sedang Dipinjam</p>
                    <p className="text-xl font-semibold text-foreground mt-1">{activeBorrowings.length}</p>
                  </div>
                  <Sparkles className="h-4 w-4 text-teal-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Menunggu Validasi</p>
                    <p className="text-xl font-semibold text-teal-600 mt-1">{pendingValidationCount}</p>
                  </div>
                  <CheckCircle className="h-4 w-4 text-teal-500 shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>

          {showForm && (
              <Card ref={borrowingFormRef} className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white/80 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Form Peminjaman Baru</CardTitle>
                <CardDescription className="text-[12px] text-muted-foreground">
                  Isi detail inventaris dan tanggal pinjam.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid mobile-form-grid gap-3">
                  <div ref={borrowingAssetPickerRef}>
                  <label className="block text-[14px] font-medium text-foreground mb-2">Pilih Inventaris</label>
                  <InventoryPicker
                    assets={borrowableAssets}
                    selectedAssets={selectedBorrowableAssets}
                    onSelect={handleToggleBorrowableAsset}
                    onToggleSelect={handleToggleBorrowableAsset}
                    multiSelect
                    formatLabel={formatInventoryDisplayLabel}
                    getItemKey={getBorrowableAssetKey}
                    getAssetCategory={(asset) => asset.assetType}
                    showCategoryFilter
                    searchValue={buildInventorySearchKey}
                    placeholder="Cari No ID, inventaris, atau kode..."
                    buttonLabel="Pilih satu atau lebih inventaris"
                    ariaLabel="Pilih satu atau lebih inventaris"
                    noResultsLabel="Tidak ada inventaris tersedia"
                    selectedSummaryLabel={(assets) => `${assets.length} inventaris dipilih`}
                    renderItemMeta={(asset) => (
                      <span>
                        Status: {getEffectiveAvailabilityLabel(asset)} · Kondisi: {getConditionLabel(asset)}
                      </span>
                    )}
                    disabled={hasBorrowingOverdueBlock}
                  />
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    {hasBorrowingOverdueBlock
                      ? "Pemilihan inventaris dikunci karena Anda masih memiliki peminjaman terlambat."
                      : "Pilih inventaris yang akan dipinjam."}
                  </p>
                  {selectedBorrowableAssets.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedBorrowableAssets.map((asset) => (
                        <div
                          key={`selected-${asset.detailId}`}
                          className="flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[12px] text-teal-800"
                        >
                          <span className="max-w-65 truncate">{formatInventoryDisplayLabel(asset)}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleBorrowableAsset(asset)}
                            className="rounded-full p-0.5 text-teal-700 transition hover:bg-teal-100"
                            aria-label={`Hapus ${formatInventoryDisplayLabel(asset)} dari pilihan`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                  <div>
                    <label className="block text-[14px] font-medium mb-1">Tanggal Pinjam</label>
                    <input
                        ref={borrowDateInputRef}
                      type="datetime-local"
                      value={formData.borrowDate}
                      onChange={(e) => setFormData({ ...formData, borrowDate: e.target.value })}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[14px] font-medium mb-1">Durasi Peminjaman</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="number"
                        min="1"
                        value={formData.durationValue}
                        onChange={(e) => setFormData({ ...formData, durationValue: e.target.value })}
                        className="flex-1 rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                        placeholder="Jumlah"
                      />
                      <select
                        value={formData.durationType}
                        onChange={(e) => setFormData({ ...formData, durationType: e.target.value as "day" | "month" | "year" })}
                        className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500 sm:w-auto"
                      >
                        <option value="day">Hari</option>
                        <option value="month">Bulan</option>
                        <option value="year">Tahun</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[14px] font-medium mb-1">Batas Pengembalian</label>
                    <input
                      type="datetime-local"
                      value={formData.dueDate}
                      readOnly
                      className="w-full rounded-2xl border border-border/80 bg-gray-100 px-3 py-2 text-[14px] text-foreground cursor-not-allowed"
                    />
                    {countdownTime && (
                      <div className="mt-2 p-3 rounded-xl bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200">
                        {selectedDurationPreview ? (
                          <p className="text-[13px] font-medium text-amber-700">
                            Durasi sesuai pilihan: {selectedDurationPreview}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[14px] font-semibold text-amber-700">Sisa Waktu Saat Ini:</p>
                        <p className="text-lg font-bold text-orange-600 font-mono mt-1">{countdownTime}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[14px] font-medium mb-1">Nama Peminjam</label>
                    <Input value={currentUser?.name || "-"} readOnly className="rounded-2xl" />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Jabatan Peminjam</label>
                    <Input
                      value={formData.borrowerPosition}
                      onChange={(e) => setFormData({ ...formData, borrowerPosition: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Contoh: Staff Pelayanan"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Unit Kerja Peminjam</label>
                    <Input
                      value={formData.borrowerWorkUnit}
                      onChange={(e) => setFormData({ ...formData, borrowerWorkUnit: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Contoh: IGD"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Jumlah per Inventaris</label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="rounded-2xl"
                    />
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Nilai ini diterapkan ke setiap inventaris yang dipilih.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Nama Pemilik Inventaris</label>
                    <Input
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Nama penanggung jawab alat"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Jabatan Pemilik Inventaris</label>
                    <Input
                      value={formData.ownerPosition}
                      onChange={(e) => setFormData({ ...formData, ownerPosition: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Contoh: Kepala Unit"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[14px] font-medium mb-1">Unit Kerja Pemilik Inventaris</label>
                    <Input
                      value={derivedOwnerWorkUnitLabel}
                      onChange={(e) => setFormData({ ...formData, ownerWorkUnit: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Otomatis mengikuti ruangan inventaris"
                      readOnly={selectedBorrowableAssets.length > 0}
                    />
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {selectedBorrowableAssets.length > 0
                        ? "Nilai ini otomatis mengikuti ruangan/lokasi inventaris yang dipilih agar data peminjaman tetap sinkron."
                        : "Pilih inventaris terlebih dahulu agar unit kerja pemilik inventaris terisi otomatis."}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Jenis Keperluan</label>
                    <select
                      value={formData.purposeType}
                      onChange={(e) =>
                        setFormData((prev) => {
                          const purposeType = e.target.value as "inside_hospital" | "outside_hospital"
                          if (purposeType === "inside_hospital") {
                            return {
                              ...prev,
                              purposeType,
                              destinationRoom: prev.destinationRoom || resolveDefaultDestinationRoom(currentUser),
                            }
                          }
                          return {
                            ...prev,
                            purposeType,
                          }
                        })
                      }
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                    >
                      <option value="inside_hospital">Penggunaan di dalam Rumah Sakit</option>
                      <option value="outside_hospital">Penggunaan di luar Rumah Sakit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">
                      {formData.purposeType === "inside_hospital" ? "Ruang / Instalasi Tujuan" : "Tujuan Pelayanan"}
                    </label>
                    <Input
                      value={formData.destinationRoom}
                      onChange={(e) => setFormData({ ...formData, destinationRoom: e.target.value })}
                      className="rounded-2xl"
                      placeholder={
                        formData.purposeType === "inside_hospital"
                          ? "Contoh: Ruang admin / gudang / IGD"
                          : "Contoh: Kegiatan luar gedung / pinjam operasional"
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[14px] font-medium mb-1">Keperluan Peminjaman</label>
                    <input
                      type="text"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                      placeholder="Contoh: Dukungan operasional unit / pelayanan / administrasi"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[14px] font-medium mb-1">Catatan</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
                      rows={2}
                      placeholder="Catatan tambahan (opsional)"
                    />
                  </div>
                </div>
                {hasBorrowingOverdueBlock ? (
                  <Alert variant="destructive" className="mt-4 rounded-2xl border-red-200 bg-red-50/90">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Peminjaman belum bisa diproses</AlertTitle>
                    <AlertDescription>
                      <p>{overdueBorrowingBlockMessage}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentUserOverdueBorrowings.map((borrowing) => {
                          const canExtend = canManageBorrowingExtension(borrowing)
                          return (
                            <Button
                              key={`form-${borrowing.id}`}
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full border-red-300 bg-white px-3 text-red-700 hover:bg-red-100"
                              disabled={!canExtend}
                              onClick={() => openExtendDialog(borrowing)}
                              title={canExtend ? "Perpanjang waktu peminjaman" : getBorrowingExtensionLimitMessage(borrowing)}
                            >
                              {canExtend ? `Perpanjang ${getBorrowingNoId(borrowing)}` : `${getBorrowingNoId(borrowing)} terkunci`}
                            </Button>
                          )
                        })}
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    onClick={handleSaveBorrowing}
                    size="sm"
                    disabled={hasBorrowingOverdueBlock}
                    className="w-full rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700 sm:w-auto"
                  >
                    Simpan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-2xl px-4 text-[14px] sm:w-auto"
                    onClick={() => {
                      setShowForm(false)
                      setFormData(getDefaultFormData(currentUser))
                      setSelectedBorrowableAssetIds([])
                    }}
                  >
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                <CardTitle className="text-lg">Daftar Peminjaman</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Total: {filteredBorrowings.length} peminjaman
                </CardDescription>
              </div>
                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua peminjaman"
                      className="h-4 w-4 accent-blue-600"
                      checked={allBorrowingsSelected}
                      onChange={handleSelectAllBorrowings}
                    />
                    Pilih semua
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBorrowingListMinimized((prev) => !prev)}
                    className="w-full rounded-2xl px-3 sm:w-auto"
                  >
                    {isBorrowingListMinimized ? (
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
                        {borrowingExportColumnDefinitions.map((column) => (
                          <DropdownMenuCheckboxItem
                            key={column.key}
                            checked={selectedBorrowingExportColumns.includes(column.key)}
                            onCheckedChange={() => handleBorrowingExportColumnToggle(column.key)}
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
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-[12px] text-muted-foreground sm:text-right sm:text-[13px]">
                  {selectedBorrowings.length
                    ? `${selectedBorrowings.length} baris dipilih`
                    : `Semua ${filteredBorrowings.length} baris`}
                </span>
              </div>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {isBorrowingListMinimized ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900">
                  Section daftar peminjaman disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 px-3 pb-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:px-6">
                    <div>
                      <label className="sr-only">Cari aset atau peminjam</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Cari No ID, aset, atau peminjam..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                        />
                      </div>
                    </div>
                    <select
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value as AssetSourceKey)}
                      className="rounded-xl border border-border/80 bg-background px-4 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                    >
                      <option value="Semua">Semua Sumber</option>
                      <option value="medis">Inventaris Medis</option>
                      <option value="non_medis">Inventaris Non-Medis</option>
                    </select>
                  </div>
                  {filteredBorrowings.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8 text-[13px]">Belum ada data peminjaman aktif atau yang menunggu validasi</p>
                  ) : (
                    <div className="px-3 pb-4 sm:px-4 sm:pb-4">
                      <div className="space-y-4 py-3">
                        {paginatedBorrowings.map((b) => {
                      const detailInfo = resolveDetailForBorrowing(b)
                      const assetName =
                        detailInfo?.detailInventoryName || detailInfo?.detailName || b.assetDetailName || b.assetName || "-"
                      const assetCode = detailInfo?.detailCode || b.assetDetailCode || b.assetCode || "-"
                      const roomNameLabel = detailInfo?.roomName || detailInfo?.assetLocation || b.assetLocation || "-"
                      const inventoryTypeLabel = assetSourceLabel(
                        deriveAssetSource(b.assetType, b.assetDetailCode || b.assetCode),
                      )
                      const borrowingNoId = getBorrowingNoId(b)
                      const dueDateLabel = b.dueDate
                        ? formatDayTimeLabel(b.dueDate, { showWeekday: false })
                        : "Belum dijadwalkan"
                      const canExtendBorrowing = canManageBorrowingExtension(b)
                      const extensionCountLabel = `${b.extensionCount || 0}/3`
                      const extensionBlockedMessage = getBorrowingExtensionLimitMessage(b)
                      const isExpanded = expandedBorrowingIds.has(b.id)
                      const borrowingSections = buildBorrowingNarrativeSections(selectedBorrowingExportColumns)(b)
                      return (
                        <SummaryResultCard
                          key={b.id}
                          title="Informasi Dasar Inventaris"
                          isExpanded={isExpanded}
                          onToggle={() => toggleBorrowingSummary(b.id)}
                          toggleLabel={isExpanded ? "Sembunyikan detail peminjaman" : "Tampilkan detail peminjaman"}
                          footer={(
                            <SummaryResultFooter
                              selected={selectedBorrowingIds.has(b.id)}
                              onSelectedChange={() => toggleBorrowingSelection(b.id)}
                              selectionLabel={`Pilih peminjaman ${assetName}`}
                            >
                              {b.status === "overdue" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-full border-amber-500 px-2.5 text-[11px] text-amber-700 hover:bg-amber-50"
                                  disabled={!canExtendBorrowing}
                                  onClick={() => openExtendDialog(b)}
                                  title={canExtendBorrowing ? "Perpanjang waktu peminjaman" : extensionBlockedMessage}
                                >
                                  Perpanjang
                                </Button>
                              ) : null}
                              {canValidateBorrowing ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {canValidateBorrowing && b.status === "pending" && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 rounded-lg p-1.5 text-green-700 hover:bg-green-50"
                                        onClick={() => void handleApproveBorrowing(b)}
                                        title="Setujui peminjaman"
                                        disabled={approvalSubmittingId === b.id}
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                        onClick={() => openRejectBorrowingDialog(b)}
                                        title="Tolak peminjaman"
                                        disabled={approvalSubmittingId === b.id}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  {hasFullAccess && ['pending', 'approved', 'borrowed', 'overdue'].includes(b.status) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                                      onClick={() => openEditDialog(b)}
                                      title={['borrowed', 'overdue'].includes(b.status) ? "Perbarui batas waktu" : "Edit"}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canDeleteBorrowing && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteBorrowing(b)}
                                      title="Hapus"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canRequestDeleteBorrowing && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                                      onClick={() => handleRequestDeleteBorrowing(b)}
                                      title="Ajukan hapus"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canValidateBorrowing && b.status === "returned" && !b.returnValidatedBy && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 rounded-full border-green-600 px-2.5 text-[11px] text-green-700 hover:bg-green-50"
                                      onClick={() => handleValidateReturn(b)}
                                      title="Validasi Pengembalian"
                                    >
                                      Validasi
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[12px] text-muted-foreground">-</span>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <Download className="h-4 w-4" />
                                    Unduh
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => void _exportSingleBorrowingNarrative("pdf", b)}>
                                    PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void _exportSingleBorrowingNarrative("word", b)}>
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
                              assetCode={assetCode}
                              noId={borrowingNoId}
                              personValue={`${b.userName || "-"} / ${b.userNip || "-"}`}
                              unitValue={b.borrowerWorkUnit || "-"}
                              unitExtra={formatBorrowingPurposeType(b.purposeType)}
                              timeLabel="Batas Pengembalian"
                              timeValue={dueDateLabel}
                              statusBadges={(
                                <>
                                  {getStatusBadge(b.status)}
                                  {getBorrowingRestrictionBadge(b.status)}
                                  {b.status === "rejected" && b.rejectionReason ? (
                                    <p className="basis-full text-left text-[13px] font-medium text-red-700 lg:text-right">
                                      Alasan: {b.rejectionReason}
                                    </p>
                                  ) : null}
                                </>
                              )}
                            />
                          )}
                          {isExpanded && (
                            <div className="space-y-3 bg-white px-3 py-3 sm:px-3 sm:py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant="outline" className="text-[11px]">
                                  {inventoryTypeLabel}
                                </Badge>
                                <Badge variant="outline" className="text-[11px]">
                                  {b.destinationRoom || roomNameLabel}
                                </Badge>
                                {getBorrowingRestrictionBadge(b.status)}
                                {b.status === "overdue" ? (
                                  <Badge variant="outline" className="text-[11px]">
                                    Perpanjangan {extensionCountLabel}
                                  </Badge>
                                ) : null}
                              </div>
                              {borrowingSections.length ? (
                                <div className="columns-1 gap-3 border-t border-slate-200 pt-3 lg:columns-2">
                                  {borrowingSections.map((section) => (
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
                                  Aktifkan minimal satu kolom untuk melihat detail peminjaman.
                                </div>
                              )}
                            </div>
                          )}
                        </SummaryResultCard>
                      )
                        })}
                      </div>
                      <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-slate-500">
                          Menampilkan {borrowingStartIndex + 1}-{Math.min(borrowingStartIndex + BORROWING_ROWS_PER_PAGE, filteredBorrowings.length)} dari {filteredBorrowings.length} peminjaman
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentBorrowingPage === 1}
                            onClick={() => setBorrowingPage((page) => Math.max(1, page - 1))}
                            aria-label="Halaman peminjaman sebelumnya"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          {visibleBorrowingPages.map((page) => (
                            typeof page === "number" ? (
                              <Button
                                key={page}
                                type="button"
                                variant={page === currentBorrowingPage ? "default" : "outline"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => goToBorrowingPage(page)}
                                aria-label={`Halaman peminjaman ${page}`}
                                aria-current={page === currentBorrowingPage ? "page" : undefined}
                              >
                                {page}
                              </Button>
                            ) : (
                              <span key={page} className="flex h-8 w-8 items-center justify-center text-sm text-slate-400">
                                ...
                              </span>
                            )
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={currentBorrowingPage === totalBorrowingPages}
                            onClick={() => setBorrowingPage((page) => Math.min(totalBorrowingPages, page + 1))}
                            aria-label="Halaman peminjaman berikutnya"
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
                  <label className="text-[13px] font-medium text-muted-foreground">Tanggal Pinjam</label>
                  <Input
                    type="datetime-local"
                    value={editForm.borrowDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, borrowDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Target Tanggal Kembali</label>
                  <Input
                    type="datetime-local"
                    value={editForm.dueDate}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Jabatan Peminjam</label>
                  <Input
                    value={editForm.borrowerPosition}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, borrowerPosition: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Unit Kerja Peminjam</label>
                  <Input
                    value={editForm.borrowerWorkUnit}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, borrowerWorkUnit: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Nama Pemilik Inventaris</label>
                  <Input
                    value={editForm.ownerName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, ownerName: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Jabatan Pemilik Inventaris</label>
                  <Input
                    value={editForm.ownerPosition}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, ownerPosition: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Unit Kerja Pemilik Inventaris</label>
                  <Input
                    value={editForm.ownerWorkUnit}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, ownerWorkUnit: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Jenis Keperluan</label>
                  <select
                    value={editForm.purposeType}
                    onChange={(event) =>
                      setEditForm((prev) => ({
                        ...prev,
                        purposeType: event.target.value as "inside_hospital" | "outside_hospital",
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="inside_hospital">Penggunaan di dalam Rumah Sakit</option>
                    <option value="outside_hospital">Penggunaan di luar Rumah Sakit</option>
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Ruang / Instalasi Tujuan</label>
                  <Input
                    value={editForm.destinationRoom}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, destinationRoom: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Jumlah</label>
                  <Input
                    type="number"
                    min="1"
                    value={editForm.quantity}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Lama Peminjaman</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={editForm.loanDurationValue}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, loanDurationValue: event.target.value }))}
                    />
                    <select
                      value={editForm.loanDurationUnit}
                      onChange={(event) =>
                        setEditForm((prev) => ({
                          ...prev,
                          loanDurationUnit: event.target.value as "day" | "month" | "year",
                        }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="day">Hari</option>
                      <option value="month">Bulan</option>
                      <option value="year">Tahun</option>
                    </select>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[13px] font-medium text-muted-foreground">Keperluan Peminjaman</label>
                  <Input
                    value={editForm.purpose}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, purpose: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Catatan Tambahan</label>
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
                  disabled={editSubmitting || !editForm.purpose.trim() || !editForm.destinationRoom.trim()}
                >
                  {editSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={extendModalOpen}
            onOpenChange={(open) => {
              if (open) {
                setExtendModalOpen(true)
                return
              }
              handleExtendDialogClose()
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Perpanjang Waktu Peminjaman</DialogTitle>
                <DialogDescription>
                  Atur batas waktu baru untuk peminjaman yang sudah terlambat agar peminjaman aktif kembali.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                  <p className="font-medium">{extendingBorrowing?.assetDetailName || extendingBorrowing?.assetName || "-"}</p>
                  <p>No ID: {extendingBorrowing ? getBorrowingNoId(extendingBorrowing) : "-"}</p>
                  <p>Perpanjangan terpakai: {extendingBorrowing?.extensionCount || 0}/3</p>
                  {extendingBorrowing?.sanctionNotes ? <p>{extendingBorrowing.sanctionNotes}</p> : null}
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Batas Waktu Baru</label>
                  <Input
                    type="datetime-local"
                    value={extensionForm.newDueDate}
                    onChange={(event) => setExtensionForm((prev) => ({ ...prev, newDueDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Catatan Perpanjangan</label>
                  <Textarea
                    rows={3}
                    value={extensionForm.extensionNotes}
                    onChange={(event) => setExtensionForm((prev) => ({ ...prev, extensionNotes: event.target.value }))}
                    placeholder="Contoh: Alat masih digunakan untuk operasional ruangan."
                  />
                </div>
              </div>
              <DialogFooter className="mt-4 flex gap-2">
                <Button variant="outline" onClick={handleExtendDialogClose} type="button">
                  Batal
                </Button>
                <Button
                  onClick={handleSaveExtension}
                  type="button"
                  disabled={extendSubmitting || !extensionForm.newDueDate}
                  className="bg-amber-600 text-white hover:bg-amber-700"
                >
                  {extendSubmitting ? "Memperpanjang..." : "Simpan Perpanjangan"}
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

      {!showForm && (
        <div className="fab-safe-area fixed z-40 xl:hidden">
          <Button
            size="sm"
            className="h-11 rounded-full bg-teal-600 px-4 text-white shadow-xl hover:bg-teal-700"
            onClick={() => {
              setFormData(getDefaultFormData(currentUser))
              setSelectedBorrowableAssetIds([])
              setShowForm(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Peminjaman
          </Button>
        </div>
      )}
      <Dialog open={Boolean(pendingRejectBorrowing)} onOpenChange={(nextOpen) => !nextOpen && handleRejectDialogClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak peminjaman?</DialogTitle>
            <DialogDescription>
              Isi alasan penolakan untuk peminjaman {pendingRejectBorrowing?.assetDetailName || pendingRejectBorrowing?.assetName || "ini"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="reject-reason">
              Alasan penolakan
            </label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Contoh: jadwal penggunaan bentrok atau inventaris belum tersedia"
              disabled={isRejectSubmitting}
              className="min-h-24"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleRejectDialogClose} disabled={isRejectSubmitting}>
              Batal
            </Button>
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
              onClick={() => void confirmRejectBorrowing()}
              disabled={isRejectSubmitting || !rejectReason.trim()}
            >
              {isRejectSubmitting ? "Menolak..." : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteReasonDialog
        open={Boolean(pendingDeleteBorrowing)}
        title="Arsipkan data peminjaman?"
        description={`Data ${pendingDeleteBorrowing?.assetDetailName || pendingDeleteBorrowing?.assetName || "peminjaman"} akan disembunyikan dari daftar utama, tetapi tetap tersimpan sebagai arsip Admin.`}
        value={deleteReason}
        isSubmitting={isDeletingBorrowing}
        onValueChange={setDeleteReason}
        onCancel={() => {
          if (isDeletingBorrowing) return
          setPendingDeleteBorrowing(null)
          setDeleteReason("")
        }}
        onConfirm={confirmDeleteBorrowing}
      />
      <DeleteReasonDialog
        open={Boolean(pendingArchiveBorrowingRequest)}
        title="Ajukan penghapusan peminjaman?"
        description={`Permintaan penghapusan ${pendingArchiveBorrowingRequest?.assetDetailName || pendingArchiveBorrowingRequest?.assetName || "peminjaman ini"} akan dikirim ke Admin untuk ditinjau.`}
        value={deleteReason}
        isSubmitting={isDeletingBorrowing}
        onValueChange={setDeleteReason}
        onCancel={() => {
          if (isDeletingBorrowing) return
          setPendingArchiveBorrowingRequest(null)
          setDeleteReason("")
        }}
        onConfirm={confirmRequestDeleteBorrowing}
      />
    </main>
  )
}
