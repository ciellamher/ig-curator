"use client"

import { useState } from "react"
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react"
import { DASHBOARD_NAV } from "@/config/dashboardNav"
import type { QuickLinkDTO, QuickLinkInput } from "@/lib/planner/types"
import { Section } from "./Section"
import type { Planner } from "./usePlanner"

export function DashboardNav() {
  return (
    <Section title="Navigation">
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-3">
        {DASHBOARD_NAV.map((group) => (
          <div key={group.label}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">{group.label}</h3>
            <ul className="flex flex-col">
              {group.links.map((l) => (
                <li key={l.label}>
                  {l.href ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="block text-sm text-zinc-700 hover:text-zinc-900 hover:bg-soft-50 rounded-md px-1.5 py-1 -mx-1.5">
                      {l.label}
                    </a>
                  ) : (
                    <span title="Set this link in src/config/dashboardNav.ts" className="block text-sm text-zinc-400 px-1.5 py-1 -mx-1.5 cursor-not-allowed">
                      {l.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

function LinkForm({ initial, onSave, onCancel }: { initial?: QuickLinkDTO; onSave: (v: QuickLinkInput) => Promise<string | null>; onCancel: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const input = "w-full h-9 px-2.5 rounded-lg border border-soft-200 bg-white text-base sm:text-sm focus:outline-none focus:border-zinc-900"
  return (
    <form
      className="flex flex-col gap-1.5 rounded-xl border border-soft-200 p-2.5 bg-soft-50"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        setSaving(true)
        const err = await onSave({ name: String(f.get("name")), url: String(f.get("url")), text: String(f.get("text")) })
        setSaving(false)
        if (err) setError(err)
        else onCancel()
      }}
    >
      <input name="name" required defaultValue={initial?.name} placeholder="Name" aria-label="Name" className={input} autoFocus />
      <input name="url" required type="url" defaultValue={initial?.url} placeholder="https://…" aria-label="URL" className={input} />
      <input name="text" defaultValue={initial?.text} placeholder="Description (optional)" aria-label="Text" className={input} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-1.5 justify-end">
        <button type="button" onClick={onCancel} className="px-3 h-8 rounded-full text-xs font-semibold text-zinc-600 hover:bg-soft-200 cursor-pointer">
          Cancel
        </button>
        <button disabled={saving} className="px-3 h-8 rounded-full text-xs font-semibold bg-zinc-900 text-white disabled:opacity-50 cursor-pointer">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  )
}

/** Quick Links ("Navigations" view): small cards sorted by name. */
export function QuickLinks({ planner, onDelete }: { planner: Planner; onDelete: (link: QuickLinkDTO) => void }) {
  const [editing, setEditing] = useState<string | "new" | null>(null)

  return (
    <Section
      title="Quick Links"
      subtitle="Navigations"
      actions={
        <button onClick={() => setEditing("new")} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-soft-100 cursor-pointer" aria-label="Add link">
          <Plus size={16} />
        </button>
      }
    >
      {editing === "new" && <LinkForm onSave={(v) => planner.saveLink(v)} onCancel={() => setEditing(null)} />}
      <div className="grid grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
        {planner.links.map((l) =>
          editing === l.id ? (
            <div key={l.id} className="col-span-full">
              <LinkForm initial={l} onSave={(v) => planner.saveLink(v, l.id)} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <div key={l.id} className="group relative rounded-xl border border-soft-200 p-2.5 hover:border-soft-300 hover:shadow-sm transition-all min-w-0">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-zinc-900 break-words pr-10">{l.name}</span>
                <span className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                  <ExternalLink size={10} className="shrink-0" />
                  {l.url.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
                {l.text && <span className="text-xs text-zinc-500 break-words">{l.text}</span>}
              </a>
              <div className="absolute top-1.5 right-1.5 flex lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100">
                <button onClick={() => setEditing(l.id)} className="p-1 rounded text-zinc-400 hover:text-zinc-900 hover:bg-soft-100 cursor-pointer" aria-label={`Edit ${l.name}`}>
                  <Pencil size={12} />
                </button>
                <button onClick={() => onDelete(l)} className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 cursor-pointer" aria-label={`Delete ${l.name}`}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
      {planner.links.length === 0 && editing !== "new" && <p className="text-sm text-zinc-400">No links yet.</p>}
    </Section>
  )
}
