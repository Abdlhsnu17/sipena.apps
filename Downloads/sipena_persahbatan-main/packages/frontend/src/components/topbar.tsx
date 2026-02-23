"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import { borrowingService } from "@/services/borrowing.service"
import { maintenanceService } from "@/services/maintenance.service"
import { formatDateId } from "@/utils/format"
import { borrowingStatusLabel, maintenanceStatusLabel } from "@/utils/api-mappers"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type NotificationItem = {
  id: string
  title: string
  subtitle: string
  description?: string
  href?: string
  category: "schedule" | "maintenance" | "borrowing" | "returns"
}

export default function Topbar() {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isCheckingNotifications, setIsCheckingNotifications] = useState(true)

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

  useEffect(() => {
    let isMounted = true

    const loadNotifications = async () => {
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
          nextNotifications.push({
            id: "maintenance-schedule",
            category: "schedule",
            title: `${scheduledMaintenance.length} jadwal pemeliharaan tertunda`,
            subtitle: `Jadwal • ${formatDateId(upcoming.scheduledDate)}`,
            description: upcoming.description || "Lihat jadwal pemeliharaan untuk detail lengkap.",
            href: "/maintenance",
          })
        }
        if (ongoingMaintenance.length > 0) {
          const active = ongoingMaintenance[0]
          nextNotifications.push({
            id: "maintenance-active",
            category: "maintenance",
            title: `${ongoingMaintenance.length} pemeliharaan dalam proses`,
            subtitle: `${maintenanceStatusLabel(active.status)} • ${formatDateId(active.scheduledDate)}`,
            description: active.description || "Pastikan teknisi menyelesaikan kendala ini.",
            href: "/maintenance",
          })
        }

        if (pendingBorrowings.length > 0) {
          const earliestPending = pendingBorrowings[0]
          const assetLabel = earliestPending.assetDetailName || earliestPending.assetName || "Aset peminjaman"
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
          })
        }

        if (unreturnedBorrowings.length > 0) {
          const focusBorrowing = unreturnedBorrowings[0]
          const assetLabel = focusBorrowing.assetDetailName || focusBorrowing.assetName || "Aset belum kembali"
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
          })
        }

        if (pendingReturns.length > 0) {
          const latestReturn = pendingReturns[0]
          const assetLabel = latestReturn.assetDetailName || latestReturn.assetName || "Aset pengembalian"
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

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener("notifications-refresh", refreshListener)
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
            <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-2xl border border-border/70 bg-white text-slate-950 shadow-lg">
              <DropdownMenuLabel className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                Pemberitahuan
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isCheckingNotifications ? (
                <div className="px-4 py-3 text-[11px] text-muted-foreground">Memeriksa kendala…</div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-3 text-[11px] text-muted-foreground">Semua kendala telah terselesaikan.</div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="gap-1 rounded-lg border border-border/60 bg-white px-4 py-3 text-slate-900 shadow-sm focus-visible:bg-white focus-visible:text-slate-900 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900 dark:data-[highlighted]:bg-slate-900 dark:data-[highlighted]:text-white active:bg-slate-100"
                    onSelect={(event) => {
                      event.preventDefault()
                      if (notification.href) {
                        router.push(notification.href)
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-950">{notification.title}</span>
                      <span className="text-[11px] text-slate-600">{notification.subtitle}</span>
                    </div>
                    <span className="text-[11px] text-slate-600">
                      {notification.description}
                    </span>
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
