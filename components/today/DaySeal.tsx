import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { BreadthStrip } from "@/components/day-poster/PosterMarks";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { bellEnergy } from "@/lib/day-poster";
import { getDayPoster } from "@/lib/day-poster-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MarketStatus } from "@/lib/market-hours";
import { displayZone, formatInZone, zoneTag } from "@/lib/session-clock";
import { formatEtDateCompact } from "@/lib/utils";
import { BellEnergySource } from "./BellEnergySource";
import styles from "./DaySeal.module.css";

/**
 * KAPANIŞ KÜNYESİ — zil günün sonucunu taşıyor (24 Ekim).
 *
 * Kapanıştan sonra (akşam seansı, gece, hafta sonu, tatil) kahramanın
 * sayacı bir SONRAKİ açılışa sayıyor ve sayfanın tepesi biten seans
 * hakkında hiçbir şey söylemiyordu; endeks kartları yüzdeyi veriyor ama
 * "piyasanın ne kadarı" sorusu yoktu. Zilin solundaki bu künye o seansın
 * tek ince şeridini taşıyor: S&P 500 GENİŞLİĞİ. Şeridin parçaları
 * BÜYÜKLÜK (yükselen / değişmeyen / düşen hisse sayısı), renk yalnız
 * işaretten (CLAUDE.md "Çubuk büyüklüktür, yargı değil"). S&P 500'ün
 * yüzdesi bilerek burada YOK: yanındaki endeks kartında zaten yazıyor.
 *
 * VERİ DÜRÜSTLÜĞÜ: kaynak Günün Posteri (`getDayPoster`, gün barları) ve
 * yalnız TAMAMLANMIŞ seans: tarih `status.sessionDate`, poster o seansın
 * kapanışı + gecikme geçmeden `missing` dönüyor ve künye hiç basılmıyor.
 * Ön seans ve asıl seans boyunca künye yok — o saatlerde sayfa gelecek
 * seansı anlatıyor. Genişlik hesaplanamadıysa şerit yok, yalnız tarih ve
 * posterin bağlantısı.
 *
 * Hafta sonu ve tam tatilde altına bir satır: sonraki açılışın tarihi ve
 * okuyucunun birincil saatiyle saati (TR'de İstanbul, EN'de New York —
 * CLAUDE.md "Saat: TR önce").
 *
 * Künye kendi Suspense sınırında (page.tsx): posterin ilk okuması
 * sağlayıcıya üç tur; kahraman onu beklemiyor, künye gelince yerine
 * oturuyor. Zilin şiddetini de buradan veriyor (`BellEnergySource`).
 *
 * HAREKET (25 Ekim): şerit girişte soldan `--ease-brand` ile doluyor ve
 * iki sayı sitenin sayaç rakamlarıyla (`RollingFigure`) dönüyor — künye
 * kahramanın ilk ekranında, sayaç rakamlarının yeri tam burası. İkisi de
 * sunucuda çiziliyor; hareketi azaltana son kare (CSS).
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
  if (status.session === "regular" || status.session === "pre-market") return null;
  const S = t.daySignature.seal;
  const read = await getDayPoster(status.sessionDate);
  const poster = read.state === "ok" ? read.poster : null;
  const nextOpen = !status.tradingToday ? nextOpenLine(status, locale) : null;
  if (!poster && !nextOpen) return null;

  const breadth = poster?.breadth ?? null;
  const total = breadth ? breadth.known : 0;

  return (
    <div className={styles.seal}>
      {poster && (
        <>
          <p className={styles.line}>
            <span className={styles.close}>{S.close.replace("{date}", formatEtDateCompact(poster.date, locale))}</span>
            <Link href={`/gun/${poster.date}`} className={styles.link}>
              {S.posterLink}
              <ArrowRight aria-hidden weight="bold" size={12} />
            </Link>
          </p>
          {breadth && total > 0 && (
            <div className={styles.breadth}>
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
                <Count template={S.advancing} n={breadth.advancing} />
                <span className={styles.sep}>·</span>
                <Count template={S.declining} n={breadth.declining} delayMs={COUNT_STAGGER_MS} />
              </span>
            </div>
          )}
          <BellEnergySource value={bellEnergy(breadth)} />
        </>
      )}
      {nextOpen && (
        <p className={styles.line}>
          <span className={styles.close}>{S.nextOpen}</span>
          <span className={styles.next}>{nextOpen}</span>
        </p>
      )}
    </div>
  );
}

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

function nextOpenLine(status: MarketStatus, locale: Locale): string {
  const zone = displayZone(locale);
  const day = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: zone,
    /* UZUN AY (25 Ekim): kahramanın üst satırı aynı tarihi "26 Ekim
       Pazartesi" yazıyor; künye "26 Eki Pazartesi" deyince aynı kartta iki
       biçim duruyordu. Kural: haftanın günüyle birlikte ay uzun
       (`formatEtDateLong`), yalnız gün + ay künyesinde kısa ("23 Eki
       Kapanışı", `formatEtDateCompact`). Bedeli ölçüldü: 390'da satır
       artık iki satır (16 → 34 piksel; etiket üstte, değer altta TEK
       parça), 1280'de tek satır. Tutarlılık 18 pikselden ağır bastı. */
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(status.nextOpen);
  return `${day} ${formatInZone(status.nextOpen, zone)} ${zoneTag(locale).primary}`;
}
