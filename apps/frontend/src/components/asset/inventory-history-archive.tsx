"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { assetUsageService, type AssetUsageLog } from "@/services/asset-usage.service"
import { borrowingService, type Borrowing } from "@/services/borrowing.service"
import { matchesSearchKeyword } from "@/utils/search-keyword"
import { ChevronLeft, ChevronRight, ClipboardList, Eye, HandHelping, RotateCcw, Search } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

type HistoryKind = "usage" | "borrowing"

const ROWS_PER_PAGE = 15

const formatDateTime = (value?: string | null) => {
  if (!value) return "-"
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

const usageStatus = (record: AssetUsageLog) => record.endedAt ? "Selesai" : "Sedang digunakan"

const borrowingStatusLabels: Record<string, string> = {
  pending: "Menunggu persetujuan",
  approved: "Disetujui",
  borrowed: "Dipinjam",
  returned: "Dikembalikan",
  overdue: "Terlambat",
  rejected: "Ditolak",
}

const sameDetail = (
  record: { assetDetailId?: string; assetDetailCode?: string },
  detailId: string,
  detailCode: string,
) => {
  if (!detailId && !detailCode) return true
  const normalizedId = String(record.assetDetailId ?? "").trim().toLowerCase()
  const normalizedCode = String(record.assetDetailCode ?? "").trim().toLowerCase()
  return Boolean(
    (detailId && normalizedId === detailId.trim().toLowerCase())
    || (detailCode && normalizedCode === detailCode.trim().toLowerCase()),
  )
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] dark:border-slate-800/60">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="break-words text-sm text-slate-900 dark:text-slate-100">{value === undefined || value === null || value === "" ? "-" : value}</p>
    </div>
  )
}

export function InventoryHistoryArchive() {
  const [kind, setKind] = useState<HistoryKind>("usage")
  const [usageRecords, setUsageRecords] = useState<AssetUsageLog[]>([])
  const [borrowingRecords, setBorrowingRecords] = useState<Borrowing[]>([])
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [assetId, setAssetId] = useState("")
  const [assetType, setAssetType] = useState<"medical" | "non_medical" | "">("")
  const [detailId, setDetailId] = useState("")
  const [detailCode, setDetailCode] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedUsage, setSelectedUsage] = useState<AssetUsageLog | null>(null)
  const [selectedBorrowing, setSelectedBorrowing] = useState<Borrowing | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setAssetId(params.get("assetId") ?? "")
    setDetailId(params.get("detailId") ?? "")
    setDetailCode(params.get("detailCode") ?? "")
    const requestedType = params.get("assetType")
    if (requestedType === "medical" || requestedType === "non_medical") setAssetType(requestedType)
  }, [])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")
    try {
      if (kind === "usage") {
        const response = await assetUsageService.getAllPages({
          assetId: assetId || undefined,
          assetType: assetType || undefined,
          dateFrom: startDate || undefined,
          dateTo: endDate || undefined,
        })
        if (!response.success) throw new Error(response.message)
        setUsageRecords(response.data)
      } else {
        const response = await borrowingService.getAll({
          page: 1,
          limit: 500,
          assetId: assetId || undefined,
          assetType: assetType || undefined,
        })
        if (!response.success) throw new Error(response.message)
        setBorrowingRecords(response.data)
      }
    } catch (error) {
      console.error("Failed to load inventory history:", error)
      setErrorMessage("Gagal memuat riwayat inventaris. Periksa koneksi lalu coba lagi.")
    } finally {
      setLoading(false)
    }
  }, [assetId, assetType, endDate, kind, startDate])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  const filteredUsage = useMemo(() => usageRecords.filter((record) =>
    sameDetail(record, detailId, detailCode)
    && matchesSearchKeyword(search, [
      record.no,
      record.assetName,
      record.assetCode,
      record.assetDetailName,
      record.assetDetailCode,
      record.operatorName,
      record.operatorNip,
      record.roomName,
      record.notes,
      usageStatus(record),
    ]),
  ), [detailCode, detailId, search, usageRecords])

  const filteredBorrowing = useMemo(() => borrowingRecords.filter((record) => {
    const recordDate = new Date(record.borrowDate)
    const afterStart = !startDate || recordDate >= new Date(`${startDate}T00:00:00`)
    const beforeEnd = !endDate || recordDate <= new Date(`${endDate}T23:59:59`)
    return afterStart && beforeEnd
      && sameDetail(record, detailId, detailCode)
      && matchesSearchKeyword(search, [
        record.borrowingCode,
        record.assetName,
        record.assetCode,
        record.assetDetailName,
        record.assetDetailCode,
        record.userName,
        record.userNip,
        record.ownerName,
        record.ownerNip,
        record.destinationRoom,
        record.purpose,
        borrowingStatusLabels[record.status],
      ])
  }), [borrowingRecords, detailCode, detailId, endDate, search, startDate])

  const records = kind === "usage" ? filteredUsage : filteredBorrowing
  const totalPages = Math.max(1, Math.ceil(records.length / ROWS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const visibleUsage = filteredUsage.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)
  const visibleBorrowing = filteredBorrowing.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)

  useEffect(() => setPage(1), [kind, search, startDate, endDate, detailId, detailCode])

  const resetFilters = () => {
    setSearch("")
    setStartDate("")
    setEndDate("")
    setAssetId("")
    setAssetType("")
    setDetailId("")
    setDetailCode("")
    setPage(1)
    window.history.replaceState({}, "", "/activity-archive?section=inventory-history")
  }

  const focusedAssetLabel = detailCode || detailId

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800/35 dark:bg-slate-900/60">
        <Button
          type="button"
          variant="ghost"
          className={kind === "usage" ? "bg-teal-600 text-white hover:bg-teal-700 hover:text-white" : "hover:bg-teal-50 hover:text-teal-800 dark:hover:bg-teal-400/10"}
          onClick={() => setKind("usage")}
        >
          <ClipboardList className="mr-2 size-4" /> Riwayat Penggunaan
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={kind === "borrowing" ? "bg-teal-600 text-white hover:bg-teal-700 hover:text-white" : "hover:bg-teal-50 hover:text-teal-800 dark:hover:bg-teal-400/10"}
          onClick={() => setKind("borrowing")}
        >
          <HandHelping className="mr-2 size-4" /> Riwayat Peminjaman
        </Button>
      </div>

      {focusedAssetLabel ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-200">
          Menampilkan riwayat khusus detail inventaris <strong>{focusedAssetLabel}</strong>.
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800/35 dark:bg-slate-900/60">
        <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto] lg:items-end">
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Cari alat, No ID, nama atau NIP</span>
            <span className="relative block">
              <Search className="absolute left-3 top-3 size-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 dark:border-slate-800/35 dark:bg-slate-900/60" placeholder="Masukkan kata kunci" />
            </span>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Tanggal mulai</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800/35 dark:bg-slate-900/60" />
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Tanggal akhir</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800/35 dark:bg-slate-900/60" />
          </label>
          <Button type="button" variant="outline" onClick={resetFilters}><RotateCcw className="mr-2 size-4" /> Reset</Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/35 dark:bg-slate-900/60">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800/35">
          <p className="text-sm font-semibold">{kind === "usage" ? "Data riwayat penggunaan" : "Data riwayat peminjaman"}</p>
          <p className="text-xs text-muted-foreground">{records.length} riwayat ditemukan</p>
        </div>
        {errorMessage ? <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div> : null}
        <div className="overflow-x-auto">
          {kind === "usage" ? (
            <table className="min-w-220 table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/40"><tr><th className="w-52 px-4 py-3">Waktu</th><th className="w-72 px-4 py-3">Detail inventaris</th><th className="w-60 px-4 py-3">Pengguna</th><th className="w-48 px-4 py-3">Sumber & status</th><th className="w-32 px-4 py-3 text-center">Tindakan</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/35">
                {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Memuat riwayat penggunaan...</td></tr> : visibleUsage.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Belum ada riwayat penggunaan pada filter ini.</td></tr> : visibleUsage.map((record) => (
                  <tr key={record.id} className="align-top"><td className="px-4 py-3"><p>{formatDateTime(record.startedAt)}</p><p className="text-xs text-muted-foreground">s.d. {formatDateTime(record.endedAt)}</p></td><td className="px-4 py-3"><p className="font-medium">{record.assetDetailName || record.assetName || "-"}</p><p className="text-xs text-muted-foreground">{record.assetDetailCode || record.assetCode || record.no || "-"}</p></td><td className="px-4 py-3"><p>{record.operatorName || "-"}</p><p className="text-xs text-muted-foreground">NIP: {record.operatorNip || "-"}</p></td><td className="px-4 py-3"><p>{record.sourceType === "borrowing_sync" ? "Peminjaman" : "Manual"}</p><p className="text-xs font-medium text-teal-700">{usageStatus(record)}</p></td><td className="px-4 py-3 text-center"><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedUsage(record)}><Eye className="mr-1.5 size-4" /> Detail</Button></td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-220 table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/40"><tr><th className="w-52 px-4 py-3">Waktu</th><th className="w-72 px-4 py-3">Detail inventaris</th><th className="w-60 px-4 py-3">Peminjam</th><th className="w-48 px-4 py-3">Status</th><th className="w-32 px-4 py-3 text-center">Tindakan</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/35">
                {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Memuat riwayat peminjaman...</td></tr> : visibleBorrowing.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Belum ada riwayat peminjaman pada filter ini.</td></tr> : visibleBorrowing.map((record) => (
                  <tr key={record.id} className="align-top"><td className="px-4 py-3"><p>{formatDateTime(record.borrowDate)}</p><p className="text-xs text-muted-foreground">Jatuh tempo: {formatDateTime(record.dueDate)}</p></td><td className="px-4 py-3"><p className="font-medium">{record.assetDetailName || record.assetName || "-"}</p><p className="text-xs text-muted-foreground">{record.assetDetailCode || record.assetCode || record.borrowingCode || "-"}</p></td><td className="px-4 py-3"><p>{record.ownerName || record.userName || "-"}</p><p className="text-xs text-muted-foreground">NIP: {record.ownerNip || record.userNip || "-"}</p></td><td className="px-4 py-3 font-medium text-teal-700">{borrowingStatusLabels[record.status] || record.status}</td><td className="px-4 py-3 text-center"><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedBorrowing(record)}><Eye className="mr-1.5 size-4" /> Detail</Button></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800/35">
          <p className="text-xs text-muted-foreground">Halaman {currentPage} dari {totalPages}</p>
          <div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="mr-1 size-4" /> Sebelumnya</Button><Button variant="outline" size="sm" disabled={currentPage >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Berikutnya <ChevronRight className="ml-1 size-4" /></Button></div>
        </div>
      </div>

      <Dialog open={Boolean(selectedUsage)} onOpenChange={(open) => { if (!open) setSelectedUsage(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Riwayat Penggunaan</DialogTitle>
            <DialogDescription>Informasi lengkap penggunaan alat tanpa memenuhi tabel arsip.</DialogDescription>
          </DialogHeader>
          {selectedUsage ? (
            <div className="rounded-lg border border-slate-200 px-4 dark:border-slate-800">
              <DetailRow label="Nama alat" value={selectedUsage.assetDetailName || selectedUsage.assetName} />
              <DetailRow label="No ID / kode" value={selectedUsage.assetDetailCode || selectedUsage.assetCode || selectedUsage.no} />
              <DetailRow label="Pengguna" value={selectedUsage.operatorName} />
              <DetailRow label="NIP" value={selectedUsage.operatorNip} />
              <DetailRow label="Waktu mulai" value={formatDateTime(selectedUsage.startedAt)} />
              <DetailRow label="Waktu selesai" value={formatDateTime(selectedUsage.endedAt)} />
              <DetailRow label="Jumlah penggunaan" value={selectedUsage.usageCount || 1} />
              <DetailRow label="Lokasi / tujuan" value={selectedUsage.roomName || selectedUsage.assetLocation} />
              <DetailRow label="Sumber" value={selectedUsage.sourceType === "borrowing_sync" ? "Peminjaman" : "Manual"} />
              <DetailRow label="Status" value={usageStatus(selectedUsage)} />
              <DetailRow label="Kondisi sebelum" value={selectedUsage.conditionBefore} />
              <DetailRow label="Kondisi sesudah" value={selectedUsage.conditionAfter} />
              <DetailRow label="Catatan" value={selectedUsage.notes} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedBorrowing)} onOpenChange={(open) => { if (!open) setSelectedBorrowing(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Riwayat Peminjaman</DialogTitle>
            <DialogDescription>Informasi lengkap peminjaman alat tanpa memenuhi tabel arsip.</DialogDescription>
          </DialogHeader>
          {selectedBorrowing ? (
            <div className="rounded-lg border border-slate-200 px-4 dark:border-slate-800">
              <DetailRow label="No peminjaman" value={selectedBorrowing.borrowingCode} />
              <DetailRow label="Nama alat" value={selectedBorrowing.assetDetailName || selectedBorrowing.assetName} />
              <DetailRow label="No ID / kode" value={selectedBorrowing.assetDetailCode || selectedBorrowing.assetCode} />
              <DetailRow label="Peminjam" value={selectedBorrowing.ownerName || selectedBorrowing.userName} />
              <DetailRow label="NIP" value={selectedBorrowing.ownerNip || selectedBorrowing.userNip} />
              <DetailRow label="Unit kerja" value={selectedBorrowing.ownerWorkUnit || selectedBorrowing.borrowerWorkUnit} />
              <DetailRow label="Tanggal pinjam" value={formatDateTime(selectedBorrowing.borrowDate)} />
              <DetailRow label="Jatuh tempo" value={formatDateTime(selectedBorrowing.dueDate)} />
              <DetailRow label="Tanggal kembali" value={formatDateTime(selectedBorrowing.returnDate)} />
              <DetailRow label="Jumlah" value={selectedBorrowing.quantity || 1} />
              <DetailRow label="Ruangan tujuan" value={selectedBorrowing.destinationRoom} />
              <DetailRow label="Keperluan" value={selectedBorrowing.purpose} />
              <DetailRow label="Status" value={borrowingStatusLabels[selectedBorrowing.status] || selectedBorrowing.status} />
              <DetailRow label="Kondisi pengembalian" value={selectedBorrowing.returnCondition} />
              <DetailRow label="Catatan" value={selectedBorrowing.returnNotes || selectedBorrowing.notes} />
              <DetailRow label="Validator pengembalian" value={selectedBorrowing.returnValidatorName} />
              <DetailRow label="Waktu validasi" value={formatDateTime(selectedBorrowing.returnValidatedAt)} />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
