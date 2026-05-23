"use client"

import type React from "react";

import InventoryPicker from "@/components/inventory-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assetUsageService } from "@/services/asset-usage.service";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { getDetailInventoryStatusLabel } from "@/utils/detail-inventory";
import { toLocalDateTimeString } from "@/utils/format";
import { buildInventorySearchKey } from "@/utils/inventory-search";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface MaintenanceFormProps {
  maintenance: any
  assets: DetailInventoryItem[]
  totalAssetsCount?: number
  lockedAssetsCount?: number
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
  const alatLine = assetLabel ? `Alat: ${assetLabel}` : ""
  return `\n\n${alatLine}`
}

const CANCELLATION_REASON_OPTIONS = [
  "Salah input",
  "Jadwal berubah",
  "Alat masih layak pakai",
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
  onSave,
  onCancel,
}: MaintenanceFormProps) {
  const [selectedAsset, setSelectedAsset] = useState<DetailInventoryItem | null>(null)
  const defaultRepairNote = useMemo(() => buildRepairNoteTemplate(selectedAsset), [selectedAsset])
  const prevAutoRepairNoteRef = useRef(defaultRepairNote)
  const formCardRef = useRef<HTMLDivElement | null>(null)
  const inventoryPickerRef = useRef<HTMLDivElement | null>(null)
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
    scheduledDate: "",
    description: "",

    technician: "",
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
      scheduledDate: toLocalDateTimeString(maintenance.scheduledDate ?? maintenance.scheduled_date) ?? "",
      description: maintenance.description ?? buildRepairNoteTemplate(resolvedAsset),
      technician: maintenance.technician || "",
      status: maintenance.status || "requested",
      cancellationReason:
        maintenance.cancellationReason ?? maintenance.cancellation_reason ?? "",
      cost: maintenance.cost ? String(maintenance.cost) : "",
    }))
  }, [maintenance, assets])

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

  useEffect(() => {
    if (maintenance) return

    window.requestAnimationFrame(() => {
      formCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      })

      const pickerButton = inventoryPickerRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-label="Pilih inventaris untuk pemeliharaan"]'
      )
      pickerButton?.focus({ preventScroll: true })
    })
  }, [maintenance])

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

      const rect = scheduledDateInput.getBoundingClientRect()
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight

      if (!isVisible) {
        scheduledDateInput.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        })
      }

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
    console.log("SELECTED ASSET ID:", resolvedAsset?.assetId, resolvedAsset?.detailId)
    console.log("PAYLOAD:", payload)
    onSave(payload)
  }


  return (
    <Card ref={formCardRef} className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>{maintenance ? "Edit Pemeliharaan Sarana" : "Tambah Pemeliharaan Sarana"}</CardTitle>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid mobile-form-grid gap-4">
            <div ref={inventoryPickerRef}>
              <label className="block text-sm font-medium text-foreground mb-2">Pilih Inventaris</label>
              <InventoryPicker
                assets={assets}
                selectedAsset={selectedAsset}
                onSelect={(asset) => {
                  handleSelectAsset(asset)
                }}
                formatLabel={formatAssetLabel}
                getItemKey={getDetailInventoryKey}
                getAssetCategory={(asset) => asset.assetType}
                showCategoryFilter
                searchValue={buildInventorySearchKey}
                placeholder="Cari inventaris..."
                buttonLabel="Pilih inventaris"
                ariaLabel="Pilih inventaris untuk pemeliharaan"
                renderItemMeta={(asset) => (
                  <span>
                    {getDetailInventoryStatusLabel(asset)} · Kondisi: {getConditionLabel(asset)}
                  </span>
                )}
                noResultsLabel="Tidak ada hasil"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tipe Layanan</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tanggal &amp; Waktu Jadwal</label>
              <input
                ref={scheduledDateInputRef}
                type="datetime-local"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
                required
                step={60}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Teknisi/Penanggung Jawab</label>
              <input
                type="text"
                name="technician"
                value={formData.technician}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="Opsional"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Dapat diisi setelah teknisi atau penanggung jawab ditentukan.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                {visibleStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!maintenance && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pengajuan baru selalu masuk ke tahap diajukan dan harus disetujui sebelum lanjut ke pengecekan.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Biaya (Rp)</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="Opsional"
              />
            </div>

            {formData.status === "cancelled" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Alasan Pembatalan</label>
                <input
                  type="text"
                  name="cancellationReason"
                  value={formData.cancellationReason}
                  onChange={handleChange}
                  required
                  list="maintenance-cancellation-reasons"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  placeholder="Pilih atau ketik alasan pembatalan"
                />
                <datalist id="maintenance-cancellation-reasons">
                  {CANCELLATION_REASON_OPTIONS.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                <p className="mt-1 text-xs text-muted-foreground">
                  Contoh: {CANCELLATION_REASON_OPTIONS.join(", ")}
                </p>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Catatan Perbaikan</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                rows={3}
                placeholder="Catatan perbaikan (cantumkan keluhan dan alat yang diperiksa)"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <div className="flex items-center gap-3">
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={hasActiveUsage && ["scheduled","in_progress","completed"].includes(formData.status)}>
                Simpan
              </Button>
              {hasActiveUsage && ["scheduled","in_progress","completed"].includes(formData.status) && (
                <p className="text-sm text-red-600">Aset sedang digunakan — hentikan penggunaan terlebih dahulu untuk membuat pemeliharaan aktif.</p>
              )}
            </div>
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
