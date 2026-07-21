"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Printer } from "lucide-react"

type PaperPrintMenuProps = {
  label: string
  compact?: boolean
  onSelect: (paperSize: "a4" | "f4") => void
}

export function PaperPrintMenu({ label, compact = false, onSelect }: PaperPrintMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          size="icon"
          className={compact
            ? "h-8 w-8 rounded-lg text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/40"
            : "h-9 w-9 shrink-0 rounded-xl"}
          aria-label={label}
          title={label}
        >
          <Printer className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onSelect("a4")}>Print A4</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("f4")}>Print F4</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
