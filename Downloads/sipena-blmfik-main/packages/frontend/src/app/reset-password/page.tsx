"use client"

import { AlertCircle, CheckCircle2, Eye, EyeOff, IdCard, KeyRound, Lock, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import authService from "@/services/auth.service"
import Image from "next/image"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState } from "react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<"request" | "confirm">("request")
  const [nip, setNip] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [deliveryTarget, setDeliveryTarget] = useState("")
  const [localVerificationCode, setLocalVerificationCode] = useState("")
  const [expiresInMinutes, setExpiresInMinutes] = useState<number | null>(null)

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage("")
    setIsLoading(true)

    try {
      const result = await authService.requestPasswordResetCode(nip)
      setMessageType(result.success ? "success" : "error")
      setMessage(result.message)

      if (result.success) {
        setDeliveryTarget(result.data?.deliveryTarget || "")
        setLocalVerificationCode(result.data?.verificationCode || "")
        setExpiresInMinutes(result.data?.expiresInMinutes ?? null)
        setVerificationCode(result.data?.verificationCode || "")
        setStep("confirm")
      }
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal mengirim kode verifikasi.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage("")

    if (newPassword !== confirmPassword) {
      setMessageType("error")
      setMessage("Konfirmasi password tidak cocok.")
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.resetPasswordWithCode({
        nip,
        verificationCode,
        newPassword,
        confirmPassword,
      })

      setMessageType(result.success ? "success" : "error")
      setMessage(result.message)

      if (result.success) {
        window.setTimeout(() => {
          router.push("/login")
        }, 1500)
      }
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal mengubah password.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0">
        <div
          className="w-full h-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/images/gedung-layanan-respirasi-ibu-dan-anak-rsup-persahabatan.png')`,
          }}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-linear-to-br from-teal-600/25 via-cyan-500/15 to-blue-600/25" />
      </div>

      <Card className="relative z-10 w-full max-w-lg shadow-2xl bg-white/95 backdrop-blur-lg border border-white/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/logo-RS.png"
              alt="Logo RS Kemenkes Persahabatan"
              width={180}
              height={80}
              className="object-contain"
            />
          </div>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
            <KeyRound className="h-6 w-6 text-teal-700" />
          </div>
          <CardTitle>Lupa Password</CardTitle>
          <CardDescription>
            Verifikasi dilakukan dengan kode angka 6 digit yang dibuat langsung di aplikasi ini tanpa pengiriman email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "request" ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label htmlFor="nip" className="block text-sm font-medium text-foreground mb-2">
                  NIP
                </label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                  <Input
                    id="nip"
                    type="text"
                    placeholder="Masukkan NIP terdaftar"
                    value={nip}
                    onChange={(event) => setNip(event.target.value.replace(/\D/g, "").slice(0, 20))}
                    maxLength={20}
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Setelah NIP diverifikasi, kode reset akan langsung muncul di halaman ini.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner className="text-white" />
                    Membuat kode...
                  </span>
                ) : (
                  "Buat Kode Verifikasi"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-700">
                Kode verifikasi tersedia di <span className="font-medium">{deliveryTarget || "aplikasi lokal"}</span>.
                {expiresInMinutes ? ` Berlaku selama ${expiresInMinutes} menit.` : ""}
              </div>

              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm text-cyan-800">
                Kode reset Anda: <span className="font-mono text-base font-bold tracking-[0.35em]">{localVerificationCode || "------"}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Kode Verifikasi</label>
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={(value) => setVerificationCode(value.replace(/\D/g, "").slice(0, 6))}
                  containerClassName="justify-center"
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-2">
                  Password Baru
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showConfirmPassword ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("request")
                    setVerificationCode("")
                    setLocalVerificationCode("")
                    setExpiresInMinutes(null)
                    setNewPassword("")
                    setConfirmPassword("")
                    setMessage("")
                  }}
                  disabled={isLoading}
                  className="w-full"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Minta Kode Baru
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="w-full bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner className="text-white" />
                      Menyimpan...
                    </span>
                  ) : (
                    "Simpan Password Baru"
                  )}
                </Button>
              </div>
            </form>
          )}

          {message && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-3 text-sm ${
                messageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {messageType === "success" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}

          <Button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
          >
            Kembali ke Login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
