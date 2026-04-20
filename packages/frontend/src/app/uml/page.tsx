"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/services/auth-utils"
import { normalizeUserRole } from "@/utils/role"
import { ArrowRight, Box, Database, FileCode2, UploadCloud, Users, Workflow, Zap } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

type DiagramLink = {
  id: string
  label: string
}

type DiagramSectionId = "activity" | "class" | "erd" | "use-case"

type ActivityStep = {
  step: string
  type: "start" | "action" | "decision" | "end"
}

const umlSections: { id: DiagramSectionId; label: string }[] = [
  {
    id: "activity",
    label: "Activity Diagram",
  },
  {
    id: "class",
    label: "Class Diagram",
  },
  {
    id: "erd",
    label: "Entity Relationship Diagram",
  },
  {
    id: "use-case",
    label: "Use Case Diagram",
  },
]

function isDiagramSectionId(value: string | null | undefined): value is DiagramSectionId {
  if (!value) {
    return false
  }

  return umlSections.some((section) => section.id === value)
}

function resolveSectionFromLocation(allowedSections: DiagramSectionId[]): DiagramSectionId {
  const hashSection = window.location.hash.replace("#", "")
  const querySection = new URLSearchParams(window.location.search).get("diagram")

  if (isDiagramSectionId(hashSection) && allowedSections.includes(hashSection)) {
    return hashSection
  }

  if (isDiagramSectionId(querySection) && allowedSections.includes(querySection)) {
    return querySection
  }

  return allowedSections[0] ?? "activity"
}

const activityFlows: { title: string; color: "amber" | "emerald" | "fuchsia" | "orange" | "purple" | "rose" | "teal"; steps: ActivityStep[] }[] = [
  {
    title: "Alur Daftar Akun",
    color: "fuchsia",
    steps: [
      { step: "Start", type: "start" },
      { step: "Klik Buat Akun", type: "action" },
      { step: "Isi formulir", type: "action" },
      { step: "Valid?", type: "decision" },
      { step: "Buat akun", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Login",
    color: "purple",
    steps: [
      { step: "Start", type: "start" },
      { step: "Input NIP & Password", type: "action" },
      { step: "Validasi kredensial", type: "action" },
      { step: "Valid?", type: "decision" },
      { step: "Generate token", type: "action" },
      { step: "Redirect dashboard", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Lupa Password",
    color: "amber",
    steps: [
      { step: "Start", type: "start" },
      { step: "Klik Lupa Password", type: "action" },
      { step: "Isi email atau username", type: "action" },
      { step: "Valid?", type: "decision" },
      { step: "Kirim tautan reset", type: "action" },
      { step: "Atur password baru", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Penambahan Inventaris",
    color: "teal",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih kategori aset", type: "action" },
      { step: "Isi data detail", type: "action" },
      { step: "Validasi", type: "decision" },
      { step: "Simpan ke master inventory", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Pemeliharaan Sarana",
    color: "emerald",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih aset yang akan dipelihara", type: "action" },
      { step: "Buat jadwal pemeliharaan", type: "action" },
      { step: "Jadwal valid?", type: "decision" },
      { step: "Teknisi melakukan pemeliharaan", type: "action" },
      { step: "Update status dan catatan hasil", type: "action" },
      { step: "Validasi selesai", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Peminjaman Alat",
    color: "orange",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pilih alat yang tersedia", type: "action" },
      { step: "Isi form peminjaman", type: "action" },
      { step: "Data lengkap?", type: "decision" },
      { step: "Kirim permintaan peminjaman", type: "action" },
      { step: "Admin/leader review permintaan", type: "action" },
      { step: "Disetujui?", type: "decision" },
      { step: "Status alat menjadi dipinjam", type: "action" },
      { step: "End", type: "end" },
    ],
  },
  {
    title: "Alur Pengembalian Alat",
    color: "rose",
    steps: [
      { step: "Start", type: "start" },
      { step: "Pengguna pilih data peminjaman aktif", type: "action" },
      { step: "Isi kondisi dan catatan pengembalian", type: "action" },
      { step: "Data valid?", type: "decision" },
      { step: "Kirim pengajuan pengembalian", type: "action" },
      { step: "Petugas verifikasi kondisi alat", type: "action" },
      { step: "Alat sesuai?", type: "decision" },
      { step: "Status alat menjadi tersedia", type: "action" },
      { step: "End", type: "end" },
    ],
  },
]

const classItems = [
  {
    name: "Borrowing",
    color: "orange" as const,
    badge: "Transaction",
    properties: [
      { name: "id", type: "string" },
      { name: "userId", type: "string" },
      { name: "assetId", type: "string" },
      { name: "status", type: "BorrowStatus" },
    ],
    methods: ["request()", "approve()", "return()"],
  },
  {
    name: "Maintenance",
    color: "emerald" as const,
    badge: "Transaction",
    properties: [
      { name: "id", type: "string" },
      { name: "assetId", type: "string" },
      { name: "status", type: "string" },
      { name: "cost", type: "number" },
    ],
    methods: ["schedule()", "complete()", "cancel()"],
  },
  {
    name: "MedicalAsset",
    color: "purple" as const,
    badge: "Entity",
    properties: [
      { name: "id", type: "string" },
      { name: "assetCode", type: "string" },
      { name: "name", type: "string" },
      { name: "status", type: "AssetStatus" },
    ],
    methods: ["create()", "update()", "delete()"],
  },
  {
    name: "NonMedicalAsset",
    color: "blue" as const,
    badge: "Entity",
    properties: [
      { name: "id", type: "string" },
      { name: "assetCode", type: "string" },
      { name: "name", type: "string" },
      { name: "status", type: "AssetStatus" },
    ],
    methods: ["create()", "update()", "delete()"],
  },
  {
    name: "Return",
    color: "rose" as const,
    badge: "Transaction",
    properties: [
      { name: "id", type: "string" },
      { name: "borrowingId", type: "string" },
      { name: "condition", type: "string" },
      { name: "notes", type: "string" },
    ],
    methods: ["submit()", "verify()"],
  },
  {
    name: "User",
    color: "teal" as const,
    badge: "Core",
    properties: [
      { name: "id", type: "string" },
      { name: "nip", type: "string" },
      { name: "name", type: "string" },
      { name: "email", type: "string" },
      { name: "role", type: "UserRole" },
    ],
    methods: ["login()", "logout()", "updateProfile()"],
  },
]

const erdTables = [
  {
    name: "borrowing_records",
    color: "orange" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "user_id", type: "INT", key: "FK" },
      { name: "asset_id", type: "INT", key: "FK" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "maintenance_records",
    color: "emerald" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "asset_id", type: "INT", key: "FK" },
      { name: "maintenance_type", type: "VARCHAR(50)" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "medical_assets",
    color: "purple" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
      { name: "name", type: "VARCHAR(255)" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "non_medical_assets",
    color: "blue" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "asset_code", type: "VARCHAR(50)", key: "UQ" },
      { name: "name", type: "VARCHAR(255)" },
      { name: "status", type: "ENUM" },
    ],
  },
  {
    name: "return_records",
    color: "rose" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "borrowing_id", type: "INT", key: "FK" },
      { name: "condition", type: "ENUM" },
      { name: "received_by", type: "INT", key: "FK" },
    ],
  },
  {
    name: "users",
    color: "teal" as const,
    columns: [
      { name: "id", type: "INT", key: "PK" },
      { name: "nip", type: "VARCHAR(20)", key: "UQ" },
      { name: "email", type: "VARCHAR(255)", key: "UQ" },
      { name: "role", type: "ENUM" },
    ],
  },
]

const useCaseActors = [
  {
    actor: "Administrator",
    accent: "teal" as const,
    items: ["Kelola inventaris", "Kelola pengguna", "Validasi transaksi", "Kelola pemeliharaan"],
  },
  {
    actor: "Leader",
    accent: "violet" as const,
    items: ["Pantau operasional", "Review peminjaman", "Validasi pengembalian"],
  },
  {
    actor: "Staff PJ",
    accent: "blue" as const,
    items: ["Lihat inventaris", "Atur jadwal pemeliharaan", "Pantau progres", "Lihat laporan"],
  },
  {
    actor: "Staff Pelayanan",
    accent: "sky" as const,
    items: ["Lihat inventaris", "Ajukan peminjaman", "Kirim pengembalian"],
  },
  {
    actor: "Teknisi",
    accent: "orange" as const,
    items: ["Lihat jadwal", "Update progres", "Isi catatan hasil"],
  },
  {
    actor: "Pengguna",
    accent: "amber" as const,
    items: ["Lihat dokumentasi", "Lihat inventaris", "Ajukan peminjaman"],
  },
]

export default function UMLPage() {
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser())
  const [activeSection, setActiveSection] = useState<DiagramSectionId>("activity")
  const sectionContainerRef = useRef<HTMLDivElement>(null)

  const visibleSections = useMemo(() => {
    const role = normalizeUserRole(currentUser?.role)
    if (role === "admin") {
      return umlSections
    }

    return umlSections.filter((section) => section.id === "activity" || section.id === "use-case")
  }, [currentUser?.role])

  const visibleSectionIds = useMemo(
    () => visibleSections.map((section) => section.id),
    [visibleSections]
  )

  useEffect(() => {
    const syncUser = () => setCurrentUser(getCurrentUser())
    syncUser()

    window.addEventListener("auth-user-updated", syncUser)
    return () => window.removeEventListener("auth-user-updated", syncUser)
  }, [])

  useEffect(() => {
    const initialSection = resolveSectionFromLocation(visibleSectionIds)
    setActiveSection(initialSection)

    const syncFromLocation = () => {
      setActiveSection(resolveSectionFromLocation(visibleSectionIds))
    }

    window.addEventListener("hashchange", syncFromLocation)
    window.addEventListener("popstate", syncFromLocation)

    return () => {
      window.removeEventListener("hashchange", syncFromLocation)
      window.removeEventListener("popstate", syncFromLocation)
    }
  }, [visibleSectionIds])

  useEffect(() => {
    if (!visibleSectionIds.includes(activeSection)) {
      setActiveSection(visibleSectionIds[0] ?? "activity")
    }
  }, [activeSection, visibleSectionIds])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set("diagram", activeSection)
    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}#${activeSection}`

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      window.history.replaceState(null, "", nextUrl)
    }

    if (sectionContainerRef.current) {
      sectionContainerRef.current.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(0.995)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        {
          duration: 280,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      )
    }
  }, [activeSection])

  return (
    <div className="bg-linear-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-8">
          <section className="grid gap-4 xl:grid-cols-2">
          <FeatureCard
            title="Dokumentasi UML"
              description="Lihat Activity Diagram dan Use Case Diagram sesuai akses Anda."
            href={`#${visibleSectionIds[0] ?? "activity"}`}
            buttonLabel="Lihat Dokumentasi UML"
            icon={<FileCode2 className="h-5 w-5 text-white" />}
            iconContainerClass="from-teal-500 to-cyan-500"
            items={visibleSections.map((section) => section.label)}
          />
            <FeatureCard
              title="Dokumentasi Unggahan"
              description="Buka dokumentasi unggahan file dan alur arsip pendukung."
              href="/unggahan"
              buttonLabel="Buka Dokumentasi Unggahan"
              icon={<UploadCloud className="h-5 w-5 text-white" />}
              iconContainerClass="from-amber-500 to-orange-500"
            />
        </section>

        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-3 shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex flex-wrap gap-3">
              {visibleSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition ${
                  activeSection === section.id
                    ? "border-teal-600 bg-teal-600 text-white dark:border-teal-500 dark:bg-teal-500"
                    : "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800/70 dark:bg-teal-950/40 dark:text-teal-200"
                }`}
                aria-pressed={activeSection === section.id}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={sectionContainerRef}>
        {activeSection === "activity" && (
          <section id="activity" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-orange-500 to-amber-500 p-2">
                  <Workflow className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Activity Diagram</CardTitle>
                  <CardDescription>Alur proses utama termasuk peminjaman, pengembalian, dan pemeliharaan sarana.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {activityFlows.map((flow) => (
                  <ActivityFlow key={flow.title} title={flow.title} color={flow.color} steps={flow.steps} />
                ))}
              </div>
            </CardContent>
          </Card>
          </section>
        )}

          {activeSection === "class" && visibleSectionIds.includes("class") && (
          <section id="class" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-purple-500 to-indigo-500 p-2">
                  <Box className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Class Diagram</CardTitle>
                  <CardDescription>Struktur kelas dan relasi inti pada sistem.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {classItems.map((item) => (
                  <ClassCard key={item.name} {...item} />
                ))}
              </div>
              <div className="rounded-2xl bg-linear-to-r from-purple-50 to-indigo-50 p-6 dark:from-purple-950/30 dark:to-indigo-950/30">
                <h4 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Relasi Antar Kelas</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { from: "Borrowing", to: "Return", rel: "1 : 1" },
                    { from: "MedicalAsset", to: "Borrowing", rel: "1 : N" },
                    { from: "User", to: "Borrowing", rel: "1 : N" },
                    { from: "User", to: "Maintenance", rel: "1 : N" },
                  ].map((relation) => (
                    <div key={`${relation.from}-${relation.to}`} className="flex items-center gap-4 rounded-xl bg-white/70 p-3 dark:bg-slate-800/60">
                      <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200">
                        {relation.from}
                      </Badge>
                      <div className="flex flex-1 items-center gap-2">
                        <div className="h-px flex-1 bg-purple-300" />
                        <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-xs text-purple-700 dark:bg-purple-950 dark:text-purple-200">
                          {relation.rel}
                        </span>
                        <div className="h-px flex-1 bg-purple-300" />
                      </div>
                      <Badge variant="outline" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                        {relation.to}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          </section>
        )}
        </div>

          {activeSection === "erd" && visibleSectionIds.includes("erd") && (
          <section id="erd" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-emerald-500 to-green-500 p-2">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Entity Relationship Diagram</CardTitle>
                  <CardDescription>Representasi tabel dan struktur data utama.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {erdTables.map((table) => (
                  <TableCard key={table.name} {...table} />
                ))}
              </div>
            </CardContent>
          </Card>
          </section>
        )}

        {activeSection === "use-case" && (
          <section id="use-case" className="scroll-mt-28">
          <Card className="border-0 bg-white/80 shadow-xl backdrop-blur-sm dark:bg-slate-900/80">
            <CardHeader className="border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-linear-to-br from-teal-500 to-cyan-500 p-2">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Use Case Diagram</CardTitle>
                  <CardDescription>Interaksi aktor dengan modul inti sistem inventaris.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {useCaseActors.map((actor) => (
                  <UseCaseActorCard key={actor.actor} {...actor} />
                ))}
              </div>
            </CardContent>
          </Card>
          </section>
        )}

        <div className="border-t border-gray-200 pt-6 text-center dark:border-gray-800">
          <p className="text-sm text-muted-foreground">Kementerian Kesehatan RI - RSUP Persahabatan</p>
          <p className="mt-1 text-xs text-muted-foreground">Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana (SiPeNa)</p>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  title,
  description,
  href,
  buttonLabel,
  icon,
  iconContainerClass,
}: {
  title: string
  description: string
  href: string
  buttonLabel: string
  icon: ReactNode
  iconContainerClass: string
}) {
  return (
    <Card className="border-slate-200/70 bg-white/90 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
      <CardHeader className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-2xl bg-linear-to-br p-3 shadow-sm ${iconContainerClass}`}>{icon}</div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1 leading-6">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  )
}

function ClassCard({
  name,
  color,
  badge,
  properties,
  methods,
}: {
  name: string
  color: "teal" | "purple" | "blue" | "orange" | "emerald" | "rose"
  badge: string
  properties: { name: string; type: string }[]
  methods: string[]
}) {
  const colorClasses: Record<typeof color, string> = {
    teal: "from-teal-500 to-cyan-500 border-teal-200 dark:border-teal-800",
    purple: "from-purple-500 to-indigo-500 border-purple-200 dark:border-purple-800",
    blue: "from-blue-500 to-indigo-500 border-blue-200 dark:border-blue-800",
    orange: "from-orange-500 to-amber-500 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 border-emerald-200 dark:border-emerald-800",
    rose: "from-rose-500 to-pink-500 border-rose-200 dark:border-rose-800",
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-slate-900 ${colorClasses[color].split(" ").slice(1).join(" ")}`}>
      <div className={`bg-linear-to-r p-3 ${colorClasses[color].split(" ").slice(0, 2).join(" ")}`}>
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-white">{name}</h4>
          <Badge className="border-0 bg-white/20 text-white">{badge}</Badge>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Properties</p>
          <div className="space-y-1">
            {properties.map((prop) => (
              <div key={`${name}-${prop.name}`} className="flex justify-between text-xs">
                <span className="text-foreground">{prop.name}</span>
                <span className="font-mono text-muted-foreground">{prop.type}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Methods</p>
          <div className="space-y-1">
            {methods.map((method) => (
              <div key={`${name}-${method}`} className="font-mono text-xs text-blue-600 dark:text-blue-400">
                + {method}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityFlow({
  title,
  color,
  steps,
}: {
  title: string
  color: "amber" | "emerald" | "fuchsia" | "orange" | "purple" | "rose" | "teal"
  steps: ActivityStep[]
}) {
  const colorClasses: Record<typeof color, string> = {
    amber: "from-amber-500 to-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    emerald: "from-emerald-500 to-green-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    fuchsia: "from-fuchsia-500 to-pink-500 bg-fuchsia-50 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-800",
    orange: "from-orange-500 to-amber-500 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
    purple: "from-purple-500 to-indigo-500 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    rose: "from-rose-500 to-pink-500 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",
    teal: "from-teal-500 to-cyan-500 bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800",
  }

  const gradientClass = colorClasses[color].split(" ").slice(0, 2).join(" ")
  const bgClass = colorClasses[color].split(" ").slice(2, 4).join(" ")
  const borderClass = colorClasses[color].split(" ").slice(4).join(" ")

  return (
    <div className={`rounded-xl border p-4 ${bgClass} ${borderClass}`}>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <div className={`h-3 w-3 rounded-full bg-linear-to-r ${gradientClass}`} />
        {title}
      </h4>
      <div className="space-y-1.5">
        {steps.map((step, index) => (
          <div key={`${title}-${step.step}`} className="flex items-start gap-2.5">
            {step.type === "start" && (
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-green-500">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
            )}
            {step.type === "end" && (
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-red-300 bg-red-500">
                <div className="h-2 w-2 rounded-full bg-white" />
              </div>
            )}
            {step.type === "action" && (
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-[10px] font-bold dark:border-gray-600 dark:bg-slate-800">
                {index}
              </div>
            )}
            {step.type === "decision" && (
              <div className="mt-0.5 flex h-7 w-7 rotate-45 items-center justify-center border-2 border-yellow-500 bg-yellow-400">
                <span className="-rotate-45 text-[10px]">?</span>
              </div>
            )}
            <span className="flex-1 text-[12px] leading-snug text-slate-700 dark:text-slate-200">{step.step}</span>
            {index < steps.length - 1 && <Zap className="h-3.5 w-3.5 text-gray-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function TableCard({
  name,
  color,
  columns,
}: {
  name: string
  color: "teal" | "purple" | "blue" | "orange" | "emerald" | "rose"
  columns: { name: string; type: string; key?: string }[]
}) {
  const colorClasses: Record<typeof color, string> = {
    teal: "from-teal-500 to-cyan-500 border-teal-200 dark:border-teal-800",
    purple: "from-purple-500 to-indigo-500 border-purple-200 dark:border-purple-800",
    blue: "from-blue-500 to-indigo-500 border-blue-200 dark:border-blue-800",
    orange: "from-orange-500 to-amber-500 border-orange-200 dark:border-orange-800",
    emerald: "from-emerald-500 to-green-500 border-emerald-200 dark:border-emerald-800",
    rose: "from-rose-500 to-pink-500 border-rose-200 dark:border-rose-800",
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-slate-900 ${colorClasses[color].split(" ").slice(1).join(" ")}`}>
      <div className={`bg-linear-to-r p-3 ${colorClasses[color].split(" ").slice(0, 2).join(" ")}`}>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-white" />
          <h4 className="font-mono text-sm font-bold text-white">{name}</h4>
        </div>
      </div>
      <div className="p-3">
        <div className="space-y-1">
          {columns.map((column) => (
            <div key={`${name}-${column.name}`} className="flex items-center justify-between border-b border-gray-100 py-1 text-xs last:border-0 dark:border-gray-800">
              <div className="flex items-center gap-2">
                {column.key && (
                  <Badge
                    variant="outline"
                    className={`px-1 py-0 text-[10px] ${
                      column.key === "PK"
                        ? "border-yellow-300 bg-yellow-100 text-yellow-700"
                        : column.key === "FK"
                          ? "border-blue-300 bg-blue-100 text-blue-700"
                          : "border-gray-300 bg-gray-100 text-gray-700"
                    }`}
                  >
                    {column.key}
                  </Badge>
                )}
                <span className="font-mono text-foreground">{column.name}</span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{column.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UseCaseActorCard({
  actor,
  accent,
  items,
}: {
  actor: string
    accent: "teal" | "violet" | "blue" | "amber" | "sky" | "orange"
  items: string[]
}) {
  const accentClass: Record<typeof accent, string> = {
    teal: "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/20",
    violet: "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20",
    blue: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20",
    amber: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20",
      sky: "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/20",
      orange: "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20",
  }

  return (
    <div className={`rounded-2xl border p-5 ${accentClass[accent]}`}>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{actor}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={`${actor}-${item}`} className="flex items-start gap-3 rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
