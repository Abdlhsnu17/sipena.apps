<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class PasswordResetSessionService
{
    private function key(string $nip): string
    {
        return "password_reset_session:{$nip}";
    }

    public function save(string $nip, array $session): void
    {
        $ttlSeconds = max(1, (int) ceil(($session['expiresAt'] - now()->getTimestampMs()) / 1000));
        Cache::put($this->key($nip), $session, $ttlSeconds);
    }

    public function get(string $nip): ?array
    {
        return Cache::get($this->key($nip));
    }

    public function delete(string $nip): void
    {
        Cache::forget($this->key($nip));
    }
}
