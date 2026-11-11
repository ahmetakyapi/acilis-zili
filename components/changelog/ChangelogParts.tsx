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
  Globe,
  Notebook,
  ShieldCheck,
  SignIn,
  Sparkle,
  TelegramLogo,
  Wrench,
  X,
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
  entryDateLabel,
  kindCounts,
  latestDigest,
  monthAnchor,
  type ChangeArea,
  type ChangeEntry,
  type ChangeFilter,
  type ChangeItem,
  type ChangeKind,
  type ChangeMonth,
  type ChangeScreen,
  type FlowWeek,
  type ScreenSummary,
} from "@/lib/changelog";
import { tryTarget } from "@/lib/feed-visuals";
import { formatIsoMonth } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import type { ChangelogLabels } from "@/lib/i18n/dictionaries/changelog";
import { withLocale } from "@/lib/i18n/routing";
import styles from "./Changelog.module.css";

/* Sunucu bileşenleri — istemci JS'i yok. Tek istemci parçaları rozetler,
   okundu işareti ve katlamadaki çapayı açan küçük dinleyici (aynı klasör).

   ÜÇÜNCÜ DÜZEN (6 Kasım; sahibinin sözü: "son güncellemeyle ne geldi, neler
   iyileşti, neler değişti hem onlar görünsün hem yeni featurelar/yeni
   düzenlemeler EKRAN ve KATEGORİ bazlı görünebilsin; günlük akış daha kolay
   anlaşılabilsin; çok daha görsel, animasyonlu ve benzersiz").

   Önceki düzenler ve neden değişti:
   - 25 Ekim (ilk ve kompakt düzen): son sürüm alan alan karolar, en çok dört
     "Öne Çıkan" kart (her alandan bir, Claude kart değil kendi grubunda);
     eski sürümler ay panelinde tek satır katlı `<details>`. Sorun: sürümün
     ne GETİRDİĞİ ile neyi ONARDIĞI kartın köşesindeki küçük etiketten
     okunuyordu; eski sürümün içeriği ancak satır açılınca görünüyordu.
   - 31 Ekim (görsel tur): sürüm akışı alan alan yığın çubuk. Sorun: gün
     ölçeğinde çubuk 1440'ta ~10, 390'da ~3 piksel ve tek büyük sürüm (16)
     ölçeği belirlediği için ötekiler aynı kısa boyda.

   Şimdi, ekran düzeni sırasıyla (CLAUDE.md):
   1. Başlık bandı: ad, tek cümle; sağda üç sayı ve tek denetim RSS.
   2. SON GÜNCELLEMEDE (ana görsel): tür payı şeridi (bir çizgi: "15 maddenin
      kaçı yeni"), altında Ne Geldi / Ne İyileşti / Ne Düzeldi üç sütun,
      sayısıyla; dibinde dokunduğu ekranlar ve özet.
   3. HAFTALIK AKIŞ: her hafta bir sütun, türe göre yığın (`weeklyFlow`).
   4. EKRANLARA GÖRE: ekran haritası; karo hem ölçü (madde sayısı, tür payı,
      son değişiklik) hem süzgeç (`?ekran=`).
   5. Süzgeç şeridi: tür + alan (+ seçili ekranın kaldırma çipi).
   6. GÜNLÜK AKIŞ: ay ay zaman çizgisi; her gün bir düğüm, maddeleri tür
      ikonlu satırlar hâlinde AÇIK (eskiden satır başına katlıydı).

   RENK: tür renk taşır (Yeni `--up`, İyileştirme `--chart-c`, Düzeltme
   `--brass`) ve her yerde aynıdır: pay şeridi, sütun başı, akışın yığını,
   ekran karosunun çizgisi, günlük akıştaki ikon. Alanın rengi KALKTI (25-31
   Ekim'de `--chart-a..d` alan renkleriydi): aynı sayfada iki ayrı renk
   sözlüğü (alan + tür) lejantsız okunmuyordu; alan artık yalnız çip ve
   künye. Ekranı İKON söyler (gezinmedeki ikonuyla). */

/** "{n} Madde" / "1 Item" — İngilizcede tekil ayrı. */
function countLabel(n: number, many: string, one: string): string {
  return (n === 1 ? one : many).replace("{n}", String(n));
}

const intlLocale = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");

/** "22 Eki" — kısa gün etiketi (künye, ekran karosu, akış). */
function shortDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function monthShort(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function weekday(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

const isExternal = (href: string) => /^https?:\/\//.test(href);

type Icon = typeof Sparkle;

/** Türün ikonu — renk sakin, biçim de ayırır (renk körlüğünde tek ipucu renk olmasın). */
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
  "/zil-raporu": Notebook,
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

/** Ekranın ikonu — ekranın gezinmedeki ana rotasının ikonu. */
const SCREEN_ROUTE: Record<ChangeScreen, string> = {
  anasayfa: "/",
  piyasalar: "/piyasalar",
  hisse: "/hisse",
  teknik: "/teknik-analiz",
  bilancolar: "/bilancolar",
  takvim: "/takvim",
  mercek: "/mercek",
  gunluk: "/seans-silueti",
  portfoy: "/portfoy",
  rehber: "/rehber",
  hesap: "/ayarlar",
  site: "",
};
const SCREEN_ICON = Object.fromEntries(
  (Object.keys(SCREEN_ROUTE) as ChangeScreen[]).map((screen) => [screen, TARGET_ICON[SCREEN_ROUTE[screen]] ?? Globe]),
) as Record<ChangeScreen, Icon>;

/** Bağlantının sarmalayıcısı: dış adres yeni sekmede, site içi yol dil önekiyle. */
function ItemLink({
  item,
  locale,
  className,
  children,
  label,
}: {
  item: ChangeItem;
  locale: Locale;
  className: string;
  children: ReactNode;
  label?: string;
}) {
  if (!item.href) return <div className={className}>{children}</div>;
  if (isExternal(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <Link href={withLocale(item.href, locale)} prefetch={false} className={className} aria-label={label}>
      {children}
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
        <div><dt>{L.statReleases}</dt><dd className="numeral">{totals.releases}</dd></div>
        <div><dt>{L.statItems}</dt><dd className="numeral">{totals.items}</dd></div>
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

/* ------------------------------------------------------------ Son güncellemede */

/**
 * SON GÜNCELLEMEDE — dördüncü düzen (6 Kasım akşamı, sahibinin sözü: "böyle
 * bir tasarım kabul edilemez, bir designer gibi yaklaş").
 *
 * NEDEN: üçüncü düzen maddeleri TÜRE göre üç sütuna bölüyordu (Ne Geldi /
 * Ne İyileşti / Ne Düzeldi). Sütun uzunluğunu içerik belirliyordu: 6 Kasım
 * sürümünde 2 / 10 / 3 madde, yani 1440'ta ortadaki sütun ~850 piksel
 * uzarken iki yanında ~600'er piksellik boş alan kaldı; on satır aynı
 * gri kutu tekrar ediyordu ve sürümün özeti en dipte, sütunların altında
 * okunmuyordu.
 *
 * Şimdi iki kat:
 *   1. GİRİŞ (iki kolon, genişte): solda sürümün adı, tarihi ve tek
 *      paragraf özeti — okur önce ne olduğunu okuyor; sağda tonla ayrılmış
 *      ölçü kuyusu: üç tür sayısı (ikon + büyük rakam + ad), sayıların pay
 *      şeridi ve dokunduğu ekranların çipleri.
 *   2. MADDE IZGARASI: tür sütunu yok, maddeler tek ızgarada eşit kartlar
 *      (genişte üç, tablette iki, telefonda bir sütun); sıra Yeni →
 *      İyileştirme → Düzeltme (`latestDigest`in sırası, Claude her türün
 *      sonunda). Tür kartın tepesindeki 3 piksellik şeritte ve ikonlu
 *      etikette (sitenin kart dili: durum tepedeki şeritte); ızgara türlerin
 *      oranından bağımsız olarak hep dolu.
 * Ölçüm CSS'te ("SON GÜNCELLEMEDE").
 */
function KindShare({ counts, L }: { counts: Record<ChangeKind | "all", number>; L: ChangelogLabels }) {
  return (
    <div className={styles.share} role="img" aria-label={`${L.digestShare.replace("{n}", String(counts.all))}: ${CHANGE_KINDS.map((k) => `${L.kind[k]} ${counts[k]}`).join(", ")}`}>
      {CHANGE_KINDS.filter((kind) => counts[kind] > 0).map((kind, index) => (
        <span
          key={kind}
          className={`${styles.shareSeg} ${styles.k}`}
          data-kind={kind}
          style={{ flexGrow: counts[kind], "--i": index } as CSSProperties}
        />
      ))}
    </div>
  );
}

/** Son güncellemenin bir maddesi: tepede türün şeridi, tür hapı ile hedef
    ekran tek satırda, başlık, iki satıra kadar özet; kartın tamamı bağlantı. */
function DigestCard({ item, locale, L }: { item: ChangeItem; locale: Locale; L: ChangelogLabels }) {
  const KindIcon = KIND_ICON[item.kind];
  const Target = (item.href ? TARGET_ICON[tryTarget(item.href)] : undefined) ?? SCREEN_ICON[item.screen];
  return (
    <ItemLink
      item={item}
      locale={locale}
      className={styles.card}
      label={item.href ? `${L.kind[item.kind]}: ${item.title}` : undefined}
    >
      {/* Türün şeridi ayrı öğe: `ItemLink` sarmalayıcıya `data-kind`
          geçirmiyor, renk değişkeni (`.k`) bu öğede çözülüyor. */}
      <span aria-hidden className={`${styles.cardStrip} ${styles.k}`} data-kind={item.kind} />
      <span className={styles.cardTop}>
        <span className={`${styles.cardKind} ${styles.k}`} data-kind={item.kind}>
          <KindIcon size={13} weight="bold" aria-hidden />
          {L.kind[item.kind]}
        </span>
        <span className={styles.cardScreen}>
          <span className={styles.cardScreenIcon} aria-hidden>
            <Target size={13} weight="duotone" />
          </span>
          {L.screen[item.screen]}
          {item.area === "claude" && <span className={styles.rowClaude}> · Claude</span>}
        </span>
      </span>
      {item.href &&
        (isExternal(item.href) ? (
          <ArrowUpRight className={styles.cardArrow} size={15} weight="bold" aria-hidden />
        ) : (
          <ArrowRight className={styles.cardArrow} size={15} weight="bold" aria-hidden />
        ))}
      <span className={styles.cardTitle}>{item.title}</span>
      <span className={styles.cardShort} title={item.body}>{item.short ?? item.body}</span>
    </ItemLink>
  );
}

/**
 * Sürümün adı kısa display başlık (izinli tek degrade yer); tarih ve madde
 * sayısı başlığın altında (ekran düzeni: başlığa ait bilgi altına iner).
 * Ekran çipleri `?ekran=` süzgecini açar ve günlük akışa iner.
 */
export function LatestDigest({
  entry,
  latest,
  locale,
  L,
  screenHref,
}: {
  entry: ChangeEntry;
  latest: string;
  locale: Locale;
  L: ChangelogLabels;
  screenHref: (screen: ChangeScreen) => string;
}) {
  const items = latestDigest(entry).flatMap((column) => column.items);
  const counts = kindCounts([entry]);
  const screens = [...new Set(entry.items.map((item) => item.screen))];
  return (
    /* Özetin kendi çapası (6 Kasım, inceleme): `entryAnchor` hem burada hem
       günlük akıştaki aynı günde duruyordu; yinelenen id yüzünden haftalık
       sütundan ve RSS'ten gelen bağlantı akışa değil özete iniyordu. */
    <Panel id="son-guncelleme" aria-labelledby="yenilikler-son" className={styles.digest}>
      <PanelHeader title={L.digestTitle} meta={<UnseenPill date={entry.date} latest={latest} label={L.badge} srLabel={L.unseenLabel} />} />
      <div className={styles.lede}>
        <div className={styles.ledeText}>
          {/* Çok satırlı manşet: degrade satır satır (`data-ink="lines"`). */}
          <h3 id="yenilikler-son" data-ink="lines" className={styles.digestTitle}>
            <span className="ink-line">{entry.title}</span>
          </h3>
          <p className={styles.digestMeta}>
            <span className={styles.latestBadge}>{L.latestBadge}</span>
            <time dateTime={entry.date}>{entryDateLabel(entry, locale)}</time>
            <span>{countLabel(entry.items.length, L.itemCount, L.itemCountOne)}</span>
          </p>
          <p className={styles.digestSummary}>{entry.summary}</p>
        </div>
        <div className={styles.ledeFigures} data-draw>
          <dl className={styles.kindStats}>
            {CHANGE_KINDS.map((kind) => {
              const KindIcon = KIND_ICON[kind];
              return (
                <div key={kind} className={styles.k} data-kind={kind} data-zero={counts[kind] === 0 || undefined}>
                  <dt>
                    <span className={styles.kindStatIcon} aria-hidden>
                      <KindIcon size={14} weight="bold" />
                    </span>
                    {L.digestKind[kind]}
                  </dt>
                  <dd className="numeral">{counts[kind]}</dd>
                </div>
              );
            })}
          </dl>
          <KindShare counts={counts} L={L} />
          <div className={styles.digestScreens}>
            <span className={styles.digestScreensLabel}>{L.digestScreens}</span>
            <ul className={styles.screenChips}>
              {screens.map((screen) => {
                const ScreenIcon = SCREEN_ICON[screen];
                const n = entry.items.filter((item) => item.screen === screen).length;
                return (
                  <li key={screen}>
                    {/* Kaydırma AÇIK (öbür süzgeç bağlantılarının aksine): çip
                        süzülmüş günlük akışa gider (`#gunluk-akis`), sayfa
                        oraya iner; yerinde kalsaydı süzgecin sonucu ekranın
                        çok altında görünmezdi. */}
                    <Link href={screenHref(screen)} className={styles.screenChip}>
                      <ScreenIcon size={14} weight="duotone" aria-hidden />
                      {L.screen[screen]}
                      <span className={`numeral ${styles.screenChipCount}`}>{n}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
      <div className={styles.cardsStage}>
        <ul className={styles.cards}>
          {items.map((item, index) => (
            <li key={item.title} style={{ "--n": index } as CSSProperties}>
              <DigestCard item={item} locale={locale} L={L} />
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.note}>{L.footnote}</p>
    </Panel>
  );
}

/* ------------------------------------------------------------ Haftalık akış */

/** Ölçek çizgilerinin adımı: tepe 12'ye kadar 4, 30'a kadar 10, üstü 20 madde. */
function gridStep(peak: number): number {
  return peak <= 12 ? 4 : peak <= 30 ? 10 : 20;
}

/**
 * HAFTALIK AKIŞ — gerekçe `lib/changelog.ts` → `weeklyFlow`. Sütunlar
 * ızgarada alanı eşit böler; boy DOĞRUSAL ve sıfırdan (madde / tepe hafta).
 * Yığın türe göre, alttan Yeni, İyileştirme, Düzeltme. Süzgeç açıkken her
 * türün eşleşmeyen payı aynı yerde soluk kalır (ölçek ve sütun boyu
 * değişmez, okur süzgecin neyi bıraktığını bütünün içinde görür); tepedeki
 * sayı o zaman "eşleşen / toplam". Sütuna basınca o haftanın en yeni
 * (süzgeçten geçen) gününe iner; eşleşmesi olmayan hafta bağlantı değil.
 * Ay adı ayın ilk haftasının altında, gün numarası her sütunda.
 */
export function WeeklyFlow({
  weeks,
  filtered,
  locale,
  L,
}: {
  weeks: readonly FlowWeek[];
  filtered: boolean;
  locale: Locale;
  L: ChangelogLabels;
}) {
  if (weeks.length === 0) return null;
  const peak = Math.max(1, ...weeks.map((week) => week.total));
  const step = gridStep(peak);
  const grid = Array.from({ length: Math.floor(peak / step) }, (_, i) => (i + 1) * step);
  const monthName = new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" });
  return (
    <Panel aria-label={L.flowTitle} className={styles.flow}>
      <PanelHeader title={L.flowTitle} />
      <p className={styles.panelHint}>{L.flowHint}</p>
      <div className={styles.flowStage} data-draw>
      <div className={styles.flowPlot} style={{ "--n": weeks.length } as CSSProperties} data-filtered={filtered || undefined}>
        <ol className={styles.flowGrid} aria-hidden>
          {grid.map((value, i) => (
            <li key={value} style={{ "--r": (value / peak).toFixed(3) } as CSSProperties}>
              <span className="numeral">
                {value}
                {/* Birim yalnız en üst çizgide; telefonda düşer (sağ pay dar). */}
                {i === grid.length - 1 && <span className={styles.gridUnit}> {L.flowScale.replace("{n}", "").trim()}</span>}
              </span>
            </li>
          ))}
        </ol>
        <ol className={styles.weeks}>
          {weeks.map((week, index) => {
            const prev = weeks[index - 1];
            /* Ay adı ayın ilk haftasında; ilk sütun yalnız ertesi hafta aynı
               aydaysa (27 Tem haftasının "Tem"i 3 Ağu'nun "Ağu"suna biniyordu,
               390'da ölçüldü). */
            const next = weeks[index + 1];
            const newMonth = prev
              ? prev.start.slice(0, 7) !== week.start.slice(0, 7)
              : !next || next.start.slice(0, 7) === week.start.slice(0, 7);
            const latest = index === weeks.length - 1;
            const label = L.flowWeek
              .replace("{date}", shortDay(week.start, locale))
              .replace("{n}", filtered ? L.flowMatch.replace("{m}", String(week.matchedTotal)).replace("{n}", String(week.total)) : String(week.total))
              .replace("{r}", String(week.releases));
            const body = (
              <>
                <span className={`numeral ${styles.weekValue}`} aria-hidden data-zero={week.total === 0 || undefined}>
                  {week.total === 0 ? "" : filtered ? (
                    <><strong>{week.matchedTotal}</strong><span className={styles.weekOf}>/{week.total}</span></>
                  ) : week.total}
                </span>
                <span className={styles.stack} aria-hidden style={{ "--r": (week.total / peak).toFixed(3) } as CSSProperties}>
                  {CHANGE_KINDS.filter((kind) => week.counts[kind] > 0).map((kind) => (
                    <span key={kind} className={styles.stackKind} style={{ flexGrow: week.counts[kind] }}>
                      {week.matched[kind] > 0 && (
                        <span className={`${styles.seg} ${styles.k}`} data-kind={kind} style={{ flexGrow: week.matched[kind] }} />
                      )}
                      {week.counts[kind] - week.matched[kind] > 0 && (
                        <span className={`${styles.seg} ${styles.k}`} data-kind={kind} data-ghost style={{ flexGrow: week.counts[kind] - week.matched[kind] }} />
                      )}
                    </span>
                  ))}
                </span>
              </>
            );
            return (
              <li
                key={week.start}
                className={styles.week}
                style={{ "--i": index } as CSSProperties}
                data-latest={latest || undefined}
              >
                {week.anchor ? (
                  <a href={`#${entryAnchor(week.anchor)}`} aria-label={label} className={styles.weekLink}>{body}</a>
                ) : (
                  <span className={styles.weekLink} role="img" aria-label={label}>{body}</span>
                )}
                <span className={styles.weekDay} aria-hidden>
                  {latest ? (
                    <>
                      <span className={styles.weekNow}>{L.flowNow}</span>
                      <span className={styles.weekNowDay}>{Number(week.start.slice(8))}</span>
                    </>
                  ) : (
                    Number(week.start.slice(8))
                  )}
                </span>
                {newMonth && (
                  <span className={styles.weekMonth} aria-hidden>
                    {monthName.format(new Date(`${week.start}T12:00:00Z`))}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      </div>
      <p className={styles.flowLegend} aria-hidden>
        {CHANGE_KINDS.map((kind) => (
          <span key={kind} className={styles.k} data-kind={kind}>
            <i className={styles.swatch} />
            {L.kind[kind]}
          </span>
        ))}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------ Ekran haritası */

/**
 * EKRANLARA GÖRE — her ekran bir karo: gezinmedeki ikonu, adı, madde sayısı,
 * tür payıyla dolan çizgi (eni en kalabalık ekrana göre: karolar arası
 * karşılaştırma) ve son değiştiği gün. Karo süzgeçtir (`?ekran=`,
 * `scroll={false}`); seçili karoya yeniden basmak süzgeci kaldırır. Sayılar
 * öbür süzgeçlere göre (tür seçiliyse yalnız o tür sayılır); sayısı sıfıra
 * düşen karo soluk ve bağlantısız ama yerinde (ızgara zıplamaz).
 */
export function ScreenMap({
  summary,
  active,
  hrefFor,
  locale,
  L,
}: {
  summary: readonly ScreenSummary[];
  active: ChangeScreen | null;
  hrefFor: (screen: ChangeScreen | null) => string;
  locale: Locale;
  L: ChangelogLabels;
}) {
  const max = Math.max(1, ...summary.map((row) => row.counts.all));
  return (
    <Panel aria-label={L.screensTitle} className={styles.screens}>
      <PanelHeader title={L.screensTitle} />
      <p className={styles.panelHint}>{L.screensHint}</p>
      <ul className={styles.screenGrid} data-motion-stagger>
        {summary.map((row) => {
          const ScreenIcon = SCREEN_ICON[row.screen];
          const selected = active === row.screen;
          const inner = (
            <>
              <span className={styles.tileTop}>
                <span className={styles.tileIcon} aria-hidden>
                  <ScreenIcon size={18} weight="duotone" />
                </span>
                <span className={styles.tileLast}>
                  {row.last ? L.screenLast.replace("{date}", shortDay(row.last, locale)) : L.screenNone}
                </span>
                <span className={`numeral ${styles.tileCount}`}>{row.counts.all}</span>
              </span>
              <span className={styles.tileName}>{L.screen[row.screen]}</span>
              <span className={styles.tileTrack} aria-hidden>
                <span
                  className={styles.tileFill}
                  data-motion-draw="line"
                  style={{ "--w": (row.counts.all / max).toFixed(3), transformOrigin: "left center" } as CSSProperties}
                >
                  {CHANGE_KINDS.map((kind) =>
                    row.counts[kind] > 0 ? (
                      <span key={kind} className={`${styles.seg} ${styles.k}`} data-kind={kind} style={{ flexGrow: row.counts[kind] }} />
                    ) : null,
                  )}
                </span>
              </span>
            </>
          );
          return (
            <li key={row.screen}>
              {row.counts.all === 0 && !selected ? (
                <span className={styles.tile} data-empty>{inner}</span>
              ) : (
                <Link
                  href={hrefFor(selected ? null : row.screen)}
                  scroll={false}
                  aria-current={selected ? "true" : undefined}
                  className={styles.tile}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------ Süzgeç şeridi */

/**
 * Tür ve alan süzgeci — adreste (`?tur=`, `?alan=`; ekran `?ekran=` ekran
 * haritasında), sunucu basar, çipler `scroll={false}`. Seçili çipe yeniden
 * basmak o süzgeci kaldırır. Tür çiplerindeki renk imi akışın ve pay
 * şeridinin lejantı. Sayılar öbür süzgeçlere göre. Ekran seçiliyse şeridin
 * sonunda adıyla bir kaldırma çipi: süzgecin nerede açıldığını okur ekran
 * haritasına geri kaydırmadan görür.
 */
export function FilterBar({
  filter,
  total,
  kindCount,
  areaCount,
  hrefFor,
  L,
}: {
  filter: ChangeFilter;
  total: number;
  kindCount: Record<ChangeKind, number>;
  areaCount: Record<ChangeArea, number>;
  hrefFor: (next: Partial<ChangeFilter>) => string;
  L: ChangelogLabels;
}) {
  const { kind, area, screen } = filter;
  const ScreenIcon = screen ? SCREEN_ICON[screen] : null;
  return (
    <div className={styles.toolbar}>
      {/* Dar ekranda çipler kırılmak yerine kayar (analizler kalıbı). */}
      <ScrollEdges className="no-scrollbar -mx-4 flex max-w-full items-center gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <FilterChip href={hrefFor({ kind: null, area: null, screen: null })} active={!kind && !area && !screen}>
          {L.filterAll} <span className={styles.count}>{total}</span>
        </FilterChip>
        <span role="group" aria-label={L.filterLabel} className={styles.chipGroup}>
          {CHANGE_KINDS.map((value) => (
            <FilterChip key={value} href={hrefFor({ kind: kind === value ? null : value })} active={kind === value}>
              <span className={`${styles.swatch} ${styles.k}`} data-kind={value} aria-hidden />
              {L.kind[value]} <span className={styles.count}>{kindCount[value]}</span>
            </FilterChip>
          ))}
        </span>
        <span className={styles.chipDivider} aria-hidden />
        <span role="group" aria-label={L.areaFilterLabel} className={styles.chipGroup}>
          {AREA_DISPLAY_ORDER.map((value) => (
            <FilterChip key={value} href={hrefFor({ area: area === value ? null : value })} active={area === value}>
              {L.areaShort[value]} <span className={styles.count}>{areaCount[value]}</span>
            </FilterChip>
          ))}
        </span>
        {screen && ScreenIcon && (
          <>
            <span className={styles.chipDivider} aria-hidden />
            <Link href={hrefFor({ screen: null })} scroll={false} aria-label={`${L.screenClear}: ${L.screen[screen]}`} className={styles.screenActive}>
              <ScreenIcon size={14} weight="duotone" aria-hidden />
              <span className={styles.screenActiveLabel}>{L.screenFilterLabel}:</span> {L.screen[screen]}
              <X size={12} weight="bold" aria-hidden />
            </Link>
          </>
        )}
      </ScrollEdges>
    </div>
  );
}

/* ------------------------------------------------------------ Günlük akış */

/** Günlük akışta bir madde: tür ikonu, başlık ve gövde, ekran künyesi ve "Dene". */
function TimelineItem({ item, locale, L }: { item: ChangeItem; locale: Locale; L: ChangelogLabels }) {
  const KindIcon = KIND_ICON[item.kind];
  const ScreenIcon = SCREEN_ICON[item.screen];
  return (
    <li className={`${styles.tItem} ${styles.k}`} data-kind={item.kind}>
      <span className={styles.tKind} aria-hidden>
        <KindIcon size={13} weight="bold" />
      </span>
      <div className={styles.tCopy}>
        <p className={styles.tHead}>
          <span className="sr-only">{L.kind[item.kind]}: </span>
          <span className={styles.tTitle}>{item.title}</span>
        </p>
        <p className={styles.tBody}>{item.body}</p>
        <p className={styles.tMeta}>
          <span className={styles.tScreen}>
            <ScreenIcon size={13} weight="duotone" aria-hidden />
            {L.screen[item.screen]}
          </span>
          {item.href &&
            (isExternal(item.href) ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`${L.try}: ${item.title}`} className={`tap-44 ${styles.tTry}`}>
                {L.try}
                <ArrowUpRight weight="bold" size={12} aria-hidden />
              </a>
            ) : (
              <Link href={withLocale(item.href, locale)} prefetch={false} aria-label={`${L.try}: ${item.title}`} className={`tap-44 ${styles.tTry}`}>
                {L.try}
                <ArrowRight weight="bold" size={12} aria-hidden />
              </Link>
            ))}
        </p>
      </div>
    </li>
  );
}

/** Bir gün (giriş): tarih sütunu, çizgideki düğüm, başlık, tür sayıları, özet ve maddeler. */
function TimelineDay({ entry, latest, locale, L }: { entry: ChangeEntry; latest: string; locale: Locale; L: ChangelogLabels }) {
  const counts = kindCounts([entry]);
  const day = entry.from ? `${Number(entry.from.slice(8))}-${Number(entry.date.slice(8))}` : String(Number(entry.date.slice(8)));
  const headingId = `baslik-${entry.date}`;
  return (
    <li id={entryAnchor(entry.date)} className={styles.day} data-motion-reveal>
      <div className={styles.dayWhen}>
        <time dateTime={entry.date} className={`numeral ${styles.dayNum}`} data-range={entry.from ? "" : undefined}>
          <span className="sr-only">{entryDateLabel(entry, locale)}</span>
          <span aria-hidden>{day}</span>
        </time>
        <span className={styles.dayWeek} aria-hidden>
          <span className={styles.dayMonth}>{monthShort(entry.date, locale)}</span>
          <span className={styles.dayWeekday}>{weekday(entry.date, locale)}</span>
        </span>
      </div>
      {/* Çizginin bu günün payı: görünüme girince yukarıdan aşağı bir kez
          çizilir (`data-motion-draw="bar"`, kök tepe); hareketi azaltana tam. */}
      <span className={styles.dayRail} data-motion-draw="bar" style={{ transformOrigin: "center top" }} aria-hidden />
      <span className={styles.dayNode} aria-hidden />
      <div className={styles.dayBody}>
        <div className={styles.dayHead}>
          <h3 id={headingId} className={styles.dayTitle} data-ink="plain">{entry.title}</h3>
          <UnseenPill date={entry.date} latest={latest} label={L.badge} srLabel={L.unseenLabel} />
          <span className={styles.dayKinds} role="img" aria-label={CHANGE_KINDS.filter((k) => counts[k] > 0).map((k) => `${L.kind[k]} ${counts[k]}`).join(", ")}>
            {CHANGE_KINDS.filter((kind) => counts[kind] > 0).map((kind) => {
              const KindIcon = KIND_ICON[kind];
              return (
                <span key={kind} className={`${styles.dayKind} ${styles.k}`} data-kind={kind}>
                  <KindIcon size={12} weight="bold" aria-hidden />
                  <span className="numeral">{counts[kind]}</span>
                </span>
              );
            })}
          </span>
        </div>
        <p className={styles.daySummary}>{entry.summary}</p>
        <ul className={styles.tItems}>
          {entry.items.map((item) => (
            <TimelineItem key={item.title} item={item} locale={locale} L={L} />
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * Bir ay — panel, `h2` ay adı ve künyesi, içinde zaman çizgisi. Ay
 * katlanabilir (`<details>`): son iki ay ve süzgeç açıkken hepsi açık; daha
 * eskisi kapalı ama sunucu HTML'inde (sayfa içi arama ve arama motoru
 * maddeleri görüyor). Açılış globals.css `::details-content` geçişiyle,
 * bastığın yerden aşağı uzar (`ExpandInPlace` kökte bağlı). Çapa günün
 * kendisinde; kapalı ayın içindeki güne giden çapayı `RevealHashTarget`
 * açar. Zaman çizgisinin dolgusu okudukça iner (CSS `view()`; gerekçe
 * modül CSS'i).
 */
export function MonthPanel({
  month,
  open,
  latest,
  locale,
  L,
}: {
  month: ChangeMonth;
  open: boolean;
  latest: string;
  locale: Locale;
  L: ChangelogLabels;
}) {
  const title = formatIsoMonth(month.month, locale);
  const items = month.entries.reduce((n, entry) => n + entry.items.length, 0);
  return (
    <Panel id={monthAnchor(month.month)} aria-label={title} className={styles.month}>
      <details className={styles.monthFold} open={open}>
        <summary className={styles.monthSummary}>
          <PanelHeader
            title={title}
            meta={`${countLabel(month.entries.length, L.entryCount, L.entryCountOne)} · ${countLabel(items, L.itemCount, L.itemCountOne)}`}
            className={styles.monthHeader}
          />
          <CaretDown className={styles.monthIcon} size={14} weight="bold" aria-hidden />
        </summary>
        <ol className={styles.days}>
          {month.entries.map((entry) => (
            <TimelineDay key={entry.date} entry={entry} latest={latest} locale={locale} L={L} />
          ))}
        </ol>
      </details>
    </Panel>
  );
}
