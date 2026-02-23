'use client'

import * as React from 'react'

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type InventoryPickerProps<T> = {
  assets: T[]
  selectedAsset?: T | null
  onSelect: (asset: T) => void
  formatLabel: (asset: T) => string
  getItemKey: (asset: T, index: number) => string
  placeholder?: string
  buttonLabel?: string
  buttonClassName?: string
  popoverClassName?: string
  listClassName?: string
  noResultsLabel?: string
  searchValue?: (asset: T) => string
  selectedAssetLabel?: (asset: T) => string
  renderItemMeta?: (asset: T) => React.ReactNode
  ariaLabel?: string
}

export function InventoryPicker<T>({
  assets,
  selectedAsset,
  onSelect,
  formatLabel,
  getItemKey,
  placeholder = 'Cari inventaris...',
  buttonLabel = 'Pilih inventaris',
  buttonClassName,
  popoverClassName = 'w-full max-w-[360px] p-0',
  listClassName,
  noResultsLabel = 'Tidak ada inventaris tersedia',
  searchValue,
  selectedAssetLabel,
  renderItemMeta,
  ariaLabel,
}: InventoryPickerProps<T>) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const matchValue = React.useMemo(
    () => (asset: T) => {
      const searchMapper = searchValue ?? formatLabel
      return searchMapper(asset)
    },
    [formatLabel, searchValue],
  )

  const filteredAssets = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return assets
    const tokens = normalizedQuery
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/gi, ""))
      .filter(Boolean)
    const compactQuery = normalizedQuery.replace(/[^a-z0-9]/gi, "")
    return assets.filter((asset) => {
      const searchText = matchValue(asset).toLowerCase()
      if (searchText.includes(normalizedQuery)) return true
      const compactText = searchText.replace(/[^a-z0-9]/gi, "")
      if (compactQuery && compactText.includes(compactQuery)) return true
      if (tokens.length === 0) return false
      if (tokens.every((token) => searchText.includes(token))) return true
      if (tokens.every((token) => compactText.includes(token))) return true
      return tokens.some((token) => searchText.includes(token))
    })
  }, [assets, matchValue, query])

  const buttonText = selectedAsset
    ? selectedAssetLabel
      ? selectedAssetLabel(selectedAsset)
      : formatLabel(selectedAsset)
    : buttonLabel

  const handleClose = () => {
    setOpen(false)
    setQuery('')
  }

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const isCharacterKey =
      event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey
    if (!isCharacterKey) {
      return
    }
    event.preventDefault()
    setQuery(event.key)
    if (!open) {
      setOpen(true)
    }
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  return (
    <Popover open={open} onOpenChange={(value) => (value ? setOpen(true) : handleClose())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex h-12 w-full items-center justify-between rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            buttonClassName ?? ''
          }`}
          aria-label={ariaLabel ?? buttonLabel ?? 'Pilih inventaris'}
          onKeyDown={handleButtonKeyDown}
        >
          <span
            className={`block truncate text-sm ${
              selectedAsset ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {buttonText}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className={popoverClassName}>
        <Command className="max-h-[420px]">
          <CommandInput
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className={`space-y-1 border-none bg-transparent px-2 pb-2 pt-1 ${listClassName ?? ''}`}>
            {filteredAssets.map((asset, index) => {
              const searchText = matchValue(asset)
              return (
                <CommandItem
                  key={getItemKey(asset, index)}
                  value={searchText}
                  onSelect={() => {
                    onSelect(asset)
                    handleClose()
                  }}
                >
                  <div className="space-y-0.5 py-1">
                    <span className="text-sm font-medium text-foreground">{formatLabel(asset)}</span>
                    {renderItemMeta && (
                      <div className="text-xs text-muted-foreground">{renderItemMeta(asset)}</div>
                    )}
                  </div>
                </CommandItem>
              )
            })}
            {filteredAssets.length === 0 && <CommandEmpty>{noResultsLabel}</CommandEmpty>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default InventoryPicker
