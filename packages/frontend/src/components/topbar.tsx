"use client"

import { Bell, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import {
    assetSourceLabel,
    borrowingStatusLabel,
    deriveAssetSource,
    maintenanceStatusLabel,
} from "@/utils/api-mappers";
import { formatDateId } from "@/utils/format";
import { formatNoId } from "@/utils/record-id";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getAuthToken, isLocalAuthSession } from "@/services/auth-utils";

type NotificationItem = {
  id: string
  title: string
  subtitle: string
  description?: string
  href?: string
  category: "schedule" | "maintenance" | "borrowing" | "returns"
  assetName: string
  assetCode: string
  recordNoId: string
  identity: string
  sourceLabel: string
  roomLabel: string
}

const categoryLabelByKey: Record<NotificationItem["category"], string> = {
  schedule: "Pemeliharaan Sarana",
  maintenance: "Pemeliharaan Sarana",
  borrowing: "Peminjaman",
  returns: "Pengembalian",
}

const getIdentityLabel = (name?: string, nip?: string) => {
  const safeName = name || "-"
  const safeNip = nip || "-"
  return `${safeName} / ${safeNip}`
}

export default function Topbar() {
  const topbarAnnouncement =
    "Selamat datang di Sistem Informasi Manajemen Sarana dan Prasarana. Periksa pemberitahuan secara berkala agar informasi penting tidak terlewat."
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isCheckingNotifications, setIsCheckingNotifications] = useState(true)
  const [notificationQuery, setNotificationQuery] = useState("")
  const [notificationDensity, setNotificationDensity] = useState<"compact" | "normal">("compact")
  const isCompactNotification = notificationDensity === "compact"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
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
        const [maintenanceResponse, borrowingResponse] = await Promise.all([
          maintenanceService.getAll({ page: 1, limit: 20 }),
          borrowingService.getAll({ page: 1, limit: 20 }),
        ])

        if (!isMounted) return

        const scheduledMaintenance = maintenanceResponse.data.filter((item) => item.status === "scheduled")
        const ongoingMaintenance = maintenanceResponse.data.filter((item) => item.status === "in_progress")
        const pendingBorrowings = borrowingResponse.data.filter((item) => item.status === "pending")
        // Track borrowings that are still out so the reminder disappears once status updates to anything except approved/borrowed/overdue.
        const unreturnedBorrowings = borrowingResponse.data.filter((item) =>
          ["approved", "borrowed", "overdue"].includes(item.status),
        )
        const pendingReturns = borrowingResponse.data.filter(
          (item) => item.status === "returned" && !item.returnValidatedAt,
        )
        const nextNotifications: NotificationItem[] = []

        if (scheduledMaintenance.length > 0) {
          const upcoming = scheduledMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(upcoming.assetType, upcoming.assetDetailCode || upcoming.assetCode))
          const assetName = upcoming.assetDetailName || upcoming.assetName || "Aset pemeliharaan"
          const assetCode = upcoming.assetDetailCode || upcoming.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-schedule",
            category: "schedule",
            title: `${scheduledMaintenance.length} pemelirahaan sarana menunggu proses`,
            subtitle: `Jadwal • ${formatDateId(upcoming.scheduledDate)}`,
            description: upcoming.description || "Lihat pemelirahaan sarana untuk detail lengkap.",
            href: "/maintenance",
            assetName,
            assetCode,
            recordNoId: formatNoId("JDW", upcoming.id, upcoming.maintenanceCode),
            identity: getIdentityLabel(upcoming.requesterName, upcoming.requesterNip),
            sourceLabel,
            roomLabel: upcoming.assetLocation || "-",
          })
        }
        if (ongoingMaintenance.length > 0) {
          const active = ongoingMaintenance[0]
          const sourceLabel = assetSourceLabel(deriveAssetSource(active.assetType, active.assetDetailCode || active.assetCode))
          const assetName = active.assetDetailName || active.assetName || "Aset pemeliharaan"
          const assetCode = active.assetDetailCode || active.assetCode || "-"
          nextNotifications.push({
            id: "maintenance-active",
            category: "maintenance",
            title: `${ongoingMaintenance.length} pemelirahaan sarana dalam proses`,
            subtitle: `${maintenanceStatusLabel(active.status)} • ${formatDateId(active.scheduledDate)}`,
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
          const description = `${assetLabel} • ${earliestPending.purpose || borrower}`
          nextNotifications.push({
            id: "borrowing-pending",
            category: "borrowing",
            title: `${pendingBorrowings.length} peminjaman menunggu persetujuan`,
            subtitle: `${borrowingStatusLabel(earliestPending.status)} • ${borrowDateLabel}`,
            description,
            href: "/borrowing",
            assetName: assetLabel,
            assetCode,
            recordNoId: formatNoId("PMJ", earliestPending.id, earliestPending.borrowingCode),
            identity: getIdentityLabel(earliestPending.userName, earliestPending.userNip),
            sourceLabel,
            roomLabel: earliestPending.assetLocation || earliestPending.purpose || "-",
          })
        }

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
          const borrower = focusBorrowing.userName || focusBorrowing.userNip || "Peminjam"
          const dueLabel = focusBorrowing.dueDate
            ? `Tgl kembali: ${formatDateId(focusBorrowing.dueDate)}`
            : "Jadwal kembali belum ditentukan"
          const approvedCount = unreturnedBorrowings.filter((item) => item.status === "approved").length
          const borrowedCount = unreturnedBorrowings.filter((item) => item.status === "borrowed").length
          const overdueCount = unreturnedBorrowings.filter((item) => item.status === "overdue").length
          const descriptionParts: string[] = []
          if (approvedCount) descriptionParts.push(`${approvedCount} menunggu pengambilan`)
          if (borrowedCount) descriptionParts.push(`${borrowedCount} sedang dipinjam`)
          if (overdueCount) descriptionParts.push(`${overdueCount} belum dikembalikan`)
          const description = descriptionParts.length > 0 ? descriptionParts.join(" · ") : `${assetLabel} • ${borrower}`
          nextNotifications.push({
            id: "borrowing-unreturned",
            category: "returns",
            title: `${unreturnedBorrowings.length} alat belum dikembalikan`,
            subtitle: `${borrowingStatusLabel(focusBorrowing.status)} • ${dueLabel}`,
            description,
            href: "/borrowing",
            assetName: assetLabel,
            assetCode,
            recordNoId: formatNoId("PGB", focusBorrowing.id, focusBorrowing.borrowingCode),
            identity: getIdentityLabel(focusBorrowing.userName, focusBorrowing.userNip),
            sourceLabel,
            roomLabel: focusBorrowing.assetLocation || focusBorrowing.purpose || "-",
          })
        }

        setNotifications(nextNotifications)
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
    <header className="z-30 w-full min-w-0 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="border-b border-border/70 bg-muted/40 px-3 py-1 xl:px-6">
        <div className="overflow-hidden">
          <div className="animate-topbar-marquee flex w-max items-center text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground will-change-transform">
            <span className="shrink-0 pr-14">{topbarAnnouncement}</span>
            <span className="shrink-0 pr-14" aria-hidden="true">{topbarAnnouncement}</span>
          </div>
        </div>
      </div>
      <div className="flex min-w-0 items-start justify-between gap-3 pl-16 pr-3 py-3 sm:items-center sm:gap-4 sm:pl-20 sm:pr-4 lg:pr-6 xl:px-8">
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-base font-bold sm:hidden">{formattedCompactDate}</p>
          <p className="hidden min-w-0 truncate font-bold sm:block" style={{ fontSize: 18 }}>{formattedDate}</p>
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:h-10 sm:w-10 md:h-11 md:w-11"
              aria-label="Menu notifikasi"
            >
              <Bell className="size-5 sm:size-5 md:size-6" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 rounded-full border border-background bg-red-500 sm:h-3 sm:w-3" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="max-h-[min(62vh,30rem)] w-[min(calc(100vw-1rem),20rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-border/70 bg-white text-slate-950 shadow-lg sm:w-84">
              <div className="flex items-center justify-between gap-2 px-2.5 pt-1 pb-0.5">
                <DropdownMenuLabel className="p-0 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                  Pemberitahuan
                </DropdownMenuLabel>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setNotificationDensity(isCompactNotification ? "normal" : "compact")
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-900 shadow-sm transition"
                  aria-label={isCompactNotification ? "Tampilan notifikasi normal" : "Tampilan notifikasi ringkas"}
                >
                  {isCompactNotification ? "Normal" : "Ringkas"}
                </button>
              </div>
              <div className="px-2.5 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={notificationQuery}
                    onChange={(event) => setNotificationQuery(event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                    placeholder="Cari notifikasi..."
                    className="h-8 border-slate-200 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400"
                    aria-label="Cari pemberitahuan"
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
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
                    className={`${isCompactNotification ? "mt-1" : "mt-1.5"} block cursor-pointer rounded-lg p-0 focus-visible:outline-none data-highlighted:bg-transparent data-highlighted:text-current`}
                    onSelect={(event) => {
                      event.preventDefault()
                      if (notification.href) {
                        router.push(notification.href)
                      }
                    }}
                  >
                    <div className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm transition hover:shadow-md">
                      <div className={`${isCompactNotification ? "gap-1.5 px-2.5 py-1.5" : "gap-2 px-3 py-2"} flex items-center justify-between bg-linear-to-r from-blue-700 to-blue-500 text-white`}>
                        <span className={`${isCompactNotification ? "text-xs" : "text-sm"} font-semibold`}>Informasi Dasar Alat</span>
                        <span className={`${isCompactNotification ? "px-2 text-[9px]" : "px-2.5 text-xs"} rounded-full border border-white/50 bg-white/15 py-0.5 font-medium`}>
                          {categoryLabelByKey[notification.category]}
                        </span>
                      </div>
                      <div className={`${isCompactNotification ? "space-y-0 px-2.5 py-2" : "space-y-0.5 px-3 py-2.5"} text-slate-900`}>
                        <p className={`${isCompactNotification ? "text-sm" : "text-[15px]"} min-w-0 wrap-break-word leading-snug font-semibold`}>{notification.assetName}</p>
                        <p className={`${isCompactNotification ? "text-xs" : "text-sm"} min-w-0 break-all text-slate-700`}>{notification.assetCode}</p>
                        <p className={`${isCompactNotification ? "text-xs" : "text-sm"} min-w-0 break-all text-slate-700`}>No ID: {notification.recordNoId}</p>
                        <p className={`${isCompactNotification ? "text-xs" : "text-sm"} min-w-0 wrap-break-word text-slate-700`}>Identitas: {notification.identity}</p>
                        <div className={`${isCompactNotification ? "pt-1" : "pt-1.5"}`}>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`${isCompactNotification ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-sm"} min-w-0 max-w-full wrap-break-word rounded-full border border-slate-300 bg-slate-50 text-slate-800`}>
                              {notification.sourceLabel}
                            </span>
                            <span className={`${isCompactNotification ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-sm"} min-w-0 max-w-full wrap-break-word rounded-full border border-slate-300 bg-slate-50 text-slate-800`}>
                              {notification.roomLabel}
                            </span>
                          </div>
                        </div>
                        <div className={`${isCompactNotification ? "pt-0.5 text-xs" : "pt-1 text-sm"} text-slate-500`}>
                          <p>{notification.title}</p>
                          <p>{notification.subtitle}</p>
                          {!isCompactNotification && notification.description ? <p>{notification.description}</p> : null}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <span className="font-mono tabular-nums text-base font-semibold tracking-[0.14em] text-foreground sm:text-lg sm:tracking-[0.18em]">
              {formattedTime}
            </span>
            <span className="text-xs text-muted-foreground sm:text-sm">WIB</span>
          </div>
        </div>
      </div>
    </header>
  )
}
