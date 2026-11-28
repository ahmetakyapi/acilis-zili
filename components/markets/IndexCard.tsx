import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChangePill, Panel } from "@/components/ui/primitives";
import { Sparkline, sparkFrame } from "@/components/ui/Sparkline";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Quote } from "@/lib/providers/types";
import { displayZone, formatInZone } from "@/lib/session-clock";
import { cn, directionOf, formatChange, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./MarketExperience.module.css";
import o from "./MarketsOverview.module.css";

/**
 * Piyasalar kapağının endeks kartı (18 Ekim; önce `piyasalar/page.tsx`
 * içinde satır içiydi). Sayfanın kendi dosyasında 1700 satır vardı ve kart
 * sayfanın en sık değişen parçası; "büyük sayfalar panellere bölünür".
 *
 * OKUMA SIRASI: ad ve fon → fiyat → yüzde + puan → gün içi eğri → gün
 * aralığı. Yüzde ile mutlak değişim YAN YANA: kart önce yalnız yüzdeyi
 * yazıyordu ve "707,87'lik fon bugün kaç dolar kaybetti" sorusu kart
 * açılmadan cevapsızdı. İkisi de aynı kotasyondan (`quote.change`,
 * `quote.changePct`), yani aynı sayının iki biçimi (veri dürüstlüğü 3).
 *
 * EĞRİNİN TABANI ADLANDIRILDI. Kesik çizgi önceki kapanıştı ama bunu
 * yazan bir şey yoktu; okuyucu çizgiyi açılış ya da ortalama sanabiliyordu.
 * Künye çizginin hemen üstünde ya da altında, eğrinin bittiği tarafın
 * TERSİNDE (fiyat kapanışın altındaysa künye üstte): son nokta ile künye
 * çakışmıyor. Konum `sparkFrame`ten, eğrinin kendi ölçeğinden — tahmin yok.
 * Seansın açılış ve kapanış anı eğrinin arkasında ince birer dikey çizgi:
 * ön seans ile asıl seans, eğrinin yarı tonundan başka bir yerde de okunuyor.
 *
 * KAHRAMAN VE SESSİZLER (28 Kasım 2026, görsel tur 3; sahibinin sözü:
 * "sayfada tek kahraman büyür, tekrar eden şeylerden uzaklaşalım"). Dört eşit
 * kart aynı beş satırı (ad, fiyat, yüzde, eğri + "Önceki Kapanış" künyesi,
 * gün aralığı) dört kez yazıyordu; seçili endeks yalnız kenar tonuyla
 * ayrılıyordu. Artık seçili endeks KAHRAMAN: display fiyat, kartın yarısını
 * tutan eğri, taban künyesi, açılış imi ve gün aralığı yalnız onda. Öteki
 * üçü SESSİZ: ad, fiyat, yüzde hapı ve imza boyunda bir eğri — künye ve
 * aralık tekrarlanmaz. Yerleşim `MarketsOverview.module.css` → "KAPAK".
 */

type Rail = { domain: [number, number]; openAt: number; closeAt: number };

/** Kartın SVG ölçüsü — Sparkline'a ve `sparkFrame`e aynı sayılar gider. */
/* 14 Kasım 2026: 44 → 64. Kapak tek kolona geçti (dört kart yan yana) ve
   eğri kartın ana görseli; 44 piksellik kutuda gün içi hareket bir çizik
   gibi okunuyordu. Çizgi 1,8 → 2 ("mini grafik çizgisi 2 piksel").
   28 Kasım 2026: ortak 64 ikiye ayrıldı — kahramanın eğrisi kartın ana
   görseli (kap 1440'ta ~200 piksel), sessiz kartınki imza (44). Viewbox
   yüksekliği kabın boyuna yakın: `sparkFrame`in künye konumu oranla
   hesaplanıyor, çizgi kalınlığı `non-scaling-stroke`. */
const HERO_SPARK = { height: 180, strokeWidth: 2 } as const;
const QUIET_SPARK = { height: 44, strokeWidth: 2 } as const;

export function IndexCard({
  href,
  label,
  proxy,
  quote,
  points,
  sparkOk,
  rail,
  selected,
  order,
  variant = "quiet",
  external = false,
  locale,
  t,
}: {
  href: string;
  /** Kart bir seçici değil, başka sayfaya giden bağlantı (Russell 2000,
      14 Kasım 2026; 28 Kasım'dan beri kahraman kart da — fonun kendi
      sayfası): gezinmede sayfa başa döner, `aria-current` taşımaz. */
  external?: boolean;
  label: string;
  proxy: string;
  quote: Quote | null;
  points: { time: number; value: number }[];
  /** Kotasyon bu seansa ait mi — değilse eğri ve gün aralığı HİÇ çizilmez. */
  sparkOk: boolean;
  rail: Rail;
  selected: boolean;
  /** Giriş kademesi — kartın sırası. */
  order: number;
  /** Kahraman (seçili endeks) ya da sessiz kart — gerekçe dosya başında. */
  variant?: "hero" | "quiet";
  locale: Locale;
  t: Dictionary;
}) {
  const hero = variant === "hero";
  const spark = hero ? HERO_SPARK : QUIET_SPARK;
  const tone = directionOf(quote?.changePct);
  const toneText = tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted";
  const drawSpark = Boolean(quote) && sparkOk && points.length > 1;
  const frame = drawSpark && hero
    ? sparkFrame({ points, height: spark.height, strokeWidth: spark.strokeWidth, baseline: quote!.prevClose, domain: rail.domain })
    : null;
  const baseShare = frame?.anchored && quote?.prevClose != null ? frame.yShare(quote.prevClose) : null;
  /* Künye çizginin hangi yanında: fiyat kapanışın altındaysa üstte. Çizgi
     kutunun üst ya da alt ucuna yakınsa künye içeride kalsın diye ters
     yana geçer (künyenin kendi boyu ~16 piksel; kahraman kap ~200). */
  const below = quote !== null && quote.prevClose !== null && quote.price >= quote.prevClose;
  const baseSide = baseShare === null ? null : baseShare < 0.16 ? "below" : baseShare > 0.84 ? "above" : below ? "below" : "above";
  const ticks = frame ? [frame.xShare(rail.openAt), frame.xShare(rail.closeAt)].filter((x): x is number => x !== null) : [];
  /* GÜN HENÜZ BİTMEDİYSE KART BOŞ DURMAZ (10 Kasım 2026). Eksen bütün
     seans (04:00 → uzatılmış seansın sonu) ve açılış öncesinde eldeki veri
     onun ilk %5–15'i: kartın solunda küçük bir kıpırtı, gerisi boş bir
     kesik çizgi — "grafik yüklenmemiş" gibi okunuyordu (canlı, 12:43 TR).
     Eksen DARALMIYOR (14 Ekim kararı: bar sırası günü yarım gösterir);
     boş kalan kısım adlandırılıyor, hepsi eldeki veriden:
     - SON FİYAT ÇİZGİSİ: eğrinin son noktasından sağ kenara noktalı ince
       çizgi, yön tonunda. Fiyatın şu anki seviyesi; önceki kapanışın kesik
       çizgisiyle arasındaki açıklık günün farkının kendisi. Tahmin değil:
       yatay ve noktalı, veri çizgisinin (dolu) devamı gibi çizilmiyor.
     - ÖN SEANS KUŞAĞI: açılış çizgisinin solu çukur tonda (`.preZone`);
       eldeki verinin eksenin hangi diliminde durduğu bir bakışta okunuyor.
     - AÇILIŞ İMİ ADIYLA: zilin dikey çizgisi "Açılış 17:30" künyesini
       taşıyor (saat okurun diliminde, `lib/session-clock.ts`); çizgi
       açılışın gerisindeyse boşluğun NEDEN boş olduğu yazıyor.
     Eğri eksenin %88'ini geçtiyse (seansın sonu) çizgi basılmaz.
     28 Kasım: üçü yalnız kahraman kartta; sessiz kartın eğrisi imza. */
  const last = frame?.shown.at(-1);
  const lastX = frame && last?.time !== undefined ? frame.xShare(last.time) : null;
  const nowLine = frame && last && lastX !== null && lastX < 0.88 ? { x: lastX, y: frame.yShare(last.value) } : null;
  const openX = frame ? frame.xShare(rail.openAt) : null;
  const openLabel = openX !== null && lastX !== null && lastX < openX
    ? `${t.markets.openTick} ${formatInZone(new Date(rail.openAt * 1000), displayZone(locale))}`
    : null;

  const range =
    hero && drawSpark && quote!.low !== null && quote!.high !== null && quote!.high > quote!.low
      ? { low: quote!.low, high: quote!.high }
      : null;
  const at = (value: number) =>
    range ? Math.min(100, Math.max(0, ((value - range.low) / (range.high - range.low)) * 100)) : 0;
  const pricePos = range ? at(quote!.price) : 0;
  /* Kapanıştan fiyata uzanan dolgu: gün aralığında bugünkü hareketin
     kendisi. Kapanış aralığın dışındaysa (boşlukla açılış) dolgu kulvarın
     ucundan başlıyor. Renk yalnız işaretten. */
  const closePos = range && quote!.prevClose !== null ? at(quote!.prevClose) : null;

  const sparkline = drawSpark ? (
    <Sparkline
      points={points}
      title={`${label} · ${locale === "tr" ? "1G" : "1D"}`}
      tone={tone}
      height={spark.height}
      showLastDot
      strokeWidth={spark.strokeWidth}
      baseline={quote!.prevClose}
      domain={rail.domain}
      split={rail.openAt}
      className={styles.spark}
    />
  ) : null;

  return (
    <Link
      href={href}
      scroll={external ? undefined : false}
      prefetch={external ? false : undefined}
      /* SEÇİLİ OLAN YALNIZCA RENKLE SÖYLENİYORDU. Kart seçildiğinde
         accent kenarlık ve tint alıyor ama ekran okuyucuya hiçbir şey
         ulaşmıyordu. Sektör çipleri (/sirketler) bunu zaten yapıyor.
         28 Kasım: seçili endeks artık kahraman kart ve fonun sayfasına
         gidiyor; seçim ekran okuyucuya şeritteki çipten (`aria-current`). */
      aria-current={selected && !external ? "true" : undefined}
      className={cn(styles.indexLink, hero ? o.heroLink : o.quietLink)}
      style={{ "--i": order } as CSSProperties}
    >
      <Panel className={cn("panel-hover", hero ? o.hero : o.quiet)} data-tone={tone}>
        <div className={o.cardHead}>
          <p className={o.cardName}>{label}</p>
          <p className={o.cardProxy}>
            <span className="numeral">{proxy}</span>
            {hero && <ArrowUpRight size={14} aria-hidden />}
          </p>
        </div>
        {!quote ? (
          <p className="mt-2 text-xs text-muted">{NO_VALUE}</p>
        ) : hero ? (
          <>
            <div className={o.heroReading}>
              <p className={cn("numeral", o.heroPrice)}>{formatPrice(quote.price, locale)}</p>
              <p className={cn("numeral", o.heroChange, toneText)}>
                <ChangePill changePct={quote.changePct} locale={locale} className={o.heroPill} />
                {quote.change !== null && <span>{formatChange(quote.change, locale)}</span>}
              </p>
            </div>
            {drawSpark && (
              <div className={cn(styles.chart, o.heroChart)}>
                {ticks.map((x) => (
                  <i key={x} className={styles.sessionTick} style={{ left: `${(x * 100).toFixed(2)}%` }} aria-hidden />
                ))}
                {openLabel && openX !== null && (
                  <i className={styles.preZone} style={{ width: `${(openX * 100).toFixed(2)}%` }} aria-hidden />
                )}
                {nowLine && (
                  <i
                    className={styles.nowLine}
                    data-tone={tone}
                    style={{ left: `${(nowLine.x * 100).toFixed(2)}%`, top: `${(nowLine.y * 100).toFixed(2)}%` }}
                    aria-hidden
                  />
                )}
                {sparkline}
                {baseShare !== null && quote.prevClose !== null && (
                  <span
                    className={cn(styles.baseLabel, o.heroBase)}
                    data-side={baseSide}
                    style={{ top: `${(baseShare * 100).toFixed(2)}%` }}
                  >
                    {t.markets.prevClose} <b className="numeral">{formatPrice(quote.prevClose, locale)}</b>
                  </span>
                )}
              </div>
            )}
            {drawSpark && openLabel && openX !== null && (
              <div className={styles.chartAxis}>
                <span className="numeral" style={{ left: `${(openX * 100).toFixed(2)}%` }}>{openLabel}</span>
              </div>
            )}
            {/* GÜN ARALIĞI (17 Ekim): kıvılcım şekli söylüyor, aralık
                ölçüyü — günün dibi ve tepesi arasında fiyat nerede.
                Kıvılcımla aynı kural: sayı bu seansa ait değilse yok.
                18 Ekim: kulvarda önceki kapanışın çentiği ve ondan fiyata
                uzanan dolgu — eğrinin tabanıyla aynı referans.
                28 Kasım: yalnız kahraman kartta ve adıyla. */}
            {range && (
              <div
                className={cn(styles.dayRange, o.heroRange)}
                aria-label={`${t.markets.dayRange}: ${formatPrice(range.low, locale)} – ${formatPrice(range.high, locale)}`}
              >
                <span className={o.heroRangeLabel}>{t.markets.dayRange}</span>
                <span className="numeral">{formatPrice(range.low, locale)}</span>
                <i className={styles.rangeLane} aria-hidden>
                  {closePos !== null && (
                    <>
                      <span
                        className={styles.rangeFill}
                        data-tone={tone}
                        style={{ left: `${Math.min(closePos, pricePos)}%`, width: `${Math.abs(pricePos - closePos)}%` }}
                      />
                      <span className={styles.rangeClose} style={{ left: `${closePos}%` }} />
                    </>
                  )}
                  <span className={styles.rangeDot} data-tone={tone} style={{ left: `${pricePos}%` }} />
                </i>
                <span className="numeral">{formatPrice(range.high, locale)}</span>
              </div>
            )}
          </>
        ) : (
          <div className={o.quietBody}>
            <div className={o.quietReading}>
              <p className={cn("numeral", o.quietPrice)}>{formatPrice(quote.price, locale)}</p>
              <ChangePill changePct={quote.changePct} locale={locale} size="sm" />
            </div>
            {sparkline && <div className={cn(styles.chart, o.quietChart)} aria-hidden>{sparkline}</div>}
          </div>
        )}
      </Panel>
    </Link>
  );
}
