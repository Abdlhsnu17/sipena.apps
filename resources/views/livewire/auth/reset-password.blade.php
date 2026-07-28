<div>
    <h1 class="mb-2 text-lg font-semibold text-slate-800">Verifikasi & Reset Password</h1>

    @if (session('reset_info'))
        <p class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{{ session('reset_info') }}</p>
    @endif
    @if (session('reset_preview_code'))
        <p class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Mode preview lokal &mdash; kode: <strong>{{ session('reset_preview_code') }}</strong>
        </p>
    @endif

    <form wire:submit="submit" class="space-y-4">
        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">NIP</label>
            <input type="text" wire:model="nip" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('nip') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Kode Verifikasi</label>
            <input type="text" wire:model="verification_code" maxlength="6" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" autofocus>
            @error('verification_code') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Password Baru</label>
            <input type="password" wire:model="password" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('password') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Konfirmasi Password Baru</label>
            <input type="password" wire:model="password_confirmation" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
        </div>

        <button type="submit" class="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800" wire:loading.attr="disabled">
            Reset Password
        </button>
    </form>
</div>
