import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Quote } from "@/lib/providers/types";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import {
  distancePct,
  rsiZone,
  slotLabel,
  stanceChangeLabel,
  technicalHref,
} from "@/lib/technical";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatPercent,
  formatPrice,
} from "@/lib/utils";
import { LevelTrack } from "./LevelTrack";
import styles from "./Technical.module.css";

/** Değişim rozetinin rengi — yeni görüşün rengi. */
export function changeToneClass(verdict: VerdictKey): string {
  return verdict === "buy" ? "text-up" : verdict === "sell" ? "text-down" : "text-primary-ink";
}

/**
 * Liste kartı — bir hissenin son analizi tek bakışta.
 *
 * Sıra okuyucunun sorusunun sırası: ne diyor (görüş), değişti mi (rozet),
 * şimdi nerede (fiyat), neden (tek cümle), nereden alınır nerede satılır
 * (seviye çizgisi), göstergeler ne gösteriyor (çipler).
 *
 * FİYAT CANLI, SEVİYELER KAYITTAN. Çizgideki nokta şu anki fiyat: okuyucu
 * sabah yazılmış alım bölgesine fiyatın şimdi ne kadar yaklaştığını görsün.
 * Kotasyon gelmezse fotoğraftaki fiyata düşülür.
 */
export function TechnicalCard({
  row,
  previousStance,
  quote,
  company,
  logoUrl,
  priceLabel,
  locale,
  t,
}: {
  row: TechnicalAnalysisRow;
  previousStance: VerdictKey | null;
  quote: Quote | null;
  company: string | null;
  logoUrl: string | null;
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

  const chips: string[] = [];
  if (snapshot.rsi14 !== null) {
    const zone = rsiZone(snapshot.rsi14);
    chips.push(
      `RSI ${formatPrice(snapshot.rsi14, locale, { digits: 0 })}${
        zone === "overbought"
          ? ` · ${t.technical.rsiOverbought}`
          : zone === "oversold"
            ? ` · ${t.technical.rsiOversold}`
            : ""
      }`,
    );
  }
  /* Trend çipi en uzun dolu ortalamaya bakıyor: 200 günlük yoksa (SPCX)
     50 günlük. Yarım pencereden ortalama zaten üretilmiyor. */
  const trendWindow = snapshot.sma200 !== null ? 200 : snapshot.sma50 !== null ? 50 : null;
  const trendAvg = trendWindow === 200 ? snapshot.sma200 : snapshot.sma50;
  const trendDistance = distancePct(price, trendAvg);
  if (trendWindow !== null && trendDistance !== null) {
    chips.push(
      (trendDistance >= 0 ? t.technical.aboveMa : t.technical.belowMa).replace(
        "{n}",
        String(trendWindow),
      ),
    );
  }
  if (snapshot.lastVolume !== null && snapshot.avgVolume20) {
    chips.push(
      `${t.technical.volume} ${formatPrice(snapshot.lastVolume / snapshot.avgVolume20, locale, { digits: 1 })}×`,
    );
  }

  return (
    <Link href={technicalHref(row.symbol)} prefetch={false} className={styles.card}>
      <div className={styles.cardHead}>
        <LogoTile symbol={row.symbol} logoUrl={logoUrl} size="md" />
        <span className={styles.cardName}>
          <span className={styles.cardSymbol}>{row.symbol}</span>
          {company && <span className={styles.cardCompany}>{company}</span>}
        </span>
        <span className={styles.badges}>
          <span className={cn(styles.stance, verdictPillClass(verdict))}>
            {verdictLabel(verdict, t)}
          </span>
          {change && (
            <span className={cn(styles.change, changeToneClass(verdict))}>{change}</span>
          )}
        </span>
      </div>

      <div className={styles.cardPrice}>
        <strong className="numeral">{formatPrice(price, locale, { currency: true })}</strong>
        {changePct !== null && (
          <span className={cn("numeral text-small font-semibold", directionText(directionOf(changePct)))}>
            {formatPercent(changePct, locale)}
          </span>
        )}
        <span className={styles.cardPriceLabel}>{priceLabel}</span>
      </div>

      <p className={styles.cardHeadline} lang={untranslated ? "tr" : locale}>
        {untranslated && (
          <span
            title={t.technical.langNote}
            className="mr-1.5 inline-flex rounded bg-surface-sunken px-1.5 align-[1px] text-nano font-bold text-muted"
          >
            {t.technical.originalBadge}
          </span>
        )}
        {copy.headline}
      </p>

      <LevelTrack
        price={price}
        entryLow={row.entryLow}
        entryHigh={row.entryHigh}
        stop={row.stop}
        targets={row.targets}
        supports={row.supports}
        resistances={row.resistances}
        locale={locale}
        t={t}
      />

      {chips.length > 0 && (
        <div className={styles.chips}>
          {chips.map((chip) => (
            <span key={chip} className={styles.chip}>
              {chip}
            </span>
          ))}
        </div>
      )}

      <div className={styles.cardFoot}>
        <span>
          {slotLabel(row.slot, t)} · {formatEtDateCompact(row.sessionDate, locale)}
        </span>
        <span className={styles.cardRead}>{t.technical.readAnalysis} ↗</span>
      </div>
    </Link>
  );
}
