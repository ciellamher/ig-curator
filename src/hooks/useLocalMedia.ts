import { useState, useEffect } from "react";
import { getMediaBlob } from "@/lib/idb";

const objectUrlCache = new Map<string, string>();

/**
 * Resolves a photo/video address to something the browser can show. Photos are kept in this browser
 * (local-media://…); `missing` is true when this browser doesn't have it (e.g. it was added on another device).
 */
export function useLocalMediaStatus(url: string | null | undefined): { src: string | null; missing: boolean } {
  const [state, setState] = useState<{ url: string | null | undefined; src: string | null; missing: boolean }>({ url: null, src: null, missing: false });

  useEffect(() => {
    if (!url) {
      setState({ url, src: null, missing: true });
      return;
    }
    if (!url.startsWith("local-media://")) {
      // A normal address (e.g. a base64 fallback from old sessions)
      setState({ url, src: url, missing: false });
      return;
    }
    // Cached, so the same photo isn't read again (and no object URLs leak)
    const cached = objectUrlCache.get(url);
    if (cached) {
      setState({ url, src: cached, missing: false });
      return;
    }

    let isMounted = true;
    setState({ url, src: null, missing: false }); // loading — never show the previous photo meanwhile
    getMediaBlob(url.replace("local-media://", ""))
      .then((blob) => {
        if (!isMounted) return;
        if (!blob) return setState({ url, src: null, missing: true });
        const objectUrl = URL.createObjectURL(blob);
        objectUrlCache.set(url, objectUrl);
        setState({ url, src: objectUrl, missing: false });
      })
      .catch((err) => {
        console.error("Failed to load local media blob:", err);
        if (isMounted) setState({ url, src: null, missing: true });
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  // Until the effect has run for a new address, it's still loading
  return state.url === url ? { src: state.src, missing: state.missing } : { src: null, missing: false };
}

export function useLocalMedia(url: string | null | undefined): string | null {
  return useLocalMediaStatus(url).src;
}
