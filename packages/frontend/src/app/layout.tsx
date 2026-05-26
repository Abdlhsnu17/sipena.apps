
import { ThemeScript } from "@/components/theme-script";
import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import type React from "react";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "Sistem Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)",
  description: "Sistem Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)",
  generator: 'Next.js',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
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
