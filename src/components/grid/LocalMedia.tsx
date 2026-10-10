import React, { ImgHTMLAttributes, VideoHTMLAttributes, useState, useEffect } from 'react';
import { useLocalMedia } from '@/hooks/useLocalMedia';
import { Image as ImageIcon, Film } from 'lucide-react';

interface LocalMediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | undefined | null;
  fallback?: React.ReactNode;
}

export function LocalMediaImage({ src, alt = "", fallback, ...props }: LocalMediaImageProps) {
  const resolvedSrc = useLocalMedia(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src, resolvedSrc]);

  if (!resolvedSrc || hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`bg-soft-100 flex items-center justify-center text-zinc-300 ${props.className || ''}`}
        style={props.style}
      >
        <ImageIcon size={14} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}

interface LocalMediaVideoProps extends Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  src: string | undefined | null;
  fallback?: React.ReactNode;
}

export function LocalMediaVideo({ src, fallback, ...props }: LocalMediaVideoProps) {
  const resolvedSrc = useLocalMedia(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src, resolvedSrc]);

  if (!resolvedSrc || hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`bg-soft-100 flex items-center justify-center text-zinc-300 ${props.className || ''}`}
        style={props.style}
      >
        <Film size={14} />
      </div>
    );
  }

  return (
    <video
      src={resolvedSrc}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}
