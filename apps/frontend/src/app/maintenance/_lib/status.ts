import type { Maintenance } from "@/services/maintenance.service";
import { normalizeUserRole } from "@/utils/role";

export const MAINTENANCE_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: ["validated", "in_progress"],
  validated: [],
  cancelled: ["scheduled"],
}

export const canCancelMaintenance = (currentStatus: string, role?: string | null) => {
  const normalizedRole = normalizeUserRole(role)
  if (!["requested", "scheduled"].includes(currentStatus)) return false
  if (["admin", "leader"].includes(normalizedRole)) return true
  if (normalizedRole === "staff_pj") return ["requested", "scheduled"].includes(currentStatus)
  return normalizedRole === "teknisi" && currentStatus === "scheduled"
}

export const canOpenMaintenanceWorkflow = (status: Maintenance["status"], role?: string | null) => {
  const normalizedRole = normalizeUserRole(role)
  if (["validated", "cancelled"].includes(status)) return false
  if (status === "requested") return false
  if (status === "scheduled") return ["admin", "leader", "staff_pj", "teknisi"].includes(normalizedRole)
  return ["admin", "leader", "teknisi"].includes(normalizedRole)
}

export const maintenanceWorkflowActionLabel = (status: Maintenance["status"]) => {
  if (status === "requested") return "Tinjau Pengajuan"
  if (status === "scheduled") return "Atur Penugasan"
  if (status === "in_progress") return "Isi Laporan"
  if (status === "completed") return "Verifikasi Hasil"
  return "Buka Proses"
}

export const maintenanceSlaLabel = (status?: Maintenance["slaStatus"]) => {
  switch (status) {
    case "on_track":
      return "SLA Aman"
    case "at_risk":
      return "SLA Risiko"
    case "overdue":
      return "Lewat SLA"
    case "met":
      return "SLA Tercapai"
    case "met_late":
      return "SLA Tercapai Terlambat"
    default:
      return "-"
  }
}

export const maintenanceSlaBadgeClass = (status?: Maintenance["slaStatus"]) => {
  switch (status) {
    case "on_track":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    case "at_risk":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    case "overdue":
    case "met_late":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    case "met":
      return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300"
    default:
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700/35 dark:bg-slate-900/40 dark:text-slate-300"
  }
}
