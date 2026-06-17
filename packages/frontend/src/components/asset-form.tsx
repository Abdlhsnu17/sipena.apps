"use client"

import { useState, useEffect, ChangeEvent, FormEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

type AssetFormValues = {
  name: string
  category: string
  location: string
  purchaseDate: string
  serialNumber: string
  condition: string
  status: string
  notes: string
}

type AssetFormProps = {
  asset?: Partial<AssetFormValues>
  onSave: (values: AssetFormValues) => void
  onCancel: () => void
}

const initialFormData: AssetFormValues = {
  name: "",
  category: "AC",
  location: "",
  purchaseDate: "",
  serialNumber: "",
  condition: "Baik",
  status: "Tersedia",
  notes: "",
}

const normalizeStatusLabel = (status?: string) => {
  if (status === "Aktif") return "Tersedia"
  if (status === "Tidak Aktif" || status === "Non-Aktif") return "Nonaktif"
  return status
}

export default function AssetForm({ asset, onSave, onCancel }: AssetFormProps) {
  const [formData, setFormData] = useState<AssetFormValues>(initialFormData)

  useEffect(() => {
    if (asset) {
      setFormData((prev) => ({
        ...prev,
        ...asset,
        status: normalizeStatusLabel(asset.status) ?? prev.status,
      }))
    } else {
      setFormData(initialFormData)
    }
  }, [asset])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(formData)
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle>{asset ? "Edit Inventaris" : "Tambah Inventaris Baru"}</CardTitle>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nama Inventaris</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="Contoh: AC Unit Ruang Kepala"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Kategori</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option>AC</option>
                <option>Komputer</option>
                <option>Genset</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Lokasi</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="Contoh: Ruang Kepala Bagian"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Tanggal Pembelian</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nomor Seri</label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="Opsional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Kondisi</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option>Baik</option>
                <option>Cukup</option>
                <option>Rusak</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                <option>Tersedia</option>
                <option>Nonaktif</option>
                <option>Pemeliharaan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Catatan</label>
              <input
                type="text"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="Opsional"
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
