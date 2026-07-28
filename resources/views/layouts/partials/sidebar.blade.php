<aside class="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
    <div class="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <span class="text-lg font-bold text-emerald-700">SIPENA</span>
    </div>
    <nav class="space-y-1 px-3 py-4">
        @foreach (auth()->user()->visibleMenus() as $menu)
            <a href="{{ $menu['path'] }}"
               class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 {{ request()->is(ltrim($menu['path'], '/').'*') ? 'bg-emerald-50 text-emerald-700' : '' }}">
                {{ $menu['label'] }}
            </a>
        @endforeach
    </nav>
</aside>
