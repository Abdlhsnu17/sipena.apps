"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import assetDisposalService, { type AssetDisposalRequest, type DisposalStatus } from "@/services/asset-disposal.service"
import deletionRequestService, { type DeletionRequest } from "@/services/deletion-request.service"
import type { User } from "@/types/auth-types"
import { formatDayTimeLabel } from "@/utils/format"
import { canManageDisposalRole } from "@/utils/role"
import { CheckCircle, ChevronDown, ChevronUp, Clock, Search, Trash2, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const statusLabel: Record<DisposalStatus, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
}

const statusVariant: Record<DisposalStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
}

const assetTypeLabel: Record<string, string> = {
  medical: "Medis",
  non_medical: "Non-Medis",
}

const targetTypeLabel: Record<string, string> = {
  user: "Pengguna",
  borrowing: "Peminjaman",
  return: "Pengembalian",
  maintenance: "Pemeliharaan",
}

export default function DisposalPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AssetDisposalRequest[]>([])
  const [dataRequests, setDataRequests] = useState<DeletionRequest[]>([])
  const [total, setTotal] = useState(0)
  const [activeTab, setActiveTab] = useState<DisposalStatus | "all">("pending")
  const [search, setSearch] = useState("")
  const [isDisposalListMinimized, setIsDisposalListMinimized] = useState(false)
  const [isDataRequestsMinimized, setIsDataRequestsMinimized] = useState(false)

  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean
    record: AssetDisposalRequest | null
    mode: "approve" | "reject"
  }>({ open: false, record: null, mode: "approve" })
  const [reviewNotes, setReviewNotes] = useState("")
  const [dataReviewDialog, setDataReviewDialog] = useState<{
    open: boolean
    record: DeletionRequest | null
    mode: "approve" | "reject"
  }>({ open: false, record: null, mode: "approve" })
  const [dataReviewNotes, setDataReviewNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.replace(buildLoginRedirectUrl())
      return
    }
    if (!canManageDisposalRole(currentUser.role)) {
      router.replace("/")
      return
    }
    setUser(currentUser)
  }, [router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [res, dataRes] = await Promise.all([
        assetDisposalService.getAll({
        status: activeTab === "all" ? undefined : activeTab,
        }),
        deletionRequestService.getAll({
          status: activeTab === "all" ? undefined : activeTab,
        }),
      ])
      if (res.success) {
        setRecords(res.data.data)
        setTotal(res.data.total)
      }
      if (dataRes.success) {
        setDataRequests(dataRes.data.data)
      }
    } catch {
      toast({ title: "Gagal memuat data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [activeTab, toast])

  useEffect(() => {
    if (user) loadData()
  }, [user, loadData])

  const filtered = records.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.requesterName?.toLowerCase().includes(q) ||
      r.assetDetailName?.toLowerCase().includes(q) ||
      r.assetDetailCode?.toLowerCase().includes(q) ||
      r.requestCode?.toLowerCase().includes(q)
    )
  })

  const filteredDataRequests = dataRequests.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.requesterName?.toLowerCase().includes(q) ||
      r.targetLabel?.toLowerCase().includes(q) ||
      r.requestCode?.toLowerCase().includes(q) ||
      targetTypeLabel[r.targetType]?.toLowerCase().includes(q)
    )
  })

  const openReview = (record: AssetDisposalRequest, mode: "approve" | "reject") => {
    setReviewNotes("")
    setReviewDialog({ open: true, record, mode })
  }

  const openDataReview = (record: DeletionRequest, mode: "approve" | "reject") => {
    setDataReviewNotes("")
    setDataReviewDialog({ open: true, record, mode })
  }

  const handleReview = async () => {
    if (!reviewDialog.record) return
    if (reviewDialog.mode === "reject" && !reviewNotes.trim()) {
      toast({ title: "Alasan penolakan wajib diisi", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res =
        reviewDialog.mode === "approve"
          ? await assetDisposalService.approve(reviewDialog.record.id, reviewNotes || undefined)
          : await assetDisposalService.reject(reviewDialog.record.id, reviewNotes)

      if (res.success) {
        toast({ title: reviewDialog.mode === "approve" ? "Permintaan disetujui" : "Permintaan ditolak" })
        setReviewDialog({ open: false, record: null, mode: "approve" })
        loadData()
      } else {
        toast({ title: res.message || "Gagal memproses", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi kesalahan", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDataReview = async () => {
    if (!dataReviewDialog.record) return
    if (dataReviewDialog.mode === "reject" && !dataReviewNotes.trim()) {
      toast({ title: "Alasan penolakan wajib diisi", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const res =
        dataReviewDialog.mode === "approve"
          ? await deletionRequestService.approve(dataReviewDialog.record.id, dataReviewNotes || undefined)
          : await deletionRequestService.reject(dataReviewDialog.record.id, dataReviewNotes)

      if (res.success) {
        toast({ title: dataReviewDialog.mode === "approve" ? "Permintaan arsip disetujui" : "Permintaan arsip ditolak" })
        setDataReviewDialog({ open: false, record: null, mode: "approve" })
        loadData()
      } else {
        toast({ title: res.message || "Gagal memproses", variant: "destructive" })
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
            <Trash2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-foreground">Permintaan Penghapusan Aset</h1>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Menunggu
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Disetujui
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" /> Ditolak
            </TabsTrigger>
            <TabsTrigger value="all">Semua</TabsTrigger>
          </TabsList>
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDisposalListMinimized((prev) => !prev)}
              className="w-full rounded-2xl px-3 sm:w-auto"
            >
              {isDisposalListMinimized ? (
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
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari aset, kode, pengaju..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isDisposalListMinimized ? (
              <div className="rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 text-center text-sm text-teal-900">
                Section permintaan penghapusan aset disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : loading ? (
              <div className="text-center py-10 text-muted-foreground">Memuat data...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {search ? "Tidak ada hasil pencarian." : "Tidak ada data permintaan."}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((record) => (
                  <div key={record.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Header bar */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-slate-700">
                          {record.requesterName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">NIP: {record.requesterNip}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <Badge variant={statusVariant[record.status]}>{statusLabel[record.status]}</Badge>
                        <Badge variant="outline" className="text-[11px]">
                          {assetTypeLabel[record.assetType] ?? record.assetType}
                        </Badge>
                      </div>
                    </div>

                    {/* Main content */}
                    <div className="space-y-2.5 bg-white px-3 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {record.assetDetailName ?? `Aset #${record.assetId}`}
                          </p>
                          {record.assetDetailCode && (
                            <p className="text-[12px] font-medium text-slate-700">{record.assetDetailCode}</p>
                          )}
                          <div className="mt-1.5 space-y-1">
                            {record.requestCode && (
                              <p className="text-[11px] text-muted-foreground">
                                No Permintaan: <span className="font-mono font-medium text-slate-700">{record.requestCode}</span>
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground">
                              Alasan: <span className="font-medium text-slate-700">{record.reason}</span>
                            </p>
                            {record.conditionNotes && (
                              <p className="text-[11px] text-muted-foreground italic">{record.conditionNotes}</p>
                            )}
                            {record.reviewedAt && (
                              <p className="text-[11px] text-muted-foreground">
                                Ditinjau oleh {record.reviewerName ?? "admin"} pada {formatDayTimeLabel(record.reviewedAt)}
                                {record.reviewNotes && ` — ${record.reviewNotes}`}
                              </p>
                            )}
                          </div>
                        </div>
                        {record.createdAt && (
                          <div className="flex flex-col items-start gap-0.5 sm:items-end sm:text-right shrink-0">
                            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Diajukan</span>
                            <span className="text-[13px] font-semibold text-foreground">
                              {formatDayTimeLabel(record.createdAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer action buttons */}
                    {record.status === "pending" && user?.role === "admin" && (
                      <div className="flex flex-col gap-1.5 border-t border-slate-200 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => openReview(record, "approve")}
                            className="h-7 rounded-full px-3 text-[12px] font-semibold"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReview(record, "reject")}
                            className="h-7 rounded-full px-3 text-[12px] font-semibold"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Tolak
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-right">
                  {filtered.length} dari {total} data
                </p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Permintaan Arsip Data</h2>
            <p className="text-[12px] text-muted-foreground">Pengajuan dari Leader untuk pengguna, peminjaman, pengembalian, dan pemeliharaan.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDataRequestsMinimized((prev) => !prev)}
              className="rounded-2xl px-3"
            >
              {isDataRequestsMinimized ? (
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
            <Badge variant="outline">{filteredDataRequests.length} data</Badge>
          </div>
        </div>
        {isDataRequestsMinimized ? (
          <div className="rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-4 text-center text-sm text-teal-900">
            Section permintaan arsip data disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
          </div>
        ) : filteredDataRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-muted-foreground">
            Tidak ada permintaan arsip data.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDataRequests.map((record) => (
              <div key={record.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-slate-700">{record.requesterName}</span>
                    <span className="text-[11px] text-muted-foreground">NIP: {record.requesterNip}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <Badge variant={statusVariant[record.status]}>{statusLabel[record.status]}</Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {targetTypeLabel[record.targetType] ?? record.targetType}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2.5 bg-white px-3 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{record.targetLabel ?? `Data #${record.targetId}`}</p>
                      {record.requestCode && (
                        <p className="text-[11px] text-muted-foreground">
                          No Permintaan: <span className="font-mono font-medium text-slate-700">{record.requestCode}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Alasan: <span className="font-medium text-slate-700">{record.reason}</span>
                      </p>
                      {record.reviewedAt && (
                        <p className="text-[11px] text-muted-foreground">
                          Ditinjau oleh {record.reviewerName ?? "admin"} pada {formatDayTimeLabel(record.reviewedAt)}
                          {record.reviewNotes && ` — ${record.reviewNotes}`}
                        </p>
                      )}
                    </div>
                    {record.createdAt && (
                      <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end sm:text-right">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Diajukan</span>
                        <span className="text-[13px] font-semibold text-foreground">{formatDayTimeLabel(record.createdAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {record.status === "pending" && user?.role === "admin" && (
                  <div className="flex flex-col gap-1.5 border-t border-slate-200 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => openDataReview(record, "approve")} className="h-7 rounded-full px-3 text-[12px] font-semibold">
                        <CheckCircle className="mr-1 h-3.5 w-3.5" /> Setujui
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openDataReview(record, "reject")} className="h-7 rounded-full px-3 text-[12px] font-semibold">
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Tolak
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => !submitting && setReviewDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.mode === "approve" ? "Setujui Permintaan Penghapusan" : "Tolak Permintaan Penghapusan"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.mode === "approve"
                ? "Dengan menyetujui, status aset akan diubah menjadi 'Dihapus' (disposed)."
                : "Berikan alasan penolakan agar pengaju dapat melakukan perbaikan."}
            </DialogDescription>
          </DialogHeader>
          {reviewDialog.record && (
            <div className="text-sm space-y-1 p-3 rounded-md bg-muted">
              <p className="font-medium">{reviewDialog.record.assetDetailName ?? `Aset #${reviewDialog.record.assetId}`}</p>
              <p className="text-muted-foreground">{reviewDialog.record.reason}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="review-notes">
              {reviewDialog.mode === "approve" ? "Catatan (opsional)" : "Alasan Penolakan *"}
            </Label>
            <Textarea
              id="review-notes"
              placeholder={
                reviewDialog.mode === "approve"
                  ? "Tambahkan catatan persetujuan jika diperlukan..."
                  : "Tuliskan alasan penolakan..."
              }
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialog((s) => ({ ...s, open: false }))}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              variant={reviewDialog.mode === "approve" ? "default" : "destructive"}
              onClick={handleReview}
              disabled={submitting}
            >
              {submitting
                ? "Memproses..."
                : reviewDialog.mode === "approve"
                ? "Setujui"
                : "Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dataReviewDialog.open}
        onOpenChange={(open) => !submitting && setDataReviewDialog((s) => ({ ...s, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dataReviewDialog.mode === "approve" ? "Setujui Permintaan Arsip Data" : "Tolak Permintaan Arsip Data"}
            </DialogTitle>
            <DialogDescription>
              {dataReviewDialog.mode === "approve"
                ? "Dengan menyetujui, data akan diarsipkan dan disembunyikan dari daftar utama."
                : "Berikan alasan penolakan agar pengaju dapat melakukan perbaikan."}
            </DialogDescription>
          </DialogHeader>
          {dataReviewDialog.record && (
            <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">{dataReviewDialog.record.targetLabel ?? `Data #${dataReviewDialog.record.targetId}`}</p>
              <p className="text-muted-foreground">{dataReviewDialog.record.reason}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="data-review-notes">
              {dataReviewDialog.mode === "approve" ? "Catatan (opsional)" : "Alasan Penolakan *"}
            </Label>
            <Textarea
              id="data-review-notes"
              placeholder={dataReviewDialog.mode === "approve" ? "Tambahkan catatan persetujuan jika diperlukan..." : "Tuliskan alasan penolakan..."}
              value={dataReviewNotes}
              onChange={(e) => setDataReviewNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDataReviewDialog((s) => ({ ...s, open: false }))} disabled={submitting}>
              Batal
            </Button>
            <Button variant={dataReviewDialog.mode === "approve" ? "default" : "destructive"} onClick={handleDataReview} disabled={submitting}>
              {submitting ? "Memproses..." : dataReviewDialog.mode === "approve" ? "Setujui" : "Tolak"}
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
