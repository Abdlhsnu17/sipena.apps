"use client"

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/services/auth-utils";
import { cn } from "@/utils";
import { normalizeUserRole } from "@/utils/role";
import { ArrowRight, Box, Database, FileText, Users, Workflow, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type DiagramSectionId = "activity" | "class" | "erd" | "use-case"

type ActivityStep = {
  step: string
  type: "start" | "action" | "decision" | "end"
}

const umlSections: { id: DiagramSectionId; label: string }[] = [
  {
    id: "activity",
    label: "Activity Diagram",
  },
  {
    id: "use-case",
    label: "Use Case Diagram",
  },
]

function isDiagramSectionId(value: string | null | undefined): value is DiagramSectionId {
  if (!value) {
    return false
  }

  return umlSections.some((section) => section.id === value)
}

function resolveSectionFromLocation(allowedSections: DiagramSectionId[]): DiagramSectionId {
  const hashSection = window.location.hash.replace("#", "")
  const querySection = new URLSearchParams(window.location.search).get("diagram")

  if (isDiagramSectionId(hashSection) && allowedSections.includes(hashSection)) {
    return hashSection
  }

  if (isDiagramSectionId(querySection) && allowedSections.includes(querySection)) {
    return querySection
  }

  return allowedSections[0] ?? "activity"
}

const activityFlows: { title: string; color: "amber" | "emerald" | "fuchsia" | "orange" | "purple" | "rose" | "teal"; steps: ActivityStep[] }[] = [
  {
    title: "Alur Daftar Akun",
    color: "fuchsia",
    steps: [
      { step: "Start", type: "start" },
      { step: "Klik Buat Akun", type: "action" },
      { step: "Isi formulir (NIP, nama, email, role)", type: "action" },
      { step: "Data valid?", type: "decision" },
      { step: "Simpan akun ke database", type: "action" },
      { step: "Admin aktifkan akun jika perlu", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Login",
    color: "purple",
    steps: [
      { step: "Start", type: "start" },
      { step: "Input NIP & Password", type: "action" },
      { step: "Validasi kredensial & status akun", type: "action" },
      { step: "Valid & aktif?", type: "decision" },
      { step: "Generate JWT token + session version", type: "action" },
      { step: "Redirect ke dashboard sesuai role", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Reset Password",
    color: "amber",
    steps: [
      { step: "Start", type: "start" },
      { step: "Klik Lupa Password", type: "action" },
      { step: "Input NIP untuk verifikasi identitas", type: "action" },
      { step: "NIP terdaftar?", type: "decision" },
      { step: "Kirim kode verifikasi ke email", type: "action" },
      { step: "Input kode & atur password baru", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Pengaturan Profil",
    color: "rose",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka Edit Profil", type: "action" },
      { step: "Ubah biodata, unit kerja, foto, atau password", type: "action" },
      { step: "Data valid?", type: "decision" },
      { step: "Simpan perubahan ke akun", type: "action" },
      { step: "Perbarui sesi & profil aktif", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Inventaris Medis",
    color: "teal",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka Inventaris Medis", type: "action" },
      { step: "Cari, filter, atau pilih detail aset", type: "action" },
      { step: "Role admin/leader/staff PJ?", type: "decision" },
      { step: "Tambah, ubah, atau impor aset medis", type: "action" },
      { step: "Simpan ke master inventaris", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Inventaris Non-Medis",
    color: "fuchsia",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka Inventaris Non-Medis", type: "action" },
      { step: "Cari, filter, atau pilih detail aset", type: "action" },
      { step: "Role admin/leader/staff PJ?", type: "decision" },
      { step: "Tambah, ubah, atau impor aset non-medis", type: "action" },
      { step: "Simpan ke master inventaris", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Peminjaman Alat",
    color: "orange",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih alat yang tersedia", type: "action" },
      { step: "Isi form: tujuan, durasi, ruangan tujuan", type: "action" },
      { step: "Data lengkap?", type: "decision" },
      { step: "Kirim permintaan peminjaman (status: pending)", type: "action" },
      { step: "Admin/leader setujui atau tolak", type: "action" },
      { step: "Disetujui?", type: "decision" },
      { step: "Status alat: dipinjam, log penggunaan terbuat", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Pengembalian Alat",
    color: "rose",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih data peminjaman aktif", type: "action" },
      { step: "Isi kondisi alat & catatan pengembalian", type: "action" },
      { step: "Data valid?", type: "decision" },
      { step: "Ajukan pengembalian (status: returned)", type: "action" },
      { step: "Petugas verifikasi fisik alat", type: "action" },
      { step: "Alat sesuai & divalidasi?", type: "decision" },
      { step: "Status alat kembali tersedia", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Penggunaan Aset",
    color: "amber",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih alat di sub ruangan pengguna", type: "action" },
      { step: "Isi operator, ruangan, waktu, konteks pemakaian", type: "action" },
      { step: "Alat overdue & konteks darurat?", type: "decision" },
      { step: "Validasi role: admin/leader/role peminjam asal", type: "action" },
      { step: "Role sesuai?", type: "decision" },
      { step: "Simpan log penggunaan, status: Sedang Digunakan", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Selesaikan Penggunaan",
    color: "teal",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih log penggunaan aktif", type: "action" },
      { step: "Role admin/leader/staff PJ atau sama dengan operator?", type: "decision" },
      { step: "Isi waktu selesai & kondisi akhir alat", type: "action" },
      { step: "Data valid?", type: "decision" },
      { step: "Simpan penyelesaian, status alat: Aktif", type: "action" },
      { step: "Sinkron status peminjaman jika ada", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Jadwal Pemeliharaan",
    color: "emerald",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih aset yang perlu dijadwalkan", type: "action" },
      { step: "Isi tanggal, teknisi, dan deskripsi", type: "action" },
      { step: "Jadwal valid?", type: "decision" },
      { step: "Simpan jadwal pemeliharaan", type: "action" },
      { step: "Sinkronkan ke record pemeliharaan", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Pemeliharaan Sarana",
    color: "teal",
    steps: [
      { step: "Start", type: "start" },
      { step: "Teknisi buka daftar pemeliharaan", type: "action" },
      { step: "Lakukan pengecekan & update status", type: "action" },
      { step: "Pekerjaan selesai?", type: "decision" },
      { step: "Isi catatan hasil & kondisi akhir", type: "action" },
      { step: "Leader/Admin validasi & tutup record", type: "action" },
      { step: "Simpan riwayat pemeliharaan", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Sanksi Peminjaman",
    color: "rose",
    steps: [
      { step: "Start", type: "start" },
      { step: "Sistem deteksi peminjaman melewati batas waktu", type: "action" },
      { step: "Tandai status peminjaman: overdue", type: "action" },
      { step: "Admin/leader buka daftar sanksi aktif", type: "action" },
      { step: "Tindakan: selesaikan atau bebaskan sanksi?", type: "decision" },
      { step: "Isi catatan resolusi sanksi", type: "action" },
      { step: "Status sanksi diperbarui & dicatat", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Pemusnahan Aset",
    color: "orange",
    steps: [
      { step: "Start", type: "start" },
      { step: "Ajukan permintaan pemusnahan aset", type: "action" },
      { step: "Isi alasan, tanggal, dan dokumen pendukung", type: "action" },
      { step: "Data lengkap?", type: "decision" },
      { step: "Admin/leader review pengajuan", type: "action" },
      { step: "Disetujui?", type: "decision" },
      { step: "Status aset: Dimusnakan, catat riwayat disposal", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur SPK Prioritas Aset",
    color: "purple",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka SPK Prioritas Aset (AHP)", type: "action" },
      { step: "Pilih aset & tentukan bobot kriteria", type: "action" },
      { step: "Rasio konsistensi (CR) ≤ 0.1?", type: "decision" },
      { step: "Hitung prioritas dengan matriks AHP", type: "action" },
      { step: "Tampilkan ranking rekomendasi pemeliharaan", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Laporan & Analitik",
    color: "fuchsia",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka dashboard laporan", type: "action" },
      { step: "Pilih jenis laporan & filter periode/unit", type: "action" },
      { step: "Data tersedia?", type: "decision" },
      { step: "Tampilkan ringkasan, grafik, dan tabel", type: "action" },
      { step: "Ekspor laporan PDF atau Excel", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Unggah Dokumen",
    color: "orange",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka modul Unggah Dokumen", type: "action" },
      { step: "Pilih file & isi metadata dokumen", type: "action" },
      { step: "Format & ukuran valid?", type: "decision" },
      { step: "Unggah dan simpan ke server", type: "action" },
      { step: "Pratinjau, unduh, atau hapus dokumen", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Manajemen Pengguna",
    color: "amber",
    steps: [
      { step: "Start", type: "start" },
      { step: "Admin/Leader buka daftar pengguna", type: "action" },
      { step: "Tambah, ubah role, unit, atau reset password", type: "action" },
      { step: "Role boleh mengelola target pengguna?", type: "decision" },
      { step: "Simpan perubahan data pengguna", type: "action" },
      { step: "Catat aktivitas manajemen user di log", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Arsip Aktivitas",
    color: "emerald",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka Riwayat Aktivitas", type: "action" },
      { step: "Terapkan filter fitur, aksi, user, atau tanggal", type: "action" },
      { step: "Hasil ditemukan?", type: "decision" },
      { step: "Tampilkan log & metadata transaksi", type: "action" },
      { step: "Gunakan sebagai bahan audit operasional", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Dokumentasi Sistem",
    color: "rose",
    steps: [
      { step: "Start", type: "start" },
      { step: "Buka Dokumentasi Sistem (UML)", type: "action" },
      { step: "Pilih Activity Diagram atau Use Case Diagram", type: "action" },
      { step: "Akses diagram sesuai role pengguna", type: "action" },
      { step: "Pelajari alur & interaksi modul SIPENA", type: "action" },
      { step: "End", type: "end" },
    ],
  },
]

const classItems = [
  {
    name: "Borrowing",
    color: "orange" as const,
    badge: "Transaction",
    properties: [
      { name: "id", type: "string" },
      { name: "userId", type: "string" },
      { name: "assetId", type: "string" },
      { name: "status", type: "BorrowStatus" },
    ],
    methods: ["request()", "approve()", "return()"],
  },
  {
    name: "Maintenance",
    color: "emerald" as const,
    badge: "Transaction",
    properties: [
      { name: "id", type: "string" },
      { name: "assetId", type: "string" },
      { name: "status", type: "string" },
      { name: "cost", type: "number" },
    ],
    methods: ["schedule()", "complete()", "cancel()"],
  },
  {
    name: "MedicalAsset",
    color: "purple" as const,
    badge: "Entity",
    properties: [
      { name: "id", type: "string" },
      { name: "assetCode", type: "string" },
      { name: "name", type: "string" },
      { name: "status", type: "AssetStatus" },
    ],
    methods: ["create()", "update()", "delete()"],
  },
  {
    name: "NonMedicalAsset",
    color: "blue" as const,
    badge: "Entity",
    properties: [
      { name: "id", type: "string" },
      { name: "assetCode", type: "string" },
      { name: "name", type: "string" },
      { name: "status", type: "AssetStatus" },
    ],
    methods: ["create()", "update()", "delete()"],
  },
  {
    name: "Return",
    color: "rose" as const,
    badge: "Transaction",
    properties: [
      { name: "id", type: "string" },
      { name: "borrowingId", type: "string" },
      { name: "condition", type: "string" },
      { name: "notes", type: "string" },
    ],
    methods: ["submit()", "verify()"],
  },
  {
    name: "User",
    color: "teal" as const,
    badge: "Core",
    properties: [
      { name: "id", type: "string" },
      { name: "nip", type: "string" },
      { name: "name", type: "string" },
      { name: "email", type: "string" },
      { name: "role", type: "UserRole" },
    ],
    methods: ["login()", "logout()", "updateProfile()"],
  },
]

const erdTables = [
  {
    name: "borrowing_records",
    color: "orange" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "user_id", type: "INT", key: "FK" },
      { name: "asset_id", type: "INT", key: "FK" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "maintenance_records",
    color: "emerald" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "asset_id", type: "INT", key: "FK" },
      { name: "maintenance_type", type: "VARCHAR(50)" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "medical_assets",
    color: "purple" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
      { name: "name", type: "VARCHAR(255)" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "non_medical_assets",
    color: "blue" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
      { name: "name", type: "VARCHAR(255)" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "return_records",
    color: "rose" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "borrowing_id", type: "INT", key: "FK" },
      { name: "condition", type: "ENUM" },
      { name: "received_by", type: "INT", key: "FK" },
    ],
  },
  {
    name: "users",
    color: "teal" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "nip", type: "VARCHAR(20)", key: "UQ" },
      { name: "email", type: "VARCHAR(255)", key: "UQ" },
      { name: "role", type: "ENUM" },
    ],
  },
]

type UseCaseActor = {
  actor: string
  accent: "teal" | "violet" | "blue" | "amber" | "sky" | "orange" | "emerald" | "rose"
  summary: string
  items: string[]
  note?: string
}

const useCaseActors: UseCaseActor[] = [
  {
    actor: "Pengguna Publik",
    accent: "rose",
    summary: "Aktor yang belum login dan hanya berinteraksi dengan modul autentikasi awal.",
    items: [
      "Login ke sistem dengan NIP & password",
      "Registrasi akun baru (menunggu aktivasi admin)",
      "Reset password melalui kode verifikasi NIP",
    ],
  },
  {
    actor: "Pengguna Terautentikasi",
    accent: "emerald",
    summary: "Hak akses dasar yang otomatis dimiliki semua akun aktif setelah berhasil login.",
    items: [
      "Logout dan kelola profil: biodata, foto, unit kerja, password",
      "Akses dokumentasi sistem (Activity & Use Case Diagram)",
      "Lihat riwayat aktivitas akun sendiri",
      "Unggah, lihat, unduh, dan pratinjau dokumen sesuai hak akses",
    ],
  },
  {
    actor: "Administrator",
    accent: "teal" as const,
    summary: "Role dengan kontrol penuh atas seluruh data master, transaksi, pengguna, sanksi, dan disposal.",
    items: [
      "CRUD inventaris medis & non-medis, impor data massal",
      "Setujui/tolak peminjaman, validasi pengembalian, kelola sanksi overdue",
      "Catat & selesaikan penggunaan aset (semua log); izin penggunaan darurat pada alat overdue",
      "Kelola pemeliharaan: jadwal, status, riwayat, dan hapus record",
      "Setujui atau tolak pengajuan pemusnahan (disposal) aset",
      "CRUD semua pengguna, akses laporan penuh, dan hapus dokumen",
    ],
  },
  {
    actor: "Leader",
    accent: "violet" as const,
    summary: "Role pengawas operasional yang memvalidasi proses inti dan mengelola sanksi serta disposal.",
    items: [
      "Pantau & validasi inventaris, peminjaman, pengembalian, pemeliharaan",
      "Setujui/tolak transaksi, selesaikan & bebaskan sanksi overdue",
      "Catat & selesaikan penggunaan aset; izin penggunaan darurat alat overdue",
      "Setujui atau tolak pengajuan pemusnahan (disposal) aset",
      "Tambah & ubah user operasional non-admin, akses laporan penuh",
    ],
    note: "Leader tidak menghapus aset, jadwal pemeliharaan, akun admin, atau dokumen unggahan.",
  },
  {
    actor: "Staff PJ",
    accent: "blue" as const,
    summary: "Penanggung jawab unit yang menangani inventaris, koordinasi transaksi, dan dapat menyelesaikan penggunaan.",
    items: [
      "Tambah & ubah inventaris sesuai cakupan unit (medis/non-medis/all)",
      "Ajukan peminjaman, catat pengembalian, buat permintaan pemeliharaan",
      "Catat penggunaan aset di sub ruangan; selesaikan log penggunaan (semua log di unitnya)",
      "Penggunaan darurat alat overdue jika role cocok dengan peminjam asal",
      "Pantau laporan operasional & progres tindak lanjut unit",
    ],
    note: "Cakupan inventaris mengikuti staff access type yang ditetapkan admin.",
  },
  {
    actor: "Staff Pelayanan",
    accent: "sky" as const,
    summary: "Role operasional harian yang mencatat penggunaan aset dan mengajukan kebutuhan pemeliharaan.",
    items: [
      "Lihat inventaris sesuai cakupan unit",
      "Ajukan peminjaman dan catat pengembalian alat",
      "Catat penggunaan aset di sub ruangan sendiri",
      "Selesaikan penggunaan yang dicatatnya sendiri (role operator cocok)",
      "Buat permintaan pemeliharaan; lihat jadwal & laporan operasional",
    ],
    note: "Penggunaan darurat alat overdue hanya jika role-nya sama dengan peminjam asal.",
  },
  {
    actor: "Teknisi",
    accent: "orange" as const,
    summary: "Role eksekutor teknis yang mengerjakan dan memperbarui status pemeliharaan di lapangan.",
    items: [
      "Lihat daftar pemeliharaan dan jadwal kerja teknisi",
      "Ubah status jadwal: in-progress, selesai, atau batalkan",
      "Isi catatan hasil perbaikan dan kondisi akhir alat",
      "Validasi penyelesaian pemeliharaan jika diberi wewenang",
    ],
  },
  {
    actor: "Pengguna",
    accent: "amber" as const,
    summary: "Role self-service untuk pinjam pakai alat tanpa akses manajemen data master atau laporan.",
    items: [
      "Lihat inventaris medis dan non-medis",
      "Ajukan peminjaman dan lihat riwayat peminjaman sendiri",
      "Catat pengembalian alat; catat penggunaan di sub ruangan sendiri",
      "Selesaikan penggunaan yang dicatatnya sendiri (role operator cocok)",
    ],
    note: "Tidak dapat mengakses laporan, manajemen pengguna, sanksi, atau disposal.",
  },
]

export default function UMLPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser())
  const [activeSection, setActiveSection] = useState<DiagramSectionId>("activity")
  const sectionContainerRef = useRef<HTMLDivElement>(null)

  const visibleSections = useMemo(() => {
    const role = normalizeUserRole(currentUser?.role)
    if (role === "admin") {
      return umlSections
    }

    return umlSections.filter((section) => section.id === "activity" || section.id === "use-case")
  }, [currentUser?.role])

  const visibleSectionIds = useMemo(
    () => visibleSections.map((section) => section.id),
    [visibleSections]
  )

  useEffect(() => {
    const syncUser = () => setCurrentUser(getCurrentUser())
    syncUser()

    window.addEventListener("auth-user-updated", syncUser)
    return () => window.removeEventListener("auth-user-updated", syncUser)
  }, [])

  useEffect(() => {
    const initialSection = resolveSectionFromLocation(visibleSectionIds)
    setActiveSection(initialSection)

    const syncFromLocation = () => {
      setActiveSection(resolveSectionFromLocation(visibleSectionIds))
    }

    window.addEventListener("hashchange", syncFromLocation)
    window.addEventListener("popstate", syncFromLocation)

    return () => {
      window.removeEventListener("hashchange", syncFromLocation)
      window.removeEventListener("popstate", syncFromLocation)
    }
  }, [visibleSectionIds])

  useEffect(() => {
    if (!visibleSectionIds.includes(activeSection)) {
      setActiveSection(visibleSectionIds[0] ?? "activity")
    }
  }, [activeSection, visibleSectionIds])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set("diagram", activeSection)
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}#${activeSection}`

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl)
    }

    if (sectionContainerRef.current) {
      sectionContainerRef.current.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(0.995)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        {
          duration: 280,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      )
    }
  }, [activeSection])

  return (
    <div>
      <div className="w-full space-y-8">
        <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex items-start gap-3 sm:items-center sm:gap-5">
            <div className="rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="mt-1 text-[18px] font-bold text-foreground">Dokumentasi Sistem</h1>
            </div>
          </div>
        </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveSection("activity")}
            className={cn(
              "group flex h-full flex-col justify-between rounded-2xl border border-white/50 bg-linear-to-br from-orange-500/70 via-amber-500/70 to-rose-500/60 p-4 text-left shadow-lg transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500",
              activeSection === "activity" && "ring-2 ring-orange-400 ring-offset-2 ring-offset-(--app-shell-background)",
            )}
            aria-label="Lihat Activity Diagram"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/30 text-white backdrop-blur">
                <Workflow className="h-5 w-5 text-white" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-base font-bold text-white">Activity Diagram</p>
                <p className="text-xs text-white/90">Alur proses semua fitur utama SIPENA.</p>
              </div>
            </div>
            <div className="mt-3 flex items-center">
              <ArrowRight className="h-4 w-4 text-white/80" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("use-case")}
            className={cn(
              "group flex h-full flex-col justify-between rounded-2xl border border-white/50 bg-linear-to-br from-purple-500/70 via-fuchsia-500/70 to-pink-500/60 p-4 text-left shadow-lg transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
              activeSection === "use-case" && "ring-2 ring-purple-400 ring-offset-2 ring-offset-(--app-shell-background)",
            )}
            aria-label="Lihat Use Case Diagram"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/30 text-white backdrop-blur">
                <Users className="h-5 w-5 text-white" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-base font-bold text-white">Use Case Diagram</p>
                <p className="text-xs text-white/90">Interaksi aktor dengan modul inti sistem.</p>
              </div>
            </div>
            <div className="mt-3 flex items-center">
              <ArrowRight className="h-4 w-4 text-white/80" />
            </div>
          </button>

        </section>

        <div ref={sectionContainerRef}>
        {activeSection === "activity" && (
          <section id="activity" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-orange-500 to-amber-500 p-2">
                  <Workflow className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Activity Diagram</CardTitle>
                  <CardDescription>Alur proses autentikasi, profil, inventaris, transaksi, pemeliharaan, laporan, SPK, unggahan, dan dokumentasi.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="panel-gutter">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {activityFlows.map((flow) => (
                  <ActivityFlow key={flow.title} title={flow.title} color={flow.color} steps={flow.steps} />
                ))}
              </div>
            </CardContent>
          </Card>
          </section>
        )}

          {activeSection === "class" && visibleSectionIds.includes("class") && (
          <section id="class" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-purple-500 to-indigo-500 p-2">
                  <Box className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Class Diagram</CardTitle>
                  <CardDescription>Struktur kelas dan relasi inti pada sistem.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 panel-gutter">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {classItems.map((item) => (
                  <ClassCard key={item.name} {...item} />
                ))}
              </div>
              <div className="rounded-2xl bg-linear-to-r from-purple-50 to-indigo-50 panel-gutter dark:from-purple-950/30 dark:to-indigo-950/30">
                <h4 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Relasi Antar Kelas</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { from: "Borrowing", to: "Return", rel: "1 : 1" },
                    { from: "MedicalAsset", to: "Borrowing", rel: "1 : N" },
                    { from: "User", to: "Borrowing", rel: "1 : N" },
                    { from: "User", to: "Maintenance", rel: "1 : N" },
                  ].map((relation) => (
                    <div key={`${relation.from}-${relation.to}`} className="flex flex-col gap-3 rounded-xl bg-white/70 p-3 sm:flex-row sm:items-center dark:bg-slate-800/60">
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200">
                        {relation.from}
                      </Badge>
                      <div className="flex flex-1 items-center gap-2">
                        <div className="h-px flex-1 bg-purple-300" />
                        <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-200">
                          {relation.rel}
                        </span>
                        <div className="h-px flex-1 bg-purple-300" />
                      </div>
                      <Badge variant="outline" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                        {relation.to}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          </section>
        )}
        </div>

          {activeSection === "erd" && visibleSectionIds.includes("erd") && (
          <section id="erd" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-emerald-500 to-green-500 p-2">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Entity Relationship Diagram</CardTitle>
                  <CardDescription>Representasi tabel dan struktur data utama.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="panel-gutter">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {erdTables.map((table) => (
                  <TableCard key={table.name} {...table} />
                ))}
              </div>
            </CardContent>
          </Card>
          </section>
        )}

        {activeSection === "use-case" && (
          <section id="use-case" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-teal-500 to-cyan-500 p-2">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Use Case Diagram</CardTitle>
                  <CardDescription>Interaksi aktor dengan modul inti sistem inventaris beserta batas akses setiap role.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="panel-gutter">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {useCaseActors.map((actor) => (
                  <UseCaseActorCard key={actor.actor} {...actor} />
                ))}
              </div>
            </CardContent>
          </Card>
          </section>
        )}

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
          </p>
        </div>
      </div>
    </div>
  )
}

function ClassCard({
  name,
  color,
  badge,
  properties,
  methods,
}: {
  name: string
  color: "teal" | "purple" | "blue" | "orange" | "emerald" | "rose"
  badge: string
  properties: { name: string; type: string }[]
  methods: string[]
}) {
  const colorClasses: Record<typeof color, string> = {
    teal: "from-teal-500 to-cyan-500 border-teal-200 dark:border-teal-800",
    purple: "from-purple-500 to-indigo-500 border-purple-200 dark:border-purple-800",
    blue: "from-blue-500 to-indigo-500 border-blue-200 dark:border-blue-800",
    orange: "from-orange-500 to-amber-500 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 border-emerald-200 dark:border-emerald-800",
    rose: "from-rose-500 to-pink-500 border-rose-200 dark:border-rose-800",
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-slate-900 ${colorClasses[color].split(" ").slice(1).join(" ")}`}>
      <div className={`bg-linear-to-r p-3 ${colorClasses[color].split(" ").slice(0, 2).join(" ")}`}>
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-white">{name}</h4>
          <Badge className="border-0 bg-white/20 text-white">{badge}</Badge>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Properties</p>
          <div className="space-y-1">
            {properties.map((prop) => (
              <div key={`${name}-${prop.name}`} className="flex justify-between text-xs">
                <span className="text-foreground">{prop.name}</span>
                <span className="font-mono text-muted-foreground">{prop.type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Methods</p>
          <div className="space-y-1">
            {methods.map((method) => (
              <div key={`${name}-${method}`} className="font-mono text-xs text-blue-600 dark:text-blue-400">
                + {method}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityFlow({
  title,
  color,
  steps,
}: {
  title: string
  color: "amber" | "emerald" | "fuchsia" | "orange" | "purple" | "rose" | "teal"
  steps: ActivityStep[]
}) {
  const colorClasses: Record<typeof color, string> = {
    amber: "from-amber-500 to-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    emerald: "from-emerald-500 to-green-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    fuchsia: "from-fuchsia-500 to-pink-500 bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800",
    orange: "from-orange-500 to-amber-500 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    purple: "from-purple-500 to-indigo-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    rose: "from-rose-500 to-pink-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    teal: "from-teal-500 to-cyan-500 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
  }

  const gradientClass = colorClasses[color].split(" ").slice(0, 2).join(" ")
  const bgClass = colorClasses[color].split(" ").slice(2, 4).join(" ")
  const borderClass = colorClasses[color].split(" ").slice(4).join(" ")

  return (
    <div className={`rounded-xl border p-4 ${bgClass} ${borderClass}`}>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <div className={`h-3 w-3 rounded-full bg-linear-to-r ${gradientClass}`} />
        {title}
      </h4>
      <div className="space-y-1.5">
        {steps.map((step, index) => (
          <div key={`${title}-${step.step}`} className="flex items-start gap-2.5">
            {step.type === "start" && (
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
            )}
            {step.type === "end" && (
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-red-300 bg-red-500">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            )}
            {step.type === "action" && (
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-[10px] font-bold dark:border-gray-600 dark:bg-slate-800">
                {index}
              </div>
            )}
            {step.type === "decision" && (
              <div className="mt-0.5 flex h-7 w-7 rotate-45 items-center justify-center border-2 border-yellow-500 bg-yellow-400">
                <span className="-rotate-45 text-[10px]">?</span>
              </div>
            )}
            <span className="flex-1 text-[12px] leading-snug text-slate-700 dark:text-slate-200">{step.step}</span>
            {index < steps.length - 1 && <Zap className="h-3.5 w-3.5 text-gray-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function TableCard({
  name,
  color,
  columns,
}: {
  name: string
  color: "teal" | "purple" | "blue" | "orange" | "emerald" | "rose"
  columns: { name: string; type: string; key?: string }[]
}) {
  const colorClasses: Record<typeof color, string> = {
    teal: "from-teal-500 to-cyan-500 border-teal-200 dark:border-teal-800",
    purple: "from-purple-500 to-indigo-500 border-purple-200 dark:border-purple-800",
    blue: "from-blue-500 to-indigo-500 border-blue-200 dark:border-blue-800",
    orange: "from-orange-500 to-amber-500 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 border-emerald-200 dark:border-emerald-800",
    rose: "from-rose-500 to-pink-500 border-rose-200 dark:border-rose-800",
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-slate-900 ${colorClasses[color].split(" ").slice(1).join(" ")}`}>
      <div className={`bg-linear-to-r p-3 ${colorClasses[color].split(" ").slice(0, 2).join(" ")}`}>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-white" />
          <h4 className="font-mono text-sm font-bold text-white">{name}</h4>
        </div>
      </div>
      <div className="p-3">
        <div className="space-y-1">
          {columns.map((column) => (
            <div key={`${name}-${column.name}`} className="flex items-center justify-between border-b border-gray-100 py-1 text-xs last:border-0 dark:border-gray-800">
              <div className="flex items-center gap-2">
                {column.key && (
                  <Badge
                    variant="outline"
                    className={`px-1 py-0 text-[10px] ${
                      column.key === "PK"
                        ? "border-yellow-300 bg-yellow-100 text-yellow-700"
                        : column.key === "FK"
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-gray-300 bg-gray-100 text-gray-700"
                    }`}
                  >
                    {column.key}
                  </Badge>
                )}
                <span className="font-mono text-foreground">{column.name}</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{column.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UseCaseActorCard({
  actor,
  accent,
  summary,
  items,
  note,
}: {
  actor: string
  accent: "teal" | "violet" | "blue" | "amber" | "sky" | "orange" | "emerald" | "rose"
  summary: string
  items: string[]
  note?: string
}) {
  const accentClass: Record<typeof accent, string> = {
    teal: "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/20",
    violet: "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20",
    blue: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20",
    amber: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20",
    sky: "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20",
    orange: "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20",
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20",
    rose: "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/20",
  }

  return (
    <div className={`rounded-2xl border p-5 ${accentClass[accent]}`}>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{actor}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{summary}</p>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={`${actor}-${item}`} className="flex items-start gap-3 rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            <span>{item}</span>
          </div>
        ))}
      </div>
      {note ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300/80 bg-white/70 px-4 py-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          {note}
        </div>
      ) : null}
    </div>
  )
}
