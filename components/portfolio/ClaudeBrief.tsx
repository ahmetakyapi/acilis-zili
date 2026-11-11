"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, CalendarBlank, ChartLineUp, ChartPieSlice, Newspaper, Sparkle, SquaresFour, TrendUp, Warning } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Skeleton } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { AdvisorReport } from "@/lib/portfolio-advisor";
import type { EarningsDesk } from "@/lib/portfolio-earnings-desk";
import type { PortfolioScan } from "@/lib/portfolio-scan";
import type { PlanAction, ScanRow, ScanThemeKind } from "@/lib/portfolio-scan-model";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import styles from "./ClaudeBrief.module.css";

/**
 * CLAUDE · BUGÜN — ana sayfa portföy kartının Claude bölümü (11 Kasım).
 *
 * ÜÇ KUTU TEK BÖLÜM OLDU. Kartın altında "Günün Taraması", "Bilanço
 * Masası" ve "Danışmanın Bugün" alt alta üç ayrı çerçeveli kutuydu (1440'ta
 * ~1.000 piksel); aynı hisseler için iki öneri listesi (Kişisel Plan ve
 * danışman) yan yana duruyor, her biri yalnız sembol ve hap taşıyordu.
 * Sahibinin itirazı: "çok daha görsel, çok daha kompakt, animasyonlu, daha
 * okunabilir, daha anlaşılabilir". Şimdi tek yüzey:
 *   1. Başlık — sahipte danışmanın günlük başlığı, üyede taramanınki; altında
 *      iki satırlık özet ve tema hapları.
 *   2. Pozisyon karoları — ağırlığı en büyük altı hisse: logo, sembol, beş
 *      seanslık şerit (sıfırdan iki yana, yön renginde, görünce dolar) ve
 *      sağ üstte görüş hapı (sahipte Kişisel Plan; üyede yaklaşan bilanço ya
 *      da teknik görüş işareti). Kâr al / zarar kes seviyeleri karonun
 *      dibinde. Karo hisse sayfasına gider.
 *   3. Bilanço çipleri — Bilanço Masası'ndan: açıklayan ve yaklaşanlar,
 *      günü ve zamanlamasıyla.
 *   4. Bağlantılar — Tarama · Danışman (sahip) · Bilanço Masası.
 * Üç uç paralel istenir (her biri günde bir kez yazılır, sonrası önbellek);
 * kart görünüme yaklaşınca. Tarama gelmezse bölüm hiç basılmaz.
 */

type Labels = {
  brief: Dictionary["claudeBrief"];
  scan: Dictionary["portfolioScan"];
  desk: Dictionary["earningsDesk"];
  advisor: Dictionary["portfolioAdvisor"];
};

const THEME_ICONS: Record<ScanThemeKind, typeof Sparkle> = {
  concentration: ChartPieSlice,
  momentum: TrendUp,
  calendar: CalendarBlank,
  technical: ChartLineUp,
  news: Newspaper,
  sector: SquaresFour,
  risk: Warning,
};
const ACTION_TONE: Record<PlanAction, "up" | "down" | "hold"> = { add: "up", hold: "hold", trim: "down", sell: "down" };
const TILES = 6;

type Data = { scan: PortfolioScan | null; advisor: AdvisorReport | null; desk: EarningsDesk | null };

async function getJson<T>(url: string, key: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    const d = (await r.json()) as Record<string, unknown>;
    return d.ok ? ((d[key] as T | null | undefined) ?? null) : null;
  } catch {
    return null;
  }
}

const shortDay = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function FiveBar({ row, scale }: { row: ScanRow; scale: number }) {
  const v = row.fiveSession;
  const dir = v === null ? "flat" : directionOf(v);
  const width = v === null ? 0 : Math.min(50, (Math.abs(v) / scale) * 50);
  return (
    <span className={cn("value-lane", styles.lane)} data-draw aria-hidden>
      <i
        className="value-bar bar-fill"
        data-end="end"
        data-tone={dir === "up" ? "up" : dir === "down" ? "down" : undefined}
        style={(dir === "down" ? { right: "50%", width: `${width}%`, transformOrigin: "right" } : { left: "50%", width: `${width}%` }) as CSSProperties}
      />
      <span className={styles.zero} />
    </span>
  );
}

export function ClaudeBrief({
  locale,
  labels,
  logos,
  owner,
}: {
  locale: Locale;
  labels: Labels;
  logos: Record<string, string | null>;
  owner: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || data || failed) return;
    const load = () => {
      Promise.all([
        getJson<PortfolioScan>(`/api/ai/portfoy-taramasi?dil=${locale}`, "scan"),
        owner ? getJson<AdvisorReport>(`/api/ai/portfoy-danisman?ufuk=gunluk&dil=${locale}`, "report") : Promise.resolve(null),
        getJson<EarningsDesk>(`/api/ai/bilanco-masasi?dil=${locale}`, "desk"),
      ]).then(([scan, advisor, desk]) => (scan ? setData({ scan, advisor, desk }) : setFailed(true)));
    };
    if (typeof IntersectionObserver === "undefined") return load();
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (io.disconnect(), load()), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [data, failed, locale, owner]);

  if (failed) return <div ref={ref} hidden />;
  const L = labels.brief;
  if (!data?.scan) {
    return (
      <div ref={ref} className={styles.brief} aria-busy>
        <div className={styles.head}>
          <span className={styles.title}>
            <Sparkle size={16} weight="duotone" aria-hidden className={styles.spark} />
            {L.title}
          </span>
        </div>
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <div className={styles.tiles} aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  const { scan, advisor, desk } = data;
  const text = scan.text;
  const headline = advisor?.text.headline ?? text?.headline ?? null;
  const summary = advisor?.text.summary ?? text?.summary ?? null;
  const plans = new Map((scan.plans ?? []).map((p) => [p.symbol, p]));
  const rows = scan.rows.slice(0, TILES);
  const scale = Math.max(5, ...rows.map((r) => Math.abs(r.fiveSession ?? 0)));
  const sessionLabel = labels.scan.session.replace(
    "{date}",
    new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${scan.session}T12:00:00Z`)),
  );
  const deskCards = (desk?.cards ?? []).slice(0, 4);

  return (
    <div ref={ref} className={styles.brief}>
      <div className={styles.head}>
        <span className={styles.title}>
          <Sparkle size={16} weight="duotone" aria-hidden className={styles.spark} />
          {L.title}
        </span>
        <span className={styles.meta}>
          {owner && <span className={styles.badge}>{labels.advisor.badge}</span>}
          {sessionLabel}
        </span>
      </div>

      {headline && <p className={styles.headline}>{headline}</p>}
      {summary && <p className={styles.summary}>{summary}</p>}

      {text && text.themes.length > 0 && (
        <ul className={styles.themes}>
          {text.themes.slice(0, 3).map((theme, i) => {
            const Icon = THEME_ICONS[theme.kind];
            return (
              <li key={i} data-kind={theme.kind} title={theme.detail}>
                <Icon size={13} weight="duotone" aria-hidden />
                <span className={styles.themeTitle}>{theme.title}</span>
              </li>
            );
          })}
        </ul>
      )}

      <section aria-label={L.positions}>
        <ul className={styles.tiles}>
          {rows.map((row, index) => {
            const plan = plans.get(row.symbol);
            const earnings = row.flags.find((f) => f.kind === "earnings") as { date: string } | undefined;
            const tech = row.flags.find((f) => f.kind === "technical") as { stance: "buy" | "hold" | "sell" } | undefined;
            const tone = plan ? ACTION_TONE[plan.action] : null;
            return (
              <li key={row.symbol} style={{ "--i": index } as CSSProperties}>
                <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.tile} data-tone={tone ?? undefined}>
                  <span className={styles.tileTop}>
                    <LogoTile symbol={row.symbol} logoUrl={logos[row.symbol] ?? null} size="sm" />
                    <span className={cn("numeral", styles.symbol)}>{row.symbol}</span>
                    {plan ? (
                      <span className={styles.action} data-tone={tone}>
                        {labels.scan.plan.actions[plan.action]}
                      </span>
                    ) : earnings ? (
                      <span className={styles.flag}>
                        <CalendarBlank size={11} weight="bold" aria-hidden />
                        {shortDay(earnings.date, locale)}
                      </span>
                    ) : tech ? (
                      <span className={styles.flag} data-stance={tech.stance}>
                        {labels.scan.flags.technical.replace("{stance}", (locale === "en" ? { buy: "Buy", hold: "Hold", sell: "Sell" } : { buy: "Al", hold: "Tut", sell: "Sat" })[tech.stance])}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.five}>
                    <FiveBar row={row} scale={scale} />
                    <b className={cn("numeral", row.fiveSession === null ? "text-muted" : directionText(directionOf(row.fiveSession)))}>
                      {formatPercent(row.fiveSession, locale, 1)}
                    </b>
                  </span>
                  {plan && (plan.takeProfit || plan.stopLoss) && (
                    <span className={styles.levels}>
                      {plan.takeProfit && (
                        <span data-kind="tp">
                          {labels.scan.plan.takeProfit} <b className="numeral">{plan.takeProfit.label}</b>
                        </span>
                      )}
                      {plan.stopLoss && (
                        <span data-kind="sl">
                          {labels.scan.plan.stopLoss} <b className="numeral">{plan.stopLoss.label}</b>
                        </span>
                      )}
                    </span>
                  )}
                  <span className="sr-only">
                    {L.fiveSessions}: {formatPercent(row.fiveSession, locale, 1)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {deskCards.length > 0 && (
        <ul className={styles.desk} aria-label={L.earnings}>
          {deskCards.map((card) => (
            <li key={card.symbol}>
              <Link href="/portfoy#bilanco-masasi" prefetch={false} className={styles.deskChip} data-phase={card.phase}>
                <CalendarBlank size={13} weight="duotone" aria-hidden />
                <b className="numeral">{card.symbol}</b>
                {card.phase === "after" ? (
                  <>
                    <span>{L.reported}</span>
                    {card.reaction && <b className={cn("numeral", directionText(directionOf(card.reaction.pct)))}>{formatPercent(card.reaction.pct, locale, 1)}</b>}
                  </>
                ) : (
                  <span>
                    {shortDay(card.reportDate, locale)} · {labels.desk.timing[card.timing as keyof typeof labels.desk.timing] ?? ""}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav className={styles.links}>
        <Link href="/portfoy#tarama" prefetch={false}>
          {L.links.scan}
          <ArrowRight size={12} weight="bold" aria-hidden />
        </Link>
        {owner && (
          <Link href="/portfoy/analiz#danisman" prefetch={false}>
            {L.links.advisor}
            <ArrowRight size={12} weight="bold" aria-hidden />
          </Link>
        )}
        {deskCards.length > 0 && (
          <Link href="/portfoy#bilanco-masasi" prefetch={false}>
            {L.links.desk}
            <ArrowRight size={12} weight="bold" aria-hidden />
          </Link>
        )}
      </nav>
    </div>
  );
}
