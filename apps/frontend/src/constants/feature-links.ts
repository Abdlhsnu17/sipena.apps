import {
    Archive,
    BarChart3,
    Building,
    Calendar,
    ClipboardList,
    FileText,
    FileUp,
    HandHelping,
    LayoutDashboard,
    ListChecks,
    RotateCcw,
    Settings,
    Shield,
    Stethoscope,
    Trash2,
    Users,
} from "lucide-react";
import type { ComponentType } from "react";

export type FeatureLink = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  iconColor: string
}

const featureIconColor = "text-teal-600"

export const featureLinks: FeatureLink[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, iconColor: featureIconColor },
  { label: "Dokumentasi Sistem", href: "/uml", icon: FileText, iconColor: featureIconColor },
  { label: "Pengaturan", href: "/settings", icon: Settings, iconColor: featureIconColor },
  { label: "Inventaris Medis", href: "/medical-assets", icon: Stethoscope, iconColor: featureIconColor },
  { label: "Inventaris Non-Medis", href: "/non-medical-assets", icon: Building, iconColor: featureIconColor },
  { label: "Pemeliharaan Sarana", href: "/maintenance", icon: Calendar, iconColor: featureIconColor },
  { label: "SPK Prioritas Aset", href: "/dss", icon: ListChecks, iconColor: featureIconColor },
  { label: "Laporan & Analitik", href: "/reports", icon: BarChart3, iconColor: featureIconColor },
  { label: "Manajemen Pengguna", href: "/users", icon: Users, iconColor: featureIconColor },
  { label: "Manajemen Sanksi", href: "/sanctions", icon: Shield, iconColor: featureIconColor },
  { label: "Peminjaman", href: "/borrowing", icon: HandHelping, iconColor: featureIconColor },
  { label: "Pengembalian", href: "/returns", icon: RotateCcw, iconColor: featureIconColor },
  { label: "Penggunaan", href: "/asset-usage", icon: ClipboardList, iconColor: featureIconColor },
  { label: "Penghapusan Aset", href: "/disposal", icon: Trash2, iconColor: featureIconColor },
  { label: "Unggah Dokumen", href: "/unggahan", icon: FileUp, iconColor: featureIconColor },
  { label: "Arsip Riwayat Aktivitas", href: "/activity-archive", icon: Archive, iconColor: featureIconColor },
]
