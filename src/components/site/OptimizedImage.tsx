// src/components/site/OptimizedImage.tsx
// Server-side wrapper around next/image that adds an optional blurred LQIP
// placeholder (generated from the Storyblok asset). Pass `blur` for photographic
// object-cover images so they fade in from a blurred preview instead of popping
// from an empty box. Leave `blur` off for logos / transparent object-contain art.
// Always pass `sizes` so the optimizer ships a source matched to the display size.
//
// Async server component: use only inside server components. Client components
// should pass a precomputed blurDataURL to next/image directly (see NewsList).
import Image, { type ImageProps } from "next/image";
import { lqip } from "@/lib/storyblokImage";

type Props = ImageProps & { blur?: boolean };

export default async function OptimizedImage({ blur = false, src, ...rest }: Props) {
  const blurDataURL = blur && typeof src === "string" ? await lqip(src) : undefined;
  return (
    <Image
      src={src}
      {...rest}
      placeholder={blurDataURL ? "blur" : "empty"}
      blurDataURL={blurDataURL}
    />
  );
}
