<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? 'SIPENA' }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 antialiased">
    <div class="w-full max-w-md">
        <div class="mb-6 text-center">
            <span class="text-2xl font-bold text-emerald-700">SIPENA</span>
            <p class="mt-1 text-sm text-slate-500">Sistem Inventaris, Peminjaman, dan Pemeliharaan</p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {{ $slot }}
        </div>
    </div>

    @livewireScripts
</body>
</html>
