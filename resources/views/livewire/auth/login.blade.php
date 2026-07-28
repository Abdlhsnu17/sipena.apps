<div>
    <h1 class="mb-6 text-lg font-semibold text-slate-800">Masuk ke Akun</h1>

    <form wire:submit="submit" class="space-y-4">
        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">NIP atau Email</label>
            <input type="text" wire:model="identifier"
                   class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                   autofocus>
            @error('identifier')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input type="password" wire:model="password"
                   class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            @error('password')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" wire:model="remember" class="rounded border-slate-300">
            Ingat saya
        </label>

        <button type="submit"
                class="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                wire:loading.attr="disabled">
            Masuk
        </button>
    </form>

    <div class="mt-4 flex justify-between text-sm">
        <a href="{{ route('register') }}" class="text-emerald-700 hover:underline">Daftar akun</a>
        <a href="{{ route('password.request') }}" class="text-emerald-700 hover:underline">Lupa password?</a>
    </div>
</div>
