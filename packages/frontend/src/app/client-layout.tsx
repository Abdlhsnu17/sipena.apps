
"use client"

import type React from "react"

import ConfirmProvider from "@/components/confirm-provider"
import Sidebar from "@/components/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import Topbar from "@/components/topbar"
import { Toaster } from "@/components/ui/toaster"
import { useIsMobile } from "@/hooks/use-mobile"
import { useOrientation } from "@/hooks/use-orientation"
import { useToast } from "@/hooks/use-toast"
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils"
import type { User } from "@/types/auth-types"
import { cn } from "@/utils"
import { canAccessRoute, getDefaultRouteForRole } from "@/utils/role"
import { Analytics } from "@vercel/analytics/next"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const isMobile = useIsMobile()
  const orientation = useOrientation()
  const isMobileLandscape = isMobile && orientation === "landscape"

  useEffect(() => {
    const syncUser = () => {
      setUser(getCurrentUser())
      setLoading(false)
    }

    syncUser()

    if (typeof window !== "undefined") {
      window.addEventListener("auth-user-updated", syncUser)
      return () => window.removeEventListener("auth-user-updated", syncUser)
    }
  }, [])

  const isLoginPage = pathname === "/login"
  const isRegisterPage = pathname === "/register"
  const isResetPasswordPage = pathname === "/reset-password"
  const isAuthPage = isLoginPage || isRegisterPage || isResetPasswordPage
  const showLayout = !isAuthPage

  const isAllowedPath = canAccessRoute(user?.role, pathname)

  useEffect(() => {
    if (!loading && showLayout && !user) {
      router.replace(buildLoginRedirectUrl())
    }
  }, [loading, router, showLayout, user])

  useEffect(() => {
    if (!loading && showLayout && user && !isAllowedPath) {
      router.replace(getDefaultRouteForRole(user.role))
    }
  }, [isAllowedPath, loading, pathname, router, showLayout, user])

  useEffect(() => {
    if (typeof window === "undefined") return

    const originalAlert = window.alert

    window.alert = (message?: unknown) => {
      const description =
        typeof message === "string"
          ? message
          : message === undefined || message === null
            ? ""
            : String(message)
      const normalized = description.toLowerCase()
      const isErrorMessage = /(gagal|error|kesalahan|tidak dapat|tidak memiliki)/.test(normalized)

      toast({
        title: isErrorMessage ? "Proses gagal" : "Pemberitahuan",
        description,
        ...(isErrorMessage ? { variant: "destructive" as const } : {}),
      })
    }

    return () => {
      window.alert = originalAlert
    }
  }, [toast])

  useEffect(() => {
    if (typeof document === "undefined") return

    const bodyClass = "auth-mobile-form"

    if (isAuthPage) {
      document.body.classList.add(bodyClass)
      return () => {
        document.body.classList.remove(bodyClass)
      }
    }

    document.body.classList.remove(bodyClass)
  }, [isAuthPage])

  useEffect(() => {
    if (typeof document === "undefined") return

    document.body.dataset.mobileOrientation = orientation
    document.body.dataset.mobileViewport = isMobileLandscape ? "landscape" : isMobile ? "portrait" : "desktop"

    return () => {
      delete document.body.dataset.mobileOrientation
      delete document.body.dataset.mobileViewport
    }
  }, [isMobile, isMobileLandscape, orientation])

  const shouldBlockProtectedPage = showLayout && (!user || (user && !isAllowedPath))

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (shouldBlockProtectedPage) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <ConfirmProvider>
        {showLayout ? (
          <div
            className="relative h-dvh overflow-hidden bg-background"
            data-app-shell="authenticated"
          >
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            <div
              className={cn(
                "flex h-dvh min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-300 ease-in-out",
                isSidebarCollapsed ? "xl:pl-20" : "xl:pl-64",
              )}
            >
              <Topbar />
              <main
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden",
                  isMobile && "overscroll-contain",
                )}
                data-main-scroll
              >
                <div
                  className={cn(
                    "min-h-full w-full px-3 py-3 sm:px-4 sm:py-4 lg:px-6",
                    isMobileLandscape ? "max-w-none" : "mx-auto max-w-7xl",
                  )}
                  data-page-width="responsive"
                >
                  {children}
                </div>
              </main>
            </div>
          </div>
        ) : (
          <div className="min-h-dvh bg-background" data-app-shell="auth">
            {children}
          </div>
        )}
        <Toaster />
      </ConfirmProvider>
      <Analytics />
    </ThemeProvider>
  )
}
