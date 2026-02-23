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
  totalMaintenance: number
  scheduledMaintenance: number
  totalUsers: number
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
  downloadPath: string
  previewPath?: string
}

class ReportService {
  async getDashboard(): Promise<ReportResponse<DashboardStats>> {
    return apiService.get<ReportResponse<DashboardStats>>("/reports")
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

  async getUploadedReports(): Promise<ReportResponse<ReportUpload[]>> {
    return apiService.get<ReportResponse<ReportUpload[]>>("/reports/uploads")
  }

  async uploadReport(file: File, notes?: string): Promise<ReportResponse<ReportUpload>> {
    const formData = new FormData()
    formData.append("file", file)
    if (notes) {
      formData.append("notes", notes)
    }
    return apiService.post<ReportResponse<ReportUpload>>("/reports/uploads", formData as any)
  }

  async deleteUpload(id: number): Promise<ReportResponse<null>> {
    return apiService.delete<ReportResponse<null>>(`/reports/uploads/${id}`)
  }
}

export const reportService = new ReportService()
export default reportService
