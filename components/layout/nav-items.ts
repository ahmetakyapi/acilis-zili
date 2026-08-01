import {
  Bell,
  Buildings,
  CalendarBlank,
  FileText,
  Heart,
  Newspaper,
  Percent,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import type { Dictionary } from "@/lib/i18n";

/**
 * Phosphor, duotone ağırlık — `/dist/ssr` girişi context kullanmaz, o yüzden
 * Server Component'lerde de çalışır. `fill` daima currentColor.
 */
export type NavItem = {
  href: string;
  label: (t: Dictionary) => string;
  icon: typeof Bell;
  /** Mobil alt çubukta görünsün mü — orada yalnızca beş yer var. */
  inBottomBar: boolean;
  /** Alt çubukta kısaltılmış etiket kullanılır (Piyasalar → Piyasa). */
  shortLabel?: (t: Dictionary) => string;
};

/**
 * Mobil alt çubuk HANDOFF §5 uyarınca beş sekme:
 * Bugün · Takvim · Piyasa · Bilanço · Favoriler.
 *
 * Şirketler dizini mobilde sekme değil — 500+ satırlık listeyi kimse
 * kaydırmaz, üstteki aramadan erişiliyor. Makro ve Haberler, Bugün akışının
 * altında bölüm olarak duruyor ve kendi tam sayfalarına açılıyor.
 */
/**
 * Masthead sırası kullanıcının kararı: geniş resimden (Piyasalar) tekil
 * şirkete (Şirketler), oradan makro çerçeveye ve takvim odaklı iki ekrana.
 * Bugün başta durur — logo da oraya gider — Favoriler sonda.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: (t) => t.nav.today,
    icon: Bell,
    inBottomBar: true,
  },
  {
    href: "/piyasalar",
    label: (t) => t.nav.markets,
    icon: TrendUp,
    inBottomBar: true,
    shortLabel: (t) => t.nav.marketsShort,
  },
  {
    href: "/sirketler",
    label: (t) => t.nav.companies,
    icon: Buildings,
    inBottomBar: false,
  },
  {
    href: "/makro",
    label: (t) => t.nav.macro,
    icon: Percent,
    inBottomBar: false,
  },
  {
    href: "/bilancolar",
    label: (t) => t.nav.earnings,
    icon: FileText,
    inBottomBar: true,
    shortLabel: (t) => t.nav.earningsShort,
  },
  {
    href: "/takvim",
    label: (t) => t.nav.calendar,
    icon: CalendarBlank,
    inBottomBar: true,
  },
  {
    href: "/favoriler",
    label: (t) => t.nav.watchlist,
    icon: Heart,
    inBottomBar: true,
  },
  {
    href: "/haberler",
    label: (t) => t.nav.news,
    icon: Newspaper,
    inBottomBar: false,
  },
];
