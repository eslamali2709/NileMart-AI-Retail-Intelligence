export function PageHeading({ title, description, badge = "Placeholder" }: { title: string; description: string; badge?: string }) {
  return (
    <div className="mb-8">
      <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-emerald-800 uppercase">Retail intelligence workspace</p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <span className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">{badge}</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}
