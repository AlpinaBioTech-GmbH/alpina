// Client component: loads the Storyblok Visual Editor bridge so edits in the
// editor live-refresh the page. Component rendering itself happens server-side
// (see src/lib/storyblok.ts) - this only wires the bridge.
"use client";

import { storyblokInit, apiPlugin } from "@storyblok/react/rsc";
import type { ReactNode } from "react";

storyblokInit({
  accessToken: process.env.NEXT_PUBLIC_STORYBLOK_TOKEN,
  use: [apiPlugin],
  apiOptions: {
    region: process.env.NEXT_PUBLIC_STORYBLOK_REGION || "eu",
  },
});

export default function StoryblokProvider({ children }: { children: ReactNode }) {
  return children;
}
