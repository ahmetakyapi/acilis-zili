"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import base from "@/components/stock/StockInsightCard.module.css";
import type { WatchlistTodayLabels } from "@/lib/i18n/dictionaries/page-claude";
import type { Locale } from "@/lib/i18n/config";
import { cn, directionOf, formatPercentText } from "@/lib/utils";
import type { WatchlistToday as Today } from "@/lib/watchlist-today";
import { formatPoints } from "@/lib/watchlist-today-core";
import styles from "./WatchlistToday.module.css";

/**
 * Takip Listem Bugün (24 Ekim) — gerekçe lib/watchlist-today.ts. Portföy
 * notunun kalıbı (components/portfolio/PortfolioNote.tsx): görünüme
 * yaklaşınca istenir, sayfanın sunucu çizimi beklemez.
 *
 * İKİ BİÇİM. `compact` ana sayfadaki takip listesi panelinin İÇİNDE, liste
 * ile veri damgası arasında tek paragraf: liste zaten canlı fiyatları
 * gösteriyor, not onun "son seansta ne oldu" okuması (ekran düzeni: ölçüden
 * sonra metin). Not yazılamazsa blok kalkar — panel listeyle eksiksiz
 * kalır; kalkış ve not gelişi yumuşak (`CompactNote`). `full` /favoriler'de kendi paneli: hareket şeridi ve bilanço
 * takvimi koddan (not düşse de durur), not ve maddeler Claude'dan.
 */
export function WatchlistToday({ locale, labels, variant }: { locale: Locale; labels: WatchlistTodayLabels; variant: "compact" | "full" }) {
  const ref = useRef<HTMLElement & HTMLDivElement>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; today?: Today }>({ status: "idle" });
  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/takip-notu?dil=${locale}`)
        .then((response) => response.json() as Promise<{ ok: boolean; today?: Today }>)
        .then((data) => setState(data.ok && data.today ? { status: "done", today: data.today } : { status: "failed" }))
        .catch(() => setState({ status: "failed" }));
    };
    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [locale, state.status]);

  const today = state.today;
  const pending = state.status === "idle" || state.status === "loading";
  const date = today
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today.session}T12:00:00Z`))
    : null;

  if (variant === "compact") return <CompactNote shellRef={ref} pending={pending} gone={!pending && !today?.note} today={today} date={date} labels={labels} />;

  const pct = (value: number) => formatPercentText(value, locale, 2);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
  return (
    <Panel ref={ref} className={base.card} aria-busy={pending}>
      <PanelHeader
        title={labels.title}
        meta={date ? labels.session.replace("{date}", date) : undefined}
        action={<Sparkle className={base.icon} size={18} weight="duotone" aria-hidden />}
      />
      {today ? (
        <div className={base.body}>
          {today.movers.length > 0 && (
            <div className={styles.movers}>
              <div className={styles.moversHead}>
                <p className={styles.label}>{labels.movers}</p>
                {today.market !== null && (
                  <span className={styles.market} data-tone={directionOf(today.market)}>
                    {labels.market.replace("{pct}", pct(today.market))}
                  </span>
                )}
              </div>
              <ul className={styles.moverList}>
                {today.movers.map((mover, index) => (
                  <li key={mover.symbol} className={styles.mover} style={{ "--i": index } as CSSProperties}>
                    <Link href={`/hisse/${mover.symbol}`} className={styles.moverLink}>
                      <span className={styles.symbol}>{mover.symbol}</span>
                      <span className={styles.change} data-tone={directionOf(mover.dayPct)}>
                        {pct(mover.dayPct)}
                      </span>
                      {mover.gap !== null && (
                        <span className={styles.versus}>
                          {labels.versus.replace("{gap}", formatPoints(mover.gap, locale, labels.pointsUnit))}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {today.note ? (
            <>
              <p className={base.summary}>{today.note.summary}</p>
              {today.note.points.length > 0 && (
                <ol className={base.points}>
                  {today.note.points.map((point, index) => (
                    <li key={index} className={base.point} style={{ "--i": index + 1 } as CSSProperties}>
                      <span className={base.pointIndex} aria-hidden>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className={base.pointTitle}>{point.title}</p>
                        <p className={base.pointDetail}>{point.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <p className={base.failed}>{labels.noteFailed}</p>
          )}
          {today.earnings.length > 0 && (
            <div className={styles.earnings}>
              <p className={styles.label}>{labels.earnings}</p>
              <ul className={styles.earningsList}>
                {today.earnings.map((row) => (
                  <li key={row.symbol}>
                    <Link href={`/hisse/${row.symbol}`} className={styles.earningsChip}>
                      <b>{row.symbol}</b>
                      <span>{day(row.date)}</span>
                      {row.hour && <span className={styles.timing}>{row.hour === "bmo" ? labels.bmo : labels.amc}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className={base.disclosure}>
            {today.covered < today.total && (
              <>
                {labels.partial.replace("{covered}", String(today.covered)).replace("{total}", String(today.total))}{" "}
              </>
            )}
            {labels.disclosure}
          </p>
        </div>
      ) : state.status === "failed" ? (
        <p className={base.failed}>{labels.unavailable}</p>
      ) : (
        <div className={styles.fullLoading}>
          <p className={base.loadingText}>
            <Sparkle className={base.loadingIcon} size={15} weight="fill" aria-hidden />
            {labels.loading}
          </p>
          <Skeleton className={styles.stripSkeleton} />
          <Skeleton className={cn(base.line, "w-[92%]")} />
          <Skeleton className={cn(base.line, "w-[78%]")} />
          <Skeleton className={cn(base.line, "w-[85%]")} />
          <Skeleton className={cn(base.line, "w-[60%]")} />
        </div>
      )}
    </Panel>
  );
}

/**
 * Kısa biçim (ana sayfa paneli içinde). 24 EKİM DÜZELTMESİ: iskelet notun
 * boyunda 111 piksel yer ayırıyordu ve not yazılamazsa blok tümden
 * kalkıyordu: kolon 135 piksel (blok + üst boşluk) bir anda yukarı
 * kayıyordu, düşüş sık (not okur başına seans başına bir kez yazılıyor,
 * liste okunamazsa hiç). Şimdi:
 *  - İskelet İNCE bir satır: Claude imi + "okuyor" künyesi ve kulvar
 *    üstünde 5 piksellik şerit (grafik dili). Ölçüldü (24 Ekim, fixture):
 *    blok 59 piksel; eski iskeletin 136sının yarısından az. Not gelince 59 → 136, düşünce 59 → 0, ikisi de 0,45 sn.
 *  - Kabuğun yüksekliği içeriğinden ölçülür ve `--ease-brand` ile geçer:
 *    not gelince yumuşak açılır, düşünce yumuşak kapanır (yükseklik, üst
 *    boşluk ve saydamlık birlikte). Boşluk dürüstçe kalmaz, kolon zıplamaz.
 *  - Hareketi azaltan okurda geçiş YOK: kabuk anında yerine oturur.
 * JS kapalıyken bileşen zaten basılmıyor (istemci bileşeni, istekle dolar).
 */
function CompactNote({
  shellRef,
  pending,
  gone,
  today,
  date,
  labels,
}: {
  shellRef: RefObject<(HTMLElement & HTMLDivElement) | null>;
  pending: boolean;
  gone: boolean;
  today: Today | undefined;
  date: string | null;
  labels: WatchlistTodayLabels;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  /* Ölçülen içerik yüksekliği; ilk ölçüme kadar `auto` (ilk karede geçiş yok). */
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => setHeight(inner.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);
  const note = today?.note;
  return (
    <div
      ref={shellRef}
      className={styles.compactShell}
      data-gone={gone || undefined}
      aria-busy={pending}
      style={height === null ? undefined : { height: gone ? 0 : height }}
    >
      <div ref={innerRef} className={styles.compact}>
        {note && date ? (
          <>
            <p className={styles.credit}>
              <Sparkle className={base.icon} size={14} weight="duotone" aria-hidden />
              {labels.credit.replace("{date}", date)}
            </p>
            <p className={styles.compactText}>{note.summary}</p>
          </>
        ) : (
          <div className={styles.compactLoading}>
            <p className={base.loadingText}>
              <Sparkle className={base.loadingIcon} size={14} weight="fill" aria-hidden />
              {labels.loading}
            </p>
            <span className={styles.lane} aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
