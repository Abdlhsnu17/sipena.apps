"use client"

import type React from "react"
import { useState } from "react"

import Sidebar from "@/components/sidebar"
import Topbar from "@/components/topbar"
import authService from "@/services/auth.service"
import { cn } from "@/utils"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push("/login")
    }
  }, [router])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main
        className={cn(
          "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        )}
      >
        <div className="flex-1 overflow-auto">
          <Topbar />
          {children}
        </div>
      </main>
    </div>
  )
}
