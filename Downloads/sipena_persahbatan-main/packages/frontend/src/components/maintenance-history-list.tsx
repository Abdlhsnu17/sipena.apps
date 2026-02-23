"use client"

import apiService from "@/services/api.service";
import { getUsers } from "@/services/auth-utils";
import maintenanceService, { type Maintenance } from "@/services/maintenance.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { cn } from "@/utils";
import { maintenanceStatusLabel } from "@/utils/api-mappers";
import { formatBracketedDateTime, formatCostLabel, formatDateId, formatLongDateLabel, formatTimeDotsLabel } from "@/utils/format";
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
import { ExportFormat, exportMaintenanceHistory, type MaintenanceHistoryExportEntry } from "@/utils/export-table";
import { Download } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

interface MaintenanceHistory {
  id: number;
  maintenanceId: number;
  assetId: number;
  assetType?: string;
  assetName?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
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
        assetId: m.assetId,
        assetType: m.assetType,
        assetDetailId: m.assetDetailId,
        assetDetailName: m.assetDetailName,
        assetDetailCode: m.assetDetailCode,
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
    // eslint-disable-next-line
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

  const historyExportColumnDefinitions = useMemo<HistoryExportColumn[]>(
    () => [
      {
        key: "jenisInventaris",
        label: "Jenis Inventaris",
        getValue: (history) => {
          const detail = findDetailInfo(history);
          const source = detail?.assetType || history.assetType || "medical";
          return source === "non_medical" ? "Non-Medis" : "Medis";
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
        getValue: (history) => formatDateId(history.scheduledDate),
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

  const historiesToExport =
    selectedHistoryIds.size > 0
      ? histories.filter((history) => selectedHistoryIds.has(history.id))
      : histories;

  const buildHistoryExportEntry = (history: MaintenanceHistory, columnSet: Set<string>): MaintenanceHistoryExportEntry => {
    const detail = findDetailInfo(history);
    const assetTypeSource = detail?.assetType || history.assetType || "medical";
    const inventoryType = columnSet.has("jenisInventaris")
      ? assetTypeSource === "non_medical"
        ? "Non-Medis"
        : "Medis"
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
    const status =
      columnSet.has("status") ? maintenanceStatusLabel(history.status).toUpperCase() : undefined;
    const requesterName = columnSet.has("peminjam") ? history.requesterName || "-" : undefined;
    const requesterNip = columnSet.has("nipPeminjam") ? history.requesterNip || "-" : undefined;
    const scheduledDate = columnSet.has("jadwal")
      ? formatLongDateLabel(history.scheduledDate) ?? "-"
      : undefined;
    const technician = columnSet.has("teknisi") ? history.technician || "-" : undefined;
    const completionDate = columnSet.has("selesai")
      ? (() => {
          if (!history.completedDate) return "-";
          const dateLabel = formatLongDateLabel(history.completedDate);
          const timeLabel = formatTimeDotsLabel(history.completedDate);
          if (dateLabel && timeLabel) return `${dateLabel} (${timeLabel})`;
          return dateLabel ?? timeLabel ?? "-";
        })()
      : undefined;
    const cost = columnSet.has("biaya")
      ? history.cost
        ? formatCostLabel(history.cost)
        : "-"
      : undefined;
    const notes = columnSet.has("catatan")
      ? history.notes?.trim()
        ? `"${history.notes.trim()}"`
        : "Tidak ada catatan"
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
        ? (() => {
            const parts = [
              formatLongDateLabel(history.validatedAt),
              formatTimeDotsLabel(history.validatedAt),
            ].filter(Boolean);
            return parts.length ? parts.join(", ") : undefined;
          })()
        : undefined;

    return {
      inventoryType,
      assetName,
      assetCode,
      brandModel,
      requesterName,
      requesterNip,
      scheduledDate,
      technician,
      completionDate,
      cost,
      notes,
      status,
      validator,
      validationDate,
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

  const historyAllSelected = histories.length > 0 && histories.every((history) => selectedHistoryIds.has(history.id));

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

  const handleHistorySelectAll = () => {
    if (historyAllSelected) {
      setSelectedHistoryIds(new Set());
      return;
    }
    setSelectedHistoryIds(new Set(histories.map((history) => history.id)));
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

  if (loading) return <div>Memuat riwayat...</div>;

  const tableContent = (
    <>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Ekspor Riwayat</p>
          <p className="text-sm text-foreground">
            Pilih kolom dan baris yang ingin dicetak sebagai PDF/Word/Excel.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
              <DropdownMenuItem onClick={() => handleHistoryExport("pdf")}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHistoryExport("word")}>Word</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHistoryExport("excel")}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-xs text-muted-foreground">
            {selectedHistoryIds.size
              ? `${selectedHistoryIds.size} baris dipilih`
              : `Semua ${histories.length} baris siap cetak`}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Pilih semua riwayat"
                      checked={historyAllSelected}
                      onChange={handleHistorySelectAll}
                    />
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Jenis Inventaris
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Alat</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Merek/Model</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Nama Pengirim Pemeliharaan</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Jadwal Pemeliharaan</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Waktu Selesai</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Teknisi</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Biaya</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Catatan After</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Validasi</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Aksi</th></tr>
          </thead>
          <tbody>
            {histories.length === 0 ? (
                <tr>
              <td colSpan={13} className="py-4 px-3 text-center text-muted-foreground">
                Belum ada riwayat pemeliharaan
              </td>
            </tr>
            ) : (
              histories.map((h) => {
                const detailInfo = findDetailInfo(h)
                const inventoryAssetType = detailInfo?.assetType || h.assetType || "medical"
                const inventoryBadgeLabel = inventoryAssetType === "non_medical" ? "Non-Medis" : "Medis"
                const inventoryBadgeClass = cn(
                  "rounded-full border px-3 py-0.5 text-[11px] font-semibold tracking-wide bg-background",
                  inventoryAssetType === "non_medical"
                    ? "border-border text-foreground/80 dark:border-slate-600 dark:text-slate-200"
                    : "border-border text-foreground/90 dark:border-slate-600 dark:text-white"
                )
                const brandModel =
                  detailInfo?.detailBrandModel ||
                  detailInfo?.detailName ||
                  detailInfo?.assetName ||
                  "-"
                const assetName =
                  detailInfo?.detailName ||
                  detailInfo?.assetName ||
                  h.assetDetailName ||
                  h.assetName ||
                  "-"
                const validatorLabel = getValidatorLabel(h);
                const validationTimestamp = formatBracketedDateTime(h.validatedAt);
                const completionTimestamp = formatBracketedDateTime(h.completedDate);
                return (
                  <tr key={h.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selectedHistoryIds.has(h.id)}
                        onChange={() => toggleHistorySelection(h.id)}
                        className="h-4 w-4"
                        aria-label={`Pilih riwayat ${assetName}`}
                      />
                    </td>
                    <td className="py-2 px-3 text-foreground">
                      <Badge variant="outline" className={inventoryBadgeClass}>{inventoryBadgeLabel}</Badge>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{assetName}</td>
                    <td className="py-2 px-3 text-muted-foreground">{brandModel}</td>
                    <td className="py-2 px-3 text-muted-foreground">{maintenanceStatusLabel(h.status)}</td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {h.requesterName || h.requesterNip ? (
                        <div className="flex flex-col">
                          <span>{h.requesterName || "-"}</span>
                          {h.requesterNip && <span className="text-xs text-muted-foreground">{h.requesterNip}</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{formatDateId(h.scheduledDate)}</td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[140px]">
                      <span className="text-xs text-muted-foreground block">{completionTimestamp ?? '-'}</span>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{h.technician || '-'}</td>
                    <td className="py-2 px-3 text-muted-foreground">{h.cost ? formatCostLabel(h.cost) : '-'}</td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[200px]">{h.notes || '-'}</td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[180px]">
                      <div className="flex flex-col gap-1">
                        {h.validatedAt ? (
                          validatorLabel ? (
                            <div className="space-y-0.5">
                              {validatorLabel.name && (
                                <div className="text-sm text-foreground leading-tight validator-name-normal">
                                  {validatorLabel.name}
                                </div>
                              )}
                              {validatorLabel.nip && (
                                <div className="text-xs text-muted-foreground leading-tight">{validatorLabel.nip}</div>
                              )}
                              {validationTimestamp && (
                                <div className="text-[11px] text-muted-foreground">{validationTimestamp}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Data validator tidak tersedia</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">Menunggu validasi</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {/* Staff/leader/admin bisa menandai selesai */}
                      {canComplete && h.status !== 'completed' && h.status !== 'validated' && editId !== h.id && (
                        <button className="text-teal-700 text-sm" onClick={() => openEdit(h)}>
                          Selesaikan
                        </button>
                      )}
                      {canComplete && editId === h.id && (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="Catatan"
                            value={completeForm.notes}
                            onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))}
                            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          />
                          <input
                            type="datetime-local"
                            value={completeForm.completedDate}
                            onChange={(e) => setCompleteForm((f) => ({ ...f, completedDate: e.target.value }))}
                            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Teknisi"
                            value={completeForm.technician}
                            onChange={(e) => setCompleteForm((f) => ({ ...f, technician: e.target.value }))}
                            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          />
                          <input
                            type="number"
                            placeholder="Biaya"
                            value={completeForm.cost}
                            onChange={(e) => setCompleteForm((f) => ({ ...f, cost: e.target.value }))}
                            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm"
                              onClick={() => handleComplete(h.id)}
                            >
                              Simpan
                            </button>
                            <button
                              className="px-3 py-2 text-red-600 border border-red-200 rounded-lg text-sm"
                              onClick={() => setEditId(null)}
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Admin/leader hanya bisa validasi jika status completed dan belum divalidasi */}
                      {canValidate && h.status === 'completed' && !h.validatedBy && (
                        <button className="text-teal-700 text-sm" onClick={() => handleValidate(h.id)}>
                          Validasi
                        </button>
                      )}
                      {canValidate && (
                        <button className="text-red-600 text-sm ml-2" onClick={() => handleDelete(h.id)}>
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  const wrapperClasses = cn(
    "rounded-2xl border border-border bg-background shadow-sm",
    wrapperClassName
  );

  if (disableWrapper) {
    return (
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600">{error}</div>}
        {tableContent}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className={wrapperClasses}>
        {tableContent}
      </div>
    </div>
  );
};

export default MaintenanceHistoryList;
