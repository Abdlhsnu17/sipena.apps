"use client"

import type React from "react";

import InventoryPicker from "@/components/inventory-picker";
import MaintenanceTechnicianPicker from "@/components/maintenance-technician-picker";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { assetUsageService } from "@/services/asset-usage.service";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { getDetailInventoryStatusLabel } from "@/utils/detail-inventory";
import { maintenanceStatusLabel } from "@/utils/api-mappers";
import { toLocalDateTimeString } from "@/utils/format";
import { buildInventorySearchKey } from "@/utils/inventory-search";
import { getUserRoleLabel, normalizeUserRole } from "@/utils/role";
import { Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface MaintenanceFormProps {
  maintenance: any
  assets: DetailInventoryItem[]
  totalAssetsCount?: number
  lockedAssetsCount?: number
  prefillAsset?: DetailInventoryItem | null
  prefillNote?: string
  userRole?: string | null
  onSave: (data: any) => void
  onCancel: () => void
}

const formatAssetLabel = (asset: DetailInventoryItem) => {
  const inventoryLabel = asset.detailInventoryName || asset.detailName || asset.assetName || ""
  const brandLabel = asset.detailBrandModel
  const codeLabel = asset.detailCode || asset.assetCode
  const locationLabel = asset.assetLocation ? ` (${asset.assetLocation})` : ""
  const brandSuffix = brandLabel ? ` (${brandLabel})` : ""
  const codeSuffix = codeLabel ? ` - ${codeLabel}` : ""
  return `${inventoryLabel}${brandSuffix}${codeSuffix}${locationLabel}`.trim()
}

const getDetailInventoryKey = (asset: DetailInventoryItem, index?: number) => {
  const segments = [
    asset.detailId,
    asset.detailCode,
    asset.detailName,
    asset.assetLocation,
    asset.assetId ? String(asset.assetId) : undefined,
  ].filter(Boolean)

  const baseKey = segments.join("|")
  if (!baseKey) {
    return index !== undefined ? `asset-${index}` : `asset-${asset.assetId ?? "unknown"}`
  }
  return index !== undefined ? `${baseKey}-${index}` : baseKey
}

const buildRepairNoteTemplate = (asset?: DetailInventoryItem | null) => {
  const assetLabel = asset ? formatAssetLabel(asset) : ""
  const inventarisLine = assetLabel ? `Inventaris: ${assetLabel}` : ""
  return `\n\n${inventarisLine}`
}

const CANCELLATION_REASON_OPTIONS = [
  "Salah input",
  "Jadwal berubah",
  "Inventaris masih layak pakai",
]

const STATUS_OPTIONS = [
  { value: "requested", label: "Diajukan" },
  { value: "scheduled", label: "Disetujui" },
  { value: "in_progress", label: "Dalam Proses Perbaikan" },
  { value: "completed", label: "Tindakan Selesai - Menunggu Verifikasi" },
  { value: "validated", label: "Selesai Pemeliharaan Sarana" },
  { value: "cancelled", label: "Ditolak / Dibatalkan" },
] as const

const EDITABLE_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ["requested", "scheduled", "cancelled"],
  scheduled: ["scheduled", "in_progress", "cancelled"],
  in_progress: ["in_progress", "completed", "cancelled"],
  completed: ["completed", "validated", "in_progress"],
  validated: ["validated"],
  cancelled: ["cancelled"],
}

const EXECUTION_FIELD_LABELS: Record<string, string> = {
  diagnosis: "Diagnosis",
  actionTaken: "Tindakan yang Dilakukan",
  checklist: "Checklist Pekerjaan",
  spareParts: "Suku Cadang",
}

const EXECUTION_REQUIRED_FIELDS_BY_TYPE: Record<string, Array<keyof typeof EXECUTION_FIELD_LABELS>> = {
  preventive: ["checklist"],
  corrective: ["diagnosis", "actionTaken", "spareParts"],
  calibration: ["actionTaken"],
  inspection: ["checklist"],
}

const VERIFICATION_FIELD_LABELS: Record<string, string> = {
  finalCondition: "Kondisi Akhir",
  verificationResult: "Hasil Pengujian",
}

const VERIFICATION_REQUIRED_FIELDS_BY_TYPE: Record<string, Array<keyof typeof VERIFICATION_FIELD_LABELS>> = {
  calibration: ["verificationResult"],
}

export default function MaintenanceForm({
  maintenance,
  assets,
  prefillAsset,
  prefillNote,
  userRole,
  onSave,
  onCancel,
}: MaintenanceFormProps) {
  const isNewRequest = !maintenance
  const [selectedAsset, setSelectedAsset] = useState<DetailInventoryItem | null>(null)
  const defaultRepairNote = useMemo(() => buildRepairNoteTemplate(selectedAsset), [selectedAsset])
  const prevAutoRepairNoteRef = useRef(defaultRepairNote)
  const appliedPrefillRef = useRef(false)
  const scheduledDateInputRef = useRef<HTMLInputElement | null>(null)

  const [formData, setFormData] = useState(() => ({
    inventarisInput: "",
    assetId: "",
    assetType: "medical" as "medical" | "non_medical",
    assetDetailId: "",
    assetDetailName: "",
    assetDetailCode: "",
    assetLocation: "",
    type: "preventive",
    priority: "normal",
    // Database lama masih mewajibkan scheduled_date. Untuk pengajuan baru,
    // gunakan waktu pengajuan sebagai nilai awal sampai admin menjadwalkannya.
    scheduledDate: toLocalDateTimeString(new Date()) ?? "",
    startedAt: "",
    completedDate: "",
    description: "",

    technician: "",
    technicianUserId: "",
    technicianNip: "",
    technicianRole: "",
    technicianWorkUnit: "",
    vendorName: "",
    vendorReference: "",
    warrantyUntil: "",
    estimatedDurationMinutes: "",
    estimatedCost: "",
    damagePhotoUrl: "",
    beforePhotoUrl: "",
    afterPhotoUrl: "",
    diagnosis: "",
    actionTaken: "",
    checklist: "",
    spareParts: "",
    verificationResult: "",
    finalCondition: "",
    verificationNotes: "",
    nextMaintenanceDate: "",
    recurrenceInterval: "none",
    recurrenceEnabled: false,
    approvalStatus: "not_required",
    approvalNotes: "",
    status: "requested",
    cancellationReason: "",
    cost: "",
  }))
  const [damagePhotoFile, setDamagePhotoFile] = useState<File | null>(null)
  const [beforePhotoFile, setBeforePhotoFile] = useState<File | null>(null)
  const [afterPhotoFile, setAfterPhotoFile] = useState<File | null>(null)
  const [hasActiveUsage, setHasActiveUsage] = useState(false)

  const typeOptions = [
    { value: "preventive", label: "Rutin" },
    { value: "corrective", label: "Perbaikan" },
    { value: "calibration", label: "Kalibrasi" },
    { value: "inspection", label: "Inspeksi" },
  ]
  const visibleStatusOptions = useMemo(() => {
    if (!maintenance) {
      return STATUS_OPTIONS.filter((option) => option.value === "requested")
    }

    const currentStatus = maintenance.status || formData.status
    const allowedStatuses = EDITABLE_STATUS_TRANSITIONS[currentStatus] || [currentStatus]
    const normalizedRole = normalizeUserRole(userRole)
    return STATUS_OPTIONS.filter((option) => {
      if (!allowedStatuses.includes(option.value)) return false
      if (option.value === currentStatus) return true
      if (option.value === "cancelled") {
        if (["admin", "leader"].includes(normalizedRole)) return true
        if (normalizedRole === "staff_pj") return ["requested", "scheduled"].includes(currentStatus)
        return normalizedRole === "teknisi" && ["scheduled", "in_progress"].includes(currentStatus)
      }
      if (option.value === "scheduled") {
        return ["admin", "leader", "staff_pj"].includes(normalizedRole)
      }
      if (option.value === "in_progress") {
        return ["admin", "leader", "staff_pj", "teknisi"].includes(normalizedRole)
      }
      if (option.value === "completed" || option.value === "validated") {
        return ["admin", "leader", "teknisi"].includes(normalizedRole)
      }
      return ["admin", "leader", "teknisi"].includes(normalizedRole)
    })
  }, [formData.status, maintenance, userRole])
  const currentWorkflowStatus = formData.status || maintenance?.status || "requested"
  const workflowStageOrder: Record<string, number> = {
    requested: 1,
    scheduled: 2,
    in_progress: 3,
    completed: 4,
    validated: 4,
    cancelled: 1,
  }
  const activeStage = workflowStageOrder[currentWorkflowStatus] || 1
  const showRequestSection = activeStage === 1
  const showSchedulingSection = activeStage === 2
  const showExecutionSection = activeStage === 3
  const showVerificationSection = activeStage === 4
  const showCancellationSection = currentWorkflowStatus === "cancelled"
  const requiresExecutionCompletion = ["completed", "validated"].includes(formData.status)
  const canStartRepair = Boolean(
    maintenance?.status === "scheduled" &&
    formData.status === "scheduled" &&
    visibleStatusOptions.some((option) => option.value === "in_progress")
  )
  const reportDateLabel = toLocalDateTimeString(maintenance?.createdAt ?? maintenance?.created_at ?? new Date())?.replace("T", " ") || "-"
  const reporterLabel = maintenance?.requesterName || maintenance?.requester_name || "Pelapor terisi saat disimpan"
  const workflowStageLabel = isNewRequest
    ? "Tahap pengajuan"
    : currentWorkflowStatus === "requested"
      ? "Menunggu ACC"
      : currentWorkflowStatus === "scheduled"
        ? "ACC diterima - penugasan teknisi/vendor"
        : currentWorkflowStatus === "in_progress"
          ? "Proses perbaikan berjalan"
          : currentWorkflowStatus === "completed"
            ? "Tindakan selesai - verifikasi hasil"
            : currentWorkflowStatus === "validated"
              ? "Pemeliharaan tervalidasi"
              : "Dibatalkan"

  const getConditionLabel = (asset: DetailInventoryItem) => {
    if (asset.condition === "damaged") return "Rusak"
    if (asset.condition === "poor") return "Kurang"
    if (asset.condition === "fair") return "Cukup"
    return "Baik"
  }

  const normalizedRole = normalizeUserRole(userRole)
  const canEditRequestSection = isNewRequest || currentWorkflowStatus === "requested" || ["admin", "leader", "staff", "staff_pj", "user"].includes(normalizedRole)
  const canEditScheduling = ["admin", "leader", "staff_pj"].includes(normalizedRole) && ["requested", "scheduled"].includes(currentWorkflowStatus)
  const canEditExecution = ["teknisi", "admin", "leader"].includes(normalizedRole) && ["scheduled", "in_progress"].includes(currentWorkflowStatus)
  const canEditVerification = ["admin", "leader"].includes(normalizedRole) && ["completed", "validated"].includes(currentWorkflowStatus)
  const canCompleteExecution = Boolean(currentWorkflowStatus === "in_progress" && canEditExecution)
  const canValidateExecution = Boolean(currentWorkflowStatus === "completed" && canEditVerification)

  const assetsByLabel = useMemo(
    () =>
      assets.reduce<Record<string, DetailInventoryItem>>((acc, asset) => {
        const label = formatAssetLabel(asset).trim().toLowerCase()
        if (label) {
          acc[label] = asset
        }
        const fallbackLabel = [`${asset.detailName}`, `${asset.detailCode || asset.assetCode}`]
          .map((segment) => (segment ? segment.trim() : ""))
          .filter(Boolean)
          .join(" - ")
          .toLowerCase()
        if (fallbackLabel) {
          acc[fallbackLabel] = asset
        }
        return acc
      }, {}),
    [assets]
  )

  useEffect(() => {
    if (!maintenance) {
      setSelectedAsset(null)
      return
    }

    const labelParts = []
    if (maintenance.assetDetailName || maintenance.assetName) {
      labelParts.push(maintenance.assetDetailName || maintenance.assetName)
    }
    if (maintenance.assetDetailCode || maintenance.assetCode) {
      labelParts.push(maintenance.assetDetailCode || maintenance.assetCode)
    }
    const labelFromMaintenance = labelParts.join(" - ")
    const resolvedType = maintenance.assetType || "medical"
    const matchedByDetailId = maintenance.assetDetailId
      ? assets.find((asset) => asset.detailId === maintenance.assetDetailId)
      : null
    const matchedByAssetId = maintenance.assetId
      ? assets.find((asset) => asset.assetId === maintenance.assetId)
      : null
    const resolvedAsset = matchedByDetailId || matchedByAssetId || null
    setSelectedAsset(resolvedAsset)

    setFormData((prev) => ({
      ...prev,
      inventarisInput: labelFromMaintenance || prev.inventarisInput,
      assetId: maintenance.assetId ? String(maintenance.assetId) : prev.assetId,
      assetType: resolvedType,
      assetDetailId: maintenance.assetDetailId || prev.assetDetailId,
      assetDetailName: maintenance.assetDetailName || maintenance.assetName || prev.assetDetailName,
      assetDetailCode: maintenance.assetDetailCode || maintenance.assetCode || prev.assetDetailCode,
      assetLocation: maintenance.assetLocation || prev.assetLocation,
      type: maintenance.type || prev.type,
      priority: maintenance.priority || "normal",
      scheduledDate: toLocalDateTimeString(maintenance.scheduledDate ?? maintenance.scheduled_date) ?? "",
      startedAt: toLocalDateTimeString(maintenance.actualStartAt ?? maintenance.startedAt ?? maintenance.started_at) ?? "",
      completedDate: toLocalDateTimeString(maintenance.actualEndAt ?? maintenance.completedDate ?? maintenance.completed_date) ?? "",
      description: maintenance.description ?? buildRepairNoteTemplate(resolvedAsset),
      technician: maintenance.technician || "",
      technicianUserId: maintenance.technicianUserId ? String(maintenance.technicianUserId) : "",
      technicianNip: maintenance.technicianNip || "",
      technicianRole: maintenance.technicianRole || "",
      technicianWorkUnit: maintenance.technicianWorkUnit || "",
      vendorName: maintenance.vendorName || "",
      vendorReference: maintenance.vendorReference || "",
      warrantyUntil: maintenance.warrantyUntil ? String(maintenance.warrantyUntil).slice(0, 10) : "",
      estimatedDurationMinutes: maintenance.estimatedDurationMinutes ? String(maintenance.estimatedDurationMinutes) : "",
      estimatedCost: maintenance.estimatedCost ? String(maintenance.estimatedCost) : "",
      damagePhotoUrl: maintenance.damagePhotoUrl || "",
      beforePhotoUrl: maintenance.beforePhotoUrl || "",
      afterPhotoUrl: maintenance.afterPhotoUrl || "",
      diagnosis: maintenance.diagnosis || "",
      actionTaken: maintenance.actionTaken || "",
      checklist: maintenance.checklist || "",
      spareParts: maintenance.spareParts || "",
      verificationResult: maintenance.verificationResult || "",
      finalCondition: maintenance.finalCondition || "",
      verificationNotes: maintenance.verificationNotes || "",
      nextMaintenanceDate: maintenance.nextMaintenanceDate ? String(maintenance.nextMaintenanceDate).slice(0, 10) : "",
      recurrenceInterval: maintenance.recurrenceInterval || "none",
      recurrenceEnabled: Boolean(maintenance.recurrenceEnabled),
      approvalStatus: maintenance.approvalStatus || "not_required",
      approvalNotes: maintenance.approvalNotes || "",
      status: maintenance.status || "requested",
      cancellationReason:
        maintenance.cancellationReason ?? maintenance.cancellation_reason ?? "",
      cost: maintenance.cost ? String(maintenance.cost) : "",
    }))
  }, [maintenance, assets])

  useEffect(() => {
    if (maintenance) return
    if (appliedPrefillRef.current) return
    if (!prefillAsset) return

    appliedPrefillRef.current = true
    setSelectedAsset(prefillAsset)
    const prefillDescription = `${prefillNote ? prefillNote : ""}${buildRepairNoteTemplate(prefillAsset)}`
    prevAutoRepairNoteRef.current = prefillDescription
    setFormData((prev) => ({
      ...prev,
      inventarisInput: formatAssetLabel(prefillAsset),
      assetId: String(prefillAsset.assetId),
      assetType: prefillAsset.assetType || prev.assetType,
      assetDetailId: prefillAsset.detailId || prev.assetDetailId,
      assetDetailName: prefillAsset.detailInventoryName || prefillAsset.detailName || prev.assetDetailName,
      assetDetailCode: prefillAsset.detailCode || prev.assetDetailCode,
      assetLocation: prefillAsset.assetLocation || prev.assetLocation,
      type: "corrective",
      description: prefillDescription,
    }))
  }, [maintenance, prefillAsset, prefillNote])

  useEffect(() => {
    if (maintenance) return
    setFormData((prev) => {
      const shouldOverride =
        !prev.description || prev.description === prevAutoRepairNoteRef.current
      if (!shouldOverride) return prev
      return { ...prev, description: defaultRepairNote }
    })
    prevAutoRepairNoteRef.current = defaultRepairNote
  }, [defaultRepairNote, maintenance])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "status" && value !== "cancelled"
        ? { cancellationReason: "" }
        : {}),
    }))
  }

  const handleSelectAsset = (asset: DetailInventoryItem) => {
    setSelectedAsset(asset)
    setFormData((prev) => ({
      ...prev,
      inventarisInput: formatAssetLabel(asset),
      assetId: String(asset.assetId),
      assetType: asset.assetType || prev.assetType,
      assetDetailId: asset.detailId || prev.assetDetailId,
      assetDetailName: asset.detailInventoryName || asset.detailName || prev.assetDetailName,
      assetDetailCode: asset.detailCode || prev.assetDetailCode,
      assetLocation: asset.assetLocation || prev.assetLocation,
    }))

    window.setTimeout(() => {
      const scheduledDateInput = scheduledDateInputRef.current
      if (!scheduledDateInput) return
      scheduledDateInput.focus({ preventScroll: true })
    }, 120)
  }

  useEffect(() => {
    let mounted = true
    const checkUsage = async (asset?: DetailInventoryItem | null) => {
      if (!asset || !asset.assetId) {
        if (mounted) setHasActiveUsage(false)
        return
      }
      try {
        const resp = await assetUsageService.getAll({ page: 1, limit: 50, assetId: String(asset.assetId), assetType: asset.assetType })
        const active = Array.isArray(resp.data) && resp.data.some((u) => !u.endedAt && ( !u.assetDetailId || u.assetDetailId === asset.detailId ))
        if (mounted) setHasActiveUsage(Boolean(active))
      } catch {
        if (mounted) setHasActiveUsage(false)
      }
    }
    // check when selectedAsset or form status changes (we only block for active maintenance statuses)
    void checkUsage(selectedAsset)
    return () => { mounted = false }
  }, [selectedAsset, formData.status])

  const findMatchedAsset = () => {
    if (formData.assetDetailId) {
      return assets.find((asset) => asset.detailId === formData.assetDetailId)
    }
    if (formData.assetId) {
      return assets.find((asset) => String(asset.assetId) === formData.assetId)
    }
    const label = formData.inventarisInput.trim().toLowerCase()
    return label ? assetsByLabel[label] : undefined
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const effectiveStatus = submitter?.value === "start_repair"
      ? "in_progress"
      : submitter?.value === "complete"
        ? "completed"
        : submitter?.value === "validate"
          ? "validated"
          : formData.status

    if (effectiveStatus === "cancelled" && !formData.cancellationReason.trim()) {
      alert("Alasan pembatalan wajib diisi jika status Dibatalkan")
      return
    }
    if (effectiveStatus === "in_progress" && !formData.technicianUserId) {
      alert("Pilih akun teknisi/PJ sebelum memulai proses perbaikan.")
      return
    }
    const activeExecutionStatuses = ["in_progress", "completed", "validated"]
    const isBlockedByUsage = hasActiveUsage && activeExecutionStatuses.includes(effectiveStatus)
    if (isBlockedByUsage) {
      alert("Aset sedang digunakan — tidak dapat membuat pemeliharaan aktif sampai penggunaan selesai.")
      return
    }

    if (["completed", "validated"].includes(effectiveStatus)) {
      const requiredExecutionFields = EXECUTION_REQUIRED_FIELDS_BY_TYPE[formData.type] || EXECUTION_REQUIRED_FIELDS_BY_TYPE.preventive
      const formDataRecord = formData as unknown as Record<string, string>
      const missingExecutionField = requiredExecutionFields.find((field) => !(formDataRecord[field] ?? "").trim())
      if (missingExecutionField) {
        alert(`Isi ${EXECUTION_FIELD_LABELS[missingExecutionField]} sebelum menyelesaikan tindakan perbaikan.`)
        return
      }
    }

    if (effectiveStatus === "validated") {
      if (!formData.finalCondition.trim()) {
        alert("Pilih Kondisi Akhir sebelum validasi final.")
        return
      }
      const requiredVerificationFields = VERIFICATION_REQUIRED_FIELDS_BY_TYPE[formData.type] || []
      const formDataRecord = formData as unknown as Record<string, string>
      const missingVerificationField = requiredVerificationFields.find((field) => !(formDataRecord[field] ?? "").trim())
      if (missingVerificationField) {
        alert(`Isi ${VERIFICATION_FIELD_LABELS[missingVerificationField]} sebelum validasi final.`)
        return
      }
    }

    const resolvedAsset = selectedAsset ?? findMatchedAsset()
    const {
      inventarisInput,
      assetDetailId,
      assetDetailName,
      assetDetailCode,
      cancellationReason,
      ...rest
    } = formData
    const resolvedAssetId =
      resolvedAsset?.assetId ?? (rest.assetId ? Number(rest.assetId) : undefined)
    const resolvedAssetType = resolvedAsset?.assetType || rest.assetType
    const payload = {
      ...rest,
      status: effectiveStatus,
      assetId: resolvedAssetId,
      assetType: resolvedAssetType,
      assetDetailId: resolvedAsset?.detailId || assetDetailId || undefined,
      assetDetailName: resolvedAsset?.detailName || assetDetailName || inventarisInput,
      assetDetailCode: resolvedAsset?.detailCode || assetDetailCode || "",
      startedAt: rest.startedAt || undefined,
      completedDate: rest.completedDate || undefined,
      actualStartAt: rest.startedAt || undefined,
      actualEndAt: rest.completedDate || undefined,
      recurrenceEnabled: Boolean(rest.recurrenceEnabled && rest.recurrenceInterval !== "none"),
      cancellationReason: cancellationReason.trim() || undefined,
      attachmentFiles: {
        damagePhoto: damagePhotoFile,
        beforePhoto: beforePhotoFile,
        afterPhoto: afterPhotoFile,
      },
    }
    console.debug("Maintenance payload:", payload)
    // If admin/leader saving as scheduled without technician, confirm action.
    if (payload.status === "scheduled" && !payload.technicianUserId && ["admin", "leader"].includes(normalizeUserRole(userRole))) {
      const ok = window.confirm("Anda belum memilih teknisi/PJ. Tetapkan diri Anda sebagai teknisi/PJ dan lanjutkan?")
      if (!ok) return
    }

    onSave(payload)
  }


  return (
    <Card className="m-0 flex max-h-[90dvh] flex-col overflow-hidden rounded-2xl border-0 text-sm shadow-none">
      {isNewRequest && (
        <CardHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
          <CardTitle className="text-base">Tambah Pemeliharaan Sarana</CardTitle>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Tutup formulir"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>
      )}

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {showRequestSection && (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">1. Pengajuan Pemeliharaan</h3>
              <p className="text-xs text-muted-foreground">Isi inventaris, jenis layanan, prioritas, keluhan, dan bukti awal.</p>
              <p className="mt-2 inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-300">
                {workflowStageLabel}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Pilih Inventaris</label>
                <InventoryPicker
                  assets={assets}
                  selectedAsset={selectedAsset}
                  onSelect={handleSelectAsset}
                  formatLabel={formatAssetLabel}
                  getItemKey={getDetailInventoryKey}
                  getAssetCategory={(asset) => asset.assetType}
                  showCategoryFilter
                  searchValue={buildInventorySearchKey}
                  placeholder="Cari inventaris..."
                  buttonLabel="Pilih inventaris"
                  buttonClassName="h-10"
                  ariaLabel="Pilih inventaris untuk pemeliharaan"
                  renderItemMeta={(asset) => (
                    <span>{getDetailInventoryStatusLabel(asset)} · Kondisi: {getConditionLabel(asset)}</span>
                  )}
                  noResultsLabel="Tidak ada alat inventaris yang tersedia"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Tipe Layanan</label>
                <select name="type" value={formData.type} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Prioritas</label>
                <select name="priority" value={formData.priority} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="low">Rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option><option value="critical">Kritis</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Tanggal Pengajuan</label>
                <input type="text" value={reportDateLabel} readOnly className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Pelapor</label>
                <input type="text" value={reporterLabel} readOnly className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" />
              </div>
              {isNewRequest && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Status Pengajuan</label>
                  <input type="text" readOnly value="Diajukan" className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" />
                </div>
              )}
              {showCancellationSection && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-foreground">Alasan Pembatalan</label>
                  <input type="text" name="cancellationReason" value={formData.cancellationReason} onChange={handleChange} required list="maintenance-cancellation-reasons" className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Pilih atau ketik alasan pembatalan" />
                  <datalist id="maintenance-cancellation-reasons">
                    {CANCELLATION_REASON_OPTIONS.map((option) => <option key={option} value={option} />)}
                  </datalist>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">Keluhan / Kerusakan</label>
                <textarea name="description" value={formData.description} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={3} placeholder="Cantumkan keluhan dan alat yang diperiksa" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Foto Kerusakan (URL)</label>
                <input type="url" name="damagePhotoUrl" value={formData.damagePhotoUrl} onChange={handleChange} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="URL foto/dokumen" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Foto Kerusakan (Upload)</label>
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(event) => setDamagePhotoFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-muted-foreground file:mr-3 file:h-10 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3 file:text-sm file:font-medium file:text-white" />
              </div>
            </div>
          </section>
          )}

          {showSchedulingSection && (
          <section className="space-y-3 border-t border-border/70 pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">2. Penjadwalan</h3>
              <p className="text-xs text-muted-foreground">Diisi admin/koordinator: teknisi, jadwal pelaksanaan, estimasi durasi, vendor, dan catatan penugasan.</p>
            </div>
            {currentWorkflowStatus === "scheduled" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                Setelah penugasan teknisi/leader/vendor siap, ubah status ke <b>Dalam Proses Perbaikan</b>. Form pelaksanaan perbaikan akan terbuka pada tahap itu.
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Cari Akun Teknisi / PJ</label>
              {canEditScheduling ? (
                <MaintenanceTechnicianPicker
                  value={formData.technicianUserId ? Number(formData.technicianUserId) : null}
                  selected={formData.technicianUserId ? {
                    id: Number(formData.technicianUserId), nip: formData.technicianNip,
                    name: formData.technician, role: formData.technicianRole,
                    workUnit: formData.technicianWorkUnit,
                  } : null}
                  onSelect={(technician) => setFormData((prev) => ({
                    ...prev, technician: technician.name, technicianUserId: String(technician.id),
                    technicianNip: technician.nip, technicianRole: technician.role,
                    technicianWorkUnit: technician.workUnit || technician.subWorkUnit || "",
                  }))}
                />
              ) : null}
            </div>
            {formData.technicianUserId ? (
              <div className="grid gap-3 rounded-xl border border-teal-200/70 bg-teal-50/60 p-3 sm:grid-cols-3 dark:border-teal-900/60 dark:bg-teal-950/20">
                <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">NIP</p><p className="mt-1 truncate text-sm font-semibold">{formData.technicianNip || "-"}</p></div>
                <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Jabatan</p><p className="mt-1 truncate text-sm font-semibold">{formData.technicianRole ? getUserRoleLabel(formData.technicianRole) : "-"}</p></div>
                <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Unit Kerja</p><p className="mt-1 truncate text-sm font-semibold">{formData.technicianWorkUnit || "-"}</p></div>
              </div>
            ) : (
              <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">Nama, NIP, jabatan, dan unit kerja akan tampil setelah akun dipilih.</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Jadwal Pelaksanaan</label>
                <input ref={scheduledDateInputRef} type="datetime-local" name="scheduledDate" value={formData.scheduledDate} onChange={handleChange} required step={60} disabled={!canEditScheduling} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Estimasi Durasi (menit)</label>
                <input type="number" name="estimatedDurationMinutes" value={formData.estimatedDurationMinutes} onChange={handleChange} min="0" disabled={!canEditScheduling} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Opsional" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Vendor/Penyedia Jasa</label>
                <input type="text" name="vendorName" value={formData.vendorName} onChange={handleChange} disabled={!canEditScheduling} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Opsional" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">No. Referensi Vendor</label>
                <input type="text" name="vendorReference" value={formData.vendorReference} onChange={handleChange} disabled={!canEditScheduling} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="PO / invoice / tiket" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Estimasi Biaya (Rp)</label>
                <input type="number" name="estimatedCost" value={formData.estimatedCost} onChange={handleChange} min="0" disabled={!canEditScheduling} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Opsional" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">Catatan Penugasan</label>
                <textarea name="approvalNotes" value={formData.approvalNotes} onChange={handleChange} disabled={!canEditScheduling} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={2} placeholder="Catatan untuk teknisi/vendor terkait penugasan" />
              </div>
            </div>
          </section>
          )}

          {showExecutionSection && (
          <section className="space-y-3 border-t border-border/70 pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">3. Pelaksanaan</h3>
              <p className="text-xs text-muted-foreground">Diisi oleh teknisi/leader/vendor saat proses berjalan: diagnosis, tindakan, checklist, suku cadang, foto, dan biaya aktual.</p>
            </div>
            {currentWorkflowStatus === "in_progress" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200">
                Setelah diagnosis, tindakan, checklist, foto, dan biaya aktual selesai diisi, ubah status ke <b>Tindakan Selesai - Menunggu Verifikasi</b> untuk masuk tahap verifikasi.
              </div>
            )}
            {currentWorkflowStatus === "completed" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                Status sudah di tahap <b>Tindakan Selesai</b>. Pastikan diagnosis, tindakan, dan checklist sudah lengkap sebelum lanjut validasi final.
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Waktu Mulai Manual</label>
                <input type="datetime-local" name="startedAt" value={formData.startedAt} onChange={handleChange} step={60} disabled={!canEditExecution} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Waktu Selesai Manual</label>
                <input type="datetime-local" name="completedDate" value={formData.completedDate} onChange={handleChange} step={60} disabled={!canEditExecution} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Foto Sebelum</label>
                <input type="url" name="beforePhotoUrl" value={formData.beforePhotoUrl} onChange={handleChange} disabled={!canEditExecution} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="URL foto sebelum" />
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(event) => setBeforePhotoFile(event.target.files?.[0] ?? null)} disabled={!canEditExecution} className="mt-2 block w-full text-sm text-muted-foreground file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:text-sm file:font-medium file:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Foto Sesudah</label>
                <input type="url" name="afterPhotoUrl" value={formData.afterPhotoUrl} onChange={handleChange} disabled={!canEditExecution} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="URL foto sesudah" />
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={(event) => setAfterPhotoFile(event.target.files?.[0] ?? null)} disabled={!canEditExecution} className="mt-2 block w-full text-sm text-muted-foreground file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:text-sm file:font-medium file:text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">Diagnosis</label>
                <textarea name="diagnosis" value={formData.diagnosis} onChange={handleChange} required={requiresExecutionCompletion} disabled={!canEditExecution} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={2} placeholder="Hasil pengecekan teknisi" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">Tindakan yang Dilakukan</label>
                <textarea name="actionTaken" value={formData.actionTaken} onChange={handleChange} required={requiresExecutionCompletion} disabled={!canEditExecution} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={2} placeholder="Perbaikan, penggantian, kalibrasi, atau inspeksi" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Checklist Pekerjaan</label>
                <textarea name="checklist" value={formData.checklist} onChange={handleChange} required={requiresExecutionCompletion} disabled={!canEditExecution} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={3} placeholder="Satu item per baris" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Suku Cadang</label>
                <textarea name="spareParts" value={formData.spareParts} onChange={handleChange} disabled={!canEditExecution} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={3} placeholder="Nama, jumlah, dan keterangan" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Biaya Aktual (Rp)</label>
                <input type="number" name="cost" value={formData.cost} onChange={handleChange} min="0" disabled={!canEditExecution} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="Biaya aktual pekerjaan" />
              </div>
            </div>
          </section>
          )}

          {showVerificationSection && (
          <section className="space-y-3 border-t border-border/70 pt-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">4. Verifikasi</h3>
              <p className="text-xs text-muted-foreground">Dilanjutkan setelah tindakan selesai untuk memastikan hasil perbaikan, kondisi akhir, dan jadwal berikutnya.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Kondisi Akhir</label>
                <select name="finalCondition" value={formData.finalCondition} onChange={handleChange} required={formData.status === "validated"} disabled={!canEditVerification} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="">Belum diverifikasi</option>
                  <option value="Baik">Baik</option>
                  <option value="Cukup">Cukup</option>
                  <option value="Kurang">Kurang</option>
                  <option value="Rusak">Rusak</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Pemeliharaan Berikutnya</label>
                <input type="date" name="nextMaintenanceDate" value={formData.nextMaintenanceDate} onChange={handleChange} disabled={!canEditVerification} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">Hasil Pengujian</label>
                <textarea name="verificationResult" value={formData.verificationResult} onChange={handleChange} required={formData.status === "validated"} disabled={!canEditVerification} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={2} placeholder="Hasil uji fungsi atau kalibrasi" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground">Catatan Verifikasi</label>
                <textarea name="verificationNotes" value={formData.verificationNotes} onChange={handleChange} disabled={!canEditVerification} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" rows={2} placeholder="Catatan admin/leader/pengguna aset" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Status Selesai</label>
                <input type="text" readOnly value={maintenanceStatusLabel(canValidateExecution ? "validated" : formData.status, formData.type)} className="h-10 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground" />
              </div>
            </div>
          </section>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {hasActiveUsage && ["in_progress","completed","validated"].includes(formData.status) ? (
            <p className="text-xs text-red-600 sm:text-sm">Aset sedang digunakan. Hentikan penggunaan sebelum membuat pemeliharaan aktif.</p>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Batal
            </Button>
            <Button
              type="submit"
              value={canStartRepair ? "start_repair" : canCompleteExecution ? "complete" : canValidateExecution ? "validate" : "save"}
              className="bg-teal-600 hover:bg-teal-700"
              disabled={hasActiveUsage && (canStartRepair || ["in_progress","completed","validated"].includes(formData.status))}
            >
              <Save className="mr-2 h-4 w-4" />
              {canStartRepair ? "Simpan & Mulai Perbaikan" : canCompleteExecution ? "Simpan & Selesaikan Tindakan" : canValidateExecution ? "Simpan & Validasi Final" : "Simpan Pemeliharaan"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}
