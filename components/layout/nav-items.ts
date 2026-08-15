import {
  Bell,
  ChartBar,
  ChartLineUp,
  BookOpen,
  Buildings,
  CalendarBlank,
  Heart,
  ListDashes,
  Newspaper,
  Percent,
  Receipt,
  Scroll,
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
  /** Masaüstü masthead'inde görünsün mü. */
  inMasthead: boolean;
  /** Mobil alt çubukta görünsün mü — orada yalnızca beş yer var. */
  inBottomBar: boolean;
  /** Alt çubukta kısaltılmış etiket kullanılır (Piyasalar → Piyasa). */
  shortLabel?: (t: Dictionary) => string;
  /**
   * Masthead'de yalnızca 1536px üstünde görünsün. Sekiz sekme daha dar
   * ekranlarda marka ile arama arasına sığmıyor; okuma ekranları o
   * genişlikte ana sayfadaki kartlardan ve alt bilgiden açılıyor.
   */
  wideOnly?: boolean;
};

/**
 * Mobil alt çubuk dört sekme: Piyasa · Bilanço · Favoriler · Menü.
 *
 * Takvim buradan çıkarıldı — bugünün takvimi ve haftaya bakış zaten Bugün
 * ekranının iki bölümü, sekmenin taşıdığı ek bilgi azdı. Yerine gelen Menü
 * sekmesi ürünün TAMAMINI açıyor: masthead'de duran her ekran, okuma
 * bölümleri, hesap ve yasal sayfalar. Mobilde artık ulaşılamayan ekran yok.
 *
 * Bugün de çıkarıldı: mobil başlıktaki logo her ekranda oraya götürüyor,
 * yani sekme ikinci bir kapıydı. Dört sekme 390px'de beşten rahat.
 *
 * Şirketler dizini mobilde sekme değil — 500+ satırlık listeyi kimse
 * kaydırmaz, üstteki aramadan ve Menü'den erişiliyor.
 */
/**
 * Masthead sırası kullanıcının kararı: geniş resimden (Piyasalar) tekil
 * şirkete (Şirketler), oradan makro çerçeveye ve takvim odaklı iki ekrana.
 * Bugün masthead'de yok — logo zaten oraya götürüyor.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    /* Alt çubukta YOK: mastheaddeki logo zaten buraya götürüyor ve o logo
       mobilde her ekranın tepesinde duruyor. Sekmeyi kaldırınca kalan dörde
       daha geniş dokunma alanı düşüyor — beş sekme 390px'de sıkışıktı. */
    href: "/",
    label: (t) => t.nav.today,
    icon: Bell,
    inMasthead: false,
    inBottomBar: false,
  },
  {
    href: "/piyasalar",
    label: (t) => t.nav.markets,
    /* `TrendUp` çıplak bir oktu ve duotone ağırlıkta 21 pikselde neredeyse
       kütlesiz kalıyordu — alt çubuktaki komşularının yanında sönük
       duruyordu. `ChartLineUp` aynı şeyi söylüyor ama eksen çizgisiyle
       birlikte, yani okunur bir gövdesi var. */
    icon: ChartLineUp,
    inMasthead: true,
    inBottomBar: true,
    shortLabel: (t) => t.nav.marketsShort,
  },
  {
    href: "/sirketler",
    label: (t) => t.nav.companies,
    icon: Buildings,
    inMasthead: true,
    inBottomBar: false,
  },
  {
    href: "/makro",
    label: (t) => t.nav.macro,
    icon: Percent,
    inMasthead: true,
    inBottomBar: false,
  },
  {
    href: "/bilancolar",
    label: (t) => t.nav.earnings,
    /* Bilanço bir FİNANSAL BELGE; `FileText` yalnızca "bir belge" diyor ve
       Mercek'in `Scroll`u ile Rehber'in `BookOpen`ı arasında ayırt edici
       değildi. */
    icon: Receipt,
    inMasthead: true,
    inBottomBar: true,
    shortLabel: (t) => t.nav.earningsShort,
  },
  {
    href: "/takvim",
    label: (t) => t.nav.calendar,
    icon: CalendarBlank,
    inMasthead: true,
    inBottomBar: false,
  },
  {
    href: "/mercek",
    label: (t) => t.nav.stories,
    icon: Scroll,
    inMasthead: true,
    inBottomBar: false,
    wideOnly: true,
  },
  {
    href: "/rehber",
    label: (t) => t.nav.guide,
    icon: BookOpen,
    inMasthead: true,
    inBottomBar: false,
    wideOnly: true,
  },
  {
    href: "/favoriler",
    label: (t) => t.nav.watchlist,
    icon: Heart,
    inMasthead: true,
    inBottomBar: true,
  },
  {
    href: "/haberler",
    label: (t) => t.nav.news,
    icon: Newspaper,
    inMasthead: false,
    inBottomBar: false,
  },
  {
    href: "/karsilastir",
    label: (t) => t.compare.title,
    icon: ChartBar,
    inMasthead: false,
    inBottomBar: false,
  },
  {
    href: "/menu",
    label: (t) => t.nav.menu,
    icon: ListDashes,
    inMasthead: false,
    inBottomBar: true,
  },
];
