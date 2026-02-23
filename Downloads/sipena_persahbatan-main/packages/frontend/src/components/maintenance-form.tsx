"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import InventoryPicker from "@/components/inventory-picker"
import { buildInventorySearchKey } from "@/utils/inventory-search"

interface MaintenanceFormProps {
  maintenance: any
  assets: DetailInventoryItem[]
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

export default function MaintenanceForm({ maintenance, assets, onSave, onCancel }: MaintenanceFormProps) {
  const [selectedAsset, setSelectedAsset] = useState<DetailInventoryItem | null>(null)
  const defaultRepairNote = useMemo(() => buildRepairNoteTemplate(selectedAsset), [selectedAsset])
  const prevAutoRepairNoteRef = useRef(defaultRepairNote)

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
    description: buildRepairNoteTemplate(null),
    technician: "",
    status: "scheduled",
    cost: "",
  }))

  const typeOptions = [
    { value: "preventive", label: "Rutin" },
    { value: "corrective", label: "Perbaikan" },
    { value: "calibration", label: "Kalibrasi" },
    { value: "inspection", label: "Inspeksi" },
  ]
  const statusOptions = [
    { value: "scheduled", label: "Tertunda" },
    { value: "in_progress", label: "Proses" },
    { value: "completed", label: "Selesai" },
    { value: "cancelled", label: "Dibatalkan" },
  ]

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
      scheduledDate: maintenance.scheduledDate ? String(maintenance.scheduledDate).split("T")[0] : "",
      description: maintenance.description ?? buildRepairNoteTemplate(resolvedAsset),
      technician: maintenance.technician || "",
      status: maintenance.status || "scheduled",
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
  }

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
    const resolvedAsset = selectedAsset ?? findMatchedAsset()
    const {
      inventarisInput,
      assetDetailId,
      assetDetailName,
      assetDetailCode,
      assetLocation,
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
      assetLocation: resolvedAsset?.assetLocation || assetLocation || "",
    }
    console.log("SELECTED ASSET ID:", resolvedAsset?.assetId, resolvedAsset?.detailId)
    console.log("PAYLOAD:", payload)
    onSave(payload)
  }


  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>{maintenance ? "Edit Jadwal Pemeliharaan" : "Tambah Jadwal Pemeliharaan"}</CardTitle>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Pilih Inventaris</label>
              <InventoryPicker
                assets={assets}
                selectedAsset={selectedAsset}
                onSelect={(asset) => {
                  handleSelectAsset(asset)
                }}
                formatLabel={formatAssetLabel}
                getItemKey={getDetailInventoryKey}
                searchValue={buildInventorySearchKey}
                placeholder="Cari inventaris..."
                buttonLabel="Pilih inventaris"
                renderItemMeta={(asset) => asset.roomName || asset.assetLocation}
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
              <label className="block text-sm font-medium text-foreground mb-2">Tanggal Jadwal</label>
              <input
                type="date"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
                required
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
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="Nama teknisi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">Catatan Perbaikan</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                rows={3}
                placeholder="Catatan perbaikan (cantumkan keluhan dan alat yang diperiksa)"
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
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
