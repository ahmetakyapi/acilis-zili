"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { AnalysisReport, analysisDate } from "./AnalysisReport";
import styles from "./Analysis.module.css";

type Entry = { id: string; symbol: string; horizon: "short" | "medium"; locale: Locale; result: SavedAnalysis };
export function AnalysisPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary["aiAnalysis"] }) {
  const [horizon, setHorizon] = useState<"short" | "medium">("short");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null | undefined>();
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<SavedAnalysis | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [visible, setVisible] = useState(true);
  const requestId = useRef<string | null>(null);
  const locked = useRef(false);
  const url = `/api/ai/analysis?symbol=${encodeURIComponent(symbol)}&locale=${locale}`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(url, { cache: "no-store", signal });
    if (signal?.aborted) return;
    if (response.status === 403) { setVisible(false); setResult(null); setHistory([]); return; }
    if (!response.ok) throw new Error("unavailable");
    const body = await response.json();
    if (signal?.aborted) return;
    setRemaining(body.remaining); setHistory(body.history); setPending(body.inProgress);
  }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => refresh(controller.signal)).catch(() => { if (!controller.signal.aborted) setError(t.errors.unavailable); });
    // Gece yarısı ve başka sekmeden yapılan yetki/kota değişikliği ücretli çağrı olmadan yenilenir.
    const update = () => { if (document.visibilityState === "visible") refresh(controller.signal).catch(() => {}); };
    const timer = setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", update); };
  }, [refresh, t.errors.unavailable]);
  useEffect(() => {
    if (!pending || busy) return;
    const timer = setInterval(() => { refresh().catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [pending, busy, refresh]);
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
      await refresh().catch(() => { setError(t.errors.unavailable); });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(code === "quota" ? t.errors.quota : code === "busy" ? t.errors.busy : code === "data-unavailable" ? t.errors.data : code === "analysis-failed" ? t.errors.failed : t.errors.connection);
      await refresh().catch(() => {});
    } finally { locked.current = false; setBusy(false); }
  }
  if (!visible) return null;
  return <Panel data-ai-analysis aria-busy={busy}>
    <PanelHeader title={t.title} />
    <div className={styles.body}>
      <p className={styles.hint}>{t.hint}</p>
      <div className={styles.controls}>
        <label className={styles.field}>{t.horizon}<select value={horizon} onChange={e => {
          setHorizon(e.target.value as "short" | "medium"); requestId.current = null;
        }} disabled={busy || pending} className={styles.select}><option value="short">{t.short}</option><option value="medium">{t.medium}</option></select></label>
        <Button onClick={generate} disabled={busy || pending || remaining === undefined || remaining === 0}>{busy ? t.generating : t.generate}</Button>
        <span className={styles.quota}>{t.remaining}<strong>{remaining === undefined ? "…" : remaining === null ? t.unlimited : remaining}</strong></span>
      </div>
      <p className={styles.stamp}>{t.quotaHint}</p>
      {pending && !busy && <p role="status" className={styles.hint}>{t.pending}</p>}
      {busy && <p role="status" className={styles.hint}>{t.generating}</p>}
      {error && <p role="alert" className={styles.hint}>{error}</p>}
      {history.length > 0 && <label className={styles.field}>{t.history}<select className={styles.select} value={selected} disabled={busy} onChange={e => {
        const entry = history.find(h => h.id === e.target.value);
        setSelected(e.target.value); setResult(entry?.result ?? null);
        if (entry) setHorizon(entry.horizon);
      }}><option value="">{t.choose}</option>{history.map(h => <option value={h.id} key={h.id}>{analysisDate(h.result.generatedAt, locale)} · {h.horizon === "short" ? t.short : t.medium}</option>)}</select></label>}
      {result && <AnalysisReport result={result} t={t} locale={locale} />}
    </div>
  </Panel>;
}
