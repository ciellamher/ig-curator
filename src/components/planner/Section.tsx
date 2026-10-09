"use client"

export function Section({
  title,
  subtitle,
  actions,
  children,
  id,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  id?: string
}) {
  return (
    <section id={id} aria-label={title} className="bg-white border border-soft-200 rounded-2xl p-3 sm:p-4 flex flex-col gap-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h2>
        {subtitle && <span className="text-xs text-zinc-400">{subtitle}</span>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  counts,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
  counts?: Partial<Record<T, number>>
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 border-b border-soft-200 -mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 pb-2 pt-1 text-sm border-b-2 -mb-px transition-colors cursor-pointer ${
            value === t.id ? "border-zinc-900 text-zinc-900 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          {t.label}
          {counts?.[t.id] !== undefined && <span className="text-xs text-zinc-400 tabular-nums">{counts[t.id]}</span>}
        </button>
      ))}
    </div>
  )
}
