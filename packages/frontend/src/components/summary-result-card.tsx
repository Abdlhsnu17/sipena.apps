"use client"

import type { ReactNode } from "react"
import { Building2, ChevronDown, ChevronUp, Package, Tag, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/utils/cn"

type SummaryResultCardProps = {
  title: string
  isExpanded: boolean
  onToggle: () => void
  toggleLabel: string
  children: ReactNode
  footer: ReactNode
  className?: string
}

export function SummaryResultCard({
  title,
  isExpanded,
  onToggle,
  toggleLabel,
  children,
  footer,
  className,
}: SummaryResultCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.10)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-blue-800">
            <Package className="h-5 w-5" />
          </span>
          <h3 className="truncate text-[16px] font-bold leading-tight text-slate-800 sm:text-[18px]">{title}</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 rounded-lg p-0 text-slate-800 hover:bg-slate-100"
          onClick={onToggle}
          aria-label={toggleLabel}
        >
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </Button>
      </div>
      {children}
      <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">{footer}</div>
    </div>
  )
}

type SummaryResultBodyProps = {
  assetName: ReactNode
  assetCode: ReactNode
  noId: ReactNode
  personLabel?: string
  personValue?: ReactNode
  unitLabel?: string
  unitValue?: ReactNode
  unitExtra?: ReactNode
  timeLabel: string
  timeValue: ReactNode
  badges?: ReactNode
  statusBadges?: ReactNode
}

export function SummaryResultBody({
  assetName,
  assetCode,
  noId,
  personLabel = "Identitas Karyawan",
  personValue,
  unitLabel = "Unit kerja",
  unitValue,
  unitExtra,
  timeLabel,
  timeValue,
  badges,
  statusBadges,
}: SummaryResultBodyProps) {
  return (
    <div className="grid gap-5 bg-white px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)] lg:gap-6">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-bold leading-tight text-slate-950 sm:text-[19px]">{assetName}</p>
        <p className="mt-1.5 text-[14px] font-medium leading-tight text-slate-600 sm:text-[15px]">{assetCode}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[13px] font-medium text-slate-600">
            <Tag className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">No ID: {noId}</span>
          </span>
          {badges}
        </div>
        <div className="mt-4 space-y-2.5 text-[13px] leading-snug text-slate-700 sm:text-[14px]">
          {personValue ? (
            <div className="flex min-w-0 items-start gap-2.5">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <p className="min-w-0">
                {personLabel}: <span className="font-medium text-blue-800">{personValue}</span>
              </p>
            </div>
          ) : null}
          {unitValue ? (
            <div className="flex min-w-0 items-start gap-2.5">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <p className="min-w-0">
                {unitLabel}: <span className="font-medium text-blue-800">{unitValue}</span>
                {unitExtra ? <span className="text-slate-700"> &bull; {unitExtra}</span> : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-start justify-center gap-4 border-t border-slate-200 pt-4 lg:items-end lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 lg:text-right">
        <div>
          <p className="text-[12px] font-semibold uppercase leading-tight text-slate-500">{timeLabel}</p>
          <p className="mt-3 text-[17px] font-bold leading-tight text-slate-950 sm:text-[19px]">{timeValue}</p>
        </div>
        {statusBadges ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{statusBadges}</div> : null}
      </div>
    </div>
  )
}

type SummaryResultFooterProps = {
  selected: boolean
  onSelectedChange: () => void
  selectionLabel: string
  children: ReactNode
}

export function SummaryResultFooter({
  selected,
  onSelectedChange,
  selectionLabel,
  children,
}: SummaryResultFooterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-center gap-3 text-[14px] font-medium text-slate-800">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelectedChange}
          className="h-5 w-5 rounded-md border border-slate-300 bg-white text-slate-700"
          aria-label={selectionLabel}
        />
        Pilih kartu
      </label>
      <div className="flex flex-wrap items-center justify-end gap-2 text-[14px] text-slate-700">{children}</div>
    </div>
  )
}
