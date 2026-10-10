"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, X } from "lucide-react";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { saveFilesLocally } from "@/lib/localUpload";

/** Asks for a reel's cover: a frame picked from the video, or a picture uploaded instead. */
export function CoverPicker({ videoUrl, onPick, onClose }: { videoUrl: string; onPick: (coverUrl: string) => void; onClose: () => void }) {
  const src = useLocalMedia(videoUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [saving, setSaving] = useState(false);

  const useFrame = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) return;
      const [url] = await saveFilesLocally([new File([blob], "cover.jpg", { type: "image/jpeg" })]);
      if (url) onPick(url);
    } finally {
      setSaving(false);
    }
  };

  // At page level, so no panel it's opened from can clip it
  return createPortal(
    <>
      <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-xs" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Choose the reel's cover"
        className="fixed z-[115] inset-x-3 bottom-3 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[380px] bg-white rounded-2xl shadow-2xl p-4 flex flex-col gap-3"
      >
        <div className="flex items-center">
          <div>
            <h3 className="text-sm font-semibold text-zinc-950">What should the cover be?</h3>
            <p className="text-xs text-zinc-500">Slide to pick a frame, or upload a picture.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto p-1.5 rounded-full text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="mx-auto w-48 aspect-[9/16] rounded-xl overflow-hidden bg-zinc-100">
          {src && (
            <video
              ref={videoRef}
              src={src}
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
            />
          )}
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={time}
          disabled={!duration}
          aria-label="Frame"
          onChange={(e) => {
            const t = Number(e.target.value);
            setTime(t);
            if (videoRef.current) videoRef.current.currentTime = t;
          }}
          className="w-full accent-zinc-950"
        />
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full border border-zinc-300 text-xs font-semibold text-zinc-800 hover:border-zinc-950 cursor-pointer"
          >
            <ImagePlus size={14} /> Upload a picture
          </button>
          <button
            onClick={useFrame}
            disabled={!duration || saving}
            className="flex-1 h-9 rounded-full bg-zinc-950 text-white text-xs font-semibold hover:bg-black disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Use this frame"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            const [url] = await saveFilesLocally([file]);
            if (url) onPick(url);
          }}
        />
      </div>
    </>,
    document.body,
  );
}
