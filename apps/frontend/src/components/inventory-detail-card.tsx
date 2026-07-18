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
import { ASSET_LABEL_SIZES, type AssetLabelSizeId } from "@/utils/asset-label";
import { cn } from "@/utils";
import {
    CalendarDays,
    Check,
    Download,
    Gauge,
    History,
    MapPin,
    MessageSquareText,
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
    X,
} from "lucide-react";
import { useState } from "react";

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
  onDownloadLabel: (sizeId: AssetLabelSizeId) => void
  onPrintLabel: (sizeId: AssetLabelSizeId) => void
  onViewHistory?: () => void
  onEdit?: () => void
  onDelete?: () => void
  deleteLabel?: string
  highlighted?: boolean
  cardRef?: (el: HTMLDivElement | null) => void
}

const statusToneClassName = (statusLabel: string) => {
  if (statusLabel === "Tersedia") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
  if (statusLabel === "Dipinjam" || statusLabel === "Sedang Digunakan") return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300"
  if (statusLabel.toLowerCase().includes("pemeliharaan") || statusLabel.toLowerCase().includes("perbaikan") || statusLabel.toLowerCase().includes("kalibrasi") || statusLabel.toLowerCase().includes("inspeksi")) {
    return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
  }
  return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
}

const conditionToneClassName = (conditionLabel: string) => {
  if (conditionLabel === "Baik") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
  if (conditionLabel === "Cukup") return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
  return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
}

const pillClassName =
  "inline-flex min-h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200"
const chipIconClassName = "size-4 shrink-0"
const metaLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400"
const metaValueClassName = "mt-1.5 whitespace-pre-line text-sm font-semibold leading-5 text-slate-950 dark:text-slate-100"

function ActionTile({ action }: { action: ActionConfig }) {
  const Icon = action.icon
  return (
    <button
      type="button"
      onClick={action.onClick}
      aria-label={action.label}
      className={cn(
        "group flex min-w-14 flex-col items-center gap-1.5 rounded-lg px-1.5 py-1 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
        action.tone === "danger"
          ? "text-rose-600 dark:text-rose-400"
          : "text-blue-700 dark:text-blue-400",
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg transition-colors group-hover:bg-slate-100 group-active:scale-95 dark:group-hover:bg-slate-800",
          action.tone === "danger" && "group-hover:bg-rose-50 dark:group-hover:bg-rose-950/50",
        )}
      >
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <span className="text-[11px] font-medium leading-none text-slate-700 dark:text-slate-300">{action.label}</span>
    </button>
  )
}

function LabelPreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 border-b border-slate-100 py-1.5 text-xs last:border-b-0">
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <span className="min-w-0 font-medium leading-4 text-slate-950">{value || "-"}</span>
    </div>
  )
}

function DetailStat({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof QrCode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      <div className="flex size-5 shrink-0 items-center justify-center text-blue-700 dark:text-blue-400">
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
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
  const [labelAction, setLabelAction] = useState<"download" | "print" | null>(null)
  const [labelSizeId, setLabelSizeId] = useState<AssetLabelSizeId>("medium")
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
  ]

  if (onEdit) {
    actions.push({ label: "Edit", icon: PencilLine, onClick: onEdit })
  }

  if (onDelete) {
    actions.push({ label: deleteLabel, icon: Trash2, onClick: onDelete, tone: "danger" })
  }

  actions.push({ label: "Label", icon: Tags, onClick: () => setLabelDialogOpen(true) })

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.3)] transition sm:p-5 dark:border-slate-700 dark:bg-slate-900",
          highlighted && "border-teal-500 ring-2 ring-teal-400 ring-offset-2 dark:ring-offset-slate-950",
        )}
      >
        <div className="grid gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <h5 className="text-xl font-bold leading-tight tracking-[-0.02em] text-slate-950 dark:text-white">
              {title}
            </h5>
          </div>

          <div className="flex flex-wrap items-start gap-1 sm:gap-2 lg:justify-end lg:self-start">
            {actions.map((action) => (
              <ActionTile key={action.label} action={action} />
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5 lg:col-span-2">
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

        <div className="flex flex-1 flex-col pt-5">
          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            <DetailStat icon={ScanLine} label="Kode" value={code} />
            <DetailStat icon={QrCode} label="Nomor seri" value={serialNumber} />
            <DetailStat icon={Package2} label="Merk" value={brand} />
            <DetailStat icon={CalendarDays} label="Tanggal beli" value={purchaseDateText} />
            <DetailStat icon={Wrench} label={maintenanceLabel} value={maintenanceDateText} />
            <DetailStat icon={MapPin} label="Penggunaan" value={usageText} />
            {usageSummaryText ? (
              <DetailStat icon={Gauge} label="Frekuensi" value={usageSummaryText} />
            ) : null}
          </div>

          {notes ? (
            <div className="mt-5 flex items-start gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <div className="flex size-5 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400">
                <MessageSquareText className="size-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className={metaLabelClassName}>Catatan</p>
                <p className="mt-1.5 text-sm leading-5 text-slate-700 dark:text-slate-300">{notes}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog
        open={labelDialogOpen}
        onOpenChange={(open) => {
          setLabelDialogOpen(open)
          if (!open) setLabelAction(null)
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] gap-3 overflow-y-auto rounded-2xl p-5 sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-blue-700" />
              Label Inventaris
            </DialogTitle>
            <DialogDescription>
              Periksa detail alat sebelum mengunduh atau mencetak label.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-2">
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

          {labelAction && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pilih ukuran label</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Untuk {labelAction === "print" ? "dicetak" : "diunduh"}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLabelAction(null)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                  aria-label="Tutup pilihan ukuran"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-3 flex items-start justify-between border-b border-blue-200/70 dark:border-blue-900" role="group" aria-label="Ukuran label inventaris">
                {ASSET_LABEL_SIZES.map((size) => {
                  const isActive = size.id === labelSizeId
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setLabelSizeId(size.id)}
                      className={cn(
                        "relative flex min-w-0 flex-1 flex-col items-center px-1 pb-2.5 pt-1 text-center outline-none transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-blue-500",
                        isActive
                          ? "text-blue-700 after:bg-blue-600 dark:text-blue-300 dark:after:bg-blue-400"
                          : "text-slate-500 after:bg-transparent hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                      )}
                      aria-pressed={isActive}
                    >
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        {isActive && <Check className="size-3.5" aria-hidden="true" />}
                        {size.label}
                      </span>
                      <span className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        {size.widthMm}×{size.heightMm} mm
                      </span>
                    </button>
                  )
                })}
              </div>

              <Button
                className="mt-3 h-9 w-full rounded-xl bg-blue-700 text-white hover:bg-blue-800"
                onClick={() => {
                  if (labelAction === "print") onPrintLabel(labelSizeId)
                  else onDownloadLabel(labelSizeId)
                  setLabelAction(null)
                }}
              >
                {labelAction === "print" ? <Printer className="size-4" /> : <Download className="size-4" />}
                {labelAction === "print" ? "Cetak label" : "Unduh label"}
              </Button>
            </div>
          )}

          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              className="size-10 rounded-xl p-0"
              variant="outline"
              onClick={() => setLabelAction((current) => current === "download" ? null : "download")}
              aria-label="Unduh label inventaris"
              title="Unduh label inventaris"
              aria-pressed={labelAction === "download"}
            >
              <Download className="size-4" />
            </Button>
            <Button
              className="size-10 rounded-xl bg-blue-700 p-0 text-white hover:bg-blue-800"
              onClick={() => setLabelAction((current) => current === "print" ? null : "print")}
              aria-label="Cetak label inventaris"
              title="Cetak label inventaris"
              aria-pressed={labelAction === "print"}
            >
              <Printer className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
