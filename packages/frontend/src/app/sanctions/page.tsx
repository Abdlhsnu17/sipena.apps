"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SummaryResultBody, SummaryResultCard, SummaryResultFooter } from "@/components/summary-result-card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import sanctionsService, { type SanctionRecord, type SanctionStats } from "@/services/sanctions.service"
import type { User } from "@/types/auth-types"
import { assetSourceBadgeClass, deriveAssetSource } from "@/utils/api-mappers"
import { formatDayTimeLabel } from "@/utils/format"
import { canManageSanctionsRole } from "@/utils/role"
import { Activity, AlertCircle, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, Search, Shield, Users, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

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

const sanctionStatusLabel: Record<string, string> = {
  active: "Aktif",
  resolved: "Selesai",
  none: "-",
}

const sanctionStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "destructive",
  resolved: "default",
  none: "outline",
}

export default function SanctionsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<SanctionRecord[]>([])
  const [stats, setStats] = useState<SanctionStats | null>(null)
  const [activeTab, setActiveTab] = useState<"active" | "resolved" | "all">("active")
  const [search, setSearch] = useState("")
  const [totalCount, setTotalCount] = useState(0)
  const [isSanctionsListMinimized, setIsSanctionsListMinimized] = useState(false)
  const [selectedSanctionIds, setSelectedSanctionIds] = useState<Set<number>>(() => new Set())
  const [expandedSanctionIds, setExpandedSanctionIds] = useState<Set<number>>(() => new Set())
  const [sanctionsPage, setSanctionsPage] = useState(1)

  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; record: SanctionRecord | null; mode: "resolve" | "waive" }>({
    open: false,
    record: null,
    mode: "resolve",
  })
  const [resolveNotes, setResolveNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.replace(buildLoginRedirectUrl())
      return
    }
    if (!canManageSanctionsRole(currentUser.role)) {
      router.replace("/")
      return
    }
    setUser(currentUser)
  }, [router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        sanctionsService.getAll({ status: activeTab }),
        sanctionsService.getStats(),
      ])
      if (listRes.success) {
        setRecords(listRes.data.data)
        setTotalCount(listRes.data.total)
      }
      if (statsRes.success) {
        setStats(statsRes.data)
      }
    } catch {
      toast({ title: "Gagal memuat data sanksi", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeTab, toast])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  const filteredRecords = useMemo(() => records.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.userName?.toLowerCase().includes(q) ||
      r.userNip?.toLowerCase().includes(q) ||
      r.assetName?.toLowerCase().includes(q) ||
      r.borrowingCode?.toLowerCase().includes(q)
    )
  }), [records, search])

  useEffect(() => {
    setSanctionsPage(1)
  }, [activeTab, records.length, search])

  const totalSanctionsPages = Math.max(1, Math.ceil(filteredRecords.length / CARD_ROWS_PER_PAGE))
  const currentSanctionsPage = Math.min(sanctionsPage, totalSanctionsPages)
  const sanctionsStartIndex = (currentSanctionsPage - 1) * CARD_ROWS_PER_PAGE
  const paginatedRecords = filteredRecords.slice(sanctionsStartIndex, sanctionsStartIndex + CARD_ROWS_PER_PAGE)
  const visibleSanctionsPages = buildVisiblePageItems(currentSanctionsPage, totalSanctionsPages)
  const selectedSanctionRows = filteredRecords.filter((record) => selectedSanctionIds.has(record.id))
  const allSanctionsSelected =
    filteredRecords.length > 0 && filteredRecords.every((record) => selectedSanctionIds.has(record.id))

  const goToSanctionsPage = (page: number) => {
    setSanctionsPage(Math.min(totalSanctionsPages, Math.max(1, page)))
  }

  const handleSelectAllSanctions = () => {
    if (allSanctionsSelected) {
      setSelectedSanctionIds(new Set())
      return
    }
    setSelectedSanctionIds(new Set(filteredRecords.map((record) => record.id)))
  }

  const toggleSanctionSelection = (id: number) => {
    setSelectedSanctionIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleCardCollapse = (id: number) => {
    setExpandedSanctionIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const openResolve = (record: SanctionRecord, mode: "resolve" | "waive") => {
    setResolveNotes("")
    setResolveDialog({ open: true, record, mode })
  }

  const handleSubmitResolve = async () => {
    if (!resolveDialog.record) return
    if (resolveDialog.mode === "waive" && !resolveNotes.trim()) {
      toast({ title: "Alasan pembebasan wajib diisi", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res =
        resolveDialog.mode === "resolve"
          ? await sanctionsService.resolve(resolveDialog.record.id, resolveNotes || undefined)
          : await sanctionsService.waive(resolveDialog.record.id, resolveNotes)
      if (res.success) {
        toast({ title: resolveDialog.mode === "resolve" ? "Sanksi diselesaikan" : "Sanksi dibebaskan" })
        setResolveDialog({ open: false, record: null, mode: "resolve" })
        loadData()
      } else {
        toast({ title: res.message || "Gagal memproses sanksi", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi kesalahan", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <main
      className="min-h-full min-w-0"
      style={{ fontFamily: "Arial, sans-serif", fontSize: "14px" }}
    >
      <div>
        <div className="w-full space-y-5">
      <section className="rounded-3xl border border-teal-100/80 bg-white/90 panel-gutter shadow-2xl backdrop-blur-sm dark:border-teal-800/60 dark:bg-slate-900/70">
        <div className="flex items-start gap-3 sm:items-center sm:gap-5">
          <div className="rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-foreground">Manajemen Sanksi</h1>
          </div>
        </div>
      </section>

      {stats && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700/35 dark:bg-slate-900/70">
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 p-3 dark:bg-amber-950/30">
                <div>
                  <p className="text-[12px] text-muted-foreground">Total Sanksi</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.active + stats.resolved}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Semua riwayat sanksi</p>
                </div>
                <Activity className="h-4 w-4 shrink-0 text-amber-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 p-3 dark:bg-teal-950/30">
                <div>
                  <p className="text-[12px] text-muted-foreground">Sanksi Selesai</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.resolved}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">Sudah diselesaikan</p>
                </div>
                <Check className="h-4 w-4 shrink-0 text-teal-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-rose-50/70 p-3 dark:bg-rose-950/30">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted-foreground">Sanksi Aktif</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.active}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {stats.active > 0 ? "Perlu tindak lanjut" : "Tidak ada sanksi aktif"}
                  </p>
                </div>
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-cyan-50/50 p-3 dark:bg-cyan-950/30">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted-foreground">Pengguna Terdampak</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.totalAffectedUsers}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {stats.totalAffectedUsers > 0 ? "Pengguna dengan sanksi aktif" : "Tidak ada pengguna terdampak"}
                  </p>
                </div>
                <Users className="h-4 w-4 shrink-0 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border border-slate-200 bg-white/70 shadow-xl dark:border-slate-700/35 dark:bg-slate-900/70">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "resolved" | "all")}>
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Daftar Manajemen Sanksi</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Total: {filteredRecords.length} data sanksi
                </CardDescription>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSanctionsListMinimized((prev) => !prev)}
                  className="w-full rounded-2xl px-3 sm:w-auto"
                >
                  {isSanctionsListMinimized ? (
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
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua sanksi"
                    className="h-4 w-4 accent-blue-600"
                    checked={allSanctionsSelected}
                    onChange={handleSelectAllSanctions}
                  />
                  Pilih semua
                </label>
                <span className="text-[12px] text-muted-foreground sm:text-right sm:text-[13px]">
                  {selectedSanctionRows.length
                    ? `${selectedSanctionRows.length} baris dipilih`
                    : `Semua ${filteredRecords.length} baris`}
                </span>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <label className="sr-only">Cari sanksi</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cari No ID, aset, nama, atau NIP..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                  />
                </div>
              </div>
              <TabsList className="w-full overflow-x-auto justify-start">
                <TabsTrigger value="active" className="shrink-0">Aktif</TabsTrigger>
                <TabsTrigger value="resolved" className="shrink-0">Selesai</TabsTrigger>
                <TabsTrigger value="all" className="shrink-0">Semua</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {(["active", "resolved", "all"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="m-0">
                {isSanctionsListMinimized ? (
                  <div className="mx-3 rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 text-center text-sm text-teal-900 sm:mx-4 lg:mx-6 dark:border-teal-400/20 dark:bg-teal-400/5 dark:text-teal-200">
                    Section manajemen sanksi disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
                  </div>
                ) : loading ? (
                  <div className="px-3 py-10 text-center text-muted-foreground sm:px-4 lg:px-6">Memuat data...</div>
                ) : filteredRecords.length === 0 ? (
                  <div className="px-3 py-10 text-center text-muted-foreground sm:px-4 lg:px-6">
                    {search ? "Tidak ada hasil pencarian." : "Tidak ada data sanksi."}
                  </div>
                ) : (
                  <div className="space-y-3 px-3 sm:px-4 lg:px-6">
                    {paginatedRecords.map((record) => {
                      const isExpanded = expandedSanctionIds.has(record.id)
                      const dueDateLabel = record.dueDate ? formatDayTimeLabel(record.dueDate, { showWeekday: true }) : "-"
                      const borrowDateLabel = record.borrowDate ? formatDayTimeLabel(record.borrowDate, { showWeekday: true }) : "-"
                      const appliedDateLabel = record.sanctionAppliedAt ? formatDayTimeLabel(record.sanctionAppliedAt, { showWeekday: true }) : "-"
                      const resolvedDateLabel = record.resolvedAt ? formatDayTimeLabel(record.resolvedAt, { showWeekday: true }) : "-"

                      return (
                        <SummaryResultCard
                          key={record.id}
                          title="Informasi Dasar Sanksi"
                          footer={(
                            <SummaryResultFooter
                              selected={selectedSanctionIds.has(record.id)}
                              onSelectedChange={() => toggleSanctionSelection(record.id)}
                              selectionLabel={`Pilih sanksi ${record.assetName || record.borrowingCode || record.id}`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                onClick={() => toggleCardCollapse(record.id)}
                                title={isExpanded ? "Sembunyikan detail sanksi" : "Lihat detail sanksi"}
                              >
                                <Eye className="h-4 w-4" />
                                Lihat
                              </Button>
                              {record.sanctionStatus === "active" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => openResolve(record, "resolve")}
                                    className="h-7 rounded-full px-3 text-[12px] font-semibold"
                                  >
                                    <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                    Selesaikan
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openResolve(record, "waive")}
                                    className="h-7 rounded-full px-3 text-[12px] font-semibold"
                                  >
                                    <XCircle className="mr-1 h-3.5 w-3.5" />
                                    Bebaskan
                                  </Button>
                                </>
                              )}
                            </SummaryResultFooter>
                          )}
                        >
                          {!isExpanded && (
                            <SummaryResultBody
                              assetName={record.assetName || "-"}
                              assetCode={record.assetCode || "-"}
                              noId={record.borrowingCode || `SNK-${record.id}`}
                              personValue={`${record.userName || "-"} • ${record.userNip || "-"}`}
                              unitLabel="Status keterlambatan"
                              unitValue={`Terlambat ${record.overdueDays} hari`}
                              unitExtra="Peminjaman"
                              timeLabel="Jatuh Tempo"
                              timeValue={dueDateLabel}
                              badges={(
                                <Badge className={`rounded-full border px-2 py-0.5 text-[10px] ${assetSourceBadgeClass(deriveAssetSource(undefined, record.assetCode))}`}>
                                  Peminjaman
                                </Badge>
                              )}
                              statusBadges={(
                                <Badge variant={sanctionStatusVariant[record.sanctionStatus]} className="text-[12px]">
                                  {sanctionStatusLabel[record.sanctionStatus]}
                                </Badge>
                              )}
                            />
                          )}

                          {isExpanded && (
                            <div className="space-y-3 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-3 sm:py-3">
                              <div className="columns-1 gap-3 lg:columns-2">
                                <div className="mb-3 break-inside-avoid space-y-2">
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                    Informasi Peminjaman
                                  </div>
                                  <div className="divide-y divide-slate-200 dark:divide-slate-800/35 rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">No ID</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{record.borrowingCode || `SNK-${record.id}`}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Nama Alat</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{record.assetName || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Kode Alat</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{record.assetCode || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Tanggal Pinjam</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{borrowDateLabel}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="mb-3 break-inside-avoid space-y-2">
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                    Detail Sanksi
                                  </div>
                                  <div className="divide-y divide-slate-200 dark:divide-slate-800/35 rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Pengguna</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{record.userName || "-"} • {record.userNip || "-"}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Jatuh Tempo</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{dueDateLabel}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Sanksi Diterapkan</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{appliedDateLabel}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Status</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{sanctionStatusLabel[record.sanctionStatus]}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                      <span className="font-medium text-slate-600 dark:text-slate-300">Catatan</span>
                                      <span className="font-medium text-slate-900 dark:text-slate-100">{record.sanctionNotes || record.resolvedNotes || "-"}</span>
                                    </div>
                                    {record.resolvedAt && (
                                      <div className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[150px_1fr]">
                                        <span className="font-medium text-slate-600 dark:text-slate-300">Diselesaikan</span>
                                        <span className="font-medium text-slate-900 dark:text-slate-100">{record.resolvedBy ?? "admin"} pada {resolvedDateLabel}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        </SummaryResultCard>
                      )
                    })}

                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Menampilkan {sanctionsStartIndex + 1}-{Math.min(sanctionsStartIndex + CARD_ROWS_PER_PAGE, filteredRecords.length)} dari {filteredRecords.length} data
                        {totalCount !== filteredRecords.length ? ` (${totalCount} total server)` : ""}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentSanctionsPage === 1}
                          onClick={() => goToSanctionsPage(currentSanctionsPage - 1)}
                          aria-label="Halaman sanksi sebelumnya"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {visibleSanctionsPages.map((page) =>
                          typeof page === "number" ? (
                            <Button
                              key={`sanctions-page-${page}`}
                              type="button"
                              variant={page === currentSanctionsPage ? "default" : "outline"}
                              size="sm"
                              className="h-8 min-w-8 px-2"
                              onClick={() => goToSanctionsPage(page)}
                            >
                              {page}
                            </Button>
                          ) : (
                            <span key={page} className="px-1 text-xs text-slate-400 dark:text-slate-500">
                              ...
                            </span>
                          )
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentSanctionsPage === totalSanctionsPages}
                          onClick={() => goToSanctionsPage(currentSanctionsPage + 1)}
                          aria-label="Halaman sanksi berikutnya"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </CardContent>
        </Tabs>
      </Card>

      <Dialog
        open={resolveDialog.open}
        onOpenChange={(open) => !submitting && setResolveDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveDialog.mode === "resolve" ? "Selesaikan Sanksi" : "Bebaskan Sanksi"}
            </DialogTitle>
            <DialogDescription>
              {resolveDialog.mode === "resolve"
                ? "Tandai sanksi ini sebagai sudah diselesaikan (misal: aset sudah dikembalikan, denda sudah dibayar)."
                : "Bebaskan/hapus sanksi ini tanpa syarat. Berikan alasan yang jelas."}
            </DialogDescription>
          </DialogHeader>
          {resolveDialog.record && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">{resolveDialog.record.userName}</span> ({resolveDialog.record.userNip})</p>
              <p>Aset: {resolveDialog.record.assetName}</p>
              <p className="text-red-500">Terlambat {resolveDialog.record.overdueDays} hari</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="resolveNotes">
              {resolveDialog.mode === "resolve" ? "Catatan (opsional)" : "Alasan pembebasan *"}
            </Label>
            <Textarea
              id="resolveNotes"
              placeholder={
                resolveDialog.mode === "resolve"
                  ? "Tambahkan catatan jika diperlukan..."
                  : "Tuliskan alasan pembebasan sanksi..."
              }
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog((s) => ({ ...s, open: false }))} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleSubmitResolve} disabled={submitting}>
              {submitting ? "Menyimpan..." : resolveDialog.mode === "resolve" ? "Selesaikan" : "Bebaskan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
          </p>
        </div>
      </div>
    </main>
  )
}
