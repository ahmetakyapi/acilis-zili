"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { AnalysisReport, analysisDate, type CurrentQuote } from "./AnalysisReport";
import styles from "./Analysis.module.css";

type Entry = { id: string; symbol: string; horizon: "short" | "medium"; locale: Locale; result: SavedAnalysis };
/** Bekleme adımları gerçek iş sırasıyla; süreler ölçülen 20 sn'lik üretimin kabaca dağılımı. */
const STEP_STARTS_MS = [0, 2_500, 5_000, 8_000];
const STEP_TICK_MS = 500;
const LIST_LIMIT = 6;
/** Analizlerim'den gelen bağlantı `?rapor=<id>`: adresten okunur (CLAUDE.md, sığ güncelleme notu). */
const REPORT_PARAM = "rapor";

export function AnalysisPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary["aiAnalysis"] }) {
  const [horizon, setHorizon] = useState<"short" | "medium">("short");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null | undefined>();
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<SavedAnalysis | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [current, setCurrent] = useState<CurrentQuote>(null);
  const [visible, setVisible] = useState(true);
  const requestId = useRef<string | null>(null);
  const locked = useRef(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const url = `/api/ai/analysis?symbol=${encodeURIComponent(symbol)}&locale=${locale}`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(url, { cache: "no-store", signal });
    if (signal?.aborted) return;
    if (response.status === 403) { setVisible(false); setResult(null); setHistory([]); return; }
    if (!response.ok) throw new Error("unavailable");
    const body = await response.json();
    if (signal?.aborted) return;
    setRemaining(body.remaining); setHistory(body.history); setPending(body.inProgress); setCurrent(body.current ?? null);
    return body.history as Entry[];
  }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    const wanted = new URLSearchParams(window.location.search).get(REPORT_PARAM);
    Promise.resolve().then(() => refresh(controller.signal)).then(async list => {
      if (!wanted || !list || controller.signal.aborted) return;
      let entry = list.find(h => h.id === wanted);
      // Başka dilde üretilmiş rapor bu dilin listesinde yok; kimlikle istenir.
      if (!entry) {
        const response = await fetch(`/api/ai/analysis?id=${encodeURIComponent(wanted)}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) entry = (await response.json()).history?.[0];
      }
      if (entry && entry.symbol === symbol && !controller.signal.aborted) {
        setSelected(entry.id); setResult(entry.result); setHorizon(entry.horizon);
        requestAnimationFrame(() => reportRef.current?.scrollIntoView({ block: "start" }));
      }
    }).catch(() => { if (!controller.signal.aborted) setError(t.errors.unavailable); });
    // Gece yarısı ve başka sekmeden yapılan yetki/kota değişikliği ücretli çağrı olmadan yenilenir.
    const update = () => { if (document.visibilityState === "visible") refresh(controller.signal).catch(() => {}); };
    const timer = setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", update); };
  }, [refresh, symbol, t.errors.unavailable]);
  useEffect(() => {
    if (!pending || busy) return;
    const timer = setInterval(() => { refresh().catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [pending, busy, refresh]);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), STEP_TICK_MS);
    return () => { clearInterval(timer); setElapsed(0); };
  }, [busy]);
  async function generate() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/ai/analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, symbol, horizon, locale }),
      });
      const body = await response.json();
      if (response.status === 403 && body.error === "forbidden") { setVisible(false); setResult(null); return; }
      if (!response.ok) {
        requestId.current = null;
        throw new Error(body.error);
      }
      setResult(body.result); setSelected(body.id); requestId.current = null;
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      await refresh().catch(() => { setError(t.errors.unavailable); });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(code === "quota" ? t.errors.quota : code === "busy" ? t.errors.busy : code === "data-unavailable" ? t.errors.data : code === "analysis-failed" ? t.errors.failed : t.errors.connection);
      await refresh().catch(() => {});
    } finally { locked.current = false; setBusy(false); }
  }
  function open(entry: Entry) {
    setSelected(entry.id); setResult(entry.result); setHorizon(entry.horizon);
  }
  if (!visible) return null;
  const step = STEP_STARTS_MS.findLastIndex(start => elapsed >= start);
  return <Panel data-ai-analysis aria-busy={busy}>
    <PanelHeader title={t.title} action={history.length > 0 ? <PanelLink href="/analizlerim">{t.allReports}</PanelLink> : undefined} />
    <div className={styles.body}>
      <p className={styles.hint}>{t.hint}</p>
      <div className={styles.controls}>
        <div className={styles.field} role="radiogroup" aria-label={t.horizon}>
          <span>{t.horizon}</span>
          <div className={styles.segment}>
            {(["short", "medium"] as const).map(value => <button key={value} type="button" role="radio" aria-checked={horizon === value}
              className={styles.segmentItem} disabled={busy || pending}
              onClick={() => { setHorizon(value); requestId.current = null; }}>{value === "short" ? t.short : t.medium}</button>)}
          </div>
        </div>
        <Button onClick={generate} disabled={busy || pending || remaining === undefined || remaining === 0}>{busy ? t.generating : t.generate}</Button>
        <span className={styles.quota}>{t.remaining}<strong>{remaining === undefined ? "…" : remaining === null ? t.unlimited : remaining}</strong></span>
      </div>
      <p className={styles.stamp}>{t.quotaHint}</p>
      {busy && <div className={styles.steps} role="status" aria-live="polite">
        <ol>{t.steps.map((label, i) => <li key={label} data-state={i < step ? "done" : i === step ? "active" : "next"}>
          <span className={styles.stepMark} aria-hidden />{label}
        </li>)}</ol>
        <p className={styles.stamp}>{t.stepsHint}</p>
      </div>}
      {pending && !busy && <p role="status" className={styles.hint}>{t.pending}</p>}
      {error && <p role="alert" className={styles.hint}>{error}</p>}
      {history.length > 0 && <section aria-labelledby="ai-history">
        <h3 id="ai-history" className={styles.sectionTitle}>{t.history}</h3>
        <ul className={styles.history}>
          {history.slice(0, LIST_LIMIT).map(entry => <li key={entry.id}>
            <button type="button" aria-pressed={selected === entry.id} disabled={busy} onClick={() => open(entry)} data-verdict={entry.result.output.verdict}>
              <span className={styles.historyVerdict}>{t.verdicts[entry.result.output.verdict]}</span>
              <span className={styles.historyScore}>{entry.result.output.overallScore}<small>/100</small></span>
              <span className={styles.historyMeta}>{entry.horizon === "short" ? t.short : t.medium} · {analysisDate(entry.result.generatedAt, locale)}</span>
            </button>
          </li>)}
        </ul>
      </section>}
      <div ref={reportRef} className={styles.reportAnchor}>
        {result && <AnalysisReport key={selected} result={result} t={t} locale={locale} current={current} symbol={symbol} />}
      </div>
    </div>
  </Panel>;
}
