"use client"

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getUsers } from "@/services/auth-utils";
import type { User } from "@/types/auth-types";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function UMLPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [currentUser] = useState(getCurrentUser())

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = () => {
    const allUsers = getUsers()
    setUsers(allUsers)
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-teal-100 text-teal-800"
      case "leader":
        return "bg-purple-100 text-purple-800"
      case "staff":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getAccessTypeLabel = (type?: string) => {
    switch (type) {
      case "medis":
        return "Medis"
      case "non-medis":
        return "Non-Medis"
      default:
        return "Semua"
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dokumentasi UML Diagram Use Case & Unggahan </h1>
          <p className="text-muted-foreground text-sm">Diagram Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)</p>
          <div className="mt-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
            <p className="text-sm text-teal-800">
              <strong>Dokumentasi ini menjelaskan:</strong> Arsitektur sistem, hubungan antar entitas, alur kerja proses peminjaman dan pemeliharaan inventaris. 
              Menggunakan standar UI/UX untuk memastikan konsistensi dan pemahaman yang jelas antar tim pengembangan.
            </p>
          </div>
        </div>

        <div className="space-y-8">

          {/* Use Case Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Use Case Diagram - Aktivitas Pengguna</CardTitle>
              <p className="text-sm text-muted-foreground">
                Diagram yang menunjukkan interaksi antara pengguna (Administrator dan Staff) dengan sistem inventaris
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-linear-to-br from-gray-50 to-blue-50 p-6 rounded-lg">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-4 h-4 bg-teal-500 rounded-full"></div>
                      <h3 className="font-bold text-teal-700 text-lg">Administrator & Leader</h3>
                      <Badge className="bg-teal-100 text-teal-800 text-xs">Full Access</Badge>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-teal-200">
                      <h4 className="font-semibold text-teal-700 mb-3">🔐 Hak Akses Penuh</h4>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Kelola Pengguna (CRUD)</span>
                            <p className="text-xs text-muted-foreground">Tambah, edit, hapus, lihat data pengguna sistem</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>

<div>
                            <span className="font-medium">Kelola Inventaris Non Medis (CRUD)</span>
                            <p className="text-xs text-muted-foreground">Mengatur genset, komputer, AC, printer, laptop</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Kelola Inventaris Medis (CRUD)</span>
                            <p className="text-xs text-muted-foreground">Mengatur peralatan medis dan kategorinya</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Tambah Inventaris (Medis & Non-Medis)</span>
                            <p className="text-xs text-muted-foreground">Membuat data master untuk aset baru</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Kelola Peminjaman Alat</span>
                            <p className="text-xs text-muted-foreground">Approve/validasi permintaan peminjaman</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Validasi Pengembalian Alat</span>
                            <p className="text-xs text-muted-foreground">Konfirmasi kondisi saat pengembalian</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Kelola Jadwal Pemeliharaan</span>
                            <p className="text-xs text-muted-foreground">Set status selesai, edit, hapus jadwal</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Dashboard & Statistik</span>
                            <p className="text-xs text-muted-foreground">Monitoring menyeluruh sistem</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Laporan & Analitik</span>
                            <p className="text-xs text-muted-foreground">Generate laporan lengkap</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      <h3 className="font-bold text-blue-700 text-lg">Staff</h3>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">Limited Access</Badge>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-700 mb-3">👤 Akses Terbatas</h4>
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Lihat Inventaris</span>
                            <p className="text-xs text-muted-foreground">Hanya read-only sesuai akses departemen</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Meminjam Alat</span>
                            <p className="text-xs text-muted-foreground">Request peminjaman aset yang tersedia</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Mengembalikan Alat</span>
                            <p className="text-xs text-muted-foreground">Submit request pengembalian</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Update Status Pemeliharaan</span>
                            <p className="text-xs text-muted-foreground">Ubah ke "Proses" (bukan "Selesai")</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Tambah Jadwal Pemeliharaan</span>
                            <p className="text-xs text-muted-foreground">Buat jadwal baru untuk aset</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium text-slate-700">Tidak Bisa Kelola Inventaris</span>
                            <p className="text-xs text-muted-foreground">Tidak dapat menambah, edit, atau hapus data master aset</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div>
                            <span className="font-medium">Lihat Dashboard</span>
                            <p className="text-xs text-muted-foreground">Monitoring data sesuai akses</p>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Relationship Overview */}
                <div className="mt-6 bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-semibold mb-3 text-gray-700">🔗 Hubungan dengan Sistem</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="text-center">
                      <div className="bg-teal-100 text-teal-800 p-2 rounded mb-2 font-semibold">Administrator & Leader</div>
                      <div className="space-y-1">
                        <div>→ Kelola Semua Modul</div>
                        <div>→ Approve Request</div>
                        <div>→ Full Report Access</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="bg-blue-100 text-blue-800 p-2 rounded mb-2 font-semibold">Staff</div>
                      <div className="space-y-1">
                        <div>→ Request-based Access</div>
                        <div>→ Limited Modification</div>
                        <div>→ View-only Reports</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="bg-gray-100 text-gray-800 p-2 rounded mb-2 font-semibold">Sistem</div>
                      <div className="space-y-1">
                        <div>→ Role-based Access</div>
                        <div>→ Audit Trail</div>
                        <div>→ Real-time Updates</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Class Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Class Diagram - Struktur Kelas & Entitas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Struktur kelas dan hubungan antar entitas dalam Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-linear-to-br from-purple-50 to-indigo-50 p-6 rounded-lg">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {/* User Class */}
                  <div className="bg-white p-5 rounded-lg border border-teal-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                      <h4 className="font-bold text-teal-700">User</h4>
                      <Badge className="bg-teal-100 text-teal-800 text-xs">Core</Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-gray-200 pb-2">
                        <div className="font-semibold text-teal-600 mb-2">Properties:</div>
                        <div className="ml-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">id</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">nip</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">name</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">email</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">role</span>
                            <span className="font-mono text-xs">UserRole</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">staffAccessType</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-teal-600 mb-2">Methods:</div>
                        <div className="ml-2 space-y-1">
                          <div>• login()</div>
                          <div>• logout()</div>
                          <div>• register()</div>
                          <div>• validateAccess()</div>
                        </div>
                      </div>
                    </div>
                  </div>


{/* NonMedicalRoom Class */}
                  <div className="bg-white p-5 rounded-lg border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <h4 className="font-bold text-blue-700">NonMedicalRoom</h4>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">Container</Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-gray-200 pb-2">
                        <div className="font-semibold text-blue-600 mb-2">Properties:</div>
                        <div className="ml-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">id</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">name</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">floor</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">capacity</span>
                            <span className="font-mono text-xs">number</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">assets</span>

<span className="font-mono text-xs">NonMedicalAsset[]</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-600 mb-2">Methods:</div>
                        <div className="ml-2 space-y-1">
                          <div>• addAsset()</div>
                          <div>• removeAsset()</div>
                          <div>• getAssets()</div>
                        </div>
                      </div>
                    </div>
                  </div>


{/* NonMedicalAsset Class */}
                  <div className="bg-white p-5 rounded-lg border border-orange-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <h4 className="font-bold text-orange-700">NonMedicalAsset</h4>
                      <Badge className="bg-orange-100 text-orange-800 text-xs">Asset</Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-gray-200 pb-2">
                        <div className="font-semibold text-orange-600 mb-2">Properties:</div>
                        <div className="ml-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">id</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">name</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">type</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">serialNumber</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">condition</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">status</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-orange-600 mb-2">Methods:</div>
                        <div className="ml-2 space-y-1">
                          <div>• updateCondition()</div>
                          <div>• markAsBorrowed()</div>
                          <div>• markAsAvailable()</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MedicalRoom Class */}
                  <div className="bg-white p-5 rounded-lg border border-green-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <h4 className="font-bold text-green-700">MedicalRoom</h4>
                      <Badge className="bg-green-100 text-green-800 text-xs">Container</Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-gray-200 pb-2">
                        <div className="font-semibold text-green-600 mb-2">Properties:</div>
                        <div className="ml-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">id</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">name</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">category</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">itemName</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">assets</span>
                            <span className="font-mono text-xs">MedicalAsset[]</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-green-600 mb-2">Methods:</div>
                        <div className="ml-2 space-y-1">
                          <div>• addMedicalAsset()</div>
                          <div>• removeMedicalAsset()</div>
                          <div>• getMedicalAssets()</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MedicalAsset Class */}
                  <div className="bg-white p-5 rounded-lg border border-red-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <h4 className="font-bold text-red-700">MedicalAsset</h4>
                      <Badge className="bg-red-100 text-red-800 text-xs">Asset</Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-gray-200 pb-2">
                        <div className="font-semibold text-red-600 mb-2">Properties:</div>
                        <div className="ml-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">id</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">name</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">type</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">manufacturer</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">category</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">status</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-red-600 mb-2">Methods:</div>
                        <div className="ml-2 space-y-1">
                          <div>• checkMaintenance()</div>
                          <div>• updateStatus()</div>
                          <div>• getCalibrationDate()</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Borrowing Class */}
                  <div className="bg-white p-5 rounded-lg border border-purple-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                      <h4 className="font-bold text-purple-700">Borrowing</h4>
                      <Badge className="bg-purple-100 text-purple-800 text-xs">Transaction</Badge>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="border-b border-gray-200 pb-2">
                        <div className="font-semibold text-purple-600 mb-2">Properties:</div>
                        <div className="ml-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">id</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">assetId</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">assetName</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">borrowerName</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">borrowDate</span>
                            <span className="font-mono text-xs">Date</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">returnDate</span>
                            <span className="font-mono text-xs">Date</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">status</span>
                            <span className="font-mono text-xs">string</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-purple-600 mb-2">Methods:</div>
                        <div className="ml-2 space-y-1">
                          <div>• createBorrowing()</div>
                          <div>• returnAsset()</div>
                          <div>• calculateFine()</div>
                          <div>• isOverdue()</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Class Relationships */}
                <div className="mt-8 bg-white p-5 rounded-lg border border-gray-200">
                  <h4 className="font-bold mb-4 text-gray-700 flex items-center gap-2">
                    <span className="text-lg">🔗</span>
                    Hubungan Antar Kelas
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">

<div className="bg-teal-50 p-3 rounded border">
                      <div className="font-semibold text-teal-700 mb-2">Composition</div>
                      <ul className="space-y-1 text-xs">
                        <li>• NonMedicalRoom → NonMedicalAsset (1:N)</li>
                        <li>• MedicalRoom → MedicalAsset (1:N)</li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 p-3 rounded border">
                      <div className="font-semibold text-blue-700 mb-2">Association</div>
                      <ul className="space-y-1 text-xs">
                        <li>• User → Borrowing (1:N)</li>
                        <li>• User → Maintenance (1:N)</li>
                      </ul>
                    </div>

<div className="bg-purple-50 p-3 rounded border">
                      <div className="font-semibold text-purple-700 mb-2">Inheritance</div>
                      <ul className="space-y-1 text-xs">
                        <li>• Asset ← NonMedicalAsset</li>
                        <li>• Asset ← MedicalAsset</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Activity Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Diagram - Proses Peminjaman Alat (SiPeNa)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Alur kerja step-by-step dalam proses peminjaman alat inventaris, menunjukkan validasi role-based access
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-linear-to-br from-blue-50 to-cyan-50 p-6 rounded-lg">
                <div className="space-y-8">
                  {/* Phase 1: Authentication & Access */}
                  <div className="bg-white p-5 rounded-lg border border-blue-200">
                    <h4 className="font-bold text-blue-700 mb-4 flex items-center gap-2">
                      <span className="text-lg">🔐</span>
                      Fase 1: Autentikasi & Validasi Akses
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">1</div>
                        <h5 className="font-semibold text-blue-700 mb-2">User Login</h5>
                        <p className="text-xs text-muted-foreground">Pengguna masuk dengan NIP & Password</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">2</div>
                        <h5 className="font-semibold text-blue-700 mb-2">Role Validation</h5>
                        <p className="text-xs text-muted-foreground">Sistem cek role Admin/Leader/Staff</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">3</div>
                        <h5 className="font-semibold text-blue-700 mb-2">Access Type Check</h5>
                        <p className="text-xs text-muted-foreground">Cek akses medis/non-medis/semua</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">4</div>
                        <h5 className="font-semibold text-blue-700 mb-2">Dashboard Access</h5>
                        <p className="text-xs text-muted-foreground">Redirect ke dashboard sesuai hak akses</p>
                      </div>
                    </div>
                  </div>

                  {/* Phase 2: Borrowing Process */}
                  <div className="bg-white p-5 rounded-lg border border-teal-200">
                    <h4 className="font-bold text-teal-700 mb-4 flex items-center gap-2">
                      <span className="text-lg">📋</span>
                      Fase 2: Proses Peminjaman
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">5</div>
                        <h5 className="font-semibold text-teal-700 mb-2">Navigate Menu</h5>
                        <p className="text-xs text-muted-foreground">Pilih "Peminjaman Alat" dari menu</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">6</div>
                        <h5 className="font-semibold text-teal-700 mb-2">Asset Filtering</h5>
                        <p className="text-xs text-muted-foreground">Tampilkan aset sesuai akses role</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">7</div>
                        <h5 className="font-semibold text-teal-700 mb-2">Select Asset</h5>
                        <p className="text-xs text-muted-foreground">Pilih aset yang tersedia untuk dipinjam</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">8</div>
                        <h5 className="font-semibold text-teal-700 mb-2">Fill Form</h5>
                        <p className="text-xs text-muted-foreground">Lengkapi data peminjam dan tanggal</p>
                      </div>
                    </div>
                  </div>

                  {/* Validation Gate */}
                  <div className="flex justify-center">
                    <div className="text-center max-w-md">
                      <div className="text-3xl text-amber-500 mb-3">⚖️</div>
                      <div className="bg-amber-100 border-2 border-amber-300 p-4 rounded-lg">
                        <h4 className="font-bold text-amber-800 mb-2">🔍 Validasi Sistem</h4>
                        <p className="text-sm text-amber-700 mb-3">
                          <strong>Apakah data lengkap dan aset tersedia?</strong>
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-amber-200 p-2 rounded">
                            <strong>Checklist:</strong>
                            <ul className="text-left mt-1 space-y-1">
                              <li>• Data peminjam lengkap</li>
                              <li>• Aset status "Tersedia"</li>
                              <li>• Tanggal valid</li>
                              <li>• Role authorize</li>
                            </ul>
                          </div>
                          <div className="bg-amber-200 p-2 rounded">
                            <strong>Validasi:</strong>
                            <ul className="text-left mt-1 space-y-1">
                              <li>• LocalStorage check</li>
                              <li>• Asset availability</li>
                              <li>• Date constraints</li>
                              <li>• Access permissions</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Decision Paths */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-green-50 border-2 border-green-200 p-5 rounded-lg">
                      <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        Validasi Berhasil
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                          <div>
                            <div className="font-semibold text-green-700">Simpan Data Peminjaman</div>
                            <div className="text-xs text-green-600">Tambah record ke LocalStorage "borrowings"</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                          <div>
                            <div className="font-semibold text-green-700">Update Status Aset</div>
                            <div className="text-xs text-green-600">Ubah status aset menjadi "Dipinjam"</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                          <div>
                            <div className="font-semibold text-green-700">Notifikasi Sukses</div>
                            <div className="text-xs text-green-600">Tampilkan konfirmasi dan update UI</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                          <div>
                            <div className="font-semibold text-green-700">Refresh Dashboard</div>
                            <div className="text-xs text-green-600">Update statistik dan daftar aset</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border-2 border-red-200 p-5 rounded-lg">
                      <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                        <span className="text-lg">❌</span>
                        Validasi Gagal
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                          <div>
                            <div className="font-semibold text-red-700">Error Handling</div>
                            <div className="text-xs text-red-600">Tampilkan pesan error spesifik</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                          <div>
                            <div className="font-semibold text-red-700">Form Reset</div>
                            <div className="text-xs text-red-600">Reset form untuk input ulang</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                          <div>
                            <div className="font-semibold text-red-700">Log Activity</div>
                            <div className="text-xs text-red-600">Catat error untuk audit trail</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                          <div>
                            <div className="font-semibold text-red-700">User Guidance</div>
                            <div className="text-xs text-red-600">Berikan panduan perbaikan</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Process Summary */}
                  <div className="bg-gray-100 p-4 rounded-lg border">
                    <h4 className="font-bold mb-3 text-gray-700">📊 Ringkasan Proses & Validasi</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-white p-3 rounded border">
                        <div className="font-semibold text-blue-600 mb-2">Input Validation</div>
                        <ul className="space-y-1">
                          <li>• NIP format (max 20 digit)</li>

                          <li>• Nama tidak kosong</li>

                          <li>• Tanggal kembali tanggal pinjam</li>
                          <li>• Aset tersedia & sesuai akses</li>
                        </ul>
                      </div>
                      <div>
                        <div className="font-semibold text-teal-600 mb-2">Business Rules</div>
                        <ul className="space-y-1">
                          <li>• Staff medis hanya aset medis</li>

<li>• Staff non-medis hanya aset non medis</li>
                          <li>• Admin/Leader akses semua aset</li>
                          <li>• Aset tidak bisa dipinjam ganda</li>
                        </ul>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="font-semibold text-purple-600 mb-2">System Actions</div>
                        <ul className="space-y-1">
                          <li>• Update LocalStorage "borrowings"</li>
                          <li>• Update asset status real-time</li>
                          <li>• Generate unique borrowing ID</li>
                          <li>• Trigger dashboard refresh</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>


          {/* Enhanced Activity Diagram - Maintenance Process */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Diagram - Proses Jadwal Pemeliharaan Alat (SiPeNa)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Alur kerja step-by-step dalam proses jadwal pemeliharaan alat inventaris, menunjukkan validasi role-based access
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-linear-to-br from-orange-50 to-red-50 p-6 rounded-lg">
                <div className="space-y-8">
                  {/* Phase 1: Authentication & Access Control */}
                  <div className="bg-white p-5 rounded-lg border border-orange-200">
                    <h4 className="font-bold text-orange-700 mb-4 flex items-center gap-2">
                      <span className="text-lg">🔐</span>
                      Fase 1: Autentikasi & Kontrol Akses
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">1</div>
                        <h5 className="font-semibold text-orange-700 mb-2">User Login</h5>
                        <p className="text-xs text-muted-foreground">Pengguna masuk ke sistem dengan NIP & Password</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">2</div>
                        <h5 className="font-semibold text-orange-700 mb-2">Role Validation</h5>
                        <p className="text-xs text-muted-foreground">Sistem cek role: Admin/Leader/Staff</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">3</div>
                        <h5 className="font-semibold text-orange-700 mb-2">Access Level Check</h5>
                        <p className="text-xs text-muted-foreground">Tentukan level akses maintenance</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-orange-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">4</div>
                        <h5 className="font-semibold text-orange-700 mb-2">Navigate Menu</h5>
                        <p className="text-xs text-muted-foreground">Akses menu "Jadwal Pemeliharaan"</p>
                      </div>
                    </div>
                  </div>

                  {/* Phase 2: Maintenance Planning & Creation */}
                  <div className="bg-white p-5 rounded-lg border border-amber-200">
                    <h4 className="font-bold text-amber-700 mb-4 flex items-center gap-2">
                      <span className="text-lg">📋</span>
                      Fase 2: Perencanaan & Pembuatan Jadwal
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">5</div>
                        <h5 className="font-semibold text-amber-700 mb-2">Select Asset</h5>
                        <p className="text-xs text-muted-foreground">Pilih aset inventaris dari daftar</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">6</div>
                        <h5 className="font-semibold text-amber-700 mb-2">Fill Form</h5>
                        <p className="text-xs text-muted-foreground">Lengkapi form: tipe, tanggal, teknisi</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">7</div>
                        <h5 className="font-semibold text-amber-700 mb-2">Set Priority</h5>
                        <p className="text-xs text-muted-foreground">Tentukan prioritas: Rutin/Urgent</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">8</div>
                        <h5 className="font-semibold text-amber-700 mb-2">Save Schedule</h5>
                        <p className="text-xs text-muted-foreground">Simpan jadwal ke LocalStorage</p>
                      </div>
                    </div>
                  </div>

                  {/* Role-Based Access Validation Gate */}
                  <div className="flex justify-center">
                    <div className="text-center max-w-lg">
                      <div className="text-3xl text-purple-500 mb-3">⚖️</div>
                      <div className="bg-purple-100 border-2 border-purple-300 p-4 rounded-lg">
                        <h4 className="font-bold text-purple-800 mb-2">🔍 Validasi Role-Based Access</h4>
                        <p className="text-sm text-purple-700 mb-3">
                          <strong>Cek hak akses berdasarkan role user</strong>
                        </p>
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="bg-purple-200 p-3 rounded">
                            <strong>Admin/Leader - Akses Penuh:</strong>
                            <ul className="text-left mt-1 space-y-1">
                              <li>• ✓ Create jadwal baru</li>
                              <li>• ✓ Edit jadwal existing</li>
                              <li>• ✓ Delete jadwal</li>
                              <li>• ✓ Set status "Selesai"</li>
                              <li>• ✓ Approve semua aksi</li>
                            </ul>
                          </div>
                          <div className="bg-blue-200 p-3 rounded">
                            <strong>Staff - Akses Terbatas:</strong>
                            <ul className="text-left mt-1 space-y-1">
                              <li>• ✓ Create jadwal baru</li>
                              <li>• ✗ Edit jadwal existing</li>
                              <li>• ✗ Delete jadwal</li>
                              <li>• ✓ Update status "Proses" saja</li>
                              <li>• ✗ Set status "Selesai"</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Phase 3: Maintenance Execution - Enhanced */}
                  <div className="bg-white p-5 rounded-lg border border-red-200">
                    <h4 className="font-bold text-red-700 mb-4 flex items-center gap-2">
                      <span className="text-lg">🔧</span>
                      Fase 3: Pelaksanaan Pemeliharaan (Detail Step-by-Step)
                    </h4>
                    
                    {/* Role-Based Task Assignment */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
                      <h5 className="font-semibold text-red-800 mb-3">🔐 Validasi Role-Based Task Assignment</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-green-100 p-3 rounded border">
                          <div className="font-semibold text-green-800 mb-2">Admin/Leader Tasks</div>
                          <ul className="space-y-1 text-xs">
                            <li>• ✓ Receive notification tugas maintenance</li>
                            <li>• ✓ Assign teknisi spesifik</li>
                            <li>• ✓ Set prioritas dan deadline</li>
                            <li>• ✓ Monitor progress secara menyeluruh</li>
                            <li>• ✓ Approve status "Selesai"</li>
                            <li>• ✓ Set budget dan approve biaya</li>
                          </ul>
                        </div>
                        <div className="bg-blue-100 p-3 rounded border">
                          <div className="font-semibold text-blue-800 mb-2">Staff Tasks</div>
                          <ul className="space-y-1 text-xs">
                            <li>• ✓ Receive tugas dari Admin/Leader</li>
                            <li>• ✓ Update status ke "Proses"</li>
                            <li>• ✓ Execute maintenance work</li>
                            <li>• ✓ Document progress harian</li>
                            <li>• ✓ Update biaya actual (tanpa approve)</li>
                            <li>• ✗ Tidak bisa set status "Selesai"</li>
                          </ul>
                        </div>
                        <div className="bg-purple-100 p-3 rounded border">
                          <div className="font-semibold text-purple-800 mb-2">System Validation</div>
                          <ul className="space-y-1 text-xs">
                            <li>• Cek role authorization</li>
                            <li>• Validate access level</li>
                            <li>• Log semua aktivitas</li>
                            <li>• Real-time notification</li>
                            <li>• Auto-assignment berdasarkan expertise</li>
                            <li>• Audit trail compliance</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Execution Steps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">9</div>
                        <h5 className="font-semibold text-red-700 mb-2">Task Notification</h5>
                        <p className="text-xs text-muted-foreground mb-2">Teknisi terima notifikasi tugas</p>
                        <div className="bg-red-50 p-2 rounded text-xs text-left">
                          <strong>Validasi:</strong>
                          <ul className="mt-1 space-y-1">
                            <li>• Role check teknisi</li>
                            <li>• Skill match dengan aset</li>
                            <li>• Availability confirmation</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">10</div>
                        <h5 className="font-semibold text-red-700 mb-2">Status Update</h5>
                        <p className="text-xs text-muted-foreground mb-2">Update status ke "Proses"</p>
                        <div className="bg-red-50 p-2 rounded text-xs text-left">
                          <strong>Actions:</strong>
                          <ul className="mt-1 space-y-1">
                            <li>• Lock aset untuk operasi</li>
                            <li>• Start timer maintenance</li>
                            <li>• Notify supervisor</li>
                            <li>• Update asset status</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">11</div>
                        <h5 className="font-semibold text-red-700 mb-2">Execute Work</h5>
                        <p className="text-xs text-muted-foreground mb-2">Lakukan perbaikan/inspeksi</p>
                        <div className="bg-red-50 p-2 rounded text-xs text-left">
                          <strong>Steps:</strong>
                          <ul className="mt-1 space-y-1">
                            <li>• Pre-maintenance check</li>
                            <li>• Execute perbaikan</li>
                            <li>• Test functionality</li>
                            <li>• Quality assurance</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg">12</div>
                        <h5 className="font-semibold text-red-700 mb-2">Documentation</h5>
                        <p className="text-xs text-muted-foreground mb-2">Catat progress & biaya</p>
                        <div className="bg-red-50 p-2 rounded text-xs text-left">
                          <strong>Records:</strong>
                          <ul className="mt-1 space-y-1">
                            <li>• Progress percentage</li>
                            <li>• Parts used</li>
                            <li>• Actual cost</li>
                            <li>• Issues found</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Role-Based Progress Tracking */}
                    <div className="mt-6 bg-gray-50 p-4 rounded-lg border">
                      <h5 className="font-semibold text-gray-800 mb-3">📊 Progress Tracking Berdasarkan Role</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-blue-700 mb-2">Staff Progress Updates</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span>Update progress: 25%, 50%, 75%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span>Upload foto kondisi aset</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span>Catat masalah yang ditemukan</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                              <span>Request approval untuk biaya tambahan</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                          <div className="font-semibold text-green-700 mb-2">Admin/Leader Monitoring</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span>Monitor progress real-time</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span>Approve/reject biaya tambahan</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span>Intervensi jika ada masalah</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span>Set final approval untuk completion</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Sub-Phase 3A: Pre-Execution Validation */}
                  <div className="bg-yellow-50 p-5 rounded-lg border border-yellow-200">
                    <h4 className="font-bold text-yellow-800 mb-4 flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      Sub-Fase 3A: Validasi Pre-Eksekusi (Role-Based Authorization)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-white p-4 rounded border">
                        <h5 className="font-semibold text-green-700 mb-3">🔐 Admin/Leader Authorization</h5>
                        <ul className="space-y-2 text-xs">
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                            <span>Verify maintenance budget available</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                            <span>Assign qualified technician</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                            <span>Set maintenance window & priority</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                            <span>Approve work order execution</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                            <span>Enable access to spare parts inventory</span>
                          </li>
                        </ul>
                      </div>
                      <div className="bg-white p-4 rounded border">
                        <h5 className="font-semibold text-blue-700 mb-3">👨‍🔧 Staff Technician Preparation</h5>
                        <ul className="space-y-2 text-xs">
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                            <span>Receive and acknowledge work order</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                            <span>Check required tools and equipment</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                            <span>Review asset maintenance history</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                            <span>Prepare safety documentation</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1"></div>
                            <span>Request spare parts if needed</span>
                          </li>
                        </ul>
                      </div>
                      <div className="bg-white p-4 rounded border">
                        <h5 className="font-semibold text-purple-700 mb-3">🤖 System Validation</h5>
                        <ul className="space-y-2 text-xs">
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                            <span>Validate technician certification</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                            <span>Check asset availability for maintenance</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                            <span>Generate maintenance checklist</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                            <span>Set up progress tracking</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
                            <span>Initialize cost tracking module</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Sub-Phase 3B: Detailed Execution Workflow */}
                  <div className="bg-white p-5 rounded-lg border border-orange-200">
                    <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
                      <span className="text-lg">⚙️</span>
                      Sub-Fase 3B: Workflow Eksekusi Detail (Step-by-Step)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      {/* Step 13-15: Pre-Maintenance */}
                      <div className="bg-blue-50 p-4 rounded-lg border">
                        <h5 className="font-semibold text-blue-800 mb-3">📋 Pre-Maintenance (Steps 13-15)</h5>
                        <div className="space-y-3">
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">13</div>
                              <span className="font-semibold text-blue-700">Safety Protocol</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Lockout/Tagout procedure</li>
                              <li>• Verify power isolation</li>
                              <li>• Wear required PPE</li>
                              <li>• Safety briefing documentation</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">14</div>
                              <span className="font-semibold text-blue-700">Asset Assessment</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Initial condition check</li>
                              <li>• Photo documentation</li>
                              <li>• Functional test baseline</li>
                              <li>• Identify specific issues</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">15</div>
                              <span className="font-semibold text-blue-700">Resource Preparation</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Gather tools and equipment</li>
                              <li>• Retrieve spare parts</li>
                              <li>• Set up work area</li>
                              <li>• Update system status</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Step 16-18: Execution */}
                      <div className="bg-red-50 p-4 rounded-lg border">
                        <h5 className="font-semibold text-red-800 mb-3">🔧 Execution Phase (Steps 16-18)</h5>
                        <div className="space-y-3">
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">16</div>
                              <span className="font-semibold text-red-700">Execute Repair</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Follow maintenance manual</li>
                              <li>• Replace defective components</li>
                              <li>• Adjust and calibrate</li>
                              <li>• Real-time progress logging</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">17</div>
                              <span className="font-semibold text-red-700">Quality Check</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Visual inspection</li>
                              <li>• Functional testing</li>
                              <li>• Performance validation</li>
                              <li>• Safety compliance check</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">18</div>
                              <span className="font-semibold text-red-700">Documentation</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Update maintenance log</li>
                              <li>• Record parts used</li>
                              <li>• Document time spent</li>
                              <li>• Photo evidence upload</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Step 19-21: Post-Execution */}
                      <div className="bg-green-50 p-4 rounded-lg border">
                        <h5 className="font-semibold text-green-800 mb-3">✅ Post-Execution (Steps 19-21)</h5>
                        <div className="space-y-3">
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">19</div>
                              <span className="font-semibold text-green-700">Final Testing</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Full system operation test</li>
                              <li>• Performance benchmarking</li>
                              <li>• Safety system verification</li>
                              <li>• Calibration validation</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">20</div>
                              <span className="font-semibold text-green-700">Cost Calculation</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Calculate labor costs</li>
                              <li>• Parts and materials cost</li>
                              <li>• Overhead allocation</li>
                              <li>• Budget variance analysis</li>
                            </ul>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">21</div>
                              <span className="font-semibold text-green-700">Handover Process</span>
                            </div>
                            <ul className="text-xs space-y-1 ml-8">
                              <li>• Update asset status to "Available"</li>
                              <li>• Transfer to operations team</li>
                              <li>• Provide maintenance report</li>
                              <li>• Schedule next maintenance</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Decision Gate - Work Completion */}
                  <div className="flex justify-center">
                    <div className="text-center max-w-2xl">
                      <div className="text-3xl text-green-500 mb-3">⚖️</div>
                      <div className="bg-green-100 border-2 border-green-300 p-6 rounded-lg">
                        <h4 className="font-bold text-green-800 mb-3">🔍 Multi-Level Validasi Penyelesaian</h4>
                        <p className="text-sm text-green-700 mb-4">
                          <strong>Apakah maintenance memenuhi semua kriteria dan mendapat approval role-based?</strong>
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-green-200 p-3 rounded">
                            <strong>Technical Validation:</strong>
                            <ul className="text-left mt-2 space-y-1">
                              <li>• ✓ Functionality test passed</li>
                              <li>• ✓ All parts properly installed</li>
                              <li>• ✓ Safety systems operational</li>
                              <li>• ✓ Performance meets standards</li>
                              <li>• ✓ Calibration verified (medis)</li>
                              <li>• ✓ Documentation complete</li>
                            </ul>
                          </div>
                          <div className="bg-blue-200 p-3 rounded">
                            <strong>Role-Based Approval:</strong>
                            <ul className="text-left mt-2 space-y-1">
                              <li>• ✓ Staff: Work completion reported</li>
                              <li>• ✓ Admin/Leader: Quality review</li>
                              <li>• ✓ Admin/Leader: Cost approval</li>
                              <li>• ✓ Admin/Leader: Final sign-off</li>
                              <li>• ✓ System: Status update authorized</li>
                              <li>• ✓ Compliance: Audit trail logged</li>
                            </ul>
                          </div>
                          <div className="bg-purple-200 p-3 rounded">
                            <strong>Business Rules:</strong>
                            <ul className="text-left mt-2 space-y-1">
                              <li>• ✓ Budget within approved limit</li>
                              <li>• ✓ Timeline adherence verified</li>
                              <li>• ✓ Asset ready for operation</li>
                              <li>• ✓ Next maintenance scheduled</li>
                              <li>• ✓ Warranty compliance checked</li>
                              <li>• ✓ Regulatory requirements met</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Completion Phase */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-green-50 border-2 border-green-200 p-5 rounded-lg">
                      <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        Maintenance Berhasil Diselesaikan
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                          <div>
                            <div className="font-semibold text-green-700">Update Status "Selesai"</div>
                            <div className="text-xs text-green-600">Hanya Admin/Leader yang bisa set status ini</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                          <div>
                            <div className="font-semibold text-green-700">Update Asset Status</div>
                            <div className="text-xs text-green-600">Aset kembali "Tersedia" atau kondisi baru</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                          <div>
                            <div className="font-semibold text-green-700">Calculate Actual Cost</div>
                            <div className="text-xs text-green-600">Update biaya aktual vs estimasi</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                          <div>
                            <div className="font-semibold text-green-700">Schedule Next Maintenance</div>
                            <div className="text-xs text-green-600">Set tanggal maintenance berikutnya</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">5</div>
                          <div>
                            <div className="font-semibold text-green-700">Generate Report</div>
                            <div className="text-xs text-green-600">Buat laporan maintenance untuk audit</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-red-50 border-2 border-red-200 p-5 rounded-lg">
                      <h4 className="font-bold text-red-800 mb-4 flex items-center gap-2">
                        <span className="text-lg">❌</span>
                        Gagal/Need Review
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                          <div>
                            <div className="font-semibold text-red-700">Status "Tertunda"</div>
                            <div className="text-xs text-red-600">Maintenance perlu perbaikan/ulangan</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                          <div>
                            <div className="font-semibold text-red-700">Notify Supervisor</div>
                            <div className="text-xs text-red-600">Alert ke Admin/Leader untuk review</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                          <div>
                            <div className="font-semibold text-red-700">Asset Status Hold</div>
                            <div className="text-xs text-red-600">Aset tetap "Maintenance" sampai selesai</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                          <div>
                            <div className="font-semibold text-red-700">Root Cause Analysis</div>
                            <div className="text-xs text-red-600">Analisis penyebab kegagalan</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Flow & Lifecycle */}
                  <div className="bg-gray-100 p-4 rounded-lg border">
                    <h4 className="font-bold mb-3 text-gray-700">🔄 Alur Status & Lifecycle Maintenance</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-semibold mb-2 text-gray-700">Status Transitions:</h5>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-medium border border-orange-200">
                            Tertunda
                          </div>
                          <div className="text-gray-400">→</div>
                          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium border border-blue-200">
                            Proses
                          </div>
                          <div className="text-gray-400">→</div>
                          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium border border-green-200">
                            Selesai
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-semibold mb-2 text-gray-700">Asset Status:</h5>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium border border-green-200">
                            Tersedia
                          </div>
                          <div className="text-gray-400">→</div>
                          <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-medium border border-red-200">
                            Maintenance
                          </div>
                          <div className="text-gray-400">→</div>
                          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium border border-green-200">
                            Tersedia
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Process Summary */}
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <h4 className="font-bold mb-3 text-gray-700">📊 Ringkasan Proses & Validasi</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="bg-orange-50 p-3 rounded border">
                        <div className="font-semibold text-orange-600 mb-2">Input Validation</div>
                        <ul className="space-y-1">
                          <li>• Asset ID valid & exists</li>
                          <li>• Tanggal jatuh tempo  today</li>
                          <li>• Technician name required</li>
                          <li>• Type maintenance sesuai aset</li>
                        </ul>
                      </div>
                      <div className="bg-red-50 p-3 rounded border">
                        <div className="font-semibold text-red-600 mb-2">Role-Based Rules</div>
                        <ul className="space-y-1">
                          <li>• Staff: Create + Update "Proses"</li>
                          <li>• Admin/Leader: Full access</li>
                          <li>• Only Admin/Leader: Set "Selesai"</li>
                          <li>• Edit/delete: Admin/Leader only</li>
                        </ul>
                      </div>
                      <div className="bg-green-50 p-3 rounded border">
                        <div className="font-semibold text-green-600 mb-2">System Actions</div>
                        <ul className="space-y-1">
                          <li>• LocalStorage "maintenance" update</li>
                          <li>• Asset status real-time sync</li>
                          <li>• Audit trail semua perubahan</li>
                          <li>• Auto-notification system</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* ERD Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Entity Relationship Diagram (ERD)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Hubungan antar tabel dalam database sistem
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="space-y-8">
                  {/* Entitas Utama */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-4 rounded border">
                      <h4 className="font-semibold mb-3 text-teal-700">USER</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">id</span>
                          <span className="text-muted-foreground">PK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>nip</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>name</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>email</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>role</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded border">

<h4 className="font-semibold mb-3 text-blue-700">NON_MEDICAL_ASSET</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">id</span>
                          <span className="text-muted-foreground">PK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>roomId</span>
                          <span className="text-muted-foreground">FK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>name</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>serialNum</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>condition</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>status</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded border">
                      <h4 className="font-semibold mb-3 text-green-700">MEDICAL_ASSET</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">id</span>
                          <span className="text-muted-foreground">PK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>roomId</span>
                          <span className="text-muted-foreground">FK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>name</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>serialNum</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>condition</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>status</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Entitas Transaction */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded border">
                      <h4 className="font-semibold mb-3 text-purple-700">BORROWING</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">id</span>
                          <span className="text-muted-foreground">PK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>assetId</span>
                          <span className="text-muted-foreground">FK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>assetName</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>borrowerName</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>borrowDate</span>
                          <span className="text-muted-foreground">Date</span>
                        </div>
                        <div className="flex justify-between">
                          <span>returnDate</span>
                          <span className="text-muted-foreground">Date</span>
                        </div>
                        <div className="flex justify-between">
                          <span>status</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded border">
                      <h4 className="font-semibold mb-3 text-orange-700">MAINTENANCE</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">id</span>
                          <span className="text-muted-foreground">PK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>userId</span>
                          <span className="text-muted-foreground">FK</span>
                        </div>
                        <div className="flex justify-between">
                          <span>assetName</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>description</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>dueDate</span>
                          <span className="text-muted-foreground">Date</span>
                        </div>
                        <div className="flex justify-between">
                          <span>status</span>
                          <span className="text-muted-foreground">string</span>
                        </div>
                        <div className="flex justify-between">
                          <span>cost</span>
                          <span className="text-muted-foreground">number</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Relasi */}
                  <div className="bg-blue-50 p-4 rounded border">
                    <h4 className="font-semibold mb-3 text-blue-800">Hubungan antar Entitas</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-blue-700">One-to-Many:</div>
                        <ul className="space-y-1 ml-2">
                          <li>• User → Borrowing (1:N)</li>

<li>• User → Maintenance (1:N)</li>
                          <li>• NonMedicalRoom → NonMedicalAsset (1:N)</li>
                          <li>• MedicalRoom → MedicalAsset (1:N)</li>
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-blue-700">Foreign Keys:</div>
                        <ul className="space-y-1 ml-2">
                          <li>• Borrowing.assetId → Asset.id</li>
                          <li>• Borrowing.userId → User.id</li>
                          <li>• Maintenance.userId → User.id</li>
                          <li>• Asset.roomId → Room.id</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sequence Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Sequence Diagram - Proses Login</CardTitle>
              <p className="text-sm text-muted-foreground">
                Interaksi antar komponen saat pengguna melakukan login
              </p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="bg-teal-600 text-white p-3 rounded-t-lg font-semibold">User</div>
                      <div className="bg-white p-3 rounded-b-lg min-h-50">
                        <div className="text-xs space-y-2">
                          <div className="text-teal-600 font-medium">1. Buka halaman login</div>
                          <div className="text-teal-600 font-medium">2. Input email & password</div>
                          <div className="text-teal-600 font-medium">9. Redirect ke dashboard</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="bg-blue-600 text-white p-3 rounded-t-lg font-semibold">LoginPage</div>
                      <div className="bg-white p-3 rounded-b-lg min-h-50">
                        <div className="text-xs space-y-2">
                          <div className="text-blue-600 font-medium">3. panggil login()</div>
                          <div className="text-blue-600 font-medium">8. Return hasil</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="bg-purple-600 text-white p-3 rounded-t-lg font-semibold">AuthUtils</div>
                      <div className="bg-white p-3 rounded-b-lg min-h-50">
                        <div className="text-xs space-y-2">
                          <div className="text-purple-600 font-medium">4. getItem("users")</div>
                          <div className="text-purple-600 font-medium">5. Return users[]</div>
                          <div className="text-purple-600 font-medium">6. Validasi credentials</div>
                          <div className="text-purple-600 font-medium">7. setItem("currentUser")</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="bg-green-600 text-white p-3 rounded-t-lg font-semibold">LocalStorage</div>
                      <div className="bg-white p-3 rounded-b-lg min-h-50">
                        <div className="text-xs space-y-2">
                          <div className="text-green-600 font-medium">Simpan data user</div>
                          <div className="text-green-600 font-medium">Ambil data users</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flow Description */}
                  <div className="bg-white p-4 rounded border">
                    <h4 className="font-semibold mb-3">Alur Proses Login</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-teal-600 mb-2">Input & Validasi</div>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• User input email & password</li>
                          <li>• LoginPage panggil AuthUtils.login()</li>
                          <li>• Validasi terhadap data di LocalStorage</li>
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-blue-600 mb-2">Autentikasi</div>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Cek credentials di database local</li>
                          <li>• Set current user di LocalStorage</li>
                          <li>• Return hasil autentikasi</li>
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium text-green-600 mb-2">Redirect</div>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Jika sukses: redirect ke dashboard</li>
                          <li>• Jika gagal: tampilkan error</li>
                          <li>• Update UI sesuai status login</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)
          </p>
        </div>
      </div>
    </div>
  )
}
