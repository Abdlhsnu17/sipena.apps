"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

type PaperPrintMenuProps = {
  label: string
  compact?: boolean
  onPrint: () => void
}

export function PaperPrintMenu({ label, compact = false, onPrint }: PaperPrintMenuProps) {
  return (
    <Button
      type="button"
      variant={compact ? "ghost" : "outline"}
      size="icon"
      className={compact
        ? "h-8 w-8 rounded-lg text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/40"
        : "h-9 w-9 shrink-0 rounded-xl"}
      aria-label={label}
      title={label}
      onClick={onPrint}
    >
      <Printer className="h-4 w-4" />
    </Button>
  )
}
