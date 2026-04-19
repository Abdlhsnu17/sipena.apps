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
import { assetSourceLabel, deriveAssetSource, maintenanceStatusLabel, type AssetSourceKey } from "@/utils/api-mappers";
import { ExportFormat, exportMaintenanceHistory, type MaintenanceHistoryExportEntry } from "@/utils/export-table";
import { formatCostLabel, formatDayTimeLabel } from "@/utils/format";
import { formatNoId } from "@/utils/record-id";
import { canManageMaintenanceStatusRole } from "@/utils/role";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { ChevronDown, ChevronUp, Download, Pencil, Search, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

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
  cancellationReason?: string;
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

type HistoryValidationSnapshot = Pick<
  MaintenanceHistory,
  "id" | "maintenanceId" | "status" | "validatedBy" | "validatedAt" | "validatorName" | "validatorNip"
>;

interface Props {
  user: User | null;
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
  <div className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
    {label}
  </div>
);

const InfoRow = ({ label, children }: InfoRowProps) => (
  <div className="detail-labeled-row border-b border-slate-200 last:border-b-0">
    <span className="font-medium text-slate-600">
      {label}
    </span>
    <span className="font-medium text-slate-900 leading-snug">{children}</span>
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
  const [historyValidationMap, setHistoryValidationMap] = useState<Record<number, HistoryValidationSnapshot>>({});
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

  // Early return if user is null
  if (!user) {
    return <div>Loading user data...</div>;
  }

  // Type assertion: user is guaranteed to be non-null here
  const safeUser = user;

  const canComplete = canManageMaintenanceStatusRole(safeUser.role);
  const canValidate = canManageMaintenanceStatusRole(safeUser.role);

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
          Number(safeUser.id)
        );
        if (!res.success) throw new Error(res.message || "Gagal menyelesaikan pemeliharaan");
        await onRefresh?.();
        await fetchHistorySnapshots();
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

  const fetchHistories = useCallback(async () => {
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
  }, []);

  const fetchHistorySnapshots = useCallback(async () => {
    try {
      const res = await apiService.get<MaintenanceHistory[]>('/maintenance-history');
      const nextMap = Array.isArray(res)
        ? res.reduce<Record<number, HistoryValidationSnapshot>>((acc, history) => {
            if (history.maintenanceId) {
              acc[history.maintenanceId] = {
                id: history.id,
                maintenanceId: history.maintenanceId,
                status: history.status,
                validatedBy: history.validatedBy,
                validatedAt: history.validatedAt,
                validatorName: history.validatorName,
                validatorNip: history.validatorNip,
              };
            }
            return acc;
          }, {})
        : {};
      setHistoryValidationMap(nextMap);
    } catch (snapshotError) {
      console.error("Gagal memuat snapshot validasi pemeliharaan:", snapshotError);
    }
  }, []);

  const handleValidate = async (id: number) => {
    try {
      if (maintenance) {
        const res = await maintenanceService.update(id, { status: "validated" });
        if (!res.success) throw new Error(res.message || "Gagal memvalidasi pemeliharaan");
        await onRefresh?.();
        await fetchHistorySnapshots();
      } else {
        await apiService.patch(`/maintenance-history/${id}/validate`, {
          validatedBy: Number(safeUser.id),
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
      setLoading(true);
      void fetchHistorySnapshots();
      return;
    }

    void fetchHistories();
  }, [fetchHistories, fetchHistorySnapshots, maintenance]);

  useEffect(() => {
    if (!maintenance) {
      return;
    }

    const mapped = maintenance.map((m) => {
      const validation = historyValidationMap[m.id];
      return {
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
        status: validation?.status === "validated" ? "validated" : m.status,
        scheduledDate: m.scheduledDate,
        startedDate: m.createdAt,
        completedDate: m.completedDate,
        description: m.description,
        technician: m.technician,
        cost: m.cost,
        notes: m.notes,
        cancellationReason: m.cancellationReason,
        createdBy: m.createdBy,
        validatedBy: validation?.validatedBy,
        validatedAt: validation?.validatedAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        requesterName: m.requesterName,
        requesterNip: m.requesterNip,
        validatorName: validation?.validatorName,
        validatorNip: validation?.validatorNip,
      };
    });

    setHistories(mapped);
    setLoading(false);
  }, [historyValidationMap, maintenance]);

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
        key: "noId",
        label: "No ID",
        getValue: (history) => getHistoryNoId(history),
        defaultSelected: true,
      },
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
        key: "namaAlat",
        label: "Nama Alat",
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
          history.assetCode ||
          "-",
        defaultSelected: true,
      },
      {
        key: "peminjam",
        label: "Peminjam",
        getValue: (history) => history.requesterName || "-",
        defaultSelected: true,
      },
      {
        key: "nip",
        label: "NIP",
        getValue: (history) => history.requesterNip || "-",
        defaultSelected: true,
      },
      {
        key: "tanggalPinjam",
        label: "Tanggal Pinjam",
        getValue: (history) => formatDayTimeLabel(history.scheduledDate, { showWeekday: false }),
        defaultSelected: true,
      },
      {
        key: "tanggalKembali",
        label: "Tanggal Kembali",
        getValue: (history) =>
          history.completedDate ? new Date(history.completedDate).toLocaleDateString("id-ID") : "-",
        defaultSelected: true,
      },
      {
        key: "ruangan",
        label: "Nama Ruangan Alat",
        getValue: (history) => {
          const detail = findDetailInfo(history);
          return detail?.roomName || detail?.assetLocation || history.assetLocation || "-";
        },
        defaultSelected: true,
      },
      {
        key: "catatan",
        label: "Catatan",
        getValue: (history) => history.description || history.notes || "-",
        defaultSelected: true,
      },
      {
        key: "status",
        label: "Status",
        getValue: (history) => maintenanceStatusLabel(history.status),
        defaultSelected: true,
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
  const [historyFilterSource, setHistoryFilterSource] = useState<AssetSourceKey>("Semua");
  const [historyFilterStatus, setHistoryFilterStatus] = useState("Semua");

  const historyRecords = useMemo(
    () => histories.filter((history) => ["completed", "validated", "cancelled"].includes(history.status)),
    [histories]
  );

  const getHistoryCardMeta = (history: MaintenanceHistory) => {
    const detail = findDetailInfo(history);
    const assetSource = deriveAssetSource(
      detail?.assetType || history.assetType,
      detail?.detailCode || history.assetDetailCode || history.assetCode
    );
    const inventoryBadgeLabel = assetSourceLabel(assetSource);
    const brandModel =
      detail?.detailBrandModel ||
      detail?.detailName ||
      detail?.assetName ||
      "-";
    const assetName =
      detail?.detailName ||
      detail?.assetName ||
      history.assetDetailName ||
      history.assetName ||
      "-";
    const assetCode =
      history.assetDetailCode ||
      detail?.detailCode ||
      history.assetCode ||
      "-";
    const assetRoom = detail?.roomName || detail?.assetLocation || history.assetLocation || "-";
    const completionDateLabel = formatDayTimeLabel(history.completedDate, { showWeekday: false });
    const validationDateLabel = formatDayTimeLabel(history.validatedAt, { showWeekday: false });
    const registrationNotes = history.description?.trim() || "Tidak ada catatan";
    const afterNotes = history.notes?.trim() || "Tidak ada catatan";
    const validatorLabel = getValidatorLabel(history);
    const validatorName = validatorLabel?.name || "-";
    const validatorNip = validatorLabel?.nip || "-";
    const scheduledLabel = formatDayTimeLabel(history.scheduledDate, { showWeekday: true });
    const completionDateShort = history.completedDate
      ? new Date(history.completedDate).toLocaleDateString("id-ID")
      : "-";
    const costLabel = history.cost ? formatCostLabel(history.cost) : "-";

    return {
      detail,
      assetSource,
      inventoryBadgeLabel,
      brandModel,
      assetName,
      assetCode,
      assetRoom,
      completionDateLabel,
      validationDateLabel,
      registrationNotes,
      afterNotes,
      validatorName,
      validatorNip,
      scheduledLabel,
      completionDateShort,
      costLabel,
    };
  };

  const filteredHistories = historyRecords.filter((history) => {
    const detail = findDetailInfo(history);
    const assetSource = deriveAssetSource(
      detail?.assetType || history.assetType,
      detail?.detailCode || history.assetDetailCode || history.assetCode
    );
    const matchesSearch = matchesSearchKeyword(historySearchTerm, [
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
    const matchesSource = historyFilterSource === "Semua" || assetSource === historyFilterSource;
    const matchesStatus = historyFilterStatus === "Semua" || history.status === historyFilterStatus;
    return matchesSearch && matchesSource && matchesStatus;
  });

  const historiesToExport =
    selectedHistoryIds.size > 0
      ? filteredHistories.filter((history) => selectedHistoryIds.has(history.id))
      : filteredHistories;

  const buildHistoryExportEntry = (history: MaintenanceHistory, columnSet: Set<string>): MaintenanceHistoryExportEntry => {
    const meta = getHistoryCardMeta(history);
    const validator = meta.validatorName !== "-" ? meta.validatorName : meta.validatorNip;
    const inventoryType = columnSet.has("jenisInventaris")
      ? meta.inventoryBadgeLabel
      : undefined;
    const noId = columnSet.has("noId") ? getHistoryNoId(history) : undefined;
    const assetName =
      columnSet.has("namaAlat")
        ? meta.assetName
        : undefined;
    const assetCode =
      columnSet.has("kode")
        ? meta.assetCode
        : undefined;
    const assetRoom =
      columnSet.has("ruangan")
        ? meta.assetRoom
        : undefined;
    const status =
      columnSet.has("status") ? maintenanceStatusLabel(history.status) : undefined;
    const requesterName = columnSet.has("peminjam") ? history.requesterName || "-" : undefined;
    const requesterNip = columnSet.has("nip") ? history.requesterNip || "-" : undefined;
    const scheduledDate = columnSet.has("tanggalPinjam")
      ? formatDayTimeLabel(history.scheduledDate, { showWeekday: false })
      : undefined;
    const completionDate = columnSet.has("tanggalKembali")
      ? meta.completionDateShort
      : undefined;
    const notes = columnSet.has("catatan")
      ? history.description?.trim() || history.notes?.trim() || "-"
      : undefined;
    const brandModel = columnSet.has("namaAlat")
      ? meta.brandModel
      : undefined;
    const technician = columnSet.has("catatan")
      ? history.technician || "-"
      : undefined;
    const cost = columnSet.has("catatan")
      ? meta.costLabel
      : undefined;
    const registrationNotes = columnSet.has("catatan")
      ? meta.registrationNotes
      : undefined;
    const validationDate = columnSet.has("status")
      ? meta.validationDateLabel
      : undefined;
    const validatorName = columnSet.has("status")
      ? meta.validatorName
      : undefined;
    const validatorNip = columnSet.has("status")
      ? meta.validatorNip
      : undefined;

    return {
      noId,
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

  const toggleHistorySelection = (id: number) => {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
      title: "Riwayat Tindak Lanjut Pemeliharaan Sarana",
      entries,
      filePrefix: "riwayat-tindak-lanjut",
    });
  };

  const exportSingleHistory = (format: ExportFormat, history: MaintenanceHistory) => {
    const columnSet = new Set(selectedHistoryColumns);
    const entry = buildHistoryExportEntry(history, columnSet);
    void exportMaintenanceHistory(format, {
      title: "Riwayat Tindak Lanjut Pemeliharaan Sarana",
      entries: [entry],
      filePrefix: `riwayat-tindak-lanjut-${history.id}`,
    });
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-[13px] text-muted-foreground">
        Memuat riwayat...
      </div>
    );
  }

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
      <div className="border-b border-border px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                aria-label="Pilih semua riwayat pemeliharaan"
                className="h-4 w-4"
                checked={historyAllSelected}
                onChange={handleHistorySelectAll}
              />
              Pilih semua
            </label>
            <span className="text-[13px] text-muted-foreground">
              {selectedVisibleHistoryCount
                ? `${selectedVisibleHistoryCount} baris dipilih`
                : `Semua ${filteredHistories.length} baris`}
            </span>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-4">
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-muted-foreground">
              Cari & Filter Riwayat
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[14px]"
              onClick={() => {
                setHistorySearchTerm("");
                setHistoryFilterSource("Semua");
                setHistoryFilterStatus("Semua");
              }}
            >
              Reset
            </Button>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label className="sr-only">Cari riwayat tindakan pemeliharaan</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={historySearchTerm}
                  onChange={(event) => setHistorySearchTerm(event.target.value)}
                  placeholder="Cari No ID, nama alat, kode, pemohon, atau teknisi..."
                  className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                />
              </div>
            </div>
            <select
              value={historyFilterSource}
              onChange={(e) => setHistoryFilterSource(e.target.value as AssetSourceKey)}
              className="rounded-xl border border-border/80 bg-background px-4 py-2 text-[13px] text-foreground transition focus:border-teal-500"
            >
              <option value="Semua">Semua Sumber</option>
              <option value="medis">Inventaris Medis</option>
              <option value="non_medis">Inventaris Non-Medis</option>
            </select>
            <select
              value={historyFilterStatus}
              onChange={(e) => setHistoryFilterStatus(e.target.value)}
              className="rounded-xl border border-border/80 bg-background px-4 py-2 text-[13px] text-foreground transition focus:border-teal-500"
            >
              <option value="Semua">Semua Status</option>
              <option value="completed">Menunggu Validasi</option>
              <option value="validated">Selesai</option>
              <option value="cancelled">Ditolak / Dibatalkan</option>
            </select>
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
        <div className="max-h-180 overflow-y-auto px-3 pb-4 pr-2 sm:px-4 sm:pb-6">
          <div className="space-y-4 py-3">
            {filteredHistories.map((h) => {
            const meta = getHistoryCardMeta(h);
            const historyNoId = getHistoryNoId(h);
            const isExpanded = expandedHistoryIds.has(h.id);
            return (
              <div
                key={h.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                  <span>Informasi Dasar Inventaris</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 rounded-lg p-0 text-slate-700 hover:bg-slate-200"
                      onClick={() => toggleHistorySummary(h.id)}
                      aria-label={isExpanded ? "Sembunyikan detail" : "Tampilkan detail"}
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {!isExpanded && (
                <div className="space-y-2.5 bg-white px-3 py-3 sm:px-3 sm:py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{meta.assetName}</p>
                      <p className="text-[12px] font-medium text-slate-700">{meta.assetCode}</p>
                      <p className="text-[11px] text-muted-foreground">No ID: {historyNoId}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Pemohon: <span className="font-medium text-slate-700">{h.requesterName || "-"} / {h.requesterNip || "-"}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Ruangan alat: <span className="font-medium text-slate-700">{meta.assetRoom}</span> • Teknisi: {h.technician || "-"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {meta.inventoryBadgeLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Jadwal {meta.scheduledLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Waktu Selesai</span>
                        <span className="text-[13px] font-semibold text-foreground">{meta.completionDateLabel}</span>
                      </div>
                      <div>
                        <Badge variant={getStatusColor(h.status)} className="text-[11px]">
                          {maintenanceStatusLabel(h.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                )}
                {isExpanded && (
                <div className="space-y-3 bg-white px-3 py-3 sm:px-3 sm:py-3">
                      <div className="columns-1 gap-3 lg:columns-2">
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Informasi Dasar Alat" />
                        <div className="rounded-xl border border-slate-200 bg-white">
                          <InfoRow label="Jenis Inventaris">{meta.inventoryBadgeLabel}</InfoRow>
                          <InfoRow label="No ID Jadwal">{historyNoId}</InfoRow>
                          <InfoRow label="Nama Alat">{meta.assetName}</InfoRow>
                          <InfoRow label="Kode Alat">{meta.assetCode}</InfoRow>
                          <InfoRow label="Nama Ruangan Alat">{meta.assetRoom}</InfoRow>
                          <InfoRow label="Merek / Model">{meta.brandModel}</InfoRow>
                        </div>
                      </div>
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Detail Administrasi" />
                        <div className="rounded-xl border border-slate-200 bg-white">
                          <InfoRow label="Nama Pengirim">{h.requesterName || "-"}</InfoRow>
                          <InfoRow label="NIP Pengirim">{h.requesterNip || "-"}</InfoRow>
                          <InfoRow label="Jadwal Pemeliharaan Sarana">{meta.scheduledLabel}</InfoRow>
                          <InfoRow label="Catatan Pendaftaran">{meta.registrationNotes}</InfoRow>
                        </div>
                      </div>
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Pelaksanaan & Biaya" />
                        <div className="rounded-xl border border-slate-200 bg-white">
                          <InfoRow label="Teknisi Pelaksana">{h.technician || "-"}</InfoRow>
                          <InfoRow label="Waktu Selesai">{meta.completionDateLabel}</InfoRow>
                          <InfoRow label="Biaya Pemeliharaan">{meta.costLabel}</InfoRow>
                          <InfoRow label="Catatan (After)">{meta.afterNotes}</InfoRow>
                          {h.status === "cancelled" && (
                            <InfoRow label="Alasan Pembatalan">{h.cancellationReason || "-"}</InfoRow>
                          )}
                        </div>
                      </div>
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Validasi" />
                        <div className="rounded-xl border border-slate-200 bg-white">
                          <InfoRow label="Validator">{meta.validatorName}</InfoRow>
                          <InfoRow label="NIP Validator">{meta.validatorNip}</InfoRow>
                          <InfoRow label="Waktu Validasi">{meta.validationDateLabel}</InfoRow>
                        </div>
                      </div>
                      </div>
                    </div>
                )}
                <div className="flex flex-col gap-1.5 border-t border-slate-200 px-3 pb-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:pb-3">
                      <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={selectedHistoryIds.has(h.id)}
                          onChange={() => toggleHistorySelection(h.id)}
                          className="h-4 w-4 rounded border border-slate-300 bg-white text-slate-700"
                          aria-label={`Pilih riwayat pemeliharaan ${meta.assetName}`}
                        />
                        Pilih kartu
                      </label>
                      <div className="flex flex-wrap items-center gap-1 text-[12px] text-slate-600">
                        {canComplete && !["completed", "validated", "cancelled"].includes(h.status) && editId !== h.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-teal-700 border-teal-600 hover:bg-teal-50"
                            onClick={() => openEdit(h)}
                          >
                            Selesai Perbaikan
                          </Button>
                        )}
                        {canValidate && h.status === "completed" && !h.validatedBy && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-green-700 border-green-600 hover:bg-green-50"
                            onClick={() => handleValidate(h.id)}
                          >
                            Validasi
                          </Button>
                        )}
                        {canComplete && ["completed", "validated"].includes(h.status) && editId !== h.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 rounded-lg p-0 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => openEdit(h)}
                            title="Edit"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {canValidate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 rounded-lg p-0 text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(h.id)}
                            title="Hapus"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 rounded-lg p-0">
                              <Download className="w-3 h-3" />
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
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          placeholder="Catatan"
                          value={completeForm.notes}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))}
                          className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
                        />
                        <input
                          type="datetime-local"
                          value={completeForm.completedDate}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, completedDate: e.target.value }))}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
                        />
                        <input
                          type="text"
                          placeholder="Teknisi"
                          value={completeForm.technician}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, technician: e.target.value }))}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
                        />
                        <input
                          type="number"
                          placeholder="Biaya"
                          value={completeForm.cost}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, cost: e.target.value }))}
                          className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
                        />
                        <div className="sm:col-span-2 flex gap-2">
                          <Button
                            size="sm"
                            className="h-9 rounded-lg px-3 text-[13px]"
                            onClick={() => handleComplete(h.id)}
                          >
                            Simpan
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg px-3 text-[13px] text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setEditId(null)}
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}
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
      <div className="space-y-2">
        {error && <div className="text-[14px] text-red-600">{error}</div>}
        {tableContent}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="text-[14px] text-red-600">{error}</div>}
      <div className={wrapperClasses}>
        {tableContent}
      </div>
    </div>
  );
};

export default MaintenanceHistoryList;
