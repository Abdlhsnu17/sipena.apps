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

type CameraConfig = string | { facingMode?: string | { exact: string }; deviceId?: string | { exact: string } }

const pickBackCamera = (cameras: CameraDevice[]): CameraDevice | null => {
  if (cameras.length === 0) return null

  const preferred = cameras.find((camera) => /back|rear|environment|belakang/i.test(camera.label))
  return preferred || cameras[0]
}

const getAdaptiveQrbox = () => {
  if (typeof window === "undefined") {
    return { width: 240, height: 240 }
  }

  const mobileSize = Math.floor(Math.min(window.innerWidth * 0.72, 280))
  const size = Math.max(180, mobileSize)

  return { width: size, height: size }
}

const buildCameraConfigs = (selectedCamera: CameraDevice | null, cameras: CameraDevice[]): CameraConfig[] => {
  const configs: CameraConfig[] = [
    { facingMode: { exact: "environment" } },
    { facingMode: "environment" },
  ]

  if (selectedCamera) {
    configs.push({ deviceId: { exact: selectedCamera.id } })
    configs.push({ deviceId: selectedCamera.id })
  }

  if (cameras.length > 0) {
    configs.push(cameras[0].id)
  }

  return configs
}

export function BarcodeScannerDialog({ open, onOpenChange, onDetected }: BarcodeScannerDialogProps) {
  const elementId = useId().replace(/:/g, "")
  const scannerRef = useRef<ScannerInstance | null>(null)
  const lifecycleRef = useRef<Promise<void>>(Promise.resolve())
  const sessionRef = useRef(0)
  const hasDetectedRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  const onOpenChangeRef = useRef(onOpenChange)
  const [isStarting, setIsStarting] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [manualValue, setManualValue] = useState("")

  onDetectedRef.current = onDetected
  onOpenChangeRef.current = onOpenChange

  const destroyScanner = useCallback(async (scanner: ScannerInstance) => {
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
  }, [])

  const stopScanner = useCallback(async () => {
    const stopSession = ++sessionRef.current

    const stopTask = lifecycleRef.current.catch(() => undefined).then(async () => {
      const scanner = scannerRef.current
      if (scanner) {
        scannerRef.current = null
        await destroyScanner(scanner)
      }

      if (sessionRef.current === stopSession) {
        setIsActive(false)
        setIsStarting(false)
      }
    })

    lifecycleRef.current = stopTask
    await stopTask
  }, [destroyScanner])

  useEffect(() => {
    if (!open) {
      hasDetectedRef.current = false
      void stopScanner()
      return
    }

    const session = ++sessionRef.current
    let disposed = false

    const isStale = () => disposed || sessionRef.current !== session

    const startScanner = async () => {
      setErrorMessage("")
      setIsStarting(true)

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
        if (isStale()) return

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

        // Start directly with the rear-facing constraint. Calling getCameras()
        // first may briefly open and close a temporary permission stream.
        const scannerConfig = {
          fps: 12,
          qrbox: getAdaptiveQrbox(),
          aspectRatio: typeof window !== "undefined" && window.innerWidth < 768 ? 1 : 1.777,
          disableFlip: false,
        }
        const handleDecoded = async (decodedText: string) => {
          const normalized = decodedText.trim()
          if (!normalized || isStale() || hasDetectedRef.current) return

          hasDetectedRef.current = true
          onDetectedRef.current(normalized)
          onOpenChangeRef.current(false)
          await stopScanner()
        }
        const tryCameraConfigs = async (cameraConfigs: CameraConfig[]): Promise<unknown> => {
          let lastError: unknown = null

          for (const cameraConfig of cameraConfigs) {
            if (isStale()) break

            try {
              await scanner.start(
                cameraConfig,
                scannerConfig,
                handleDecoded,
                () => {
                  // Suppress per-frame decode errors to keep UI quiet.
                },
              )
              return null
            } catch (error) {
              lastError = error
            }
          }

          return lastError
        }

        let startError = await tryCameraConfigs([{ facingMode: "environment" }])

        // Some browsers/devices do not honor facingMode. Enumerate cameras only
        // as a fallback, after the stable rear-camera constraint has failed.
        if (startError && !isStale()) {
          const cameras = await Html5Qrcode.getCameras() as CameraDevice[]
          const selectedCamera = pickBackCamera(cameras)
          const cameraConfigs = buildCameraConfigs(selectedCamera, cameras).filter(
            (config) => typeof config === "string" || "deviceId" in config,
          )
          startError = await tryCameraConfigs(cameraConfigs)
        }

        if (startError) {
          throw startError
        }

        if (isStale()) {
          if (scannerRef.current === scanner) scannerRef.current = null
          await destroyScanner(scanner)
          return
        }

        setIsActive(true)
        setIsStarting(false)
      } catch (error) {
        if (isStale()) return

        const message = error instanceof Error ? error.message : "Gagal mengakses kamera"
        setErrorMessage(message)
        setIsActive(false)
        setIsStarting(false)
      }
    }

    const startTask = lifecycleRef.current.catch(() => undefined).then(startScanner)
    lifecycleRef.current = startTask

    return () => {
      disposed = true
      void stopScanner()
    }
  }, [destroyScanner, elementId, open, stopScanner])

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
          hasDetectedRef.current = false
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
