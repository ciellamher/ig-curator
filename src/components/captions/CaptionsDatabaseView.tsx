"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Check, Filter } from "lucide-react";

export type CaptionItem = {
  id: string;
  text: string;
  category: string;
  isUsed: boolean;
};

const PREDEFINED_CATEGORIES = [
  "Birthday",
  "Family",
  "Food",
  "Friends",
  "Holidays",
  "Me",
  "Others",
  "Pet",
  "Relationship",
  "Summer",
  "Things",
  "Throwback",
  "University",
  "View",
];

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
        className="w-full text-left bg-soft-100/50 hover:bg-soft-100 text-slate-600 text-[11px] font-semibold px-3 py-1.5 rounded-full outline-none focus:bg-soft-200 focus:text-slate-900 transition-colors truncate"
      >
        {value || "Select..."}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-soft-200 shadow-xl rounded-xl z-50 max-h-64 overflow-y-auto py-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            {PREDEFINED_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  onChange(cat);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-soft-50 transition-colors ${value === cat ? "bg-soft-100 text-slate-900" : "text-slate-700"}`}
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

export function CaptionsDatabaseView() {
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    import("@/lib/idb").then(({ getItem }) => {
      getItem<CaptionItem[]>("ig-curator-captions").then((saved) => {
        if (saved) {
          setCaptions(saved);
        } else {
          // Initialize with a demo caption based on the user's screenshot
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

  const handleDelete = (id: string) => {
    if (confirm("Delete this caption?")) {
      saveCaptions(captions.filter((c) => c.id !== id));
    }
  };

  if (!isLoaded)
    return <div className="p-8 text-center text-sm">Loading...</div>;

  return (
    <div className="w-full h-full bg-white flex flex-col px-4 sm:px-8 py-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8 max-w-4xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Captions
        </h1>
        <button
          onClick={handleAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} strokeWidth={2.5} />
          <span>New</span>
        </button>
      </div>

      <div className="flex flex-col gap-1 w-full max-w-4xl pb-24">
        {captions.map((caption) => (
          <div
            key={caption.id}
            className="group flex items-start gap-4 py-3 px-2 hover:bg-soft-50 rounded-xl transition-colors"
          >
            <div className="pt-1 shrink-0">
              <button
                onClick={() =>
                  handleUpdate(caption.id, { isUsed: !caption.isUsed })
                }
                className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                  caption.isUsed
                    ? "bg-blue-500 border-blue-500 text-white"
                    : "border-slate-300 hover:border-slate-400 bg-white"
                }`}
              >
                {caption.isUsed && <Check size={12} strokeWidth={3} />}
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
              className={`flex-1 bg-transparent border-none outline-none resize-none overflow-hidden text-[15px] font-medium leading-relaxed min-h-[28px] mt-0.5 ${
                caption.isUsed
                  ? "text-slate-400 line-through"
                  : "text-slate-800"
              }`}
            />

            <div className="w-28 shrink-0 mt-0.5">
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
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={15} />
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
