"use client"

import { Bell, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { borrowingService } from "@/services/borrowing.service"
import { maintenanceService } from "@/services/maintenance.service"
import {
    assetSourceLabel,
    borrowingStatusLabel,
    deriveAssetSource,
    maintenanceStatusLabel,
} from "@/utils/api-mappers"
import { formatDateId } from "@/utils/format"
import { formatNoId } from "@/utils/record-id"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { getAuthToken } from "@/services/auth-utils"

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
  schedule: "Jadwal Pemeliharaan",
  maintenance: "Pemeliharaan",
  borrowing: "Peminjaman Alat",
  returns: "Pengembalian Alat",
}

const getIdentityLabel = (name?: string, nip?: string) => {
  const safeName = name || "-"
  const safeNip = nip || "-"
  return `${safeName} / ${safeNip}`
}

export default function Topbar() {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isCheckingNotifications, setIsCheckingNotifications] = useState(true)
  const [notificationQuery, setNotificationQuery] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const dateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
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
            title: `${scheduledMaintenance.length} jadwal pemeliharaan tertunda`,
            subtitle: `Jadwal • ${formatDateId(upcoming.scheduledDate)}`,
            description: upcoming.description || "Lihat jadwal pemeliharaan untuk detail lengkap.",
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
            title: `${ongoingMaintenance.length} pemeliharaan dalam proses`,
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
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex items-center justify-between gap-4 py-3 pr-4 pl-16 lg:px-6">
        <p className="min-w-0 truncate font-bold" style={{ fontSize: 16 }}>{formattedDate}</p>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              aria-label="Menu notifikasi"
            >
              <Bell className="size-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full border border-background bg-red-500" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-[26rem] max-h-[72vh] overflow-y-auto rounded-2xl border border-border/70 bg-white text-slate-950 shadow-lg">
              <DropdownMenuLabel className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                Pemberitahuan
              </DropdownMenuLabel>
              <div className="px-3 pb-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={notificationQuery}
                    onChange={(event) => setNotificationQuery(event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                    placeholder="Cari notifikasi..."
                    className="h-8 border-slate-200 bg-white pl-8 text-[12px] text-slate-900 placeholder:text-slate-400"
                    aria-label="Cari pemberitahuan"
                  />
                </div>
              </div>
              <DropdownMenuSeparator />
              {isCheckingNotifications ? (
                <div className="px-4 py-3 text-[12px] text-muted-foreground">Memeriksa kendala…</div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-muted-foreground">Semua kendala telah terselesaikan.</div>
              ) : filteredNotifications.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-muted-foreground">
                  Tidak ada pemberitahuan yang cocok dengan pencarian.
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="mt-2 block cursor-pointer rounded-2xl p-0 focus-visible:outline-none data-[highlighted]:bg-transparent data-[highlighted]:text-current"
                    onSelect={(event) => {
                      event.preventDefault()
                      if (notification.href) {
                        router.push(notification.href)
                      }
                    }}
                  >
                    <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition hover:shadow-md">
                      <div className="flex items-center justify-between gap-3 bg-linear-to-r from-blue-700 to-blue-500 px-4 py-2.5 text-white">
                        <span className="text-[13px] font-semibold">Informasi Dasar Alat</span>
                        <span className="rounded-full border border-white/50 bg-white/15 px-2 py-0.5 text-[10px] font-medium">
                          {categoryLabelByKey[notification.category]}
                        </span>
                      </div>
                      <div className="space-y-1 px-4 py-3.5 text-slate-900">
                        <p className="text-[15px] leading-snug">{notification.assetName}</p>
                        <p className="text-[14px] text-slate-700">{notification.assetCode}</p>
                        <p className="text-[14px] text-slate-700">No ID: {notification.recordNoId}</p>
                        <p className="text-[14px] text-slate-700">Identitas: {notification.identity}</p>
                        <div className="pt-2">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-[13px] text-slate-800">
                              {notification.sourceLabel}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-[13px] text-slate-800">
                              {notification.roomLabel}
                            </span>
                          </div>
                        </div>
                        <div className="pt-1 text-[11px] text-slate-500">
                          <p>{notification.title}</p>
                          <p>{notification.subtitle}</p>
                          {notification.description ? <p>{notification.description}</p> : null}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-sm font-semibold tracking-[0.18em] text-foreground">
              {formattedTime}
            </span>
            <span className="text-xs text-muted-foreground">WIB</span>
          </div>
        </div>
      </div>
    </header>
  )
}
