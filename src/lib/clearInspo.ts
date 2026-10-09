import type { SlotItem } from "@/types";

const LOCAL = "local-media://";

/** Splits the feed into inspo (boards, sub-boards and everything inside them) and everything else. */
export function splitInspo(items: SlotItem[]): { keep: SlotItem[]; removed: SlotItem[]; mediaToDelete: string[] } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const isInspo = (item: SlotItem): boolean => {
    const seen = new Set<string>();
    let cur: SlotItem | undefined = item;
    while (cur && !seen.has(cur.id)) {
      if (cur.contentType?.startsWith("Inspo")) return true;
      seen.add(cur.id);
      cur = cur.folderId ? byId.get(cur.folderId) : undefined;
    }
    return false;
  };
  const keep: SlotItem[] = [];
  const removed: SlotItem[] = [];
  for (const i of items) (isInspo(i) ? removed : keep).push(i);

  // Only delete photo files that nothing outside Inspo still uses
  const stillUsed = new Set(keep.flatMap((i) => i.urls ?? []));
  const mediaToDelete = [...new Set(removed.flatMap((i) => i.urls ?? []))]
    .filter((u) => u.startsWith(LOCAL) && !stillUsed.has(u))
    .map((u) => u.slice(LOCAL.length));
  return { keep, removed, mediaToDelete };
}
