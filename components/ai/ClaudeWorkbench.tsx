"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { ButtonLink, LogoTile } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { HORIZON_OF, formatSpan, type AnalysisFocus, type NextReport } from "@/lib/ai-analysis-core";
import { AnalysisFilm, CURTAIN_MS, type FilmBar } from "./AnalysisFilm";
import { KineticText } from "./KineticText";
import { primeFilmSound, soundPreferred } from "./filmSound";
import { useNow } from "./useNow";
import styles from "./Claude.module.css";

/** Düğme damlaya büzülür, sahne boşalır, film başlar (ms). İstek basıldığı an gider; bu yalnız görüntü. */
const LAUNCH_MS = 560;
/** Hak sayısı bu kadar ya da azsa nokta dizisiyle, fazlaysa sayıyla. */
const MAX_PIPS = 12;

export type LatestReport = { href: string; verdict: "buy" | "hold" | "sell" | "insufficient"; score: number | null; when: string };

/** Son 60 kapanıştan sahnenin arkasındaki silik çizgi (viewBox 0–100 × 0–40). */
function sparkPath(bars: FilmBar[]) {
  if (bars.length < 2) return "";
  const closes = bars.map(b => b.c), lo = Math.min(...closes), hi = Math.max(...closes);
  return closes.map((c, i) => `${i ? "L" : "M"}${((i / (closes.length - 1)) * 100).toFixed(2)} ${(36 - ((c - lo) / (hi - lo || 1)) * 30).toFixed(2)}`).join(" ");
}

/**
 * Yeni Analiz sekmesi: filmle AYNI KUTUDA bir sahne. Düğmeye basınca kutu
 * yerinde kalır, içerik boşalır ve film aynı zeminde başlar — kesme yok.
 *
 * Sahnede: şirketin kimliği, odağın sorusu dev kinetik yazıyla, raporun dört
 * perdesi (filmin perdeleriyle aynı adlar), hak sayacı ve tek birincil eylem.
 * Önerilen bekleme dolmadıysa (`nextReportAt`: teknik 1 sa, seçim 1 gün;
 * piyasa kapalıyken açılış) önce o söylenir ama üretim engellenmez; düğmenin
 * adı "Yine de…" olur (sahibinin isteği, 11 Ekim). Eskiden ölçü "bugün bu
 * odakta rapor var mı"ydı; sabah ve akşam raporu ayırt etmiyordu. Üretim sürerken film oynar;
 * sonuç gelince perde açılır ve rapor sekmesine gidilir (sunucu raporu
 * veritabanından çizer). Adrese `yeni=1` eklenir: kapak filmin selinden açılır.
 */
export function ClaudeWorkbench({ symbol, name, logoUrl, locale, t, focus, canGenerate, signedIn, remaining, limit, inProgress, next, nextLabel, now: serverNow, edition, latest, bars, headlines }: {
  symbol: string; name: string; logoUrl: string | null; locale: Locale; t: Dictionary["aiAnalysis"]; focus: AnalysisFocus;
  canGenerate: boolean; signedIn: boolean; remaining: number | null; limit: number | null; inProgress: boolean;
  next: NextReport | null; nextLabel: string | null; now: string;
  /** Sitenin teknik analizinin sıradaki yayını ("15:45 TR"); yalnız teknik odakta ve kapsamdaki hissede. */
  edition: string | null; latest: LatestReport | null; bars: FilmBar[]; headlines: string[];
}) {
  const router = useRouter();
  const reduced = useMotionPreference();
  const [launching, setLaunching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const launchTimer = useRef(0);
  const stageRef = useRef<HTMLElement>(null);
  /** Film, sahnenin o anki boyunda açılır: kutu yerinde kalsın, alttaki sayfa zıplamasın. */
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  /** Düğmenin büzüldüğü damlanın sahnedeki yeri: film o damlayla açılır (kesmesiz geçiş). */
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const goIconRef = useRef<HTMLSpanElement>(null);
  const C = t.claude;
  const L = C.launch;
  const T = C.timeline;
  const now = useNow(serverNow);
  const early = !!next && new Date(next.at).getTime() > now;
  const span = (ms: number) => formatSpan(ms, T.units);
  useEffect(() => () => clearTimeout(launchTimer.current), []);
  // Logo filme ÖNCEDEN hazır: sahne açılırken indirilip çözülür, film aynı görüntüyü
  // çizer. Yoksa film başladığında logo daha inmemiş oluyor, damga anında harfli karo
  // ("NV") görünüp sonradan logoya dönüyordu.
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!logoUrl) return;
    let live = true;
    const img = Object.assign(new Image(), { decoding: "async" as const, src: logoUrl });
    img.decode().then(() => { if (live) setLogoImage(img); }, () => { /* logo yok: harfli karo */ });
    return () => { live = false; };
  }, [logoUrl]);
  /** Filme verilen logo basıldığı an dondurulur: sonradan çözülürse film baştan başlamasın (film o zaman kendisi bekler). */
  const [filmLogo, setFilmLogo] = useState<HTMLImageElement | null>(null);

  async function generate() {
    if (busy || launching) return;
    setLaunching(true); setDone(false); setError(""); setFilmLogo(logoImage);
    // Ölçü iki kez: tıklamada (sonuç çok hızlı gelirse) ve büzülme bitince — damla
    // o zaman düğmenin sol ucuna kaymış olur; film tam oradan açılır.
    const measure = () => {
      setStageHeight(stageRef.current?.offsetHeight ?? null);
      const stageBox = stageRef.current?.getBoundingClientRect(), iconBox = goIconRef.current?.getBoundingClientRect();
      setOrigin(!reduced && stageBox && iconBox ? { x: iconBox.left + iconBox.width / 2 - stageBox.left, y: iconBox.top + iconBox.height / 2 - stageBox.top } : null);
    };
    measure();
    // Ses tercihi açıksa bağlam BU tıklamanın içinde açılır (tarayıcı sesi ancak kullanıcı hareketiyle başlatır).
    if (soundPreferred()) primeFilmSound();
    launchTimer.current = window.setTimeout(() => { measure(); setBusy(true); }, reduced ? 0 : LAUNCH_MS);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/ai/analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, symbol, horizon: HORIZON_OF[focus], locale }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { requestId.current = null; throw new Error(typeof body.error === "string" ? body.error : ""); }
      requestId.current = null;
      setBusy(true);
      setDone(true);
      const target = withLocale(`/claude/${encodeURIComponent(symbol)}?odak=${focus === "technical" ? "teknik" : "secim"}&sekme=rapor&rapor=${body.id}&yeni=1`, locale);
      setTimeout(() => router.push(target, { scroll: true }), CURTAIN_MS);
    } catch (e) {
      clearTimeout(launchTimer.current);
      const code = e instanceof Error ? e.message : "";
      setError(code === "quota" ? t.errors.quota : code === "busy" ? t.errors.busy : code === "data-unavailable" ? t.errors.data : code === "analysis-failed" ? t.errors.failed : t.errors.connection);
      setBusy(false); setLaunching(false);
    }
  }

  if (busy) return <AnalysisFilm bars={bars} headlines={headlines} symbol={symbol} name={name} logoUrl={logoUrl} done={done} t={t} locale={locale} minHeight={stageHeight} origin={origin} logoImage={filmLogo} />;

  const spark = sparkPath(bars);
  const disabled = inProgress || remaining === 0;
  const pips = remaining !== null && limit !== null && limit > 0 && limit <= MAX_PIPS;
  const scenes = C.scenes;

  return <div className={styles.workbench}>
    <section ref={stageRef} className={styles.stage} data-launching={launching ? "" : undefined} aria-labelledby="claude-launch-title" aria-busy={launching || undefined}>
      {/* Sahnenin arkasında hissenin kendi son 60 kapanışı: filmde kalemin çizeceği çizgi, silik. */}
      {spark && <svg className={styles.stageLine} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        <path d={spark} pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>}

      <div className={styles.stageHead}>
        <LogoTile symbol={symbol} logoUrl={logoUrl} size="lg" className={styles.stageLogo} />
        <div className={styles.stageId}>
          <span className={styles.stageSymbol}>{symbol}</span>
          {name && <span className={styles.stageName}>{name}</span>}
        </div>
        <span className={styles.stageBadge}>{focus === "technical" ? t.focus.technical : t.focus.selection}<b>{focus === "technical" ? t.short : t.medium}</b></span>
      </div>

      <div className={styles.stageBody}>
        {/* `data-ink="plain"`: başlıkların varsayılan degradesi `background-clip: text` ile
            çiziliyor ve harfleri ayrı taşınan kutulara (kinetik yazı) uygulanmıyor — başlık
            saydam kalıyordu (1280 ölçümü). */}
        <h2 id="claude-launch-title" className={styles.stageTitle} data-ink="plain"><KineticText text={L.title[focus]} delay={120} stagger={28} /></h2>
        <p className={styles.stageHint}>{focus === "technical" ? t.focus.technicalHint : t.focus.selectionHint}</p>
      </div>

      {/* Filmin dört perdesi: basınca ekranda olacakların künyesi. */}
      <div className={styles.program}>
        <p className={styles.programTitle}>{L.program}</p>
        <ol>{scenes.map((scene, i) => <li key={scene.title} style={{ "--i": i } as CSSProperties}>
          <span className={styles.programNo} aria-hidden>{["I", "II", "III", "IV"][i]}</span>
          <span className={styles.programName}>{scene.title}</span>
          <span className={styles.programLine}>{scene.line}</span>
        </li>)}</ol>
      </div>

      <div className={styles.stageFoot}>
        {canGenerate ? <>
          <button type="button" data-claude-generate className={styles.go} onClick={generate} disabled={disabled || launching}>
            <span className={styles.goLabel}><span>{early ? L.startAnyway : L.start}</span></span>
            <span ref={goIconRef} className={styles.goIcon} aria-hidden>
              <svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
            </span>
          </button>
          <div className={styles.quota}>
            <span>{t.remaining}</span>
            {pips ? <span className={styles.pips} role="img" aria-label={`${remaining} / ${limit}`}>
              {Array.from({ length: limit! }, (_, i) => <i key={i} data-on={i < remaining! ? "" : undefined} style={{ "--i": i } as CSSProperties} />)}
            </span> : <b className="figure">{remaining === null ? t.unlimited : remaining}</b>}
          </div>
        </> : <p className={styles.stageHint}>{signedIn ? C.noAccess : C.signIn}</p>}
        {latest && <ButtonLink href={latest.href} variant="ghost" size="sm" scroll={false} className={styles.latest} data-verdict={latest.verdict}>
          {latest.score !== null && <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={26} />}
          <span>{L.latest}</span><b>{t.verdicts[latest.verdict]}</b><small>{latest.when}</small>
        </ButtonLink>}
      </div>

      {canGenerate && next && early && <p className={styles.today} role="note">
        {next.reason === "market-closed"
          ? T.closedHint.replace("{time}", nextLabel ?? "")
          : T.waitHint.replace("{ago}", span(now - new Date(next.lastAt).getTime())).replace("{gap}", span(next.gapMinutes * 60_000)).replace("{left}", span(new Date(next.at).getTime() - now))}
      </p>}
      {/* Günde üç teknik yayın (11 Ekim, sahibinin isteği): yeni rapor istemeden önce beklenebilir. */}
      {canGenerate && edition && <p className={styles.ctaEdition} data-stage>
        <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        <span>{t.cta.editions.split("{time}")[0]}<b className="whitespace-nowrap font-semibold text-strong">{edition}</b>{t.cta.editions.split("{time}")[1]}</span>
      </p>}
      {inProgress && <p role="status" className={styles.stageNote}>{t.pending}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section>
    <p className="text-small text-muted">{L.duration} {t.quotaHint}</p>
  </div>;
}
