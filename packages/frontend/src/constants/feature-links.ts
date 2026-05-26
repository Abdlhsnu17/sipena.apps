import {
    BarChart3,
    Building,
    Calendar,
    ClipboardList,
    FileText,
    FileUp,
    HandHelping,
    LayoutDashboard,
    RotateCcw,
    Settings,
    Stethoscope,
    Users,
} from "lucide-react";
import type { ComponentType } from "react";

export type FeatureLink = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  iconColor: string
}

export const featureLinks: FeatureLink[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, iconColor: "text-teal-700" },
  { label: "Dokumentasi UML & Unggahan", href: "/uml", icon: FileText, iconColor: "text-slate-500" },
  { label: "Edit Profil", href: "/settings", icon: Settings, iconColor: "text-orange-700" },
  { label: "Inventaris Medis", href: "/medical-assets", icon: Stethoscope, iconColor: "text-cyan-600" },
  { label: "Inventaris Non-Medis", href: "/non-medical-assets", icon: Building, iconColor: "text-teal-600" },
  { label: "Jadwal Pemeliharaan", href: "/maintenance", icon: Calendar, iconColor: "text-red-600" },
  { label: "Laporan", href: "/reports", icon: BarChart3, iconColor: "text-purple-600" },
  { label: "Manajemen Pengguna", href: "/users", icon: Users, iconColor: "text-amber-600" },
  { label: "Peminjaman", href: "/borrowing", icon: HandHelping, iconColor: "text-amber-600" },
  { label: "Pengembalian", href: "/returns", icon: RotateCcw, iconColor: "text-green-600" },
  { label: "Penggunaan", href: "/asset-usage", icon: ClipboardList, iconColor: "text-emerald-600" },
  { label: "Unggahan", href: "/unggahan", icon: FileUp, iconColor: "text-sky-700" },
]
