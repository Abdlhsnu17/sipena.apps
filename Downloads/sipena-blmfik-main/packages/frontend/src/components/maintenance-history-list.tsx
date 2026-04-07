"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import apiService from "@/services/api.service";
import { getUsers } from "@/services/auth-utils";
import maintenanceService, { type Maintenance } from "@/services/maintenance.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { cn } from "@/utils";
import { assetSourceLabel, deriveAssetSource, maintenanceStatusLabel } from "@/utils/api-mappers";
import { ExportFormat, exportMaintenanceHistory, type MaintenanceHistoryExportEntry } from "@/utils/export-table";
import { formatBracketedDateTime, formatCostLabel, formatDayTimeLabel } from "@/utils/format";
import { formatNoId } from "@/utils/record-id";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { ChevronDown, ChevronUp, Download, Pencil, Search, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

interface MaintenanceHistory {
  id: number;
  maintenanceId: number;
  maintenanceCode?: string;
  assetId: number;
  assetCode?: string;
  assetType?: string;
  assetName?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  type: string;
  status: string;
  scheduledDate: string;
  startedDate?: string;
  completedDate?: string;
  description: string;
  technician?: string;
  cost?: number;
  notes?: string;
  createdBy: number;
  validatedBy?: number;
  validatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  requesterName?: string;
  requesterNip?: string;
  validatorName?: string;
  validatorNip?: string;
}

interface ValidatorInfo {
  name?: string;
  nip?: string;
}

interface Props {
  user: User;
  assets?: DetailInventoryItem[];
  maintenance?: Maintenance[];
  onRefresh?: () => void | Promise<void>;
  disableWrapper?: boolean;
  wrapperClassName?: string;
}

type InfoRowProps = {
  label: string;
  children: React.ReactNode;
};

const SectionHeader = ({ label }: { label: string }) => (
  <div className="rounded-2xl bg-blue-600 px-4 py-2 text-[14px] font-semibold text-white">
    {label}
  </div>
);

const InfoRow = ({ label, children }: InfoRowProps) => (
  <div className="grid grid-cols-1 gap-1 border-b border-blue-200/60 px-4 py-3 text-[14px] last:border-b-0 sm:grid-cols-[160px_1fr] sm:items-center sm:gap-3">
    <span className="text-[13px] font-medium text-blue-900 sm:text-[14px]">
      {label}
    </span>
    <span className="text-[14px] font-normal text-foreground leading-snug">{children}</span>
  </div>
);

type HistoryExportColumn = {
  key: string;
  label: string;
  getValue: (history: MaintenanceHistory) => string;
  defaultSelected?: boolean;
};

const MaintenanceHistoryList: React.FC<Props> = ({ user, assets, maintenance, onRefresh, disableWrapper, wrapperClassName }) => {
  const [histories, setHistories] = useState<MaintenanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [completeForm, setCompleteForm] = useState({
    notes: '',
    status: 'completed',
    completedDate: '',
    technician: '',
    cost: ''
  });
  const [userLookup, setUserLookup] = useState<Record<string, User>>({});

  useEffect(() => {
    const users = getUsers();
    const lookup: Record<string, User> = {};
    users.forEach((u) => {
      lookup[u.id] = u;
    });
    setUserLookup(lookup);
  }, []);
  const canComplete = user.role === "leader" || user.role === "admin";
  const canValidate = user.role === "leader" || user.role === "admin";

  const getValidatorLabel = (history: MaintenanceHistory): ValidatorInfo | null => {
    const explicitName = history.validatorName?.trim();
    const explicitNip = history.validatorNip?.trim();
    if (explicitName || explicitNip) {
      return {
        name: explicitName || undefined,
        nip: explicitNip || undefined,
      };
    }
    if (!history.validatedBy) return null;
    const validator = userLookup[String(history.validatedBy)];
    if (!validator) return null;
    const fallbackName = validator.name?.trim();
    const fallbackNip = validator.nip?.trim();
    if (!fallbackName && !fallbackNip) return null;
    return {
      name: fallbackName || undefined,
      nip: fallbackNip || undefined,
    };
  };

  const handleComplete = async (id: number) => {
    try {
      if (maintenance) {
        const res = await maintenanceService.complete(
          id,
          completeForm.notes || undefined,
          completeForm.cost ? Number(completeForm.cost) : undefined,
          Number(user.id)
        );
        if (!res.success) throw new Error(res.message || "Gagal menyelesaikan pemeliharaan");
        await onRefresh?.();
      } else {
        await apiService.patch(`/maintenance-history/${id}/complete`, {
          ...completeForm,
          completedDate: completeForm.completedDate ? new Date(completeForm.completedDate).toISOString() : undefined,
          cost: completeForm.cost ? Number(completeForm.cost) : undefined,
        });
      }
      setEditId(null);
      setCompleteForm({ notes: '', status: 'completed', completedDate: '', technician: '', cost: '' });
      setError(null);
      if (!maintenance) fetchHistories();
    } catch (err: any) {
      setError(err?.message || 'Gagal memperbarui status');
    }
  };

  const openEdit = (h: MaintenanceHistory) => {
    setEditId(h.id);
    setCompleteForm({
      notes: h.notes || '',
      status: 'completed',
      completedDate: h.completedDate ? h.completedDate.substring(0, 16) : '',
      technician: h.technician || '',
      cost: h.cost ? String(h.cost) : ''
    });
  };

  const fetchHistories = async () => {
    setLoading(true);
    try {
      const res = await apiService.get<MaintenanceHistory[]>('/maintenance-history');
      setHistories(Array.isArray(res) ? res : []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat riwayat pemeliharaan');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (id: number) => {
    try {
      if (maintenance) {
        const res = await maintenanceService.complete(id, completeForm.notes || undefined, completeForm.cost ? Number(completeForm.cost) : undefined, Number(user.id));
        if (!res.success) throw new Error(res.message || "Gagal menyelesaikan pemeliharaan");
        await onRefresh?.();
      } else {
        await apiService.patch(`/maintenance-history/${id}/validate`, {
          validatedBy: Number(user.id),
          validatedAt: new Date().toISOString(),
        });
      }
      setError(null);
      if (!maintenance) fetchHistories();
    } catch (err: any) {
      setError(err?.message || 'Gagal memvalidasi riwayat');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      if (maintenance) {
        const res = await maintenanceService.delete(String(id));
        if (!res.success) throw new Error(res.message || "Gagal menghapus jadwal");
        await onRefresh?.();
      } else {
        await apiService.delete(`/maintenance-history/${id}`);
      }
      setError(null);
      if (!maintenance) fetchHistories();
    } catch (err: any) {
      setError(err?.message || 'Gagal menghapus riwayat');
    }
  };

  useEffect(() => {
    if (maintenance) {
      const mapped = maintenance.map((m) => ({
        id: m.id,
        maintenanceId: m.id,
        maintenanceCode: m.maintenanceCode,
        assetId: m.assetId,
        assetCode: m.assetCode,
        assetType: m.assetType,
        assetDetailId: m.assetDetailId,
        assetDetailName: m.assetDetailName,
        assetDetailCode: m.assetDetailCode,
        assetLocation: m.assetLocation,
        type: m.type,
        status: m.status,
        scheduledDate: m.scheduledDate,
        startedDate: m.createdAt,
        completedDate: m.completedDate,
        description: m.description,
        technician: m.technician,
        cost: m.cost,
        notes: m.notes,
        createdBy: m.createdBy,
        validatedBy: m.completedBy,
        validatedAt: m.completedDate,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        requesterName: m.requesterName,
        requesterNip: m.requesterNip,
        validatorName: m.validatorName,
        validatorNip: m.validatorNip,
      }));
      setHistories(mapped);
      setLoading(false);
    } else {
      fetchHistories();
    }
  }, [maintenance]);

  const findDetailInfo = (history: MaintenanceHistory) => {
    if (!assets?.length) return undefined;
    if (history.assetDetailId) {
      const match = assets.find((asset) => asset.detailId === history.assetDetailId);
      if (match) return match;
    }
    if (history.assetDetailCode) {
      const match = assets.find((asset) => asset.assetId === history.assetId && asset.detailCode === history.assetDetailCode);
      if (match) return match;
    }
    if (history.assetDetailName) {
      const match = assets.find((asset) => asset.assetId === history.assetId && asset.detailName === history.assetDetailName);
      if (match) return match;
    }
    return assets.find((asset) => asset.assetId === history.assetId);
  };

  const getHistoryNoId = (history: MaintenanceHistory) =>
    formatNoId("PMH", history.maintenanceId || history.id, history.maintenanceCode);

  const historyExportColumnDefinitions = useMemo<HistoryExportColumn[]>(
    () => [
      {
        key: "jenisInventaris",
        label: "Jenis Inventaris",
        getValue: (history) => {
          const detail = findDetailInfo(history);
          const source = deriveAssetSource(
            detail?.assetType || history.assetType,
            detail?.detailCode || history.assetDetailCode || history.assetCode
          );
          return assetSourceLabel(source);
        },
        defaultSelected: true,
      },
      {
        key: "alat",
        label: "Alat",
        getValue: (history) =>
          findDetailInfo(history)?.detailName ||
          findDetailInfo(history)?.assetName ||
          history.assetDetailName ||
          history.assetName ||
          "-",
        defaultSelected: true,
      },
      {
        key: "kode",
        label: "Kode",
        getValue: (history) =>
          history.assetDetailCode ||
          findDetailInfo(history)?.detailCode ||
          history.assetDetailCode ||
          history.assetCode ||
          "-",
        defaultSelected: true,
      },
      {
        key: "merek",
        label: "Merek/Model",
        getValue: (history) =>
          findDetailInfo(history)?.detailBrandModel ||
          findDetailInfo(history)?.detailName ||
          "-",
        defaultSelected: true,
      },
      {
        key: "ruanganAlat",
        label: "Nama Ruangan Alat",
        getValue: (history) => {
          const detail = findDetailInfo(history);
          return detail?.roomName || detail?.assetLocation || history.assetLocation || "-";
        },
        defaultSelected: true,
      },
      {
        key: "status",
        label: "Status",
        getValue: (history) => maintenanceStatusLabel(history.status),
        defaultSelected: true,
      },
      {
        key: "peminjam",
        label: "Nama Pengirim",
        getValue: (history) => history.requesterName || "-",
        defaultSelected: true,
      },
      {
        key: "nipPeminjam",
        label: "NIP Pengirim",
        getValue: (history) => history.requesterNip || "-",
        defaultSelected: true,
      },
      {
        key: "jadwal",
        label: "Jadwal Pemeliharaan",
        getValue: (history) => formatDayTimeLabel(history.scheduledDate, { showWeekday: false }),
      },
      {
        key: "selesai",
        label: "Waktu Selesai",
        getValue: (history) => formatBracketedDateTime(history.completedDate) || "-",
      },
      {
        key: "teknisi",
        label: "Teknisi",
        getValue: (history) => history.technician || "-",
      },
      {
        key: "biaya",
        label: "Biaya",
        getValue: (history) => (history.cost ? formatCostLabel(history.cost) : "-"),
      },
      {
        key: "catatanPendaftaran",
        label: "Catatan Pendaftaran",
        getValue: (history) => {
          const text = history.description?.trim()
          return text || "-"
        },
        defaultSelected: true,
      },
      {
        key: "catatan",
        label: "Catatan After",
        getValue: (history) => history.notes || "-",
      },
      {
        key: "validasi",
        label: "Validasi",
        getValue: (history) => {
          if (history.validatedAt) {
            const label = getValidatorLabel(history);
            const labelText = label
              ? `${label.name || ""} ${label.nip || ""}`.trim()
              : "Validator tidak tersedia";
            return `${labelText}${labelText && history.validatedAt ? ` • ${formatBracketedDateTime(history.validatedAt)}` : ""}`;
          }
          return "Menunggu validasi";
        },
      },
    ],
    [findDetailInfo]
  );

  const [selectedHistoryColumns, setSelectedHistoryColumns] = useState<string[]>(() =>
    historyExportColumnDefinitions.filter((column) => column.defaultSelected ?? true).map((column) => column.key)
  );
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(() => new Set());
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<number>>(() => new Set());
  const [historySearchTerm, setHistorySearchTerm] = useState("");

  const filteredHistories = histories.filter((history) => {
    const detail = findDetailInfo(history);
    return matchesSearchKeyword(historySearchTerm, [
      getHistoryNoId(history),
      history.maintenanceCode,
      history.assetDetailName,
      history.assetName,
      history.assetDetailCode,
      history.assetLocation,
      history.assetCode,
      detail?.detailName,
      detail?.detailInventoryName,
      detail?.detailCode,
      detail?.roomName,
      detail?.assetLocation,
      history.requesterName,
      history.requesterNip,
      history.technician,
      history.notes,
      history.description,
    ]);
  });

  const historiesToExport =
    selectedHistoryIds.size > 0
      ? filteredHistories.filter((history) => selectedHistoryIds.has(history.id))
      : filteredHistories;

  const buildHistoryExportEntry = (history: MaintenanceHistory, columnSet: Set<string>): MaintenanceHistoryExportEntry => {
    const detail = findDetailInfo(history);
    const assetTypeSource = deriveAssetSource(
      detail?.assetType || history.assetType,
      detail?.detailCode || history.assetDetailCode || history.assetCode
    );
    const inventoryType = columnSet.has("jenisInventaris")
      ? assetSourceLabel(assetTypeSource)
      : undefined;
    const assetName =
      columnSet.has("alat")
        ? detail?.detailName ||
          detail?.assetName ||
          history.assetDetailName ||
          history.assetName ||
          "-"
        : undefined;
    const assetCode =
      columnSet.has("kode")
        ? detail?.detailCode || history.assetDetailCode || history.assetCode || "-"
        : undefined;
    const brandModel =
      columnSet.has("merek")
        ? detail?.detailBrandModel ||
          detail?.detailName ||
          detail?.assetName ||
          "-"
        : undefined;
    const assetRoom =
      columnSet.has("ruanganAlat")
        ? detail?.roomName || detail?.assetLocation || history.assetLocation || "-"
        : undefined;
    const status =
      columnSet.has("status") ? maintenanceStatusLabel(history.status) : undefined;
    const requesterName = columnSet.has("peminjam") ? history.requesterName || "-" : undefined;
    const requesterNip = columnSet.has("nipPeminjam") ? history.requesterNip || "-" : undefined;
    const scheduledDate = columnSet.has("jadwal")
      ? formatDayTimeLabel(history.scheduledDate, { showWeekday: false })
      : undefined;
    const technician = columnSet.has("teknisi") ? history.technician || "-" : undefined;
    const completionDate = columnSet.has("selesai")
      ? formatDayTimeLabel(history.completedDate, { showWeekday: false })
      : undefined;
    const cost = columnSet.has("biaya")
      ? history.cost
        ? formatCostLabel(history.cost)
        : "-"
      : undefined;
    const notes = columnSet.has("catatan")
      ? history.notes?.trim() || "Tidak ada catatan"
      : undefined;
    const registrationNotes = columnSet.has("catatanPendaftaran")
      ? history.description?.trim() || "Tidak ada catatan"
      : undefined;
    const validatorInfo = getValidatorLabel(history);
    const validator =
      columnSet.has("validasi")
        ? history.validatedAt
          ? (() => {
              const name = validatorInfo?.name?.trim();
              const nip = validatorInfo?.nip?.trim();
              if (name && nip) return `${name} (NIP: ${nip})`;
              if (name) return name;
              if (nip) return `NIP: ${nip}`;
              return "Data validator tidak tersedia";
            })()
          : "Menunggu validasi"
        : undefined;
    const validationDate =
      columnSet.has("validasi") && history.validatedAt
        ? formatDayTimeLabel(history.validatedAt, { showWeekday: false })
        : undefined;
    const validatorName = validatorInfo?.name?.trim();
    const validatorNip = validatorInfo?.nip?.trim();

    return {
      inventoryType,
      assetName,
      assetCode,
      brandModel,
      assetRoom,
      requesterName,
      requesterNip,
      scheduledDate,
      technician,
      completionDate,
      cost,
      notes,
      registrationNotes,
      status,
      validator,
      validationDate,
      validatorName,
      validatorNip,
    };
  };

  const toggleHistoryColumn = (columnKey: string) => {
    setSelectedHistoryColumns((previous) => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous;
        return previous.filter((item) => item !== columnKey);
      }
      return [...previous, columnKey];
    });
  };

  const historyAllSelected =
    filteredHistories.length > 0 && filteredHistories.every((history) => selectedHistoryIds.has(history.id));
  const selectedVisibleHistoryCount = filteredHistories.filter((history) =>
    selectedHistoryIds.has(history.id)
  ).length;

  const handleHistorySelectAll = () => {
    if (historyAllSelected) {
      setSelectedHistoryIds(new Set());
      return;
    }
    setSelectedHistoryIds(new Set(filteredHistories.map((history) => history.id)));
  };

  const toggleHistorySummary = (id: number) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleHistoryExport = (format: ExportFormat) => {
    const columnSet = new Set(selectedHistoryColumns);
    const entries = historiesToExport.map((history) => buildHistoryExportEntry(history, columnSet));
    void exportMaintenanceHistory(format, {
      title: "Riwayat Tindak Lanjut Pemeliharaan",
      entries,
      filePrefix: "riwayat-tindak-lanjut",
    });
  };

  const exportSingleHistory = (format: ExportFormat, history: MaintenanceHistory) => {
    const columnSet = new Set(selectedHistoryColumns);
    const entry = buildHistoryExportEntry(history, columnSet);
    void exportMaintenanceHistory(format, {
      title: "Riwayat Tindak Lanjut Pemeliharaan",
      entries: [entry],
      filePrefix: `riwayat-tindak-lanjut-${history.id}`,
    });
  };

  if (loading) return <div>Memuat riwayat...</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "destructive" as const;
      case "in_progress":
        return "secondary" as const;
      case "completed":
      case "validated":
        return "default" as const;
      case "cancelled":
        return "secondary" as const;
      default:
        return "default" as const;
    }
  };

  const tableContent = (
    <>
      <div className="space-y-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-2xl px-3">
                  <Download className="mr-2 h-4 w-4" />
                  Ekspor
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                <DropdownMenuLabel>Pilih kolom</DropdownMenuLabel>
                <div className="max-h-44 overflow-y-auto">
                  {historyExportColumnDefinitions.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.key}
                      checked={selectedHistoryColumns.includes(column.key)}
                      onCheckedChange={() => toggleHistoryColumn(column.key)}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Ekspor daftar</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleHistoryExport("pdf")}>
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleHistoryExport("word")}>
                  Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleHistoryExport("excel")}>
                  Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-2xl px-3 text-[14px] font-semibold"
              onClick={handleHistorySelectAll}
            >
              {historyAllSelected ? "Batal pilih semua" : "Pilih semua"}
            </Button>
            <span className="text-[13px] text-muted-foreground">
              {selectedVisibleHistoryCount
                ? `${selectedVisibleHistoryCount} baris dipilih`
                : `Semua ${filteredHistories.length} baris siap cetak`}
            </span>
          </div>
        </div>
        <div>
          <label className="sr-only">Cari riwayat tindakan pemeliharaan</label>
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={historySearchTerm}
              onChange={(event) => setHistorySearchTerm(event.target.value)}
              placeholder="Cari No ID, nama alat, kode, pengirim, atau teknisi..."
              className="w-full rounded-2xl border border-border/80 bg-background px-11 py-2 text-[14px] text-foreground transition focus:border-teal-500"
            />
          </div>
        </div>
      </div>
      {filteredHistories.length === 0 ? (
        <div className="py-10 px-6 text-center text-[13px] text-muted-foreground">
          {historySearchTerm.trim()
            ? "Tidak ada riwayat yang cocok dengan pencarian."
            : "Belum ada riwayat pemeliharaan"}
        </div>
      ) : (
        <div className="max-h-180 overflow-y-auto px-4 pb-6 pr-2">
          <div className="space-y-6 py-4">
            {filteredHistories.map((h) => {
            const detailInfo = findDetailInfo(h);
            const historyNoId = getHistoryNoId(h);
            const inventoryBadgeLabel = assetSourceLabel(
              deriveAssetSource(
                detailInfo?.assetType || h.assetType,
                detailInfo?.detailCode || h.assetDetailCode || h.assetCode
              )
            );
            const brandModel =
              detailInfo?.detailBrandModel ||
              detailInfo?.detailName ||
              detailInfo?.assetName ||
              "-";
            const assetName =
              detailInfo?.detailName ||
              detailInfo?.assetName ||
              h.assetDetailName ||
              h.assetName ||
              "-";
            const assetCode =
              h.assetDetailCode ||
              detailInfo?.detailCode ||
              h.assetCode ||
              "-";
            const assetRoom = detailInfo?.roomName || detailInfo?.assetLocation || h.assetLocation || "-";
            const completionDateLabel = formatDayTimeLabel(h.completedDate, { showWeekday: false });
            const validationDateLabel = formatDayTimeLabel(h.validatedAt, { showWeekday: false });
            const registrationNotes = h.description?.trim() || "Tidak ada catatan";
            const afterNotes = h.notes?.trim() || "Tidak ada catatan";
            const validatorLabel = getValidatorLabel(h)
            const validatorName = validatorLabel?.name || "-";
            const validatorNip = validatorLabel?.nip || "-";
            const scheduledLabel = formatDayTimeLabel(h.scheduledDate, { showWeekday: true });
            const isExpanded = expandedHistoryIds.has(h.id);
            return (
              <div
                key={h.id}
                className="overflow-hidden rounded-4xl border border-blue-100/80 bg-linear-to-b from-white via-white to-slate-50 shadow-xl shadow-blue-100"
              >
                <div className="flex items-center justify-between gap-3 rounded-t-4xl bg-linear-to-r from-blue-600 to-sky-800 px-6 py-3 text-[14px] font-semibold text-white">
                  <span>Informasi Dasar Alat</span>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-white hover:bg-blue-500/60"
                      onClick={() => toggleHistorySummary(h.id)}
                      aria-label={isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-5 bg-white/80 px-6 py-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[14px] font-normal text-slate-900 truncate">{assetName}</p>
                      <p className="text-[13px] text-muted-foreground">{assetCode}</p>
                      <p className="text-[13px] text-muted-foreground">No ID: {historyNoId}</p>
                      <p className="text-[13px] text-muted-foreground">
                        Identitas: {h.requesterName || "-"} / {h.requesterNip || "-"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[12px]">
                          {inventoryBadgeLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[12px]">
                          {assetRoom}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 sm:items-end">
                      <span className="text-[13px] text-muted-foreground">Jadwal Pemeliharaan</span>
                      <span className="text-[14px] font-normal text-foreground">{scheduledLabel}</span>
                      <div>
                        <Badge variant={getStatusColor(h.status)} className="text-[14px]">
                          {maintenanceStatusLabel(h.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <SectionHeader label="Informasi Dasar Alat" />
                          <div className="rounded-[28px] border border-blue-100 bg-blue-50/80">
                            <InfoRow label="Jenis Inventaris" >{inventoryBadgeLabel}</InfoRow>
                            <InfoRow label="No ID Jadwal" >{historyNoId}</InfoRow>
                            <InfoRow label="Nama Alat" >{assetName}</InfoRow>
                            <InfoRow label="Kode Alat" >{assetCode}</InfoRow>
                            <InfoRow label="Nama Ruangan Alat" >{assetRoom}</InfoRow>
                            <InfoRow label="Merek / Model" >{brandModel}</InfoRow>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <SectionHeader label="Detail Administrasi" />
                          <div className="rounded-[28px] border border-blue-100 bg-blue-50/80">
                            <InfoRow label="Nama Pengirim">{h.requesterName || "-"}</InfoRow>
                            <InfoRow label="NIP Pengirim">{h.requesterNip || "-"}</InfoRow>
                            <InfoRow label="Jadwal Pemeliharaan">{scheduledLabel}</InfoRow>
                            <InfoRow label="Catatan Pendaftaran">{registrationNotes}</InfoRow>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <SectionHeader label="Pelaksanaan & Biaya" />
                          <div className="rounded-[28px] border border-blue-100 bg-blue-50/80">
                            <InfoRow label="Teknisi Pelaksana">{h.technician || "-"}</InfoRow>
                            <InfoRow label="Waktu Selesai">{completionDateLabel}</InfoRow>
                            <InfoRow label="Biaya Pemeliharaan">{h.cost ? formatCostLabel(h.cost) : "-"}</InfoRow>
                            <InfoRow label="Catatan (After)">{afterNotes}</InfoRow>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <SectionHeader label="Validasi" />
                          <div className="rounded-[28px] border border-blue-100 bg-blue-50/80">
                            <InfoRow label="Validator">{validatorName}</InfoRow>
                            <InfoRow label="NIP Validator">{validatorNip}</InfoRow>
                            <InfoRow label="Waktu Validasi">{validationDateLabel}</InfoRow>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900">
                      Tekan panah untuk membuka detail pemeliharaan.
                    </div>
                  )}
                  <div className="flex flex-col gap-3 border-t border-blue-100 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {canComplete && h.status !== 'completed' && h.status !== 'validated' && editId !== h.id && (
                        <button className="text-teal-700 text-[14px]" onClick={() => openEdit(h)}>
                          Selesaikan
                        </button>
                      )}
                      {canValidate && h.status === 'completed' && !h.validatedBy && (
                        <button className="text-teal-700 text-[14px]" onClick={() => handleValidate(h.id)}>
                          Validasi
                        </button>
                      )}
                      {canComplete && ['completed', 'validated'].includes(h.status) && editId !== h.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => openEdit(h)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {canValidate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(h.id)}
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Download className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => exportSingleHistory("pdf", h)}>
                            PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportSingleHistory("word", h)}>
                            Word
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportSingleHistory("excel", h)}>
                            Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {canComplete && editId === h.id && (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Catatan"
                          value={completeForm.notes}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))}
                          className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-[14px]"
                        />
                        <input
                          type="datetime-local"
                          value={completeForm.completedDate}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, completedDate: e.target.value }))}
                          className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-[14px]"
                        />
                        <input
                          type="text"
                          placeholder="Teknisi"
                          value={completeForm.technician}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, technician: e.target.value }))}
                          className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-[14px]"
                        />
                        <input
                          type="number"
                          placeholder="Biaya"
                          value={completeForm.cost}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, cost: e.target.value }))}
                          className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-[14px]"
                        />
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-2 bg-teal-600 text-white rounded-lg text-[14px]"
                            onClick={() => handleComplete(h.id)}
                          >
                            Simpan
                          </button>
                          <button
                            className="px-3 py-2 text-red-600 border border-red-200 rounded-lg text-[14px]"
                            onClick={() => setEditId(null)}
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}
    </>
  );

  const wrapperClasses = cn(
    "rounded-2xl border border-border bg-background shadow-sm",
    wrapperClassName
  );

  if (disableWrapper) {
    return (
      <div className="space-y-2" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>
        {error && <div className="text-[14px] text-red-600">{error}</div>}
        {tableContent}
      </div>
    );
  }

  return (
    <div className="space-y-2" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>
      {error && <div className="text-[14px] text-red-600">{error}</div>}
      <div className={wrapperClasses}>
        {tableContent}
      </div>
    </div>
  );
};

export default MaintenanceHistoryList;
