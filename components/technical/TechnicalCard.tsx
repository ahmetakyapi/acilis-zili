import { ArrowUpRight, CaretDown, CaretUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Quote } from "@/lib/providers/types";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import {
  editionTime,
  indicatorSignals,
  planPosition,
  slotLabel,
  stanceChangeLabel,
  technicalHref,
  type PlanPosition,
  type PlanReading,
} from "@/lib/technical";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";
import { PlanRail } from "./PlanRail";
import { PlanStrip } from "./PlanStrip";
import styles from "./Technical.module.css";

/** Değişim rozetinin rengi — yeni görüşün rengi. */
export function changeToneClass(verdict: VerdictKey): string {
  return verdict === "buy" ? "text-up" : verdict === "sell" ? "text-down" : "text-primary-ink";
}

/** Plan konumunun etiketi; uzaklık işaretsiz, yönü cümle söylüyor. */
export function planPositionLabel(position: PlanPosition, locale: Locale, t: Dictionary): string {
  switch (position.kind) {
    case "inZone":
      return t.technical.planInZone;
    case "belowStop":
      return t.technical.planBelowStop;
    case "above":
      return t.technical.planAbove.replace("{n}", formatPercentPlain(position.pct, locale, 1));
    case "below":
      return t.technical.planBelow.replace("{n}", formatPercentPlain(position.pct, locale, 1));
  }
}

/**
 * Planın okuması — tek cümle. Sayılar `planReading`ten, cümleler sözlükten;
 * eksik seviye (stop yok, destek yok) cümlenin daha kısa bir sürümüne düşer,
 * "—" basılmaz.
 */
export function planReadingText(reading: PlanReading, locale: Locale, t: Dictionary): string {
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const pct = (value: number) => formatPercentPlain(value, locale, 1);
  switch (reading.kind) {
    case "inZone":
      if (reading.hold) return t.technical.readingHoldInZone;
      return reading.stop === null
        ? t.technical.readingInZoneNoStop
        : t.technical.readingInZone.replace("{stop}", money(reading.stop));
    case "above":
      return t.technical.readingAbove.replace("{n}", pct(reading.pct)).replace("{high}", money(reading.high));
    case "below":
      return reading.stop === null
        ? t.technical.readingBelowNoStop.replace("{n}", pct(reading.pct))
        : t.technical.readingBelow.replace("{n}", pct(reading.pct)).replace("{stop}", money(reading.stop));
    case "belowStop":
      return t.technical.readingBelowStop.replace("{stop}", money(reading.stop));
    case "wait":
      if (reading.support !== null && reading.resistance !== null) {
        return t.technical.readingWait
          .replace("{support}", money(reading.support))
          .replace("{resistance}", money(reading.resistance));
      }
      if (reading.support !== null) return t.technical.readingWaitSupport.replace("{support}", money(reading.support));
      if (reading.resistance !== null) {
        return t.technical.readingWaitResistance.replace("{resistance}", money(reading.resistance));
      }
      return t.technical.readingWaitPlain;
    case "sell":
      if (reading.level !== null && reading.support !== null) {
        return t.technical.readingSell.replace("{level}", money(reading.level)).replace("{support}", money(reading.support));
      }
      if (reading.level !== null) return t.technical.readingSellLevel.replace("{level}", money(reading.level));
      if (reading.support !== null) return t.technical.readingSellSupport.replace("{support}", money(reading.support));
      return t.technical.readingSellPlain;
  }
}

/** Okumanın tonu — bölgede ve stop altı kesin, gerisi nötr. */
export function planReadingTone(reading: PlanReading): "up" | "down" | "flat" {
  if (reading.kind === "inZone" && !reading.hold) return "up";
  if (reading.kind === "belowStop" || reading.kind === "sell") return "down";
  return "flat";
}

/* Analiz anındaki fiyat ile canlı fiyat arasındaki fark bu eşiğin altında
   kalırsa ne halka ne künye basılıyor: 0,1'in altında halka noktanın
   altında kalıyor, künye de aynı sayıyı ikinci kez yazıyordu. */
const SNAPSHOT_MOVE_PCT = 0.1;
/* Hacim göstergesinin ölçeği: 0 ile ortalamanın üç katı arası. Üç kat
   "olağandışı yoğun"un üstü; daha uzun bir ölçek 1×'i sol kenara ezerdi. */
const VOLUME_SCALE_MAX = 3;

/**
 * Liste kartı — bir hissenin son analizi tek bakışta.
 *
 * Sıra okuyucunun sorusunun sırası: ne diyor (görüş), değişti mi (rozet),
 * şimdi nerede (fiyat ve plana göre yeri), NEREDEN ALINIR / NEREDE SATILIR /
 * NEREDE VAZGEÇİLİR (plan şeridi), o seviyeler fiyata göre nerede (ray),
 * neden (tek cümle ve ne zaman yazıldığı), göstergeler ne diyor (üç ölçü).
 *
 * FİYAT CANLI, SEVİYELER KAYITTAN. Raydaki nokta şu anki fiyat: okuyucu
 * sabah yazılmış alım bölgesine fiyatın şimdi ne kadar yaklaştığını görsün.
 * Kotasyon gelmezse fotoğraftaki fiyata düşülür ve etiket de ona göre
 * "Analiz Anında" olur: eski bir fiyata "Şu An" demek sayıyı olduğundan
 * taze gösterirdi.
 */
export function TechnicalCard({
  row,
  previousStance,
  quote,
  company,
  logoUrl,
  priceLabel,
  stale = false,
  locale,
  t,
}: {
  row: TechnicalAnalysisRow;
  previousStance: VerdictKey | null;
  quote: Quote | null;
  company: string | null;
  logoUrl: string | null;
  /** Kotasyon varken kullanılacak etiket (seans içi "15 Dakika Gecikmeli" ya da "Son Fiyat"). */
  priceLabel: string;
  /** Kart panonun en yeni yayınından değil (daha eski bir yayından kalan satır). */
  stale?: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const verdict = verdictOf(row.stance);
  const change = stanceChangeLabel(verdict, previousStance, t);
  /* ÇEVİRİ YOKSA SÖYLENİYOR. İngilizce sayfada Türkçe bir cümle rozetsiz
     durursa hata gibi okunuyor; mercek ve analiz listeleri aynı durumda
     orijinalin dil kodunu basıyor. */
  const untranslated = locale === "en" && !row.copy.en;
  const copy = locale === "en" ? (row.copy.en ?? row.copy.tr) : row.copy.tr;
  const { snapshot } = row;
  const price = quote?.price ?? snapshot.price;
  const changePct = quote ? quote.changePct : snapshot.changePct;
  const position = planPosition(price, row.entryLow, row.entryHigh, row.stop);
  const headingId = `technical-${row.symbol}`;
  const levelProps = {
    entryLow: row.entryLow,
    entryHigh: row.entryHigh,
    stop: row.stop,
    targets: row.targets,
    supports: row.supports,
    resistances: row.resistances,
  };
  /* Cümle analiz anında yazıldı, fiyat canlı. Fark anlamlıysa raya bir
     halka ve cümlenin künyesine o anın fiyatı giriyor (bkz. `LevelTrack`). */
  const snapshotPrice =
    quote && snapshot.price !== null && price !== null && snapshot.price > 0 &&
    (Math.abs(price - snapshot.price) / snapshot.price) * 100 >= SNAPSHOT_MOVE_PCT
      ? snapshot.price
      : null;

  /* ÜÇ ÖLÇÜ, ÜÇ KELİME DEĞİL (23 Eylül). Göstergeler "Trend Yukarı · RSI 61
     · Hacim 1,1×" diye üç çipti ve iki çipin önündeki gri nokta hiçbir hâl
     taşımıyordu (süs). RSI ve hacim oranı ancak eşiklerine göre anlamlı
     (30/70, 1×) ve eşikler ekranda yoktu. Her ölçü artık kendi çizgisini
     taşıyor: trendde iki ortalamanın yönü, RSI'da 30 ve 70 çentikli bir kıl
     çizgi üstünde nokta, hacimde 1× çentikli ölçek. Ayrıntı detay
     sayfasında (`SignalStrip`). 320'de çip şeridi iki satıra sarıp 58
     piksel oluyordu; üç sütun her genişlikte tek satır. */
  const signals = indicatorSignals(snapshot, price);
  const trend = signals.trend;
  const trendDetail = trend
    ? trend.above50 === null || trend.above200 === null
      ? null
      : trend.above50 && trend.above200
        ? t.technical.trendAboveBoth
        : !trend.above50 && !trend.above200
          ? t.technical.trendBelowBoth
          : trend.above50
            ? t.technical.trendAbove50Below200
            : t.technical.trendBelow50Above200
    : null;
  const rsi = signals.momentum;
  const rsiZoneText =
    rsi?.tone === "overbought" ? t.technical.rsiOverbought : rsi?.tone === "oversold" ? t.technical.rsiOversold : null;
  /* Aşırı alım düşüş, aşırı satım yükseliş tonunda — çiplerdeki eşleme. */
  const rsiTone = rsi?.tone === "overbought" ? "down" : rsi?.tone === "oversold" ? "up" : undefined;
  const volume = signals.volume;
  const maTag = (above: boolean | null, label: string) =>
    above === null ? null : (
      <i data-dir={above ? "up" : "down"}>
        {above ? <CaretUp size={8} weight="fill" /> : <CaretDown size={8} weight="fill" />}
        {label}
      </i>
    );

  return (
    /* DÜZ KAP, `SpotlightCard` DEĞİL. Ortak spot kartı imleci izleyen bir
       mavi ışıma boyuyordu (520 piksellik radyal degrade, hover'da opaklık
       0,7; koyu temada belirgin, ölçüldü). Sahibinin "büyük kartlardaki
       hover'ı kaldıralım" isteğinin yarısı buydu: kalkma ve gölge gitmişti
       ama ışıma duruyordu. Hover artık yalnızca kenarlık tonu. Spot kartın
       verdiği `isolation` CSS'te `.card` üzerinde; kaplama bağlantısının
       (`.cardLink::after`, z-1) yerel yığını ona bağlı. */
    <div className={styles.card}>
      <div className={styles.cardHead}>
        {/* Kimlik balonu 22 Eylül'de dağılım logolarına taşındı: kart
            kimliği zaten gösteriyor, balon aynı bilgiyi ikinci kez veriyordu
            ve kaplama bağlantısıyla çakışma riski taşıyordu. Bkz.
            `CompanyBalloon`. */}
        <LogoTile symbol={row.symbol} logoUrl={logoUrl} size="md" />
        <div className={styles.cardName}>
          {/* h3: kartlar sayfanın "Hisse Planları" bölüm başlığının altında. */}
          <h3 id={headingId} className={styles.cardSymbol}>
            <Link href={technicalHref(row.symbol)} prefetch={false} className={styles.cardLink}>
              {row.symbol}
            </Link>
          </h3>
          {company && <span className={styles.cardCompany}>{company}</span>}
        </div>
        <span className={styles.badges}>
          <span className={cn(styles.stance, verdictPillClass(verdict))}>
            {verdictLabel(verdict, t)}
          </span>
          {change && (
            <span className={cn(styles.change, changeToneClass(verdict))}>{change}</span>
          )}
        </span>
      </div>

      {/* PLAN ROZETİ FİYATIN SATIRINDA (24 Eylül). Etiket ile rozet üstte
          bir satırı, fiyat altında bir satırı paylaşıyordu: gözün ilk
          durduğu yerde iki ayrı hizada üç öğe ("Son Fiyat" solda, rozet
          sağda, fiyat altta solda). Rozet artık fiyatın sağ ucunda — ikisi
          aynı soruya cevap ("fiyat nerede?"), aynı satırda okunuyor; etiket
          fiyatın küçük künyesi olarak üstte tek başına. Dar kartta fiyat
          ile rozet tek satıra sığmıyor ve rozet etiketin satırına dönüyor
          (CSS, `.cardQuote` kap sorgusu) — yeni bir satır açmıyor. */}
      <div className={styles.cardQuote}>
        <div className={styles.quoteGrid}>
        <span className={styles.cardQuoteLabel}>{quote ? priceLabel : t.technical.atAnalysis}</span>
        <div className={styles.cardPrice}>
          <strong className="numeral">{formatPrice(price, locale, { currency: true })}</strong>
          {changePct !== null && (
            <span className={cn("numeral text-base font-semibold", directionText(directionOf(changePct)))}>
              {formatPercent(changePct, locale)}
            </span>
          )}
        </div>
        {position && (
          <span className={styles.plan} data-kind={position.kind}>
            {planPositionLabel(position, locale, t)}
          </span>
        )}
        </div>
      </div>

      <div className={styles.cardPlan} data-verdict={verdict}>
        <PlanStrip verdict={verdict} {...levelProps} locale={locale} t={t} />
        <PlanRail verdict={verdict} price={price} snapshotPrice={snapshotPrice} {...levelProps} locale={locale} t={t} />
      </div>

      {/* CÜMLENİN ANI CÜMLENİN ÜSTÜNDE (23 Eylül). Gerekçe analiz anını
          anlatıyor ama yanında canlı fiyat duruyor: ONDS "7,61'deki
          ortalamanın hemen altında" derken üstte 7,73 yazıyordu. Cümlenin ne
          zaman yazıldığı yalnızca dört blok aşağıdaki ayak künyesindeydi ve
          saat hiç yoktu. Künye artık cümlenin başında; fiyat o andan beri
          anlamlı ölçüde yol aldıysa o anın fiyatı da yanında (rayın boş
          halkasının metin karşılığı — ray `aria-hidden`). */}
      <div className={styles.cardThesis}>
        <p className={styles.thesisStamp}>
          <span>
            {slotLabel(row.slot, t)} · <span className="numeral">{editionTime(row.sessionDate, row.slot, locale)}</span>
          </span>
          {snapshotPrice !== null && (
            <span>
              {t.technical.atAnalysis}{" "}
              <b className="numeral">{formatPrice(snapshotPrice, locale, { currency: true })}</b>
            </span>
          )}
        </p>
        <p className={styles.cardHeadline} lang={untranslated ? "tr" : locale}>
          {untranslated && (
            /* `relative z-[3]`: kartı kaplayan bağlantı katmanının (z-1)
               üstünde, yoksa fare ipucu hiç açılmıyordu. Aradaki z-2 bir
               dönem `SpotlightCard`ın ışığıydı; kart düz kaba dönünce ışık
               gitti, sıra yine doğru. Not kendi dilinde: paragraf
               `lang="tr"`, not arayüzün dilinde. */
            <span
              title={t.technical.langNote}
              className="relative z-[3] mr-1.5 inline-flex rounded bg-surface-sunken px-1.5 align-[1px] text-nano font-bold text-muted"
            >
              {t.technical.originalBadge}
              <span className="sr-only" lang={locale}>
                {t.technical.langNote}
              </span>
            </span>
          )}
          {copy.headline}
        </p>
      </div>

      {/* ÖLÇÜ ŞERİDİ ÖLÇÜ YOKKEN DE BASILIYOR. Kart bölümleri komşu kartlarla
          aynı satırları paylaşıyor (bkz. CSS `.grid`/`.cell`/`.card`
          alt ızgarası); bir kartta şerit hiç basılmazsa o kartın ayak satırı
          bir satır yukarı kayar ve ızgara yine tırtıklanır. Boş şerit
          yüksekliksiz, yalnızca satırı tutuyor. */}
      <div className={styles.gaugeBox}>
        <ul className={styles.gauges}>
          {trend && (
            <li>
              <span className={styles.gaugeHead}>
                <span className={styles.gaugeName}>{t.technical.signalTrend}</span>
                <span className={styles.gaugeValue} data-tone={trend.tone === "mixed" ? undefined : trend.tone}>
                  {trend.tone === "up" ? t.technical.trendUp : trend.tone === "down" ? t.technical.trendDown : t.technical.trendMixed}
                </span>
                {trendDetail && <span className="sr-only">, {trendDetail}</span>}
              </span>
              <span className={styles.gaugeTags} aria-hidden>
                {maTag(trend.above50, t.technical.ma50Short)}
                {maTag(trend.above200, t.technical.ma200Short)}
              </span>
            </li>
          )}
          {rsi && (
            <li>
              <span className={styles.gaugeHead}>
                <span className={styles.gaugeName}>RSI</span>
                <span className={cn(styles.gaugeValue, "numeral")} data-tone={rsiTone}>
                  {formatPrice(rsi.rsi, locale, { digits: 0 })}
                </span>
                {rsiZoneText && <span className="sr-only">, {rsiZoneText}</span>}
              </span>
              <span className={styles.gaugeMeter} data-kind="rsi" data-tone={rsiTone} aria-hidden>
                <i style={{ left: `${Math.min(100, Math.max(0, rsi.rsi))}%` }} />
              </span>
            </li>
          )}
          {volume && (
            <li>
              <span className={styles.gaugeHead}>
                <span className={styles.gaugeName}>{t.technical.volume}</span>
                <span className={cn(styles.gaugeValue, "numeral")}>{formatPrice(volume.ratio, locale, { digits: 1 })}×</span>
              </span>
              <span className={styles.gaugeMeter} data-kind="volume" data-tone={volume.tone} aria-hidden>
                <i data-motion-draw="line" style={{ width: `${Math.min(volume.ratio / VOLUME_SCALE_MAX, 1) * 100}%` }} />
              </span>
            </li>
          )}
        </ul>
      </div>

      {/* ESKİ YAYIN AYAKTA ADIYLA (23 Eylül). On beş kartın on beşi aynı
          soluk künyeyi taşıyordu ("Kapanış Öncesi · 22 Eyl") ve pano beş
          güne kadar eski satırları da gösteriyor: yayını aksamış bir kart
          bugünkülerin yanında aynı künyeyle duracaktı. Yayın anı cümlenin
          üstüne çıktı; güncel kartın tarihi başlıktaki "Son Yayın"
          künyesinde bir kez yazılı, ayakta tekrar etmiyor — ayakta yalnızca
          "Analizi Oku" kalıyor. Eski yayından gelen kart "Önceki Yayın" ve
          kendi tarihini taşıyan bir etiket alıyor, renkle değil tonla: on
          dört boş ayağın yanında tek dolu ayak kendiliğinden seçiliyor. */}
      <div className={styles.cardFoot} data-stale={stale || undefined}>
        {stale && (
          <span className={styles.staleTag}>
            {t.technical.earlierEdition} · {formatEtDateCompact(row.sessionDate, locale)}
          </span>
        )}
        {/* Bağlantı zaten başlıkta ve kartı kaplıyor; bu yazı yalnızca bir
            işaret, ekran okuyucuya ikinci bir bağlantı gibi okunmasın. */}
        <span className={styles.cardRead} aria-hidden>
          {t.technical.readAnalysis}
          <ArrowUpRight size={13} weight="bold" />
        </span>
      </div>
    </div>
  );
}
