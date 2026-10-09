"use client";

import { useEffect, useState } from "react";
import { Globe, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import { formatDate } from "@/lib/planner/dates";
import type { FacebookPage } from "@/lib/planner/types";
import { LocalMediaImage, LocalMediaVideo } from "./LocalMedia";

const isVideo = (url: string) => url.includes("-video-") || url.startsWith("data:video");

function Media({ url, className }: { url: string; className: string }) {
  return isVideo(url) ? (
    <LocalMediaVideo src={url} className={className} muted playsInline />
  ) : (
    <LocalMediaImage src={url} alt="" className={className} />
  );
}

/** Facebook's photo layouts: one full width, two side by side, three or more as one big and up to two small (+N). */
function PhotoGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  if (urls.length === 1) return <Media url={urls[0]} className="block w-full max-h-[420px] object-cover bg-zinc-100" />;
  if (urls.length === 2)
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {urls.map((u) => (
          <Media key={u} url={u} className="block w-full aspect-square object-cover bg-zinc-100" />
        ))}
      </div>
    );
  const rest = urls.length - 3;
  return (
    <div className="grid grid-cols-2 gap-0.5">
      <Media url={urls[0]} className="col-span-2 block w-full aspect-[16/10] object-cover bg-zinc-100" />
      <Media url={urls[1]} className="block w-full aspect-square object-cover bg-zinc-100" />
      <div className="relative">
        <Media url={urls[2]} className="block w-full aspect-square object-cover bg-zinc-100" />
        {rest > 0 && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-white text-2xl font-semibold">+{rest}</div>
        )}
      </div>
    </div>
  );
}

/** Pages with the Facebook category, previewed as Facebook posts. Tapping one opens its page in the planner. */
export function FacebookFeedView({ pages, onOpen }: { pages: FacebookPage[]; onOpen: (id: string) => void }) {
  const [profile, setProfile] = useState<{ username?: string; avatarUrl?: string }>({});
  useEffect(() => {
    const load = () => {
      try {
        setProfile(JSON.parse(localStorage.getItem("ig-curator-profile") || "{}") ?? {});
      } catch {}
    };
    load();
    window.addEventListener("ig-curator:profile", load);
    window.addEventListener("ig-curator:profile-saved", load);
    return () => {
      window.removeEventListener("ig-curator:profile", load);
      window.removeEventListener("ig-curator:profile-saved", load);
    };
  }, []);

  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-16 px-6">
        <p className="text-sm font-semibold text-zinc-800">No Facebook posts yet</p>
        <p className="text-xs text-zinc-500">Tick Facebook in a page&apos;s Category and it shows here as a Facebook post.</p>
      </div>
    );
  }

  const name = profile.username || "You";
  return (
    <div className="flex flex-col gap-2 bg-zinc-100 pb-20">
      {pages.map((page) => (
        <article
          key={page.id}
          onClick={() => onOpen(page.id)}
          className="bg-white cursor-pointer hover:bg-zinc-50 transition-colors"
          data-slot-id={page.id}
          data-no-outline
        >
          <header className="flex items-center gap-2 px-3 pt-3">
            {profile.avatarUrl ? (
              <LocalMediaImage src={profile.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-zinc-300" />
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-zinc-950 truncate">{name}</div>
              <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                {page.post ? formatDate(page.post, { weekday: true }) : "Not scheduled"}
                {page.status === "Posted" ? " · Posted" : ""} · <Globe size={10} />
              </div>
            </div>
          </header>
          <p className="px-3 py-2 text-[13px] text-zinc-900 whitespace-pre-wrap break-words">{page.title}</p>
          <PhotoGrid urls={page.urls} />
          <footer className="flex items-center justify-around border-t border-zinc-100 mx-3 py-1.5 text-[12px] font-semibold text-zinc-500">
            <span className="flex items-center gap-1.5">
              <ThumbsUp size={14} /> Like
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle size={14} /> Comment
            </span>
            <span className="flex items-center gap-1.5">
              <Share2 size={14} /> Share
            </span>
          </footer>
        </article>
      ))}
    </div>
  );
}
