import { describe, expect, it } from 'vitest';
import { buildStoredFileName, sanitizeUploadFileName } from './upload-filename';

describe('sanitizeUploadFileName', () => {
  it('mempertahankan nama file yang sudah aman', () => {
    expect(sanitizeUploadFileName('laporan-juli.pdf')).toBe('laporan-juli.pdf');
  });

  it('mengganti karakter tidak aman dengan satu tanda hubung', () => {
    expect(sanitizeUploadFileName('Foto Kerusakan (AC) #2.JPG')).toBe('Foto-Kerusakan-AC-2.jpg');
  });

  it('membuang komponen direktori sehingga path traversal tidak mungkin', () => {
    expect(sanitizeUploadFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeUploadFileName('/var/www/rahasia.pdf')).toBe('rahasia.pdf');
    // Di POSIX backslash bukan pemisah path, jadi yang penting hasilnya tidak
    // lagi memuat pemisah direktori dalam bentuk apa pun.
    const windowsStyle = sanitizeUploadFileName('..\\..\\windows\\system.ini');
    expect(windowsStyle).toBe('windows-system.ini');
    expect(windowsStyle).not.toMatch(/[/\\]/);
  });

  it('memakai fallback ketika nama file kosong setelah dibersihkan', () => {
    expect(sanitizeUploadFileName('###.png', 'maintenance')).toBe('maintenance.png');
    expect(sanitizeUploadFileName('')).toBe('file');
  });

  it('menormalkan ekstensi menjadi huruf kecil', () => {
    expect(sanitizeUploadFileName('bukti.PNG')).toBe('bukti.png');
  });
});

describe('buildStoredFileName', () => {
  it('memberi prefiks token acak 32 karakter heksadesimal', () => {
    const name = buildStoredFileName('bukti.png');

    expect(name).toMatch(/^[0-9a-f]{32}-bukti\.png$/);
  });

  it('tidak dapat ditebak: dua unggahan file yang sama menghasilkan nama berbeda', () => {
    const names = new Set(Array.from({ length: 200 }, () => buildStoredFileName('bukti.png')));

    expect(names.size).toBe(200);
  });

  it('tetap membersihkan nama asli yang berbahaya', () => {
    expect(buildStoredFileName('../../etc/passwd')).toMatch(/^[0-9a-f]{32}-passwd$/);
  });

  it('tidak mengandung timestamp yang bisa diurutkan seperti pola lama', () => {
    const name = buildStoredFileName('bukti.png');
    const prefix = name.split('-')[0];

    // Pola lama `${Date.now()}-nama` menghasilkan prefiks 13 digit desimal yang
    // bisa ditebak dengan mencoba rentang waktu unggah.
    expect(prefix).not.toMatch(/^\d{13}$/);
  });
});
