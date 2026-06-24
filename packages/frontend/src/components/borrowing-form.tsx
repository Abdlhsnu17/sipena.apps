"use client"

import InventoryPicker from "@/components/inventory-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetUsageService } from "@/services/asset-usage.service";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { getCurrentLocalDateTimeValue, toDateTimeLocalInputValue } from "@/utils/date-input";
import { getDetailInventoryStatusLabel } from "@/utils/detail-inventory";
import { toLocalDateTimeString } from "@/utils/format";
import { buildInventorySearchKey } from "@/utils/inventory-search";
import { useEffect, useState } from "react";

type BorrowingFormPayload = {
  selectedAsset: DetailInventoryItem
  borrowDate: string
  dueDate?: string
  /**
   * The field previously called "room"; sent to backend as `purpose`.
   * Label in the UI still reads "Ruangan Peminjaman" but the API expects
   * a `purpose` property so we map accordingly.
   */
  purpose: string
  notes: string
}

interface BorrowingFormProps {
  assets: DetailInventoryItem[]
  formatLabel: (asset: DetailInventoryItem) => string
  getItemKey: (asset: DetailInventoryItem, index?: number) => string
  selectedAssetLabel?: (asset: DetailInventoryItem) => string
  defaultBorrowDate?: string
  onSave: (payload: BorrowingFormPayload) => void
  onCancel: () => void
}

export default function BorrowingForm({
  assets,
  formatLabel,
  getItemKey,
  selectedAssetLabel,
  defaultBorrowDate,
  onSave,
  onCancel,
}: BorrowingFormProps) {
  const [selectedAsset, setSelectedAsset] = useState<DetailInventoryItem | null>(null)
  const [hasActiveUsage, setHasActiveUsage] = useState(false)
  const [formData, setFormData] = useState(() => ({
    borrowDate: defaultBorrowDate ?? "",
    dueDate: "",
    purpose: "",
    notes: "",
  }))

  useEffect(() => {
    if (!defaultBorrowDate) {
      return
    }

    setFormData((prev) => ({
      ...prev,
      borrowDate: defaultBorrowDate,
    }))
  }, [defaultBorrowDate])

  useEffect(() => {
    let mounted = true
    const checkUsage = async (asset?: DetailInventoryItem | null) => {
      if (!asset || !asset.assetId) {
        if (mounted) setHasActiveUsage(false)
        return
      }
      try {
        const resp = await assetUsageService.getAll({ page: 1, limit: 50, assetId: String(asset.assetId), assetType: asset.assetType })
        const active = Array.isArray(resp.data) && resp.data.some((u) => !u.endedAt && ( !u.assetDetailId || u.assetDetailId === asset.detailId ))
        if (mounted) setHasActiveUsage(Boolean(active))
      } catch {
        if (mounted) setHasActiveUsage(false)
      }
    }
    void checkUsage(selectedAsset)
    return () => { mounted = false }
  }, [selectedAsset])

  const handleBorrowDateFocus = () => {
    if (formData.borrowDate) {
      return
    }
    setFormData((prev) => ({
      ...prev,
      borrowDate: getCurrentLocalDateTimeValue(),
    }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAsset) {
      alert("Pilih inventaris yang ingin dipinjam dulu")
      return
    }
    if (!formData.borrowDate.trim()) {
      alert("Tanggal pinjam wajib diisi")
      return
    }
    if (!formData.purpose.trim()) {
      alert("Ruangan peminjaman wajib diisi")
      return
    }

    if (hasActiveUsage) {
      alert("Aset sedang digunakan — tidak dapat membuat peminjaman sampai penggunaan selesai.")
      return
    }

    // Validasi dueDate jika diisi
    if (formData.dueDate.trim()) {
      const borrowDateTime = new Date(formData.borrowDate).getTime()
      const dueDateTime = new Date(formData.dueDate).getTime()
      if (dueDateTime < borrowDateTime) {
        alert("Tanggal kembali harus lebih besar atau sama dengan tanggal pinjam")
        return
      }
    }

    onSave({
      selectedAsset,
      borrowDate: formData.borrowDate,
      dueDate: formData.dueDate || undefined,
      // translate the UI field to the API property
      purpose: formData.purpose.trim(),
      notes: formData.notes.trim(),
    })
  }

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700/35 dark:bg-slate-900/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Tambah Data Peminjaman</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Daftar penambahan inventaris sudah menyediakan pemilihan tanggal pinjaman seperti jadwal pemeliharaan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid mobile-form-grid gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Pilih Inventaris</label>
              <InventoryPicker
                assets={assets}
                selectedAsset={selectedAsset}
                onSelect={(asset) => setSelectedAsset(asset)}
                formatLabel={formatLabel}
                getItemKey={getItemKey}
                getAssetCategory={(asset) => asset.assetType}
                showCategoryFilter
                searchValue={buildInventorySearchKey}
                placeholder="Cari No ID, inventaris, atau kode..."
                buttonLabel="Pilih inventaris"
                ariaLabel="Pilih inventaris untuk peminjaman"
                selectedAssetLabel={selectedAssetLabel ?? formatLabel}
                renderItemMeta={(asset) => getDetailInventoryStatusLabel(asset)}
                noResultsLabel="Tidak ada alat inventaris yang tersedia"
              />
              {hasActiveUsage && (
                <div className="mt-2 text-sm text-rose-600">Alat sedang digunakan — tidak dapat dipinjam sampai penggunaan selesai.</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tanggal &amp; Waktu Pinjam</label>
              <input
                type="datetime-local"
                name="borrowDate"
                value={toDateTimeLocalInputValue(formData.borrowDate)}
                onFocus={handleBorrowDateFocus}
                onChange={(event) => setFormData((prev) => ({ ...prev, borrowDate: event.target.value }))}
                required
                placeholder="dd/mm/yyyy, --:--"
                step={60}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tanggal &amp; Waktu Kembali (Opsional)</label>
              <input
                type="datetime-local"
                name="dueDate"
                value={toLocalDateTimeString(formData.dueDate) ?? ""}
                onChange={(event) => setFormData((prev) => ({ ...prev, dueDate: event.target.value }))}
                step={60}
                placeholder="dd/mm/yyyy, --:--"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Ruangan Peminjaman</label>
              <input
                type="text"
                name="purpose"
                value={formData.purpose}
                onChange={(event) => setFormData((prev) => ({ ...prev, purpose: event.target.value }))}
                placeholder="Contoh: Ruangan IGD Lt 4"
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Catatan</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                placeholder="Catatan tambahan (opsional)"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={hasActiveUsage}>
              Simpan
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
