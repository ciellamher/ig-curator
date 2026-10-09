import type { SlotItem } from "@/types";

const LOCAL = "local-media://";

type Split = { keep: SlotItem[]; removed: SlotItem[]; mediaToDelete: string[] };

/** Splits the feed into inspo (boards, sub-boards and everything inside them) and everything else. */
export function splitInspo(items: SlotItem[]): Split {
  const byId = new Map(items.map((i) => [i.id, i]));
  return splitBy(items, (item) => {
    const seen = new Set<string>();
    let cur: SlotItem | undefined = item;
    while (cur && !seen.has(cur.id)) {
      if (cur.contentType?.startsWith("Inspo")) return true;
      seen.add(cur.id);
      cur = cur.folderId ? byId.get(cur.folderId) : undefined;
    }
    return false;
  });
}

/** Splits the feed into draft boxes and everything else. */
export function splitDrafts(items: SlotItem[]): Split {
  return splitBy(items, (item) => item.folderId === "draft-pool");
}

function splitBy(items: SlotItem[], remove: (item: SlotItem) => boolean): Split {
  const keep: SlotItem[] = [];
  const removed: SlotItem[] = [];
  for (const i of items) (remove(i) ? removed : keep).push(i);

  // Only delete photo files that nothing outside Inspo still uses
  const stillUsed = new Set(keep.flatMap((i) => i.urls ?? []));
  const mediaToDelete = [...new Set(removed.flatMap((i) => i.urls ?? []))]
    .filter((u) => u.startsWith(LOCAL) && !stillUsed.has(u))
    .map((u) => u.slice(LOCAL.length));
  return { keep, removed, mediaToDelete };
}
