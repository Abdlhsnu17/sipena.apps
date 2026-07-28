<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OtpDeliveryService
{
    public static function normalizePhoneNumber(string $value): string
    {
        $cleaned = preg_replace('/[^\d+]/', '', $value) ?? '';

        if ($cleaned === '') {
            return '';
        }

        if (str_starts_with($cleaned, '+')) {
            return $cleaned;
        }

        if (str_starts_with($cleaned, '62')) {
            return '+' . $cleaned;
        }

        if (str_starts_with($cleaned, '0')) {
            return '+62' . substr($cleaned, 1);
        }

        return '+' . $cleaned;
    }

    public static function isValidPhoneNumber(string $value): bool
    {
        $normalized = self::normalizePhoneNumber($value);

        return (bool) preg_match('/^\+[1-9]\d{9,15}$/', $normalized);
    }

    private static function maskPhoneNumber(string $value): string
    {
        $normalized = self::normalizePhoneNumber($value);

        if (strlen($normalized) <= 6) {
            return $normalized;
        }

        $middleLength = max(strlen($normalized) - 7, 3);

        return substr($normalized, 0, 4) . str_repeat('*', $middleLength) . substr($normalized, -3);
    }

    /**
     * Sends a password-reset OTP over WhatsApp then SMS webhook (in that order),
     * falling back to a local preview when neither channel is configured.
     *
     * @return array{channel: string, preview: bool, deliveryTarget: string}
     */
    public function sendPasswordResetOtp(string $phoneNumber, string $code, int $expiresInMinutes, string $userName): array
    {
        $normalizedPhoneNumber = self::normalizePhoneNumber($phoneNumber);
        $deliveryTarget = self::maskPhoneNumber($normalizedPhoneNumber);
        $isProduction = app()->environment('production');
        $brandName = trim((string) config('sipena.otp.brand_name')) ?: 'SiPeNa';

        $basePayload = [
            'to' => $normalizedPhoneNumber,
            'code' => $code,
            'expiresInMinutes' => $expiresInMinutes,
            'brandName' => $brandName,
            'userName' => $userName,
            'message' => "{$brandName}: kode OTP reset password Anda adalah {$code}. Berlaku {$expiresInMinutes} menit.",
        ];

        $attempts = [
            ['channel' => 'whatsapp', 'url' => config('sipena.otp.whatsapp_webhook_url'), 'token' => config('sipena.otp.whatsapp_webhook_token')],
            ['channel' => 'sms', 'url' => config('sipena.otp.sms_webhook_url'), 'token' => config('sipena.otp.sms_webhook_token')],
        ];

        $configuredAttempts = array_filter($attempts, fn ($attempt) => !empty($attempt['url']));

        if (empty($configuredAttempts)) {
            if (!$isProduction) {
                Log::debug('[DEV][RESET OTP] kode verifikasi', ['to' => $normalizedPhoneNumber, 'code' => $code]);

                return ['channel' => 'local_preview', 'preview' => true, 'deliveryTarget' => $deliveryTarget];
            }

            throw new \RuntimeException('Layanan OTP WhatsApp/SMS belum dikonfigurasi di server.');
        }

        foreach ($configuredAttempts as $attempt) {
            try {
                $request = Http::timeout(10)->acceptJson();
                if (!empty($attempt['token'])) {
                    $request = $request->withToken($attempt['token']);
                }

                $response = $request->post($attempt['url'], [...$basePayload, 'channel' => $attempt['channel']]);

                if ($response->successful()) {
                    return ['channel' => $attempt['channel'], 'preview' => false, 'deliveryTarget' => $deliveryTarget];
                }

                Log::error('[OTP] Pengiriman gagal', ['channel' => $attempt['channel'], 'status' => $response->status()]);
            } catch (\Throwable $e) {
                Log::error('[OTP] Pengiriman gagal', ['channel' => $attempt['channel'], 'error' => $e->getMessage()]);
            }
        }

        if (!$isProduction) {
            Log::debug('[DEV][RESET OTP] kode verifikasi', ['to' => $normalizedPhoneNumber, 'code' => $code]);

            return ['channel' => 'local_preview', 'preview' => true, 'deliveryTarget' => $deliveryTarget];
        }

        throw new \RuntimeException('Pengiriman kode verifikasi gagal di semua channel WhatsApp/SMS. Periksa webhook OTP.');
    }
}
