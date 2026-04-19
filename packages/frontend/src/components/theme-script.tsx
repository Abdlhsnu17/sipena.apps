import { createThemeScript } from "@/components/theme-config"

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: createThemeScript() }}
      suppressHydrationWarning
    />
  )
}
