// File System Access API helpers
// Saves grid data directly to a folder on the user's computer (no browser quota limits!)
// Requires Chrome 86+ or Edge 86+. Not supported in Safari.

import { getItem, setItem } from "./idb";

const FS_HANDLE_KEY = "ig-curator-fs-handle";

export function isFileSystemSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await getItem<FileSystemDirectoryHandle>(FS_HANDLE_KEY);
  } catch {
    return null;
  }
}

export async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await setItem(FS_HANDLE_KEY, handle);
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({
      id: "ig-curator-save",
      mode: "readwrite",
      startIn: "documents",
    });
    await storeHandle(handle);
    return handle;
  } catch {
    return null; // user cancelled or denied
  }
}

export async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const opts = { mode: "readwrite" as const };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  } catch {
    return false;
  }
}

export async function saveToFolder(
  handle: FileSystemDirectoryHandle,
  items: unknown[]
): Promise<void> {
  const fileHandle = await handle.getFileHandle("grid.json", { create: true });
  const writable = await (fileHandle as any).createWritable();
  await writable.write(JSON.stringify(items));
  await writable.close();
}

export async function loadFromFolder(
  handle: FileSystemDirectoryHandle
): Promise<unknown[] | null> {
  try {
    const fileHandle = await handle.getFileHandle("grid.json");
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}
