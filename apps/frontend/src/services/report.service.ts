import { toIsoDateTimeString } from "../utils/date-input"
import apiService from "./api.service"

export interface DashboardStats {
  totalAssets: number
  totalMedicalAssets: number
  totalNonMedicalAssets: number
  availableAssets: number
  borrowedAssets: number
  maintenanceAssets: number
  totalBorrowings: number
  pendingBorrowings: number
  activeBorrowings: number
  overdueBorrowings: number
  activeSanctions: number
  totalMaintenance: number
  scheduledMaintenance: number
  totalUsers: number
  assetStatusSummary: StatusSummary[]
  borrowingStatusSummary: StatusSummary[]
  maintenanceStatusSummary: StatusSummary[]
  dueNotifications: DueNotification[]
  operational: DashboardOperationalStats
}

/**
 * Statistik kartu dashboard yang dihitung di database.
 *
 * Sebelumnya nilai-nilai ini dihitung di browser setelah menarik lima endpoint
 * pada `limit: 1000`. Cakupan datanya sudah disesuaikan dengan hak akses aktor
 * oleh backend, jadi tidak perlu difilter ulang di sisi klien.
 */
export interface DashboardOperationalStats {
  totalMedicalAssets: number
  totalNonMedicalAssets: number
  nonMedicalRoomCount: number
  medicalRoomCount: number
  totalRoomCount: number
  medicalDetailsCount: number
  nonMedicalDetailsCount: number
  maintenanceDue: number
  completedMaintenance: number
  activeBorrowings: number
  returnedBorrowings: number
  pendingBorrowings: number
  overdueBorrowings: number
  totalUsageLogs: number
  usedAssetCount: number
}

export interface StatusSummary {
  status: string
  total: number
}

export type DueNotificationSeverity = "danger" | "warning" | "info"

export interface DueNotification {
  id: number
  type: "borrowing_overdue" | "borrowing_due_soon" | "maintenance_due_soon"
  title: string
  description: string
  dueDate: string | null
  daysRemaining: number
  severity: DueNotificationSeverity
  href: string
}

export interface ReportResponse<T = any> {
  success: boolean
  message: string
  data: T
}

export interface ReportUpload {
  id: number
  userId?: number | null
  filename: string
  contentType: string
  sizeBytes: number
  storedPath: string | null
  uploadedAt: string
  notes?: string | null
  category?: string | null
  relatedModule?: string | null
  retentionUntil?: string | null
  downloadPath: string
  previewPath?: string
}

class ReportService {
  async getDashboard(): Promise<ReportResponse<DashboardStats>> {
    return apiService.get<ReportResponse<DashboardStats>>("/reports")
  }

  async getNotifications(): Promise<ReportResponse<DueNotification[]>> {
    return apiService.get<ReportResponse<DueNotification[]>>("/reports/notifications")
  }

  async getAssetReport(params: Record<string, string> = {}): Promise<ReportResponse<any[]>> {
    const query = new URLSearchParams(params).toString()
    const endpoint = `/reports/assets${query ? `?${query}` : ""}`
    return apiService.get<ReportResponse<any[]>>(endpoint)
  }

  async getBorrowingReport(params: Record<string, string> = {}): Promise<ReportResponse<any[]>> {
    const query = new URLSearchParams(params).toString()
    const endpoint = `/reports/borrowing${query ? `?${query}` : ""}`
    return apiService.get<ReportResponse<any[]>>(endpoint)
  }

  async getMaintenanceReport(params: Record<string, string> = {}): Promise<ReportResponse<any[]>> {
    const query = new URLSearchParams(params).toString()
    const endpoint = `/reports/maintenance${query ? `?${query}` : ""}`
    return apiService.get<ReportResponse<any[]>>(endpoint)
  }

  async getUsageReport(params: Record<string, string> = {}): Promise<ReportResponse<any[]>> {
    const query = new URLSearchParams(params).toString()
    const endpoint = `/reports/usage${query ? `?${query}` : ""}`
    return apiService.get<ReportResponse<any[]>>(endpoint)
  }

  async getUploadedReports(): Promise<ReportResponse<ReportUpload[]>> {
    return apiService.get<ReportResponse<ReportUpload[]>>("/reports/uploads")
  }

  async uploadReport(file: File, metadata: { notes?: string; category?: string; relatedModule?: string; retentionUntil?: string } = {}): Promise<ReportResponse<ReportUpload>> {
    const formData = new FormData()
    formData.append("file", file)
    for (const [key, value] of Object.entries(metadata)) {
      if (!value) continue
      if (key === "retentionUntil") {
        const normalizedRetentionUntil = toIsoDateTimeString(value)
        if (normalizedRetentionUntil) {
          formData.append(key, normalizedRetentionUntil)
        }
        continue
      }
      formData.append(key, value)
    }
    return apiService.post<ReportResponse<ReportUpload>>("/reports/uploads", formData as FormData)
  }

  async deleteUpload(id: number): Promise<ReportResponse<null>> {
    return apiService.delete<ReportResponse<null>>(`/reports/uploads/${id}`)
  }

  getExportEndpoint(format: "pdf" | "excel" | "csv", params: Record<string, string> = {}): string {
    const query = new URLSearchParams(params).toString()
    return `/reports/export/${format}${query ? `?${query}` : ""}`
  }
}

export const reportService = new ReportService()
export default reportService
