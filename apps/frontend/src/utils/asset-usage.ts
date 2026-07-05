export const USAGE_OPTIONS = [
  "Administrasi & Komunikasi",
  "Fasilitas & Furnitur",
  "Utilitas & Tata Udara",
  "Keamanan & Darurat",
  "Logistik & Penyimpanan",
  "Kebersihan & Limbah",
  "Dapur, Laundry & Penunjang",
  "Transportasi Operasional",
  "Operasional bersama",
  "Pendukung klinis",
] as const

export const USAGE_PURPOSE_ALIASES: Record<string, (typeof USAGE_OPTIONS)[number]> = {
  "Administrasi, IT, dan komunikasi": "Administrasi & Komunikasi",
  "Office administrasi": "Administrasi & Komunikasi",
  "Fasilitas ruangan dan furniture": "Fasilitas & Furnitur",
  "Fasilitas umum": "Fasilitas & Furnitur",
  "Kelistrikan, utilitas, dan tata udara": "Utilitas & Tata Udara",
  "Keamanan, keselamatan, dan tanggap darurat": "Keamanan & Darurat",
  "Keamanan keselamatan": "Keamanan & Darurat",
  "Logistik, penyimpanan, dan distribusi": "Logistik & Penyimpanan",
  "Kebersihan, sanitasi, dan pengelolaan limbah": "Kebersihan & Limbah",
  "Kebersihan sanitasi": "Kebersihan & Limbah",
  "Dapur, laundry, dan layanan penunjang": "Dapur, Laundry & Penunjang",
  "Transportasi dan operasional lapangan": "Transportasi Operasional",
}
