// Dragging inspo photos onto the phone: into a post or reel, between boxes (new posts), or into a story folder.

/** Data type carrying the dragged photos' addresses (JSON string array). */
export const PHOTO_DRAG_TYPE = "application/x-ig-curator-photos";

export type PhotoDropMode = "into" | "before" | "after";

export function isPhotoDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(PHOTO_DRAG_TYPE);
}

export function droppedPhotos(e: React.DragEvent): string[] {
  try {
    const urls = JSON.parse(e.dataTransfer.getData(PHOTO_DRAG_TYPE) || "[]");
    return Array.isArray(urls) ? urls.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
  } catch {
    return [];
  }
}

/** Where a photo dropped on a box goes: its outer edges insert new boxes beside it, the middle adds to it. */
export function dropModeAt(e: React.DragEvent, el: HTMLElement): PhotoDropMode {
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  return x < 0.25 ? "before" : x > 0.75 ? "after" : "into";
}

const FOLDER_TYPES = new Set(["StoryFolder", "InspoFolder", "PlaceholderFolder"]);

/** Ids of the items a drag came from (inspo photos, stories, drafts), so a drop can move them instead of copying. */
export function draggedItemIds(e: React.DragEvent): string[] {
  const ids: string[] = [];
  try {
    const many = JSON.parse(e.dataTransfer.getData("application/folder-ids") || "[]");
    if (Array.isArray(many)) ids.push(...many.filter((id): id is string => typeof id === "string"));
  } catch {}
  ids.push(
    e.dataTransfer.getData("application/folder-id"),
    e.dataTransfer.getData("application/x-ig-curator-story-id") || e.dataTransfer.getData("application/x-ig-curator-story"),
  );
  return Array.from(new Set(ids.filter(Boolean)));
}

/**
 * Moving, not copying: removes the dragged items from where they were. Boards and folders are never removed (only
 * the photos and stories dragged out of them), and neither is anything already in the folder they were dropped into.
 */
export function withoutMoved<T extends { id: string; contentType?: string; folderId?: string }>(items: T[], ids: string[], intoFolderId?: string): T[] {
  if (!ids.length) return items;
  const moved = new Set(ids);
  return items.filter((i) => !moved.has(i.id) || FOLDER_TYPES.has(i.contentType ?? "") || (intoFolderId !== undefined && i.folderId === intoFolderId));
}

/** True when every dragged item already sits in `folderId` (a drop back where it came from does nothing). */
export function alreadyIn<T extends { id: string; folderId?: string }>(items: T[], ids: string[], folderId: string): boolean {
  return ids.length > 0 && ids.every((id) => items.find((i) => i.id === id)?.folderId === folderId);
}
