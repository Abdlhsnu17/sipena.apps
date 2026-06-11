"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

type DeleteReasonDialogProps = {
  open: boolean
  title: string
  description: string
  value: string
  isSubmitting?: boolean
  onValueChange: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteReasonDialog({
  open,
  title,
  description,
  value,
  isSubmitting = false,
  onValueChange,
  onCancel,
  onConfirm,
}: DeleteReasonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="delete-reason">
            Alasan penghapusan
          </label>
          <Textarea
            id="delete-reason"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder="Contoh: data duplikat, salah input, atau koreksi audit"
            disabled={isSubmitting}
            className="min-h-24"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
            onClick={onConfirm}
            disabled={isSubmitting || !value.trim()}
          >
            {isSubmitting ? "Mengarsipkan..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
