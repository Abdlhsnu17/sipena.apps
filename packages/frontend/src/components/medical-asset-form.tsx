import { MEDICAL_ASSET_CATEGORIES } from "@/components/medical-asset-categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MEDICAL_ASSET_TYPE_OPTIONS } from "@/constants/medical-asset-types";
import type { MedicalAsset } from "@/types/medical-assets-types";
import { inferMedicalUsagePurpose, matchMedicalTypeFromInventoryName } from "@/utils/asset-function-classifier";
import { MEDICAL_USAGE_OPTIONS } from "@/utils/medical-asset-usage";
import { buildUsagePurposeOptions, normalizeUsagePurpose } from "@/utils/usage-purpose";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ConditionType = "Baik" | "Cukup" | "Rusak"
type StatusType = "Aktif" | "Non-Aktif" | "Dalam Perbaikan" | "Sedang Digunakan" | "Dipinjam"

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

const createInitialFormData = (defaultTypeValue: MedicalAsset["type"]) => ({
  assetCode: "",
  inventoryName: "",
  type: defaultTypeValue,
  name: "",
  serialNumber: "",
  purchaseDate: "",
  lastMaintenance: "",
  lastRepair: "",
  nextMaintenance: "",
  condition: "Baik" as ConditionType,
  status: "Aktif" as StatusType,
  notes: "",
  usagePurpose: normalizeUsagePurpose(inferMedicalUsagePurpose("", defaultTypeValue), MEDICAL_USAGE_OPTIONS),
})

const createCustomTypeOption = (value: string) => ({
  value,
  label: value,
  category: "Kategori Tipe",
})

export default function MedicalAssetForm({
  asset,
  onSave,
  onCancel,
}: {
  asset?: MedicalAsset | null
  onSave: (asset: MedicalAsset) => void
  onCancel: () => void
}) {
  const medicalTypeCategoryOptions = useMemo(
    () =>
      Array.from(new Set(MEDICAL_ASSET_TYPE_OPTIONS.map((option) => option.category)))
        .sort((a, b) => a.localeCompare(b))
        .map((category) => ({
          value: category,
          label: category,
          category: "Kategori Tipe",
        })),
    [],
  )

  const defaultTypeValue =
    (medicalTypeCategoryOptions[0]?.value as MedicalAsset["type"]) ?? ("Perlengkapan Ruang Perawatan" as MedicalAsset["type"])
  const defaultTypeLabel = defaultTypeValue

  const [formData, setFormData] = useState(createInitialFormData(defaultTypeValue))
  const [typeSearch, setTypeSearch] = useState(defaultTypeLabel)
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false)
  const [showInventorySuggestions, setShowInventorySuggestions] = useState(false)
  const typeSelectorRef = useRef<HTMLDivElement>(null)
  const inventorySelectorRef = useRef<HTMLDivElement>(null)

  const inventoryOptions = useMemo(
    () =>
      Object.values(MEDICAL_ASSET_CATEGORIES).flatMap((category) => category.assetTypes).filter((assetType, index, all) => {
        return all.indexOf(assetType) === index
      }),
    [],
  )

  useEffect(() => {
    if (asset) {
      const typeValue = asset.type ?? defaultTypeValue
      const resolvedTypeCategory =
        MEDICAL_ASSET_TYPE_OPTIONS.find((option) => option.value === typeValue)?.category ?? typeValue
      setFormData({
        assetCode: asset.assetCode ?? "",
        inventoryName: asset.inventoryName ?? "",
        type: resolvedTypeCategory,
        name: asset.name ?? "",
        serialNumber: asset.serialNumber ?? "",
        purchaseDate: toDateInputValue(asset.purchaseDate),
        lastMaintenance: toDateInputValue(asset.lastMaintenance),
        lastRepair: toDateInputValue(asset.lastRepair),
        nextMaintenance: toDateInputValue(asset.nextMaintenance),
        condition: (asset.condition as ConditionType) ?? "Baik",
        status: (asset.status as StatusType) ?? "Aktif",
        notes: asset.notes ?? "",
        usagePurpose: normalizeUsagePurpose(
          asset.usagePurpose ?? inferMedicalUsagePurpose(asset.inventoryName, resolvedTypeCategory),
          MEDICAL_USAGE_OPTIONS,
        ),
      })
      setTypeSearch(resolvedTypeCategory)
    } else {
      setFormData(createInitialFormData(defaultTypeValue))
      setTypeSearch(defaultTypeValue)
    }
  }, [asset, defaultTypeValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeSelectorRef.current && !typeSelectorRef.current.contains(event.target as Node)) {
        setShowTypeSuggestions(false)
      }
      if (inventorySelectorRef.current && !inventorySelectorRef.current.contains(event.target as Node)) {
        setShowInventorySuggestions(false)
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
      assetCode: formData.assetCode.trim(),
      inventoryName: formData.inventoryName.trim(),
      name: formData.name.trim(),
      serialNumber: formData.serialNumber.trim(),
      notes: formData.notes.trim(),
      usagePurpose: normalizeUsagePurpose(formData.usagePurpose, MEDICAL_USAGE_OPTIONS),
      id: asset?.id || Date.now().toString(),
      roomId: asset?.roomId || "",
    })
  }

  const typeOptions = useMemo(() => {
    const customType = formData.type?.trim()
    if (!customType) {
      return medicalTypeCategoryOptions
    }

    const alreadyExists = medicalTypeCategoryOptions.some(
      (option) => option.value.toLowerCase() === customType.toLowerCase(),
    )
    if (alreadyExists) {
      return medicalTypeCategoryOptions
    }

    return [createCustomTypeOption(customType), ...medicalTypeCategoryOptions]
  }, [formData.type, medicalTypeCategoryOptions])

  const filteredTypedOptions = useMemo(() => {
    const query = typeSearch.trim().toLowerCase()
    if (!query) {
      return typeOptions
    }

    return typeOptions.filter((option) => option.label.toLowerCase().includes(query))
  }, [typeOptions, typeSearch])

  const inferredUsagePurpose = useMemo(
    () => normalizeUsagePurpose(inferMedicalUsagePurpose(formData.inventoryName, formData.type), MEDICAL_USAGE_OPTIONS),
    [formData.inventoryName, formData.type],
  )

  const usagePurposeOptions = useMemo(
    () => buildUsagePurposeOptions(MEDICAL_USAGE_OPTIONS, formData.usagePurpose),
    [formData.usagePurpose],
  )

  const selectTypeOption = (option: { value: string; label: string; category: string }) => {
    setTypeSearch(option.value)
    setFormData((prev) => ({
      ...prev,
      type: option.value,
      usagePurpose: normalizeUsagePurpose(inferMedicalUsagePurpose(prev.inventoryName, option.value), MEDICAL_USAGE_OPTIONS),
    }))
    setShowTypeSuggestions(false)
  }

  const handleTypeInputChange = (value: string) => {
    setTypeSearch(value)
    setShowTypeSuggestions(true)
    const exactMatch = typeOptions.find(
      (option) =>
        option.value.toLowerCase() === value.trim().toLowerCase() ||
        option.label.toLowerCase() === value.trim().toLowerCase(),
    )
    setFormData((prev) => ({
      ...prev,
      type: exactMatch?.value ?? value.trim(),
      usagePurpose: normalizeUsagePurpose(
        inferMedicalUsagePurpose(prev.inventoryName, exactMatch?.value ?? value.trim()),
        MEDICAL_USAGE_OPTIONS,
      ),
    }))
  }

  const handleTypeInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setShowTypeSuggestions(false)
      return
    }

    if (event.key === "Enter" && showTypeSuggestions && filteredTypedOptions.length > 0) {
      event.preventDefault()
      selectTypeOption(filteredTypedOptions[0])
    }
  }

  const filteredInventoryOptions = useMemo(() => {
    const query = formData.inventoryName.trim().toLowerCase()
    if (!query) {
      return inventoryOptions
    }

    return inventoryOptions.filter((option) => option.toLowerCase().includes(query))
  }, [formData.inventoryName, inventoryOptions])

  const selectInventoryOption = (value: string) => {
    const matchedTypeOption = matchMedicalTypeFromInventoryName(value)
    if (matchedTypeOption) {
      setTypeSearch(matchedTypeOption.category)
    }
    setFormData((prev) => {
      const resolvedType = matchedTypeOption?.category ?? prev.type
      return {
        ...prev,
        inventoryName: value,
        type: resolvedType,
        usagePurpose: normalizeUsagePurpose(
          inferMedicalUsagePurpose(value, matchedTypeOption?.value ?? resolvedType),
          MEDICAL_USAGE_OPTIONS,
        ),
      }
    })
    setShowInventorySuggestions(false)
  }

  const handleInventoryInputChange = (value: string) => {
    const matchedTypeOption = matchMedicalTypeFromInventoryName(value)
    if (matchedTypeOption) {
      setTypeSearch(matchedTypeOption.category)
    }
    setFormData((prev) => {
      const resolvedType = matchedTypeOption?.category ?? prev.type
      return {
        ...prev,
        inventoryName: value,
        type: resolvedType,
        usagePurpose: normalizeUsagePurpose(
          inferMedicalUsagePurpose(value, matchedTypeOption?.value ?? resolvedType),
          MEDICAL_USAGE_OPTIONS,
        ),
      }
    })
    setShowInventorySuggestions(true)
  }

  const handleInventoryInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setShowInventorySuggestions(false)
      return
    }

    if (event.key === "Enter" && showInventorySuggestions && filteredInventoryOptions.length > 0) {
      event.preventDefault()
      selectInventoryOption(filteredInventoryOptions[0])
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
          <div className="grid mobile-form-grid gap-3">
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
            <div ref={inventorySelectorRef} className="relative">
              <label className="block text-sm font-medium mb-1">Nama Inventaris *</label>
              <input
                type="text"
                name="inventoryName"
                value={formData.inventoryName}
                onChange={(e) => handleInventoryInputChange(e.target.value)}
                onFocus={() => setShowInventorySuggestions(true)}
                onKeyDown={handleInventoryInputKeyDown}
                autoComplete="off"
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                placeholder="Cari atau ketik nama inventaris medis"
              />
              {showInventorySuggestions && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
                  {filteredInventoryOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada hasil pencarian</div>
                  ) : (
                    filteredInventoryOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectInventoryOption(option)}
                        className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted"
                      >
                        <span className="leading-tight">{option}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
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
                  {filteredTypedOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada hasil pencarian</div>
                  ) : (
                    filteredTypedOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectTypeOption(option)}
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted"
                      >
                        <span className="font-medium leading-tight">{option.label}</span>
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
                <option>Sedang Digunakan</option>
                <option>Dipinjam</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fungsi Aset</label>
              <select
                name="usagePurpose"
                value={formData.usagePurpose}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              >
                {usagePurposeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">{inferredUsagePurpose}</p>
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
              <label className="block text-sm font-medium mb-1">Perbaikan Terakhir</label>
              <input
                type="date"
                name="lastRepair"
                value={formData.lastRepair}
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
