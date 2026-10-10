"use client";

import { useState, useRef } from "react";
import { SlotItem } from "@/types";
import { Plus, Trash2, X, Edit2 } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LocalMediaImage, LocalMediaVideo } from "./LocalMedia";
import { draggedItemIds, droppedPhotos, withoutMoved } from "@/lib/photoDrag";

interface InspoFolderListViewProps {
  folders: SlotItem[];
  allItems: SlotItem[];
  onFolderClick: (folderId: string) => void;
  onAddFolder: (title: string, hexColor?: string, coverUrl?: string) => void;
  onDeleteFolder: (folderId: string) => void;
  updateItem?: (id: string, updates: Partial<SlotItem>) => void;
  updateItems?: (newItemsOrUpdater: SlotItem[] | ((curr: SlotItem[]) => SlotItem[])) => void;
  /** The collection's name, e.g. "Inspo" or "Fits" */
  name?: string;
}

export function InspoFolderListView({
  folders,
  allItems,
  onFolderClick,
  onAddFolder,
  onDeleteFolder,
  updateItem,
  updateItems,
  name = "Inspo",
}: InspoFolderListViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCoverUrl, setNewCoverUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deleteFolderName = deleteFolderId ? folders.find(f => f.id === deleteFolderId)?.text || "this folder" : "";

  // Helper to recursively find up to 4 images inside a folder (including sub-folders)
  const getFolderImages = (
    folderId: string,
    max: number = 4,
    visited = new Set<string>(),
  ): string[] => {
    if (visited.has(folderId)) return [];
    visited.add(folderId);

    let images: string[] = [];
    const children = allItems.filter((i) => i.folderId === folderId);

    for (const child of children) {
      if (images.length >= max) break;
      if (child.urls && child.urls.length > 0) {
        images.push(child.urls[0]);
      } else if (child.contentType === "InspoFolder") {
        const subImages = getFolderImages(
          child.id,
          max - images.length,
          visited,
        );
        images.push(...subImages);
      }
    }
    return images.slice(0, max);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNewCoverUrl(event.target.result as string);
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload failed", err);
      setIsUploading(false);
    }
  };

  const handleCreateOrEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (editingFolderId && updateItem) {
      updateItem(editingFolderId, {
        text: newTitle.trim(),
        urls: newCoverUrl ? [newCoverUrl] : [],
      });
      setEditingFolderId(null);
    } else {
      onAddFolder(newTitle.trim(), undefined, newCoverUrl || undefined);
      setIsCreating(false);
    }
    setNewTitle("");
    setNewCoverUrl(null);
  };

  const openEditModal = (folder: SlotItem) => {
    setEditingFolderId(folder.id);
    setNewTitle(folder.text || "");
    setNewCoverUrl(folder.urls?.[0] || null);
  };

  // Photos in a board, including its sub-boards
  const countPhotos = (folderId: string, seen = new Set<string>()): number => {
    if (seen.has(folderId)) return 0;
    seen.add(folderId);
    return allItems
      .filter((i) => i.folderId === folderId)
      .reduce((n, i) => n + (i.contentType === "InspoFolder" ? countPhotos(i.id, seen) : 1), 0);
  };

  return (
    <div className="w-full flex flex-col pb-6">
      <ConfirmModal
        isOpen={!!deleteFolderId}
        title="Delete folder"
        message={`Delete "${deleteFolderName}" and all its photos?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteFolderId) onDeleteFolder(deleteFolderId); setDeleteFolderId(null); }}
        onCancel={() => setDeleteFolderId(null)}
      />
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-100 px-4 py-3 flex items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-950 leading-tight">{name} boards</h2>
          <p className="text-[11px] text-zinc-500">{folders.length} board{folders.length === 1 ? "" : "s"}</p>
        </div>
        <button
          onClick={() => {
            setNewTitle("");
            setNewCoverUrl(null);
            setIsCreating(true);
            setEditingFolderId(null);
          }}
          className="ml-auto inline-flex items-center gap-1 px-3 h-8 rounded-full bg-zinc-950 text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
          title="New Collection"
        >
          <Plus size={14} strokeWidth={2.5} /> New board
        </button>
      </div>

      <div className="px-4 py-4">
        {/* Create / Edit Folder Modal */}
        {(isCreating || editingFolderId) && (
          <form
            onSubmit={handleCreateOrEdit}
            className="mb-6 p-4 bg-white border border-soft-200 rounded-2xl shadow-lg flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                {editingFolderId ? "Edit Folder" : "Create Folder"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingFolderId(null);
                }}
                className="p-1 text-foreground/40 hover:text-foreground rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-foreground/60">
                Folder Name
              </label>
              <input
                type="text"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Japan, Summer Campaign, Outfit Ideas..."
                className="p-2.5 bg-soft-50 border border-soft-200 rounded-xl outline-none focus:border-slate-800 focus:bg-white text-xs font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-foreground/60">
                Cover Photo
              </label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                className="hidden"
                accept="image/*"
              />

              {newCoverUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden group">
                  <LocalMediaImage
                    src={newCoverUrl}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 size={16} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-soft-200 flex flex-col items-center justify-center gap-1 hover:border-slate-400 hover:bg-soft-50 transition-colors text-slate-500 cursor-pointer"
                >
                  <Plus size={20} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    Upload
                  </span>
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingFolderId(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-foreground/60 hover:text-foreground rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 bg-slate-900 hover:bg-black disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {editingFolderId ? "Save Changes" : "Create Folder"}
              </button>
            </div>
          </form>
        )}

        {folders.length === 0 && !isCreating && (
          <div className="flex flex-col items-center text-center gap-3 py-16 px-6">
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-zinc-300 flex items-center justify-center text-zinc-400">
              <Plus size={22} />
            </div>
            <p className="text-sm font-semibold text-zinc-800">No {name.toLowerCase()} boards yet</p>
            <p className="text-xs text-zinc-500">Make a board for each trip, shoot or mood, then add photos to it.</p>
            <button
              onClick={() => {
                setNewTitle("");
                setNewCoverUrl(null);
                setIsCreating(true);
                setEditingFolderId(null);
              }}
              className="mt-1 inline-flex items-center gap-1 px-4 h-9 rounded-full bg-zinc-950 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus size={14} strokeWidth={2.5} /> Create your first board
            </button>
          </div>
        )}

        {/* Boards */}
        <div className="grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-3 gap-x-3 gap-y-4">
          {folders
            .slice()
            .sort((a, b) => (a.text || "").localeCompare(b.text || ""))
            .map((folder) => {
              const customCover = folder.urls?.[0];
              const folderImages = customCover
                ? [customCover, ...getFolderImages(folder.id, 3).filter((u) => u !== customCover)].slice(0, 3)
                : getFolderImages(folder.id, 3);

              return (
                <div
                  key={folder.id}
                  data-slot-id={folder.id}
                  onClick={() => onFolderClick(folder.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/folder-id", folder.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault(); // Necessary to allow dropping
                    setDragTargetId(folder.id);
                  }}
                  onDragLeave={() => {
                    setDragTargetId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragTargetId(null);

                    // Inspo photos from another board just move to this one
                    const sourceIds = draggedItemIds(e);
                    const boardPhotos = sourceIds.filter((id) => {
                      const type = allItems.find((i) => i.id === id)?.contentType;
                      return type?.startsWith("Inspo") && type !== "InspoFolder";
                    });
                    if (boardPhotos.length && updateItems) {
                      updateItems((curr) => curr.map((i) => (boardPhotos.includes(i.id) ? { ...i, folderId: folder.id } : i)));
                      return;
                    }

                    // Dropped photos or stories from phone: moved here, so they leave the phone
                    let urls: string[] = droppedPhotos(e);
                    if (!urls.length) {
                      const storyId =
                        e.dataTransfer.getData("application/x-ig-curator-story-id") ||
                        e.dataTransfer.getData("application/x-ig-curator-story");
                      if (storyId && allItems) {
                        const sourceItem = allItems.find((i) => i.id === storyId);
                        if (sourceItem?.urls?.length) urls = sourceItem.urls;
                      }
                    }
                    if (urls.length > 0 && updateItems) {
                      const newItems: SlotItem[] = urls.map((u, n) => ({
                        id: `inspo-${Date.now().toString(36)}-${n}-${Math.random().toString(36).slice(2, 6)}`,
                        type: u.includes("-video-") || u.startsWith("data:video") ? "video" : "image",
                        urls: [u],
                        currentUrlIndex: 0,
                        hexColor: "#E4E4E7",
                        text: "",
                        folderId: folder.id,
                        contentType: "InspoPost",
                      }));
                      updateItems((curr) => [...newItems, ...withoutMoved(curr, sourceIds)]);
                      return;
                    }

                    const draggedId = e.dataTransfer.getData(
                      "application/folder-id",
                    );
                    if (draggedId && draggedId !== folder.id && updateItem) {
                      // Update the dragged folder to have the target folder as its parent!
                      updateItem(draggedId, { folderId: folder.id });
                    }
                  }}
                  className={`group cursor-pointer flex flex-col gap-2 rounded-xl transition-all ${
                    dragTargetId === folder.id
                      ? "ring-2 ring-slate-800 ring-offset-2 scale-105"
                      : ""
                  }`}
                >
                  <div
                    className="w-full aspect-[5/2] rounded-xl overflow-hidden relative shadow-sm flex gap-0.5"
                    style={{ backgroundColor: folder.hexColor || "#E4E4E7" }}
                  >
                    {/* Three photos side by side, like the story folders */}
                    {[0, 1, 2].map((n) => {
                      const url = folderImages[n];
                      return (
                        <div key={n} className="flex-1 h-full overflow-hidden bg-zinc-50">
                          {url ? (
                            url.startsWith("data:video") || url.includes("-video-") ? (
                              <LocalMediaVideo src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted loop playsInline />
                            ) : (
                              <LocalMediaImage src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            )
                          ) : null}
                        </div>
                      );
                    })}

                    {/* Edit & delete: on hover with a mouse, always visible on touch screens */}
                    <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(folder);
                        }}
                        className="p-1.5 bg-white/80 backdrop-blur-sm text-slate-700 hover:text-slate-900 rounded-lg shadow-sm"
                        title="Edit folder"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteFolderId(folder.id);
                        }}
                        className="p-1.5 bg-white/80 backdrop-blur-sm text-slate-700 hover:text-zinc-900 rounded-lg shadow-sm"
                        title="Delete folder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="px-1 -mt-0.5">
                    <h3 className="font-bold text-zinc-950 text-sm tracking-tight truncate">{folder.text || "Untitled board"}</h3>
                    <p className="text-[11px] font-medium text-zinc-500">
                      {countPhotos(folder.id)} {countPhotos(folder.id) === 1 ? "Pin" : "Pins"}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
