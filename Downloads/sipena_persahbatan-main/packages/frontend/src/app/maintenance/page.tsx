'use client'

import { Download, Edit2, Plus, Search, ShieldCheck, Trash2, UserCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import MaintenanceForm from "@/components/maintenance-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ExportFormat, SectionBuilder, DocumentSection, SectionLine, appendLine, exportNarrativeReport } from "@/utils/export-table"

import { assetService } from "@/services/asset.service"
import { getCurrentUser } from "@/services/auth-utils"
import { maintenanceService, type Maintenance } from "@/services/maintenance.service"
import type { User } from "@/types/auth-types"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { assetSourceLabel, deriveAssetSource, maintenanceStatusLabel, maintenanceTypeLabel } from "@/utils/api-mappers"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import { formatBracketedDateTime, formatDateId } from "@/utils/format"

type MaintenanceExportColumn = {
  key: string
  label: string
  getValue: (maintenance: Maintenance) => string
  defaultSelected?: boolean
}

export default function MaintenancePage() {
  const router = useRouter()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [assets, setAssets] = useState<DetailInventoryItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("Semua")

  // 1. Cek Autentikasi Pengguna
  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
    } else {
      setCurrentUser(user)
    }
  }, [router])

  const loadMaintenance = async () => {
    try {
      const response = await maintenanceService.getAll({ page: 1, limit: 1000 })
      if (response.success) setMaintenance(response.data)
    } catch (error) {
      console.error("Error loading maintenance:", error)
    }
  }

  const loadAssets = async () => {
    try {
      const [medicalResponse, nonMedicalResponse] = await Promise.all([
        assetService.getMedicalAssets({ page: 1, limit: 1000 }),
        assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
      ])

      const combinedAssets = [
        ...(medicalResponse.success ? medicalResponse.data : []),
        ...(nonMedicalResponse.success ? nonMedicalResponse.data : []),
      ]

      const detailItems = flattenDetailInventories(combinedAssets, { includeAssetFallback: true })
      setAssets(detailItems)
    } catch (error) {
      console.error("Error loading assets:", error)
    }
  }

  // 2. Muat Data Pemeliharaan dan Aset dari API
  useEffect(() => {
    void loadMaintenance()
    void loadAssets()
  }, [])

  // Cek hak akses penuh (Admin atau Leader)
  const hasFullAccess = currentUser?.role === "admin" || currentUser?.role === "leader"

  const handleSaveMaintenance = async (data: any) => {
    if (!currentUser) {
      alert("Anda harus login terlebih dahulu")
      return
    }
    if (!data.assetId || !data.scheduledDate || !data.description) {
      alert("Mohon lengkapi data pemeliharaan")
      return
    }

    try {
      if (editingMaintenance) {
        if (!hasFullAccess) {
          alert("Hanya Admin/Leader yang dapat mengedit jadwal pemeliharaan")
          return
        }

        const updatePayload: any = {
          assetId: Number(data.assetId),
          type: data.type,
          scheduledDate: data.scheduledDate,
          description: data.description,
          technician: data.technician || undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          status: data.status,
        }

        console.log("SELECTED ASSET ID (UPDATE):", updatePayload.assetId, updatePayload.assetDetailId)
        console.log("PAYLOAD (UPDATE):", updatePayload)
        const response = await maintenanceService.update(editingMaintenance.id, updatePayload)
        if (!response.success) {
          alert(response.message || "Gagal memperbarui jadwal pemeliharaan")
          return
        }
      } else {
        const newPayload = {
          assetId: Number(data.assetId),
          type: data.type,
          scheduledDate: data.scheduledDate,
          description: data.description,
          technician: data.technician || undefined,
          cost: data.cost ? Number(data.cost) : undefined,
          notes: data.notes || undefined,
          createdBy: Number(currentUser.id),
        }
        console.log("SELECTED ASSET ID (CREATE):", newPayload.assetId, data.assetDetailId)
        console.log("PAYLOAD (CREATE):", { ...newPayload, assetDetailId: data.assetDetailId, assetDetailName: data.assetDetailName, assetDetailCode: data.assetDetailCode, assetLocation: data.assetLocation })

        const response = await maintenanceService.create({
          ...newPayload,
          assetDetailId: data.assetDetailId,
          assetDetailName: data.assetDetailName,
          assetDetailCode: data.assetDetailCode,
          assetLocation: data.assetLocation,
        })

        if (!response.success) {
          alert(response.message || "Gagal menambah jadwal pemeliharaan")
          return
        }
      }

      await loadMaintenance()
      setShowForm(false)
      setEditingMaintenance(null)
    } catch (error: any) {
      alert(error?.message || "Gagal menyimpan jadwal pemeliharaan")
    }
  }

  const handleDeleteMaintenance = async (id: string | number) => {
    if (!hasFullAccess) {
      alert("Hanya Admin/Leader yang dapat menghapus jadwal pemeliharaan")
      return
    }
    if (!confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) return

    try {
      const response = await maintenanceService.delete(String(id))
      if (!response.success) {
        alert(response.message || "Gagal menghapus jadwal pemeliharaan")
        return
      }
      await loadMaintenance()
    } catch (error: any) {
      alert(error?.message || "Gagal menghapus jadwal pemeliharaan")
    }
  }

  const handleEditMaintenance = (data: Maintenance) => {
    if (!hasFullAccess) {
      alert("Hanya Admin/Leader yang dapat mengedit jadwal pemeliharaan")
      return
    }
    setEditingMaintenance(data)
    setShowForm(true)
  }

  const handleUpdateStatus = async (id: string | number, newStatus: string) => {
    if (!currentUser) {
      alert("Anda harus login terlebih dahulu")
      return
    }

    if (!hasFullAccess && newStatus === "completed") {
      alert("Hanya Admin/Leader yang dapat menandai pemeliharaan sebagai Selesai")
      return
    }

    try {
      if (newStatus === "completed") {
        const response = await maintenanceService.complete(String(id), undefined, undefined, Number(currentUser.id))
        if (!response.success) {
          alert(response.message || "Gagal menyelesaikan pemeliharaan")
          return
        }
      } else {
        const response = await maintenanceService.update(String(id), { status: newStatus as "scheduled" | "in_progress" | "completed" | "cancelled" })
        if (!response.success) {
          alert(response.message || "Gagal memperbarui status pemeliharaan")
          return
        }
      }

      await loadMaintenance()
    } catch (error: any) {
      alert(error?.message || "Gagal memperbarui status pemeliharaan")
    }
  }

  const detailLookup = useMemo(() => {
    const lookup = new Map<string, DetailInventoryItem>()
    for (const item of assets) {
      if (item.detailId) lookup.set(item.detailId, item)
    }
    return lookup
  }, [assets])

  const resolveDetailForMaintenance = useCallback(
    (m: Maintenance) => {
      if (m.assetDetailId) {
        const detail = detailLookup.get(m.assetDetailId)
        if (detail) return detail
      }
      const fallbackByCode = assets.find((a) => a.assetId === m.assetId && a.detailCode === m.assetDetailCode)
      if (fallbackByCode) return fallbackByCode
      return assets.find((a) => a.assetId === m.assetId)
    },
    [assets, detailLookup]
  )

  const maintenanceExportColumnDefinitions = useMemo<MaintenanceExportColumn[]>(
    () => [
      {
        key: "jenisInventaris",
        label: "Jenis Inventaris",
        getValue: (item) => {
          const detail = resolveDetailForMaintenance(item)
          const source = deriveAssetSource(detail?.assetType ?? item.assetType, detail?.detailCode ?? item.assetCode)
          return assetSourceLabel(source)
        },
        defaultSelected: true,
      },
      {
        key: "alat",
        label: "Alat",
        getValue: (item) =>
          item.assetDetailName ||
          resolveDetailForMaintenance(item)?.detailInventoryName ||
          resolveDetailForMaintenance(item)?.detailName ||
          item.assetName ||
          "-",
        defaultSelected: true,
      },
      {
        key: "kode",
        label: "Kode",
        getValue: (item) =>
          item.assetDetailCode ||
          resolveDetailForMaintenance(item)?.detailCode ||
          item.assetCode ||
          "-",
        defaultSelected: true,
      },
      {
        key: "jenisPemeliharaan",
        label: "Jenis Pemeliharaan",
        getValue: (item) => maintenanceTypeLabel(item.type),
        defaultSelected: true,
      },
      {
        key: "jadwal",
        label: "Jadwal Pemeliharaan",
        getValue: (item) => formatDateId(item.scheduledDate),
        defaultSelected: true,
      },
      {
        key: "pengirim",
        label: "Nama Pengirim",
        getValue: (item) => item.requesterName || "-",
        defaultSelected: true,
      },
      {
        key: "nipPengirim",
        label: "NIP Pengirim",
        getValue: (item) => item.requesterNip || "-",
        defaultSelected: true,
      },
      {
        key: "teknisi",
        label: "Teknisi",
        getValue: (item) => item.technician || "-",
        defaultSelected: true,
      },
      {
        key: "catatan",
        label: "Catatan",
        getValue: (item) => item.description || item.notes || "-",
        defaultSelected: true,
      },
      {
        key: "waktuLog",
        label: "Waktu Log",
        getValue: (item) => formatBracketedDateTime(item.completedDate ?? item.validatedAt ?? item.updatedAt) || "-",
        defaultSelected: true,
      },
      {
        key: "validator",
        label: "Validator",
        getValue: (item) =>
          item.validatorName || item.validatorNip
            ? `${item.validatorName || ""} ${item.validatorNip || ""}`.trim()
            : "Menunggu validasi",
        defaultSelected: true,
      },
      {
        key: "status",
        label: "Status",
        getValue: (item) => maintenanceStatusLabel(item.status),
        defaultSelected: true,
      },
    ],
    [resolveDetailForMaintenance]
  )

  const [selectedMaintenanceColumns, setSelectedMaintenanceColumns] = useState<string[]>(() =>
    maintenanceExportColumnDefinitions.filter((column) => column.defaultSelected ?? true).map((column) => column.key)
  )
  const [selectedMaintenanceIds, setSelectedMaintenanceIds] = useState<Set<number>>(() => new Set())

  const pendingCount = useMemo(
    () => maintenance.filter((m) => m.status === "scheduled" || m.status === "in_progress").length,
    [maintenance]
  )

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  const filteredMaintenance = maintenance.filter((m) => {
    const detailInfo = resolveDetailForMaintenance(m)
    const searchableValues = [
      m.assetName,
      m.assetCode,
      m.assetDetailName,
      m.assetDetailCode,
      detailInfo?.detailInventoryName,
      detailInfo?.detailName,
      detailInfo?.detailBrandModel,
      detailInfo?.detailCode,
      detailInfo?.assetName,
      detailInfo?.assetCode,
    ]
      .filter(Boolean)
      .map((text) => text!.toLowerCase())

    const matchesSearch =
      !normalizedSearchTerm ||
      searchableValues.some((text) => text.includes(normalizedSearchTerm))
    const matchesStatus = filterStatus === "Semua" || m.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const selectedMaintenanceRows = filteredMaintenance.filter((item) => selectedMaintenanceIds.has(item.id))
  const maintenanceRowsToExport =
    selectedMaintenanceRows.length > 0 ? selectedMaintenanceRows : filteredMaintenance

  const maintenanceAllSelected =
    filteredMaintenance.length > 0 && filteredMaintenance.every((item) => selectedMaintenanceIds.has(item.id))

  const toggleMaintenanceSelection = (id: number) => {
    setSelectedMaintenanceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleMaintenanceSelectAll = () => {
    if (maintenanceAllSelected) {
      setSelectedMaintenanceIds(new Set())
      return
    }
    setSelectedMaintenanceIds(new Set(filteredMaintenance.map((item) => item.id)))
  }

  const maintenanceColumnsForExport = maintenanceExportColumnDefinitions.filter((column) =>
    selectedMaintenanceColumns.includes(column.key)
  )

  const handleMaintenanceExportColumnToggle = (columnKey: string) => {
    setSelectedMaintenanceColumns((previous) => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous
        return previous.filter((item) => item !== columnKey)
      }
      return [...previous, columnKey]
    })
  }

  const getValidatorDisplay = (item: Maintenance) => {
    if (item.validatorName || item.validatorNip) {
      return `${item.validatorName ? item.validatorName : ""} ${item.validatorNip ? item.validatorNip : ""}`.trim()
    }
    return "Menunggu Validasi"
  }

  const buildMaintenanceNarrativeSections = (columnKeys: string[]): SectionBuilder<Maintenance> => {
    const columnSet = new Set(columnKeys)
    return (item) => {
      const detail = resolveDetailForMaintenance(item)
      const assetSource = deriveAssetSource(detail?.assetType ?? item.assetType, detail?.detailCode ?? item.assetCode)
      const assetTypeLabel = assetSourceLabel(assetSource)
      const assetName =
        item.assetDetailName || detail?.detailInventoryName || detail?.detailName || item.assetName || "-"
      const assetCode = item.assetDetailCode || detail?.detailCode || item.assetCode || "-"
      const maintenanceType = maintenanceTypeLabel(item.type)
      const scheduledLabel = formatDateId(item.scheduledDate)
      const notesLabel = item.description || item.notes || "-"
      const validatorLabel = getValidatorDisplay(item)
      const technicianLabel = item.technician || "-"
      const logLabel = formatBracketedDateTime(item.completedDate ?? item.validatedAt ?? item.updatedAt) || "-"
      const statusLabel = `[ ${maintenanceStatusLabel(item.status).toUpperCase()} ]`

      const identities: SectionLine[] = []
      if (columnSet.has("jenisInventaris")) {
        appendLine(identities, "Jenis Inventaris", assetTypeLabel)
      }
      if (columnSet.has("alat")) {
        appendLine(identities, "Nama Alat", assetName)
      }
      if (columnSet.has("kode")) {
        appendLine(identities, "Kode Alat", assetCode)
      }

      const details: SectionLine[] = []
      if (columnSet.has("jenisPemeliharaan")) {
        appendLine(details, "Jenis Pemeliharaan", maintenanceType)
      }
      if (columnSet.has("jadwal")) {
        appendLine(details, "Jadwal Pemeliharaan", scheduledLabel)
      }

      const logLines: SectionLine[] = []
      if (columnSet.has("pengirim")) {
        appendLine(logLines, "Nama Pengirim", item.requesterName || "-")
      }
      if (columnSet.has("nipPengirim")) {
        appendLine(logLines, "NIP Pengirim", item.requesterNip || "-")
      }
      if (columnSet.has("teknisi")) {
        appendLine(logLines, "Teknisi Pelaksana", technicianLabel)
      }
      if (columnSet.has("catatan")) {
        appendLine(logLines, "Catatan Pemeliharaan", notesLabel)
      }
      if (columnSet.has("validator")) {
        appendLine(logLines, "Validator", validatorLabel)
      }
      if (columnSet.has("waktuLog")) {
        appendLine(logLines, "Waktu Log", logLabel)
      }

      const statusLines: SectionLine[] = []
      if (columnSet.has("status")) {
        appendLine(statusLines, "Status Akhir", statusLabel)
      }

      const sections: DocumentSection[] = []
      if (identities.length) {
        sections.push({ title: "INFORMASI DASAR ALAT", lines: identities })
      }
      if (details.length) {
        sections.push({ title: "DETAIL PEMELIHARAAN", lines: details })
      }
      if (logLines.length) {
        sections.push({ title: "LOG PELAKSANAAN & VALIDASI", lines: logLines })
      }
      if (statusLines.length) {
        sections.push({ title: "STATUS AKHIR", lines: statusLines })
      }
      return sections
    }
  }

  const exportSingleNarrative = async (format: ExportFormat, item: Maintenance) => {
    const columnKeys =
      maintenanceColumnsForExport.length > 0
        ? maintenanceColumnsForExport.map((column) => column.key)
        : maintenanceExportColumnDefinitions.map((column) => column.key)

    void exportNarrativeReport(format, {
      title: "Daftar Jadwal Pemeliharaan",
      subtitle: "LAPORAN PEMELIHARAAN",
      entries: [item],
      filePrefix: `jadwal-pemeliharaan-${item.id}`,
      buildSections: buildMaintenanceNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada jadwal pemeliharaan yang dipilih.",
    })
  }

  const handleExport = async (format: ExportFormat) => {
    if (!maintenanceRowsToExport.length) return
    const columnKeys =
      maintenanceColumnsForExport.length > 0
        ? maintenanceColumnsForExport.map((column) => column.key)
        : maintenanceExportColumnDefinitions.map((column) => column.key)

    void exportNarrativeReport(format, {
      title: "Daftar Jadwal Pemeliharaan",
      subtitle: "LAPORAN PEMELIHARAAN",
      entries: maintenanceRowsToExport,
      filePrefix: "jadwal-pemeliharaan",
      buildSections: buildMaintenanceNarrativeSections(columnKeys),
      emptyMessage: "Tidak ada jadwal pemeliharaan yang dipilih.",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "destructive"
      case "in_progress":
        return "secondary"
      case "completed":
        return "default"
      case "cancelled":
        return "secondary"
      default:
        return "default"
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-white to-teal-50/30 min-h-screen">
      <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        <div className="space-y-4">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl shadow-lg">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Jadwal Pemeliharaan</h1>
                  <p className="text-sm text-muted-foreground">& validasi pemeliharaan sesuai dokumentasi
                    Monitor jadwal 
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  
                </Badge>
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">

                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() => {
                  setEditingMaintenance(null)
                  setShowForm(true)
                }}
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                Tambah Jadwal
              </Button>
            </div>
          </div>

          {!hasFullAccess && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Mode terbatas: hanya melihat jadwal & memperbarui status ke Proses.
            </p>
          )}

          <div className="rounded-2xl border border-orange-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <p className="text-sm text-orange-700/90">
              Setiap update pemeliharaan diarsipkan dalam flow aktivitas untuk memudahkan audit dan pelaporan status.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Sedang Berjalan</p>
            <p className="text-3xl font-semibold text-orange-600">{pendingCount.toLocaleString("id-ID")}</p>
            <p className="text-xs text-muted-foreground">Jadwal belum selesai</p>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border/70 bg-white/70 p-5 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">Validasi & Akses</p>
              <p className="text-sm text-foreground">
                {hasFullAccess
                  ? "Admin/Leader dapat mengubah status hingga selesai atau batal."
                  : "Peran lain hanya dapat melihat & mengirim progress ke Proses."}
              </p>
            </div>
          </div>
        </div>

        {showForm && (
          <MaintenanceForm
            maintenance={editingMaintenance}
            assets={assets}
            onSave={handleSaveMaintenance}
            onCancel={() => {
              setShowForm(false)
              setEditingMaintenance(null)
            }}
          />
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Cari inventaris atau kode..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-white/90 text-sm"
                    />
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-white/90 text-sm"
            >
              <option>Semua</option>
              <option value="scheduled">Tertunda</option>
              <option value="in_progress">Proses</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg">Daftar Pemeliharaan</CardTitle>
              <CardDescription className="text-sm">
                Total: {filteredMaintenance.length} jadwal
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-2xl px-3">
                    <Download className="mr-2 h-4 w-4" />
                    Ekspor
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-52">
                  <DropdownMenuLabel>Pilih kolom</DropdownMenuLabel>
                  <div className="max-h-52 overflow-y-auto">
                    {maintenanceExportColumnDefinitions.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={`maintenance-column-${column.key}`}
                        checked={selectedMaintenanceColumns.includes(column.key)}
                        onCheckedChange={() => handleMaintenanceExportColumnToggle(column.key)}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Ekspor daftar</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleExport("pdf")}>PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleExport("word")}>Word</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleExport("excel")}>Excel</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs text-muted-foreground">
                {selectedMaintenanceRows.length
                  ? `${selectedMaintenanceRows.length} baris dipilih`
                  : `Semua ${filteredMaintenance.length} baris`}
              </span>
            </div>
          </CardHeader>

          <CardContent>
            {filteredMaintenance.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">Belum ada jadwal pemeliharaan</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <input
                          aria-label="Pilih semua jadwal pemeliharaan"
                          type="checkbox"
                          className="h-4 w-4"
                          checked={maintenanceAllSelected}
                          onChange={handleMaintenanceSelectAll}
                        />
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Jenis Inventaris</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Alat</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Kode</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Merek/Model</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tipe Perawatan</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Jadwal Pemeliharaan</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nama Pengirim Pemeliharaan</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Teknisi</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Catatan</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Validasi</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Aksi</th></tr>
                  </thead>

                  <tbody>
                      {filteredMaintenance.map((m) => {
                        const detailInfo = resolveDetailForMaintenance(m)

                        const inventoryTypeSource = deriveAssetSource(
                          detailInfo?.assetType ?? m.assetType,
                          detailInfo?.detailCode ?? m.assetCode
                        )

                        const inventoryTypeLabel = assetSourceLabel(inventoryTypeSource)

                        const inventoryName =
                          m.assetDetailName ||
                          detailInfo?.detailInventoryName ||
                          detailInfo?.detailName ||
                          m.assetName ||
                          "-"

                        const codeLabel = m.assetDetailCode || detailInfo?.detailCode || m.assetCode || "-"

                        const brandModel =
                          detailInfo?.detailBrandModel ||
                          detailInfo?.detailName ||
                          m.description ||
                          "-"
                        const validationTimestamp = formatBracketedDateTime(m.completedDate ?? m.validatedAt ?? m.updatedAt)

                      return (
                        <tr key={String(m.id)} className="border-b border-border hover:bg-muted/50">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={selectedMaintenanceIds.has(m.id)}
                              onChange={() => toggleMaintenanceSelection(m.id)}
                              className="h-4 w-4"
                              aria-label={`Pilih jadwal pemeliharaan ${m.assetDetailName || m.assetName || ""}`}
                            />
                          </td>
                          <td className="py-2 px-3 text-foreground">
                            {inventoryTypeLabel !== "-" ? (
                              <Badge variant="outline" className="text-xs">
                                {inventoryTypeLabel}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-foreground">{inventoryName}</td>
                          <td className="py-2 px-3 text-muted-foreground text-xs">{codeLabel}</td>
                          <td className="py-2 px-3 text-muted-foreground">{brandModel}</td>
                          <td className="py-2 px-3 text-muted-foreground">{maintenanceTypeLabel(m.type)}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {formatDateId(m.scheduledDate)}
                          </td>
                          <td className="py-2 px-3 text-foreground">
                            {m.requesterName || m.requesterNip ? (
                              <div className="flex flex-col">
                                <span>{m.requesterName || "-"}</span>
                                {m.requesterNip && (
                                  <span className="text-xs text-muted-foreground">{m.requesterNip}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{m.technician || "-"}</td>

                          <td className="py-2 px-3 text-muted-foreground max-w-[220px] whitespace-normal break-words text-sm leading-snug">
                            {m.description ? (
                              m.description
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>

                          <td className="py-2 px-3 text-foreground">
                            {m.validatorName || m.validatorNip ? (
                              <div className="flex flex-col gap-0.5">
                                {m.validatorName && (
                                  <span className="text-sm font-medium text-foreground">{m.validatorName}</span>
                                )}
                                {m.validatorNip && (
                                  <span className="text-[11px] text-muted-foreground">{m.validatorNip}</span>
                                )}
                                {validationTimestamp && (
                                  <span className="text-[11px] text-muted-foreground">{validationTimestamp}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {m.status === "completed"
                                  ? "Validator tidak tersedia"
                                  : "Menunggu validasi"}
                              </span>
                            )}
                          </td>

                          <td className="py-2 px-3">
                            {m.status !== "completed" ? (
                              <select
                                value={m.status}
                                onChange={(e) => handleUpdateStatus(m.id, e.target.value)}
                                className="px-2 py-1 border border-border rounded bg-background text-xs"
                              >
                                <option value="scheduled">Tertunda</option>
                                <option value="in_progress">Proses</option>
                                {hasFullAccess && <option value="completed">Selesai</option>}
                                {hasFullAccess && <option value="cancelled">Dibatalkan</option>}
                              </select>
                            ) : (
                              <Badge
                                variant={getStatusColor(m.status)}
                                className="text-xs bg-teal-100 text-teal-800 hover:bg-teal-100"
                              >
                                {maintenanceStatusLabel(m.status)}
                              </Badge>
                            )}
                          </td>

                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {hasFullAccess ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => handleEditMaintenance(m)}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteMaintenance(m.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => void exportSingleNarrative("pdf", m)}>
                                    PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void exportSingleNarrative("word", m)}>
                                    Word
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void exportSingleNarrative("excel", m)}>
                                    Excel
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan Sistem Informasi Inventaris dan Pemeliharaan Sarana
            Prasarana Peminjaman
          </p>
        </div>
      </div>
    </div>
  )
}
