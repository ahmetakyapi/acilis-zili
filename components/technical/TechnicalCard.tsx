import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { SpotlightCard } from "@/components/motion/PremiumMotion";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Quote } from "@/lib/providers/types";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import {
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
  formatMoneyCompact,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";
import { LevelTrack } from "./LevelTrack";
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

/**
 * Liste kartı — bir hissenin son analizi tek bakışta.
 *
 * Sıra okuyucunun sorusunun sırası: ne diyor (görüş), değişti mi (rozet),
 * şimdi nerede (fiyat ve plana göre yeri), NEREDEN ALINIR / NEREDE SATILIR /
 * NEREDE VAZGEÇİLİR (plan şeridi), o seviyeler fiyata göre nerede (çizgi),
 * neden (tek cümle), göstergeler ne diyor (üç kelime).
 *
 * FİYAT CANLI, SEVİYELER KAYITTAN. Çizgideki nokta şu anki fiyat: okuyucu
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
  marketCap,
  currency,
  sector,
  priceLabel,
  locale,
  t,
}: {
  row: TechnicalAnalysisRow;
  previousStance: VerdictKey | null;
  quote: Quote | null;
  company: string | null;
  logoUrl: string | null;
  /** Kimlik balonu için — `getSymbolNames` bunları zaten döndürüyor. */
  marketCap: number | null;
  currency: string | null;
  sector: string | null;
  /** Kotasyon varken kullanılacak etiket ("Şu An" ya da "Son Fiyat"). */
  priceLabel: string;
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

  /* Üç kelime: trend, RSI, hacim. Ayrıntı detay sayfasında (`SignalStrip`). */
  const signals = indicatorSignals(snapshot, price);
  const chips: { text: string; tone?: "up" | "down" }[] = [];
  if (signals.trend) {
    chips.push({
      text: `${t.technical.signalTrend} ${
        signals.trend.tone === "up" ? t.technical.trendUp : signals.trend.tone === "down" ? t.technical.trendDown : t.technical.trendMixed
      }`,
      tone: signals.trend.tone === "up" ? "up" : signals.trend.tone === "down" ? "down" : undefined,
    });
  }
  if (signals.momentum) {
    const zone =
      signals.momentum.tone === "overbought"
        ? ` · ${t.technical.rsiOverbought}`
        : signals.momentum.tone === "oversold"
          ? ` · ${t.technical.rsiOversold}`
          : "";
    chips.push({
      text: `RSI ${formatPrice(signals.momentum.rsi, locale, { digits: 0 })}${zone}`,
      tone: signals.momentum.tone === "overbought" ? "down" : signals.momentum.tone === "oversold" ? "up" : undefined,
    });
  }
  if (signals.volume) {
    chips.push({ text: `${t.technical.volume} ${formatPrice(signals.volume.ratio, locale, { digits: 1 })}×` });
  }

  return (
    <SpotlightCard className={styles.card}>
      <div className={styles.cardHead}>
        {/* KİMLİK BALONU. Kartta şirketin yalnızca sembolü ve kısaltılmış adı
            var; sektörü ve büyüklüğü öğrenmek için detaya gitmek gerekiyordu.
            Balon hepsini aynı yerde veriyor ve VERİSİ ZATEN ELDE: sayfa
            `getSymbolNames` çağırıyor, o sorgu piyasa değerini ve sektörü de
            döndürüyor — yeni bir tur yok.

            İmleç YA DA klavye açıyor (`:focus-within`, sembol bağlantısı
            odaklanınca). Dokunmatikte hover yok; orada kartın kendisi zaten
            detaya götürüyor ve aynı bilgiler orada tam hâliyle duruyor, yani
            balon bir zenginleştirme, tek yol değil. */}
        <div className={styles.identity}>
          <LogoTile symbol={row.symbol} logoUrl={logoUrl} size="md" />
          <div className={styles.cardName}>
            {/* h3: kartlar sayfanın "15 Hisse" bölümünün (sr-only h2) altında. */}
            <h3 id={headingId} className={styles.cardSymbol}>
              <Link href={technicalHref(row.symbol)} prefetch={false} className={styles.cardLink}>
                {row.symbol}
              </Link>
            </h3>
            {company && <span className={styles.cardCompany}>{company}</span>}
          </div>
          <div className={styles.identityCard} aria-hidden>
            <div className={styles.identityTop}>
              <LogoTile symbol={row.symbol} logoUrl={logoUrl} size="md" />
              <div>
                <strong className="numeral">{row.symbol}</strong>
                {company && <span>{company}</span>}
              </div>
              <span className={cn(styles.stance, verdictPillClass(verdict))}>
                {verdictLabel(verdict, t)}
              </span>
            </div>
            <dl className={styles.identityFacts}>
              {sector && (
                <div>
                  <dt>{t.companies.sector}</dt>
                  <dd>{sector}</dd>
                </div>
              )}
              <div>
                <dt>{t.market.marketCap}</dt>
                <dd className="numeral">{formatMoneyCompact(marketCap, locale, currency)}</dd>
              </div>
              <div>
                <dt>{quote ? priceLabel : t.technical.atAnalysis}</dt>
                <dd className="numeral">
                  {formatPrice(price, locale, { currency: true })}
                  {changePct !== null && (
                    <span className={cn(directionText(directionOf(changePct)))}>
                      {formatPercent(changePct, locale)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
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

      <div className={styles.cardQuote}>
        <div className={styles.cardQuoteLabel}>
          <span>{quote ? priceLabel : t.technical.atAnalysis}</span>
          {position && (
            <span className={styles.plan} data-kind={position.kind}>
              {planPositionLabel(position, locale, t)}
            </span>
          )}
        </div>
        <div className={styles.cardPrice}>
          <strong className="numeral">{formatPrice(price, locale, { currency: true })}</strong>
          {changePct !== null && (
            <span className={cn("numeral text-base font-semibold", directionText(directionOf(changePct)))}>
              {formatPercent(changePct, locale)}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cardPlan} data-verdict={verdict}>
        <PlanStrip verdict={verdict} {...levelProps} locale={locale} t={t} />
        <LevelTrack price={price} {...levelProps} verdict={verdict} />
      </div>

      <p className={styles.cardHeadline} lang={untranslated ? "tr" : locale}>
        {untranslated && (
          /* `relative z-[3]`: kartı kaplayan bağlantı katmanının (z-1) ve
             ışığın (z-2) üstünde, yoksa fare ipucu hiç açılmıyordu. Not kendi
             dilinde: paragraf `lang="tr"`, not arayüzün dilinde. */
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

      {/* ÇİP ŞERİDİ ÇİP YOKKEN DE BASILIYOR. Kart bölümleri komşu kartlarla
          aynı satırları paylaşıyor (bkz. CSS `.grid`/`.cell`/`.card`
          alt ızgarası); bir kartta şerit hiç basılmazsa o kartın ayak satırı
          bir satır yukarı kayar ve ızgara yine tırtıklanır. Boş şerit
          yüksekliksiz, yalnızca satırı tutuyor. */}
      <div className={styles.chips}>
        {chips.map((chip) => (
          <span key={chip.text} className={styles.chip} data-tone={chip.tone}>
            {chip.text}
          </span>
        ))}
      </div>

      <div className={styles.cardFoot}>
        <span>
          {slotLabel(row.slot, t)} · {formatEtDateCompact(row.sessionDate, locale)}
        </span>
        {/* Bağlantı zaten başlıkta ve kartı kaplıyor; bu yazı yalnızca bir
            işaret, ekran okuyucuya ikinci bir bağlantı gibi okunmasın. */}
        <span className={styles.cardRead} aria-hidden>
          {t.technical.readAnalysis}
          <ArrowUpRight size={13} weight="bold" />
        </span>
      </div>
    </SpotlightCard>
  );
}
