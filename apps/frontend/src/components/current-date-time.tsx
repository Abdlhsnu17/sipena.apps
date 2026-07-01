"use client"

import { useNow } from "@/hooks/use-now"
import { cn } from "@/utils"

type CurrentDateTimeProps = {
  variant?: "compact" | "hero"
  className?: string
}

function formatTimeParts(date: Date) {
  const pad2 = (value: number) => value.toString().padStart(2, "0")
  return {
    hours: pad2(date.getHours()),
    minutes: pad2(date.getMinutes()),
    seconds: pad2(date.getSeconds()),
  }
}

function formatDateLong(date: Date) {
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function CurrentDateTime({ variant = "compact", className }: CurrentDateTimeProps) {
  const now = useNow()
  const timeParts = formatTimeParts(now)

  if (variant === "hero") {
    return (
      <div className={cn("text-right", className)}>
        <div className="leading-none">
          <div className="flex items-end justify-end gap-2">
            <p className="font-mono tabular-nums text-[28px] font-semibold tracking-[0.16em] text-foreground drop-shadow-[0_0_12px_rgba(16,185,129,0.35)] dark:drop-shadow-[0_0_14px_rgba(16,185,129,0.45)]">
              {timeParts.hours}:{timeParts.minutes}
            </p>
            <span className="font-mono tabular-nums text-sm text-muted-foreground pb-1">{timeParts.seconds}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateLong(now)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("text-right", className)}>
      <div className="leading-none">
        <div className="flex items-end justify-end gap-2">
          <p className="font-mono tabular-nums text-sm font-semibold tracking-[0.14em] text-foreground">
            {timeParts.hours}:{timeParts.minutes}
          </p>
          <span className="font-mono tabular-nums text-xs text-muted-foreground pb-[1px]">{timeParts.seconds}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{formatDateLong(now)}</p>
      </div>
    </div>
  )
}

