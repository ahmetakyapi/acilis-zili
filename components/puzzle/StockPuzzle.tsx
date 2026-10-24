"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  LockSimple,
  ShareNetwork,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { Button, ButtonLink, LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatMoneyCompact, formatPercent, formatPercentPlain } from "@/lib/utils";
import { foldForSearch } from "@/lib/search-fold";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { playBellSound, primeBellSound } from "@/components/sound/bell-sound";
import { BELL_RANG_EVENT } from "@/components/today/bell-event";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import type { PuzzleResponse } from "@/app/api/bulmaca/route";
import {
  CAP_BANDS,
  MAX_GUESSES,
  currentStreak,
  dayNumberOf,
  nextPuzzleAt,
  puzzleDayKey,
  recordGame,
  shareText,
  type Clue,
  type ClueKind,
  type PoolOption,
  type PuzzleState,
} from "@/lib/stock-puzzle";
import { progressSnapshot, readProgress, readStats, statsSnapshot, subscribeStorage, writeProgress, writeStats } from "./puzzle-storage";
import { GuessDots } from "./GuessDots";
import styles from "./StockPuzzle.module.css";

/**
 * "Hisseyi Bil" oyunu (24 Ekim).
 *
 * Sunucu her istekte durumu baştan kurar (`/api/bulmaca`); bu bileşen
 * yalnızca tahmin listesini tutar, gönderir ve dönen durumu çizer. Cevabı
 * bilmez — bitmiş bulmacada yanıtla gelir.
 *
 * EKRAN DÜZENİ (CLAUDE.md sırası): başlık sayfada; burada sol kolonda ana
 * görsel (siluet) ve ipucu ızgarası, sağ kolonda tahminler, bitince sonuç
 * ve seri. Telefonda tek kolon: tahmin kutusu, ipuçları, seri (gerekçe
 * StockPuzzle.module.css → telefon sırası).
 *
 * DOĞRU TAHMİNDE ZİL (25 Ekim): sitenin imza anı. Sayfada ikinci bir zil
 * bileşeni yok; sonuç kartı kahraman zilinin `heroTap` sahnesini bir kez
 * oynatıyor (InkCanvas, hareketi azaltana son kare), `BELL_RANG_EVENT`
 * yayılıyor ve zil sesi ayarı açıksa ses geliyor. Ses bağlamı tıklamanın
 * İÇİNDE hazırlanıyor (`primeBellSound`, tercihe bakar): yanıt ağdan
 * döndüğünde artık bir kullanıcı hareketinin içinde değiliz ve tarayıcı
 * yeni bağlam açtırmıyor. Geri yüklenen (önceden kazanılmış) bulmaca
 * çalmaz; zil yalnız o anki doğru tahmine.
 */

const MAX_OPTIONS = 8;

type Props = {
  initial: PuzzleState;
  options: PoolOption[];
  labels: StockPuzzleLabels;
  locale: Locale;
  /** Paylaşım metnindeki bağlantı — sayfanın mutlak adresi. */
  shareUrl: string;
};

type Failure = Extract<PuzzleResponse, { ok: false }>["error"] | "network";

async function ask(day: string, guesses: string[]): Promise<PuzzleResponse | { ok: false; error: "network" }> {
  try {
    const response = await fetch("/api/bulmaca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, guesses }),
    });
    return (await response.json()) as PuzzleResponse;
  } catch {
    return { ok: false, error: "network" };
  }
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/* Bant sınırları yuvarlak sayılar: "75,0 Mr $" değil "75 Mr $". */
const capText = (value: number, locale: Locale) => formatMoneyCompact(value, locale).replace(/[.,]0+(?!\d)/, "");

function capBandText(band: number, locale: Locale, labels: StockPuzzleLabels): string {
  const lower = CAP_BANDS[band];
  const upper = CAP_BANDS[band + 1];
  if (band === 0 && upper !== undefined) return fill(labels.capBelow, { v: capText(upper, locale) });
  if (upper === undefined) return fill(labels.capAbove, { v: capText(lower, locale) });
  return `${capText(lower, locale)} - ${capText(upper, locale)}`;
}

function clueValue(clue: Clue, locale: Locale, labels: StockPuzzleLabels): string {
  switch (clue.kind) {
    case "silhouette":
      return labels.silhouetteNote;
    case "sector":
      return clue.sector;
    case "capBand":
      return capBandText(clue.band, locale, labels);
    case "ipoYear":
      return String(clue.year);
    case "revenueGrowth":
      return formatPercent(clue.pct, locale, 1);
    case "initial":
      return clue.letter;
  }
}

/** Eksensiz siluet — kulvar üstünde ince çizgi (sitenin grafik dili). */
function Silhouette({ points, label }: { points: number[]; label: string }) {
  const width = 100;
  const height = 32;
  const pad = 2;
  const path = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = pad + (1 - value) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className={styles.silhouette} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} className={styles.lane} vectorEffect="non-scaling-stroke" />
      <path d={path} className={styles.line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function useNow(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [active]);
  return active ? now : null;
}

function countdownText(left: number, labels: StockPuzzleLabels): string {
  const total = Math.floor(Math.max(0, left) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return fill(labels.countdown, {
    h: pad(Math.floor(total / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  });
}

const subscribeNothing = () => () => undefined;

/** Durumu tarayıcıya yazar; bitmiş bulmaca seriye işlenir (aynı gün iki
    kez sayılmaz, `recordGame`). */
function persist(next: PuzzleState) {
  writeProgress({ day: next.day, guesses: next.guesses.map((row) => row.symbol), status: next.status });
  if (next.status !== "playing") {
    writeStats(recordGame(readStats(), dayNumberOf(next.day), next.status === "won", next.guesses.length));
  }
}

export function StockPuzzle({ initial, options, labels, locale, shareUrl }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PuzzleState>(initial);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [announce, setAnnounce] = useState("");
  const [restoreDone, setRestoreDone] = useState(false);
  const [shareNote, setShareNote] = useState<"copied" | "failed" | null>(null);
  /* Bu oturumda yeni açılan ipuçları — giriş hareketi yalnız onlara. */
  const [fresh, setFresh] = useState<ReadonlySet<ClueKind>>(() => new Set());
  /* Bu oturumda, bu tıklamayla kazanıldı mı — zil yalnız o zaman çalar. */
  const [rang, setRang] = useState(false);

  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const progressRaw = useSyncExternalStore(subscribeStorage, progressSnapshot, () => null);
  const statsValue = useSyncExternalStore(subscribeStorage, statsSnapshot, () => null);

  const savedGuesses = useMemo(() => {
    if (!progressRaw) return [];
    return progressRaw.day === initial.day ? progressRaw.guesses : [];
  }, [progressRaw, initial.day]);

  const restoring = hydrated && !restoreDone && savedGuesses.length > 0 && state.guesses.length === 0;
  const finished = state.status !== "playing";
  const guessed = useMemo(() => new Set(state.guesses.map((row) => row.symbol)), [state.guesses]);

  /* Sunucunun döndürdüğü yeni durumu çizer ve ekran okuyucuya ne
     değiştiğini söyler (tahminin sonucu, açılan ipucu). */
  const apply = (next: PuzzleState, previous: PuzzleState) => {
    setState(next);
    persist(next);
    if (next.status === "won" && previous.status === "playing") {
      setRang(true);
      window.dispatchEvent(new CustomEvent(BELL_RANG_EVENT));
      playBellSound({ gesture: false });
    }
    const before = new Set(previous.clues.map((clue) => clue.kind));
    const opened = next.clues.filter((clue) => !before.has(clue.kind));
    setFresh(new Set(opened.map((clue) => clue.kind)));
    const last = next.guesses[next.guesses.length - 1];
    const parts: string[] = [];
    if (last) {
      if (next.status === "won") parts.push(fill(labels.announceRight, { symbol: last.symbol }));
      else parts.push(fill(labels.announceWrong, { symbol: last.symbol }));
      if (next.status === "lost" && next.answer) parts.push(fill(labels.announceLost, { symbol: next.answer.symbol }));
    }
    if (next.status === "playing") {
      for (const clue of opened) {
        parts.push(fill(labels.announceClue, { label: labels.clue[clue.kind], value: clueValue(clue, locale, labels) }));
      }
    }
    setAnnounce(parts.join(" "));
  };

  /* GERİ YÜKLEME: bu tarayıcıda bugünün tahminleri varsa sunucuya bir kez
     sorulur. Sonuç gelene kadar kutu kapalı (`restoring`) — aynı anda
     yazılan yeni tahmin eski listeyi ezmesin. Havuz değişip kayıttaki bir
     sembol artık tanınmıyorsa kayıt silinir, okur baştan oynar. */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;
    const saved = readProgress(initial.day);
    if (!saved || saved.guesses.length === 0) return;
    void ask(initial.day, saved.guesses).then((result) => {
      setRestoreDone(true);
      if (result.ok) {
        setState(result.state);
        persist(result.state);
      } else if (result.error === "day") {
        router.refresh();
      } else if (result.error === "unknown-symbol" || result.error === "duplicate" || result.error === "too-many") {
        writeProgress({ day: initial.day, guesses: [], status: "playing" });
      } else {
        setFailure(result.error);
      }
    });
  }, [hydrated, initial.day, router]);

  /* Sonuç `true` ise tahmin işlendi ve kutu boşalabilir. Ağ ya da oran
     hatasında `false`: seçim kutuda KALIR, okur aynı tahmini tek dokunuşla
     yeniden gönderir (eskiden kutu yanıt gelmeden boşalıyordu ve hatada
     seçim kayboluyordu). */
  const submit = async (symbol: string): Promise<boolean> => {
    if (pending || finished || guessed.has(symbol)) return false;
    /* Tıklamanın içindeyken: ayar açıksa ses bağlamını hazırla. */
    primeBellSound();
    setPending(true);
    setFailure(null);
    const guesses = [...state.guesses.map((row) => row.symbol), symbol];
    const result = await ask(state.day, guesses);
    setPending(false);
    if (result.ok) {
      apply(result.state, state);
      return true;
    }
    setFailure(result.error);
    if (result.error === "day") router.refresh();
    return false;
  };

  const share = async () => {
    const text = shareText({ title: labels.shareTitle, number: state.number, feedback: state.guesses, url: shareUrl });
    setShareNote(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNote("copied");
    } catch {
      setShareNote("failed");
    }
  };

  const stats = statsValue;
  const today = dayNumberOf(state.day);
  const failureText =
    failure === "rate-limited"
      ? labels.errorRate
      : failure === "day"
        ? labels.errorDay
        : failure === "unavailable"
          ? labels.unavailable
          : failure
            ? labels.errorNetwork
            : null;

  const clueByKind = new Map(state.clues.map((clue) => [clue.kind, clue]));
  const silhouette = clueByKind.get("silhouette");
  const tiles = state.clues.filter((clue) => clue.kind !== "silhouette");
  const silhouetteKnown = Boolean(silhouette) || state.upcoming.includes("silhouette");

  /* SERİ PANELİ KOLON DEĞİŞTİRİR (24 Ekim, 1280'de ölçüldü). Seri hep
     sağdayken bitmiş bulmacada sağ kolon 1160, sol 640 piksel kalıyor ve
     ipuçlarının altında 500 piksellik boşluk açılıyordu (sağa sonuç kartı
     da geliyor). Şimdi oynanırken seri sağda (sol 624 / sağ 606), bitince
     sola, ipuçlarının altına iniyor (sol 988 / sağ 770). Telefonda
     kolonlar yok (`display: contents`), sıra `order` ile: sonuç, tahminler,
     ipuçları, seri (25 Ekim; gerekçe StockPuzzle.module.css). */
  const recordPanel = (
    <Panel className={styles.record}>
      <PanelHeader title={labels.statsTitle} />
      <div className="px-4 pb-5 sm:px-5">
        {stats && stats.played > 0 ? (
          <>
            <dl className={styles.stats}>
              <div>
                <dt>{labels.played}</dt>
                <dd className="numeral">{stats.played}</dd>
              </div>
              <div>
                <dt>{labels.winRate}</dt>
                <dd className="numeral">{formatPercentPlain((stats.wins / stats.played) * 100, locale, 0)}</dd>
              </div>
              <div>
                <dt>{labels.streak}</dt>
                <dd className="numeral">{currentStreak(stats, today)}</dd>
              </div>
              <div>
                <dt>{labels.best}</dt>
                <dd className="numeral">{stats.best}</dd>
              </div>
            </dl>
            <h3 className={styles.distHead}>{labels.distribution}</h3>
            <ol className={styles.dist}>
              {stats.distribution.map((count, i) => {
                const max = Math.max(1, ...stats.distribution);
                return (
                  <li key={i}>
                    <span className={styles.distKey}>{i + 1}</span>
                    <span className={styles.distLane}>
                      <span className={styles.distBar} style={{ width: `${(count / max) * 100}%` }} />
                    </span>
                    <span className={cn(styles.distValue, "numeral")}>{count}</span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p className={styles.note}>{labels.statsEmpty}</p>
        )}
        <p className={styles.note}>{labels.statsNote}</p>
      </div>
    </Panel>
  );

  return (
    <div className={styles.board}>
      <p aria-live="polite" className="sr-only">{announce}</p>

      {/* ---- İpuçları: ana görsel (siluet) + ölçü ızgarası ---- */}
      <div className={styles.main}>
      <Panel className={styles.clues}>
        <PanelHeader title={labels.cluesTitle} />
        <div className="px-4 pb-5 sm:px-5">
          {silhouette?.kind === "silhouette" ? (
            <figure className={cn(styles.figure, fresh.has("silhouette") && styles.fresh)}>
              <figcaption className={styles.tileLabel}>{labels.clue.silhouette}</figcaption>
              <Silhouette points={silhouette.points} label={`${labels.clue.silhouette}. ${labels.silhouetteNote}`} />
              <p className={styles.note}>{labels.silhouetteNote}</p>
            </figure>
          ) : !silhouetteKnown ? (
            <p className={styles.note}>{labels.silhouetteMissing}</p>
          ) : null}

          <ul className={styles.tiles}>
            {tiles.map((clue) => (
              <li key={clue.kind} className={cn(styles.tile, fresh.has(clue.kind) && styles.fresh)}>
                <span className={styles.tileLabel}>{labels.clue[clue.kind]}</span>
                <span className={cn(styles.tileValue, clue.kind === "initial" && styles.initial)}>
                  {clueValue(clue, locale, labels)}
                </span>
                {clue.kind === "revenueGrowth" && <span className={styles.tileNote}>{labels.revenueGrowthNote}</span>}
              </li>
            ))}
            {state.upcoming
              .filter((kind) => kind !== "silhouette")
              .map((kind, index) => (
                <li key={kind} className={cn(styles.tile, styles.locked)}>
                  <span className={styles.tileLabel}>{labels.clue[kind]}</span>
                  <span className={styles.lockLine}>
                    <LockSimple aria-hidden size={14} weight="bold" />
                    {index === 0 ? labels.locked : fill(labels.lockedLater, { n: index + 1 })}
                  </span>
                </li>
              ))}
          </ul>
          <p className={cn(styles.note, styles.pool)}>{labels.poolNote}</p>
        </div>
      </Panel>
      {finished && recordPanel}
      </div>

      <div className={styles.side}>
        {/* ---- Sonuç: yalnız bitmiş bulmacada ---- */}
        {finished && state.answer && (
          <Panel className={styles.result}>
            <PanelHeader title={state.status === "won" ? labels.wonTitle : labels.lostTitle} />
            <div className="px-4 pb-5 sm:px-5">
              {rang && (
                /* Kahraman zilinin vuruşu, bir kez (gerekçe dosya başında). */
                <InkCanvas scene="heroTap" seed={13} className={styles.bell} />
              )}
              <p className={styles.resultLine}>
                {state.status === "won" ? fill(labels.wonLine, { n: state.guesses.length }) : labels.lostLine}
              </p>
              <div className={styles.answer}>
                <LogoTile symbol={state.answer.symbol} logoUrl={state.answer.logoUrl} size="lg" />
                <div className="min-w-0">
                  <p className={styles.answerName}>{state.answer.name}</p>
                  <p className={styles.answerSymbol}>{state.answer.symbol}</p>
                </div>
              </div>
              {state.answer.blurb && <p className={styles.blurb}>{state.answer.blurb}</p>}
              <div className={styles.actions}>
                <ButtonLink href={`/hisse/${state.answer.symbol}`} variant="primary" prefetch={false}>
                  {labels.openStock}
                  <ArrowRight aria-hidden size={15} weight="bold" />
                </ButtonLink>
                <Button type="button" variant="ghost" onClick={share}>
                  <ShareNetwork aria-hidden size={16} weight="bold" />
                  {labels.share}
                </Button>
              </div>
              <p role="status" className={styles.shareNote}>
                {shareNote === "copied" ? labels.copied : shareNote === "failed" ? labels.shareFailed : ""}
              </p>
              {shareNote === "failed" && (
                <pre className={styles.sharePreview}>
                  {shareText({ title: labels.shareTitle, number: state.number, feedback: state.guesses, url: shareUrl })}
                </pre>
              )}
              <NextPuzzle labels={labels} day={state.day} />
            </div>
          </Panel>
        )}

        {/* ---- Tahminler ---- */}
        <Panel className={styles.guesses} aria-busy={restoring || pending}>
          <PanelHeader
            title={labels.guessesTitle}
            meta={
              <span className={styles.progress}>
                <GuessDots
                  results={state.guesses.map((row) => row.correct)}
                  label={fill(labels.guessCount, { n: state.guesses.length })}
                />
                <span aria-hidden className="numeral">{fill(labels.guessCount, { n: state.guesses.length })}</span>
              </span>
            }
          />
          <div className="px-4 pb-5 sm:px-5">
            {!finished && (
              <GuessBox
                options={options}
                guessed={guessed}
                labels={labels}
                locale={locale}
                disabled={!hydrated || restoring || pending}
                pending={pending}
                onGuess={submit}
              />
            )}
            {failureText && <p role="alert" className={styles.error}>{failureText}</p>}
            <ol className={styles.rows}>
              {Array.from({ length: MAX_GUESSES }, (_, i) => {
                const row = state.guesses[i];
                if (!row) {
                  return (
                    <li key={`bos-${i}`} className={cn(styles.row, styles.emptyRow)}>
                      <span className={styles.slot}>{fill(labels.emptySlot, { n: i + 1 })}</span>
                    </li>
                  );
                }
                return (
                  <li key={row.symbol} className={cn(styles.row, row.correct && styles.correctRow)}>
                    <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                    <span className={styles.rowName}>
                      <span className={styles.rowSymbol}>{row.symbol}</span>
                      <span className={styles.rowCompany}>{row.name}</span>
                    </span>
                    {row.correct ? (
                      <span className={styles.verdict}>
                        <span className={styles.correctMark} aria-hidden><Check size={14} weight="bold" /></span>
                        {labels.correct}
                      </span>
                    ) : (
                      <span className={styles.feedback}>
                        {row.sameSector !== null && (
                          <span className={cn(styles.chip, row.sameSector && styles.chipMatch)}>
                            {row.sameSector ? <Check aria-hidden size={12} weight="bold" /> : <X aria-hidden size={12} weight="bold" />}
                            {row.sameSector ? labels.sameSector : labels.otherSector}
                          </span>
                        )}
                        {row.cap === "up" || row.cap === "down" ? (
                          <span className={styles.chip} title={row.cap === "up" ? labels.capUpLong : labels.capDownLong}>
                            {row.cap === "up" ? <ArrowUp aria-hidden size={12} weight="bold" /> : <ArrowDown aria-hidden size={12} weight="bold" />}
                            <span aria-hidden>{row.cap === "up" ? labels.capUp : labels.capDown}</span>
                            <span className="sr-only">{row.cap === "up" ? labels.capUpLong : labels.capDownLong}</span>
                          </span>
                        ) : null}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </Panel>

        {!finished && recordPanel}
      </div>
    </div>
  );
}

/**
 * Sonraki bulmacaya geri sayım. Hedef ŞİMDİDEN değil BULMACANIN GÜNÜNDEN
 * (o günün TR gece yarısı): şimdiden hesaplanınca gece yarısı geçtiğinde
 * hedef ertesi geceye kayıyor, sayaç bitmiş eski bulmacanın üstünde 24
 * saatten yeniden başlıyordu. Sıfıra varınca (ya da sekme gece yarısını
 * uykuda geçip döndüğünde) sayfa bir kez tazelenir; sunucu yeni günü basar
 * ve oyun `key={day}` ile baştan kurulur (`app/(app)/bulmaca/page.tsx`).
 */
function NextPuzzle({ labels, day }: { labels: StockPuzzleLabels; day: string }) {
  const router = useRouter();
  const now = useNow(true);
  const target = useMemo(() => nextPuzzleAt(Date.parse(`${day}T12:00:00Z`)).getTime(), [day]);
  const over = now !== null && (now >= target || puzzleDayKey(new Date(now)) !== day);
  const refreshed = useRef(false);
  useEffect(() => {
    if (!over || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [over, router]);
  return (
    <p className={styles.next}>
      <span>{labels.next}</span>
      <span className={cn(styles.nextTime, "numeral")}>{now === null ? "" : countdownText(target - now, labels)}</span>
    </p>
  );
}

/**
 * Tahmin kutusu — ⌘K paletinin arama kuralı (Türkçe katlama
 * `foldForSearch`, takma adlar `db/seed/aliases.ts`) bu bulmacanın havuzu
 * üzerinde, tarayıcıda. Uç sorulmuyor: havuz 200 şirket ve sayfayla geldi.
 * Seçmek göndermek değil: listeden seçilen şirket kutuya oturur, "Tahmin
 * Et" ya da ikinci Enter gönderir; yanlışlıkla bir hak yanmasın.
 */
function GuessBox({
  options,
  guessed,
  labels,
  locale,
  disabled,
  pending,
  onGuess,
}: {
  options: PoolOption[];
  guessed: ReadonlySet<string>;
  labels: StockPuzzleLabels;
  locale: Locale;
  disabled: boolean;
  pending: boolean;
  onGuess: (symbol: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<PoolOption | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const needle = foldForSearch(query, locale);
    if (!needle || picked) return [];
    const scored: { option: PoolOption; score: number }[] = [];
    for (const option of options) {
      if (guessed.has(option.symbol)) continue;
      const symbol = option.symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
      const tokens = option.haystack.split(" ");
      const score =
        symbol === needle ? 0
          : symbol.startsWith(needle) ? 1
            : tokens.some((token) => token.startsWith(needle)) ? 2
              : option.haystack.includes(needle) ? 3
                : -1;
      if (score >= 0) scored.push({ option, score });
    }
    return scored
      .sort((a, b) => a.score - b.score || a.option.symbol.localeCompare(b.option.symbol))
      .slice(0, MAX_OPTIONS)
      .map((item) => item.option);
  }, [query, options, guessed, locale, picked]);

  const choose = (option: PoolOption) => {
    setPicked(option);
    setQuery(`${option.name} (${option.symbol})`);
    setOpen(false);
    setHint(null);
    inputRef.current?.focus();
  };

  const send = () => {
    if (disabled) return;
    let target = picked;
    if (!target && matches.length === 1) target = matches[0];
    if (!target) {
      setHint(query.trim() && matches.length === 0 ? labels.noMatch : labels.pickFirst);
      return;
    }
    if (guessed.has(target.symbol)) {
      setHint(labels.alreadyGuessed);
      return;
    }
    setHint(null);
    const sent = target;
    const sentQuery = query;
    void onGuess(sent.symbol).then((accepted) => {
      /* Kutu YANIT GELİNCE boşalır, yalnız tahmin işlendiyse. Arada okur
         başka bir şey yazdıysa ona dokunulmaz. */
      if (!accepted) return;
      setPicked((current) => (current?.symbol === sent.symbol ? null : current));
      setQuery((current) => (current === sentQuery ? "" : current));
    });
  };

  const listOpen = open && matches.length > 0;
  const activeId = listOpen ? `bulmaca-secenek-${matches[Math.min(active, matches.length - 1)]?.symbol}` : undefined;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor="bulmaca-tahmin" className="sr-only">{labels.inputLabel}</label>
      <div className={styles.combo}>
        <input
          ref={inputRef}
          id="bulmaca-tahmin"
          type="text"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls="bulmaca-secenekler"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={labels.placeholder}
          value={query}
          disabled={disabled && !pending}
          className={styles.input}
          onChange={(event) => {
            setQuery(event.target.value);
            setPicked(null);
            setOpen(true);
            setActive(0);
            setHint(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && matches.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActive((value) => (value + 1) % matches.length);
            } else if (event.key === "ArrowUp" && matches.length > 0) {
              event.preventDefault();
              setOpen(true);
              setActive((value) => (value - 1 + matches.length) % matches.length);
            } else if (event.key === "Enter" && listOpen) {
              event.preventDefault();
              choose(matches[Math.min(active, matches.length - 1)]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <ul id="bulmaca-secenekler" role="listbox" aria-label={labels.inputLabel} hidden={!listOpen} className={styles.listbox}>
          {matches.map((option, index) => (
            <li
              key={option.symbol}
              id={`bulmaca-secenek-${option.symbol}`}
              role="option"
              aria-selected={index === active}
              className={cn(styles.option, index === active && styles.optionActive)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <LogoTile symbol={option.symbol} logoUrl={option.logoUrl} size="sm" />
              <span className={styles.optionSymbol}>{option.symbol}</span>
              <span className={styles.optionName}>{option.name}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button type="submit" size="lg" disabled={disabled} className={styles.submit}>
        {pending ? labels.pending : labels.submit}
      </Button>
      {/* Canlı bölge HEP yerinde: sonradan eklenen bir `aria-live` öğesinin
          ilk içeriği ekran okuyucuda duyurulmuyor. Boşken yer kaplamıyor. */}
      <p aria-live="polite" className={styles.hint}>{hint ?? ""}</p>
    </form>
  );
}
