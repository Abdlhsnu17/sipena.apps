"use client";

import { Badge } from "@/components/ui/badge";
import { assetUsageService, type AssetUsageContext, type AssetUsageLog } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { flattenDetailInventories, getDetailInventoryStatusLabel } from "@/utils/detail-inventory";
import { formatDayTimeLabel } from "@/utils/format";
import { buildInventorySearchKey } from "@/utils/inventory-search";
import { formatNoId } from "@/utils/record-id";
import { isAdminOrLeaderRole } from "@/utils/role";
import { matchesSearchKeyword } from "@/utils/search-keyword";
import { Activity, Check, ChevronDown, ChevronUp, ClipboardList, ClipboardPlus, Pencil, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import { appendLine, ExportFormat, exportNarrativeReport, type DocumentSection, type SectionLine } from "@/utils/export-table";

// Only show functional usage categories to avoid confusion between location vs function
const usageContextLabels: Record<AssetUsageContext, string> = {
  own_room: "Ruangan",
  same_unit_cross_room: "Antar Sub Ruangan",
  cross_room: "Antar Instalasi",
  emergency: "Emergency",
  procedure: "Antar Sub Ruangan",
  rounding: "Antar Instalasi",
  other: "Lainnya",
};

const functionalUsageKeys: AssetUsageContext[] = ["emergency", "rounding"];

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
  usageContext: "rounding",
  startedAt: toDateTimeLocalInputValue(),
  endedAt: "",
  usageCount: 1,
  conditionBefore: "Baik",
  notes: "",
};

const getInventoryKey = (item: DetailInventoryItem) => `${item.assetType}|${item.assetId}|${item.detailId}`;
type AssetSourceFilter = "all" | "medical" | "non_medical";

const activeMaintenanceStatuses = new Set(["requested", "scheduled", "in_progress", "completed"]);

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
  activeBorrowingLocks: Set<string>
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
  if (activeBorrowingLocks.has(baseKey) || activeBorrowingLocks.has(detailKey)) return "borrowed";

  if (isFallbackAssetItem) {
    if (item.assetStatus === "disposed") return "disposed";
    if (item.assetStatus === "maintenance") return "maintenance";
    if (item.assetStatus === "in_use") return "in_use";
    if (item.assetStatus === "borrowed") return "borrowed";
  }

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

const getUserUsageRoom = (user?: User | null) =>
  [user?.workUnit, user?.subWorkUnit].filter(Boolean).join(" - ");

const _subText = (value?: string | null) => value ? ` dan sub ruangan ${value}` : "";

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
  const sameSubRoom = locationIncludes(assetLocation, user.subWorkUnit);

  // Banyak data inventaris memakai nama ruangan detail saja, misalnya
  // "Ruangan Mawar Atas", tanpa menyimpan induk "Instalasi Rawat Inap".
  // Jika sub ruangan profil cocok dengan lokasi alat, alat tetap dianggap
  // milik ruangan sendiri.
  if (sameSubRoom) return "own_room";
  if (sameUnit && !user.subWorkUnit) return "own_room";
  if (sameUnit) return "same_unit_cross_room";
  return "cross_room";
};

const isOwnRoomAsset = (item: DetailInventoryItem, user: User | null) =>
  isAdminOrLeaderRole(user?.role) || deriveUsageContextFromProfile(item, user) === "own_room";

const getUsageNoId = (log: Pick<AssetUsageLog, "id">) => formatNoId("PMG", log.id);

export default function AssetUsagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assets, setAssets] = useState<DetailInventoryItem[]>([]);
  const [logs, setLogs] = useState<AssetUsageLog[]>([]);
  const [activeUsageLocks, setActiveUsageLocks] = useState<Set<string>>(new Set());
  const [activeMaintenanceLocks, setActiveMaintenanceLocks] = useState<Set<string>>(new Set());
  const [activeBorrowingLocks, setActiveBorrowingLocks] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [assetSearchTerm, setAssetSearchTerm] = useState("");
  const [assetSearchInput, setAssetSearchInput] = useState("");
  const [assetSourceFilter, setAssetSourceFilter] = useState<AssetSourceFilter>("all");
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [isUsageFormMinimized, setIsUsageFormMinimized] = useState(false);
  const [isUsageHistoryMinimized, setIsUsageHistoryMinimized] = useState(false);
  const [expandedUsageHistoryIds, setExpandedUsageHistoryIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteFormState | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const sortedFunctionalUsageKeys = useMemo<AssetUsageContext[]>(() => {
    const usageKeys: AssetUsageContext[] = [...functionalUsageKeys, "own_room"];
    return usageKeys.sort((a, b) => usageContextLabels[a].localeCompare(usageContextLabels[b], "id"));
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace(buildLoginRedirectUrl());
      return;
    }
    setCurrentUser(user);
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [medicalAssetResponse, nonMedicalAssetResponse, usageResponse, maintenanceResponse, borrowingResponse] = await Promise.all([
        assetService.getAll({ page: 1, limit: 1000, type: "medical" }),
        assetService.getAll({ page: 1, limit: 1000, type: "non_medical" }),
        assetUsageService.getAll({ page: 1, limit: 1000 }),
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
      } else {
        setActiveBorrowingLocks(new Set());
      }
    } catch (error) {
      console.error("Error loading asset usage:", error);
      setActiveUsageLocks(new Set());
      setActiveMaintenanceLocks(new Set());
      setActiveBorrowingLocks(new Set());
      toast({ title: "Gagal memuat data", description: "Data penggunaan alat belum dapat dimuat.", variant: "destructive" });
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

  const availableAssets = useMemo(() => {
    return assets.filter((item) => {
      if (item.assetStatus === "disposed") return false;
      if (item.condition === "damaged") return false;
      return getEffectiveAvailability(item, activeUsageLocks, activeMaintenanceLocks, activeBorrowingLocks) === "available";
    });
  }, [activeBorrowingLocks, activeMaintenanceLocks, activeUsageLocks, assets]);

  const selectableAssets = useMemo(() => {
    if (form.usageContext === "emergency") {
      return availableAssets.filter((item) => (item.detailType || "").toLowerCase() === "emergency");
    }
    if (form.usageContext !== "own_room") return availableAssets;
    return availableAssets.filter((item) => isOwnRoomAsset(item, currentUser));
  }, [availableAssets, currentUser, form.usageContext]);

  const roomOptions = useMemo(() => {
    if (selectedAsset) {
      return getAssetRoomOptions(selectedAsset);
    }

    return Array.from(
      new Set(
        selectableAssets.flatMap((item) => getAssetRoomOptions(item))
      )
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [selectedAsset, selectableAssets]);

  const assetFilterCounts = useMemo(() => ({
    all: selectableAssets.length,
    medical: selectableAssets.filter((item) => item.assetType === "medical").length,
    non_medical: selectableAssets.filter((item) => item.assetType === "non_medical").length,
  }), [selectableAssets]);

  const filteredSelectableAssets = useMemo(() => {
    const searchTerm = assetSearchTerm.trim();
    return selectableAssets.filter((item) => {
      const matchesSource =
        assetSourceFilter === "all" ||
        (assetSourceFilter === "medical" && item.assetType === "medical") ||
        (assetSourceFilter === "non_medical" && item.assetType === "non_medical");
      if (!matchesSource) return false;

      return matchesSearchKeyword(searchTerm, [buildInventorySearchKey(item)]);
    });
  }, [assetSearchTerm, assetSourceFilter, selectableAssets]);

  useEffect(() => {
    if (!form.inventoryKey) return;
    const currentStillSelectable = selectableAssets.some((item) => getInventoryKey(item) === form.inventoryKey);
    if (currentStillSelectable) return;

    setForm((prev) => ({ ...prev, inventoryKey: "" }));
  }, [form.inventoryKey, selectableAssets]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = matchesSearchKeyword(searchTerm, [
        getUsageNoId(log),
        log.assetDetailName,
        log.assetName,
        log.assetDetailCode,
        log.assetCode,
        log.roomName,
        log.operatorName,
        log.notes,
        log.endedAt ? "Selesai" : "Sedang Digunakan",
      ]);
      return matchesSearch && matchesSearchKeyword(roomFilter, [log.roomName]);
    });
  }, [logs, roomFilter, searchTerm]);

  const summary = useMemo(() => {
    const totalUsage = filteredLogs.reduce((sum, log) => sum + (log.usageCount || 1), 0);
    const uniqueAssets = new Set(filteredLogs.map((log) => `${log.assetType}|${log.assetId}|${log.assetDetailId || log.assetDetailCode || log.assetCode}`));
    const topAsset = Object.entries(
      filteredLogs.reduce<Record<string, { label: string; count: number }>>((acc, log) => {
        const key = `${log.assetType}|${log.assetId}|${log.assetDetailId || log.assetDetailCode || log.assetCode}`;
        const label = log.assetDetailName || log.assetName || "-";
        acc[key] = { label, count: (acc[key]?.count || 0) + (log.usageCount || 1) };
        return acc;
      }, {})
    ).sort((a, b) => b[1].count - a[1].count)[0]?.[1];

    return { totalUsage, uniqueAssets: uniqueAssets.size, topAsset };
  }, [filteredLogs]);

  const handleAssetChange = (inventoryKey: string) => {
    const item = assets.find((asset) => getInventoryKey(asset) === inventoryKey);
    const nextRoomName = getAssetRoomOptions(item)[0] || getUserUsageRoom(currentUser) || "";
    setForm((prev) => ({
      ...prev,
      inventoryKey,
      roomName: nextRoomName || prev.roomName,
    }));
    setIsAssetPickerOpen(false);
  };

  const handleUsageContextChange = (usageContext: AssetUsageContext) => {
    let nextSelectableAssets: DetailInventoryItem[];
    if (usageContext === "emergency") nextSelectableAssets = availableAssets.filter((item) => (item.detailType || "").toLowerCase() === "emergency");
    else if (usageContext === "own_room") nextSelectableAssets = availableAssets.filter((item) => isOwnRoomAsset(item, currentUser));
    else nextSelectableAssets = availableAssets;
    const currentStillVisible = nextSelectableAssets.some((item) => getInventoryKey(item) === form.inventoryKey);
    const nextAsset = currentStillVisible
      ? nextSelectableAssets.find((item) => getInventoryKey(item) === form.inventoryKey)
      : nextSelectableAssets[0];
    const nextRoomName = getAssetRoomOptions(nextAsset)[0] || getUserUsageRoom(currentUser) || "";

    setForm((prev) => ({
      ...prev,
      usageContext,
      inventoryKey: nextAsset ? getInventoryKey(nextAsset) : "",
      roomName: nextRoomName || prev.roomName,
    }));
  };

  useEffect(() => {
    if (!selectedAsset) return;
    const nextRoomName = getAssetRoomOptions(selectedAsset)[0];
    if (!nextRoomName) return;
    setForm((prev) => (prev.roomName === nextRoomName ? prev : { ...prev, roomName: nextRoomName }));
  }, [selectedAsset]);

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
        setForm((prev) => ({ ...initialForm, inventoryKey: prev.inventoryKey, roomName: prev.roomName, startedAt: toDateTimeLocalInputValue() }));
        await loadData();
      }
    } catch (error) {
      console.error("Error saving asset usage:", error);
      toast({ title: "Gagal menyimpan", description: "Catatan penggunaan alat belum tersimpan.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (log: AssetUsageLog) => {
    const ok = await confirm({
      title: "Hapus log penggunaan?",
      description: `Log ${log.assetDetailName || log.assetName || "alat"} akan dihapus dari riwayat.`,
      confirmText: "Hapus",
      destructive: true,
    });
    if (!ok) return;
    await assetUsageService.delete(log.id);
    await loadData();
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
    });
  };

  const handleEditUsage = async () => {
    if (!editForm) return;

    setIsSaving(true);
    try {
      const response = await assetUsageService.update(editForm.id, {
        roomName: editForm.roomName.trim(),
        startedAt: editForm.startedAt,
        endedAt: editForm.endedAt || undefined,
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
      } else {
        toast({
          title: "Gagal menyimpan edit",
          description: response.message || "Tidak dapat memperbarui data pemakaian.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error editing asset usage:", error);
      toast({
        title: "Gagal menyimpan edit",
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
      } else {
        toast({
          title: "Gagal memperbarui status",
          description: response.message || "Tidak dapat memperbarui log penggunaan.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating asset usage status:", error);
      toast({
        title: "Gagal memperbarui status",
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

  const getUsageDetailSections = (log: AssetUsageLog): UsageDetailSection[] => {
    const sections: UsageDetailSection[] = [];
    const usageContextLabel = usageContextLabels[log.usageContext] || log.usageContext || "-";

    sections.push({
      title: "Data Alat Digunakan",
      lines: [
        { label: "No ID Pemakaian", value: getUsageNoId(log) },
        { label: "Jenis Inventaris", value: log.assetType === "medical" ? "Medis" : "Non-Medis" },
        { label: "Nama Alat", value: log.assetDetailName || log.assetName || "-" },
        { label: "Kode Alat", value: log.assetDetailCode || log.assetCode || "-" },
        { label: "Lokasi Alat", value: log.assetLocation || "-" },
      ],
    });

    sections.push({
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

    sections.push({
      title: "Operator Pemakaian",
      lines: [
        { label: "Nama Operator", value: log.operatorName || "-" },
        { label: "NIP Operator", value: log.operatorNip || "-" },
      ],
    });

    sections.push({
      title: "Catatan Pemakaian",
      lines: [
        { label: "Waktu Selesai", value: formatDayTimeLabel(log.endedAt) || "-" },
        { label: "Kondisi Akhir", value: log.conditionAfter || "-" },
        { label: "Catatan", value: log.notes?.trim() || "-" },
      ],
    });

    sections.push({
      title: "Status Pemakaian",
      lines: [
        { label: "Status", value: getUsageStatusLabel(log) },
        { label: "Kondisi Saat Ini", value: getUsageConditionLabel(log) },
      ],
    });

    return sections;
  };

  const buildUsageLetterSections = (log: AssetUsageLog): DocumentSection[] => {
    const main: SectionLine[] = []
    appendLine(main, 'Nomor Surat', getUsageNoId(log))
    appendLine(main, 'Operator', log.operatorName || log.createdByName || '-')
    appendLine(main, 'NIP Operator', log.operatorNip || '-')
    appendLine(main, 'Nama Alat', log.assetDetailName || log.assetName || '-')
    appendLine(main, 'Kode Alat', log.assetDetailCode || log.assetCode || '-')
    appendLine(main, 'Ruangan Pengguna', getUsageRoomDisplay(log).primary)
    appendLine(main, 'Waktu Mulai', formatDayTimeLabel(log.startedAt) || '-')
    appendLine(main, 'Waktu Selesai', formatDayTimeLabel(log.endedAt) || '-')
    appendLine(main, 'Tujuan / Keterangan', log.notes?.trim() || '-')

    const sign: SectionLine[] = []
    appendLine(sign, 'Tempat, Tanggal', formatDayTimeLabel(log.startedAt) || '-')
    appendLine(sign, 'Penanggung Jawab', log.createdByName || '-')
    appendLine(sign, 'Keterangan', '-')

    return [
      { title: 'SURAT PENGGUNAAN', lines: main },
      { title: 'PENUTUP & TANDA TANGAN', lines: sign },
    ]
  }

  const exportSingleUsageLetter = async (format: ExportFormat, log: AssetUsageLog) => {
    void exportNarrativeReport(format, {
      title: `Surat Penggunaan - ${log.operatorName || log.id}`,
      subtitle: 'SURAT PENGGUNAAN',
      entries: [log],
      filePrefix: `surat-penggunaan-${log.id}`,
      buildSections: buildUsageLetterSections,
      emptyMessage: 'Tidak ada data pemakaian yang dipilih.',
    })
  }

  const toggleUsageHistoryCard = (id: number) => {
    setExpandedUsageHistoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-7xl space-y-5 bg-linear-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 page-gutter">
      <section className="rounded-3xl border border-teal-100/80 bg-white/90 p-4 shadow-2xl backdrop-blur-sm dark:border-teal-800/60 dark:bg-slate-900/70 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="rounded-lg bg-linear-to-br from-teal-500 to-cyan-500 p-2.5">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Penggunaan Alat</h1>
            <p className="mt-1 text-[12px] text-muted-foreground">Catat pemakaian alat untuk melihat frekuensi dan beban pemakaian.</p>
          </div>
        </div>
      </section>

        <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 p-3 dark:bg-amber-950/30">
                <div>
                  <p className="text-[12px] text-muted-foreground">Total Pemakaian</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{summary.totalUsage}</p>
                </div>
                <Activity className="h-4 w-4 shrink-0 text-amber-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 p-3 dark:bg-teal-950/30">
                <div>
                  <p className="text-[12px] text-muted-foreground">Alat Terpakai</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{summary.uniqueAssets}</p>
                </div>
                <ClipboardPlus className="h-4 w-4 shrink-0 text-teal-500" />
              </div>

              <div className="flex items-start justify-between gap-3 rounded-lg bg-cyan-50/50 p-3 dark:bg-cyan-950/30">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted-foreground">Paling Sering</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{summary.topAsset?.label || "-"}</p>
                  <p className="text-xs text-slate-600">{summary.topAsset ? `${summary.topAsset.count} kali` : "Belum ada data"}</p>
                </div>
                <Check className="h-4 w-4 shrink-0 text-cyan-500" />
              </div>
            </div>
          </CardContent>
        </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><ClipboardPlus className="h-4 w-4" /> Catat Pemakaian</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUsageFormMinimized((prev) => !prev)}
                className="w-full rounded-2xl px-3 sm:w-auto"
              >
                {isUsageFormMinimized ? (
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
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
              {isUsageFormMinimized ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-sm text-blue-900">
                Section catat pemakaian disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Alat</label>
                    <div className="relative mt-1">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-left text-sm"
                        onClick={() => setIsAssetPickerOpen((open) => !open)}
                      >
                        <span className={selectedAsset ? "text-slate-900" : "text-slate-500"}>
                          {selectedAsset
                            ? `${selectedAsset.detailInventoryName || selectedAsset.detailName} - ${selectedAsset.detailCode}`
                            : "Pilih alat"}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      </button>
                      {isAssetPickerOpen && (
                        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
                          <div className="border-b p-3">
                            <div className="relative">
                              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                  <Input
                                    className="pl-9 pr-20"
                                    placeholder="Cari inventaris..."
                                    value={assetSearchInput}
                                    onChange={(event) => {
                                      setAssetSearchInput(event.target.value);
                                      setAssetSearchTerm(event.target.value.trim());
                                    }}
                                  />
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                    setAssetSearchInput("");
                                    setAssetSearchTerm("");
                                  }}
                                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[
                                { value: "all" as const, label: `Semua (${assetFilterCounts.all})` },
                                { value: "medical" as const, label: `Medis (${assetFilterCounts.medical})` },
                                { value: "non_medical" as const, label: `Non-Medis (${assetFilterCounts.non_medical})` },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setAssetSourceFilter(option.value)}
                                  className={`rounded-full border px-3 py-1.5 text-sm ${
                                    assetSourceFilter === option.value
                                      ? "border-teal-500 bg-teal-50 text-teal-700"
                                      : "border-slate-200 bg-white text-slate-700"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="max-h-72 overflow-y-auto">
                            {filteredSelectableAssets.map((item) => {
                              const key = getInventoryKey(item);
                              const isSelected = key === form.inventoryKey;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => handleAssetChange(key)}
                                  className="flex w-full items-start gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                                >
                                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center">
                                    {isSelected && <Check className="h-4 w-4 text-teal-600" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium text-slate-900">{item.detailInventoryName || item.detailName}</span>
                                    <span className="block truncate text-xs text-slate-600">{item.detailCode} - {item.roomName || item.assetLocation || "-"}</span>
                                    <span className="block truncate text-xs text-slate-500">
                                      Status: {getDetailInventoryStatusLabel(item)} · Kondisi: {getConditionLabel(item)}
                                    </span>
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                    {item.assetType === "medical" ? "Medis" : "Non-Medis"}
                                  </span>
                                </button>
                              );
                            })}
                            {filteredSelectableAssets.length === 0 && (
                              <div className="px-3 py-6 text-center text-sm text-slate-600">
                                Tidak ada alat yang sesuai filter.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {form.usageContext === "own_room" && selectableAssets.length === 0 && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Belum ada alat yang cocok dengan Unit Kerja / Sub Ruangan profil akun.
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Ruangan Penggunaan</label>
                    {roomOptions.length > 0 ? (
                      <select
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        value={form.roomName}
                        onChange={(event) => setForm((prev) => ({ ...prev, roomName: event.target.value }))}
                      >
                        {roomOptions.map((room) => (
                          <option key={room} value={room}>{room}</option>
                        ))}
                      </select>
                    ) : (
                      <Input value={form.roomName} onChange={(event) => setForm((prev) => ({ ...prev, roomName: event.target.value }))} />
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">Jenis Penggunaan</label>
                    <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.usageContext} onChange={(event) => handleUsageContextChange(event.target.value as AssetUsageContext)}>
                      {sortedFunctionalUsageKeys.map((key) => (
                        <option key={key} value={key}>{usageContextLabels[key]}</option>
                      ))}
                    </select>
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

                <div className="mt-3 flex justify-end">
                  <Button className="w-full md:w-48" onClick={handleSubmit} disabled={isSaving || isLoading}>
                    <Activity className="mr-2 h-4 w-4" /> {isSaving ? "Menyimpan..." : "Simpan Penggunaan"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 bg-white/90 shadow-xl">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <CardTitle className="text-base">Riwayat Pemakaian</CardTitle>
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
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isUsageHistoryMinimized ? (
              <div className="rounded-2xl border border-green-100 bg-green-50/80 px-4 py-4 text-center text-sm text-green-900">
                Section riwayat pemakaian disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input className="pl-9" placeholder="Cari alat/operator" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
                  </div>
                  <Input placeholder="Filter ruangan" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} />
                </div>
                <div className="max-h-180 overflow-y-auto px-3 pb-4 pr-0 sm:px-4 sm:pb-4">
                  <div className="space-y-4 py-3">
                  {filteredLogs.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                      {isLoading ? "Memuat data..." : "Belum ada log penggunaan alat."}
                    </div>
                  ) : (
                    filteredLogs.map((log) => {
                      const roomDisplay = getUsageRoomDisplay(log);
                      const userLabel = log.operatorName || log.createdByName || "-";
                      const isExpanded = expandedUsageHistoryIds.includes(log.id);
                      const detailSections = getUsageDetailSections(log);
                      const leftSections = detailSections.slice(0, 2);
                      const rightSections = detailSections.slice(2);

                      return (
                        <div key={log.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                            <span>Informasi Dasar Pemakaian</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 rounded-lg p-0 text-slate-700 hover:bg-slate-200"
                              onClick={() => toggleUsageHistoryCard(log.id)}
                              aria-label={isExpanded ? "Sembunyikan detail pemakaian" : "Tampilkan detail pemakaian"}
                            >
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                          </div>

                          {!isExpanded && (
                            <div className="space-y-2.5 bg-white px-3 py-3 sm:px-3 sm:py-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] font-semibold text-slate-900">{log.assetDetailName || log.assetName || "-"}</p>
                                  <p className="text-[12px] font-medium text-slate-700">{log.assetDetailCode || log.assetCode || "-"}</p>
                                  <div className="mt-1.5 space-y-1.5">
                                    <p className="text-[11px] text-muted-foreground">No ID: {getUsageNoId(log)}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Ruangan alat: <span className="font-medium text-slate-700">{log.assetLocation || "-"}</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Ruangan pengguna: <span className="font-medium text-slate-700">{roomDisplay.primary}</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Pengguna: <span className="font-medium text-slate-700">{userLabel}</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      Kondisi: <span className="font-medium text-slate-700">{getUsageConditionLabel(log)}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Waktu</span>
                                    <span className="text-[13px] font-semibold text-foreground">{formatDayTimeLabel(log.startedAt) || "-"}</span>
                                  </div>
                                  <div className="flex flex-col items-start gap-1 sm:items-end">
                                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Jumlah {log.usageCount}</Badge>
                                    <Badge className={log.endedAt ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>
                                      {getUsageStatusLabel(log)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {isExpanded && (
                            <div className="space-y-3 bg-white px-3 py-3 sm:px-3 sm:py-3">
                              <div className="columns-1 gap-3 border-t border-slate-200 pt-3 lg:columns-2">
                                {[leftSections, rightSections].map((columnSections, columnIndex) => (
                                  <div key={columnIndex} className="mb-3 break-inside-avoid space-y-3">
                                    {columnSections.map((section) => (
                                      <div key={section.title} className="space-y-2">
                                        <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-700">
                                          {section.title}
                                        </div>
                                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                          {section.lines.map((line) => (
                                            <div key={`${section.title}-${line.label}`} className="detail-labeled-row border-b border-slate-200 last:border-b-0">
                                              <span className="font-medium text-slate-600">{line.label}</span>
                                              <span className="font-medium text-slate-900">{line.value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end border-t border-slate-200 px-3 pb-3 pt-2 sm:px-3 sm:pb-3">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {!log.endedAt && (
                                <Button
                                  size="sm"
                                  onClick={() => handleStatusChange(log, "completed")}
                                  className="h-6 rounded-full bg-teal-600 px-3 text-[12px] font-semibold text-white hover:bg-teal-700"
                                >
                                  Selesaikan
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-lg p-0"
                                onClick={() => openEditDialog(log)}
                                aria-label="Edit log penggunaan"
                                title="Edit"
                              >
                                <Pencil className="h-3 w-3 text-slate-700" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 rounded-full px-2 text-[12px]" onClick={() => exportSingleUsageLetter("pdf", log)}>
                                Surat
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 rounded-lg p-0" onClick={() => handleDelete(log)} aria-label="Hapus log penggunaan">
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>
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
              <p className="text-sm font-medium text-slate-900">{completeForm?.assetLabel ?? "Alat"}</p>
              <p className="text-xs text-slate-600">Periksa kondisi akhir dan catatan sebelum menyelesaikan pemakaian.</p>
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

      <div className="mt-8 pt-6 border-t border-border text-center">
        <p className="text-[13px] text-muted-foreground">
          Sistem Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)
        </p>
      </div>
    </div>
  );
}
