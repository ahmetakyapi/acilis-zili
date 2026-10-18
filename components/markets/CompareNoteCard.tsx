"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { useCompareOptional } from "@/components/markets/CompareLive";
import { ScaleBar } from "@/components/markets/CompareScale";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { seriesColorOf } from "@/lib/chart-series";
import { scaleRatios, type CompareRange } from "@/lib/compare";
import type { CompareNote } from "@/lib/compare-note";
import type { SeriesStats } from "@/lib/compare-note-core";
import type { Dictionary } from "@/lib/i18n";
import { cn, formatPercent, formatPercentPlain, NO_VALUE } from "@/lib/utils";
import insight from "@/components/stock/StockInsightCard.module.css";
import styles from "./CompareNoteCard.module.css";

/**
 * Karşılaştırma ekranının Claude notu (18 Ekim). Gerekçe ve kurallar
 * lib/compare-note.ts; kart kalıbı hisse notunun
 * (components/stock/StockInsightCard.tsx).
 *
 * NE ZAMAN İSTENİR: panel görünüme yaklaşınca (sayfayı açıp aşağı inmeyen
 * okur Claude çağrısı tetiklemez) ve sonra her seçim/aralık değişiminde —
 * ama 800 ms sessizlikten sonra: aralık rayında düğmeden düğmeye gezen
 * okur her basışta bir istek atmasın. Uçuştaki istek yeni seçimde kesilir
 * (AbortController). Gelen not süreç boyunca anahtarıyla hatırlanır: eski
 * aralığa dönen okur ağa çıkmaz. Sunucuda da aynı anahtar 36 saat önbellekte.
 *
 * Aralık değişince ESKİ NOT GÖSTERİLMEZ, iskelet gelir: önceki not başka
 * bir dönemi anlatıyor ve yeni aralığın altında durursa yanlış okunur.
 *
 * Düzen sitenin sırası: başlık → künye şeridi (aralık, pencere, dayanak) →
 * ölçü ızgarası (getiri, en derin düşüş, oynaklık; kodda hesaplanmış) →
 * metin → künye panelin İÇİNDE, hairline'la.
 */

type Labels = Dictionary["compare"]["note"];
type Entry = { status: "loading" | "failed" } | { status: "done"; note: CompareNote };

/** Sekme ömrü boyunca gelen notlar — sağlayıcı sembol değişiminde yeniden
 *  kurulduğu için (CompareProvider `key`) durum modül düzeyinde. */
const memo = new Map<string, CompareNote>();
const DEBOUNCE_MS = 800;

const dateRange = (from: string, to: string, locale: "tr" | "en") =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).formatRange(
    new Date(`${from}T12:00:00Z`),
    new Date(`${to}T12:00:00Z`),
  );
const shortDate = (date: string, locale: "tr" | "en") =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

function MeasureGrid({ note, order, labels, locale }: { note: CompareNote; order: string[]; labels: Labels; locale: "tr" | "en" }) {
  /* Satırlar EKRANIN sırasında (renkler sembolün listedeki yerinden), S&P
     500 en altta, renksiz. Çubuklar satırların ORTAK ölçeğinde: getiri
     işaretli ve yön renginde; düşüş ve oynaklık büyüklük, nötr. */
  const rows: (SeriesStats & { market?: boolean })[] = [
    ...order.flatMap((symbol) => note.stats.filter((s) => s.symbol === symbol)),
    ...(note.market && !order.includes(note.market.symbol) ? [{ ...note.market, market: true }] : []),
  ];
  const ret = scaleRatios(rows.map((r) => r.returnPct));
  const dd = scaleRatios(rows.map((r) => Math.abs(r.drawdownPct)));
  const vol = scaleRatios(rows.map((r) => r.volatilityPct));

  return (
    <ScrollEdges className={cn("scroll-x-hint", styles.scroller)} tabIndex={0} role="region" aria-label={labels.gridLabel}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th scope="col">{labels.columns.symbol}</th>
            <th scope="col">{labels.columns.return}</th>
            <th scope="col">{labels.columns.drawdown}</th>
            <th scope="col">{labels.columns.volatility}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const retRatio = ret.ratios[i] ?? null;
            const ddRatio = dd.ratios[i] ?? null;
            const volRatio = vol.ratios[i] ?? null;
            return (
            <tr key={row.symbol} data-market={row.market || undefined} style={{ "--i": i } as CSSProperties}>
              <th scope="row">
                <span className={styles.symbol}>
                  {!row.market && <i className={styles.swatch} style={{ background: seriesColorOf(order, row.symbol) }} aria-hidden />}
                  {row.market ? labels.market : row.symbol}
                </span>
                {row.from !== note.from && <span className={styles.since}>{labels.since.replace("{date}", shortDate(row.from, locale))}</span>}
              </th>
              <td>
                <span className={cn("numeral", styles.value)} data-tone={row.returnPct > 0 ? "up" : row.returnPct < 0 ? "down" : undefined}>
                  {formatPercent(row.returnPct, locale, 2)}
                </span>
                {retRatio !== null && <ScaleBar ratio={retRatio} signed={ret.signed} tone="signal" />}
              </td>
              <td>
                <span className={cn("numeral", styles.value)}>{formatPercent(row.drawdownPct, locale, 1)}</span>
                {ddRatio !== null && <ScaleBar ratio={ddRatio} signed={false} />}
              </td>
              <td>
                <span className={cn("numeral", styles.value)}>
                  {row.volatilityPct === null ? NO_VALUE : formatPercentPlain(row.volatilityPct, locale, 1)}
                </span>
                {volRatio !== null && <ScaleBar ratio={volRatio} signed={false} />}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollEdges>
  );
}

export function CompareNoteCard({ labels, rangeLongs }: { labels: Labels; rangeLongs: Record<CompareRange, string> }) {
  const compare = useCompareOptional();
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [attempt, setAttempt] = useState(0);

  const symbols = compare?.symbols ?? [];
  const range = compare?.range;
  const locale = compare?.locale === "en" ? "en" : "tr";
  const joined = [...symbols].sort().join(",");
  const key = range ? `${joined}:${range}` : "";
  const enough = symbols.length >= 2;

  useEffect(() => {
    const el = ref.current;
    if (!el || seen || !enough) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      (list) => {
        if (list.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setSeen(true);
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen, enough]);

  useEffect(() => {
    if (!seen || !enough || !range) return;
    if (memo.has(key)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setEntries((prev) => ({ ...prev, [key]: { status: "loading" } }));
      fetch(`/api/ai/karsilastirma-notu?semboller=${joined}&aralik=${range}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<{ ok: boolean; note?: CompareNote }>)
        .then((data) => {
          if (data.ok && data.note) memo.set(key, data.note);
          setEntries((prev) => ({ ...prev, [key]: data.ok && data.note ? { status: "done", note: data.note } : { status: "failed" } }));
        })
        .catch((error: unknown) => {
          /* Kesilen istek başarısızlık değil: seçim değişti, girdi silinir ki
             okur bu seçime dönünce not yeniden istensin. */
          if (error instanceof DOMException && error.name === "AbortError") {
            setEntries((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            return;
          }
          setEntries((prev) => ({ ...prev, [key]: { status: "failed" } }));
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [seen, enough, key, joined, range, attempt]);

  if (!compare || !enough || !range) return null;

  const remembered = memo.get(key);
  const entry: Entry | undefined = remembered ? { status: "done", note: remembered } : entries[key];
  const note = entry?.status === "done" ? entry.note : null;
  const text = note?.text[locale];

  return (
    <Panel ref={ref} className={insight.card} aria-busy={!entry || entry.status === "loading"}>
      <PanelHeader title={labels.title} action={<Sparkle className={insight.icon} size={18} weight="duotone" aria-hidden />} />

      {note && (
        <div className={insight.strip}>
          <span className={insight.stripLabel}>
            {labels.window.replace("{range}", rangeLongs[note.range]).replace("{dates}", dateRange(note.from, note.to, locale))}
          </span>
          <span className={insight.stripMuted}>{note.weekly ? labels.basisWeekly : labels.basis}</span>
        </div>
      )}

      {note && text ? (
        <>
          <MeasureGrid note={note} order={symbols} labels={labels} locale={locale} />
          <div className={insight.body}>
            <p className={insight.summary}>{text.summary}</p>
            {text.points.length > 0 && (
              <ol className={insight.points}>
                {text.points.map((point, index) => (
                  <li key={index} className={insight.point} style={{ "--i": index + 1 } as CSSProperties}>
                    <span className={insight.pointIndex} aria-hidden>
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={insight.pointTitle}>{point.title}</p>
                      <p className={insight.pointDetail}>{point.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className={insight.disclosure}>{labels.disclosure}</p>
          </div>
        </>
      ) : entry?.status === "failed" ? (
        <div className={styles.failed}>
          <p className={insight.failed}>{labels.unavailable}</p>
          {/* Yeniden deneme AÇIK EYLEM: sunucu başarısızlığı 20 dakika
              hatırlıyor (`remembered`), düğme Claude'u boşuna çağırmaz. */}
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              setEntries((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
              setAttempt((n) => n + 1);
            }}
          >
            {labels.retry}
          </button>
        </div>
      ) : (
        <div className={styles.loading}>
          <p className={insight.loadingText}>
            <Sparkle className={insight.loadingIcon} size={15} weight="fill" aria-hidden />
            {labels.loading}
          </p>
          <Skeleton className={cn(insight.line, "w-[92%]")} />
          <Skeleton className={cn(insight.line, "w-[78%]")} />
          <Skeleton className={cn(insight.line, "w-[85%]")} />
          <Skeleton className={cn(insight.line, "w-[60%]")} />
        </div>
      )}
    </Panel>
  );
}
