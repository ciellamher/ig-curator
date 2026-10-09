import localforage from 'localforage';

// Configure the main store
const mainStore = localforage.createInstance({
  name: "ig-curator",
  storeName: "items" // Default store for JSON state
});

// Configure the media store
const mediaStore = localforage.createInstance({
  name: "ig-curator",
  storeName: "media" // Separate store for heavy blobs
});

export const setItem = async (key: string, value: any): Promise<void> => {
  try {
    await mainStore.setItem(key, value);
  } catch (err) {
    console.error(`[LocalForage] Failed to setItem for key: ${key}`, err);
    throw err;
  }
};

export const getItem = async <T,>(key: string): Promise<T | null> => {
  try {
    const val = await mainStore.getItem<T>(key);
    return val !== undefined ? val : null;
  } catch (err) {
    console.error(`[LocalForage] Failed to getItem for key: ${key}`, err);
    return null;
  }
};

export const removeItem = async (key: string): Promise<void> => {
  try {
    await mainStore.removeItem(key);
  } catch (err) {
    console.error(`[LocalForage] Failed to removeItem for key: ${key}`, err);
    throw err;
  }
};

// --- MEDIA BLOB STORAGE ---

export const saveMediaBlob = async (id: string, blob: Blob): Promise<void> => {
  try {
    await mediaStore.setItem(id, blob);
    console.log(`[LocalForage] Successfully saved blob ${id}`);
  } catch (err) {
    console.error(`[LocalForage] Failed to saveMediaBlob for id: ${id}`, err);
    throw err;
  }
};

export const getMediaBlob = async (id: string): Promise<Blob | null> => {
  try {
    const val = await mediaStore.getItem<Blob>(id);
    return val !== undefined && val !== null ? val : null;
  } catch (err) {
    console.error(`[LocalForage] Failed to getMediaBlob for id: ${id}`, err);
    return null;
  }
};

export const deleteMediaBlob = async (id: string): Promise<void> => {
  try {
    await mediaStore.removeItem(id);
  } catch (err) {
    console.error(`[LocalForage] Failed to deleteMediaBlob for id: ${id}`, err);
    throw err;
  }
};

/** Every photo/video id saved in this browser. */
export const listMediaIds = async (): Promise<string[]> => {
  try {
    return await mediaStore.keys();
  } catch (err) {
    console.error("[LocalForage] Failed to list media", err);
    return [];
  }
};

// --- FEED LAYOUT BACKUPS ---
// Snapshots of the feed layout kept in this browser, taken before anything replaces it and once a day,
// so a bad overwrite can always be undone.

const BACKUP_PREFIX = "backup:";
const MAX_BACKUPS = 15;

export type FeedBackup = { key: string; savedAt: string; reason: string; count: number };

export const saveFeedBackup = async (items: unknown[], reason: string): Promise<void> => {
  if (!Array.isArray(items) || items.length === 0) return;
  const savedAt = new Date().toISOString();
  try {
    await mainStore.setItem(`${BACKUP_PREFIX}${savedAt}`, { savedAt, reason, items });
    const keys = (await mainStore.keys()).filter((k) => k.startsWith(BACKUP_PREFIX)).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_BACKUPS))) await mainStore.removeItem(old);
  } catch (err) {
    console.error("[LocalForage] Failed to save feed backup", err);
  }
};

export const listFeedBackups = async (): Promise<FeedBackup[]> => {
  const keys = (await mainStore.keys()).filter((k) => k.startsWith(BACKUP_PREFIX)).sort().reverse();
  const out: FeedBackup[] = [];
  for (const key of keys) {
    const b = await mainStore.getItem<{ savedAt: string; reason: string; items: unknown[] }>(key);
    if (b) out.push({ key, savedAt: b.savedAt, reason: b.reason, count: b.items.length });
  }
  return out;
};

export const getFeedBackup = async <T,>(key: string): Promise<T[] | null> => {
  const b = await mainStore.getItem<{ items: T[] }>(key);
  return b?.items ?? null;
};
