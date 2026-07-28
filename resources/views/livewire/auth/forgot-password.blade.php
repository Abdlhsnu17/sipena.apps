<div>
    <h1 class="mb-2 text-lg font-semibold text-slate-800">Lupa Password</h1>
    <p class="mb-6 text-sm text-slate-500">Masukkan NIP Anda. Kode verifikasi akan dikirim melalui WhatsApp/SMS, dengan email sebagai cadangan.</p>

    <form wire:submit="submit" class="space-y-4">
        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">NIP</label>
            <input type="text" wire:model="nip" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" autofocus>
            @error('nip') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <button type="submit" class="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800" wire:loading.attr="disabled">
            Kirim Kode Verifikasi
        </button>
    </form>

    <div class="mt-4 text-center text-sm">
        <a href="{{ route('login') }}" class="text-emerald-700 hover:underline">Kembali ke halaman masuk</a>
    </div>
</div>
