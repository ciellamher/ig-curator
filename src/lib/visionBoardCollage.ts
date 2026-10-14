import { getMediaBlob } from "./idb";
import { heicToJpeg, isHeicBlob } from "./heic";

// One-page vision board of a board's or story folder's photos: a PNG, or an MP4 with the videos playing when there are any.

export const isVideoUrl = (url: string) => url.includes("-video-") || url.startsWith("data:video");

type Tile = { el: CanvasImageSource; w: number; h: number; x: number; y: number; dw: number; dh: number };
type Loaded = Pick<Tile, "el" | "w" | "h">;
/** A photo that isn't saved in this browser (added on another device) vs one that's here but wouldn't open */
type LoadResult = Loaded | "missing" | "failed";

const LOAD_TIMEOUT = 60_000;
/** Photos are kept at the size the board needs (a tile is at most ~1000px wide), so big boards don't run out of memory */
const MAX_SIDE = 1400;
/** How many photos are opened at once */
const AT_ONCE = 4;

/** One photo that never loads mustn't hold up the whole board */
function within<T>(ms: number, work: Promise<T>): Promise<T> {
  return Promise.race([work, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("took too long to load")), ms))]);
}

/** The saved photo or video (local-media:// lives in this browser's storage); null when it isn't here */
async function blobFor(url: string): Promise<Blob | null> {
  if (url.startsWith("local-media://")) return getMediaBlob(url.replace("local-media://", ""));
  if (url.startsWith("data:") || url.startsWith("blob:")) return (await fetch(url)).blob();
  return null; // a web address: loaded as an image instead
}

async function loadVideo(src: string): Promise<Loaded> {
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  // Some browsers never report the first frame of a video that isn't on screen: after a while, its size is enough
  await within(LOAD_TIMEOUT, new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("video failed to load"));
    video.src = src;
    video.load();
  })).catch((err) => {
    if (!video.videoWidth) throw err;
  });
  if (!video.videoWidth) throw new Error("video has no picture");
  return { el: video, w: video.videoWidth, h: video.videoHeight };
}

/** A photo, decoded straight at board size (full-size phone photos all at once used several GB and some failed) */
async function loadPhoto(blob: Blob): Promise<Loaded> {
  if (await isHeicBlob(blob)) blob = await heicToJpeg(blob); // iPhone photos can't be drawn outside Safari
  const full = await within(LOAD_TIMEOUT, createImageBitmap(blob));
  const scale = Math.min(1, MAX_SIDE / Math.max(full.width, full.height));
  if (scale === 1) return { el: full, w: full.width, h: full.height };
  const w = Math.max(1, Math.round(full.width * scale));
  const h = Math.max(1, Math.round(full.height * scale));
  full.close();
  const small = await within(LOAD_TIMEOUT, createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" }));
  return { el: small, w, h };
}

async function loadWebImage(url: string): Promise<Loaded> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await within(LOAD_TIMEOUT, new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("photo failed to load"));
    img.src = url;
  }));
  return { el: img, w: img.naturalWidth, h: img.naturalHeight };
}

async function loadOnce(url: string, revokeLater: string[]): Promise<LoadResult> {
  const blob = await blobFor(url);
  if (!blob) {
    if (url.startsWith("local-media://")) return "missing";
    return loadWebImage(url);
  }
  if (isVideoUrl(url) || blob.type.startsWith("video/")) {
    const src = URL.createObjectURL(blob);
    revokeLater.push(src);
    return loadVideo(src);
  }
  return loadPhoto(blob);
}

/** Tried twice before it's left out */
async function load(url: string, revokeLater: string[]): Promise<LoadResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await loadOnce(url, revokeLater);
    } catch (err) {
      if (attempt >= 2) {
        console.warn("Left out of the vision board:", url, err);
        return "failed";
      }
    }
  }
}

/** Loads every photo, a few at a time, keeping their order */
async function loadAll(urls: string[], revokeLater: string[]): Promise<LoadResult[]> {
  const results: LoadResult[] = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const n = next++;
      results[n] = await load(urls[n], revokeLater);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, urls.length) }, worker));
  return results;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const WIDTH = 1080;
const PAD = 32;
const GAP = 14;
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Shortest-column layout at each item's own shape; more columns until it fits on one page (about 4:5 or taller up to 9:16). */
function layout(items: Loaded[], top: number) {
  let best: { tiles: Tile[]; height: number } | null = null;
  const fewest = Math.min(2, items.length);
  for (let cols = fewest; cols <= Math.max(fewest, Math.min(6, items.length)); cols++) {
    const colW = (WIDTH - PAD * 2 - GAP * (cols - 1)) / cols;
    const heights = new Array(cols).fill(top);
    const tiles = items.map((it) => {
      const c = heights.indexOf(Math.min(...heights));
      const dh = colW * Math.min(2, it.h / it.w);
      const tile = { ...it, x: PAD + c * (colW + GAP), y: heights[c], dw: colW, dh };
      heights[c] += dh + GAP;
      return tile;
    });
    best = { tiles, height: Math.max(...heights) - GAP + PAD };
    if (best.height <= WIDTH * (16 / 9)) break;
  }
  return best!;
}

function drawBoard(ctx: CanvasRenderingContext2D, tiles: Tile[], height: number, title?: string, subtitle?: string) {
  ctx.fillStyle = "#F8F8F7";
  ctx.fillRect(0, 0, WIDTH, height);
  if (title) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#18181B";
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(title, WIDTH / 2, 62);
    if (subtitle) {
      ctx.fillStyle = "#71717A";
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText(subtitle.toUpperCase(), WIDTH / 2, 90);
    }
  }
  for (const t of tiles) {
    ctx.save();
    roundedRect(ctx, t.x, t.y, t.dw, t.dh, 14);
    ctx.clip();
    // Cover-crop only for very tall items (capped at 1:2); everything else keeps its shape
    const scale = Math.max(t.dw / t.w, t.dh / t.h);
    const sw = t.dw / scale;
    const sh = t.dh / scale;
    ctx.drawImage(t.el, (t.w - sw) / 2, (t.h - sh) / 2, sw, sh, t.x, t.y, t.dw, t.dh);
    ctx.restore();
  }
}

function save(blob: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

/** The first format this browser can record: MP4 (Safari, recent Chrome), otherwise WebM. */
function recordingType(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mimeType of ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(mimeType)) return { mimeType, ext: mimeType.startsWith("video/mp4") ? "mp4" : "webm" };
  }
  return null;
}

const MAX_SECONDS = 30;

export interface CollageOptions {
  title?: string;
  /** What the photos are called under the title, e.g. "Stories" → "BEACH DAY · 30 STORIES" (counting the ones included) */
  countLabel?: string;
}

/**
 * Downloads every photo as one vision board page: a PNG, or an MP4 (videos playing, as long as the longest one,
 * up to 30s) when any of them is a video.
 */
export async function downloadVisionBoardCollage(urls: string[], options: CollageOptions = {}): Promise<void> {
  if (!urls.length) return;
  const revoke: string[] = [];
  try {
    const results = await loadAll(urls, revoke);
    const loaded = results.filter((r): r is Loaded => typeof r === "object");
    const missing = results.filter((r) => r === "missing").length;
    const failed = results.filter((r) => r === "failed").length;
    if (!loaded.length) {
      alert(missing ? "None of these photos are saved in this browser (they were added on another device), so the vision board couldn't be made here." : "None of these photos could be opened, so the vision board couldn't be made.");
      return;
    }
    if (missing || failed) {
      // Say so, rather than quietly making a board that's missing photos
      const why = [
        missing ? `${missing} ${missing === 1 ? "was" : "were"} added on another device and ${missing === 1 ? "isn't" : "aren't"} saved in this browser (download from that device to include ${missing === 1 ? "it" : "them"})` : "",
        failed ? `${failed} couldn't be opened` : "",
      ].filter(Boolean).join("; ");
      const go = confirm(`${missing + failed} of ${urls.length} photos can't be included: ${why}. Download the vision board with the other ${loaded.length}?`);
      if (!go) return;
    }
    const subtitle = options.countLabel ? `${options.title ?? "Vision board"} · ${loaded.length} ${options.countLabel}` : undefined;
    const { tiles, height: rawHeight } = layout(loaded, options.title ? 116 : PAD);
    const height = Math.ceil(rawHeight / 2) * 2; // video encoders need even sizes
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const name = (options.title || "vision-board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "vision-board";

    const videos = tiles.map((t) => t.el).filter((el): el is HTMLVideoElement => el instanceof HTMLVideoElement);
    const format = videos.length ? recordingType() : null;
    if (!videos.length || !format) {
      drawBoard(ctx, tiles, height, options.title, subtitle);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (png) save(png, `${name}.png`);
      return;
    }

    // Videos: play them all from the start and record the board for as long as the longest one
    const seconds = Math.min(MAX_SECONDS, Math.max(3, ...videos.map((v) => (Number.isFinite(v.duration) ? v.duration : 0))));
    await Promise.all(
      videos.map((v) => {
        v.currentTime = 0;
        return v.play().catch(() => {});
      }),
    );
    drawBoard(ctx, tiles, height, options.title, subtitle);
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    recorder.start(250);
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const frame = () => {
        drawBoard(ctx, tiles, height, options.title, subtitle);
        if (performance.now() - started >= seconds * 1000) return resolve();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    recorder.stop();
    await done;
    videos.forEach((v) => v.pause());
    save(new Blob(chunks, { type: format.mimeType.split(";")[0] }), `${name}.${format.ext}`);
  } finally {
    setTimeout(() => revoke.forEach((u) => URL.revokeObjectURL(u)), 1000);
  }
}
