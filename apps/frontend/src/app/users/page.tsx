"use client"


import type React from "react";

import { Button } from "@/components/ui/button";
import DeleteReasonDialog from "@/components/delete-reason-dialog";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/hooks/use-confirm";
import accessControlService, { type AccessMatrix } from "@/services/access-control.service";
import { getCurrentUser } from "@/services/auth-utils";
import deletionRequestService from "@/services/deletion-request.service";
import type { User as ApiUser } from "@/services/user.service";
import { userService } from "@/services/user.service";
import type { AccountStatus, User as AuthUser, StaffAccessType } from "@/types/auth-types";
import { isAdminRole, normalizeUserRole } from "@/utils/role";
import { isStrongPassword } from "@/utils/validation";

import { AlertCircle, CalendarCheck2, Check, Edit, Eye, KeyRound, Mail, MapPin, Phone, Plus, Save, Shield, Smartphone, Trash2, Users } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

export default function UsersPage() {
  type ManagedRole = "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | "user"

  const [users, setUsers] = useState<ApiUser[]>([])
  const { confirm } = useConfirm()
  const [currentUser] = useState<AuthUser | null>(getCurrentUser())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<ApiUser | null>(null)
  const [pendingDeleteUser, setPendingDeleteUser] = useState<ApiUser | null>(null)
  const [pendingArchiveUserRequest, setPendingArchiveUserRequest] = useState<ApiUser | null>(null)
  const [isDeleteAllUsersOpen, setIsDeleteAllUsersOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState("")
  const [isDeletingUser, setIsDeletingUser] = useState(false)
  const [resetPassword, setResetPassword] = useState("")
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [formData, setFormData] = useState({
    nip: "",
    name: "",
    email: "",
    phoneNumber: "",
    gender: "",
    workUnit: "",
    subWorkUnit: "",
    homeAddress: "",
    role: "staff" as ManagedRole,
    staffAccessType: "all" as StaffAccessType,
    accountStatus: "active" as AccountStatus,
    mustChangePassword: true,
    password: "",
  })
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [activeTab, setActiveTab] = useState<"users" | "access">("users")
  const [accessMatrix, setAccessMatrix] = useState<AccessMatrix | null>(null)
  const [selectedRoleCode, setSelectedRoleCode] = useState("admin")
  const [selectedMenuCodes, setSelectedMenuCodes] = useState<string[]>([])
  const [isSavingAccess, setIsSavingAccess] = useState(false)
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string | number>>(() => new Set())

  const toggleUserExpand = (id: string | number) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isAdmin = isAdminRole(currentUser?.role)
  const isLeader = normalizeUserRole(currentUser?.role) === "leader"
  const canViewUsers = isAdmin || isLeader
  const canCreateUsers = isAdmin || isLeader
  const canDeleteUsers = isAdmin
  const editableRoles = (isLeader ? ["user", "staff", "staff_pj", "teknisi", "leader"] : ["user", "admin", "leader", "staff", "staff_pj", "teknisi"]) as ManagedRole[]
  const sortedAccessMenus = [...(accessMatrix?.menus || [])].sort((a, b) => a.label.localeCompare(b.label, "id"))
  const getValidMenuCodesForRole = (_roleCode: string, matrix: AccessMatrix | null = accessMatrix) => {
    return new Set((matrix?.menus || []).map((menu) => menu.code))
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadAccessMatrix()
    }
  }, [isAdmin])

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

  const loadAccessMatrix = async () => {
    try {
      const response = await accessControlService.getMatrix()
      if (response.success) {
        setAccessMatrix(response.data)
        const roleCode = selectedRoleCode || response.data.roles[0]?.code || "admin"
        const validMenuCodes = getValidMenuCodesForRole(roleCode, response.data)
        setSelectedRoleCode(roleCode)
        setSelectedMenuCodes((response.data.permissions[roleCode] || []).filter((code) => validMenuCodes.has(code)))
      }
    } catch (error) {
      console.error("Failed to load access matrix:", error)
    }
  }

  const handleSelectRoleAccess = (roleCode: string) => {
    const validMenuCodes = getValidMenuCodesForRole(roleCode)
    setSelectedRoleCode(roleCode)
    setSelectedMenuCodes((accessMatrix?.permissions[roleCode] || []).filter((code) => validMenuCodes.has(code)))
  }

  const toggleMenuAccess = (menuCode: string) => {
    const menu = accessMatrix?.menus.find((item) => item.code === menuCode)
    if (!menu) return

    setSelectedMenuCodes((current) =>
      current.includes(menuCode)
        ? current.filter((code) => code !== menuCode)
        : [...current, menuCode],
    )
  }

  const saveRoleAccess = async () => {
    if (!selectedRoleCode) return
    setIsSavingAccess(true)
    try {
      const validMenuCodes = getValidMenuCodesForRole(selectedRoleCode)
      const menuCodes = selectedMenuCodes.filter((code) => validMenuCodes.has(code))
      const result = await accessControlService.updateRoleMenus(selectedRoleCode, menuCodes)
      setMessageType(result.success ? "success" : "error")
      setMessage(result.message)
      if (result.success) {
        await loadAccessMatrix()
      }
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal menyimpan hak akses")
    } finally {
      setIsSavingAccess(false)
    }
  }

  const handleAddUser = () => {
    if (!canCreateUsers) return
    setEditingId(null)
    setFormData({
      nip: "",
      name: "",
      email: "",
      phoneNumber: "",
      gender: "",
      workUnit: "",
      subWorkUnit: "",
      homeAddress: "",
      role: "user",
      staffAccessType: "all",
      accountStatus: "active",
      mustChangePassword: true,
      password: "",
    })
    setIsFormOpen(true)
  }

  const handleEdit = (user: ApiUser) => {
    if (!canViewUsers) return
    setEditingId(user.id)
    setFormData({
      nip: user.nip,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      gender: user.gender || "",
      workUnit: user.workUnit || "",
      subWorkUnit: user.subWorkUnit || "",
      homeAddress: user.homeAddress || "",
      role: user.role,
      staffAccessType: user.staffAccessType || "all",
      accountStatus: user.accountStatus || "active",
      mustChangePassword: Boolean(user.mustChangePassword),
      password: "",
    })
    setIsFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")

    if (!formData.nip || !formData.name || !formData.email || !formData.phoneNumber || !formData.role) {
      setMessage("Semua field harus diisi")
      setMessageType("error")
      return
    }

    if (formData.nip.length < 8 || formData.nip.length > 20) {
      setMessage("NIP harus 8 sampai 20 digit")
      setMessageType("error")
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setMessage("Format email tidak valid")
      setMessageType("error")
      return
    }

    if (!/^\+?\d{10,25}$/.test(formData.phoneNumber)) {
      setMessage("Nomor WhatsApp / SMS harus 10 sampai 25 digit")
      setMessageType("error")
      return
    }

    if (formData.workUnit.length > 255 || formData.subWorkUnit.length > 255 || formData.homeAddress.length > 500) {
      setMessage("Unit kerja maksimal 255 karakter dan alamat maksimal 500 karakter")
      setMessageType("error")
      return
    }

    try {
      if (editingId) {
        const updateData = {
          name: formData.name,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          gender: formData.gender || undefined,
          workUnit: formData.workUnit || undefined,
          subWorkUnit: formData.subWorkUnit || undefined,
          homeAddress: formData.homeAddress || undefined,
          role: formData.role,
          staffAccessType:
            formData.role === "staff" || formData.role === "staff_pj" ? formData.staffAccessType : undefined,
          accountStatus: formData.accountStatus,
          mustChangePassword: formData.mustChangePassword,
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
        if (!isStrongPassword(formData.password)) {
          setMessage("Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, dan angka")
          setMessageType("error")
          return
        }
        const result = await userService.create({
          nip: formData.nip,
          name: formData.name,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          gender: formData.gender || undefined,
          workUnit: formData.workUnit || undefined,
          subWorkUnit: formData.subWorkUnit || undefined,
          homeAddress: formData.homeAddress || undefined,
          password: formData.password,
          role: formData.role,
          staffAccessType:
            formData.role === "staff" || formData.role === "staff_pj" ? formData.staffAccessType : undefined,
          accountStatus: formData.accountStatus,
          mustChangePassword: formData.mustChangePassword,
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

    const target = users.find((user) => String(user.id) === String(userId)) || null
    setPendingDeleteUser(target)
    setDeleteReason("")
  }

  const handleRequestDelete = (user: ApiUser) => {
    setPendingArchiveUserRequest(user)
    setDeleteReason("")
  }

  const confirmRequestDeleteUser = async () => {
    if (!pendingArchiveUserRequest) return
    const reason = deleteReason.trim()
    if (!reason) {
      setMessageType("error")
      setMessage("Alasan penghapusan wajib diisi")
      return
    }

    setIsDeletingUser(true)
    try {
      const result = await deletionRequestService.create({
        targetType: "user",
        targetId: Number(pendingArchiveUserRequest.id),
        targetLabel: `${pendingArchiveUserRequest.name} (${pendingArchiveUserRequest.nip})`,
        reason,
      })
      setMessageType(result.success ? "success" : "error")
      setMessage(result.message || "Permintaan penghapusan pengguna diajukan")
      setPendingArchiveUserRequest(null)
      setDeleteReason("")
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal mengajukan penghapusan pengguna")
    } finally {
      setIsDeletingUser(false)
    }
  }

  const confirmDeleteUser = async () => {
    if (!pendingDeleteUser) return
    const reason = deleteReason.trim()
    if (!reason) {
      setMessageType("error")
      setMessage("Alasan penghapusan wajib diisi")
      return
    }

    setIsDeletingUser(true)
    try {
      const result = await userService.delete(pendingDeleteUser.id, reason)
      setMessageType(result.success ? "success" : "error")
      setMessage(result.message)
      setPendingDeleteUser(null)
      setDeleteReason("")
      loadUsers()
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal menghapus pengguna")
    } finally {
      setIsDeletingUser(false)
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
    setIsDeleteAllUsersOpen(true)
    setDeleteReason("")
  }

  const confirmDeleteAllUsers = async () => {
    if (!currentUser) return
    const reason = deleteReason.trim()
    if (!reason) {
      setMessage("Alasan penghapusan wajib diisi")
      setMessageType("error")
      return
    }

    setIsDeletingUser(true)
    const deletions = users
      .filter((user) => String(user.id) !== String(currentUser.id))
      .map((user) => userService.delete(user.id, reason))

    Promise.all(deletions)
      .then(() => {
        setMessage("Pengguna berhasil dihapus")
        setMessageType("success")
        setIsDeleteAllUsersOpen(false)
        setDeleteReason("")
        loadUsers()
      })
      .catch((error: any) => {
        setMessageType("error")
        setMessage(error.message || "Gagal menghapus semua pengguna")
      })
      .finally(() => setIsDeletingUser(false))
  }

  const openResetPassword = (user: ApiUser) => {
    if (isLeader && ["admin", "leader"].includes(normalizeUserRole(user.role))) {
      setMessage("Leader tidak dapat reset password admin atau leader")
      setMessageType("error")
      return
    }
    setResetTarget(user)
    setResetPassword("")
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return

    if (!isStrongPassword(resetPassword)) {
      setMessage("Password baru minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, dan angka")
      setMessageType("error")
      return
    }

    setIsResettingPassword(true)
    try {
      const result = await userService.resetPassword(resetTarget.id, resetPassword)
      setMessageType(result.success ? "success" : "error")
      setMessage(result.message)
      if (result.success) {
        setResetTarget(null)
        setResetPassword("")
        loadUsers()
      }
    } catch (error: any) {
      setMessageType("error")
      setMessage(error.message || "Gagal reset password pengguna")
    } finally {
      setIsResettingPassword(false)
    }
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

  const getAccessBadgeClass = (role?: string, staffAccessType?: StaffAccessType) => {
    const normalizedRole = normalizeUserRole(role)
    if (normalizedRole === "admin" || normalizedRole === "leader") {
      return "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-400/10 dark:text-teal-300 dark:border-teal-400/30"
    }
    if (normalizedRole === "teknisi") {
      return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30"
    }
    if (normalizedRole === "user") {
      return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/30"
    }
    if (staffAccessType === "medis") {
      return "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/30"
    }
    if (staffAccessType === "non-medis") {
      return "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-400/10 dark:text-orange-300 dark:border-orange-400/30"
    }
    return "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-400/10 dark:text-indigo-300 dark:border-indigo-400/30"
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
        return "bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
      case "leader":
        return "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-300"
      case "staff_pj":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300"
      case "teknisi":
        return "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
      case "user":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
    }
  }

  const getAccountStatusLabel = (status?: AccountStatus) => {
    switch (status) {
      case "inactive":
        return "Nonaktif"
      case "suspended":
        return "Ditangguhkan"
      default:
        return "Aktif"
    }
  }

  const getAccountStatusBadgeClass = (status?: AccountStatus) => {
    switch (status) {
      case "inactive":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
      case "suspended":
        return "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300"
      default:
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
    }
  }

  if (!currentUser || !canViewUsers) {
    return (
      <div>
        <div className="w-full space-y-4">

          <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl dark:bg-red-400/10 dark:border-red-400/30">
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
    <div>
      <div className="w-full space-y-6">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/35 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div className="flex items-start gap-3 sm:items-center">
                  <div className="rounded-2xl bg-linear-to-br from-teal-500 to-teal-700 p-2.5 shadow-lg">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-[18px] font-bold text-foreground">Manajemen Pengguna</h1>
                  </div>
                </div>

              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                {canCreateUsers && (
                  <Button onClick={handleAddUser} size="sm" className="w-full rounded-2xl bg-teal-600 text-white hover:bg-teal-700 sm:w-auto">
                    <Plus className="mr-1 h-4 w-4" />
                    Tambah Pengguna
                  </Button>
                )}
                {isAdmin && (
                  <Button variant="destructive" size="sm" className="w-full rounded-2xl sm:w-auto" onClick={handleDeleteAllUsers}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Hapus Semua
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Dashboard info card removed to avoid confusion */}
        </div>

        {/* Message */}
        {message && (
          <div
            className={`flex items-center gap-2 p-3 rounded-2xl mb-4 text-sm ${
              messageType === "success" ? "bg-green-50 border border-green-200 dark:bg-emerald-400/10 dark:border-emerald-400/30" : "bg-red-50 border border-red-200 dark:bg-red-400/10 dark:border-red-400/30"
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

        <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-white/90 p-2 shadow-sm dark:bg-slate-900/60">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "users" ? "bg-teal-600 text-white" : "text-foreground hover:bg-muted"
            }`}
          >
            <Users className="h-4 w-4" />
            Data Pengguna
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("access")}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === "access" ? "bg-teal-600 text-white" : "text-foreground hover:bg-muted"
              }`}
            >
              <Shield className="h-4 w-4" />
              Hak Akses Role
            </button>
          )}
        </div>

        {/* Form Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="mx-4 max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto rounded-lg bg-card p-6 shadow-xl">
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
                <label className="block text-sm font-medium text-foreground mb-1">Nomor WhatsApp / SMS</label>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="+628xxxxxxxxxx"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/[^\d+]/g, "") })}
                    className="pl-10 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Jenis Kelamin</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="">Belum diisi</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Unit Kerja</label>
                <Input
                  type="text"
                  placeholder="Contoh: Instalasi Rawat Inap"
                  value={formData.workUnit}
                  onChange={(e) => setFormData({ ...formData, workUnit: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sub Unit Kerja</label>
                <Input
                  type="text"
                  placeholder="Contoh: Ruang Melati"
                  value={formData.subWorkUnit}
                  onChange={(e) => setFormData({ ...formData, subWorkUnit: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Alamat Rumah</label>
                <textarea
                  placeholder="Alamat pengguna"
                  value={formData.homeAddress}
                  onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status Akun</label>
                <select
                  value={formData.accountStatus}
                  onChange={(e) => setFormData({ ...formData, accountStatus: e.target.value as AccountStatus })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                  <option value="suspended">Ditangguhkan</option>
                </select>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.mustChangePassword}
                  onChange={(e) => setFormData({ ...formData, mustChangePassword: e.target.checked })}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-foreground">Wajib ganti password</span>
                  <span className="text-xs text-muted-foreground">Pengguna akan diarahkan ke Pengaturan sebelum memakai modul lain.</span>
                </span>
              </label>

              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Password</label>
                  <Input
                    type="password"
                    placeholder="Min. 8 karakter, huruf besar, kecil & angka"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-sm"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-3 sm:flex-row">
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

        {resetTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-card p-6 shadow-xl">
              <h2 className="mb-2 text-lg font-bold text-foreground">Reset Password</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Reset password untuk {resetTarget.name}. Pengguna akan wajib mengganti password saat login berikutnya.
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">Password Baru</label>
                <Input
                  type="password"
                  placeholder="Min. 8 karakter, huruf besar, kecil & angka"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setResetTarget(null)}>
                  Batal
                </Button>
                <Button type="button" className="flex-1 bg-teal-600 text-white hover:bg-teal-700" onClick={handleResetPassword} disabled={isResettingPassword}>
                  {isResettingPassword ? "Mereset..." : "Reset"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "access" && isAdmin && (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="rounded-2xl border border-border/60 bg-white/90 p-3 shadow-sm dark:bg-slate-900/60">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-teal-600" />
                <h2 className="text-sm font-bold text-foreground">Role</h2>
              </div>
              <div className="space-y-1">
                {(accessMatrix?.roles || []).map((role) => (
                  <button
                    key={role.code}
                    type="button"
                    onClick={() => handleSelectRoleAccess(role.code)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      selectedRoleCode === role.code ? "bg-teal-600 text-white" : "hover:bg-muted"
                    }`}
                  >
                    <span className="block font-semibold">{role.name}</span>
                    {role.description && (
                      <span className={`block text-xs ${selectedRoleCode === role.code ? "text-white/80" : "text-muted-foreground"}`}>
                        {role.description}
                      </span>
                    )}
                  </button>
                ))}
                {!accessMatrix && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Memuat role...</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/90 p-4 shadow-sm dark:bg-slate-900/60">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Menu yang Diizinkan</h2>
                  <p className="text-xs text-muted-foreground">Centang menu yang boleh tampil dan diakses oleh role terpilih.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveRoleAccess}
                  disabled={isSavingAccess || !accessMatrix}
                  className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                >
                  <Save className="mr-1 h-4 w-4" />
                  {isSavingAccess ? "Menyimpan..." : "Simpan Hak Akses"}
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {sortedAccessMenus.map((menu) => (
                  <label
                    key={menu.code}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMenuCodes.includes(menu.code)}
                      onChange={() => toggleMenuAccess(menu.code)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{menu.label}</span>
                    </span>
                  </label>
                ))}
              </div>

              {accessMatrix && accessMatrix.menus.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">Belum ada menu terdaftar.</p>
              )}
            </div>
          </div>
        )}

        {/* Users Management Cards */}
        {activeTab === "users" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-slate-50/80 px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 dark:bg-slate-900/40">
            <span className="text-xs text-muted-foreground">Keterangan akses:</span>
            <span className="inline-flex items-center gap-1 text-xs"><span className="inline-block w-2 h-2 rounded-full bg-teal-400" />Full Access (Admin/Leader)</span>
            <span className="inline-flex items-center gap-1 text-xs"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" />Self Service (Pengguna)</span>
            <span className="inline-flex items-center gap-1 text-xs"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />Dashboard &amp; Pemeliharaan (Teknisi)</span>
            <span className="inline-flex items-center gap-1 text-xs"><span className="inline-block w-2 h-2 rounded-full bg-indigo-400" />Cakupan Inventaris (Staff)</span>
          </div>

          <div className="mobile-table-scroll rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800/35 dark:bg-slate-900/60">
            <table className="w-full min-w-[1040px] table-fixed text-left text-sm leading-5">
              <colgroup>
                <col className="w-[29%]" />
                <col className="w-[18%]" />
                <col className="w-[22%]" />
                <col className="w-[27%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.04em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Pengguna</th>
                  <th className="px-4 py-3 font-semibold">Kontak</th>
                  <th className="px-4 py-3 font-semibold">Unit Kerja</th>
                  <th className="px-4 py-3 font-semibold">Status &amp; Akses</th>
                  <th className="px-2 py-3 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/35">
                {users.map((user) => {
                  const isExpanded = expandedUserIds.has(user.id)
                  const canEditThisUser = canViewUsers
                  const canResetThisUser =
                    canViewUsers && String(user.id) !== String(currentUser?.id) && (!isLeader || !["admin", "leader"].includes(normalizeUserRole(user.role)))
                  const canDeleteThisUser = canDeleteUsers && user.id !== currentUser?.id
                  const canRequestDeleteThisUser =
                    isLeader && String(user.id) !== String(currentUser?.id) && !["admin", "leader"].includes(normalizeUserRole(user.role))

                  return (
                    <Fragment key={user.id}>
                      <tr className="align-middle hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3.5">
                          <p className="truncate text-sm font-semibold leading-5 text-slate-900 dark:text-slate-100">{user.name}</p>
                          <div className="mt-1.5 flex flex-col items-start gap-1.5">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium leading-4 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                              NIP: {user.nip}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${getRoleBadgeClass(user.role)}`}>
                              {getRoleLabel(user.role)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                          {user.phoneNumber ? (
                            <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
                              <Phone className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" strokeWidth={1.75} aria-hidden="true" />
                              <span>{user.phoneNumber.replace(/^\+/, "")}</span>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          <p className="truncate text-sm font-medium leading-5">{user.workUnit || "-"}</p>
                          {user.subWorkUnit && <p className="mt-0.5 truncate text-xs leading-4 text-slate-400 dark:text-slate-500">{user.subWorkUnit}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${getAccountStatusBadgeClass(user.accountStatus)}`}>
                              {getAccountStatusLabel(user.accountStatus)}
                            </span>
                            <span
                              className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${getAccessBadgeClass(user.role, user.staffAccessType)}`}
                              title={getAccessDescriptionByRole(user.role, user.staffAccessType)}
                            >
                              {getAccessLabelByRole(user.role, user.staffAccessType)}
                            </span>
                            {user.mustChangePassword && (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-4 text-amber-600 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300" title="Wajib ganti sandi saat login">
                                ⚠ Ganti sandi
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 shrink-0 rounded-lg p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100"
                            onClick={() => toggleUserExpand(user.id)}
                            title={isExpanded ? "Sembunyikan detail pengguna" : "Lihat detail pengguna"}
                            aria-label={isExpanded ? `Sembunyikan detail ${user.name}` : `Lihat detail ${user.name}`}
                          >
                            <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                          <td colSpan={5} className="px-3 py-2">
                            <div className="grid gap-2 text-[12px] text-slate-700 sm:grid-cols-2 lg:grid-cols-4 dark:text-slate-300">
                              <div className="flex items-start gap-2">
                                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                                <p className="min-w-0">Email: <span className="font-medium text-blue-800 dark:text-blue-300">{user.email}</span></p>
                              </div>
                              <div className="flex items-start gap-2">
                                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                                <p className="min-w-0">Telepon: <span className="font-medium text-blue-800 dark:text-blue-300">{user.phoneNumber || "-"}</span></p>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                                <p className="min-w-0">Alamat: <span className="font-medium text-blue-800 dark:text-blue-300">{user.homeAddress || "-"}</span></p>
                              </div>
                              <div className="flex items-start gap-2">
                                <CalendarCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                                <p className="min-w-0">Terdaftar: <span className="font-medium text-blue-800 dark:text-blue-300">
                                  {user.createdAt
                                    ? new Date(user.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                    : "-"}
                                </span></p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800/35">
                              {canEditThisUser && (
                                <Button variant="outline" size="sm" className="h-7 gap-1.5 border-teal-200 px-2.5 text-xs text-teal-700 hover:bg-teal-50 dark:border-teal-400/30 dark:text-teal-300 dark:hover:bg-teal-400/10" onClick={() => handleEdit(user)}>
                                  <Edit className="h-3.5 w-3.5" /> Edit
                                </Button>
                              )}
                              {canResetThisUser && (
                                <Button variant="outline" size="sm" className="h-7 gap-1.5 border-amber-200 px-2.5 text-xs text-amber-700 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-300 dark:hover:bg-amber-400/10" onClick={() => openResetPassword(user)}>
                                  <KeyRound className="h-3.5 w-3.5" /> Reset password
                                </Button>
                              )}
                              {canDeleteThisUser ? (
                                <Button variant="outline" size="sm" className="h-7 gap-1.5 border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-400/10" onClick={() => handleDelete(user.id)}>
                                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                                </Button>
                              ) : canRequestDeleteThisUser ? (
                                <Button variant="outline" size="sm" className="h-7 gap-1.5 border-red-200 px-2.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-400/10" onClick={() => handleRequestDelete(user)}>
                                  <Trash2 className="h-3.5 w-3.5" /> Ajukan hapus
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Tidak ada pengguna terdaftar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
          </p>
        </div>
        <DeleteReasonDialog
          open={Boolean(pendingDeleteUser)}
          title="Arsipkan pengguna?"
          description={`Pengguna ${pendingDeleteUser?.name || ""} akan disembunyikan dari daftar utama, tetapi tetap tersimpan sebagai arsip Admin.`}
          value={deleteReason}
          isSubmitting={isDeletingUser}
          onValueChange={setDeleteReason}
          onCancel={() => {
            if (isDeletingUser) return
            setPendingDeleteUser(null)
            setDeleteReason("")
          }}
          onConfirm={confirmDeleteUser}
        />
        <DeleteReasonDialog
          open={Boolean(pendingArchiveUserRequest)}
          title="Ajukan penghapusan pengguna?"
          description={`Permintaan penghapusan ${pendingArchiveUserRequest?.name || ""} akan dikirim ke Admin untuk ditinjau.`}
          value={deleteReason}
          isSubmitting={isDeletingUser}
          onValueChange={setDeleteReason}
          onCancel={() => {
            if (isDeletingUser) return
            setPendingArchiveUserRequest(null)
            setDeleteReason("")
          }}
          onConfirm={confirmRequestDeleteUser}
        />
        <DeleteReasonDialog
          open={isDeleteAllUsersOpen}
          title="Arsipkan semua pengguna?"
          description="Semua pengguna selain akun Anda akan disembunyikan dari daftar utama dan tetap tersimpan sebagai arsip Admin."
          value={deleteReason}
          isSubmitting={isDeletingUser}
          onValueChange={setDeleteReason}
          onCancel={() => {
            if (isDeletingUser) return
            setIsDeleteAllUsersOpen(false)
            setDeleteReason("")
          }}
          onConfirm={confirmDeleteAllUsers}
        />
      </div>
    </div>
  )
}
