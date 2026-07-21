import type { ComponentType, ReactNode } from "react"

import { cn } from "@/utils/cn"

type NotificationTone = "slate" | "teal" | "amber" | "indigo" | "rose" | "cyan"

type NotificationSummaryItem = {
  label: string
  value: ReactNode
  icon: ComponentType<{ className?: string }>
  tone?: NotificationTone
  description?: ReactNode
}

type NotificationSummaryProps = {
  items: NotificationSummaryItem[]
  className?: string
  ariaLabel?: string
}

const toneClasses: Record<NotificationTone, { card: string; icon: string; label: string; value: string }> = {
  slate: {
    card: "bg-slate-100/80 dark:bg-slate-800/55",
    icon: "text-slate-500 dark:text-slate-300",
    label: "text-slate-500 dark:text-slate-300",
    value: "text-slate-800 dark:text-slate-50",
  },
  teal: {
    card: "bg-teal-50 dark:bg-teal-950/35",
    icon: "text-teal-600 dark:text-teal-300",
    label: "text-teal-600 dark:text-teal-300",
    value: "text-teal-700 dark:text-teal-200",
  },
  amber: {
    card: "bg-amber-50 dark:bg-amber-950/35",
    icon: "text-amber-600 dark:text-amber-300",
    label: "text-amber-600 dark:text-amber-300",
    value: "text-amber-700 dark:text-amber-200",
  },
  indigo: {
    card: "bg-indigo-50 dark:bg-indigo-950/35",
    icon: "text-indigo-600 dark:text-indigo-300",
    label: "text-indigo-500 dark:text-indigo-300",
    value: "text-indigo-700 dark:text-indigo-200",
  },
  rose: {
    card: "bg-rose-50 dark:bg-rose-950/35",
    icon: "text-rose-600 dark:text-rose-300",
    label: "text-rose-600 dark:text-rose-300",
    value: "text-rose-700 dark:text-rose-200",
  },
  cyan: {
    card: "bg-cyan-50 dark:bg-cyan-950/35",
    icon: "text-cyan-600 dark:text-cyan-300",
    label: "text-cyan-600 dark:text-cyan-300",
    value: "text-cyan-700 dark:text-cyan-200",
  },
}

export function NotificationSummary({
  items,
  className,
  ariaLabel = "Ringkasan pemberitahuan",
}: NotificationSummaryProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]",
        className,
      )}
    >
      {items.map((item) => {
        const tone = toneClasses[item.tone ?? "slate"]
        const Icon = item.icon

        return (
          <article
            key={item.label}
            className={cn(
              "flex h-20 min-w-0 items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2",
              tone.card,
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/85 shadow-sm ring-1 ring-white/80 dark:bg-slate-900/75 dark:ring-slate-700/50">
              <Icon className={cn("h-4 w-4", tone.icon)} />
            </span>
            <div className="min-w-0">
              <p className={cn("truncate text-xs font-medium leading-tight sm:text-[13px]", tone.label)}>{item.label}</p>
              <p className={cn("mt-0.5 truncate text-lg font-bold leading-none sm:text-xl", tone.value)}>
                {item.value}
              </p>
              {item.description ? (
                <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                  {item.description}
                </p>
              ) : null}
            </div>
          </article>
        )
      })}
    </section>
  )
}
