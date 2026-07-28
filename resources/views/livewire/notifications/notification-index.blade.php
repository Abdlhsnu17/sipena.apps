<div>
    <h1 class="mb-6 text-xl font-semibold text-slate-800">Notifikasi</h1>

    <div class="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm">
        @forelse ($notifications as $notification)
            <div class="flex items-start justify-between gap-4 p-4 {{ $notification->is_read ? '' : 'bg-emerald-50/50' }}">
                <div>
                    <p class="text-sm font-medium text-slate-800">{{ $notification->title }}</p>
                    @if ($notification->message)
                        <p class="mt-1 text-sm text-slate-500">{{ $notification->message }}</p>
                    @endif
                    <p class="mt-1 text-xs text-slate-400">{{ $notification->created_at?->diffForHumans() }}</p>
                </div>
                @unless ($notification->is_read)
                    <button wire:click="markRead({{ $notification->id }})" class="shrink-0 text-xs text-emerald-700 hover:underline">
                        Tandai dibaca
                    </button>
                @endunless
            </div>
        @empty
            <p class="p-6 text-sm text-slate-500">Belum ada notifikasi.</p>
        @endforelse
    </div>

    <div class="mt-4">{{ $notifications->links() }}</div>
</div>
