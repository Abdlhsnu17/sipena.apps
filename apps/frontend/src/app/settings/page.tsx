"use client"

import { useTheme } from "@/components/theme/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser, setCurrentUser } from "@/services/auth-utils";
import { authService } from "@/services/auth.service";
import notificationService, { type NotificationDeliveryStatus } from "@/services/notification.service";
import { userService } from "@/services/user.service";
import { toPublicPhotoUrl } from "@/utils/photo-url";
import { isStrongPassword } from "@/utils/validation";
// ...existing code...
import { Eye, EyeOff, Monitor, Moon, Save, Settings, Smartphone, Sun } from "lucide-react";
import { ChangeEvent, SyntheticEvent, useEffect, useState } from "react";

export default function SettingsPage() {
  const { toast } = useToast()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [profileForm, setProfileForm] = useState({
    nip: "",
    name: "",
    email: "",
    gender: "",
    workUnit: "",
    subWorkUnit: "",
    homeAddress: "",
    phoneNumber: "",
  })
  const [profileLoading, setProfileLoading] = useState(true)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null)
  const [remotePhotoUrl, setRemotePhotoUrl] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [imageError, setImageError] = useState<boolean>(false)

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
    setImageError(false)
  }
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [deliveryStatus, setDeliveryStatus] = useState<NotificationDeliveryStatus | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    void notificationService.getDeliveryStatus().then((response) => {
      if (response.success) setDeliveryStatus(response.data)
    }).catch(() => undefined)
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
            subWorkUnit: user.subWorkUnit ?? "",
            homeAddress: user.homeAddress ?? "",
            phoneNumber: user.phoneNumber ?? "",
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

    if (!isStrongPassword(newPassword)) {
      toast({
        title: "Error",
        description: "Password baru minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, dan angka",
        variant: "destructive",
      })
      return
    }

    setIsChangingPassword(true)

    try {
      const result = await userService.changePassword(user.id, currentPassword, newPassword)
      if (result.success) {
        const currentUser = getCurrentUser()
        if (currentUser?.mustChangePassword) {
          setCurrentUser({ ...currentUser, mustChangePassword: false })
        }
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

  const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    if (file && file.size > MAX_PHOTO_SIZE_BYTES) {
      toast({
        title: "Ukuran file terlalu besar",
        description: "Pilih foto profil dengan ukuran maksimal 5MB.",
        variant: "destructive",
      })
      event.target.value = ""
      return
    }

    if (localPhotoPreview) URL.revokeObjectURL(localPhotoPreview)

    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setLocalPhotoPreview(previewUrl)
      setPhotoFile(file)
      setImageError(false)
    } else {
      setLocalPhotoPreview(null)
      setPhotoFile(null)
    }
  }

  const clearPhotoSelection = () => {
    setPhotoFile(null)
    setLocalPhotoPreview(null)
  }

  const handleImageError = (error: SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('[Photo] Image failed to load:', error)
    setImageError(true)
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
        subWorkUnit: profileForm.subWorkUnit || undefined,
        homeAddress: profileForm.homeAddress || undefined,
        phoneNumber: profileForm.phoneNumber || undefined,
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
          subWorkUnit: updated.subWorkUnit ?? "",
          homeAddress: updated.homeAddress ?? "",
          phoneNumber: updated.phoneNumber ?? "",
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
        console.error(`[Profile] Update failed:`, response.message)
        toast({
          title: "Error",
          description: response.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('[Profile] Error during submit:', error)
      const isPayloadTooLarge = error?.response?.status === 413
      toast({
        title: "Error",
        description: isPayloadTooLarge
          ? "Ukuran foto terlalu besar untuk diunggah. Pilih foto maksimal 5MB."
          : error.message || "Gagal memperbarui profil",
        variant: "destructive",
      })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const profileImageSrc = localPhotoPreview || remotePhotoUrl
  const currentUser = getCurrentUser()

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="w-full space-y-5">
        <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/35 dark:bg-slate-900/60">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-linear-to-br from-teal-500 to-teal-700 p-2.5 shadow-sm">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-[18px] font-bold text-foreground">Pengaturan</h1>
            </div>
          </div>
        </section>

        {currentUser?.mustChangePassword && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            Akun Anda wajib mengganti password sebelum menggunakan modul lain.
          </div>
        )}

        {currentUser?.mustCompletePhoneNumber && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
            Akun Anda belum memiliki nomor WhatsApp/SMS. Lengkapi nomor tersebut untuk dapat menggunakan modul lain,
            karena kode verifikasi lupa password hanya dikirim ke nomor terdaftar.
          </div>
        )}

        <div className="space-y-5">
          <Card className="gap-4 py-5">
            <CardHeader className="gap-1.5">
              <CardTitle className="text-base">Profil Akun</CardTitle>
              <CardDescription>
                Lengkapi NIP, jenis kelamin, unit kerja, alamat, dan foto profil agar identitas akun lengkap.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {profileLoading ? (
                <p className="text-sm text-muted-foreground">Memuat informasi profil...</p>
              ) : (
                <>
                  <div className="flex flex-col gap-4 rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/35 dark:bg-slate-900/40">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <Avatar className="h-16 w-16 shrink-0 border border-white/70 shadow-sm dark:border-slate-700/35">
                        {profileImageSrc && !imageError ? (
                          <AvatarImage src={profileImageSrc} alt={`${profileForm.name || "Profil"} photo`} onError={handleImageError} />
                        ) : null}
                        <AvatarFallback className="text-lg font-semibold uppercase text-white">
                          {profileForm.name ? profileForm.name.slice(0, 1) : "P"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground">Foto Profil</p>
                        <p className="text-xs leading-5 text-muted-foreground">Pilih foto profil (JPG/PNG hingga 5MB).</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <label
                        htmlFor="profilePhoto"
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-teal-200 px-3 text-xs font-semibold text-teal-700 hover:cursor-pointer hover:bg-teal-50 dark:border-teal-500/70 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-900/60"
                      >
                        <span>Pilih Foto</span>
                        <input
                          id="profilePhoto"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handlePhotoChange}
                        />
                      </label>
                      {photoFile && (
                        <>
                          <p className="max-w-xs text-xs font-medium text-amber-700 dark:text-amber-300 md:text-right">
                            Pratinjau foto sudah tampil. Klik <span className="font-semibold">Simpan Profil</span> agar avatar akun ikut berubah.
                          </p>
                          <Button variant="ghost" size="sm" className="text-muted-foreground md:self-end" onClick={clearPhotoSelection}>
                            Batalkan pratinjau
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">
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
                    <div className="space-y-2">
                      <Label>Jenis Kelamin</Label>
                      <Select
                        value={profileForm.gender || undefined}
                        onValueChange={(value) => setProfileForm((prev) => ({ ...prev, gender: value }))}
                      >
                        <SelectTrigger className="w-full" size="default">
                          <SelectValue placeholder="Pilih jenis kelamin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                          <SelectItem value="Perempuan">Perempuan</SelectItem>
                          <SelectItem value="Lainnya">Lainnya</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Nomor WhatsApp / SMS</Label>
                      <div className="relative">
                        <Smartphone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phoneNumber"
                          type="tel"
                          placeholder="+628xxxxxxxxxx"
                          value={profileForm.phoneNumber}
                          onChange={(event) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              phoneNumber: event.target.value.replace(/[^\d+]/g, ""),
                            }))
                          }
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="workUnit">Unit Kerja / Instalasi</Label>
                      <Input
                        id="workUnit"
                        value={profileForm.workUnit}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, workUnit: event.target.value }))}
                        placeholder="Contoh: Instalasi Rawat Inap"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subWorkUnit">Sub Ruangan</Label>
                      <Input
                        id="subWorkUnit"
                        value={profileForm.subWorkUnit}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, subWorkUnit: event.target.value }))}
                        placeholder="Contoh: Ranap Mawar / ICU / OK 1"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="homeAddress">Alamat Tempat Tinggal</Label>
                      <Textarea
                        id="homeAddress"
                        rows={2}
                        className="min-h-20"
                        value={profileForm.homeAddress}
                        onChange={(event) => setProfileForm((prev) => ({ ...prev, homeAddress: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleProfileSubmit}
                      disabled={profileLoading || isUpdatingProfile}
                      className="w-full bg-teal-600 text-white hover:bg-teal-700 sm:w-auto"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isUpdatingProfile ? "Menyimpan..." : photoFile ? "Simpan Profil & Foto" : "Simpan Profil"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid items-stretch gap-5 md:grid-cols-2">
            <Card className="h-full gap-4 py-5">
              <CardHeader className="gap-1.5">
                <CardTitle className="text-base">Ganti Sandi</CardTitle>
                <CardDescription>Ubah password akun Anda untuk keamanan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
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
                  className="w-full bg-teal-600 hover:bg-teal-700 sm:w-auto"
                >
                  {isChangingPassword ? "Menyimpan..." : "Ubah Password"}
                </Button>
              </CardContent>
            </Card>
            <Card className="h-full gap-4 py-5">
              <CardHeader className="gap-1.5">
                <CardTitle className="text-base">Informasi Sistem</CardTitle>
                <CardDescription>Informasi aplikasi dan tanggal yang sedang berjalan.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-sm dark:border-slate-700/35 dark:bg-slate-900/40">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">Nama Sistem</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5 text-sm dark:border-slate-700/35 dark:bg-slate-900/40">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">Tanggal Hari Ini</p>
                    <p className="text-sm text-muted-foreground">24/5/2026</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full gap-4 py-5">
              <CardHeader className="gap-1.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  {mounted && theme === "system" ? (
                    <Monitor className="h-5 w-5" />
                  ) : mounted && (theme === "dark" || resolvedTheme === "dark") ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                  Tema Tampilan
                </CardTitle>
                <CardDescription>Pilih mode terang, gelap, atau otomatis mengikuti sistem.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => setTheme("light")}
                    className={`relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-2.5 text-center transition-all ${
                      mounted && theme === "light"
                        ? "border-teal-500 bg-teal-50/80 shadow-sm dark:bg-teal-950/50"
                        : "border-gray-200 bg-white/70 hover:border-gray-300 hover:bg-slate-50 dark:border-gray-700 dark:bg-slate-900/40 dark:hover:border-gray-600"
                    }`}
                  >
                    <span className="rounded-full bg-amber-100 p-2 dark:bg-amber-300/20">
                      <Sun className="h-5 w-5 text-amber-600 dark:text-amber-200" />
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      Terang
                    </span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-2.5 text-center transition-all ${
                      mounted && theme === "dark"
                        ? "border-teal-500 bg-teal-50/80 shadow-sm dark:bg-teal-950/50"
                        : "border-gray-200 bg-white/70 hover:border-gray-300 hover:bg-slate-50 dark:border-gray-700 dark:bg-slate-900/40 dark:hover:border-gray-600"
                    }`}
                  >
                    <span className="rounded-full bg-indigo-100 p-2 dark:bg-indigo-300/20">
                      <Moon className="h-5 w-5 text-indigo-600 dark:text-indigo-200" />
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      Gelap
                    </span>
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={`relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-2.5 text-center transition-all ${
                      mounted && theme === "system"
                        ? "border-teal-500 bg-teal-50/80 shadow-sm dark:bg-teal-950/50"
                        : "border-gray-200 bg-white/70 hover:border-gray-300 hover:bg-slate-50 dark:border-gray-700 dark:bg-slate-900/40 dark:hover:border-gray-600"
                    }`}
                  >
                    <span className="rounded-full bg-sky-100 p-2 dark:bg-sky-300/20">
                      <Monitor className="h-5 w-5 text-sky-700 dark:text-sky-200" />
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      Sistem
                    </span>
                  </button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Mode sistem akan menyesuaikan tema perangkat Anda secara otomatis.
                </p>
              </CardContent>
            </Card>

            <Card className="h-full gap-4 py-5">
              <CardHeader className="gap-1.5">
                <CardTitle className="text-base">Status Kanal Notifikasi</CardTitle>
                <CardDescription>Status konfigurasi server tanpa menampilkan kredensial.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Dalam aplikasi', deliveryStatus?.inApp ? 'active' : 'unavailable'],
                  ['WhatsApp', deliveryStatus?.whatsapp.mode],
                  ['SMS', deliveryStatus?.sms.mode],
                  ['Email reset password', deliveryStatus?.email.mode],
                ].map(([label, mode]) => (
                  <div key={label} className="flex min-h-10 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                    <span>{label}</span>
                    <span className={`shrink-0 text-xs font-medium ${mode === 'active' ? 'text-emerald-600' : mode === 'preview' ? 'text-amber-600' : 'text-red-600'}`}>
                      {mode === 'active' ? 'Aktif' : mode === 'preview' ? 'Pratinjau lokal' : 'Belum dikonfigurasi'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
          </p>
        </div>
      </div>
    </div>
  )
}
