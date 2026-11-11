"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChangePill, Panel, PanelHeader, Skeleton, TimingChip, type TimingTone } from "@/components/ui/primitives";
import { VerdictPill } from "@/components/ui/VerdictPill";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { EarningsDesk as Desk } from "@/lib/portfolio-earnings-desk";
import type { DeskAction, DeskCard, DeskFigure, DeskView } from "@/lib/portfolio-earnings-desk-model";
import { cn, directionOf, directionText, formatMoneyCompact, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./EarningsDesk.module.css";

/**
 * BİLANÇO MASASI — arayüz (11 Kasım). Gerekçe ve doğruluk kuralları
 * lib/portfolio-earnings-desk.ts. İki görünüş, tek istek kalıbı (portföy
 * taramasının, components/portfolio/PortfolioScan.tsx):
 *  - `EarningsDesk`: /portfoy'daki tam panel — masanın başlığı, kart başına
 *    şirket, tarih ve pencere çipi, beklenti ölçüleri, Claude notu; site
 *    sahibinde bilanço görüşü (VerdictPill + seviyeler).
 *  - `EarningsDeskBrief`: ana sayfa portföy kartı için tek satır özet +
 *    "Masayı Aç".
 *
 * MASA ÇOĞU GÜN BOŞ. Portföyde yaklaşan ya da yeni açıklanmış bilanço
 * yoksa uç `desk: null` döner ve iki görünüş de HİÇBİR ŞEY basmaz (yalnız
 * görünmez gözlemci düğümü). Boş masa yanıtı yalnız veritabanı sorgusu,
 * hızlı gelir; iskelet bu yüzden GECİKMELİ (`SKELETON_DELAY`): boş masada
 * iskelet açılıp kapanmasın (yerleşim zıplaması), Claude'un yazdığı dolu
 * masada bekleme görünsün. Kompakt görünüş iskelet hiç basmaz: ana sayfa
 * kartının içinde zıplama daha pahalı.
 *
 * ÇİZİM (kalın yatay şerit dili, `.claude/rules/arayuz.md`):
 *  - Sonrası: HBK ve gelirde gerçekleşen dolu çubuk (yönü renginde),
 *    beklenti onun üstünde kıyas çentiği; ilk tepki sıfırdan iki yana.
 *  - Öncesi: son çeyreklerin HBK sürprizi sıfırdan iki yana, yanında ilk
 *    tepki; beklenti değerleri yazılı (büyüklük çizilmez, yazılır).
 *  - İkisinde: portföydeki ağırlık 0–100 çubuğu, 5 ve 21 seans.
 * Ölçüm sonuçları dosya sonunda ("Ölçüm").
 */

type Labels = Dictionary["earningsDesk"];
type State = { status: "idle" | "loading" | "done" | "failed"; desk?: Desk | null };

const SKELETON_DELAY = 450;

/* Görüş hapı VerdictPill'in renk dilinde: ekle = al; tut ve azalt nötr
   (ikisi de pozisyonu taşımaya devam ediyor) — taramanın eşlemesi. */
const ACTION_VERDICT: Record<DeskAction, VerdictKey> = { add: "buy", hold: "hold", trim: "hold" };
const TIMING_TONE: Record<string, TimingTone> = { bmo: "pre", amc: "post" };

function useDesk(locale: Locale) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/bilanco-masasi?dil=${locale}`)
        .then((response) => response.json() as Promise<{ ok: boolean; desk?: Desk | null }>)
        .then((data) => setState(data.ok ? { status: "done", desk: data.desk ?? null } : { status: "failed" }))
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
  useEffect(() => {
    if (state.status !== "loading") return;
    const timer = setTimeout(() => setSlow(true), SKELETON_DELAY);
    return () => clearTimeout(timer);
  }, [state.status]);
  return { ref, state, slow };
}

const shortDay = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );

const sessionDate = (session: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${session}T12:00:00Z`),
  );

function Pct({ value, locale, digits = 1 }: { value: number | null; locale: Locale; digits?: number }) {
  return <b className={cn("numeral", value === null ? "text-muted" : directionText(directionOf(value)))}>{formatPercent(value, locale, digits)}</b>;
}

/** Sıfırdan iki yana açılan çubuk (sürpriz, tepki); ölçek çağıranın. */
function SplitBar({ value, scale }: { value: number | null; scale: number }) {
  const dir = value === null ? "flat" : directionOf(value);
  const width = value === null || scale <= 0 ? 0 : Math.min(50, (Math.abs(value) / scale) * 50);
  return (
    <span className={cn("value-lane", styles.lane)} data-draw aria-hidden>
      {width > 0 && (
        <i
          className="value-bar bar-fill"
          data-end={dir === "down" ? "start" : "end"}
          data-tone={dir === "up" ? "up" : dir === "down" ? "down" : "flat"}
          style={(dir === "down" ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }) as CSSProperties}
        />
      )}
      <span className={styles.zero} />
    </span>
  );
}

function Timing({ card, labels, locale }: { card: DeskCard; labels: Labels; locale: Locale }) {
  const timing = card.timing ? labels.timing[card.timing] : labels.timing.unknown;
  return (
    <div className={styles.when}>
      <span className={cn("numeral", styles.dayChip)}>{shortDay(card.reportDate, locale)}</span>
      <TimingChip tone={(card.timing && TIMING_TONE[card.timing]) || "neutral"} size="sm">
        {timing}
        {card.bell && <span className={cn("numeral", styles.bell)}>{labels.bell.replace("{time}", card.bell)}</span>}
      </TimingChip>
    </div>
  );
}

/** Gerçekleşen (dolu çubuk) ve beklenti (çentik), aynı ölçekte; değerlerden biri sıfır ya da eksiyse çubuk çizilmez, değerler yazılır. */
function FigureRow({ title, fig, format, labels, locale }: { title: string; fig: DeskFigure; format: (v: number) => string; labels: Labels; locale: Locale }) {
  const { actual, estimate } = fig;
  const drawable = actual !== null && estimate !== null && actual > 0 && estimate > 0;
  const max = drawable ? Math.max(actual, estimate) * 1.08 : 1;
  const tone = fig.direction === "beat" ? "up" : fig.direction === "miss" ? "down" : "flat";
  return (
    <div className={styles.figure}>
      <div className={styles.figureHead}>
        <span className={styles.label}>{title}</span>
        {fig.direction && (
          <span className={styles.verdict} data-tone={tone}>
            {labels.verdict[fig.direction]}
            {fig.ratio !== null && <span className="numeral"> · {labels.surprise.replace("{pct}", formatPercent(fig.ratio * 100, locale, 1))}</span>}
          </span>
        )}
      </div>
      {drawable && (
        <span className={cn("value-lane", styles.lane)} data-draw aria-hidden>
          <i className="value-bar bar-fill" data-end="end" data-tone={tone} style={{ left: 0, width: `${(actual / max) * 100}%` }} />
          <i className="value-notch" style={{ left: `${(estimate / max) * 100}%` }} />
        </span>
      )}
      <dl className={styles.pair}>
        <div>
          <dt>{labels.actual}</dt>
          <dd className="numeral">{actual === null ? "–" : format(actual)}</dd>
        </div>
        <div>
          <dt>{labels.estimate}</dt>
          <dd className="numeral">{estimate === null ? "–" : format(estimate)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Position({ card, labels, locale }: { card: DeskCard; labels: Labels; locale: Locale }) {
  return (
    <div className={styles.position}>
      <div className={styles.weight}>
        <span className={styles.label}>{labels.weight}</span>
        <span className={cn("value-lane", styles.lane)} data-draw aria-hidden>
          {card.weight !== null && <i className="value-bar bar-fill" data-end="end" style={{ left: 0, width: `${Math.max(1.5, Math.min(100, card.weight))}%` }} />}
        </span>
        <b className="numeral">{card.weight === null ? "–" : `${locale === "en" ? "" : "%"}${Math.round(card.weight)}${locale === "en" ? "%" : ""}`}</b>
      </div>
      <span className={styles.metric}>
        <span className={styles.label}>{labels.five}</span>
        <Pct value={card.fiveSession} locale={locale} />
      </span>
      <span className={styles.metric}>
        <span className={styles.label}>{labels.month}</span>
        <Pct value={card.month} locale={locale} />
      </span>
    </div>
  );
}

function History({ card, labels, locale }: { card: DeskCard; labels: Labels; locale: Locale }) {
  if (card.history.length === 0) return null;
  const scale = Math.max(5, ...card.history.map((q) => Math.abs((q.ratio ?? 0) * 100)));
  return (
    <div className={styles.history}>
      <span className={styles.historyTitle}>{labels.history}</span>
      <div className={styles.historyHead} aria-hidden>
        <span>{labels.historyCols.surprise}</span>
        <span>{labels.historyCols.reaction}</span>
      </div>
      <ul>
        {card.history.map((q) => {
          const surprise = q.ratio === null ? null : q.ratio * 100;
          return (
            <li
              key={q.reportDate}
              aria-label={labels.historyAria
                .replace("{quarter}", q.label)
                .replace("{surprise}", q.ratio === null ? labels.verdict[q.direction] : formatPercent(surprise, locale, 1))
                .replace("{reaction}", formatPercent(q.reaction, locale, 1))}
            >
              <span className={cn("numeral", styles.quarter)}>{q.label}</span>
              <SplitBar value={surprise} scale={scale} />
              <span className={styles.histValue}>
                {surprise === null ? <span className={styles.inline}>{labels.inlineShort}</span> : <Pct value={surprise} locale={locale} />}
              </span>
              <span className={styles.histValue}>
                <Pct value={q.reaction} locale={locale} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Reaction({ card, labels, locale }: { card: DeskCard; labels: Labels; locale: Locale }) {
  const pct = card.reaction?.pct ?? null;
  return (
    <div className={styles.reaction}>
      <span className={styles.label}>{labels.reaction}</span>
      {card.reactionPending ? (
        <span className={styles.pending}>{labels.reactionPending}</span>
      ) : (
        <>
          <SplitBar value={pct} scale={Math.max(5, Math.abs(pct ?? 0))} />
          <ChangePill changePct={pct} locale={locale} size="sm" />
        </>
      )}
    </div>
  );
}

function ViewBox({ view, labels }: { view: DeskView; labels: Labels }) {
  return (
    <div className={styles.view}>
      <div className={styles.viewRow}>
        <VerdictPill verdict={ACTION_VERDICT[view.action]} label={labels.view.actions[view.action]} />
        {view.takeProfit && (
          <span className={styles.level} data-kind="tp">
            {labels.view.takeProfit} <b className="numeral">{view.takeProfit.label}</b>
          </span>
        )}
        {view.stopLoss && (
          <span className={styles.level} data-kind="sl">
            {labels.view.stopLoss} <b className="numeral">{view.stopLoss.label}</b>
          </span>
        )}
      </div>
      <p className={styles.viewText}>{view.rationale}</p>
    </div>
  );
}

function Card({ card, note, view, labels, locale }: { card: DeskCard; note: string | null; view: DeskView | null; labels: Labels; locale: Locale }) {
  const money = (v: number) => formatPrice(v, locale, { currency: card.currency ?? true });
  const compact = (v: number) => formatMoneyCompact(v, locale, card.currency);
  const strip =
    card.phase === "before" ? "pending" : card.eps.direction === "beat" ? "up" : card.eps.direction === "miss" ? "down" : "flat";
  return (
    <li className={styles.card} data-phase={card.phase} data-strip={strip}>
      <div className={styles.cardHead}>
        <Link href={`/hisse/${card.symbol}`} prefetch={false} className={styles.identity}>
          <span className={cn("numeral", styles.symbol)}>{card.symbol}</span>
          <span className={styles.name}>{card.name}</span>
        </Link>
        {card.fiscal && <span className={cn("numeral", styles.fiscal)}>{card.fiscal}</span>}
      </div>
      <Timing card={card} labels={labels} locale={locale} />

      {card.phase === "after" ? (
        <div className={styles.figures}>
          <FigureRow title={labels.eps} fig={card.eps} format={money} labels={labels} locale={locale} />
          <FigureRow title={labels.revenue} fig={card.revenue} format={compact} labels={labels} locale={locale} />
          <Reaction card={card} labels={labels} locale={locale} />
        </div>
      ) : (
        <>
          <dl className={styles.estimates}>
            <div>
              <dt>{labels.epsEstimate}</dt>
              <dd className="numeral">{card.eps.estimate === null ? "–" : money(card.eps.estimate)}</dd>
            </div>
            <div>
              <dt>{labels.revenueEstimate}</dt>
              <dd className="numeral">{card.revenue.estimate === null ? "–" : compact(card.revenue.estimate)}</dd>
            </div>
          </dl>
          <History card={card} labels={labels} locale={locale} />
        </>
      )}

      <Position card={card} labels={labels} locale={locale} />
      {note && <p className={styles.note}>{note}</p>}
      {view && <ViewBox view={view} labels={labels} />}
      <div className={styles.links}>
        <Link href={`/hisse/${card.symbol}`} prefetch={false}>
          {labels.stock}
          <ArrowRight size={13} weight="bold" aria-hidden />
        </Link>
        {card.analysisHref && (
          <Link href={card.analysisHref} prefetch={false}>
            {labels.analysis}
            <ArrowRight size={13} weight="bold" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */

export function EarningsDesk({ locale, labels }: { locale: Locale; labels: Labels }) {
  const { ref, state, slow } = useDesk(locale);
  const desk = state.desk ?? null;
  if (!desk) {
    if (state.status === "loading" && slow) {
      return (
        <Panel ref={ref as never} id="bilanco-masasi" className={styles.panel} aria-busy>
          <PanelHeader title={labels.title} action={<Sparkle className={styles.spark} size={18} weight="duotone" aria-hidden />} />
          <p className={styles.muted}>{labels.loading}</p>
          <div className={styles.skeleton} aria-hidden>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </Panel>
      );
    }
    return <div ref={ref} id="bilanco-masasi" className={styles.sentinel} aria-hidden />;
  }

  const text = desk.text;
  const views = new Map((desk.views ?? []).map((v) => [v.symbol, v]));
  const groups = (["after", "before"] as const).map((phase) => ({ phase, cards: desk.cards.filter((c) => c.phase === phase) })).filter((g) => g.cards.length > 0);

  return (
    <Panel ref={ref as never} id="bilanco-masasi" className={styles.panel}>
      <PanelHeader
        title={labels.title}
        meta={labels.session.replace("{date}", sessionDate(desk.session, locale))}
        action={<Sparkle className={styles.spark} size={18} weight="duotone" aria-hidden />}
      />
      {text?.headline ? <h3 className={styles.headline}>{text.headline}</h3> : !text && <p className={styles.muted}>{labels.noText}</p>}

      {groups.map((group) => (
        <section key={group.phase} aria-label={labels.groups[group.phase]} className={styles.group}>
          <h3 className={styles.groupTitle}>
            {labels.groups[group.phase]}
            <span className="numeral">{group.cards.length}</span>
          </h3>
          <ul className={styles.cards}>
            {group.cards.map((card) => (
              <Card
                key={card.symbol}
                card={card}
                note={text?.notes[card.symbol]?.note ?? null}
                view={views.get(card.symbol) ?? null}
                labels={labels}
                locale={locale}
              />
            ))}
          </ul>
        </section>
      ))}

      <div className={styles.foot}>
        <p>{labels.disclosure.replace("{zone}", labels.zone[locale])}</p>
        {views.size > 0 && <p>{labels.view.disclosure}</p>}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

export function EarningsDeskBrief({ locale, labels }: { locale: Locale; labels: Labels }) {
  const { ref, state } = useDesk(locale);
  const desk = state.desk ?? null;
  if (!desk) return <div ref={ref} className={styles.sentinel} aria-hidden />;
  const after = desk.cards.filter((c) => c.phase === "after").length;
  const before = desk.cards.length - after;
  const counts = [after > 0 && labels.brief.after.replace("{n}", String(after)), before > 0 && labels.brief.before.replace("{n}", String(before))].filter(Boolean).join(" · ");
  /* Tek satır: Claude'un masa başlığı; yoksa (yazılamadı) sembol ve gün. */
  const line =
    desk.text?.headline ??
    desk.cards.map((c) => `${c.symbol} ${shortDay(c.reportDate, locale)}`).join(" · ");
  return (
    <div ref={ref} className={styles.brief}>
      <div className={styles.briefHead}>
        <span className={styles.briefTitle}>
          <Sparkle size={16} weight="duotone" aria-hidden className={styles.spark} />
          {labels.homeTitle}
        </span>
        <span className={styles.briefMeta}>{counts}</span>
      </div>
      <p className={styles.briefLine}>{line}</p>
      <Link href="/portfoy#bilanco-masasi" prefetch={false} className={styles.briefLink}>
        {labels.brief.open}
        <ArrowRight size={13} weight="bold" aria-hidden />
      </Link>
    </div>
  );
}

/*
 * Ölçüm (11 Kasım; geçici önizleme rotası, uca `page.route` ile sahte masa:
 * iki sonrası — biri tepkili, biri tepki bekleyen — iki öncesi — dört
 * çeyrek geçmişli, TWD'li uzun adlı — sahipte üç görüş; reducedMotion,
 * iki tema, TR + EN):
 *  - Tam panel: 946'lık kapta üye 1.282, sahip 1.542 piksel (iki sütun,
 *    kartlar sırada eşit boy); 390'lık telefonda (322 kap) üye 2.404,
 *    sahip 2.821; 350'lik rayda sahip 2.741; 768'de 1.978.
 *  - Kompakt: 350'lik rayda 125 piksel (başlık + iki satırlık özet + bağlantı).
 *  - Bütün durumlarda yatay taşma 0, kutusundan taşan öğe 0, kırpılan
 *    metin 0, görüş hapı taşması 0; her değer çubuğunun hesaplanan boyu 8.
 *  - İlk turda üç bulgu düzeltildi: kap sorgusu `.cards`ın kendisindeydi
 *    (946'da tek sütun kalıyordu), "Son Çeyrekler" 62 piksellik sütunda iki
 *    satıra kırılıyordu, "Beklentide" 58 piksellik sütundan taşıyordu.
 */
