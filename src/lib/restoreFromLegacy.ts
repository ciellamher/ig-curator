// One-time restore after the Oct 9 layout overwrite. The previous layout was lost, but this browser still holds
// (1) the feed as of the old "ig-curator-db" storage, with every inspo board and its photos embedded, and
// (2) every photo/video file added since. This rebuilds the boards from (1), matches their photos to the files in
// (2) — identical bytes first, then by appearance — and puts every remaining photo into Drafts.

import { getMediaBlob, listMediaIds, saveFeedBackup, saveMediaBlob, setItem as saveState } from "@/lib/idb";
import type { SlotItem } from "@/types";

export const RESTORE_FLAG = "ig-curator-restored-2026-10-09";
const LEGACY_DB = "ig-curator-db";
const LEGACY_STORE = "store";
const LEGACY_KEY = "ig-curator-items";
const LOCAL = "local-media://";
const APPEARANCE_THRESHOLD = 6; // max differing bits out of 64

export type RestoreProgress = { stage: string; done: number; total: number };
export type RestoreSummary = { boards: number; boardPhotos: number; matched: number; imported: number; drafts: number };

async function readLegacyFeed(): Promise<SlotItem[] | null> {
  // Only open the old database if it exists (opening would otherwise create it).
  const dbs = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
  if (!dbs.some((d) => d.name === LEGACY_DB)) return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(LEGACY_DB);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE)) {
        db.close();
        return resolve(null);
      }
      const get = db.transaction(LEGACY_STORE, "readonly").objectStore(LEGACY_STORE).get(LEGACY_KEY);
      get.onsuccess = () => {
        db.close();
        resolve(Array.isArray(get.result) ? get.result : null);
      };
      get.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

async function sha1(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 64-bit difference hash: survives resizing and re-compression, so resaved copies still match. */
async function appearanceHash(blob: Blob): Promise<bigint | null> {
  try {
    const bmp = await createImageBitmap(blob, { resizeWidth: 9, resizeHeight: 8, resizeQuality: "medium" });
    const canvas = new OffscreenCanvas(9, 8);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const px = ctx.getImageData(0, 0, 9, 8).data;
    let hash = BigInt(0);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const a = (y * 9 + x) * 4;
        const b = a + 4;
        const left = px[a] * 0.299 + px[a + 1] * 0.587 + px[a + 2] * 0.114;
        const right = px[b] * 0.299 + px[b + 1] * 0.587 + px[b + 2] * 0.114;
        hash = (hash << BigInt(1)) | (left > right ? BigInt(1) : BigInt(0));
      }
    }
    return hash;
  } catch {
    return null;
  }
}

function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    x &= x - BigInt(1);
    n++;
  }
  return n;
}

function urlsOf(item: SlotItem): unknown[] {
  const u = item.urls as unknown;
  return Array.isArray(u) ? u : u && typeof u === "object" ? Object.values(u as object) : [];
}

function mediaTime(id: string): number {
  return Number(id.match(/^media-(?:image|video)-(\d+)-/)?.[1] ?? 0);
}

export async function hasLegacyFeed(): Promise<boolean> {
  try {
    if (localStorage.getItem(RESTORE_FLAG)) return false;
    const dbs = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    return dbs.some((d) => d.name === LEGACY_DB);
  } catch {
    return false;
  }
}

export async function restoreFromLegacy(
  current: SlotItem[],
  onProgress: (p: RestoreProgress) => void,
): Promise<{ items: SlotItem[]; summary: RestoreSummary } | null> {
  onProgress({ stage: "Reading your saved boards", done: 0, total: 1 });
  const legacy = await readLegacyFeed();
  if (!legacy?.length) return null;
  await saveFeedBackup(current, "before restoring boards and photos");

  // Photo files in this browser that the current feed doesn't use: candidates to put back.
  const used = new Set<string>();
  for (const i of current) for (const u of i.urls ?? []) if (u.startsWith(LOCAL)) used.add(u.slice(LOCAL.length));
  const pool = (await listMediaIds()).filter((id) => !used.has(id));

  // Fingerprint the pool: exact (bytes) and appearance (images)
  const exact = new Map<string, string>();
  const looks: { id: string; hash: bigint }[] = [];
  for (let i = 0; i < pool.length; i++) {
    onProgress({ stage: "Checking your photos", done: i, total: pool.length });
    const blob = await getMediaBlob(pool[i]);
    if (!blob) continue;
    exact.set(await sha1(blob), pool[i]);
    if (blob.type.startsWith("image/")) {
      const h = await appearanceHash(blob);
      if (h !== null) looks.push({ id: pool[i], hash: h });
    }
  }
  const taken = new Set<string>();
  const takeLookalike = (h: bigint): string | null => {
    let best: { id: string; d: number } | null = null;
    for (const c of looks) {
      if (taken.has(c.id)) continue;
      const d = hamming(h, c.hash);
      if (d <= APPEARANCE_THRESHOLD && (!best || d < best.d)) best = { id: c.id, d };
    }
    return best?.id ?? null;
  };

  // Boards: the named ones from the snapshot, plus boards whose names weren't saved
  const legacyFolders = new Map(legacy.filter((i) => i.contentType === "InspoFolder").map((f) => [f.id, f]));
  const posts = legacy.filter((i) => i.contentType === "InspoPost" && i.folderId);
  const unnamed = new Map<string, number>();
  for (const p of posts) if (!legacyFolders.has(p.folderId!)) unnamed.set(p.folderId!, (unnamed.get(p.folderId!) ?? 0) + 1);
  const existingIds = new Set(current.map((i) => i.id));
  const unnamedBoards: SlotItem[] = [...unnamed.entries()]
    .filter(([id]) => !existingIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id], n) => ({ id, type: "placeholder", urls: [], currentUrlIndex: 0, hexColor: "#E4E4E7", text: `Board ${n + 1}`, contentType: "InspoFolder" }));

  const toRestore = [
    ...[...legacyFolders.values()],
    ...posts,
    // Grid posts/reels from the snapshot that aren't already in the feed
    ...legacy.filter((i) => !i.folderId && i.contentType !== "InspoFolder"),
  ].filter((i) => !existingIds.has(i.id));

  let matched = 0;
  let imported = 0;
  let boardPhotos = 0;
  const restored: SlotItem[] = [];
  for (let n = 0; n < toRestore.length; n++) {
    onProgress({ stage: "Putting photos back in their boards", done: n, total: toRestore.length });
    const item = toRestore[n];
    const urls: string[] = [];
    const raw = urlsOf(item);
    for (let k = 0; k < raw.length; k++) {
      const u = raw[k];
      if (typeof u !== "string" || !u) continue;
      if (!u.startsWith("data:")) {
        urls.push(u);
        continue;
      }
      const blob = await (await fetch(u)).blob();
      let id: string | undefined = exact.get(await sha1(blob));
      if (id && taken.has(id)) id = undefined;
      if (!id && blob.type.startsWith("image/")) {
        const h = await appearanceHash(blob);
        if (h !== null) id = takeLookalike(h) ?? undefined;
      }
      if (id) {
        matched++;
      } else {
        id = `media-${blob.type.startsWith("video/") ? "video" : "image"}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        await saveMediaBlob(id, blob);
        imported++;
      }
      taken.add(id);
      urls.push(LOCAL + id);
    }
    if (item.contentType === "InspoPost") boardPhotos += urls.length;
    const urlsDropped = raw as unknown[];
    urlsDropped.length = 0; // release the embedded copy as we go
    restored.push({ ...item, urls, currentUrlIndex: Math.min(item.currentUrlIndex ?? 0, Math.max(0, urls.length - 1)) });
  }

  // Everything else goes into Drafts, newest first
  const leftovers = pool.filter((id) => !taken.has(id)).sort((a, b) => mediaTime(b) - mediaTime(a));
  const stamp = Date.now();
  const drafts: SlotItem[] = leftovers.map((id, n) => ({
    id: `slot-draft-restored-${stamp}-${n}`,
    type: "image",
    urls: [LOCAL + id],
    currentUrlIndex: 0,
    hexColor: "#E4E4E7",
    text: "",
    contentType: id.startsWith("media-video") ? "Reel" : "Post",
    folderId: "draft-pool",
  }));

  const items = [...current, ...unnamedBoards, ...restored, ...drafts];
  onProgress({ stage: "Saving", done: 1, total: 1 });
  await saveState("ig-curator-items", items);
  localStorage.setItem(RESTORE_FLAG, new Date().toISOString());
  return {
    items,
    summary: {
      boards: legacyFolders.size + unnamedBoards.length,
      boardPhotos,
      matched,
      imported,
      drafts: drafts.length,
    },
  };
}
