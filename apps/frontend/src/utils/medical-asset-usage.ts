export const MEDICAL_USAGE_OPTIONS = [
  "Perawatan & Rawat Inap",
  "Pemeriksaan & Monitoring",
  "Diagnostik & Pencitraan",
  "Spesialistik & Tindakan",
  "Terapi & Dukungan Hidup",
  "ICU & Dukungan Kritis",
  "Bedah & Sterilisasi",
  "Ibu, Bayi & Neonatal",
  "Hemodialisis",
  "Lab, Farmasi & Sampel",
  "Rehabilitasi & Mobilisasi",
  "Operasional bersama",
  "Tim medis",
] as const

export const MEDICAL_USAGE_ALIASES: Record<string, (typeof MEDICAL_USAGE_OPTIONS)[number]> = {
  "Perawatan pasien dan dukungan ruang rawat": "Perawatan & Rawat Inap",
  "Monitoring pasien dan pemeriksaan klinis": "Pemeriksaan & Monitoring",
  "Diagnostik, pencitraan, dan analisis medis": "Diagnostik & Pencitraan",
  "Pemeriksaan spesialistik dan tindakan klinis": "Spesialistik & Tindakan",
  "Terapi, perawatan, dan dukungan hidup": "Terapi & Dukungan Hidup",
  "Monitoring intensif dan dukungan hidup kritis": "ICU & Dukungan Kritis",
  "Tindakan bedah dan prosedur steril": "Bedah & Sterilisasi",
  "Pelayanan ibu, bayi, dan neonatal": "Ibu, Bayi & Neonatal",
  "Hemodialisis dan terapi penunjang ginjal": "Hemodialisis",
  "Laboratorium, farmasi, dan pengolahan sampel": "Lab, Farmasi & Sampel",
  "Rehabilitasi medik dan mobilisasi pasien": "Rehabilitasi & Mobilisasi",
}
