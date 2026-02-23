"use client"

import { MEDICAL_ASSET_CATEGORIES } from "@/components/medical-asset-categories"
import MedicalAssetForm from "@/components/medical-asset-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getMedicalAssetTypeColor, getMedicalAssetTypeLabel } from "@/constants/medical-asset-types"
import { assetService, type Asset } from "@/services/asset.service"
import { getCurrentUser } from "@/services/auth-utils"
import type { User } from "@/types/auth-types"
import type { MedicalAsset, MedicalRoom } from "@/types/medical-assets-types"
import { buildSpecifications, deriveAssetCondition, deriveAssetStatus, getSpecificationDetails } from "@/utils/api-mappers"
import { MEDICAL_USAGE_OPTIONS } from "@/utils/medical-asset-usage"


import { BookOpen, ChevronDown, ChevronUp, Edit2, Plus, Search, Sparkles, Stethoscope, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function MedicalAssetsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [rooms, setRooms] = useState<MedicalRoom[]>([])
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<MedicalAsset | null>(null)
  const [editingRoom, setEditingRoom] = useState<MedicalRoom | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState("")
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("Semua")
  const categoryOptions = Object.keys(MEDICAL_ASSET_CATEGORIES)
  const defaultCategory = categoryOptions[0] ?? "Alat Diagnostik dan Pencitraan"
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
          category: asset.category,
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
      router.push("/login")
    } else {
      setCurrentUser(user)
    }
  }, [router])

  useEffect(() => {
    loadRooms()
  }, [])

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "leader"
  const usageCounts = rooms.reduce<Record<string, number>>((acc, room) => {
    room.assets.forEach((asset) => {
      const key = asset.usagePurpose || "Operasional Bersama"
      acc[key] = (acc[key] || 0) + 1
    })
    return acc
  }, {})

  const usageList = MEDICAL_USAGE_OPTIONS.map((usage) => ({
    label: usage,
    count: usageCounts[usage] || 0,
  })).filter((item) => item.count > 0)

  const handleAddRoom = async () => {
    if (!roomFormData.roomName) {
      alert("Masukkan nama ruangan")
      return
    }

    try {
      if (editingRoom) {
        const details = editingRoom.assets || []
        const response = await assetService.update(editingRoom.id, {
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
    if (!isAdmin) {
      alert("Hanya Admin/Leader yang dapat menghapus data inventaris")
      return
    }
    if (!confirm("Hapus ruangan ini beserta semua inventaris di dalamnya?")) return
    try {
      const response = await assetService.delete(roomId)
      if (!response.success) {
        alert(response.message || "Gagal menghapus inventaris medis")
        return
      }
      await loadRooms()
    } catch (error: any) {
      alert(error.message || "Gagal menghapus inventaris medis")
    }
  }

  const handleSaveAsset = async (asset: MedicalAsset) => {
    if (!isAdmin) {
      alert("Hanya Admin/Leader yang dapat menambah atau mengubah detail inventaris")
      return
    }
    const targetRoom = rooms.find((room) => room.id === selectedRoomId)
    if (!targetRoom) return

    const updatedDetails = editingAsset
      ? targetRoom.assets.map((a) => (a.id === asset.id ? asset : a))
      : [...targetRoom.assets, { ...asset, id: Date.now().toString() }]

    try {
      const response = await assetService.update(selectedRoomId, {
        specifications: buildSpecifications(updatedDetails),
        status: deriveAssetStatus(updatedDetails),
        condition: deriveAssetCondition(updatedDetails),
      })
      if (!response.success) {
        alert(response.message || "Gagal menyimpan detail inventaris")
        return
      }
      await loadRooms()
      setShowAssetForm(false)
      setEditingAsset(null)
    } catch (error: any) {
      alert(error.message || "Gagal menyimpan detail inventaris")
    }
  }

  const handleDeleteAsset = async (roomId: string, assetId: string) => {
    if (!isAdmin) {
      alert("Hanya Admin/Leader yang dapat menghapus inventaris")
      return
    }
    if (!confirm("Hapus inventaris ini?")) return
    const targetRoom = rooms.find((room) => room.id === roomId)
    if (!targetRoom) return
    const updatedDetails = targetRoom.assets.filter((a) => a.id !== assetId)
    try {
      const response = await assetService.update(roomId, {
        specifications: buildSpecifications(updatedDetails),
        status: deriveAssetStatus(updatedDetails),
        condition: deriveAssetCondition(updatedDetails),
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Alat Diagnostik":
      case "Alat Diagnostik dan Pencitraan":
        return "bg-blue-100 text-blue-800"
      case "Alat Terapi & Perawatan":
      case "Alat Terapi dan Perawatan":
        return "bg-green-100 text-green-800"
      case "Alat Bedah":
      case "Alat Bedah dan Operasi":
        return "bg-red-100 text-red-800"
      case "Alat Lab Medis":
      case "Alat Laboratorium Medis":
        return "bg-purple-100 text-purple-800"
      case "Alat Kebidanan":
      case "Alat Kebidanan dan Kandungan":
        return "bg-pink-100 text-pink-800"
      case "Alat Kesehatan Gigi":
      case "Alat Kesehatan Gigi dan Mulut":
        return "bg-yellow-100 text-yellow-800"
      case "Alat Kesehatan Dasar":
      case "Alat Kesehatan Dasar dan P3K":
        return "bg-cyan-100 text-cyan-800"
      case "Alat Khusus":
      case "Alat Khusus dan Modern":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const searchTermNormalized = searchTerm.trim().toLowerCase()

  const matchesAssetSearch = (asset: MedicalAsset) => {
    if (!searchTermNormalized) return false
    const searchableFields = [
      asset.inventoryName,
      asset.name,
      asset.serialNumber,
      asset.assetCode,
      asset.usagePurpose,
      asset.notes,
      asset.status,
      asset.condition,
    ]
    return searchableFields.some((value) => value?.toLowerCase().includes(searchTermNormalized))
  }

  const filteredRooms = rooms.filter((room) => {
    const matchesRoomSearch =
      (room.roomName || "").toLowerCase().includes(searchTermNormalized) ||
      (room.assetName || "").toLowerCase().includes(searchTermNormalized) ||
      (room.assetCode || "").toLowerCase().includes(searchTermNormalized) ||
      (room.category || "").toLowerCase().includes(searchTermNormalized)
    const matchesDetailSearch = searchTermNormalized ? room.assets.some(matchesAssetSearch) : false
    const matchesCategory = filterCategory === "Semua" || room.category === filterCategory
    return (matchesRoomSearch || matchesDetailSearch) && matchesCategory
  })

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-cyan-950/30 min-h-screen">
      <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 space-y-6">

        <div className="space-y-6">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl shadow-lg">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-foreground bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent leading-tight">
                    Inventaris Medis
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    {isAdmin
                      ? "Kelola peralatan medis antar ruang sesuai dokumentasi"
                      : "Lihat status inventaris medis sambil merujuk dokumentasi."}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
              Memastikan struktur pengelompokan aset, kategori penggunaan, dan status pemeliharaan mudah dipantau.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <div className="flex gap-2">
                <Badge
                  variant="outline"
                  className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300"
                >
                  
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                >

                </Badge>
              </div>
              {isAdmin && (
                <Button onClick={startRoomCreation} size="sm" className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="w-4 h-4 mr-1" />
                  Tambah Inventaris
                </Button>
              )}
            </div>
          </div>

        <div className="p-4 rounded-2xl border border-teal-200 bg-white/80 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-teal-100">
              <BookOpen className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Panduan dokumentasi</p>
              <p className="text-xs text-muted-foreground mt-1">
                Standar untuk menuntun pengguna dalam mengelola aset medis, menjamin akurasi kategori dan laporan pemeliharaan.
              </p>
            </div>
          </div>
        </div>
      </div>

        {usageList.length > 0 && (
          <Card className="rounded-2xl border border-teal-100 bg-white/90 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.3em] text-muted-foreground uppercase">
                    Penggunaan utama
                  </p>
                  <h3 className="text-lg font-semibold text-foreground">Distribusi pemakaian medis</h3>
                </div>
                <Sparkles className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {usageList.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-slate-50/80 p-3 text-xs font-semibold text-foreground"
                  >
                    <p className="text-muted-foreground text-[11px]">{item.label}</p>
                    <p className="text-2xl text-emerald-600">{item.count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Room Form */}
        {showRoomForm && (
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
        )}

        {/* Filters */}
        <Card className="rounded-2xl border border-border bg-white/80 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cari ruangan, nama alat, kode barang..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-sm"
                  />
                </div>
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-background text-sm"
              >
                <option>Semua</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

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
              const detailMatchesSearch = searchTermNormalized ? room.assets.some(matchesAssetSearch) : false
              const assetsToDisplay = detailMatchesSearch ? room.assets.filter(matchesAssetSearch) : room.assets
              const isExpanded = expandedRooms.has(room.id)
              const shouldShowDetails = isExpanded || (searchTermNormalized && detailMatchesSearch)
              return (
                <Card key={room.id} className="overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-50 to-teal-50 p-3 flex items-center justify-between cursor-pointer hover:from-cyan-100 hover:to-teal-100"
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {assetsToDisplay.length} Detail
                    </Badge>
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      Medis
                    </Badge>
                    {isAdmin && (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                  {editingRoom?.id === room.id && (
                    <CardContent className="border-t border-border bg-teal-50/50 p-3">
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
                      <div className="mb-3 flex justify-between items-center">
                        <h4 className="font-medium text-sm">Detail Inventaris</h4>
                        {isAdmin && (
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
                          {assetsToDisplay.map((asset) => (
                            <div
                              key={asset.id}
                              className="border border-border rounded-lg p-3 hover:bg-muted/50 h-full flex flex-col justify-between gap-4"
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm">{asset.inventoryName || asset.name}</span>
                                    <Badge
                                      variant={asset.status === "Aktif" ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {asset.status}
                                    </Badge>
                                    <Badge
                                      variant={
                                        asset.condition === "Baik"
                                          ? "default"
                                          : asset.condition === "Cukup"
                                            ? "secondary"
                                            : "destructive"
                                      }
                                      className="text-xs"
                                    >
                                      {asset.condition}
                                    </Badge>
                                  </div>
                                  {asset.type && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${getMedicalAssetTypeColor(asset.type)}`}
                                    >
                                      {getMedicalAssetTypeLabel(asset.type)}
                                    </Badge>
                                  )}
                                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
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
                                  <div className="grid grid-cols-2 gap-4 text-[13px] text-muted-foreground">
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
                                        {asset.usagePurpose || "Operasional Bersama"}
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
                                {isAdmin && (
                                  <div className="flex gap-1 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        setSelectedRoomId(room.id)
                                        setEditingAsset(asset)
                                        setShowAssetForm(true)
                                      }}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                      onClick={() => handleDeleteAsset(room.id, asset.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Copyright Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Kementerian Kesehatan RI - RSUP Persahabatan<br />
          Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman
        </div>
      </div>

      {/* Asset Form Modal */}
      {showAssetForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
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
