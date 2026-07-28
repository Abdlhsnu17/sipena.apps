<div>
    <h1 class="mb-6 text-lg font-semibold text-slate-800">Daftar Akun</h1>

    <form wire:submit="submit" class="space-y-4">
        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">NIP</label>
            <input type="text" wire:model="nip" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('nip') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Nama Lengkap</label>
            <input type="text" wire:model="name" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('name') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input type="email" wire:model="email" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('email') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Nomor WhatsApp/SMS</label>
            <input type="text" wire:model="phone_number" placeholder="08xxxxxxxxxx" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('phone_number') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input type="password" wire:model="password" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('password') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Konfirmasi Password</label>
            <input type="password" wire:model="password_confirmation" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
        </div>

        <button type="submit" class="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800" wire:loading.attr="disabled">
            Daftar
        </button>
    </form>

    <div class="mt-4 text-center text-sm">
        <a href="{{ route('login') }}" class="text-emerald-700 hover:underline">Sudah punya akun? Masuk</a>
    </div>
</div>
