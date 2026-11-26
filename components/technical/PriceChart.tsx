import type { CSSProperties } from "react";
import { seriesPath } from "@/components/stock/average-paths";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Bar } from "@/lib/providers/types";
import { distancePct, ladderOf } from "@/lib/technical";
import { cn, formatEtDateMedium, formatPercent, formatPrice } from "@/lib/utils";
import { PriceChartScrub } from "./PriceChartScrub";
import { buildPriceChart, buildPriceLens, LENS_PAD, lensLabelSlots, type ChartLevel } from "./price-chart";
import styles from "./PriceChart.module.css";

/* Mercekte iki satır arası en az pay, merceğin yüksekliğinin oranı. Satır
   22 piksel + 4–6 hava (fiyat çipi 26) = 26–28 piksel. Mercek masaüstünde
   çizimle aynı boy (340, CSS `--plot-h`; 12 satıra kadar adım ≥ 28).
   Telefonda en az 232 piksel ve satır sayısıyla UZAR (`--lens-h`): sahte
   AMD'de on seviye + fiyat 232'ye 21 piksel adımla sıkışıp üst üste
   biniyordu (ölçüldü, 390). */
const ROW_GAP_WIDE = 28 / 340;
const ROW_STEP_NARROW = 28;
const LENS_MIN_NARROW = 232;
/* Büyütme bu kattan azsa ne yazılır ne çizilir (bant tonu, kama yüzeyi):
   seviyeler grafiğin zaten büyük kısmını kaplıyorsa (sahte AMD/MU: 1,0–1,6
   kat) ton bütün çizimi griye boyuyor ve "büyütme" bir şey anlatmıyordu.
   Mercek ve bağ çizgileri yine durur. */
const ZOOM_NOTE_MIN = 2;

/**
 * KAPAĞIN KAHRAMANI: FİYAT GRAFİĞİ VE SEVİYELER AYNI EKSENDE (14 Kasım 2026,
 * görsel tur; sahibinin isteği: "gerçek bir tasarımcı gözünden").
 *
 * NEDEN. Teknik analiz sayfasında fiyatın geçmişi yoktu: destek, direnç,
 * bölge ve stop yalnız yatay bir ölçekte (`LevelScale`) ve dikey bir
 * merdivende (`PriceLadder`) duruyordu. Okur "160,71 desteği" sayısını
 * görüyor ama fiyatın oraya NEREDEN geldiğini, o seviyenin geçmişte kaç kez
 * tuttuğunu, ortalamaların üstünde mi altında mı kaldığını göremiyordu.
 * Artık son altı ayın günlük kapanış çizgisi, 20/50/200 günlük ortalamalar
 * ve yayındaki bütün seviyeler tek fiyat ekseninde. Bu grafik geldiği için
 * kapaktaki "Fiyat Ölçeği" şeridi ve sayfadaki "Fiyat Haritası" merdiveni
 * (aynı beş sayının iki ayrı çizimi) kalktı; sayılar `LevelList`te.
 *
 * VERİ. Hisse sayfasının "Hareketli Ortalamalar" panelinin çağırdığı
 * `getChartBars(symbol, "1Y", status)` (aynı istek, yeni sağlayıcı çağrısı
 * yok). Bar yoksa ya da seri bayatsa (`stale`) sayfa bu bileşeni HİÇ basmaz
 * ve eski ölçek kalır (`TechnicalCover`). Son nokta kotasyon: başlıktaki
 * fiyat ile çizginin ucu aynı sayı.
 *
 * DİL. İnce grafik: fiyat en koyu mürekkep 2 piksel, ortalamalar nötr ve
 * çizgi biçimiyle ayrışır (düz, kesik, noktalı; hisse sayfasındaki
 * `AveragesChart` ile aynı kural, renk yön taşıdığı için ortalamaya renk
 * verilmez). Seviyeler yatay kıl çizgi: destek/direnç nötr kesik, hedef
 * yükseliş, SAT'ın satış seviyesi ve stop düşüş renginde, alım bölgesi mavi
 * bant, stopun altı soluk düşüş yıkaması ("plan geçersiz" alanı). Sayısal
 * dikey eksen yok: eksenin kendisi seviyeler.
 *
 * SEVİYE MERCEĞİ (26 Kasım 2026; sahibinin sözü: "grafiğin sağ tarafı küçük
 * kalmış, saçma duruyor"). 14 Kasım'da seviyelerin adı ve fiyatı grafiğin
 * KENDİ ölçeğindeki yerlerine, 132 piksellik bir sütuna yazılıyordu. Fiyat
 * altı ayın tepesinden uzaksa bütün plan grafiğin dar bir bandına düşüyor:
 * canlıda MU (SAT, 615,28) altı seviye + fiyat 591–691 arasındaydı, bant
 * 340 piksellik çizimin alttaki ~50 pikseliydi; yedi 16 piksellik etiket
 * o bandın etrafına itilip yelpaze gibi eğik bağlarla asılıyordu ve planın
 * asıl bilgisi okunmuyordu. Artık sağ sütun KENDİ ölçeği olan bir mercek
 * (`buildPriceLens`): alanını yalnız seviyeler ve son fiyat kurar, grafikteki
 * bant (hafif ton) ile mercek arasındaki kama bandın büyütüldüğünü çizer;
 * merceğin içinde her seviye gerçek oranında, adı, fiyata uzaklığı
 * (`LevelList` ile aynı hesap, `distancePct`) ve fiyatıyla. Grafiğin ölçeği
 * DEĞİŞMEDİ: altı ayı kırpıp seviyeleri büyütmek geçmişi saklardı (tepeden
 * düşüş SAT'ın gerekçesi), iki ölçek iki ayrı soruya cevap veriyor.
 * Değerlendirilen öteki yol (y ölçeğini seviyelere odaklayıp tepeyi kesmek)
 * bu yüzden seçilmedi. Kama ve satırlardaki eğik bağlar artık büyütmenin
 * kendisi: dar banttan geniş merceğe açılıyorlar, birkaç piksellik itme
 * dışında satırlar gerçek yerinde. Telefonda kama yok: mercek grafiğin
 * ALTINDA tam genişlikte, bant grafikte aynı tonla işaretli.
 * Ölçüm `PriceChart.module.css` başında.
 *
 * HAREKET. Fiyat çizgisi `spark-line`, uç nokta `spark-dot`: sayfa
 * `MotionExperience` içinde ve onun kuralı geçerli (ilk ekrandaki çizim
 * sabit, ekranın altındaki görünüme girince bir kez soldan çizilir).
 * Grafik kapakta, yani çoğu açılışta ilk ekranda ve SON KAREDE durur
 * (ölçüldü, 1440×900: `getAnimations()` çizgide 0); dar ve kısa ekranda
 * katın altına düşerse girişte bir kez oynar. Sunucu son kareyi basar;
 * hareketi azaltanda hiç oynamaz. Ortalamalar, seviyeler ve mercek
 * hareketsiz (mercek bir ölçek, çizim değil).
 *
 * OKUMA. Üzerine gelince/dokununca o günün tarihi ve kapanışı
 * (`PriceChartScrub`, tek istemci adası); JS yoksa grafik eksiksiz.
 */
export function PriceChart({
  bars,
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  verdict,
  priceLabel,
  locale,
  t,
}: {
  bars: readonly Bar[];
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  verdict: VerdictKey;
  priceLabel: string;
  locale: Locale;
  t: Dictionary;
}) {
  const sellSide = verdict === "sell";
  const model = buildPriceChart(bars, price, ladderOf({ entryLow, entryHigh, stop, targets, supports, resistances }), sellSide);
  if (!model) return null;
  const lens = buildPriceLens(model);
  const v = t.technicalVisuals;
  const nameOf = (level: ChartLevel) => {
    switch (level.tone) {
      case "target":
        return t.technical.target.replace("{n}", String(level.order ?? 1));
      case "sellLevel":
        return v.chartSell.replace("{n}", String(level.order ?? 1));
      case "resistance":
        return t.technical.resistance;
      case "entry":
        return v.chartZone;
      case "support":
        return t.technical.support;
      case "stop":
        return t.technical.stop;
    }
  };
  const valueOf = (level: ChartLevel) =>
    level.high === undefined || level.high === level.price
      ? formatPrice(level.price, locale)
      : `${formatPrice(level.price, locale)}–${formatPrice(level.high, locale)}`;
  /* Uzaklık `LevelList` ile aynı hesap: bölgede en yakın kenara, içindeyse
     "Bölgede". Fiyat yoksa sütun boş kalır (tire duvarı yok). */
  const distanceOf = (level: ChartLevel) => {
    if (price === null) return "";
    const reference =
      level.high !== undefined ? (price > level.high ? level.high : price < level.price ? level.price : price) : level.price;
    const pct = distancePct(reference, price);
    if (pct === null) return "";
    return level.kind === "entry" && pct === 0 ? v.inZone : formatPercent(pct, locale, 1);
  };

  type Row = { key: string; tone: ChartLevel["tone"] | "price"; chartY: number; y: number; name: string; distance: string; value: string };
  const rows: Row[] = lens
    ? [
        ...model.levels.map((level, index) => ({
          key: `${level.kind}-${level.price}`,
          tone: level.tone,
          chartY: level.y,
          y: lens.levelYs[index]!,
          name: nameOf(level),
          distance: distanceOf(level),
          value: valueOf(level),
        })),
        ...(lens.priceY !== null && model.priceY !== null && price !== null
          ? [{ key: "price", tone: "price" as const, chartY: model.priceY, y: lens.priceY, name: priceLabel, distance: "", value: formatPrice(price, locale) }]
          : []),
      ]
    : [];
  const wide = lensLabelSlots(rows.map((row) => row.y), ROW_GAP_WIDE);
  /* Telefon merceğinin boyu: satırlar pay içinde (1 − 2·LENS_PAD) en az
     28 piksel adımla dizilsin (fiyat çipi 26, satır 22: en az 4 piksel hava). */
  const narrowHeight = Math.max(LENS_MIN_NARROW, Math.ceil(((rows.length - 1) * ROW_STEP_NARROW) / (1 - 2 * LENS_PAD)));
  const narrow = lensLabelSlots(rows.map((row) => row.y), ROW_STEP_NARROW / narrowHeight);
  const pct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;
  const at = (fraction: number) => (fraction * 100).toFixed(2);
  const stopLevel = model.levels.find((level) => level.kind === "stop");
  const stopIndex = stopLevel ? model.levels.indexOf(stopLevel) : -1;
  const first = model.dates[0]!;
  const last = model.dates[model.dates.length - 1]!;
  const month = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { month: "short", timeZone: "UTC" });
  const zoom = lens && lens.zoom >= ZOOM_NOTE_MIN ? Math.round(lens.zoom * 10) / 10 : null;
  const zoomText = zoom !== null ? new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", { maximumFractionDigits: 1 }).format(zoom) : null;

  return (
    <figure
      className={styles.chart}
      data-lens={lens ? "" : undefined}
      data-zoom={zoom !== null ? "" : undefined}
      style={lens ? ({ "--lens-h": `${narrowHeight}px` } as CSSProperties) : undefined}
      data-draw
      aria-label={v.chartLabel.replace("{from}", formatEtDateMedium(first, locale)).replace("{to}", formatEtDateMedium(last, locale))}
      role="img"
    >
      <div className={styles.plot}>
        {/* Merceğe giren bant: grafikte hafif ton, kama ve mercek aynı tonda
            devam eder (tek yüzey gibi okunsun). */}
        {lens && <span className={styles.focus} style={{ top: pct(lens.chartTop), height: pct(lens.chartBottom - lens.chartTop) }} />}
        {stopLevel && <span className={styles.void} style={{ top: pct(stopLevel.y) }} />}
        {model.levels.map((level) =>
          level.yTop !== undefined && level.yBottom !== undefined ? (
            <span
              key={`band-${level.price}`}
              className={styles.band}
              style={{ top: pct(level.yTop), height: `max(4px, ${pct(level.yBottom - level.yTop)})` }}
            />
          ) : (
            <span key={`line-${level.kind}-${level.price}`} className={styles.level} data-tone={level.tone} style={{ top: pct(level.y) }} />
          ),
        )}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.svg} aria-hidden focusable="false">
          {model.averages.map((average) => (
            <path key={average.window} data-window={average.window} d={seriesPath(average.values, model.domain)} />
          ))}
          <path className="spark-line" data-price="" d={seriesPath(model.closes, model.domain)} />
        </svg>
        {model.priceY !== null && <i className={cn("spark-dot", styles.dot)} style={{ top: pct(model.priceY) }} />}
        <PriceChartScrub dates={model.dates} closes={model.closes} min={model.domain.min} max={model.domain.max} locale={locale} />
      </div>

      {lens && (
        <>
          {/* Kama: grafikteki bandın iki kenarından merceğin iki kenarına; her
              satırın bağı seviyenin grafikteki yerinden mercekteki satırına. */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.wedge} aria-hidden focusable="false">
            <polygon points={`0,${at(lens.chartTop)} 100,0 100,100 0,${at(lens.chartBottom)}`} />
            <line data-edge="" x1="0" y1={at(lens.chartTop)} x2="100" y2="0" />
            <line data-edge="" x1="0" y1={at(lens.chartBottom)} x2="100" y2="100" />
            {rows.map((row, index) => (
              <line key={row.key} data-tone={row.tone} x1="0" y1={at(row.chartY)} x2="100" y2={at(wide[index]!)} />
            ))}
          </svg>
          <p className={styles.lensHead} aria-hidden>
            <span>{t.technical.lensTitle}</span>
            {zoomText && <b className="numeral">{t.technical.lensZoom.replace("{n}", zoomText)}</b>}
          </p>
          <ol className={styles.lens} aria-hidden>
            {lens.bands.map((band, index) =>
              band ? <li key={`zone-${index}`} className={styles.lensBand} style={{ top: pct(band.top), height: `max(4px, ${pct(band.bottom - band.top)})` }} /> : null,
            )}
            {stopIndex >= 0 && <li className={styles.lensVoid} style={{ top: pct(lens.levelYs[stopIndex]!) }} />}
            {rows.map((row, index) => (
              <li
                key={row.key}
                className={styles.row}
                data-tone={row.tone}
                style={{ "--wide": pct(wide[index]!), "--narrow": pct(narrow[index]!) } as CSSProperties}
              >
                <span className={styles.rowName}>{row.name}</span>
                {row.distance && <span className={cn(styles.rowDistance, "numeral")}>{row.distance}</span>}
                <b className={cn(styles.rowValue, "numeral")}>{row.value}</b>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className={styles.months} aria-hidden>
        {model.months
          .filter((tick) => tick.x > 0.03 && tick.x < 0.95)
          .map((tick) => (
            <span key={tick.date} style={{ left: pct(tick.x) }}>
              {month.format(new Date(`${tick.date}T12:00:00Z`))}
            </span>
          ))}
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.legend}>
          <span data-price="">{v.legendPrice}</span>
          {model.averages.map((average) => (
            <span key={average.window} data-window={average.window}>
              {t.stock.movingAverageShort.replace("{n}", String(average.window))}
            </span>
          ))}
        </span>
        <span className={styles.note}>
          {v.chartNote}
          {model.offScale > 0 && ` · ${v.chartOffScale.replace("{n}", String(model.offScale))}`}
        </span>
      </figcaption>
    </figure>
  );
}
