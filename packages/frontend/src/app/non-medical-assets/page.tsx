"use client"

import { NON_MEDICAL_ASSET_CATEGORIES } from "@/components/non-medical-asset-categories";
import NonMedicalAssetForm from "@/components/non-medical-asset-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNonMedicalAssetTypeColor, getNonMedicalAssetTypeLabel } from "@/constants/non-medical-asset-types";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { assetService, type Asset } from "@/services/asset.service";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import type { User } from "@/types/auth-types";
import { buildSpecifications, deriveAssetCondition, deriveAssetStatus, getSpecificationDetails } from "@/utils/api-mappers";
import { formatNoId } from "@/utils/record-id";
import { canManageInventoryRole, isAdminOrLeaderRole, isAdminRole } from "@/utils/role";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { buildOrderedUsagePurposeList, normalizeUsagePurpose } from "@/utils/usage-purpose";

import type { NonMedicalAsset, NonMedicalRoom } from "@/types/non-medical-assets-types";

import { USAGE_OPTIONS } from "@/utils/asset-usage";
import { Building, ChevronDown, ChevronUp, Edit2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const normalizeNonMedicalDetailId = (
  detail: Partial<NonMedicalAsset> & { assetCode?: string; serialNumber?: string },
  roomId: string,
  index: number,
) => String(detail.id || detail.assetCode || detail.serialNumber || `${roomId}-detail-${index + 1}`)

export default function NonMedicalAssetsPage() {
  const router = useRouter()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [rooms, setRooms] = useState<NonMedicalRoom[]>([])
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<NonMedicalAsset | null>(null)
  const [editingRoom, setEditingRoom] = useState<NonMedicalRoom | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState("")
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("Semua")

  const categoryOptions = Object.keys(NON_MEDICAL_ASSET_CATEGORIES)
  const defaultCategory = categoryOptions[0] ?? "Sarana Gedung dan Infrastruktur"
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

  const closeAssetForm = () => {
    setShowAssetForm(false)
    setEditingAsset(null)
    setSelectedRoomId("")
  }

  const startRoomCreation = () => {
    resetRoomForm()
    setEditingRoom(null)
    setShowRoomForm(true)
  }

  const loadRooms = async () => {
    try {
      const response = await assetService.getNonMedicalAssets({ page: 1, limit: 1000 })
      if (!response.success) {
        alert(response.message || "Gagal memuat data inventaris non-medis")
        return
      }

      const apiAssets = response.data as Asset[]
      const mappedRooms: NonMedicalRoom[] = apiAssets.map((asset) => {
        const roomId = String(asset.id)
        const details = getSpecificationDetails<NonMedicalAsset & { brandModel?: string }>(asset.specifications).map(
          (detail, index) => ({
            ...detail,
            id: normalizeNonMedicalDetailId(detail, roomId, index),
            roomId,
            name: detail.name ?? detail.brandModel ?? "",
          }),
        )
        return {
          id: roomId,
          roomName: asset.location || "",
          assetName: asset.name,
          assetCode: asset.assetCode,
          category: asset.category,
          assets: details,
        }
      })
      setRooms(mappedRooms)
    } catch (error: any) {
      alert(error.message || "Gagal memuat data inventaris non-medis")
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
        const details = currentRoom.assets || []
        const response = await assetService.update(currentRoom.id, {
          name: roomFormData.roomName,
          category: roomFormData.category || defaultCategory,
          type: "non_medical",
          location: roomFormData.roomName,
          specifications: buildSpecifications(details),
          status: deriveAssetStatus(details),
          condition: deriveAssetCondition(details),
        })
        if (!response.success) {
          alert(response.message || "Gagal memperbarui inventaris non-medis")
          return
        }
      } else {
        const response = await assetService.create({
          name: roomFormData.roomName,
          category: roomFormData.category || defaultCategory,
          type: "non_medical",
          location: roomFormData.roomName,
          status: "available",
          condition: "good",
          specifications: buildSpecifications<NonMedicalAsset>([]),
        })
        if (!response.success) {
          alert(response.message || "Gagal menambah inventaris non-medis")
          return
        }
      }

      await loadRooms()
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan inventaris non-medis")
      return
    }

    closeRoomForm()

    if (!isEditingRoom) {
      toast({
        title: "Inventaris non-medis berhasil ditambahkan",
        description: "Data inventaris non-medis sudah tersimpan.",
      })
    }
  }

  const handleDeleteRoom = async (roomId: string) => {
    if (!canDeleteInventory) {
      alert("Hanya Admin yang dapat menghapus data inventaris")
      return
    }
    const isConfirmed = await confirm({
      title: "Hapus inventaris non-medis",
      description: "Hapus ruangan ini beserta semua inventaris di dalamnya?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return
    try {
      const response = await assetService.delete(roomId, "non_medical")
      if (!response.success) {
        alert(response.message || "Gagal menghapus inventaris non-medis")
        return
      }
      await loadRooms()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus inventaris non-medis")
    }
  }

  const handleEditRoom = (room: NonMedicalRoom) => {
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

  const handleSaveAsset = async (asset: NonMedicalAsset) => {
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

    const normalizedAsset = {
      ...asset,
      id: asset.id || Date.now().toString(),
      roomId: asset.roomId || selectedRoomId,
    }

    // Create or update the asset in the details array
    let updatedDetails: NonMedicalAsset[]
    
    if (isEditingAsset) {
      // When editing, replace the existing asset with the new data
      updatedDetails = targetRoom.assets.map((item) => 
        item.id === normalizedAsset.id ? normalizedAsset : item
      )
    } else {
      // When creating new, just add to the array
      updatedDetails = [...targetRoom.assets, normalizedAsset]
    }

    try {
      const response = await assetService.update(selectedRoomId, {
        specifications: buildSpecifications(updatedDetails),
        status: deriveAssetStatus(updatedDetails),
        condition: deriveAssetCondition(updatedDetails),
        type: "non_medical",
      })
      if (!response.success) {
        alert(response.message || "Gagal menyimpan detail inventaris")
        return
      }
      await loadRooms()
      closeAssetForm()

      if (!isEditingAsset) {
        toast({
          title: "Alat inventaris non-medis berhasil ditambahkan",
          description: "Data alat inventaris non-medis sudah tersimpan.",
        })
      } else {
        toast({
          title: "Detail inventaris non-medis berhasil diperbarui",
          description: "Perubahan detail inventaris non-medis sudah tersimpan.",
        })
      }
    } catch (error: any) {
      console.error("Asset save error:", error)
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
        type: "non_medical",
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

  const usageCounts = rooms.reduce<Record<string, number>>((acc, room) => {
    room.assets.forEach((asset) => {
      const key = normalizeUsagePurpose(asset.usagePurpose || "Operasional bersama", USAGE_OPTIONS)
      acc[key] = (acc[key] || 0) + 1
    })
    return acc
  }, {})

  const usageOrder = buildOrderedUsagePurposeList(USAGE_OPTIONS, Object.keys(usageCounts))
  const usageList = usageOrder.map((usage) => ({
    label: usage,
    count: usageCounts[usage] || 0,
  })).filter((item) => item.count > 0)
  const totalRoomCount = rooms.length
  const totalAssetCount = rooms.reduce((total, room) => total + room.assets.length, 0)

  const searchTermNormalized = searchTerm.trim().toLowerCase()
  const getRoomNoId = (roomId: string) => formatNoId("INM", roomId)
  const getAssetNoId = (assetId: string) => formatNoId("INM-DTL", assetId)

  const matchesAssetSearch = (asset: NonMedicalAsset) => {
    if (!searchTermNormalized) return false
    return matchesSearchKeyword(searchTerm, [
      getAssetNoId(asset.id),
      asset.id,
      asset.roomId,
      asset.inventoryName,
      asset.name,
      asset.serialNumber,
      asset.assetCode,
      normalizeUsagePurpose(asset.usagePurpose, USAGE_OPTIONS),
      asset.notes,
      asset.status,
      asset.condition,
    ])
  }

  const filteredRooms = rooms.filter((room) => {
    const matchesRoomSearch = matchesSearchKeyword(searchTerm, [
      getRoomNoId(room.id),
      room.id,
      room.roomName,
      room.assetName,
      room.assetCode,
      room.category,
    ])
    const matchesDetailSearch = searchTermNormalized ? room.assets.some(matchesAssetSearch) : false
    const matchesCategory = filterCategory === "Semua" || room.category === filterCategory
    return (matchesRoomSearch || matchesDetailSearch) && matchesCategory
  })

  return (
    <div className="bg-linear-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30">
      <div className="mx-auto w-full max-w-7xl space-y-6 page-gutter">
        <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-slate-50 panel-gutter">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl space-y-3">
                  <div className="inline-flex p-2 bg-linear-to-br from-cyan-500 to-teal-500 rounded-lg">
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">Inventaris Non-Medis</h1>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600">
                      Kelola aset penunjang operasional dengan tampilan inventaris yang lebih rapi dan mudah dipantau.
                    </p>
                  </div>
                </div>
                {canManageInventory && (
                  <Button
                    onClick={startRoomCreation}
                    className="w-full rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700 sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Inventaris
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-5 panel-gutter">
              <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600 leading-none">Ruang</p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-600">Lokasi aset non-medis terdaftar.</p>
                  </div>
                  <p className="shrink-0 text-xl font-semibold leading-none text-slate-900">{totalRoomCount}</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-700/80 leading-none">Detail Aset</p>
                    <p className="mt-1 text-[11px] leading-4 text-cyan-800/80">Aset penunjang operasional di seluruh ruang.</p>
                  </div>
                  <p className="shrink-0 text-xl font-semibold leading-none text-cyan-950">{totalAssetCount}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700/80 leading-none">Pemakaian</p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-none text-emerald-950">Distribusi utama</p>
                    </div>
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                  </div>
                  {usageList.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-4">
                      {usageList.slice(0, 8).map((item) => (
                        <div key={item.label} className="rounded-lg bg-white/80 px-1.5 py-1 text-center">
                          <p className="truncate text-[9px] font-medium leading-none text-emerald-700/80">{item.label}</p>
                          <p className="mt-0.5 text-[13px] font-semibold leading-none text-emerald-700">{item.count}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-800/80">Belum ada data pemakaian.</p>
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
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
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
                  <h3 className="font-semibold">{editingRoom ? "Edit Inventaris Non-Medis" : "Tambah Inventaris Non-Medis Baru"}</h3>
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
              <p className="text-muted-foreground">Belum ada inventaris non-medis terdaftar</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
        {filteredRooms.map((room) => {
          const categoryMeta =
            NON_MEDICAL_ASSET_CATEGORIES[room.category as keyof typeof NON_MEDICAL_ASSET_CATEGORIES]
          const detailMatchesSearch = searchTermNormalized ? room.assets.some(matchesAssetSearch) : false
          const assetsToDisplay = detailMatchesSearch ? room.assets.filter(matchesAssetSearch) : room.assets
          const isExpanded = expandedRooms.has(room.id)
          const shouldAutoExpandFromSearch = Boolean(searchTermNormalized)
          const shouldShowDetails = isExpanded || shouldAutoExpandFromSearch
          const roomNoId = getRoomNoId(room.id)

          return (
            <Card key={room.id} className="overflow-hidden">
                  <div
                    className="bg-linear-to-r from-teal-50 to-cyan-50 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between cursor-pointer hover:from-teal-100 hover:to-cyan-100"
                    onClick={() => toggleRoomExpanded(room.id)}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <button className="text-teal-600">
                        {shouldShowDetails ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{room.roomName}</h3>
                        <p className="text-[11px] text-muted-foreground">No ID: {roomNoId}</p>
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <div className="flex flex-col items-end gap-1 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {assetsToDisplay.length} Detail
                    </Badge>
                          <Badge variant="outline" className="text-[11px]">
                            {room.category}
                          </Badge>
                        </div>
                        {categoryMeta?.description && (
                          <span className="max-w-[18ch] wrap-break-word text-left sm:text-right">{categoryMeta.description}</span>
                        )}
                      </div>
                      {canEditInventory && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditRoom(room)
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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
                          className="text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {editingRoom?.id === room.id && (
                    <CardContent className="border-t border-border bg-slate-50/60 p-3">
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
                              setShowRoomForm(false)
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
                          {assetsToDisplay.map((asset, assetIndex) => {
                            const assetKey = asset.id ?? `${room.id}-${assetIndex}`
                            return (
                              <div
                                key={assetKey}
                                className="border border-border rounded-lg p-3 hover:bg-muted/50 h-full flex flex-col justify-between gap-4"
                              >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm">{asset.inventoryName || asset.name}</span>
                                    <Badge variant="outline" className="text-[10px]">
                                      No ID: {getAssetNoId(asset.id)}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs border ${
                                        asset.status === "Aktif"
                                          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                                          : asset.status === "Dalam Perbaikan"
                                            ? "bg-amber-100 border-amber-300 text-amber-900"
                                            : asset.status === "Dipinjam"
                                              ? "bg-sky-100 border-sky-300 text-sky-800"
                                            : asset.status === "Sedang Digunakan"
                                              ? "bg-sky-100 border-sky-300 text-sky-800"
                                              : "bg-rose-100 border-rose-300 text-rose-800"
                                      }`}
                                    >
                                      {asset.status}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs border ${
                                        asset.condition === "Baik"
                                          ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                                          : asset.condition === "Cukup"
                                            ? "bg-amber-100 border-amber-300 text-amber-900"
                                            : "bg-red-100 border-red-300 text-red-800"
                                      }`}
                                    >
                                      {asset.condition}
                                    </Badge>
                                  </div>
                                  {asset.type && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getNonMedicalAssetTypeColor(asset.type)}`}
                                    >
                                      {getNonMedicalAssetTypeLabel(asset.type)}
                                    </Badge>
                                  )}
                                  <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-2 sm:gap-4">
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide">Kode</p>
                                      <p className="text-foreground font-medium">{asset.assetCode || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide">SN</p>
                                      <p className="text-foreground font-medium">{asset.serialNumber || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide">Merk</p>
                                      <p className="text-foreground font-medium">{asset.name || "-"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide">Beli</p>
                                      <p className="text-foreground font-medium">
                                        {asset.purchaseDate
                                          ? new Date(asset.purchaseDate).toLocaleDateString("id-ID")
                                          : "-"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 text-[13px] text-muted-foreground sm:grid-cols-2 sm:gap-4">
                                    {asset.lastMaintenance && (
                                      <div>
                                        <p className="text-[11px] uppercase tracking-wide">Pemeliharaan</p>
                                        <p className="text-foreground font-medium">
                                          {new Date(asset.lastMaintenance).toLocaleDateString("id-ID")}
                                        </p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-[11px] uppercase tracking-wide">Penggunaan</p>
                                      <p className="text-foreground font-medium">
                                        {normalizeUsagePurpose(asset.usagePurpose || "Operasional bersama", USAGE_OPTIONS)}
                                      </p>
                                    </div>
                                  </div>
                                  {asset.notes && (
                                    <div className="text-[13px] text-muted-foreground">
                                      <p className="text-[11px] uppercase tracking-wide">Catatan</p>
                                      <p className="text-foreground font-medium">{asset.notes}</p>
                                    </div>
                                  )}
                                </div>
                                {(canEditInventory || canDeleteInventory) && (
                                  <div className="flex gap-1 shrink-0">
                                    {canEditInventory && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => {
                                          setShowRoomForm(false)
                                          setSelectedRoomId(room.id)
                                          setEditingAsset(asset)
                                          setShowAssetForm(true)
                                        }}
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                    {canDeleteInventory && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                        onClick={() => handleDeleteAsset(room.id, asset.id)}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
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

      {/* Asset Form Modal */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-[calc(100%-1rem)] rounded-lg bg-background max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <NonMedicalAssetForm
              asset={editingAsset}
              onSave={handleSaveAsset}
              onCancel={closeAssetForm}
            />
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
          Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)
        </p>
      </div>
    </div>
  )
}
