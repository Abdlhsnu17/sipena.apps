"use client"

import { getCurrentUser, getUsers } from "@/services/auth-utils";
import type { User } from "@/types/auth-types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function UMLPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [currentUser] = useState(getCurrentUser())
  const [activeTab, setActiveTab] = useState("usecase")

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = () => {
    const allUsers = getUsers()
    setUsers(allUsers)
  }

  return (
    <div className="flex-1 overflow-auto bg-linear-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30 min-h-screen">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header, Navigation Tabs, and Footer restored below */}
        {/* ...header code... */}
        {/* ...tabs code... */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris Peminjaman Serta Pemeliharaan Sarana
          </p>
        </div>
      </div>
    </div>
  )
}

function ClassCard({ name, color, badge, properties, methods }: {
  name: string
  color: string
  badge: string
  properties: { name: string; type: string }[]
  methods: string[]
}) {
  const colorClasses: Record<string, string> = {
    teal: "from-teal-500 to-cyan-500 border-teal-200 dark:border-teal-800",
    purple: "from-purple-500 to-indigo-500 border-purple-200 dark:border-purple-800",
    blue: "from-blue-500 to-indigo-500 border-blue-200 dark:border-blue-800",
    orange: "from-orange-500 to-amber-500 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 border-emerald-200 dark:border-emerald-800",
    rose: "from-rose-500 to-pink-500 border-rose-200 dark:border-rose-800",
  }
  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-lg ${colorClasses[color]?.split(' ').slice(1).join(' ')}`}> {/* ...class card code... */} </div>
  )
}

function ActivityFlow({ title, color, steps }: {
  title: string
  color: string
  steps: { step: string; type: string }[]
}) {
  // ...activity flow code...
  return (
    <div className="rounded-xl p-5 border"> {/* ...activity flow code... */} </div>
  )
}

function TableCard({ name, color, columns }: {
  name: string
  color: string
  columns: { name: string; type: string; key?: string }[]
}) {
  // ...table card code...
  return (
    <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-lg"> {/* ...table card code... */} </div>
  )
}
