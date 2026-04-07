"use client"

import type React from "react"

import Sidebar from "@/components/sidebar"
import Topbar from "@/components/topbar"
import { getCurrentUser } from "@/services/auth-utils"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
    }
  }, [router])

  const user = getCurrentUser()

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex flex-col flex-1 min-w-0 overflow-auto">
        <Topbar />
        <div className="flex-1 min-h-0">{children}</div>
      </main>
    </div>
  )
}
