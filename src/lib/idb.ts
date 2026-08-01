const DB_NAME = 'ig-curator-db';
const DB_VERSION = 2; // Incremented version to add media store
const STORE_NAME = 'store';
const MEDIA_STORE_NAME = 'ig-curator-media';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  console.log("[IDB] getDB() called");
  if (!dbPromise) {
    console.log("[IDB] Creating new dbPromise...");
    dbPromise = new Promise((resolve, reject) => {
      try {
        console.log(`[IDB] Attempting to open indexedDB '${DB_NAME}' v${DB_VERSION}...`);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (e) => {
          console.log("[IDB] onupgradeneeded triggered", e);
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            console.log(`[IDB] Creating object store: ${STORE_NAME}`);
            db.createObjectStore(STORE_NAME);
          }
          if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
            console.log(`[IDB] Creating object store: ${MEDIA_STORE_NAME}`);
            db.createObjectStore(MEDIA_STORE_NAME);
          }
        };
        
        request.onsuccess = (e) => {
          console.log("[IDB] onsuccess triggered!");
          const db = (e.target as IDBOpenDBRequest).result;
          
          db.onclose = () => {
            console.warn("[IDB] Database closed unexpectedly.");
            dbPromise = null;
          };
          db.onversionchange = () => {
            console.warn("[IDB] Database version changed unexpectedly.");
            db.close();
            dbPromise = null;
          };
          
          resolve(db);
        };
        
        request.onerror = (e) => {
          console.error("[IDB] onerror triggered during open!", request.error, e);
          dbPromise = null;
          reject(request.error);
        };
        
        request.onblocked = (e) => {
          console.error("[IDB] onblocked triggered! Another tab might be holding an older version of the DB open.", e);
        };
      } catch (err) {
        console.error("[IDB] Synchronous exception while trying to open DB:", err);
        dbPromise = null;
        reject(err);
      }
    });
  }
  return dbPromise;
}

export const setItem = async (key: string, value: any): Promise<void> => {
  console.log(`[IDB] setItem called for key: ${key}`);
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      
      tx.oncomplete = () => {
        console.log(`[IDB] setItem complete for key: ${key}`);
        resolve();
      };
      tx.onerror = () => {
        console.error(`[IDB] tx.onerror during setItem for key: ${key}`, tx.error);
        reject(tx.error);
      };
      tx.onabort = () => {
        console.error(`[IDB] tx.onabort during setItem for key: ${key}`, tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error(`[IDB] Failed to execute setItem for key: ${key}`, err);
    throw err;
  }
};

export const getItem = async <T,>(key: string): Promise<T | null> => {
  console.log(`[IDB] getItem called for key: ${key}`);
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      
      req.onsuccess = () => {
        console.log(`[IDB] getItem success for key: ${key}`);
        resolve(req.result !== undefined ? req.result : null);
      };
      req.onerror = () => {
        console.error(`[IDB] tx.onerror during getItem for key: ${key}`, req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.error(`[IDB] Failed to execute getItem for key: ${key}`, err);
    return null; // Return null instead of crashing the app
  }
};

export const removeItem = async (key: string): Promise<void> => {
  console.log(`[IDB] removeItem called for key: ${key}`);
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error(`[IDB] Failed to execute removeItem for key: ${key}`, err);
    throw err;
  }
};

// --- MEDIA BLOB STORAGE ---

export const saveMediaBlob = async (id: string, blob: Blob): Promise<void> => {
  console.log(`[IDB] saveMediaBlob called for id: ${id}, blob size: ${blob.size}`);
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE_NAME);
      store.put(blob, id);
      
      tx.oncomplete = () => {
        console.log(`[IDB] saveMediaBlob complete for id: ${id}`);
        resolve();
      };
      tx.onerror = () => {
        console.error(`[IDB] tx.onerror during saveMediaBlob for id: ${id}`, tx.error);
        reject(tx.error);
      };
      tx.onabort = () => {
        console.error(`[IDB] tx.onabort during saveMediaBlob for id: ${id}`, tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error(`[IDB] Failed to execute saveMediaBlob for id: ${id}`, err);
    throw err;
  }
};

export const getMediaBlob = async (id: string): Promise<Blob | null> => {
  console.log(`[IDB] getMediaBlob called for id: ${id}`);
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readonly');
      const store = tx.objectStore(MEDIA_STORE_NAME);
      const req = store.get(id);
      
      req.onsuccess = () => {
        console.log(`[IDB] getMediaBlob success for id: ${id}`);
        resolve(req.result !== undefined ? req.result : null);
      };
      req.onerror = () => {
        console.error(`[IDB] tx.onerror during getMediaBlob for id: ${id}`, req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.error(`[IDB] Failed to execute getMediaBlob for id: ${id}`, err);
    return null;
  }
};

export const deleteMediaBlob = async (id: string): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, 'readwrite');
      const store = tx.objectStore(MEDIA_STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error(`[IDB] Failed to execute deleteMediaBlob for id: ${id}`, err);
    throw err;
  }
};
