<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Mirrors the Express authMiddleware's server-side session invalidation
 * (session_version) and account-status re-check on every authenticated request.
 */
class EnsureAccountIsUsable
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        $user->refresh();

        if ((int) $request->session()->get('session_version') !== (int) $user->session_version) {
            auth()->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors(['nip' => 'Sesi Anda telah berakhir, silakan masuk kembali.']);
        }

        if (($user->account_status ?? 'active') !== 'active') {
            auth()->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            $message = $user->account_status === 'suspended'
                ? 'Akun Anda sedang ditangguhkan.'
                : 'Akun Anda sedang nonaktif.';

            return redirect()->route('login')->withErrors(['nip' => $message]);
        }

        return $next($request);
    }
}
