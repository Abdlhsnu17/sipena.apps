
"use client"

import type React from "react"

import Sidebar from "@/components/sidebar"
import Topbar from "@/components/topbar"
import { ThemeProvider } from "@/components/theme-provider"
import type { User } from "@/types/auth-types"
import { getCurrentUser } from "@/services/auth-utils"
import { Analytics } from "@vercel/analytics/next"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    // Check for authenticated user
    const currentUser = getCurrentUser()
    setUser(currentUser)
    setLoading(false)
  }, [])

  const isLoginPage = pathname === "/login"
  const isRegisterPage = pathname === "/register"
  const isResetPasswordPage = pathname === "/reset-password"
  const isAuthPage = isLoginPage || isRegisterPage || isResetPasswordPage
  
  // Show layout if not an auth page, regardless of user state
  // This ensures sidebar appears when user is authenticated
  const showLayout = !isAuthPage

  if (loading) {
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
      <Analytics />
    </ThemeProvider>
  )
}
