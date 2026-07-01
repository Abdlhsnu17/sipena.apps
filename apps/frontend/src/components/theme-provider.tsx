'use client'

import * as React from 'react';

import {
    THEME_ATTRIBUTE,
    THEME_DEFAULT_THEME,
    THEME_ENABLE_COLOR_SCHEME,
    THEME_ENABLE_SYSTEM,
    THEME_STORAGE_KEY,
    THEME_THEMES,
} from '@/components/theme-config';

type Attribute = string | string[]
type ThemeValueMap = Record<string, string>

export type ThemeProviderProps = {
  children: React.ReactNode
  attribute?: Attribute
  defaultTheme?: string
  disableTransitionOnChange?: boolean
  enableColorScheme?: boolean
  enableSystem?: boolean
  forcedTheme?: string
  storageKey?: string
  themes?: string[]
  value?: ThemeValueMap
}

type ThemeProviderState = {
  forcedTheme?: string
  resolvedTheme?: string
  setTheme: (theme: string) => void
  systemTheme?: 'dark' | 'light'
  theme?: string
  themes: string[]
}

const MEDIA_QUERY = '(prefers-color-scheme: dark)'

const ThemeContext = React.createContext<ThemeProviderState | undefined>(undefined)

function getSystemTheme() {
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

function getStoredTheme(storageKey: string, fallbackTheme: string) {
  try {
    return localStorage.getItem(storageKey) || fallbackTheme
  } catch {
    return fallbackTheme
  }
}

function disableTransitions() {
  const style = document.createElement('style')
  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}'
    )
  )
  document.head.appendChild(style)

  return () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.head.removeChild(style)
      })
    })
  }
}

function applyTheme({
  attribute,
  disableTransitionOnChange,
  enableColorScheme,
  resolvedTheme,
  themes,
  value,
}: {
  attribute: Attribute
  disableTransitionOnChange: boolean
  enableColorScheme: boolean
  resolvedTheme: string
  themes: string[]
  value?: ThemeValueMap
}) {
  const root = document.documentElement
  const attributes = Array.isArray(attribute) ? attribute : [attribute]
  const cleanup = disableTransitionOnChange ? disableTransitions() : undefined
  const themeValues = themes.map((themeName) => value?.[themeName] ?? themeName)
  const activeValue = value?.[resolvedTheme] ?? resolvedTheme

  attributes.forEach((currentAttribute) => {
    if (currentAttribute === 'class') {
      root.classList.remove(...themeValues)
      root.classList.add(activeValue)
      return
    }

    root.setAttribute(currentAttribute, activeValue)
  })

  if (enableColorScheme) {
    root.style.colorScheme =
      resolvedTheme === 'light' || resolvedTheme === 'dark' ? resolvedTheme : ''
  }

  cleanup?.()
}

export function ThemeProvider({
  attribute = THEME_ATTRIBUTE,
  children,
  defaultTheme = THEME_DEFAULT_THEME,
  disableTransitionOnChange = false,
  enableColorScheme = THEME_ENABLE_COLOR_SCHEME,
  enableSystem = THEME_ENABLE_SYSTEM,
  forcedTheme,
  storageKey = THEME_STORAGE_KEY,
  themes = [...THEME_THEMES],
  value,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<string>(defaultTheme)
  const [systemTheme, setSystemTheme] = React.useState<'dark' | 'light'>('light')

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(MEDIA_QUERY)
    const handleMediaQuery = () => {
      setSystemTheme(getSystemTheme())
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return
      }

      setThemeState(event.newValue || defaultTheme)
    }

    // Get system theme on mount
    const storedTheme = getStoredTheme(storageKey, defaultTheme)
    setThemeState(storedTheme)
    handleMediaQuery()

    // Only listen to media query changes if system theme is enabled
    // This prevents auto-switching when user has explicitly chosen light/dark
    if (enableSystem && typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaQuery)
    } else if (enableSystem && typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleMediaQuery)
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      if (enableSystem) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMediaQuery)
        } else if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleMediaQuery)
        }
      }

      window.removeEventListener('storage', handleStorage)
    }
  }, [defaultTheme, storageKey, enableSystem])

  const activeTheme = forcedTheme ?? theme
  const resolvedTheme =
    activeTheme === 'system' && enableSystem ? systemTheme : activeTheme

  React.useEffect(() => {
    // Only apply theme if a valid theme is set (not empty string)
    if (!resolvedTheme) return

    applyTheme({
      attribute,
      disableTransitionOnChange,
      enableColorScheme,
      resolvedTheme,
      themes,
      value,
    })
  }, [
    attribute,
    disableTransitionOnChange,
    enableColorScheme,
    enableSystem,
    resolvedTheme,
    themes,
    value,
  ])

  const setTheme = React.useCallback(
    (nextTheme: string) => {
      setThemeState(nextTheme)

      try {
        localStorage.setItem(storageKey, nextTheme)
      } catch {
        // Ignore storage write failures and keep the in-memory theme.
      }
    },
    [storageKey]
  )

  const contextValue = React.useMemo<ThemeProviderState>(
    () => ({
      forcedTheme,
      resolvedTheme,
      setTheme,
      systemTheme,
      theme,
      themes: enableSystem ? [...themes, 'system'] : themes,
    }),
    [enableSystem, forcedTheme, resolvedTheme, setTheme, systemTheme, theme, themes]
  )

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return React.useContext(ThemeContext) ?? {
    setTheme: () => undefined,
    themes: [],
  }
}
