"use client"

import MedicalAssetForm from "@/components/medical-asset-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { assetService, type Asset } from "@/services/asset.service";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import type { User } from "@/types/auth-types";
import type { MedicalAsset, MedicalRoom } from "@/types/medical-assets-types";
import { buildSpecifications, deriveAssetCondition, deriveAssetStatus, getSpecificationDetails } from "@/utils/api-mappers";
import { downloadManualAssetLabel, printManualAssetLabel } from "@/utils/asset-label";
import { MEDICAL_USAGE_ALIASES, MEDICAL_USAGE_OPTIONS } from "@/utils/medical-asset-usage";
import { formatNoId, rebaseRoomScopedDetailCode } from "@/utils/record-id";
import { canManageInventoryRole, isAdminOrLeaderRole, isAdminRole } from "@/utils/role";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { buildOrderedUsagePurposeList, normalizeUsagePurpose } from "@/utils/usage-purpose";


import { AssetImportDialog } from "@/components/asset-import-dialog";
import { AssetQrDialog } from "@/components/asset-qr-dialog";
import { DisposalRequestDialog } from "@/components/disposal-request-dialog";
import { InventoryDetailCard } from "@/components/inventory-detail-card";
import { ChevronDown, ChevronUp, Edit2, FileSpreadsheet, Plus, Search, Sparkles, Stethoscope, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const getInventoryStatusLabel = (status?: string) => {
  if (status === "Aktif") return "Tersedia"
  if (status === "Non-Aktif") return "Nonaktif"
  return status || "Tersedia"
}

const formatUsageSummary = (summary?: { total?: number; manual?: number; borrowing?: number }) => {
  const total = Number(summary?.total || 0)
  const manual = Number(summary?.manual || 0)
  const borrowing = Number(summary?.borrowing || 0)
  return `Total ${total}x | Manual ${manual}x | Peminjaman ${borrowing}x`
}

export default function MedicalAssetsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [rooms, setRooms] = useState<MedicalRoom[]>([])
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<MedicalAsset | null>(null)
  const [editingRoom, setEditingRoom] = useState<MedicalRoom | null>(null)
  const [disposalTarget, setDisposalTarget] = useState<{ roomId: string; asset: MedicalAsset } | null>(null)
  const [qrTarget, setQrTarget] = useState<{ noId: string; asset: MedicalAsset; location?: string } | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState("")
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("Semua")
  const [isResettingInventory, setIsResettingInventory] = useState(false)

  useEffect(() => {
    const scannedQuery = searchParams.get("scan")?.trim()
    if (!scannedQuery) return

    setSearchTerm(scannedQuery)
  }, [searchParams])

  const categoryOptions = ["Medis"]
  const defaultCategory = "Medis"
  const roomFormRef = useRef<HTMLDivElement | null>(null)
  const [roomFormData, setRoomFormData] = useState({
    roomName: "",
    category: defaultCategory,
  })

  const resetRoomForm = () => {
    setRoomFormData({
      roomName: "",
      category: defaultCategory,
    })
  }

  const closeRoomForm = () => {
    setShowRoomForm(false)
    setEditingRoom(null)
    resetRoomForm()
  }

  const startRoomCreation = () => {
    resetRoomForm()
    setEditingRoom(null)
    setShowRoomForm(true)
  }

  const loadRooms = async () => {
    try {
      const response = await assetService.getMedicalAssets({ page: 1, limit: 1000 })
      if (!response.success) {
        alert(response.message || "Gagal memuat data inventaris medis")
        return
      }

      const apiAssets = response.data as Asset[]
      const mappedRooms: MedicalRoom[] = apiAssets.map((asset) => {
        const details = getSpecificationDetails<MedicalAsset>(asset.specifications).map((detail) => ({
          ...detail,
          roomId: String(asset.id),
        }))
        return {
          id: String(asset.id),
          roomName: asset.location || "",
          assetName: asset.name,
          assetCode: asset.assetCode,
          category: defaultCategory,
          assets: details,
        }
      })
      setRooms(mappedRooms)
    } catch (error: any) {
      alert(error.message || "Gagal memuat data inventaris medis")
    }
  }

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
    } else {
      setCurrentUser(user)
    }
  }, [router])

  useEffect(() => {
    loadRooms()
  }, [])

  useEffect(() => {
    if (showRoomForm) {
      roomFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [showRoomForm])

  useEffect(() => {
    const handleInventoryRefresh = () => {
      void loadRooms()
    }

    window.addEventListener("inventory-refresh", handleInventoryRefresh)
    return () => window.removeEventListener("inventory-refresh", handleInventoryRefresh)
  }, [])

  const canEditInventory = isAdminOrLeaderRole(currentUser?.role)
  const canDeleteInventory = isAdminRole(currentUser?.role)
  const canManageInventory = canManageInventoryRole(currentUser?.role)
  const canRequestInventoryDeletion = canManageInventory && !canDeleteInventory
  const usageCounts = rooms.reduce<Record<string, number>>((acc, room) => {
    room.assets.forEach((asset) => {
      const key = normalizeUsagePurpose(
        asset.usagePurpose || "Operasional bersama",
        MEDICAL_USAGE_OPTIONS,
        MEDICAL_USAGE_ALIASES,
      )
      acc[key] = (acc[key] || 0) + 1
    })
    return acc
  }, {})

  const usageOrder = buildOrderedUsagePurposeList(
    MEDICAL_USAGE_OPTIONS,
    Object.keys(usageCounts),
    MEDICAL_USAGE_ALIASES,
  )
  const usageList = usageOrder.map((usage) => ({
    label: usage,
    count: usageCounts[usage] || 0,
  })).filter((item) => item.count > 0)
  const totalRoomCount = rooms.length
  const totalAssetCount = rooms.reduce((total, room) => total + room.assets.length, 0)

  const handleAddRoom = async () => {
    if (!canManageInventory) {
      alert("Anda tidak memiliki hak akses untuk menambah inventaris")
      return
    }

    if (!roomFormData.roomName) {
      alert("Masukkan nama ruangan")
      return
    }

    if (editingRoom && !canEditInventory) {
      alert("Hanya Admin/Leader yang dapat mengubah data inventaris")
      return
    }

    const isEditingRoom = Boolean(editingRoom)

    try {
      if (isEditingRoom) {
        const currentRoom = editingRoom
        if (!currentRoom) {
          return
        }
        const details = (currentRoom.assets || []).map((detail) => ({
          ...detail,
          id: rebaseRoomScopedDetailCode(detail.id, "MED", currentRoom.roomName, roomFormData.roomName),
          assetCode: rebaseRoomScopedDetailCode(detail.assetCode, "MED", currentRoom.roomName, roomFormData.roomName),
          roomId: roomFormData.roomName,
        }))
        const response = await assetService.update(currentRoom.id, {
          name: roomFormData.roomName,
          category: roomFormData.category || defaultCategory,
          type: "medical",
          location: roomFormData.roomName,
          specifications: buildSpecifications(details),
          status: deriveAssetStatus(details),
          condition: deriveAssetCondition(details),
        })
        if (!response.success) {
          alert(response.message || "Gagal memperbarui inventaris medis")
          return
        }
      } else {
        const response = await assetService.create({
          name: roomFormData.roomName,
          category: roomFormData.category || defaultCategory,
          type: "medical",
          location: roomFormData.roomName,
          status: "available",
          condition: "good",
          specifications: buildSpecifications<MedicalAsset>([]),
        })
        if (!response.success) {
          alert(response.message || "Gagal menambah inventaris medis")
          return
        }
      }

      await loadRooms()
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan inventaris medis")
      return
    }

    closeRoomForm()

    if (!isEditingRoom) {
      toast({
        title: "Inventaris medis berhasil ditambahkan",
        description: "Data inventaris medis sudah tersimpan.",
      })
    }
  }

  const handleEditRoom = (room: MedicalRoom) => {
    if (editingRoom?.id === room.id) {
      closeRoomForm()
      return
    }
    setEditingRoom(room)
    setRoomFormData({
      roomName: room.roomName,
      category: room.category || defaultCategory,
    })
    setShowRoomForm(false)
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!canDeleteInventory) {
      alert("Hanya Admin yang dapat menghapus data inventaris")
      return
    }
    const isConfirmed = await confirm({
      title: "Hapus inventaris medis",
      description: "Hapus ruangan ini beserta semua inventaris di dalamnya?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return
    try {
      const response = await assetService.delete(roomId, "medical")
      if (!response.success) {
        alert(response.message || "Gagal menghapus inventaris medis")
        return
      }
      await loadRooms()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus inventaris medis")
    }
  }

  const handleResetInventory = async () => {
    if (!canDeleteInventory) {
      alert("Hanya Admin yang dapat menghapus seluruh data inventaris")
      return
    }

    const isConfirmed = await confirm({
      title: "Hapus semua data inventaris?",
      description: "Semua inventaris medis, non-medis, peminjaman, penggunaan, dan pemeliharaan akan dihapus. Data pengguna tetap tersimpan.",
      confirmText: "Ya, hapus semua",
      destructive: true,
    })
    if (!isConfirmed) return

    setIsResettingInventory(true)
    try {
      const response = await assetService.resetInventory()
      if (!response.success) {
        alert(response.message || "Gagal menghapus seluruh data inventaris")
        return
      }

      await loadRooms()
      window.dispatchEvent(new Event("inventory-refresh"))
      toast({
        title: "Data inventaris berhasil dihapus",
        description: `Total ${response.data?.totalDeleted ?? 0} data inventaris dan operasional terkait dihapus. Data pengguna tetap tersimpan.`,
      })
    } catch (error: any) {
      alert(error.message || "Gagal menghapus seluruh data inventaris")
    } finally {
      setIsResettingInventory(false)
    }
  }

  const handleSaveAsset = async (asset: MedicalAsset) => {
    if (!canManageInventory) {
      alert("Anda tidak memiliki hak akses untuk menambah detail inventaris")
      return
    }
    if (editingAsset && !canEditInventory) {
      alert("Hanya Admin/Leader yang dapat mengubah detail inventaris")
      return
    }
    const targetRoom = rooms.find((room) => room.id === selectedRoomId)
    if (!targetRoom) return

    const isEditingAsset = Boolean(editingAsset)

    const updatedDetails = isEditingAsset
      ? targetRoom.assets.map((a) => (a.id === asset.id ? asset : a))
      : [...targetRoom.assets, { ...asset, id: Date.now().toString() }]

    try {
      const response = await assetService.update(selectedRoomId, {
        specifications: buildSpecifications(updatedDetails),
        status: deriveAssetStatus(updatedDetails),
        condition: deriveAssetCondition(updatedDetails),
        type: "medical",
      })
      if (!response.success) {
        alert(response.message || "Gagal menyimpan detail inventaris")
        return
      }
      await loadRooms()
      setShowAssetForm(false)
      setEditingAsset(null)

      if (!isEditingAsset) {
        toast({
          title: "Alat inventaris medis berhasil ditambahkan",
          description: "Data alat inventaris medis sudah tersimpan.",
        })
      } else {
        toast({
          title: "Detail inventaris medis berhasil diperbarui",
          description: "Perubahan detail inventaris medis sudah tersimpan.",
        })
      }
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan detail inventaris")
    }
  }

  const handleDeleteAsset = async (roomId: string, assetId: string) => {
    if (!canDeleteInventory) {
      alert("Hanya Admin yang dapat menghapus inventaris")
      return
    }
    const isConfirmed = await confirm({
      title: "Hapus detail inventaris",
      description: "Hapus inventaris ini?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return
    const targetRoom = rooms.find((room) => room.id === roomId)
    if (!targetRoom) return
    const updatedDetails = targetRoom.assets.filter((a) => a.id !== assetId)
    try {
      const response = await assetService.update(roomId, {
        specifications: buildSpecifications(updatedDetails),
        status: deriveAssetStatus(updatedDetails),
        condition: deriveAssetCondition(updatedDetails),
        type: "medical",
      })
      if (!response.success) {
        alert(response.message || "Gagal menghapus detail inventaris")
        return
      }
      await loadRooms()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus detail inventaris")
    }
  }

  const toggleRoomExpanded = (roomId: string) => {
    const newExpanded = new Set(expandedRooms)
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId)
    } else {
      newExpanded.add(roomId)
    }
    setExpandedRooms(newExpanded)
  }

  const searchTermNormalized = searchTerm.trim().toLowerCase()
  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((left, right) => {
        const nameComparison = left.roomName.localeCompare(right.roomName, "id", { numeric: true })
        if (nameComparison !== 0) return nameComparison
        return left.id.localeCompare(right.id, "id", { numeric: true })
      }),
    [rooms],
  )
  const roomNoIdByRoomId = useMemo(
    () => new Map(sortedRooms.map((room, index) => [room.id, formatNoId("IMD", index + 1)])),
    [sortedRooms],
  )
  const assetNoIdByRoomAndAssetId = useMemo(() => {
    let detailNumber = 1
    const lookup = new Map<string, string>()

    sortedRooms.forEach((room) => {
      room.assets.forEach((asset) => {
        lookup.set(`${room.id}:${asset.id}`, formatNoId("IMD-DTL", detailNumber))
        detailNumber += 1
      })
    })

    return lookup
  }, [sortedRooms])
  const getRoomNoId = (roomId: string) => roomNoIdByRoomId.get(roomId) ?? formatNoId("IMD", roomId)
  const getAssetNoId = (roomId: string, assetId: string) =>
    assetNoIdByRoomAndAssetId.get(`${roomId}:${assetId}`) ?? formatNoId("IMD-DTL", assetId)

  const matchesAssetSearch = (roomId: string, roomName: string, asset: MedicalAsset) => {
    if (!searchTermNormalized) return false
    return matchesSearchKeyword(searchTerm, [
      getAssetNoId(roomId, asset.id),
      asset.id,
      asset.roomId,
      roomName,
      asset.inventoryName,
      asset.name,
      asset.serialNumber,
      asset.assetCode,
      "Medis",
      "Medical",
      normalizeUsagePurpose(asset.usagePurpose, MEDICAL_USAGE_OPTIONS, MEDICAL_USAGE_ALIASES),
      asset.notes,
      asset.status,
      asset.condition,
    ])
  }

  const filteredRooms = sortedRooms.filter((room) => {
    const matchesRoomSearch = matchesSearchKeyword(searchTerm, [
      getRoomNoId(room.id),
      room.id,
      room.roomName,
      room.assetName,
      room.assetCode,
      room.category,
    ])
    const matchesDetailSearch = searchTermNormalized ? room.assets.some((asset) => matchesAssetSearch(room.id, room.roomName, asset)) : false
    const matchesCategory = filterCategory === "Semua" || room.category === filterCategory
    return (matchesRoomSearch || matchesDetailSearch) && matchesCategory
  })

  return (
    <div>
      <div className="w-full space-y-6">
        <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/35 dark:bg-slate-900/60">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-slate-50 panel-gutter dark:border-slate-800/35 dark:bg-slate-900/40">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl flex items-center gap-3">
                  <div className="inline-flex rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
                    <Stethoscope className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-[18px] font-semibold tracking-tight">Inventaris Medis</h1>
                  </div>
                </div>
                {canManageInventory && (
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    {canDeleteInventory && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetInventory}
                        disabled={isResettingInventory}
                        className="w-full rounded-2xl border-red-200 px-4 text-red-600 hover:bg-red-50 hover:text-red-700 sm:w-auto dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-300"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isResettingInventory ? "Menghapus..." : "Hapus Semua"}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setShowImportDialog(true)}
                      className="w-full rounded-2xl px-4 sm:w-auto"
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Import Excel
                    </Button>
                    <Button
                      onClick={startRoomCreation}
                      className="w-full rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700 sm:w-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Tambah Inventaris
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5 panel-gutter">
              <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-3 py-2.5 dark:border-teal-400/15 dark:bg-teal-400/5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-teal-700/80 leading-none dark:text-teal-300/80">Ruang</p>
                    <p className="mt-1 text-[11px] leading-4 text-teal-800/80 dark:text-teal-200/70">Unit lokasi inventaris medis.</p>
                  </div>
                  <p className="shrink-0 text-xl font-semibold leading-none text-teal-950 dark:text-teal-200">{totalRoomCount}</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5 dark:border-cyan-400/15 dark:bg-cyan-400/5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-700/80 leading-none dark:text-cyan-300/80">Detail Aset</p>
                    <p className="mt-1 text-[11px] leading-4 text-cyan-800/80 dark:text-cyan-200/70">Peralatan tersimpan di seluruh ruang.</p>
                  </div>
                  <p className="shrink-0 text-xl font-semibold leading-none text-cyan-950 dark:text-cyan-200">{totalAssetCount}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-2.5 dark:border-emerald-400/15 dark:bg-emerald-400/5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700/80 leading-none dark:text-emerald-300/80">Pemakaian</p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-none text-emerald-950 dark:text-emerald-200">Distribusi utama</p>
                    </div>
                    <Sparkles className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  {usageList.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-4">
                      {usageList.slice(0, 8).map((item) => (
                        <div key={item.label} className="rounded-lg bg-white/80 px-1.5 py-1 text-center dark:bg-slate-900/50">
                          <p className="truncate text-[9px] font-medium leading-none text-emerald-700/80 dark:text-emerald-300/80">{item.label}</p>
                          <p className="mt-0.5 text-[13px] font-semibold leading-none text-emerald-700 dark:text-emerald-300">{item.count}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-800/80 dark:text-emerald-200/70">Belum ada data pemakaian.</p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cari No ID, ruangan, nama alat, kode barang..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-200"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-200"
                >
                  <option>Semua</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Room Form */}
        {showRoomForm && (
          <div ref={roomFormRef} className="scroll-mt-24">
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">{editingRoom ? "Edit Inventaris Medis" : "Tambah Inventaris Medis Baru"}</h3>
                  <button onClick={closeRoomForm} className="text-muted-foreground hover:text-foreground text-lg">
                    &times;
                  </button>
                </div>
                <div className="grid gap-3">
                  <input
                    type="text"
                    value={roomFormData.roomName}
                    onChange={(e) => setRoomFormData({ ...roomFormData, roomName: e.target.value })}
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    placeholder="Nama Ruangan & Lantai *"
                  />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button onClick={handleAddRoom} size="sm" className="bg-teal-600 hover:bg-teal-700">
                    Simpan
                  </Button>
                  <Button variant="outline" size="sm" onClick={closeRoomForm}>
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rooms List */}
        {filteredRooms.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Belum ada inventaris medis terdaftar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRooms.map((room) => {
              const detailMatchesSearch = searchTermNormalized ? room.assets.some((asset) => matchesAssetSearch(room.id, room.roomName, asset)) : false
              const assetsToDisplay = detailMatchesSearch
                ? room.assets.filter((asset) => matchesAssetSearch(room.id, room.roomName, asset))
                : room.assets
              const isExpanded = expandedRooms.has(room.id)
              const shouldAutoExpandFromSearch = Boolean(searchTermNormalized)
              const shouldShowDetails = isExpanded || shouldAutoExpandFromSearch
              const roomNoId = getRoomNoId(room.id)
              return (
                <Card key={room.id} className="overflow-hidden">
                  <div
                    className="bg-linear-to-r from-cyan-50 to-teal-50 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:from-cyan-100 hover:to-teal-100 dark:from-cyan-400/10 dark:to-teal-400/10 dark:hover:from-cyan-400/15 dark:hover:to-teal-400/15"
                    onClick={() => toggleRoomExpanded(room.id)}
                  >
                  <div className="flex items-center gap-3 flex-1">
                    <button className="text-teal-600 hover:bg-teal-100/60 rounded-lg p-1.5 transition dark:text-teal-400 dark:hover:bg-teal-400/10">
                      {shouldShowDetails ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{room.roomName}</h3>
                      <p className="text-[11px] text-muted-foreground">No ID: {roomNoId}</p>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <Badge variant="secondary" className="text-xs">
                      {assetsToDisplay.length} Detail
                    </Badge>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      Medis
                    </Badge>
                    {canEditInventory && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditRoom(room)
                        }}
                        className="h-9 w-9 p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteInventory && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteRoom(room.id)
                        }}
                        className="text-red-600 hover:bg-red-50 h-9 w-9 p-1.5 dark:text-red-400 dark:hover:bg-red-400/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                  {editingRoom?.id === room.id && (
                    <CardContent className="border-t border-border bg-teal-50/50 p-3 dark:bg-teal-400/5">
                      <div className="grid gap-2">
                        <label className="text-xs font-medium text-muted-foreground">Nama Ruangan</label>
                        <input
                          type="text"
                          value={roomFormData.roomName}
                          onChange={(e) => setRoomFormData({ ...roomFormData, roomName: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                          placeholder="Nama Ruangan & Lantai *"
                        />
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button onClick={handleAddRoom} size="sm" className="bg-teal-600 hover:bg-teal-700">
                          Simpan
                        </Button>
                        <Button variant="outline" size="sm" onClick={closeRoomForm}>
                          Batal
                        </Button>
                      </div>
                    </CardContent>
                  )}

                  {shouldShowDetails && (
                    <CardContent className="p-3 border-t border-border">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="font-medium text-sm">Detail Inventaris</h4>
                        {canManageInventory && (
                          <Button
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-700 h-7 text-xs"
                            onClick={() => {
                              setSelectedRoomId(room.id)
                              setEditingAsset(null)
                              setShowAssetForm(true)
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Tambah Detail
                          </Button>
                        )}
                      </div>

                      {assetsToDisplay.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-sm">Belum ada detail inventaris</p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 auto-rows-fr">
                          {assetsToDisplay.map((asset) => {
                            const noId = getAssetNoId(room.id, asset.id)
                            const purchaseDateText = asset.purchaseDate
                              ? new Date(asset.purchaseDate).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                              : "-"
                            const maintenanceDateText = asset.lastMaintenance
                              ? new Date(asset.lastMaintenance).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                              : asset.lastRepair
                                ? new Date(asset.lastRepair).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                                : "-"
                            const maintenanceLabelText = asset.lastMaintenance
                              ? "Pemeliharaan Terakhir"
                              : asset.lastRepair
                                ? "Perbaikan Terakhir"
                                : "Pemeliharaan Terakhir"
                            const statusLabel = getInventoryStatusLabel(asset.status)

                            return (
                              <InventoryDetailCard
                                key={asset.id}
                                title={asset.inventoryName || asset.name}
                                noId={noId}
                                statusLabel={statusLabel}
                                conditionLabel={asset.condition}
                                categoryLabel={room.category}
                                code={asset.assetCode || "-"}
                                serialNumber={asset.serialNumber || "-"}
                                brand={asset.name || "-"}
                                purchaseDateText={purchaseDateText}
                                maintenanceLabel={maintenanceLabelText}
                                maintenanceDateText={maintenanceDateText}
                                usageText={normalizeUsagePurpose(
                                  asset.usagePurpose || "Operasional bersama",
                                  MEDICAL_USAGE_OPTIONS,
                                  MEDICAL_USAGE_ALIASES,
                                )}
                                usageSummaryText={formatUsageSummary(asset.usageSummary)}
                                notes={asset.notes}
                                onShowQr={() => setQrTarget({ noId, asset, location: room.roomName })}
                                onDownloadLabel={() =>
                                  downloadManualAssetLabel({
                                    noId,
                                    assetName: asset.inventoryName || asset.name,
                                    assetCode: asset.assetCode,
                                    serialNumber: asset.serialNumber,
                                    location: room.roomName,
                                    condition: asset.condition,
                                    status: asset.status,
                                    purchaseDate: asset.purchaseDate,
                                    nextMaintenance: asset.nextMaintenance,
                                    sourceLabel: "Medis",
                                  })
                                }
                                onPrintLabel={() =>
                                  printManualAssetLabel({
                                    noId,
                                    assetName: asset.inventoryName || asset.name,
                                    assetCode: asset.assetCode,
                                    serialNumber: asset.serialNumber,
                                    location: room.roomName,
                                    condition: asset.condition,
                                    status: asset.status,
                                    purchaseDate: asset.purchaseDate,
                                    nextMaintenance: asset.nextMaintenance,
                                    sourceLabel: "Medis",
                                  })
                                }
                                onViewHistory={() => {
                                  const params = new URLSearchParams({
                                    section: "inventory-history",
                                    assetId: String(room.id),
                                    assetType: "medical",
                                    detailId: String(asset.id),
                                    detailCode: asset.assetCode || "",
                                  })
                                  window.location.assign(`/activity-archive?${params.toString()}`)
                                }}
                                onEdit={
                                  canEditInventory
                                    ? () => {
                                      setSelectedRoomId(room.id)
                                      setEditingAsset(asset)
                                      setShowAssetForm(true)
                                    }
                                    : undefined
                                }
                                onDelete={
                                  canDeleteInventory
                                    ? () => handleDeleteAsset(room.id, asset.id)
                                    : canRequestInventoryDeletion
                                      ? () => setDisposalTarget({ roomId: room.id, asset })
                                      : undefined
                                }
                                deleteLabel={canDeleteInventory ? "Hapus" : canRequestInventoryDeletion ? "Ajukan" : undefined}
                              />
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}

      </div>

      {/* Import Dialog */}
      <AssetImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        assetType="medical"
        onSuccess={() => { setShowImportDialog(false); void loadRooms() }}
      />

      {/* Disposal Request Dialog */}
      {disposalTarget && canRequestInventoryDeletion && (
        <DisposalRequestDialog
          open={true}
          onOpenChange={(open) => { if (!open) setDisposalTarget(null) }}
          assetId={Number(disposalTarget.roomId)}
          assetType="medical"
          assetDetailId={disposalTarget.asset.id}
          assetDetailName={disposalTarget.asset.name}
          assetDetailCode={disposalTarget.asset.assetCode}
          onSuccess={() => setDisposalTarget(null)}
        />
      )}

      {/* Asset QR Dialog */}
      {qrTarget && (
        <AssetQrDialog
          open={true}
          onOpenChange={(open) => { if (!open) setQrTarget(null) }}
          noId={qrTarget.noId}
          assetName={qrTarget.asset.inventoryName || qrTarget.asset.name}
          assetCode={qrTarget.asset.assetCode}
          serialNumber={qrTarget.asset.serialNumber}
          location={qrTarget.location}
          condition={qrTarget.asset.condition}
          status={qrTarget.asset.status}
          purchaseDate={qrTarget.asset.purchaseDate}
          nextMaintenance={qrTarget.asset.nextMaintenance}
          sourceLabel="Medis"
        />
      )}

      {/* Asset Form Modal */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[calc(100%-1rem)] rounded-lg bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <MedicalAssetForm
              asset={editingAsset}
              onSave={handleSaveAsset}
              onCancel={() => {
                setShowAssetForm(false)
                setEditingAsset(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
