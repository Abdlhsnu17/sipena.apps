<?php

namespace App\Services;

use App\Mail\PasswordResetCodeMail;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AuthService
{
    public function __construct(
        private readonly PasswordResetSessionService $resetSessions,
        private readonly OtpDeliveryService $otpDelivery,
    ) {}

    /**
     * @return array{success: bool, message: string, user?: User}
     */
    public function attemptLogin(string $identifier, string $password): array
    {
        $identifier = trim($identifier);

        /** @var User|null $user */
        $user = User::where('nip', $identifier)->orWhere('email', $identifier)->first();

        if (!$user) {
            return ['success' => false, 'message' => 'Akun tidak ditemukan'];
        }

        if (($user->account_status ?? 'active') !== 'active') {
            return [
                'success' => false,
                'message' => $user->account_status === 'suspended'
                    ? 'Akun Anda sedang ditangguhkan. Hubungi admin.'
                    : 'Akun Anda sedang nonaktif. Hubungi admin.',
            ];
        }

        if ($user->locked_until && $user->locked_until->isFuture()) {
            $remainingMinutes = now()->diffInMinutes($user->locked_until, true);

            return [
                'success' => false,
                'message' => sprintf('Akun terkunci sementara karena terlalu banyak percobaan login gagal. Coba lagi dalam %d menit.', (int) ceil($remainingMinutes)),
            ];
        }

        if (!Hash::check($password, $user->password)) {
            $maxAttempts = (int) config('sipena.auth.max_failed_login_attempts');
            $nextFailedAttempts = $user->failed_login_attempts + 1;
            $shouldLock = $nextFailedAttempts >= $maxAttempts;

            $user->forceFill([
                'failed_login_attempts' => $shouldLock ? 0 : $nextFailedAttempts,
                'locked_until' => $shouldLock
                    ? now()->addMinutes((int) config('sipena.auth.account_lock_duration_minutes'))
                    : null,
            ])->save();

            return [
                'success' => false,
                'message' => $shouldLock
                    ? sprintf('Akun terkunci sementara karena terlalu banyak percobaan login gagal. Coba lagi dalam %d menit.', config('sipena.auth.account_lock_duration_minutes'))
                    : 'Password yang Anda masukkan salah',
            ];
        }

        $user->forceFill([
            'last_login' => now(),
            'failed_login_attempts' => 0,
            'locked_until' => null,
        ])->save();

        return ['success' => true, 'message' => 'Login berhasil', 'user' => $user];
    }

    public function register(array $credentials): array
    {
        $phoneNumber = OtpDeliveryService::normalizePhoneNumber($credentials['phone_number'] ?? '');

        if (!OtpDeliveryService::isValidPhoneNumber($phoneNumber)) {
            return ['success' => false, 'message' => 'Nomor WhatsApp/SMS tidak valid'];
        }

        $exists = User::where('nip', $credentials['nip'])
            ->orWhere('email', $credentials['email'])
            ->orWhere('phone_number', $phoneNumber)
            ->exists();

        if ($exists) {
            return ['success' => false, 'message' => 'Akun dengan NIP atau email ini sudah terdaftar'];
        }

        $user = User::create([
            'nip' => $credentials['nip'],
            'name' => $credentials['name'],
            'email' => $credentials['email'],
            'password' => $credentials['password'],
            'role' => User::ROLE_USER,
            'phone_number' => $phoneNumber,
        ]);

        return ['success' => true, 'message' => 'Pendaftaran berhasil', 'user' => $user];
    }

    public function requestPasswordResetCode(string $nip): array
    {
        $genericMessage = 'Jika data Anda terdaftar, kode verifikasi akan dikirim melalui kanal yang tersedia.';

        $user = User::where('nip', $nip)->first();
        if (!$user) {
            return ['success' => true, 'message' => $genericMessage];
        }

        $code = (string) random_int(100000, 999999);
        $expiresInMinutes = (int) config('sipena.otp.expires_in_minutes');
        $expiresAt = now()->addMinutes($expiresInMinutes)->getTimestampMs();

        $this->resetSessions->save($user->nip, [
            'userId' => $user->id,
            'nip' => $user->nip,
            'email' => $user->email,
            'codeHash' => Hash::make($code),
            'expiresAt' => $expiresAt,
            'attemptsLeft' => (int) config('sipena.otp.max_attempts'),
        ]);

        $deliveries = [];
        $phoneDeliverySucceeded = false;

        if ($user->phone_number && OtpDeliveryService::isValidPhoneNumber($user->phone_number)) {
            try {
                $delivery = $this->otpDelivery->sendPasswordResetOtp($user->phone_number, $code, $expiresInMinutes, $user->name);
                $deliveries[] = $delivery;
                $phoneDeliverySucceeded = !$delivery['preview'];
            } catch (\Throwable $e) {
                report($e);
            }
        }

        if (!$phoneDeliverySucceeded) {
            try {
                $preview = !config('mail.mailers.smtp.host') && !app()->environment('production');
                Mail::to($user->email)->send(new PasswordResetCodeMail($user->name, $code, $expiresInMinutes));
                $deliveries[] = [
                    'channel' => $preview ? 'local_preview' : 'email',
                    'preview' => $preview,
                    'deliveryTarget' => $this->maskEmail($user->email),
                ];
            } catch (\Throwable $e) {
                report($e);
            }
        }

        if (empty($deliveries)) {
            $this->resetSessions->delete($user->nip);

            return ['success' => false, 'message' => 'Pengiriman kode verifikasi gagal di semua kanal. Periksa konfigurasi WhatsApp, SMS, dan email.'];
        }

        $activeDelivery = collect($deliveries)->first(fn ($d) => !$d['preview']);
        $previewOnly = !$activeDelivery;
        $selected = $activeDelivery ?? $deliveries[0];

        return [
            'success' => true,
            'message' => $previewOnly ? 'Kode verifikasi tersedia di preview lokal pengembangan.' : $genericMessage,
            'deliveryTarget' => $selected['deliveryTarget'] ?? $selected['channel'],
            'previewCode' => $previewOnly ? $code : null,
        ];
    }

    public function resetPasswordWithCode(string $nip, string $verificationCode, string $newPassword): array
    {
        $genericFailure = 'Kode verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.';

        $user = User::where('nip', $nip)->first();
        if (!$user) {
            return ['success' => false, 'message' => $genericFailure];
        }

        $session = $this->resetSessions->get($nip);
        if (!$session || (int) $session['userId'] !== $user->id) {
            return ['success' => false, 'message' => $genericFailure];
        }

        if (!Hash::check($verificationCode, $session['codeHash'])) {
            $nextAttemptsLeft = $session['attemptsLeft'] - 1;
            if ($nextAttemptsLeft <= 0) {
                $this->resetSessions->delete($nip);

                return ['success' => false, 'message' => $genericFailure];
            }

            $this->resetSessions->save($nip, [...$session, 'attemptsLeft' => $nextAttemptsLeft]);

            return ['success' => false, 'message' => $genericFailure];
        }

        $user->forceFill([
            'password' => $newPassword,
            'must_change_password' => false,
            'session_version' => $user->session_version + 1,
        ])->save();

        $this->resetSessions->delete($nip);

        return ['success' => true, 'message' => 'Password berhasil diubah. Silakan login dengan password baru.'];
    }

    public function invalidateUserSessions(User $user): void
    {
        $user->forceFill(['session_version' => $user->session_version + 1])->save();
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if (!$local || !$domain) {
            return 'email terdaftar';
        }

        $visible = Str::substr($local, 0, min(2, strlen($local)));

        return $visible . str_repeat('*', max(strlen($local) - strlen($visible), 2)) . '@' . $domain;
    }
}
