"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Cards, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { playBellSound, primeBellSound } from "@/components/sound/bell-sound";
import { BELL_RANG_EVENT } from "@/components/today/bell-event";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import type { PuzzleResponse } from "@/app/api/bulmaca/route";
import {
  AXIS_AFTER_MISSES,
  JOKER,
  dayNumberOf,
  isClose,
  isJoker,
  isPureWin,
  jokerAllowed,
  recordArchiveGame,
  recordGame,
  type ClueKind,
  type PoolOption,
  type PuzzleState,
} from "@/lib/stock-puzzle";
import {
  historySnapshot,
  progressSnapshot,
  readHistory,
  readStats,
  statsSnapshot,
  subscribeStorage,
  writeArchiveCookie,
  writeHistoryEntry,
  writeProgress,
  writeStats,
} from "./puzzle-storage";
import { ClueBoard } from "./ClueBoard";
import { GuessBox } from "./GuessBox";
import { GuessDots } from "./GuessDots";
import { GuessList } from "./GuessList";
import { PuzzleChart } from "./PuzzleChart";
import { PuzzleCover } from "./PuzzleCover";
import { PuzzleRecord } from "./PuzzleRecord";
import { clueValue, fill } from "./puzzle-format";
import styles from "./StockPuzzle.module.css";

/**
 * "Hisseyi Bil" oyunu (24 Ekim; 25 Ekim'de oyun gibi yeniden kuruldu).
 *
 * Sunucu her istekte durumu baştan kurar (`/api/bulmaca`); bu bileşen
 * yalnızca tahmin listesini tutar, gönderir ve dönen durumu çizer. Cevabı
 * bilmez — bitmiş bulmacada yanıtla gelir. Karşılaştırma karoları da
 * sunucuda hesaplanır (`compareGuess`); istemciye yalnız sınıf ve yön iner.
 *
 * EKRAN DÜZENİ (CLAUDE.md sırası): başlık sayfada; sol kolonda ANA GÖRSEL
 * (oynanırken siluet paneli, bitince onun yerine kapak kartı) ve ipucu
 * yolu; sağ kolonda tahminler ve seri. Telefonda tek kolon, sıra `order`
 * ile: ana görsel, tahminler, ipuçları, seri — siluet ve tahmin kutusu
 * ilk ekranda (390×844'te ölçüldü, StockPuzzle.module.css).
 *
 * DOĞRU TAHMİNDE ZİL (25 Ekim): sitenin imza anı. Sayfada ikinci bir zil
 * bileşeni yok; kapak kartı kahraman zilinin `heroTap` sahnesini bir kez
 * oynatıyor (InkCanvas, hareketi azaltana son kare), `BELL_RANG_EVENT`
 * yayılıyor ve zil sesi ayarı açıksa ses geliyor. Ses bağlamı tıklamanın
 * İÇİNDE hazırlanıyor (`primeBellSound`, tercihe bakar): yanıt ağdan
 * döndüğünde artık bir kullanıcı hareketinin içinde değiliz ve tarayıcı
 * yeni bağlam açtırmıyor. Geri yüklenen (önceden kazanılmış) bulmaca
 * çalmaz; zil yalnız o anki doğru tahmine.
 */

type Props = {
  initial: PuzzleState;
  options: PoolOption[];
  labels: StockPuzzleLabels;
  locale: Locale;
  /** Paylaşım metnindeki bağlantı — sayfanın mutlak adresi. */
  shareUrl: string;
  /** Arşivden oynanan geçmiş gün: seriye sayılmaz, geri sayım yok. */
  archive?: boolean;
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

const subscribeNothing = () => () => undefined;

/**
 * Durumu tarayıcıya yazar. Günlük bulmaca ilerleme kaydına ve seriye
 * (aynı gün iki kez sayılmaz, `recordGame`); arşiv oyunu yalnız geçmişe ve
 * "Arşivden Çözülen" sayacına (gün geçmişte zaten bitmişse sayılmaz). İkisi
 * de gün başına geçmişe (arşiv ızgarasının rozetleri).
 */
function persist(next: PuzzleState, archive: boolean) {
  const guesses = next.guesses.map((row) => row.symbol);
  const finished = next.status !== "playing";
  const won = next.status === "won";
  const pure = isPureWin(next.guesses);
  const before = readHistory()[next.day];
  writeHistoryEntry(next.day, {
    guesses,
    status: next.status,
    answer: next.answer ? { symbol: next.answer.symbol, logoUrl: next.answer.logoUrl } : null,
  });
  if (archive) {
    writeArchiveCookie(next.day, guesses);
    if (finished && (!before || before.status === "playing")) writeStats(recordArchiveGame(readStats(), won, pure));
    return;
  }
  writeProgress({ day: next.day, guesses, status: next.status });
  if (finished) writeStats(recordGame(readStats(), dayNumberOf(next.day), won, next.guesses.length, pure));
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item, i) => item === b[i]);

export function StockPuzzle({ initial, options, labels, locale, shareUrl, archive = false }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PuzzleState>(initial);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [announce, setAnnounce] = useState("");
  const [restoreDone, setRestoreDone] = useState(false);
  /* Bu oturumda yeni açılan ipuçları ve az önce gönderilen tahmin — giriş
     hareketi yalnız onlara; geri yüklenen durum durağan. */
  const [fresh, setFresh] = useState<ReadonlySet<ClueKind>>(() => new Set());
  const [freshSymbol, setFreshSymbol] = useState<string | null>(null);
  /* Bu oturumda, bu tıklamayla kazanıldı mı — zil yalnız o zaman çalar. */
  const [rang, setRang] = useState(false);

  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const progressRaw = useSyncExternalStore(subscribeStorage, progressSnapshot, () => null);
  const statsValue = useSyncExternalStore(subscribeStorage, statsSnapshot, () => null);
  const history = useSyncExternalStore(subscribeStorage, historySnapshot, () => null);

  /* Kayıttaki liste: günlükte ilerleme kaydı, arşivde günün geçmiş kaydı. */
  const savedGuesses = useMemo(() => {
    if (archive) return history?.[initial.day]?.guesses ?? [];
    if (!progressRaw) return [];
    return progressRaw.day === initial.day ? progressRaw.guesses : [];
  }, [archive, history, progressRaw, initial.day]);
  const initialSymbols = useMemo(() => initial.guesses.map((row) => row.symbol), [initial.guesses]);

  /* Sunucu ilerleme çerezinden durumu zaten bastıysa (`PROGRESS_COOKIE`)
     geri yükleme yok; depodaki liste farklıysa (çerez kapalı, başka sekme)
     eski yol: sunucuya bir kez sorulur. */
  const needsRestore = savedGuesses.length > 0 && !sameList(savedGuesses, initialSymbols);
  const restoring = hydrated && !restoreDone && needsRestore && state.guesses.length === initial.guesses.length;
  const finished = state.status !== "playing";
  const guessed = useMemo(() => new Set(state.guesses.map((row) => row.symbol)), [state.guesses]);

  /* Sunucunun döndürdüğü yeni durumu çizer ve ekran okuyucuya ne
     değiştiğini söyler (tahminin sonucu, açılan ipucu). */
  const apply = (next: PuzzleState, previous: PuzzleState) => {
    setState(next);
    persist(next, archive);
    if (next.status === "won" && previous.status === "playing") {
      setRang(true);
      window.dispatchEvent(new CustomEvent(BELL_RANG_EVENT));
      playBellSound({ gesture: false });
    }
    const before = new Set(previous.clues.map((clue) => clue.kind));
    const opened = next.clues.filter((clue) => !before.has(clue.kind));
    setFresh(new Set(opened.map((clue) => clue.kind)));
    const last = next.guesses[next.guesses.length - 1];
    setFreshSymbol(last?.symbol ?? null);
    const parts: string[] = [];
    if (last && isJoker(last.symbol)) {
      parts.push(labels.announceJoker);
    } else if (last) {
      if (next.status === "won") parts.push(fill(labels.announceRight, { symbol: last.symbol }));
      else parts.push(fill(labels.announceWrong, { symbol: last.symbol }));
      if (isClose(last)) parts.push(labels.announceClose);
      if (next.status === "lost" && next.answer) parts.push(fill(labels.announceLost, { symbol: next.answer.symbol }));
    }
    if (next.status === "playing") {
      for (const clue of opened) {
        parts.push(fill(labels.announceClue, { label: labels.clue[clue.kind], value: clueValue(clue, locale, labels) }));
      }
    }
    setAnnounce(parts.join(" "));
  };

  /* GERİ YÜKLEME: bu tarayıcıda bugünün tahminleri varsa ve sunucu onları
     basmadıysa sunucuya bir kez sorulur. Sonuç gelene kadar kutu kapalı
     (`restoring`) — aynı anda yazılan yeni tahmin eski listeyi ezmesin.
     Havuz değişip kayıttaki bir sembol artık tanınmıyorsa kayıt silinir,
     okur baştan oynar. Sunucu durumu bastıysa yalnız depo eşitlenir
     (seri `recordGame` ile aynı gün iki kez sayılmaz). */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!hydrated || restoredRef.current) return;
    restoredRef.current = true;
    const saved = savedGuesses;
    if (saved.length === 0 || sameList(saved, initial.guesses.map((row) => row.symbol))) {
      if (initial.guesses.length > 0) persist(initial, archive);
      return;
    }
    void ask(initial.day, saved).then((result) => {
      setRestoreDone(true);
      if (result.ok) {
        setState(result.state);
        persist(result.state, archive);
      } else if (result.error === "day") {
        router.refresh();
      } else if (result.error === "unknown-symbol" || result.error === "duplicate" || result.error === "too-many") {
        if (archive) writeHistoryEntry(initial.day, { guesses: [], status: "playing", answer: null });
        else writeProgress({ day: initial.day, guesses: [], status: "playing" });
      } else {
        setFailure(result.error);
      }
    });
  }, [hydrated, initial, router, savedGuesses, archive]);

  /* Sonuç `true` ise tahmin işlendi ve kutu boşalabilir. Ağ ya da oran
     hatasında `false`: seçim kutuda KALIR, okur aynı tahmini tek dokunuşla
     yeniden gönderir (eskiden kutu yanıt gelmeden boşalıyordu ve hatada
     seçim kayboluyordu). */
  const submit = async (symbol: string): Promise<boolean> => {
    if (pending || finished || (!isJoker(symbol) && guessed.has(symbol))) return false;
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

  const silhouette = state.clues.find((clue) => clue.kind === "silhouette");
  const silhouetteKnown = Boolean(silhouette) || state.upcoming.includes("silhouette");
  const guessLabel = fill(labels.guessCount, { n: state.guesses.length });

  return (
    <div className={styles.board}>
      <p aria-live="polite" className="sr-only">{announce}</p>

      <div className={styles.main}>
        {/* ---- Ana görsel: oynanırken siluet, bitince kapak kartı ---- */}
        {finished && state.answer ? (
          <PuzzleCover className={styles.lead} state={state} labels={labels} locale={locale} rang={rang} shareUrl={shareUrl} archive={archive} />
        ) : silhouette?.kind === "silhouette" ? (
          <Panel className={styles.lead}>
            <PanelHeader
              title={labels.clue.silhouette}
              meta={
                state.axis ? (
                  labels.axisOpen
                ) : (
                  <span className={styles.axisLock}>
                    <LockSimple aria-hidden size={12} weight="bold" />
                    {fill(labels.axisLocked, { n: AXIS_AFTER_MISSES })}
                  </span>
                )
              }
            />
            <div className="px-4 pb-5 sm:px-5">
              <PuzzleChart
                points={silhouette.points}
                axis={state.axis ? { kind: "pct", spreadPct: state.axis.spreadPct } : { kind: "shape" }}
                labels={labels}
                locale={locale}
                label={`${labels.clue.silhouette}. ${labels.silhouetteNote}`}
              />
              {/* "Eksen ve fiyat yok" notu yalnız eksensizken doğru; eksen
                  açılınca ölçüler onun yerini alıyor (telefonda kutuyu da
                  ilk ekranda tutuyor: 390'da tahmin kutusu 731 → 696). */}
              {!state.axis && <p className={styles.note}>{labels.silhouetteNote}</p>}
            </div>
          </Panel>
        ) : null}

        {/* ---- İpucu yolu ve kartları ---- */}
        <Panel className={styles.clues}>
          <PanelHeader title={labels.cluesTitle} meta={<span className="numeral">{`${state.clues.length}/${state.clues.length + state.upcoming.length}`}</span>} />
          <div className="px-4 pb-5 sm:px-5">
            {!silhouetteKnown && <p className={styles.missing}>{labels.silhouetteMissing}</p>}
            <ClueBoard
              clues={state.clues}
              upcoming={state.upcoming}
              guesses={state.guesses}
              status={state.status}
              fresh={fresh}
              year={Number(state.day.slice(0, 4))}
              labels={labels}
              locale={locale}
            />
            <p className={styles.pool}>{labels.poolNote}</p>
          </div>
        </Panel>
      </div>

      <div className={styles.side}>
        {/* ---- Tahminler ---- */}
        <Panel className={styles.guesses} aria-busy={restoring || pending}>
          <PanelHeader
            title={labels.guessesTitle}
            meta={
              <span className={styles.progress}>
                <GuessDots results={state.guesses.map((row) => row.correct)} label={guessLabel} />
                <span aria-hidden className="numeral">{guessLabel}</span>
              </span>
            }
          />
          <div className="px-4 pb-5 sm:px-5">
            {!finished && (
              <div className={styles.box}>
                <GuessBox
                  options={options}
                  guessed={guessed}
                  labels={labels}
                  locale={locale}
                  disabled={!hydrated || restoring || pending}
                  pending={pending}
                  onGuess={submit}
                />
                <div className={styles.joker}>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!hydrated || restoring || pending || !jokerAllowed(state.guesses.length, state.upcoming.length)}
                    onClick={() => void submit(JOKER)}
                  >
                    <Cards aria-hidden size={16} weight="bold" />
                    {labels.jokerButton}
                  </Button>
                  <p className={styles.jokerHint}>{labels.jokerHint}</p>
                </div>
              </div>
            )}
            {failureText && <p role="alert" className={styles.error}>{failureText}</p>}
            <GuessList guesses={state.guesses} status={state.status} freshSymbol={freshSymbol} labels={labels} locale={locale} />
          </div>
        </Panel>

        <PuzzleRecord
          className={styles.record}
          stats={statsValue}
          today={today}
          todaySlot={!archive && state.status === "won" ? state.guesses.length : null}
          labels={labels}
          locale={locale}
        />
      </div>

    </div>
  );
}
