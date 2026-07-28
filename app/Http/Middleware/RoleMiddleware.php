<?php

namespace App\Http\Middleware;

use App\Support\RoleHelper;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level role gate, mirroring Express's requireRole([...]).
 * Usage: ->middleware('role:admin,leader')
 */
class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        abort_if(!$user, 401);
        abort_unless(RoleHelper::hasAnyRole($user->role, $roles), 403, 'Anda tidak memiliki izin untuk mengakses halaman ini.');

        return $next($request);
    }
}
