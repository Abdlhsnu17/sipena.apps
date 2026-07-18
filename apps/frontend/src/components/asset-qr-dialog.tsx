"use client"

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DetailSource } from "@/types/detail-inventory";
import { sanitizeAssetFilename } from "@/utils/asset-label";
import { buildScanTargetParams } from "@/utils/asset-scan-target";
import { Download, Printer, QrCode } from "lucide-react";
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
          margin: 2,
          width: 512,
          color: { dark: "#0f172a", light: "#ffffff" },
        })
        if (cancelled) return
        setDataUrl(url)
        const canvas = canvasRef.current
        if (canvas) {
          await QRCode.toCanvas(canvas, qrValue, {
            errorCorrectionLevel: "M",
            margin: 2,
            width: 220,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-teal-600" />
            Kode QR Aset
          </DialogTitle>
          <DialogDescription>
            Pindai, unduh, atau cetak barcode aset ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <canvas ref={canvasRef} className="h-55 w-55" aria-label={`QR ${qrValue}`} />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Ukuran cetak barcode</p>
          <div className="grid grid-cols-3 gap-2">
            {LABEL_SIZES.map((size) => {
              const isActive = size.id === selectedSizeId
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setSelectedSizeId(size.id)}
                  className={`flex flex-col items-center rounded-lg border px-2 py-1.5 text-center transition ${
                    isActive
                      ? "border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
                      : "border-border text-foreground hover:border-teal-300 hover:bg-teal-50/50"
                  }`}
                  aria-pressed={isActive}
                >
                  <span className="text-sm font-semibold">{size.label}</span>
                  <span className="text-[11px] text-muted-foreground">{sizeDimensionLabel(size)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!dataUrl}>
            <Download className="mr-2 h-4 w-4" />
            Unduh Barcode
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!dataUrl}>
            <Printer className="mr-2 h-4 w-4" />
            Cetak Barcode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AssetQrDialog
