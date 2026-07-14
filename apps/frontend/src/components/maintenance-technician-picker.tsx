"use client"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { maintenanceService, type MaintenanceTechnicianCandidate } from "@/services/maintenance.service"
import { getUserRoleLabel } from "@/utils/role"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

interface Props {
  value?: number | null
  selected?: MaintenanceTechnicianCandidate | null
  onSelect: (technician: MaintenanceTechnicianCandidate) => void
}

export default function MaintenanceTechnicianPicker({ value, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<MaintenanceTechnicianCandidate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await maintenanceService.getTechnicianCandidates(query, 30)
        if (active) setOptions(response.success && Array.isArray(response.data) ? response.data : [])
      } catch (error) {
        console.error("Failed to load maintenance technician candidates:", error)
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between rounded-2xl px-3 font-normal">
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
            {selected ? `${selected.name} — NIP ${selected.nip}` : "Cari nama atau NIP teknisi/PJ"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ketik nama, NIP, atau unit kerja..." value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat akun...
              </div>
            ) : (
              <>
                <CommandEmpty>Tidak ada akun aktif yang cocok.</CommandEmpty>
                <CommandGroup>
                  {options.map((technician) => (
                    <CommandItem key={technician.id} value={String(technician.id)} onSelect={() => {
                      onSelect(technician)
                      setOpen(false)
                      setQuery("")
                    }} className="gap-2 py-2">
                      <Check className={`h-4 w-4 ${Number(value) === technician.id ? "opacity-100" : "opacity-0"}`} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{technician.name} — NIP {technician.nip}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {getUserRoleLabel(technician.role)}
                          {technician.workUnit || technician.subWorkUnit ? ` · ${technician.workUnit || technician.subWorkUnit}` : ""}
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
