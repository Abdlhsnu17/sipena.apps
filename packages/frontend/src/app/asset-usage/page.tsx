"use client";

import { assetUsageService, type AssetUsageContext, type AssetUsageLog } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import { formatDayTimeLabel } from "@/utils/format";
import { isAdminOrLeaderRole } from "@/utils/role";
import { Activity, Check, ChevronDown, ClipboardPlus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";

// Only show functional usage categories to avoid confusion between location vs function
const usageContextLabels: Record<AssetUsageContext, string> = {
  own_room: "Ruangan",
  emergency: "Emergency",
  procedure: "Antar Sub Ruangan",
  rounding: "Antar Instalasi",
  other: "Lainnya",
};

const functionalUsageKeys: AssetUsageContext[] = ["own_room", "emergency", "procedure", "rounding", "other"];

const mapToFunctionalUsage = (ctx?: AssetUsageContext | string | null): AssetUsageContext => {
  const key = (ctx || "other").toString();
  if (key === "emergency") return "emergency";
  if (key === "procedure") return "procedure";
  if (key === "rounding") return "rounding";
  // treat location-based contexts as 'Ruangan' (functional)
  if (key === "same_unit_cross_room" || key === "cross_room" || key === "own_room") return "own_room";
  return "other";
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
  conditionAfter: string;
  notes: string;
};

const initialForm: FormState = {
  inventoryKey: "",
  roomName: "",
  usageContext: "own_room",
  startedAt: toDateTimeLocalInputValue(),
  endedAt: "",
  usageCount: 1,
  conditionBefore: "Baik",
  conditionAfter: "Baik",
  notes: "",
};

const getInventoryKey = (item: DetailInventoryItem) => `${item.assetType}|${item.assetId}|${item.detailId}`;
type AssetSourceFilter = "all" | "medical" | "non_medical";

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

export default function AssetUsagePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [assets, setAssets] = useState<DetailInventoryItem[]>([]);
  const [logs, setLogs] = useState<AssetUsageLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [assetSearchTerm, setAssetSearchTerm] = useState("");
  const [assetSourceFilter, setAssetSourceFilter] = useState<AssetSourceFilter>("all");
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);

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
      const [medicalAssetResponse, nonMedicalAssetResponse, usageResponse] = await Promise.all([
        assetService.getAll({ page: 1, limit: 1000, type: "medical" }),
        assetService.getAll({ page: 1, limit: 1000, type: "non_medical" }),
        assetUsageService.getAll({ page: 1, limit: 1000 }),
      ]);

      if (medicalAssetResponse.success || nonMedicalAssetResponse.success) {
        const combinedAssets = [
          ...(medicalAssetResponse.success ? medicalAssetResponse.data : []),
          ...(nonMedicalAssetResponse.success ? nonMedicalAssetResponse.data : []),
        ];
        const items = flattenDetailInventories(combinedAssets, { includeAssetFallback: true });
        setAssets(items);
        const ownRoomItems = items.filter((item) => isOwnRoomAsset(item, currentUser));
        const initialItem = ownRoomItems[0] || null;
        if (!form.inventoryKey && initialItem) {
          setForm((prev) => ({
            ...prev,
            inventoryKey: getInventoryKey(initialItem),
            roomName: getUserUsageRoom(currentUser) || initialItem.roomName || initialItem.assetLocation || "",
            usageContext: "own_room",
          }));
        }
      }

      if (usageResponse.success) setLogs(usageResponse.data);
    } catch (error) {
      console.error("Error loading asset usage:", error);
      toast({ title: "Gagal memuat data", description: "Data penggunaan alat belum dapat dimuat.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) void loadData();
  }, [currentUser]);

  const selectedAsset = useMemo(
    () => assets.find((item) => getInventoryKey(item) === form.inventoryKey),
    [assets, form.inventoryKey]
  );

  const selectableAssets = useMemo(() => {
    if (form.usageContext !== "own_room") return assets;
    return assets.filter((item) => isOwnRoomAsset(item, currentUser));
  }, [assets, currentUser, form.usageContext]);

  const assetFilterCounts = useMemo(() => ({
    all: selectableAssets.length,
    medical: selectableAssets.filter((item) => item.assetType === "medical").length,
    non_medical: selectableAssets.filter((item) => item.assetType === "non_medical").length,
  }), [selectableAssets]);

  const filteredSelectableAssets = useMemo(() => {
    const normalizedSearch = assetSearchTerm.trim().toLowerCase();
    return selectableAssets.filter((item) => {
      const matchesSource =
        assetSourceFilter === "all" ||
        (assetSourceFilter === "medical" && item.assetType === "medical") ||
        (assetSourceFilter === "non_medical" && item.assetType === "non_medical");
      if (!matchesSource) return false;

      const searchable = [
        item.detailInventoryName,
        item.detailName,
        item.detailCode,
        item.assetName,
        item.assetCode,
        item.roomName,
        item.assetLocation,
        item.detailBrandModel,
        item.serialNumber,
      ].filter(Boolean).join(" ").toLowerCase();
      return !normalizedSearch || searchable.includes(normalizedSearch);
    });
  }, [assetSearchTerm, assetSourceFilter, selectableAssets]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedRoom = roomFilter.trim().toLowerCase();
    return logs.filter((log) => {
      const searchable = [
        log.assetDetailName,
        log.assetName,
        log.assetDetailCode,
        log.assetCode,
        log.roomName,
        log.operatorName,
        log.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      return (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!normalizedRoom || (log.roomName || "").toLowerCase().includes(normalizedRoom));
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
    setForm((prev) => ({
      ...prev,
      inventoryKey,
      roomName: getUserUsageRoom(currentUser) || item?.roomName || item?.assetLocation || prev.roomName,
    }));
    setIsAssetPickerOpen(false);
  };

  const handleUsageContextChange = (usageContext: AssetUsageContext) => {
    const nextSelectableAssets =
      usageContext === "own_room"
        ? assets.filter((item) => isOwnRoomAsset(item, currentUser))
        : assets;
    const currentStillVisible = nextSelectableAssets.some((item) => getInventoryKey(item) === form.inventoryKey);
    const nextAsset = currentStillVisible
      ? nextSelectableAssets.find((item) => getInventoryKey(item) === form.inventoryKey)
      : nextSelectableAssets[0];

    setForm((prev) => ({
      ...prev,
      usageContext,
      inventoryKey: nextAsset ? getInventoryKey(nextAsset) : "",
      roomName: getUserUsageRoom(currentUser) || nextAsset?.roomName || nextAsset?.assetLocation || prev.roomName,
    }));
  };

  const handleSubmit = async () => {
    if (!selectedAsset) {
      toast({ title: "Pilih alat", description: "Alat yang digunakan wajib dipilih.", variant: "destructive" });
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
        conditionAfter: form.conditionAfter,
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

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Penggunaan Alat Ruangan</h1>
          <p className="text-sm text-slate-600">Catat pemakaian alat di ruangan sendiri untuk melihat frekuensi dan beban pemakaian.</p>
        </div>
        <Badge className="w-fit bg-teal-100 text-teal-800 hover:bg-teal-100">
          {filteredLogs.length} log
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Pemakaian</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.totalUsage}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alat Terpakai</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.uniqueAssets}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Paling Sering</CardTitle></CardHeader>
          <CardContent>
            <p className="truncate text-base font-semibold">{summary.topAsset?.label || "-"}</p>
            <p className="text-sm text-slate-600">{summary.topAsset ? `${summary.topAsset.count} kali` : "Belum ada data"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardPlus className="h-4 w-4" /> Catat Pemakaian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
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
                          className="pl-9"
                          placeholder="Cari inventaris..."
                          value={assetSearchTerm}
                          onChange={(event) => setAssetSearchTerm(event.target.value)}
                        />
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
            <div>
              <label className="text-sm font-medium">Ruangan Penggunaan</label>
              <Input value={form.roomName} onChange={(event) => setForm((prev) => ({ ...prev, roomName: event.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Jenis Penggunaan</label>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={form.usageContext} onChange={(event) => handleUsageContextChange(event.target.value as AssetUsageContext)}>
                {functionalUsageKeys.map((key) => (
                  <option key={key} value={key}>{usageContextLabels[key]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Mulai</label>
                <Input type="datetime-local" value={form.startedAt} onChange={(event) => setForm((prev) => ({ ...prev, startedAt: event.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Selesai</label>
                <Input type="datetime-local" value={form.endedAt} onChange={(event) => setForm((prev) => ({ ...prev, endedAt: event.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">Jumlah</label>
                <Input type="number" min={1} value={form.usageCount} onChange={(event) => setForm((prev) => ({ ...prev, usageCount: Math.max(1, Number(event.target.value) || 1) }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Sebelum</label>
                <Input value={form.conditionBefore} onChange={(event) => setForm((prev) => ({ ...prev, conditionBefore: event.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Sesudah</label>
                <Input value={form.conditionAfter} onChange={(event) => setForm((prev) => ({ ...prev, conditionAfter: event.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Catatan</label>
              <Input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Opsional" />
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={isSaving || isLoading}>
              <Activity className="mr-2 h-4 w-4" /> {isSaving ? "Menyimpan..." : "Simpan Penggunaan"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Pemakaian</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-9" placeholder="Cari alat/operator" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
              </div>
              <Input placeholder="Filter ruangan" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)} />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alat</TableHead>
                  <TableHead>Ruangan</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Kondisi</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <p className="font-medium">{log.assetDetailName || log.assetName || "-"}</p>
                      <p className="text-xs text-slate-600">{log.assetDetailCode || log.assetCode || "-"}</p>
                    </TableCell>
                    <TableCell>
                      <p>{log.roomName}</p>
                        <p className="text-xs text-slate-600">{usageContextLabels[mapToFunctionalUsage(log.usageContext)]}</p>
                    </TableCell>
                    <TableCell>{formatDayTimeLabel(log.startedAt) || "-"}</TableCell>
                    <TableCell>{log.usageCount}</TableCell>
                    <TableCell>{log.conditionBefore || "-"} -&gt; {log.conditionAfter || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(log)} aria-label="Hapus log penggunaan">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-slate-600">
                      {isLoading ? "Memuat data..." : "Belum ada log penggunaan alat."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
