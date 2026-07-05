"use client"

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Printer, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

export interface AssetQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Canonical human-readable identifier, e.g. "IMD-DTL-0001". */
  noId: string
  assetName: string
  assetCode?: string
  serialNumber?: string
  location?: string
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

export function AssetQrDialog({
  open,
  onOpenChange,
  noId,
  assetName,
  assetCode,
  serialNumber,
  location,
  sourceLabel,
}: AssetQrDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [dataUrl, setDataUrl] = useState<string>("")
  const [selectedSizeId, setSelectedSizeId] = useState<LabelSizeId>("medium")

  // The QR encodes the most stable searchable identifier so a scan can be
  // pasted straight into the inventory search box to locate the asset.
  const qrValue = (assetCode && assetCode !== "-" ? assetCode : noId).trim()

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
    link.download = `QR-${noId || qrValue}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    if (!dataUrl) return
    const size = LABEL_SIZES.find((item) => item.id === selectedSizeId) ?? LABEL_SIZES[1]
    const printWindow = window.open("", "_blank", "width=520,height=640")
    if (!printWindow) return

    const rows = [
      { label: "No ID", value: noId },
      { label: "Kode", value: assetCode },
      { label: "SN", value: serialNumber },
      { label: "Lokasi", value: location },
      { label: "Sumber", value: sourceLabel },
    ]
      .filter((row) => row.value && row.value !== "-")
      .slice(0, size.maxRows)
      .map(
        (row) =>
          `<tr><td class="label">${escapeHtml(row.label)}</td><td class="value">${escapeHtml(String(row.value))}</td></tr>`,
      )
      .join("")

    const isHorizontal = size.layout === "horizontal"

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Label QR ${escapeHtml(noId || qrValue)}</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; }
      .label-card {
        width: ${size.widthMm}mm;
        height: ${size.heightMm}mm;
        padding: ${size.paddingMm}mm;
        overflow: hidden;
        display: flex;
        flex-direction: ${isHorizontal ? "row" : "column"};
        align-items: center;
        justify-content: ${isHorizontal ? "flex-start" : "center"};
        gap: ${isHorizontal ? size.paddingMm : 0}mm;
        text-align: ${isHorizontal ? "left" : "center"};
      }
      .qr-box { flex: 0 0 auto; }
      .qr-box img { display: block; width: ${size.qrMm}mm; height: ${size.qrMm}mm; }
      .info { ${isHorizontal ? "flex: 1 1 auto; min-width: 0;" : "width: 100%;"} }
      .name { font-size: ${size.nameFontPt}pt; font-weight: 700; margin: 0 0 1mm; line-height: 1.15; word-break: break-word; }
      table { width: 100%; border-collapse: collapse; font-size: ${size.tableFontPt}pt; }
      td { padding: 0.2mm 0.6mm; text-align: left; vertical-align: top; line-height: 1.15; }
      td.label { color: #475569; text-transform: uppercase; letter-spacing: 0.02em; width: 32%; white-space: nowrap; }
      td.value { font-weight: 600; word-break: break-all; }
      .brand { margin-top: 1mm; font-size: ${Math.max(4, size.tableFontPt - 1)}pt; color: #94a3b8; letter-spacing: 0.14em; text-transform: uppercase; }
    </style>
  </head>
  <body>
    <div class="label-card">
      <div class="qr-box">
        <img src="${dataUrl}" alt="QR ${escapeHtml(qrValue)}" />
      </div>
      <div class="info">
        <p class="name">${escapeHtml(assetName || "Aset")}</p>
        <table>${rows}</table>
        ${isHorizontal ? "" : '<div class="brand">SIPENA</div>'}
      </div>
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
            Pindai kode ini untuk mencari aset dengan cepat, atau cetak sebagai label.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <canvas ref={canvasRef} className="h-55 w-55" aria-label={`QR ${qrValue}`} />
          </div>
          <div className="w-full space-y-1 text-sm">
            <p className="text-center text-base font-semibold text-foreground wrap-break-word">{assetName || "Aset"}</p>
            <div className="mx-auto grid max-w-xs grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">No ID</span>
              <span className="font-medium text-foreground break-all">{noId || "-"}</span>
              {assetCode && assetCode !== "-" && (
                <>
                  <span className="uppercase tracking-wide">Kode</span>
                  <span className="font-medium text-foreground break-all">{assetCode}</span>
                </>
              )}
              {serialNumber && serialNumber !== "-" && (
                <>
                  <span className="uppercase tracking-wide">SN</span>
                  <span className="font-medium text-foreground break-all">{serialNumber}</span>
                </>
              )}
              {location && location !== "-" && (
                <>
                  <span className="uppercase tracking-wide">Lokasi</span>
                  <span className="font-medium text-foreground wrap-break-word">{location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Ukuran cetak label</p>
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!dataUrl}>
            <Download className="mr-2 h-4 w-4" />
            Unduh
          </Button>
          <Button onClick={handlePrint} disabled={!dataUrl} className="bg-teal-600 hover:bg-teal-700">
            <Printer className="mr-2 h-4 w-4" />
            Cetak Label
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AssetQrDialog
