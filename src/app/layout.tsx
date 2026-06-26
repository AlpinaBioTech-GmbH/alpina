import type { Metadata } from "next";
import { IBM_Plex_Mono, Figtree } from "next/font/google";
import StoryblokProvider from "@/components/providers/StoryblokProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { type GlobalConfig } from "@/components/site/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { fetchGlobalConfig } from "@/lib/storyblok";
import { brand } from "../../brand.config";
import "./globals.css";

// Type system. To swap fonts, change these next/font imports and the matching
// CSS variables (--font-heading / --font-sans / --font-mono) in globals.css.
const heading = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const globalStory = await fetchGlobalConfig();
  const favicon = (globalStory?.content as GlobalConfig | undefined)?.favicon
    ?.filename;
  return {
    metadataBase: new URL(brand.siteUrl),
    title: {
      default: brand.homeTitle,
      template: `%s - ${brand.name}`,
    },
    description: brand.description,
    openGraph: { siteName: brand.name, locale: "en", type: "website" },
    // Favicon is CMS-driven via global_config when present.
    ...(favicon
      ? { icons: { icon: [{ url: favicon, type: "image/png" }] } }
      : {}),
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout is intentionally chrome-free: the public site header/footer live
  // in the (site) route group so the /admin area can render its own chrome
  // without the marketing nav.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${heading.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <StoryblokProvider>
            {children}
            <Toaster position="bottom-right" />
          </StoryblokProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
