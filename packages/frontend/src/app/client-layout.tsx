
"use client"

import type React from "react";

import ConfirmProvider from "@/components/confirm-provider";
import Sidebar from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import Topbar from "@/components/topbar";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import type { User } from "@/types/auth-types";
import { cn } from "@/utils";
import { canAccessRoute, getDefaultRouteForRole } from "@/utils/role";
import { Analytics } from "@vercel/analytics/next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem("sipena-sidebar-collapsed") !== "false"
  })

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
    if (!showLayout) return
    if (typeof document === "undefined") return

    const scrollContainer = document.querySelector("[data-main-scroll]") as HTMLElement | null
    if (!scrollContainer) return

    scrollContainer.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [pathname, showLayout])

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
    if (typeof window === "undefined") return
    window.localStorage.setItem("sipena-sidebar-collapsed", String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const shouldBlockProtectedPage = showLayout && (!user || (user && !isAllowedPath))

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-(--app-shell-background)">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (shouldBlockProtectedPage) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-x-hidden bg-(--app-shell-background)">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ConfirmProvider>
        {showLayout ? (
          <div
            className="relative flex h-dvh min-h-screen w-full flex-col overflow-hidden bg-(--app-shell-background) text-foreground"
            data-app-shell="authenticated"
          >
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-(--app-shell-background) transition-[padding] duration-300 ease-in-out lg:pl-64"
            >
              <Topbar />
              <main
                className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-scroll bg-(--app-shell-background) overscroll-contain"
                data-main-scroll
              >
                <div
                  className={cn(
                    "mx-auto min-h-full w-full max-w-368 min-w-0 bg-(--app-shell-background) px-3 py-3 sm:px-4 sm:py-4 lg:px-5 xl:px-6",
                  )}
                  data-app-content
                  data-page-width="responsive"
                >
                  {children}
                </div>
              </main>
            </div>
          </div>
        ) : (
          <div className="min-h-screen overflow-x-hidden bg-(--app-shell-background)" data-app-shell="auth">
            {children}
          </div>
        )}
        <Toaster />
      </ConfirmProvider>
      <Analytics />
    </ThemeProvider>
  )
}
