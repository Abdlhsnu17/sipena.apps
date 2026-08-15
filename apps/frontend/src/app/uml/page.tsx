"use client"

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/services/auth-utils";
import { cn } from "@/utils";
import { normalizeUserRole } from "@/utils/role";
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Box,
  Boxes,
  CalendarClock,
  ClipboardList,
  Crown,
  Database,
  FileText,
  Globe,
  History,
  KeyRound,
  LogIn,
  Scale,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Upload,
  UserCog,
  UserRound,
  Users,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";

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

type UseCaseIconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>

type UseCaseAccent = "slate" | "emerald" | "teal" | "violet" | "indigo" | "sky" | "orange" | "amber"

type UseCaseLevel = "penuh" | "kelola" | "ajukan" | "lihat"

type UseCaseGroup = {
  module: string
  icon: UseCaseIconComponent
  level: UseCaseLevel
  points: string[]
}

type UseCaseActor = {
  actor: string
  roleKey: string
  tier: string
  icon: UseCaseIconComponent
  accent: UseCaseAccent
  summary: string
  groups: UseCaseGroup[]
  note?: string
}

const useCaseLevelMeta: Record<UseCaseLevel, { label: string; className: string }> = {
  penuh: {
    label: "Akses Penuh",
    className: "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300",
  },
  kelola: {
    label: "Kelola & Validasi",
    className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300",
  },
  ajukan: {
    label: "Ajukan & Catat",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
  },
  lihat: {
    label: "Lihat Saja",
    className: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-400/30 dark:bg-slate-400/10 dark:text-slate-300",
  },
}

const useCaseAccentMeta: Record<UseCaseAccent, { card: string; icon: string; chip: string; module: string; bullet: string }> = {
  slate: {
    card: "border-slate-200 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/40",
    icon: "from-slate-500 to-slate-700",
    chip: "bg-slate-200/80 text-slate-700 dark:bg-slate-400/15 dark:text-slate-200",
    module: "text-slate-500 dark:text-slate-400",
    bullet: "bg-slate-400",
  },
  emerald: {
    card: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/60 dark:bg-emerald-950/20",
    icon: "from-emerald-500 to-green-600",
    chip: "bg-emerald-200/70 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
    module: "text-emerald-600 dark:text-emerald-400",
    bullet: "bg-emerald-500",
  },
  teal: {
    card: "border-teal-200 bg-teal-50/70 dark:border-teal-800/60 dark:bg-teal-950/20",
    icon: "from-teal-500 to-cyan-600",
    chip: "bg-teal-200/70 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200",
    module: "text-teal-600 dark:text-teal-400",
    bullet: "bg-teal-500",
  },
  violet: {
    card: "border-violet-200 bg-violet-50/70 dark:border-violet-800/60 dark:bg-violet-950/20",
    icon: "from-violet-500 to-purple-600",
    chip: "bg-violet-200/70 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
    module: "text-violet-600 dark:text-violet-400",
    bullet: "bg-violet-500",
  },
  indigo: {
    card: "border-indigo-200 bg-indigo-50/70 dark:border-indigo-800/60 dark:bg-indigo-950/20",
    icon: "from-indigo-500 to-blue-600",
    chip: "bg-indigo-200/70 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200",
    module: "text-indigo-600 dark:text-indigo-400",
    bullet: "bg-indigo-500",
  },
  sky: {
    card: "border-sky-200 bg-sky-50/70 dark:border-sky-800/60 dark:bg-sky-950/20",
    icon: "from-sky-500 to-blue-500",
    chip: "bg-sky-200/70 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200",
    module: "text-sky-600 dark:text-sky-400",
    bullet: "bg-sky-500",
  },
  orange: {
    card: "border-orange-200 bg-orange-50/70 dark:border-orange-800/60 dark:bg-orange-950/20",
    icon: "from-orange-500 to-amber-600",
    chip: "bg-orange-200/70 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200",
    module: "text-orange-600 dark:text-orange-400",
    bullet: "bg-orange-500",
  },
  amber: {
    card: "border-amber-200 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/20",
    icon: "from-amber-500 to-yellow-600",
    chip: "bg-amber-200/70 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
    module: "text-amber-600 dark:text-amber-400",
    bullet: "bg-amber-500",
  },
}

const useCaseActors: UseCaseActor[] = [
  {
    actor: "Pengguna Publik",
    roleKey: "guest",
    tier: "Pra-Login",
    icon: Globe,
    accent: "slate",
    summary: "Aktor yang belum memiliki sesi aktif. Interaksinya terbatas pada gerbang autentikasi sebelum masuk ke sistem.",
    groups: [
      {
        module: "Autentikasi",
        icon: LogIn,
        level: "ajukan",
        points: [
          "Login memakai NIP dan password",
          "Registrasi akun baru dan menunggu aktivasi admin",
          "Reset password lewat kode verifikasi yang dikirim ke email",
        ],
      },
    ],
    note: "Tidak ada akses ke data aset, transaksi, maupun laporan sebelum sesi terbentuk.",
  },
  {
    actor: "Pengguna Terautentikasi",
    roleKey: "base actor",
    tier: "Hak Dasar",
    icon: KeyRound,
    accent: "emerald",
    summary: "Aktor generalisasi. Seluruh role di bawah ini mewarisi hak akses berikut begitu berhasil login.",
    groups: [
      {
        module: "Akun & Profil",
        icon: UserCog,
        level: "kelola",
        points: [
          "Logout dan mengelola sesi perangkat sendiri",
          "Ubah biodata, unit kerja, foto profil, dan password",
        ],
      },
      {
        module: "Dokumen & Arsip",
        icon: Upload,
        level: "ajukan",
        points: [
          "Unggah, pratinjau, unduh, dan lihat dokumen sesuai hak akses",
          "Telusuri riwayat aktivitas (teknisi & pengguna hanya log miliknya)",
        ],
      },
      {
        module: "Penunjang Sistem",
        icon: ScrollText,
        level: "lihat",
        points: [
          "Akses dokumentasi sistem: Activity Diagram & Use Case Diagram",
          "Gunakan pemindai QR aset dan SPK Prioritas Aset (AHP)",
        ],
      },
    ],
  },
  {
    actor: "Administrator",
    roleKey: "admin",
    tier: "Kontrol Penuh",
    icon: ShieldCheck,
    accent: "teal",
    summary: "Pemegang kendali tertinggi atas data master, transaksi, pengguna, sanksi, dan pemusnahan aset.",
    groups: [
      {
        module: "Inventaris Aset",
        icon: Boxes,
        level: "penuh",
        points: [
          "Tambah, ubah, dan hapus aset medis maupun non-medis",
          "Impor data massal dan perbaiki kode aset yang keliru",
        ],
      },
      {
        module: "Peminjaman & Pengembalian",
        icon: ArrowLeftRight,
        level: "penuh",
        points: [
          "Setujui atau tolak pengajuan peminjaman",
          "Validasi pengembalian, ubah, hingga hapus data transaksi",
        ],
      },
      {
        module: "Penggunaan Aset",
        icon: Activity,
        level: "penuh",
        points: [
          "Catat dan selesaikan seluruh log penggunaan lintas unit",
          "Beri izin penggunaan darurat pada alat berstatus overdue",
        ],
      },
      {
        module: "Pemeliharaan & Jadwal",
        icon: Wrench,
        level: "penuh",
        points: [
          "Buat jadwal, ubah status, validasi akhir, dan hapus record",
          "Pantau riwayat pemeliharaan seluruh aset",
        ],
      },
      {
        module: "Sanksi & Pemusnahan",
        icon: ShieldAlert,
        level: "penuh",
        points: [
          "Kelola sanksi overdue: selesaikan atau bebaskan",
          "Setujui atau tolak pengajuan pemusnahan (disposal) aset",
        ],
      },
      {
        module: "Pengguna & Laporan",
        icon: Users,
        level: "penuh",
        points: [
          "CRUD semua akun termasuk reset password pengguna",
          "Akses laporan penuh, ekspor PDF/Excel, dan hapus dokumen unggahan",
        ],
      },
    ],
  },
  {
    actor: "Leader",
    roleKey: "leader",
    tier: "Pengawasan",
    icon: Crown,
    accent: "violet",
    summary: "Pengawas operasional yang memvalidasi proses inti serta memutuskan sanksi dan pemusnahan aset.",
    groups: [
      {
        module: "Inventaris Aset",
        icon: Boxes,
        level: "kelola",
        points: [
          "Pantau seluruh inventaris medis dan non-medis",
          "Tambah dan ubah data aset (tanpa hak hapus)",
        ],
      },
      {
        module: "Peminjaman & Pengembalian",
        icon: ArrowLeftRight,
        level: "kelola",
        points: [
          "Setujui atau tolak pengajuan peminjaman",
          "Validasi pengembalian dan koreksi data transaksi berjalan",
        ],
      },
      {
        module: "Penggunaan Aset",
        icon: Activity,
        level: "kelola",
        points: [
          "Catat dan selesaikan log penggunaan seluruh unit",
          "Beri izin penggunaan darurat pada alat overdue",
        ],
      },
      {
        module: "Pemeliharaan & Jadwal",
        icon: BadgeCheck,
        level: "kelola",
        points: [
          "Buat dan ubah jadwal pemeliharaan",
          "Validasi hasil kerja teknisi lalu tutup record pemeliharaan",
        ],
      },
      {
        module: "Sanksi & Pemusnahan",
        icon: ShieldAlert,
        level: "kelola",
        points: [
          "Selesaikan atau bebaskan sanksi keterlambatan",
          "Putuskan persetujuan pengajuan pemusnahan aset",
        ],
      },
      {
        module: "Pengguna & Laporan",
        icon: BarChart3,
        level: "kelola",
        points: [
          "Tambah dan ubah akun operasional non-admin",
          "Akses laporan penuh beserta ekspor PDF/Excel",
        ],
      },
    ],
    note: "Batas akses: tidak menghapus aset, jadwal pemeliharaan, akun admin, maupun dokumen unggahan.",
  },
  {
    actor: "Staff PJ",
    roleKey: "staff_pj",
    tier: "Penanggung Jawab Unit",
    icon: ClipboardList,
    accent: "indigo",
    summary: "Penanggung jawab unit yang memelihara data inventaris dan mengoordinasikan transaksi di wilayah kerjanya.",
    groups: [
      {
        module: "Inventaris Aset",
        icon: Boxes,
        level: "kelola",
        points: [
          "Tambah dan ubah aset sesuai cakupan unit: medis, non-medis, atau keduanya",
          "Rapikan penempatan aset pada ruangan dan sub ruangan",
        ],
      },
      {
        module: "Peminjaman & Pengembalian",
        icon: ArrowLeftRight,
        level: "ajukan",
        points: [
          "Ajukan peminjaman alat untuk kebutuhan unit",
          "Catat pengembalian beserta kondisi fisik alat",
        ],
      },
      {
        module: "Penggunaan Aset",
        icon: Activity,
        level: "kelola",
        points: [
          "Catat penggunaan aset di sub ruangan unitnya",
          "Selesaikan seluruh log penggunaan yang ada di unitnya",
          "Penggunaan darurat alat overdue jika role cocok dengan peminjam asal",
        ],
      },
      {
        module: "Pemeliharaan & Laporan",
        icon: Wrench,
        level: "ajukan",
        points: [
          "Buat permintaan pemeliharaan dan pantau progres tindak lanjut",
          "Pantau laporan operasional unit beserta ekspornya",
        ],
      },
    ],
    note: "Cakupan inventaris mengikuti staff access type yang ditetapkan admin. Tidak mengakses manajemen pengguna, sanksi, atau pemusnahan.",
  },
  {
    actor: "Staff Pelayanan",
    roleKey: "staff",
    tier: "Operasional Harian",
    icon: Stethoscope,
    accent: "sky",
    summary: "Pelaksana harian di ruang layanan yang memakai alat dan mengajukan kebutuhan pemeliharaan.",
    groups: [
      {
        module: "Inventaris Aset",
        icon: Boxes,
        level: "lihat",
        points: [
          "Lihat, cari, dan filter inventaris sesuai cakupan unit",
          "Buka detail aset untuk memastikan ketersediaan",
        ],
      },
      {
        module: "Peminjaman & Pengembalian",
        icon: ArrowLeftRight,
        level: "ajukan",
        points: [
          "Ajukan peminjaman alat dan pantau statusnya",
          "Catat pengembalian alat beserta catatan kondisi",
        ],
      },
      {
        module: "Penggunaan Aset",
        icon: Activity,
        level: "ajukan",
        points: [
          "Catat penggunaan aset di sub ruangan sendiri",
          "Selesaikan log penggunaan yang dicatatnya sendiri",
        ],
      },
      {
        module: "Pemeliharaan & Laporan",
        icon: BarChart3,
        level: "lihat",
        points: [
          "Buat permintaan pemeliharaan lalu pantau jadwalnya",
          "Baca laporan operasional sebagai bahan koordinasi",
        ],
      },
    ],
    note: "Penggunaan darurat alat overdue hanya berlaku bila role-nya sama dengan peminjam asal.",
  },
  {
    actor: "Teknisi",
    roleKey: "teknisi",
    tier: "Eksekusi Teknis",
    icon: Wrench,
    accent: "orange",
    summary: "Eksekutor lapangan yang mengerjakan perbaikan dan memperbarui status pemeliharaan aset.",
    groups: [
      {
        module: "Pemeliharaan",
        icon: Wrench,
        level: "kelola",
        points: [
          "Buka daftar pemeliharaan dan detail pekerjaan yang ditugaskan",
          "Isi catatan hasil perbaikan serta kondisi akhir alat",
          "Tandai pengecekan lanjutan atau batalkan pekerjaan",
        ],
      },
      {
        module: "Jadwal Kerja",
        icon: CalendarClock,
        level: "kelola",
        points: [
          "Lihat jadwal pemeliharaan yang menjadi tanggung jawabnya",
          "Ubah status jadwal: berjalan, selesai, atau dibatalkan",
        ],
      },
      {
        module: "Bukti & Laporan",
        icon: BarChart3,
        level: "lihat",
        points: [
          "Unggah dokumen bukti perbaikan pada modul unggahan",
          "Baca laporan pemeliharaan dan riwayat aktivitasnya sendiri",
        ],
      },
    ],
    note: "Tidak mengakses inventaris, peminjaman, manajemen pengguna, sanksi, maupun pemusnahan.",
  },
  {
    actor: "Pengguna",
    roleKey: "user",
    tier: "Self-Service",
    icon: UserRound,
    accent: "amber",
    summary: "Role mandiri untuk pinjam pakai alat tanpa kewenangan atas data master maupun keputusan operasional.",
    groups: [
      {
        module: "Inventaris Aset",
        icon: Boxes,
        level: "lihat",
        points: [
          "Lihat inventaris medis dan non-medis beserta detailnya",
          "Cari dan filter alat yang tersedia untuk dipinjam",
        ],
      },
      {
        module: "Peminjaman & Pengembalian",
        icon: ArrowLeftRight,
        level: "ajukan",
        points: [
          "Ajukan peminjaman dan pantau riwayat pengajuannya sendiri",
          "Catat pengembalian alat untuk diverifikasi petugas",
        ],
      },
      {
        module: "Penggunaan Aset",
        icon: Activity,
        level: "ajukan",
        points: [
          "Catat penggunaan aset di sub ruangan sendiri",
          "Selesaikan log penggunaan yang dicatatnya sendiri",
        ],
      },
      {
        module: "Laporan Ringkas",
        icon: Scale,
        level: "lihat",
        points: [
          "Baca ringkasan laporan dan hasil SPK prioritas aset",
          "Telusuri riwayat aktivitas miliknya sendiri",
        ],
      },
    ],
    note: "Tidak memiliki akses ke modul pemeliharaan, manajemen pengguna, sanksi, maupun pemusnahan aset.",
  },
]

const useCaseTotals = useCaseActors.reduce(
  (accumulator, actor) => {
    accumulator.modules += actor.groups.length
    accumulator.useCases += actor.groups.reduce((total, group) => total + group.points.length, 0)
    return accumulator
  },
  { modules: 0, useCases: 0 },
)

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
        <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/35 dark:bg-slate-900/60">
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
                <p className="text-xs text-white/90">Hak akses tiap role pengguna per modul sistem.</p>
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
                  <CardDescription>
                    {useCaseActors.length} aktor, {useCaseTotals.modules} kelompok modul, dan {useCaseTotals.useCases} use case yang disusun per role pengguna.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 panel-gutter">
              <UseCaseOverview />
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
                        ? "border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-300"
                        : column.key === "FK"
                          ? "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300"
                          : "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-400/30 dark:bg-gray-400/10 dark:text-gray-300"
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

function UseCaseOverview() {
  const inheritedActors = useCaseActors.filter((actor) => actor.roleKey !== "guest" && actor.roleKey !== "base actor")

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/50">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hierarki Aktor</p>
        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Pengguna Publik masuk lewat autentikasi, lalu menjadi Pengguna Terautentikasi. Enam role di bawah ini adalah spesialisasi
          yang mewarisi seluruh hak akses dasar tersebut.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {useCaseActors.slice(0, 2).map((actor, index) => (
          <div key={actor.roleKey} className="flex items-center gap-2">
            {index > 0 ? <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" /> : null}
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                useCaseAccentMeta[actor.accent].chip,
              )}
            >
              <actor.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {actor.actor}
            </span>
          </div>
        ))}
        <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-2">
          {inheritedActors.map((actor) => (
            <span
              key={actor.roleKey}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                useCaseAccentMeta[actor.accent].chip,
              )}
            >
              <actor.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {actor.actor}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200/70 pt-3 dark:border-slate-800/60">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Keterangan Tingkat Akses</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(useCaseLevelMeta) as UseCaseLevel[]).map((level) => (
            <span
              key={level}
              className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", useCaseLevelMeta[level].className)}
            >
              {useCaseLevelMeta[level].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function UseCaseActorCard({ actor, roleKey, tier, icon: ActorIcon, accent, summary, groups, note }: UseCaseActor) {
  const accentMeta = useCaseAccentMeta[accent]
  const totalUseCases = groups.reduce((total, group) => total + group.points.length, 0)

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md",
        accentMeta.card,
      )}
    >
      <header className="flex items-start gap-3 border-b border-white/60 p-4 dark:border-slate-800/60">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-md",
            accentMeta.icon,
          )}
        >
          <ActorIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{actor}</h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", accentMeta.chip)}>
              {tier}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {roleKey} · {groups.length} modul · {totalUseCases} use case
          </p>
          <p className="mt-2 text-[13px] leading-6 text-slate-600 dark:text-slate-300">{summary}</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 p-4">
        {groups.map((group) => (
          <div
            key={`${roleKey}-${group.module}`}
            className="rounded-xl border border-slate-200/70 bg-white/85 p-3 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <group.icon className={cn("h-4 w-4 shrink-0", accentMeta.module)} aria-hidden="true" />
                <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{group.module}</p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  useCaseLevelMeta[group.level].className,
                )}
              >
                {useCaseLevelMeta[group.level].label}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {group.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", accentMeta.bullet)} aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {note ? (
        <footer className="flex items-start gap-2 border-t border-dashed border-slate-300/70 px-4 py-3 text-[11px] leading-5 text-slate-600 dark:border-slate-700/60 dark:text-slate-300">
          <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>{note}</span>
        </footer>
      ) : null}
    </article>
  )
}
