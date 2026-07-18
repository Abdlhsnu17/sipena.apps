"use client"

import { buildScanTargetParams, type ScannedAssetTarget } from "@/utils/asset-scan-target"
import type { ScanSourceType } from "@/utils/scanned-asset"

export interface ScanChoice {
  query: string
  source: ScanSourceType
  target: ScannedAssetTarget | null
}

const buildDestinationParams = (choice: ScanChoice): URLSearchParams => {
  if (choice.target) return buildScanTargetParams(choice.target)
  const params = new URLSearchParams()
  if (choice.query) params.set("q", choice.query)
  return params
}

export const buildBorrowUrl = (choice: ScanChoice): string => {
  const params = buildDestinationParams(choice)
  params.set("openForm", "1")
  return `/borrowing?${params.toString()}`
}

export const buildUsageUrl = (choice: ScanChoice): string => {
  const params = buildDestinationParams(choice)
  params.set("openForm", "1")
  return `/asset-usage?${params.toString()}`
}

export const buildMaintenanceUrl = (choice: ScanChoice): string => {
  const params = buildDestinationParams(choice)
  params.set("openForm", "1")
  return `/maintenance?${params.toString()}`
}

export const buildDetailUrl = (choice: ScanChoice): string => {
  if (choice.target) {
    const params = buildScanTargetParams(choice.target)
    const basePath = choice.target.type === "non_medis" ? "/non-medical-assets" : "/medical-assets"
    return `${basePath}?${params.toString()}`
  }

  const basePath = choice.source === "non-medical" ? "/non-medical-assets" : "/medical-assets"
  return `${basePath}?scan=${encodeURIComponent(choice.query)}`
}

interface ScanChoiceButtonsProps {
  choice: ScanChoice
  onNavigate: (url: string) => void
}

export function ScanChoiceButtons({ choice, onNavigate }: ScanChoiceButtonsProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={() => onNavigate(buildBorrowUrl(choice))}
        className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
      >
        Pinjam
      </button>
      <button
        type="button"
        onClick={() => onNavigate(buildUsageUrl(choice))}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        Gunakan
      </button>
      <button
        type="button"
        onClick={() => onNavigate(buildMaintenanceUrl(choice))}
        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
      >
        Pemeliharaan
      </button>
      <button
        type="button"
        onClick={() => onNavigate(buildDetailUrl(choice))}
        className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent hover:text-accent-foreground"
      >
        Lihat Detail
      </button>
    </div>
  )
}
