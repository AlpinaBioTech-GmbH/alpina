import type { NextConfig } from "next";

// Optional LAN IP for testing the dev server from a phone over HTTPS.
const devLanOrigin = process.env.DEV_LAN_IP ? [process.env.DEV_LAN_IP] : [];

const nextConfig: NextConfig = {
  // Allow the dev server's internal assets (/_next, HMR) to be requested from
  // localhost and (optionally) a LAN IP when testing on another device.
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0", ...devLanOrigin],
  // Admin document uploads (PDF/DOCX) go through a Server Action; the default
  // body limit is 1MB, which is too small for real documents.
  experimental: {
    serverActions: { bodySizeLimit: "15mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "a.storyblok.com" }, // Storyblok CDN
      { protocol: "https", hostname: "image.mux.com" }, // Mux video poster thumbnails
      { protocol: "https", hostname: "stream.mux.com" }, // Mux HLS streams
    ],
    // Prefer AVIF (smaller) and fall back to WebP.
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
