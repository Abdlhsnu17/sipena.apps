import { createThemeScript } from "@/components/theme/theme-config"

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: createThemeScript() }}
      suppressHydrationWarning
    />
  )
}
