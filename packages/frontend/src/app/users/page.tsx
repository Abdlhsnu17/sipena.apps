"use client"


import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirm } from "@/hooks/use-confirm"
import { getCurrentUser } from "@/services/auth-utils"
import type { User as ApiUser } from "@/services/user.service"
import { userService } from "@/services/user.service"
import type { User as AuthUser, StaffAccessType } from "@/types/auth-types"
import { normalizeUserRole } from "@/utils/role"

import { AlertCircle, Check, Edit, Plus, Trash2, Users } from "lucide-react"
import { useEffect, useState } from "react"

export default function UsersPage() {
  type ManagedRole = "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | "user"

  const [users, setUsers] = useState<ApiUser[]>([])
  const { confirm } = useConfirm()
  const [currentUser] = useState<AuthUser | null>(getCurrentUser())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [formData, setFormData] = useState({
    nip: "",
    name: "",
    email: "",
    role: "staff" as ManagedRole,
    staffAccessType: "all" as StaffAccessType,
    password: "",
  })
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")

  const isAdmin = currentUser?.role === "admin"
  const isLeader = currentUser?.role === "leader"
  const canViewUsers = isAdmin || isLeader
  const canCreateUsers = isAdmin || isLeader
  const canDeleteUsers = isAdmin
  const canEditAdminUsers = isAdmin
  const editableRoles = (isLeader ? ["user", "staff", "staff_pj", "teknisi"] : ["user", "admin", "leader", "staff", "staff_pj", "teknisi"]) as ManagedRole[]

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await userService.getAll({ page: 1, limit: 1000 })
      if (response.success) {
        setUsers(response.data as ApiUser[])
      }
    } catch (error) {
      console.error("Failed to load users:", error)
    }
  }

  const handleAddUser = () => {
    if (!canCreateUsers) return
    setEditingId(null)
    setFormData({ nip: "", name: "", email: "", role: "user", staffAccessType: "all", password: "" })
    setIsFormOpen(true)
  }

  const handleEdit = (user: ApiUser) => {
    if (!canViewUsers) return
    if (!canEditAdminUsers && normalizeUserRole(user.role) === "admin") {
      setMessage("Leader tidak dapat mengubah pengguna admin")
      setMessageType("error")
      return
    }
    setEditingId(user.id)
    setFormData({
      nip: user.nip,
      name: user.name,
      email: user.email,
      role: user.role,
      staffAccessType: user.staffAccessType || "all",
      password: "",
    })
    setIsFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")

    if (!formData.nip || !formData.name || !formData.email || !formData.role) {
      setMessage("Semua field harus diisi")
      setMessageType("error")
      return
    }

    try {
      if (editingId) {
        const updateData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          staffAccessType:
            formData.role === "staff" || formData.role === "staff_pj" ? formData.staffAccessType : undefined,
        }
        const result = await userService.update(editingId, updateData)
        setMessageType(result.success ? "success" : "error")
        setMessage(result.message)
        if (result.success) {
          setTimeout(() => {
            setIsFormOpen(false)
            loadUsers()
            setMessage("")
          }, 1500)
        }
      } else {
        if (!formData.password) {
          setMessage("Password harus diisi untuk pengguna baru")
          setMessageType("error")
          return
        }
        const result = await userService.create({
          nip: formData.nip,
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          staffAccessType:
            formData.role === "staff" || formData.role === "staff_pj" ? formData.staffAccessType : undefined,
        })
        setMessageType(result.success ? "success" : "error")
        setMessage(result.message)
        if (result.success) {
          setTimeout(() => {
            setIsFormOpen(false)
            loadUsers()
            setMessage("")
          }, 1500)
        }
      }
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal menyimpan pengguna")
    }
  }

  const handleDelete = async (userId: string | number) => {
    if (!canDeleteUsers) {
      setMessage("Anda tidak memiliki izin untuk menghapus pengguna")
      setMessageType("error")
      return
    }
    if (String(userId) === String(currentUser?.id)) {
      setMessage("Tidak bisa menghapus akun sendiri")
      setMessageType("error")
      return
    }

    const isConfirmed = await confirm({
      title: "Hapus pengguna",
      description: "Yakin ingin menghapus pengguna ini?",
      confirmText: "Ya, hapus",
      destructive: true,
    })
    if (!isConfirmed) return

    try {
      const result = await userService.delete(userId)
      setMessageType(result.success ? "success" : "error")
      setMessage(result.message)
      loadUsers()
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal menghapus pengguna")
    }
  }

  const handleDeleteAllUsers = async () => {
    if (!currentUser) return

    const isConfirmed = await confirm({
      title: "Hapus semua pengguna",
      description: "Hapus semua pengguna kecuali Anda?",
      confirmText: "Ya, hapus semua",
      destructive: true,
    })
    if (!isConfirmed) return

    const deletions = users
      .filter((user) => String(user.id) !== String(currentUser.id))
      .map((user) => userService.delete(user.id))

    Promise.all(deletions)
      .then(() => {
        setMessage("Pengguna berhasil dihapus")
        setMessageType("success")
        loadUsers()
      })
      .catch((error: any) => {
        setMessageType("error")
        setMessage(error.message || "Gagal menghapus semua pengguna")
      })
  }

  const getAccessTypeLabel = (type?: StaffAccessType) => {
    switch (type) {
      case "medis":
        return "Inventaris Medis"
      case "non-medis":
        return "Inventaris Non-Medis"
      default:
        return "Semua Inventaris"
    }
  }

  const getAccessLabelByRole = (role?: string, staffAccessType?: StaffAccessType) => {
    const normalizedRole = normalizeUserRole(role)

    if (normalizedRole === "staff" || normalizedRole === "staff_pj") {
      return getAccessTypeLabel(staffAccessType)
    }

    if (normalizedRole === "teknisi") {
      return "Dashboard & Pemeliharaan"
    }

    if (normalizedRole === "user") {
      return "Self Service"
    }

    return "Full Access"
  }

  const getAccessDescriptionByRole = (role?: string, staffAccessType?: StaffAccessType) => {
    const normalizedRole = normalizeUserRole(role)

    if (normalizedRole === "admin") {
      return "Akses penuh semua modul dan manajemen pengguna"
    }

    if (normalizedRole === "leader") {
      return "Akses penuh modul operasional dan pengawasan"
    }

    if (normalizedRole === "staff_pj") {
      return `Staff PJ dengan cakupan ${getAccessTypeLabel(staffAccessType).toLowerCase()}`
    }

    if (normalizedRole === "staff") {
      return `Staff Pelayanan dengan cakupan ${getAccessTypeLabel(staffAccessType).toLowerCase()}`
    }

    if (normalizedRole === "teknisi") {
      return "Akses teknisi untuk pekerjaan pemeliharaan"
    }

    return "Akses mandiri untuk alur pinjam/kembali dan lihat inventaris"
  }

  const getRoleLabel = (role?: string) => {
    switch (normalizeUserRole(role)) {
      case "admin":
        return "Admin"
      case "leader":
        return "Leader"
      case "staff_pj":
        return "Staff PJ"
      case "teknisi":
        return "Teknisi"
      case "user":
        return "Pengguna"
      default:
        return "Staff Pelayanan"
    }
  }

  const getRoleBadgeClass = (role?: string) => {
    switch (normalizeUserRole(role)) {
      case "admin":
        return "bg-teal-100 text-teal-700"
      case "leader":
        return "bg-purple-100 text-purple-700"
      case "staff_pj":
        return "bg-indigo-100 text-indigo-700"
      case "teknisi":
        return "bg-amber-100 text-amber-700"
      case "user":
        return "bg-slate-100 text-slate-700"
      default:
        return "bg-blue-100 text-blue-700"
    }
  }

  if (!currentUser || !canViewUsers) {
    return (
      <div className="bg-linear-to-br from-slate-50 via-white to-teal-50/30">
        <div className="max-w-4xl mx-auto p-6 space-y-4">

          <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-semibold text-red-700">Akses Ditolak</h2>
            </div>
            <p className="text-sm text-red-600">Anda tidak memiliki peran yang diizinkan untuk halaman ini.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-linear-to-br from-slate-50 via-white to-teal-50/30">
      <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-linear-to-br from-teal-500 to-cyan-500 p-3 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-foreground">Manajemen Pengguna</h1>
                    <p className="text-sm text-muted-foreground">
                      Pengaturan akun, akses role, dan kontrol perubahan data pengguna.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full bg-teal-50 text-teal-700 border-teal-200">
                    Akses admin
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                    Audit pengguna
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {canCreateUsers && (
                  <Button onClick={handleAddUser} size="sm" className="rounded-2xl bg-teal-600 text-white hover:bg-teal-700">
                    <Plus className="mr-1 h-4 w-4" />
                    Tambah Pengguna
                  </Button>
                )}
                {currentUser?.role === "admin" && (
                  <Button variant="destructive" size="sm" className="rounded-2xl" onClick={handleDeleteAllUsers}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Hapus Semua
                  </Button>
                )}
              </div>
            </div>
          </section>

          <div className="rounded-2xl border border-teal-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-teal-900/50 dark:bg-slate-900/50">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-teal-700/90 dark:text-teal-200/90">
                Dashboard ini menampilkan alur pengelolaan pengguna yang mengikuti kaidah mulai dari otentikasi hingga pemberian akses untuk inventaris medis dan non-medis.
              </p>
              <p className="text-xs text-muted-foreground">
                Setiap perubahan pengguna perlu tercatat agar kontrol akses tetap konsisten.
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-2xl mb-4 text-sm ${
              messageType === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}
          >
            {messageType === "success" ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span className={messageType === "success" ? "text-green-600" : "text-red-600"}>{message}</span>
          </div>
        )}

        {/* Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-bold text-foreground mb-4">
                {editingId ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">NIP (8-20 digit)</label>
                <Input
                  type="text"
                  placeholder="Nomor Induk Pegawai"
                  value={formData.nip}
                  onChange={(e) => setFormData({ ...formData, nip: e.target.value.replace(/\D/g, "").slice(0, 20) })}
                  maxLength={20}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Nama</label>
                <Input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <Input
                  type="email"
                  placeholder="email@hospital.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as ManagedRole })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm"
                >
                  {editableRoles.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.role === "staff" || formData.role === "staff_pj") && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Akses Peminjaman</label>
                  <select
                    value={formData.staffAccessType}
                    onChange={(e) => setFormData({ ...formData, staffAccessType: e.target.value as StaffAccessType })}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm"
                  >
                    <option value="all">Semua Inventaris</option>
                    <option value="medis">Inventaris Medis Saja</option>
                    <option value="non-medis">Inventaris Non-Medis Saja</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Menentukan inventaris yang dapat dipinjam oleh staff
                  </p>
                </div>
              )}

              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <Input
                    type="password"
                    placeholder="Masukkan password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-sm"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <Button type="button" onClick={() => setIsFormOpen(false)} variant="outline" className="flex-1">
                  Batal
                </Button>
                <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                  {editingId ? "Update" : "Tambah"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

        {/* Users Management Table */}
        <div className="bg-white/90 rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="border-b border-border/70 bg-slate-50/70 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Keterangan akses: <span className="font-medium text-foreground">Full Access</span> (Admin/Leader), <span className="font-medium text-foreground">Self Service</span> (Pengguna), <span className="font-medium text-foreground">Dashboard & Pemeliharaan</span> (Teknisi), dan Staff mengikuti cakupan inventaris.
              </p>
            </div>
          <div className="mobile-table-scroll">
            <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">NIP</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Nama</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Akses</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Terdaftar</th>
                <th className="px-4 py-3 text-center font-medium text-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-foreground font-mono text-xs">{user.nip}</td>
                  <td className="px-4 py-3 text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                      <span
                        className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                        title={getAccessDescriptionByRole(user.role, user.staffAccessType)}
                      >
                        {getAccessLabelByRole(user.role, user.staffAccessType)}
                      </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("id-ID")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      {canViewUsers && (!isLeader || normalizeUserRole(user.role) !== "admin") && (
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors text-teal-600"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteUsers && user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1.5 hover:bg-muted rounded-lg transition-colors text-red-600"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-sm">Tidak ada pengguna terdaftar</p>
          </div>
        )}
      </div>

        {/* Information Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-teal-100/80 bg-white/70 p-6 shadow">
            <h3 className="text-lg font-semibold text-teal-800 mb-3">ℹ️ Cara Kerja Sistem</h3>
            <ul className="text-sm text-teal-700 space-y-2">
              <li>• Admin memetakan peran dan akses ke dalam diagram UML.</li>
              <li>• Pengguna dicatat sebagai role self-service untuk alur pinjam dan kembali aset.</li>
              <li>• Staff diberi akses khusus sesuai alur peminjaman medis atau non-medis.</li>
              <li>• Leader membantu validasi sesuai use case diagram.</li>
              <li>• Data pengguna selalu terupdate agar dokumentasi sinkron.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-orange-100/80 bg-white/80 p-6 shadow">
            <h3 className="text-lg font-semibold text-orange-800 mb-3">⚠️ Catatan Penting</h3>
            <ul className="text-sm text-orange-700 space-y-2">
              <li>• Gunakan NIP valid agar diagram referensi mudah ditelusuri.</li>
              <li>• Hindari akun berbagi agar audit trail jelas.</li>
              <li>• Hapus pengguna tidak aktif sesuai proses UML.</li>
              <li>• Update peran staff ketika batas akses berubah.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
