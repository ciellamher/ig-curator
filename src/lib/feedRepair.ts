import type { SlotItem } from "@/types";

/**
 * Undoes the damage of a sync loop (Oct 9, 2026) that re-sent every planner page's photos to the feed on each
 * load: boxes got the same photos appended again and again, story folders got the same stories again, and a bogus
 * box with the id "true" could appear. Removes only exact repeats; the first copy of everything is kept.
 */
export function removeRepeatedPhotos(items: SlotItem[]): { items: SlotItem[]; changed: boolean } {
  let changed = false;
  const seenInFolder = new Map<string, Set<string>>();
  const out: SlotItem[] = [];
  for (const item of items) {
    if (item.id === "true" || (item.contentType as string) === "hiddenFromFeed") {
      changed = true;
      continue;
    }
    // A story added by the planner (one photo) that its folder already has
    if (item.folderId && item.id.startsWith("story-") && item.urls?.length === 1) {
      const seen = seenInFolder.get(item.folderId) ?? new Set<string>();
      seenInFolder.set(item.folderId, seen);
      if (seen.has(item.urls[0])) {
        changed = true;
        continue;
      }
      seen.add(item.urls[0]);
    }
    const urls = item.urls ?? [];
    const unique = [...new Set(urls)];
    if (unique.length !== urls.length) {
      changed = true;
      out.push({ ...item, urls: unique, currentUrlIndex: Math.min(item.currentUrlIndex ?? 0, Math.max(0, unique.length - 1)) });
    } else out.push(item);
  }
  return { items: changed ? out : items, changed };
}
