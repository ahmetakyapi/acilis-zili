import type { CSSProperties } from "react";
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
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import {
  entryAnchor,
  entryAreas,
  entryDateLabel,
  groupByArea,
  monthAnchor,
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

/* Sunucu bileşenleri — istemci JS'i yok. Tek istemci parçaları rozet,
   okundu işareti ve katlamadaki çapayı açan küçük dinleyici (aynı klasör).

   YENİDEN DÜZEN (25 Ekim, sahibinin isteği: "çok yer kaplamış, alttaki
   kısım için çok kaydırma lazım; çok daha görsel, premium"). Önceki hâlde
   son sürümün 16 maddesi 3 sütunda ~170 piksellik kartlardı ve 1440×900'de
   ilk ekrana 6 madde giriyordu (önce görüntüsü); şimdi maddelerin tamamı
   giriyor (ölçüldü, alttaki piyasa şeridinin üstüne kadar). Düzen: tepede
   sürüm şeridi, son
   sürüm ALANLARA göre gruplanmış kompakt karolar (tek satır özet), eski
   sürümler tek satırlık katlı girişler. */

/** "{n} Madde" / "1 Item" — İngilizcede tekil ayrı. */
function countLabel(n: number, many: string, one: string): string {
  return (n === 1 ? one : many).replace("{n}", String(n));
}

const intlLocale = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");

/** "22 Eki" — kısa gün etiketi (şerit ve tek satırlık giriş). */
function shortDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function weekday(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

type Icon = typeof Sparkle;

/** Etiketin ikonu — renk değil biçim ayırır (etiketler ton farkıyla). */
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
  if (/^https?:\/\//.test(item.href)) {
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

/* ------------------------------------------------------------ Sürüm şeridi */

/** Nokta çapı — en az 7, en çok 26 piksel (telefonda %70); alan madde sayısıyla orantılı (karekök). */
const DOT_MIN = 7;
const DOT_RANGE = 19;

/**
 * SÜRÜM ŞERİDİ — sayfanın tepesinde sürüm akışı: yatay kulvar, her sürüm
 * bir nokta (boyu madde sayısı), konum gün ölçeğinde (sessiz haftalar boşluk
 * olarak görünür). Noktaya basınca o sürüme kayar (sayfa içi çapa; katlı
 * girişi `RevealHashTarget` açar). Altında üç sayı.
 */
export function ReleaseStrip({
  points,
  ticks,
  totals,
  locale,
  L,
}: {
  points: readonly ReleasePoint[];
  ticks: readonly { month: string; x: number }[];
  totals: { releases: number; items: number; updated: string };
  locale: Locale;
  L: ChangelogLabels;
}) {
  if (points.length === 0) return null;
  const peak = Math.max(1, ...points.map((point) => point.items));
  const monthName = new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" });
  return (
    <Panel aria-label={L.stripTitle} className={styles.strip}>
      <div className={styles.stripHead}>
        <h2 className={styles.stripTitle} data-ink="plain">{L.stripTitle}</h2>
        <dl className={styles.stats}>
          <div><dt>{L.statReleases}</dt><dd>{totals.releases}</dd></div>
          <div><dt>{L.statItems}</dt><dd>{totals.items}</dd></div>
          <div><dt>{L.statUpdated}</dt><dd>{shortDay(totals.updated, locale)}</dd></div>
        </dl>
      </div>
      <nav aria-label={L.stripTitle} className={styles.laneWrap}>
        <ol className={styles.lane}>
          {points.map((point, index) => {
            const size = DOT_MIN + DOT_RANGE * Math.sqrt(point.items / peak);
            const label = L.pointLabel
              .replace("{date}", shortDay(point.date, locale))
              .replace("{title}", point.title)
              .replace("{n}", String(point.items));
            return (
              <li
                key={point.date}
                className={styles.point}
                style={{ "--x": point.x, "--s": `${size.toFixed(1)}px`, "--i": index } as CSSProperties}
                data-latest={index === points.length - 1 || undefined}
              >
                <a href={`#${entryAnchor(point.date)}`} aria-label={label} className={styles.pointLink}>
                  <span className={styles.dot} aria-hidden />
                  <span className={styles.tip} aria-hidden>
                    <strong>{shortDay(point.date, locale)}</strong> {point.title}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
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

/* ------------------------------------------------------------- Son sürüm */

/** Kompakt karo: alan renginde ikon karosu + başlık + tek satır özet; karo bağlantının kendisi. */
function Tile({ item, locale, L, index }: { item: ChangeItem; locale: Locale; L: ChangelogLabels; index: number }) {
  const Target = (item.href ? TARGET_ICON[tryTarget(item.href)] : null) ?? AREA_ICON[item.area];
  const body = (
    <>
      <span className={styles.tileIcon} aria-hidden>
        <Target size={18} weight="duotone" />
      </span>
      <span className={styles.tileCopy}>
        <span className={styles.tileTitle}>
          {item.title}
          {item.kind !== "yeni" && <span className={styles.tileKind}>{L.kind[item.kind]}</span>}
        </span>
        <span className={styles.tileShort} aria-hidden>{item.short ?? item.body}</span>
        <span className="sr-only">{item.body}</span>
      </span>
      {item.href && (
        /^https?:\/\//.test(item.href)
          ? <ArrowUpRight className={styles.tileArrow} size={14} weight="bold" aria-hidden />
          : <ArrowRight className={styles.tileArrow} size={14} weight="bold" aria-hidden />
      )}
    </>
  );
  const common = { className: styles.tile, "data-area": item.area, title: item.body, style: { "--i": index } as CSSProperties };
  if (!item.href) return <div {...common}>{body}</div>;
  if (/^https?:\/\//.test(item.href)) {
    return <a href={item.href} target="_blank" rel="noopener noreferrer" {...common}>{body}</a>;
  }
  return <Link href={withLocale(item.href, locale)} prefetch={false} {...common}>{body}</Link>;
}

/**
 * EN SON SÜRÜM — sayfanın ana görseli. Başlık izinli tek degrade yer (kısa
 * display başlık). Maddeler ALANA göre gruplu (`groupByArea`), gruplar
 * çok sütunlu akışta (`columns`, grup bölünmez): 1440'ta dört, 768'de iki,
 * telefonda tek sütun sıkı liste. Her maddede "Yeni" rozeti yok — sürüm
 * zaten yeni; yalnız iyileştirme ve düzeltme küçük künyeyle ayrılır.
 * Panelin dibinde künye: bu listenin neyi kapsadığı.
 */
export function LatestRelease({ entry, locale, L }: { entry: ChangeEntry; locale: Locale; L: ChangelogLabels }) {
  const headingId = "yenilikler-son-surum";
  let index = 0;
  return (
    <Panel id={entryAnchor(entry.date)} aria-labelledby={headingId} className={styles.latest}>
      <div className={styles.latestHead}>
        {/* Çok satırlı manşet: degrade satır satır (`data-ink="lines"`). */}
        <h2 id={headingId} data-ink="lines" className="text-title font-bold tracking-[-0.02em] sm:text-heading">
          <span className="ink-line">{entry.title}</span>
        </h2>
        <p className={styles.latestMeta}>
          <span>{L.latestTitle}</span>
          <time dateTime={entry.date}>{entryDateLabel(entry, locale)}</time>
          <span>{countLabel(entry.items.length, L.itemCount, L.itemCountOne)}</span>
        </p>
      </div>
      <div className={styles.areas}>
        {groupByArea(entry.items).map((group) => (
          <section key={group.area} className={styles.area} data-area={group.area} aria-label={L.area[group.area]}>
            <h3 className={styles.areaHead} data-ink="plain">
              <span className={styles.areaSwatch} aria-hidden />
              {L.area[group.area]}
              <span className={styles.areaCount}>{group.items.length}</span>
            </h3>
            <ul className={styles.tiles}>
              {group.items.map((item) => (
                <li key={item.title}>
                  <Tile item={item} locale={locale} L={L} index={index++} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {/* Özet karoların ALTINDA (ekran düzeni: görsel, sonra metin). Üstte
          dururken telefonda dört satırla ilk karoyu ekranın dışına itiyordu
          (390×844'te ilk ekranda sıfır karo, ölçüldü). */}
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
 * (`RevealHashTarget` kapalıysa açar).
 */
export function MonthPanel({ month, locale, L }: { month: ChangeMonth; locale: Locale; L: ChangelogLabels }) {
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
                <span className={styles.entryTitle}>{entry.title}</span>
                <span className={styles.entryDots} aria-label={entryAreas(entry).map((area) => L.area[area]).join(", ")}>
                  {entryAreas(entry).map((area) => <span key={area} className={styles.entryDot} data-area={area} />)}
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
                    <li key={item.title} className={styles.item} data-area={item.area}>
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
