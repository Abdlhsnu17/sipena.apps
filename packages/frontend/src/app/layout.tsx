
import { ThemeScript } from "@/components/theme-script";
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
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
        className="min-h-screen overflow-x-hidden overflow-y-scroll bg-[var(--app-shell-background)] text-foreground antialiased"
        suppressHydrationWarning
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
