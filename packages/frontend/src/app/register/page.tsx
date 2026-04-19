"use client"

import AuthHeader from "@/components/auth-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useMobileFocusScroll } from "@/hooks/use-mobile-focus-scroll"
import authService from "@/services/auth.service"
import { AlertCircle, CheckCircle2, Eye, EyeOff, IdCard, Lock, Mail, User2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState } from "react"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    nip: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [isLoading, setIsLoading] = useState(false)
  const { handleFocusCapture } = useMobileFocusScroll()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage("")

    if (formData.password !== formData.confirmPassword) {
      setMessageType("error")
      setMessage("Konfirmasi password tidak cocok.")
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.register(formData)
      setMessageType(result.success ? "success" : "error")
      setMessage(
        result.success
          ? "Akun berhasil dibuat. Role akan diatur admin atau leader setelah verifikasi."
          : result.message,
      )

      if (result.success) {
        window.setTimeout(() => {
          router.replace("/login")
        }, 1600)
      }
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Pendaftaran akun gagal.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="auth-safe-area relative flex min-h-svh items-center justify-center overflow-y-auto py-4"
      onFocusCapture={handleFocusCapture}
    >
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

      <Card
        className="relative z-10 w-full max-w-md max-h-[calc(100svh-2rem)] overflow-y-auto border border-white/20 bg-white/95 shadow-2xl backdrop-blur-lg"
        data-auth-card
      >
        <CardHeader className="pb-4 text-center">
          <AuthHeader
            title="Pendaftaran Akun"
            description="Isi data dasar akun dengan benar setelah akun berhasil dibuat lalu lakukan login."
          />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="nip" className="block text-sm font-medium text-foreground mb-2">
                NIP
              </label>
              <div className="relative">
                <IdCard className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                <Input
                  id="nip"
                  type="text"
                  placeholder="Masukkan NIP (8-20 digit)"
                  value={formData.nip}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      nip: event.target.value.replace(/\D/g, "").slice(0, 20),
                    }))
                  }
                  maxLength={20}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                Nama Lengkap
              </label>
              <div className="relative">
                <User2 className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@domain.com"
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  className="pl-10"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 6 karakter"
                  value={formData.password}
                  onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
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
                Konfirmasi Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Ulangi password"
                  value={formData.confirmPassword}
                  onChange={(event) => setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
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
              type="submit"
              disabled={isLoading}
              className="w-full bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="text-white" />
                  Memproses...
                </span>
              ) : (
                "Buat Akun"
              )}
            </Button>
          </form>

          <div className="mt-4">
          <Button
            type="button"
            onClick={() => router.replace("/login")}
            className="w-full bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
          >
            Kembali ke Login
          </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
