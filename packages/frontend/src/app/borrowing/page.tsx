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
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import { borrowingService, type Borrowing as ApiBorrowing } from "@/services/borrowing.service"
import { maintenanceService } from "@/services/maintenance.service"
import type { User } from "@/types/auth-types"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import {
    assetSourceLabel,
    borrowingStatusLabel,
    deriveAssetSource,
    type AssetSourceKey,
} from "@/utils/api-mappers"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import {
    formatDayTimeLabel,
    parseServerDateTimeValue,
    toLocalDateTimeString,
} from "@/utils/format"
import { buildInventorySearchKey } from "@/utils/inventory-search"
import { formatNoId } from "@/utils/record-id"
import { getUserRoleLabel, isAdminOrLeaderRole, isAdminRole } from "@/utils/role"
import { matchesSearchKeyword } from "@/utils/search-keyword"

import InventoryPicker from "@/components/inventory-picker"
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
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import {
    appendLine,
    ExportFormat,
    exportNarrativeReport,
    SectionBuilder,
    TableExportColumn,
    type DocumentSection,
    type SectionLine,
} from "@/utils/export-table"
import { CheckCircle, ChevronDown, ChevronUp, Download, HandHelping, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

type BorrowableAsset = DetailInventoryItem

type BorrowingExportColumn = TableExportColumn<ApiBorrowing> & {
  defaultSelected?: boolean
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
  destinationRoom: "",
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
    key: "merek",
    label: "Merek / Model",
    getValue: (borrowing) => borrowing.assetDetailName || borrowing.assetName || "-",
    defaultSelected: true,
  },
  {
    key: "ruanganAlat",
    label: "Nama Ruangan Alat",
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
    label: "Pemilik Alat",
    getValue: (borrowing) => borrowing.ownerName || "-",
    defaultSelected: true,
  },
  {
    key: "jabatanPemilikAlat",
    label: "Jabatan Pemilik Alat",
    getValue: (borrowing) => borrowing.ownerPosition || "-",
    defaultSelected: true,
  },
  {
    key: "unitPemilikAlat",
    label: "Unit Pemilik Alat",
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
          await loadBorrowings()
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
  const [activeMaintenanceLocks, setActiveMaintenanceLocks] = useState<Set<string>>(new Set())
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
  const [expandedBorrowingIds, setExpandedBorrowingIds] = useState<Set<number>>(() => new Set())
  const [selectedBorrowableAssetIds, setSelectedBorrowableAssetIds] = useState<string[]>([])

  const [formData, setFormData] = useState(() => getDefaultFormData())
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingBorrowing, setEditingBorrowing] = useState<ApiBorrowing | null>(null)
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
  const [countdownTime, setCountdownTime] = useState<string>("")
  const [selectedDurationPreview, setSelectedDurationPreview] = useState<string>("")

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
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
  const canDeleteBorrowing = isAdminRole(currentUser?.role)

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
        if (!["requested", "scheduled", "in_progress"].includes(record.status)) return

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

  useEffect(() => {
    if (currentUser) {
      // Load data only once when component mounts
      let isMounted = true
      
      const loadAllData = async () => {
        if (!isMounted) return
        await Promise.all([
          loadAssets(),
          loadBorrowings(),
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
    const handleInventoryRefresh = () => {
      void Promise.all([
        loadAssets(),
        loadBorrowings(),
        loadActiveMaintenanceLocks(),
      ])
    }

    window.addEventListener("inventory-refresh", handleInventoryRefresh)
    return () => window.removeEventListener("inventory-refresh", handleInventoryRefresh)
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
    if (
      selectedBorrowableAssets.length === 0 ||
      !formData.borrowDate ||
      !formData.borrowerPosition.trim() ||
      !formData.borrowerWorkUnit.trim() ||
      !formData.ownerName.trim() ||
      !formData.ownerPosition.trim() ||
      !formData.ownerWorkUnit.trim() ||
      !formData.purpose.trim() ||
      !formData.destinationRoom.trim()
    ) {
      alert("Mohon lengkapi semua field yang diperlukan")
      return
    }

    try {
      const successLabels: string[] = []
      const failedAssets: BorrowableAsset[] = []
      const failureMessages: string[] = []

      for (const selectedAsset of selectedBorrowableAssets) {
        try {
          await borrowingService.create({
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
            ownerWorkUnit: formData.ownerWorkUnit.trim(),
            purposeType: formData.purposeType,
            destinationRoom: formData.destinationRoom.trim(),
            purpose: formData.purpose.trim(),
            loanDurationValue: Number.parseInt(formData.durationValue, 10) || undefined,
            loanDurationUnit: formData.durationType,
            quantity: Number.parseInt(formData.quantity, 10) || 1,
            notes: formData.notes || undefined,
          })

          successLabels.push(formatInventoryLabel(selectedAsset))
        } catch (error: any) {
          failedAssets.push(selectedAsset)
          failureMessages.push(`${formatInventoryLabel(selectedAsset)}: ${error.message || "Gagal dibuat"}`)
        }
      }

      await loadBorrowings()
      await loadAssets()
      await loadActiveMaintenanceLocks()

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
    try {
      const response = await borrowingService.delete(borrowing.id)
      if (!response.success) {
        alert(response.message || "Gagal menghapus peminjaman")
        return
      }
      await loadBorrowings()
      await loadAssets()
      await loadActiveMaintenanceLocks()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus peminjaman")
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

    const matchesStatus =
      filterStatus === "Semua" ||
      (filterStatus === "Dipinjam" && ["approved", "borrowed"].includes(b.status)) ||
      (filterStatus === "Menunggu Validasi" && b.status === "returned" && !b.returnValidatedAt) ||
      (filterStatus === "Terlambat" && b.status === "overdue") ||
      (filterStatus === "Menunggu" && b.status === "pending")

    const assetSource = deriveAssetSource(b.assetType, b.assetCode)
    const matchesSource = filterSource === "Semua" || assetSource === filterSource
    return matchesSearch && matchesStatus && matchesSource
  })

  const selectedBorrowings = filteredBorrowings.filter((b) => selectedBorrowingIds.has(b.id))
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
        appendLine(ownerLines, "Nama Pemilik Alat", ownerName)
      }
      if (columnSet.has("jabatanPemilikAlat") && ownerPosition !== "-") {
        appendLine(ownerLines, "Jabatan Pemilik Alat", ownerPosition)
      }
      if (columnSet.has("unitPemilikAlat")) {
        appendLine(ownerLines, "Unit Pemilik Alat", ownerWorkUnit)
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
      title: "Formulir Peminjaman Inventaris",
      subtitle: "RINGKASAN FORMULIR PEMINJAMAN",
      entries: [borrowing],
      filePrefix: `formulir-peminjaman-${borrowing.id}`,
      buildSections: buildBorrowingNarrativeSections(
        borrowingExportColumnDefinitions.map((column) => column.key)
      ),
      emptyMessage: "Tidak ada data peminjaman yang dipilih.",
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

  const pendingCount = visibleBorrowings.filter((b) => b.status === "pending").length
  const pendingValidationCount = visibleBorrowings.filter(
    (b) => b.status === "returned" && !b.returnValidatedAt
  ).length
  const activeBorrowings = visibleBorrowings.filter((b) =>
    ["approved", "borrowed", "overdue"].includes(b.status)
  )
  const activeBorrowingAssetLocks = new Set<string>()
  const activeBorrowingDetailLocks = new Set<string>()

  visibleBorrowings.forEach((borrowing) => {
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

    if (asset.availability === "disposed") return "disposed"
    if (asset.availability === "maintenance" || isMaintenanceLockedAsset(asset)) {
      return "maintenance"
    }
    if (isBorrowingLockedAsset(asset)) {
      return "borrowed"
    }
    if (isFallbackAssetItem) {
      if (asset.assetStatus === "disposed") return "disposed"
      if (asset.assetStatus === "maintenance") return "maintenance"
      if (asset.assetStatus === "borrowed") return "borrowed"
    }
    return "available"
  }

  const getEffectiveAvailabilityLabel = (asset: BorrowableAsset) => {
    const effectiveAvailability = getEffectiveAvailability(asset)
    if (effectiveAvailability === "maintenance") return "Dalam Perbaikan"
    if (effectiveAvailability === "borrowed") return "Dipinjam"
    if (effectiveAvailability === "disposed") return "Non-Aktif"
    return "Aktif"
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

  const selectedBorrowableAssets = borrowableAssets.filter((asset) =>
    selectedBorrowableAssetIds.includes(asset.detailId)
  )

  const handleToggleBorrowableAsset = (asset: BorrowableAsset) => {
    const isSelectingAsset = !selectedBorrowableAssetIds.includes(asset.detailId)

    setSelectedBorrowableAssetIds((prev) =>
      prev.includes(asset.detailId)
        ? prev.filter((item) => item !== asset.detailId)
        : [...prev, asset.detailId]
    )

    setFormData((prev) => ({
      ...prev,
      ownerWorkUnit: prev.ownerWorkUnit || asset.roomName || asset.assetLocation || "",
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

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const searchDropdownRef = useRef<HTMLDivElement | null>(null)
  const borrowingFormRef = useRef<HTMLDivElement | null>(null)
  const borrowingAssetPickerRef = useRef<HTMLDivElement | null>(null)
  const borrowDateInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!showForm) return

    window.requestAnimationFrame(() => {
      borrowingFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      })

      const pickerButton = borrowingAssetPickerRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-label="Pilih satu atau lebih inventaris"]'
      )
      pickerButton?.focus({ preventScroll: true })
    })
  }, [showForm])

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
      matchesSearchKeyword(searchTerm, [
        formatInventoryLabel(asset),
        formatInventoryDisplayLabel(asset),
        formatNoId(asset.source === "medis" ? "IMD" : "INM", asset.assetId),
        formatNoId(asset.source === "medis" ? "IMD-DTL" : "INM-DTL", asset.detailId),
        asset.assetId,
        asset.detailId,
        asset.assetCode,
        asset.detailCode,
      ])
    )
  }, [borrowableAssets, searchTerm])

  return (
    <main
      className="min-h-full bg-white"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}
    >
      <div className="p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-5 items-center">
                <div className="p-2 bg-linear-to-br from-cyan-500 to-teal-500 rounded-lg">
                  <HandHelping className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Peminjaman Alat</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Audit, validasi, dan monitoring status alat dalam satu halaman.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-200 text-[11px]">
                      Peminjaman aktif
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  className="rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700"
                  onClick={() => {
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
              <Card ref={borrowingFormRef} className="rounded-3xl border border-slate-200 bg-white/80 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
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
                    renderItemMeta={(asset) => getEffectiveAvailabilityLabel(asset)}
                  />
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Anda bisa memilih beberapa inventaris sekaligus dalam satu form peminjaman.
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
                    <div className="flex gap-2">
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
                        className="rounded-2xl border border-border/80 bg-background px-3 py-2 text-[14px] text-foreground transition focus:border-teal-500"
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
                    <label className="block text-[14px] font-medium mb-1">Nama Pemilik Alat</label>
                    <Input
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Nama penanggung jawab alat"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Jabatan Pemilik Alat</label>
                    <Input
                      value={formData.ownerPosition}
                      onChange={(e) => setFormData({ ...formData, ownerPosition: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Contoh: Kepala Unit"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[14px] font-medium mb-1">Unit Kerja Pemilik Alat</label>
                    <Input
                      value={formData.ownerWorkUnit}
                      onChange={(e) => setFormData({ ...formData, ownerWorkUnit: e.target.value })}
                      className="rounded-2xl"
                      placeholder="Contoh: Unit Alat / Instalasi"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium mb-1">Jenis Keperluan</label>
                    <select
                      value={formData.purposeType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          purposeType: e.target.value as "inside_hospital" | "outside_hospital",
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
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button onClick={handleSaveBorrowing} size="sm" className="rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700">
                    Simpan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-2xl px-4 text-[14px]"
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
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-2xl px-3">
                        <Download className="mr-2 h-4 w-4" />
                        Export
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
                      <DropdownMenuItem onClick={() => void handleExport("excel")}>Excel</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-2xl px-3 text-[14px] font-semibold "
                  onClick={handleSelectAllBorrowings}
                >
                  {allBorrowingsSelected ? "Batal pilih semua" : "Pilih semua"}
                </Button>
                <span className="text-[13px] text-muted-foreground">
                  {selectedBorrowings.length
                    ? `${selectedBorrowings.length} baris dipilih`
                    : `Semua ${filteredBorrowings.length} baris siap cetak`}
                </span>
              </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_220px]">
                <div>
                  <label className="sr-only">Cari aset atau peminjam</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Cari No ID, aset, atau peminjam..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() => setSearchDropdownOpen(true)}
                      className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                    />
                    {searchDropdownOpen && (
                      <div
                        ref={searchDropdownRef}
                        className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/80 bg-background shadow-xl"
                      >
                        <ScrollArea className="h-70 w-full rounded-b-2xl">
                          <div className="space-y-1 px-3 py-3">
                            {assetSearchResults.length === 0 ? (
                              <p className="py-2 text-center text-[13px] text-muted-foreground">
                                Tidak ada inventaris
                              </p>
                            ) : (
                              assetSearchResults.map((asset, index) => (
                                <button
                                  key={getBorrowableAssetKey(asset, index)}
                                  type="button"
                                  className="w-full rounded-xl px-2 py-2 text-left text-[14px] text-foreground transition hover:bg-border"
                                  onMouseDown={(event) => {
                                    event.preventDefault()
                                    const label = formatInventoryLabel(asset)
                                    setSearchTerm(label)
                                    setSearchDropdownOpen(false)
                                  }}
                                >
                                  <div className="font-medium">{formatInventoryLabel(asset)}</div>
                                  <p className="text-[13px] text-muted-foreground">
                                    {asset.assetLocation || "Lokasi tidak tersedia"}
                                  </p>
                                  <p className="text-[13px] text-muted-foreground">
                                    No ID: {formatNoId(asset.source === "medis" ? "IMD-DTL" : "INM-DTL", asset.detailId)}
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
                  className="rounded-xl border border-border/80 bg-background px-4 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                >
                  <option>Semua</option>
                  <option>Menunggu</option>
                  <option>Dipinjam</option>
                  <option>Menunggu Validasi</option>
                  <option>Terlambat</option>
                </select>
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
            </CardHeader>
            <CardContent className="px-0">
              {filteredBorrowings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-[13px]">Belum ada data peminjaman aktif atau yang menunggu validasi</p>
              ) : (
                <div className="max-h-180 overflow-y-auto px-3 pb-4 pr-2 sm:px-4 sm:pb-6">
                  <div className="space-y-4">
                    {filteredBorrowings.map((b) => {
                      const detailInfo = resolveDetailForBorrowing(b)
                      const assetName = b.assetDetailName || b.assetName || "-"
                      const assetCode = b.assetDetailCode || b.assetCode || "-"
                      const roomNameLabel = detailInfo?.roomName || detailInfo?.assetLocation || b.assetLocation || "-"
                      const inventoryTypeLabel = assetSourceLabel(
                        deriveAssetSource(b.assetType, b.assetDetailCode || b.assetCode),
                      )
                      const borrowingNoId = getBorrowingNoId(b)
                      const dueDateLabel = b.dueDate
                        ? formatDayTimeLabel(b.dueDate, { showWeekday: false })
                        : "Belum dijadwalkan"
                      const isExpanded = expandedBorrowingIds.has(b.id)
                      const borrowingSections = buildBorrowingNarrativeSections(selectedBorrowingExportColumns)(b)
                      return (
                        <div
                          key={b.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                            <span>Informasi Dasar Inventaris</span>
                            <div className="flex items-center gap-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-lg p-0 text-slate-700 hover:bg-slate-200"
                                onClick={() => toggleBorrowingSummary(b.id)}
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
                                  <p className="text-[12px] font-medium text-slate-700">{assetCode}</p>
                                  <div className="mt-1.5 space-y-1.5">
                                    <p className="text-[11px] text-muted-foreground">No ID: {borrowingNoId}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Identias Karyawan: <span className="font-medium text-slate-700">{b.userName || "-"} / {b.userNip || "-"}</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Unit kerja: <span className="font-medium text-slate-700">{b.borrowerWorkUnit || "-"}</span> • {formatBorrowingPurposeType(b.purposeType)}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <Badge variant="outline" className="text-[10px]">
                                      {inventoryTypeLabel}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px]">
                                      {b.destinationRoom || roomNameLabel}
                                    </Badge>
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
                          <div className="flex flex-col gap-1.5 border-t border-slate-200 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:pb-3">
                            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={selectedBorrowingIds.has(b.id)}
                                onChange={() => toggleBorrowingSelection(b.id)}
                                className="h-4 w-4 rounded border border-slate-300 bg-white text-slate-700"
                                aria-label={`Pilih peminjaman ${b.assetDetailName || b.assetName || ""}`}
                              />
                              Pilih kartu
                            </label>
                            <div className="flex flex-wrap items-center gap-1 text-[12px] text-slate-600">
                              {hasFullAccess ? (
                                <div className="flex flex-wrap gap-1">
                                  {['pending', 'approved'].includes(b.status) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 rounded-lg p-0 text-emerald-600 hover:bg-emerald-50"
                                      onClick={() => openEditDialog(b)}
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  )}
                                  {canDeleteBorrowing && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 rounded-lg p-0 text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteBorrowing(b)}
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                  {b.status === "returned" && !b.returnValidatedBy && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 px-2 text-[12px] text-green-700 border-green-600 hover:bg-green-50"
                                      onClick={() => handleValidateReturn(b)}
                                      title="Validasi Pengembalian"
                                    >
                                      Validasi
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[13px] text-muted-foreground">-</span>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 rounded-lg p-0">
                                    <Download className="w-3 h-3" />
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
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
                  <label className="text-[13px] font-medium text-muted-foreground">Nama Pemilik Alat</label>
                  <Input
                    value={editForm.ownerName}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, ownerName: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Jabatan Pemilik Alat</label>
                  <Input
                    value={editForm.ownerPosition}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, ownerPosition: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-muted-foreground">Unit Kerja Pemilik Alat</label>
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

          <div className="text-center text-[13px] font-medium tracking-wider text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan<br />
            Sistem Inventaris & Peminjaman Serta Pemeliharaan Sarana
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
    </main>
  )
}
