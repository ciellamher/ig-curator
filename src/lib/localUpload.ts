/** Saves picked photos/videos in this browser (IndexedDB) and returns their local-media:// addresses. */
export async function saveFilesLocally(files: File[]): Promise<string[]> {
  const { saveMediaBlob } = await import("@/lib/idb");
  const urls: string[] = [];
  for (const file of files) {
    try {
      const prefix = file.type.startsWith("video/") ? "video" : "image";
      const id = `media-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      // A plain Blob copy, so the photo doesn't depend on the original file still being there after a refresh
      await saveMediaBlob(id, new Blob([await file.arrayBuffer()], { type: file.type }));
      urls.push(`local-media://${id}`);
    } catch (e) {
      console.error("Failed to save media to IDB:", e);
    }
  }
  return urls;
}
