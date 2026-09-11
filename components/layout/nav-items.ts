import {
  Bell,
  ChartBar,
  BookOpen,
  Buildings,
  CalendarBlank,
  ChartLineUp,
  EnvelopeSimple,
  Heart,
  ListDashes,
  Newspaper,
  FileText,
  Percent,
  Scroll,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import { stripLocale } from "@/lib/i18n/routing";
import type { Dictionary } from "@/lib/i18n";

/** Masthead şeridinde taşma önceliği — 1 en son taşar. */
export type StripRank = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Phosphor, duotone ağırlık — `/dist/ssr` girişi context kullanmaz, o yüzden
 * Server Component'lerde de çalışır. `fill` daima currentColor.
 */
export type NavItem = {
  href: string;
  label: (t: Dictionary) => string;
  icon: typeof Bell;
  /** Mobil alt çubukta görünsün mü — orada yalnızca dört yer var. */
  inBottomBar: boolean;
  /** Alt çubukta kısaltılmış etiket kullanılır (Piyasalar → Piyasa). */
  shortLabel?: (t: Dictionary) => string;
  /**
   * Masaüstü şeridinde sekme. `label` verilirse şeritte o yazılır (Teknik'in
   * EN adı şeride sığmıyor); taşıp "Daha Fazla"ya indiğinde tam ad döner.
   */
  strip?: { rank: StripRank; label?: (t: Dictionary) => string };
  /** Masaüstünde "Daha Fazla" panelinin sabit satırı. */
  more?: true;
  /** Paneldeki ikinci satır — /menu ile aynı sözlük anahtarı. */
  hint?: (t: Dictionary) => string;
};

/**
 * Mobil alt çubuk dört sekme: Piyasa · Bilanço · Mercek · Menü.
 *
 * VERİ MODELİ ÇUBUĞUN KENDİSİ. Favoriler bir dönem burada `inBottomBar`
 * işaretliydi ve AppShell o yuvayı basarken sessizce Mercek'e çeviriyordu:
 * model bir şey, ekran başka bir şey söylüyordu. Yuvanın neden Mercek olduğu
 * AppShell'deki yorumda; işaret artık doğrudan Mercek'te.
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
 * MASAÜSTÜ: TEK ŞERİT, YEDİ SEKME VE "DAHA FAZLA".
 *
 * Masthead sırası kullanıcının kararı: geniş resimden (Piyasalar) tekil
 * şirkete (Şirketler), oradan makro çerçeveye, bilançoya, teknik görüşe ve
 * takvim odaklı ekranlara. Bugün şeritte yok — logo zaten oraya götürüyor.
 *
 * Eski düzen üç ayrı mekanizmaydı: `inMasthead` sekmeleri, 1280 altında
 * gizlenen `wideOnly` Rehber ve geri kalanı toplayan bir "Menü" hapı. Hangi
 * ekranın nerede durduğu genişliğe ve oturuma göre değişiyordu; Teknik
 * Analiz de hiçbir genişlikte şeride sığmadığı için yalnızca o hapın
 * içindeydi ve okuyucu sayfayı hiç bulamıyordu.
 *
 * ŞİMDİ İKİ LİSTE VAR VE KESİŞMİYOR: `strip` sekmeleri ve `more` satırları.
 * Favoriler hesap panelinde (mobildeki karar), tema ve dil de orada; Menü
 * satırı mobil dizin olarak kalıyor. Kesişmezlik `tests/nav-items.test.ts`te
 * sınanıyor.
 *
 * TAŞMA ÖNCELİĞİ (`strip.rank`, 1 en son taşar): 1-3 mobil alt çubuğun üç
 * içerik yuvası, 4 Teknik (kullanıcının isteği), 5-7 kod içi kayıtların
 * "ikinci kapı" dediği ekranlar. Varsayılan yazı boyunda HİÇBİR masaüstü
 * genişliğinde taşma olmuyor; öncelik yalnızca büyütülmüş yazıda devreye
 * giriyor (usePriorityStrip).
 *
 * SIĞMA ÖLÇÜSÜ — tarayıcıda, 16px kök; "Daha Fazla"nın sağ kenarı ile arama
 * kutusunun sol kenarı arası (ızgara aralığı dahil). Kullanıcı adı başlıkta
 * yazılmadığı için misafir ve oturumlu aynı.
 *
 *            1024   1100   1279   1280   1366   1440+
 *     TR      114    190    369     58    144    178
 *     EN      112    188    367     58    144    178
 *
 * 1280'deki düşüş bilinçli: arama orada 36'lık kareden 240'lık alana
 * açılıyor. Eski düzende 1024 EN'de 7 piksel kalıyor, oturumlu 1280/1536
 * EN'de sekmeler arama kutusunun ALTINA 58/70 piksel biniyordu ve sayfa
 * taşmadığı için hiçbir taşma taraması bunu görmüyordu.
 *
 * Büyütülmüş yazıda (20 ve 24px kök; 1024, 1280, 1440; TR ve EN) hiçbir
 * sekme araçlara binmiyor, gizlenen her sekme panelin ilk grubunda duruyor
 * ve sayfa yatay taşmıyor. 20px'te Şirketler ve Takvim (1280'de Makro da),
 * 24px'te bunlara ek olarak Makro ve Teknik panele iniyor.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    /* Alt çubukta YOK: mastheaddeki logo zaten buraya götürüyor ve o logo
       mobilde her ekranın tepesinde duruyor. Sekmeyi kaldırınca kalan dörde
       daha geniş dokunma alanı düşüyor — beş sekme 390px'de sıkışıktı. */
    href: "/",
    label: (t) => t.nav.today,
    icon: Bell,
    inBottomBar: false,
  },
  {
    href: "/piyasalar",
    label: (t) => t.nav.markets,
    icon: TrendUp,
    inBottomBar: true,
    shortLabel: (t) => t.nav.marketsShort,
    strip: { rank: 1 },
    hint: (t) => t.menu.hintMarkets,
  },
  {
    href: "/sirketler",
    label: (t) => t.nav.companies,
    icon: Buildings,
    inBottomBar: false,
    strip: { rank: 6 },
    hint: (t) => t.menu.hintCompanies,
  },
  {
    href: "/makro",
    label: (t) => t.nav.macro,
    icon: Percent,
    inBottomBar: false,
    strip: { rank: 5 },
    hint: (t) => t.menu.hintMacro,
  },
  {
    href: "/bilancolar",
    label: (t) => t.nav.earnings,
    icon: FileText,
    inBottomBar: true,
    shortLabel: (t) => t.nav.earningsShort,
    strip: { rank: 2 },
    hint: (t) => t.menu.hintEarnings,
  },
  {
    /* ŞERİTTE, BEŞİNCİ SIRADA. Bir dönem hiçbir genişlikte sığmıyordu ve
       yalnızca "Menü" hapının içindeydi. Tek şeride inen düzen yer açtı:
       dizideki ve alt bilgideki yeri zaten Bilançolar ile Takvim arası.
       Şeritteki ad `nav.technical` — TR "Teknik Analiz", EN "Technicals";
       İngilizce tam ad ("Technical Analysis") 1024'te aralığı daraltıyordu. */
    href: "/teknik",
    label: (t) => t.technical.title,
    icon: ChartLineUp,
    inBottomBar: false,
    strip: { rank: 4, label: (t) => t.nav.technical },
    hint: (t) => t.menu.hintTechnical,
  },
  {
    href: "/takvim",
    label: (t) => t.nav.calendar,
    icon: CalendarBlank,
    inBottomBar: false,
    strip: { rank: 7 },
    hint: (t) => t.menu.hintCalendar,
  },
  {
    /* HER GENİŞLİKTE ŞERİTTE. Bir süre `wideOnly` idi ve 1280px altındaki
       ekranlarda — yani tipik dizüstünde — sitenin kendi yazdığı tek içerik
       türü gezinmede hiç görünmüyordu; oysa yanındaki sekmelerin hepsi
       sağlayıcıdan gelen veriyi gösteriyor. */
    href: "/mercek",
    label: (t) => t.nav.stories,
    icon: Scroll,
    inBottomBar: true,
    strip: { rank: 3 },
    hint: (t) => t.menu.hintStories,
  },
  {
    href: "/karsilastir",
    label: (t) => t.compare.title,
    icon: ChartBar,
    inBottomBar: false,
    more: true,
    hint: (t) => t.menu.hintCompare,
  },
  {
    /* DAHA FAZLA'DA. Bir dönem yalnızca 1280 üstünde sekmeydi: aynı ekran
       dizüstünde menüde, masaüstünde şeritte duruyordu. Durağan bir
       müfredat, her gün değişmiyor ve ana sayfadan da açılıyor. */
    href: "/rehber",
    label: (t) => t.nav.guide,
    icon: BookOpen,
    inBottomBar: false,
    more: true,
    hint: (t) => t.menu.hintGuide,
  },
  {
    href: "/haberler",
    label: (t) => t.nav.news,
    icon: Newspaper,
    inBottomBar: false,
    more: true,
    hint: (t) => t.menu.hintNews,
  },
  {
    /* Masaüstünde yalnızca alt bilgide duruyordu. */
    href: "/bulten",
    label: (t) => t.footer.briefArchive,
    icon: EnvelopeSimple,
    inBottomBar: false,
    more: true,
    hint: (t) => t.menu.hintBrief,
  },
  {
    /* ŞERİTTE DEĞİL, HESAP PANELİNDE — mobildeki karar. Misafir için sayfa
       doğrudan /giris'e atıyor; şeritte duran bir sekme o okuyucuya içerik
       değil bir duvar gösteriyordu. */
    href: "/favoriler",
    label: (t) => t.nav.watchlist,
    icon: Heart,
    inBottomBar: false,
    hint: (t) => t.menu.hintWatchlist,
  },
  {
    href: "/menu",
    label: (t) => t.nav.menu,
    icon: ListDashes,
    inBottomBar: true,
  },
];

/**
 * Aktif sekme — KARŞILAŞTIRMA DİLDEN ARINDIRILMIŞ yolla yapılır.
 *
 * `usePathname()` tarayıcının adresini veriyor, yani `/en/piyasalar`. Gezinme
 * hedefleri ise dilsiz yazılıyor (`/piyasalar`). İkisi ham hâlde
 * karşılaştırılınca İngilizce tarafta HİÇBİR sekme aktif görünmüyordu —
 * `startsWith` yalnızca "/" ile eşleşiyor ve vurgu "Menü"ye düşüyordu.
 *
 * Şerit, "Daha Fazla" paneli ve mobil alt çubuk ÜÇÜ DE buradan okur. Eski
 * "Menü" açılır listesi bir dönem kendi `startsWith` kopyasını taşıdı ve "/"
 * hedefli "Bugün"ü her sayfada aktif saydı: düğme hiç sönmüyor, "Bugün" her
 * sayfada `aria-current="page"` taşıyordu (ölçüldü, 1024–1920).
 */
export function isActive(pathname: string, href: string): boolean {
  const path = stripLocale(pathname);
  if (href === "/") return path === "/";
  return path.startsWith(href);
}
