import type { AssetUsageContext } from "@/services/asset-usage.service";

export const usageContextLabels: Record<AssetUsageContext, string> = {
  own_room: "Ruangan",
  same_unit_cross_room: "Antar Sub Ruangan",
  cross_room: "Antar Instalasi",
  emergency: "Emergency",
  procedure: "Antar Sub Ruangan",
  rounding: "Antar Instalasi",
  other: "Lainnya",
};

export const usageContextOptions: Array<{ value: AssetUsageContext; label: string }> = [
  { value: "own_room", label: "Ruangan sendiri" },
  { value: "same_unit_cross_room", label: "Antar sub ruangan" },
  { value: "cross_room", label: "Antar instalasi" },
  { value: "emergency", label: "Emergency" },
  { value: "procedure", label: "Tindakan/prosedur" },
  { value: "rounding", label: "Rounding" },
  { value: "other", label: "Lainnya" },
];

export const HISTORY_ROWS_PER_PAGE = 2;
export const usageExportColumnDefinitions = [
  { key: "basic", label: "Data Alat Digunakan" },
  { key: "usage", label: "Data Pemakaian" },
  { key: "operator", label: "Operator Pemakaian" },
  { key: "notes", label: "Catatan Pemakaian" },
  { key: "status", label: "Status Pemakaian" },
] as const;

export type UsageExportColumnKey = (typeof usageExportColumnDefinitions)[number]["key"];
export type UsageSourceFilter = "all" | "manual" | "borrowing_sync";

export const usageSourceFilterOptions: Array<{ value: UsageSourceFilter; label: string }> = [
  { value: "manual", label: "Input Manual" },
  { value: "borrowing_sync", label: "Dari Peminjaman" },
  { value: "all", label: "Semua" },
];
