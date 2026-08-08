import crypto from 'crypto';
import path from 'path';

/**
 * Membersihkan nama file yang diunggah pengguna: hanya menyisakan karakter aman
 * dan membuang komponen direktori, sehingga tidak bisa dipakai untuk path
 * traversal (mis. `../../etc/passwd`).
 */
export const sanitizeUploadFileName = (filename: string, fallback = 'file'): string => {
  const parsed = path.parse(path.basename(filename || ''));
  const baseName = parsed.name
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const extension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${baseName || fallback}${extension}`;
};

/**
 * Membuat nama file penyimpanan yang tidak bisa ditebak.
 *
 * Lampiran pemeliharaan dan foto profil disajikan sebagai file statis supaya bisa
 * dibuka langsung oleh `<img>`/`<a target="_blank">`, yang tidak dapat mengirim
 * header `Authorization`. Karena itu URL-nya sendiri yang berfungsi sebagai
 * kredensial, sehingga nama file wajib acak: pola lama `${Date.now()}-nama.jpg`
 * masih bisa ditebak dengan mencoba rentang timestamp.
 *
 * 16 byte acak (128 bit) membuat penebakan tidak praktis, sementara nama asli
 * tetap dipertahankan agar file mudah dikenali saat diunduh.
 */
export const buildStoredFileName = (originalName: string, fallback = 'file'): string => {
  const token = crypto.randomBytes(16).toString('hex');
  return `${token}-${sanitizeUploadFileName(originalName, fallback)}`;
};
