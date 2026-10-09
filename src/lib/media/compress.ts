// Shrinks photos before upload. Instagram never displays more than ~1440px, so this keeps full posting quality
// while cutting a typical 3–5 MB phone photo to a few hundred KB.

export const MAX_EDGE = 1440
const QUALITY = 0.82

export async function compressImage(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith("image/") || blob.type === "image/gif" || blob.type === "image/svg+xml") return blob
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(blob) // applies EXIF rotation
  } catch {
    return blob // a format the browser can't decode (e.g. HEIC on some browsers): upload as-is
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))
  let out = await encode("image/webp")
  if (!out || out.type !== "image/webp") out = await encode("image/jpeg") // browsers without WebP encoding
  return out && out.size < blob.size ? out : blob
}

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

export function extensionFor(type: string): string {
  return EXT[type] ?? (type.startsWith("video/") ? "mp4" : "jpg")
}

export function isCloudMediaUrl(url: string): boolean {
  return /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url)
}

/** Photos that still live only in this browser. */
export function isDeviceOnlyMedia(url: string): boolean {
  return url.startsWith("local-media://") || url.startsWith("data:")
}
