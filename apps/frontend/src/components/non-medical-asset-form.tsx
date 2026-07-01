
import {
    NON_MEDICAL_ASSET_CATEGORIES,
    NON_MEDICAL_ASSET_CLASSIFICATIONS,
} from "@/components/non-medical-asset-categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    NON_MEDICAL_ASSET_TYPE_OPTIONS,
} from "@/constants/non-medical-asset-types";
import type { NonMedicalAsset } from "@/types/non-medical-assets-types";
import { maintenanceDetailStatusLabels } from "@/utils/api-mappers";
import { inferNonMedicalUsagePurpose, matchNonMedicalTypeFromInventoryName } from "@/utils/asset-function-classifier";
import { USAGE_OPTIONS } from "@/utils/asset-usage";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { buildUsagePurposeOptions, normalizeUsagePurpose } from "@/utils/usage-purpose";
import { X } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ConditionType = "Baik" | "Cukup" | "Rusak"
type StatusType = NonMedicalAsset["status"]

const normalizeAssetStatusLabel = (status?: string | null): StatusType => {
  if (status === "Aktif") return "Tersedia"
  if (status === "Non-Aktif") return "Nonaktif"
  return (status as StatusType) || "Tersedia"
}

function toDateInputValue(value?: string | null) {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) return ""
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, "0")
  const day = String(dateValue.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const createInitialFormData = (defaultTypeValue: NonMedicalAsset["type"]) => ({
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
  status: "Tersedia" as StatusType,
  notes: "",
  usagePurpose: normalizeUsagePurpose(inferNonMedicalUsagePurpose("", defaultTypeValue), USAGE_OPTIONS),
})

const createCustomTypeOption = (value: string) => ({
  value,
  label: value,
  category: "Tipe Manual",
})

export default function NonMedicalAssetForm({
  asset,
  onSave,
  onCancel,
}: {
  asset?: NonMedicalAsset | null
  onSave: (asset: NonMedicalAsset) => void
  onCancel: () => void
}) {
  const nonMedicalTypeCategoryOptions = useMemo(
    () =>
      Array.from(new Set(NON_MEDICAL_ASSET_TYPE_OPTIONS.map((option) => option.category)))
        .sort((a, b) => a.localeCompare(b))
        .map((category) => ({
          value: category,
          label: category,
        })),
    [],
  )

  const defaultTypeValue =
    (nonMedicalTypeCategoryOptions[0]?.value as NonMedicalAsset["type"]) ??
    ("IT & Elektronik" as NonMedicalAsset["type"])
  const defaultTypeLabel = defaultTypeValue

  const [formData, setFormData] = useState(createInitialFormData(defaultTypeValue))
  const [typeSearch, setTypeSearch] = useState(defaultTypeLabel)
  const [showInventorySuggestions, setShowInventorySuggestions] = useState(false)
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false)
  const inventorySelectorRef = useRef<HTMLDivElement>(null)
  const typeSelectorRef = useRef<HTMLDivElement>(null)

  const inventoryOptions = useMemo(() => {
    const uniqueOptions = new Set<string>()

    Object.values(NON_MEDICAL_ASSET_CATEGORIES).forEach((category) => {
      category.assetTypes.forEach((assetType) => {
        uniqueOptions.add(assetType)
      })
    })

    return Array.from(uniqueOptions)
  }, [])

  useEffect(() => {
    if (asset) {
      const resolvedType = asset.type ?? defaultTypeValue
      const resolvedTypeCategory =
        NON_MEDICAL_ASSET_TYPE_OPTIONS.find((option) => option.value === resolvedType)?.category ?? resolvedType
      setFormData({
        assetCode: asset.assetCode ?? "",
        inventoryName: asset.inventoryName ?? "",
        type: resolvedTypeCategory,
        name: asset.name ?? (asset as NonMedicalAsset & { brandModel?: string }).brandModel ?? "",
        serialNumber: asset.serialNumber ?? "",
        purchaseDate: toDateInputValue(asset.purchaseDate),
        lastMaintenance: toDateInputValue(asset.lastMaintenance),
        lastRepair: toDateInputValue(asset.lastRepair),
        nextMaintenance: toDateInputValue(asset.nextMaintenance),
        condition: (asset.condition as ConditionType) ?? "Baik",
        status: normalizeAssetStatusLabel(asset.status),
        notes: asset.notes ?? "",
        usagePurpose: normalizeUsagePurpose(
          asset.usagePurpose ?? inferNonMedicalUsagePurpose(asset.inventoryName, resolvedTypeCategory),
          USAGE_OPTIONS,
        ),
      })
      setTypeSearch(resolvedTypeCategory)
    } else {
      setFormData(createInitialFormData(defaultTypeValue))
      setTypeSearch(defaultTypeValue)
    }
  }, [asset, defaultTypeLabel, defaultTypeValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inventorySelectorRef.current && !inventorySelectorRef.current.contains(event.target as Node)) {
        setShowInventorySuggestions(false)
      }
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
    
    // Validate required fields
    if (!formData.assetCode.trim()) {
      alert("Kode Barang wajib diisi")
      return
    }
    if (!formData.inventoryName.trim()) {
      alert("Nama Inventaris wajib diisi")
      return
    }
    if (!formData.purchaseDate) {
      alert("Tanggal Beli wajib diisi")
      return
    }

    const resolvedType = formData.type?.trim() || typeSearch.trim() || defaultTypeValue
    
    const assetData: NonMedicalAsset = {
      ...formData,
      type: resolvedType as NonMedicalAsset["type"],
      id: asset?.id || Date.now().toString(),
      roomId: asset?.roomId || "",
      // Ensure all fields are included
      assetCode: formData.assetCode.trim(),
      inventoryName: formData.inventoryName.trim(),
      name: formData.name.trim(),
      serialNumber: formData.serialNumber.trim(),
      notes: formData.notes.trim(),
      purchaseDate: formData.purchaseDate,
      lastMaintenance: formData.lastMaintenance,
      lastRepair: formData.lastRepair,
      nextMaintenance: formData.nextMaintenance,
      condition: formData.condition as "Baik" | "Cukup" | "Rusak",
      status: formData.status as StatusType,
      usagePurpose: normalizeUsagePurpose(formData.usagePurpose, USAGE_OPTIONS),
    }
    
    onSave(assetData)
  }

  const typeOptions = useMemo(() => {
    const customType = formData.type?.trim()
    if (!customType) {
      return nonMedicalTypeCategoryOptions.map((option) => ({
        ...option,
        category: "Kategori Tipe",
      }))
    }

    const baseOptions = nonMedicalTypeCategoryOptions.map((option) => ({
      ...option,
      category: "Kategori Tipe",
    }))

    const alreadyExists = baseOptions.some((option) => option.value.toLowerCase() === customType.toLowerCase())
    if (alreadyExists) {
      return baseOptions
    }

    return [createCustomTypeOption(customType), ...baseOptions]
  }, [formData.type, nonMedicalTypeCategoryOptions])

  const filteredInventoryOptions = useMemo(() => {
    const query = formData.inventoryName.trim()
    if (!query) {
      return inventoryOptions
    }

    return inventoryOptions.filter((option) => matchesSearchKeyword(query, [option]))
  }, [formData.inventoryName, inventoryOptions])

  const classificationByInventoryName = useMemo(() => {
    const lookup = new Map<string, (typeof NON_MEDICAL_ASSET_CLASSIFICATIONS)[number]>()

    NON_MEDICAL_ASSET_CLASSIFICATIONS.forEach((classification) => {
      lookup.set(classification.inventoryName.trim().toLowerCase(), classification)
      classification.aliases.forEach((alias) => {
        lookup.set(alias.trim().toLowerCase(), classification)
      })
    })

    return lookup
  }, [])

  const resolveMatchedType = (inventoryName: string) => {
    const exactType = matchNonMedicalTypeFromInventoryName(inventoryName)
    if (exactType) {
      return {
        typeValue: exactType.category,
        typeLabel: exactType.category,
        usagePurpose: inferNonMedicalUsagePurpose(inventoryName, exactType.value),
      }
    }

    const classification = classificationByInventoryName.get(inventoryName.trim().toLowerCase())
    if (!classification) {
      return undefined
    }

    const recommendedTypeOption = NON_MEDICAL_ASSET_TYPE_OPTIONS.find(
      (option) => option.label.toLowerCase() === classification.recommendedType.toLowerCase(),
    )

    if (!recommendedTypeOption) {
      return {
        typeValue: classification.recommendedTypeCategory,
        typeLabel: classification.recommendedTypeCategory,
        usagePurpose: classification.usagePurpose,
      }
    }

    return {
      typeValue: recommendedTypeOption.category,
      typeLabel: recommendedTypeOption.category,
      usagePurpose: classification.usagePurpose,
    }
  }

  const selectInventoryOption = (value: string) => {
    const matchedType = resolveMatchedType(value)
    if (matchedType) {
      setTypeSearch(matchedType.typeLabel)
    }

    setFormData((prev) => {
      const resolvedType = matchedType?.typeValue ?? prev.type
      return {
        ...prev,
        inventoryName: value,
        type: resolvedType,
        usagePurpose: normalizeUsagePurpose(
          matchedType?.usagePurpose ?? inferNonMedicalUsagePurpose(value, resolvedType),
          USAGE_OPTIONS,
        ),
      }
    })
    setShowInventorySuggestions(false)
  }

  const handleInventoryInputChange = (value: string) => {
    const matchedType = resolveMatchedType(value)
    if (matchedType) {
      setTypeSearch(matchedType.typeLabel)
    }

    setFormData((prev) => {
      const resolvedType = matchedType?.typeValue ?? prev.type
      return {
        ...prev,
        inventoryName: value,
        type: resolvedType,
        usagePurpose: normalizeUsagePurpose(
          matchedType?.usagePurpose ?? inferNonMedicalUsagePurpose(value, resolvedType),
          USAGE_OPTIONS,
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

  const filteredTypeOptions = useMemo(() => {
    const query = typeSearch.trim().toLowerCase()
    if (!query) {
      return typeOptions
    }

    return typeOptions.filter(
      (option) =>
        option.value.toLowerCase().includes(query) ||
        option.label.toLowerCase().includes(query) ||
        option.category.toLowerCase().includes(query)
    )
  }, [typeOptions, typeSearch])

  const inferredUsagePurpose = useMemo(
    () => normalizeUsagePurpose(inferNonMedicalUsagePurpose(formData.inventoryName, formData.type), USAGE_OPTIONS),
    [formData.inventoryName, formData.type],
  )

  const usagePurposeOptions = useMemo(
    () => buildUsagePurposeOptions(USAGE_OPTIONS, formData.usagePurpose),
    [formData.usagePurpose],
  )

  const selectTypeOption = (option: { value: string; label: string; category: string }) => {
    setTypeSearch(option.value)
    setFormData((prev) => ({
      ...prev,
      type: option.value,
      usagePurpose: normalizeUsagePurpose(inferNonMedicalUsagePurpose(prev.inventoryName, option.value), USAGE_OPTIONS),
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
        inferNonMedicalUsagePurpose(prev.inventoryName, exactMatch?.value ?? value.trim()),
        USAGE_OPTIONS,
      ),
    }))
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
                placeholder="NON-MED-GEN-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama Inventaris *</label>
              <div ref={inventorySelectorRef} className="relative">
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
                  placeholder="Cari atau ketik nama inventaris non-medis"
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
                placeholder="Cari atau ketik tipe peralatan"
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
                <option>Tersedia</option>
                <option>Nonaktif</option>
                {maintenanceDetailStatusLabels.map((status) => (
                  <option key={status}>{status}</option>
                ))}
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
                {usagePurposeOptions.map((usage) => (
                  <option key={usage} value={usage}>
                    {usage}
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
