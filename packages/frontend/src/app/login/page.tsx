"use client"

import AuthHeader from "@/components/auth-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useMobileFocusScroll } from "@/hooks/use-mobile-focus-scroll";
import { useToast } from "@/hooks/use-toast";
import { resolveSafeRedirectPath } from "@/services/auth-utils";
import authService from "@/services/auth.service";
import { AlertCircle, Eye, EyeOff, IdCard, KeyRound, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

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
  const { toast } = useToast()

  useEffect(() => {
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
        toast({
          title: "Login berhasil",
        })
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
      className="auth-safe-area relative flex min-h-svh items-center justify-center overflow-y-auto py-4"
      onFocusCapture={handleFocusCapture}
    >
      <div className="absolute inset-0">
        <div
          className="h-full w-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/images/gedung-layanan-respirasi-ibu-dan-anak-persahabatan.png')`,
          }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-linear-to-br from-teal-600/25 via-cyan-500/15 to-blue-600/25" />
        <div className="absolute inset-0 bg-linear-to-t from-slate-900/20 via-transparent to-white/10" />
      </div>

      <div className="relative z-10 flex w-full justify-center px-2 sm:px-4">
        <div className="w-full max-w-md" data-auth-card>
          <div className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur-lg sm:p-8">
            <div className="mb-6">
              <AuthHeader
                title="SiPeNa"
                description="Masuk untuk mengelola inventaris, pemeliharaan, dan peminjaman sarana."
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nip" className="mb-2 block text-sm font-medium text-foreground">
                  Username atau Email
                </label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                  <Input
                    id="nip"
                    type="text"
                    placeholder="Masukkan NIP atau email"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    disabled={isLoading}
                    autoComplete="username"
                    className="border-gray-200 pl-10 transition-colors focus:border-teal-500 focus:ring-teal-500"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Gunakan NIP atau email yang terdaftar.</p>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-teal-600" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="******"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="border-gray-200 pl-10 pr-10 transition-colors focus:border-teal-500 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">
                  <Checkbox checked={rememberMe} onCheckedChange={(value) => setRememberMe(value === true)} />
                  Ingat saya di perangkat ini
                </label>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => router.push("/reset-password")}
                  disabled={isLoading}
                  className="ml-auto flex items-center gap-1 text-sm font-medium text-teal-600 transition-colors hover:text-teal-700 hover:underline disabled:opacity-50 disabled:hover:text-teal-600"
                >
                  <KeyRound className="h-3 w-3" />
                  Bantuan Password
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-linear-to-r from-teal-600 to-cyan-600 py-3 font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:from-teal-700 hover:to-cyan-700 hover:shadow-lg disabled:transform-none disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner className="text-white" />
                    Masuk...
                  </span>
                ) : (
                  "Masuk"
                )}
              </Button>

              <div className="border-t border-gray-100 pt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/register")}
                    className="font-medium text-teal-600 transition-colors hover:text-teal-700 hover:underline"
                  >
                    Daftar di sini
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
