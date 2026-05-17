'use client'

import * as React from 'react'
import { Check } from 'lucide-react'

import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { matchesSearchKeyword } from '@/utils/search-keyword'

type InventoryPickerProps<T> = {
  assets: T[]
  selectedAsset?: T | null
  selectedAssets?: T[]
  onSelect: (asset: T) => void
  onToggleSelect?: (asset: T) => void
  formatLabel: (asset: T) => string
  getItemKey: (asset: T, index: number) => string
  getAssetCategory?: (asset: T) => string | undefined
  showCategoryFilter?: boolean
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
  multiSelect?: boolean
  selectedSummaryLabel?: (assets: T[]) => string
  disabled?: boolean
}

export function InventoryPicker<T>({
  assets,
  selectedAsset,
  selectedAssets = [],
  onSelect,
  onToggleSelect,
  formatLabel,
  getItemKey,
  getAssetCategory,
  showCategoryFilter = false,
  placeholder = 'Cari inventaris...',
  buttonLabel = 'Pilih inventaris',
  buttonClassName,
  popoverClassName = 'w-[min(92vw,680px)] p-0 sm:w-[var(--radix-popover-trigger-width)] sm:min-w-[320px] sm:max-w-[min(92vw,680px)]',
  listClassName,
  noResultsLabel = 'Tidak ada inventaris tersedia',
  searchValue,
  selectedAssetLabel,
  renderItemMeta,
  ariaLabel,
  multiSelect = false,
  selectedSummaryLabel,
  disabled = false,
}: InventoryPickerProps<T>) {
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [categoryFilter, setCategoryFilter] = React.useState<'all' | 'medical' | 'non_medical'>('all')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const matchValue = React.useMemo(
    () => (asset: T) => {
      const searchMapper = searchValue ?? formatLabel
      return searchMapper(asset)
    },
    [formatLabel, searchValue],
  )

  const assetCategoryMap = React.useMemo(() => {
    const map = new Map<T, 'medical' | 'non_medical'>()
    assets.forEach((asset) => {
      const rawCategory = getAssetCategory?.(asset)
      if (!rawCategory) return
      const normalized = rawCategory.toLowerCase()
      if (normalized === 'medical' || normalized === 'medis') {
        map.set(asset, 'medical')
      } else if (
        normalized === 'non_medical' ||
        normalized === 'non-medical' ||
        normalized === 'non medical' ||
        normalized === 'non_medis' ||
        normalized === 'non medis'
      ) {
        map.set(asset, 'non_medical')
      }
    })
    return map
  }, [assets, getAssetCategory])

  const stableAssetKeys = React.useMemo(() => {
    const map = new Map<T, string>()
    assets.forEach((asset, index) => {
      map.set(asset, getItemKey(asset, index))
    })
    return map
  }, [assets, getItemKey])

  const selectedAssetKeySet = React.useMemo(() => {
    const keys = new Set<string>()
    selectedAssets.forEach((asset) => {
      const stableKey = stableAssetKeys.get(asset)
      if (stableKey) keys.add(stableKey)
    })
    return keys
  }, [selectedAssets, stableAssetKeys])

  const filteredAssets = React.useMemo(() => {
    const byCategory = showCategoryFilter
      ? assets.filter((asset) => {
          if (categoryFilter === 'all') return true
          return assetCategoryMap.get(asset) === categoryFilter
        })
      : assets
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return byCategory
    return byCategory.filter((asset) => {
      const searchText = matchValue(asset)
      return matchesSearchKeyword(normalizedQuery, [searchText])
    })
  }, [assetCategoryMap, assets, categoryFilter, matchValue, query, showCategoryFilter])

  const categoryCounts = React.useMemo(
    () =>
      assets.reduce(
        (acc, asset) => {
          const category = assetCategoryMap.get(asset)
          if (category === 'medical') acc.medical += 1
          if (category === 'non_medical') acc.nonMedical += 1
          acc.total += 1
          return acc
        },
        { total: 0, medical: 0, nonMedical: 0 },
      ),
    [assetCategoryMap, assets],
  )

  const buttonText = multiSelect
    ? selectedAssets.length > 0
      ? selectedSummaryLabel
        ? selectedSummaryLabel(selectedAssets)
        : `${selectedAssets.length} inventaris dipilih`
      : buttonLabel
    : selectedAsset
      ? selectedAssetLabel
        ? selectedAssetLabel(selectedAsset)
        : formatLabel(selectedAsset)
      : buttonLabel

  const handleClose = () => {
    setOpen(false)
    setQuery('')
  }

  React.useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [open])

  const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return
    }
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
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (disabled) {
          setOpen(false)
          return
        }
        value ? setOpen(true) : handleClose()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex h-12 w-full items-center justify-between rounded-2xl border border-border/80 bg-background px-3 py-2 text-sm text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            buttonClassName ?? ''
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          aria-label={ariaLabel ?? buttonLabel ?? 'Pilih inventaris'}
          disabled={disabled}
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
      <PopoverContent align="start" sideOffset={8} collisionPadding={12} className={popoverClassName}>
        <Command className="max-h-115" shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          {showCategoryFilter && (
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  categoryFilter === 'all'
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Semua ({categoryCounts.total})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('medical')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  categoryFilter === 'medical'
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Medis ({categoryCounts.medical})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('non_medical')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  categoryFilter === 'non_medical'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Non-Medis ({categoryCounts.nonMedical})
              </button>
            </div>
          )}
          <CommandList className={`space-y-1 border-none bg-transparent px-2 pb-2 pt-1 max-h-85 ${listClassName ?? ''}`}>
            {filteredAssets.map((asset, index) => {
              const searchText = matchValue(asset)
              return (
                <CommandItem
                  key={stableAssetKeys.get(asset) ?? getItemKey(asset, index)}
                  value={searchText}
                  onSelect={() => {
                    if (multiSelect) {
                      onToggleSelect?.(asset)
                      return
                    }
                    onSelect(asset)
                    handleClose()
                  }}
                >
                  <div className="flex w-full items-start justify-between gap-3 py-1">
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium text-foreground">{formatLabel(asset)}</span>
                      {renderItemMeta && (
                        <div className="text-xs text-muted-foreground">{renderItemMeta(asset)}</div>
                      )}
                    </div>
                    {multiSelect && selectedAssetKeySet.has(stableAssetKeys.get(asset) ?? getItemKey(asset, index)) ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    ) : null}
                  </div>
                </CommandItem>
              )
            })}
            {filteredAssets.length === 0 && (
              <CommandEmpty>
                {showCategoryFilter && categoryFilter !== 'all'
                  ? `Tidak ada hasil pada kategori ${categoryFilter === 'medical' ? 'Medis' : 'Non-Medis'}`
                  : noResultsLabel}
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default InventoryPicker
