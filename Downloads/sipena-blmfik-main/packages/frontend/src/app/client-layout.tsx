
"use client"

import type React from "react"

import ConfirmProvider from "@/components/confirm-provider"
import Sidebar from "@/components/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import Topbar from "@/components/topbar"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/services/auth-utils"
import type { User } from "@/types/auth-types"
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

  // Show layout if not an auth page, regardless of user state
  // This ensures sidebar appears when user is authenticated
  const shouldBlockProtectedPage = showLayout && !!user && !isAllowedPath

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (shouldBlockProtectedPage) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
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
          <div className="relative flex h-screen overflow-hidden bg-background">
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            <main
              className="flex flex-col flex-1 min-w-0 h-screen overflow-y-auto transition-all duration-300 ease-in-out"
              data-main-scroll
            >
              <Topbar />
              <div className="flex-1 min-h-0">
                <div className="w-full max-w-[calc(100vw-2rem)] lg:max-w-7xl mx-auto px-4 lg:px-0">
                  {children}
                </div>
              </div>
            </main>
          </div>
        ) : (
          <div className="min-h-screen bg-background">
            {children}
          </div>
        )}
        <Toaster />
      </ConfirmProvider>
      <Analytics />
    </ThemeProvider>
  )
}
