import {
  CalendarClock,
  FileBarChart,
  Newspaper,
  Star,
  Sunrise,
  TrendingUp,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

export type NavItem = {
  href: string;
  label: (t: Dictionary) => string;
  icon: typeof Sunrise;
  /** Mobil alt çubukta görünsün mü — orada yalnızca beş yer var. */
  inBottomBar: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: (t) => t.nav.today,
    icon: Sunrise,
    inBottomBar: true,
  },
  {
    href: "/takvim",
    label: (t) => t.nav.calendar,
    icon: CalendarClock,
    inBottomBar: true,
  },
  {
    href: "/bilancolar",
    label: (t) => t.nav.earnings,
    icon: FileBarChart,
    inBottomBar: true,
  },
  {
    href: "/favoriler",
    label: (t) => t.nav.watchlist,
    icon: Star,
    inBottomBar: true,
  },
  {
    href: "/haberler",
    label: (t) => t.nav.news,
    icon: Newspaper,
    inBottomBar: true,
  },
  {
    href: "/makro",
    label: (t) => t.nav.macro,
    icon: TrendingUp,
    inBottomBar: false,
  },
];
