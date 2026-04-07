import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MedicalAsset } from "@/types/medical-assets-types"
import { MEDICAL_ASSET_TYPE_OPTIONS, getMedicalAssetTypeLabel } from "@/constants/medical-asset-types"
import { MEDICAL_USAGE_OPTIONS } from "@/utils/medical-asset-usage"
import { X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

type ConditionType = "Baik" | "Cukup" | "Rusak"
type StatusType = "Aktif" | "Non-Aktif" | "Dalam Perbaikan"

function toDateInputValue(value?: string | null) {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function MedicalAssetForm({
  asset,
  onSave,
  onCancel,
}: {
  asset?: MedicalAsset | null
  onSave: (asset: MedicalAsset) => void
  onCancel: () => void
}) {
  const defaultTypeValue =
    MEDICAL_ASSET_TYPE_OPTIONS[0]?.value ?? ("" as MedicalAsset["type"])
  const defaultTypeLabel = getMedicalAssetTypeLabel(defaultTypeValue)

  const [formData, setFormData] = useState({
    assetCode: "",
    inventoryName: "",
    type: defaultTypeValue,
    name: "",
    serialNumber: "",
    purchaseDate: "",
    lastMaintenance: "",
    nextMaintenance: "",
    condition: "Baik" as ConditionType,
    status: "Aktif" as StatusType,
    notes: "",
    usagePurpose: MEDICAL_USAGE_OPTIONS[0],
  })
  const [typeSearch, setTypeSearch] = useState(defaultTypeLabel)
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false)
  const typeSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (asset) {
      const typeValue = asset.type ?? defaultTypeValue
      setFormData({
        assetCode: asset.assetCode ?? "",
        inventoryName: asset.inventoryName ?? "",
        type: typeValue,
        name: asset.name ?? "",
        serialNumber: asset.serialNumber ?? "",
        purchaseDate: toDateInputValue(asset.purchaseDate),
        lastMaintenance: toDateInputValue(asset.lastMaintenance),
        nextMaintenance: toDateInputValue(asset.nextMaintenance),
        condition: (asset.condition as ConditionType) ?? "Baik",
        status: (asset.status as StatusType) ?? "Aktif",
        notes: asset.notes ?? "",
        usagePurpose: asset.usagePurpose ?? MEDICAL_USAGE_OPTIONS[0],
      })
      const resolvedLabel = getMedicalAssetTypeLabel(typeValue) || getMedicalAssetTypeLabel(defaultTypeValue)
      setTypeSearch(resolvedLabel)
    } else {
      setTypeSearch(getMedicalAssetTypeLabel(defaultTypeValue))
    }
  }, [asset, defaultTypeValue])

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
      return MEDICAL_ASSET_TYPE_OPTIONS
    }

    return MEDICAL_ASSET_TYPE_OPTIONS.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.category.toLowerCase().includes(query),
    )
  }, [typeSearch])

  const selectTypeOption = (option: (typeof MEDICAL_ASSET_TYPE_OPTIONS)[number]) => {
    setTypeSearch(option.label)
    setFormData((prev) => ({ ...prev, type: option.value }))
    setShowTypeSuggestions(false)
  }

  const handleTypeInputChange = (value: string) => {
    setTypeSearch(value)
    setShowTypeSuggestions(true)
    const exactMatch = MEDICAL_ASSET_TYPE_OPTIONS.find(
      (option) => option.label.toLowerCase() === value.trim().toLowerCase(),
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
        <CardTitle className="text-lg">{asset ? "Edit Inventaris Medis" : "Tambah Inventaris Medis Baru"}</CardTitle>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Kode Barang *</label>
              <input
                type="text"
                name="assetCode"
                value={formData.assetCode}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                placeholder="MED-EKG-001"
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
                placeholder="ECG/EKG 12 Lead"
              />
            </div>

            <div ref={typeSelectorRef} className="relative">
              <label className="block text-sm font-medium mb-1">Tipe Peralatan Medis</label>
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
                placeholder="Philips, GE, Siemens"
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
                {MEDICAL_USAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
