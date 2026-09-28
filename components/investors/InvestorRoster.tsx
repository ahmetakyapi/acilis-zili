import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { Dictionary } from "@/lib/i18n";
import type { Overview } from "@/lib/investor-data";
import { INVESTORS, investorBySlug, investorFirm } from "@/lib/investors";
import { formatMoneyCompact, formatPercentPlain } from "@/lib/utils";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/** Şeridin altında adıyla anılan en büyük pay sayısı; kalanı tek "Diğer". */
const STRIP_NAMED = 5;

/**
 * Dizin kapağının görseli (28 Eylül) — portre mozaiğinin yerine.
 *
 * Mozaik on altı büyük fotoğraftı ve sahibi haklı olarak "fazla fotoğraf
 * odaklı" buldu: kapak bir veri ekranının değil bir galeri sayfasının
 * kapağı gibiydi ve hiçbir şey söylemiyordu. Şimdi iki parça:
 *
 *   1. SERMAYE ŞERİDİ — takip edilen hisse portföylerinin toplamı tek bir
 *      yatay çizgi; her fon kendi payı kadar uzun (doğrusal, uzunluk bir
 *      BÜYÜKLÜK: CLAUDE.md "karşılaştırılan her büyüklük bir de çizgi").
 *      Kapanan fon (Burry) ve Kongre üyesi toplamın dışında, kahramandaki
 *      sayıyla aynı tanım (`trackedValue`). En büyük beşi adıyla, kalanı
 *      tek "Diğer" satırında.
 *   2. KADRO — kişi başına kompakt bir satır: küçük portre, ad, kuruluş ve
 *      portföy değeri. Fotoğraf kişiyi tanıtıyor, ekranı taşımıyor.
 *
 * Şerit girişi `clip-path` ile soldan açılıyor (opaklık yok, LCP
 * beklemiyor); hareketi azaltan okuyucu son kareyi görüyor.
 */
export function InvestorRoster({
  overview,
  locale,
  t,
}: {
  overview: Overview | null;
  locale: string;
  t: Dictionary["investors"];
}) {
  const valueOf = new Map<string, number>();
  for (const card of overview?.cards ?? []) {
    if (card.kind === "13f") valueOf.set(card.slug, card.longValue);
  }
  const segments = INVESTORS.filter((investor) => investor.kind === "13f" && investor.status !== "closed")
    .map((investor) => ({ investor, value: valueOf.get(investor.slug) ?? 0 }))
    .filter((segment) => segment.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const named = segments.slice(0, STRIP_NAMED);
  const rest = segments.slice(STRIP_NAMED);
  const restValue = rest.reduce((sum, segment) => sum + segment.value, 0);
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  return (
    <div className={styles.roster}>
      {total > 0 && (
        <figure className={styles.capital}>
          <figcaption className={styles.capitalTitle}>{t.capitalTitle}</figcaption>
          <div className={styles.capitalBar} role="img" aria-label={t.capitalAria}>
            {segments.map((segment, index) => (
              <i
                key={segment.investor.slug}
                data-rank={Math.min(index, STRIP_NAMED)}
                style={{ flexGrow: segment.value } as CSSProperties}
                title={`${segment.investor.name} · ${formatPercentPlain(share(segment.value), locale, 1)}`}
              />
            ))}
          </div>
          <ol className={styles.capitalLegend}>
            {named.map((segment, index) => (
              <li key={segment.investor.slug} data-rank={index}>
                <Link href={`/yatirimcilar/${segment.investor.slug}`} prefetch={false} className={styles.capitalItem}>
                  <Portrait investor={segment.investor} size="chip" />
                  <span className={styles.capitalName}>{segment.investor.name}</span>
                  <b className="numeral">{formatPercentPlain(share(segment.value), locale, 0)}</b>
                </Link>
              </li>
            ))}
            {rest.length > 0 && (
              <li data-rank={STRIP_NAMED} className={styles.capitalItem}>
                <span className={styles.capitalRestDot} aria-hidden />
                <span className={styles.capitalName}>{t.capitalRest.replace("{count}", String(rest.length))}</span>
                <b className="numeral">{formatPercentPlain(share(restValue), locale, 0)}</b>
              </li>
            )}
          </ol>
        </figure>
      )}

      <ul className={styles.rosterList} aria-label={t.investorsCount.replace("{count}", String(INVESTORS.length))}>
        {INVESTORS.map((listed, index) => {
          const investor = investorBySlug(listed.slug) ?? listed;
          const value = valueOf.get(investor.slug);
          return (
            <li key={investor.slug} style={{ "--i": index } as CSSProperties}>
              <Link href={`/yatirimcilar/${investor.slug}`} prefetch={false} className={styles.rosterItem}>
                <Portrait investor={investor} size="sm" priority={index < 4} />
                <span className={styles.rosterId}>
                  <b lang="en">{investor.name}</b>
                  <small>{investorFirm(investor, locale)}</small>
                </span>
                <span className={styles.rosterValue}>
                  {investor.kind === "congress" ? (
                    <em data-tone="info">{t.congressBadge}</em>
                  ) : investor.status === "closed" ? (
                    <em data-tone="closed">{t.fundClosed}</em>
                  ) : value !== undefined ? (
                    <b className="numeral">{formatMoneyCompact(value, locale)}</b>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
