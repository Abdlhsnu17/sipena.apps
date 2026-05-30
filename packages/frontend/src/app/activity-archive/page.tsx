"use client"

import { Button } from "@/components/ui/button";
import authService, { type User as AuthUser } from "@/services/auth.service";
import userActivityService, { type UserActivity } from "@/services/user-activity.service";
import userService, { type User } from "@/services/user.service";
import { getFeatureLabel } from "@/utils/feature-presentation";
import { isAdminOrLeaderRole } from "@/utils/role";
import { Archive, ChevronLeft, ChevronRight, Clock3, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const ACTIVITY_CODE_PATTERN = /\b([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/

const normalizeActivityValue = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")

const getMetadataTextValue = (metadata: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!metadata) return null
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

const getCodeLikeIdentifier = (value: unknown) => {
  if (typeof value !== "string") return null
  const matchedCode = value.trim().match(ACTIVITY_CODE_PATTERN)
  return matchedCode?.[1] ?? null
}

const getActivityCode = (activity: UserActivity) => {
  const metadata = activity.metadata ?? {}
  for (const key of ["recordNoId", "record_no_id", "transactionCode", "transaction_code", "borrowingCode", "borrowing_code", "maintenanceCode", "maintenance_code"]) {
    const code = getCodeLikeIdentifier((metadata as Record<string, unknown>)[key])
    if (code) return code
  }
  return getCodeLikeIdentifier(activity.description)
}

const getActivityItemName = (activity: UserActivity) =>
  getMetadataTextValue(activity.metadata as Record<string, unknown> | null | undefined, [
    "recordItemName",
    "record_item_name",
    "assetName",
    "asset_name",
    "itemName",
    "item_name",
  ])

const getActivityItemCode = (activity: UserActivity) =>
  getMetadataTextValue(activity.metadata as Record<string, unknown> | null | undefined, [
    "recordItemCode",
    "record_item_code",
    "assetCode",
    "asset_code",
    "itemCode",
    "item_code",
  ])

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatActivityAction = (activity: UserActivity) => {
  const feature = normalizeActivityValue(activity.feature)
  const action = normalizeActivityValue(activity.action)

  if (feature === "peminjaman alat" && action === "create") return "Membuat peminjaman alat"
  if (feature === "peminjaman alat" && action === "approve") return "Menyetujui peminjaman"
  if (feature === "peminjaman alat" && action === "reject") return "Menolak peminjaman"
  if (feature === "pengembalian alat" && action === "return") return "Mengembalikan alat"
  if (feature === "pengembalian alat" && action === "validate") return "Memvalidasi pengembalian"
  if (feature === "jadwal pemeliharaan" && action === "create") return "Membuat jadwal pemeliharaan"
  if (feature === "jadwal pemeliharaan" && action === "status update") return "Memperbarui status jadwal"
  if (feature === "pemeliharaan" && action === "complete") return "Menyelesaikan pemeliharaan"
  if (feature === "unggahan" && action === "upload") return "Mengunggah file"
  if (feature === "unggahan" && action === "delete") return "Menghapus unggahan"

  return activity.description
}

export default function ActivityArchivePage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [activities, setActivities] = useState<UserActivity[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const canViewOthers = isAdminOrLeaderRole(currentUser?.role)

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser())
  }, [])

  useEffect(() => {
    if (!canViewOthers) return
    const loadUsers = async () => {
      try {
        const response = await userService.getAll({ page: 1, limit: 500 })
        if (response.success && Array.isArray(response.data)) {
          setUsers(response.data)
        }
      } catch (error) {
        console.error("Failed to load users:", error)
      }
    }
    void loadUsers()
  }, [canViewOthers])

  const loadActivities = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedUserId) params.userId = selectedUserId
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      const response = await userActivityService.getActivities(params)
      if (response.success) {
        setActivities(response.data)
        setTotal(response.pagination?.total ?? response.data.length)
        setTotalPages(Math.max(1, response.pagination?.totalPages ?? 1))
      } else {
        setErrorMessage(response.message || "Gagal memuat arsip aktivitas.")
      }
    } catch (error) {
      console.error("Failed to load activity archive:", error)
      setErrorMessage("Gagal memuat arsip aktivitas. Periksa koneksi lalu coba lagi.")
    } finally {
      setLoading(false)
    }
  }, [endDate, page, selectedUserId, startDate])

  useEffect(() => {
    void loadActivities()
  }, [loadActivities])

  const selectedUserLabel = useMemo(() => {
    if (!canViewOthers) return currentUser?.name ?? "Akun sendiri"
    if (!selectedUserId) return "Semua user"
    return users.find((user) => String(user.id) === selectedUserId)?.name ?? "User terpilih"
  }, [canViewOthers, currentUser?.name, selectedUserId, users])

  const resolveActivityUser = useCallback(
    (activity: UserActivity) => {
      if (activity.userName) {
        return activity.userName
      }

      const matchedUser = users.find((user) => String(user.id) === String(activity.userId))
      if (matchedUser?.name) {
        return matchedUser.name
      }

      if (currentUser && String(currentUser.id) === String(activity.userId)) {
        return currentUser.name ?? "Pengguna aktif"
      }

      return "-"
    },
    [currentUser, users],
  )

  const resetFilters = () => {
    setSelectedUserId("")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
        <div className="flex items-start gap-3 sm:items-center sm:gap-5">
          <div className="rounded-lg bg-linear-to-br from-slate-500 to-slate-700 p-2">
            <Archive className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Arsip aktivitas</p>
            <h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">Arsip Riwayat Aktivitas</h1>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          {canViewOthers ? (
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>User</span>
              <select
                value={selectedUserId}
                onChange={(event) => {
                  setSelectedUserId(event.target.value)
                  setPage(1)
                }}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400"
              >
                <option value="">Semua user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.nip}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium text-slate-500">User</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{selectedUserLabel}</p>
            </div>
          )}

          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Tanggal mulai</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value)
                setPage(1)
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400"
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-slate-600">
            <span>Tanggal akhir</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value)
                setPage(1)
              }}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400"
            />
          </label>

          <Button type="button" variant="outline" onClick={resetFilters}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Data arsip</p>
            <p className="text-xs text-muted-foreground">{selectedUserLabel} - {total} aktivitas</p>
          </div>
          <Archive className="size-5 text-teal-600" />
        </div>

        {errorMessage ? (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{errorMessage}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadActivities()}>
              Coba lagi
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Waktu</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Fitur</th>
                <th className="px-4 py-3 font-semibold">Aktivitas</th>
                <th className="px-4 py-3 font-semibold">Referensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Memuat arsip aktivitas...</td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada aktivitas pada filter ini.</td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="size-4 text-slate-400" />
                        {formatDateTime(activity.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{resolveActivityUser(activity)}</p>
                      <p className="text-xs text-muted-foreground">{activity.userNip ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-teal-700">{getFeatureLabel(activity.feature)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatActivityAction(activity)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {getActivityItemName(activity) ? <p>Nama Alat: {getActivityItemName(activity)}</p> : null}
                      {getActivityItemCode(activity) ? <p>Kode Barang: {getActivityItemCode(activity)}</p> : null}
                      {getActivityCode(activity) ? <p>No ID: {getActivityCode(activity)}</p> : null}
                      {!getActivityItemName(activity) && !getActivityItemCode(activity) && !getActivityCode(activity) ? "-" : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-muted-foreground">Halaman {page} dari {totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="mr-1 size-4" />
              Sebelumnya
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>
              Berikutnya
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
