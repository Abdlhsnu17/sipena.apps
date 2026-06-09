"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import assetDisposalService, { type AssetDisposalRequest, type DisposalStatus } from "@/services/asset-disposal.service"
import type { User } from "@/types/auth-types"
import { formatDayTimeLabel } from "@/utils/format"
import { isAdminOrLeaderRole } from "@/utils/role"
import { CheckCircle, Clock, Search, Trash2, XCircle } from "lucide-react"
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

export default function DisposalPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AssetDisposalRequest[]>([])
  const [total, setTotal] = useState(0)
  const [activeTab, setActiveTab] = useState<DisposalStatus | "all">("pending")
  const [search, setSearch] = useState("")

  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean
    record: AssetDisposalRequest | null
    mode: "approve" | "reject"
  }>({ open: false, record: null, mode: "approve" })
  const [reviewNotes, setReviewNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      router.replace(buildLoginRedirectUrl())
      return
    }
    if (!isAdminOrLeaderRole(currentUser.role)) {
      router.replace("/")
      return
    }
    setUser(currentUser)
  }, [router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await assetDisposalService.getAll({
        status: activeTab === "all" ? undefined : activeTab,
      })
      if (res.success) {
        setRecords(res.data.data)
        setTotal(res.data.total)
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

  const openReview = (record: AssetDisposalRequest, mode: "approve" | "reject") => {
    setReviewNotes("")
    setReviewDialog({ open: true, record, mode })
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

  if (!user) return null

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trash2 className="h-6 w-6 text-destructive" />
          Permintaan Penghapusan Aset
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tinjau dan proses permintaan penghapusan (disposal) aset dari staff
        </p>
      </div>

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

        {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Memuat data...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {search ? "Tidak ada hasil pencarian." : "Tidak ada data permintaan."}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((record) => (
                  <Card key={record.id}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {record.requestCode && (
                              <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {record.requestCode}
                              </span>
                            )}
                            <Badge variant={statusVariant[record.status]}>{statusLabel[record.status]}</Badge>
                            <Badge variant="outline">{assetTypeLabel[record.assetType] ?? record.assetType}</Badge>
                          </div>
                          <p className="font-semibold">{record.assetDetailName ?? `Aset #${record.assetId}`}</p>
                          {record.assetDetailCode && (
                            <p className="text-xs text-muted-foreground">Kode: {record.assetDetailCode}</p>
                          )}
                          <p className="text-sm">
                            <span className="text-muted-foreground">Pengaju: </span>
                            {record.requesterName} ({record.requesterNip})
                          </p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Alasan: </span>
                            {record.reason}
                          </p>
                          {record.conditionNotes && (
                            <p className="text-xs text-muted-foreground italic">{record.conditionNotes}</p>
                          )}
                          {record.createdAt && (
                            <p className="text-xs text-muted-foreground">
                              Diajukan: {formatDayTimeLabel(record.createdAt)}
                            </p>
                          )}
                          {record.reviewedAt && (
                            <p className="text-xs text-muted-foreground">
                              Ditinjau oleh {record.reviewerName ?? "admin"} pada {formatDayTimeLabel(record.reviewedAt)}
                              {record.reviewNotes && ` — ${record.reviewNotes}`}
                            </p>
                          )}
                        </div>
                        {record.status === "pending" && (
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" onClick={() => openReview(record, "approve")}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Setujui
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openReview(record, "reject")}>
                              <XCircle className="h-4 w-4 mr-1" /> Tolak
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <p className="text-xs text-muted-foreground text-right">
                  {filtered.length} dari {total} data
                </p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

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
    </div>
  )
}
