import type { User } from "@/types/auth-types";
import { getUserRoleLabel } from "@/utils/role";

export const resolveDefaultDestinationRoom = (currentUser?: User | null) => {
  const subWorkUnit = currentUser?.subWorkUnit?.trim()
  if (subWorkUnit) return subWorkUnit
  const workUnit = currentUser?.workUnit?.trim()
  return workUnit || ""
}

export const getDefaultFormData = (currentUser?: User | null) => ({
  assetId: "",
  assetType: "medical" as "medical" | "non_medical",
  assetDetailId: "",
  assetDetailName: "",
  assetDetailCode: "",
  borrowDate: "",
  dueDate: "",
  durationValue: "1",
  durationType: "day" as "day" | "month" | "year",
  borrowerPosition: currentUser ? getUserRoleLabel(currentUser.role) : "",
  borrowerWorkUnit: currentUser?.workUnit ?? "",
  ownerUserId: "",
  ownerName: "",
  ownerNip: "",
  ownerPosition: "",
  ownerWorkUnit: "",
  purposeType: "inside_hospital" as "inside_hospital" | "outside_hospital",
  destinationRoom: resolveDefaultDestinationRoom(currentUser),
  purpose: "",
  quantity: "1",
  notes: "",
})
