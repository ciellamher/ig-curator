import { useState, useEffect } from "react";
import { getMediaBlob } from "@/lib/idb";

const objectUrlCache = new Map<string, string>();

export function useLocalMedia(url: string | null | undefined): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setResolvedUrl(null);
      return;
    }

    if (!url.startsWith("local-media://")) {
      // It's a normal URL (e.g., base64 fallback from old sessions)
      setResolvedUrl(url);
      return;
    }

    // Check cache first to prevent re-fetching and memory leaks
    if (objectUrlCache.has(url)) {
      setResolvedUrl(objectUrlCache.get(url)!);
      return;
    }

    let isMounted = true;
    const mediaId = url.replace("local-media://", "");

    getMediaBlob(mediaId)
      .then((blob) => {
        if (!isMounted || !blob) return;
        const objectUrl = URL.createObjectURL(blob);
        objectUrlCache.set(url, objectUrl);
        setResolvedUrl(objectUrl);
      })
      .catch((err) => {
        console.error("Failed to load local media blob:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return resolvedUrl;
}
