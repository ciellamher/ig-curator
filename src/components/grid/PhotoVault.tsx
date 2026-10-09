"use client";

import { useEffect, useState } from "react";
import { Archive, Download, History, X } from "lucide-react";
import { getFeedBackup, getMediaBlob, listFeedBackups, listMediaIds, saveFeedBackup, type FeedBackup } from "@/lib/idb";
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

// ---- Photos & backups dialog ----

export function PhotoVault({
  items,
  onClose,
  onRestoreLayout,
}: {
  items: SlotItem[];
  onClose: () => void;
  onRestoreLayout: (items: SlotItem[]) => void;
}) {
  const [backups, setBackups] = useState<FeedBackup[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    listFeedBackups().then(setBackups).catch(() => setBackups([]));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Photos and backups"
        className="fixed z-[95] inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] sm:max-h-[85dvh] sm:rounded-3xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 pb-safe"
      >
        <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-zinc-100">
          <Archive size={18} />
          <h2 className="text-base font-semibold text-zinc-950">Photos &amp; backups</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto p-1.5 rounded-full text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-zinc-100 flex flex-col gap-2">
          <p className="text-sm text-zinc-600">Save every photo and video to your computer, organised into Posts, Reels, Stories, Drafts and Inspo folders.</p>
          <button
            disabled={!!progress}
            onClick={async () => {
              setProgress("Preparing…");
              const res = await downloadAllPhotos(items, (d, t) => setProgress(`Packing ${d} of ${t}…`));
              setProgress(res.failed ? `Downloaded ${res.saved} · ${res.failed} couldn't be read` : null);
            }}
            className="self-start inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold bg-zinc-950 text-white hover:bg-black disabled:opacity-60 cursor-pointer"
          >
            <Download size={14} /> {progress ?? "Download all photos (.zip)"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <History size={13} /> Layout backups
          </h3>
          {backups === null ? (
            <p className="py-4 text-sm text-zinc-400">Loading…</p>
          ) : backups.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">A snapshot of your feed layout is kept every day and before anything replaces it.</p>
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
      </div>
    </>
  );
}
