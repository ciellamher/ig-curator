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
