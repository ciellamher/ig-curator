// A page that is both a story and a post (or reel) has a story folder and a grid box; they always hold the same photos.

import type { SlotItem } from "@/types";

const isVideo = (url: string) => url.includes("-video-") || url.startsWith("data:video");

/** The photos a box shows: a story folder's are its stories', in order. */
export function slotPhotos(items: SlotItem[], id: string): string[] {
  const item = items.find((i) => i.id === id);
  if (!item) return [];
  if (item.contentType === "StoryFolder") return items.filter((i) => i.folderId === id).flatMap((i) => i.urls?.slice(0, 1) ?? []);
  return item.urls ?? [];
}

/**
 * Gives a box exactly these photos. In a story folder, stories already holding one of them are kept as they are
 * (same id, text and settings) and put in this order; new photos become new stories; empty stories stay at the end.
 */
export function withSlotPhotos(items: SlotItem[], id: string, urls: string[]): SlotItem[] {
  const item = items.find((i) => i.id === id);
  if (!item) return items;
  if (item.contentType !== "StoryFolder") {
    const type: SlotItem["type"] = !urls.length ? "placeholder" : item.type === "placeholder" ? (isVideo(urls[0]) ? "video" : "image") : item.type;
    return items.map((i) => (i.id === id ? { ...i, urls, type, currentUrlIndex: Math.min(i.currentUrlIndex ?? 0, Math.max(0, urls.length - 1)) } : i));
  }
  const old = items.filter((i) => i.folderId === id);
  const unused = [...old];
  const stories = urls.map((url, n) => {
    const at = unused.findIndex((s) => s.urls?.[0] === url);
    if (at !== -1) return unused.splice(at, 1)[0];
    return {
      id: `story-${Date.now().toString(36)}-${n}-${Math.random().toString(36).slice(2, 6)}`,
      type: isVideo(url) ? "video" : "image",
      urls: [url],
      currentUrlIndex: 0,
      hexColor: "#E4E4E7",
      text: "",
      contentType: "Story",
      folderId: id,
    } satisfies SlotItem;
  });
  const ordered = [...stories, ...unused.filter((s) => !s.urls?.length)];
  const first = items.findIndex((i) => i.folderId === id);
  const rest = items.filter((i) => i.folderId !== id);
  const at = first === -1 ? rest.length : items.slice(0, first).filter((i) => i.folderId !== id).length;
  return [...rest.slice(0, at), ...ordered, ...rest.slice(at)];
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((u, n) => u === b[n]);

/** After a change: whichever linked box's photos changed, the others in its group follow. */
export function syncLinked(prev: SlotItem[], next: SlotItem[], groups: string[][]): SlotItem[] {
  let out = next;
  for (const group of groups) {
    const present = group.filter((id) => out.some((i) => i.id === id));
    if (present.length < 2) continue;
    const changed = present.find((id) => !same(slotPhotos(prev, id), slotPhotos(out, id)));
    if (!changed) continue;
    const urls = slotPhotos(out, changed);
    for (const id of present) if (!same(slotPhotos(out, id), urls)) out = withSlotPhotos(out, id, urls);
  }
  return out;
}

/** When the links are first known: linked boxes that differ get every photo either has (nothing is lost). */
export function mergeLinked(items: SlotItem[], groups: string[][]): SlotItem[] {
  let out = items;
  for (const group of groups) {
    const present = group.filter((id) => out.some((i) => i.id === id));
    if (present.length < 2) continue;
    // The story folder's order first, then anything only the post has
    const ordered = [...present].sort((a, b) => Number(out.find((i) => i.id === b)?.contentType === "StoryFolder") - Number(out.find((i) => i.id === a)?.contentType === "StoryFolder"));
    const urls = [...new Set(ordered.flatMap((id) => slotPhotos(out, id)))];
    for (const id of present) if (!same(slotPhotos(out, id), urls)) out = withSlotPhotos(out, id, urls);
  }
  return out;
}
