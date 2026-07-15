"use client"

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    borrowingService,
    type BorrowingOwnerCandidate,
} from "@/services/borrowing.service";
import { getUserRoleLabel } from "@/utils/role";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface BorrowingOwnerPickerProps {
  value?: number | null
  selected?: BorrowingOwnerCandidate | null
  onSelect: (owner: BorrowingOwnerCandidate) => void
}

export default function BorrowingOwnerPicker({
  value,
  selected,
  onSelect,
}: BorrowingOwnerPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<BorrowingOwnerCandidate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await borrowingService.getOwnerCandidates(query, 30)
        if (active) setOptions(response.success && Array.isArray(response.data) ? response.data : [])
      } catch (error) {
        console.error("Failed to load borrowing owner candidates:", error)
        if (active) setOptions([])
      } finally {
        if (active) setLoading(false)
      }
    }, query ? 250 : 0)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [open, query])

  const selectedLabel = selected
    ? `${selected.name} — NIP ${selected.nip}`
    : "Cari nama atau NIP pemilik/PJ"

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="flex h-12 w-full items-center justify-between rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 hover:bg-background"
        >
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        avoidCollisions={false}
        updatePositionStrategy="always"
        className="max-h-[min(420px,calc(100vh-8rem))] w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ketik nama, NIP, atau unit kerja..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-80 min-h-55">
            {loading ? (
              <div className="flex min-h-55 items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat akun...
              </div>
            ) : (
              <>
                <CommandEmpty>Tidak ada akun aktif yang cocok.</CommandEmpty>
                <CommandGroup>
                  {options.map((owner) => (
                    <CommandItem
                      key={owner.id}
                      value={String(owner.id)}
                      onSelect={() => {
                        onSelect(owner)
                        setOpen(false)
                        setQuery("")
                      }}
                      className="gap-2 py-2"
                    >
                      <Check className={`h-4 w-4 ${Number(value) === owner.id ? "opacity-100" : "opacity-0"}`} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{owner.name} — NIP {owner.nip}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {getUserRoleLabel(owner.role)}
                          {owner.workUnit || owner.subWorkUnit ? ` · ${owner.workUnit || owner.subWorkUnit}` : ""}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
