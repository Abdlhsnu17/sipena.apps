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
import { AlertTriangle, CheckCircle, Search, Shield, Users, XCircle } from "lucide-react"
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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-red-600" />
          Manajemen Sanksi
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola sanksi peminjaman aset yang melewati jatuh tempo
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sanksi Aktif</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.active}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Perlu tindak lanjut
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Sanksi Selesai</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.resolved}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Sudah diselesaikan
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pengguna Terdampak</CardDescription>
              <CardTitle className="text-3xl text-amber-600">{stats.totalAffectedUsers}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Pengguna dengan sanksi aktif
            </CardContent>
          </Card>
        </div>
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
