import type { Metadata } from "next";
import Image from "next/image";
import { ArrowLeft, ArrowRight, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { ShareButton } from "@/components/article/ShareButton";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { EarningsTabs } from "@/components/earnings/EarningsTabs";
import { WeekBoard } from "@/components/earnings/week/WeekBoard";
import styles from "@/components/motion/DirectoryExperience.module.css";
import board from "@/components/earnings/week/WeekBoard.module.css";
import { DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import {
  dayLabel,
  defaultWeekStart,
  mondayOf,
  parseWeekParam,
  weekRangeLabel,
  WEEK_MAX_NAMES,
} from "@/lib/earnings-week";
import { getEarningsWeek } from "@/lib/earnings-week-data";
import { WEEK_OG_SIZES } from "@/lib/earnings-week-og";
import { getDictionary, getI18n, getLocale, INTL_LOCALE } from "@/lib/i18n";
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

type ImageKind = "yatay" | "dikey";

function imagePath(kind: ImageKind, monday: string): string {
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

export default async function EarningsWeekPage(props: PageProps<"/bilancolar/hafta">) {
  const search = await props.searchParams;
  const param = typeof search.hafta === "string" ? parseWeekParam(search.hafta) : null;
  const today = todayEt();
  const monday = param ?? defaultWeekStart(today);

  const { locale, t } = await getI18n();
  const w = t.earningsExtra.week;
  const week = await getEarningsWeek(monday, locale);
  const range = weekRangeLabel(monday, locale);

  const thisMonday = mondayOf(today);
  const weekHref = (target: string) =>
    target === defaultWeekStart(today) ? "/bilancolar/hafta" : `/bilancolar/hafta?hafta=${target}`;

  const all = week.days.flatMap((day) => [...day.bmo, ...day.amc, ...day.other]);
  const bmoCount = week.days.reduce((sum, day) => sum + day.bmo.length, 0);
  const amcCount = week.days.reduce((sum, day) => sum + day.amc.length, 0);
  /* En yoğun gün yalnızca bir gün öne çıkıyorsa yazılıyor: eşitlikte
     "Salı" demek, Perşembe'yi de aynı sayıyla saklamak olurdu. */
  const counts = week.days.map((day) => day.bmo.length + day.amc.length + day.other.length);
  const peak = Math.max(0, ...counts);
  const busiest =
    peak > 0 && counts.filter((count) => count === peak).length === 1
      ? week.days[counts.indexOf(peak)]
      : null;

  const images: { kind: ImageKind; size: "landscape" | "portrait"; label: string; alt: string }[] = [
    { kind: "yatay", size: "landscape", label: w.imageLandscape, alt: w.landscapeAlt },
    { kind: "dikey", size: "portrait", label: w.imagePortrait, alt: w.portraitAlt },
  ];

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <DirectoryHeader
        eyebrow={w.eyebrow}
        title={w.title}
        description={w.description}
      />

      <EarningsTabs active="calendar" t={t} className="-mt-2" />

      {/* ---- Seçim şeridi: hangi hafta, öteki haftalar, paylaş ----
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
          <ShareButton
            url={absoluteUrl(pagePath(monday, true), locale)}
            title={`${w.title} · ${range}`}
            labels={{ ...t.share, title: w.shareTitle }}
          />
        </nav>
      </div>

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
              <WeekBoard days={week.days} locale={locale} t={t} />

              {/* ---- Ölçüler ---- */}
              <dl className={board.stats}>
                <div className={board.stat}>
                  <dt className={board.statLabel}>{w.statCompanies}</dt>
                  <dd className={`figure ${board.statValue}`}>{week.picked}</dd>
                </div>
                <div className={board.stat}>
                  <dt className={board.statLabel}>{w.statBeforeOpen}</dt>
                  <dd className={`figure ${board.statValue}`}>{bmoCount}</dd>
                </div>
                <div className={board.stat}>
                  <dt className={board.statLabel}>{w.statAfterClose}</dt>
                  <dd className={`figure ${board.statValue}`}>{amcCount}</dd>
                </div>
                {busiest && (
                  <div className={board.stat}>
                    <dt className={board.statLabel}>{w.statBusiest}</dt>
                    <dd className={board.statValue}>{dayLabel(busiest.date, locale).weekday}</dd>
                  </div>
                )}
              </dl>
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

      {all.length > 0 && (
        <Panel>
          <PanelHeader title={w.imagesTitle} />
          <div className={board.images}>
            {images.map((image) => {
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
                      alt={image.alt.replace("{range}", range)}
                      width={dims.width}
                      height={dims.height}
                      unoptimized
                    />
                  </div>
                  <figcaption className={board.imageCaption}>
                    <span>{image.label}</span>
                    <a
                      href={src}
                      download={`${FILE_PREFIX}-${monday}-${dims.width}x${dims.height}.png`}
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

      <DataStamp
        source="finnhub"
        at={week.updatedAt}
        locale={locale}
        labels={t.data}
      />

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["bilanco"]} />
    </MotionExperience>
  );
}
