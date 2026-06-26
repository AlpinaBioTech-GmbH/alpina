"use client"

import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react"
import type { ComponentProps, CSSProperties } from "react"
import { cn } from "@/lib/utils"

export type VideoPlayerProps = ComponentProps<typeof MediaController>

// 4QT brand theme (§3 tokens): light controls on the dark operations surface,
// signal as the single accent on the progress bar.
const variables = {
  "--media-primary-color": "var(--paper)",
  "--media-secondary-color": "var(--void)",
  "--media-text-color": "var(--paper)",
  "--media-background-color": "var(--void)",
  "--media-control-hover-background": "color-mix(in srgb, var(--signal) 22%, transparent)",
  "--media-font-family": "var(--font-mono)",
  "--media-range-track-background": "var(--steel)",
  "--media-range-bar-color": "var(--signal)",
  "--media-range-thumb-background": "var(--signal)",
  "--media-time-range-buffered-color": "var(--mist)",
} as CSSProperties

export const VideoPlayer = ({ style, ...props }: VideoPlayerProps) => (
  <MediaController
    style={{
      ...variables,
      ...style,
    }}
    {...(props as any)}
  />
)

export type VideoPlayerControlBarProps = ComponentProps<typeof MediaControlBar>

export const VideoPlayerControlBar = (props: VideoPlayerControlBarProps) => (
  <MediaControlBar {...(props as any)} />
)

export type VideoPlayerTimeRangeProps = ComponentProps<typeof MediaTimeRange>

export const VideoPlayerTimeRange = ({ className, ...props }: VideoPlayerTimeRangeProps) => (
  <MediaTimeRange className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerTimeDisplayProps = ComponentProps<typeof MediaTimeDisplay>

export const VideoPlayerTimeDisplay = ({ className, ...props }: VideoPlayerTimeDisplayProps) => (
  <MediaTimeDisplay className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerVolumeRangeProps = ComponentProps<typeof MediaVolumeRange>

export const VideoPlayerVolumeRange = ({ className, ...props }: VideoPlayerVolumeRangeProps) => (
  <MediaVolumeRange className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerPlayButtonProps = ComponentProps<typeof MediaPlayButton>

export const VideoPlayerPlayButton = ({ className, ...props }: VideoPlayerPlayButtonProps) => (
  <MediaPlayButton className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerSeekBackwardButtonProps = ComponentProps<typeof MediaSeekBackwardButton>

export const VideoPlayerSeekBackwardButton = ({
  className,
  ...props
}: VideoPlayerSeekBackwardButtonProps) => (
  <MediaSeekBackwardButton className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerSeekForwardButtonProps = ComponentProps<typeof MediaSeekForwardButton>

export const VideoPlayerSeekForwardButton = ({
  className,
  ...props
}: VideoPlayerSeekForwardButtonProps) => (
  <MediaSeekForwardButton className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerMuteButtonProps = ComponentProps<typeof MediaMuteButton>

export const VideoPlayerMuteButton = ({ className, ...props }: VideoPlayerMuteButtonProps) => (
  <MediaMuteButton className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerFullscreenButtonProps = ComponentProps<typeof MediaFullscreenButton>

export const VideoPlayerFullscreenButton = ({
  className,
  ...props
}: VideoPlayerFullscreenButtonProps) => (
  <MediaFullscreenButton className={cn("p-2.5", className)} {...(props as any)} />
)

export type VideoPlayerContentProps = ComponentProps<"video">

export const VideoPlayerContent = ({ className, ...props }: VideoPlayerContentProps) => (
  <video className={cn("mt-0 mb-0", className)} {...(props as any)} />
)

// Demo
export function Demo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <VideoPlayer className="rounded-none overflow-hidden border">
          {/* biome-ignore lint/a11y/useMediaCaption: demo video */}
          <video
            slot="media"
            src="https://stream.mux.com/VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqBsTwaxU/high.mp4"
            poster="https://image.mux.com/VZtzUzGRv02OhRnZCxcNg49OilvolTqdnFLEqBsTwaxU/thumbnail.webp?time=0"
            suppressHydrationWarning
          />
          <VideoPlayerControlBar>
            <VideoPlayerPlayButton />
            <VideoPlayerTimeRange />
            <VideoPlayerTimeDisplay showDuration />
            <VideoPlayerMuteButton />
            <VideoPlayerVolumeRange />
          </VideoPlayerControlBar>
        </VideoPlayer>
      </div>
    </div>
  )
}
