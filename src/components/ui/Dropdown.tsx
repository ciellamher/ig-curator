"use client"

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"

export type DropdownOption = { value: string; label?: string; group?: string }

type Props = {
  label: string
  options: DropdownOption[]
  /** Selected values (one for single-select). */
  selected: string[]
  onSelect: (value: string) => void
  multiple?: boolean
  /** Trigger content; defaults to the selected option's label. */
  trigger?: React.ReactNode
  renderOption?: (o: DropdownOption) => React.ReactNode
  /** "field": bordered input look. "ghost": inline cell look (Notion-style). */
  variant?: "field" | "ghost"
  placeholder?: string
  className?: string
}

/** Accessible listbox dropdown rendered in a portal so table scroll containers can't clip it. */
export function Dropdown({
  label,
  options,
  selected,
  onSelect,
  multiple,
  trigger,
  renderOption,
  variant = "field",
  placeholder = "Select",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number; maxHeight: number; flip: boolean } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 8
    const above = r.top - 8
    // Room for every option (and group headings) so nothing needs scrolling when the screen allows
    const groups = new Set(options.map((o) => o.group).filter(Boolean)).size
    const needed = options.length * 34 + groups * 26 + 10
    const flip = below < needed && above > below
    const width = Math.max(r.width, 180)
    setPos({
      top: flip ? r.top - 4 : r.bottom + 4,
      left: Math.min(r.left, window.innerWidth - width - 8),
      minWidth: width,
      maxHeight: Math.min(needed, flip ? above : below),
      flip,
    })
  }, [options])

  useLayoutEffect(() => {
    if (!open) return
    place()
    const i = options.findIndex((o) => selected.includes(o.value))
    setActive(i === -1 ? 0 : i)
    listRef.current?.focus()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!listRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false)
    }
    window.addEventListener("pointerdown", onDown)
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, place])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  const choose = (value: string) => {
    onSelect(value)
    if (!multiple) close()
  }

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, options.length - 1))
    else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0))
    else if (e.key === "Home") setActive(0)
    else if (e.key === "End") setActive(options.length - 1)
    else if (e.key === "Enter" || e.key === " ") options[active] && choose(options[active].value)
    else if (e.key === "Escape") close()
    else if (e.key === "Tab") return close(false)
    else return
    e.preventDefault()
  }

  const current = options.find((o) => selected.includes(o.value))
  const base =
    variant === "field"
      ? "h-8 px-2.5 rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 text-xs font-medium text-zinc-800"
      : "min-h-7 px-1 rounded-md hover:bg-zinc-100 text-left"

  let lastGroup: string | undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={`inline-flex items-center gap-1.5 max-w-full cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20 ${
          open ? (variant === "field" ? "border-zinc-950" : "bg-zinc-100") : ""
        } ${base} ${className}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {trigger ?? (current ? current.label ?? current.value : <span className="text-zinc-400">{placeholder}</span>)}
        </span>
        {variant === "field" && <ChevronDown size={13} className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            id={id}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            aria-activedescendant={`${id}-${active}`}
            tabIndex={-1}
            onKeyDown={onListKey}
            style={{
              position: "fixed",
              left: pos.left,
              minWidth: pos.minWidth,
              maxHeight: pos.maxHeight,
              ...(pos.flip ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className="z-[120] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.2)] outline-none animate-in fade-in zoom-in-95 duration-100"
          >
            {options.map((o, i) => {
              const isSelected = selected.includes(o.value)
              const header = o.group && o.group !== lastGroup ? o.group : null
              lastGroup = o.group
              return (
                <div key={o.value}>
                  {header && <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{header}</div>}
                  <div
                    id={`${id}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className={`flex items-center justify-between gap-3 px-2 py-1 min-h-8 rounded-lg text-sm cursor-pointer ${i === active ? "bg-zinc-100" : ""}`}
                  >
                    <span className="min-w-0">{renderOption ? renderOption(o) : o.label ?? o.value}</span>
                    <Check size={14} className={`shrink-0 ${isSelected ? "text-zinc-950" : "invisible"}`} />
                  </div>
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
