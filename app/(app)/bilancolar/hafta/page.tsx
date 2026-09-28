import type { Metadata } from "next";
import { cache, Suspense, type CSSProperties } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { ShareButton } from "@/components/article/ShareButton";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { EarningsTabs } from "@/components/earnings/EarningsTabs";
import {
  WeekBoard,
  WeekBoardSkeleton,
  WeekPulse,
  WeekPulseSkeleton,
} from "@/components/earnings/week/WeekBoard";
import styles from "@/components/motion/DirectoryExperience.module.css";
import board from "@/components/earnings/week/WeekBoard.module.css";
import { buttonClass, DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import {
  defaultWeekStart,
  mondayOf,
  parseWeekParam,
  weekRangeLabel,
  WEEK_MAX_NAMES,
} from "@/lib/earnings-week";
import { getEarningsWeek } from "@/lib/earnings-week-data";
import { WEEK_OG_SIZES } from "@/lib/earnings-week-og";
import { getDictionary, getI18n, getLocale, INTL_LOCALE, type Dictionary, type Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { absoluteUrl, pageAlternates } from "@/lib/site";

/**
 * Haftalık Bilanço Takvimi — `/bilancolar/hafta` (+ `?hafta=YYYY-MM-DD`).
 *
 * TAKVİMİN BİR GÖRÜNÜMÜ, DÖRDÜNCÜ SEKME DEĞİL. Sekme çubuğu aynı listenin
 * üç görünümünü taşıyor (takvim, analizler, takip) ve telefonda üç sekme
 * zaten satırı dolduruyor. Bu sayfa takvimin SEÇİLMİŞ bir haftası ve
 * paylaşılacak bir çıktı: `/bilancolar` takvim sekmesinden bağlanıyor,
 * burada da sekme çubuğu Takvim'i etkin gösteriyor — okuyucu hangi
 * bölümde olduğunu kaybetmiyor, çubuk da dördüncü bir sekmeye sıkışmıyor.
 *
 * Sayfa ile iki görsel AYNI veriyi okuyor (`getEarningsWeek`): görselde
 * görünen her şirket sayfada da var; sayfa görselin kırptığı "+N"leri de
 * gösteriyor.
 */

const FILE_PREFIX = "aciliszili-bilanco-haftasi";

function imagePath(kind: "yatay" | "dikey", monday: string): string {
  return `/bilancolar/hafta/gorsel?boyut=${kind}&hafta=${monday}`;
}

function pagePath(monday: string, explicit: boolean): string {
  return explicit ? `/bilancolar/hafta?hafta=${monday}` : "/bilancolar/hafta";
}

export async function generateMetadata(
  props: PageProps<"/bilancolar/hafta">,
): Promise<Metadata> {
  const search = await props.searchParams;
  const param = typeof search.hafta === "string" ? parseWeekParam(search.hafta) : null;
  const monday = param ?? defaultWeekStart(todayEt());
  const locale = await getLocale();
  const t = getDictionary(locale);
  const w = t.earningsExtra.week;
  const range = weekRangeLabel(monday, locale);
  return {
    title: w.metaTitle.replace("{range}", range),
    description: w.metaDescription.replace("{range}", range),
    alternates: pageAlternates(pagePath(monday, param !== null), locale),
    /* PAYLAŞIM KARTI HAFTANIN KENDİ GÖRSELİ. Dosya tabanlı OG kuralı sorgu
       görmediği için görsel bir Route Handler ve adresi burada veriliyor
       (gerekçe `gorsel/route.tsx`). `openGraph` kökle derin birleşmiyor;
       marka satırı elle (bkz. `articleOpenGraph`). */
    openGraph: {
      type: "website",
      siteName: t.brand.name,
      locale: INTL_LOCALE[locale].replace("-", "_"),
      images: [
        {
          url: absoluteUrl(imagePath("yatay", monday), locale),
          ...WEEK_OG_SIZES.landscape,
          alt: w.landscapeAlt.replace("{range}", range),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [absoluteUrl(imagePath("yatay", monday), locale)],
    },
  };
}

/**
 * Haftanın verisi istek içinde TEK okuma: kahramanın nabzı ve pano ayrı
 * Suspense sınırlarında ama aynı listeyi çiziyor (CLAUDE.md "Veri
 * dürüstlüğü" 3). Alttaki `getEarningsBetween` ve `getSymbolNames` zaten
 * önbellekli; bu sarmal seçimin kendisini de (sıralama, süzgeç) iki kez
 * koşturmuyor.
 */
const loadWeek = cache(getEarningsWeek);

type ImageKind = "yatay" | "dikey";

const IMAGE_KINDS: { kind: ImageKind; size: "landscape" | "portrait" }[] = [
  { kind: "yatay", size: "landscape" },
  { kind: "dikey", size: "portrait" },
];

function downloadName(monday: string, size: "landscape" | "portrait"): string {
  const dims = WEEK_OG_SIZES[size];
  return `${FILE_PREFIX}-${monday}-${dims.width}x${dims.height}.png`;
}

/**
 * İLK BAYT VERİYİ BEKLEMİYOR. Sayfa bir dönem takvimi ve sembol tablosunu
 * okuyup ancak ondan sonra ilk baytı gönderiyordu (soğuk önbellekte 252 ms,
 * 28 Eylül ölçümü). Kapak, sekme çubuğu, hafta seçimi ve indirme eylemleri
 * veriye bağlı değil — hepsi adresteki haftadan çıkıyor; yalnızca nabız ve
 * pano Suspense içinde akıyor ve yedekleri aynı ızgarayı tutuyor.
 */
export default async function EarningsWeekPage(props: PageProps<"/bilancolar/hafta">) {
  const search = await props.searchParams;
  const param = typeof search.hafta === "string" ? parseWeekParam(search.hafta) : null;
  const today = todayEt();
  const monday = param ?? defaultWeekStart(today);

  const { locale, t } = await getI18n();
  const w = t.earningsExtra.week;
  const range = weekRangeLabel(monday, locale);

  const thisMonday = mondayOf(today);
  const weekHref = (target: string) =>
    target === defaultWeekStart(today) ? "/bilancolar/hafta" : `/bilancolar/hafta?hafta=${target}`;

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <DirectoryHeader
        eyebrow={w.eyebrow}
        title={w.title}
        description={w.description}
        visual={
          <Suspense fallback={<WeekPulseSkeleton t={t} />}>
            <HeroPulse monday={monday} locale={locale} t={t} />
          </Suspense>
        }
      >
        {/* EYLEMLER KAHRAMANDA. Görseller sayfanın en altındaydı ve indirme
            bağlantısı ancak iki panel aşağıda bulunuyordu; oysa bu sayfanın
            işi paylaşılacak bir çıktı. Adresler haftadan çıkıyor, veriyi
            beklemiyor. */}
        <div className={board.heroActions}>
          {IMAGE_KINDS.map((image) => (
            <a
              key={image.kind}
              href={withLocale(imagePath(image.kind, monday), locale)}
              download={downloadName(monday, image.size)}
              className={buttonClass({
                variant: image.kind === "yatay" ? "primary" : "ghost",
                size: "md",
              })}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
              {image.kind === "yatay" ? w.downloadLandscape : w.downloadPortrait}
            </a>
          ))}
          <ShareButton
            url={absoluteUrl(pagePath(monday, true), locale)}
            title={`${w.title} · ${range}`}
            labels={{ ...t.share, title: w.shareTitle }}
          />
        </div>
      </DirectoryHeader>

      <EarningsTabs active="calendar" t={t} className="-mt-2" />

      {/* ---- Seçim şeridi: hangi hafta, öteki haftalar ----
          Bağlantılar `scroll={false}`: hafta değiştiren okuyucu sayfanın
          başına fırlamasın (CLAUDE.md, sayfa içi süzgeç kuralı). */}
      <div className={board.strip}>
        <p className={board.range}>{range}</p>
        <nav aria-label={w.navLabel} className={board.stripActions}>
          <Link href={weekHref(addEtDays(monday, -7))} scroll={false} className={board.navLink}>
            <ArrowLeft size={14} weight="bold" aria-hidden />
            {w.prevWeek}
          </Link>
          {monday !== thisMonday && (
            <Link href={weekHref(thisMonday)} scroll={false} className={board.navLink}>
              {w.thisWeek}
            </Link>
          )}
          <Link href={weekHref(addEtDays(monday, 7))} scroll={false} className={board.navLink}>
            {w.nextWeek}
            <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        </nav>
      </div>

      <Suspense
        fallback={
          <Panel>
            <PanelHeader title={w.boardTitle} />
            <div className={board.boardPanel}>
              <WeekBoardSkeleton />
            </div>
          </Panel>
        }
      >
        <WeekBody monday={monday} range={range} today={today} locale={locale} t={t} />
      </Suspense>

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["bilanco"]} />
    </MotionExperience>
  );
}

async function HeroPulse({ monday, locale, t }: { monday: string; locale: Locale; t: Dictionary }) {
  const week = await loadWeek(monday, locale);
  return <WeekPulse days={week.days} picked={week.picked} locale={locale} t={t} />;
}

async function WeekBody({
  monday,
  range,
  today,
  locale,
  t,
}: {
  monday: string;
  range: string;
  today: string;
  locale: Locale;
  t: Dictionary;
}) {
  const w = t.earningsExtra.week;
  const week = await loadWeek(monday, locale);
  const labels = { landscape: w.imageLandscape, portrait: w.imagePortrait };
  const alts = { landscape: w.landscapeAlt, portrait: w.portraitAlt };
  /* Sütun oranı = görselin en/boy oranı: iki görsel aynı yükseklikte biter
     (gerekçe WeekBoard.module.css → .images). */
  const ratio = (size: "landscape" | "portrait") =>
    WEEK_OG_SIZES[size].width / WEEK_OG_SIZES[size].height;
  const imageColumns = `minmax(0, ${ratio("landscape")}fr) minmax(0, ${ratio("portrait")}fr)`;

  return (
    <>
      <Panel>
        <PanelHeader
          title={w.boardTitle}
          meta={w.countCompanies.replace("{count}", String(week.picked))}
        />
        {week.picked === 0 ? (
          <EmptyState title={w.empty} hint={w.emptyHint} scene="chart" />
        ) : (
          <>
            <div className={board.boardPanel}>
              <WeekBoard days={week.days} locale={locale} t={t} today={today} />
            </div>

            {/* ---- Künyeler: panelin içinde, hairline ile ---- */}
            <div className={board.notes}>
              <p>
                {w.countOf
                  .replace("{count}", String(week.picked))
                  .replace("{total}", String(week.total))}{" "}
                {w.noteSelection.replace("{max}", String(WEEK_MAX_NAMES))}
              </p>
              <p>{w.noteTimes}</p>
            </div>
          </>
        )}
      </Panel>

      {week.picked > 0 && (
        <Panel>
          <PanelHeader title={w.imagesTitle} />
          <div
            className={board.images}
            style={{ "--image-columns": imageColumns } as CSSProperties}
          >
            {IMAGE_KINDS.map((image) => {
              const src = withLocale(imagePath(image.kind, monday), locale);
              const dims = WEEK_OG_SIZES[image.size];
              return (
                <figure key={image.kind} className={board.imageFigure}>
                  <div className={board.imageFrame}>
                    {/* `unoptimized`: görsel zaten bu sunucunun ürettiği bir
                        PNG ve adresi sorgu taşıyor; iyileştiriciden geçmesi
                        hem gereksiz hem `localPatterns` kaydı isterdi.
                        Tembel yükleme `next/image`in varsayılanı — iki kart
                        yalnızca panele inilince çiziliyor. */}
                    <Image
                      src={src}
                      alt={alts[image.size].replace("{range}", range)}
                      width={dims.width}
                      height={dims.height}
                      unoptimized
                    />
                  </div>
                  <figcaption className={board.imageCaption}>
                    <span>{labels[image.size]}</span>
                    <a
                      href={src}
                      download={downloadName(monday, image.size)}
                      className={board.download}
                    >
                      <DownloadSimple size={15} weight="bold" aria-hidden />
                      {w.download}
                    </a>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </Panel>
      )}

      <DataStamp source="finnhub" at={week.updatedAt} locale={locale} labels={t.data} />
    </>
  );
}
