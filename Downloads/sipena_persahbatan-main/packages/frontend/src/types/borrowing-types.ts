export interface BorrowingRecord {
  id: string
  assetId: string
  assetName: string
  assetCategory: string
  assetSource: "medical" | "office"
  borrowerName: string
  borrowerNip: string
  borrowerDepartment: string
  borrowDate: string
  returnDate: string
  actualReturnDate?: string
  purpose: string
  status: "Dipinjam" | "Dikembalikan" | "Terlambat"
  notes?: string
  createdAt: string
}

export const DEPARTMENTS = [
  "IGD",
  "Rawat Inap",
  "Rawat Jalan",
  "ICU",
  "Radiologi",
  "Laboratorium",
  "Farmasi",
  "Bedah",
  "Kebidanan",
  "Anak",
  "Penyakit Dalam",
  "Administrasi",
  "Logistik",
  "IT",
  "Lainnya",
]
