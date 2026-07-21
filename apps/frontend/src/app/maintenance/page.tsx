'use client'

import { buildLoginRedirectUrl } from "@/services/auth-utils";
import { id } from "date-fns/locale";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Download,
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
import { findAssetByScanTarget, parseScanTargetFromSearchParams } from "@/utils/asset-scan-target";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import { formatCostLabel, formatDayTimeLabel } from "@/utils/format";
import { formatNoId } from "@/utils/record-id";
import { canCreateMaintenanceRole, canManageMaintenanceStatusRole, isAdminOrLeaderRole, isAdminRole, isStaffPjRole, isTechnicianRole, normalizeUserRole } from "@/utils/role";
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
  in_progress: ["completed"],
  completed: ["validated", "in_progress"],
  validated: [],
  cancelled: ["scheduled"],
}

const canCancelMaintenance = (currentStatus: string, role?: string | null) => {
  const normalizedRole = normalizeUserRole(role)
  if (!["requested", "scheduled"].includes(currentStatus)) return false
  if (["admin", "leader"].includes(normalizedRole)) return true
  if (normalizedRole === "staff_pj") return ["requested", "scheduled"].includes(currentStatus)
  return normalizedRole === "teknisi" && currentStatus === "scheduled"
}

const canOpenMaintenanceWorkflow = (status: Maintenance["status"], role?: string | null) => {
  const normalizedRole = normalizeUserRole(role)
  if (["validated", "cancelled"].includes(status)) return false
  if (status === "requested") return false
  if (status === "scheduled") return ["admin", "leader", "staff_pj", "teknisi"].includes(normalizedRole)
  return ["admin", "leader", "teknisi"].includes(normalizedRole)
}

const maintenanceWorkflowActionLabel = (status: Maintenance["status"]) => {
  if (status === "requested") return "Tinjau Pengajuan"
  if (status === "scheduled") return "Atur Penugasan"
  if (status === "in_progress") return "Isi Laporan"
  if (status === "completed") return "Verifikasi Hasil"
  return "Buka Proses"
}

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
  const [maintenanceAnalytics, setMaintenanceAnalytics] = useState<any | null>(null)

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

  const loadMaintenanceAnalytics = async () => {
    try {
      const response = await maintenanceService.getAnalytics()
      if (response.success) {
        setMaintenanceAnalytics(response.data || null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (message.includes("Maintenance record not found")) {
        setMaintenanceAnalytics(null)
        return
      }
      console.warn("Maintenance analytics unavailable:", error)
    }
  }

  const handleDispatchReminders = async () => {
    try {
      const response = await maintenanceService.dispatchReminders()
      toast({
        title: response.success ? "Reminder diproses" : "Reminder belum diproses",
        description: response.success ? `${response.data?.sent ?? 0} notifikasi reminder dibuat.` : response.message,
        variant: response.success ? "default" : "destructive",
      })
    } catch {
      toast({
        title: "Reminder belum diproses",
        description: "Terjadi kesalahan saat memproses reminder pemeliharaan.",
        variant: "destructive",
      })
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

  useEffect(() => {
    if (searchParams.get("openForm") !== "1") return
    if (!canCreateMaintenanceRole(currentUser?.role)) return
    if (assets.length === 0) return
    const target = parseScanTargetFromSearchParams(searchParams)
    const query = (searchParams.get("q") || "").trim().toLowerCase()
    if (!target && !query) return
    const matchedAsset = findAssetByScanTarget(assets, target, query, (candidateAssets, fuzzyQuery) =>
      candidateAssets.find((asset) => {
        const candidates = [
          asset.detailId,
          asset.detailCode,
          asset.assetCode,
          asset.detailInventoryName,
          asset.detailName,
          asset.assetName,
        ].filter(Boolean).map((value) => String(value).toLowerCase())
        return candidates.some((value) => value.includes(fuzzyQuery) || fuzzyQuery.includes(value))
      }),
    )
    if (!matchedAsset) return
    setPrefillAsset(matchedAsset)
    setPrefillNote("Pengajuan dari QR inventaris.")
    setShowForm(true)
  }, [assets, currentUser?.role, searchParams])

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
        loadMaintenanceAnalytics(),
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
    void Promise.all([loadMaintenance(), loadMaintenanceAnalytics()])
  }, [filterAutomationSource])

  useEffect(() => {
    const handleInventoryRefresh = () => {
      void Promise.all([
        loadMaintenance(),
        loadMaintenanceAnalytics(),
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
  const canEditMaintenance = hasFullAccess || isTechnician || isStaffPjRole(currentUser?.role)
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

    const shouldBlockByUsage = ["in_progress", "completed", "validated"].includes(String(data.status || "requested"))
    if (shouldBlockByUsage) {
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
    }

    try {
      const isEditing = Boolean(editingMaintenance)
      let savedMaintenanceId: number | string | undefined

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
          priority: data.priority,
          scheduledDate: data.scheduledDate,
          description: data.description || '',
          technician: data.technician || undefined,
          technicianUserId: data.technicianUserId ? Number(data.technicianUserId) : undefined,
          vendorName: data.vendorName || undefined,
          vendorReference: data.vendorReference || undefined,
          warrantyUntil: data.warrantyUntil || undefined,
          estimatedDurationMinutes: data.estimatedDurationMinutes ? Number(data.estimatedDurationMinutes) : undefined,
          estimatedCost: data.estimatedCost ? Number(data.estimatedCost) : undefined,
          damagePhotoUrl: data.damagePhotoUrl || undefined,
          beforePhotoUrl: data.beforePhotoUrl || undefined,
          afterPhotoUrl: data.afterPhotoUrl || undefined,
          diagnosis: data.diagnosis || undefined,
          actionTaken: data.actionTaken || undefined,
          checklist: data.checklist || undefined,
          spareParts: data.spareParts || undefined,
          verificationResult: data.verificationResult || undefined,
          finalCondition: data.finalCondition || undefined,
          verificationNotes: data.verificationNotes || undefined,
          nextMaintenanceDate: data.nextMaintenanceDate || undefined,
          startedAt: data.startedAt || undefined,
          completedDate: data.completedDate || undefined,
          actualStartAt: data.actualStartAt || data.startedAt || undefined,
          actualEndAt: data.actualEndAt || data.completedDate || undefined,
          recurrenceInterval: data.recurrenceInterval || "none",
          recurrenceEnabled: Boolean(data.recurrenceEnabled),
          approvalStatus: data.approvalStatus || undefined,
          approvalNotes: data.approvalNotes || undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          status: data.status,
          cancellationReason: data.cancellationReason?.trim() || undefined,
        }

        const currentMaintenance = editingMaintenance
        if (!currentMaintenance) {
          return
        }
        // If Admin/Leader saves as 'scheduled' but no technician chosen,
        // assign current user so backend validation passes.
        if (updatePayload.status === "scheduled" && !updatePayload.technicianUserId && isAdminOrLeaderRole(currentUser.role)) {
          updatePayload.technicianUserId = Number(currentUser.id)
        }

        console.debug("Updating maintenance (payload):", updatePayload)
        const response = await maintenanceService.update(currentMaintenance.id, updatePayload)
        console.debug("Update response:", response)
        if (!response.success) {
          toast({
            title: "Pemeliharaan belum diperbarui",
            description: response.message || "Data pemeliharaan belum dapat diperbarui.",
            variant: "destructive",
          })
          return
        }
        savedMaintenanceId = response.data?.id ?? currentMaintenance.id
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
          priority: data.priority,
          status: data.status,
          scheduledDate: data.scheduledDate,
          description: data.description || '',
          technician: data.technician || undefined,
          technicianUserId: data.technicianUserId ? Number(data.technicianUserId) : undefined,
          vendorName: data.vendorName || undefined,
          vendorReference: data.vendorReference || undefined,
          warrantyUntil: data.warrantyUntil || undefined,
          estimatedDurationMinutes: data.estimatedDurationMinutes ? Number(data.estimatedDurationMinutes) : undefined,
          estimatedCost: data.estimatedCost ? Number(data.estimatedCost) : undefined,
          damagePhotoUrl: data.damagePhotoUrl || undefined,
          beforePhotoUrl: data.beforePhotoUrl || undefined,
          afterPhotoUrl: data.afterPhotoUrl || undefined,
          diagnosis: data.diagnosis || undefined,
          actionTaken: data.actionTaken || undefined,
          checklist: data.checklist || undefined,
          spareParts: data.spareParts || undefined,
          verificationResult: data.verificationResult || undefined,
          finalCondition: data.finalCondition || undefined,
          verificationNotes: data.verificationNotes || undefined,
          nextMaintenanceDate: data.nextMaintenanceDate || undefined,
          startedAt: data.startedAt || undefined,
          completedDate: data.completedDate || undefined,
          actualStartAt: data.actualStartAt || data.startedAt || undefined,
          actualEndAt: data.actualEndAt || data.completedDate || undefined,
          recurrenceInterval: data.recurrenceInterval || "none",
          recurrenceEnabled: Boolean(data.recurrenceEnabled),
          approvalStatus: data.approvalStatus || undefined,
          approvalNotes: data.approvalNotes || undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          cancellationReason: data.cancellationReason?.trim() || undefined,
          createdBy: Number(currentUser.id),
        }

        // If Admin/Leader creates as 'scheduled' but no technician chosen,
        // assign current user so backend validation passes.
        if (newPayload.status === "scheduled" && !newPayload.technicianUserId && isAdminOrLeaderRole(currentUser.role)) {
          newPayload.technicianUserId = Number(currentUser.id)
        }

        console.debug("Creating maintenance (payload):", newPayload)
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
        savedMaintenanceId = response.data?.id
      }

      if (savedMaintenanceId && data.attachmentFiles) {
        const uploadedUrls: Record<string, string> = {}
        const uploadTargets = [
          { key: "damagePhotoUrl", file: data.attachmentFiles.damagePhoto },
          { key: "beforePhotoUrl", file: data.attachmentFiles.beforePhoto },
          { key: "afterPhotoUrl", file: data.attachmentFiles.afterPhoto },
        ].filter((target) => target.file)

        for (const target of uploadTargets) {
          const uploadResponse = await maintenanceService.uploadAttachment(savedMaintenanceId, target.file)
          if (uploadResponse.success && uploadResponse.data?.url) {
            uploadedUrls[target.key] = uploadResponse.data.url
          }
        }

        if (Object.keys(uploadedUrls).length > 0) {
          await maintenanceService.update(savedMaintenanceId, uploadedUrls as any)
        }
      }

      await loadMaintenance()
      if (savedMaintenanceId) {
        try {
          const refreshed = await maintenanceService.getById(String(savedMaintenanceId))
          console.debug("Refreshed maintenance record:", refreshed)
        } catch (e) {
          console.debug("Failed to fetch refreshed maintenance record:", e)
        }
      }
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
      } else {
        const savedStatusToast: Record<string, { title: string; description: string }> = {
          scheduled: {
            title: "Penjadwalan tersimpan",
            description: "Penugasan teknisi/vendor sudah tersimpan dan menunggu proses perbaikan dimulai.",
          },
          in_progress: {
            title: "Proses perbaikan dimulai",
            description: "Penjadwalan tersimpan dan status sudah berpindah ke Dalam Proses Perbaikan.",
          },
          completed: {
            title: "Tindakan perbaikan selesai",
            description: "Laporan pelaksanaan tersimpan dan status sudah berpindah ke Menunggu Verifikasi.",
          },
          validated: {
            title: maintenanceStatusLabel("validated", data.type),
            description: "Hasil verifikasi tersimpan dan pemeliharaan sarana sudah selesai final.",
          },
          cancelled: {
            title: "Pemeliharaan dibatalkan",
            description: "Status pemeliharaan sudah diperbarui menjadi dibatalkan.",
          },
        }
        toast(
          savedStatusToast[String(data.status)] ?? {
            title: "Pemeliharaan sarana diperbarui",
            description: "Perubahan data pemeliharaan sarana sudah tersimpan.",
          }
        )
      }
    } catch (error: any) {
      console.error("Error saving maintenance:", error)
      const backendMessage = error?.response?.body?.message || error?.message
      toast({
        title: "Pemeliharaan belum tersimpan",
        description: backendMessage || "Terjadi kesalahan saat menyimpan pemeliharaan sarana.",
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

    if (currentRecord.status === "validated") {
      toast({
        title: "Status tidak dapat diubah",
        description: "Pemeliharaan yang sudah selesai final tidak dapat diubah lagi.",
        variant: "destructive",
      })
      return
    }

    if (!canManageAdvancedStatuses) {
      toast({
        title: "Akses ditolak",
        description: "Anda tidak memiliki kewenangan untuk mengubah tahap pemeliharaan ini.",
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
        // If Admin/Leader approves (schedules) but no technician/PJ is selected,
        // set the current user as the assignee so backend validation passes.
        const payload: any = {
          status: newStatus as "requested" | "scheduled" | "in_progress" | "validated" | "cancelled",
        }
        if (
          newStatus === "scheduled" &&
          !currentRecord.technicianUserId &&
          isAdminOrLeaderRole(currentUser.role)
        ) {
          payload.technicianUserId = Number(currentUser.id)
        }
        const response = await maintenanceService.update(String(id), payload)
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
          description:
            currentRecord.status === "cancelled"
              ? "Pemeliharaan dibuka kembali dan masuk ke tahap penugasan teknisi/leader/vendor."
              : "Pengajuan pemeliharaan sudah masuk ke tahap penugasan teknisi/leader/vendor.",
        })
      } else if (newStatus === "in_progress") {
        toast({
          title: "Pemeliharaan dalam proses perbaikan",
          description: "Status pemeliharaan sudah diubah ke tahap pelaksanaan tindakan.",
        })
      } else if (newStatus === "completed") {
        toast({
          title: "Tindakan selesai, menunggu verifikasi",
          description: "Status pemeliharaan sudah diubah ke tahap verifikasi hasil tindakan.",
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
      // Prefer backend-provided message when available so the user sees
      // why the update failed (e.g. missing technician selection).
      const backendMessage = error?.response?.body?.message || error?.message
      toast({
        title: "Status belum diperbarui",
        description: backendMessage || "Terjadi kesalahan saat memperbarui status pemeliharaan.",
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
        getValue: (item) => maintenanceStatusLabel(item.status, item.type),
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

      maintenanceHistory.forEach((item) => {
        byId.set(item.id, item)
      })

      return Array.from(byId.values())
    },
    [maintenanceHistory]
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
            { label: "Status", value: maintenanceStatusLabel(item.status, item.type) },
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

          <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700/35 dark:bg-slate-900/70" data-maintenance-dashboard>
            <CardHeader className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800/60 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="space-y-0.5">
                <h2 className="text-sm font-semibold text-foreground">Ringkasan Pemeliharaan</h2>
                <p className="text-xs text-muted-foreground">Ikhtisar biaya, keterlambatan, dan progres penanganan.</p>
              </div>
              {isAdminOrLeaderRole(currentUser?.role) ? (
                <Button className="h-8 rounded-lg px-3" variant="outline" size="sm" onClick={() => void handleDispatchReminders()} title="Proses reminder pemeliharaan">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  Reminder
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="sr-only">Status pemeliharaan</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {[
                    {
                      label: "Pengajuan",
                      fullLabel: "Diajukan atau disetujui",
                      value: submissionCount,
                      icon: ShieldCheck,
                      className: "bg-slate-50 text-slate-700 dark:bg-slate-950/35 dark:text-slate-300",
                      iconClassName: "bg-white text-slate-500 dark:bg-slate-900",
                    },
                    {
                      label: "Perbaikan",
                      fullLabel: "Dalam proses perbaikan",
                      value: inProgressCount,
                      icon: Wrench,
                      className: "bg-teal-50/70 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300",
                      iconClassName: "bg-white/80 text-teal-600 dark:bg-teal-950/60",
                    },
                    {
                      label: "Verifikasi",
                      fullLabel: "Laporan selesai, menunggu verifikasi",
                      value: awaitingValidationCount,
                      icon: AlertCircle,
                      className: "bg-amber-50/70 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
                      iconClassName: "bg-white/80 text-amber-600 dark:bg-amber-950/60",
                    },
                    {
                      label: "Selesai",
                      fullLabel: "Selesai pemeliharaan sarana",
                      value: completedCount,
                      icon: UserCheck,
                      className: "bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300",
                      iconClassName: "bg-white/80 text-indigo-600 dark:bg-indigo-950/60",
                    },
                    {
                      label: "Dibatalkan",
                      fullLabel: "Ditolak atau dibatalkan",
                      value: cancelledCount,
                      icon: XCircle,
                      className: "bg-rose-50/70 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
                      iconClassName: "bg-white/80 text-rose-600 dark:bg-rose-950/60",
                    },
                  ].map(({ label, fullLabel, value, icon: Icon, className, iconClassName }) => (
                    <div key={label} className={`flex min-h-20 min-w-0 items-center gap-3 rounded-xl px-3 py-3 ${className}`} title={fullLabel}>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium opacity-75 sm:text-xs">{label}</p>
                        <p className="text-lg font-bold leading-tight">{value.toLocaleString("id-ID")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {maintenanceAnalytics?.summary ? (
                <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-xl bg-slate-50 px-1 py-1 dark:divide-slate-800 dark:bg-slate-950/35 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {[
                    ["Total", maintenanceAnalytics.summary.total],
                    ["Terlambat", maintenanceAnalytics.summary.overdue],
                    ["Biaya", `Rp ${Number(maintenanceAnalytics.summary.total_cost || 0).toLocaleString("id-ID")}`],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex min-w-0 flex-col items-center justify-center px-3 py-2 text-center">
                      <p className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">{label}</p>
                      <p className="mt-0.5 truncate text-lg font-bold leading-tight text-slate-900 dark:text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
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
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{assetName}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">{formatDayTimeLabel(item.scheduledDate, { showWeekday: true })}</p>
                              </div>
                              <Badge
                                variant={getStatusColor(item.status)}
                                className="max-w-[58%] shrink text-left text-[10px] whitespace-normal wrap-break-word leading-tight"
                                title={maintenanceStatusLabel(item.status, item.type)}
                              >
                                {maintenanceStatusLabel(item.status, item.type)}
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
                userRole={currentUser?.role}
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
          className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm dark:border-slate-700/35 dark:bg-slate-900/70 sm:p-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={maintenanceView === "active"}
            aria-controls="active-maintenance-panel"
            id="active-maintenance-tab"
            onClick={() => setMaintenanceView("active")}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-[13px] font-semibold transition sm:min-h-12 sm:px-4 sm:text-sm ${
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
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-[13px] font-semibold transition sm:min-h-12 sm:px-4 sm:text-sm ${
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
                    <option value="in_progress">Dalam Proses Perbaikan</option>
                    <option value="completed">Laporan Pelaksanaan Selesai - Menunggu Verifikasi</option>
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
                const estimatedDurationLabel = m.estimatedDurationMinutes ? `${m.estimatedDurationMinutes} menit` : "-"
                const estimatedCostLabel = m.estimatedCost ? `Rp ${Number(m.estimatedCost).toLocaleString("id-ID")}` : "-"
                const nextMaintenanceDateLabel = m.nextMaintenanceDate
                  ? formatDayTimeLabel(m.nextMaintenanceDate, { showWeekday: false })
                  : "-"

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
                        {m.status === "requested" && ["admin", "leader", "staff_pj", "teknisi"].includes(normalizeUserRole(currentUser?.role)) && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-1.5 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-400/10"
                              onClick={() => void handleUpdateStatus(m.id, "scheduled")}
                              title="Setujui pengajuan pemeliharaan"
                              aria-label="Setujui pengajuan pemeliharaan"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            {canCancelMaintenance(m.status, currentUser?.role) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                                onClick={() => handleStatusSelection(m.id, "cancelled")}
                                title="Tolak pengajuan pemeliharaan"
                                aria-label="Tolak pengajuan pemeliharaan"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}

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

                        {canOpenMaintenanceWorkflow(m.status, currentUser?.role) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px] font-medium"
                            onClick={() => {
                              setEditingMaintenance(m)
                              setShowForm(true)
                            }}
                          >
                            <Wrench className="h-4 w-4" />
                            {maintenanceWorkflowActionLabel(m.status)}
                          </Button>
                        )}

                        {m.status === "cancelled" && ["admin", "leader", "staff_pj"].includes(normalizeUserRole(currentUser?.role)) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px] font-medium"
                            onClick={() => void handleUpdateStatus(m.id, "scheduled")}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Buka Kembali
                          </Button>
                        )}

                        <div className="flex items-center gap-2">
                          {canDeleteMaintenance ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                              onClick={() => handleDeleteMaintenance(m)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Alur via status</span>
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
                            <Badge variant={getStatusColor(m.status)} className="max-w-full rounded-full px-2.5 py-1 text-left text-[11px] font-medium whitespace-normal wrap-break-word leading-tight sm:text-[12px]">
                              {maintenanceStatusLabel(m.status, m.type)}
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
                              <InfoRow label="Estimasi Durasi">{estimatedDurationLabel}</InfoRow>
                              <InfoRow label="Batas Penyelesaian (SLA)">{m.dueAt ? formatDayTimeLabel(m.dueAt, { showWeekday: false }) : "-"}</InfoRow>
                              <InfoRow label="Status SLA">{maintenanceSlaLabel(m.slaStatus)}</InfoRow>
                              <InfoRow label="Catatan Pendaftaran">{registrationNote}</InfoRow>
                              <InfoRow label="Bukti Kerusakan">{m.damagePhotoUrl ? <a className="text-teal-700 underline dark:text-teal-300" href={m.damagePhotoUrl} target="_blank" rel="noreferrer">Lihat lampiran</a> : "-"}</InfoRow>
                            </div>
                          </div>
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Pelaksanaan & Biaya" />
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                              <InfoRow label="Teknisi Pelaksana">{m.technician || "-"}</InfoRow>
                              <InfoRow label="NIP Teknisi/PJ">{m.technicianNip || "-"}</InfoRow>
                              <InfoRow label="Vendor/Penyedia Jasa">{m.vendorName || "-"}</InfoRow>
                              <InfoRow label="Referensi Vendor">{m.vendorReference || "-"}</InfoRow>
                              <InfoRow label="Estimasi Biaya">{estimatedCostLabel}</InfoRow>
                              <InfoRow label="Waktu Selesai">{completionLabel}</InfoRow>
                              <InfoRow label="Biaya Pemeliharaan">{costLabel}</InfoRow>
                              <InfoRow label="Diagnosis">{m.diagnosis || "-"}</InfoRow>
                              <InfoRow label="Tindakan">{m.actionTaken || "-"}</InfoRow>
                              <InfoRow label="Checklist">{m.checklist || "-"}</InfoRow>
                              <InfoRow label="Suku Cadang">{m.spareParts || "-"}</InfoRow>
                              <InfoRow label="Foto Sebelum">{m.beforePhotoUrl ? <a className="text-teal-700 underline dark:text-teal-300" href={m.beforePhotoUrl} target="_blank" rel="noreferrer">Lihat foto</a> : "-"}</InfoRow>
                              <InfoRow label="Foto Sesudah">{m.afterPhotoUrl ? <a className="text-teal-700 underline dark:text-teal-300" href={m.afterPhotoUrl} target="_blank" rel="noreferrer">Lihat foto</a> : "-"}</InfoRow>
                              <InfoRow label="Catatan (After)">{afterNotesLabel}</InfoRow>
                              {m.status === "cancelled" && (
                                <InfoRow label="Alasan Pembatalan">{cancellationReasonLabel}</InfoRow>
                              )}
                            </div>
                          </div>
                          <div className="mb-3 break-inside-avoid space-y-2">
                            <SectionHeader label="Verifikasi" />
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                              <InfoRow label="Hasil Pengujian">{m.verificationResult || "-"}</InfoRow>
                              <InfoRow label="Kondisi Akhir">{m.finalCondition || "-"}</InfoRow>
                              <InfoRow label="Catatan Verifikasi">{m.verificationNotes || "-"}</InfoRow>
                              <InfoRow label="Jadwal Berikutnya">{nextMaintenanceDateLabel}</InfoRow>
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
