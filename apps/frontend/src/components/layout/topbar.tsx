"use client"

import { ArrowRight, Bell, Building2, Hash, ScanLine, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import appSettingService, {
    ANNOUNCEMENT_UPDATED_EVENT,
    DEFAULT_TOPBAR_ANNOUNCEMENT,
    DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE,
    getAnnouncementStyleClass,
    type TopbarAnnouncementStyle,
} from "@/services/app-setting.service";
import { assetUsageService } from "@/services/asset-usage.service";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import notificationService, { type AppNotification } from "@/services/notification.service";
import { serverTimeService } from "@/services/server-time.service";
import {
    assetSourceLabel,
    borrowingStatusLabel,
    deriveAssetSource,
    locationBadgeClass,
    maintenanceStatusLabel,
} from "@/utils/api-mappers";
import { formatDateId } from "@/utils/format";
import { toPublicPhotoUrl } from "@/utils/photo-url";
import { formatNoId } from "@/utils/record-id";
import { parseScannedBarcode } from "@/utils/scanned-asset";

import { BarcodeScannerDialog } from "@/components/scan/barcode-scanner-dialog";
import { buildBorrowUrl, buildDetailUrl, buildMaintenanceUrl, buildUsageUrl, type ScanChoice } from "@/components/scan/scan-choice-dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getAuthToken, getCurrentUser, isLocalAuthSession } from "@/services/auth-utils";
import { normalizeUserRole } from "@/utils/role";

type NotificationType =
  | "jadwal_layanan"
  | "jadwal_terlewat"
  | "permintaan_baru"
  | "teknisi_ditugaskan"
  | "status_berubah"
  | "prioritas_tinggi"
  | "layanan_selesai"
  | "laporan_tersedia"
  | "preventive_maintenance"
  | "ditolak_dibatalkan"

type NotificationStatus = "info" | "success" | "reminder" | "warning" | "urgent"

type NotificationCategoryKey =
  | "schedule"
  | "maintenance"
  | "borrowing"
  | "returns"
  | "usage"
  | "disposal"
  | "deletion"
  | "asset"
  | "system"

/**
 * Lonceng menampilkan dua jenis pemberitahuan sekaligus:
 *
 * - `derived`: ringkasan keadaan yang dihitung di klien dari polling modul
 *   pemeliharaan/peminjaman/penggunaan. Selalu sinkron dengan data terkini dan
 *   ditutup lewat `dismissKey` di localStorage.
 * - `server`: baris tabel `notifications` yang mewakili kejadian pada satu titik
 *   waktu (mis. peminjaman disetujui). Ditutup dengan menandainya sudah dibaca
 *   di server lewat `serverId`.
 *
 * Field aset bersifat opsional karena hanya pemberitahuan turunan yang selalu
 * punya konteks aset; kejadian dari server bisa saja tidak terkait aset sama sekali.
 */
type NotificationItem = {
  id: string
  title: string
  subtitle: string
  description?: string
  href?: string
  category: NotificationCategoryKey
  type: NotificationType | string
  /** Label siap tampil untuk item server; item turunan memakai `notificationTypeLabel`. */
  typeLabel?: string
  notifStatus: NotificationStatus
  assetName?: string
  assetCode?: string
  recordNoId?: string
  identity?: string
  sourceLabel?: string
  roomLabel?: string
  dismissKey?: string
  serverId?: number
  /** URL gambar lampiran siaran admin, bila ada. */
  imageUrl?: string | null
}

const notificationTypeLabel: Record<NotificationType, string> = {
  jadwal_layanan: "📅 Jadwal Layanan",
  jadwal_terlewat: "⏰ Jadwal Terlewat",
  permintaan_baru: "🔧 Permintaan Layanan Baru",
  teknisi_ditugaskan: "👨‍🔧 Penugasan",
  status_berubah: "🔄 Status Berubah",
  prioritas_tinggi: "⚠️ Prioritas Tinggi",
  layanan_selesai: "✅ Layanan Selesai",
  laporan_tersedia: "📄 Laporan Tersedia",
  preventive_maintenance: "🛠️ Preventive Maintenance",
  ditolak_dibatalkan: "❌ Ditolak/Dibatalkan",
}

const statusConfig: Record<NotificationStatus, { gradient: string; dot: string }> = {
  info:     { gradient: "from-blue-700 to-blue-500",     dot: "bg-blue-500" },
  success:  { gradient: "from-green-700 to-green-500",   dot: "bg-green-500" },
  reminder: { gradient: "from-amber-600 to-amber-400",   dot: "bg-amber-400" },
  warning:  { gradient: "from-orange-600 to-orange-400", dot: "bg-orange-500" },
  urgent:   { gradient: "from-red-700 to-red-500",       dot: "bg-red-500" },
}

const NOTIFICATION_TYPES_BY_ROLE: Record<string, NotificationType[]> = {
  admin:    ["jadwal_layanan", "jadwal_terlewat", "permintaan_baru", "teknisi_ditugaskan", "status_berubah", "prioritas_tinggi", "layanan_selesai", "laporan_tersedia", "preventive_maintenance", "ditolak_dibatalkan"],
  leader:   ["jadwal_terlewat", "prioritas_tinggi", "layanan_selesai", "laporan_tersedia", "permintaan_baru"],
  staff_pj: ["jadwal_layanan", "jadwal_terlewat", "teknisi_ditugaskan", "status_berubah", "preventive_maintenance", "layanan_selesai"],
  staff:    ["permintaan_baru", "ditolak_dibatalkan", "status_berubah", "layanan_selesai"],
  teknisi:  ["teknisi_ditugaskan", "jadwal_layanan", "jadwal_terlewat", "prioritas_tinggi", "status_berubah", "preventive_maintenance"],
  user:     ["permintaan_baru", "jadwal_layanan", "status_berubah", "layanan_selesai", "laporan_tersedia", "ditolak_dibatalkan"],
}

const categoryLabelByKey: Record<NotificationCategoryKey, string> = {
  schedule: "Pemeliharaan Sarana",
  maintenance: "Pemeliharaan Sarana",
  borrowing: "Peminjaman",
  returns: "Pengembalian",
  usage: "Penggunaan Alat",
  disposal: "Penghapusan Aset",
  deletion: "Permintaan Arsip",
  asset: "Inventaris",
  system: "Sistem",
}

/** Label header kartu untuk tipe yang datang dari tabel `notifications`. */
const SERVER_TYPE_LABELS: Record<string, string> = {
  borrowing_approved: "✅ Peminjaman Disetujui",
  borrowing_rejected: "❌ Peminjaman Ditolak",
  maintenance_scheduled: "📅 Jadwal Layanan",
  maintenance_in_progress: "🔄 Status Berubah",
  maintenance_completed: "✅ Layanan Selesai",
  maintenance_validated: "📄 Laporan Tersedia",
  maintenance_cancelled: "❌ Ditolak/Dibatalkan",
  admin_broadcast: "📢 Pengumuman",
  sanction_applied: "⚠️ Sanksi Keterlambatan",
  sanction_resolved: "✅ Sanksi Selesai",
  sanction_waived: "✅ Sanksi Dibebaskan",
}

const SERVER_CATEGORY_FALLBACK_LABELS: Record<string, string> = {
  borrowing: "📦 Peminjaman",
  maintenance: "🛠️ Pemeliharaan",
  disposal: "🗑️ Penghapusan Aset",
  deletion: "🗂️ Permintaan Arsip",
  asset: "📦 Inventaris",
  system: "🔔 Pemberitahuan",
}

const resolveServerTypeLabel = (type: string, category: string): string => {
  if (SERVER_TYPE_LABELS[type]) return SERVER_TYPE_LABELS[type]
  // Pengingat memakai tipe bernomor (`maintenance_reminder_h3`), jadi dicocokkan
  // lewat awalan agar jumlah harinya tidak perlu didaftarkan satu per satu.
  if (type.startsWith("maintenance_reminder")) return "⏰ Pengingat Pemeliharaan"
  return SERVER_CATEGORY_FALLBACK_LABELS[category] ?? "🔔 Pemberitahuan"
}

const resolveServerNotifStatus = (type: string): NotificationStatus => {
  // Sanksi dicek lebih dulu: `sanction_applied` tidak tertangkap pola mana pun di
  // bawah, padahal justru kejadian yang paling perlu menonjol.
  if (type === "sanction_applied") return "warning"
  if (type.startsWith("sanction_")) return "success"
  if (/rejected|cancelled|blocked|locked|suspended|gagal/i.test(type)) return "warning"
  if (/approved|completed|validated|resolved|selesai/i.test(type)) return "success"
  if (/reminder|overdue|due|terlewat/i.test(type)) return "reminder"
  return "info"
}

const isKnownCategoryKey = (value: string): value is NotificationCategoryKey =>
  Object.prototype.hasOwnProperty.call(categoryLabelByKey, value)

const mapServerNotification = (notification: AppNotification): NotificationItem => ({
  // Prefiks mencegah bentrok id dengan pemberitahuan turunan yang memakai id teks.
  id: `server-${notification.id}`,
  serverId: notification.id,
  title: notification.title,
  subtitle: notification.createdAt ? formatDateId(notification.createdAt) : "Baru saja",
  description: notification.message,
  href: notification.link,
  category: isKnownCategoryKey(notification.category) ? notification.category : "system",
  type: notification.type,
  typeLabel: resolveServerTypeLabel(notification.type, notification.category),
  notifStatus: resolveServerNotifStatus(notification.type),
  imageUrl: toPublicPhotoUrl(notification.imagePath),
})

const sourceLabelBadgeClass = (sourceLabel: string): string => {
  if (sourceLabel === "Medis") return "border-blue-200 bg-blue-50 text-blue-700"
  if (sourceLabel === "Non-Medis") return "border-purple-200 bg-purple-50 text-purple-700"
  return "border-slate-300 bg-slate-50 text-slate-800"
}

const DISMISSED_NOTIFICATIONS_STORAGE_KEY = "dismissed-notifications"
const NOTIFICATION_FETCH_LIMIT = 1000
const SERVER_NOTIFICATION_LIMIT = 20
const BORROWING_NOTIFICATION_STATUSES = ["pending", "approved", "rejected", "borrowed", "overdue", "returned"] as const
const MAINTENANCE_NOTIFICATION_STATUSES = ["requested", "scheduled", "in_progress", "completed", "validated", "cancelled"] as const
const PRIORITY_KEYWORDS = ["prioritas tinggi", "urgent", "darurat", "cito", "segera"]

const buildDismissKey = (bucket: string, items: Array<{ id: number | string }>): string => {
  const ids = items.map((item) => String(item.id)).sort()
  return `${bucket}:${ids.join(",")}`
}

const getIdentityLabel = (name?: string, nip?: string) => {
  const safeName = name || "-"
  const safeNip = nip || "-"
  return `${safeName} / ${safeNip}`
}

const uniqueById = <T extends { id: number | string }>(items: T[]): T[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = String(item.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const hasHighPrioritySignal = (...values: Array<string | null | undefined>): boolean => {
  const text = values.filter(Boolean).join(" ").toLowerCase()
  return PRIORITY_KEYWORDS.some((keyword) => text.includes(keyword))
}

const loadDismissedNotificationKeys = (): Set<string> => {
  try {
    const raw = window.localStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

const saveDismissedNotificationKeys = (keys: Set<string>) => {
  window.localStorage.setItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(Array.from(keys)))
}

export default function Topbar() {
  // Teks marquee diambil dari pengaturan aplikasi supaya admin bisa mengubahnya
  // lewat halaman Pengaturan. Default dipakai selama fetch berjalan atau gagal.
  const [topbarAnnouncement, setTopbarAnnouncement] = useState(DEFAULT_TOPBAR_ANNOUNCEMENT)
  const [announcementStyle, setAnnouncementStyle] = useState<TopbarAnnouncementStyle>(DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE)
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const serverTimeOffsetMsRef = useRef(0)
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isCheckingNotifications, setIsCheckingNotifications] = useState(true)
  const dismissedNotificationKeysRef = useRef<Set<string>>(new Set())
  const [notificationQuery, setNotificationQuery] = useState("")
  const [notificationDensity, setNotificationDensity] = useState<"compact" | "normal">("compact")
  const [scanDialogOpen, setScanDialogOpen] = useState(false)
  const [scanChoice, setScanChoice] = useState<ScanChoice | null>(null)
  const isCompactNotification = notificationDensity === "compact"
  const announcementStyleClass = getAnnouncementStyleClass(announcementStyle)

  useEffect(() => {
    setMounted(true)
    dismissedNotificationKeysRef.current = loadDismissedNotificationKeys()
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadAnnouncement = async () => {
      // Sesi lokal (offline/dev) tidak punya backend untuk dihubungi, jadi cukup
      // pakai teks default seperti yang dilakukan pemuatan notifikasi.
      if (!getAuthToken() || isLocalAuthSession()) return

      try {
        const announcement = await appSettingService.getAnnouncement()
        if (!isMounted) return
        setTopbarAnnouncement(announcement.value)
        setAnnouncementStyle(announcement.style)
      } catch (error) {
        console.error("Gagal memuat teks pemberitahuan", error)
      }
    }

    void loadAnnouncement()

    const refreshListener = () => {
      void loadAnnouncement()
    }
    window.addEventListener(ANNOUNCEMENT_UPDATED_EVENT, refreshListener)
    window.addEventListener("auth-user-updated", refreshListener)

    return () => {
      isMounted = false
      window.removeEventListener(ANNOUNCEMENT_UPDATED_EVENT, refreshListener)
      window.removeEventListener("auth-user-updated", refreshListener)
    }
  }, [])

  const dismissNotification = (notification: NotificationItem) => {
    // Item server ditutup dengan menandainya sudah dibaca supaya keputusan itu
    // ikut terbawa ke perangkat lain, bukan tersimpan di localStorage.
    if (notification.serverId) {
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id))
      void notificationService.markAsRead(notification.serverId).catch((error) => {
        console.error("Gagal menandai notifikasi sudah dibaca", error)
      })
      return
    }

    if (!notification.dismissKey) return
    const next = new Set(dismissedNotificationKeysRef.current)
    next.add(notification.dismissKey)
    dismissedNotificationKeysRef.current = next
    saveDismissedNotificationKeys(next)
    setNotifications((prev) => prev.filter((item) => item.id !== notification.id))
  }

  useEffect(() => {
    let isMounted = true

    const getSyncedNow = () => new Date(Date.now() + serverTimeOffsetMsRef.current)

    const syncServerTime = async () => {
      const requestStartedAt = Date.now()

      try {
        const serverTime = await serverTimeService.getCurrentTime()
        const requestFinishedAt = Date.now()
        const serverUnixMs = Date.parse(serverTime.now)

        if (!Number.isFinite(serverUnixMs)) {
          return
        }

        const estimatedServerUnixMs = serverUnixMs + Math.round((requestFinishedAt - requestStartedAt) / 2)
        serverTimeOffsetMsRef.current = estimatedServerUnixMs - requestFinishedAt

        if (isMounted) {
          setNow(getSyncedNow())
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Gagal sinkronisasi waktu server:", error)
        }
      }
    }

    void syncServerTime()
    const tickId = window.setInterval(() => setNow(getSyncedNow()), 1000)
    const syncId = window.setInterval(() => void syncServerTime(), 60000)

    return () => {
      isMounted = false
      window.clearInterval(tickId)
      window.clearInterval(syncId)
    }
  }, [])

  useEffect(() => {
    const savedDensity = window.localStorage.getItem("notification-density")
    if (savedDensity === "compact" || savedDensity === "normal") {
      setNotificationDensity(savedDensity)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem("notification-density", notificationDensity)
  }, [notificationDensity])

  const handleBarcodeDetected = useCallback((rawValue: string) => {
    const parsed = parseScannedBarcode(rawValue)
    if (!parsed.query) {
      window.alert("Hasil scan kosong. Silakan coba lagi.")
      return
    }

    setScanChoice(parsed)
  }, [])

  const handleScanChooseBorrow = useCallback(() => {
    if (!scanChoice) return
    router.push(buildBorrowUrl(scanChoice))
    setScanChoice(null)
  }, [router, scanChoice])

  const handleScanChooseUsage = useCallback(() => {
    if (!scanChoice) return
    router.push(buildUsageUrl(scanChoice))
    setScanChoice(null)
  }, [router, scanChoice])

  const handleScanChooseMaintenance = useCallback(() => {
    if (!scanChoice) return
    router.push(buildMaintenanceUrl(scanChoice))
    setScanChoice(null)
  }, [router, scanChoice])

  const handleScanChooseDetail = useCallback(() => {
    if (!scanChoice) return
    router.push(buildDetailUrl(scanChoice))
    setScanChoice(null)
  }, [router, scanChoice])

  const dateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }, [])

  const compactDateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
      day: "numeric",
      month: "short",
    })
  }, [])

  const timeFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }, [])

  const formattedDate = mounted ? dateFormatter.format(now) : "Memuat tanggal…"
  const formattedCompactDate = mounted ? compactDateFormatter.format(now) : "Memuat…"
  const formattedTime = mounted ? timeFormatter.format(now) : "--:--:--"

  const filteredNotifications = useMemo(() => {
    const query = notificationQuery.trim().toLowerCase()
    if (!query) {
      return notifications
    }

    return notifications.filter((item) => {
      const searchable = [
        item.title,
        item.subtitle,
        item.description,
        item.assetName,
        item.assetCode,
        item.recordNoId,
        item.identity,
        item.sourceLabel,
        item.roomLabel,
        categoryLabelByKey[item.category],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [notificationQuery, notifications])

  useEffect(() => {
    let isMounted = true

    const loadNotifications = async () => {
      if (!getAuthToken()) {
        if (isMounted) {
          setNotifications([])
          setIsCheckingNotifications(false)
        }
        return
      }

      if (isLocalAuthSession()) {
        if (isMounted) {
          setNotifications([])
          setIsCheckingNotifications(false)
        }
        return
      }

      setIsCheckingNotifications(true)

      try {
        const currentUser = getCurrentUser()
        const userRole = normalizeUserRole(currentUser?.role)
        const allowedTypes = NOTIFICATION_TYPES_BY_ROLE[userRole] ?? NOTIFICATION_TYPES_BY_ROLE["user"]

        const shouldFetchMaintenance = userRole !== "user"
        const shouldFetchBorrowing = userRole !== "teknisi"
        const shouldFetchUsage = userRole !== "teknisi"

        const [maintenanceResponse, borrowingResponse, usageResponse, serverNotificationResponse] = await Promise.all([
          shouldFetchMaintenance
            ? Promise.all(
                MAINTENANCE_NOTIFICATION_STATUSES.map((status) =>
                  maintenanceService.getAll({ page: 1, limit: NOTIFICATION_FETCH_LIMIT, status }),
                ),
              ).then((responses) => ({
                data: uniqueById(responses.flatMap((response) => response.data || [])),
              }))
            : Promise.resolve({ data: [] as any[] }),
          shouldFetchBorrowing
            ? Promise.all(
                BORROWING_NOTIFICATION_STATUSES.map((status) =>
                  borrowingService.getAll({ page: 1, limit: NOTIFICATION_FETCH_LIMIT, status }),
                ),
              ).then((responses) => ({
                data: uniqueById(responses.flatMap((response) => response.data || [])),
              }))
            : Promise.resolve({ data: [] as any[] }),
          shouldFetchUsage ? assetUsageService.getAll({ page: 1, limit: NOTIFICATION_FETCH_LIMIT }) : Promise.resolve({ data: [] as any[] }),
          // Kegagalan di sini tidak boleh menjatuhkan seluruh isi lonceng, karena
          // pemberitahuan turunan tetap berguna walau endpoint ini tidak tersedia.
          notificationService
            .list({ unreadOnly: true, limit: SERVER_NOTIFICATION_LIMIT })
            .catch((error) => {
              console.error("Gagal memuat notifikasi tersimpan", error)
              return null
            }),
        ])

        if (!isMounted) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const overdueMaintenance = maintenanceResponse.data.filter((item) =>
          item.status === "scheduled" && item.scheduledDate && new Date(item.scheduledDate) < today,
        )
        const upcomingMaintenance = maintenanceResponse.data.filter((item) => {
          if (item.status !== "scheduled" || !item.scheduledDate) return false
          const daysUntil = Math.ceil((new Date(item.scheduledDate).getTime() - today.getTime()) / 86400000)
          return daysUntil >= 0 && daysUntil <= 7
        })
        const scheduledMaintenance = maintenanceResponse.data.filter((item) => item.status === "scheduled")
        const ongoingMaintenance = maintenanceResponse.data.filter((item) => item.status === "in_progress")
        const requestedMaintenance = maintenanceResponse.data.filter((item) => item.status === "requested")
        const assignedMaintenance = maintenanceResponse.data.filter((item) =>
          ["scheduled", "in_progress"].includes(item.status) && Boolean(item.technician?.trim()),
        )
        const completedMaintenance = maintenanceResponse.data.filter((item) => item.status === "completed")
        const validatedMaintenance = maintenanceResponse.data.filter((item) => item.status === "validated")
        const cancelledMaintenance = maintenanceResponse.data.filter((item) => item.status === "cancelled")
        const highPriorityMaintenance = maintenanceResponse.data.filter((item) =>
          !["validated", "cancelled"].includes(item.status) &&
          hasHighPrioritySignal(item.description, item.notes, item.cancellationReason, item.type),
        )
        const pendingBorrowings = borrowingResponse.data.filter((item) => item.status === "pending")
        const rejectedBorrowings = borrowingResponse.data.filter((item) => item.status === "rejected")
        const approvedBorrowings = borrowingResponse.data.filter((item) => item.status === "approved")
        const unreturnedBorrowings = borrowingResponse.data.filter((item) =>
          ["approved", "borrowed", "overdue"].includes(item.status),
        )
        const pendingReturns = borrowingResponse.data.filter(
          (item) => item.status === "returned" && !item.returnValidatedAt,
        )
        const validatedReturns = borrowingResponse.data.filter(
          (item) => item.status === "returned" && Boolean(item.returnValidatedAt),
        )
        const nextNotifications: NotificationItem[] = []

        // --- Permintaan Layanan Baru (maintenance requested) ---
        if (requestedMaintenance.length > 0) {
          const item = requestedMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(item.assetType, item.assetDetailCode || item.assetCode))
          const assetName = item.assetDetailName || item.assetName || "Aset pemeliharaan"
          const assetCode = item.assetDetailCode || item.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-requested",
            category: "maintenance",
            type: "permintaan_baru",
            notifStatus: "info",
            title: `${requestedMaintenance.length} permintaan pemeliharaan baru`,
            subtitle: `${maintenanceStatusLabel(item.status, item.type)} • ${formatDateId(item.scheduledDate)}`,
            description: item.description || "Permintaan layanan menunggu verifikasi.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("MNT", item.id, item.maintenanceCode),
            identity: getIdentityLabel(item.requesterName, item.requesterNip),
            sourceLabel,
            roomLabel: item.assetLocation || "-",
          })
        }

        // --- Jadwal Terlewat (overdue maintenance) ---
        if (overdueMaintenance.length > 0) {
          const item = overdueMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(item.assetType, item.assetDetailCode || item.assetCode))
          const assetName = item.assetDetailName || item.assetName || "Aset pemeliharaan"
          const assetCode = item.assetDetailCode || item.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-overdue",
            category: "schedule",
            type: "jadwal_terlewat",
            notifStatus: "warning",
            title: `${overdueMaintenance.length} jadwal pemeliharaan terlambat`,
            subtitle: `Terlambat • ${formatDateId(item.scheduledDate)}`,
            description: item.description || "Segera tindak lanjuti jadwal yang melewati batas waktu.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("JDW", item.id, item.maintenanceCode),
            identity: getIdentityLabel(item.requesterName, item.requesterNip),
            sourceLabel,
            roomLabel: item.assetLocation || "-",
          })
        }

        // --- Preventive Maintenance (jadwal dalam 7 hari) ---
        if (upcomingMaintenance.length > 0 && overdueMaintenance.length === 0) {
          const upcoming = upcomingMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(upcoming.assetType, upcoming.assetDetailCode || upcoming.assetCode))
          const assetName = upcoming.assetDetailName || upcoming.assetName || "Aset pemeliharaan"
          const assetCode = upcoming.assetDetailCode || upcoming.assetCode || "-"
          const daysUntil = Math.ceil((new Date(upcoming.scheduledDate).getTime() - today.getTime()) / 86400000)
          nextNotifications.push({
            id: "maintenance-upcoming",
            category: "schedule",
            type: "preventive_maintenance",
            notifStatus: "reminder",
            title: `${upcomingMaintenance.length} pemeliharaan jatuh tempo dalam ${daysUntil} hari`,
            subtitle: `Pengingat • ${formatDateId(upcoming.scheduledDate)}`,
            description: upcoming.description || "Persiapkan pelaksanaan pemeliharaan tepat waktu.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("JDW", upcoming.id, upcoming.maintenanceCode),
            identity: getIdentityLabel(upcoming.requesterName, upcoming.requesterNip),
            sourceLabel,
            roomLabel: upcoming.assetLocation || "-",
          })
        } else if (scheduledMaintenance.length > 0 && overdueMaintenance.length === 0) {
          // --- Jadwal Layanan (scheduled normal) ---
          const upcoming = scheduledMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(upcoming.assetType, upcoming.assetDetailCode || upcoming.assetCode))
          const assetName = upcoming.assetDetailName || upcoming.assetName || "Aset pemeliharaan"
          const assetCode = upcoming.assetDetailCode || upcoming.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-schedule",
            category: "schedule",
            type: "jadwal_layanan",
            notifStatus: "info",
            title: `${scheduledMaintenance.length} pemeliharaan sarana menunggu proses`,
            subtitle: `Jadwal • ${formatDateId(upcoming.scheduledDate)}`,
            description: upcoming.description || "Lihat pemeliharaan sarana untuk detail lengkap.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("JDW", upcoming.id, upcoming.maintenanceCode),
            identity: getIdentityLabel(upcoming.requesterName, upcoming.requesterNip),
            sourceLabel,
            roomLabel: upcoming.assetLocation || "-",
          })
        }

        // --- Teknisi Ditugaskan ---
        if (assignedMaintenance.length > 0) {
          const assigned = assignedMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(assigned.assetType, assigned.assetDetailCode || assigned.assetCode))
          const assetName = assigned.assetDetailName || assigned.assetName || "Aset pemeliharaan"
          const assetCode = assigned.assetDetailCode || assigned.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-assigned",
            category: "maintenance",
            type: "teknisi_ditugaskan",
            notifStatus: "info",
            title: `${assignedMaintenance.length} layanan memiliki penugasan teknisi`,
            subtitle: `${assigned.technician} • ${formatDateId(assigned.scheduledDate)}`,
            description: assigned.description || "Teknisi atau Staff PJ telah ditugaskan untuk layanan ini.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("MNT", assigned.id, assigned.maintenanceCode),
            identity: getIdentityLabel(assigned.requesterName, assigned.requesterNip),
            sourceLabel,
            roomLabel: assigned.assetLocation || "-",
          })
        }

        // --- Status Berubah (maintenance in_progress) ---
        if (ongoingMaintenance.length > 0) {
          const active = ongoingMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(active.assetType, active.assetDetailCode || active.assetCode))
          const assetName = active.assetDetailName || active.assetName || "Aset pemeliharaan"
          const assetCode = active.assetDetailCode || active.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-active",
            category: "maintenance",
            type: "status_berubah",
            notifStatus: "info",
            title: `${ongoingMaintenance.length} pemeliharaan sarana dalam proses`,
            subtitle: `${maintenanceStatusLabel(active.status, active.type)} • ${formatDateId(active.scheduledDate)}`,
            description: active.description || "Pastikan teknisi menyelesaikan kendala ini.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("JDW", active.id, active.maintenanceCode),
            identity: getIdentityLabel(active.requesterName, active.requesterNip),
            sourceLabel,
            roomLabel: active.assetLocation || "-",
          })
        }

        // --- Prioritas Tinggi ---
        if (highPriorityMaintenance.length > 0) {
          const urgent = highPriorityMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(urgent.assetType, urgent.assetDetailCode || urgent.assetCode))
          const assetName = urgent.assetDetailName || urgent.assetName || "Aset pemeliharaan"
          const assetCode = urgent.assetDetailCode || urgent.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-high-priority",
            category: "maintenance",
            type: "prioritas_tinggi",
            notifStatus: "urgent",
            title: `${highPriorityMaintenance.length} layanan prioritas tinggi`,
            subtitle: `${maintenanceStatusLabel(urgent.status, urgent.type)} • ${formatDateId(urgent.scheduledDate)}`,
            description: urgent.description || "Layanan memiliki tingkat urgensi tinggi.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("MNT", urgent.id, urgent.maintenanceCode),
            identity: getIdentityLabel(urgent.requesterName, urgent.requesterNip),
            sourceLabel,
            roomLabel: urgent.assetLocation || "-",
          })
        }

        // --- Layanan Selesai ---
        if (completedMaintenance.length > 0) {
          const completed = completedMaintenance[0]
          const dismissKey = buildDismissKey("maintenance-completed", completedMaintenance)
          if (!dismissedNotificationKeysRef.current.has(dismissKey)) {
            const sourceLabel = assetSourceLabel(deriveAssetSource(completed.assetType, completed.assetDetailCode || completed.assetCode))
            const assetName = completed.assetDetailName || completed.assetName || "Aset pemeliharaan"
            const assetCode = completed.assetDetailCode || completed.assetCode || "-"
            nextNotifications.push({
              id: "maintenance-completed",
              category: "maintenance",
              type: "layanan_selesai",
              notifStatus: "success",
              title: `${completedMaintenance.length} layanan selesai dan menunggu validasi`,
              subtitle: `${maintenanceStatusLabel(completed.status, completed.type)} • ${formatDateId(completed.completedDate || completed.scheduledDate)}`,
              description: completed.notes || completed.description || "Pekerjaan telah selesai dilaksanakan.",
              href: "/maintenance",
              assetName,
              assetCode,
              recordNoId: formatNoId("MNT", completed.id, completed.maintenanceCode),
              identity: getIdentityLabel(completed.validatorName || completed.requesterName, completed.validatorNip || completed.requesterNip),
              sourceLabel,
              roomLabel: completed.assetLocation || "-",
              dismissKey,
            })
          }
        }

        // --- Laporan Tersedia ---
        if (validatedMaintenance.length > 0) {
          const validated = validatedMaintenance[0]
          const dismissKey = buildDismissKey("maintenance-report", validatedMaintenance)
          if (!dismissedNotificationKeysRef.current.has(dismissKey)) {
            const sourceLabel = assetSourceLabel(deriveAssetSource(validated.assetType, validated.assetDetailCode || validated.assetCode))
            const assetName = validated.assetDetailName || validated.assetName || "Aset pemeliharaan"
            const assetCode = validated.assetDetailCode || validated.assetCode || "-"
            nextNotifications.push({
              id: "maintenance-report",
              category: "maintenance",
              type: "laporan_tersedia",
              notifStatus: "success",
              title: `${validatedMaintenance.length} laporan hasil layanan tersedia`,
              subtitle: `${maintenanceStatusLabel(validated.status, validated.type)} • ${formatDateId(validated.validatedAt || validated.completedDate || validated.scheduledDate)}`,
              description: validated.notes || "Laporan hasil layanan dapat dilihat melalui modul pemeliharaan.",
              href: "/reports",
              assetName,
              assetCode,
              recordNoId: formatNoId("MNT", validated.id, validated.maintenanceCode),
              identity: getIdentityLabel(validated.validatorName || validated.requesterName, validated.validatorNip || validated.requesterNip),
              sourceLabel,
              roomLabel: validated.assetLocation || "-",
              dismissKey,
            })
          }
        }

        // --- Layanan Ditolak/Dibatalkan ---
        if (cancelledMaintenance.length > 0) {
          const cancelled = cancelledMaintenance[0]
          const dismissKey = buildDismissKey("maintenance-cancelled", cancelledMaintenance)
          if (!dismissedNotificationKeysRef.current.has(dismissKey)) {
            const sourceLabel = assetSourceLabel(deriveAssetSource(cancelled.assetType, cancelled.assetDetailCode || cancelled.assetCode))
            const assetName = cancelled.assetDetailName || cancelled.assetName || "Aset pemeliharaan"
            const assetCode = cancelled.assetDetailCode || cancelled.assetCode || "-"
            nextNotifications.push({
              id: "maintenance-cancelled",
              category: "maintenance",
              type: "ditolak_dibatalkan",
              notifStatus: "warning",
              title: `${cancelledMaintenance.length} layanan ditolak atau dibatalkan`,
              subtitle: `${maintenanceStatusLabel(cancelled.status, cancelled.type)} • ${formatDateId(cancelled.updatedAt || cancelled.scheduledDate)}`,
              description: cancelled.cancellationReason || cancelled.description || "Permintaan layanan tidak dilanjutkan.",
              href: "/maintenance",
              assetName,
              assetCode,
              recordNoId: formatNoId("MNT", cancelled.id, cancelled.maintenanceCode),
              identity: getIdentityLabel(cancelled.requesterName, cancelled.requesterNip),
              sourceLabel,
              roomLabel: cancelled.assetLocation || "-",
              dismissKey,
            })
          }
        }

        // --- Permintaan Baru (borrowing pending) ---
        if (pendingBorrowings.length > 0) {
          const earliestPending = pendingBorrowings[0]
          const assetLabel = earliestPending.assetDetailName || earliestPending.assetName || "Aset peminjaman"
          const assetCode = earliestPending.assetDetailCode || earliestPending.assetCode || "-"
          const sourceLabel = assetSourceLabel(
            deriveAssetSource(earliestPending.assetType, earliestPending.assetDetailCode || earliestPending.assetCode),
          )
          const borrower = earliestPending.userName || earliestPending.userNip || "Peminjam"
          const borrowDateLabel = earliestPending.borrowDate
            ? `Tanggal pinjam: ${formatDateId(earliestPending.borrowDate)}`
            : "Tanggal pinjam belum dicatat"
          nextNotifications.push({
            id: "borrowing-pending",
            category: "borrowing",
            type: "permintaan_baru",
            notifStatus: "info",
            title: `${pendingBorrowings.length} peminjaman menunggu persetujuan`,
            subtitle: `${borrowingStatusLabel(earliestPending.status)} • ${borrowDateLabel}`,
            description: `${assetLabel} • ${earliestPending.purpose || borrower}`,
            href: "/borrowing",
            assetName: assetLabel,
            assetCode,
            recordNoId: formatNoId("PMJ", earliestPending.id, earliestPending.borrowingCode),
            identity: getIdentityLabel(earliestPending.userName, earliestPending.userNip),
            sourceLabel,
            roomLabel: earliestPending.assetLocation || earliestPending.purpose || "-",
          })
        }

        // --- Permintaan disetujui menjadi Jadwal Layanan ---
        if (approvedBorrowings.length > 0) {
          const approved = approvedBorrowings[0]
          const assetLabel = approved.assetDetailName || approved.assetName || "Aset peminjaman"
          const assetCode = approved.assetDetailCode || approved.assetCode || "-"
          const sourceLabel = assetSourceLabel(
            deriveAssetSource(approved.assetType, approved.assetDetailCode || approved.assetCode),
          )
          nextNotifications.push({
            id: "borrowing-approved",
            category: "borrowing",
            type: "jadwal_layanan",
            notifStatus: "info",
            title: `${approvedBorrowings.length} peminjaman telah disetujui`,
            subtitle: `${borrowingStatusLabel(approved.status)} • ${approved.dueDate ? `Batas kembali: ${formatDateId(approved.dueDate)}` : "Batas kembali belum ditentukan"}`,
            description: `${assetLabel} siap diproses sesuai jadwal layanan.`,
            href: "/borrowing",
            assetName: assetLabel,
            assetCode,
            recordNoId: formatNoId("PMJ", approved.id, approved.borrowingCode),
            identity: getIdentityLabel(approved.userName, approved.userNip),
            sourceLabel,
            roomLabel: approved.assetLocation || approved.purpose || "-",
          })
        }

        // --- Layanan Ditolak/Dibatalkan (borrowing rejected) ---
        if (rejectedBorrowings.length > 0) {
          const rejected = rejectedBorrowings[0]
          const dismissKey = buildDismissKey("borrowing-rejected", rejectedBorrowings)
          if (!dismissedNotificationKeysRef.current.has(dismissKey)) {
            const assetLabel = rejected.assetDetailName || rejected.assetName || "Aset peminjaman"
            const assetCode = rejected.assetDetailCode || rejected.assetCode || "-"
            const sourceLabel = assetSourceLabel(
              deriveAssetSource(rejected.assetType, rejected.assetDetailCode || rejected.assetCode),
            )
            nextNotifications.push({
              id: "borrowing-rejected",
              category: "borrowing",
              type: "ditolak_dibatalkan",
              notifStatus: "warning",
              title: `${rejectedBorrowings.length} permintaan peminjaman ditolak`,
              subtitle: `${borrowingStatusLabel(rejected.status)} • ${formatDateId(rejected.rejectedAt || rejected.updatedAt || rejected.borrowDate)}`,
              description: rejected.rejectionReason || "Permintaan peminjaman tidak disetujui.",
              href: "/borrowing",
              assetName: assetLabel,
              assetCode,
              recordNoId: formatNoId("PMJ", rejected.id, rejected.borrowingCode),
              identity: getIdentityLabel(rejected.userName, rejected.userNip),
              sourceLabel,
              roomLabel: rejected.assetLocation || rejected.purpose || "-",
              dismissKey,
            })
          }
        }

        // --- Status Berubah (pengembalian) ---
        if (pendingReturns.length > 0) {
          const latestReturn = pendingReturns[0]
          const assetLabel = latestReturn.assetDetailName || latestReturn.assetName || "Aset pengembalian"
          const assetCode = latestReturn.assetDetailCode || latestReturn.assetCode || "-"
          const sourceLabel = assetSourceLabel(
            deriveAssetSource(latestReturn.assetType, latestReturn.assetDetailCode || latestReturn.assetCode),
          )
          const borrower = latestReturn.userName || latestReturn.userNip || "Peminjam"
          const returnDateLabel = latestReturn.returnDate
            ? `Tanggal kembali: ${formatDateId(latestReturn.returnDate)}`
            : "Tanggal kembali belum dicatat"
          nextNotifications.push({
            id: "returns",
            category: "returns",
            type: "status_berubah",
            notifStatus: "reminder",
            title: `${pendingReturns.length} pengembalian belum divalidasi`,
            subtitle: `Proses validasi • ${returnDateLabel}`,
            description: `${assetLabel} • ${borrower}`,
            href: "/returns",
            assetName: assetLabel,
            assetCode,
            recordNoId: formatNoId("PGB", latestReturn.id, latestReturn.borrowingCode),
            identity: getIdentityLabel(latestReturn.userName, latestReturn.userNip),
            sourceLabel,
            roomLabel: latestReturn.assetLocation || latestReturn.purpose || "-",
          })
        } else if (unreturnedBorrowings.length > 0) {
          const focusBorrowing = unreturnedBorrowings[0]
          const assetLabel = focusBorrowing.assetDetailName || focusBorrowing.assetName || "Aset belum kembali"
          const assetCode = focusBorrowing.assetDetailCode || focusBorrowing.assetCode || "-"
          const sourceLabel = assetSourceLabel(
            deriveAssetSource(focusBorrowing.assetType, focusBorrowing.assetDetailCode || focusBorrowing.assetCode),
          )
          const dueLabel = focusBorrowing.dueDate
            ? `Tgl kembali: ${formatDateId(focusBorrowing.dueDate)}`
            : "Jadwal kembali belum ditentukan"
          const overdueCount = unreturnedBorrowings.filter((item) => item.status === "overdue").length
          const approvedCount = unreturnedBorrowings.filter((item) => item.status === "approved").length
          const borrowedCount = unreturnedBorrowings.filter((item) => item.status === "borrowed").length
          const descriptionParts: string[] = []
          if (approvedCount) descriptionParts.push(`${approvedCount} menunggu pengambilan`)
          if (borrowedCount) descriptionParts.push(`${borrowedCount} sedang dipinjam`)
          if (overdueCount) descriptionParts.push(`${overdueCount} belum dikembalikan`)
          nextNotifications.push({
            id: "borrowing-unreturned",
            category: "returns",
            type: overdueCount > 0 ? "jadwal_terlewat" : "status_berubah",
            notifStatus: overdueCount > 0 ? "warning" : "reminder",
            title: `${unreturnedBorrowings.length} alat belum dikembalikan`,
            subtitle: `${borrowingStatusLabel(focusBorrowing.status)} • ${dueLabel}`,
            description: descriptionParts.length > 0 ? descriptionParts.join(" · ") : assetLabel,
            href: "/borrowing",
            assetName: assetLabel,
            assetCode,
            recordNoId: formatNoId("PGB", focusBorrowing.id, focusBorrowing.borrowingCode),
            identity: getIdentityLabel(focusBorrowing.userName, focusBorrowing.userNip),
            sourceLabel,
            roomLabel: focusBorrowing.assetLocation || focusBorrowing.purpose || "-",
          })
        }

        // --- Laporan Tersedia dari pengembalian tervalidasi ---
        if (validatedReturns.length > 0) {
          const validatedReturn = validatedReturns[0]
          const dismissKey = buildDismissKey("return-report", validatedReturns)
          if (!dismissedNotificationKeysRef.current.has(dismissKey)) {
            const assetLabel = validatedReturn.assetDetailName || validatedReturn.assetName || "Aset pengembalian"
            const assetCode = validatedReturn.assetDetailCode || validatedReturn.assetCode || "-"
            const sourceLabel = assetSourceLabel(
              deriveAssetSource(validatedReturn.assetType, validatedReturn.assetDetailCode || validatedReturn.assetCode),
            )
            nextNotifications.push({
              id: "return-report",
              category: "returns",
              type: "laporan_tersedia",
              notifStatus: "success",
              title: `${validatedReturns.length} laporan pengembalian tersedia`,
              subtitle: `Tervalidasi • ${formatDateId(validatedReturn.returnValidatedAt || validatedReturn.returnDate)}`,
              description: validatedReturn.returnNotes || "Laporan hasil layanan dapat dilihat atau diunduh.",
              href: "/reports",
              assetName: assetLabel,
              assetCode,
              recordNoId: formatNoId("PGB", validatedReturn.id, validatedReturn.borrowingCode),
              identity: getIdentityLabel(validatedReturn.userName, validatedReturn.userNip),
              sourceLabel,
              roomLabel: validatedReturn.assetLocation || validatedReturn.purpose || "-",
              dismissKey,
            })
          }
        }

        // --- Status Berubah (penggunaan aktif) ---
        const activeUsages = (usageResponse.data || []).filter((item) => !item.endedAt)
        if (activeUsages.length > 0) {
          const latestUsage = activeUsages[0]
          const assetLabel = latestUsage.assetDetailName || latestUsage.assetName || "Aset penggunaan"
          const assetCode = latestUsage.assetDetailCode || latestUsage.assetCode || "-"
          const sourceLabel = assetSourceLabel(
            deriveAssetSource(latestUsage.assetType, latestUsage.assetDetailCode || latestUsage.assetCode),
          )
          const startedLabel = latestUsage.startedAt
            ? `Mulai: ${formatDateId(latestUsage.startedAt)}`
            : "Waktu mulai belum dicatat"
          nextNotifications.push({
            id: "asset-usage-active",
            category: "usage",
            type: "status_berubah",
            notifStatus: "info",
            title: `${activeUsages.length} alat sedang dalam penggunaan`,
            subtitle: `Penggunaan aktif • ${startedLabel}`,
            description: `${assetLabel} • ${latestUsage.operatorName || latestUsage.createdByName || "Operator"}`,
            href: "/asset-usage",
            assetName: assetLabel,
            assetCode,
            recordNoId: latestUsage.no || formatNoId("PG", latestUsage.id),
            identity: getIdentityLabel(latestUsage.operatorName || latestUsage.createdByName, latestUsage.operatorNip),
            sourceLabel,
            roomLabel: latestUsage.roomName || latestUsage.assetLocation || "-",
          })
        }

        // Filter notifikasi sesuai hak akses role. Hanya berlaku untuk item
        // turunan: item server sudah ditujukan ke satu `user_id` di backend, jadi
        // menyaringnya lagi di sini justru akan menyembunyikannya dari penerima.
        const filtered = nextNotifications.filter((n) => allowedTypes.includes(n.type as NotificationType))
        const serverNotifications = (serverNotificationResponse?.data?.data || []).map(mapServerNotification)

        // Item server didahulukan karena mewakili kejadian yang belum dibaca,
        // sedangkan item turunan adalah ringkasan keadaan yang selalu ada.
        setNotifications([...serverNotifications, ...filtered])
      } catch (error) {
        console.error("Gagal memuat notifikasi", error)
        if (isMounted) {
          setNotifications([])
        }
      } finally {
        if (isMounted) {
          setIsCheckingNotifications(false)
        }
      }
    }

    void loadNotifications()

    const intervalId = window.setInterval(() => {
      void loadNotifications()
    }, 45000)

    const refreshListener = () => {
      void loadNotifications()
    }
    window.addEventListener("notifications-refresh", refreshListener)
    window.addEventListener("auth-user-updated", refreshListener)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener("notifications-refresh", refreshListener)
      window.removeEventListener("auth-user-updated", refreshListener)
    }
  }, [])

  return (
    <header className="z-30 w-full min-w-0 shrink-0 bg-background/95 shadow-[0_1px_0_rgba(15,23,42,0.05)] backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="flex h-7 items-center overflow-hidden bg-muted/40 px-3 xl:px-6">
        <div className="overflow-hidden">
          <div className="animate-topbar-marquee flex w-max items-center text-sm font-semibold uppercase tracking-[0.16em] will-change-transform">
            {/* Warna dipasang per salinan teks, bukan di pembungkus, agar setiap
                salinan mendapat gradien penuh saat marquee bergulir. */}
            <span className={`shrink-0 pr-14 ${announcementStyleClass}`}>{topbarAnnouncement}</span>
            <span className={`shrink-0 pr-14 ${announcementStyleClass}`} aria-hidden="true">{topbarAnnouncement}</span>
          </div>
        </div>
      </div>
      <div className="flex min-h-16 min-w-0 items-start justify-between gap-3 pl-16 pr-3 py-3 sm:items-center sm:gap-4 sm:pl-20 sm:pr-4 md:pl-4 lg:px-6 xl:px-8">
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-sm font-bold sm:hidden">{formattedCompactDate}</p>
          <p className="hidden min-w-0 truncate text-[16px] font-bold sm:block">{formattedDate}</p>
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setScanDialogOpen(true)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            aria-label="Scan barcode"
            title="Scan barcode"
          >
            <ScanLine className="size-4.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label="Menu notifikasi"
            >
              <Bell className="size-4.5" />
              {notifications.length > 0 ? (
                <span className={`absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full border border-background ${
                  notifications.some((n) => n.notifStatus === "urgent") ? "bg-red-500" :
                  notifications.some((n) => n.notifStatus === "warning") ? "bg-orange-500" :
                  notifications.some((n) => n.notifStatus === "reminder") ? "bg-amber-400" :
                  "bg-blue-500"
                }`} />
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="max-h-[min(72vh,36rem)] w-[min(calc(100vw-1rem),22rem)] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200/80 bg-slate-50/95 p-1 text-slate-950 shadow-xl shadow-slate-900/15 backdrop-blur-sm sm:w-88">
              <div className="flex items-center justify-between gap-3 px-2 pt-1.5 pb-1">
                <div className="min-w-0">
                  <DropdownMenuLabel className="p-0 text-[13px] font-bold tracking-tight text-slate-900">
                    Pemberitahuan
                  </DropdownMenuLabel>
                  <p className="mt-0.5 text-[10px] leading-none text-slate-500">
                    {notifications.length > 0 ? `${notifications.length} informasi perlu diperhatikan` : "Tidak ada informasi terbaru"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setNotificationDensity(isCompactNotification ? "normal" : "compact")
                  }}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  aria-label={isCompactNotification ? "Tampilan notifikasi normal" : "Tampilan notifikasi ringkas"}
                >
                  {isCompactNotification ? "Normal" : "Ringkas"}
                </button>
              </div>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={notificationQuery}
                    onChange={(event) => setNotificationQuery(event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                    placeholder="Cari notifikasi..."
                    className="h-8 rounded-lg border-slate-200 bg-white pl-8 text-xs text-slate-900 shadow-xs placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:ring-blue-100"
                    aria-label="Cari pemberitahuan"
                  />
                </div>
              </div>
              <DropdownMenuSeparator className="mx-1 mb-1 bg-slate-200/80" />
              {isCheckingNotifications ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">Memeriksa kendala…</div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">Semua kendala telah terselesaikan.</div>
              ) : filteredNotifications.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-muted-foreground">
                  Tidak ada pemberitahuan yang cocok dengan pencarian.
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`${isCompactNotification ? "mt-1" : "mt-2"} block cursor-pointer rounded-lg p-0 focus-visible:outline-none data-highlighted:bg-transparent data-highlighted:text-current`}
                    onSelect={(event) => {
                      event.preventDefault()
                      if (notification.href) {
                        router.push(notification.href)
                      }
                    }}
                  >
                    <div className="group overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/10">
                      <div className={`${isCompactNotification ? "gap-1 px-2.5 py-1.5" : "gap-2 px-3.5 py-2.5"} flex items-center justify-between bg-linear-to-r ${statusConfig[notification.notifStatus].gradient} text-white`}>
                        <span className={`${isCompactNotification ? "text-[11px]" : "text-sm"} min-w-0 truncate font-bold tracking-tight`}>
                          {notification.typeLabel ?? notificationTypeLabel[notification.type as NotificationType]}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className={`${isCompactNotification ? "px-1.5 text-[8px]" : "px-2.5 text-[11px]"} max-w-28 truncate rounded-full border border-white/40 bg-white/15 py-0.5 font-semibold shadow-inner backdrop-blur-sm`}>
                            {categoryLabelByKey[notification.category]}
                          </span>
                          {notification.dismissKey || notification.serverId ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                dismissNotification(notification)
                              }}
                              className={`${isCompactNotification ? "h-4 w-4 text-xs" : "h-5 w-5"} flex items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white`}
                              aria-label="Tutup pemberitahuan"
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      </div>
                      <div className={`${isCompactNotification ? "px-2.5 py-2" : "px-3.5 py-3"} text-slate-900`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {/* Pemberitahuan tanpa konteks aset memakai judulnya sendiri
                                sebagai kepala kartu agar tidak ada baris kosong. */}
                            <p className={`${isCompactNotification ? "text-[13px]" : "text-base"} min-w-0 wrap-break-word leading-tight font-bold tracking-tight text-slate-950`}>
                              {notification.assetName || notification.title}
                            </p>
                            {notification.assetCode ? (
                              <p className={`${isCompactNotification ? "mt-0.5 text-[10px]" : "mt-1 text-xs"} min-w-0 break-all font-medium text-slate-500`}>{notification.assetCode}</p>
                            ) : null}
                          </div>
                          <span className={`${isCompactNotification ? "h-2 w-2 ring-2" : "h-2.5 w-2.5 ring-4"} mt-0.5 shrink-0 rounded-full ${statusConfig[notification.notifStatus].dot} ring-slate-100`} aria-hidden="true" />
                        </div>

                        {notification.recordNoId || notification.identity ? (
                          <div className={`${isCompactNotification ? "mt-1.5 grid-cols-2 gap-1" : "mt-2.5 gap-2"} grid`}>
                            {notification.recordNoId ? (
                              <div className={`${isCompactNotification ? "gap-1.5 rounded-md px-2 py-1" : "gap-2 rounded-lg px-2.5 py-1.5"} flex min-w-0 items-start bg-slate-50`}>
                                <Hash className={`${isCompactNotification ? "size-3" : "size-3.5"} mt-0.5 shrink-0 text-slate-400`} />
                                <div className="min-w-0">
                                  <p className={`${isCompactNotification ? "text-[7px]" : "text-[9px]"} font-bold tracking-[0.12em] text-slate-400 uppercase`}>Nomor ID</p>
                                  <p className={`${isCompactNotification ? "text-[9px] leading-tight" : "text-xs"} break-all font-semibold text-slate-700`}>{notification.recordNoId}</p>
                                </div>
                              </div>
                            ) : null}
                            {notification.identity ? (
                              <div className={`${isCompactNotification ? "gap-1.5 rounded-md px-2 py-1" : "gap-2 rounded-lg px-2.5 py-1.5"} flex min-w-0 items-start bg-slate-50`}>
                                <UserRound className={`${isCompactNotification ? "size-3" : "size-3.5"} mt-0.5 shrink-0 text-slate-400`} />
                                <div className="min-w-0">
                                  <p className={`${isCompactNotification ? "text-[7px]" : "text-[9px]"} font-bold tracking-[0.12em] text-slate-400 uppercase`}>Identitas</p>
                                  <p className={`${isCompactNotification ? "text-[9px] leading-tight" : "text-xs"} wrap-break-word font-semibold text-slate-700`}>{notification.identity}</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {notification.sourceLabel || notification.roomLabel ? (
                          <div className={`${isCompactNotification ? "pt-1.5" : "pt-2.5"}`}>
                            <div className="flex flex-wrap gap-1.5">
                              {notification.sourceLabel ? (
                                <span className={`${isCompactNotification ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-xs"} min-w-0 max-w-full wrap-break-word rounded-full border font-semibold ${sourceLabelBadgeClass(notification.sourceLabel)}`}>
                                  {notification.sourceLabel}
                                </span>
                              ) : null}
                              {notification.roomLabel ? (
                                <span className={`${isCompactNotification ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-1 text-xs"} min-w-0 max-w-full wrap-break-word rounded-full border font-semibold ${locationBadgeClass}`}>
                                  <Building2 className="mr-1 inline size-3 text-current" />
                                  {notification.roomLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className={`${isCompactNotification ? "mt-1.5 rounded-md px-2 py-1.5" : "mt-3 rounded-lg px-3 py-2.5"} border border-slate-100 bg-linear-to-br from-white to-slate-50 text-slate-600`}>
                          {notification.assetName ? (
                            <p className={`${isCompactNotification ? "text-[10px]" : "text-xs"} font-semibold leading-snug text-slate-700`}>{notification.title}</p>
                          ) : null}
                          <p className={`${isCompactNotification ? "text-[9px]" : "text-[11px]"} ${notification.assetName ? (isCompactNotification ? "mt-0.5" : "mt-1") : ""} leading-snug text-slate-500`}>{notification.subtitle}</p>
                          {/* Pada kartu tanpa aset, pesan inilah isi utamanya, jadi tetap
                              ditampilkan walau tampilan sedang ringkas. */}
                          {(!isCompactNotification || !notification.assetName) && notification.description ? (
                            <p className={`${isCompactNotification ? "mt-1 text-[10px]" : "mt-1.5 text-xs"} leading-relaxed text-slate-600`}>{notification.description}</p>
                          ) : null}
                        </div>

                        {/* Gambar dibatasi tingginya karena panel lonceng sempit;
                            klik membuka berkas aslinya di tab baru. */}
                        {notification.imageUrl ? (
                          <a
                            href={notification.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="mt-2 block overflow-hidden rounded-lg border border-slate-200"
                          >
                            <img
                              src={notification.imageUrl}
                              alt={`Gambar pemberitahuan: ${notification.title}`}
                              className={`${isCompactNotification ? "max-h-24" : "max-h-40"} w-full object-cover`}
                              loading="lazy"
                            />
                          </a>
                        ) : null}

                        {!isCompactNotification ? (
                          <div className="mt-2.5 flex items-center justify-end gap-1 text-[11px] font-bold text-blue-600 transition group-hover:text-blue-700">
                            Lihat detail
                            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <span className="font-mono tabular-nums text-base font-semibold tracking-widest text-foreground sm:text-[18px] sm:tracking-[0.14em]">
              {formattedTime}
            </span>
            <span className="text-[11px] text-muted-foreground sm:text-xs">WIB</span>
          </div>
        </div>
      </div>

      <BarcodeScannerDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        onDetected={handleBarcodeDetected}
      />

      <AlertDialog open={Boolean(scanChoice)} onOpenChange={(open) => !open && setScanChoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aset terdeteksi</AlertDialogTitle>
            <AlertDialogDescription>
              Pilih tindakan yang ingin dilakukan untuk aset hasil scan ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction onClick={handleScanChooseBorrow} className="w-full bg-teal-600 hover:bg-teal-700">
              Pinjam
            </AlertDialogAction>
            <AlertDialogAction onClick={handleScanChooseUsage} className="w-full bg-blue-600 hover:bg-blue-700">
              Gunakan
            </AlertDialogAction>
            <AlertDialogAction onClick={handleScanChooseMaintenance} className="w-full bg-amber-600 hover:bg-amber-700">
              Pemeliharaan
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleScanChooseDetail}
              className="w-full border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Lihat Detail
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">Batal</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  )
}
