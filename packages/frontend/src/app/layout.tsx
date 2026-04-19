
import type { Metadata, Viewport } from "next"
import { ThemeScript } from "@/components/theme-script"
import type React from "react"
import ClientLayout from "./client-layout"
import "@/styles/globals.css"

export const metadata: Metadata = {
  title: "Sistem Inventaris & Pemeliharaan Sarana RSUP Persahabatan",
  description: "Sistem manajemen inventaris dan pemeliharaan sarana serta peminjaman RSUP Persahabatan",
  generator: 'Next.js',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
