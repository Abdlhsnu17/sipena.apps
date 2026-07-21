"use client";

import { Badge } from "@/components/ui/badge";
import InventoryPicker from "@/components/inventory-picker";
import { NotificationSummary } from "@/components/notification-summary";
import { PaperPrintMenu } from "@/components/paper-print-menu";
import { SummaryResultBody, SummaryResultCard, SummaryResultFooter } from "@/components/summary-result-card";
import { assetUsageService, type AssetUsageContext, type AssetUsageLog } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { authService } from "@/services/auth.service";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import { borrowingService, type Borrowing } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { locationBadgeClass } from "@/utils/api-mappers";
import { flattenDetailInventories, getDetailInventoryStatusLabel } from "@/utils/detail-inventory";
import { formatDayTimeLabel, formatLongDateLabel } from "@/utils/format";
import { findAssetByScanTarget, parseScanTargetFromSearchParams } from "@/utils/asset-scan-target";
import { buildInventorySearchKey } from "@/utils/inventory-search";
import { formatNoId } from "@/utils/record-id";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { findMatchingAsset } from "@/utils/scanned-asset";
import { Activity, AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Download, Eye, Pencil, Plus, Save, Search, Tag, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { appendLine, ExportFormat, exportNarrativeReport, type DocumentSection, type SectionLine } from "@/utils/export-table";

const usageContextLabels: Record<AssetUsageContext, string> = {
  own_room: "Ruangan",
  same_unit_cross_room: "Antar Sub Ruangan",
  cross_room: "Antar Instalasi",
  emergency: "Emergency",
  procedure: "Antar Sub Ruangan",
  rounding: "Antar Instalasi",
  other: "Lainnya",
};

const usageContextOptions: Array<{ value: AssetUsageContext; label: string }> = [
  { value: "own_room", label: "Ruangan sendiri" },
  { value: "same_unit_cross_room", label: "Antar sub ruangan" },
  { value: "cross_room", label: "Antar instalasi" },
  { value: "emergency", label: "Emergency" },
  { value: "procedure", label: "Tindakan/prosedur" },
  { value: "rounding", label: "Rounding" },
  { value: "other", label: "Lainnya" },
];

const HISTORY_ROWS_PER_PAGE = 2;
const usageExportColumnDefinitions = [
  { key: "basic", label: "Data Alat Digunakan" },
  { key: "usage", label: "Data Pemakaian" },
  { key: "operator", label: "Operator Pemakaian" },
  { key: "notes", label: "Catatan Pemakaian" },
  { key: "status", label: "Status Pemakaian" },
] as const;

type UsageExportColumnKey = (typeof usageExportColumnDefinitions)[number]["key"];
type UsageSourceFilter = "all" | "manual" | "borrowing_sync";

const usageSourceFilterOptions: Array<{ value: UsageSourceFilter; label: string }> = [
  { value: "manual", label: "Input Manual" },
  { value: "borrowing_sync", label: "Dari Peminjaman" },
  { value: "all", label: "Semua" },
];

const buildVisiblePageItems = (currentPage: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sortedPages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);

  return sortedPages.flatMap((page, index) => {
    const previousPage = sortedPages[index - 1];
    if (index > 0 && previousPage && page - previousPage > 1) {
      return [`ellipsis-${previousPage}-${page}`, page];
    }
    return [page];
  });
};

const getAssetRoomOptions = (item?: DetailInventoryItem) => {
  if (!item) return [];
  return Array.from(
    new Set(
      [item.roomName, item.assetLocation]
        .map((value) => (value || "").trim())
        .filter(Boolean)
    )
  );
};

const getUsageRoomDisplay = (log: AssetUsageLog) => {
  const roomName = (log.roomName || "").trim();
  const assetLocation = (log.assetLocation || "").trim();
  const [workUnit, ...roomParts] = roomName.split(" - ").map((part) => part.trim()).filter(Boolean);
  const roomDetail = roomParts.join(" - ");

  if (workUnit && roomDetail) {
    return {
      primary: workUnit,
      secondary: roomDetail,
    };
  }

  if (roomName && assetLocation && roomName.toLowerCase() !== assetLocation.toLowerCase()) {
    return {
      primary: roomName,
      secondary: assetLocation,
    };
  }

  return {
    primary: roomName || assetLocation || "-",
    secondary: "",
  };
};

const toDateTimeLocalInputValue = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type FormState = {
  inventoryKey: string;
  roomName: string;
  usageContext: AssetUsageContext;
  startedAt: string;
  endedAt: string;
  usageCount: number;
  conditionBefore: string;
  notes: string;
};

type EditFormState = {
  id: number | string;
  roomName: string;
  startedAt: string;
  endedAt: string;
  usageCount: number;
  conditionBefore: string;
  conditionAfter: string;
  notes: string;
  isBorrowingSync: boolean;
};

type CompleteFormState = {
  id: number | string;
  assetLabel: string;
  endedAt: string;
  conditionAfter: string;
  notes: string;
};

type UsageDetailLine = {
  label: string;
  value: string;
};

type UsageDetailSection = {
  title: string;
  lines: UsageDetailLine[];
};

const initialForm: FormState = {
  inventoryKey: "",
  roomName: "",
  usageContext: "procedure",
  startedAt: toDateTimeLocalInputValue(),
  endedAt: "",
  usageCount: 1,
  conditionBefore: "Baik",
  notes: "",
};

const getInventoryKey = (item: DetailInventoryItem) => `${item.assetType}|${item.assetId}|${item.detailId}`;

const activeMaintenanceStatuses = new Set(["requested", "scheduled", "in_progress", "completed"]);

const formatUsageAssetLabel = (asset: DetailInventoryItem) => {
  const inventoryLabel = asset.detailInventoryName || asset.detailName || asset.assetName || "";
  const brandLabel = asset.detailBrandModel;
  const codeLabel = asset.detailCode || asset.assetCode;
  const locationLabel = asset.assetLocation ? ` (${asset.assetLocation})` : "";
  const brandSuffix = brandLabel ? ` (${brandLabel})` : "";
  const codeSuffix = codeLabel ? ` - ${codeLabel}` : "";
  return `${inventoryLabel}${brandSuffix}${codeSuffix}${locationLabel}`.trim();
};

const getConditionLabel = (asset: DetailInventoryItem) => {
  if (asset.condition === "damaged") return "Rusak";
  if (asset.condition === "poor") return "Kurang";
  if (asset.condition === "fair") return "Cukup";
  return "Baik";
};

const getInventoryLockKey = (assetType: string | undefined, assetId: number, detailId?: string | number | null) => {
  const normalizedAssetType = assetType === "non_medical" ? "non_medical" : "medical";
  const baseKey = `${normalizedAssetType}|${assetId}`;
  const normalizedDetailId = String(detailId || "").trim();
  return normalizedDetailId ? `${baseKey}|${normalizedDetailId}` : baseKey;
};

const normalizeDetailIdentifier = (value?: string | number | null) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const isAssetFallbackDetailId = (
  detailId: string | number | undefined | null,
  assetId: number,
  assetType?: string
) => {
  const normalizedDetailId = normalizeDetailIdentifier(detailId);
  if (!normalizedDetailId) return false;
  const normalizedAssetType = assetType === "non_medical" ? "non_medical" : "medical";
  return (
    normalizedDetailId === `asset-${assetId}` ||
    normalizedDetailId === `asset-${normalizedAssetType}-${assetId}`
  );
};

const isBorrowingLockRecord = (record: { status: string; returnValidatedAt?: string | null }) =>
  ["pending", "approved", "borrowed", "overdue"].includes(record.status) ||
  (record.status === "returned" && !record.returnValidatedAt);

const getEffectiveAvailability = (
  item: DetailInventoryItem,
  activeUsageLocks: Set<string>,
  activeMaintenanceLocks: Set<string>,
  activeBorrowingLocks: Set<string>,
  options: { ignoreBorrowing?: boolean } = {}
) => {
  const baseKey = getInventoryLockKey(item.assetType, item.assetId);
  const detailKey = getInventoryLockKey(item.assetType, item.assetId, item.detailId);
  const isFallbackAssetItem = isAssetFallbackDetailId(item.detailId, item.assetId, item.assetType);

  if (item.availability === "disposed") return "disposed";
  if (activeUsageLocks.has(baseKey) || activeUsageLocks.has(detailKey)) return "in_use";
  if (item.availability === "maintenance" || activeMaintenanceLocks.has(baseKey) || activeMaintenanceLocks.has(detailKey)) {
    return "maintenance";
  }
  if (item.availability === "in_use") return "in_use";
  if (!options.ignoreBorrowing && (activeBorrowingLocks.has(baseKey) || activeBorrowingLocks.has(detailKey))) return "borrowed";

  if (isFallbackAssetItem) {
    if (item.assetStatus === "disposed") return "disposed";
    if (item.assetStatus === "maintenance") return "maintenance";
    if (item.assetStatus === "in_use") return "in_use";
    if (!options.ignoreBorrowing && item.assetStatus === "borrowed") return "borrowed";
  }

  if (!options.ignoreBorrowing && item.availability === "borrowed") return "borrowed";

  return "available";
};

const normalizeLocationText = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const locationIncludes = (source: string, target?: string | null) => {
  const normalizedTarget = normalizeLocationText(target);
  return Boolean(normalizedTarget && source.includes(normalizedTarget));
};

const ROOM_MATCH_IGNORED_WORDS = new Set(["ruang", "ruangan", "ranap", "rawat", "inap", "kamar", "unit", "sub", "instalasi"]);

const getMeaningfulRoomTokens = (value: string) =>
  normalizeLocationText(value)
    .split(" ")
    .filter((token) => token && !ROOM_MATCH_IGNORED_WORDS.has(token) && (token.length >= 3 || token === "ok"));

const roomMatchesSubRoom = (assetRoomText: string, subRoom?: string | null) => {
  const normalizedAssetRoom = normalizeLocationText(assetRoomText);
  const normalizedSubRoom = normalizeLocationText(subRoom);
  if (!normalizedAssetRoom || !normalizedSubRoom) return false;
  if (normalizedAssetRoom.includes(normalizedSubRoom)) return true;

  const subRoomSegments = String(subRoom || "")
    .split(/[\/,;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return subRoomSegments.some((segment) => {
    const normalizedSegment = normalizeLocationText(segment);
    if (!normalizedSegment) return false;
    if (normalizedAssetRoom.includes(normalizedSegment)) return true;

    const meaningfulTokens = getMeaningfulRoomTokens(segment);
    return meaningfulTokens.length > 0 && meaningfulTokens.some((token) => normalizedAssetRoom.includes(token));
  });
};

const getUserUsageRoom = (user?: User | null) =>
  [user?.workUnit, user?.subWorkUnit].filter(Boolean).join(" - ");

const getAutoUsageRoom = (item: DetailInventoryItem | undefined, user: User | null) =>
  getUserUsageRoom(user) || getAssetRoomOptions(item)[0] || "";

const getAssetRoomSearchText = (item: DetailInventoryItem) =>
  normalizeLocationText([item.roomName, item.assetLocation].filter(Boolean).join(" "));

const isAssetInUserSubRoom = (item: DetailInventoryItem, user: User | null) => {
  const userSubRoom = user?.subWorkUnit?.trim();
  if (!userSubRoom) return false;

  const assetRoomText = getAssetRoomSearchText(item);
  return roomMatchesSubRoom(assetRoomText, userSubRoom);
};

const deriveUsageContextFromProfile = (
  item: DetailInventoryItem | undefined,
  user: User | null
): AssetUsageContext => {
  if (!item || !user?.workUnit) return "own_room";

  const assetLocation = normalizeLocationText(
    [
      item.roomName,
      item.assetLocation,
      item.assetName,
      item.detailName,
      item.detailInventoryName,
    ].filter(Boolean).join(" ")
  );
  const sameUnit = locationIncludes(assetLocation, user.workUnit);
  const sameSubRoom = roomMatchesSubRoom(assetLocation, user.subWorkUnit);

  // Banyak data inventaris memakai nama ruangan detail saja, misalnya
  // "Ruangan Mawar Atas", tanpa menyimpan induk "Instalasi Rawat Inap".
  // Jika sub ruangan profil cocok dengan lokasi alat, alat tetap dianggap
  // milik ruangan sendiri.
  if (sameSubRoom) return "own_room";
  if (sameUnit && !user.subWorkUnit) return "own_room";
  if (sameUnit) return "same_unit_cross_room";
  return "cross_room";
};

const getUsageNoId = (log: Pick<AssetUsageLog, "id">) => formatNoId("PMG", log.id);

const isBorrowingUsageLog = (log: AssetUsageLog): boolean => {
  return log.sourceType === "borrowing_sync" || Boolean(log.borrowingId);
};

const normalizeRole = (role?: string | null) =>
  (role || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

const canManageUsageRecord = (actor: User | null, log: AssetUsageLog): boolean => {
  if (!actor) return false;
  const role = normalizeRole(actor.role);
  if (role === "admin" || role === "leader") return true;

  const actorId = Number(actor.id);
  if (!Number.isFinite(actorId) || actorId <= 0) return false;

  return [log.operatorUserId, log.createdBy].some((value) => Number(value) === actorId);
};

const canCompleteUsage = (actor: User | null, log: AssetUsageLog): boolean =>
  !isBorrowingUsageLog(log) && canManageUsageRecord(actor, log);

const borrowingMatchesInventory = (borrowing: Borrowing, item: DetailInventoryItem) => {
  const borrowingType = borrowing.assetType === "non_medical" ? "non_medical" : "medical";
  if (borrowing.assetId !== item.assetId || borrowingType !== item.assetType) return false;

  const borrowingDetailId = normalizeDetailIdentifier(borrowing.assetDetailId);
  if (!borrowingDetailId || isAssetFallbackDetailId(borrowingDetailId, borrowing.assetId, borrowingType)) return true;
  return borrowingDetailId === normalizeDetailIdentifier(item.detailId);
};

const canUseOverdueAssetForEmergency = (actor: User | null, borrowing?: Borrowing) => {
  if (!actor || !borrowing) return false;
  const actorRole = normalizeRole(actor.role);
  if (actorRole === "admin" || actorRole === "leader") return true;
  if (Number(actor.id) === Number(borrowing.userId)) return true;
  return Boolean(borrowing.borrowerRole) && actorRole === normalizeRole(borrowing.borrowerRole);
};

const dispatchInventoryRefresh = () => {
  window.dispatchEvent(new Event("inventory-refresh"));
};

export default function AssetUsagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const canDeleteAssetUsage = ["admin", "leader"].includes(normalizeRole(currentUser?.role));
  const [assets, setAssets] = useState<DetailInventoryItem[]>([]);
  const [logs, setLogs] = useState<AssetUsageLog[]>([]);
  const [activeUsageLocks, setActiveUsageLocks] = useState<Set<string>>(new Set());
  const [activeMaintenanceLocks, setActiveMaintenanceLocks] = useState<Set<string>>(new Set());
  const [activeBorrowingLocks, setActiveBorrowingLocks] = useState<Set<string>>(new Set());
  const [overdueBorrowings, setOverdueBorrowings] = useState<Borrowing[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [usageSourceFilter, setUsageSourceFilter] = useState<UsageSourceFilter>("all");
  const [selectedUsageIds, setSelectedUsageIds] = useState<number[]>([]);
  const [selectedUsageColumns] = useState<UsageExportColumnKey[]>(
    usageExportColumnDefinitions.map((column) => column.key)
  );
  const [showForm, setShowForm] = useState(false);
  const [isUsageHistoryMinimized, setIsUsageHistoryMinimized] = useState(false);
  const [expandedUsageHistoryIds, setExpandedUsageHistoryIds] = useState<number[]>([]);
  const [usageHistoryPage, setUsageHistoryPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteFormState | null>(null);
  const [pendingDeleteLog, setPendingDeleteLog] = useState<AssetUsageLog | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeletingLog, setIsDeletingLog] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace(buildLoginRedirectUrl());
      return;
    }
    setCurrentUser(user);

    // Refresh profile from server so sub-room (subWorkUnit) reflects the latest
    // value instead of the one cached in the session at login time.
    authService
      .getProfile()
      .then((response) => {
        if (response.success && response.data?.user) {
          setCurrentUser(response.data.user);
        }
      })
      .catch(() => undefined);
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [medicalAssetResponse, nonMedicalAssetResponse, usageResponse, maintenanceResponse, borrowingResponse] = await Promise.all([
        assetService.getAll({ page: 1, limit: 1000, type: "medical" }),
        assetService.getAll({ page: 1, limit: 1000, type: "non_medical" }),
        assetUsageService.getAllPages(),
        maintenanceService.getAll({ page: 1, limit: 1000 }),
        borrowingService.getAll({ page: 1, limit: 1000 }),
      ]);

      if (medicalAssetResponse.success || nonMedicalAssetResponse.success) {
        const combinedAssets = [
          ...(medicalAssetResponse.success ? medicalAssetResponse.data : []),
          ...(nonMedicalAssetResponse.success ? nonMedicalAssetResponse.data : []),
        ];
        const items = flattenDetailInventories(combinedAssets, { includeAssetFallback: true });
        setAssets(items);
      }

      if (usageResponse.success) {
        setLogs(usageResponse.data);

        const nextUsageLocks = new Set<string>();
        usageResponse.data.forEach((record) => {
          if (record.endedAt) return;

          const assetType = record.assetType === "non_medical" ? "non_medical" : "medical";
          const assetId = Number(record.assetId);
          if (!Number.isFinite(assetId) || assetId <= 0) return;

          const detailId = normalizeDetailIdentifier(record.assetDetailId);
          if (detailId && !isAssetFallbackDetailId(detailId, assetId, assetType)) {
            nextUsageLocks.add(getInventoryLockKey(assetType, assetId, detailId));
            return;
          }

          nextUsageLocks.add(getInventoryLockKey(assetType, assetId));
        });
        setActiveUsageLocks(nextUsageLocks);
      } else {
        setActiveUsageLocks(new Set());
      }

      if (maintenanceResponse.success) {
        const nextMaintenanceLocks = new Set<string>();
        maintenanceResponse.data.forEach((record) => {
          if (!activeMaintenanceStatuses.has(record.status)) return;

          const assetType = record.assetType === "non_medical" ? "non_medical" : "medical";
          const assetId = Number(record.assetId);
          if (!Number.isFinite(assetId) || assetId <= 0) return;

          const detailId = normalizeDetailIdentifier(record.assetDetailId);
          if (detailId && !isAssetFallbackDetailId(detailId, assetId, assetType)) {
            nextMaintenanceLocks.add(getInventoryLockKey(assetType, assetId, detailId));
            return;
          }

          nextMaintenanceLocks.add(getInventoryLockKey(assetType, assetId));
        });
        setActiveMaintenanceLocks(nextMaintenanceLocks);
      } else {
        setActiveMaintenanceLocks(new Set());
      }

      if (borrowingResponse.success) {
        const nextBorrowingLocks = new Set<string>();
        borrowingResponse.data.forEach((record) => {
          if (!isBorrowingLockRecord(record)) return;

          const assetType = record.assetType === "non_medical" ? "non_medical" : "medical";
          const assetId = Number(record.assetId);
          if (!Number.isFinite(assetId) || assetId <= 0) return;

          const detailId = normalizeDetailIdentifier(record.assetDetailId);
          if (detailId && !isAssetFallbackDetailId(detailId, assetId, assetType)) {
            nextBorrowingLocks.add(getInventoryLockKey(assetType, assetId, detailId));
            return;
          }

          nextBorrowingLocks.add(getInventoryLockKey(assetType, assetId));
        });
        setActiveBorrowingLocks(nextBorrowingLocks);
        setOverdueBorrowings(borrowingResponse.data.filter((r) => r.status === "overdue"));
      } else {
        setActiveBorrowingLocks(new Set());
        setOverdueBorrowings([]);
      }
    } catch (error) {
      console.error("Error loading asset usage:", error);
      setActiveUsageLocks(new Set());
      setActiveMaintenanceLocks(new Set());
      setActiveBorrowingLocks(new Set());
      toast({ title: "Data penggunaan belum termuat", description: "Data penggunaan alat belum dapat dimuat.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) void loadData();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const handleInventoryRefresh = () => {
      void loadData();
    };

    window.addEventListener("inventory-refresh", handleInventoryRefresh);
    return () => window.removeEventListener("inventory-refresh", handleInventoryRefresh);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const refreshOnFocus = () => {
      void loadData();
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") {
        void loadData();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [currentUser]);

  const selectedAsset = useMemo(
    () => assets.find((item) => getInventoryKey(item) === form.inventoryKey),
    [assets, form.inventoryKey]
  );

  const selectableAssets = useMemo(() => {
    return assets.filter((item) => {
      if (item.assetStatus === "disposed" || item.condition === "damaged") return false;
      if (!isAssetInUserSubRoom(item, currentUser)) return false;

      const regularAvailability = getEffectiveAvailability(
        item,
        activeUsageLocks,
        activeMaintenanceLocks,
        activeBorrowingLocks
      );
      if (regularAvailability === "available") return true;
      if (form.usageContext !== "emergency") return false;

      const overdueBorrowing = overdueBorrowings.find((borrowing) => borrowingMatchesInventory(borrowing, item));
      if (!canUseOverdueAssetForEmergency(currentUser, overdueBorrowing)) return false;

      return getEffectiveAvailability(
        item,
        activeUsageLocks,
        activeMaintenanceLocks,
        activeBorrowingLocks,
        { ignoreBorrowing: true }
      ) === "available";
    });
  }, [activeBorrowingLocks, activeMaintenanceLocks, activeUsageLocks, assets, currentUser, form.usageContext, overdueBorrowings]);

  const noSelectableAssetMessage = currentUser?.subWorkUnit?.trim()
    ? "Tidak ada alat inventaris yang tersedia"
    : "Sub ruangan akun belum diisi, sehingga alat penggunaan tidak dapat dipilih.";

  const overdueEmergencyWarning = useMemo(() => {
    if (!selectedAsset || form.usageContext !== "emergency") return null;
    const overdue = overdueBorrowings.find((borrowing) => borrowingMatchesInventory(borrowing, selectedAsset));
    if (!overdue) return null;
    const isAllowed = canUseOverdueAssetForEmergency(currentUser, overdue);
    return { overdue, isAllowed };
  }, [selectedAsset, form.usageContext, overdueBorrowings, currentUser]);

  useEffect(() => {
    if (!form.inventoryKey) return;
    const currentStillSelectable = selectableAssets.some((item) => getInventoryKey(item) === form.inventoryKey);
    if (currentStillSelectable) return;

    setForm((prev) => ({ ...prev, inventoryKey: "" }));
  }, [form.inventoryKey, selectableAssets]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const sourceType = isBorrowingUsageLog(log) ? "borrowing_sync" : "manual";
      if (usageSourceFilter !== "all" && sourceType !== usageSourceFilter) return false;

      const matchesSearch = matchesSearchKeyword(searchTerm, [
        getUsageNoId(log),
        log.assetDetailName,
        log.assetName,
        log.assetDetailCode,
        log.assetCode,
        log.roomName,
        log.operatorName,
        log.notes,
        isBorrowingUsageLog(log) ? "Dari Peminjaman" : "Input Manual",
        log.endedAt ? "Selesai" : "Sedang Digunakan",
      ]);
      return matchesSearch;
    });
  }, [logs, searchTerm, usageSourceFilter]);

  const usageSourceCounts = useMemo(() => {
    return logs.reduce<Record<UsageSourceFilter, number>>(
      (acc, log) => {
        acc.all += 1;
        acc[isBorrowingUsageLog(log) ? "borrowing_sync" : "manual"] += 1;
        return acc;
      },
      { all: 0, manual: 0, borrowing_sync: 0 }
    );
  }, [logs]);

  useEffect(() => {
    setUsageHistoryPage(1);
  }, [logs.length, searchTerm, usageSourceFilter]);

  const totalUsageHistoryPages = Math.max(1, Math.ceil(filteredLogs.length / HISTORY_ROWS_PER_PAGE));
  const currentUsageHistoryPage = Math.min(usageHistoryPage, totalUsageHistoryPages);
  const usageHistoryStartIndex = (currentUsageHistoryPage - 1) * HISTORY_ROWS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(usageHistoryStartIndex, usageHistoryStartIndex + HISTORY_ROWS_PER_PAGE);
  const visibleUsageHistoryPages = buildVisiblePageItems(currentUsageHistoryPage, totalUsageHistoryPages);
  const goToUsageHistoryPage = (page: number) => {
    setUsageHistoryPage(Math.min(totalUsageHistoryPages, Math.max(1, page)));
  };
  const selectedUsageRows = useMemo(
    () => filteredLogs.filter((log) => selectedUsageIds.includes(log.id)),
    [filteredLogs, selectedUsageIds]
  );
  const toggleUsageSelection = (id: number) => {
    setSelectedUsageIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };
  useEffect(() => {
    setSelectedUsageIds((prev) => prev.filter((id) => filteredLogs.some((log) => log.id === id)));
  }, [filteredLogs]);

  const summary = useMemo(() => {
    const totalRecords = filteredLogs.length;
    const completedUsage = filteredLogs.filter((log) => Boolean(log.endedAt)).length;
    const activeUsage = filteredLogs.filter((log) => !log.endedAt).length;
    const activeAssetLabels = filteredLogs
      .filter((log) => !log.endedAt)
      .map((log) => log.assetDetailName || log.assetName || "-")
      .filter(Boolean);
    const topAsset = Object.entries(
      filteredLogs.reduce<Record<string, { label: string; count: number }>>((acc, log) => {
        const key = `${log.assetType}|${log.assetId}|${log.assetDetailId || log.assetDetailCode || log.assetCode}`;
        const label = log.assetDetailName || log.assetName || "-";
        acc[key] = { label, count: (acc[key]?.count || 0) + (log.usageCount || 1) };
        return acc;
      }, {})
    ).sort((a, b) => b[1].count - a[1].count)[0]?.[1];

    return { totalRecords, completedUsage, activeUsage, activeAssetLabels, topAsset };
  }, [filteredLogs]);

  const handleAssetChange = (inventoryKey: string) => {
    const item = assets.find((asset) => getInventoryKey(asset) === inventoryKey);
    const nextRoomName = getAutoUsageRoom(item, currentUser);
    const nextUsageContext = item ? deriveUsageContextFromProfile(item, currentUser) : "own_room";
    setForm((prev) => ({
      ...prev,
      inventoryKey,
      roomName: nextRoomName || prev.roomName,
      usageContext: prev.usageContext === "emergency" ? "emergency" : nextUsageContext,
    }));
  };

  useEffect(() => {
    if (searchParams.get("openForm") !== "1") return;
    setShowForm(true);
    const target = parseScanTargetFromSearchParams(searchParams);
    const query = searchParams.get("q")?.trim();
    if (!target && !query) return;
    if (selectableAssets.length === 0) return;

    const match = findAssetByScanTarget(selectableAssets, target, query, (assets, q) =>
      findMatchingAsset(assets, q, buildInventorySearchKey),
    );
    if (!match) {
      toast({
        title: "Alat tidak ditemukan",
        description: "Aset dari hasil scan tidak ditemukan di daftar yang tersedia untuk digunakan.",
        variant: "destructive",
      });
      return;
    }

    handleAssetChange(getInventoryKey(match));
  }, [searchParams, selectableAssets.length]);

  useEffect(() => {
    if (!selectedAsset) return;
    const nextRoomName = getAutoUsageRoom(selectedAsset, currentUser);
    const nextUsageContext = deriveUsageContextFromProfile(selectedAsset, currentUser);
    setForm((prev) => {
      const resolvedUsageContext = prev.usageContext === "emergency" ? "emergency" : nextUsageContext;
      if (prev.roomName === nextRoomName && prev.usageContext === resolvedUsageContext) return prev;
      return {
        ...prev,
        roomName: nextRoomName || prev.roomName,
        usageContext: resolvedUsageContext,
      };
    });
  }, [currentUser, selectedAsset]);

  const handleSubmit = async () => {
    if (!selectedAsset) {
      toast({ title: "Pilih alat", description: "Alat yang digunakan wajib dipilih.", variant: "destructive" });
      return;
    }
    if (!selectableAssets.some((item) => getInventoryKey(item) === form.inventoryKey)) {
      toast({
        title: "Alat tidak tersedia",
        description: "Alat sedang digunakan, dipinjam, dalam pemeliharaan, atau tidak aktif.",
        variant: "destructive",
      });
      return;
    }
    if (!form.roomName.trim()) {
      toast({ title: "Ruangan wajib diisi", description: "Isi ruangan pemakaian alat.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await assetUsageService.create({
        assetId: selectedAsset.assetId,
        assetType: selectedAsset.assetType,
        assetDetailId: selectedAsset.detailId,
        assetDetailName: selectedAsset.detailInventoryName || selectedAsset.detailName,
        assetDetailCode: selectedAsset.detailCode,
        assetLocation: selectedAsset.assetLocation,
        roomName: form.roomName.trim(),
        operatorUserId: currentUser?.id ? Number(currentUser.id) : undefined,
        usageContext: form.usageContext,
        startedAt: form.startedAt,
        endedAt: form.endedAt || undefined,
        usageCount: form.usageCount,
        conditionBefore: form.conditionBefore,
        notes: form.notes,
      });

      if (response.success) {
        toast({ title: "Penggunaan alat dicatat", description: "Frekuensi pemakaian alat berhasil ditambahkan." });
        setForm({ ...initialForm, startedAt: toDateTimeLocalInputValue() });
        setShowForm(false);
        await loadData();
        dispatchInventoryRefresh();
      } else {
        toast({
          title: "Penggunaan belum tersimpan",
          description: response.message || "Catatan penggunaan alat belum tersimpan.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving asset usage:", error);
      toast({ title: "Penggunaan belum tersimpan", description: "Terjadi kesalahan saat menyimpan catatan penggunaan alat.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (log: AssetUsageLog) => {
    if (!canDeleteAssetUsage) return;
    setPendingDeleteLog(log);
    setDeleteReason("");
  };

  const confirmDeleteLog = async () => {
    if (!pendingDeleteLog) return;
    const reason = deleteReason.trim();
    if (!reason) {
      toast({ title: "Alasan wajib diisi", description: "Alasan pengarsipan log penggunaan wajib diisi.", variant: "destructive" });
      return;
    }
    setIsDeletingLog(true);
    try {
      const response = await assetUsageService.delete(pendingDeleteLog.id, reason);
      if (!response.success) {
        toast({ title: "Log belum diarsipkan", description: response.message || "Log penggunaan belum dapat diarsipkan.", variant: "destructive" });
        return;
      }
      setPendingDeleteLog(null);
      setDeleteReason("");
      await loadData();
      dispatchInventoryRefresh();
    } catch (error) {
      console.error("Error archiving asset usage:", error);
      toast({ title: "Log belum diarsipkan", description: "Terjadi kesalahan saat mengarsipkan log penggunaan.", variant: "destructive" });
    } finally {
      setIsDeletingLog(false);
    }
  };

  const openEditDialog = (log: AssetUsageLog) => {
    setEditForm({
      id: log.id,
      roomName: log.roomName || "",
      startedAt: toDateTimeLocalInputValue(log.startedAt ? new Date(log.startedAt) : new Date()),
      endedAt: log.endedAt ? toDateTimeLocalInputValue(new Date(log.endedAt)) : "",
      usageCount: log.usageCount || 1,
      conditionBefore: log.conditionBefore || "Baik",
      conditionAfter: log.conditionAfter || "",
      notes: log.notes || "",
      isBorrowingSync: isBorrowingUsageLog(log),
    });
  };

  const handleEditUsage = async () => {
    if (!editForm) return;

    setIsSaving(true);
    try {
      const response = await assetUsageService.update(editForm.id, {
        roomName: editForm.roomName.trim(),
        startedAt: editForm.startedAt,
        endedAt: editForm.isBorrowingSync ? undefined : editForm.endedAt || undefined,
        usageCount: editForm.usageCount,
        conditionBefore: editForm.conditionBefore.trim(),
        conditionAfter: editForm.conditionAfter.trim() || undefined,
        notes: editForm.notes.trim(),
      });

      if (response.success) {
        toast({
          title: "Pemakaian diperbarui",
          description: "Data riwayat pemakaian berhasil disimpan.",
        });
        setEditForm(null);
        await loadData();
        dispatchInventoryRefresh();
      } else {
        toast({
          title: "Perubahan belum tersimpan",
          description: response.message || "Tidak dapat memperbarui data pemakaian.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error editing asset usage:", error);
      toast({
        title: "Perubahan belum tersimpan",
        description: "Terjadi kesalahan saat menyimpan data pemakaian.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openCompleteDialog = (log: AssetUsageLog) => {
    setCompleteForm({
      id: log.id,
      assetLabel: log.assetDetailName || log.assetName || "Alat",
      endedAt: toDateTimeLocalInputValue(),
      conditionAfter: log.conditionAfter || log.conditionBefore || "Baik",
      notes: log.notes || "",
    });
  };

  const handleStatusChange = (log: AssetUsageLog, status: string) => {
    if (status !== "completed" || log.endedAt) return;
    if (isBorrowingUsageLog(log)) {
      router.push(log.borrowingId ? `/returns?borrowingId=${log.borrowingId}` : "/returns", { scroll: false });
      return;
    }
    openCompleteDialog(log);
  };

  const handleCompleteUsage = async () => {
    if (!completeForm) return;
    if (!completeForm.endedAt) {
      toast({ title: "Waktu selesai wajib diisi", description: "Isi waktu selesai sebelum menyimpan status selesai.", variant: "destructive" });
      return;
    }
    if (!completeForm.conditionAfter.trim()) {
      toast({ title: "Kondisi akhir wajib diisi", description: "Isi kondisi akhir alat sebelum menyimpan status selesai.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await assetUsageService.update(completeForm.id, {
        endedAt: completeForm.endedAt,
        conditionAfter: completeForm.conditionAfter.trim(),
        notes: completeForm.notes.trim(),
      });

      if (response.success) {
        toast({
          title: "Penggunaan alat diselesaikan",
          description: "Kondisi akhir dan catatan penyelesaian sudah tersimpan.",
        });
        setCompleteForm(null);
        await loadData();
        dispatchInventoryRefresh();
      } else {
        toast({
          title: "Status belum diperbarui",
          description: response.message || "Tidak dapat memperbarui log penggunaan.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating asset usage status:", error);
      toast({
        title: "Status belum diperbarui",
        description: "Terjadi kesalahan saat mengubah status pemakaian alat.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getUsageConditionLabel = (log: AssetUsageLog) => {
    if (log.endedAt) {
      return log.conditionAfter || log.conditionBefore || "-";
    }

    return log.conditionBefore || log.conditionAfter || "-";
  };

  const getUsageStatusLabel = (log: AssetUsageLog) => (log.endedAt ? "Selesai" : "Sedang Digunakan");

  const getUsageSourceLabel = (log: AssetUsageLog) =>
    isBorrowingUsageLog(log)
      ? `Otomatis dari Peminjaman${log.borrowingId ? ` No. ${log.borrowingId}` : ""}`
      : "Manual";

  const getUsageConditionBadgeClass = (condition: string) => {
    const normalized = condition.toLowerCase();
    if (normalized.includes("rusak")) {
      return "rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-800 hover:bg-red-100 sm:text-[12px] dark:bg-red-400/10 dark:text-red-300 dark:hover:bg-red-400/10";
    }
    if (normalized.includes("perbaikan") || normalized.includes("perlu")) {
      return "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 sm:text-[12px] dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/10";
    }
    if (normalized.includes("baik")) {
      return "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 sm:text-[12px] dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/10";
    }
    return "rounded-full bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 sm:text-[12px]";
  };

  const getUsageDetailSections = (
    log: AssetUsageLog,
    visibleColumns: UsageExportColumnKey[] = selectedUsageColumns,
  ): UsageDetailSection[] => {
    const sections: UsageDetailSection[] = [];
    const usageContextLabel = usageContextLabels[log.usageContext] || log.usageContext || "-";

    const pushIfVisible = (key: UsageExportColumnKey, section: UsageDetailSection) => {
      if (visibleColumns.includes(key)) sections.push(section);
    };

    pushIfVisible("basic", {
      title: "Data Alat Digunakan",
      lines: [
        { label: "No ID Pemakaian", value: getUsageNoId(log) },
        { label: "Sumber Pencatatan", value: getUsageSourceLabel(log) },
        { label: "Jenis Inventaris", value: log.assetType === "medical" ? "Medis" : "Non-Medis" },
        { label: "Nama Alat", value: log.assetDetailName || log.assetName || "-" },
        { label: "Kode Alat", value: log.assetDetailCode || log.assetCode || "-" },
        { label: "Lokasi Alat", value: log.assetLocation || "-" },
      ],
    });

    pushIfVisible("usage", {
      title: "Data Pemakaian",
      lines: [
        { label: "Ruangan Pengguna", value: getUsageRoomDisplay(log).primary },
        { label: "Lokasi Alat Tercatat", value: getUsageRoomDisplay(log).secondary || log.assetLocation || "-" },
        { label: "Jenis Pemakaian", value: usageContextLabel },
        { label: "Waktu Mulai", value: formatDayTimeLabel(log.startedAt) || "-" },
        { label: "Jumlah", value: String(log.usageCount || 1) },
        { label: "Kondisi Awal", value: log.conditionBefore || "-" },
      ],
    });

    pushIfVisible("operator", {
      title: "Operator Pemakaian",
      lines: [
        { label: "Nama Operator", value: log.operatorName || "-" },
        { label: "NIP Operator", value: log.operatorNip || "-" },
      ],
    });

    pushIfVisible("notes", {
      title: "Catatan Pemakaian",
      lines: [
        { label: "Waktu Selesai", value: formatDayTimeLabel(log.endedAt) || "-" },
        { label: "Kondisi Akhir", value: log.conditionAfter || "-" },
        { label: "Catatan", value: log.notes?.trim() || "-" },
      ],
    });

    pushIfVisible("status", {
      title: "Status Pemakaian",
      lines: [
        { label: "Status", value: getUsageStatusLabel(log) },
        { label: "Kondisi Saat Ini", value: getUsageConditionLabel(log) },
      ],
    });

    return sections;
  };

  const buildUsageLetterSections = (log: AssetUsageLog): DocumentSection[] => {
    const usageContextLabel = usageContextLabels[log.usageContext] || log.usageContext || "-";
    const operatorLabel = log.operatorName || log.createdByName || "-";
    const roomDisplay = getUsageRoomDisplay(log);
    const usageNotes = [
      usageContextLabel,
      log.notes?.trim(),
      `Jumlah penggunaan: ${log.usageCount || 1}`,
    ].filter(Boolean).join("\n");
    const statusNotes = [
      `Status: ${getUsageStatusLabel(log)}`,
      `Kondisi awal: ${log.conditionBefore || "-"}`,
      `Kondisi akhir: ${log.conditionAfter || "-"}`,
    ].join("\n");

    const main: SectionLine[] = []
    appendLine(main, 'Nomor Surat', getUsageNoId(log))
    appendLine(main, 'Sumber Pencatatan', getUsageSourceLabel(log))
    appendLine(main, 'Operator', operatorLabel)
    appendLine(main, 'NIP Operator', log.operatorNip || '-')
    appendLine(main, 'Nama Alat', log.assetDetailName || log.assetName || '-')
    appendLine(main, 'Kode Alat', log.assetDetailCode || log.assetCode || '-')
    appendLine(main, 'Ruangan Pengguna', roomDisplay.secondary ? `${roomDisplay.primary}\n${roomDisplay.secondary}` : roomDisplay.primary)
    appendLine(main, 'Waktu Mulai', formatDayTimeLabel(log.startedAt) || '-')
    appendLine(main, 'Waktu Selesai', formatDayTimeLabel(log.endedAt) || '-')
    appendLine(main, 'Tujuan / Keterangan', usageNotes || '-')

    const sign: SectionLine[] = []
    appendLine(sign, 'Tempat, Tanggal', `Jakarta, ${formatLongDateLabel(new Date()) || '-'}`)
    appendLine(sign, 'Penanggung Jawab', operatorLabel)
    appendLine(sign, 'Keterangan', statusNotes)

    return [
      { title: 'PENGGUNAAN', lines: main },
      { title: 'PENUTUP & TANDA TANGAN', lines: sign },
    ]
  }

  const exportSingleUsageLetter = async (format: ExportFormat, log: AssetUsageLog) => {
    void exportNarrativeReport(format, {
      title: `Penggunaan - ${log.operatorName || log.id}`,
      subtitle: 'PENGGUNAAN',
      entries: [log],
      filePrefix: `penggunaan-${log.id}`,
      buildSections: buildUsageLetterSections,
      emptyMessage: 'Tidak ada data pemakaian yang dipilih.',
      showEntryHeader: false,
    })
  }

  const exportUsageList = async (format: ExportFormat) => {
    const entries = selectedUsageRows.length ? selectedUsageRows : filteredLogs;
    await exportNarrativeReport(format, {
      title: "Riwayat Penggunaan",
      subtitle: "PENGGUNAAN",
      entries,
      filePrefix: "riwayat-penggunaan",
      buildSections: (log) => getUsageDetailSections(log, selectedUsageColumns),
      emptyMessage: "Tidak ada data pemakaian yang dipilih.",
      showEntryHeader: false,
    });
  };

  const toggleUsageHistoryCard = (id: number) => {
    setExpandedUsageHistoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-full w-full space-y-5">
      <section className="rounded-3xl border border-teal-100/80 bg-white/90 p-4 shadow-2xl backdrop-blur-sm dark:border-teal-800/60 dark:bg-slate-900/70 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:items-center sm:gap-5">
            <div className="rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-foreground">Penggunaan</h1>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700 sm:w-auto"
            onClick={() => {
              setForm({ ...initialForm, startedAt: toDateTimeLocalInputValue() });
              setShowForm(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Tambah Penggunaan
          </Button>
        </div>
      </section>

      <NotificationSummary
        ariaLabel="Pemberitahuan penggunaan"
        items={[
          {
            label: "Total Catatan",
            value: summary.totalRecords,
            icon: Activity,
            tone: "slate",
            description: "Semua riwayat pemakaian",
          },
          {
            label: "Selesai Penggunaan",
            value: summary.completedUsage,
            icon: Check,
            tone: "teal",
            description: "Alat sudah selesai digunakan",
          },
          {
            label: "Belum Diselesaikan",
            value: summary.activeUsage,
            icon: AlertCircle,
            tone: "rose",
            description:
              summary.activeUsage > 0
                ? `${summary.activeAssetLabels.slice(0, 2).join(", ")} masih digunakan`
                : "Tidak ada alat tertahan",
          },
          {
            label: "Paling Sering",
            value: summary.topAsset?.count ?? 0,
            icon: Check,
            tone: "cyan",
            description: summary.topAsset?.label || "Belum ada data",
          },
        ]}
      />

      <div className="flex flex-col gap-4">
        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            if (open) return;
            setShowForm(false);
            setForm({ ...initialForm, startedAt: toDateTimeLocalInputValue() });
          }}
        >
          {showForm && (
            <DialogContent
              showCloseButton={false}
              className="max-h-[90dvh] w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-2xl p-0 sm:w-full sm:max-w-2xl"
            >
              <DialogTitle className="sr-only">Tambah Penggunaan</DialogTitle>
              <DialogDescription className="sr-only">
                Formulir penggunaan dengan area gulir mandiri.
              </DialogDescription>
              <div className="flex max-h-[90dvh] flex-col overflow-hidden text-sm">
                <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
                  <h2 className="text-base font-semibold text-foreground">Tambah Penggunaan</h2>
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-label="Tutup formulir penggunaan"
                      onClick={() => {
                        setShowForm(false);
                        setForm({ ...initialForm, startedAt: toDateTimeLocalInputValue() });
                      }}
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Jenis Pemakaian</label>
                    <Select
                      value={form.usageContext}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, usageContext: value as AssetUsageContext }))}
                    >
                      <SelectTrigger className="mt-1 h-12">
                        <SelectValue placeholder="Pilih jenis pemakaian" />
                      </SelectTrigger>
                      <SelectContent>
                        {usageContextOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Alat</label>
                    <div className="mt-1">
                      <InventoryPicker
                        assets={selectableAssets}
                        selectedAsset={selectedAsset}
                        onSelect={(asset) => handleAssetChange(getInventoryKey(asset))}
                        formatLabel={formatUsageAssetLabel}
                        getItemKey={getInventoryKey}
                        getAssetCategory={(asset) => asset.assetType}
                        showCategoryFilter
                        searchValue={buildInventorySearchKey}
                        placeholder="Cari inventaris..."
                        buttonLabel="Pilih alat"
                        ariaLabel="Pilih alat untuk pemakaian"
                        selectedAssetLabel={formatUsageAssetLabel}
                        renderItemMeta={(asset) => (
                          <span>
                            Status: {getDetailInventoryStatusLabel(asset)} · Kondisi: {getConditionLabel(asset)}
                          </span>
                        )}
                        noResultsLabel={noSelectableAssetMessage}
                      />
                    </div>
                    {selectableAssets.length === 0 && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        {noSelectableAssetMessage}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Mulai</label>
                    <Input type="datetime-local" value={form.startedAt} onChange={(event) => setForm((prev) => ({ ...prev, startedAt: event.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Selesai</label>
                    <Input type="datetime-local" value={form.endedAt} onChange={(event) => setForm((prev) => ({ ...prev, endedAt: event.target.value }))} />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Jumlah</label>
                    <Input type="number" min={1} value={form.usageCount} onChange={(event) => setForm((prev) => ({ ...prev, usageCount: Math.max(1, Number(event.target.value) || 1) }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Sebelum</label>
                    <Input value={form.conditionBefore} onChange={(event) => setForm((prev) => ({ ...prev, conditionBefore: event.target.value }))} />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Catatan</label>
                    <Input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Opsional" />
                  </div>
                </div>

                {overdueEmergencyWarning && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${overdueEmergencyWarning.isAllowed ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300" : "border-red-200 bg-red-50 text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300"}`}>
                    <p className="font-semibold">
                      {overdueEmergencyWarning.isAllowed
                        ? "Peringatan: Alat melewati batas waktu peminjaman"
                        : "Tidak Diizinkan: Alat melewati batas waktu peminjaman"}
                    </p>
                    <p className="mt-0.5">
                      {overdueEmergencyWarning.isAllowed
                        ? "Penggunaan darurat pada alat overdue diizinkan sesuai hak akses pengguna."
                        : "Penggunaan darurat pada alat yang melebihi batas waktu peminjaman hanya dapat dilakukan oleh admin, leader, atau pengguna dengan role yang sama dengan peminjam asal."}
                    </p>
                  </div>
                )}

                </div>
                <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setForm({ ...initialForm, startedAt: toDateTimeLocalInputValue() });
                    }}
                    disabled={isSaving}
                  >
                    Batal
                  </Button>
                  <Button
                    className="bg-teal-600 text-white hover:bg-teal-700 sm:min-w-48"
                    onClick={handleSubmit}
                    disabled={isSaving || isLoading || (overdueEmergencyWarning !== null && !overdueEmergencyWarning.isAllowed)}
                  >
                    <Save className="mr-2 h-4 w-4" /> {isSaving ? "Menyimpan..." : "Simpan Penggunaan"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          )}
        </Dialog>

        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800/35 bg-white/90 dark:bg-slate-900/60 shadow-xl">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-lg">Riwayat Pemakaian</CardTitle>
                <CardDescription className="text-[13px] text-muted-foreground">
                  Total: {filteredLogs.length} catatan penggunaan
                </CardDescription>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUsageHistoryMinimized((prev) => !prev)}
                  className="w-full rounded-2xl px-3 sm:w-auto"
                >
                  {isUsageHistoryMinimized ? (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Tampilkan
                    </>
                  ) : (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Sembunyikan
                    </>
                  )}
                </Button>
                <PaperPrintMenu label="Cetak daftar pemakaian aset" onPrint={() => void exportUsageList("print")} />
                <span className="text-[12px] text-muted-foreground sm:text-right sm:text-[13px]">
                  {selectedUsageRows.length
                    ? `${selectedUsageRows.length} baris dipilih`
                    : `Semua ${filteredLogs.length} baris`}
                </span>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label className="sr-only">Cari alat atau operator</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Cari No ID, aset, atau operator..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-xl border border-border/80 bg-background px-10 py-2 text-[13px] text-foreground transition focus:border-teal-500"
                  />
                </div>
              </div>
              <div className="flex w-full rounded-2xl bg-slate-100 p-1 shadow-inner dark:bg-slate-800/70 lg:w-auto">
                {usageSourceFilterOptions.map((option) => {
                  const active = usageSourceFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setUsageSourceFilter(option.value)}
                      className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold transition sm:text-[13px] lg:flex-none ${
                        active
                          ? "bg-teal-600 text-white shadow-sm dark:bg-teal-600 dark:text-white"
                          : "text-slate-600 hover:bg-white/60 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/70 dark:hover:text-slate-50"
                      }`}
                      aria-pressed={active}
                    >
                      <span>{option.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          active
                            ? "bg-white/20 text-white dark:bg-white/20 dark:text-white"
                            : "bg-white/70 text-slate-500 dark:bg-slate-900/70 dark:text-slate-400"
                        }`}
                      >
                        {usageSourceCounts[option.value]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {isUsageHistoryMinimized ? (
              <div className="rounded-2xl border border-green-100 bg-green-50/80 px-4 py-4 text-center text-sm text-green-900">
                Section riwayat pemakaian disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
                <div className="px-3 pb-4 sm:px-4 sm:pb-4">
                  <div className="space-y-4 py-3">
                  {filteredLogs.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300">
                      {isLoading
                        ? "Memuat data..."
                        : "Belum ada log penggunaan alat. Catat penggunaan manual atau proses peminjaman aktif akan tampil di sini."}
                    </div>
                  ) : (
                    paginatedLogs.map((log) => {
                      const roomDisplay = getUsageRoomDisplay(log);
                      const userLabel = log.operatorName || log.createdByName || "-";
                      const isExpanded = expandedUsageHistoryIds.includes(log.id);
                      const detailSections = getUsageDetailSections(log);
                      const leftSections = detailSections.slice(0, 2);
                      const rightSections = detailSections.slice(2);

                      return (
                        <SummaryResultCard
                          key={log.id}
                          title="Informasi Dasar Inventaris"
                          footer={(
                            <SummaryResultFooter
                              selected={selectedUsageIds.includes(log.id)}
                              onSelectedChange={() => toggleUsageSelection(log.id)}
                              selectionLabel={`Pilih riwayat penggunaan ${log.assetDetailName || log.assetName || "-"}`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                onClick={() => toggleUsageHistoryCard(log.id)}
                                title={isExpanded ? "Sembunyikan detail penggunaan" : "Lihat detail penggunaan"}
                              >
                                <Eye className="h-4 w-4" />
                                Lihat
                              </Button>
                              {!log.endedAt && (() => {
                                if (isBorrowingUsageLog(log)) {
                                  return (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStatusChange(log, "completed")}
                                      className="h-8 rounded-lg border-blue-200 px-2.5 text-[12px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-400/30 dark:text-blue-300 dark:hover:bg-blue-400/10"
                                      title="Log dari peminjaman harus diselesaikan lewat Pengembalian agar validasi alat tetap tercatat"
                                    >
                                      Buka Pengembalian
                                    </Button>
                                  );
                                }

                                const allowed = canCompleteUsage(currentUser, log);
                                return allowed ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleStatusChange(log, "completed")}
                                    className="h-8 rounded-lg bg-teal-600 px-2.5 text-[12px] font-semibold text-white hover:bg-teal-700"
                                  >
                                    Selesaikan
                                  </Button>
                                ) : (
                                  <span
                                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-100 px-2.5 text-[12px] font-medium text-slate-400 dark:border-slate-800/35 dark:bg-slate-800/60 dark:text-slate-500"
                                    title="Hanya admin, leader, atau pengguna pemilik riwayat yang dapat menyelesaikan pemakaian ini"
                                  >
                                    Selesaikan
                                  </span>
                                );
                              })()}
                              {canManageUsageRecord(currentUser, log) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-400/10"
                                  onClick={() => openEditDialog(log)}
                                  aria-label="Edit log penggunaan"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 rounded-lg px-2 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                aria-label="Unduh penggunaan"
                                title="Unduh penggunaan"
                                onClick={() => void exportSingleUsageLetter("pdf", log)}
                              >
                                <Download className="h-4 w-4" />
                                Unduh
                              </Button>
                              <PaperPrintMenu compact label="Cetak penggunaan aset" onPrint={() => void exportSingleUsageLetter("print", log)} />
                              {canDeleteAssetUsage && (
                                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-400/10" onClick={() => handleDelete(log)} aria-label="Hapus log penggunaan">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </SummaryResultFooter>
                          )}
                        >
                          {!isExpanded && (() => {
                            const conditionLabel = getUsageConditionLabel(log);
                            return (
                              <SummaryResultBody
                                assetName={log.assetDetailName || log.assetName || "-"}
                                assetCode={log.assetDetailCode || log.assetCode || "-"}
                                noId={getUsageNoId(log)}
                                personValue={`${userLabel} • ${log.operatorNip || "-"}`}
                                unitValue={roomDisplay.primary}
                                unitExtra={[
                                  roomDisplay.secondary,
                                  (usageContextLabels[log.usageContext] || log.usageContext || "").trim().toLowerCase() ===
                                  (roomDisplay.secondary || "").trim().toLowerCase()
                                    ? null
                                    : usageContextLabels[log.usageContext] || log.usageContext,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                                timeLabel={log.endedAt ? "Waktu Selesai" : "Waktu Mulai"}
                                timeValue={(log.endedAt ? formatDayTimeLabel(log.endedAt) : formatDayTimeLabel(log.startedAt)) || "-"}
                                badges={(
                                  <>
                                    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium sm:text-[12px] ${locationBadgeClass}`}>
                                      <Tag className="h-3 w-3 shrink-0" />
                                      <span className="truncate">Lokasi alat: {log.assetLocation || roomDisplay.secondary || "-"}</span>
                                    </span>
                                    {isBorrowingUsageLog(log) && (
                                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300">
                                        Dari Peminjaman
                                      </Badge>
                                    )}
                                    {!isBorrowingUsageLog(log) && (
                                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300">
                                        Input Manual
                                      </Badge>
                                    )}
                                  </>
                                )}
                                statusBadges={(
                                  <div className="w-full space-y-2.5">
                                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800/35 pt-2.5 text-[12px]">
                                      <span className="text-slate-600 dark:text-slate-300">Jumlah</span>
                                      <span className="font-bold text-slate-950 dark:text-slate-50">{log.usageCount} Unit</span>
                                    </div>
                                    {conditionLabel !== "-" && (
                                      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800/35 pt-2.5 text-[12px]">
                                        <span className="text-slate-600 dark:text-slate-300">Kondisi</span>
                                        <Badge className={getUsageConditionBadgeClass(conditionLabel)}>{conditionLabel}</Badge>
                                      </div>
                                    )}
                                    <div className="border-t border-slate-200 dark:border-slate-800/35 pt-2.5">
                                      <span
                                        className={`block w-full rounded-lg px-3 py-2 text-center text-[12px] font-semibold ${
                                          log.endedAt ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300"
                                        }`}
                                      >
                                        {getUsageStatusLabel(log)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              />
                            );
                          })()}
                          {!isExpanded && log.notes?.trim() && (
                            <div className="border-t border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 px-3 pb-3 sm:px-4">
                              <p className="text-[11px] leading-snug text-slate-700 dark:text-slate-300 sm:text-[12px]">
                                <span className="font-semibold text-slate-600 dark:text-slate-300">Catatan: </span>
                                {log.notes.trim()}
                              </p>
                            </div>
                          )}

                          {isExpanded && (
                            <div className="space-y-3 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-3 sm:py-3">
                              {detailSections.length ? (
                                <div className="columns-1 gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 lg:columns-2">
                                  {[leftSections, rightSections].map((columnSections, columnIndex) => (
                                    <div key={columnIndex} className="mb-3 break-inside-avoid space-y-3">
                                      {columnSections.map((section) => (
                                        <div key={section.title} className="space-y-2">
                                          <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                                            {section.title}
                                          </div>
                                          <div className="divide-y divide-slate-200 dark:divide-slate-800/35 rounded-xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60">
                                            {section.lines.map((line) => (
                                              <div key={`${section.title}-${line.label}`} className="detail-labeled-row">
                                                <span className="font-medium text-slate-600 dark:text-slate-300">{line.label}</span>
                                                <span className="font-medium text-slate-900 dark:text-slate-100">{line.value}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 px-4 py-2.5 text-center text-[13px] text-slate-700 dark:text-slate-300">
                                  Aktifkan minimal satu kolom untuk melihat detail penggunaan.
                                </div>
                              )}
                            </div>
                          )}

                        </SummaryResultCard>
                      );
                    })
                  )}
                  </div>
                  {filteredLogs.length > 0 && (
                    <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800/35 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Menampilkan {usageHistoryStartIndex + 1}-{Math.min(usageHistoryStartIndex + HISTORY_ROWS_PER_PAGE, filteredLogs.length)} dari {filteredLogs.length} riwayat
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentUsageHistoryPage === 1}
                          onClick={() => setUsageHistoryPage((page) => Math.max(1, page - 1))}
                          aria-label="Halaman riwayat pemakaian sebelumnya"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {visibleUsageHistoryPages.map((page) => (
                          typeof page === "number" ? (
                            <Button
                              key={page}
                              type="button"
                              variant={page === currentUsageHistoryPage ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => goToUsageHistoryPage(page)}
                              aria-label={`Halaman riwayat pemakaian ${page}`}
                              aria-current={page === currentUsageHistoryPage ? "page" : undefined}
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
                          disabled={currentUsageHistoryPage === totalUsageHistoryPages}
                          onClick={() => setUsageHistoryPage((page) => Math.min(totalUsageHistoryPages, page + 1))}
                          aria-label="Halaman riwayat pemakaian berikutnya"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(completeForm)} onOpenChange={(open) => !open && setCompleteForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Selesaikan Pemakaian</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{completeForm?.assetLabel ?? "Alat"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Periksa kondisi akhir dan catatan sebelum menyelesaikan pemakaian.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Waktu Selesai</label>
              <Input
                type="datetime-local"
                value={completeForm?.endedAt ?? ""}
                onChange={(event) => setCompleteForm((prev) => prev ? { ...prev, endedAt: event.target.value } : prev)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kondisi Akhir</label>
              <Input
                value={completeForm?.conditionAfter ?? ""}
                onChange={(event) => setCompleteForm((prev) => prev ? { ...prev, conditionAfter: event.target.value } : prev)}
                placeholder="Baik / Cukup / Rusak"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Catatan Penyelesaian</label>
              <Textarea
                value={completeForm?.notes ?? ""}
                onChange={(event) => setCompleteForm((prev) => prev ? { ...prev, notes: event.target.value } : prev)}
                placeholder="Opsional"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteForm(null)}>
              Batal
            </Button>
            <Button onClick={handleCompleteUsage} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan Selesai"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editForm)} onOpenChange={(open) => !open && setEditForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Pemakaian</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Ruangan Penggunaan</label>
              <Input
                value={editForm?.roomName ?? ""}
                onChange={(event) => setEditForm((prev) => prev ? { ...prev, roomName: event.target.value } : prev)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Mulai</label>
              <Input
                type="datetime-local"
                value={editForm?.startedAt ?? ""}
                onChange={(event) => setEditForm((prev) => prev ? { ...prev, startedAt: event.target.value } : prev)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Selesai</label>
              <Input
                type="datetime-local"
                value={editForm?.endedAt ?? ""}
                onChange={(event) => setEditForm((prev) => prev ? { ...prev, endedAt: event.target.value } : prev)}
                disabled={Boolean(editForm?.isBorrowingSync)}
                title={editForm?.isBorrowingSync ? "Log dari peminjaman diselesaikan melalui Pengembalian" : undefined}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Jumlah</label>
              <Input
                type="number"
                min={1}
                value={editForm?.usageCount ?? 1}
                onChange={(event) => setEditForm((prev) => prev ? { ...prev, usageCount: Math.max(1, Number(event.target.value) || 1) } : prev)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kondisi Awal</label>
              <Input
                value={editForm?.conditionBefore ?? ""}
                onChange={(event) => setEditForm((prev) => prev ? { ...prev, conditionBefore: event.target.value } : prev)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Kondisi Akhir</label>
              <Input
                value={editForm?.conditionAfter ?? ""}
                onChange={(event) => setEditForm((prev) => prev ? { ...prev, conditionAfter: event.target.value } : prev)}
                placeholder="Baik / Cukup / Rusak"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Catatan</label>
              <Textarea
                value={editForm?.notes ?? ""}
                onChange={(event) => setEditForm((prev) => prev ? { ...prev, notes: event.target.value } : prev)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm(null)}>
              Batal
            </Button>
            <Button onClick={handleEditUsage} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDeleteLog)} onOpenChange={(open) => !open && setPendingDeleteLog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arsipkan Log Penggunaan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Log {pendingDeleteLog?.assetDetailName || pendingDeleteLog?.assetName || "alat"} akan diarsipkan dan tidak lagi tampil di riwayat aktif.
            </p>
            <div>
              <label className="text-sm font-medium">Alasan Pengarsipan</label>
              <Textarea
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                placeholder="Contoh: data duplikat, salah input ruangan"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteLog(null)} disabled={isDeletingLog}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDeleteLog} disabled={isDeletingLog || !deleteReason.trim()}>
              {isDeletingLog ? "Mengarsipkan..." : "Arsipkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!showForm && (
        <div className="fab-safe-area fixed z-40 xl:hidden">
          <Button
            size="sm"
            className="h-11 rounded-full bg-teal-600 px-4 text-white shadow-xl hover:bg-teal-700"
            onClick={() => {
              setForm({ ...initialForm, startedAt: toDateTimeLocalInputValue() });
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Penggunaan
          </Button>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border text-center">
        <p className="text-[13px] text-muted-foreground">
          Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
        </p>
      </div>
    </div>
  );
}
