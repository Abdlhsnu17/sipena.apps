"use client"

import type React from "react";

import InventoryPicker from "@/components/inventory-picker";
import MaintenanceTechnicianPicker from "@/components/maintenance-technician-picker";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { assetUsageService } from "@/services/asset-usage.service";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { getDetailInventoryStatusLabel } from "@/utils/detail-inventory";
import { toLocalDateTimeString } from "@/utils/format";
import { buildInventorySearchKey } from "@/utils/inventory-search";
import { getUserRoleLabel } from "@/utils/role";
import { Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface MaintenanceFormProps {
  maintenance: any
  assets: DetailInventoryItem[]
  totalAssetsCount?: number
  lockedAssetsCount?: number
  prefillAsset?: DetailInventoryItem | null
  prefillNote?: string
  onSave: (data: any) => void
  onCancel: () => void
}

const formatAssetLabel = (asset: DetailInventoryItem) => {
  const inventoryLabel = asset.detailInventoryName || asset.detailName || asset.assetName || ""
  const brandLabel = asset.detailBrandModel
  const codeLabel = asset.detailCode || asset.assetCode
  const locationLabel = asset.assetLocation ? ` (${asset.assetLocation})` : ""
  const brandSuffix = brandLabel ? ` (${brandLabel})` : ""
  const codeSuffix = codeLabel ? ` - ${codeLabel}` : ""
  return `${inventoryLabel}${brandSuffix}${codeSuffix}${locationLabel}`.trim()
}

const getDetailInventoryKey = (asset: DetailInventoryItem, index?: number) => {
  const segments = [
    asset.detailId,
    asset.detailCode,
    asset.detailName,
    asset.assetLocation,
    asset.assetId ? String(asset.assetId) : undefined,
  ].filter(Boolean)

  const baseKey = segments.join("|")
  if (!baseKey) {
    return index !== undefined ? `asset-${index}` : `asset-${asset.assetId ?? "unknown"}`
  }
  return index !== undefined ? `${baseKey}-${index}` : baseKey
}

const buildRepairNoteTemplate = (asset?: DetailInventoryItem | null) => {
  const assetLabel = asset ? formatAssetLabel(asset) : ""
  const inventarisLine = assetLabel ? `Inventaris: ${assetLabel}` : ""
  return `\n\n${inventarisLine}`
}

const CANCELLATION_REASON_OPTIONS = [
  "Salah input",
  "Jadwal berubah",
  "Inventaris masih layak pakai",
]

const STATUS_OPTIONS = [
  { value: "requested", label: "Diajukan" },
  { value: "scheduled", label: "Disetujui" },
  { value: "in_progress", label: "Sedang Pengecekan Lanjutan" },
  { value: "completed", label: "Dalam Proses Pengerjaan" },
  { value: "validated", label: "Selesai Pemeliharaan Sarana" },
  { value: "cancelled", label: "Ditolak / Dibatalkan" },
] as const

const EDITABLE_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ["requested", "scheduled", "cancelled"],
  scheduled: ["scheduled", "in_progress", "cancelled"],
  in_progress: ["in_progress", "completed", "cancelled"],
  completed: ["completed", "validated", "in_progress"],
  validated: ["validated"],
  cancelled: ["cancelled"],
}

export default function MaintenanceForm({
  maintenance,
  assets,
  prefillAsset,
  prefillNote,
  onSave,
  onCancel,
}: MaintenanceFormProps) {
  const [selectedAsset, setSelectedAsset] = useState<DetailInventoryItem | null>(null)
  const defaultRepairNote = useMemo(() => buildRepairNoteTemplate(selectedAsset), [selectedAsset])
  const prevAutoRepairNoteRef = useRef(defaultRepairNote)
  const appliedPrefillRef = useRef(false)
  const scheduledDateInputRef = useRef<HTMLInputElement | null>(null)

  const [formData, setFormData] = useState(() => ({
    inventarisInput: "",
    assetId: "",
    assetType: "medical" as "medical" | "non_medical",
    assetDetailId: "",
    assetDetailName: "",
    assetDetailCode: "",
    assetLocation: "",
    type: "preventive",
    priority: "normal",
    scheduledDate: "",
    description: "",

    technician: "",
    technicianUserId: "",
    technicianNip: "",
    technicianRole: "",
    technicianWorkUnit: "",
    vendorName: "",
    vendorReference: "",
    warrantyUntil: "",
    status: "requested",
    cancellationReason: "",
    cost: "",
  }))
  const [hasActiveUsage, setHasActiveUsage] = useState(false)

  const typeOptions = [
    { value: "preventive", label: "Rutin" },
    { value: "corrective", label: "Perbaikan" },
    { value: "calibration", label: "Kalibrasi" },
    { value: "inspection", label: "Inspeksi" },
  ]
  const visibleStatusOptions = useMemo(() => {
    if (!maintenance) {
      return STATUS_OPTIONS.filter((option) => option.value === "requested")
    }

    const currentStatus = maintenance.status || formData.status
    const allowedStatuses = EDITABLE_STATUS_TRANSITIONS[currentStatus] || [currentStatus]
    return STATUS_OPTIONS.filter((option) => allowedStatuses.includes(option.value))
  }, [formData.status, maintenance])

  const getConditionLabel = (asset: DetailInventoryItem) => {
    if (asset.condition === "damaged") return "Rusak"
    if (asset.condition === "poor") return "Kurang"
    if (asset.condition === "fair") return "Cukup"
    return "Baik"
  }

  const assetsByLabel = useMemo(
    () =>
      assets.reduce<Record<string, DetailInventoryItem>>((acc, asset) => {
        const label = formatAssetLabel(asset).trim().toLowerCase()
        if (label) {
          acc[label] = asset
        }
        const fallbackLabel = [`${asset.detailName}`, `${asset.detailCode || asset.assetCode}`]
          .map((segment) => (segment ? segment.trim() : ""))
          .filter(Boolean)
          .join(" - ")
          .toLowerCase()
        if (fallbackLabel) {
          acc[fallbackLabel] = asset
        }
        return acc
      }, {}),
    [assets]
  )

  useEffect(() => {
    if (!maintenance) {
      setSelectedAsset(null)
      return
    }

    const labelParts = []
    if (maintenance.assetDetailName || maintenance.assetName) {
      labelParts.push(maintenance.assetDetailName || maintenance.assetName)
    }
    if (maintenance.assetDetailCode || maintenance.assetCode) {
      labelParts.push(maintenance.assetDetailCode || maintenance.assetCode)
    }
    const labelFromMaintenance = labelParts.join(" - ")
    const resolvedType = maintenance.assetType || "medical"
    const matchedByDetailId = maintenance.assetDetailId
      ? assets.find((asset) => asset.detailId === maintenance.assetDetailId)
      : null
    const matchedByAssetId = maintenance.assetId
      ? assets.find((asset) => asset.assetId === maintenance.assetId)
      : null
    const resolvedAsset = matchedByDetailId || matchedByAssetId || null
    setSelectedAsset(resolvedAsset)

    setFormData((prev) => ({
      ...prev,
      inventarisInput: labelFromMaintenance || prev.inventarisInput,
      assetId: maintenance.assetId ? String(maintenance.assetId) : prev.assetId,
      assetType: resolvedType,
      assetDetailId: maintenance.assetDetailId || prev.assetDetailId,
      assetDetailName: maintenance.assetDetailName || maintenance.assetName || prev.assetDetailName,
      assetDetailCode: maintenance.assetDetailCode || maintenance.assetCode || prev.assetDetailCode,
      assetLocation: maintenance.assetLocation || prev.assetLocation,
      type: maintenance.type || prev.type,
      priority: maintenance.priority || "normal",
      scheduledDate: toLocalDateTimeString(maintenance.scheduledDate ?? maintenance.scheduled_date) ?? "",
      description: maintenance.description ?? buildRepairNoteTemplate(resolvedAsset),
      technician: maintenance.technician || "",
      technicianUserId: maintenance.technicianUserId ? String(maintenance.technicianUserId) : "",
      technicianNip: maintenance.technicianNip || "",
      technicianRole: maintenance.technicianRole || "",
      technicianWorkUnit: maintenance.technicianWorkUnit || "",
      vendorName: maintenance.vendorName || "",
      vendorReference: maintenance.vendorReference || "",
      warrantyUntil: maintenance.warrantyUntil ? String(maintenance.warrantyUntil).slice(0, 10) : "",
      status: maintenance.status || "requested",
      cancellationReason:
        maintenance.cancellationReason ?? maintenance.cancellation_reason ?? "",
      cost: maintenance.cost ? String(maintenance.cost) : "",
    }))
  }, [maintenance, assets])

  useEffect(() => {
    if (maintenance) return
    if (appliedPrefillRef.current) return
    if (!prefillAsset) return

    appliedPrefillRef.current = true
    setSelectedAsset(prefillAsset)
    const prefillDescription = `${prefillNote ? prefillNote : ""}${buildRepairNoteTemplate(prefillAsset)}`
    prevAutoRepairNoteRef.current = prefillDescription
    setFormData((prev) => ({
      ...prev,
      inventarisInput: formatAssetLabel(prefillAsset),
      assetId: String(prefillAsset.assetId),
      assetType: prefillAsset.assetType || prev.assetType,
      assetDetailId: prefillAsset.detailId || prev.assetDetailId,
      assetDetailName: prefillAsset.detailInventoryName || prefillAsset.detailName || prev.assetDetailName,
      assetDetailCode: prefillAsset.detailCode || prev.assetDetailCode,
      assetLocation: prefillAsset.assetLocation || prev.assetLocation,
      type: "corrective",
      description: prefillDescription,
    }))
  }, [maintenance, prefillAsset, prefillNote])

  useEffect(() => {
    if (maintenance) return
    setFormData((prev) => {
      const shouldOverride =
        !prev.description || prev.description === prevAutoRepairNoteRef.current
      if (!shouldOverride) return prev
      return { ...prev, description: defaultRepairNote }
    })
    prevAutoRepairNoteRef.current = defaultRepairNote
  }, [defaultRepairNote, maintenance])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "status" && value !== "cancelled"
        ? { cancellationReason: "" }
        : {}),
    }))
  }

  const handleSelectAsset = (asset: DetailInventoryItem) => {
    setSelectedAsset(asset)
    setFormData((prev) => ({
      ...prev,
      inventarisInput: formatAssetLabel(asset),
      assetId: String(asset.assetId),
      assetType: asset.assetType || prev.assetType,
      assetDetailId: asset.detailId || prev.assetDetailId,
      assetDetailName: asset.detailInventoryName || asset.detailName || prev.assetDetailName,
      assetDetailCode: asset.detailCode || prev.assetDetailCode,
      assetLocation: asset.assetLocation || prev.assetLocation,
    }))

    window.setTimeout(() => {
      const scheduledDateInput = scheduledDateInputRef.current
      if (!scheduledDateInput) return
      scheduledDateInput.focus({ preventScroll: true })
    }, 120)
  }

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
    // check when selectedAsset or form status changes (we only block for active maintenance statuses)
    void checkUsage(selectedAsset)
    return () => { mounted = false }
  }, [selectedAsset, formData.status])

  const findMatchedAsset = () => {
    if (formData.assetDetailId) {
      return assets.find((asset) => asset.detailId === formData.assetDetailId)
    }
    if (formData.assetId) {
      return assets.find((asset) => String(asset.assetId) === formData.assetId)
    }
    const label = formData.inventarisInput.trim().toLowerCase()
    return label ? assetsByLabel[label] : undefined
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.status === "cancelled" && !formData.cancellationReason.trim()) {
      alert("Alasan pembatalan wajib diisi jika status Dibatalkan")
      return
    }
    const activeMaintenanceStatuses = ["scheduled", "in_progress", "completed"]
    const isBlockedByUsage = hasActiveUsage && activeMaintenanceStatuses.includes(formData.status)
    if (isBlockedByUsage) {
      alert("Aset sedang digunakan — tidak dapat membuat pemeliharaan aktif sampai penggunaan selesai.")
      return
    }
    const resolvedAsset = selectedAsset ?? findMatchedAsset()
    const {
      inventarisInput,
      assetDetailId,
      assetDetailName,
      assetDetailCode,
      cancellationReason,
      ...rest
    } = formData
    const resolvedAssetId =
      resolvedAsset?.assetId ?? (rest.assetId ? Number(rest.assetId) : undefined)
    const resolvedAssetType = resolvedAsset?.assetType || rest.assetType
    const payload = {
      ...rest,
      assetId: resolvedAssetId,
      assetType: resolvedAssetType,
      assetDetailId: resolvedAsset?.detailId || assetDetailId || undefined,
      assetDetailName: resolvedAsset?.detailName || assetDetailName || inventarisInput,
      assetDetailCode: resolvedAsset?.detailCode || assetDetailCode || "",
      cancellationReason: cancellationReason.trim() || undefined,
    }
    onSave(payload)
  }


  return (
    <Card className="m-0 flex max-h-[90dvh] flex-col overflow-hidden rounded-2xl border-0 text-sm shadow-none">
      <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="space-y-0.5">
          <CardTitle className="text-base">
            {maintenance ? "Edit Pemeliharaan Sarana" : "Tambah Pemeliharaan Sarana"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Lengkapi jadwal, penanggung jawab, dan detail layanan.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Tutup formulir"
        >
          <X className="h-5 w-5" />
        </button>
      </CardHeader>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Informasi Jadwal</h3>
              <p className="text-xs text-muted-foreground">Tentukan inventaris dan waktu pelaksanaan layanan.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Pilih Inventaris</label>
                <InventoryPicker
                  assets={assets}
                  selectedAsset={selectedAsset}
                  onSelect={handleSelectAsset}
                  formatLabel={formatAssetLabel}
                  getItemKey={getDetailInventoryKey}
                  getAssetCategory={(asset) => asset.assetType}
                  showCategoryFilter
                  searchValue={buildInventorySearchKey}
                  placeholder="Cari inventaris..."
                  buttonLabel="Pilih inventaris"
                  buttonClassName="h-10"
                  ariaLabel="Pilih inventaris untuk pemeliharaan"
                  renderItemMeta={(asset) => (
                    <span>{getDetailInventoryStatusLabel(asset)} · Kondisi: {getConditionLabel(asset)}</span>
                  )}
                  noResultsLabel="Tidak ada alat inventaris yang tersedia"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Tipe Layanan</label>
                <select name="type" value={formData.type} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Prioritas</label>
                <select name="priority" value={formData.priority} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="low">Rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option><option value="critical">Kritis</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Tanggal &amp; Waktu Jadwal</label>
                <input ref={scheduledDateInputRef} type="datetime-local" name="scheduledDate" value={formData.scheduledDate} onChange={handleChange} required step={60} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-border/70 pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Teknisi / Penanggung Jawab</h3>
              <p className="text-xs text-muted-foreground">Tautkan akun aktif agar identitas teknisi terisi otomatis.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Cari Akun Teknisi / PJ</label>
              <MaintenanceTechnicianPicker
                value={formData.technicianUserId ? Number(formData.technicianUserId) : null}
                selected={formData.technicianUserId ? {
                  id: Number(formData.technicianUserId), nip: formData.technicianNip,
                  name: formData.technician, role: formData.technicianRole,
                  workUnit: formData.technicianWorkUnit,
                } : null}
                onSelect={(technician) => setFormData((prev) => ({
                  ...prev, technician: technician.name, technicianUserId: String(technician.id),
                  technicianNip: technician.nip, technicianRole: technician.role,
                  technicianWorkUnit: technician.workUnit || technician.subWorkUnit || "",
                }))}
              />
            </div>
            {formData.technicianUserId ? (
              <div className="grid gap-3 rounded-xl border border-teal-200/70 bg-teal-50/60 p-3 sm:grid-cols-3 dark:border-teal-900/60 dark:bg-teal-950/20">
                <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">NIP</p><p className="mt-1 truncate text-sm font-semibold">{formData.technicianNip || "-"}</p></div>
                <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Jabatan</p><p className="mt-1 truncate text-sm font-semibold">{formData.technicianRole ? getUserRoleLabel(formData.technicianRole) : "-"}</p></div>
                <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Unit Kerja</p><p className="mt-1 truncate text-sm font-semibold">{formData.technicianWorkUnit || "-"}</p></div>
              </div>
            ) : (
              <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">Nama, NIP, jabatan, dan unit kerja akan tampil setelah akun dipilih.</p>
            )}
          </section>

          <section className="space-y-3 border-t border-border/70 pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Detail Layanan</h3>
              <p className="text-xs text-muted-foreground">Informasi vendor, status pengajuan, dan biaya layanan.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Vendor/Penyedia Jasa</label>
                <input type="text" name="vendorName" value={formData.vendorName} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Opsional" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">No. Referensi Vendor</label>
                <input type="text" name="vendorReference" value={formData.vendorReference} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="PO / invoice / tiket" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Status</label>
                <select name="status" value={formData.status} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {visibleStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Biaya (Rp)</label>
                <input type="number" name="cost" value={formData.cost} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Opsional" />
              </div>
              {formData.status === "cancelled" && (
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Alasan Pembatalan</label>
                  <input type="text" name="cancellationReason" value={formData.cancellationReason} onChange={handleChange} required list="maintenance-cancellation-reasons" className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Pilih atau ketik alasan pembatalan" />
                  <datalist id="maintenance-cancellation-reasons">
                    {CANCELLATION_REASON_OPTIONS.map((option) => <option key={option} value={option} />)}
                  </datalist>
                  <p className="mt-1 text-xs text-muted-foreground">Contoh: {CANCELLATION_REASON_OPTIONS.join(", ")}</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-1.5 border-t border-border/70 pt-4">
            <label className="block text-xs font-medium text-foreground">Catatan Perbaikan</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={3} placeholder="Cantumkan keluhan dan alat yang diperiksa" />
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {hasActiveUsage && ["scheduled","in_progress","completed"].includes(formData.status) ? (
            <p className="text-xs text-red-600 sm:text-sm">Aset sedang digunakan. Hentikan penggunaan sebelum membuat pemeliharaan aktif.</p>
          ) : <span />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onCancel}>Batal</Button>
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={hasActiveUsage && ["scheduled","in_progress","completed"].includes(formData.status)}>
              <Save className="mr-2 h-4 w-4" /> Simpan Pemeliharaan
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}
