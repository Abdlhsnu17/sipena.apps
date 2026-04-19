"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useMobileFocusScroll } from "@/hooks/use-mobile-focus-scroll"
import authService from "@/services/auth.service"

import { resolveSafeRedirectPath } from "@/services/auth-utils"
import { AlertCircle, Eye, EyeOff, IdCard, KeyRound, Lock } from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import type React from "react"
import { useEffect, useState } from "react"


export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = resolveSafeRedirectPath(searchParams.get("redirect"))
  const [nip, setNip] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const { handleFocusCapture } = useMobileFocusScroll()

  useEffect(() => {
    // Check if already logged in
    if (authService.isAuthenticated()) {
      router.replace(redirectTo)
    }
  }, [redirectTo, router])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await authService.login({ nip, password, rememberMe })

      if (result.success) {
        router.replace(redirectTo)
      } else {
        setError(result.message)
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat login")
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div
      className="auth-safe-area relative flex min-h-dvh items-start justify-center overflow-y-auto sm:items-center sm:py-8"
      onFocusCapture={handleFocusCapture}
    >


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
        <div className="absolute inset-0 bg-linear-to-br from-teal-600/25 via-cyan-500/15 to-blue-600/25"></div>
        {/* Additional subtle gradient untuk depth */}
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/20 via-transparent to-white/10"></div>
      </div>
      
      <div className="relative z-10 my-2 w-full max-w-md sm:my-0" data-auth-card>
        {/* Card dengan backdrop blur */}
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-lg sm:max-h-none sm:p-8">

          <div className="text-center mb-8">
            {/* Logo RSP */}
            <div className="flex justify-center mb-4">
              <Image
                src="/images/logo-RS.png"
                alt="Logo RS Kemenkes Persahabatan"
                width={180}
                height={80}
                className="object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            
            <h1 className="text-xl font-bold text-foreground mb-2">Sistem Inventaris & Peminjaman Serta Pemeliharaan Sarana</h1>
            <p className="text-muted-foreground text-sm">"SiPeNa"</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* NIP Input */}
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
                  maxLength={20}
                  disabled={isLoading}
                  className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{nip.length}/20 digit</p>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="******"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 pr-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={rememberMe}
                  onCheckedChange={(value) => setRememberMe(value === true)}
                />
                Ingat saya di perangkat ini
              </label>
            </div>


            <div className="text-right">
              <button
                type="button"
                onClick={() => router.push("/reset-password")}
                disabled={isLoading}
                className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors flex items-center gap-1 ml-auto hover:underline disabled:opacity-50 disabled:hover:text-teal-600"
              >
                <KeyRound className="w-3 h-3" />
                Bantuan Password
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-shake">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="w-full bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="text-white" />
                  Memproses...
                </div>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Belum punya akun? Daftar terlebih dahulu.
              </p>
              <Button
                type="button"
                onClick={() => router.push("/register")}
                className="w-full bg-linear-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
              >
                Daftar Akun Baru
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
