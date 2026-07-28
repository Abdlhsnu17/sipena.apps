<div>
    <h1 class="mb-2 text-lg font-semibold text-slate-800">Ganti Password Wajib</h1>
    <p class="mb-6 text-sm text-slate-500">Demi keamanan, Anda wajib mengganti password sebelum melanjutkan.</p>

    <form wire:submit="submit" class="space-y-4">
        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Password Baru</label>
            <input type="password" wire:model="password" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" autofocus>
            @error('password') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Konfirmasi Password Baru</label>
            <input type="password" wire:model="password_confirmation" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
        </div>

        <button type="submit" class="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800" wire:loading.attr="disabled">
            Simpan Password Baru
        </button>
    </form>
</div>
