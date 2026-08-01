import React, { ImgHTMLAttributes, VideoHTMLAttributes } from 'react';
import { useLocalMedia } from '@/hooks/useLocalMedia';

interface LocalMediaImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string | undefined | null;
}

export function LocalMediaImage({ src, alt = "", ...props }: LocalMediaImageProps) {
  const resolvedSrc = useLocalMedia(src);

  if (!resolvedSrc) {
    return <div className={`bg-soft-200 animate-pulse ${props.className || ''}`} />;
  }

  return <img src={resolvedSrc} alt={alt} {...props} />;
}

interface LocalMediaVideoProps extends VideoHTMLAttributes<HTMLVideoElement> {
  src: string | undefined | null;
}

export function LocalMediaVideo({ src, ...props }: LocalMediaVideoProps) {
  const resolvedSrc = useLocalMedia(src);

  if (!resolvedSrc) {
    return <div className={`bg-soft-200 animate-pulse ${props.className || ''}`} />;
  }

  return <video src={resolvedSrc} {...props} />;
}
