"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Vision-board layout: items keep their own shape, columns about `columnWidth` wide, and each item goes to the
 * shortest column (so the first items run along the top). `renderItem` gets `onRatio` to report an item's
 * height ÷ width once its photo has loaded; until then it counts as `defaultRatio`.
 */
export function Masonry<T extends { id: string }>({
  items,
  renderItem,
  columnWidth = 140,
  minColumns = 2,
  gap = 8,
  defaultRatio = 1.4,
  className = "",
}: {
  items: T[];
  renderItem: (item: T, onRatio: (width: number, height: number) => void) => React.ReactNode;
  columnWidth?: number;
  minColumns?: number;
  gap?: number;
  defaultRatio?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(minColumns);
  const [ratios, setRatios] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setColumns(Math.max(minColumns, Math.floor((el.getBoundingClientRect().width + gap) / (columnWidth + gap))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [columnWidth, minColumns, gap]);

  const cols = useMemo(() => {
    const out: T[][] = Array.from({ length: columns }, () => []);
    const heights = new Array(columns).fill(0);
    for (const item of items) {
      const c = heights.indexOf(Math.min(...heights));
      out[c].push(item);
      heights[c] += (ratios[item.id] ?? defaultRatio) + 0.1;
    }
    return out;
  }, [items, columns, ratios, defaultRatio]);

  const ratioFor = (id: string) => (w: number, h: number) => {
    if (!w || !h) return;
    const r = h / w;
    setRatios((prev) => (Math.abs((prev[id] ?? 0) - r) < 0.01 ? prev : { ...prev, [id]: r }));
  };

  return (
    <div ref={ref} className={`flex items-start ${className}`} style={{ gap }}>
      {cols.map((column, c) => (
        <div key={c} className="flex-1 min-w-0 flex flex-col" style={{ gap }}>
          {column.map((item) => (
            <div key={item.id}>{renderItem(item, ratioFor(item.id))}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
