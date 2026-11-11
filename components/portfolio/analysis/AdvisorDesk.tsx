"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowsSplit,
  Binoculars,
  Minus,
  Plus,
  ShieldCheck,
  Sparkle,
  Umbrella,
  Warning,
} from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChatComposer, ChatThread, SuggestionChips, type ChatMessage } from "@/components/ai/chat/Chat";
import { ChangePill, Panel, Skeleton } from "@/components/ui/primitives";
import type { PortfolioAskAnswer, PortfolioTurn } from "@/lib/portfolio-question";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { AdvisorReport } from "@/lib/portfolio-advisor";
import type { AdvisorActionKind, AdvisorHorizon } from "@/lib/portfolio-advisor-model";
import { cn, formatPercentText } from "@/lib/utils";
import styles from "./AdvisorDesk.module.css";

/**
 * KİŞİSEL DANIŞMAN — arayüz (11 Kasım). Gerekçe lib/portfolio-advisor*.ts;
 * yalnız site sahibine basılır (sayfa `getAdmin` ile seçer).
 *  - `AdvisorDesk`: /portfoy/analiz'de Günlük | Aylık sekmeli panel —
 *    başlık + özet, öncelik sıralı eylem karoları (tür ikonu ve rengi:
 *    azalt/çeşitlendir/sınırla sıcak, ekle yeşil, koru/izle nötr), riskler,
 *    önümüzdeki dönem; aylıkta 21 seansın karnesi (portföy vs S&P 500,
 *    getiriyi taşıyan/götüren pozisyonlar, katkı şeridi).
 *  - `AdvisorBrief`: ana sayfa portföy kartında günlük notun başlığı ve ilk
 *    iki eylemi + "Danışman Notunun Tamamı".
 * Sekme ilk açılışta istenir; ikincisi tıklanınca (aylık not ayda bir
 * yazılır, sonrası önbellekten).
 *
 * Ölçüm (geçici önizleme, sahte yanıt, beş eylem, iki tema): 1180 kapta
 * günlük 899 / aylık 1.162, 358'de 1.539 / 1.885 piksel; ana sayfa özeti
 * 420'de 205, 358'de 226. Yatay taşma, kutudan taşan öğe ve kırpılan
 * metin 0.
 */

type Labels = Dictionary["portfolioAdvisor"];
type Entry = { status: "loading" | "done" | "failed"; report?: AdvisorReport };

const KIND_ICON: Record<AdvisorActionKind, typeof Plus> = {
  trim: Minus,
  add: Plus,
  diversify: ArrowsSplit,
  hedge: Umbrella,
  hold: ShieldCheck,
  watch: Binoculars,
};

function fetchReport(horizon: AdvisorHorizon, locale: Locale): Promise<Entry> {
  return fetch(`/api/ai/portfoy-danisman?ufuk=${horizon === "monthly" ? "aylik" : "gunluk"}&dil=${locale}`)
    .then((r) => r.json() as Promise<{ ok: boolean; report?: AdvisorReport }>)
    .then((d) => (d.ok && d.report ? { status: "done" as const, report: d.report } : { status: "failed" as const }))
    .catch(() => ({ status: "failed" as const }));
}

function useVisible<T extends HTMLElement>(onVisible: () => void) {
  const ref = useRef<T>(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return;
    const fire = () => {
      if (fired.current) return;
      fired.current = true;
      onVisible();
    };
    if (typeof IntersectionObserver === "undefined") return fire();
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (io.disconnect(), fire()), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible]);
  return ref;
}

const dateOf = (session: string, locale: Locale, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { ...opts, timeZone: "UTC" }).format(new Date(`${session}T12:00:00Z`));

function Loading({ labels }: { labels: Labels }) {
  return (
    <div className={styles.loading} aria-hidden>
      <p>{labels.loading}</p>
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <div className={styles.actions}>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

function Monthly({ report, labels, locale }: { report: AdvisorReport; labels: Labels; locale: Locale }) {
  const m = report.monthly;
  if (!m) return null;
  const scale = Math.max(0.5, ...m.contributions.map((c) => Math.abs(c.points)));
  const tops = m.contributions.filter((c) => c.points > 0).slice(0, 3);
  const bottoms = m.contributions.filter((c) => c.points < 0).slice(-3).reverse();
  const pts = (v: number) => `${formatPercentText(v, locale, 1).replace("%", "")} ${labels.pointsUnit}`;
  const Row = ({ c }: { c: (typeof m.contributions)[number] }) => (
    <li className={styles.contrib}>
      <span className={cn("numeral", styles.contribSymbol)}>{c.symbol}</span>
      <span className={cn("value-lane", styles.contribLane)} data-draw>
        <i
          className="value-bar bar-fill"
          data-end="end"
          data-tone={c.points >= 0 ? "up" : "down"}
          style={{ left: 0, width: `${Math.max(3, (Math.abs(c.points) / scale) * 100)}%` } as CSSProperties}
        />
      </span>
      <b className={cn("numeral", c.points >= 0 ? "text-up" : "text-down")}>{pts(c.points)}</b>
    </li>
  );
  return (
    <section className={styles.monthly} aria-label={labels.monthlyTitle}>
      <h3 className={styles.sectionTitle}>{labels.monthlyTitle}</h3>
      <dl className={styles.versus}>
        <div>
          <dt>{labels.portfolio}</dt>
          <dd><ChangePill changePct={m.portfolio} locale={locale} /></dd>
        </div>
        <div>
          <dt>{labels.sp500}</dt>
          <dd><ChangePill changePct={m.sp500} locale={locale} /></dd>
        </div>
      </dl>
      <div className={styles.contribGrid}>
        {tops.length > 0 && (
          <div>
            <h4>{labels.contributors}</h4>
            <ul>{tops.map((c) => <Row key={c.symbol} c={c} />)}</ul>
          </div>
        )}
        {bottoms.length > 0 && (
          <div>
            <h4>{labels.detractors}</h4>
            <ul>{bottoms.map((c) => <Row key={c.symbol} c={c} />)}</ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Report({ report, labels, locale }: { report: AdvisorReport; labels: Labels; locale: Locale }) {
  const t = report.text;
  return (
    <div className={styles.report}>
      <div className={styles.lead}>
        <h3 className={styles.headline}>{t.headline}</h3>
        <p className={styles.summary}>{t.summary}</p>
      </div>

      {report.horizon === "monthly" && <Monthly report={report} labels={labels} locale={locale} />}

      {t.actions.length > 0 && (
        <section aria-label={labels.actionsTitle}>
          <h3 className={styles.sectionTitle}>{labels.actionsTitle}</h3>
          <ol className={styles.actions}>
            {t.actions.map((a, i) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <li key={i} className={styles.action} data-kind={a.kind}>
                  <div className={styles.actionHead}>
                    <span className={styles.rank}>{i + 1}</span>
                    <span className={styles.kind}>
                      <Icon size={14} weight="bold" aria-hidden />
                      {labels.kinds[a.kind]}
                    </span>
                    {a.symbol && (
                      <Link href={`/hisse/${a.symbol}`} prefetch={false} className={cn("numeral", styles.symbol)}>
                        {a.symbol}
                      </Link>
                    )}
                  </div>
                  <h4 className={styles.actionTitle}>{a.title}</h4>
                  <p className={styles.actionDetail}>{a.detail}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className={styles.split}>
        {t.risks.length > 0 && (
          <section className={styles.risks} aria-label={labels.risksTitle}>
            <h3 className={styles.sectionTitle}>
              <Warning size={15} weight="duotone" aria-hidden />
              {labels.risksTitle}
            </h3>
            <ul>
              {t.risks.map((r, i) => (
                <li key={i}>
                  <b>{r.title}</b>
                  <span>{r.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {t.outlook && (
          <section className={styles.outlook} aria-label={labels.outlookTitle}>
            <h3 className={styles.sectionTitle}>{labels.outlookTitle}</h3>
            <p>{t.outlook}</p>
          </section>
        )}
      </div>
    </div>
  );
}

/* DANIŞMANLA SOHBET (11 Kasım, sahibinin isteği: "bana öneriler yapsın,
   beraber soru cevap ilerleyelim, kritik yapabilelim; ayrıca kendi
   fikirlerini yapsın"). Notun hemen altında: Claude'un önerdiği sorular
   (danışman çıktısının `followUps`ı; yoksa sabit üç soru), konuşma akışı ve
   giriş kutusu. Uç Portföyüne Sor'un ucu (`/api/ai/portfoy-sor`): sahipte
   açık görüş, senaryo hesabı sunucuda, sayı denetimi açık; son üç adım
   `history` olarak gider. Her yanıtın altında Claude'un yeni takip
   soruları. Sohbet oturum boyunca durur, sayfa yenilenince sıfırlanır. */
type Turn = { id: string; question: string; answer: PortfolioAskAnswer | null; error: string | null };

function AdvisorChat({ locale, labels, seeds }: { locale: Locale; labels: Labels; seeds: string[] }) {
  const C = labels.chat;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const ask = (question: string) => {
    if (busy) return;
    const id = `t${Date.now()}`;
    const history: PortfolioTurn[] = turns
      .filter((t) => t.answer && t.answer.paragraphs.length)
      .slice(-3)
      .map((t) => ({ question: t.question, answer: t.answer!.paragraphs.join(" ").slice(0, 1200) }));
    setTurns((all) => [...all, { id, question, answer: null, error: null }]);
    setBusy(true);
    fetch("/api/ai/portfoy-sor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, locale, history }),
    })
      .then((r) => r.json() as Promise<{ ok: boolean; answer?: PortfolioAskAnswer; reason?: string; remaining?: number }>)
      .then((d) => {
        if (typeof d.remaining === "number") setRemaining(d.remaining);
        const err = d.ok && d.answer
          ? d.answer.kind === "unanswerable"
            ? C.errors.unanswerable
            : d.answer.kind === "scenario-unavailable"
              ? C.errors.scenario
              : null
          : (C.errors[(d.reason ?? "error") as keyof typeof C.errors] ?? C.errors.error);
        setTurns((all) => all.map((t) => (t.id === id ? { ...t, answer: d.ok ? d.answer ?? null : null, error: err } : t)));
      })
      .catch(() => setTurns((all) => all.map((t) => (t.id === id ? { ...t, error: C.errors.error } : t))))
      .finally(() => setBusy(false));
  };
  const messages: ChatMessage[] = turns.flatMap((t) => {
    const out: ChatMessage[] = [{ id: `${t.id}-q`, role: "user", content: t.question }];
    if (t.error) out.push({ id: `${t.id}-e`, role: "assistant", content: <p className={styles.chatError}>{t.error}</p> });
    else if (t.answer && t.answer.paragraphs.length)
      out.push({
        id: `${t.id}-a`,
        role: "assistant",
        content: (
          <>
            {t.answer.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {t.answer.measures.length > 0 && (
              <ul className={styles.chatMeasures} aria-label={C.measures}>
                {t.answer.measures.map((m) => (
                  <li key={m.id} data-tone={m.tone ?? undefined}>
                    <span>{m.label}</span>
                    <b className="numeral">{m.value}</b>
                  </li>
                ))}
              </ul>
            )}
          </>
        ),
      });
    return out;
  });
  const last = [...turns].reverse().find((t) => t.answer);
  const next = last?.answer?.followUps?.length ? last.answer.followUps : turns.length === 0 ? seeds : [];
  return (
    <section className={styles.chat} aria-label={C.title}>
      <div className={styles.chatHead}>
        <h3 className={styles.sectionTitle}>{C.title}</h3>
        <p className={styles.chatIntro}>{C.intro}</p>
      </div>
      {messages.length > 0 && (
        <ChatThread messages={messages} thinking={busy} thinkingLabel={C.thinking} label={C.log} youLabel={C.you} assistantLabel={C.assistant} />
      )}
      <SuggestionChips items={next} onPick={ask} disabled={busy || remaining === 0} label={C.suggestionsLabel} />
      <ChatComposer
        onSend={ask}
        label={C.label}
        placeholder={C.placeholder}
        sendLabel={C.send}
        busy={busy}
        disabled={remaining === 0}
        foot={remaining !== null ? <span>{C.remaining.replace("{n}", String(remaining))}</span> : undefined}
      />
    </section>
  );
}

export function AdvisorDesk({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [tab, setTab] = useState<AdvisorHorizon>("daily");
  const [entries, setEntries] = useState<Partial<Record<AdvisorHorizon, Entry>>>({});
  const load = (horizon: AdvisorHorizon) => {
    setEntries((e) => (e[horizon] ? e : { ...e, [horizon]: { status: "loading" } }));
    fetchReport(horizon, locale).then((entry) => setEntries((e) => ({ ...e, [horizon]: entry })));
  };
  const ref = useVisible<HTMLDivElement>(() => load("daily"));
  const entry = entries[tab];
  const report = entry?.report;
  const meta = report
    ? report.horizon === "daily"
      ? labels.sessionDaily.replace("{date}", dateOf(report.session, locale, { day: "numeric", month: "long" }))
      : labels.sessionMonthly.replace("{month}", dateOf(report.session, locale, { month: "long", year: "numeric" }))
    : null;

  return (
    <Panel id="danisman" className={styles.panel} aria-busy={!entry || entry.status === "loading"}>
      <div ref={ref} className={styles.head}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>
            <Sparkle size={20} weight="duotone" aria-hidden className={styles.spark} />
            {labels.title}
          </h2>
          <span className={styles.badge}>{labels.badge}</span>
        </div>
        <div className={styles.tabs} role="tablist" aria-label={labels.title}>
          {(["daily", "monthly"] as const).map((h) => (
            <button
              key={h}
              type="button"
              role="tab"
              aria-selected={tab === h}
              className={styles.tab}
              onClick={() => {
                setTab(h);
                if (!entries[h]) load(h);
              }}
            >
              {labels.tabs[h]}
            </button>
          ))}
        </div>
      </div>
      {meta && <p className={styles.meta}>{meta}</p>}
      {(!entry || entry.status === "loading") && <Loading labels={labels} />}
      {entry?.status === "failed" && <p className={styles.unavailable}>{labels.unavailable}</p>}
      {report && <Report report={report} labels={labels} locale={locale} />}
      {entries.daily?.status === "done" && (
        <AdvisorChat locale={locale} labels={labels} seeds={entries.daily.report?.text.followUps?.length ? entries.daily.report.text.followUps : labels.chat.defaults} />
      )}
      <p className={styles.disclosure}>{labels.disclosure}</p>
    </Panel>
  );
}

export function AdvisorBrief({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const ref = useVisible<HTMLDivElement>(() => {
    setEntry({ status: "loading" });
    fetchReport("daily", locale).then(setEntry);
  });
  if (entry?.status === "failed") return <div ref={ref} hidden />;
  const report = entry?.report;
  return (
    <div ref={ref} className={styles.brief} aria-busy={!report}>
      <div className={styles.briefHead}>
        <span className={styles.briefTitle}>
          <Sparkle size={16} weight="duotone" aria-hidden className={styles.spark} />
          {labels.homeTitle}
        </span>
        <span className={styles.badge}>{labels.badge}</span>
      </div>
      {!report ? (
        <div className={styles.loading} aria-hidden>
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <>
          <p className={styles.briefHeadline}>{report.text.headline}</p>
          <ol className={styles.briefActions}>
            {report.text.actions.slice(0, 3).map((a, i) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <li key={i} data-kind={a.kind}>
                  <span className={styles.kind}>
                    <Icon size={13} weight="bold" aria-hidden />
                    {labels.kinds[a.kind]}
                  </span>
                  {a.symbol && <b className="numeral">{a.symbol}</b>}
                  <span className={styles.briefActionTitle}>{a.title}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
      <Link href="/portfoy/analiz#danisman" prefetch={false} className={styles.briefLink}>
        {labels.openFull}
        <ArrowRight size={13} weight="bold" aria-hidden />
      </Link>
    </div>
  );
}
