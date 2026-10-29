"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Cards, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { playBellSound, primeBellSound } from "@/components/sound/bell-sound";
import { BELL_RANG_EVENT } from "@/components/today/bell-event";
import { PUZZLE_UPDATE_EVENT } from "./puzzle-event";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import type { PuzzleResponse } from "@/app/api/bulmaca/route";
import {
  AXIS_AFTER_MISSES,
  JOKER,
  candidatesFor,
  currentStreak,
  MAX_GUESSES,
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
import { PuzzleCover, PuzzleResult } from "./PuzzleCover";
import { PuzzleRecord } from "./PuzzleRecord";
import { cn } from "@/lib/utils";
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
 * TEK EKRANLIK TAHTA (25 Ekim, ikinci kurulum). Sahibinin itirazı:
 * "Kaydırılmadan da görünebilsin; detaylar, ipuçları hepsi kolay okunsun
 * ve tek ekranda her şey net belli olsun." Ölçü: 1280×800, 1440×900 ve
 * 1920×1080'de oyunun dört durumunda (başlangıç, üç yanlış, kazanma,
 * kaybetme) siluet/cevap, on bir ipucunun hepsi, giriş, altı tahmin yuvası
 * ve seri, üst gezinmenin altından alt fiyat şeridinin üstüne kadar
 * kaydırmasız (sayılar StockPuzzle.module.css başında). İkincil metin
 * (kurallar, havuz, lejantın uzun açıklaması) tahtanın altındaki "Nasıl
 * Oynanır"da (PuzzleScreen).
 *
 * EKRAN DÜZENİ (CLAUDE.md sırası): başlık sayfada; sol kolonda ANA GÖRSEL
 * (oynanırken siluet, bitince aynı kutuda cevap) ve altında ipucu
 * ızgarası; sağ kolonda tahminler (giriş kutusu, bitince onun yerinde
 * sonuç ve paylaşım) ve seri şeridi. Telefonda tek kolon, sıra `order`
 * ile: ana görsel, yapışkan Tahminler/İpuçları anahtarı, seçili bölüm,
 * seri.
 *
 * DOĞRU TAHMİNDE ZİL (25 Ekim): sitenin imza anı. Sayfada ikinci bir zil
 * bileşeni yok; kapak kartı kahraman zilinin `heroTap` sahnesini bir kez
 * oynatıyor (InkCanvas, hareketi azaltana son kare), `BELL_RANG_EVENT`
 * yayılıyor ve zil sesi ayarı açıksa ses geliyor. Ses bağlamı tıklamanın
 * İÇİNDE hazırlanıyor (`primeBellSound`, tercihe bakar): yanıt ağdan
 * döndüğünde artık bir kullanıcı hareketinin içinde değiliz ve tarayıcı
 * yeni bağlam açtırmıyor. Geri yüklenen (önceden kazanılmış) bulmaca
 * çalmaz; zil yalnız o anki doğru tahmine.
 *
 * KLAVYE (25 Ekim, üçüncü kurulum): Enter kutuda seçer ve gönderir (kutu
 * dışındayken kutuya odaklanır); J, yazı alanında değilken jokeri
 * kullanır. Düğmede `aria-keyshortcuts` ve ince imleçli ekranda küçük bir
 * "J" tuşu; dokunmatikte tuş gizli. Kısayol bir hakkı harcadığı için
 * yalnız joker gerçekten kullanılabilirken çalışır (düğmeyle aynı koşul).
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
  /* Telefonda yapışkan anahtar: Tahminler mi İpuçları mı. `seen`, okurun
     İpuçları'nı en son açtığında kaç ipucu gördüğü — anahtarda "yeni"
     noktası buradan. */
  const [tab, setTab] = useState<"guesses" | "clues">("guesses");
  const [seen, setSeen] = useState(initial.clues.length);
  const leadRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

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
  /* İpuçlarına uyan adaylar — yalnız ekranda açık bilgiden (`fitsClues`). */
  const candidates = useMemo(() => candidatesFor(options, state.clues, state.guesses), [options, state.clues, state.guesses]);

  /* Sunucunun döndürdüğü yeni durumu çizer ve ekran okuyucuya ne
     değiştiğini söyler (tahminin sonucu, açılan ipucu). */
  const apply = (next: PuzzleState, previous: PuzzleState) => {
    setState(next);
    persist(next, archive);
    window.dispatchEvent(new CustomEvent(PUZZLE_UPDATE_EVENT));
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
  const streak = archive || !statsValue ? 0 : currentStreak(statsValue, today);
  const jokerReady = hydrated && !restoring && !pending && !finished && jokerAllowed(state.guesses.length, state.upcoming.length);

  /* Klavye kısayolları: J joker, Enter kutuya odak. Yazı alanında ya da
     değiştirici tuşla basılınca dokunulmaz. */
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    if (finished) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if (typing) return;
      if ((event.key === "j" || event.key === "J") && jokerReady) {
        event.preventDefault();
        void submitRef.current(JOKER);
      } else if (event.key === "Enter" && (target === document.body || target === null)) {
        const input = document.getElementById("bulmaca-tahmin");
        if (input instanceof HTMLInputElement && !input.disabled) {
          event.preventDefault();
          input.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, jokerReady]);
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
  const unseen = tab === "clues" ? 0 : Math.max(0, state.clues.length - seen);
  const cluesLabel = fill(labels.cluesOpen, { n: state.clues.length, total: state.clues.length + state.upcoming.length });

  /* Anahtar yapışmışken bölüm değişince sayfa, seçilen panelin başına
     (anahtarın hemen altına) döner; yapışmamışken yerinde kalır. Yeni
     yerleşim çizildikten SONRA ölçülür: tıklamanın içinde kaydırınca
     tarayıcının kaydırma çapası panel değişiminde sayfayı yeniden
     oynatıyordu (390'da ölçüldü: ipuçları anahtarın 67 piksel altında
     kalıyordu). */
  const jumpRef = useRef(false);
  const choose = (next: "guesses" | "clues") => {
    if (next === "clues") setSeen(state.clues.length);
    if (next === tab) return;
    jumpRef.current = true;
    setTab(next);
  };
  useLayoutEffect(() => {
    if (!jumpRef.current) return;
    jumpRef.current = false;
    const bar = tabsRef.current;
    const lead = leadRef.current;
    if (!bar || !lead) return;
    const stuckAt = parseFloat(getComputedStyle(bar).top) || 0;
    const gap = parseFloat(getComputedStyle(bar.parentElement ?? bar).rowGap) || 0;
    const target = window.scrollY + lead.getBoundingClientRect().bottom + gap - stuckAt;
    if (window.scrollY > target) window.scrollTo({ top: target });
  }, [tab]);

  return (
    <div className={styles.board} data-tahta-kok>
      <p aria-live="polite" className="sr-only">{announce}</p>

      <div className={styles.main}>
        {/* ---- Ana görsel: oynanırken siluet, bitince aynı kutuda cevap ---- */}
        {finished && state.answer ? (
          <PuzzleCover ref={leadRef} className={styles.lead} state={state} labels={labels} locale={locale} rang={rang} streak={streak} />
        ) : silhouette?.kind === "silhouette" ? (
          <Panel ref={leadRef} className={styles.lead}>
            <PanelHeader
              className="py-2.5"
              title={labels.clue.silhouette}
              meta={
                state.axis ? (
                  labels.axisOpen
                ) : (
                  <span className={styles.axisLock} title={labels.silhouetteNote}>
                    <LockSimple aria-hidden size={12} weight="bold" />
                    {fill(labels.axisLocked, { n: AXIS_AFTER_MISSES })}
                  </span>
                )
              }
            />
            <div className={styles.leadBody}>
              <PuzzleChart
                points={silhouette.points}
                axis={state.axis ? { kind: "pct", spreadPct: state.axis.spreadPct } : { kind: "shape" }}
                labels={labels}
                locale={locale}
                label={`${labels.clue.silhouette}. ${labels.silhouetteNote}`}
                live
              />
            </div>
          </Panel>
        ) : null}

        {/* ---- İpuçları: on eşit karo, basamak sırasıyla ---- */}
        <Panel className={styles.clues} data-gizli={tab === "clues" ? undefined : ""}>
          <PanelHeader
            className="py-2.5"
            title={labels.cluesTitle}
            meta={<span className="numeral">{cluesLabel}</span>}
          />
          <div className={styles.cluesBody}>
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
          </div>
        </Panel>
      </div>

      {/* ---- Telefon: yapışkan Tahminler / İpuçları anahtarı ----
          Tek kolonda dört panel alt alta 390×844'te üç ekran boyu
          kaydırma istiyordu ve giriş kutusu ile ipuçları hiçbir zaman
          aynı anda görünmüyordu. Anahtar siluetin altında yapışıyor; bir
          dokunuşla öbür bölüme geçiliyor. Masaüstünde gizli, iki panel
          yan yana. Sekme değil düğme grubu (`aria-pressed`): masaüstünde
          paneller hep görünür, sekme paneli ilan etmek yanlış olurdu. */}
      <div ref={tabsRef} role="group" aria-label={labels.tabsLabel} className={styles.tabs}>
        <button type="button" aria-pressed={tab === "guesses"} onClick={() => choose("guesses")} className={styles.tab}>
          {labels.guessesTitle}
          <span className={cn(styles.tabMeta, "numeral")}>{state.guesses.length}/{MAX_GUESSES}</span>
        </button>
        <button type="button" aria-pressed={tab === "clues"} onClick={() => choose("clues")} className={styles.tab}>
          {labels.cluesTitle}
          <span className={cn(styles.tabMeta, "numeral")}>{state.clues.length}/{state.clues.length + state.upcoming.length}</span>
          {unseen > 0 && (
            <span className={styles.tabNew}>
              <span aria-hidden>+{unseen}</span>
              <span className="sr-only">{fill(labels.newClues, { n: unseen })}</span>
            </span>
          )}
        </button>
      </div>

      <div className={styles.side}>
        {/* ---- Tahminler: giriş (bitince sonuç), altı yuva, lejant ---- */}
        <Panel className={styles.guesses} data-gizli={tab === "guesses" ? undefined : ""} aria-busy={restoring || pending}>
          <PanelHeader
            className="py-2.5"
            title={labels.guessesTitle}
            meta={
              <span className={styles.progress}>
                <GuessDots results={state.guesses.map((row) => row.correct)} label={guessLabel} />
                <span aria-hidden className="numeral">{guessLabel}</span>
              </span>
            }
          />
          <div className={styles.guessesBody}>
            {finished && state.answer ? (
              <PuzzleResult state={state} labels={labels} shareUrl={shareUrl} archive={archive} />
            ) : (
              <div className={styles.box} data-tahta="giris">
                <GuessBox
                  options={options}
                  candidates={candidates}
                  guessed={guessed}
                  labels={labels}
                  locale={locale}
                  disabled={!hydrated || restoring || pending}
                  pending={pending}
                  onGuess={submit}
                  extra={
                    <Button
                      type="button"
                      variant="ghost"
                      size="lg"
                      title={`${labels.jokerHint} ${labels.jokerKey}`}
                      aria-describedby="bulmaca-joker-not"
                      aria-keyshortcuts="J"
                      disabled={!jokerReady}
                      onClick={() => void submit(JOKER)}
                    >
                      <Cards aria-hidden size={16} weight="bold" />
                      <span className={styles.jokerText}>{labels.jokerButton}</span>
                      <kbd aria-hidden className={styles.kbd}>J</kbd>
                    </Button>
                  }
                />
                <span id="bulmaca-joker-not" className="sr-only">{labels.jokerHint}</span>
              </div>
            )}
            {failureText && <p role="alert" className={styles.error}>{failureText}</p>}
            <GuessList guesses={state.guesses} freshSymbol={freshSymbol} labels={labels} locale={locale} />
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
