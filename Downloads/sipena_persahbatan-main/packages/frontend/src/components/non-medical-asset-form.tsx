
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { NonMedicalAsset } from "@/types/non-medical-assets-types"
import { X } from "lucide-react"
import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  getNonMedicalAssetTypeLabel,
  NON_MEDICAL_ASSET_TYPE_LABELS,
  NON_MEDICAL_ASSET_TYPE_OPTIONS,
} from "@/constants/non-medical-asset-types"
import { USAGE_OPTIONS } from "@/utils/asset-usage"

export default function NonMedicalAssetForm({
  asset,
  onSave,
  onCancel,
}: {
  asset?: NonMedicalAsset | null
  onSave: (asset: NonMedicalAsset) => void
  onCancel: () => void
}) {
  const defaultTypeValue =
    NON_MEDICAL_ASSET_TYPE_OPTIONS[0]?.value ?? ("genset" as NonMedicalAsset["type"])
  const defaultTypeLabel = NON_MEDICAL_ASSET_TYPE_LABELS[defaultTypeValue] ?? ""

  const [formData, setFormData] = useState({
    assetCode: "",
    inventoryName: "",
    type: defaultTypeValue,
    name: "",
    serialNumber: "",
    purchaseDate: "",
    lastMaintenance: "",
    nextMaintenance: "",
    condition: "Baik" as "Baik" | "Cukup" | "Rusak",
    status: "Aktif" as "Aktif" | "Non-Aktif" | "Dalam Perbaikan",
    notes: "",
    usagePurpose: "Operasional Bersama",
  })
  const [typeSearch, setTypeSearch] = useState(defaultTypeLabel)
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false)
  const typeSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (asset) {
      const resolvedType = asset.type ?? defaultTypeValue
      const resolvedTypeLabel = getNonMedicalAssetTypeLabel(resolvedType) ?? defaultTypeLabel
      setFormData({
        assetCode: asset.assetCode ?? "",
        inventoryName: asset.inventoryName ?? "",
        type: resolvedType,
        name: asset.name ?? "",
        serialNumber: asset.serialNumber ?? "",
        purchaseDate: asset.purchaseDate ?? "",
        lastMaintenance: asset.lastMaintenance ?? "",
        nextMaintenance: asset.nextMaintenance ?? "",
        condition: asset.condition ?? "Baik",
        status: asset.status ?? "Aktif",
        notes: asset.notes ?? "",
        usagePurpose: asset.usagePurpose ?? "Operasional Bersama",
      })
      setTypeSearch(resolvedTypeLabel)
    } else {
      setTypeSearch(defaultTypeLabel)
    }
  }, [asset, defaultTypeLabel, defaultTypeValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeSelectorRef.current && !typeSelectorRef.current.contains(event.target as Node)) {
        setShowTypeSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      id: asset?.id || Date.now().toString(),
      roomId: asset?.roomId || "",
    })
  }

  const filteredTypeOptions = useMemo(() => {
    const query = typeSearch.trim().toLowerCase()
    if (!query) {
      return NON_MEDICAL_ASSET_TYPE_OPTIONS
    }

    return NON_MEDICAL_ASSET_TYPE_OPTIONS.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.category.toLowerCase().includes(query)
    )
  }, [typeSearch])

  const selectTypeOption = (option: typeof NON_MEDICAL_ASSET_TYPE_OPTIONS[number]) => {
    setTypeSearch(option.label)
    setFormData((prev) => ({ ...prev, type: option.value }))
    setShowTypeSuggestions(false)
  }

  const handleTypeInputChange = (value: string) => {
    setTypeSearch(value)
    setShowTypeSuggestions(true)
    const exactMatch = NON_MEDICAL_ASSET_TYPE_OPTIONS.find(
      (option) => option.label.toLowerCase() === value.trim().toLowerCase()
    )
    if (exactMatch) {
      setFormData((prev) => ({ ...prev, type: exactMatch.value }))
    }
  }

  const handleTypeInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setShowTypeSuggestions(false)
      return
    }

    if (event.key === "Enter" && showTypeSuggestions && filteredTypeOptions.length > 0) {
      event.preventDefault()
      selectTypeOption(filteredTypeOptions[0])
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">{asset ? "Edit Inventaris Non-Medis" : "Tambah Inventaris Non-Medis Baru"}</CardTitle>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Kode Barang *</label>
              <input
                type="text"
                name="assetCode"
                value={formData.assetCode}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                placeholder="NON-MED-GEN-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Inventaris *</label>
              <input
                type="text"
                name="inventoryName"
                value={formData.inventoryName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                placeholder="Generator Set 1000KVA"
              />
            </div>

            <div ref={typeSelectorRef} className="relative">
              <label className="block text-sm font-medium mb-1">Tipe Peralatan Non-Medis</label>
              <input
                type="text"
                value={typeSearch}
                onChange={(e) => handleTypeInputChange(e.target.value)}
                onFocus={() => setShowTypeSuggestions(true)}
                onKeyDown={handleTypeInputKeyDown}
                autoComplete="off"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                placeholder="Cari tipe peralatan"
                aria-expanded={showTypeSuggestions}
              />
              {showTypeSuggestions && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                  {filteredTypeOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada hasil pencarian</div>
                  ) : (
                    filteredTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectTypeOption(option)}
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted"
                      >
                        <span className="font-medium leading-tight">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.category}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Merk/Model</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                placeholder="Caterpillar, Cummins, Yamaha"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nomor Seri</label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                placeholder="SN-12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Beli *</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kondisi</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              >
                <option>Baik</option>
                <option>Cukup</option>
                <option>Rusak</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              >
                <option>Aktif</option>
                <option>Non-Aktif</option>
                <option>Dalam Perbaikan</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Penggunaan Aset</label>
              <select
                name="usagePurpose"
                value={formData.usagePurpose}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              >
                {USAGE_OPTIONS.map((usage) => (
                  <option key={usage} value={usage}>
                    {usage}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pemeliharaan Terakhir</label>
              <input
                type="date"
                name="lastMaintenance"
                value={formData.lastMaintenance}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pemeliharaan Berikutnya</label>
              <input
                type="date"
                name="nextMaintenance"
                value={formData.nextMaintenance}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Catatan</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              placeholder="Opsional"
              rows={2}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="bg-teal-600 hover:bg-teal-700 flex-1">
              Simpan
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
