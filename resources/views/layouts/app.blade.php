<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? 'SIPENA' }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-slate-50 text-slate-900 antialiased">
    <div class="flex min-h-screen">
        @auth
            @include('layouts.partials.sidebar')
        @endauth

        <div class="flex min-h-screen flex-1 flex-col">
            @auth
                @include('layouts.partials.topbar')
            @endauth

            <main class="flex-1 p-4 sm:p-6">
                <div class="mx-auto max-w-7xl">
                    @if (session('status'))
                        <div class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {{ session('status') }}
                        </div>
                    @endif

                    {{ $slot }}
                </div>
            </main>
        </div>
    </div>

    @livewireScripts
</body>
</html>
