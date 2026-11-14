import type { CSSProperties } from "react";
import { KarneStrip, type KarneStripMark } from "@/components/earnings/KarneStrip";
import { MetricStrip } from "@/components/earnings/MetricStrip";
import { epsSurprise, formatEpsSurprise, type PastQuarter } from "@/components/stock/past-quarters";
import type { Locale } from "@/lib/i18n";
import { cn, formatEtDateCompact, formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";
import css from "./QuarterLedger.module.css";

/**
 * BEKLENTİ KARNESİ DEFTERİ — `/bilancolar/[symbol]` (14 Kasım 2026, görsel
 * tur).
 *
 * NEDEN: bir bilanço sayfasından beklenen asıl görsel bu sayfada yoktu.
 * Geçmiş çeyrekler "Beklentiyi Geçer mi?" panelinin sağında dört küçük
 * hücreydi (`BeatRecordCard`, 31 Ekim: dönem, "Geçti", iki sayı); sayılar
 * yazılıydı ama büyüklük olarak okunmuyor, raporun ertesindeki fiyat
 * tepkisi ise yalnız hisse sayfasındaydı. Karne artık kendi panelinde,
 * çeyrek başına bir SATIR:
 *
 *   çeyrek · kalın yatay şerit (gerçekleşen EPS) + çentik (beklenti) ·
 *   iki sayı · sapma · raporun ertesindeki tepki (sıfır ortada şerit).
 *
 * Şerit dili sitenin ortak değer çubuğu (`value-lane` / `value-bar` /
 * `value-notch`, globals.css → "DEĞER ÇUBUĞU"): kulvar 5, dolgu 8, kıyas
 * çentiği çubuğun üstünde. Hisse sayfasının EPS izi aynı sayıları dikey
 * sütunla veriyor (`components/stock/EpsTrack.tsx`); burada yatay satır
 * seçildi çünkü satır aynı hatta ÜÇÜNCÜ bir okumayı (tepki) taşıyabiliyor
 * ve telefonda kaydırmadan sığıyor ("büyüklük kalın yatay şeritle okunur",
 * `.claude/rules/arayuz.md`).
 *
 * VERİ (hiçbiri yeni çağrı değil; hisse sayfasının yükleyicileri):
 *   · satırlar `buildPastQuarters` (hisse sayfasının tablosu ve iziyle AYNI
 *     dizi: sürpriz ucu + takvim + analiz); sapma `epsSurprise` /
 *     `formatEpsSurprise` (yüzde, tabanı anlamsızsa dolar farkı).
 *   · tepki `historicalMoves` (Beklenen Hareket panelinin geçmişi), rapor
 *     gününe göre eşlenir. Ölçülemeyen raporda hücre BOŞ kalır; hiçbir
 *     satırda tepki yoksa sütun hiç açılmaz ("–" duvarı yok).
 *   · solda özet: kaç çeyrekte aşıldı (panelin en büyük sayısı) ve ortalama
 *     sapma; rapor yakınsa opsiyonların fiyatladığı hareket ile geçmiş
 *     raporların ortalaması aynı ölçekte iki şerit (`getExpectedMove`).
 *
 * Renk yalnız yönden: şerit ve sapma, beklentinin aşılıp aşılmadığına göre
 * `--up` / `--down`; denk çeyrek nötr. Renk tek taşıyıcı değil: sapma ve
 * tepki işaretiyle yazılır (+/−). Çizimler `data-draw` ile ekrana girince bir kez dolar (`bar-fill`);
 * sunucu son kareyi basar.
 */

/** Defterde en çok bu kadar çeyrek (iki yıl; hisse sayfasının tablosu kadar). */
const MAX_QUARTERS = 8;
/** Tepki şeridinin en küçük ölçeği (yüzde): %1'lik hareket tam şerit olmasın. */
const MIN_REACTION_SCALE = 4;

type Labels = {
  beats: string;
  avgSurprise: string;
  colQuarter: string;
  colEps: string;
  colSurprise: string;
  colReaction: string;
  estimate: string;
  actual: string;
  reactionShort: string;
  note: string;
  aria: string;
  moveTitle: string;
  moveImplied: string;
  moveAverage: string;
  moveCount: string;
  moveIndicative: string;
};

export type LedgerMove = {
  /** Opsiyonların fiyatladığı hareket (yüzde); yoksa null. */
  implied: number | null;
  /** Geçmiş raporların ortalama mutlak hareketi ve kaç rapordan. */
  average: { avg: number; count: number } | null;
};

export function QuarterLedger({
  quarters,
  reactions,
  move,
  currency,
  locale,
  labels,
}: {
  /** En yeni çeyrek başta (`buildPastQuarters` sırası). */
  quarters: readonly PastQuarter[];
  /** Rapor günü (ET) → ertesi seansın yüzde değişimi. */
  reactions: ReadonlyMap<string, number>;
  move: LedgerMove | null;
  currency: string | true;
  locale: Locale;
  labels: Labels;
}) {
  const rows = quarters
    .filter((row) => row.epsActual !== null && row.epsEstimate !== null)
    .slice(0, MAX_QUARTERS)
    .map((row) => {
      const surprise = epsSurprise(row.epsEstimate, row.epsActual);
      return {
        row,
        actual: row.epsActual!,
        estimate: row.epsEstimate!,
        surprise,
        reaction: row.reportDate ? (reactions.get(row.reportDate) ?? null) : null,
      };
    });
  if (rows.length === 0) return null;

  /* Ölçek sıfırı HER ZAMAN içerir (uzunluk değerin kendisi); zarar eden
     çeyrek sıfırın soluna uzanır. Üstte %6 pay: en uzun şerit kulvarın
     ucuna yapışmasın, çentik kenarda kesilmesin. */
  const values = rows.flatMap((item) => [item.actual, item.estimate]);
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = (hi - lo || 1) * 1.06;
  const origin = lo < 0 ? lo * 1.06 : 0;
  const x = (value: number) => ((value - origin) / span) * 100;
  const zero = x(0);

  const marks: KarneStripMark[] = [...rows]
    .reverse()
    .map((item) => (item.surprise?.direction === "up" ? "beat" : item.surprise?.direction === "down" ? "miss" : "inline"));
  const beats = marks.filter((mark) => mark === "beat").length;
  const pct = rows.map((item) => item.surprise).filter((item): item is NonNullable<typeof item> => item?.kind === "pct");
  /* Ortalama yalnız yüzde sapmalardan ve hepsi yüzdeyse (EpsTrack'in kuralı:
     dolar farkı karışırsa iki birim toplanırdı). */
  const avg = pct.length === rows.length ? pct.reduce((sum, item) => sum + item.value, 0) / pct.length : null;

  const hasReaction = rows.some((item) => item.reaction !== null);
  const reactionScale = Math.max(MIN_REACTION_SCALE, ...rows.map((item) => Math.abs(item.reaction ?? 0)));

  const moveScale = move ? Math.max(move.implied ?? 0, move.average?.avg ?? 0) : 0;
  const showMove = move !== null && moveScale > 0;

  return (
    <div className={css.ledger} data-reaction={hasReaction || undefined}>
      <aside className={css.summary}>
        <div className={css.score}>
          <p className={cn("figure", css.scoreValue)}>
            {beats}
            <span>/{rows.length}</span>
          </p>
          <p className={css.scoreLabel}>{labels.beats}</p>
          <KarneStrip marks={marks} size="lg" className={css.scoreStrip} />
        </div>
        {avg !== null && (
          <dl className={css.fact}>
            <dt>{labels.avgSurprise}</dt>
            <dd className="figure" data-tone={avg > 0 ? "up" : avg < 0 ? "down" : undefined}>
              {formatPercent(avg, locale, 1)}
            </dd>
          </dl>
        )}
        {showMove && move && (
          <div className={css.move}>
            <p className={css.moveTitle}>{labels.moveTitle}</p>
            {move.implied !== null && (
              <MoveRow
                label={labels.moveImplied}
                value={`±${formatPercentPlain(move.implied, locale, 1)}`}
                ratio={move.implied / moveScale}
                meta={labels.moveIndicative}
                strong
              />
            )}
            {move.average && (
              <MoveRow
                label={labels.moveAverage}
                value={formatPercentPlain(move.average.avg, locale, 1)}
                ratio={move.average.avg / moveScale}
                meta={labels.moveCount.replace("{n}", String(move.average.count))}
              />
            )}
          </div>
        )}
      </aside>

      <div className={css.main}>
        <div className={css.head} aria-hidden>
          <span>{labels.colQuarter}</span>
          <span>{labels.colEps}</span>
          <span />
          <span>{labels.colSurprise}</span>
          {hasReaction && <span>{labels.colReaction}</span>}
        </div>
        <ol
          className={css.rows}
          aria-label={labels.aria.replace("{n}", String(rows.length)).replace("{beats}", String(beats))}
        >
          {rows.map(({ row, actual, estimate, surprise, reaction }, index) => {
            const tone = surprise?.direction === "up" ? "up" : surprise?.direction === "down" ? "down" : "flat";
            const from = Math.min(zero, x(actual));
            const width = Math.max(Math.abs(x(actual) - zero), 0.8);
            return (
              <li key={row.key} className={css.row} style={{ "--i": index } as CSSProperties}>
                <div className={css.period}>
                  <span className={cn("figure", css.periodName)}>{row.label ?? row.key}</span>
                  {row.reportDate && (
                    <span className={cn("figure", css.periodDate)}>{formatEtDateCompact(row.reportDate, locale)}</span>
                  )}
                </div>
                <span aria-hidden data-draw className={cn("value-lane", css.lane)}>
                  <i
                    className="value-bar bar-fill"
                    data-tone={tone}
                    data-end={actual < 0 ? "start" : "end"}
                    style={{ left: `${from}%`, width: `${width}%` }}
                  />
                  {lo < 0 && <i className="value-notch" data-quiet style={{ left: `${zero}%` }} />}
                  <i className="value-notch" style={{ left: `${x(estimate)}%` }} />
                </span>
                <div className={css.values}>
                  <span className={cn("figure", css.actual)}>
                    <span className="sr-only">{labels.actual} </span>
                    {formatPrice(actual, locale, { currency })}
                  </span>
                  <span className={css.estimate}>
                    {labels.estimate} <span className="figure">{formatPrice(estimate, locale, { currency })}</span>
                  </span>
                </div>
                <span className={cn("figure", css.surprise)} data-tone={tone}>
                  {surprise ? formatEpsSurprise(surprise, locale, currency) : null}
                </span>
                {hasReaction && (
                  <div className={css.reaction}>
                    {reaction !== null && (
                      <>
                        <span className={css.reactionLabel}>{labels.reactionShort}</span>
                        <MetricStrip value={reaction} scale={reactionScale} className={css.reactionStrip} />
                        <span className={cn("figure", css.reactionValue)} data-tone={reaction > 0 ? "up" : reaction < 0 ? "down" : "flat"}>
                          {formatPercent(reaction, locale, 1)}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <p className={css.note}>{labels.note}</p>
      </div>
    </div>
  );
}

function MoveRow({
  label,
  value,
  ratio,
  meta,
  strong = false,
}: {
  label: string;
  value: string;
  ratio: number;
  meta: string;
  strong?: boolean;
}) {
  return (
    <div className={css.moveRow} data-strong={strong || undefined}>
      <p className={css.moveLabel}>
        <span>{label}</span>
        <b className="figure">{value}</b>
      </p>
      <span aria-hidden data-draw className="value-lane">
        <i className="value-bar bar-fill" style={{ left: 0, width: `${Math.max(2, Math.min(1, ratio) * 100)}%`, opacity: strong ? 1 : 0.6 }} />
      </span>
      <p className={css.moveMeta}>{meta}</p>
    </div>
  );
}
