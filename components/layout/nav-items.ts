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
  /** Manşetin altındaki yatay gezinme satırında görünsün mü. */
  inTopNav: boolean;
  /** Mobil alt çubukta görünsün mü — orada yalnızca beş yer var. */
  inBottomBar: boolean;
};

/**
 * Gezinme sırası gazetenin okuma sırasıdır: gün → takvim → bilanço →
 * piyasa → şirket → makro → takip.
 *
 * Haberler üst satırda yok: Bugün akışının altında bölüm olarak duruyor ve
 * "Tümünü gör" ile tam sayfaya çıkıyor (HANDOFF §6).
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: (t) => t.nav.today,
    icon: Sunrise,
    inTopNav: true,
    inBottomBar: true,
  },
  {
    href: "/takvim",
    label: (t) => t.nav.calendar,
    icon: CalendarClock,
    inTopNav: true,
    inBottomBar: true,
  },
  {
    href: "/bilancolar",
    label: (t) => t.nav.earnings,
    icon: FileBarChart,
    inTopNav: true,
    inBottomBar: true,
  },
  {
    href: "/piyasalar",
    label: (t) => t.nav.markets,
    icon: Activity,
    inTopNav: true,
    inBottomBar: true,
  },
  {
    href: "/sirketler",
    label: (t) => t.nav.companies,
    icon: Building2,
    inTopNav: true,
    // Mobilde alfabetik dizin kaydırılmaz; sembol aramak asıl davranış.
    inBottomBar: false,
  },
  {
    href: "/makro",
    label: (t) => t.nav.macro,
    icon: TrendingUp,
    inTopNav: true,
    inBottomBar: false,
  },
  {
    href: "/favoriler",
    label: (t) => t.nav.watchlist,
    icon: Star,
    inTopNav: true,
    inBottomBar: true,
  },
  {
    href: "/haberler",
    label: (t) => t.nav.news,
    icon: Newspaper,
    inTopNav: false,
    inBottomBar: false,
  },
];
