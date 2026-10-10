"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { HORIZON_OF, type AnalysisFocus } from "@/lib/ai-analysis-core";
import { AnalysisFilm, CURTAIN_MS, type FilmBar } from "./AnalysisFilm";
import styles from "./Claude.module.css";

/**
 * Yeni Analiz sekmesi: odak zaten sayfanın üstünde seçili, burada tek düğme.
 *
 * Bugün bu odakta rapor varsa önce o söylenir ("Bugünkü Raporu Aç") ama
 * üretim engellenmez; düğme tek basışla çalışır, yalnız adı "Yine de…" olur
 * (sahibinin isteği, 11 Ekim). Üretim sürerken film oynar; sonuç gelince
 * perde açılır ve rapor sekmesine gidilir (sunucu raporu veritabanından çizer).
 */
export function ClaudeWorkbench({ symbol, locale, t, focus, canGenerate, signedIn, remaining, inProgress, today, bars, headlines }: {
  symbol: string; locale: Locale; t: Dictionary["aiAnalysis"]; focus: AnalysisFocus;
  canGenerate: boolean; signedIn: boolean; remaining: number | null; inProgress: boolean;
  today: { href: string; time: string } | null; bars: FilmBar[]; headlines: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const C = t.claude;

  async function generate() {
    if (busy) return;
    setBusy(true); setDone(false); setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/ai/analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, symbol, horizon: HORIZON_OF[focus], locale }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { requestId.current = null; throw new Error(typeof body.error === "string" ? body.error : ""); }
      requestId.current = null;
      setDone(true);
      const target = withLocale(`/claude/${encodeURIComponent(symbol)}?odak=${focus === "technical" ? "teknik" : "secim"}&sekme=rapor&rapor=${body.id}`, locale);
      setTimeout(() => router.push(target, { scroll: true }), CURTAIN_MS);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(code === "quota" ? t.errors.quota : code === "busy" ? t.errors.busy : code === "data-unavailable" ? t.errors.data : code === "analysis-failed" ? t.errors.failed : t.errors.connection);
      setBusy(false);
    }
  }

  if (busy) return <AnalysisFilm bars={bars} headlines={headlines} symbol={symbol} done={done} t={t} locale={locale} />;

  return <div className={styles.workbench}>
    <div className={styles.launch}>
      <div>
        <p className="plate">{t.focus.label}</p>
        <h2 className={styles.launchTitle} data-ink="plain">{focus === "technical" ? t.focus.technical : t.focus.selection}</h2>
        <p className={styles.launchHint}>{focus === "technical" ? t.focus.technicalHint : t.focus.selectionHint}</p>
      </div>
      {canGenerate ? <div className={styles.launchAction}>
        <Button data-claude-generate onClick={generate} disabled={inProgress || remaining === 0} className={styles.launchButton}>{today ? C.generateAnyway : t.generate}</Button>
        <span className={styles.quota}>{t.remaining}: <b>{remaining === null ? t.unlimited : remaining}</b></span>
      </div> : <p className={styles.launchHint}>{signedIn ? C.noAccess : C.signIn}</p>}
    </div>
    {canGenerate && today && <div className={styles.today} role="note">
      <div><strong>{C.todayTitle}</strong><p>{C.todayHint.replace("{time}", today.time)}</p></div>
      <ButtonLink href={today.href} variant="ghost" size="sm" scroll={false}>{C.openToday}</ButtonLink>
    </div>}
    {inProgress && <p role="status" className={styles.launchHint}>{t.pending}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <p className="text-small text-muted">{t.quotaHint}</p>
  </div>;
}
