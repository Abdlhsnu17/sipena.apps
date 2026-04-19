"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/services/auth-utils"
import { normalizeUserRole } from "@/utils/role"
import {
    ArrowRight,
    BookOpen,
    Box,
    Database,
    FileCode2,
    GitBranch,
    Network,
    Shield,
    UploadCloud,
    Users,
    Workflow,
    Zap
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function UMLPage() {
  const [currentUser] = useState(getCurrentUser())
  const role = normalizeUserRole(currentUser?.role ?? "user")
  const canViewClassAndErd = role === "admin"
  const useCaseRoleCards: UseCaseRoleCard[] = [
    {
      key: "admin",
      title: "Administrator",
      roleIcon: "🛡️",
      summary: "Mengelola seluruh modul inti, menjaga kualitas data, dan memegang validasi akhir proses operasional.",
      badge: "Akses Penuh",
      titleClass: "text-teal-800 dark:text-teal-200",
      badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
      containerClass: "bg-linear-to-br from-teal-500/5 via-teal-500/10 to-cyan-500/5 border-teal-200/50 dark:border-teal-800/50",
      glowClass: "bg-linear-to-br from-teal-500/20 to-cyan-500/20",
      iconWrapClass: "bg-linear-to-br from-teal-500 to-cyan-500",
      items: [
        { icon: "👥", title: "Kelola Pengguna", desc: "CRUD pengguna dan kontrol akun non-aktif" },
        { icon: "🏥", title: "Kelola Inventaris", desc: "Tambah, ubah, dan hapus inventaris medis/non-medis" },
        { icon: "📋", title: "Kelola Peminjaman", desc: "Review, update, dan tindak lanjut peminjaman" },
        { icon: "✅", title: "Validasi Pengembalian", desc: "Final approval kondisi aset saat kembali" },
        { icon: "🔧", title: "Kelola Pemeliharaan", desc: "Buat, edit, hapus, dan validasi status pemeliharaan" },
        { icon: "🧾", title: "Akses Dokumentasi Lengkap", desc: "Laporan, unggahan, class diagram, dan ERD" },
      ],
    },
    {
      key: "leader",
      title: "Leader",
      roleIcon: "🎯",
      summary: "Berperan sebagai pengawas operasional lintas modul tanpa mengambil alih kontrol administrasi pengguna.",
      badge: "Akses Operasional Luas",
      titleClass: "text-purple-800 dark:text-purple-200",
      badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      containerClass: "bg-linear-to-br from-purple-500/5 via-purple-500/10 to-indigo-500/5 border-purple-200/50 dark:border-purple-800/50",
      glowClass: "bg-linear-to-br from-purple-500/20 to-indigo-500/20",
      iconWrapClass: "bg-linear-to-br from-purple-500 to-indigo-500",
      items: [
        { icon: "👁️", title: "Monitoring Seluruh Modul", desc: "Pantau inventaris, peminjaman, dan pemeliharaan" },
        { icon: "🏥", title: "Kelola Inventaris", desc: "Akses CRUD inventaris medis/non-medis" },
        { icon: "📋", title: "Review Peminjaman", desc: "Verifikasi proses pinjam dan tindak lanjut data" },
        { icon: "✅", title: "Validasi Pengembalian", desc: "Menyetujui pengembalian aset sebelum ditutup" },
        { icon: "🔧", title: "Kelola Status Lanjutan", desc: "Boleh set status selesai atau dibatalkan" },
        { icon: "🚫", title: "Tidak Kelola Pengguna", desc: "Manajemen pengguna tetap kewenangan admin", disabled: true },
      ],
    },
    {
      key: "staff",
      title: "Staff Pelayanan",
      roleIcon: "👤",
      summary: "Fokus pada alur harian seperti pemeliharaan, peminjaman, pengembalian, dan pemantauan laporan.",
      badge: "Akses Terbatas",
      titleClass: "text-blue-800 dark:text-blue-200",
      badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      containerClass: "bg-linear-to-br from-blue-500/5 via-blue-500/10 to-indigo-500/5 border-blue-200/50 dark:border-blue-800/50",
      glowClass: "bg-linear-to-br from-blue-500/20 to-indigo-500/20",
      iconWrapClass: "bg-linear-to-br from-blue-500 to-indigo-500",
      items: [
        { icon: "🔧", title: "Akses Pemeliharaan", desc: "Membuka modul pemeliharaan untuk monitoring dan tindak lanjut awal" },
        { icon: "📅", title: "Jadwal Pemeliharaan", desc: "Membuat dan memantau jadwal pemeliharaan aset" },
        { icon: "📦", title: "Peminjaman Alat", desc: "Mengajukan dan memantau proses peminjaman alat" },
        { icon: "↩️", title: "Pengembalian Alat", desc: "Mengirim data kondisi aset saat pengembalian" },
        { icon: "📊", title: "Akses Laporan", desc: "Melihat rekap inventaris, pemeliharaan, dan peminjaman" },
        { icon: "⚙️", title: "Kelola Pengaturan", desc: "Memperbarui preferensi dan profil akun sendiri" },
      ],
    },
    {
      key: "user",
      title: "Pengguna",
      roleIcon: "🙋",
      summary: "Memakai fitur self-service untuk peminjaman, pengembalian, dokumentasi, dan pengaturan akun sendiri.",
      badge: "Akses Self-Service",
      titleClass: "text-emerald-800 dark:text-emerald-200",
      badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
      containerClass: "bg-linear-to-br from-emerald-500/5 via-emerald-500/10 to-teal-500/5 border-emerald-200/50 dark:border-emerald-800/50",
      glowClass: "bg-linear-to-br from-emerald-500/20 to-teal-500/20",
      iconWrapClass: "bg-linear-to-br from-emerald-500 to-teal-500",
      items: [
        { icon: "🏠", title: "Lihat Dashboard", desc: "Memantau ringkasan aktivitas peminjaman pribadi" },
        { icon: "📦", title: "Ajukan Peminjaman", desc: "Membuat transaksi peminjaman alat yang tersedia" },
        { icon: "↩️", title: "Proses Pengembalian", desc: "Mengirim kondisi alat saat pengembalian" },
        { icon: "🧾", title: "Akses Dokumentasi UML & Unggahan", desc: "Melihat dokumentasi dan mengunggah laporan secara mandiri" },
        { icon: "⚙️", title: "Kelola Pengaturan", desc: "Memperbarui profil dan preferensi akun sendiri" },
      ],
    },
    {
      key: "staff_pj",
      title: "Staff PJ",
      roleIcon: "📌",
      summary: "Menangani inventaris unit kerja sekaligus mendukung operasional pemeliharaan dan pelaporan unit.",
      badge: "Akses Inventaris Unit",
      titleClass: "text-indigo-800 dark:text-indigo-200",
      badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
      containerClass: "bg-linear-to-br from-indigo-500/5 via-indigo-500/10 to-violet-500/5 border-indigo-200/50 dark:border-indigo-800/50",
      glowClass: "bg-linear-to-br from-indigo-500/20 to-violet-500/20",
      iconWrapClass: "bg-linear-to-br from-indigo-500 to-violet-500",
      items: [
        { icon: "🏥", title: "Input Aset Medis", desc: "Menambah dan melengkapi data inventaris medis pada unit kerja" },
        { icon: "🏢", title: "Input Aset Non-Medis", desc: "Menambah dan memperbarui data inventaris non-medis" },
        { icon: "🔧", title: "Akses Pemeliharaan", desc: "Membuka modul pemeliharaan untuk monitoring dan tindak lanjut awal" },
        { icon: "📅", title: "Jadwal Pemeliharaan", desc: "Buat jadwal dan update progres dasar pemeliharaan" },
        { icon: "📦", title: "Peminjaman & Pengembalian", desc: "Mengelola alur pinjam-kembali alat di unit tanggung jawab" },
        { icon: "📊", title: "Akses Laporan", desc: "Melihat rekap inventaris, pemeliharaan, dan peminjaman unit" },
        { icon: "⚙️", title: "Kelola Pengaturan", desc: "Memperbarui preferensi dan profil akun sendiri" },
      ],
    },
    {
      key: "teknisi",
      title: "Teknisi",
      roleIcon: "🛠️",
      summary: "Berfokus pada pekerjaan teknis pemeliharaan, pembaruan status, dan pencatatan hasil pengerjaan.",
      badge: "Fokus Pemeliharaan",
      titleClass: "text-amber-800 dark:text-amber-200",
      badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      containerClass: "bg-linear-to-br from-amber-500/5 via-amber-500/10 to-orange-500/5 border-amber-200/50 dark:border-amber-800/50",
      glowClass: "bg-linear-to-br from-amber-500/20 to-orange-500/20",
      iconWrapClass: "bg-linear-to-br from-amber-500 to-orange-500",
      items: [
        { icon: "🔧", title: "Eksekusi Pemeliharaan", desc: "Berfokus pada pekerjaan pemeliharaan aset" },
        { icon: "👁️", title: "Lihat Jadwal Pemeliharaan", desc: "Akses daftar jadwal untuk ditindaklanjuti" },
        { icon: "✅", title: "Selesaikan / Batalkan", desc: "Dapat set status selesai atau dibatalkan" },
        { icon: "💰", title: "Catat Biaya & Notes", desc: "Mengisi biaya dan catatan hasil pekerjaan" },
        { icon: "📈", title: "Monitoring Maintenance", desc: "Memantau progres maintenance di dashboard teknisi" },
        { icon: "🚫", title: "Tanpa Akses Inventaris/User", desc: "Tidak menambah jadwal baru, tidak kelola pengguna", disabled: true },
      ],
    },
  ]

  const useCaseSummaryCards: UseCaseSummaryCard[] = [
    {
      title: "Admin",
      containerClass: "bg-teal-50 dark:bg-teal-950/30 border border-teal-200/50 dark:border-teal-800/50",
      titleClass: "text-teal-700 dark:text-teal-300",
      items: ["Kontrol lintas modul", "Validasi akhir operasional"],
    },
    {
      title: "Leader",
      containerClass: "bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/50",
      titleClass: "text-purple-700 dark:text-purple-300",
      items: ["Koordinasi proses harian", "Validasi peminjaman dan return"],
    },
    {
      title: "Staff",
      containerClass: "bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50",
      titleClass: "text-blue-700 dark:text-blue-300",
      items: ["Pemeliharaan, jadwal, dan laporan", "Peminjaman, pengembalian, dan pengaturan"],
    },
    {
      title: "Pengguna",
      containerClass: "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50",
      titleClass: "text-emerald-700 dark:text-emerald-300",
      items: ["Dashboard, UML, pengaturan", "Peminjaman dan pengembalian mandiri"],
    },
    {
      title: "Staff PJ",
      containerClass: "bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/50",
      titleClass: "text-indigo-700 dark:text-indigo-300",
      items: ["Input aset medis dan non-medis", "Pemeliharaan, laporan, dan pengaturan unit"],
    },
    {
      title: "Teknisi",
      containerClass: "bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50",
      titleClass: "text-amber-700 dark:text-amber-300",
      items: ["Status selesai/batal maintenance", "Catatan teknis & biaya"],
    },
    {
      title: "Sistem",
      containerClass: "bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60",
      titleClass: "text-slate-700 dark:text-slate-300",
      items: ["Role-based authorization", "Audit trail dan sinkronisasi data"],
    },
  ]
  const enabledUseCaseCount = useCaseRoleCards.reduce(
    (total, card) => total + card.items.filter((item) => !item.disabled).length,
    0
  )
  const restrictedUseCaseCount = useCaseRoleCards.reduce(
    (total, card) => total + card.items.filter((item) => item.disabled).length,
    0
  )
  const useCaseQuickSummary = [
    { label: "Role aktif", value: `${useCaseRoleCards.length}` },
    { label: "Interaksi utama", value: `${enabledUseCaseCount}` },
    { label: "Batasan akses", value: `${restrictedUseCaseCount}` },
  ]

  return (
    <div className="bg-linear-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="space-y-6">
          {/* Header */}
        <div className="mb-8">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-xl shadow-lg">
                  <FileCode2 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-linear-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  Dokumentasi UML Diagram Use Case & Unggahan
                </h1>
              </div>
              <p className="text-muted-foreground">
                Arsitektur sistem inventaris dan pemeliharaan RSUP Persahabatan
              </p>
            </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-6 p-4 bg-linear-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10 border border-teal-200/50 dark:border-teal-800/50 rounded-xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-lg">
                <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-semibold text-teal-800 dark:text-teal-200">Tentang Dokumentasi</h3>
                <p className="text-sm text-teal-700/80 dark:text-teal-300/80 mt-1">
                  Dokumentasi ini menjelaskan arsitektur sistem, hubungan antar entitas, dan alur kerja proses peminjaman serta pemeliharaan inventaris menggunakan standar 
                </p>
                <p className="text-xs text-teal-600/90 dark:text-teal-300/80 mt-1">
                
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200/60 bg-white/70 p-2 backdrop-blur-sm dark:border-gray-700/60 dark:bg-slate-900/60">
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="#dokumentasi"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-linear-to-r from-teal-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
              >
                <FileCode2 className="h-4 w-4" />
                Dokumentasi
              </Link>
              <Link
                href="#unggahan"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <UploadCloud className="h-4 w-4" />
                Unggahan
              </Link>
            </div>
          </div>

        <div className="space-y-6">
          {/* Use Case Diagram */}
          <section id="dokumentasi" className="space-y-6 scroll-mt-28">
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Use Case Diagram</CardTitle>
                    <CardDescription>Interaksi pengguna dengan sistem inventaris</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 p-6">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-700/70 dark:bg-slate-900/40">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Ringkasan Akses per Role
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Tampilan di bawah difokuskan untuk memperjelas hak akses, tanggung jawab, dan batasan setiap
                        role tanpa elemen visual yang berlebihan.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {useCaseQuickSummary.map((item) => (
                        <Badge
                          key={item.label}
                          className="bg-white text-slate-700 border border-slate-200 hover:bg-white dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
                        >
                          {item.label}: {item.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Role dan Tanggung Jawab
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Kartu berikut menampilkan ruang lingkup kerja tiap aktor beserta fitur yang dibatasi.
                      </p>
                    </div>
                    <Badge className="w-fit bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Disusun untuk desktop dan mobile
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {useCaseRoleCards.map((card) => (
                      <RoleUseCaseCard key={card.key} card={card} />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200/60 bg-linear-to-r from-gray-50 to-slate-50 p-6 dark:border-gray-700/60 dark:from-slate-800/50 dark:to-slate-900/50">
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Network className="w-5 h-5 text-gray-600" />
                    Matriks Ringkas Role
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {useCaseSummaryCards.map((card, i) => (
                      <div key={i} className={`rounded-2xl p-4 ${card.containerClass}`}>
                        <p className={`font-semibold ${card.titleClass}`}>{card.title}</p>
                        <div className="space-y-2">
                          {card.items.map((item, j) => (
                            <div key={j} className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                              <ArrowRight className="mt-1 h-3 w-3 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Matriks ini diselaraskan dengan role aktif sistem: <span className="font-medium">admin, leader, staff, staff_pj, teknisi, user</span>.
                  </p>
                </div>
            </CardContent>
          </Card>
          </section>

        {/* Unggahan */}
        <section id="unggahan" className="space-y-6 scroll-mt-28">
          <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-linear-to-br from-slate-800 to-slate-500 rounded-lg">
                  <UploadCloud className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>Unggahan Terintegrasi</CardTitle>
                  <CardDescription>Selaras dengan dokumentasi UML, file laporan mudah diakses.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Tombol unggahan sebagai bagian dari tab membantu auditor dan tim pengembangan menjaga visibilitas proses. Klik tombol di bawah untuk membuka fitur unggah utama.
              </p>
              <div className="mt-4 flex justify-end">
                <Button size="sm" asChild>
                  <Link href="/unggahan" className="inline-flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" />
                    Buka Unggahan
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

          {/* Class Diagram */}
          <section className="space-y-6">
            {canViewClassAndErd ? (
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-linear-to-br from-purple-500 to-indigo-500 rounded-lg">
                      <Box className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>Class Diagram</CardTitle>
                      <CardDescription>Struktur kelas dan entitas sistem</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* User Class */}
                    <ClassCard 
                      name="User"
                      color="teal"
                      badge="Core"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "nip", type: "string" }, 
                        { name: "name", type: "string" }, 
                        { name: "email", type: "string" }, 
                        { name: "role", type: "UserRole" }, 
                        { name: "createdAt", type: "Date" } 
                      ]} 
                      methods={[ 
                        "login()", 
                        "logout()", 
                        "updateProfile()" 
                      ]} 
                    />

                    {/* MedicalAsset Class */}
                    <ClassCard 
                      name="MedicalAsset"
                      color="purple"
                      badge="Entity"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "assetCode", type: "string" }, 
                        { name: "inventoryName", type: "string" },
                        { name: "name", type: "string" }, 
                        { name: "type", type: "string" },
                        { name: "serialNumber", type: "string" },
                        { name: "purchaseDate", type: "Date" },
                        { name: "lastMaintenance", type: "Date" },
                        { name: "nextMaintenance", type: "Date" },
                        { name: "category", type: "string" }, 
                        { name: "status", type: "AssetStatus" }, 
                        { name: "roomId", type: "string" },
                        { name: "notes", type: "string" },
                        { name: "condition", type: "string" }, 
                        { name: "usagePurpose", type: "string" }, 
                      ]} 
                      methods={[ 
                        "create()", 
                        "update()", 
                        "delete()" 
                      ]} 
                    />

                    {/* NonMedicalAsset Class */}
                    <ClassCard 
                      name="NonMedicalAsset"
                      color="blue"
                      badge="Entity"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "assetCode", type: "string" }, 
                        { name: "inventoryName", type: "string" },
                        { name: "name", type: "string" }, 
                        { name: "type", type: "string" },
                        { name: "serialNumber", type: "string" },
                        { name: "purchaseDate", type: "Date" },
                        { name: "lastMaintenance", type: "Date" },
                        { name: "nextMaintenance", type: "Date" },
                        { name: "category", type: "string" }, 
                        { name: "status", type: "AssetStatus" }, 
                        { name: "roomId", type: "string" },
                        { name: "notes", type: "string" },
                        { name: "condition", type: "string" }, 
                        { name: "usagePurpose", type: "string" }, 
                      ]}  
                      methods={[ 
                        "create()", 
                        "update()", 
                        "delete()" 
                      ]} 
                    />

                    {/* Borrowing Class */}
                    <ClassCard 
                      name="Borrowing"
                      color="orange"
                      badge="Transaction"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "userId", type: "string" }, 
                        { name: "assetId", type: "string" }, 
                        { name: "borrowDate", type: "Date" }, 
                        { name: "returnDate", type: "Date" }, 
                        { name: "status", type: "BorrowStatus" } 
                      ]} 
                      methods={[ 
                        "request()", 
                        "approve()", 
                        "return()" 
                      ]} 
                    />
                    <ClassCard 
                      name="ReportUpload"
                      color="rose"
                      badge="Storage"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "userId", type: "string" }, 
                        { name: "filename", type: "string" }, 
                        { name: "contentType", type: "string" }, 
                        { name: "sizeBytes", type: "number" }, 
                        { name: "uploadedAt", type: "Date" }, 
                        { name: "notes", type: "string" }, 
                      ]} 
                      methods={[ 
                        "store()", 
                        "delete()", 
                        "download()" 
                      ]} 
                    />

                    {/* Maintenance Class */}
                    <ClassCard 
                      name="Maintenance"
                      color="emerald"
                      badge="Transaction"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "assetId", type: "string" }, 
                        { name: "type", type: "string" }, 
                        { name: "scheduledDate", type: "Date" }, 
                        { name: "status", type: "string" }, 
                        { name: "cost", type: "number" } 
                      ]} 
                      methods={[ 
                        "schedule()", 
                        "complete()", 
                        "cancel()" 
                      ]} 
                    />

                    {/* Return Class */}
                    <ClassCard 
                      name="Return"
                      color="rose"
                      badge="Transaction"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "borrowingId", type: "string" }, 
                        { name: "returnDate", type: "Date" }, 
                        { name: "condition", type: "string" }, 
                        { name: "notes", type: "string" } 
                      ]} 
                      methods={[ 
                        "submit()", 
                        "verify()" 
                      ]} 
                    />
                  </div>

                  {/* Relationships */}
                  <div className="mt-8 p-6 bg-linear-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-2xl">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <GitBranch className="w-5 h-5 text-purple-600" />
                      Relasi Antar Kelas
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {[
                        { from: "User", to: "Borrowing", rel: "1 : N", desc: "User dapat memiliki banyak peminjaman" },
                        { from: "User", to: "Maintenance", rel: "1 : N", desc: "User dapat membuat banyak jadwal" },
                        { from: "MedicalAsset", to: "Borrowing", rel: "1 : N", desc: "Aset dapat dipinjam berkali-kali" },
                        { from: "Borrowing", to: "Return", rel: "1 : 1", desc: "Setiap peminjaman punya 1 pengembalian" },
                      ].map((rel, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl">
                          <Badge variant="outline" className="bg-purple-100 text-purple-700">{rel.from}</Badge>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="h-px flex-1 bg-purple-300"></div>
                            <span className="text-xs font-mono bg-purple-100 px-2 py-0.5 rounded">{rel.rel}</span>
                            <div className="h-px flex-1 bg-purple-300"></div>
                          </div>
                          <Badge variant="outline" className="bg-indigo-100 text-indigo-700">{rel.to}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <RestrictedNotice feature="Class Diagram" />
            )}
          </section>

          {/* Activity Diagram */}
          <section className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-linear-to-br from-orange-500 to-amber-500 rounded-lg">
                    <Workflow className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Activity Diagram</CardTitle>
                    <CardDescription>Alur proses dalam sistem</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ActivityFlow 
                    title="Alur Login"
                    color="purple"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Input NIP & Password", type: "action" },
                      { step: "Validasi kredensial", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Generate token", type: "action" },
                      { step: "Redirect dashboard", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Lupa Password"
                    color="amber"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "User klik Lupa Password", type: "action" },
                      { step: "Tampilkan form email/username", type: "action" },
                      { step: "User mengirim identifier", type: "action" },
                      { step: "Validasi input", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Kirim tautan atau kode reset", type: "action" },
                      { step: "User buka tautan/masukkan kode", type: "action" },
                      { step: "User atur password baru", type: "action" },
                      { step: "Perbarui kredensial & konfirmasi", type: "action" },
                      { step: "Kembali ke login", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Daftar Akun"
                    color="fuchsia"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "User klik Buat Akun", type: "action" },
                      { step: "Tampilkan formulir pendaftaran", type: "action" },
                      { step: "User isi nama, email, password, dll.", type: "action" },
                      { step: "Validasi format & keunikan", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Buat akun baru", type: "action" },
                      { step: "Kirim email verifikasi (opsional)", type: "action" },
                      { step: "Tampilkan konfirmasi dan redirect", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Penambahan Inventaris"
                    color="teal"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "User pilih Tambah Inventaris", type: "action" },
                      { step: "Pilih kategori aset (medis/non-medis)", type: "action" },
                      { step: "Isi data detail & spesifikasi", type: "action" },
                      { step: "Unggah dokumen pendukung (foto/sertifikat)", type: "action" },
                      { step: "Validasi data & anggaran", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Simpan aset ke master inventory", type: "action" },
                      { step: "Update status ruangan & laporan", type: "action" },
                      { step: "Notifikasi approval ke penanggung jawab", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />

                  {/* Borrowing Flow */}
                  <ActivityFlow 
                    title="Alur Peminjaman"
                    color="orange"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Pengguna/Staff memilih aset", type: "action" },
                      { step: "Cek ketersediaan", type: "decision" },
                      { step: "Isi form pinjam & submit", type: "action" },
                      { step: "Sistem simpan transaksi", type: "action" },
                      { step: "Auto approve sesuai alur aktif", type: "action" },
                      { step: "Aset dipinjam", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />

                  {/* Maintenance Flow */}
                  <ActivityFlow 
                    title="Alur Pemeliharaan"
                    color="blue"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Staff/Staff PJ buat jadwal", type: "action" },
                      { step: "Set tanggal & prioritas", type: "action" },
                      { step: "Notifikasi dikirim", type: "action" },
                      { step: "Teknisi mengerjakan", type: "action" },
                      { step: "Update progress", type: "action" },
                      { step: "Leader/Admin validasi lanjutan", type: "action" },
                      { step: "Mark complete", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />

                  {/* Return Flow */}
                  <ActivityFlow 
                    title="Alur Pengembalian"
                    color="emerald"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Pengguna/Staff submit return", type: "action" },
                      { step: "Pilih kondisi aset", type: "action" },
                      { step: "Sistem simpan data pengembalian", type: "action" },
                      { step: "Admin/Leader verifikasi", type: "action" },
                      { step: "Kondisi OK?", type: "decision" },
                      { step: "Update status aset", type: "action" },
                      { step: "Selesai", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Laporan & Unggah"
                    color="rose"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Tampilkan ringkasan data", type: "action" },
                      { step: "Pilih format PDF/Excel/Word", type: "action" },
                      { step: "Unggah file", type: "action" },
                      { step: "Simpan ke arsip & log", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ERD */}
          <section className="space-y-6">
            {canViewClassAndErd ? (
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-linear-to-br from-emerald-500 to-green-500 rounded-lg">
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>Entity Relationship Diagram</CardTitle>
                      <CardDescription>Struktur database sistem</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Users Table */}
                    <TableCard 
                      name="users"
                      color="teal"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "nip", type: "VARCHAR(20)", key: "UQ" },
                        { name: "name", type: "VARCHAR(255)" },
                        { name: "email", type: "VARCHAR(255)", key: "UQ" },
                        { name: "password", type: "VARCHAR(255)" },
                        { name: "role", type: "ENUM" },
                        { name: "created_at", type: "TIMESTAMP" },
                      ]}
                    />

                    {/* Medical Assets Table */}
                    <TableCard 
                      name="medical_assets"
                      color="purple"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
                        { name: "name", type: "VARCHAR(255)" },
                        { name: "inventory_name", type: "VARCHAR(255)" },
                        { name: "category", type: "VARCHAR(100)" },
                        { name: "type", type: "VARCHAR(20)" },
                        { name: "serial_number", type: "VARCHAR(100)" },
                        { name: "condition", type: "VARCHAR(20)" },
                        { name: "status", type: "ENUM" },
                        { name: "location", type: "VARCHAR(255)" },
                        { name: "purchase_date", type: "DATE" },
                        { name: "next_maintenance", type: "DATE" },
                        { name: "last_maintenance", type: "DATE" },
                        { name: "specifications", type: "JSON/TEXT" },
                        { name: "created_by", type: "INT", key: "FK" },
                      ]}
                    />

                    {/* Non-Medical Assets Table */}
                    <TableCard 
                      name="non_medical_assets"
                      color="blue"
                      columns={[
                      { name: "id", type: "INT", key: "PK" },
                        { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
                        { name: "name", type: "VARCHAR(255)" },
                        { name: "inventory_name", type: "VARCHAR(255)" },
                        { name: "category", type: "VARCHAR(100)" },
                        { name: "type", type: "VARCHAR(20)" },
                        { name: "serial_number", type: "VARCHAR(100)" },
                        { name: "condition", type: "VARCHAR(20)" },
                        { name: "status", type: "ENUM" },
                        { name: "location", type: "VARCHAR(255)" },
                        { name: "purchase_date", type: "DATE" },
                        { name: "next_maintenance", type: "DATE" },
                        { name: "last_maintenance", type: "DATE" },
                        { name: "specifications", type: "JSON/TEXT" },
                        { name: "created_by", type: "INT", key: "FK" },
                      ]}
                    />

                    {/* Borrowing Records Table */}
                    <TableCard 
                      name="borrowing_records"
                      color="orange"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "user_id", type: "INT", key: "FK" },
                        { name: "asset_type", type: "VARCHAR(20)" },
                        { name: "asset_id", type: "INT", key: "FK" },
                        { name: "borrowed_date", type: "TIMESTAMP" },
                        { name: "status", type: "ENUM" },
                      ]}
                    />

                    {/* Return Records Table */}
                    <TableCard 
                      name="return_records"
                      color="rose"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "borrowing_id", type: "INT", key: "FK" },
                        { name: "return_date", type: "TIMESTAMP" },
                        { name: "condition", type: "ENUM" },
                        { name: "received_by", type: "INT", key: "FK" },
                      ]}
                    />

                    {/* Maintenance Records Table */}
                    <TableCard 
                      name="maintenance_records"
                      color="emerald"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "asset_type", type: "VARCHAR(20)" },
                        { name: "asset_id", type: "INT", key: "FK" },
                        { name: "maintenance_type", type: "VARCHAR(50)" },
                        { name: "status", type: "ENUM" },
                        { name: "cost", type: "DECIMAL(10,2)" },
                      ]}
                    />
                    <TableCard 
                      name="report_uploads"
                      color="rose"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "user_id", type: "INT", key: "FK" },
                        { name: "filename", type: "VARCHAR(255)" },
                        { name: "content_type", type: "VARCHAR(100)" },
                        { name: "size_bytes", type: "INT" },
                        { name: "stored_path", type: "VARCHAR(255)" },
                        { name: "uploaded_at", type: "TIMESTAMP" },
                        { name: "notes", type: "TEXT" },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <RestrictedNotice feature="ERD" />
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-muted-foreground">Kementerian Kesehatan RI - RSUP Persahabatan</p>
          <p className="text-xs text-muted-foreground mt-1">Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana (SiPeNa)</p>
        </div>
        </div>
      </div>
    </div>
  )
}

type UseCaseRoleItem = {
  icon: string
  title: string
  desc: string
  disabled?: boolean
}

type UseCaseRoleCard = {
  key: string
  title: string
  roleIcon: string
  summary: string
  badge: string
  titleClass: string
  badgeClass: string
  containerClass: string
  glowClass: string
  iconWrapClass: string
  items: UseCaseRoleItem[]
}

type UseCaseSummaryCard = {
  title: string
  containerClass: string
  titleClass: string
  items: string[]
}

function RoleUseCaseCard({ card }: { card: UseCaseRoleCard }) {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
            <span>{card.roleIcon}</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.summary}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200">
          {card.badge}
        </Badge>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
        <span>{card.items.filter((item) => !item.disabled).length} akses aktif</span>
        <span>{card.items.length} poin</span>
      </div>

      <div className="mt-4 space-y-2.5">
        {card.items.map((item, i) => (
          <div
            key={`${card.key}-${i}`}
            className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${
              item.disabled
                ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20"
                : "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40"
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-base dark:bg-slate-900">
              <span>{item.icon}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
                {item.disabled && (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Dibatasi</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Component: Class Card
function ClassCard({ name, color, badge, properties, methods }: {
  name: string
  color: string
  badge: string
  properties: { name: string; type: string }[]
  methods: string[]
}) {
  const colorClasses: Record<string, string> = {
    teal: "from-teal-500 to-cyan-500 border-teal-200 dark:border-teal-800",
    purple: "from-purple-500 to-indigo-500 border-purple-200 dark:border-purple-800",
    blue: "from-blue-500 to-indigo-500 border-blue-200 dark:border-blue-800",
    orange: "from-orange-500 to-amber-500 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 border-emerald-200 dark:border-emerald-800",
    rose: "from-rose-500 to-pink-500 border-rose-200 dark:border-rose-800",
  }

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-lg ${colorClasses[color]?.split(' ').slice(1).join(' ')}`}>
      <div className={`bg-linear-to-r ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} p-3`}>
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-white">{name}</h4>
          <Badge className="bg-white/20 text-white border-0">{badge}</Badge>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Properties</p>
          <div className="space-y-1">
            {properties.map((prop, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-foreground">{prop.name}</span>
                <span className="font-mono text-muted-foreground">{prop.type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Methods</p>
          <div className="space-y-1">
            {methods.map((method, i) => (
              <div key={i} className="text-xs font-mono text-blue-600 dark:text-blue-400">
                + {method}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Component: Activity Flow
function ActivityFlow({ title, color, steps }: {
  title: string
  color: string
  steps: { step: string; type: string }[]
}) {
  const colorClasses: Record<string, string> = {
    orange: "from-orange-500 to-amber-500 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    blue: "from-blue-500 to-indigo-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    purple: "from-purple-500 to-indigo-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    rose: "from-rose-500 to-pink-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    amber: "from-amber-500 to-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    fuchsia: "from-fuchsia-500 to-pink-500 bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800",
    teal: "from-teal-500 to-cyan-500 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
  }

  const bgClass = colorClasses[color]?.split(' ').slice(2, 4).join(' ')
  const borderClass = colorClasses[color]?.split(' ').slice(4).join(' ')
  const gradientClass = colorClasses[color]?.split(' ').slice(0, 2).join(' ')

  return (
    <div className={`rounded-xl p-4 border ${bgClass} ${borderClass}`}>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <div className={`w-3 h-3 rounded-full bg-linear-to-r ${gradientClass}`}></div>
        {title}
      </h4>
      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {s.type === "start" && (
              <div className="mt-0.5 h-7 w-7 rounded-full bg-green-500 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
            )}
            {s.type === "end" && (
              <div className="mt-0.5 h-7 w-7 rounded-full bg-red-500 border-4 border-red-300 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
            {s.type === "action" && (
              <div className="mt-0.5 h-7 w-7 rounded-lg bg-white dark:bg-slate-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-[10px] font-bold">
                {i}
              </div>
            )}
            {s.type === "decision" && (
              <div className="mt-0.5 h-7 w-7 rotate-45 bg-yellow-400 border-2 border-yellow-500 flex items-center justify-center">
                <span className="-rotate-45 text-[10px]">?</span>
              </div>
            )}
            <span className="flex-1 text-[12px] leading-snug text-slate-700 dark:text-slate-200">{s.step}</span>
            {i < steps.length - 1 && (
              <Zap className="h-3.5 w-3.5 text-gray-400" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Component: Table Card (ERD)
function TableCard({ name, color, columns }: {
  name: string
  color: string
  columns: { name: string; type: string; key?: string }[]
}) {
  const colorClasses: Record<string, string> = {
    teal: "from-teal-500 to-cyan-500 border-teal-200 dark:border-teal-800",
    purple: "from-purple-500 to-indigo-500 border-purple-200 dark:border-purple-800",
    blue: "from-blue-500 to-indigo-500 border-blue-200 dark:border-blue-800",
    orange: "from-orange-500 to-amber-500 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 border-emerald-200 dark:border-emerald-800",
    rose: "from-rose-500 to-pink-500 border-rose-200 dark:border-rose-800",
  }

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-lg ${colorClasses[color]?.split(' ').slice(1).join(' ')}`}>
      <div className={`bg-linear-to-r ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} p-3`}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-white" />
          <h4 className="font-bold text-white font-mono text-sm">{name}</h4>
        </div>
      </div>
      <div className="p-3">
        <div className="space-y-1">
          {columns.map((col, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-2">
                {col.key && (
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${col.key === 'PK' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : col.key === 'FK' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                    {col.key}
                  </Badge>
                )}
                <span className="font-mono text-foreground">{col.name}</span>
              </div>
              <span className="font-mono text-muted-foreground text-[10px]">{col.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RestrictedNotice({ feature }: { feature: string }) {
  return (
    <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
      <CardHeader className="border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-linear-to-br from-slate-600 to-slate-800 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle>{feature}</CardTitle>
            <CardDescription>Akses terbatas</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Diagram ini hanya bisa dilihat oleh Administrator untuk menjaga kerahasiaan struktur aplikasi.
        </p>
        <p className="text-xs text-muted-foreground">
          Silakan hubungi admin apabila membutuhkan penjelasan tambahan.
        </p>
      </CardContent>
    </Card>
  )
}
