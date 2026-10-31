import type { CSSProperties, ReactNode } from "react";
import {
  ArrowCircleUp,
  ArrowRight,
  ArrowUpRight,
  BellRinging,
  Brain,
  CaretDown,
  ChartLine,
  GearSix,
  Notebook,
  ShieldCheck,
  SignIn,
  Sparkle,
  SquaresFour,
  TelegramLogo,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import { UnseenPill } from "@/components/changelog/ChangelogBadge";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { FilterChip, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import {
  AREA_DISPLAY_ORDER,
  CHANGE_KINDS,
  entryAnchor,
  entryAreas,
  entryDateLabel,
  monthAnchor,
  splitLatest,
  type ChangeArea,
  type ChangeEntry,
  type ChangeItem,
  type ChangeKind,
  type ChangeMonth,
  type ReleasePoint,
} from "@/lib/changelog";
import { tryTarget } from "@/lib/feed-visuals";
import { formatIsoMonth } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import type { ChangelogLabels } from "@/lib/i18n/dictionaries/changelog";
import { withLocale } from "@/lib/i18n/routing";
import styles from "./Changelog.module.css";

/* Sunucu bileşenleri — istemci JS'i yok. Tek istemci parçaları rozetler,
   okundu işareti ve katlamadaki çapayı açan küçük dinleyici (aynı klasör).

   İLK YENİDEN DÜZEN (25 Ekim, "çok yer kaplamış"): son sürüm alanlara göre
   gruplu kompakt karolar, eski sürümler tek satır katlı girişler.

   KOMPAKT DÜZEN (25 Ekim, ikinci tur; sahibinin sözü: "yenilikleri daha
   kolay görsün, daha kolay ulaşsın, daha görsel olsun"). Önceki hâlde 16
   madde aynı ağırlıkta karolardı: hepsi ilk ekrandaydı ama hiçbiri öne
   çıkmıyordu, telefonda ilk ekrana iki karo giriyordu (390×844, ölçüldü).
   Şimdi:
   - başlık bandı tek sıra: ad, tek cümle, sağda üç sayı ve RSS (istatistik
     şeritten buraya çıktı, şerit yalnız görsel);
   - sürüm akışı nokta değil ÇUBUK: boy madde sayısı (doğrusal, yalan
     söylemeyen ölçek), renk baskın alan; en yeni çubuk dolu ve kalın;
   - süzgeç şeridi alan + tür: alan çipleri aynı zamanda akışın renk
     açıklaması (lejant ayrı basılmıyor), seçim akışta eşleşmeyen çubukları
     soldurur;
   - son sürüm: en çok dört "Öne Çıkan" büyük kart (ikon, başlık, tek satır,
     "Dene" butonu), kalanı kompakt ızgara. Seçim kuralı `splitLatest`.

   ALAN ÇEŞİTLİLİĞİ (25 Ekim, mobil turu; sahibinin sözü: "Claude çok yer
   kaplıyor, ilk giren kullanıcı sadece Claude ile karşılaşmasın"). Son
   sürümün ilk üç maddesi Claude'du; öne çıkan ilk kart, sürüm başlığı ve
   telefonda ilk ekran yalnız Claude'u gösteriyordu. Şimdi kartlar her
   alandan bir tane (Piyasa, Bilanço, Kişisel, İçerik), Claude maddeleri
   kartların altında kendi küçük grubunda ("Claude ile"), süzgeç
   çiplerinde Claude sonda ve ötekilerle aynı ağırlıkta. Telefonda kartlar
   tek sütun yatay satır (ikon, başlık, tek satır, "Dene"): 390×844'te ilk
   ekranda dört alan. Ölçüm Changelog.module.css → "Öne çıkanlar". */

/** "{n} Madde" / "1 Item" — İngilizcede tekil ayrı. */
function countLabel(n: number, many: string, one: string): string {
  return (n === 1 ? one : many).replace("{n}", String(n));
}

const intlLocale = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");

/** "22 Eki" — kısa gün etiketi (şerit, künye ve tek satırlık giriş). */
export function shortDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function weekday(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

const isExternal = (href: string) => /^https?:\/\//.test(href);

type Icon = typeof Sparkle;

/** Etiketin ikonu — renk sakin, biçim de ayırır (renk körlüğünde tek ipucu renk olmasın). */
const KIND_ICON: Record<ChangeKind, Icon> = { yeni: Sparkle, iyilestirme: ArrowCircleUp, duzeltme: Wrench };

/* "DENE" HEDEFİNİN İKONU: bağlantının açacağı ekran gezinmedeki ikonuyla
   görünür — okur "nereye gidiyorum" sorusunu metni okumadan cevaplıyor.
   Tek kaynak `NAV_ITEMS`; gezinmede olmayan ekranlar için küçük ek tablo.
   Modül düzeyinde bir kez kurulur (çizimde bileşen üretilmez). */
const EXTRA_ICON: Record<string, Icon> = {
  "/hisse": ChartLine,
  "/claude": Brain,
  "/ayarlar": GearSix,
  "/analizlerim": Notebook,
  "/raporum": Notebook,
  "/yazilarim": Notebook,
  "/bildirimler": BellRinging,
  "/giris": SignIn,
  "/kvkk": ShieldCheck,
  external: TelegramLogo,
};
const TARGET_ICON: Record<string, Icon> = {
  ...Object.fromEntries(NAV_ITEMS.map((item) => [item.href, item.icon])),
  ...EXTRA_ICON,
};
/** Bağlantısız maddede alanın kendi ikonu. */
const AREA_ICON: Record<ChangeArea, Icon> = {
  claude: Brain,
  piyasa: ChartLine,
  bilanco: TARGET_ICON["/bilancolar"] ?? ChartLine,
  kisisel: TARGET_ICON["/favoriler"] ?? Notebook,
  icerik: SquaresFour,
};


/**
 * Tür etiketi — renkli ama sakin (kompakt düzen): yıkanmış zemin, koyu
 * mürekkep. Yeni yeşil (eklenen), Düzeltme pirinç, İyileştirme nötr (mavi
 * etkileşim rengi, etiket bağlantı gibi okunurdu); her biri kendi ikonunu
 * da taşır.
 */
function KindTag({ kind, L }: { kind: ChangeKind; L: ChangelogLabels }) {
  const KindIcon = KIND_ICON[kind];
  return (
    <span className={styles.kind} data-kind={kind}>
      <KindIcon size={12} weight="bold" aria-hidden />
      {L.kind[kind]}
    </span>
  );
}

/** Maddenin "Dene" bağlantısı (eski sürümlerin açılan gövdesinde). */
function TryLink({ item, label, locale }: { item: ChangeItem; label: string; locale: Locale }) {
  if (!item.href) return null;
  const aria = `${label}: ${item.title}`;
  const Target = TARGET_ICON[tryTarget(item.href)] ?? ArrowRight;
  const lead = <Target size={14} weight="duotone" aria-hidden className={styles.tryIcon} />;
  if (isExternal(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={aria} className={`tap-44 ${styles.tryLink}`}>
        {lead}
        {label}
        <ArrowUpRight weight="bold" size={12} aria-hidden />
      </a>
    );
  }
  return (
    <Link href={withLocale(item.href, locale)} prefetch={false} aria-label={aria} className={`tap-44 ${styles.tryLink}`}>
      {lead}
      {label}
      <ArrowRight weight="bold" size={12} aria-hidden />
    </Link>
  );
}

/* ------------------------------------------------------------ Başlık künyesi */

/**
 * Başlık bandının sağı: üç sayı ve RSS tek sırada (`PageHeader` `action`).
 * Sayılar DENETİM değil künye; RSS sıranın tek denetimi olarak sonda.
 */
export function HeaderAside({
  totals,
  feedHref,
  locale,
  L,
  feedIcon,
}: {
  totals: { releases: number; items: number; updated: string };
  feedHref: string;
  locale: Locale;
  L: ChangelogLabels;
  feedIcon: ReactNode;
}) {
  return (
    <div className={styles.headAside}>
      <dl className={styles.stats} aria-label={L.statsLabel}>
        <div><dt>{L.statReleases}</dt><dd>{totals.releases}</dd></div>
        <div><dt>{L.statItems}</dt><dd>{totals.items}</dd></div>
        <div><dt>{L.statUpdated}</dt><dd>{shortDay(totals.updated, locale)}</dd></div>
      </dl>
      {/* Besleme bir sayfa değil (XML): ön yükleme yok, düz bağlantı. */}
      <a
        href={feedHref}
        aria-label={L.feedLabel}
        className="tap-44 inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-small font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
      >
        {feedIcon}
        {L.feedLink}
      </a>
    </div>
  );
}

/* ------------------------------------------------------------ Sürüm akışı */

/** Ölçek çizgilerinin adımı: tepe 6'ya kadar 2, 30'a kadar 5, üstü 10 madde. */
function gridStep(peak: number): number {
  return peak <= 6 ? 2 : peak <= 30 ? 5 : 10;
}

/**
 * SÜRÜM AKIŞI — yatay eksende her sürüm bir çubuk. Konum gün ölçeğinde
 * (sessiz haftalar boşluk olarak görünür), boy madde sayısı. En yeni sürüm
 * künyeli. Çubuğa basınca o sürüme kayar (sayfa içi çapa; katlı girişi
 * `RevealHashTarget` açar); imleç ya da odakta tarih ve başlık balonu.
 * Süzgeç açıkken eşleşmeyen sürümler solar (`matches`): akış her zaman
 * bütün geçmişi gösterir, süzgeç neyin kaldığını işaretler.
 *
 * OKUNUR AKIŞ (31 Ekim, sahibinin sözü: "ince çubuklar, okunması zor").
 * Eski çubuk 6 piksel enli, tek renkli (baskın alan) ve ölçeksizdi: boy
 * bir sayı söylemiyordu, renk sürümün yalnız bir alanını. Şimdi:
 *   - çubuk ALAN ALAN YIĞIN (`parts`): her dilim o alanın madde sayısı
 *     kadar; süzgeç çiplerindeki renk imi lejant olmaya devam ediyor;
 *   - en, gün diliminden (`--days`): 1440'ta ~10, 390'da ~3 piksel; aynı
 *     günde iki sürüm olmadığı için çubuklar üst üste binmez;
 *   - ölçek çizgileri (5, 10, 15 madde), en üstteki birimli; sıfır çizgisi
 *     `--line-strong` (grafik dili);
 *   - en yeni çubuğun tepesinde "Son · 16" künyesi (eski dolu baş yerine).
 * Boy DOĞRUSAL ve sıfırdan (oran × çizim yüksekliği): bir maddelik sürüm
 * kısa görünür, yalan söylemez.
 */
export function ReleaseStrip({
  points,
  ticks,
  matches,
  locale,
  L,
}: {
  points: readonly ReleasePoint[];
  ticks: readonly { month: string; x: number }[];
  /** Süzgeçten geçen sürümlerin günleri; süzgeç yoksa `null`. */
  matches: ReadonlySet<string> | null;
  locale: Locale;
  L: ChangelogLabels;
}) {
  if (points.length === 0) return null;
  const peak = Math.max(1, ...points.map((point) => point.items));
  const days = (points.at(-1)?.day ?? 0) + 1;
  const step = gridStep(peak);
  const grid = Array.from({ length: Math.floor(peak / step) }, (_, i) => (i + 1) * step);
  const monthName = new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" });
  return (
    <Panel aria-labelledby="yenilikler-akis" className={styles.strip}>
      <div className={styles.stripHead}>
        <h2 id="yenilikler-akis" className={styles.stripTitle} data-ink="plain">{L.stripTitle}</h2>
        <p className={styles.stripHint}>{L.stripHint}</p>
      </div>
      <nav
        aria-labelledby="yenilikler-akis"
        className={styles.laneWrap}
        data-filtered={matches ? "" : undefined}
        style={{ "--days": days } as CSSProperties}
      >
        <div className={styles.plot}>
          <ol className={styles.grid} aria-hidden>
            {grid.map((value, i) => (
              <li key={value} style={{ "--r": (value / peak).toFixed(3) } as CSSProperties}>
                <span className="numeral">
                  {value}
                  {i === grid.length - 1 && <span className={styles.gridUnit}>{L.stripScale.replace("{n}", "")}</span>}
                </span>
              </li>
            ))}
          </ol>
          <ol className={styles.bars}>
            {points.map((point, index) => {
              const ratio = point.items / peak;
              const latest = index === points.length - 1;
              const label = L.pointLabel
                .replace("{date}", shortDay(point.date, locale))
                .replace("{title}", point.title)
                .replace("{n}", String(point.items));
              return (
                <li
                  key={point.date}
                  className={styles.bar}
                  style={{ "--x": point.x, "--r": ratio.toFixed(3), "--i": index } as CSSProperties}
                  data-latest={latest || undefined}
                  data-side={point.x > 0.5 ? "left" : "right"}
                  data-match={!matches || matches.has(point.date) || undefined}
                >
                  <a href={`#${entryAnchor(point.date)}`} aria-label={label} className={styles.barLink}>
                    <span className={styles.barFill} aria-hidden>
                      {point.parts.map((part) => (
                        <span
                          key={part.area}
                          className={`${styles.barPart} ${styles.tone}`}
                          data-area={part.area}
                          style={{ flexGrow: part.count }}
                        />
                      ))}
                    </span>
                    {latest && (
                      <span className={`numeral ${styles.barLatest}`} aria-hidden>
                        {L.stripLatest.replace("{n}", String(point.items))}
                      </span>
                    )}
                    <span className={styles.tip} aria-hidden>
                      <strong>{shortDay(point.date, locale)}</strong> {point.title}
                      <span className={styles.tipParts}>
                        {point.parts.map((part) => (
                          <span key={part.area}>
                            <i className={`${styles.chipSwatch} ${styles.tone}`} data-area={part.area} />
                            {L.areaShort[part.area]} {part.count}
                          </span>
                        ))}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
        <ol className={styles.ticks} aria-hidden>
          {ticks.map((tick) => (
            <li key={tick.month} style={{ "--x": tick.x } as CSSProperties}>
              {monthName.format(new Date(`${tick.month}-01T12:00:00Z`))}
            </li>
          ))}
        </ol>
      </nav>
    </Panel>
  );
}

/* ------------------------------------------------------------ Süzgeç şeridi */

/**
 * Alan ve tür süzgeci — adreste (`?alan=`, `?tur=`), sunucu basar, çipler
 * `scroll={false}`. Seçili çipe yeniden basmak o süzgeci kaldırır. Alan
 * çiplerindeki renk imi akışın lejantı. Sayılar öbür süzgece göre
 * (tür seçiliyken alan çipleri o türün maddelerini sayar).
 */
export function FilterBar({
  kind,
  area,
  total,
  kindCount,
  areaCount,
  hrefFor,
  L,
}: {
  kind: ChangeKind | null;
  area: ChangeArea | null;
  total: number;
  kindCount: Record<ChangeKind, number>;
  areaCount: Record<ChangeArea, number>;
  hrefFor: (kind: ChangeKind | null, area: ChangeArea | null) => string;
  L: ChangelogLabels;
}) {
  return (
    <div className={styles.toolbar}>
      {/* Dar ekranda çipler kırılmak yerine kayar (analizler kalıbı). */}
      <ScrollEdges className="no-scrollbar -mx-4 flex max-w-full items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <FilterChip href={hrefFor(null, null)} active={!kind && !area}>
          {L.filterAll} <span className={styles.count}>{total}</span>
        </FilterChip>
        <span role="group" aria-label={L.areaFilterLabel} className={styles.chipGroup}>
          {AREA_DISPLAY_ORDER.map((value) => (
            <FilterChip key={value} href={hrefFor(kind, area === value ? null : value)} active={area === value}>
              <span className={`${styles.chipSwatch} ${styles.tone}`} data-area={value} aria-hidden />
              {L.areaShort[value]} <span className={styles.count}>{areaCount[value]}</span>
            </FilterChip>
          ))}
        </span>
        <span className={styles.chipDivider} aria-hidden />
        <span role="group" aria-label={L.filterLabel} className={styles.chipGroup}>
          {CHANGE_KINDS.map((value) => (
            <FilterChip key={value} href={hrefFor(kind === value ? null : value, area)} active={kind === value}>
              {L.kind[value]} <span className={styles.count}>{kindCount[value]}</span>
            </FilterChip>
          ))}
        </span>
      </ScrollEdges>
    </div>
  );
}

/* ------------------------------------------------------------- Son sürüm */

/** Bağlantının sarmalayıcısı: dış adres yeni sekmede, site içi yol dil önekiyle. */
function ItemLink({
  item,
  locale,
  className,
  children,
  extra,
}: {
  item: ChangeItem;
  locale: Locale;
  className: string;
  children: ReactNode;
  extra: Record<string, unknown>;
}) {
  if (!item.href) return <div className={className} {...extra}>{children}</div>;
  if (isExternal(item.href)) {
    return <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} {...extra}>{children}</a>;
  }
  return <Link href={withLocale(item.href, locale)} prefetch={false} className={className} {...extra}>{children}</Link>;
}

type Seen = { date: string; latest: string };

/**
 * ÖNE ÇIKAN KART — nötr zemin, alan rengi 3 piksellik tepe şeridinde (31 Ekim;
 * eskiden alan renginde yıkanmış zemin, gerekçe modül CSS başı),
 * hedef ekranın ikonu, başlık, tek satır özet ve "Dene" butonu. Kartın
 * tamamı bağlantı: buton görünümlü `span` içeride (iç içe etkileşim yok),
 * dokunma hedefi kartın kendisi.
 */
function FeatureCard({ item, locale, L, index, seen }: { item: ChangeItem; locale: Locale; L: ChangelogLabels; index: number; seen: Seen }) {
  const Target = (item.href ? TARGET_ICON[tryTarget(item.href)] : null) ?? AREA_ICON[item.area];
  return (
    <ItemLink
      item={item}
      locale={locale}
      className={`${styles.feature} ${styles.tone}`}
      extra={{ "data-area": item.area, "data-cl-featured": "", title: item.body, style: { "--i": index } as CSSProperties }}
    >
      <span className={styles.featureTop}>
        <span className={styles.featureIcon} aria-hidden>
          <Target size={22} weight="duotone" />
        </span>
        <span className={styles.featureArea}>{L.areaShort[item.area]}</span>
        {item.kind !== "yeni" && <KindTag kind={item.kind} L={L} />}
        <UnseenPill date={seen.date} latest={seen.latest} label={L.badge} srLabel={L.unseenLabel} className={styles.featurePill} />
      </span>
      <span className={styles.featureTitle}>{item.title}</span>
      <span className={styles.featureShort} aria-hidden>{item.short ?? item.body}</span>
      <span className="sr-only">{item.body}</span>
      {item.href && (
        <span className={styles.featureCta} aria-hidden>
          {L.try}
          {isExternal(item.href) ? <ArrowUpRight size={13} weight="bold" /> : <ArrowRight size={13} weight="bold" />}
        </span>
      )}
    </ItemLink>
  );
}

/** Kompakt karo: alan renginde ikon karosu + başlık + tek satır özet; karo bağlantının kendisi. */
/* Görülmemiş rozeti yalnız öne çıkan kartlarda ve eski girişin satırında:
   son sürümün on altı karosunun hepsinde "Yeni" yazınca rozet bilgi değil
   desen oluyordu (ölçüldü, 1440'ta 16 hap). Bölümün başlığındaki künye
   sürümün kendisini zaten işaret ediyor. */
function Tile({ item, locale, L, index }: { item: ChangeItem; locale: Locale; L: ChangelogLabels; index: number }) {
  const Target = (item.href ? TARGET_ICON[tryTarget(item.href)] : null) ?? AREA_ICON[item.area];
  return (
    <ItemLink
      item={item}
      locale={locale}
      className={`${styles.tile} ${styles.tone}`}
      extra={{ "data-area": item.area, title: item.body, style: { "--i": index } as CSSProperties }}
    >
      <span className={styles.tileIcon} aria-hidden>
        <Target size={18} weight="duotone" />
      </span>
      <span className={styles.tileCopy}>
        <span className={styles.tileTitle}>
          <span className={styles.tileName}>{item.title}</span>
          {item.kind !== "yeni" && <KindTag kind={item.kind} L={L} />}
        </span>
        <span className={styles.tileShort} aria-hidden>{item.short ?? item.body}</span>
        <span className="sr-only">{item.body}</span>
      </span>
      {item.href && (
        isExternal(item.href)
          ? <ArrowUpRight className={styles.tileArrow} size={14} weight="bold" aria-hidden />
          : <ArrowRight className={styles.tileArrow} size={14} weight="bold" aria-hidden />
      )}
    </ItemLink>
  );
}

/**
 * EN SON SÜRÜM — sayfanın ana görseli. Başlık izinli tek degrade yer (kısa
 * display başlık); künye (tarih, madde sayısı) genişte başlıkla aynı sırada.
 * Önce "Öne Çıkanlar" (en çok dört büyük kart; 1024 ve üstünde tek sıra,
 * altında iki sütun), sonra "Bu Sürümde Ayrıca" kompakt ızgara (1/2/3/4
 * sütun). Özet ve kapsam künyesi en altta (ekran düzeni: görsel, sonra
 * metin, sonra künye).
 */
export function LatestRelease({ entry, latest, locale, L }: { entry: ChangeEntry; latest: string; locale: Locale; L: ChangelogLabels }) {
  const headingId = "yenilikler-son-surum";
  const { featured, claude, rest } = splitLatest(entry.items);
  const seen = { date: entry.date, latest };
  return (
    <Panel id={entryAnchor(entry.date)} aria-labelledby={headingId} className={styles.latest}>
      <div className={styles.latestHead}>
        {/* Çok satırlı manşet: degrade satır satır (`data-ink="lines"`). */}
        <h2 id={headingId} data-ink="lines" className="text-lead font-bold tracking-[-0.02em] sm:text-heading">
          <span className="ink-line">{entry.title}</span>
        </h2>
        <p className={styles.latestMeta}>
          <span className={styles.latestBadge}>{L.latestBadge}</span>
          <time dateTime={entry.date}>{entryDateLabel(entry, locale)}</time>
          <span>{countLabel(entry.items.length, L.itemCount, L.itemCountOne)}</span>
        </p>
      </div>
      {featured.length > 0 && (
        <section aria-labelledby="yenilikler-one-cikan" className={styles.section}>
          <h3 id="yenilikler-one-cikan" className={styles.sectionHead} data-ink="plain">{L.featuredTitle}</h3>
          <ul className={styles.featureGrid} style={{ "--n": featured.length } as CSSProperties}>
            {featured.map((item, index) => (
              <li key={item.title}>
                <FeatureCard item={item} locale={locale} L={L} index={index} seen={seen} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {claude.length > 0 && (
        <section aria-labelledby="yenilikler-claude" className={styles.section}>
          <h3 id="yenilikler-claude" className={styles.sectionHead} data-ink="plain">
            <span className={`${styles.chipSwatch} ${styles.tone}`} data-area="claude" aria-hidden />
            {L.claudeTitle}
            <span className={styles.sectionCount}>{claude.length}</span>
          </h3>
          <ul className={styles.restGrid} data-group="claude">
            {claude.map((item, index) => (
              <li key={item.title}>
                <Tile item={item} locale={locale} L={L} index={index + featured.length} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="yenilikler-ayrica" className={styles.section}>
          <h3 id="yenilikler-ayrica" className={styles.sectionHead} data-ink="plain">
            {L.restTitle}
            <span className={styles.sectionCount}>{rest.length}</span>
          </h3>
          <ul className={styles.restGrid}>
            {rest.map((item, index) => (
              <li key={item.title}>
                <Tile item={item} locale={locale} L={L} index={index + featured.length + claude.length} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className={styles.latestSummary}>{entry.summary}</p>
      <p className={styles.note}>{L.footnote}</p>
    </Panel>
  );
}

/* --------------------------------------------------------- Eski sürümler */

/**
 * Bir ay — panel, `h2` ay adı, her giriş TEK SATIR katlı `<details>`
 * (gün, başlık, alan noktaları, madde sayısı). JS'siz; açılış globals.css
 * `::details-content` geçişiyle, bastığın yerden aşağı uzar (`ExpandInPlace`
 * kökte bağlı). Kapalıyken de içerik sunucu HTML'inde: sayfa içi arama ve
 * arama motoru maddeleri görüyor. Çapa girişin kendisinde
 * (`RevealHashTarget` kapalıysa açar). Okurun görmediği giriş satırında
 * "Yeni" rozeti.
 */
export function MonthPanel({ month, latest, locale, L }: { month: ChangeMonth; latest: string; locale: Locale; L: ChangelogLabels }) {
  const title = formatIsoMonth(month.month, locale);
  return (
    <Panel id={monthAnchor(month.month)} aria-label={title} className={styles.month}>
      <PanelHeader title={title} meta={countLabel(month.entries.length, L.entryCount, L.entryCountOne)} />
      <ol className={styles.entries}>
        {month.entries.map((entry) => (
          <li key={entry.date}>
            <details id={entryAnchor(entry.date)} className={styles.entry}>
              <summary className={styles.entryRow}>
                <time dateTime={entry.date} className={styles.whenDay}>
                  {entry.from ? entryDateLabel(entry, locale).replace(/,? \d{4}$/, "") : shortDay(entry.date, locale)}
                </time>
                <span className={styles.entryTitleCell}>
                  <span className={styles.entryTitle}>{entry.title}</span>
                  <UnseenPill date={entry.date} latest={latest} label={L.badge} srLabel={L.unseenLabel} />
                </span>
                {/* Alan payı (31 Ekim): renk noktaları yerine akıştaki
                    çubuğun yatay küçüğü; eni madde sayısı, dilimleri alanlar. */}
                <span
                  className={styles.entryDots}
                  role="img"
                  aria-label={entryAreas(entry).map((area) => L.area[area]).join(", ")}
                  style={{ "--n": entry.items.length } as CSSProperties}
                >
                  {AREA_DISPLAY_ORDER.map((area) => {
                    const count = entry.items.filter((item) => item.area === area).length;
                    return count > 0 ? (
                      <span key={area} className={`${styles.entryDot} ${styles.tone}`} data-area={area} style={{ flexGrow: count }} />
                    ) : null;
                  })}
                </span>
                <span className={styles.entryCount}>{countLabel(entry.items.length, L.itemCount, L.itemCountOne)}</span>
                <CaretDown className={styles.entryIcon} size={14} weight="bold" aria-hidden />
              </summary>
              <div className={styles.entryBody}>
                <p className={styles.entrySummary}>
                  <span className={styles.whenWeek}>{weekday(entry.date, locale)}</span> {entry.summary}
                </p>
                <ul className={styles.items}>
                  {entry.items.map((item) => (
                    <li key={item.title} className={`${styles.item} ${styles.tone}`} data-area={item.area}>
                      <span className={styles.itemHead}>
                        <KindTag kind={item.kind} L={L} />
                        <span className={styles.itemTitle}>{item.title}</span>
                      </span>
                      <span className={styles.itemBody}>{item.body}</span>
                      <TryLink item={item} label={L.try} locale={locale} />
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
