// src/components/site/HeroBackgroundVideo.tsx
// Ambient hero video: autoplay, muted, looped, no controls. Used full-bleed
// behind the copy (full layout) or filling a framed aspect-ratio box (split
// layout). HLS via native Safari/iOS or hls.js. Honors prefers-reduced-motion
// by leaving the poster frame in place instead of playing. Client-side only.
"use client";

import { useEffect, useRef } from "react";

export default function HeroBackgroundVideo({
  src,
  poster,
  className = "pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover",
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Respect reduced-motion: keep the still poster, do not autoplay.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let hls: { destroy: () => void } | undefined;
    const isHls = /\.m3u8(\?|$)/i.test(src);

    if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src; // native HLS (Safari / iOS)
      video.play().catch(() => {});
    } else if (isHls) {
      import("hls.js").then(({ default: Hls }) => {
        const el = ref.current;
        if (!el) return;
        if (Hls.isSupported()) {
          const instance = new Hls();
          instance.loadSource(src);
          instance.attachMedia(el);
          instance.on(Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}));
          hls = instance;
        } else {
          el.src = src;
          el.play().catch(() => {});
        }
      });
    } else {
      video.src = src;
      video.play().catch(() => {});
    }

    return () => hls?.destroy();
  }, [src]);

  return (
    <video
      ref={ref}
      poster={poster}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      className={className}
    />
  );
}
