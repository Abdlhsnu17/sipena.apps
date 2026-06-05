import {
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

const featureIconColor = "text-teal-600"

export const featureLinks: FeatureLink[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, iconColor: featureIconColor },
  { label: "Dokumentasi UML", href: "/uml", icon: FileText, iconColor: featureIconColor },
  { label: "Edit Profil", href: "/settings", icon: Settings, iconColor: featureIconColor },
  { label: "Inventaris Medis", href: "/medical-assets", icon: Stethoscope, iconColor: featureIconColor },
  { label: "Inventaris Non-Medis", href: "/non-medical-assets", icon: Building, iconColor: featureIconColor },
  { label: "Jadwal Pemeliharaan", href: "/maintenance", icon: Calendar, iconColor: featureIconColor },
  { label: "SPK Prioritas Aset", href: "/dss", icon: ListChecks, iconColor: featureIconColor },
  { label: "Laporan & Analitik", href: "/reports", icon: BarChart3, iconColor: featureIconColor },
  { label: "Manajemen Pengguna", href: "/users", icon: Users, iconColor: featureIconColor },
  { label: "Peminjaman", href: "/borrowing", icon: HandHelping, iconColor: featureIconColor },
  { label: "Pengembalian", href: "/returns", icon: RotateCcw, iconColor: featureIconColor },
  { label: "Penggunaan", href: "/asset-usage", icon: ClipboardList, iconColor: featureIconColor },
  { label: "Unggahan", href: "/unggahan", icon: FileUp, iconColor: featureIconColor },
]
