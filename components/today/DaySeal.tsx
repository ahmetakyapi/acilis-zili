import Image from "next/image";
import { ArrowRight, CaretDown, CaretUp, Minus } from "@phosphor-icons/react/dist/ssr";
import { posterStoryText } from "@/components/day-poster/story";
import { BreadthStrip } from "@/components/day-poster/PosterMarks";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { bellEnergy } from "@/lib/day-poster";
import { posterStory } from "@/lib/day-poster-story";
import { getDayPoster, getLatestPosterDate } from "@/lib/day-poster-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MarketStatus } from "@/lib/market-hours";
import { formatEtDateCompact } from "@/lib/utils";
import { BellEnergySource } from "./BellEnergySource";
import { tileFeedsBell } from "./day-tile";
import styles from "./DaySeal.module.css";

/**
 * SON SEANS KAROSU — kahramanın sol üstünde, seans çipinin altında
 * (24 Ekim künye olarak, 25 Ekim'de karoya döndü).
 *
 * NEDEN KARO (sahibi, 25 Ekim, 1480 ekran görüntüsü üzerine: "Günün
 * posteri kısmı da daha iyi durabilir"). Künye dört dağınık satırdı:
 * "23 Eki Kapanışı · Günün Posteri →" bağlantısı, etiketsiz ince bir
 * şerit + "130 Yükseldi · 363 Düştü" ve hafta sonu bir de "Sonraki Açılış"
 * satırı. Posterin NE olduğunu hiçbiri göstermiyordu. Şimdi tek karo,
 * tamamı posterin bağlantısı: posterin sahnesinin minyatürü (her hisse bir
 * nokta, sektör sektör; arşiv kartıyla AYNI dosya, `/gun/[tarih]/minyatur`),
 * günün kısa başlığı ve cümlesi (`posterStoryText`, posterin kendi cümlesi;
 * uydurma yok, şablon + veri) ve etiketli genişlik şeridi.
 * "Sonraki Açılış" satırı kalktı: aynı bilgi kahramanın üst şeridinde
 * (`BellLedger`: "Açılış Zili 16:30 TR · 26 Ekim Pazartesi") ve geri
 * sayımın gün hanesinde zaten yazıyor.
 *
 * HER SEANSTA (25 Ekim). Künye ön seansta ve asıl seansta hiç basılmıyordu;
 * sabah okuyucusu dünün nasıl kapandığını ilk ekranda göremiyordu. Karo
 * artık en yeni TAMAMLANMIŞ seansı anlatıyor (`getLatestPosterDate`) ve
 * künyesi tarihi söylüyor ("23 Eki Kapanışı"): seans sürerken bile hangi
 * günü anlattığı belli (CLAUDE.md "Veri dürüstlüğü" 4). Zilin şiddeti ise
 * yalnız bitmiş seansın kendi karosundan (`tileFeedsBell`, gerekçe orada).
 *
 * VERİ DÜRÜSTLÜĞÜ: kaynak Günün Posteri (`getDayPoster`, gün barları),
 * posterle aynı çağrı; karodaki "130 Yükseldi" ile posterdeki aynı sayı.
 * Poster yoksa (veri eksik, sağlayıcı düştü) karo hiç basılmıyor.
 * Genişlik hesaplanamadıysa şerit ve sayılar yok, sahne ve cümle kalıyor.
 *
 * Karo kendi Suspense sınırında (page.tsx): kahraman onu beklemiyor.
 * Ölçüler ve telefondaki bütçe DaySeal.module.css'te.
 */
export async function DaySeal({
  status,
  locale,
  t,
}: {
  status: MarketStatus;
  locale: Locale;
  t: Dictionary;
}) {
  const S = t.daySignature.seal;
  const date = await getLatestPosterDate(status);
  const read = await getDayPoster(date);
  if (read.state !== "ok") return null;
  const poster = read.poster;
  const breadth = poster.breadth && poster.breadth.known > 0 ? poster.breadth : null;
  const story = posterStoryText(poster, locale, t);
  const tone = posterStory(poster).tone;
  const close = S.close.replace("{date}", formatEtDateCompact(poster.date, locale));
  const ToneMark = tone === "up" ? CaretUp : tone === "down" ? CaretDown : Minus;

  return (
    <>
      <Link
        href={`/gun/${poster.date}`}
        className={styles.tile}
        aria-label={S.tileLabel.replace("{close}", close).replace("{sentence}", story.sentence)}
      >
        {/* Sahne süs değil ama karonun adı `aria-label`da; görsel `alt=""`.
            İki tema iki dosya, görünmeyen `display:none` ve tembel olduğu
            için hiç inmiyor (arşiv kartıyla aynı kalıp). */}
        <span className={styles.scene} aria-hidden>
          {(["acik", "koyu"] as const).map((theme) => (
            <Image
              key={theme}
              src={`/gun/${poster.date}/minyatur/${theme}`}
              alt=""
              width={MINI_W}
              height={MINI_H}
              unoptimized
              className={theme === "koyu" ? styles.sceneDark : styles.sceneLight}
            />
          ))}
        </span>
        <span className={styles.head}>
          <span className={styles.name}>{S.posterLink}</span>
          <span className={styles.close}>{close}</span>
          <ArrowRight aria-hidden weight="bold" size={12} className={styles.arrow} />
        </span>
        <span className={styles.story}>
          <span className={styles.title} data-tone={tone}>
            <ToneMark aria-hidden weight="fill" size={11} className={styles.mark} />
            {story.title}
          </span>
          <span className={styles.detail}>{story.detail}</span>
        </span>
        {breadth && (
          <span className={styles.breadth}>
            <BreadthStrip
              animate
              className={styles.strip}
              breadth={breadth}
              label={S.stripLabel
                .replace("{adv}", String(breadth.advancing))
                .replace("{dec}", String(breadth.declining))
                .replace("{flat}", String(breadth.unchanged))}
            />
            <span className={styles.counts} aria-hidden>
              <span className={styles.up}>
                <Count template={S.advancing} n={breadth.advancing} />
              </span>
              <span className={styles.down}>
                <Count template={S.declining} n={breadth.declining} delayMs={COUNT_STAGGER_MS} />
              </span>
            </span>
          </span>
        )}
      </Link>
      {tileFeedsBell(status, poster.date) && <BellEnergySource value={bellEnergy(poster.breadth)} />}
    </>
  );
}

/** Minyatürün kutusu — sahnenin `mini` düzeni (arşiv kartıyla aynı oran). */
const MINI_W = 320;
const MINI_H = 150;

/** İkinci sayı birincinin ardından dönsün (RollingFigure `delayMs`). */
const COUNT_STAGGER_MS = 120;

/** "{n} Yükseldi" kalıbında sayı yuvarlanıyor, sözcük yerinde. */
function Count({ template, n, delayMs = 0 }: { template: string; n: number; delayMs?: number }) {
  const [before, after = ""] = template.split("{n}");
  return (
    <>
      {before}
      <RollingFigure value={String(n)} delayMs={delayMs} />
      {after}
    </>
  );
}
