import nodemailer, { Transporter } from 'nodemailer';
import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('service:email');

interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

const BRAND = process.env.EMAIL_BRAND_NAME || 'SiPeNa';
const FROM_ADDRESS = process.env.EMAIL_FROM || `noreply@sipena.id`;

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

export async function sendEmail(opts: MailOptions): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('[Email PREVIEW]', { to: opts.to, subject: opts.subject });
    }
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${BRAND}" <${FROM_ADDRESS}>`,
      to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return true;
  } catch (err) {
    logger.error('[Email Error]', { error: err });
    return false;
  }
}

const base = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:30px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <tr><td style="background:#0f766e;padding:20px 30px">
          <p style="color:#fff;font-size:20px;margin:0;font-weight:bold">${BRAND}</p>
          <p style="color:#99f6e4;font-size:12px;margin:4px 0 0">Sistem Inventaris Peminjaman & Pemeliharaan Sarana</p>
        </td></tr>
        <tr><td style="padding:30px">
          <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px">${title}</h2>
          ${body}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
          <p style="color:#94a3b8;font-size:12px;margin:0">Email ini dikirim otomatis oleh sistem ${BRAND}. Jangan membalas email ini.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const row = (label: string, value: string) =>
  `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:160px">${label}</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:500">${value}</td></tr>`;

export async function sendBorrowingApprovedEmail(
  to: string,
  data: { userName: string; assetName: string; borrowDate: string; dueDate: string; borrowingCode: string }
) {
  const body = `
    <p style="color:#475569;font-size:14px">Yth. <strong>${data.userName}</strong>,</p>
    <p style="color:#475569;font-size:14px">Permohonan peminjaman Anda telah <strong style="color:#16a34a">disetujui</strong>.</p>
    <table style="margin:16px 0;width:100%">
      ${row('Kode', data.borrowingCode)}
      ${row('Aset', data.assetName)}
      ${row('Tanggal Pinjam', data.borrowDate)}
      ${row('Jatuh Tempo', data.dueDate)}
    </table>
    <p style="color:#475569;font-size:14px">Silakan ambil aset sesuai jadwal yang telah ditentukan.</p>`;
  await sendEmail({ to, subject: `[${BRAND}] Peminjaman Disetujui – ${data.borrowingCode}`, html: base('Peminjaman Disetujui', body) });
}

export async function sendBorrowingRejectedEmail(
  to: string,
  data: { userName: string; assetName: string; borrowingCode: string; reason: string }
) {
  const body = `
    <p style="color:#475569;font-size:14px">Yth. <strong>${data.userName}</strong>,</p>
    <p style="color:#475569;font-size:14px">Permohonan peminjaman Anda <strong style="color:#dc2626">ditolak</strong>.</p>
    <table style="margin:16px 0;width:100%">
      ${row('Kode', data.borrowingCode)}
      ${row('Aset', data.assetName)}
      ${row('Alasan', data.reason)}
    </table>
    <p style="color:#475569;font-size:14px">Untuk informasi lebih lanjut, silakan hubungi petugas.</p>`;
  await sendEmail({ to, subject: `[${BRAND}] Peminjaman Ditolak – ${data.borrowingCode}`, html: base('Peminjaman Ditolak', body) });
}

export async function sendBorrowingOverdueEmail(
  to: string,
  data: { userName: string; assetName: string; dueDate: string; overdueDays: number; borrowingCode: string }
) {
  const body = `
    <p style="color:#475569;font-size:14px">Yth. <strong>${data.userName}</strong>,</p>
    <p style="color:#475569;font-size:14px">Peminjaman berikut telah <strong style="color:#dc2626">melewati jatuh tempo</strong>.</p>
    <table style="margin:16px 0;width:100%">
      ${row('Kode', data.borrowingCode)}
      ${row('Aset', data.assetName)}
      ${row('Jatuh Tempo', data.dueDate)}
      ${row('Terlambat', `${data.overdueDays} hari`)}
    </table>
    <p style="color:#dc2626;font-size:14px;font-weight:500">Segera kembalikan aset untuk menghindari sanksi lebih lanjut.</p>`;
  await sendEmail({ to, subject: `[${BRAND}] Pengingat: Peminjaman Overdue – ${data.borrowingCode}`, html: base('Peminjaman Melewati Jatuh Tempo', body) });
}

export async function sendDisposalReviewedEmail(
  to: string,
  data: { requesterName: string; assetName: string; requestCode: string; approved: boolean; reviewNotes?: string }
) {
  const status = data.approved ? 'disetujui' : 'ditolak';
  const color = data.approved ? '#16a34a' : '#dc2626';
  const body = `
    <p style="color:#475569;font-size:14px">Yth. <strong>${data.requesterName}</strong>,</p>
    <p style="color:#475569;font-size:14px">Permintaan penghapusan aset Anda telah <strong style="color:${color}">${status}</strong>.</p>
    <table style="margin:16px 0;width:100%">
      ${row('Kode', data.requestCode)}
      ${row('Aset', data.assetName)}
      ${data.reviewNotes ? row('Catatan', data.reviewNotes) : ''}
    </table>`;
  await sendEmail({ to, subject: `[${BRAND}] Permintaan Penghapusan ${data.approved ? 'Disetujui' : 'Ditolak'} – ${data.requestCode}`, html: base(`Permintaan Penghapusan ${data.approved ? 'Disetujui' : 'Ditolak'}`, body) });
}
