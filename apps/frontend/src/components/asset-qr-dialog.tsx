"use client"

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DetailSource } from "@/types/detail-inventory";
import { sanitizeAssetFilename } from "@/utils/asset-label";
import { buildScanTargetParams } from "@/utils/asset-scan-target";
import { Check, CheckCircle2, Download, MapPin, Printer, QrCode } from "lucide-react";
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

type LabelSizeId = "small" | "medium" | "large"

interface LabelSize {
  id: LabelSizeId
  /** Short display name shown on the selector. */
  label: string
  /** Physical label dimensions in millimetres (matches the printed page). */
  widthMm: number
  heightMm: number
  qrMm: number
  nameFontPt: number
  tableFontPt: number
  paddingMm: number
  /** Small labels place the QR beside the info to fit the limited height. */
  layout: "vertical" | "horizontal"
  /** Small labels only show the most essential rows so nothing overflows. */
  maxRows: number
}

const LABEL_SIZES: LabelSize[] = [
  { id: "small", label: "Kecil", widthMm: 40, heightMm: 30, qrMm: 20, nameFontPt: 5, tableFontPt: 4.5, paddingMm: 1.5, layout: "horizontal", maxRows: 3 },
  { id: "medium", label: "Sedang", widthMm: 50, heightMm: 50, qrMm: 28, nameFontPt: 8, tableFontPt: 6, paddingMm: 3, layout: "vertical", maxRows: 5 },
  { id: "large", label: "Besar", widthMm: 70, heightMm: 50, qrMm: 32, nameFontPt: 10, tableFontPt: 7.5, paddingMm: 4, layout: "vertical", maxRows: 5 },
]

const sizeDimensionLabel = (size: LabelSize): string => `${size.widthMm}×${size.heightMm} mm`

const hasValue = (value?: string): value is string => Boolean(value?.trim() && value.trim() !== "-")

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
  const [selectedSizeId, setSelectedSizeId] = useState<LabelSizeId>("medium")

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

  const handleDownload = () => {
    if (!dataUrl) return
    const link = document.createElement("a")
    link.href = dataUrl
    link.download = `QR-${sanitizeAssetFilename(noId || assetCode || assetName || "aset")}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    if (!dataUrl) return
    const size = LABEL_SIZES.find((item) => item.id === selectedSizeId) ?? LABEL_SIZES[1]
    const printWindow = window.open("", "_blank", "width=520,height=640")
    if (!printWindow) return

    const qrSizeMm = Math.min(size.widthMm, size.heightMm) - size.paddingMm * 2

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
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] gap-0 overflow-y-auto rounded-3xl border-slate-200/80 p-0 shadow-2xl shadow-slate-950/15 sm:max-w-[560px] dark:border-slate-800 dark:shadow-black/30">
        <DialogHeader className="border-b border-slate-100 px-5 py-5 pr-14 text-left sm:px-7 sm:py-6">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/15">
              <QrCode className="size-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-xl leading-6 font-bold tracking-tight text-slate-950 dark:text-slate-50">
                Kode QR Aset
              </DialogTitle>
              <DialogDescription className="leading-5">
                Pindai untuk membuka detail atau simpan untuk dicetak.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide text-slate-950 uppercase dark:text-slate-50">
                {assetName || "Aset SIPENA"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-teal-700 dark:text-teal-300">{noId || assetCode || "Tanpa ID"}</span>
                {location && (
                  <>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="size-3" aria-hidden="true" />
                      <span className="truncate">{location}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
            {sourceLabel && (
              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-600 uppercase shadow-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {sourceLabel}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center rounded-3xl bg-slate-50 px-4 py-5 ring-1 ring-slate-100 dark:bg-slate-900/50 dark:ring-slate-800">
            <div className="rounded-2xl bg-white p-3 shadow-[0_14px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
              <canvas
                ref={canvasRef}
                className="size-[236px] sm:size-[260px]"
                aria-label={`Kode QR untuk ${assetName || noId}`}
              />
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/15">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Siap dipindai
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ukuran label</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Pilih ukuran media saat dicetak.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-900" role="group" aria-label="Ukuran label cetak">
              {LABEL_SIZES.map((size) => {
                const isActive = size.id === selectedSizeId
                return (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setSelectedSizeId(size.id)}
                    className={`relative flex min-w-0 flex-col items-center rounded-xl px-1.5 py-2.5 text-center outline-none transition-all focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 ${
                      isActive
                        ? "bg-white text-teal-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-teal-300 dark:ring-slate-700"
                        : "text-slate-700 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span className="inline-flex items-center gap-1 text-xs font-bold sm:text-sm">
                      {isActive && <Check className="size-3.5" aria-hidden="true" />}
                      {size.label}
                    </span>
                    <span className="mt-0.5 truncate text-[10px] text-slate-500 sm:text-[11px] dark:text-slate-400">{sizeDimensionLabel(size)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:grid-cols-2 sm:px-7 dark:border-slate-800 dark:bg-slate-900/40">
          <Button className="h-11 rounded-xl bg-white shadow-xs dark:bg-slate-950" variant="outline" onClick={handleDownload} disabled={!dataUrl}>
            <Download className="mr-2 h-4 w-4" />
            Unduh Kode QR
          </Button>
          <Button className="h-11 rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-900/15 hover:bg-teal-700" onClick={handlePrint} disabled={!dataUrl}>
            <Printer className="mr-2 h-4 w-4" />
            Cetak Kode QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AssetQrDialog
