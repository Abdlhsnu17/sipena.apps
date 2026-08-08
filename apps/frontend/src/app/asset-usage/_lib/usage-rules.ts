import type { AssetUsageLog, AssetUsageContext } from "@/services/asset-usage.service";
import type { Borrowing } from "@/services/borrowing.service";
import type { User } from "@/types/auth-types";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { formatLocalDateTimeInputValue } from "@/utils/date-input";
import {
  getInventoryLockKey,
  isAssetFallbackDetailId,
  normalizeDetailIdentifier,
} from "@/utils/detail-inventory";
import { formatNoId } from "@/utils/record-id";

export const getAssetRoomOptions = (item?: DetailInventoryItem) => {
  if (!item) return [];
  return Array.from(
    new Set(
      [item.roomName, item.assetLocation]
        .map((value) => (value || "").trim())
        .filter(Boolean)
    )
  );
};

export const getUsageRoomDisplay = (log: AssetUsageLog) => {
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

export type FormState = {
  inventoryKey: string;
  roomName: string;
  usageContext: AssetUsageContext;
  startedAt: string;
  endedAt: string;
  usageCount: number;
  conditionBefore: string;
  notes: string;
};

export type EditFormState = {
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

export type CompleteFormState = {
  id: number | string;
  assetLabel: string;
  endedAt: string;
  conditionAfter: string;
  notes: string;
};

export type UsageDetailLine = {
  label: string;
  value: string;
};

export type UsageDetailSection = {
  title: string;
  lines: UsageDetailLine[];
};

export const initialForm: FormState = {
  inventoryKey: "",
  roomName: "",
  usageContext: "procedure",
  startedAt: formatLocalDateTimeInputValue(),
  endedAt: "",
  usageCount: 1,
  conditionBefore: "Baik",
  notes: "",
};

export const getInventoryKey = (item: DetailInventoryItem) => `${item.assetType}|${item.assetId}|${item.detailId}`;

export const activeMaintenanceStatuses = new Set(["requested", "scheduled", "in_progress", "completed"]);

export const formatUsageAssetLabel = (asset: DetailInventoryItem) => {
  const inventoryLabel = asset.detailInventoryName || asset.detailName || asset.assetName || "";
  const brandLabel = asset.detailBrandModel;
  const codeLabel = asset.detailCode || asset.assetCode;
  const locationLabel = asset.assetLocation ? ` (${asset.assetLocation})` : "";
  const brandSuffix = brandLabel ? ` (${brandLabel})` : "";
  const codeSuffix = codeLabel ? ` - ${codeLabel}` : "";
  return `${inventoryLabel}${brandSuffix}${codeSuffix}${locationLabel}`.trim();
};

export const getConditionLabel = (asset: DetailInventoryItem) => {
  if (asset.condition === "damaged") return "Rusak";
  if (asset.condition === "poor") return "Kurang";
  if (asset.condition === "fair") return "Cukup";
  return "Baik";
};

export const getEffectiveAvailability = (
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

export const normalizeLocationText = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const locationIncludes = (source: string, target?: string | null) => {
  const normalizedTarget = normalizeLocationText(target);
  return Boolean(normalizedTarget && source.includes(normalizedTarget));
};

export const ROOM_MATCH_IGNORED_WORDS = new Set(["ruang", "ruangan", "ranap", "rawat", "inap", "kamar", "unit", "sub", "instalasi"]);

export const getMeaningfulRoomTokens = (value: string) =>
  normalizeLocationText(value)
    .split(" ")
    .filter((token) => token && !ROOM_MATCH_IGNORED_WORDS.has(token) && (token.length >= 3 || token === "ok"));

export const roomMatchesSubRoom = (assetRoomText: string, subRoom?: string | null) => {
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

export const getUserUsageRoom = (user?: User | null) =>
  [user?.workUnit, user?.subWorkUnit].filter(Boolean).join(" - ");

export const getAutoUsageRoom = (item: DetailInventoryItem | undefined, user: User | null) =>
  getUserUsageRoom(user) || getAssetRoomOptions(item)[0] || "";

export const getAssetRoomSearchText = (item: DetailInventoryItem) =>
  normalizeLocationText([item.roomName, item.assetLocation].filter(Boolean).join(" "));

export const isAssetInUserSubRoom = (item: DetailInventoryItem, user: User | null) => {
  const userSubRoom = user?.subWorkUnit?.trim();
  if (!userSubRoom) return false;

  const assetRoomText = getAssetRoomSearchText(item);
  return roomMatchesSubRoom(assetRoomText, userSubRoom);
};

export const deriveUsageContextFromProfile = (
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

export const getUsageNoId = (log: Pick<AssetUsageLog, "id">) => formatNoId("PMG", log.id);

export const isBorrowingUsageLog = (log: AssetUsageLog): boolean => {
  return log.sourceType === "borrowing_sync" || Boolean(log.borrowingId);
};

export const normalizeRole = (role?: string | null) =>
  (role || "").toLowerCase().trim().replace(/[\s-]+/g, "_");

export const canManageUsageRecord = (actor: User | null, log: AssetUsageLog): boolean => {
  if (!actor) return false;
  const role = normalizeRole(actor.role);
  if (role === "admin" || role === "leader") return true;

  const actorId = Number(actor.id);
  if (!Number.isFinite(actorId) || actorId <= 0) return false;

  return [log.operatorUserId, log.createdBy].some((value) => Number(value) === actorId);
};

export const canCompleteUsage = (actor: User | null, log: AssetUsageLog): boolean =>
  !isBorrowingUsageLog(log) && canManageUsageRecord(actor, log);

export const borrowingMatchesInventory = (borrowing: Borrowing, item: DetailInventoryItem) => {
  const borrowingType = borrowing.assetType === "non_medical" ? "non_medical" : "medical";
  if (borrowing.assetId !== item.assetId || borrowingType !== item.assetType) return false;

  const borrowingDetailId = normalizeDetailIdentifier(borrowing.assetDetailId);
  if (!borrowingDetailId || isAssetFallbackDetailId(borrowingDetailId, borrowing.assetId, borrowingType)) return true;
  return borrowingDetailId === normalizeDetailIdentifier(item.detailId);
};

export const canUseOverdueAssetForEmergency = (actor: User | null, borrowing?: Borrowing) => {
  if (!actor || !borrowing) return false;
  const actorRole = normalizeRole(actor.role);
  if (actorRole === "admin" || actorRole === "leader") return true;
  if (Number(actor.id) === Number(borrowing.userId)) return true;
  return Boolean(borrowing.borrowerRole) && actorRole === normalizeRole(borrowing.borrowerRole);
};
