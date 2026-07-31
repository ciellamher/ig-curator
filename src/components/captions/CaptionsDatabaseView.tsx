"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Check, CheckSquare, Square } from "lucide-react";
import { ConfirmModal, useConfirmModal } from "@/components/ui/ConfirmModal";

export type CaptionItem = {
  id: string;
  text: string;
  category: string;
  isUsed: boolean;
};

const PREDEFINED_CATEGORIES = [
  "General",
  "Morning",
  "Work",
  "Home",
  "Selfcare",
  "Family",
  "Friends",
  "Love",
  "Travel",
  "Food",
  "Growth",
  "Birthday",
].sort();

function CategorySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left bg-soft-100/50 hover:bg-soft-100 text-slate-500 text-[11px] font-medium px-2.5 py-1 rounded-full outline-none focus:bg-soft-200 focus:text-slate-700 transition-colors truncate"
      >
        {value || "Select..."}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-soft-200 shadow-xl rounded-xl z-50 max-h-64 overflow-y-auto py-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            {PREDEFINED_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  onChange(cat);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-[12px] font-medium hover:bg-soft-50 transition-colors ${value === cat ? "bg-soft-100 text-slate-900" : "text-slate-600"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function CaptionsDatabaseView({
  searchQuery = "",
}: {
  searchQuery?: string;
}) {
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { confirm, modalProps } = useConfirmModal();

  useEffect(() => {
    import("@/lib/idb").then(({ getItem }) => {
      getItem<CaptionItem[]>("ig-curator-captions").then((saved) => {
        if (saved) {
          setCaptions(saved);
        } else {
          setCaptions([
            {
              id: "1",
              text: "21, can you do sum for me? ❤️",
              category: "Birthday",
              isUsed: false,
            },
            {
              id: "2",
              text: "a bit late, but what a blessing it is to finally be 20!",
              category: "Birthday",
              isUsed: false,
            },
            {
              id: "3",
              text: "i love you guys so much and here's to 28",
              category: "Friends",
              isUsed: false,
            },
          ]);
        }
        setIsLoaded(true);
      });
    });
  }, []);

  const filteredCaptions = captions
    .filter(
      (c) =>
        c.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => a.text.localeCompare(b.text));

  const saveCaptions = (newCaptions: CaptionItem[]) => {
    setCaptions(newCaptions);
    import("@/lib/idb").then(({ setItem }) => {
      setItem("ig-curator-captions", newCaptions);
    });
  };

  const handleAdd = () => {
    const newItem: CaptionItem = {
      id: `caption-${Date.now()}`,
      text: "",
      category: "General",
      isUsed: false,
    };
    saveCaptions([newItem, ...captions]);
  };

  const handleUpdate = (id: string, updates: Partial<CaptionItem>) => {
    saveCaptions(captions.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete caption",
      message: "Are you sure you want to delete this caption?",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) {
      saveCaptions(captions.filter((c) => c.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: "Delete selected",
      message: `Delete ${selectedIds.size} caption${selectedIds.size > 1 ? "s" : ""}?`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) {
      saveCaptions(captions.filter((c) => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCaptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCaptions.map((c) => c.id)));
    }
  };

  const allSelected =
    filteredCaptions.length > 0 &&
    selectedIds.size === filteredCaptions.length;

  if (!isLoaded)
    return <div className="p-8 text-center text-sm">Loading...</div>;

  return (
    <div className="w-full h-full bg-white flex flex-col px-4 sm:px-8 py-6 overflow-y-auto">
      <ConfirmModal {...modalProps} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 max-w-4xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Captions
        </h1>
        <button
          onClick={handleAdd}
          className="bg-soft-200 hover:bg-soft-300 text-slate-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors text-sm"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New</span>
        </button>
      </div>

      {/* Select All / Bulk Actions */}
      {filteredCaptions.length > 0 && (
        <div className="flex items-center gap-3 mb-2 max-w-4xl">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors py-1 px-1"
          >
            {allSelected ? (
              <CheckSquare size={14} className="text-slate-600" />
            ) : (
              <Square size={14} />
            )}
            <span>{allSelected ? "Deselect all" : "Select all"}</span>
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Delete {selectedIds.size}
            </button>
          )}
        </div>
      )}

      {/* Caption Rows */}
      <div className="flex flex-col w-full max-w-4xl pb-24">
        {filteredCaptions.map((caption) => (
          <div
            key={caption.id}
            className={`group flex items-start gap-3 py-2 px-2 hover:bg-soft-50/60 rounded-lg transition-colors border-b border-soft-100/80 ${selectedIds.has(caption.id) ? "bg-soft-50/40" : ""}`}
          >
            {/* Selection checkbox */}
            <div className="pt-1.5 shrink-0">
              <button
                onClick={() => toggleSelect(caption.id)}
                className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                  selectedIds.has(caption.id)
                    ? "bg-slate-700 border-slate-700 text-white"
                    : "border-slate-300 hover:border-slate-400 bg-white"
                }`}
              >
                {selectedIds.has(caption.id) && (
                  <Check size={11} strokeWidth={3} />
                )}
              </button>
            </div>

            <textarea
              value={caption.text}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
                handleUpdate(caption.id, { text: e.target.value });
              }}
              placeholder="Write a caption..."
              className={`flex-1 bg-transparent border-none outline-none resize-none overflow-hidden text-[14px] font-medium leading-snug min-h-[24px] mt-1 ${
                caption.isUsed
                  ? "text-slate-400 line-through"
                  : "text-slate-800"
              }`}
            />

            <div className="w-20 shrink-0 mt-1">
              <CategorySelector
                value={caption.category}
                onChange={(newCat) =>
                  handleUpdate(caption.id, { category: newCat })
                }
              />
            </div>

            <div className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleDelete(caption.id)}
                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {captions.length === 0 && (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">
            No captions yet. Click New to add one!
          </div>
        )}
      </div>
    </div>
  );
}
