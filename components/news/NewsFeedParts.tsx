import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { NewsPulse } from "@/lib/feed-visuals";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { cn, directionOf, directionText, formatPercentPlain } from "@/lib/utils";
import feed from "./NewsFeed.module.css";

/**
 * HABERLER'İN GÖRSEL KATMANI (25 Ekim, sahibinin isteği: "logo + başlık
 * listesi okunmuyor"). Saf görünüm; sayılar lib/feed-visuals.ts'te, seans
 * kanıtı sayfada (`dayChange` yalnız bu seansa ait işlemden gelir — CLAUDE.md
 * "Veri dürüstlüğü" 4). Yüzde yön renginde; sayım çubuğu markanın yumuşak
 * mavisi (büyüklük), doygun mavi yalnız etkileşimde; sayılar metin renginde.
 */

type Names = Record<string, { logoUrl?: string | null; name?: string | null } | undefined>;
type L = Dictionary["feedVisuals"]["news"];

/** Küçük yön rozeti — ok yönü söylüyor, sayı işaretsiz (çift işaret yok). */
export function DirectionFigure({ pct, locale, className }: { pct: number | null | undefined; locale: Locale; className?: string }) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  const direction = directionOf(pct);
  return (
    <span className={cn("numeral", directionText(direction), feed.figure, className)}>
      {direction !== "flat" && <span aria-hidden className={feed.arrow}>{direction === "up" ? "▲" : "▼"}</span>}
      <span className="sr-only">{direction === "up" ? "+" : direction === "down" ? "−" : ""}</span>
      {formatPercentPlain(pct, locale, 1)}
    </span>
  );
}

/**
 * Tepe cümlesi + "En Çok Konuşulan Şirketler" şeridi. Kart bir süzgeç
 * bağlantısı (`?sembol=`), `scroll={false}`: sayfa içi süzgeç kalıbı.
 * Çubuğun boyu o şirketin haber sayısının şeritteki en yükseğe oranı.
 */
export function NewsPulseStrip({
  pulse,
  sentence,
  names,
  dayChange,
  labels,
  locale,
}: {
  pulse: NewsPulse;
  sentence: string | null;
  names: Names;
  dayChange: Record<string, number>;
  labels: L;
  locale: Locale;
}) {
  if (!sentence) return null;
  const max = Math.max(1, ...pulse.top.map((entry) => entry.count));
  return (
    <Panel aria-label={labels.stripTitle} className={feed.pulse}>
      <PanelHeader title={labels.stripTitle} />
      <p className={feed.sentence}>{sentence}</p>
      {pulse.top.length > 0 && (
        <ol className={feed.companies}>
          {pulse.top.map((entry, index) => (
            <li key={entry.symbol} className={feed.companyItem} style={{ "--i": index } as CSSProperties}>
              <Link
                href={`/haberler?sembol=${encodeURIComponent(entry.symbol)}`}
                scroll={false}
                prefetch={false}
                className={feed.company}
                aria-label={labels.companyAria.replace("{symbol}", entry.symbol).replace("{n}", String(entry.count))}
              >
                <span className={feed.companyHead}>
                  <LogoTile symbol={entry.symbol} logoUrl={names[entry.symbol]?.logoUrl} size="sm" />
                  <span className={feed.companyId}>
                    <span className={feed.companySymbol}>{entry.symbol}</span>
                    <span className={feed.companyName}>{names[entry.symbol]?.name ?? ""}</span>
                  </span>
                </span>
                <span className={feed.companyFoot}>
                  <span className={feed.companyCount}>
                    {entry.count === 1 ? labels.storyCountOne : labels.storyCount.replace("{n}", String(entry.count))}
                  </span>
                  <DirectionFigure pct={dayChange[entry.symbol]} locale={locale} />
                </span>
                <span className={feed.countLane} aria-hidden>
                  <span className={feed.countBar} style={{ "--share": entry.count / max } as CSSProperties} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className={feed.hint}>{labels.stripHint}</p>
    </Panel>
  );
}

/** Saat başlığı — zaman çizgisinin durağı. */
export function HourHead({
  id,
  from,
  to,
  dayOffset,
  dayLabel,
  count,
  labels,
}: {
  id: string;
  from: string;
  to: string | null;
  dayOffset: number;
  dayLabel: string;
  count: number;
  labels: L;
}) {
  const day = dayOffset === 0 ? labels.today : dayOffset === -1 ? labels.yesterday : dayLabel;
  return (
    <h2 id={id} className={feed.hourHead} data-ink="plain">
      <span className={feed.hourClock} data-range={to ? "" : undefined}>
        {from}
        {to && <span className={feed.hourTo}>-{to}</span>}
      </span>
      <span className={feed.hourDay}>{day}</span>
      <span className={feed.hourCount}>
        {count === 1 ? labels.storyCountOne : labels.storyCount.replace("{n}", String(count))}
      </span>
    </h2>
  );
}
