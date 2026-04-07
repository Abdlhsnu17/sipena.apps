"use client"

import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { assetService } from "@/services/asset.service"
import { getCurrentUser, setCurrentUser } from "@/services/auth-utils"
import { authService } from "@/services/auth.service"
import { borrowingService } from "@/services/borrowing.service"
import { maintenanceService } from "@/services/maintenance.service"
import { userService } from "@/services/user.service"
import { toPublicPhotoUrl } from "@/utils/photoUrl"
// ...existing code...
import { Eye, EyeOff, Moon, Settings, Sun } from "lucide-react"
import { ChangeEvent, useEffect, useState } from "react"

export default function SettingsPage() {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [profileForm, setProfileForm] = useState({
    nip: "",
    name: "",
    email: "",
    gender: "",
    workUnit: "",
    homeAddress: "",
  })
  const [profileLoading, setProfileLoading] = useState(true)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null)
  const [remotePhotoUrl, setRemotePhotoUrl] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  const getPhotoVersion = (user?: {
    updatedAt?: string | number | null
    lastLogin?: string | number | null
    createdAt?: string | number | null
  }): string | number | null => {
    return user?.updatedAt ?? user?.lastLogin ?? user?.createdAt ?? null
  }

  const updateRemotePhotoState = (path: string | null, version: string | number | null = null) => {
    setPhotoPath(path)
    setRemotePhotoUrl(toPublicPhotoUrl(path, version))
  }
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true)
      try {
        const response = await authService.getProfile()
        if (response.success && response.data?.user) {
          const user = response.data.user
          setProfileForm({
            nip: user.nip ?? "",
            name: user.name ?? "",
            email: user.email ?? "",
            gender: user.gender ?? "",
            workUnit: user.workUnit ?? "",
            homeAddress: user.homeAddress ?? "",
          })
          updateRemotePhotoState(user.photoPath ?? null, getPhotoVersion(user))
        }
      } catch (error) {
        console.error("Failed to load profile:", error)
      } finally {
        setProfileLoading(false)
      }
    }

    void loadProfile()
  }, [])

  useEffect(() => {
    return () => {
      if (localPhotoPreview) {
        URL.revokeObjectURL(localPhotoPreview)
      }
    }
  }, [localPhotoPreview])

  const handleChangePassword = async () => {
    const user = getCurrentUser()
    if (!user) {
      toast({
        title: "Error",
        description: "Anda harus login terlebih dahulu",
        variant: "destructive",
      })
      return
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast({
        title: "Error",
        description: "Semua field harus diisi",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmNewPassword) {
      toast({
        title: "Error",
        description: "Password baru dan konfirmasi tidak cocok",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password baru minimal 6 karakter",
        variant: "destructive",
      })
      return
    }

    setIsChangingPassword(true)

    try {
      const result = await userService.changePassword(user.id, currentPassword, newPassword)
      if (result.success) {
        toast({
          title: "Berhasil",
          description: "Password berhasil diubah",
        })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmNewPassword("")
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal mengubah password",
        variant: "destructive",
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleClearData = () => {
    alert("Fitur hapus data massal belum tersedia untuk penyimpanan berbasis server.")
  }

  const handleBackupData = async () => {
    try {
      const [medicalAssets, nonMedicalAssets, maintenanceData, borrowingData, usersData] = await Promise.all([
        assetService.getMedicalAssets({ page: 1, limit: 1000 }),
        assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
        maintenanceService.getAll({ page: 1, limit: 1000 }),
        borrowingService.getAll({ page: 1, limit: 1000 }),
        userService.getAll({ page: 1, limit: 1000 }),
      ])

      const backup = {
        timestamp: new Date().toISOString(),
        data: {
          medicalAssets: medicalAssets.success ? medicalAssets.data : [],
          nonMedicalAssets: nonMedicalAssets.success ? nonMedicalAssets.data : [],
          maintenance: maintenanceData.success ? maintenanceData.data : [],
          borrowings: borrowingData.success ? borrowingData.data : [],
          users: usersData.success ? usersData.data : [],
        },
      }

      const element = document.createElement("a")
      element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2)))
      element.setAttribute("download", `backup-inventaris-${new Date().toISOString().split("T")[0]}.json`)
      element.style.display = "none"
      document.body.appendChild(element)
      element.click()
      document.body.removeChild(element)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal membuat backup data",
        variant: "destructive",
      })
    }
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (localPhotoPreview) URL.revokeObjectURL(localPhotoPreview)

    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setLocalPhotoPreview(previewUrl)
      setPhotoFile(file)
    } else {
      setLocalPhotoPreview(null)
      setPhotoFile(null)
    }
  }

  const clearPhotoSelection = () => {
    setPhotoFile(null)
    setLocalPhotoPreview(null)
  }

  const handleProfileSubmit = async () => {
    setIsUpdatingProfile(true)
    try {
      const response = await authService.updateProfile({
        nip: profileForm.nip || undefined,
        name: profileForm.name || undefined,
        email: profileForm.email || undefined,
        gender: profileForm.gender || undefined,
        workUnit: profileForm.workUnit || undefined,
        homeAddress: profileForm.homeAddress || undefined,
        photo: photoFile || undefined,
      })

      if (response.success && response.data?.user) {
        const updated = response.data.user
        setProfileForm({
          nip: updated.nip ?? "",
          name: updated.name ?? "",
          email: updated.email ?? "",
          gender: updated.gender ?? "",
          workUnit: updated.workUnit ?? "",
          homeAddress: updated.homeAddress ?? "",
        })
        // 1) update preview url (cache-busting) while reusing previous path when backend omits it
        const nextPhotoPath = updated.photoPath ?? photoPath
        updateRemotePhotoState(nextPhotoPath ?? null, getPhotoVersion(updated))

        // 2) update auth session supaya sidebar yang pakai getCurrentUser() ikut berubah
        try {
          const current = getCurrentUser() || {}
          const merged = { ...current, ...updated }
          setCurrentUser(merged)
        } catch {}

        clearPhotoSelection()
        toast({
          title: "Profil berhasil disimpan",
          description: "Data profil sudah tersimpan.",
        })
      } else {
        toast({
          title: "Error",
          description: response.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui profil",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const profileImageSrc = localPhotoPreview || remotePhotoUrl

  return (
    <div className="flex-1 overflow-auto bg-linear-to-br from-slate-50 via-white to-emerald-50/30 min-h-screen">
      <div className="w-full px-6 py-6 lg:px-8 lg:py-8">
        <div className="max-w-5xl w-full space-y-6">
        <div className="space-y-4">


          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-linear-to-br from-slate-900 to-slate-600 rounded-2xl shadow-lg">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Pengaturan Sistem</h1>
                  <p className="text-sm text-muted-foreground">
                    Kelola preferensi yang sejalan dengan dokumentasi
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                  
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">

                </Badge>
              </div>
            </div>
            <div className="text-sm text-muted-foreground max-w-sm">
              <p className="text-foreground font-semibold"></p>
              <p>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-teal-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <p className="text-sm text-teal-700/90">
              Halaman ini memperkuat kontrol sistem agar kebijakan, tema, dan backup data mengikuti standar arsitektur
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profil Akun</CardTitle>
            <CardDescription>
              Lengkapi NIP, jenis kelamin, unit kerja, alamat, dan foto profil agar identitas akun lengkap.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {profileLoading ? (
              <p className="text-sm text-muted-foreground">Memuat informasi profil...</p>
            ) : (
              <>
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <Avatar className="h-20 w-20">
                    {profileImageSrc ? (
                      <AvatarImage src={profileImageSrc} alt={`${profileForm.name || "Profil"} photo`} />
                    ) : (
                      <AvatarFallback className="text-lg uppercase text-muted-foreground">
                        {profileForm.name ? profileForm.name.slice(0, 1) : "P"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">Unggah foto profil (JPG/PNG hingga 5MB)</p>
                    <label
                      htmlFor="profilePhoto"
                      className="inline-flex items-center gap-2 rounded-full border border-teal-200 px-4 py-1 text-xs font-semibold text-teal-600 hover:cursor-pointer dark:border-teal-500/70"
                    >
                      <span>Unggah Foto</span>
                      <input
                        id="profilePhoto"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handlePhotoChange}
                      />
                    </label>
                    {photoFile && (
                      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearPhotoSelection}>
                        Batalkan pilihan
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profileNip">NIP</Label>
                    <Input
                      id="profileNip"
                      value={profileForm.nip}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, nip: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profileName">Nama Lengkap</Label>
                    <Input
                      id="profileName"
                      value={profileForm.name}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profileEmail">Email</Label>
                    <Input
                      id="profileEmail"
                      type="email"
                      value={profileForm.email}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Jenis Kelamin</Label>
                    <Select
                      value={profileForm.gender || undefined}
                      onValueChange={(value) => setProfileForm((prev) => ({ ...prev, gender: value }))}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="Pilih jenis kelamin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Laki-laki</SelectItem>
                        <SelectItem value="female">Perempuan</SelectItem>
                        <SelectItem value="other">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workUnit">Unit Kerja</Label>
                  <Input
                    id="workUnit"
                    value={profileForm.workUnit}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, workUnit: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="homeAddress">Alamat Tempat Tinggal</Label>
                  <Textarea
                    id="homeAddress"
                    rows={3}
                    value={profileForm.homeAddress}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, homeAddress: event.target.value }))}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleProfileSubmit}
                    disabled={profileLoading || isUpdatingProfile}
                  >
                    {isUpdatingProfile ? "Menyimpan..." : "Simpan Profil"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="max-w-2xl space-y-6">
          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Ganti Sandi</CardTitle>
              <CardDescription>Ubah password akun Anda untuk keamanan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password Saat Ini</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password saat ini"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Konfirmasi password baru"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Button 
                onClick={handleChangePassword} 
                disabled={isChangingPassword}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isChangingPassword ? "Menyimpan..." : "Ubah Password"}
              </Button>
            </CardContent>
          </Card>

          {/* Theme Mode Settings - Dark/Light */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {mounted && theme === "dark" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                Tema Tampilan
              </CardTitle>
              <CardDescription>Pilih mode tampilan website (Terang/Gelap)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* Light Mode */}
                <button
                  onClick={() => setTheme("light")}
                  className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                    mounted && theme === "light"
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950 shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="w-16 h-12 rounded-lg bg-white border-2 border-gray-200 shadow-sm flex items-center justify-center">
                    <Sun className="w-6 h-6 text-yellow-500" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Terang</span>
                  {mounted && theme === "light" && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Dark Mode */}
                <button
                  onClick={() => setTheme("dark")}
                  className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                    mounted && theme === "dark"
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950 shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="w-16 h-12 rounded-lg bg-gray-900 border-2 border-gray-700 shadow-sm flex items-center justify-center">
                    <Moon className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Gelap</span>
                  {mounted && theme === "dark" && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* System Mode */}
                <button
                  onClick={() => setTheme("system")}
                  className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                    mounted && theme === "system"
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-950 shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="w-16 h-12 rounded-lg bg-linear-to-r from-white to-gray-900 border-2 border-gray-300 shadow-sm flex items-center justify-center">
                    <div className="flex">
                      <Sun className="w-5 h-5 text-yellow-500" />
                      <Moon className="w-5 h-5 text-blue-400 -ml-1" />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-foreground">Sistem</span>
                  {mounted && theme === "system" && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Mode "Sistem" akan mengikuti pengaturan tema dari perangkat Anda.
              </p>
            </CardContent>
          </Card>

          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Informasi Sistem</CardTitle>
              <CardDescription>Detail tentang sistem ini</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Nama Sistem</label>
                  <p className="text-foreground font-medium">
                    Sistem Inventaris & Peminjaman Pemeliharaan Sarana Serta 
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Institusi</label>
                  <p className="text-foreground font-medium">RSUP Persahabatan Kementerian Kesehatan</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Versi</label>
                  <p className="text-foreground font-medium">2.5</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Tanggal Update</label>
                  <p className="text-foreground font-medium">{new Date().toLocaleDateString("id-ID")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card>
            <CardHeader>
              <CardTitle>Manajemen Data</CardTitle>
              <CardDescription>Kelola data server sistem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Data tersimpan di server. Gunakan fitur backup untuk menyimpan salinan data.
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleBackupData}>Backup Data</Button>
                <Button variant="destructive" onClick={handleClearData}>
                  Hapus Semua Data
                </Button>
              </div>
            </CardContent>
          </Card>


          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fitur Tersedia</CardTitle>
              <CardDescription>Daftar fitur lengkap sistem inventaris dan pemeliharaan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Dashboard & Monitoring</h4>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Dashboard Realtime dengan Statistik
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Grafik & Analitik Data
                    </li>
                  </ul>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Inventaris & Aset</h4>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Inventaris Non-Medis (Sarana Prasarana)
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Inventaris Medis (Peralatan Kesehatan)
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Peminjaman & Pengembalian</h4>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Sistem Peminjaman Alat
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Pengembalian & Tracking
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Pemeliharaan & Laporan</h4>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Jadwal Pemeliharaan Terencana
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Laporan & Analitik Lengkap
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Manajemen Sistem</h4>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Manajemen Pengguna (Admin/Leader/Staff)
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Dokumentasi Unggahan & UML Diagram Use Case
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Fitur Teknis</h4>
                  <ul className="space-y-2 text-sm text-foreground">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Sistem Otentikasi & Keamanan
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                      Backup & Restore Data
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">Kementerian Kesehatan RI - RSUP Persahabatan</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana
          </p>
        </div>
      </div>
    </div>
  </div>
  )
}
