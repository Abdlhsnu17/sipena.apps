"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCurrentUser, getUsers } from "@/services/auth-utils"
import type { User } from "@/types/auth-types"
import {
    ArrowRight,
    BookOpen,
    Box,
    ChevronRight,
    Database,
    FileCode2,
    GitBranch,
    Network,
    Shield,
    UploadCloud,
    Users,
    Workflow,
    Zap
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function UMLPage() {
  const [users, setUsers] = useState<User[]>([])
  const [currentUser] = useState(getCurrentUser())
  const role = (currentUser?.role ?? "staff").toLowerCase()
  const canViewClassAndErd = role === "admin"
  const tabDefinitions = [
    {
      value: "usecase",
      label: "Use Case",
      icon: Users,
      activeClass:
        "data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white",
      roles: ["admin", "leader", "staff"],
    },
    {
      value: "class",
      label: "Class Diagram",
      icon: Box,
      activeClass:
        "data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white",
      roles: ["admin"],
    },
    {
      value: "activity",
      label: "Activity",
      icon: Workflow,
      activeClass:
        "data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white",
      roles: ["admin", "leader", "staff"],
    },
    {
      value: "erd",
      label: "ERD",
      icon: Database,
      activeClass:
        "data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-500 data-[state=active]:text-white",
      roles: ["admin"],
    },
    {
      value: "unggahan",
      label: "Unggahan",
      icon: UploadCloud,
      activeClass:
        "data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-900/90 data-[state=active]:to-slate-500/70 data-[state=active]:text-white",
      roles: ["admin", "leader", "staff"],
    },
  ]
  const visibleTabs = tabDefinitions.filter((tab) => tab.roles.includes(role))
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.value ?? "usecase")
  const router = useRouter()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = () => {
    const allUsers = getUsers()
    setUsers(allUsers)
  }

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30 min-h-screen">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Header */}
        <div className="mb-8">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl shadow-lg">
                  <FileCode2 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                  Dokumentasi UML Diagram Use Case & Unggahan
                </h1>
              </div>
              <p className="text-muted-foreground">
                Arsitektur sistem inventaris dan pemeliharaan RSUP Persahabatan
              </p>
            </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-6 p-4 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10 border border-teal-200/50 dark:border-teal-800/50 rounded-xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-lg">
                <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-semibold text-teal-800 dark:text-teal-200">Tentang Dokumentasi</h3>
                <p className="text-sm text-teal-700/80 dark:text-teal-300/80 mt-1">
                  Dokumentasi ini menjelaskan arsitektur sistem, hubungan antar entitas, dan alur kerja proses peminjaman serta pemeliharaan inventaris menggunakan standar 
                </p>
                <p className="text-xs text-teal-600/90 dark:text-teal-300/80 mt-1">
                
                </p>
              </div>
            </div>
          </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <TabsList className="grid grid-cols-2 lg:grid-cols-5 gap-2 h-auto p-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl flex-1 min-w-[280px]">
              {visibleTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={`${tab.activeClass} data-[state=active]:shadow-lg py-3 px-4 rounded-lg transition-all flex items-center gap-2`}
                  onClick={
                    tab.value === "unggahan"
                      ? () => {
                          router.push("/unggahan")
                          setActiveTab("unggahan")
                        }
                      : undefined
                  }
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Use Case Diagram Tab */}
          <TabsContent value="usecase" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Use Case Diagram</CardTitle>
                    <CardDescription>Interaksi pengguna dengan sistem inventaris</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Actor Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Admin & Leader */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500/5 via-teal-500/10 to-cyan-500/5 border border-teal-200/50 dark:border-teal-800/50 p-6">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl shadow-lg">
                          <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-teal-800 dark:text-teal-200">Administrator & Leader</h3>
                          <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">Full Access</Badge>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {[
                          { icon: "👥", title: "Kelola Pengguna", desc: "CRUD data pengguna sistem" },
                          { icon: "🧹", title: "Hapus Semua Pengguna", desc: "Reset semua akun kecuali admin aktif" },
                          { icon: "🏢", title: "Inventaris Non-Medis", desc: "Genset, AC, Komputer, Laptop" },
                          { icon: "🏥", title: "Inventaris Medis", desc: "Peralatan medis & kategori" },
                          { icon: "📋", title: "Peminjaman", desc: "Approve/validasi request" },
                          { icon: "↩️", title: "Pengembalian", desc: "Konfirmasi kondisi aset" },
                          { icon: "🔧", title: "Pemeliharaan", desc: "Kelola jadwal & status" },
                          {
                            icon: "🧾",
                            title: "Form Inventaris Medis",
                            desc: "Modal tambah/ubah memakai struktur dua kolom dan menjaga nilai kolom lama saat edit",
                          },
                          { icon: "📊", title: "Laporan", desc: "Generate analitik & unggah laporan PDF/Excel/Word" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all cursor-default">
                            <span className="text-xl">{item.icon}</span>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-teal-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Staff */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-indigo-500/5 border border-blue-200/50 dark:border-blue-800/50 p-6">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200">Staff</h3>
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Limited Access</Badge>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {[
                          { icon: "👁️", title: "Lihat Inventaris", desc: "Read-only sesuai departemen" },
                          { icon: "📦", title: "Meminjam Alat", desc: "Request peminjaman aset" },
                          { icon: "↩️", title: "Mengembalikan", desc: "Submit pengembalian" },
                          { icon: "🔄", title: "Update Status", desc: "Ubah ke 'Proses'" },
                          { icon: "📅", title: "Tambah Jadwal", desc: "Buat jadwal pemeliharaan" },
                          { icon: "📈", title: "Dashboard", desc: "Monitoring data" },
                          { icon: "🚫", title: "Tidak Bisa Kelola", desc: "Tidak dapat CRUD aset", disabled: true },
                        ].map((item, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-default ${item.disabled ? 'bg-red-50/60 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/50' : 'bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800'}`}>
                            <span className="text-xl">{item.icon}</span>
                            <div className="flex-1">
                              <p className={`font-medium text-sm ${item.disabled ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                            {!item.disabled && <ChevronRight className="w-4 h-4 text-blue-500" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Overview */}
                <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Network className="w-5 h-5 text-gray-600" />
                    Hubungan dengan Sistem
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { title: "Admin & Leader", color: "teal", items: ["Kelola Semua Modul", "Approve Request", "Full Report"] },
                      { title: "Staff", color: "blue", items: ["Request Access", "Limited Modify", "View Reports"] },
                      { title: "Sistem", color: "gray", items: ["Role-based Auth", "Audit Trail", "Real-time Sync"] },
                    ].map((card, i) => (
                      <div key={i} className={`text-center p-4 rounded-xl bg-${card.color}-50 dark:bg-${card.color}-950/30 border border-${card.color}-200/50 dark:border-${card.color}-800/50`}>
                        <p className={`font-semibold text-${card.color}-700 dark:text-${card.color}-300 mb-3`}>{card.title}</p>
                        <div className="space-y-2">
                          {card.items.map((item, j) => (
                            <div key={j} className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <ArrowRight className="w-3 h-3" />
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Unggahan Tab */}
        <TabsContent value="unggahan" className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-slate-800 to-slate-500 rounded-lg">
                  <UploadCloud className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle>Unggahan Terintegrasi</CardTitle>
                  <CardDescription>Selaras dengan dokumentasi UML, file laporan mudah diakses.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Tombol unggahan sebagai bagian dari tab membantu auditor dan tim pengembangan menjaga visibilitas proses. Klik tombol di bawah untuk membuka fitur unggah utama.
              </p>
              <div className="mt-4 flex justify-end">
                <Button size="sm" asChild>
                  <Link href="/unggahan" className="inline-flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" />
                    Buka Unggahan
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          {/* Class Diagram Tab */}
          <TabsContent value="class" className="space-y-6">
            {canViewClassAndErd ? (
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg">
                      <Box className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>Class Diagram</CardTitle>
                      <CardDescription>Struktur kelas dan entitas sistem</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* User Class */}
                    <ClassCard 
                      name="User"
                      color="teal"
                      badge="Core"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "nip", type: "string" }, 
                        { name: "name", type: "string" }, 
                        { name: "email", type: "string" }, 
                        { name: "role", type: "UserRole" }, 
                        { name: "createdAt", type: "Date" } 
                      ]} 
                      methods={[ 
                        "login()", 
                        "logout()", 
                        "updateProfile()" 
                      ]} 
                    />

                    {/* MedicalAsset Class */}
                    <ClassCard 
                      name="MedicalAsset"
                      color="purple"
                      badge="Entity"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "assetCode", type: "string" }, 
                        { name: "inventoryName", type: "string" },
                        { name: "name", type: "string" }, 
                        { name: "type", type: "string" },
                        { name: "serialNumber", type: "string" },
                        { name: "purchaseDate", type: "Date" },
                        { name: "lastMaintenance", type: "Date" },
                        { name: "nextMaintenance", type: "Date" },
                        { name: "category", type: "string" }, 
                        { name: "status", type: "AssetStatus" }, 
                        { name: "roomId", type: "string" },
                        { name: "notes", type: "string" },
                        { name: "condition", type: "string" }, 
                        { name: "usagePurpose", type: "string" }, 
                      ]} 
                      methods={[ 
                        "create()", 
                        "update()", 
                        "delete()" 
                      ]} 
                    />

                    {/* NonMedicalAsset Class */}
                    <ClassCard 
                      name="NonMedicalAsset"
                      color="blue"
                      badge="Entity"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "assetCode", type: "string" }, 
                        { name: "inventoryName", type: "string" },
                        { name: "name", type: "string" }, 
                        { name: "type", type: "string" },
                        { name: "serialNumber", type: "string" },
                        { name: "purchaseDate", type: "Date" },
                        { name: "lastMaintenance", type: "Date" },
                        { name: "nextMaintenance", type: "Date" },
                        { name: "category", type: "string" }, 
                        { name: "status", type: "AssetStatus" }, 
                        { name: "roomId", type: "string" },
                        { name: "notes", type: "string" },
                        { name: "condition", type: "string" }, 
                        { name: "usagePurpose", type: "string" }, 
                      ]}  
                      methods={[ 
                        "create()", 
                        "update()", 
                        "delete()" 
                      ]} 
                    />

                    {/* Borrowing Class */}
                    <ClassCard 
                      name="Borrowing"
                      color="orange"
                      badge="Transaction"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "userId", type: "string" }, 
                        { name: "assetId", type: "string" }, 
                        { name: "borrowDate", type: "Date" }, 
                        { name: "returnDate", type: "Date" }, 
                        { name: "status", type: "BorrowStatus" } 
                      ]} 
                      methods={[ 
                        "request()", 
                        "approve()", 
                        "return()" 
                      ]} 
                    />
                    <ClassCard 
                      name="ReportUpload"
                      color="rose"
                      badge="Storage"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "userId", type: "string" }, 
                        { name: "filename", type: "string" }, 
                        { name: "contentType", type: "string" }, 
                        { name: "sizeBytes", type: "number" }, 
                        { name: "uploadedAt", type: "Date" }, 
                        { name: "notes", type: "string" }, 
                      ]} 
                      methods={[ 
                        "store()", 
                        "delete()", 
                        "download()" 
                      ]} 
                    />

                    {/* Maintenance Class */}
                    <ClassCard 
                      name="Maintenance"
                      color="emerald"
                      badge="Transaction"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "assetId", type: "string" }, 
                        { name: "type", type: "string" }, 
                        { name: "scheduledDate", type: "Date" }, 
                        { name: "status", type: "string" }, 
                        { name: "cost", type: "number" } 
                      ]} 
                      methods={[ 
                        "schedule()", 
                        "complete()", 
                        "cancel()" 
                      ]} 
                    />

                    {/* Return Class */}
                    <ClassCard 
                      name="Return"
                      color="rose"
                      badge="Transaction"
                      properties={[ 
                        { name: "id", type: "string" }, 
                        { name: "borrowingId", type: "string" }, 
                        { name: "returnDate", type: "Date" }, 
                        { name: "condition", type: "string" }, 
                        { name: "notes", type: "string" } 
                      ]} 
                      methods={[ 
                        "submit()", 
                        "verify()" 
                      ]} 
                    />
                  </div>

                  {/* Relationships */}
                  <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-2xl">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <GitBranch className="w-5 h-5 text-purple-600" />
                      Relasi Antar Kelas
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {[
                        { from: "User", to: "Borrowing", rel: "1 : N", desc: "User dapat memiliki banyak peminjaman" },
                        { from: "User", to: "Maintenance", rel: "1 : N", desc: "User dapat membuat banyak jadwal" },
                        { from: "MedicalAsset", to: "Borrowing", rel: "1 : N", desc: "Aset dapat dipinjam berkali-kali" },
                        { from: "Borrowing", to: "Return", rel: "1 : 1", desc: "Setiap peminjaman punya 1 pengembalian" },
                      ].map((rel, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl">
                          <Badge variant="outline" className="bg-purple-100 text-purple-700">{rel.from}</Badge>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="h-px flex-1 bg-purple-300"></div>
                            <span className="text-xs font-mono bg-purple-100 px-2 py-0.5 rounded">{rel.rel}</span>
                            <div className="h-px flex-1 bg-purple-300"></div>
                          </div>
                          <Badge variant="outline" className="bg-indigo-100 text-indigo-700">{rel.to}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <RestrictedNotice feature="Class Diagram" />
            )}
          </TabsContent>

          {/* Activity Diagram Tab */}
          <TabsContent value="activity" className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
                    <Workflow className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Activity Diagram</CardTitle>
                    <CardDescription>Alur proses dalam sistem</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ActivityFlow 
                    title="Alur Login"
                    color="purple"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Input NIP & Password", type: "action" },
                      { step: "Validasi kredensial", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Generate token", type: "action" },
                      { step: "Redirect dashboard", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Lupa Password"
                    color="amber"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "User klik Lupa Password", type: "action" },
                      { step: "Tampilkan form email/username", type: "action" },
                      { step: "User mengirim identifier", type: "action" },
                      { step: "Validasi input", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Kirim tautan atau kode reset", type: "action" },
                      { step: "User buka tautan/masukkan kode", type: "action" },
                      { step: "User atur password baru", type: "action" },
                      { step: "Perbarui kredensial & konfirmasi", type: "action" },
                      { step: "Kembali ke login", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Daftar Akun"
                    color="fuchsia"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "User klik Buat Akun", type: "action" },
                      { step: "Tampilkan formulir pendaftaran", type: "action" },
                      { step: "User isi nama, email, password, dll.", type: "action" },
                      { step: "Validasi format & keunikan", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Buat akun baru", type: "action" },
                      { step: "Kirim email verifikasi (opsional)", type: "action" },
                      { step: "Tampilkan konfirmasi dan redirect", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Penambahan Inventaris"
                    color="teal"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "User pilih Tambah Inventaris", type: "action" },
                      { step: "Pilih kategori aset (medis/non-medis)", type: "action" },
                      { step: "Isi data detail & spesifikasi", type: "action" },
                      { step: "Unggah dokumen pendukung (foto/sertifikat)", type: "action" },
                      { step: "Validasi data & anggaran", type: "action" },
                      { step: "Valid?", type: "decision" },
                      { step: "Simpan aset ke master inventory", type: "action" },
                      { step: "Update status ruangan & laporan", type: "action" },
                      { step: "Notifikasi approval ke penanggung jawab", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />

                  {/* Borrowing Flow */}
                  <ActivityFlow 
                    title="Alur Peminjaman"
                    color="orange"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Staff memilih aset", type: "action" },
                      { step: "Cek ketersediaan", type: "decision" },
                      { step: "Submit request", type: "action" },
                      { step: "Admin review", type: "action" },
                      { step: "Approved?", type: "decision" },
                      { step: "Aset dipinjam", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />

                  {/* Maintenance Flow */}
                  <ActivityFlow 
                    title="Alur Pemeliharaan"
                    color="blue"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Buat jadwal", type: "action" },
                      { step: "Set tanggal & prioritas", type: "action" },
                      { step: "Notifikasi dikirim", type: "action" },
                      { step: "Teknisi mengerjakan", type: "action" },
                      { step: "Update progress", type: "action" },
                      { step: "Mark complete", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />

                  {/* Return Flow */}
                  <ActivityFlow 
                    title="Alur Pengembalian"
                    color="emerald"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Staff submit return", type: "action" },
                      { step: "Pilih kondisi aset", type: "action" },
                      { step: "Admin verifikasi", type: "action" },
                      { step: "Kondisi OK?", type: "decision" },
                      { step: "Update status aset", type: "action" },
                      { step: "Selesai", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                  <ActivityFlow 
                    title="Alur Laporan & Unggah"
                    color="rose"
                    steps={[
                      { step: "Start", type: "start" },
                      { step: "Tampilkan ringkasan data", type: "action" },
                      { step: "Pilih format PDF/Excel/Word", type: "action" },
                      { step: "Unggah file", type: "action" },
                      { step: "Simpan ke arsip & log", type: "action" },
                      { step: "End", type: "end" },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ERD Tab */}
          <TabsContent value="erd" className="space-y-6">
            {canViewClassAndErd ? (
              <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg">
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>Entity Relationship Diagram</CardTitle>
                      <CardDescription>Struktur database sistem</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Users Table */}
                    <TableCard 
                      name="users"
                      color="teal"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "nip", type: "VARCHAR(20)", key: "UQ" },
                        { name: "name", type: "VARCHAR(255)" },
                        { name: "email", type: "VARCHAR(255)", key: "UQ" },
                        { name: "password", type: "VARCHAR(255)" },
                        { name: "role", type: "ENUM" },
                        { name: "created_at", type: "TIMESTAMP" },
                      ]}
                    />

                    {/* Medical Assets Table */}
                    <TableCard 
                      name="medical_assets"
                      color="purple"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
                        { name: "name", type: "VARCHAR(255)" },
                        { name: "inventory_name", type: "VARCHAR(255)" },
                        { name: "category", type: "VARCHAR(100)" },
                        { name: "type", type: "VARCHAR(20)" },
                        { name: "serial_number", type: "VARCHAR(100)" },
                        { name: "condition", type: "VARCHAR(20)" },
                        { name: "status", type: "ENUM" },
                        { name: "location", type: "VARCHAR(255)" },
                        { name: "purchase_date", type: "DATE" },
                        { name: "next_maintenance", type: "DATE" },
                        { name: "last_maintenance", type: "DATE" },
                        { name: "specifications", type: "JSON/TEXT" },
                        { name: "created_by", type: "INT", key: "FK" },
                      ]}
                    />

                    {/* Non-Medical Assets Table */}
                    <TableCard 
                      name="non_medical_assets"
                      color="blue"
                      columns={[
                      { name: "id", type: "INT", key: "PK" },
                        { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
                        { name: "name", type: "VARCHAR(255)" },
                        { name: "inventory_name", type: "VARCHAR(255)" },
                        { name: "category", type: "VARCHAR(100)" },
                        { name: "type", type: "VARCHAR(20)" },
                        { name: "serial_number", type: "VARCHAR(100)" },
                        { name: "condition", type: "VARCHAR(20)" },
                        { name: "status", type: "ENUM" },
                        { name: "location", type: "VARCHAR(255)" },
                        { name: "purchase_date", type: "DATE" },
                        { name: "next_maintenance", type: "DATE" },
                        { name: "last_maintenance", type: "DATE" },
                        { name: "specifications", type: "JSON/TEXT" },
                        { name: "created_by", type: "INT", key: "FK" },
                      ]}
                    />

                    {/* Borrowing Records Table */}
                    <TableCard 
                      name="borrowing_records"
                      color="orange"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "user_id", type: "INT", key: "FK" },
                        { name: "asset_type", type: "VARCHAR(20)" },
                        { name: "asset_id", type: "INT", key: "FK" },
                        { name: "borrowed_date", type: "TIMESTAMP" },
                        { name: "status", type: "ENUM" },
                      ]}
                    />

                    {/* Return Records Table */}
                    <TableCard 
                      name="return_records"
                      color="rose"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "borrowing_id", type: "INT", key: "FK" },
                        { name: "return_date", type: "TIMESTAMP" },
                        { name: "condition", type: "ENUM" },
                        { name: "received_by", type: "INT", key: "FK" },
                      ]}
                    />

                    {/* Maintenance Records Table */}
                    <TableCard 
                      name="maintenance_records"
                      color="emerald"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "asset_type", type: "VARCHAR(20)" },
                        { name: "asset_id", type: "INT", key: "FK" },
                        { name: "maintenance_type", type: "VARCHAR(50)" },
                        { name: "status", type: "ENUM" },
                        { name: "cost", type: "DECIMAL(10,2)" },
                      ]}
                    />
                    <TableCard 
                      name="report_uploads"
                      color="rose"
                      columns={[
                        { name: "id", type: "INT", key: "PK" },
                        { name: "user_id", type: "INT", key: "FK" },
                        { name: "filename", type: "VARCHAR(255)" },
                        { name: "content_type", type: "VARCHAR(100)" },
                        { name: "size_bytes", type: "INT" },
                        { name: "stored_path", type: "VARCHAR(255)" },
                        { name: "uploaded_at", type: "TIMESTAMP" },
                        { name: "notes", type: "TEXT" },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <RestrictedNotice feature="ERD" />
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-muted-foreground">Kementerian Kesehatan RI - RSUP Persahabatan</p>
          <p className="text-xs text-muted-foreground mt-1">Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana (SiPeNa)</p>
        </div>
        </div>
      </div>
    </div>
  )
}

// Component: Class Card
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
    <div className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-lg ${colorClasses[color]?.split(' ').slice(1).join(' ')}`}>
      <div className={`bg-gradient-to-r ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} p-3`}>
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-white">{name}</h4>
          <Badge className="bg-white/20 text-white border-0">{badge}</Badge>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Properties</p>
          <div className="space-y-1">
            {properties.map((prop, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-foreground">{prop.name}</span>
                <span className="font-mono text-muted-foreground">{prop.type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Methods</p>
          <div className="space-y-1">
            {methods.map((method, i) => (
              <div key={i} className="text-xs font-mono text-blue-600 dark:text-blue-400">
                + {method}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Component: Activity Flow
function ActivityFlow({ title, color, steps }: {
  title: string
  color: string
  steps: { step: string; type: string }[]
}) {
  const colorClasses: Record<string, string> = {
    orange: "from-orange-500 to-amber-500 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    blue: "from-blue-500 to-indigo-500 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    purple: "from-purple-500 to-indigo-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    rose: "from-rose-500 to-pink-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    amber: "from-amber-500 to-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    fuchsia: "from-fuchsia-500 to-pink-500 bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800",
    teal: "from-teal-500 to-cyan-500 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
  }

  const bgClass = colorClasses[color]?.split(' ').slice(2, 4).join(' ')
  const borderClass = colorClasses[color]?.split(' ').slice(4).join(' ')
  const gradientClass = colorClasses[color]?.split(' ').slice(0, 2).join(' ')

  return (
    <div className={`rounded-xl p-5 border ${bgClass} ${borderClass}`}>
      <h4 className="font-semibold mb-4 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${gradientClass}`}></div>
        {title}
      </h4>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {s.type === "start" && (
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
            )}
            {s.type === "end" && (
              <div className="w-8 h-8 rounded-full bg-red-500 border-4 border-red-300 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
            {s.type === "action" && (
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs font-bold">
                {i}
              </div>
            )}
            {s.type === "decision" && (
              <div className="w-8 h-8 rotate-45 bg-yellow-400 border-2 border-yellow-500 flex items-center justify-center">
                <span className="-rotate-45 text-xs">?</span>
              </div>
            )}
            <span className="text-sm flex-1">{s.step}</span>
            {i < steps.length - 1 && (
              <Zap className="w-4 h-4 text-gray-400" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Component: Table Card (ERD)
function TableCard({ name, color, columns }: {
  name: string
  color: string
  columns: { name: string; type: string; key?: string }[]
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
    <div className={`rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-lg ${colorClasses[color]?.split(' ').slice(1).join(' ')}`}>
      <div className={`bg-gradient-to-r ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} p-3`}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-white" />
          <h4 className="font-bold text-white font-mono text-sm">{name}</h4>
        </div>
      </div>
      <div className="p-3">
        <div className="space-y-1">
          {columns.map((col, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-2">
                {col.key && (
                  <Badge variant="outline" className={`text-[10px] px-1 py-0 ${col.key === 'PK' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : col.key === 'FK' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                    {col.key}
                  </Badge>
                )}
                <span className="font-mono text-foreground">{col.name}</span>
              </div>
              <span className="font-mono text-muted-foreground text-[10px]">{col.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RestrictedNotice({ feature }: { feature: string }) {
  return (
    <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
      <CardHeader className="border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle>{feature}</CardTitle>
            <CardDescription>Akses terbatas</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          Diagram ini hanya bisa dilihat oleh Administrator untuk menjaga kerahasiaan struktur aplikasi.
        </p>
        <p className="text-xs text-muted-foreground">
          Silakan hubungi admin apabila membutuhkan penjelasan tambahan.
        </p>
      </CardContent>
    </Card>
  )
}
