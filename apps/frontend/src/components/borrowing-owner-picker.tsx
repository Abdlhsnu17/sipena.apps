"use client"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  borrowingService,
  type BorrowingOwnerCandidate,
} from "@/services/borrowing.service"
import { getUserRoleLabel } from "@/utils/role"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between rounded-2xl px-3 font-normal"
        >
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ketik nama, NIP, atau unit kerja..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
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
