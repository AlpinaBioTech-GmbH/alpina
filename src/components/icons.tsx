// Single icon entry point for the admin area: curated name map, uniform weight.
// Components always go through <Icon name="…" /> rather than importing icons
// directly, so glyphs stay consistent. Uses Phosphor (the project's v0 preset
// iconLibrary) to match the rest of the design system.
//
// "use client": Phosphor icons rely on React context (createContext), so this
// module must live in the client graph. Server components can still render
// <Icon/> as a client boundary.
"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  ArrowUpRightIcon,
  AtIcon,
  CameraIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  LinkSimpleIcon,
  ListIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PaperPlaneRightIcon,
  RssIcon,
  ShareNetworkIcon,
  SignOutIcon,
  SparkleIcon,
  SquaresFourIcon,
  TrashIcon,
  WarningIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

const ICONS = {
  dashboard: SquaresFourIcon,
  news: NewspaperIcon,
  social: MegaphoneIcon,
  linkedin: ShareNetworkIcon,
  twitter: AtIcon,
  instagram: CameraIcon,
  sent: PaperPlaneRightIcon,
  logout: SignOutIcon,
  arrowUpRight: ArrowUpRightIcon,
  link: LinkSimpleIcon,
  externalLink: ArrowSquareOutIcon,
  sparkles: SparkleIcon,
  menu: ListIcon,
  check: CheckIcon,
  clock: ClockIcon,
  cancel: XIcon,
  eye: EyeIcon,
  rss: RssIcon,
  file: FileTextIcon,
  trash: TrashIcon,
  refresh: ArrowCounterClockwiseIcon,
  warning: WarningIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className,
  size = 18,
  weight = "regular",
}: {
  name: IconName;
  className?: string;
  size?: number;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}) {
  const Component = ICONS[name];
  return <Component className={className} size={size} weight={weight} />;
}
