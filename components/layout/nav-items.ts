import {
  Activity,
  Building2,
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
  /** Kenar çubuğunda hangi grupta durur. */
  group: "market" | "follow";
  /** Mobil alt çubukta görünsün mü — orada yalnızca altı yer var. */
  inBottomBar: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: (t) => t.nav.today,
    icon: Sunrise,
    group: "market",
    inBottomBar: true,
  },
  {
    href: "/piyasalar",
    label: (t) => t.nav.markets,
    icon: Activity,
    group: "market",
    inBottomBar: true,
  },
  {
    href: "/takvim",
    label: (t) => t.nav.calendar,
    icon: CalendarClock,
    group: "market",
    inBottomBar: true,
  },
  {
    href: "/sirketler",
    label: (t) => t.nav.companies,
    icon: Building2,
    group: "market",
    inBottomBar: true,
  },
  {
    href: "/bilancolar",
    label: (t) => t.nav.earnings,
    icon: FileBarChart,
    group: "market",
    inBottomBar: true,
  },
  {
    href: "/makro",
    label: (t) => t.nav.macro,
    icon: TrendingUp,
    group: "market",
    inBottomBar: false,
  },
  {
    href: "/favoriler",
    label: (t) => t.nav.watchlist,
    icon: Star,
    group: "follow",
    inBottomBar: true,
  },
  {
    href: "/haberler",
    label: (t) => t.nav.news,
    icon: Newspaper,
    group: "follow",
    inBottomBar: false,
  },
];
