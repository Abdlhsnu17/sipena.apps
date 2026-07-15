'use client'

import { buildLoginRedirectUrl } from "@/services/auth-utils";
import { id } from "date-fns/locale";
import {
    AlertCircle,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Download,
    Edit2,
    Eye,
    History,
    MapPin,
    Plus,
    Save,
    Search,
    ShieldCheck,
    Trash2,
    UserCheck,
    Wrench,
    XCircle
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import DeleteReasonDialog from "@/components/delete-reason-dialog";
import MaintenanceForm from "@/components/maintenance-form";
import MaintenanceHistoryList from "@/components/maintenance-history-list";
import { SummaryResultBody, SummaryResultCard, SummaryResultFooter } from "@/components/summary-result-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExportFormat, exportFormularReport, FormularData, TableExportColumn } from "@/utils/export-table";

import { useToast } from "@/hooks/use-toast";
import { assetUsageService } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { getCurrentUser } from "@/services/auth-utils";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService, type Maintenance } from "@/services/maintenance.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { assetSourceBadgeClass, assetSourceLabel, deriveAssetSource, locationBadgeClass, maintenanceStatusLabel, maintenanceTypeBadgeClass, maintenanceTypeLabel } from "@/utils/api-mappers";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import { formatCostLabel, formatDayTimeLabel } from "@/utils/format";
import { formatNoId } from "@/utils/record-id";
import { canCreateMaintenanceRole, canManageMaintenanceStatusRole, isAdminOrLeaderRole, isAdminRole, isTechnicianRole } from "@/utils/role";
import { matchesSearchKeyword } from "@/utils/search-keyword";

type MaintenanceExportColumn = TableExportColumn<Maintenance> & {
  defaultSelected?: boolean
}

const CARD_ROWS_PER_PAGE = 2

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

const SectionHeader = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
    {label}
  </div>
)

type InfoRowProps = {
  label: string
  children: ReactNode
}

const InfoRow = ({ label, children }: InfoRowProps) => (
  <div className="detail-labeled-row border-b border-slate-200 dark:border-slate-800/35 last:border-b-0">
    <span className="font-medium text-slate-600 dark:text-slate-300">
      {label}
    </span>
    <span className="font-medium text-slate-900 dark:text-slate-100 leading-snug">{children}</span>
  </div>
)

const getInventoryLockKey = (assetType: string | undefined, assetId: number, detailId?: string | null) => {
  const normalizedAssetType = assetType === "non_medical" ? "non_medical" : "medical"
  const baseKey = `${normalizedAssetType}|${assetId}`
  const normalizedDetailId = String(detailId || "").trim()
  return normalizedDetailId ? `${baseKey}|${normalizedDetailId}` : baseKey
}

const normalizeDetailIdentifier = (value?: string | number | null) => {
  if (value === undefined || value === null) return ""
  return String(value).trim()
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

const maintenanceSlaLabel = (status?: Maintenance["slaStatus"]) => {
  switch (status) {
    case "on_track":
      return "SLA Aman"
    case "at_risk":
      return "SLA Risiko"
    case "overdue":
      return "Lewat SLA"
    case "met":
      return "SLA Tercapai"
    case "met_late":
      return "SLA Tercapai Terlambat"
    default:
      return "-"
  }
}

const maintenanceSlaBadgeClass = (status?: Maintenance["slaStatus"]) => {
  switch (status) {
    case "on_track":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    case "at_risk":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    case "overdue":
    case "met_late":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    case "met":
      return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300"
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700/35 dark:bg-slate-900/40 dark:text-slate-300"
  }
}

const calendarWeekDays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

const parseCalendarDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const isSameCalendarDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

const getCalendarStartOffset = (date: Date) => (date.getDay() + 6) % 7

export default function MaintenancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialAutomationSource = searchParams.get("automationSource")
  const initialSearchTerm = searchParams.get("q") || ""
  const dssPrefillHandledRef = useRef(false)
  const { toast } = useToast()
  const activeMaintenanceStatuses = useMemo(
    () => new Set(["requested", "scheduled", "in_progress", "completed"]),
    []
  )

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [maintenanceHistory, setMaintenanceHistory] = useState<Maintenance[]>([])
  const [assets, setAssets] = useState<DetailInventoryItem[]>([])
  const [activeUsageLocks, setActiveUsageLocks] = useState<Set<string>>(new Set())
  const [activeBorrowingLocks, setActiveBorrowingLocks] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null)
  const [pendingDeleteMaintenance, setPendingDeleteMaintenance] = useState<Maintenance | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [isDeletingMaintenance, setIsDeletingMaintenance] = useState(false)
  const [prefillAsset, setPrefillAsset] = useState<DetailInventoryItem | null>(null)
  const [prefillNote, setPrefillNote] = useState("")
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [filterStatus, setFilterStatus] = useState("Semua")
  const [filterAutomationSource, setFilterAutomationSource] = useState<"all" | "usage_threshold" | "manual">(
    initialAutomationSource === "usage_threshold" || initialAutomationSource === "manual"
      ? initialAutomationSource
      : "all"
  )
  const [isCalendarMinimized, setIsCalendarMinimized] = useState(false)
  const [isMaintenanceMinimized, setIsMaintenanceMinimized] = useState(false)
  const [isHistoryMinimized, setIsHistoryMinimized] = useState(false)
  const [maintenancePage, setMaintenancePage] = useState(1)
  const [maintenanceView, setMaintenanceView] = useState<"active" | "history">("active")
  const [calendarMonthDate, setCalendarMonthDate] = useState(() => new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date())
  const [calendarPickerOpen, setCalendarPickerOpen] = useState(false)
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
      const automationSourceFilter = filterAutomationSource === "all" ? undefined : filterAutomationSource
      const [activeResponse, historyResponse] = await Promise.all([
        maintenanceService.getAll({ page: 1, limit: 1000, view: "active", automationSource: automationSourceFilter }),
        maintenanceService.getAll({ page: 1, limit: 1000, view: "history", automationSource: automationSourceFilter }),
      ])

      if (activeResponse.success) {
        setMaintenance(activeResponse.data)
      }

      if (historyResponse.success) {
        setMaintenanceHistory(historyResponse.data)
      }
    } catch (error) {
      console.error("Error loading maintenance:", error)
    }
  }

  useEffect(() => {
    const nextAutomationSource = searchParams.get("automationSource")
    if (nextAutomationSource === "usage_threshold" || nextAutomationSource === "manual") {
      setFilterAutomationSource(nextAutomationSource)
    }

    const nextSearch = searchParams.get("q")
    if (typeof nextSearch === "string") {
      setSearchTerm(nextSearch)
    }
  }, [searchParams])

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
        loadActiveUsageLocks(),
        loadActiveBorrowingLocks()
      ])
    }
    
    loadAllData()
    
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    void loadMaintenance()
  }, [filterAutomationSource])

  useEffect(() => {
    const handleInventoryRefresh = () => {
      void Promise.all([
        loadMaintenance(),
        loadAssets(),
        loadActiveUsageLocks(),
        loadActiveBorrowingLocks(),
      ])
    }

    window.addEventListener("inventory-refresh", handleInventoryRefresh)
    return () => window.removeEventListener("inventory-refresh", handleInventoryRefresh)
  }, [])

  // Cek hak akses peran
  const hasFullAccess = isAdminOrLeaderRole(currentUser?.role)
  const canDeleteMaintenance = isAdminRole(currentUser?.role)
  const isTechnician = isTechnicianRole(currentUser?.role)
  const canCreateMaintenance = canCreateMaintenanceRole(currentUser?.role)
  const canEditMaintenance = hasFullAccess || isTechnician
  const canManageAdvancedStatuses = canManageMaintenanceStatusRole(currentUser?.role)
  const createMaintenanceActionLabel = "Tambah Pemeliharaan"

  useEffect(() => {
    if (dssPrefillHandledRef.current) return
    if (searchParams.get("source") !== "dss") return
    if (!currentUser || assets.length === 0) return

    const detailId = searchParams.get("detailId")
    const detailCode = searchParams.get("detailCode")
    const assetIdRaw = searchParams.get("assetId")
    const assetId = assetIdRaw ? Number(assetIdRaw) : NaN
    const matched =
      (detailId ? assets.find((item) => item.detailId === detailId) : undefined) ||
      (Number.isFinite(assetId) && detailCode ? assets.find((item) => item.assetId === assetId && item.detailCode === detailCode) : undefined) ||
      (Number.isFinite(assetId) ? assets.find((item) => item.assetId === assetId) : undefined) ||
      null

    dssPrefillHandledRef.current = true

    if (!canCreateMaintenance) {
      toast({
        title: "Akses ditolak",
        description: "Anda tidak memiliki izin untuk mengajukan pemeliharaan dari SPK.",
        variant: "destructive",
      })
      router.replace("/maintenance", { scroll: false })
      return
    }

    if (!matched) {
      toast({
        title: "Aset tidak ditemukan",
        description: "Aset dari SPK tidak tersedia atau sedang tidak dapat diajukan pemeliharaan.",
        variant: "destructive",
      })
      router.replace("/maintenance", { scroll: false })
      return
    }

    const score = searchParams.get("score")
    const rank = searchParams.get("rank")
    const noteParts = ["Diajukan dari SPK Prioritas Aset"]
    if (rank) noteParts.push(`peringkat #${rank}`)
    if (score) noteParts.push(`skor ${score}`)

    setEditingMaintenance(null)
    setPrefillAsset(matched)
    setPrefillNote(noteParts.join(" · "))
    setShowForm(true)
    router.replace("/maintenance", { scroll: false })
  }, [assets, currentUser, canCreateMaintenance, searchParams, router, toast])

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
      toast({
        title: "Alasan wajib diisi",
        description: "Isi alasan pembatalan sebelum memperbarui status.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await maintenanceService.update(String(pendingStatusChange.maintenanceId), {
        status: "cancelled",
        cancellationReason,
      })

      if (!response.success) {
        toast({
          title: "Status belum diperbarui",
          description: response.message || "Status pemeliharaan belum dapat dibatalkan.",
          variant: "destructive",
        })
        return
      }

      await loadMaintenance()
      await loadAssets()
      toast({
        title: "Pemeliharaan sarana dibatalkan",
        description: "Status pemeliharaan sudah diperbarui menjadi dibatalkan.",
      })
    } catch (error: any) {
      console.error("Error cancelling maintenance:", error)
      toast({
        title: "Status belum diperbarui",
        description: "Terjadi kesalahan saat membatalkan pemeliharaan.",
        variant: "destructive",
      })
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
      toast({
        title: "Sesi tidak tersedia",
        description: "Silakan login terlebih dahulu sebelum menyimpan pemeliharaan.",
        variant: "destructive",
      })
      return
    }
    if (!data.assetId || !data.scheduledDate) {
      toast({
        title: "Formulir belum lengkap",
        description: "Pilih aset dan isi jadwal pemeliharaan sebelum menyimpan.",
        variant: "destructive",
      })
      return
    }

    try {
      const usageResponse = await assetUsageService.getAll({
        page: 1,
        limit: 50,
        assetId: String(data.assetId),
        assetType: data.assetType,
      })
      const hasActiveUsage = Array.isArray(usageResponse.data) && usageResponse.data.some((usage) => {
        const matchesDetail = !data.assetDetailId || !usage.assetDetailId || usage.assetDetailId === data.assetDetailId
        return matchesDetail && !usage.endedAt
      })
      if (hasActiveUsage) {
        toast({
          title: "Aset belum dapat dipelihara",
          description: "Aset sedang dalam penggunaan aktif. Selesaikan penggunaan terlebih dahulu.",
          variant: "destructive",
        })
        return
      }
    } catch (usageError) {
      console.error("Failed to check asset usage before maintenance create:", usageError)
    }

    try {
      const isEditing = Boolean(editingMaintenance)

      if (isEditing) {
        if (!canEditMaintenance) {
          toast({
            title: "Akses ditolak",
            description: "Anda tidak memiliki izin untuk mengedit jadwal pemeliharaan.",
            variant: "destructive",
          })
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
          technicianUserId: data.technicianUserId ? Number(data.technicianUserId) : undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          status: data.status,
          cancellationReason: data.cancellationReason?.trim() || undefined,
        }

        const currentMaintenance = editingMaintenance
        if (!currentMaintenance) {
          return
        }
        const response = await maintenanceService.update(currentMaintenance.id, updatePayload)
        if (!response.success) {
          toast({
            title: "Pemeliharaan belum diperbarui",
            description: response.message || "Data pemeliharaan belum dapat diperbarui.",
            variant: "destructive",
          })
          return
        }
      } else {
        if (!canCreateMaintenance) {
          toast({
            title: "Akses ditolak",
            description: "Anda tidak memiliki izin untuk menambah pengajuan pemeliharaan sarana.",
            variant: "destructive",
          })
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
          technicianUserId: data.technicianUserId ? Number(data.technicianUserId) : undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          cancellationReason: data.cancellationReason?.trim() || undefined,
          createdBy: Number(currentUser.id),
        }

        const response = await maintenanceService.create({
          ...newPayload,
          assetDetailId: data.assetDetailId,
          assetDetailName: data.assetDetailName,
          assetDetailCode: data.assetDetailCode,
          assetLocation: data.assetLocation,
        })

        if (!response.success) {
          toast({
            title: "Pemeliharaan belum tersimpan",
            description: response.message || "Pengajuan pemeliharaan sarana belum dapat disimpan.",
            variant: "destructive",
          })
          return
        }
      }

      await loadMaintenance()
      await loadAssets()
      setShowForm(false)
      setEditingMaintenance(null)
      setPrefillAsset(null)
      setPrefillNote("")

      if (!isEditing) {
        toast({
          title: "Pemeliharaan sarana berhasil ditambahkan",
          description: "Data pemeliharaan sarana sudah tersimpan.",
        })
      }
    } catch (error: any) {
      console.error("Error saving maintenance:", error)
      toast({
        title: "Pemeliharaan belum tersimpan",
        description: "Terjadi kesalahan saat menyimpan pemeliharaan sarana.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteMaintenance = (item: Maintenance) => {
    if (!canDeleteMaintenance) {
      toast({
        title: "Akses ditolak",
        description: "Hanya Admin yang dapat menghapus jadwal pemeliharaan.",
        variant: "destructive",
      })
      return
    }
    setPendingDeleteMaintenance(item)
    setDeleteReason("")
  }

  const confirmDeleteMaintenance = async () => {
    if (!pendingDeleteMaintenance) return
    const reason = deleteReason.trim()
    if (!reason) {
      toast({
        title: "Alasan wajib diisi",
        description: "Isi alasan penghapusan sebelum melanjutkan.",
        variant: "destructive",
      })
      return
    }

    setIsDeletingMaintenance(true)
    try {
      const response = await maintenanceService.delete(String(pendingDeleteMaintenance.id), reason)
      if (!response.success) {
        toast({
          title: "Pemeliharaan belum terhapus",
          description: response.message || "Jadwal pemeliharaan belum dapat dihapus.",
          variant: "destructive",
        })
        return
      }
      setPendingDeleteMaintenance(null)
      setDeleteReason("")
      await loadMaintenance()
      await loadAssets()
    } catch (error: any) {
      console.error("Error deleting maintenance:", error)
      toast({
        title: "Pemeliharaan belum terhapus",
        description: "Terjadi kesalahan saat menghapus jadwal pemeliharaan.",
        variant: "destructive",
      })
    } finally {
      setIsDeletingMaintenance(false)
    }
  }

  const handleEditMaintenance = (data: Maintenance) => {
    if (!canEditMaintenance) {
      toast({
        title: "Akses ditolak",
        description: "Anda tidak memiliki izin untuk mengedit jadwal pemeliharaan.",
        variant: "destructive",
      })
      return
    }
    setEditingMaintenance(data)
    setShowForm(true)
  }

  const handleUpdateStatus = async (id: string | number, newStatus: string) => {
    if (!currentUser) {
      toast({
        title: "Sesi tidak tersedia",
        description: "Silakan login terlebih dahulu sebelum mengubah status pemeliharaan.",
        variant: "destructive",
      })
      return
    }

    const currentRecord = maintenance.find((item) => String(item.id) === String(id))
    if (!currentRecord) {
      toast({
        title: "Data tidak ditemukan",
        description: "Data pemeliharaan tidak ditemukan atau sudah berubah.",
        variant: "destructive",
      })
      return
    }

    if (["validated", "cancelled"].includes(currentRecord.status)) {
      toast({
        title: "Status tidak dapat diubah",
        description: "Pemeliharaan yang sudah selesai final atau dibatalkan tidak dapat diubah lagi.",
        variant: "destructive",
      })
      return
    }

    if (!canManageAdvancedStatuses) {
      toast({
        title: "Akses ditolak",
        description: "Hanya Admin, Leader, atau Teknisi yang dapat mengubah alur status pemeliharaan.",
        variant: "destructive",
      })
      return
    }

    if (newStatus === currentRecord.status) {
      return
    }

    const allowedTransitions = MAINTENANCE_STATUS_TRANSITIONS[currentRecord.status] || []
    if (!allowedTransitions.includes(newStatus)) {
      toast({
        title: "Status tidak valid",
        description: "Perubahan status tidak sesuai dengan tahap pemeliharaan saat ini.",
        variant: "destructive",
      })
      return
    }

    try {
      if (newStatus === "completed") {
        const response = await maintenanceService.complete(String(id), undefined, undefined, Number(currentUser.id))
        if (!response.success) {
          toast({
            title: "Status belum diperbarui",
            description: response.message || "Pemeliharaan belum dapat diselesaikan.",
            variant: "destructive",
          })
          return
        }
      } else if (["requested", "scheduled", "in_progress", "validated", "cancelled"].includes(newStatus)) {
        const response = await maintenanceService.update(String(id), {
          status: newStatus as "requested" | "scheduled" | "in_progress" | "validated" | "cancelled",
        })
        if (!response.success) {
          toast({
            title: "Status belum diperbarui",
            description: response.message || "Status pemeliharaan belum dapat diperbarui.",
            variant: "destructive",
          })
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
          title: "Pemeliharaan sarana sedang pengecekan lanjutan",
          description: "Status pemeliharaan sudah diubah ke tahap pengecekan lanjutan.",
        })
      } else if (newStatus === "completed") {
        toast({
          title: "Pemeliharaan dalam proses pengerjaan",
          description: "Status pemeliharaan sudah diubah ke tahap dalam proses pengerjaan.",
        })
      } else if (newStatus === "validated") {
        toast({
          title: "Pemeliharaan selesai final",
          description: "Pemeliharaan telah lolos validasi akhir.",
        })
      } else if (newStatus === "cancelled") {
        toast({
          title: "Pemeliharaan sarana ditolak",
          description: "Status pemeliharaan sudah diperbarui menjadi ditolak atau dibatalkan.",
        })
      }
    } catch (error: any) {
      console.error("Error updating maintenance status:", error)
      toast({
        title: "Status belum diperbarui",
        description: "Terjadi kesalahan saat memperbarui status pemeliharaan.",
        variant: "destructive",
      })
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
      if (activeUsageLocks.has(baseKey)) return false
      if (activeUsageLocks.has(`${baseKey}|${String(item.detailId)}`)) return false
      if (activeBorrowingLocks.has(baseKey)) return false
      return !activeBorrowingLocks.has(`${baseKey}|${String(item.detailId)}`)
    })
  }, [activeBorrowingLocks, activeMaintenanceStatuses, activeUsageLocks, assets, maintenance])

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
    const allowedByDetailId = new Set(availableAssetsForForm.map((item) => item.detailId))
    let baseAssets = availableAssetsForForm

    if (prefillAsset && !allowedByDetailId.has(prefillAsset.detailId)) {
      baseAssets = [...baseAssets, prefillAsset]
      allowedByDetailId.add(prefillAsset.detailId)
    }

    if (!editingMaintenance) return baseAssets

    const currentDetailId = editingMaintenance.assetDetailId

    if (currentDetailId && allowedByDetailId.has(currentDetailId)) {
      return baseAssets
    }

    const currentAsset = resolveDetailForMaintenance(editingMaintenance)
    if (!currentAsset) return baseAssets

    if (allowedByDetailId.has(currentAsset.detailId)) {
      return baseAssets
    }

    return [...baseAssets, currentAsset]
  }, [availableAssetsForForm, editingMaintenance, resolveDetailForMaintenance, prefillAsset])

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
          return detail?.detailInventoryName || detail?.detailName || item.assetDetailName || item.assetName || "-"
        },
        defaultSelected: true,
      },
      {
        key: "kode",
        label: "Kode",
        getValue: (item) => {
          const detail = resolveDetailForMaintenance(item)
          return detail?.detailCode || item.assetDetailCode || item.assetCode || "-"
        },
        defaultSelected: true,
      },
      {
        key: "tipeLayanan",
        label: "Tipe Layanan",
        getValue: (item) => maintenanceTypeLabel(item.type),
        defaultSelected: true,
      },
      {
        key: "merek",
        label: "Merek / Model",
        getValue: (item) => {
          const detail = resolveDetailForMaintenance(item)
          return detail?.detailBrandModel || detail?.detailName || item.assetDetailName || item.assetName || "-"
        },
        defaultSelected: true,
      },
      {
        key: "peminjam",
        label: "Nama Pengirim",
        getValue: (item) => item.requesterName || "-",
        defaultSelected: true,
      },
      {
        key: "nip",
        label: "NIP Pengirim",
        getValue: (item) => item.requesterNip || "-",
        defaultSelected: true,
      },
      {
        key: "tanggalPinjam",
        label: "Jadwal Pemeliharaan",
        getValue: (item) => formatDayTimeLabel(item.scheduledDate, { showWeekday: false }),
        defaultSelected: true,
      },
      {
        key: "tanggalKembali",
        label: "Waktu Selesai",
        getValue: (item) => formatDayTimeLabel(item.completedDate, { showWeekday: false }),
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
        key: "catatanPendaftaran",
        label: "Catatan Pendaftaran",
        getValue: (item) => item.description || "-",
        defaultSelected: true,
      },
      {
        key: "teknisi",
        label: "Teknisi Pelaksana",
        getValue: (item) => item.technician || "-",
        defaultSelected: true,
      },
      {
        key: "biaya",
        label: "Biaya Pemeliharaan",
        getValue: (item) => (item.cost ? formatCostLabel(item.cost) : "-"),
        defaultSelected: true,
      },
      {
        key: "catatanAfter",
        label: "Catatan (After)",
        getValue: (item) => item.notes || "-",
        defaultSelected: true,
      },
      {
        key: "alasanPembatalan",
        label: "Alasan Pembatalan",
        getValue: (item) => item.cancellationReason || "-",
        defaultSelected: true,
      },
      {
        key: "catatan",
        label: "Ringkasan Catatan",
        getValue: (item) => item.notes || item.description || "-",
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
  const allMaintenanceForMetrics = useMemo(
    () => [...maintenance, ...maintenanceHistory],
    [maintenance, maintenanceHistory]
  )
  const completedCount = useMemo(
    () => allMaintenanceForMetrics.filter((m) => m.status === "validated").length,
    [allMaintenanceForMetrics]
  )
  const cancelledCount = useMemo(
    () => allMaintenanceForMetrics.filter((m) => m.status === "cancelled").length,
    [allMaintenanceForMetrics]
  )
  const maintenanceForHistory = useMemo(
    () => {
      const byId = new Map<number, Maintenance>()

      maintenance
        .filter((item) => item.status === "completed")
        .forEach((item) => {
          byId.set(item.id, item)
        })

      maintenanceHistory.forEach((item) => {
        byId.set(item.id, item)
      })

      return Array.from(byId.values())
    },
    [maintenance, maintenanceHistory]
  )
  const calendarEntries = useMemo(() => {
    const year = calendarMonthDate.getFullYear()
    const month = calendarMonthDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startOffset = getCalendarStartOffset(firstDay)
    const startDate = new Date(year, month, 1 - startOffset)

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + index)

      const items = allMaintenanceForMetrics
        .filter((item) => {
          const scheduledDate = parseCalendarDate(item.scheduledDate)
          return scheduledDate ? isSameCalendarDate(date, scheduledDate) : false
        })
        .sort((a, b) => String(a.scheduledDate).localeCompare(String(b.scheduledDate)))

      return {
        date,
        isCurrentMonth: date.getMonth() === month,
        items,
      }
    })
  }, [allMaintenanceForMetrics, calendarMonthDate])
  const calendarMonthLabel = calendarMonthDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
  const upcomingCalendarItems = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return allMaintenanceForMetrics
      .filter((item) => !["validated", "cancelled"].includes(item.status))
      .map((item) => ({ item, scheduledDate: parseCalendarDate(item.scheduledDate) }))
      .filter((entry): entry is { item: Maintenance; scheduledDate: Date } => Boolean(entry.scheduledDate))
      .filter((entry) => entry.scheduledDate >= today)
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
      .slice(0, 5)
  }, [allMaintenanceForMetrics])
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
    const isThresholdAutomation = String(m.notes || "").startsWith("AUTO_USAGE_THRESHOLD")
    const matchesAutomationSource =
      filterAutomationSource === "all" ||
      (filterAutomationSource === "usage_threshold" && isThresholdAutomation) ||
      (filterAutomationSource === "manual" && !isThresholdAutomation)
    return matchesSearch && matchesStatus && matchesAutomationSource
  })

  useEffect(() => {
    setMaintenancePage(1)
  }, [filterStatus, filterAutomationSource, maintenance.length, searchTerm])

  const totalMaintenancePages = Math.max(1, Math.ceil(filteredMaintenance.length / CARD_ROWS_PER_PAGE))
  const currentMaintenancePage = Math.min(maintenancePage, totalMaintenancePages)
  const maintenanceStartIndex = (currentMaintenancePage - 1) * CARD_ROWS_PER_PAGE
  const paginatedMaintenance = filteredMaintenance.slice(maintenanceStartIndex, maintenanceStartIndex + CARD_ROWS_PER_PAGE)
  const visibleMaintenancePages = buildVisiblePageItems(currentMaintenancePage, totalMaintenancePages)
  const goToMaintenancePage = (page: number) => {
    setMaintenancePage(Math.min(totalMaintenancePages, Math.max(1, page)))
  }

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

  const handleMaintenanceExportColumnToggle = (columnKey: string) => {
    setSelectedMaintenanceColumns((previous) => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous
        return previous.filter((item) => item !== columnKey)
      }
      return [...previous, columnKey]
    })
  }

  const buildMaintenanceFormular = (item: Maintenance): FormularData => {
    const detail = resolveDetailForMaintenance(item)
    const assetName = item.assetDetailName || detail?.detailInventoryName || detail?.detailName || item.assetName || "-"
    const assetCode = item.assetDetailCode || detail?.detailCode || item.assetCode || "-"
    const assetRoom = detail?.roomName || detail?.assetLocation || item.assetLocation || "-"
    const assetType = assetSourceLabel(deriveAssetSource(detail?.assetType ?? item.assetType, detail?.detailCode ?? item.assetCode))
    const requesterName = item.requesterName || "(................................)"
    const technicianName = item.technician || "(................................)"
    const validatorName = item.validatorName || technicianName

    return {
      formTitle: "Formulir Pemeliharaan Sarana",
      formNo: getMaintenanceNoId(item),
      introText: "Dokumen ini menjadi catatan permohonan dan pelaksanaan pemeliharaan sarana.",
      sections: [
        {
          numeral: "I",
          title: "Identitas Pemohon",
          fields: [
            { label: "Nama", value: item.requesterName || "-" },
            { label: "NIP", value: item.requesterNip || "-" },
            { label: "Unit Kerja", value: item.requesterWorkUnit || "-" },
            { label: "Sub Unit Kerja", value: item.requesterSubWorkUnit || "-" },
          ],
        },
        {
          numeral: "II",
          title: "Identitas Alat",
          fields: [
            { label: "Jenis Inventaris", value: assetType },
            { label: "Nama Alat", value: assetName },
            { label: "Kode Alat", value: assetCode },
            { label: "Ruangan Alat", value: assetRoom },
          ],
        },
        {
          numeral: "III",
          title: "Rencana Pemeliharaan",
          fields: [
            { label: "Tipe Layanan", value: maintenanceTypeLabel(item.type) },
            { label: "Jadwal Pemeliharaan", value: formatDayTimeLabel(item.scheduledDate, { showWeekday: false }) },
            { label: "Uraian Permohonan", value: item.description || "-" },
            { label: "Status", value: maintenanceStatusLabel(item.status) },
          ],
        },
        {
          numeral: "IV",
          title: "Pelaksanaan Pemeliharaan",
          fields: [
            { label: "Teknisi Pelaksana", value: item.technician || "-" },
            { label: "NIP Teknisi/PJ", value: item.technicianNip || "-" },
            { label: "Waktu Selesai", value: formatDayTimeLabel(item.completedDate, { showWeekday: false }) || "-" },
            { label: "Biaya Pemeliharaan", value: item.cost ? formatCostLabel(item.cost) : "-" },
            { label: "Catatan Hasil", value: item.notes || "-" },
            { label: "Alasan Pembatalan", value: item.cancellationReason || "-" },
          ],
        },
      ],
      signatureDate: "Jakarta, ..................... 20.....",
      signatureLeft: { title: "Yang Mengajukan", name: requesterName, nip: item.requesterNip || undefined },
      signatureRight: {
        title: "Teknisi / Pelaksana",
        name: technicianName,
        nip: item.technicianNip || undefined,
      },
      approverLabel: "MENGETAHUI",
      approverLeft: { title: "Penanggung Jawab Unit", name: requesterName },
      approverRight: { title: "Validator", name: validatorName, nip: item.validatorNip || undefined },
      notes: ["Dokumen ini digunakan sebagai bukti pencatatan pemeliharaan sarana."],
    }
  }

  const _exportSingleNarrative = async (format: ExportFormat, item: Maintenance) => {
    void exportFormularReport(format, {
      entries: [item],
      filePrefix: `jadwal-pemeliharaan-${item.id}`,
      buildFormular: buildMaintenanceFormular,
    })
  }

  const handleExport = async (format: ExportFormat) => {
    if (!maintenanceRowsToExport.length) return
    void exportFormularReport(format, {
      entries: maintenanceRowsToExport,
      filePrefix: "jadwal-pemeliharaan",
      buildFormular: buildMaintenanceFormular,
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

  const getCalendarStatusClass = (status: string) => {
    switch (status) {
      case "requested":
        return "border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300"
      case "scheduled":
        return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300"
      case "in_progress":
        return "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300"
      case "completed":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
      case "validated":
        return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300"
      case "cancelled":
        return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
      default:
        return "border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300"
    }
  }

  const shiftCalendarMonth = (offset: number) => {
    setCalendarMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const selectCalendarDate = (date: Date | undefined) => {
    if (!date) return
    setSelectedCalendarDate(date)
    setCalendarMonthDate(date)
    setCalendarPickerOpen(false)
  }

  const showCurrentCalendarDate = () => {
    const today = new Date()
    setSelectedCalendarDate(today)
    setCalendarMonthDate(today)
  }

  return (
    <main
      className="flex min-h-full flex-col"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}
      data-maintenance-page
    >
      <div className="flex flex-col flex-1">
        <div className="w-full space-y-4">
          <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/35 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-5">
                <div className="rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-[18px] font-bold text-foreground">Pemeliharaan Sarana</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {canCreateMaintenance && (
                  <Button
                    size="sm"
                    className="w-full rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700 sm:w-auto"
                    onClick={() => {
                      setEditingMaintenance(null)
                      setShowForm(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {createMaintenanceActionLabel}
                  </Button>
                )}
              </div>
            </div>
          </section>

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700/35 dark:bg-slate-900/70" data-maintenance-summary>
            <CardContent className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50/70 dark:bg-slate-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Diajukan / Disetujui</p>
                    <p className="text-xl font-semibold text-slate-700 dark:text-slate-300 mt-1">{submissionCount.toLocaleString("id-ID")}</p>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Sedang Pengecekan Lanjutan</p>
                    <p className="text-xl font-semibold text-teal-600 mt-1">{inProgressCount.toLocaleString("id-ID")}</p>
                  </div>
                  <Wrench className="h-4 w-4 text-teal-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Dalam Proses Pengerjaan</p>
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

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700/35 dark:bg-slate-900/70" data-maintenance-calendar>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-teal-50 p-2 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Kalender Pemeliharaan</CardTitle>
                    <CardDescription className="text-[13px] text-muted-foreground">
                      Jadwal bulanan untuk memantau pengajuan, proses, dan validasi.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!isCalendarMinimized ? (
                    <>
                      <Button variant="outline" size="sm" className="h-9 w-9 rounded-xl p-0" onClick={() => shiftCalendarMonth(-1)} aria-label="Bulan sebelumnya">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Popover open={calendarPickerOpen} onOpenChange={setCalendarPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 min-w-36 rounded-xl bg-slate-50 px-3 text-sm font-semibold capitalize text-slate-800 hover:bg-slate-100 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
                            aria-label={`Pilih tanggal, bulan, dan tahun. Saat ini ${calendarMonthLabel}`}
                          >
                            {calendarMonthLabel}
                            <ChevronDown className="ml-2 h-4 w-4 text-slate-500" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="center" className="w-auto p-0">
                          <Calendar
                            mode="single"
                            locale={id}
                            selected={selectedCalendarDate}
                            month={calendarMonthDate}
                            onMonthChange={setCalendarMonthDate}
                            onSelect={selectCalendarDate}
                            captionLayout="dropdown"
                            startMonth={new Date(2000, 0)}
                            endMonth={new Date(2100, 11)}
                            formatters={{
                              formatMonthDropdown: (date) => date.toLocaleDateString("id-ID", { month: "short" }),
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Button variant="outline" size="sm" className="h-9 w-9 rounded-xl p-0" onClick={() => shiftCalendarMonth(1)} aria-label="Bulan berikutnya">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 rounded-xl px-3" onClick={showCurrentCalendarDate}>
                        Hari ini
                      </Button>
                    </>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCalendarMinimized((prev) => !prev)}
                    className="rounded-2xl px-3"
                  >
                    {isCalendarMinimized ? (
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCalendarMinimized ? (
                <div className="rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 text-center text-[14px] text-teal-900 dark:border-teal-400/20 dark:bg-teal-400/5 dark:text-teal-200">
                  Section kalender pemeliharaan disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="overflow-x-auto">
                    <div className="min-w-180 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/35">
                      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40">
                        {calendarWeekDays.map((day) => (
                          <div key={day} className="px-2 py-2 text-center text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7">
                        {calendarEntries.map(({ date, isCurrentMonth, items }) => (
                          <div
                            key={date.toISOString()}
                            className={`min-h-28 border-b border-r border-slate-200 dark:border-slate-800/35 p-2 last:border-r-0 ${
                              isSameCalendarDate(date, selectedCalendarDate)
                                ? "bg-teal-50/70 ring-1 ring-inset ring-teal-300 dark:bg-teal-400/10 dark:ring-teal-500/40"
                                : isCurrentMonth
                                  ? "bg-white dark:bg-slate-900/60"
                                  : "bg-slate-50/70 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                                  isSameCalendarDate(date, new Date())
                                    ? "bg-teal-600 text-white"
                                    : isCurrentMonth
                                      ? "text-slate-700 dark:text-slate-300"
                                      : "text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                {date.getDate()}
                              </span>
                              {items.length > 0 ? (
                                <span className="rounded-full bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                  {items.length}
                                </span>
                              ) : null}
                            </div>
                            <div className="space-y-1">
                              {items.slice(0, 2).map((item) => {
                                const detail = resolveDetailForMaintenance(item)
                                const assetName = item.assetDetailName || detail?.detailInventoryName || detail?.detailName || item.assetName || "Aset"
                                return (
                                  <button
                                    key={`${date.toISOString()}-${item.id}`}
                                    type="button"
                                    onClick={() => {
                                      setSearchTerm(getMaintenanceNoId(item))
                                      setFilterStatus("Semua")
                                      setIsMaintenanceMinimized(false)
                                    }}
                                    className={`block w-full truncate rounded-md border px-2 py-1 text-left text-[11px] font-medium ${getCalendarStatusClass(item.status)}`}
                                    title={`${getMaintenanceNoId(item)} - ${assetName}`}
                                  >
                                    {assetName}
                                  </button>
                                )
                              })}
                              {items.length > 2 ? (
                                <div className="rounded-md bg-slate-100 dark:bg-slate-800/60 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                  +{items.length - 2} jadwal
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Jadwal terdekat</p>
                    </div>
                    {upcomingCalendarItems.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 px-3 py-4 text-sm text-muted-foreground">
                        Tidak ada jadwal aktif mendatang.
                      </div>
                    ) : (
                      upcomingCalendarItems.map(({ item, scheduledDate }) => {
                        const detail = resolveDetailForMaintenance(item)
                        const assetName = item.assetDetailName || detail?.detailInventoryName || detail?.detailName || item.assetName || "-"
                        return (
                          <button
                            key={`upcoming-${item.id}`}
                            type="button"
                            onClick={() => {
                              setSearchTerm(getMaintenanceNoId(item))
                              setFilterStatus("Semua")
                              setIsMaintenanceMinimized(false)
                            }}
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 px-3 py-3 text-left shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-900/40"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{assetName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{formatDayTimeLabel(item.scheduledDate, { showWeekday: true })}</p>
                              </div>
                              <Badge variant={getStatusColor(item.status)} className="shrink-0 text-[10px]">
                                {maintenanceStatusLabel(item.status)}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {scheduledDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                            </p>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            if (open) return
            setShowForm(false)
            setEditingMaintenance(null)
            setPrefillAsset(null)
            setPrefillNote("")
          }}
        >
          {showForm && (
            <DialogContent
              showCloseButton={false}
              className="max-h-[90dvh] w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-2xl p-0 sm:w-full sm:max-w-2xl"
            >
              <DialogTitle className="sr-only">
                {editingMaintenance ? "Edit Pemeliharaan Sarana" : "Tambah Pemeliharaan Sarana"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Formulir pemeliharaan sarana dengan area gulir mandiri.
              </DialogDescription>
              <MaintenanceForm
                maintenance={editingMaintenance}
                assets={maintenanceFormAssets}
                prefillAsset={editingMaintenance ? null : prefillAsset}
                prefillNote={prefillNote}
                onSave={handleSaveMaintenance}
                onCancel={() => {
                  setShowForm(false)
                  setEditingMaintenance(null)
                  setPrefillAsset(null)
                  setPrefillNote("")
                }}
              />
            </DialogContent>
          )}
        </Dialog>

        <div
          role="tablist"
          aria-label="Daftar pemeliharaan"
          className="grid grid-cols-2 gap-2 rounded-3xl border border-slate-200/80 bg-white/90 p-2 shadow-lg dark:border-slate-700/35 dark:bg-slate-900/70 sm:gap-3 sm:p-3"
        >
          <button
            type="button"
            role="tab"
            aria-selected={maintenanceView === "active"}
            aria-controls="active-maintenance-panel"
            id="active-maintenance-tab"
            onClick={() => setMaintenanceView("active")}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-[13px] font-semibold transition sm:min-h-16 sm:gap-3 sm:px-5 sm:text-base ${
              maintenanceView === "active"
                ? "bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Wrench className="h-5 w-5 shrink-0" />
            <span>Daftar Pemeliharaan Sarana</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={maintenanceView === "history"}
            aria-controls="maintenance-history-panel"
            id="maintenance-history-tab"
            onClick={() => setMaintenanceView("history")}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-center text-[13px] font-semibold transition sm:min-h-16 sm:gap-3 sm:px-5 sm:text-base ${
              maintenanceView === "history"
                ? "bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <History className="h-5 w-5 shrink-0" />
            <span>Riwayat Pemeliharaan Sarana</span>
          </button>
        </div>

        {maintenanceView === "active" && (
        <Card className="rounded-3xl border border-slate-200 bg-white/70 shadow-xl dark:border-slate-700/35 dark:bg-slate-900/70" data-maintenance-list>
          <div
            id="active-maintenance-panel"
            role="tabpanel"
            aria-labelledby="active-maintenance-tab"
          >
          <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Daftar Pemeliharaan Sarana</CardTitle>
                  <CardDescription className="text-[13px] text-muted-foreground">
                    Total: {filteredMaintenance.length} jadwal
                  </CardDescription>
                </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMaintenanceMinimized((prev) => !prev)}
                  className="w-full rounded-2xl px-3 sm:w-auto"
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
                    <Button variant="outline" size="sm" className="w-full rounded-2xl px-3 sm:w-auto">
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
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full rounded-2xl px-3 text-[14px] font-semibold sm:w-auto"
                  onClick={handleSelectAllMaintenance}
                >
                  {allMaintenanceSelected ? "Batal pilih semua" : "Pilih semua"}
                </Button>
                <span className="text-[12px] text-muted-foreground sm:text-right sm:text-[13px]">
                  {selectedMaintenanceRows.length
                    ? `${selectedMaintenanceRows.length} baris dipilih`
                    : `Semua ${filteredMaintenance.length} baris siap cetak`}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {isMaintenanceMinimized ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-200">
                Section jadwal pemeliharaan disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
                <div className="grid gap-3 px-3 pb-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_190px_210px] lg:px-6">
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
                    <option value="in_progress">Sedang Pengecekan Lanjutan</option>
                    <option value="completed">Dalam Proses Pengerjaan</option>
                    <option value="validated">Selesai</option>
                    <option value="cancelled">Ditolak / Dibatalkan</option>
                  </select>
                  <select
                    value={filterAutomationSource}
                    onChange={(e) => setFilterAutomationSource(e.target.value as "all" | "usage_threshold" | "manual")}
                    className="rounded-xl border border-border/80 bg-background px-4 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                  >
                    <option value="all">Semua Sumber</option>
                    <option value="usage_threshold">Otomatis (Threshold)</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                {filteredMaintenance.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-[13px]">Belum ada jadwal pemeliharaan</p>
                ) : (
                  <div className="px-3 pb-4 sm:px-4 sm:pb-4">
                    <div className="space-y-4">
                      {paginatedMaintenance.map((m) => {
                      const detailInfo = resolveDetailForMaintenance(m)

                      const inventoryTypeSource = deriveAssetSource(
                        detailInfo?.assetType ?? m.assetType,
                        detailInfo?.detailCode ?? m.assetCode
                )

                const inventoryTypeLabel = assetSourceLabel(inventoryTypeSource)

                const inventoryName =
                  detailInfo?.detailInventoryName ||
                  detailInfo?.detailName ||
                  m.assetDetailName ||
                  m.assetName ||
                  "-"
                const maintenanceNoId = getMaintenanceNoId(m)

                const codeLabel = detailInfo?.detailCode || m.assetDetailCode || m.assetCode || "-"
                const roomNameLabel = detailInfo?.roomName || detailInfo?.assetLocation || m.assetLocation || "-"
                const requesterRoomLabel = m.requesterWorkUnit || "-"

                const brandModel =
                  detailInfo?.detailBrandModel ||
                  detailInfo?.detailName ||
                  m.assetDetailName ||
                  m.assetName ||
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
                  <SummaryResultCard
                    key={String(m.id)}
                    title="Informasi Dasar Alat"
                    footer={(
                      <SummaryResultFooter
                        selected={selectedMaintenanceIds.has(m.id)}
                        onSelectedChange={() => toggleMaintenanceSelection(m.id)}
                        selectionLabel={`Pilih jadwal pemeliharaan ${inventoryName}`}
                      >
                        {canManageAdvancedStatuses && getSelectableStatuses(m.status).length > 1 ? (
                          <select
                            value={m.status}
                            onChange={(e) => handleStatusSelection(m.id, e.target.value)}
                            className="h-8 rounded-lg border border-border bg-slate-50 dark:bg-slate-900/40 px-2.5 text-[12px]"
                          >
                            {getSelectableStatuses(m.status).map((status) => (
                              <option key={`${m.id}-${status}`} value={status}>
                                {maintenanceStatusLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : null}

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                          onClick={() => toggleCardCollapse(m.id)}
                          title={isExpanded ? "Sembunyikan detail pemeliharaan" : "Lihat detail pemeliharaan"}
                        >
                          <Eye className="h-4 w-4" />
                          Lihat
                        </Button>

                        <div className="flex items-center gap-2">
                          {canEditMaintenance ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                                onClick={() => handleEditMaintenance(m)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {canDeleteMaintenance && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                                  onClick={() => handleDeleteMaintenance(m)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">-</span>
                          )}
                        </div>

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
                            <DropdownMenuItem onClick={() => void _exportSingleNarrative("pdf", m)}>
                              PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void _exportSingleNarrative("word", m)}>
                              Word
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </SummaryResultFooter>
                    )}
                  >

                    {!isExpanded && (
                      <SummaryResultBody
                        assetName={inventoryName}
                        assetCode={codeLabel}
                        noId={maintenanceNoId}
                        personLabel="Pemohon"
                        personValue={`${m.requesterName || "-"} • ${m.requesterNip || "-"}`}
                        unitLabel="Ruangan pemohon"
                        unitValue={requesterRoomLabel}
                        unitExtra={`Teknisi: ${m.technician || "-"}${m.technicianNip ? ` • ${m.technicianNip}` : ""}`}
                        timeLabel="Jadwal Pemeliharaan"
                        timeValue={scheduledLabel}
                        badges={(
                          <>
                            <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${assetSourceBadgeClass(inventoryTypeSource)}`}>
                              {inventoryTypeLabel}
                            </Badge>
                            <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${maintenanceTypeBadgeClass(m.type)}`}>
                              {maintenanceTypeLabel(m.type)}
                            </Badge>
                            <Badge className={`gap-1 rounded-full border px-2 py-0.5 text-[11px] ${locationBadgeClass}`}>
                              <MapPin className="h-3 w-3" />
                              {roomNameLabel}
                            </Badge>
                          </>
                        )}
                        statusBadges={(
                          <>
                            <Badge variant={getStatusColor(m.status)} className="rounded-full px-2.5 py-1 text-[11px] font-medium sm:text-[12px]">
                              {maintenanceStatusLabel(m.status)}
                            </Badge>
                            {m.slaStatus && m.slaStatus !== "no_target" ? (
                              <Badge className={`rounded-full border px-2.5 py-1 text-[11px] font-medium sm:text-[12px] ${maintenanceSlaBadgeClass(m.slaStatus)}`}>
                                {maintenanceSlaLabel(m.slaStatus)}
                              </Badge>
                            ) : null}
                          </>
                        )}
                      />
                    )}
                    {isExpanded && (
                      <div className="space-y-3 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-3 sm:py-3">
                        <div className="columns-1 gap-3 lg:columns-2">
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Informasi Dasar Alat" />
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                              <InfoRow label="Jenis Inventaris">{inventoryTypeLabel}</InfoRow>
                              <InfoRow label="Tipe Layanan">{maintenanceTypeLabel(m.type)}</InfoRow>
                              <InfoRow label="Prioritas">{({ low: "Rendah", normal: "Normal", high: "Tinggi", critical: "Kritis" }[m.priority || "normal"] || "Normal")}</InfoRow>
                              <InfoRow label="No ID Jadwal">{maintenanceNoId}</InfoRow>
                              <InfoRow label="Nama Alat">{inventoryName}</InfoRow>
                              <InfoRow label="Kode Alat">{codeLabel}</InfoRow>
                              <InfoRow label="Nama Ruangan Alat">{roomNameLabel}</InfoRow>
                              <InfoRow label="Merek / Model">{brandModel}</InfoRow>
                            </div>
                          </div>
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Detail Administrasi" />
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                              <InfoRow label="Nama Pengirim">{m.requesterName || "-"}</InfoRow>
                              <InfoRow label="NIP Pengirim">{m.requesterNip || "-"}</InfoRow>
                              <InfoRow label="Jadwal Pemeliharaan Sarana">{scheduledLabel}</InfoRow>
                              <InfoRow label="Batas Penyelesaian (SLA)">{m.dueAt ? formatDayTimeLabel(m.dueAt, { showWeekday: false }) : "-"}</InfoRow>
                              <InfoRow label="Status SLA">{maintenanceSlaLabel(m.slaStatus)}</InfoRow>
                              <InfoRow label="Catatan Pendaftaran">{registrationNote}</InfoRow>
                            </div>
                          </div>
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Pelaksanaan & Biaya" />
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                              <InfoRow label="Teknisi Pelaksana">{m.technician || "-"}</InfoRow>
                              <InfoRow label="NIP Teknisi/PJ">{m.technicianNip || "-"}</InfoRow>
                              <InfoRow label="Vendor/Penyedia Jasa">{m.vendorName || "-"}</InfoRow>
                              <InfoRow label="Referensi Vendor">{m.vendorReference || "-"}</InfoRow>
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

                  </SummaryResultCard>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Menampilkan {maintenanceStartIndex + 1}-{Math.min(maintenanceStartIndex + CARD_ROWS_PER_PAGE, filteredMaintenance.length)} dari {filteredMaintenance.length} jadwal
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentMaintenancePage === 1}
                    onClick={() => setMaintenancePage((page) => Math.max(1, page - 1))}
                    aria-label="Halaman daftar pemeliharaan sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {visibleMaintenancePages.map((page) => (
                    typeof page === "number" ? (
                      <Button
                        key={page}
                        type="button"
                        variant={page === currentMaintenancePage ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => goToMaintenancePage(page)}
                        aria-label={`Halaman daftar pemeliharaan ${page}`}
                        aria-current={page === currentMaintenancePage ? "page" : undefined}
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
                    disabled={currentMaintenancePage === totalMaintenancePages}
                    onClick={() => setMaintenancePage((page) => Math.min(totalMaintenancePages, page + 1))}
                    aria-label="Halaman daftar pemeliharaan berikutnya"
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

        {/* Riwayat Pemeliharaan Sarana */}
        {maintenanceView === "history" && (
        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700/35 dark:bg-slate-900/70" data-maintenance-history>
          <div
            id="maintenance-history-panel"
            role="tabpanel"
            aria-labelledby="maintenance-history-tab"
          >
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
              <div className="rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 text-center text-[14px] text-teal-900 dark:border-teal-400/20 dark:bg-teal-400/5 dark:text-teal-200">
                Section riwayat pemeliharaan disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
                {currentUser ? (
                  <MaintenanceHistoryList
                    user={currentUser}
                    assets={assets}
                    maintenance={maintenanceForHistory}
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
          </div>
        </Card>
        )}

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
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Pembatalan
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

            <div className="mt-auto pt-6 border-t border-border text-center">
              <p className="text-[13px] text-muted-foreground">
                Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
              </p>
            </div>
	      </div>
	    </div>

      <DeleteReasonDialog
        open={Boolean(pendingDeleteMaintenance)}
        title="Arsipkan data pemeliharaan?"
        description={`Data ${pendingDeleteMaintenance?.assetDetailName || pendingDeleteMaintenance?.assetName || "pemeliharaan"} akan disembunyikan dari daftar utama, tetapi tetap tersimpan sebagai arsip Admin.`}
        value={deleteReason}
        isSubmitting={isDeletingMaintenance}
        onValueChange={setDeleteReason}
        onCancel={() => {
          if (isDeletingMaintenance) return
          setPendingDeleteMaintenance(null)
          setDeleteReason("")
        }}
        onConfirm={confirmDeleteMaintenance}
      />

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
            {createMaintenanceActionLabel}
          </Button>
        </div>
      )}
	    </main>
  )
}
