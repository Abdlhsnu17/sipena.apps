"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useConfirm } from "@/hooks/use-confirm"
import { useToast } from "@/hooks/use-toast"
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import sanctionsService, { type SanctionRecord, type SanctionStats } from "@/services/sanctions.service"
import type { User } from "@/types/auth-types"
import { formatDayTimeLabel } from "@/utils/format"
import { isAdminOrLeaderRole } from "@/utils/role"
import { Activity, AlertCircle, Check, CheckCircle, Search, Shield, Users, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

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
  const { confirm } = useConfirm()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<SanctionRecord[]>([])
  const [stats, setStats] = useState<SanctionStats | null>(null)
  const [activeTab, setActiveTab] = useState<"active" | "resolved" | "all">("active")
  const [search, setSearch] = useState("")
  const [totalCount, setTotalCount] = useState(0)

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
    if (!isAdminOrLeaderRole(currentUser.role)) {
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

  const filteredRecords = records.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.userName?.toLowerCase().includes(q) ||
      r.userNip?.toLowerCase().includes(q) ||
      r.assetName?.toLowerCase().includes(q) ||
      r.borrowingCode?.toLowerCase().includes(q)
    )
  })

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
    <div className="container mx-auto px-4 py-6 space-y-6">
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
        <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 p-3 dark:bg-amber-950/30">
                <div>
                  <p className="text-[12px] text-muted-foreground">Total Sanksi</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.active + stats.resolved}</p>
                  <p className="text-xs text-slate-600">Semua riwayat sanksi</p>
                </div>
                <Activity className="h-4 w-4 shrink-0 text-amber-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 p-3 dark:bg-teal-950/30">
                <div>
                  <p className="text-[12px] text-muted-foreground">Sanksi Selesai</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.resolved}</p>
                  <p className="text-xs text-slate-600">Sudah diselesaikan</p>
                </div>
                <Check className="h-4 w-4 shrink-0 text-teal-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-rose-50/70 p-3 dark:bg-rose-950/30">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted-foreground">Sanksi Aktif</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.active}</p>
                  <p className="text-xs text-slate-600">
                    {stats.active > 0 ? "Perlu tindak lanjut" : "Tidak ada sanksi aktif"}
                  </p>
                </div>
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-cyan-50/50 p-3 dark:bg-cyan-950/30">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted-foreground">Pengguna Terdampak</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{stats.totalAffectedUsers}</p>
                  <p className="text-xs text-slate-600">
                    {stats.totalAffectedUsers > 0 ? "Pengguna dengan sanksi aktif" : "Tidak ada pengguna terdampak"}
                  </p>
                </div>
                <Users className="h-4 w-4 shrink-0 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">Aktif</TabsTrigger>
            <TabsTrigger value="resolved">Selesai</TabsTrigger>
            <TabsTrigger value="all">Semua</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, NIP, kode..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {(["active", "resolved", "all"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Memuat data...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {search ? "Tidak ada hasil pencarian." : "Tidak ada data sanksi."}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <Card key={record.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{record.userName}</span>
                            <span className="text-muted-foreground text-xs">NIP: {record.userNip}</span>
                            <Badge variant={sanctionStatusVariant[record.sanctionStatus]}>
                              {sanctionStatusLabel[record.sanctionStatus]}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{record.assetName}</span>
                            {record.assetCode && (
                              <span className="ml-1 text-xs">({record.assetCode})</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-x-3">
                            {record.borrowingCode && <span>No: {record.borrowingCode}</span>}
                            {record.dueDate && (
                              <span>Jatuh tempo: {formatDayTimeLabel(record.dueDate)}</span>
                            )}
                            <span className="text-red-500 font-medium">
                              Terlambat {record.overdueDays} hari
                            </span>
                          </div>
                          {record.sanctionNotes && (
                            <p className="text-xs text-muted-foreground italic">{record.sanctionNotes}</p>
                          )}
                          {record.resolvedAt && (
                            <p className="text-xs text-green-600">
                              Diselesaikan oleh {record.resolvedBy ?? "admin"} pada{" "}
                              {formatDayTimeLabel(record.resolvedAt)}
                              {record.resolvedNotes && ` — ${record.resolvedNotes}`}
                            </p>
                          )}
                        </div>
                        {record.sanctionStatus === "active" && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openResolve(record, "resolve")}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Selesaikan
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openResolve(record, "waive")}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Bebaskan
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <p className="text-xs text-muted-foreground text-right">
                  {filteredRecords.length} dari {totalCount} data
                </p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

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
  )
}
