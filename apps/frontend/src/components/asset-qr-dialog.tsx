"use client"

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DetailSource } from "@/types/detail-inventory";
import { ASSET_LABEL_SIZES, sanitizeAssetFilename, type AssetLabelSizeId } from "@/utils/asset-label";
import { buildScanTargetParams } from "@/utils/asset-scan-target";
import { Check, CheckCircle2, Download, Printer, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

export interface AssetQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Canonical human-readable identifier, e.g. "IMD-DTL-0001". */
  noId: string
  /** Real database identifier of the detail row, used to build the scan target link. */
  detailId: string
  assetId: number
  assetType: DetailSource
  assetName: string
  assetCode?: string
  serialNumber?: string
  location?: string
  condition?: string
  status?: string
  purchaseDate?: string
  nextMaintenance?: string
  /** "Medis" / "Non-Medis" badge label. */
  sourceLabel?: string
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

type QrAction = "download" | "print"

type QrLabelSize = (typeof ASSET_LABEL_SIZES)[number] & {
  qrMm: number
}

const QR_SIZE_MM: Record<AssetLabelSizeId, number> = {
  small: 38,
  medium: 46,
  large: 54,
}

/** QR labels share the exact physical sizes used by the inventory labels. */
const LABEL_SIZES: QrLabelSize[] = ASSET_LABEL_SIZES.map((size) => ({
  ...size,
  qrMm: QR_SIZE_MM[size.id],
}))

const sizeDimensionLabel = (size: QrLabelSize): string => `${size.widthMm}×${size.heightMm} mm`

const hasValue = (value?: string): value is string => Boolean(value?.trim() && value.trim() !== "-")

function IdentityPreviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 border-b border-slate-100 py-1.5 text-xs last:border-b-0 dark:border-slate-800">
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="min-w-0 break-words font-medium leading-4 text-slate-950 dark:text-slate-100">
        {hasValue(value) ? value : "-"}
      </span>
    </div>
  )
}

const buildQrIdentityValue = ({
  noId,
  assetName,
  assetCode,
  serialNumber,
  location,
  sourceLabel,
}: Pick<AssetQrDialogProps, "noId" | "assetName" | "assetCode" | "serialNumber" | "location" | "sourceLabel">): string => {
  const rows = [
    ["NO ID", noId],
    ["NAMA", assetName],
    ["KODE", assetCode],
    ["SN", serialNumber],
    ["LOKASI", location],
    ["SUMBER", sourceLabel],
  ]
    .filter(([, value]) => hasValue(value))
    .map(([label, value]) => `${label}: ${value?.trim()}`)

  return rows.length ? rows.join("\n") : "ASET SIPENA"
}

export function AssetQrDialog({
  open,
  onOpenChange,
  noId,
  detailId,
  assetId,
  assetType,
  assetName,
  assetCode,
  serialNumber,
  location,
  sourceLabel,
}: AssetQrDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [dataUrl, setDataUrl] = useState<string>("")
  const [selectedSizeId, setSelectedSizeId] = useState<AssetLabelSizeId>("medium")
  const [activeAction, setActiveAction] = useState<QrAction | null>(null)

  const scanUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/scan?${buildScanTargetParams({ detailId, assetId, type: assetType }).toString()}`
      : ""
  const qrValue = scanUrl || buildQrIdentityValue({ noId, assetName, assetCode, serialNumber, location, sourceLabel })

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const render = async () => {
      try {
        const url = await QRCode.toDataURL(qrValue, {
          errorCorrectionLevel: "M",
          margin: 4,
          width: 512,
          color: { dark: "#0f172a", light: "#ffffff" },
        })
        if (cancelled) return
        setDataUrl(url)
        const canvas = canvasRef.current
        if (canvas) {
          await QRCode.toCanvas(canvas, qrValue, {
            errorCorrectionLevel: "M",
            margin: 4,
            width: 260,
            color: { dark: "#0f172a", light: "#ffffff" },
          })
        }
      } catch {
        if (!cancelled) setDataUrl("")
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [open, qrValue])

  const handleDownload = async () => {
    if (!dataUrl) return
    const size = LABEL_SIZES.find((item) => item.id === selectedSizeId) ?? LABEL_SIZES[1]
    const dpi = 300
    const mmToPixels = (millimetres: number) => Math.round((millimetres / 25.4) * dpi)
    const canvas = document.createElement("canvas")
    canvas.width = mmToPixels(size.widthMm)
    canvas.height = mmToPixels(size.heightMm)
    const context = canvas.getContext("2d")
    if (!context) return

    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)

    const qrImage = new Image()
    qrImage.src = dataUrl
    await qrImage.decode()
    const qrPixels = mmToPixels(size.qrMm)
    context.drawImage(
      qrImage,
      Math.round((canvas.width - qrPixels) / 2),
      Math.round((canvas.height - qrPixels) / 2),
      qrPixels,
      qrPixels,
    )

    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = `QR-${sanitizeAssetFilename(noId || assetCode || assetName || "aset")}-${size.widthMm}x${size.heightMm}mm.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setActiveAction(null)
  }

  const handlePrint = () => {
    if (!dataUrl) return
    const size = LABEL_SIZES.find((item) => item.id === selectedSizeId) ?? LABEL_SIZES[1]
    const printWindow = window.open("", "_blank", "width=520,height=640")
    if (!printWindow) return

    const qrSizeMm = Math.min(size.qrMm, Math.min(size.widthMm, size.heightMm) - size.paddingMm * 2)

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QR ${escapeHtml(noId || qrValue)}</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { background: #ffffff; }
      .qr-page {
        width: ${size.widthMm}mm;
        height: ${size.heightMm}mm;
        padding: ${size.paddingMm}mm;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      img {
        display: block;
        width: ${qrSizeMm}mm;
        height: ${qrSizeMm}mm;
      }
    </style>
  </head>
  <body>
    <div class="qr-page">
      <img src="${dataUrl}" alt="QR ${escapeHtml(qrValue)}" />
    </div>
    <script>
      window.onload = function () {
        window.focus();
        window.print();
        setTimeout(function () { window.close(); }, 300);
      };
    </script>
  </body>
</html>`)
    printWindow.document.close()
    setActiveAction(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto rounded-3xl border-slate-200/80 p-0 shadow-2xl shadow-slate-950/15 sm:max-w-[440px] dark:border-slate-800 dark:shadow-black/30">
        <DialogHeader className="border-b border-slate-100 px-4 py-3 pr-12 text-left dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/15">
              <QrCode className="size-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-lg leading-5 font-bold tracking-tight text-slate-950 dark:text-slate-50">
                Kode QR Aset
              </DialogTitle>
              <DialogDescription className="text-xs leading-4">
                Pindai untuk membuka detail atau simpan untuk dicetak.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  SIPENA - Identitas Inventaris
                </p>
                <p className="mt-1 text-base font-bold leading-tight text-slate-950 dark:text-slate-50">
                  {assetName || "Aset SIPENA"}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold uppercase text-slate-700 dark:border-slate-700 dark:text-slate-300">
                {sourceLabel || "Inventaris"}
              </span>
            </div>
            <div>
              <IdentityPreviewRow label="No. ID" value={noId} />
              <IdentityPreviewRow label="Kode" value={assetCode} />
              <IdentityPreviewRow label="Nomor Seri" value={serialNumber} />
              <IdentityPreviewRow label="Lokasi" value={location} />
            </div>

            <div className="mt-3 flex flex-col items-center border-t border-slate-200 pt-3 dark:border-slate-800">
              <div className="rounded-2xl bg-white p-3 shadow-[0_14px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
                <canvas
                  ref={canvasRef}
                  className="size-[236px] sm:size-[260px]"
                  aria-label={`Kode QR untuk ${assetName || noId}`}
                />
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/15">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Siap dipindai
              </div>
            </div>
          </div>

          {activeAction && (
            <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-3.5 dark:border-teal-900/60 dark:bg-teal-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Pilih ukuran label
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Untuk {activeAction === "print" ? "dicetak" : "diunduh"}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                  aria-label="Tutup pilihan ukuran"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-3 flex items-start justify-between border-b border-teal-200/70 dark:border-teal-900" role="group" aria-label="Ukuran label">
                {LABEL_SIZES.map((size) => {
                  const isActive = size.id === selectedSizeId
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setSelectedSizeId(size.id)}
                      className={`relative flex min-w-0 flex-1 flex-col items-center px-1 pb-2.5 pt-1 text-center outline-none transition-colors after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-teal-500 ${
                        isActive
                          ? "text-teal-700 after:bg-teal-600 dark:text-teal-300 dark:after:bg-teal-400"
                          : "text-slate-500 after:bg-transparent hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      }`}
                      aria-pressed={isActive}
                    >
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        {isActive && <Check className="size-3.5" aria-hidden="true" />}
                        {size.label}
                      </span>
                      <span className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">{sizeDimensionLabel(size)}</span>
                    </button>
                  )
                })}
              </div>

              <Button
                className="mt-3 h-9 w-full rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                onClick={activeAction === "print" ? handlePrint : handleDownload}
                disabled={!dataUrl}
              >
                {activeAction === "print" ? <Printer className="size-4" /> : <Download className="size-4" />}
                {activeAction === "print" ? "Cetak kode QR" : "Unduh kode QR"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <Button
            className="size-10 rounded-xl bg-white p-0 shadow-xs dark:bg-slate-950"
            variant="outline"
            onClick={() => setActiveAction((current) => current === "download" ? null : "download")}
            disabled={!dataUrl}
            aria-label="Unduh kode QR"
            title="Unduh kode QR"
            aria-pressed={activeAction === "download"}
          >
            <Download className="size-4" />
          </Button>
          <Button
            className="size-10 rounded-xl bg-teal-600 p-0 text-white shadow-sm shadow-teal-900/15 hover:bg-teal-700"
            onClick={() => setActiveAction((current) => current === "print" ? null : "print")}
            disabled={!dataUrl}
            aria-label="Cetak kode QR"
            title="Cetak kode QR"
            aria-pressed={activeAction === "print"}
          >
            <Printer className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AssetQrDialog
