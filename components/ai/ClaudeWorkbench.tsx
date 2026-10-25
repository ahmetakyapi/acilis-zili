"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary, Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { ButtonLink, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { HORIZON_OF, formatSpan, type AnalysisFocus, type NextReport } from "@/lib/ai-analysis-core";
import { deskState } from "@/lib/ai-analysis-desk";
import { AnalysisFilm, CURTAIN_MS, type FilmBar } from "./AnalysisFilm";
import { FocusOptions, type FocusOption } from "./FocusOptions";
import { KineticText } from "./KineticText";
import { useNow } from "./useNow";
import styles from "./Claude.module.css";

/** Düğme damlaya büzülür, kart boşalır, film başlar (ms). İstek basıldığı an gider; bu yalnız görüntü. */
const LAUNCH_MS = 560;
/** Hak sayısı bu kadar ya da azsa nokta dizisiyle, fazlaysa sayıyla. */
const MAX_PIPS = 12;
const NUMERALS = ["I", "II", "III", "IV"] as const;

export type LatestReport = { href: string; verdict: "buy" | "hold" | "sell" | "insufficient"; score: number | null; when: string };

/** Son 60 kapanıştan kartın arkasındaki silik çizgi (viewBox 0–100 × 0–40). */
function sparkPath(bars: FilmBar[]) {
  if (bars.length < 2) return "";
  const closes = bars.map(b => b.c), lo = Math.min(...closes), hi = Math.max(...closes);
  return closes.map((c, i) => `${i ? "L" : "M"}${((i / (closes.length - 1)) * 100).toFixed(2)} ${(36 - ((c - lo) / (hi - lo || 1)) * 30).toFixed(2)}`).join(" ");
}

/**
 * ANALİZ MASASI (25 Ekim yeniden kuruluşu; sahibinin isteği: "Analizi Başlat
 * butonu kaydırmadan gözükmüyor"). Ölçüm, önce: düğmenin üst kenarı
 * 390×844'te 1.424, 768×1024'te 1.035, 1280×800'de 1.062, 1440×900'de
 * 1.125. pikseldeydi; dört genişlikte de ilk ekranın dışında. Üstünde
 * sırayla başlık, kimlik şeridi, mürekkep çizimli iki odak kartı (telefonda
 * 379 px), sekmeler ve sahnenin İÇİNDE ikinci bir kimlik satırı, dev kinetik
 * soru (4,75 rem'e kadar) ve dört perdelik "Raporun Yolu" vardı.
 *
 * Şimdi kart yalnız karar verdiren şeyi taşır, eylem sırasına göre: soru
 * (h2), iki odak seçeneği (vade · çıktı tek satır), durum satırı (en fazla
 * bir tane, tek cümle + tek eylem), düğme ve hak sayacı yan yana. Program,
 * odak açıklaması ve hak kuralı kartın ALTINDAKİ "Raporun Yolu" panelinde.
 * Telefonda eylem satırı kartın içinde yapışkan (alt sekme çubuğunun
 * üstünde, `env(safe-area-inset-bottom)` ile): kart ekrana girdiği anda
 * düğme de görünür, kart bitince yerine oturur; kartın dışına taşmaz.
 *
 * Önerilen bekleme dolmadıysa (`nextReportAt`) durum satırı söyler, üretim
 * engellenmez: düğmenin adı "Yine de Başlat" olur (sahibinin isteği, 11
 * Ekim). Basınca düğme damlaya büzülür, kart filme dönüşür ve filmin
 * kendi oranına büyür (`fromHeight`); film bitince perde açılır ve rapor
 * sekmesine gidilir (hareketi azaltana beklemeden). Adrese `yeni=1`
 * eklenir: kapak filmin selinden açılır.
 */
export function ClaudeWorkbench({ symbol, name, logoUrl, locale, t, focus, options, remaining, limit, inProgress, next, nextLabel, now: serverNow, edition, latest, historyHref, bars, headlines }: {
  symbol: string; name: string; logoUrl: string | null; locale: Locale; t: Dictionary["aiAnalysis"]; focus: AnalysisFocus;
  /** İki odak seçeneği; adresler sunucuda kurulur (`?odak=`). */
  options: FocusOption[];
  remaining: number | null; limit: number | null; inProgress: boolean;
  next: NextReport | null; nextLabel: string | null; now: string;
  /** Sitenin teknik analizinin sıradaki yayını ("15:45 TR"); yalnız teknik odakta ve kapsamdaki hissede. */
  edition: string | null; latest: LatestReport | null; historyHref: string; bars: FilmBar[]; headlines: string[];
}) {
  const router = useRouter();
  const reduced = useMotionPreference();
  const [launching, setLaunching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ code: string; text: string } | null>(null);
  const requestId = useRef<string | null>(null);
  const launchTimer = useRef(0);
  const stageRef = useRef<HTMLElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  /** Film kartın o anki boyundan kendi oranına büyür: kesme yok, alttaki sayfa zıplamaz. */
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  /** Düğmenin büzüldüğü damlanın karttaki yeri: film o damlayla açılır (kesmesiz geçiş). */
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const goIconRef = useRef<HTMLSpanElement>(null);
  const C = t.claude;
  const L = C.launch;
  const D = C.desk;
  const T = C.timeline;
  const now = useNow(serverNow);
  const early = !!next && new Date(next.at).getTime() > now;
  const span = (ms: number) => formatSpan(ms, T.units);
  /* SÖKÜLÜNCE GEZİNME YOK (20 Ekim). Üretim filmin açık uçlu son perdesi
     boyunca sürüyor ve okuyucu o arada başka sayfaya geçebiliyor; istek
     bitince kurulan perde zamanlayıcısı bileşen gitmiş olsa da
     `router.push` yapıyor ve okuyucuyu okuduğu sayfadan rapora geri
     çekiyordu. İstek KESİLMİYOR: rapor sunucuda yine kaydediliyor, dönen
     okuyucu onu sekmede buluyor (filmin altındaki not bunu söyler). */
  const alive = useRef(true);
  const curtainTimer = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(launchTimer.current);
      clearTimeout(curtainTimer.current);
    };
  }, []);
  // Logo filme ÖNCEDEN hazır: kart açılırken indirilip çözülür, film aynı görüntüyü
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
  // Film başlayınca kart ekranın dışındaysa (okuyucu aşağı kaydırmış) filmi görünüme al;
  // film ekran dışında durduğu için (AnalysisFilm → IntersectionObserver) yoksa hiç oynamazdı.
  useEffect(() => {
    if (busy) filmRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [busy, reduced]);

  async function generate() {
    if (busy || launching) return;
    setLaunching(true); setDone(false); setError(null); setFilmLogo(logoImage);
    // Ölçü iki kez: tıklamada (sonuç çok hızlı gelirse) ve büzülme bitince — damla
    // o zaman düğmenin sol ucuna kaymış olur; film tam oradan açılır.
    const measure = () => {
      setStageHeight(stageRef.current?.offsetHeight ?? null);
      const stageBox = stageRef.current?.getBoundingClientRect(), iconBox = goIconRef.current?.getBoundingClientRect();
      setOrigin(!reduced && stageBox && iconBox ? { x: iconBox.left + iconBox.width / 2 - stageBox.left, y: iconBox.top + iconBox.height / 2 - stageBox.top } : null);
    };
    measure();
    launchTimer.current = window.setTimeout(() => { measure(); setBusy(true); }, reduced ? 0 : LAUNCH_MS);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/ai/analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, symbol, horizon: HORIZON_OF[focus], locale }),
      });
      const body = await response.json().catch(() => ({}));
      if (!alive.current) return;
      if (!response.ok) { requestId.current = null; throw new Error(typeof body.error === "string" ? body.error : ""); }
      requestId.current = null;
      setBusy(true);
      setDone(true);
      const target = withLocale(`/claude/${encodeURIComponent(symbol)}?odak=${focus === "technical" ? "teknik" : "secim"}&sekme=rapor&rapor=${body.id}&yeni=1`, locale);
      // Hareketi azaltana perde yok: "Rapor Hazır" karesi çizilir, rapora hemen geçilir.
      curtainTimer.current = window.setTimeout(() => router.push(target, { scroll: true }), reduced ? 0 : CURTAIN_MS);
    } catch (e) {
      if (!alive.current) return;
      clearTimeout(launchTimer.current);
      const code = e instanceof Error ? e.message : "";
      setError({ code, text: code === "quota" ? t.errors.quota : code === "busy" ? t.errors.busy : code === "data-unavailable" ? t.errors.data : code === "analysis-failed" ? t.errors.failed : t.errors.connection });
      setBusy(false); setLaunching(false);
    }
  }

  if (busy) return <div className={styles.workbench}>
    <div ref={filmRef} className={styles.filmWrap}>
      <AnalysisFilm bars={bars} headlines={headlines} symbol={symbol} name={name} logoUrl={logoUrl} done={done} t={t} locale={locale} fromHeight={stageHeight} origin={origin} logoImage={filmLogo} />
      {/* Ne olduğu filmde (perde adı + canlı künye), ne kadar sürdüğü ve ayrılınca ne olacağı burada. */}
      <p className={styles.filmNote}>{D.filmNote}</p>
    </div>
  </div>;

  const spark = sparkPath(bars);
  const { note: noteKind, label: labelKind, disabled, retry } = deskState({ errorCode: error?.code ?? null, inProgress, remaining, early });
  const pips = remaining !== null && limit !== null && limit > 0 && limit <= MAX_PIPS;

  /* DURUM SATIRI: en fazla bir tane, öncelik sırasıyla; her biri tek cümle + tek eylem.
     Hata > sürüyor > hak bitti > önerilen bekleme. Beklemenin eylemi düğmenin kendisi ("Yine de Başlat"). */
  let note: { tone: "error" | "info" | "warn"; text: string; action?: ReactNode; role: "alert" | "status" | "note" } | null = null;
  if (noteKind === "error" && error) note = {
    tone: "error", text: error.text, role: "alert",
    action: error.code === "quota" ? (latest ? <ButtonLink href={latest.href} variant="ghost" size="sm" scroll={false}>{D.openLatest}</ButtonLink> : undefined)
      : retry ? undefined : <ButtonLink href={historyHref} variant="ghost" size="sm" scroll={false}>{D.checkHistory}</ButtonLink>,
  };
  else if (noteKind === "running") note = { tone: "info", text: t.pending, role: "status", action: <button type="button" className={styles.noteAction} onClick={() => router.refresh()}>{D.refresh}</button> };
  else if (noteKind === "quota") note = { tone: "warn", text: D.quotaOut, role: "status", action: latest ? <ButtonLink href={latest.href} variant="ghost" size="sm" scroll={false}>{D.openLatest}</ButtonLink> : undefined };
  else if (noteKind === "early" && next) note = {
    tone: "warn", role: "note",
    text: next.reason === "market-closed"
      ? D.closed.replace("{time}", nextLabel ?? "")
      : D.early.replace("{ago}", span(now - new Date(next.lastAt).getTime())).replace("{left}", span(new Date(next.at).getTime() - now)),
  };

  const label = labelKind === "retry" ? D.retry : labelKind === "startAnyway" ? L.startAnyway : L.start;

  return <div className={styles.workbench}>
    <section ref={stageRef} className={styles.desk} data-launching={launching ? "" : undefined} aria-labelledby="claude-launch-title" aria-busy={launching || undefined}>
      {/* Kartın arkasında hissenin kendi son 60 kapanışı: filmde kalemin çizeceği çizgi, silik. */}
      {spark && <svg className={styles.stageLine} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        <path d={spark} pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>}

      <div className={styles.deskHead}>
        {/* `data-ink="plain"`: başlıkların varsayılan degradesi `background-clip: text` ile
            çiziliyor ve harfleri ayrı taşınan kutulara (kinetik yazı) uygulanmıyor — başlık
            saydam kalıyordu (1280 ölçümü). */}
        <h2 id="claude-launch-title" className={styles.deskTitle} data-ink="plain"><KineticText key={focus} text={L.title[focus]} delay={80} stagger={22} /></h2>
        {latest && <ButtonLink href={latest.href} variant="ghost" size="sm" scroll={false} className={styles.latest} data-verdict={latest.verdict}>
          {latest.score !== null && <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={26} />}
          <span>{L.latest}</span><b>{t.verdicts[latest.verdict]}</b><small>{latest.when}</small>
        </ButtonLink>}
      </div>

      <FocusOptions items={options} label={t.focus.label} className={styles.deskOptions} />

      {/* Eylem satırı: durum + düğme + hak; telefonda kartın içinde yapışkan (Claude.module.css → .deskAction). */}
      <div className={styles.deskAction}>
        {/* Durum satırı eylem satırının İÇİNDE: telefonda yapışkan satırla birlikte görünür,
            düğmenin neden "Yine de Başlat" dediğini ya da neden kapalı olduğunu söyler.
            Kartın gövdesindeyken yapışkan satırın altında kalıyordu (390×844 ölçümü). */}
        {note && <p className={styles.deskNote} data-tone={note.tone} role={note.role}>
          <span>{note.text}</span>{note.action}
        </p>}
        <button type="button" data-claude-generate className={styles.go} onClick={generate} disabled={disabled || launching} aria-describedby="claude-duration">
          <span className={styles.goLabel}><span>{label}</span></span>
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
        <p id="claude-duration" className={styles.deskDuration}>{L.duration}</p>
      </div>
    </section>

    {/* RAPORUN YOLU: eylemin ALTINDA. Odağın uzun açıklaması, filmin dört perdesi
        (basınca ekranda olacakların künyesi), sıradaki teknik yayın ve hak kuralı. */}
    <Panel>
      <PanelHeader title={D.about} />
      <div className={styles.aboutBody}>
        <p className={styles.aboutHint}>{focus === "technical" ? t.focus.technicalHint : t.focus.selectionHint}</p>
        <ol className={styles.program}>{C.scenes.map((scene, i) => <li key={scene.title}>
          <span className={styles.programNo} aria-hidden>{NUMERALS[i]}</span>
          <span className={styles.programName}>{scene.title}</span>
          <span className={styles.programLine}>{scene.line}</span>
        </li>)}</ol>
        {/* Günde üç teknik yayın (11 Ekim, sahibinin isteği): yeni rapor istemeden önce beklenebilir. */}
        {edition && <p className={styles.ctaEdition} data-stage>
          <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
          <span>{t.cta.editions.split("{time}")[0]}<b className="whitespace-nowrap font-semibold text-strong">{edition}</b>{t.cta.editions.split("{time}")[1]}</span>
        </p>}
        <p className={styles.aboutFoot}>{t.quotaHint}</p>
      </div>
    </Panel>
  </div>;
}
