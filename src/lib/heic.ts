// iPhone photos (HEIC/HEIF) only show in Safari, so they're turned into JPEGs: when added, and (for ones saved before)
// the first time they're shown. The converter is large, so it's loaded only when a HEIC photo turns up.

const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const HEIC_NAME = /\.(heic|heif)$/i;

/** By type or file name (Chrome on Windows reports no type for them). */
export function looksHeic(file: { type: string; name?: string }): boolean {
  return HEIC_TYPES.has(file.type.toLowerCase()) || HEIC_NAME.test(file.name ?? "");
}

/** By the file's own bytes ("ftypheic", "ftypmif1", …), for photos saved without a reliable type. */
export async function isHeicBlob(blob: Blob): Promise<boolean> {
  if (HEIC_TYPES.has(blob.type.toLowerCase())) return true;
  if (blob.type && !blob.type.startsWith("image/") && blob.type !== "application/octet-stream") return false;
  const head = new TextDecoder().decode(await blob.slice(4, 12).arrayBuffer());
  return /^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(head);
}

/** The photo as a JPEG; the original if it can't be converted (Safari can still show it). */
export async function heicToJpeg(blob: Blob): Promise<Blob> {
  try {
    const { heicTo } = await import("heic-to/next");
    return await heicTo({ blob, type: "image/jpeg", quality: 0.92 });
  } catch (err) {
    console.warn("Couldn't convert a HEIC photo:", err);
    return blob;
  }
}

/** A picked or dropped file, with HEIC turned into JPEG. */
export async function normalizeImageFile(file: File): Promise<File> {
  if (!looksHeic(file)) return file;
  const jpeg = await heicToJpeg(file);
  if (jpeg === file) return file;
  return new File([jpeg], file.name.replace(HEIC_NAME, "") + ".jpg", { type: "image/jpeg" });
}
