"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import authService from "@/services/auth.service"
import { StaffAccessType, UserRole } from "@/types/auth-types"
import { AlertCircle, CheckCircle, CreditCard, Eye, EyeOff, Lock, User } from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import type React from "react"
import { useEffect, useState } from "react"


export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [nip, setNip] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState<UserRole>("staff")
  const [staffAccessType, setStaffAccessType] = useState<StaffAccessType>("all")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (authService.isAuthenticated()) {
      router.push("/")
    }
  }, [router])


  const validateForm = (): boolean => {
    if (!nip.trim()) {
      setError("NIP pekerja harus diisi")
      return false
    }
    if (nip.length < 8 || nip.length > 20) {
      setError("NIP harus antara 8-20 digit")
      return false
    }
    if (!name.trim()) {
      setError("Nama harus diisi")
      return false
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Email harus diisi dengan format yang benar")
      return false
    }
    if (!role) {
      setError("Role harus dipilih")
      return false
    }
    if (!password) {
      setError("Password harus diisi")
      return false
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter")
      return false
    }
    if (password !== confirmPassword) {
      setError("Password tidak cocok")
      return false
    }
    if (!acceptTerms) {
      setError("Silakan setujui Syarat dan Ketentuan serta Kebijakan Privasi")
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const result = await authService.register({
        nip,
        name,
        email,
        password,
        confirmPassword,
        role,
        staffAccessType:
          role === "staff" ? staffAccessType ?? undefined : undefined,
      })

      if (result.success) {
        setSuccess("Pendaftaran berhasil! Silakan login dengan akun Anda.")
        setTimeout(() => {
          router.push("/login")
        }, 2000)
      } else {
        setError(result.message)
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat pendaftaran")
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginClick = () => {
    router.push("/login")
  }



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
        {/* Card dengan backdrop blur */}
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
          {/* Header with Logo */}
          <div className="text-center mb-8">
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
            <h2 className="text-lg font-semibold text-foreground mt-4">Daftar Akun</h2>
          </div>

          {/* Success Message */}
          {success && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-green-600">{success}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* NIP Input */}
            <div>
              <label htmlFor="nip" className="block text-sm font-medium text-foreground mb-2">
                NIP Pekerja 
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                <Input
                  id="nip"
                  type="text"
                  placeholder="(maks. 20 digit)"
                  value={nip}
                  onChange={(e) => setNip(e.target.value.replace(/\D/g, "").slice(0, 20))}
                  disabled={isLoading}
                  className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                  maxLength={20}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">8-20 digit NIP pekerja</p>
            </div>

            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                Nama Lengkap 
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Nama lengkap Anda"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email 
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10 border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                  required
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <Label htmlFor="role" className="block text-sm font-medium text-foreground mb-2">
                Role 
              </Label>
              <Select value={role} onValueChange={(value: UserRole) => setRole(value)} disabled={isLoading}>
                <SelectTrigger className="border-gray-200 focus:border-teal-500 focus:ring-teal-500 transition-colors" disabled={isLoading}>
                  <SelectValue placeholder="Pilih role Anda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
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
                  placeholder="Minimal 6 karakter"
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

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                Konfirmasi Password 
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-teal-600" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ulangi password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={acceptTerms}
                  onCheckedChange={(value) => setAcceptTerms(value === true)}
                />
                <span>
                  Saya menyetujui{" "}
                  <span className="text-teal-600 font-semibold">Syarat dan Ketentuan</span> serta{" "}
                  <span className="text-teal-600 font-semibold">Kebijakan Privasi</span>
                </span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}


            {/* Register Button */}
            <Button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-medium py-3 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner className="text-white" />
                  Mendaftarkan...
                </div>
              ) : (
                "Daftar"
              )}
            </Button>
          </form>


          {/* Login Link */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Sudah memiliki akun?{" "}
              <button
                onClick={handleLoginClick}
                disabled={isLoading}
                className="text-teal-600 hover:text-teal-700 font-medium transition-colors disabled:opacity-50 disabled:hover:text-teal-600"
              >
                Login sekarang
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
