"use client"

import { Camera, Keyboard, Loader2, ScanLine } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type BarcodeScannerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDetected: (value: string) => void
}

type ScannerInstance = {
  stop: () => Promise<void>
  clear: () => void | Promise<void>
}

type CameraDevice = {
  id: string
  label: string
}

const pickBackCamera = (cameras: CameraDevice[]): CameraDevice | null => {
  if (cameras.length === 0) return null

  const preferred = cameras.find((camera) => /back|rear|environment|belakang/i.test(camera.label))
  return preferred || cameras[0]
}

export function BarcodeScannerDialog({ open, onOpenChange, onDetected }: BarcodeScannerDialogProps) {
  const elementId = useId().replace(/:/g, "")
  const scannerRef = useRef<ScannerInstance | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [manualValue, setManualValue] = useState("")

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    if (!scanner) {
      setIsActive(false)
      setIsStarting(false)
      return
    }

    scannerRef.current = null

    try {
      await scanner.stop()
    } catch {
      // Ignore stop errors from partially initialized camera streams.
    }

    try {
      await Promise.resolve(scanner.clear())
    } catch {
      // Ignore clear errors when the scanner view is already detached.
    }

    setIsActive(false)
    setIsStarting(false)
  }, [])

  useEffect(() => {
    if (!open) {
      void stopScanner()
      return
    }

    let cancelled = false

    const startScanner = async () => {
      setErrorMessage("")
      setIsStarting(true)

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
        if (cancelled) return

        const scanner = new Html5Qrcode(elementId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
        })

        scannerRef.current = scanner

        const cameras = await Html5Qrcode.getCameras()
        if (cancelled) {
          await stopScanner()
          return
        }

        const selectedCamera = pickBackCamera(cameras as CameraDevice[])
        const cameraConfig = selectedCamera ? { deviceId: { exact: selectedCamera.id } } : { facingMode: "environment" }

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.777,
          },
          async (decodedText: string) => {
            const normalized = decodedText.trim()
            if (!normalized || cancelled) return

            onDetected(normalized)
            onOpenChange(false)
            await stopScanner()
          },
          () => {
            // Suppress per-frame decode errors to keep UI quiet.
          },
        )

        if (cancelled) {
          await stopScanner()
          return
        }

        setIsActive(true)
        setIsStarting(false)
      } catch (error) {
        if (cancelled) return

        const message = error instanceof Error ? error.message : "Gagal mengakses kamera"
        setErrorMessage(message)
        setIsActive(false)
        setIsStarting(false)
      }
    }

    void startScanner()

    return () => {
      cancelled = true
      void stopScanner()
    }
  }, [elementId, onDetected, onOpenChange, open, stopScanner])

  const handleManualSubmit = () => {
    const value = manualValue.trim()
    if (!value) return

    onDetected(value)
    setManualValue("")
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setManualValue("")
          setErrorMessage("")
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-blue-600" />
            Scan Barcode Aset
          </DialogTitle>
          <DialogDescription>
            Arahkan kamera ke QR/barcode inventaris. Sistem akan mengisi pencarian aset secara otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
            <div id={elementId} className="min-h-70 w-full overflow-hidden rounded-lg bg-black" />
          </div>

          {isStarting ? (
            <p className="flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Menyiapkan kamera...
            </p>
          ) : isActive ? (
            <p className="flex items-center gap-2 text-xs text-slate-600">
              <Camera className="h-3.5 w-3.5" />
              Kamera aktif. Arahkan ke barcode/QR untuk memindai.
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
              {errorMessage}. Pastikan izin kamera aktif dan halaman diakses lewat HTTPS/localhost.
            </p>
          ) : null}

          <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Keyboard className="h-3.5 w-3.5" />
              Input manual (opsional)
            </p>
            <div className="flex gap-2">
              <Input
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Tempel hasil barcode jika kamera tidak tersedia"
                className="h-9"
              />
              <Button type="button" variant="secondary" onClick={handleManualSubmit} disabled={!manualValue.trim()}>
                Gunakan
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BarcodeScannerDialog
