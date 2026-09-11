import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { SpotlightCard } from "@/components/motion/PremiumMotion";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Quote } from "@/lib/providers/types";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import {
  distancePct,
  planPosition,
  rsiZone,
  slotLabel,
  stanceChangeLabel,
  technicalHref,
  type PlanPosition,
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
import { LevelTrack } from "./LevelTrack";
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
 * Liste kartı — bir hissenin son analizi tek bakışta.
 *
 * Sıra okuyucunun sorusunun sırası: ne diyor (görüş), değişti mi (rozet),
 * şimdi nerede (fiyat ve plana göre yeri), neden (tek cümle), nereden alınır
 * nerede satılır (seviye çizgisi), göstergeler ne gösteriyor (çipler).
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
  priceLabel,
  locale,
  t,
}: {
  row: TechnicalAnalysisRow;
  previousStance: VerdictKey | null;
  quote: Quote | null;
  company: string | null;
  logoUrl: string | null;
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
    <SpotlightCard className={styles.card}>
      <div className={styles.cardHead}>
        <LogoTile symbol={row.symbol} logoUrl={logoUrl} size="md" />
        <div className={styles.cardName}>
          <h2 id={headingId} className={styles.cardSymbol}>
            <Link href={technicalHref(row.symbol)} prefetch={false} className={styles.cardLink}>
              {row.symbol}
            </Link>
          </h2>
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

      <div className={styles.cardPrice}>
        <strong className="numeral">{formatPrice(price, locale, { currency: true })}</strong>
        {changePct !== null && (
          <span className={cn("numeral text-small font-semibold", directionText(directionOf(changePct)))}>
            {formatPercent(changePct, locale)}
          </span>
        )}
        <span className={styles.cardPriceLabel}>{quote ? priceLabel : t.technical.atAnalysis}</span>
      </div>

      {position && (
        <span className={styles.plan} data-kind={position.kind}>
          {planPositionLabel(position, locale, t)}
        </span>
      )}

      <p className={styles.cardHeadline} lang={untranslated ? "tr" : locale}>
        {untranslated && (
          <span
            title={t.technical.langNote}
            className="mr-1.5 inline-flex rounded bg-surface-sunken px-1.5 align-[1px] text-nano font-bold text-muted"
          >
            {t.technical.originalBadge}
            <span className="sr-only">{t.technical.langNote}</span>
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
        verdict={verdict}
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
        {/* Bağlantı zaten başlıkta ve kartı kaplıyor; bu yazı yalnızca bir
            işaret, ekran okuyucuya ikinci bir bağlantı gibi okunmasın. */}
        <span className={styles.cardRead} aria-hidden>
          {t.technical.readAnalysis}
          <ArrowUpRight size={12} weight="bold" />
        </span>
      </div>
    </SpotlightCard>
  );
}
