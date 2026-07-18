"use client"

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/utils";
import {
    CalendarDays,
    Download,
    History,
    MapPin,
    Package2,
    PencilLine,
    Printer,
    QrCode,
    ScanLine,
    ShieldCheck,
    SquareStack,
    Tags,
    Trash2,
    Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";

type ActionConfig = {
  label: string
  icon: typeof QrCode
  onClick: () => void
  tone?: "default" | "danger"
}

type InventoryDetailCardProps = {
  title: string
  noId: string
  statusLabel: string
  conditionLabel: string
  categoryLabel: string
  code: string
  serialNumber: string
  brand: string
  purchaseDateText: string
  maintenanceLabel: string
  maintenanceDateText: string
  usageText: string
  usageSummaryText?: string
  notes?: string
  onShowQr: () => void
  onDownloadLabel: () => void
  onPrintLabel: () => void
  onViewHistory?: () => void
  onEdit?: () => void
  onDelete?: () => void
  deleteLabel?: string
  highlighted?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
}

const statusToneClassName = (statusLabel: string) => {
  if (statusLabel === "Tersedia") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (statusLabel === "Dipinjam" || statusLabel === "Sedang Digunakan") return "border-sky-200 bg-sky-50 text-sky-800"
  if (statusLabel.toLowerCase().includes("pemeliharaan") || statusLabel.toLowerCase().includes("perbaikan") || statusLabel.toLowerCase().includes("kalibrasi") || statusLabel.toLowerCase().includes("inspeksi")) {
    return "border-amber-200 bg-amber-50 text-amber-900"
  }
  return "border-rose-200 bg-rose-50 text-rose-800"
}

const conditionToneClassName = (conditionLabel: string) => {
  if (conditionLabel === "Baik") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (conditionLabel === "Cukup") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-red-200 bg-red-50 text-red-800"
}

const pillClassName =
  "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-800"
const chipIconClassName = "h-3 w-3 shrink-0"
const actionIconClassName = "h-4.5 w-4.5"
const detailIconClassName = "h-3.5 w-3.5"
const metaLabelClassName = "text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"
const metaValueClassName = "mt-1 whitespace-pre-line text-sm font-medium leading-5 text-slate-950"

function ActionTile({ action }: { action: ActionConfig }) {
  const Icon = action.icon
  return (
    <button
      type="button"
      onClick={action.onClick}
      className={cn(
        "flex w-14 flex-col items-center justify-start gap-1 px-1 py-1 text-center transition hover:opacity-80 sm:w-16",
        action.tone === "danger"
          ? "text-red-600"
          : "text-blue-700",
      )}
    >
      <Icon className={actionIconClassName} strokeWidth={1.8} />
      <span className="text-[11px] font-medium leading-none text-slate-900">{action.label}</span>
    </button>
  )
}

function LabelActionTile({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-14 flex-col items-center justify-start gap-1 px-1 py-1 text-center text-blue-700 transition hover:opacity-80 sm:w-16"
      aria-label="Lihat label"
    >
      <Tags className={actionIconClassName} strokeWidth={1.8} />
      <span className="text-[11px] font-medium leading-none text-slate-900">Label</span>
    </button>
  )
}

function LabelPreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2 text-sm last:border-b-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="min-w-0 font-medium text-slate-950">{value || "-"}</span>
    </div>
  )
}

function DetailStat({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <div className="pt-0.5 text-blue-700">{icon}</div>
      <div className="min-w-0">
        <p className={metaLabelClassName}>{label}</p>
        <p className={metaValueClassName}>{value || "-"}</p>
      </div>
    </div>
  )
}

export function InventoryDetailCard({
  title,
  noId,
  statusLabel,
  conditionLabel,
  categoryLabel,
  code,
  serialNumber,
  brand,
  purchaseDateText,
  maintenanceLabel,
  maintenanceDateText,
  usageText,
  usageSummaryText,
  notes,
  onShowQr,
  onDownloadLabel,
  onPrintLabel,
  onViewHistory,
  onEdit,
  onDelete,
  deleteLabel = "Hapus",
  highlighted = false,
  cardRef,
}: InventoryDetailCardProps) {
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const actions: ActionConfig[] = [
    { label: "QR Code", icon: QrCode, onClick: onShowQr },
  ]

  if (onViewHistory) {
    actions.push({ label: "Riwayat", icon: History, onClick: onViewHistory })
  }

  const labelPreviewRows = [
    { label: "No ID", value: noId },
    { label: "Kode", value: code },
    { label: "SN", value: serialNumber },
    { label: "Merk", value: brand },
    { label: "Kategori", value: categoryLabel },
    { label: "Status", value: statusLabel },
    { label: "Kondisi", value: conditionLabel },
    { label: "Tanggal Beli", value: purchaseDateText },
    { label: maintenanceLabel, value: maintenanceDateText },
    { label: "Penggunaan", value: usageText },
    ...(usageSummaryText ? [{ label: "Frekuensi", value: usageSummaryText }] : []),
  ]

  if (onEdit) {
    actions.push({ label: "Edit", icon: PencilLine, onClick: onEdit })
  }

  if (onDelete) {
    actions.push({ label: deleteLabel, icon: Trash2, onClick: onDelete, tone: "danger" })
  }

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          "flex h-full flex-col rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.35)] transition",
          highlighted && "border-teal-500 ring-2 ring-teal-400 ring-offset-2",
        )}
      >
        <div className="grid gap-4 border-b border-slate-200 pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <h5 className="text-lg font-semibold leading-tight tracking-tight text-slate-950 sm:text-xl">
              {title}
            </h5>
          </div>

          <div className="flex flex-wrap justify-end gap-x-2 gap-y-2 lg:gap-x-3 lg:self-start">
            {actions.map((action) => (
              <ActionTile key={action.label} action={action} />
            ))}
            <LabelActionTile onClick={() => setLabelDialogOpen(true)} />
          </div>

          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <div className={cn(pillClassName, "bg-white")}>
              <SquareStack className={cn(chipIconClassName, "text-slate-700")} />
              <span>No ID: {noId}</span>
            </div>
            <div className={cn(pillClassName, statusToneClassName(statusLabel))}>
              <ShieldCheck className={chipIconClassName} />
              <span>{statusLabel}</span>
            </div>
            <div className={cn(pillClassName, conditionToneClassName(conditionLabel))}>
              <ShieldCheck className={chipIconClassName} />
              <span>{conditionLabel}</span>
            </div>
            <div className={cn(pillClassName, "text-blue-800")}>
              <Package2 className={cn(chipIconClassName, "text-blue-700")} />
              <span>Kategori: {categoryLabel}</span>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            <DetailStat icon={<ScanLine className={detailIconClassName} />} label="Kode" value={code} />
            <DetailStat icon={<QrCode className={detailIconClassName} />} label="SN" value={serialNumber} />
            <DetailStat icon={<Package2 className={detailIconClassName} />} label="Merk" value={brand} />
            <DetailStat icon={<CalendarDays className={detailIconClassName} />} label="Tanggal Beli" value={purchaseDateText} />
            <DetailStat icon={<Wrench className={detailIconClassName} />} label={maintenanceLabel} value={maintenanceDateText} />
            <DetailStat icon={<MapPin className={detailIconClassName} />} label="Penggunaan" value={usageText} />
            {usageSummaryText ? (
              <DetailStat icon={<CalendarDays className={detailIconClassName} />} label="Frekuensi" value={usageSummaryText} />
            ) : null}
          </div>

          {notes ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className={metaLabelClassName}>Catatan</p>
              <p className="mt-1.5 text-[11px] leading-5 text-slate-700">{notes}</p>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-blue-700" />
              Label Inventaris
            </DialogTitle>
            <DialogDescription>
              Periksa detail alat sebelum mengunduh atau mencetak label.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">SIPENA - Identitas Inventaris</p>
                <p className="mt-1 text-base font-bold leading-tight text-slate-950">{title}</p>
              </div>
              <span className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase text-slate-700">
                {categoryLabel || "Inventaris"}
              </span>
            </div>
            <div>
              {labelPreviewRows.map((row) => (
                <LabelPreviewRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={onDownloadLabel}>
              <Download className="mr-2 h-4 w-4" />
              Unduh Label
            </Button>
            <Button variant="outline" onClick={onPrintLabel}>
              <Printer className="mr-2 h-4 w-4" />
              Cetak Label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
