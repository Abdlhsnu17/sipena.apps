"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import assetDisposalService from "@/services/asset-disposal.service"
import { Trash2 } from "lucide-react"
import { useState } from "react"

interface DisposalRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetId: number
  assetType: "medical" | "non_medical"
  assetDetailId?: string
  assetDetailName?: string
  assetDetailCode?: string
  onSuccess?: () => void
}

export function DisposalRequestDialog({
  open,
  onOpenChange,
  assetId,
  assetType,
  assetDetailId,
  assetDetailName,
  assetDetailCode,
  onSuccess,
}: DisposalRequestDialogProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [conditionNotes, setConditionNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast({ title: "Alasan penghapusan wajib diisi", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const res = await assetDisposalService.create({
        assetId,
        assetType,
        assetDetailId,
        assetDetailName,
        assetDetailCode,
        reason: reason.trim(),
        conditionNotes: conditionNotes.trim() || undefined,
      })

      if (res.success) {
        toast({ title: "Permintaan penghapusan berhasil dikirim", description: `Kode: ${res.data?.requestCode ?? "-"}` })
        setReason("")
        setConditionNotes("")
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast({ title: res.message || "Gagal mengirim permintaan", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi kesalahan", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    setReason("")
    setConditionNotes("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Ajukan Penghapusan Aset
          </DialogTitle>
          <DialogDescription>
            Permintaan akan dikirim ke admin/pimpinan untuk disetujui atau ditolak. Aset tidak langsung dihapus.
          </DialogDescription>
        </DialogHeader>

        {(assetDetailName || assetDetailCode) && (
          <div className="text-sm p-3 rounded-md bg-muted space-y-0.5">
            {assetDetailName && <p className="font-medium">{assetDetailName}</p>}
            {assetDetailCode && <p className="text-muted-foreground text-xs">Kode: {assetDetailCode}</p>}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disposal-reason">Alasan Penghapusan *</Label>
            <Textarea
              id="disposal-reason"
              placeholder="Contoh: Aset sudah tidak dapat diperbaiki, kondisi rusak berat..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disposal-condition">Catatan Kondisi (opsional)</Label>
            <Textarea
              id="disposal-condition"
              placeholder="Jelaskan kondisi aset saat ini secara detail..."
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Mengirim..." : "Ajukan Penghapusan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
