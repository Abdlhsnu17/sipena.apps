"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import apiService from "@/services/api.service"
import { AlertCircle, CheckCircle2, Award as IdCard, Eye, EyeOff, KeyRound, Lock } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import type React from "react"
import { useEffect, useState } from "react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<"verify" | "reset" | "success">("verify")
  const [nip, setNip] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null)
  const [verifiedUserName, setVerifiedUserName] = useState<string>("")

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await apiService.post<{
        success: boolean
        message: string
        data?: {
          user: { id: number | string; name: string; nip: string }
        }
      }>("/auth/reset-password/verify", { nip })

      const user = response.data?.user
      if (!user) {
        setError("Data pengguna tidak ditemukan.")
        return
      }

      setVerifiedUserId(String(user.id))
      setVerifiedUserName(user.name)
      setStep("reset")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat verifikasi")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!acknowledged) {
      setError("Centang untuk mengonfirmasi reset password")
      return
    }

    if (newPassword.length < 6) {
      setError("Password minimal 6 karakter")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Password tidak cocok")
      return
    }

    setIsLoading(true)

    try {
      if (!verifiedUserId) {
        setError("Sesi verifikasi tidak valid")
        return
      }

      await apiService.post<{ success: boolean; message: string }>("/auth/reset-password", {
        userId: Number(verifiedUserId),
        newPassword
      })

      setStep("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat reset password")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (step !== "reset") {
      setAcknowledged(false)
      setShowNewPassword(false)
    }
    if (step === "verify") {
      setVerifiedUserId(null)
      setVerifiedUserName("")
    }
  }, [step])

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">

      {/* Background dengan foto gedung */}
      <div className="absolute inset-0">
        <div 
          className="w-full h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/images/gedung-layanan-respirasi-ibu-dan-anak-rsup-persahabatan.png')`
          }}
        />
        {/* Overlay untuk kontras */}
        <div className="absolute inset-0 bg-black/50"></div>
        {/* Gradient overlay yang lebih estetis */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600/25 via-cyan-500/15 to-blue-600/25"></div>
        {/* Additional subtle gradient untuk depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-white/10"></div>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-2xl bg-white/95 backdrop-blur-lg border border-white/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/images/logo-RS.png"
                alt="Logo RS Kemenkes Persahabatan"
                width={180}
                height={80}
                className="object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300"
              />
            </div>
            
            <h1 className="text-xl font-bold text-foreground mb-2">Sistem Inventaris & Pemeliharaan Sarana Prasarana Serta Peminjaman</h1>
            <p className="text-muted-foreground text-sm">"SiPeNa"</p>
            
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto my-4">
              <KeyRound className="w-6 h-6 text-teal-600" />
            </div>
            <CardTitle className="text-lg font-semibold text-foreground">Reset Password</CardTitle>
            <CardDescription>
              {step === "verify" && "Masukkan NIP untuk verifikasi akun Anda"}
              {step === "reset" && "Buat password baru untuk akun Anda"}
              {step === "success" && "Password berhasil diubah"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Step 1: Verify NIP */}
            {step === "verify" && (
              <form onSubmit={handleVerify} className="space-y-4">

                <div>
                  <label htmlFor="nip" className="block text-sm font-medium text-foreground mb-2">
                    NIP
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                    <Input
                      id="nip"
                      type="text"
                      placeholder="Masukkan NIP (maks. 20 digit)"
                      value={nip}
                      onChange={(e) => setNip(e.target.value.replace(/\D/g, "").slice(0, 20))}
                      disabled={isLoading}
                      className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                      maxLength={20}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{nip.length}/20 digit</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-600">{error}</span>
                  </div>
                )}

                {!error && (
                  <Button
                    type="submit"
                    disabled={isLoading}
                    aria-busy={isLoading}
                    className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Spinner className="text-white" />
                        Memverifikasi...
                      </div>
                    ) : (
                      "Verifikasi Akun"
                    )}
                  </Button>
                )}
                <div className="mt-4 text-center text-sm">
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="text-teal-600 hover:text-teal-700 font-medium transition-colors"
                  >
                    Kembali ke halaman login
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Reset Password */}
            {step === "reset" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg mb-4">
                  <p className="text-sm text-teal-700">
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Verifikasi berhasil! Silakan buat password baru.
                  </p>
                </div>
                {verifiedUserName && (
                  <p className="text-xs text-muted-foreground">
                    Mengatur password untuk <span className="font-semibold">{verifiedUserName}</span>
                  </p>
                )}

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-2">
                    Password Baru
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      className="pl-10 pr-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showNewPassword ? "Sembunyikan password baru" : "Tampilkan password baru"}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                    <Input
                      id="confirmPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Ulangi password baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      className="pl-10 pr-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showNewPassword ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <label className="flex items-start gap-2">
                    <Checkbox
                      checked={acknowledged}
                      onCheckedChange={(value) => setAcknowledged(value === true)}
                    />
                    <span>
                      Saya telah memverifikasi identitas dan siap mengganti password akun ini.
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="text-sm text-red-600">{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner className="text-white" />
                      Menyimpan...
                    </div>
                  ) : (
                    "Simpan Password Baru"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={error ? () => router.push("/login") : () => setStep("verify")}
                  className={`w-full text-sm font-medium transition-colors mt-2 ${
                    error ? "text-red-600 hover:text-red-800" : "text-white/80 hover:text-white"
                  }`}
                >
                  Kembali
                </button>
              </form>
            )}

            {/* Step 3: Success */}
            {step === "success" && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Password Berhasil Diubah!</h3>
                  <p className="text-sm text-muted-foreground mt-2">Silakan login menggunakan password baru Anda.</p>
                </div>

                <Button
                  onClick={() => router.push("/login")}
                  className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
                >
                  Kembali ke Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
