import { seriesPath } from "@/components/stock/average-paths";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Bar } from "@/lib/providers/types";
import { ladderOf } from "@/lib/technical";
import { cn, formatEtDateMedium, formatPrice } from "@/lib/utils";
import { PriceChartScrub } from "./PriceChartScrub";
import { buildPriceChart, chartLabelSlots, type ChartLevel } from "./price-chart";
import styles from "./PriceChart.module.css";

/* İki etiket arası en az pay, çizim yüksekliğinin oranı. Etiket satırı 16
   piksel + 4 hava; en kısa çizim telefonda 260 piksel (CSS) → 20/260. */
const LABEL_GAP = 0.077;

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
 * dikey eksen yok: eksenin kendisi seviyeler, adları ve fiyatları sağ
 * sütunda. Yakın seviyelerin etiketleri itilir (`chartLabelSlots`) ve kısa
 * DÜZ bir bağ çizgisi etiketi asıl yerine bağlar; merdivendeki kıvrımlı
 * bağlar ve sol ray (sahibinin "nokta/çentik" itirazı sınıfı) yok.
 *
 * HAREKET. Fiyat çizgisi `spark-line`, uç nokta `spark-dot`: sayfa
 * `MotionExperience` içinde ve onun kuralı geçerli (ilk ekrandaki çizim
 * sabit, ekranın altındaki görünüme girince bir kez soldan çizilir).
 * Grafik kapakta, yani çoğu açılışta ilk ekranda ve SON KAREDE durur
 * (ölçüldü, 1440×900: `getAnimations()` çizgide 0); dar ve kısa ekranda
 * katın altına düşerse girişte bir kez oynar. Sunucu son kareyi basar;
 * hareketi azaltanda hiç oynamaz. Ortalamalar ve seviyeler hareketsiz.
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
  /* Bölgenin aralığı sütuna ancak üç haneli fiyatlarda sığar ("353,07–356,22"
     78 piksel; "1.255,35–1.271,10" 118 piksel, sütun 126). Sığmayacaksa
     etiket yalnız adıdır: bant çizimde, sayılar plan panelinde ve defterde. */
  const valueOf = (level: ChartLevel) => {
    if (level.high === undefined || level.high === level.price) return formatPrice(level.price, locale);
    const range = `${formatPrice(level.price, locale)}–${formatPrice(level.high, locale)}`;
    return range.length <= 13 ? range : "";
  };

  type Label = { key: string; tone: ChartLevel["tone"] | "price"; y: number; name: string; value: string };
  const labels: Label[] = [
    ...model.levels.map((level) => ({ key: `${level.kind}-${level.price}`, tone: level.tone, y: level.y, name: nameOf(level), value: valueOf(level) })),
    ...(model.priceY !== null && price !== null
      ? [{ key: "price", tone: "price" as const, y: model.priceY, name: priceLabel, value: formatPrice(price, locale) }]
      : []),
  ];
  const slots = chartLabelSlots(labels.map((label) => label.y), LABEL_GAP);
  const pct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;
  const stopLevel = model.levels.find((level) => level.kind === "stop");
  const first = model.dates[0]!;
  const last = model.dates[model.dates.length - 1]!;
  const month = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { month: "short", timeZone: "UTC" });

  return (
    <figure
      className={styles.chart}
      data-draw
      aria-label={v.chartLabel.replace("{from}", formatEtDateMedium(first, locale)).replace("{to}", formatEtDateMedium(last, locale))}
      role="img"
    >
      <div className={styles.frame}>
        <div className={styles.plot}>
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
        {/* Bağ çizgileri: seviyenin asıl yerinden etiketin itilmiş yerine,
            düz ve kısa (16 piksellik kanal). İtilmemiş etikette yatay. */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.leaders} aria-hidden focusable="false">
          {labels.map((label, index) => (
            <line key={label.key} data-tone={label.tone} x1="0" y1={(label.y * 100).toFixed(2)} x2="100" y2={(slots[index]! * 100).toFixed(2)} />
          ))}
        </svg>
        <ol className={styles.labels} aria-hidden>
          {labels.map((label, index) => (
            <li key={label.key} data-tone={label.tone} style={{ top: pct(slots[index]!) }}>
              <span>{label.name}</span>
              <b className="numeral">{label.value}</b>
            </li>
          ))}
        </ol>
      </div>
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
