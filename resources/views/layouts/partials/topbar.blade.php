<header class="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
    <div class="text-sm font-medium text-slate-500">{{ $title ?? '' }}</div>
    <div class="flex items-center gap-4">
        <a href="{{ route('notifications.index') }}" class="relative text-slate-500 hover:text-emerald-700" title="Notifikasi">
            <span>🔔</span>
        </a>
        <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-700">{{ auth()->user()->name }}</span>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button type="submit" class="text-sm text-slate-500 hover:text-red-600">Keluar</button>
            </form>
        </div>
    </div>
</header>
