export default function DashboardLoading() {
  return (
    <div className="min-h-full min-w-0 bg-slate-50/80 px-3 py-3 dark:bg-slate-950 sm:px-4 sm:py-4 lg:px-5 xl:px-6">
      <div className="mx-auto w-full max-w-[92rem] animate-pulse space-y-5">
        <div className="space-y-2 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-7 w-56 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-full max-w-xl rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 rounded-lg border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70" />
          ))}
        </div>
        <div className="h-80 rounded-lg border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70" />
      </div>
    </div>
  )
}
