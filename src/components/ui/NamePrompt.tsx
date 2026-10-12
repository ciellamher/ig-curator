"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Ask = { title: string; placeholder?: string; confirmLabel?: string };

/** Asks for a name before something is made, so nothing is left untitled. Cancel or Escape makes nothing. */
function NamePrompt({ ask, onDone }: { ask: Ask; onDone: (name: string | null) => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/30 backdrop-blur-sm" onClick={() => onDone(null)}>
      <form
        role="dialog"
        aria-label={ask.title}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onDone(name.trim());
        }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{ask.title}</h3>
          <button type="button" onClick={() => onDone(null)} aria-label="Cancel" className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={ask.placeholder ?? "Name"}
          aria-label="Name"
          maxLength={80}
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm outline-none focus:border-zinc-950"
        />
        <div className="flex gap-3">
          <button type="button" onClick={() => onDone(null)} className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-soft-100 hover:bg-soft-200 rounded-xl cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-slate-900 hover:bg-black text-white disabled:opacity-40 cursor-pointer">
            {ask.confirmLabel ?? "Create"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

/** `askName(...)` resolves to the name typed, or null when cancelled. Render `namePrompt` once. */
export function useNamePrompt() {
  const [pending, setPending] = useState<(Ask & { resolve: (name: string | null) => void }) | null>(null);
  const askName = useCallback((ask: Ask) => new Promise<string | null>((resolve) => setPending({ ...ask, resolve })), []);
  const onDone = useCallback(
    (name: string | null) => {
      pending?.resolve(name);
      setPending(null);
    },
    [pending],
  );
  const namePrompt = pending ? <NamePrompt ask={pending} onDone={onDone} /> : null;
  return { askName, namePrompt };
}
