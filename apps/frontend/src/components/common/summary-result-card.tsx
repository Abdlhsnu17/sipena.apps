"use client"

import { Building2, CalendarClock, Package, Tag, UserRound } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { cn } from "@/utils/cn";

type SummaryResultCardProps = {
  title: string
  children: ReactNode
  footer: ReactNode
  className?: string
}

export function SummaryResultCard({
  title,
  children,
  footer,
  className,
}: SummaryResultCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/60 text-blue-800">
          <Package className="h-4 w-4" />
        </span>
        <h3 className="truncate text-[13px] font-bold leading-tight text-slate-800 dark:text-slate-200 sm:text-[15px]">{title}</h3>
      </div>
      {children}
      <div className="border-t border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 px-3 py-2.5 sm:px-4">{footer}</div>
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
  unitIcon?: ComponentType<{ className?: string }>
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
  unitIcon: UnitIcon = Building2,
  timeLabel,
  timeValue,
  badges,
  statusBadges,
}: SummaryResultBodyProps) {
  return (
    <div className="grid gap-3 bg-white dark:bg-slate-900/60 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)] lg:gap-5">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold leading-tight text-slate-950 dark:text-slate-50 sm:text-[15px]">{assetName}</p>
        <p className="mt-1 text-[12px] font-medium leading-tight text-slate-600 dark:text-slate-300 sm:text-[13px]">{assetCode}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800/60 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 sm:text-[12px]">
            <Tag className="h-3 w-3 shrink-0" />
            <span className="truncate">No ID: {noId}</span>
          </span>
          {badges}
        </div>
        <div className="mt-3 space-y-2 text-[11px] leading-snug text-slate-700 dark:text-slate-300 sm:text-[12px]">
          {personValue ? (
            <div className="flex min-w-0 items-start gap-2">
              <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
              <p className="min-w-0">
                {personLabel}: <span className="font-medium text-blue-800">{personValue}</span>
              </p>
            </div>
          ) : null}
          {unitValue ? (
            <div className="flex min-w-0 items-start gap-2">
              <UnitIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
              <p className="min-w-0">
                {unitLabel}: <span className="font-medium text-blue-800">{unitValue}</span>
                {unitExtra ? <span className="text-slate-700 dark:text-slate-300"> &bull; {unitExtra}</span> : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex w-full flex-col items-start justify-center gap-2.5 border-t border-slate-200 dark:border-slate-800/35 pt-3 lg:items-end lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right">
        <div className="w-full">
          <div className="flex items-center gap-1.5 lg:justify-end">
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
            <p className="text-[10px] font-semibold uppercase leading-tight text-slate-500 dark:text-slate-400 sm:text-[11px]">{timeLabel}</p>
          </div>
          <p className="mt-2 text-[13px] font-bold leading-tight text-slate-950 dark:text-slate-50 sm:text-[14px]">{timeValue}</p>
        </div>
        {statusBadges ? <div className="flex w-full flex-wrap items-center gap-1.5 lg:justify-end">{statusBadges}</div> : null}
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
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelectedChange}
          className="h-4 w-4 cursor-pointer rounded border border-slate-300 bg-white text-blue-600 accent-blue-600 dark:bg-slate-900/60"
          aria-label={selectionLabel}
          title={selectionLabel}
        />
        <span className="sr-only">{selectionLabel}</span>
      </label>
      <div className="flex flex-wrap items-center justify-end gap-1.5 text-[12px] text-slate-700 dark:text-slate-300">{children}</div>
    </div>
  )
}
