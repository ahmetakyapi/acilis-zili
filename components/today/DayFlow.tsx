"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarBlank, Check, CircleNotch, Clock, TrendUp } from "@phosphor-icons/react";
import { LogoTile } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { displayFlowStatus, flowResultSignature, preserveConfirmedResults, type DayFlowSnapshot, type FlowEvent } from "@/lib/day-flow";
import { clockOf, displayZone } from "@/lib/session-clock";
import styles from "./DayFlow.module.css";

type Props = { initial: DayFlowSnapshot; locale: Locale; labels: Dictionary["dayFlow"]; railLabels: Dictionary["dayRail"] };
const pct = (minutes: number) => Math.max(0, Math.min(100, (minutes - 240) / 960 * 100));
const minutesOf = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

function revealRow(container: HTMLDivElement, card: HTMLElement, behavior: ScrollBehavior) {
  const bounds = container.getBoundingClientRect();
  const row = card.getBoundingClientRect();
  const delta = row.top < bounds.top ? row.top - bounds.top
    : row.bottom > bounds.bottom ? Math.min(row.top - bounds.top, row.bottom - bounds.bottom) : 0;
  if (delta) container.scrollTo({ top: container.scrollTop + delta, left: 0, behavior });
}

function Status({ event, nowMs, labels }: { event: Pick<FlowEvent, "status" | "scheduledAt">; nowMs: number; labels: Props["labels"] }) {
  const status = displayFlowStatus(event, nowMs);
  return <span key={status} className={styles.status} data-status={status}>
    {status === "released" || status === "analyzed" ? <Check size={11} weight="bold" /> : <span className={styles.statusDot} />}
    {labels[status]}
  </span>;
}

export function DayFlow({ initial, locale, labels, railLabels }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [nowMs, setNowMs] = useState(() => new Date(initial.asOf).getTime());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connection, setConnection] = useState<"ready" | "checking" | "error">("ready");
  const [announcement, setAnnouncement] = useState("");
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const refresh = useRef<() => void>(() => {});
  const announcedResults = useRef(flowResultSignature(initial.events));
  const reduced = useMotionPreference();
  const detailId = useId();

  useEffect(() => {
    // SessionRefresh can bring a partial provider response too. Merge it
    // exactly like polling, and never replace a newer poll with older SSR.
    // The loader is keyed by locale so formatted values cannot cross languages.
    const timer = window.setTimeout(() => setSnapshot((previous) =>
      Date.parse(initial.asOf) < Date.parse(previous.asOf)
        ? previous : preserveConfirmedResults(previous, initial)), 0);
    return () => window.clearTimeout(timer);
  }, [initial]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setNowMs(Date.now()); }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // Announce visible, merged results, not temporary gaps in raw responses.
    const signature = flowResultSignature(snapshot.events);
    if (signature === announcedResults.current) return;
    announcedResults.current = signature;
    const timer = window.setTimeout(() => {
      const time = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", {
        timeZone: displayZone(locale), hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      }).format(new Date());
      setAnnouncement(`${labels.updatedAnnouncement} ${time}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [snapshot.events, labels.updatedAnnouncement, locale]);

  useEffect(() => {
    let timer = 0;
    let abort: AbortController | null = null;
    let active = true;
    let visible = true;
    let failures = 0;
    async function poll() {
      window.clearTimeout(timer);
      if (!active || document.hidden || !visible || abort) return;
      const controller = new AbortController();
      abort = controller;
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      setConnection("checking");
      let delay = 30_000;
      try {
        const response = await fetch(`/api/day-flow?locale=${locale}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          delay = Math.max(delay, Number(response.headers.get("Retry-After") ?? 0) * 1000);
          throw new Error("unavailable");
        }
        const result: { ok: boolean; snapshot?: DayFlowSnapshot } = await response.json();
        if (!result.ok || !result.snapshot || !Array.isArray(result.snapshot.events) || !Number.isFinite(Date.parse(result.snapshot.asOf))) throw new Error("invalid-response");
        if (!active) return;
        const next = result.snapshot;
        startTransition(() => setSnapshot((previous) =>
          Date.parse(next.asOf) < Date.parse(previous.asOf)
            ? previous : preserveConfirmedResults(previous, next)));
        setNowMs(Date.now());
        setConnection("ready");
        failures = 0;
        delay = Math.max(30_000, next.pollAfterMs);
      } catch {
        if (!active) return;
        // Retain the last confirmed results. A failed refresh is visible,
        // never disguised as an empty day or a successful live update.
        setConnection("error");
        failures++;
        delay = Math.max(delay, Math.min(300_000, 30_000 * 2 ** failures));
      } finally {
        window.clearTimeout(timeout);
        abort = null;
        if (active && visible && !document.hidden) timer = window.setTimeout(poll, delay);
      }
    }
    function onVisibility() {
      window.clearTimeout(timer);
      if (!document.hidden && visible) void poll();
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) void poll(); else window.clearTimeout(timer);
    }, { rootMargin: "200px" });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", onVisibility);
    refresh.current = () => void poll();
    return () => {
      active = false;
      window.clearTimeout(timer);
      abort?.abort();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      refresh.current = () => {};
    };
  }, [locale]);

  const events = snapshot.events;
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const selectedIndex = events.findIndex((event) => event.id === selected?.id);
  const activeEventId = selected?.id;
  useEffect(() => {
    const container = cards.current;
    if (!container || !activeEventId) return;
    // Keep the selected agenda row visible across responsive width changes.
    // The compact list keeps a bounded height on both desktop and mobile.
    let width = container.clientWidth;
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === width) return;
      width = container.clientWidth;
      const card = container.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(activeEventId)}"]`);
      if (card) revealRow(container, card, "instant");
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeEventId]);
  const markerTimes = [...new Set(events.flatMap((event) => event.timeEt ? [event.timeEt] : []))];
  const nowEt = new Intl.DateTimeFormat("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(nowMs));
  const now = minutesOf(nowEt);
  const primary = (minutes: number) => clockOf(minutes + snapshot.offsets.primary);
  const timeOf = (event: FlowEvent) => event.timeEt ? `${event.approx ? "~" : ""}${primary(minutesOf(event.timeEt))}` : labels.timeUnknown;
  const checked = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: displayZone(locale), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(snapshot.asOf));
  const dayLabel = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "UTC", month: "long", day: "numeric", weekday: "long" }).format(new Date(snapshot.dateEt + "T12:00:00Z"));
  function select(id: string) {
    setSelectedId(id);
    const card = cards.current?.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(id)}"]`);
    if (card && cards.current) revealRow(cards.current, card, reduced ? "instant" : "smooth");
  }

  return <div ref={ref} className={styles.flow} data-day-flow>
    <div className={styles.toolbar}>
      <span className={styles.date}><CalendarBlank size={15} />{dayLabel}<small>NY</small></span>
      <div className={styles.connection} data-state={connection}>
        {connection === "checking" ? <CircleNotch className={styles.spinner} size={13} /> : <span className={styles.connectionDot} />}
        <span>{connection === "error" ? labels.offline : labels.auto}</span>
        <button onClick={() => refresh.current()} disabled={connection === "checking"} aria-label={connection === "error" ? labels.retry : `${labels.checked}: ${checked} ${snapshot.tags.primary}`} title={labels.liveNote}><Clock size={14} /><span>{labels.checked}</span>{checked} {snapshot.tags.primary}</button>
      </div>
    </div>

    <div className={styles.rail} aria-label={railLabels.marketHours}>
      <div className={styles.bounds}>
        {[{ minutes: 570, label: railLabels.openShort }, { minutes: snapshot.closeMinutes, label: railLabels.closeShort }].map(({ minutes, label }) => <div key={label} className={styles.bound} style={{ left: `${pct(minutes)}%` }}><span>{label}</span><strong>{primary(minutes)} <small>{snapshot.tags.primary}</small></strong></div>)}
      </div>
      <div className={styles.axis}>
        <div className={styles.track} aria-hidden="true" />
        <div aria-hidden="true" className={styles.sessionBand} data-open={snapshot.tradingDay} style={{ left: `${pct(570)}%`, width: `${pct(snapshot.closeMinutes) - pct(570)}%` }} />
        <motion.div aria-hidden="true" className={styles.elapsed} style={{ transformOrigin: "left" }} animate={{ scaleX: pct(now) / 100 }} transition={{ duration: reduced ? 0 : 1.2, ease: "easeOut" }} />
        {[570, snapshot.closeMinutes].map((minutes) => <span aria-hidden="true" key={minutes} className={styles.boundDot} style={{ left: `${pct(minutes)}%` }} />)}
        {markerTimes.map((time) => {
          const group = events.filter((event) => event.timeEt === time);
          const active = group.findIndex((event) => event.id === selected?.id);
          // Coincident releases share a timestamp, not a destination. Repeated
          // activation advances through every release at that time.
          const target = group[(active + 1) % group.length];
          const released = group.some((event) => event.status !== "scheduled");
          return <button key={time} className={styles.eventDot} data-selected={active >= 0} data-released={released} style={{ left: `${pct(minutesOf(time))}%` }} onClick={() => select(target.id)} aria-pressed={active >= 0} aria-controls={detailId} aria-label={`${labels.selectEvent}: ${timeOf(target)} ${snapshot.tags.primary} · ${target.title}`} title={`${primary(minutesOf(time))} · ${group.map((event) => event.title).join(", ")}`}>
            {group.length > 1 ? <span>{group.length}</span> : group[0].kind === "earnings" ? <Bell size={13} weight="bold" /> : <TrendUp size={13} weight="bold" />}
          </button>;
        })}
        {now >= 240 && now <= 1200 && <div className={styles.now} data-live={snapshot.tradingDay} data-edge={pct(now) < 8 ? "start" : pct(now) > 92 ? "end" : undefined} style={{ left: `${pct(now)}%` }}><span>{railLabels.now}</span><i /></div>}
      </div>
      <div className={styles.axisLabels}><span>{primary(240)}</span><span>{snapshot.tradingDay ? railLabels.marketHours : labels.closed}</span><span>{primary(1200)} {snapshot.tags.primary}</span></div>
    </div>

    {events.length ? <>
      <div className={styles.eventHeading}><h3>{labels.events}<span>{events.length}</span></h3><div><button aria-label={labels.back} disabled={selectedIndex <= 0} onClick={() => events[selectedIndex - 1] && select(events[selectedIndex - 1].id)}><ArrowLeft size={18} /></button><button aria-label={labels.next} disabled={selectedIndex >= events.length - 1} onClick={() => events[selectedIndex + 1] && select(events[selectedIndex + 1].id)}><ArrowRight size={18} /></button></div></div>
      <div className={styles.eventLayout}>
      <div ref={cards} className={styles.eventCards}>
        {events.map((event) => <button key={event.id} data-event-id={event.id} className={styles.eventCard} data-selected={selected?.id === event.id} onClick={() => select(event.id)} aria-pressed={selected?.id === event.id} aria-controls={detailId}>
          <span className={styles.cardTime} data-unknown={!event.timeEt}>{timeOf(event)}{event.timeEt && <small>{snapshot.tags.primary}</small>}</span>
          <span className={styles.cardSummary}>
            <span className={styles.cardKind}>{event.kind === "earnings" ? <Bell size={12} /> : <TrendUp size={12} />}{event.kind === "earnings" ? labels.earnings : labels.economic}<Status event={event} nowMs={nowMs} labels={labels} /></span>
            <strong>{event.title}</strong>
          </span>
          <span className={styles.cardBottom}>{event.actual && <b>{event.actual}</b>}<ArrowRight size={15} /></span>
        </button>)}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {selected && <motion.div key={selected.id} id={detailId} role="region" aria-label={selected.title} className={styles.detail} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? undefined : { opacity: 0, y: -3 }} transition={{ duration: .18 }}>
          <div className={styles.detailHeading}><div><span>{timeOf(selected)} {selected.timeEt && snapshot.tags.primary} · {selected.detail ?? (selected.kind === "earnings" ? labels.earnings : labels.economic)}</span><h4>{selected.title}</h4></div><Status event={selected} nowMs={nowMs} labels={labels} /></div>
          {selected.members ? <div className={styles.members}>{selected.members.map((member) => <div key={member.symbol} className={styles.member}>
            <div className={styles.memberIdentity}><LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size="sm" /><div><strong>{member.symbol}</strong><Status event={{ status: member.status, scheduledAt: selected.scheduledAt }} nowMs={nowMs} labels={labels} /></div></div>
            {(member.revenue || member.eps) && <dl className={styles.memberNumbers}>{member.revenue && <div><dt>{labels.revenue}</dt><dd>{member.revenue}</dd></div>}{member.eps && <div><dt>{labels.eps}</dt><dd>{member.eps}</dd></div>}</dl>}
            <Link href={member.href} className={styles.detailLink} data-analysis={member.status === "analyzed"}>{member.status === "analyzed" ? labels.readAnalysis : labels.viewCompany}<ArrowUpRight size={16} /></Link>
          </div>)}</div> : <>
            <dl className={styles.results}>{[[labels.actual, selected.actual], [labels.forecast, selected.forecast], [labels.previous, selected.previous]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>
            {!selected.actual && <p className={styles.waiting}>{labels.pendingHint}</p>}
          </>}
          <div className={styles.detailFooter}><span>{labels.source}: {selected.source}</span><Link href={selected.href}>{labels.calendar}<ArrowUpRight size={13} /></Link></div>
        </motion.div>}
      </AnimatePresence>
      </div>
    </> : <div className={styles.empty}><span><CalendarBlank size={32} weight="duotone" /></span><div><h3>{labels.emptyTitle}</h3><p>{labels.emptyHint}</p></div></div>}
    {snapshot.sourceDelayed && <p className={styles.sourceDelay}>{labels.sourceDelayed}</p>}
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}

/** Initial data failures recover too; an empty calendar is never fabricated. */
export function DayFlowLoader({ initial, ...props }: Omit<Props, "initial"> & { initial: DayFlowSnapshot | null }) {
  const [loaded, setLoaded] = useState(initial);
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    if (loaded || initial) return;
    let active = true;
    let timer = 0;
    let controller: AbortController | null = null;
    async function check() {
      window.clearTimeout(timer);
      if (document.hidden || controller) return;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20_000);
      try {
        const response = await fetch(`/api/day-flow?locale=${props.locale}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const result = await response.json();
          if (active && result.ok && Array.isArray(result.snapshot?.events) && Number.isFinite(Date.parse(result.snapshot.asOf))) setLoaded(result.snapshot);
        }
      } catch { /* The explicit retry state remains visible. */ }
      finally {
        window.clearTimeout(timeout); controller = null;
        if (active) timer = window.setTimeout(check, 30_000);
      }
    }
    timer = window.setTimeout(check, 0);
    retry.current = () => void check();
    document.addEventListener("visibilitychange", check);
    return () => { active = false; window.clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", check); retry.current = () => {}; };
  }, [initial, loaded, props.locale]);
  const snapshot = initial ?? loaded;
  if (snapshot) return <DayFlow key={props.locale} initial={snapshot} {...props} />;
  return <div className={styles.unavailable} role="status"><CalendarBlank size={25} /><p>{props.labels.offline}</p><button onClick={() => retry.current()}>{props.labels.retry}<ArrowRight size={14} /></button></div>;
}
