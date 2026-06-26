// src/components/site/ArticleVideo.tsx
// Inline article video. Poster + clean signal play button; on click it mounts
// the (brand-themed) media-chrome VideoPlayer and plays IN PLACE with full
// controls + fullscreen. HLS via native Safari/iOS or hls.js. The player only
// mounts client-side after the click, so there are no SSR/custom-element issues.
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import {
  VideoPlayer,
  VideoPlayerControlBar,
  VideoPlayerFullscreenButton,
  VideoPlayerMuteButton,
  VideoPlayerPlayButton,
  VideoPlayerTimeDisplay,
  VideoPlayerTimeRange,
  VideoPlayerVolumeRange,
} from "@/components/ui/video-player";

export default function ArticleVideo({
  videoSrc,
  poster,
  posterAlt = "Play video",
  aspectClass = "aspect-video",
}: {
  videoSrc: string;
  poster?: string;
  posterAlt?: string;
  aspectClass?: string;
}) {
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!started) return;
    const video = videoRef.current;
    if (!video) return;

    let hls: { destroy: () => void } | undefined;
    const isHls = /\.m3u8(\?|$)/i.test(videoSrc);

    if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = videoSrc; // native HLS (Safari / iOS)
      video.play().catch(() => {});
    } else if (isHls) {
      import("hls.js").then(({ default: Hls }) => {
        const el = videoRef.current;
        if (!el) return;
        if (Hls.isSupported()) {
          const instance = new Hls();
          instance.loadSource(videoSrc);
          instance.attachMedia(el);
          instance.on(Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}));
          hls = instance;
        } else {
          el.src = videoSrc;
          el.play().catch(() => {});
        }
      });
    } else {
      video.src = videoSrc;
      video.play().catch(() => {});
    }

    return () => hls?.destroy();
  }, [started, videoSrc]);

  if (!started) {
    return (
      <div
        style={{ borderColor: "var(--hair)", background: "var(--void)" }}
        className={`relative w-full overflow-hidden border ${aspectClass}`}
      >
        <button
          type="button"
          aria-label="Play video"
          onClick={() => setStarted(true)}
          className="group absolute inset-0 h-full w-full cursor-pointer"
        >
          {poster && (
            <Image
              src={poster}
              alt={posterAlt}
              width={1280}
              height={720}
              className="absolute inset-0 h-full w-full object-cover transition duration-200 group-hover:brightness-75"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span
              style={{ background: "var(--signal)" }}
              className="grid size-[72px] shrink-0 place-items-center rounded-full transition-transform duration-200 group-hover:scale-105"
            >
              <Play
                size={30}
                fill="currentColor"
                style={{ color: "var(--on-signal)" }}
                className="translate-x-[2px]"
              />
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <VideoPlayer
      style={{ borderColor: "var(--hair)" }}
      className={`block w-full overflow-hidden border ${aspectClass}`}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        slot="media"
        poster={poster}
        playsInline
        preload="metadata"
        suppressHydrationWarning
        className="h-full w-full object-cover"
      />
      <VideoPlayerControlBar>
        <VideoPlayerPlayButton />
        <VideoPlayerTimeRange />
        <VideoPlayerTimeDisplay showDuration />
        <VideoPlayerMuteButton />
        <VideoPlayerVolumeRange />
        <VideoPlayerFullscreenButton />
      </VideoPlayerControlBar>
    </VideoPlayer>
  );
}
