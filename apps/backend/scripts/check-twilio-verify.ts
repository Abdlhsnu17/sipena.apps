import { applyDevelopmentEnvDefaults, getLoadedEnvPath, loadEnvironment } from '../src/config/env';

loadEnvironment();
applyDevelopmentEnvDefaults();

/**
 * Memeriksa kredensial Twilio Verify tanpa mengirim SMS.
 *
 * Tujuannya memisahkan dua kegagalan yang gejalanya mirip: kredensial salah
 * atau tidak terbaca backend, versus kredensial benar tetapi SMS tidak sampai
 * (nomor trial belum diverifikasi, sender ID belum terdaftar, dan sejenisnya).
 * Nilai rahasia tidak pernah dicetak.
 */
const maskSid = (value: string): string =>
  value.length <= 8 ? '*'.repeat(value.length) : `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`;

const run = async (): Promise<void> => {
  const envPath = getLoadedEnvPath();
  console.log(`File env terbaca : ${envPath ?? '(tidak ada file env; memakai environment proses)'}`);

  const { getTwilioVerifyConfig } = await import('../src/services/otp/twilio.service');
  const config = getTwilioVerifyConfig();

  if (!config) {
    const missing = [
      ['TWILIO_ACCOUNT_SID', process.env.TWILIO_ACCOUNT_SID],
      ['TWILIO_AUTH_TOKEN', process.env.TWILIO_AUTH_TOKEN],
      ['TWILIO_VERIFY_SERVICE_SID', process.env.TWILIO_VERIFY_SERVICE_SID],
    ]
      .filter(([, value]) => !value?.trim())
      .map(([key]) => key);

    console.error('❌ Twilio Verify belum dikonfigurasi. Variabel yang masih kosong:');
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error('\nIsi nilai tersebut di apps/backend/.env (pengembangan lokal) atau docker/.env (Docker),');
    console.error('lalu jalankan ulang perintah ini. Backend membaca env sekali saat start.');
    process.exitCode = 1;
    return;
  }

  console.log('Konfigurasi terbaca:');
  console.log(`   Account SID       : ${maskSid(config.accountSid)}`);
  console.log(`   Verify Service SID: ${maskSid(config.verifyServiceSid)}`);
  console.log(`   Channel           : ${config.channel}`);

  const twilio = (await import('twilio')).default;
  const client = twilio(config.accountSid, config.authToken);

  try {
    const service = await client.verify.v2.services(config.verifyServiceSid).fetch();

    console.log('\n✅ Kredensial valid dan Verify Service ditemukan.');
    console.log(`   Nama service   : ${service.friendlyName}`);
    console.log(`   Panjang kode   : ${service.codeLength} digit`);
    console.log('\nKredensial sudah benar. Bila SMS tetap tidak sampai, penyebabnya ada di sisi pengiriman:');
    console.log('nomor tujuan belum diverifikasi (akun trial), atau sender ID/regulasi tujuan belum terpenuhi.');
  } catch (error) {
    const status = (error as { status?: number }).status;
    const code = (error as { code?: number }).code;

    console.error('\n❌ Twilio menolak permintaan.');
    console.error(`   HTTP status: ${status ?? '(tidak diketahui)'} | kode Twilio: ${code ?? '(tidak ada)'}`);

    if (status === 401) {
      console.error('   Artinya: Account SID atau Auth Token salah.');
    } else if (status === 404) {
      console.error('   Artinya: Verify Service SID tidak ditemukan pada akun ini.');
      console.error('   Pastikan SID diawali "VA" dan diambil dari Console → Verify → Services.');
    } else {
      console.error(`   Pesan: ${(error as Error).message}`);
    }

    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('❌ Gagal menjalankan pemeriksaan Twilio Verify:', error);
  process.exit(1);
});
