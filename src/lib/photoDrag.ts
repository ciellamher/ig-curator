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
