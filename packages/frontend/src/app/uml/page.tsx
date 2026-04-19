"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/services/auth-utils"
import { normalizeUserRole } from "@/utils/role"
import {
    ArrowRight,
  Activity,
    BookOpen,
    Box,
    Database,
    FileCode2,
    GitBranch,
    Network,
    Shield,
    Users,
    Workflow,
    Zap
} from "lucide-react"
import Link from "next/link"
                      <div className="rounded-lg bg-linear-to-br from-purple-500 to-indigo-500 p-2">
                        <Box className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>Class Diagram</CardTitle>
                        <CardDescription>Struktur kelas dan entitas sistem</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <ClassCard name="User" color="teal" badge="Core" properties={[{ name: "id", type: "string" }, { name: "nip", type: "string" }, { name: "name", type: "string" }, { name: "email", type: "string" }, { name: "role", type: "UserRole" }, { name: "createdAt", type: "Date" }]} methods={["login()", "logout()", "updateProfile()"]} />
                      <ClassCard name="MedicalAsset" color="purple" badge="Entity" properties={[{ name: "id", type: "string" }, { name: "assetCode", type: "string" }, { name: "inventoryName", type: "string" }, { name: "name", type: "string" }, { name: "type", type: "string" }, { name: "serialNumber", type: "string" }, { name: "purchaseDate", type: "Date" }, { name: "lastMaintenance", type: "Date" }, { name: "nextMaintenance", type: "Date" }, { name: "category", type: "string" }, { name: "status", type: "AssetStatus" }, { name: "roomId", type: "string" }, { name: "notes", type: "string" }, { name: "condition", type: "string" }, { name: "usagePurpose", type: "string" }]} methods={["create()", "update()", "delete()"]} />
                      <ClassCard name="NonMedicalAsset" color="blue" badge="Entity" properties={[{ name: "id", type: "string" }, { name: "assetCode", type: "string" }, { name: "inventoryName", type: "string" }, { name: "name", type: "string" }, { name: "type", type: "string" }, { name: "serialNumber", type: "string" }, { name: "purchaseDate", type: "Date" }, { name: "lastMaintenance", type: "Date" }, { name: "nextMaintenance", type: "Date" }, { name: "category", type: "string" }, { name: "status", type: "AssetStatus" }, { name: "roomId", type: "string" }, { name: "notes", type: "string" }, { name: "condition", type: "string" }, { name: "usagePurpose", type: "string" }]} methods={["create()", "update()", "delete()"]} />
                      <ClassCard name="Borrowing" color="orange" badge="Transaction" properties={[{ name: "id", type: "string" }, { name: "userId", type: "string" }, { name: "assetId", type: "string" }, { name: "borrowDate", type: "Date" }, { name: "returnDate", type: "Date" }, { name: "status", type: "BorrowStatus" }]} methods={["request()", "approve()", "return()"]} />
                      <ClassCard name="Maintenance" color="emerald" badge="Transaction" properties={[{ name: "id", type: "string" }, { name: "assetId", type: "string" }, { name: "type", type: "string" }, { name: "scheduledDate", type: "Date" }, { name: "status", type: "string" }, { name: "cost", type: "number" }]} methods={["schedule()", "complete()", "cancel()"]} />
                      <ClassCard name="Return" color="rose" badge="Transaction" properties={[{ name: "id", type: "string" }, { name: "borrowingId", type: "string" }, { name: "returnDate", type: "Date" }, { name: "condition", type: "string" }, { name: "notes", type: "string" }]} methods={["submit()", "verify()"]} />
                    </div>
                    <div className="mt-8 rounded-2xl bg-linear-to-r from-purple-50 to-indigo-50 p-6 dark:from-purple-950/30 dark:to-indigo-950/30">
                      <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold"><GitBranch className="h-5 w-5 text-purple-600" />Relasi Antar Kelas</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {[
                          { from: "User", to: "Borrowing", rel: "1 : N", desc: "User dapat memiliki banyak peminjaman" },
                          { from: "User", to: "Maintenance", rel: "1 : N", desc: "User dapat membuat banyak jadwal" },
                          { from: "MedicalAsset", to: "Borrowing", rel: "1 : N", desc: "Aset dapat dipinjam berkali-kali" },
                          { from: "Borrowing", to: "Return", rel: "1 : 1", desc: "Setiap peminjaman punya 1 pengembalian" },
                        ].map((rel, i) => (
                          <div key={i} className="flex items-center gap-4 rounded-xl bg-white/60 p-3 dark:bg-slate-800/60">
                            <Badge variant="outline" className="bg-purple-100 text-purple-700">{rel.from}</Badge>
                            <div className="flex flex-1 items-center gap-2">
                              <div className="h-px flex-1 bg-purple-300" />
                              <span className="rounded bg-purple-100 px-2 py-0.5 font-mono text-xs">{rel.rel}</span>
                              <div className="h-px flex-1 bg-purple-300" />
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
            </section>

            <section id="erd" className="space-y-6">
              {canViewClassAndErd ? (
                <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                  <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-linear-to-br from-emerald-500 to-green-500 p-2">
                        <Database className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>Entity Relationship Diagram</CardTitle>
                        <CardDescription>Struktur database sistem</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      <TableCard name="users" color="teal" columns={[{ name: "id", type: "INT", key: "PK" }, { name: "nip", type: "VARCHAR(20)", key: "UQ" }, { name: "name", type: "VARCHAR(255)" }, { name: "email", type: "VARCHAR(255)", key: "UQ" }, { name: "password", type: "VARCHAR(255)" }, { name: "role", type: "ENUM" }, { name: "created_at", type: "TIMESTAMP" }]} />
                      <TableCard name="medical_assets" color="purple" columns={[{ name: "id", type: "INT", key: "PK" }, { name: "asset_code", type: "VARCHAR(50)", key: "UQ" }, { name: "name", type: "VARCHAR(255)" }, { name: "inventory_name", type: "VARCHAR(255)" }, { name: "category", type: "VARCHAR(100)" }, { name: "type", type: "VARCHAR(20)" }, { name: "serial_number", type: "VARCHAR(100)" }, { name: "condition", type: "VARCHAR(20)" }, { name: "status", type: "ENUM" }, { name: "location", type: "VARCHAR(255)" }, { name: "purchase_date", type: "DATE" }, { name: "next_maintenance", type: "DATE" }, { name: "last_maintenance", type: "DATE" }, { name: "specifications", type: "JSON/TEXT" }, { name: "created_by", type: "INT", key: "FK" }]} />
                      <TableCard name="non_medical_assets" color="blue" columns={[{ name: "id", type: "INT", key: "PK" }, { name: "asset_code", type: "VARCHAR(50)", key: "UQ" }, { name: "name", type: "VARCHAR(255)" }, { name: "inventory_name", type: "VARCHAR(255)" }, { name: "category", type: "VARCHAR(100)" }, { name: "type", type: "VARCHAR(20)" }, { name: "serial_number", type: "VARCHAR(100)" }, { name: "condition", type: "VARCHAR(20)" }, { name: "status", type: "ENUM" }, { name: "location", type: "VARCHAR(255)" }, { name: "purchase_date", type: "DATE" }, { name: "next_maintenance", type: "DATE" }, { name: "last_maintenance", type: "DATE" }, { name: "specifications", type: "JSON/TEXT" }, { name: "created_by", type: "INT", key: "FK" }]} />
                      <TableCard name="borrowing_records" color="orange" columns={[{ name: "id", type: "INT", key: "PK" }, { name: "user_id", type: "INT", key: "FK" }, { name: "asset_type", type: "VARCHAR(20)" }, { name: "asset_id", type: "INT", key: "FK" }, { name: "borrowed_date", type: "TIMESTAMP" }, { name: "status", type: "ENUM" }]} />
                      <TableCard name="return_records" color="rose" columns={[{ name: "id", type: "INT", key: "PK" }, { name: "borrowing_id", type: "INT", key: "FK" }, { name: "return_date", type: "TIMESTAMP" }, { name: "condition", type: "ENUM" }, { name: "received_by", type: "INT", key: "FK" }]} />
                      <TableCard name="maintenance_records" color="emerald" columns={[{ name: "id", type: "INT", key: "PK" }, { name: "asset_type", type: "VARCHAR(20)" }, { name: "asset_id", type: "INT", key: "FK" }, { name: "maintenance_type", type: "VARCHAR(50)" }, { name: "status", type: "ENUM" }, { name: "cost", type: "DECIMAL(10,2)" }]} />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <RestrictedNotice feature="ERD" />
              )}
            </section>

            <section id="use-case" className="space-y-6 scroll-mt-28">
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-linear-to-br from-teal-500 to-cyan-500 p-2">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>Use Case Diagram</CardTitle>
                      <CardDescription>Interaksi pengguna dengan sistem inventaris</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8 p-6">
                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-700/70 dark:bg-slate-900/40">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ringkasan Akses per Role</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Tampilan di bawah difokuskan untuk memperjelas hak akses, tanggung jawab, dan batasan setiap role tanpa elemen visual yang berlebihan.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {useCaseQuickSummary.map((item) => (
                          <Badge key={item.label} className="border border-slate-200 bg-white text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{item.label}: {item.value}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Role dan Tanggung Jawab</h4>
                        <p className="text-sm text-muted-foreground">Kartu berikut menampilkan ruang lingkup kerja tiap aktor beserta fitur yang dibatasi.</p>
                      </div>
                      <Badge className="w-fit bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Disusun untuk desktop dan mobile</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                      {useCaseRoleCards.map((card) => <RoleUseCaseCard key={card.key} card={card} />)}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-gray-200/60 bg-linear-to-r from-gray-50 to-slate-50 p-6 dark:border-gray-700/60 dark:from-slate-800/50 dark:to-slate-900/50">
                    <h4 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Network className="h-5 w-5 text-gray-600" />Matriks Ringkas Role</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {useCaseSummaryCards.map((card, i) => (
                        <div key={i} className={`rounded-2xl p-4 ${card.containerClass}`}>
                          <p className={`font-semibold ${card.titleClass}`}>{card.title}</p>
                          <div className="space-y-2">
                            {card.items.map((item, j) => (
                              <div key={j} className="mt-3 flex items-start gap-2 text-sm text-muted-foreground"><ArrowRight className="mt-1 h-3 w-3 shrink-0" /><span>{item}</span></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <div className="mt-8 border-t border-gray-200 pt-6 text-center dark:border-gray-800">
              <p className="text-sm text-muted-foreground">Kementerian Kesehatan RI - RSUP Persahabatan</p>
              <p className="mt-1 text-xs text-muted-foreground">Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana (SiPeNa)</p>
            </div>
          </div>
        </div>
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
                  </div>
                </CardContent>
              </Card>
            ) : (
              <RestrictedNotice feature="ERD" />
            )}
          </section>

          {/* Use Case Diagram */}
          <section id="use-case" className="space-y-6 scroll-mt-28">
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Use Case Diagram</CardTitle>
                    <CardDescription>Interaksi pengguna dengan sistem inventaris</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 p-6">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-700/70 dark:bg-slate-900/40">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Ringkasan Akses per Role
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Tampilan di bawah difokuskan untuk memperjelas hak akses, tanggung jawab, dan batasan setiap
                        role tanpa elemen visual yang berlebihan.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {useCaseQuickSummary.map((item) => (
                        <Badge
                          key={item.label}
                          className="bg-white text-slate-700 border border-slate-200 hover:bg-white dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
                        >
                          {item.label}: {item.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Role dan Tanggung Jawab
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Kartu berikut menampilkan ruang lingkup kerja tiap aktor beserta fitur yang dibatasi.
                      </p>
                    </div>
                    <Badge className="w-fit bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Disusun untuk desktop dan mobile
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {useCaseRoleCards.map((card) => (
                      <RoleUseCaseCard key={card.key} card={card} />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200/60 bg-linear-to-r from-gray-50 to-slate-50 p-6 dark:border-gray-700/60 dark:from-slate-800/50 dark:to-slate-900/50">
                  <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Network className="w-5 h-5 text-gray-600" />
                    Matriks Ringkas Role
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {useCaseSummaryCards.map((card, i) => (
                      <div key={i} className={`rounded-2xl p-4 ${card.containerClass}`}>
                        <p className={`font-semibold ${card.titleClass}`}>{card.title}</p>
                        <div className="space-y-2">
                          {card.items.map((item, j) => (
                            <div key={j} className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                              <ArrowRight className="mt-1 h-3 w-3 shrink-0" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Matriks ini diselaraskan dengan role aktif sistem: <span className="font-medium">admin, leader, staff, staff_pj, teknisi, user</span>.
                  </p>
                </div>
            </CardContent>
          </Card>
          </section>

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
          </section>
        </div>

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

type UseCaseRoleItem = {
  icon: string
  title: string
  desc: string
  disabled?: boolean
}

type UseCaseRoleCard = {
  key: string
  title: string
  roleIcon: string
  summary: string
  badge: string
  titleClass: string
  badgeClass: string
  containerClass: string
  glowClass: string
  iconWrapClass: string
  items: UseCaseRoleItem[]
}

type UseCaseSummaryCard = {
  title: string
  containerClass: string
  titleClass: string
  items: string[]
}

function RoleUseCaseCard({ card }: { card: UseCaseRoleCard }) {
  return (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
            <span>{card.roleIcon}</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.summary}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200">
          {card.badge}
        </Badge>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
        <span>{card.items.filter((item) => !item.disabled).length} akses aktif</span>
        <span>{card.items.length} poin</span>
      </div>

      <div className="mt-4 space-y-2.5">
        {card.items.map((item, i) => (
          <div
            key={`${card.key}-${i}`}
            className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${
              item.disabled
                ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20"
                : "border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40"
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-base dark:bg-slate-900">
              <span>{item.icon}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
                {item.disabled && (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Dibatasi</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
            </div>
          </div>
        ))}
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
      <div className={`bg-linear-to-r ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} p-3`}>
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
    <div className={`rounded-xl p-4 border ${bgClass} ${borderClass}`}>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <div className={`w-3 h-3 rounded-full bg-linear-to-r ${gradientClass}`}></div>
        {title}
      </h4>
      <div className="space-y-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {s.type === "start" && (
              <div className="mt-0.5 h-7 w-7 rounded-full bg-green-500 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
            )}
            {s.type === "end" && (
              <div className="mt-0.5 h-7 w-7 rounded-full bg-red-500 border-4 border-red-300 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            )}
            {s.type === "action" && (
              <div className="mt-0.5 h-7 w-7 rounded-lg bg-white dark:bg-slate-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-[10px] font-bold">
                {i}
              </div>
            )}
            {s.type === "decision" && (
              <div className="mt-0.5 h-7 w-7 rotate-45 bg-yellow-400 border-2 border-yellow-500 flex items-center justify-center">
                <span className="-rotate-45 text-[10px]">?</span>
              </div>
            )}
            <span className="flex-1 text-[12px] leading-snug text-slate-700 dark:text-slate-200">{s.step}</span>
            {i < steps.length - 1 && (
              <Zap className="h-3.5 w-3.5 text-gray-400" />
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
      <div className={`bg-linear-to-r ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')} p-3`}>
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
          <div className="p-2 bg-linear-to-br from-slate-600 to-slate-800 rounded-lg">
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
