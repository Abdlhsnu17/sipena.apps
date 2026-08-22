
import { ThemeScript } from "@/components/theme/theme-script";
import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import type React from "react";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)",
  description: "Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)",
  generator: 'Next.js',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  // Pertahankan tinggi shell ketika keyboard virtual terbuka. Jika memakai
  // `resizes-content`, seluruh halaman menyusut dan form terlihat terdorong ke
  // atas dengan area kosong besar di bawahnya.
  interactiveWidget: 'overlays-content',
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
      <body
        className="h-dvh min-h-svh overflow-hidden bg-(--app-shell-background) text-foreground antialiased"
        suppressHydrationWarning
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
