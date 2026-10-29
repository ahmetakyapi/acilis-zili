"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowClockwise, ArrowDown, ArrowUp, Check, ShareNetwork, Trophy, X } from "@phosphor-icons/react/dist/ssr";
import { Button, LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import {
  biggerShareText,
  isRight,
  parseBest,
  pickChallenger,
  pickStarter,
  type BiggerChoice,
  type BiggerCompany,
} from "@/lib/bigger-game";
import { hash32 } from "@/lib/stock-puzzle";
import { cn, formatMoneyCompact } from "@/lib/utils";
import { fill } from "./puzzle-format";
import styles from "./BiggerGame.module.css";

/**
 * "Hangisi Büyük?" ekranı (29 Ekim) — kurallar ve gerekçe `lib/bigger-game.ts`.
 *
 * EKRAN DÜZENİ: üstte skor şeridi (skor, en iyi, sıradaki zorluk), altında
 * iki kart: solda değeri açık şirket, ortada "VS", sağda soru kartı ve iki
 * büyük düğme. Cevaptan sonra sağın değeri açılır ve iki değer bir ÇİZGİ
 * olarak da okunur (CLAUDE.md: karşılaştırılan büyüklük çizgide; çubuk
 * büyüklüktür, renk yargı taşımaz — doğru/yanlış rengi yalnız sonuç
 * rozetinde). Doğruysa ~1,2 saniye sonra sağ şirket sola geçer.
 *
 * KLAVYE: ↑ "Daha Büyük", ↓ "Daha Küçük", Enter yeniden oyna. Düğmelerde
 * `aria-keyshortcuts`; sonuç canlı bölgede duyurulur.
 *
 * İLK ÇİZİM RASTGELE DEĞİL: sunucu ve istemci aynı kartı basmalı (yoksa
 * hidratasyon uyuşmaz); ilk eşleşme günün tohumundan (`seed`, sayfa
 * bulmacanın gününü verir), yani her gün başka bir çift. Oyun yeniden
 * başlayınca `Math.random`.
 */

const BEST_KEY = "az-hangisi-buyuk-en-iyi";
const NEXT_DELAY_MS = 1200;
/** Son görülenler — aynı şirket art arda gelmesin. */
const SEEN_LIMIT = 24;

type Phase = "ask" | "right" | "wrong";

const subscribeNothing = () => () => undefined;

function readBest(): number {
  try {
    return parseBest(window.localStorage.getItem(BEST_KEY));
  } catch {
    return 0;
  }
}
function writeBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* Depo kapalıysa en iyi skor yalnız bu oturumda. */
  }
}

/** Günün tohumundan kararlı sayı dizisi — ilk eşleşme sunucuda ve istemcide aynı. */
function seededRandom(seed: string) {
  let value = hash32(seed) || 1;
  return () => {
    value = (Math.imul(value, 1103515245) + 12345) >>> 0;
    return (value % 1_000_000) / 1_000_000;
  };
}

export function BiggerGame({ pool, labels, locale, shareUrl, seed }: { pool: BiggerCompany[]; labels: StockPuzzleLabels; locale: Locale; shareUrl: string; seed: string }) {
  const G = labels.games;
  const [opening] = useState(() => {
    const random = seededRandom(`hangisi-buyuk:${seed}`);
    const first = pickStarter(pool, random);
    return { first, second: first ? pickChallenger(pool, first, 0, new Set(), random) : null };
  });
  const [known, setKnown] = useState<BiggerCompany | null>(opening.first);
  const [challenger, setChallenger] = useState<BiggerCompany | null>(opening.second);
  const [score, setScore] = useState(0);
  /* En iyi skor depodan (sunucuda 0); oturumda kırılan rekor üstüne yazar. */
  const storedBest = useSyncExternalStore(subscribeNothing, readBest, () => 0);
  const [sessionBest, setBest] = useState(0);
  const best = Math.max(storedBest, sessionBest);
  const [phase, setPhase] = useState<Phase>("ask");
  const [choice, setChoice] = useState<BiggerChoice | null>(null);
  const [round, setRound] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [copied, setCopied] = useState(false);
  const seen = useRef<string[]>(opening.first ? [opening.first.symbol] : []);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const money = (value: number) => formatMoneyCompact(value, locale);

  const restart = useCallback(() => {
    window.clearTimeout(timer.current);
    const starter = pickStarter(pool);
    if (!starter) return;
    seen.current = [starter.symbol];
    setKnown(starter);
    setChallenger(pickChallenger(pool, starter, 0, new Set(seen.current)));
    setScore(0);
    setPhase("ask");
    setChoice(null);
    setCopied(false);
    setRound((value) => value + 1);
    setAnnounce("");
  }, [pool]);

  const answer = useCallback(
    (picked: BiggerChoice) => {
      if (phase !== "ask" || !known || !challenger) return;
      setChoice(picked);
      const right = isRight(known, challenger, picked);
      const value = formatMoneyCompact(challenger.marketCap, locale);
      if (right) {
        const next = score + 1;
        setScore(next);
        setPhase("right");
        if (next > best) {
          setBest(next);
          writeBest(next);
        }
        setAnnounce(fill(G.announceRight, { name: challenger.name, value, score: next }));
        timer.current = window.setTimeout(() => {
          seen.current = [...seen.current, challenger.symbol].slice(-SEEN_LIMIT);
          setKnown(challenger);
          setChallenger(pickChallenger(pool, challenger, next, new Set(seen.current)));
          setPhase("ask");
          setChoice(null);
          setRound((r) => r + 1);
        }, NEXT_DELAY_MS);
      } else {
        setPhase("wrong");
        setAnnounce(fill(G.announceWrong, { name: challenger.name, value, score }));
      }
    },
    [phase, known, challenger, score, best, pool, G, locale],
  );

  /* ↑ / ↓ cevap, Enter yeniden. Yazı alanında ya da değiştiriciyle dokunulmaz. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (phase === "ask" && event.key === "ArrowUp") {
        event.preventDefault();
        answer("bigger");
      } else if (phase === "ask" && event.key === "ArrowDown") {
        event.preventDefault();
        answer("smaller");
      } else if (phase === "wrong" && event.key === "Enter" && (event.target === document.body || event.target === null)) {
        event.preventDefault();
        restart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, answer, restart]);

  const share = async () => {
    const text = biggerShareText({ title: G.biggerTitle, score, best, url: shareUrl });
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* İptal ya da izin yok: sessiz. */
    }
  };

  if (!known || !challenger) return null;
  const revealed = phase !== "ask";
  const max = Math.max(known.marketCap, challenger.marketCap);
  const stage = score < 3 ? G.levelEasy : score < 6 ? G.levelMid : score < 10 ? G.levelHard : G.levelExpert;
  const ratio = Math.max(known.marketCap, challenger.marketCap) / Math.min(known.marketCap, challenger.marketCap);

  return (
    <div className={styles.game}>
      <p aria-live="polite" className="sr-only">{announce}</p>

      {/* ---- Skor şeridi ---- */}
      <dl className={styles.scores}>
        <div className={styles.score} data-kind="score">
          <dt>{G.score}</dt>
          <dd key={score} className={cn("numeral", styles.scoreValue)}>{score}</dd>
        </div>
        <div className={styles.score}>
          <dt>
            <Trophy aria-hidden size={13} weight="fill" className={styles.trophy} />
            {G.best}
          </dt>
          <dd className="numeral">{best}</dd>
        </div>
        <div className={styles.score}>
          <dt>{G.level}</dt>
          <dd className={styles.level}>{stage}</dd>
        </div>
      </dl>

      {/* ---- İki kart ---- */}
      <div className={styles.arena} data-phase={phase}>
        <Card company={known} money={money} value={known.marketCap} max={max} revealed scaled={revealed} labels={labels} side="known" key={`k-${known.symbol}-${round}`} />
        <span className={styles.vs} aria-hidden data-phase={phase}>
          {phase === "right" ? <Check size={20} weight="bold" /> : phase === "wrong" ? <X size={20} weight="bold" /> : G.vs}
        </span>
        <Card
          company={challenger}
          money={money}
          value={challenger.marketCap}
          max={max}
          revealed={revealed}
          scaled={revealed}
          labels={labels}
          side="challenger"
          key={`c-${challenger.symbol}-${round}`}
        />
      </div>

      {/* SORU VE SONUÇ AYNI YERDE, KARTLARIN ALTINDA (29 Ekim, 390'da ölçüldü):
          düğmeler sağ kartın içindeyken telefonda kartlar alt alta diziliyor
          ve düğmelerin dibi 847. pikselde, alt gezinmenin altında kalıyordu.
          Şimdi kartlar her genişlikte yan yana, düğmeler ve sonuç kartların
          altında tek yuvada — cevaptan sonra düzen zıplamıyor. */}
      <div className={styles.answerSlot}>
        {!revealed && (
          <div className={styles.choices}>
            <p className={styles.question}>{fill(G.question, { name: known.name })}</p>
            <Button type="button" size="lg" className={styles.choice} onClick={() => answer("bigger")} aria-keyshortcuts="ArrowUp">
              <ArrowUp aria-hidden size={16} weight="bold" />
              {G.bigger}
            </Button>
            <Button type="button" size="lg" variant="ghost" className={cn(styles.choice, styles.choiceAlt)} onClick={() => answer("smaller")} aria-keyshortcuts="ArrowDown">
              <ArrowDown aria-hidden size={16} weight="bold" />
              {G.smaller}
            </Button>
          </div>
        )}
        {revealed && (
          <p className={styles.verdict} data-phase={phase}>
            {phase === "right" ? G.right : G.wrong}
            <span className={styles.verdictNote}>
              {fill(choice === "bigger" ? G.ratioBigger : G.ratioSmaller, { x: ratio.toLocaleString(locale === "en" ? "en-US" : "tr-TR", { maximumFractionDigits: 1 }) })}
            </span>
          </p>
        )}
      </div>

      {/* ---- Oyun bitti ---- */}
      {phase === "wrong" && (
        <Panel className={styles.over}>
          <PanelHeader title={G.overTitle} meta={<span className="numeral">{fill(G.overScore, { n: score })}</span>} />
          <div className={styles.overBody}>
            <p className={styles.overText}>{score >= best && score > 0 ? G.overRecord : fill(G.overBest, { n: best })}</p>
            <div className={styles.overActions}>
              <Button type="button" size="lg" onClick={restart} autoFocus>
                <ArrowClockwise aria-hidden size={16} weight="bold" />
                {G.again}
              </Button>
              <Button type="button" size="lg" variant="ghost" onClick={() => void share()}>
                <ShareNetwork aria-hidden size={16} weight="bold" />
                {copied ? labels.copied : labels.share}
              </Button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Card({
  company,
  value,
  max,
  revealed,
  scaled,
  money,
  labels,
  side,
}: {
  company: BiggerCompany;
  value: number;
  max: number;
  revealed: boolean;
  /** Kulvar YALNIZ cevaptan sonra: ölçek iki değerin büyüğüne göre çizildiği
      için soruda dolu bir kulvar cevabı söylerdi (soldaki %25'teyse sağdaki
      büyüktür — 29 Ekim, 1440'ta görüldü). */
  scaled: boolean;
  money: (value: number) => string;
  labels: StockPuzzleLabels;
  side: "known" | "challenger";
}) {
  return (
    <section className={styles.card} data-side={side} aria-label={company.name}>
      <div className={styles.identity}>
        <LogoTile symbol={company.symbol} logoUrl={company.logoUrl} size="lg" />
        <div className={styles.names}>
          <h2 className={styles.name}>{company.name}</h2>
          <p className={styles.meta}>
            <span className={styles.symbol}>{company.symbol}</span>
            {company.sector && <span>{company.sector}</span>}
          </p>
        </div>
      </div>
      <div className={styles.figure}>
        <span className={styles.figureLabel}>{labels.clue.capBand}</span>
        {revealed ? (
          <b className={cn("numeral", styles.value)}>{money(value)}</b>
        ) : (
          <b aria-label={labels.games.hidden} className={cn(styles.value, styles.hiddenValue)}>?</b>
        )}
        {/* Büyüklük çizgide — iki kartın kulvarı aynı ölçekte (büyüğe göre). */}
        <span aria-hidden className={styles.lane}>
          {scaled && <span className={styles.fill} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />}
        </span>
      </div>
    </section>
  );
}
