<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks every route except logout and "change my own password" while
 * must_change_password is set, mirroring the Express authMiddleware gate.
 */
class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->must_change_password) {
            return $next($request);
        }

        $allowedRoutes = ['logout', 'password.force-change', 'password.force-change.update'];

        if ($request->routeIs($allowedRoutes)) {
            return $next($request);
        }

        return redirect()->route('password.force-change');
    }
}
