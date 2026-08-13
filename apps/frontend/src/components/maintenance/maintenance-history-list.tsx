"use client"

import DeleteReasonDialog from "@/components/common/delete-reason-dialog";
import { PaperPrintMenu } from "@/components/common/paper-print-menu";
import { SummaryResultBody, SummaryResultCard, SummaryResultFooter } from "@/components/common/summary-result-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import apiService from "@/services/api.service";
import { getUsers } from "@/services/auth-utils";
import deletionRequestService from "@/services/deletion-request.service";
import maintenanceService, { type Maintenance } from "@/services/maintenance.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { cn } from "@/utils";
import { assetSourceBadgeClass, assetSourceLabel, deriveAssetSource, locationBadgeClass, maintenanceStatusLabel, maintenanceTypeBadgeClass, maintenanceTypeLabel, type AssetSourceKey } from "@/utils/api-mappers";
import { ExportFormat, exportMaintenanceHistory, type MaintenanceHistoryExportEntry } from "@/utils/export-table";
import { formatCostLabel, formatDayTimeLabel } from "@/utils/format";
import { toIsoDateTimeString } from "@/utils/date-input";
import { formatNoId } from "@/utils/record-id";
import { canManageMaintenanceStatusRole, isAdminOrLeaderRole, isAdminRole } from "@/utils/role";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { ChevronLeft, ChevronRight, Download, Eye, MapPin, Pencil, Search, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { buildVisiblePageItems } from "@/utils/pagination";

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
  priority?: 'low' | 'normal' | 'high' | 'critical';
  status: string;
  scheduledDate: string;
  startedDate?: string;
  completedDate?: string;
  dueAt?: string;
  estimatedDurationMinutes?: number;
  estimatedCost?: number;
  slaStatus?: 'no_target' | 'on_track' | 'at_risk' | 'overdue' | 'met' | 'met_late';
  description: string;
  technician?: string;
  technicianNip?: string;
  vendorName?: string;
  vendorReference?: string;
  diagnosis?: string;
  actionTaken?: string;
  checklist?: string;
  spareParts?: string;
  verificationResult?: string;
  finalCondition?: string;
  verificationNotes?: string;
  nextMaintenanceDate?: string;
  cost?: number;
  notes?: string;
  damagePhotoUrl?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  cancellationReason?: string;
  createdBy: number;
  validatedBy?: number;
  validatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  requesterName?: string;
  requesterNip?: string;
  requesterWorkUnit?: string;
  requesterSubWorkUnit?: string;
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
  <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
    {label}
  </div>
);

const maintenancePriorityLabel = (priority?: MaintenanceHistory["priority"]) => {
  switch (priority) {
    case "low":
      return "Rendah";
    case "high":
      return "Tinggi";
    case "critical":
      return "Kritis";
    default:
      return "Normal";
  }
};

const maintenanceSlaLabel = (status?: MaintenanceHistory["slaStatus"]) => {
  switch (status) {
    case "on_track":
      return "SLA Aman";
    case "at_risk":
      return "SLA Risiko";
    case "overdue":
      return "Lewat SLA";
    case "met":
      return "SLA Tercapai";
    case "met_late":
      return "SLA Tercapai Terlambat";
    default:
      return "-";
  }
};

const InfoRow = ({ label, children }: InfoRowProps) => (
  <div className="detail-labeled-row border-b border-slate-200 dark:border-slate-800/35 last:border-b-0">
    <span className="font-medium text-slate-600 dark:text-slate-300">
      {label}
    </span>
    <span className="font-medium text-slate-900 dark:text-slate-100 leading-snug">{children}</span>
  </div>
);

const NOTES_KEYWORD_RULES: { words: string[]; category: "red" | "amber" | "emerald"; textClass: string; markerClass: string }[] = [
  { words: ["rusak", "tidak normal", "tidak berfungsi", "perlu ganti", "error"], category: "red", textClass: "text-red-600 font-semibold", markerClass: "marker:text-red-600" },
  { words: ["cukup", "perlu perhatian", "perlu pengecekan"], category: "amber", textClass: "text-amber-600 font-semibold", markerClass: "marker:text-amber-600" },
  { words: ["baik", "normal", "sesuai", "aman"], category: "emerald", textClass: "text-emerald-600 font-semibold", markerClass: "marker:text-emerald-600" },
];

const NOTES_KEYWORD_REGEX = new RegExp(
  `\\b(${NOTES_KEYWORD_RULES.flatMap((rule) => rule.words)
    .sort((a, b) => b.length - a.length)
    .map((word) => word.replace(/\s+/g, "\\s+"))
    .join("|")})\\b`,
  "gi",
);

const getKeywordRule = (word: string) => {
  const normalized = word.toLowerCase().replace(/\s+/g, " ");
  return NOTES_KEYWORD_RULES.find((rule) => rule.words.includes(normalized));
};

const renderHighlightedText = (text: string): React.ReactNode => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  NOTES_KEYWORD_REGEX.lastIndex = 0;
  while ((match = NOTES_KEYWORD_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const rule = getKeywordRule(match[0]);
    parts.push(
      <span key={`hl-${key++}`} className={rule?.textClass}>
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

const renderNotesContent = (text: string | undefined): React.ReactNode => {
  const trimmed = text?.trim();
  if (!trimmed) return "Tidak ada catatan";

  const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return renderHighlightedText(trimmed);
  }

  return (
    <ul className="list-disc space-y-1 pl-4 marker:text-slate-400 dark:text-slate-500">
      {lines.map((line, index) => {
        const rule = NOTES_KEYWORD_RULES.find((candidate) =>
          candidate.words.some((word) => line.toLowerCase().includes(word)),
        );
        return (
          <li key={index} className={rule?.markerClass}>
            {renderHighlightedText(line)}
          </li>
        );
      })}
    </ul>
  );
};

type HistoryExportColumn = {
  key: string;
  label: string;
  getValue: (history: MaintenanceHistory) => string;
  defaultSelected?: boolean;
};

const HISTORY_ROWS_PER_PAGE = 2;

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
  const [pendingDeleteHistory, setPendingDeleteHistory] = useState<MaintenanceHistory | null>(null);
  const [pendingArchiveHistoryRequest, setPendingArchiveHistoryRequest] = useState<MaintenanceHistory | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);

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
  const canDelete = isAdminRole(safeUser.role);
  const canRequestDelete = isAdminOrLeaderRole(safeUser.role) && !canDelete;

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
          completedDate: completeForm.completedDate ? toIsoDateTimeString(completeForm.completedDate) : undefined,
          cost: completeForm.cost ? Number(completeForm.cost) : undefined,
        });
      }
      window.dispatchEvent(new Event('inventory-refresh'))
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
          validatedAt: toIsoDateTimeString(new Date()),
        });
      }
      window.dispatchEvent(new Event('inventory-refresh'))
      setError(null);
      if (!maintenance) fetchHistories();
    } catch (err: any) {
      setError(err?.message || 'Gagal memvalidasi riwayat');
    }
  };

  const openDeleteDialog = (history: MaintenanceHistory) => {
    setPendingDeleteHistory(history);
    setDeleteReason("");
    setError(null);
  };

  const closeDeleteDialog = () => {
    if (isDeletingHistory) return;
    setPendingDeleteHistory(null);
    setDeleteReason("");
  };

  const handleDelete = async () => {
    if (!pendingDeleteHistory) return;
    const reason = deleteReason.trim();
    if (!reason) {
      setError("Alasan penghapusan wajib diisi");
      return;
    }

    try {
      if (!canDelete) {
        setError('Hanya admin yang dapat menghapus riwayat');
        return;
      }

      setIsDeletingHistory(true);

      if (maintenance) {
        const res = await maintenanceService.delete(String(pendingDeleteHistory.id), reason);
        if (!res.success) throw new Error(res.message || "Gagal menghapus jadwal");
        await onRefresh?.();
      } else {
        await apiService.delete(`/maintenance-history/${pendingDeleteHistory.id}`, { deleteReason: reason });
      }
      window.dispatchEvent(new Event('inventory-refresh'))
      setSelectedHistoryIds((prev) => {
        if (!prev.has(pendingDeleteHistory.id)) return prev;
        const next = new Set(prev);
        next.delete(pendingDeleteHistory.id);
        return next;
      });
      setPendingDeleteHistory(null);
      setDeleteReason("");
      setError(null);
      if (!maintenance) fetchHistories();
    } catch (err: any) {
      setError(err?.message || 'Gagal menghapus riwayat');
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const openArchiveRequestDialog = (history: MaintenanceHistory) => {
    setPendingArchiveHistoryRequest(history);
    setDeleteReason("");
    setError(null);
  };

  const confirmArchiveRequest = async () => {
    if (!pendingArchiveHistoryRequest) return;
    const reason = deleteReason.trim();
    if (!reason) {
      setError("Alasan penghapusan wajib diisi");
      return;
    }

    setIsDeletingHistory(true);
    try {
      const response = await deletionRequestService.create({
        targetType: "maintenance",
        targetId: pendingArchiveHistoryRequest.id,
        targetLabel: pendingArchiveHistoryRequest.assetDetailName || pendingArchiveHistoryRequest.assetName || pendingArchiveHistoryRequest.maintenanceCode || `Pemeliharaan #${pendingArchiveHistoryRequest.id}`,
        reason,
      });
      if (!response.success) {
        throw new Error(response.message || "Gagal mengajukan penghapusan riwayat");
      }
      setPendingArchiveHistoryRequest(null);
      setDeleteReason("");
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Gagal mengajukan penghapusan riwayat");
    } finally {
      setIsDeletingHistory(false);
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
        priority: m.priority,
        status: validation?.status === "validated" ? "validated" : m.status,
        scheduledDate: m.scheduledDate,
        startedDate: m.createdAt,
        completedDate: m.completedDate,
        dueAt: m.dueAt,
        estimatedDurationMinutes: m.estimatedDurationMinutes,
        estimatedCost: m.estimatedCost,
        slaStatus: m.slaStatus,
        description: m.description,
        technician: m.technician,
        technicianNip: m.technicianNip,
        vendorName: m.vendorName,
        vendorReference: m.vendorReference,
        diagnosis: m.diagnosis,
        actionTaken: m.actionTaken,
        checklist: m.checklist,
        spareParts: m.spareParts,
        verificationResult: m.verificationResult,
        finalCondition: m.finalCondition,
        verificationNotes: m.verificationNotes,
        nextMaintenanceDate: m.nextMaintenanceDate,
        cost: m.cost,
        notes: m.notes,
        damagePhotoUrl: m.damagePhotoUrl,
        beforePhotoUrl: m.beforePhotoUrl,
        afterPhotoUrl: m.afterPhotoUrl,
        cancellationReason: m.cancellationReason,
        createdBy: m.createdBy,
        validatedBy: validation?.validatedBy,
        validatedAt: validation?.validatedAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        requesterName: m.requesterName,
        requesterNip: m.requesterNip,
        requesterWorkUnit: m.requesterWorkUnit,
        requesterSubWorkUnit: m.requesterSubWorkUnit,
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
        key: "tipeLayanan",
        label: "Tipe Layanan",
        getValue: (history) => maintenanceTypeLabel(history.type),
        defaultSelected: true,
      },
      {
        key: "namaAlat",
        label: "Nama Inventaris",
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
        key: "merek",
        label: "Merek / Model",
        getValue: (history) => {
          const detail = findDetailInfo(history);
          return detail?.detailBrandModel || detail?.detailName || history.assetDetailName || history.assetName || "-";
        },
        defaultSelected: true,
      },
      {
        key: "ruanganAlat",
        label: "Nama Ruangan Inventaris",
        getValue: (history) => {
          const detail = findDetailInfo(history);
          return detail?.roomName || detail?.assetLocation || history.assetLocation || "-";
        },
        defaultSelected: true,
      },
      {
        key: "pengirim",
        label: "Nama Pengirim",
        getValue: (history) => history.requesterName || "-",
        defaultSelected: true,
      },
      {
        key: "nipPengirim",
        label: "NIP Pengirim",
        getValue: (history) => history.requesterNip || "-",
        defaultSelected: true,
      },
      {
        key: "jadwalPemeliharaan",
        label: "Jadwal Pemeliharaan",
        getValue: (history) => formatDayTimeLabel(history.scheduledDate, { showWeekday: false }),
        defaultSelected: true,
      },
      {
        key: "catatanPendaftaran",
        label: "Catatan Pendaftaran",
        getValue: (history) => history.description || "-",
        defaultSelected: true,
      },
      {
        key: "buktiKerusakan",
        label: "Bukti Kerusakan",
        getValue: (history) => history.damagePhotoUrl || "-",
        defaultSelected: true,
      },
      {
        key: "teknisi",
        label: "Teknisi Pelaksana",
        getValue: (history) => history.technician || "-",
        defaultSelected: true,
      },
      {
        key: "waktuSelesai",
        label: "Waktu Selesai",
        getValue: (history) => formatDayTimeLabel(history.completedDate, { showWeekday: false }),
        defaultSelected: true,
      },
      {
        key: "biaya",
        label: "Biaya Pemeliharaan",
        getValue: (history) => (history.cost ? formatCostLabel(history.cost) : "-"),
        defaultSelected: true,
      },
      {
        key: "fotoSebelum",
        label: "Foto Sebelum",
        getValue: (history) => history.beforePhotoUrl || "-",
        defaultSelected: true,
      },
      {
        key: "fotoSesudah",
        label: "Foto Sesudah",
        getValue: (history) => history.afterPhotoUrl || "-",
        defaultSelected: true,
      },
      {
        key: "catatanAfter",
        label: "Catatan (After)",
        getValue: (history) => history.notes || "-",
        defaultSelected: true,
      },
      {
        key: "alasanPembatalan",
        label: "Alasan Pembatalan",
        getValue: (history) => history.cancellationReason || "-",
        defaultSelected: true,
      },
      {
        key: "validator",
        label: "Validator",
        getValue: (history) => getValidatorLabel(history)?.name || "-",
        defaultSelected: true,
      },
      {
        key: "validatorNip",
        label: "NIP Validator",
        getValue: (history) => getValidatorLabel(history)?.nip || "-",
        defaultSelected: true,
      },
      {
        key: "waktuValidasi",
        label: "Waktu Validasi",
        getValue: (history) => formatDayTimeLabel(history.validatedAt, { showWeekday: false }),
        defaultSelected: true,
      },
      {
        key: "status",
        label: "Status",
        getValue: (history) => maintenanceStatusLabel(history.status, history.type),
        defaultSelected: true,
      },
    ],
    [findDetailInfo]
  );

  const [selectedHistoryColumns] = useState<string[]>(() =>
    historyExportColumnDefinitions.filter((column) => column.defaultSelected ?? true).map((column) => column.key)
  );
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<number>>(() => new Set());
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<number>>(() => new Set());
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historyFilterSource, setHistoryFilterSource] = useState<AssetSourceKey>("Semua");
  const [historyFilterStatus, setHistoryFilterStatus] = useState("Semua");
  const [historyPage, setHistoryPage] = useState(1);

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
      history.assetDetailName ||
      history.assetName ||
      "-";
    const assetName =
      detail?.detailInventoryName ||
      detail?.detailName ||
      history.assetDetailName ||
      history.assetName ||
      "-";
    const assetCode =
      detail?.detailCode ||
      history.assetDetailCode ||
      history.assetCode ||
      "-";
    const assetRoom = detail?.roomName || detail?.assetLocation || history.assetLocation || "-";
    const requesterRoom = history.requesterWorkUnit || "-";
    const completionDateLabel = formatDayTimeLabel(history.completedDate, { showWeekday: false });
    const validationDateLabel = formatDayTimeLabel(history.validatedAt, { showWeekday: false });
    const registrationNotes = history.description?.trim() || "Tidak ada catatan";
    const afterNotes = history.notes?.trim() || "Tidak ada catatan";
    const validatorLabel = getValidatorLabel(history);
    const validatorName = validatorLabel?.name || "-";
    const validatorNip = validatorLabel?.nip || "-";
    const scheduledLabel = formatDayTimeLabel(history.scheduledDate, { showWeekday: true });
    const costLabel = history.cost ? formatCostLabel(history.cost) : "-";
    const priorityLabel = maintenancePriorityLabel(history.priority);
    const dueAtLabel = history.dueAt ? formatDayTimeLabel(history.dueAt, { showWeekday: false }) : "-";
    const slaLabel = maintenanceSlaLabel(history.slaStatus);
    const estimatedDurationLabel = history.estimatedDurationMinutes ? `${history.estimatedDurationMinutes} menit` : "-";
    const estimatedCostLabel = history.estimatedCost ? `Rp ${Number(history.estimatedCost).toLocaleString("id-ID")}` : "-";
    const nextMaintenanceDateLabel = history.nextMaintenanceDate
      ? formatDayTimeLabel(history.nextMaintenanceDate, { showWeekday: false })
      : "-";

    return {
      detail,
      assetSource,
      inventoryBadgeLabel,
      brandModel,
      assetName,
      assetCode,
      assetRoom,
      requesterRoom,
      completionDateLabel,
      validationDateLabel,
      registrationNotes,
      afterNotes,
      validatorName,
      validatorNip,
      scheduledLabel,
      costLabel,
      priorityLabel,
      dueAtLabel,
      slaLabel,
      estimatedDurationLabel,
      estimatedCostLabel,
      nextMaintenanceDateLabel,
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

  useEffect(() => {
    setHistoryPage(1);
  }, [histories.length, historyFilterSource, historyFilterStatus, historySearchTerm]);

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistories.length / HISTORY_ROWS_PER_PAGE));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const historyStartIndex = (currentHistoryPage - 1) * HISTORY_ROWS_PER_PAGE;
  const paginatedHistories = filteredHistories.slice(historyStartIndex, historyStartIndex + HISTORY_ROWS_PER_PAGE);
  const visibleHistoryPages = buildVisiblePageItems(currentHistoryPage, totalHistoryPages);
  const goToHistoryPage = (page: number) => {
    setHistoryPage(Math.min(totalHistoryPages, Math.max(1, page)));
  };

  const historiesToExport =
    selectedHistoryIds.size > 0
      ? filteredHistories.filter((history) => selectedHistoryIds.has(history.id))
      : filteredHistories;

  const buildHistoryExportEntry = (history: MaintenanceHistory, columnSet: Set<string>): MaintenanceHistoryExportEntry => {
    const meta = getHistoryCardMeta(history);
    const validator =
      columnSet.has("validator") || columnSet.has("validatorNip")
        ? meta.validatorName !== "-"
          ? meta.validatorName
          : meta.validatorNip
        : undefined;
    const inventoryType = columnSet.has("jenisInventaris")
      ? meta.inventoryBadgeLabel
      : undefined;
    const maintenanceType = columnSet.has("tipeLayanan")
      ? maintenanceTypeLabel(history.type)
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
      columnSet.has("ruanganAlat")
        ? meta.assetRoom
        : undefined;
    const status =
      columnSet.has("status") ? maintenanceStatusLabel(history.status, history.type) : undefined;
    const requesterName = columnSet.has("pengirim") ? history.requesterName || "-" : undefined;
    const requesterNip = columnSet.has("nipPengirim") ? history.requesterNip || "-" : undefined;
    const scheduledDate = columnSet.has("jadwalPemeliharaan")
      ? formatDayTimeLabel(history.scheduledDate, { showWeekday: false })
      : undefined;
    const completionDate = columnSet.has("waktuSelesai")
      ? meta.completionDateLabel
      : undefined;
    const brandModel = columnSet.has("merek")
      ? meta.brandModel
      : undefined;
    const technician = columnSet.has("teknisi")
      ? history.technician || "-"
      : undefined;
    const cost = columnSet.has("biaya")
      ? meta.costLabel
      : undefined;
    const registrationNotes = columnSet.has("catatanPendaftaran")
      ? meta.registrationNotes
      : undefined;
    const damagePhotoUrl = columnSet.has("buktiKerusakan")
      ? history.damagePhotoUrl || "-"
      : undefined;
    const beforePhotoUrl = columnSet.has("fotoSebelum")
      ? history.beforePhotoUrl || "-"
      : undefined;
    const afterPhotoUrl = columnSet.has("fotoSesudah")
      ? history.afterPhotoUrl || "-"
      : undefined;
    const validationDate = columnSet.has("waktuValidasi")
      ? meta.validationDateLabel
      : undefined;
    const validatorName = columnSet.has("validator")
      ? meta.validatorName
      : undefined;
    const validatorNip = columnSet.has("validatorNip")
      ? meta.validatorNip
      : undefined;
    const afterNotes = columnSet.has("catatanAfter")
      ? meta.afterNotes
      : undefined;
    const cancellationReason = columnSet.has("alasanPembatalan")
      ? history.cancellationReason || "-"
      : undefined;

    return {
      noId,
      inventoryType,
      maintenanceType,
      assetName,
      assetCode,
      brandModel,
      assetRoom,
      requesterName,
      requesterNip,
      scheduledDate,
      damagePhotoUrl,
      technician,
      completionDate,
      cost,
      beforePhotoUrl,
      afterPhotoUrl,
      notes: afterNotes,
      registrationNotes,
      status,
      validator,
      validationDate,
      validatorName,
      validatorNip,
      cancellationReason,
    };
  };

  const selectedVisibleHistoryCount = filteredHistories.filter((history) =>
    selectedHistoryIds.has(history.id)
  ).length;

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
            <span className="text-[13px] text-muted-foreground">
              {selectedVisibleHistoryCount
                ? `${selectedVisibleHistoryCount} baris dipilih`
                : `Semua ${filteredHistories.length} baris`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PaperPrintMenu label="Cetak riwayat pemeliharaan" onPrint={() => handleHistoryExport("print")} />
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-4">
        <div className="rounded-2xl border border-border/70 bg-slate-50/60 dark:bg-slate-900/40 p-3">
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
              <option value="completed">Tindakan Selesai - Menunggu Verifikasi</option>
              <option value="validated">Selesai Pemeliharaan Sarana</option>
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
        <div className="px-3 pb-4 sm:px-4 sm:pb-4">
          <div className="space-y-4 py-3">
            {paginatedHistories.map((h) => {
            const meta = getHistoryCardMeta(h);
            const historyNoId = getHistoryNoId(h);
            const isExpanded = expandedHistoryIds.has(h.id);
            return (
              <SummaryResultCard
                key={h.id}
                title="Informasi Dasar Alat"
                footer={(
                  <SummaryResultFooter
                    selected={selectedHistoryIds.has(h.id)}
                    onSelectedChange={() => toggleHistorySelection(h.id)}
                    selectionLabel={`Pilih riwayat pemeliharaan ${meta.assetName}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                      onClick={() => toggleHistorySummary(h.id)}
                      title={isExpanded ? "Sembunyikan detail" : "Lihat detail"}
                    >
                      <Eye className="h-4 w-4" />
                      Lihat
                    </Button>
                    {canComplete && !["completed", "validated", "cancelled"].includes(h.status) && editId !== h.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-teal-600 px-2.5 text-[12px] text-teal-700 hover:bg-teal-50 dark:border-teal-400/50 dark:text-teal-300 dark:hover:bg-teal-400/10"
                        onClick={() => openEdit(h)}
                      >
                        Selesai Perbaikan
                      </Button>
                    )}
                    {canValidate && h.status === "completed" && !h.validatedBy && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg border-green-600 px-2.5 text-[12px] text-green-700 hover:bg-green-50"
                        onClick={() => handleValidate(h.id)}
                      >
                        Validasi
                      </Button>
                    )}
                    {canComplete && ["completed", "validated"].includes(h.status) && editId !== h.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                        onClick={() => openEdit(h)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                        onClick={() => openDeleteDialog(h)}
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {canRequestDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10"
                        onClick={() => openArchiveRequestDialog(h)}
                        title="Ajukan hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                      onClick={() => exportSingleHistory("pdf", h)}
                    >
                      <Download className="h-4 w-4" />
                      Unduh
                    </Button>
                    <PaperPrintMenu compact label="Cetak riwayat pemeliharaan" onPrint={() => exportSingleHistory("print", h)} />
                    {canComplete && editId === h.id && (
                      <div className="grid w-full gap-2 pt-1 sm:grid-cols-2">
                        <input
                          type="text"
                          placeholder="Catatan"
                          value={completeForm.notes}
                          onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))}
                          className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground sm:col-span-2"
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
                          className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground sm:col-span-2"
                        />
                        <div className="flex gap-2 sm:col-span-2">
                          <Button
                            size="sm"
                            className="h-9 rounded-lg bg-teal-600 px-3 text-[13px] text-white hover:bg-teal-700"
                            onClick={() => handleComplete(h.id)}
                          >
                            Simpan
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-lg border-red-200 px-3 text-[13px] text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-400/10"
                            onClick={() => setEditId(null)}
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}
                  </SummaryResultFooter>
                )}
              >
                {!isExpanded && (
                  <SummaryResultBody
                    assetName={meta.assetName}
                    assetCode={meta.assetCode}
                    noId={historyNoId}
                    personLabel="Pemohon"
                    personValue={`${h.requesterName || "-"} • ${h.requesterNip || "-"}`}
                    unitLabel="Ruangan pemohon"
                    unitValue={meta.requesterRoom}
                    unitExtra={`Teknisi: ${h.technician || "-"}`}
                    timeLabel="Waktu Selesai"
                    timeValue={meta.completionDateLabel}
                    badges={(
                      <>
                        <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${assetSourceBadgeClass(meta.assetSource)}`}>
                          {meta.inventoryBadgeLabel}
                        </Badge>
                        <Badge className={`rounded-full border px-2 py-0.5 text-[11px] ${maintenanceTypeBadgeClass(h.type)}`}>
                          {maintenanceTypeLabel(h.type)}
                        </Badge>
                        <Badge className={`gap-1 rounded-full border px-2 py-0.5 text-[11px] ${locationBadgeClass}`}>
                          <MapPin className="h-3 w-3" />
                          {meta.assetRoom}
                        </Badge>
                      </>
                    )}
                    statusBadges={(
                      <Badge variant={getStatusColor(h.status)} className="max-w-full rounded-full px-2.5 py-1 text-left text-[11px] font-medium whitespace-normal wrap-break-word leading-tight sm:text-[12px]">
                        {maintenanceStatusLabel(h.status, h.type)}
                      </Badge>
                    )}
                  />
                )}
                {isExpanded && (
                  <div className="space-y-3 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-3 sm:py-3">
                      <div className="columns-1 gap-3 lg:columns-2">
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Informasi Dasar Alat" />
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                          <InfoRow label="Jenis Inventaris">{meta.inventoryBadgeLabel}</InfoRow>
                          <InfoRow label="Tipe Layanan">{maintenanceTypeLabel(h.type)}</InfoRow>
                          <InfoRow label="Prioritas">{meta.priorityLabel}</InfoRow>
                          <InfoRow label="No ID Jadwal">{historyNoId}</InfoRow>
                          <InfoRow label="Nama Alat">{meta.assetName}</InfoRow>
                          <InfoRow label="Kode Alat">{meta.assetCode}</InfoRow>
                          <InfoRow label="Nama Ruangan Alat">{meta.assetRoom}</InfoRow>
                          <InfoRow label="Merek / Model">{meta.brandModel}</InfoRow>
                        </div>
                      </div>
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Detail Administrasi" />
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                          <InfoRow label="Nama Pengirim">{h.requesterName || "-"}</InfoRow>
                          <InfoRow label="NIP Pengirim">{h.requesterNip || "-"}</InfoRow>
                          <InfoRow label="Jadwal Pemeliharaan Sarana">{meta.scheduledLabel}</InfoRow>
                          <InfoRow label="Estimasi Durasi">{meta.estimatedDurationLabel}</InfoRow>
                          <InfoRow label="Batas Penyelesaian (SLA)">{meta.dueAtLabel}</InfoRow>
                          <InfoRow label="Status SLA">{meta.slaLabel}</InfoRow>
                          <InfoRow label="Catatan Pendaftaran">{meta.registrationNotes}</InfoRow>
                          <InfoRow label="Bukti Kerusakan">{h.damagePhotoUrl ? <a className="text-teal-700 underline dark:text-teal-300" href={h.damagePhotoUrl} target="_blank" rel="noreferrer">Lihat lampiran</a> : "-"}</InfoRow>
                        </div>
                      </div>
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Pelaksanaan & Biaya" />
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                          <InfoRow label="Teknisi Pelaksana">{h.technician || "-"}</InfoRow>
                          <InfoRow label="NIP Teknisi/PJ">{h.technicianNip || "-"}</InfoRow>
                          <InfoRow label="Vendor/Penyedia Jasa">{h.vendorName || "-"}</InfoRow>
                          <InfoRow label="Referensi Vendor">{h.vendorReference || "-"}</InfoRow>
                          <InfoRow label="Estimasi Biaya">{meta.estimatedCostLabel}</InfoRow>
                          <InfoRow label="Waktu Selesai">{meta.completionDateLabel}</InfoRow>
                          <InfoRow label="Biaya Pemeliharaan">{meta.costLabel}</InfoRow>
                          <InfoRow label="Diagnosis">{h.diagnosis || "-"}</InfoRow>
                          <InfoRow label="Tindakan">{h.actionTaken || "-"}</InfoRow>
                          <InfoRow label="Checklist">{h.checklist || "-"}</InfoRow>
                          <InfoRow label="Suku Cadang">{h.spareParts || "-"}</InfoRow>
                          <InfoRow label="Foto Sebelum">{h.beforePhotoUrl ? <a className="text-teal-700 underline dark:text-teal-300" href={h.beforePhotoUrl} target="_blank" rel="noreferrer">Lihat foto</a> : "-"}</InfoRow>
                          <InfoRow label="Foto Sesudah">{h.afterPhotoUrl ? <a className="text-teal-700 underline dark:text-teal-300" href={h.afterPhotoUrl} target="_blank" rel="noreferrer">Lihat foto</a> : "-"}</InfoRow>
                          <InfoRow label="Catatan (After)">{renderNotesContent(meta.afterNotes)}</InfoRow>
                          {h.status === "cancelled" && (
                            <InfoRow label="Alasan Pembatalan">{h.cancellationReason || "-"}</InfoRow>
                          )}
                        </div>
                      </div>
                      <div className="mb-3 break-inside-avoid space-y-2">
                        <SectionHeader label="Verifikasi" />
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                          <InfoRow label="Hasil Pengujian">{h.verificationResult || "-"}</InfoRow>
                          <InfoRow label="Kondisi Akhir">{h.finalCondition || "-"}</InfoRow>
                          <InfoRow label="Catatan Verifikasi">{h.verificationNotes || "-"}</InfoRow>
                          <InfoRow label="Jadwal Berikutnya">{meta.nextMaintenanceDateLabel}</InfoRow>
                          <InfoRow label="Validator">{meta.validatorName}</InfoRow>
                          <InfoRow label="NIP Validator">{meta.validatorNip}</InfoRow>
                          <InfoRow label="Waktu Validasi">{meta.validationDateLabel}</InfoRow>
                        </div>
                      </div>
                      </div>
                    </div>
                )}
              </SummaryResultCard>
            )
          })}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan {historyStartIndex + 1}-{Math.min(historyStartIndex + HISTORY_ROWS_PER_PAGE, filteredHistories.length)} dari {filteredHistories.length} riwayat
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentHistoryPage === 1}
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                aria-label="Halaman riwayat pemeliharaan sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {visibleHistoryPages.map((page) => (
                typeof page === "number" ? (
                  <Button
                    key={page}
                    type="button"
                    variant={page === currentHistoryPage ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToHistoryPage(page)}
                    aria-label={`Halaman riwayat pemeliharaan ${page}`}
                    aria-current={page === currentHistoryPage ? "page" : undefined}
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={page} className="flex h-8 w-8 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                    ...
                  </span>
                )
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentHistoryPage === totalHistoryPages}
                onClick={() => setHistoryPage((page) => Math.min(totalHistoryPages, page + 1))}
                aria-label="Halaman riwayat pemeliharaan berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const wrapperClasses = cn(
    "rounded-2xl border border-border bg-background shadow-sm",
    wrapperClassName
  );

  const pendingDeleteAssetLabel = pendingDeleteHistory?.assetDetailName
    || pendingDeleteHistory?.assetName
    || pendingDeleteHistory?.assetCode
    || "aset ini";
  const pendingDeleteRecordLabel = pendingDeleteHistory?.maintenanceCode ? ` (${pendingDeleteHistory.maintenanceCode})` : "";
  const deleteDialog = (
    <Dialog open={Boolean(pendingDeleteHistory)} onOpenChange={(open) => !open && closeDeleteDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Arsipkan riwayat pemeliharaan?</DialogTitle>
          <DialogDescription>
            Riwayat {pendingDeleteAssetLabel}{pendingDeleteRecordLabel} akan disembunyikan dari daftar utama, tetapi tetap tersimpan sebagai arsip Admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="maintenance-delete-reason">
            Alasan penghapusan
          </label>
          <Textarea
            id="maintenance-delete-reason"
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            placeholder="Contoh: data duplikat, salah input, atau koreksi audit"
            disabled={isDeletingHistory}
            className="min-h-24"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={isDeletingHistory}>
            Batal
          </Button>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
            onClick={handleDelete}
            disabled={isDeletingHistory || !deleteReason.trim()}
          >
            {isDeletingHistory ? "Mengarsipkan..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  const archiveRequestDialog = (
    <DeleteReasonDialog
      open={Boolean(pendingArchiveHistoryRequest)}
      title="Ajukan penghapusan riwayat pemeliharaan?"
      description={`Permintaan penghapusan ${pendingArchiveHistoryRequest?.assetDetailName || pendingArchiveHistoryRequest?.assetName || "riwayat ini"} akan dikirim ke Admin untuk ditinjau.`}
      value={deleteReason}
      isSubmitting={isDeletingHistory}
      confirmLabel="Ajukan"
      submittingLabel="Mengajukan..."
      onValueChange={setDeleteReason}
      onCancel={() => {
        if (isDeletingHistory) return;
        setPendingArchiveHistoryRequest(null);
        setDeleteReason("");
      }}
      onConfirm={confirmArchiveRequest}
    />
  );

  if (disableWrapper) {
    return (
      <div className="space-y-2">
        {error && <div className="text-[14px] text-red-600">{error}</div>}
        {tableContent}
        {deleteDialog}
        {archiveRequestDialog}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="text-[14px] text-red-600">{error}</div>}
      <div className={wrapperClasses}>
        {tableContent}
      </div>
      {deleteDialog}
      {archiveRequestDialog}
    </div>
  );
};

export default MaintenanceHistoryList;
