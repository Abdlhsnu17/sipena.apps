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
    const printWindow = window.open("", "_blank", "width=420,height=560")
    if (!printWindow) return

    const rows = [
      { label: "No ID", value: noId },
      { label: "Kode", value: assetCode },
      { label: "SN", value: serialNumber },
      { label: "Lokasi", value: location },
      { label: "Sumber", value: sourceLabel },
    ]
      .filter((row) => row.value && row.value !== "-")
      .map(
        (row) =>
          `<tr><td class="label">${escapeHtml(row.label)}</td><td class="value">${escapeHtml(String(row.value))}</td></tr>`,
      )
      .join("")

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Label QR ${escapeHtml(noId || qrValue)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; color: #0f172a; }
      .label-card { width: 260px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; margin: 0 auto; text-align: center; }
      .name { font-size: 14px; font-weight: 700; margin: 0 0 8px; word-break: break-word; }
      img { width: 200px; height: 200px; }
      table { width: 100%; margin-top: 10px; border-collapse: collapse; font-size: 11px; }
      td { padding: 2px 4px; text-align: left; vertical-align: top; }
      td.label { color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; width: 34%; }
      td.value { font-weight: 600; word-break: break-all; }
      .brand { margin-top: 10px; font-size: 10px; color: #94a3b8; letter-spacing: 0.14em; text-transform: uppercase; }
    </style>
  </head>
  <body>
    <div class="label-card">
      <p class="name">${escapeHtml(assetName || "Aset")}</p>
      <img src="${dataUrl}" alt="QR ${escapeHtml(qrValue)}" />
      <table>${rows}</table>
      <div class="brand">SIPENA</div>
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
