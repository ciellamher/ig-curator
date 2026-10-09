"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Download, History, LifeBuoy, X } from "lucide-react";
import { getFeedBackup, getMediaBlob, listFeedBackups, listMediaIds, saveFeedBackup, type FeedBackup } from "@/lib/idb";
import { LocalMediaImage } from "./LocalMedia";
import { SlotItem } from "@/types";

const LOCAL = "local-media://";

/** Upload time encoded in a stored media id (media-image-<timestamp>-<random>). */
function mediaTime(id: string): number {
  return Number(id.match(/^media-(?:image|video)-(\d+)-/)?.[1] ?? 0);
}

function referencedIds(items: SlotItem[]): Set<string> {
  const ids = new Set<string>();
  for (const i of items) for (const u of i.urls ?? []) if (u.startsWith(LOCAL)) ids.add(u.slice(LOCAL.length));
  return ids;
}

/** Photos saved in this browser that no feed box uses (e.g. after the layout was replaced). */
export function useOrphanPhotos(items: SlotItem[], ready: boolean) {
  const [orphans, setOrphans] = useState<string[]>([]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(async () => {
      const used = referencedIds(items);
      const all = await listMediaIds();
      setOrphans(all.filter((id) => !used.has(id)).sort((a, b) => mediaTime(b) - mediaTime(a)));
    }, 800);
    return () => clearTimeout(t);
  }, [items, ready]);
  return orphans;
}

// ---- ZIP export ----

function slug(s: string) {
  return s.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "photo";
}

function extFor(type: string, url: string) {
  const map: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
  return map[type] ?? (url.includes("video") ? "mp4" : "jpg");
}

/** Folder inside the ZIP for a feed box: Posts, Reels, Drafts, Stories/<folder>, Inspo/<board>/<sub-board>. */
function folderFor(item: SlotItem, byId: Map<string, SlotItem>): string {
  if (item.folderId === "draft-pool") return "Drafts";
  const chain: SlotItem[] = [];
  let f = item.folderId ? byId.get(item.folderId) : undefined;
  const seen = new Set<string>();
  while (f && !seen.has(f.id)) {
    seen.add(f.id);
    chain.unshift(f);
    f = f.folderId ? byId.get(f.folderId) : undefined;
  }
  const names = chain.map((c) => slug(c.text || c.caption || "Folder"));
  if (chain[0]?.contentType === "StoryFolder" || item.contentType === "Story") return ["Stories", ...names].join("/");
  if (chain[0]?.contentType === "InspoFolder" || item.contentType?.startsWith("Inspo")) return ["Inspo", ...names].join("/");
  if (item.contentType === "Reel") return "Reels";
  return "Posts";
}

async function blobFor(url: string): Promise<Blob | null> {
  try {
    if (url.startsWith(LOCAL)) return await getMediaBlob(url.slice(LOCAL.length));
    return await (await fetch(url)).blob();
  } catch {
    return null;
  }
}

export async function downloadAllPhotos(items: SlotItem[], onProgress: (done: number, total: number) => void): Promise<{ saved: number; failed: number }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const byId = new Map(items.map((i) => [i.id, i]));
  const used = new Set<string>();
  const jobs: { url: string; path: string }[] = [];
  const counters = new Map<string, number>();

  for (const item of items) {
    const urls = (item.urls ?? []).filter(Boolean);
    if (!urls.length) continue;
    const folder = folderFor(item, byId);
    const n = (counters.get(folder) ?? 0) + 1;
    counters.set(folder, n);
    const base = `${String(n).padStart(3, "0")}-${slug(item.text || item.caption?.split("\n")[0] || item.contentType || "photo")}`;
    urls.forEach((url, i) => {
      jobs.push({ url, path: `${folder}/${base}${urls.length > 1 ? `-${i + 1}` : ""}` });
      if (url.startsWith(LOCAL)) used.add(url.slice(LOCAL.length));
    });
  }
  // Photos in this browser that no box uses
  const orphans = (await listMediaIds()).filter((id) => !used.has(id)).sort((a, b) => mediaTime(a) - mediaTime(b));
  orphans.forEach((id, i) => jobs.push({ url: LOCAL + id, path: `Not in feed/${String(i + 1).padStart(3, "0")}-${new Date(mediaTime(id) || Date.now()).toISOString().slice(0, 10)}` }));

  let saved = 0;
  let failed = 0;
  for (let i = 0; i < jobs.length; i++) {
    const blob = await blobFor(jobs[i].url);
    if (blob) {
      zip.file(`${jobs[i].path}.${extFor(blob.type, jobs[i].url)}`, blob, { binary: true });
      saved++;
    } else failed++;
    onProgress(i + 1, jobs.length);
  }
  // Photos are already compressed, so store them as-is (much faster)
  const out = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(out);
  a.download = `ig-curator-photos-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return { saved, failed };
}

// ---- Vault dialog ----

type Target = "grid" | "drafts" | "inspo";

export function PhotoVault({
  items,
  orphans,
  onClose,
  onRestorePhotos,
  onRestoreLayout,
}: {
  items: SlotItem[];
  orphans: string[];
  onClose: () => void;
  onRestorePhotos: (boxes: SlotItem[]) => void;
  onRestoreLayout: (items: SlotItem[]) => void;
}) {
  const [tab, setTab] = useState<"recover" | "backups">(orphans.length ? "recover" : "backups");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(orphans));
  const [target, setTarget] = useState<Target>("grid");
  const [backups, setBackups] = useState<FeedBackup[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    listFeedBackups().then(setBackups).catch(() => setBackups([]));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const allSelected = selected.size === orphans.length && orphans.length > 0;
  const chosen = useMemo(() => orphans.filter((id) => selected.has(id)), [orphans, selected]);

  const restore = () => {
    const stamp = Date.now();
    let folderId: string | undefined;
    const boxes: SlotItem[] = [];
    if (target === "inspo") {
      folderId = `folder-inspo-recovered-${stamp}`;
      boxes.push({ id: folderId, type: "placeholder", urls: [], currentUrlIndex: 0, hexColor: "#E4E4E7", text: "Recovered photos", contentType: "InspoFolder" });
    }
    chosen.forEach((id, i) => {
      const video = id.startsWith("media-video");
      boxes.push({
        id: `slot-recovered-${stamp}-${i}`,
        type: "image",
        urls: [LOCAL + id],
        currentUrlIndex: 0,
        hexColor: "#E4E4E7",
        text: "",
        contentType: target === "inspo" ? "InspoPost" : video ? "Reel" : "Post",
        ...(target === "drafts" ? { folderId: "draft-pool" } : folderId ? { folderId } : {}),
      });
    });
    onRestorePhotos(boxes);
    onClose();
  };

  const tabBtn = (id: "recover" | "backups", label: string, Icon: typeof LifeBuoy) => (
    <button
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold cursor-pointer ${tab === id ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
    >
      <Icon size={13} /> {label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Photo backup and recovery"
        className="fixed z-[95] inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[640px] sm:max-h-[85dvh] sm:rounded-3xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 pb-safe"
      >
        <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-zinc-100">
          <Archive size={18} />
          <h2 className="text-base font-semibold text-zinc-950">Photos &amp; backups</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto p-1.5 rounded-full text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-zinc-100">
          {tabBtn("recover", `Recover photos (${orphans.length})`, LifeBuoy)}
          {tabBtn("backups", "Layout backups", History)}
          <button
            disabled={!!progress}
            onClick={async () => {
              setProgress("Preparing…");
              const res = await downloadAllPhotos(items, (d, t) => setProgress(`Packing ${d} of ${t}…`));
              setProgress(res.failed ? `Downloaded ${res.saved} · ${res.failed} couldn't be read` : null);
              if (!res.failed) setTimeout(() => setProgress(null), 0);
            }}
            className="ml-auto inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border border-zinc-300 hover:border-zinc-950 disabled:opacity-60 cursor-pointer"
          >
            <Download size={13} /> {progress ?? "Download all photos (.zip)"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "recover" ? (
            orphans.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Every photo saved in this browser is in your feed. Nothing to recover.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-600">
                  These {orphans.length} photos are saved in this browser but aren&apos;t in any feed box. Pick the ones to put back (newest first).
                </p>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" className="w-4 h-4 accent-zinc-950" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(orphans))} />
                  Select all
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {orphans.map((id) => {
                    const on = selected.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => setSelected((s) => {
                          const next = new Set(s);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        })}
                        aria-pressed={on}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer ring-2 ${on ? "ring-zinc-950" : "ring-transparent opacity-60"}`}
                      >
                        {id.startsWith("media-video") ? (
                          <div className="w-full h-full bg-zinc-900 text-white text-[10px] flex items-center justify-center">Video</div>
                        ) : (
                          <LocalMediaImage src={LOCAL + id} className="w-full h-full object-cover" />
                        )}
                        {on && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-zinc-950 text-white text-[10px] flex items-center justify-center">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ) : backups === null ? (
            <p className="py-8 text-center text-sm text-zinc-400">Loading…</p>
          ) : backups.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No layout backups yet. From now on a snapshot of your feed is kept every day and before anything replaces it.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {backups.map((b) => (
                <li key={b.key} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-950">{new Date(b.savedAt).toLocaleString()}</div>
                    <div className="text-xs text-zinc-500">{b.count} boxes · {b.reason}</div>
                  </div>
                  <button
                    onClick={async () => {
                      const snapshot = await getFeedBackup<SlotItem>(b.key);
                      if (!snapshot) return;
                      await saveFeedBackup(items, "before restoring a backup");
                      onRestoreLayout(snapshot);
                      onClose();
                    }}
                    className="ml-auto px-3 h-8 rounded-full text-xs font-semibold bg-zinc-950 text-white hover:bg-black cursor-pointer"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {tab === "recover" && orphans.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Put back into</span>
            {(
              [
                ["grid", "Posts grid"],
                ["drafts", "Drafts"],
                ["inspo", "New Inspo board"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTarget(id)}
                aria-pressed={target === id}
                className={`px-3 h-8 rounded-full text-xs font-semibold border cursor-pointer ${target === id ? "bg-zinc-950 text-white border-zinc-950" : "border-zinc-200 text-zinc-700 hover:border-zinc-400"}`}
              >
                {label}
              </button>
            ))}
            <button
              disabled={!chosen.length}
              onClick={restore}
              className="ml-auto px-4 h-9 rounded-full text-sm font-semibold bg-zinc-950 text-white hover:bg-black disabled:opacity-40 cursor-pointer"
            >
              Restore {chosen.length} photo{chosen.length === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
