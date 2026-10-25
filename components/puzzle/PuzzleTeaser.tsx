"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowRight, ArrowUp, PuzzlePiece } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink, LogoTile, Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import type { PuzzleResponse, PuzzleTeaserResponse } from "@/app/api/bulmaca/route";
import { MAX_GUESSES, TILE_KINDS, currentStreak, dayNumberOf, emptyStats, isJoker, nextPuzzleAt, type GuessRow, type PuzzleState } from "@/lib/stock-puzzle";
import { GuessDots } from "./GuessDots";
import { countdownText, useNow } from "./puzzle-clock";
import { fill } from "./puzzle-format";
import { progressSnapshot, statsSnapshot, subscribeStorage } from "./puzzle-storage";
import styles from "./PuzzleTeaser.module.css";

/**
 * Ana sayfadaki bulmaca şeridi (24 Ekim; 25 Ekim'de iki kez yeniden
 * kuruldu).
 *
 * İKİ KOLONLU IZGARANIN DIŞINDA (seans zili figürünün ardında): kolonlar
 * ölçülü bir dengede (`FillColumn`) ve araya giren bir panel ötekinde kendi
 * boyu kadar boşluk açardı.
 *
 * OYUNSU ŞERİT (25 Ekim, ikinci kurulum). Sahibinin itirazı (1440): tam
 * genişlik ince kartta solda soluk bir çizgi, bir cümle, altı nokta ve bir
 * bağlantı vardı, aradaki genişlik boştu: "Bu da çok daha iyi olmalı."
 * Şimdi aynı boyda (~100 piksel) ama durumu anlatan bir şerit:
 * - Oynanmamış: davet, altı boş hak, ilk ipucunun siluet olduğu, "Oyna".
 * - Sürüyor: kalan hak, açık ipucu sayısı ve SON TAHMİNİN dört
 *   karşılaştırma karosu (oyundaki renklerle), "Devam Et".
 * - Bitti: cevabın logosu ve adı, renkli sonuç ızgarası, gece yarısına
 *   geri sayım; "Sonucu Gör".
 * Geniş ekranda sağda seri ve altı sütunluk dağılım (oyundaki şeritle
 * aynı dil). Telefonda iki satır: [siluet | başlık], [durum ... eylem].
 *
 * GÜVENLİK MODELİ AYNI: sayfanın HTML'i bulmacayla ilgili hiçbir veri
 * taşımıyor. Siluet `/api/bulmaca` GET'inden (zaten herkese açık ilk
 * ipucu); karolar ve cevap, bu tarayıcıdaki tahmin listesiyle oyunun
 * kendi POST ucundan — cevap orada da yalnız bitmiş oyunda gelir. Sunucu
 * çiziminde ve depo boşken davet hâli; yer tutan öğeler aynı boyda, kayma
 * yok.
 *
 * BİRİNCİL EYLEM (davette ve devamda): önceki kurulumda burada hayalet
 * düğme vardı, çünkü telefonda seans zili figürünün tam genişlik "Günü
 * Oynat"ının hemen altında ikinci bir tam genişlik mavi düğme duruyordu.
 * Düğme artık tam genişlik değil, kartın sağ alt köşesinde; iki mavi blok
 * üst üste binmiyor. Bitmiş oyunda eylem ikincil (hayalet).
 *
 * EYLEM HER DURUMDA İKİNCİL (25 Ekim, doğrulama turu). Köşeye çekilmek
 * yetmedi: 390×844'te "Günü Oynat" (seans zili figürü, `sb-play`, dolu
 * mavi; günün seanslarını kadranda oynatıyor) y=2077–2129, bu şeridin
 * "Oyna"sı 2348–2392 — 219 piksel arayla aynı ekranda iki dolu mavi
 * birincil eylem (TR/EN, açık/koyu ölçüldü). Ekranın birincil eylemi
 * zilinki; şeridin butonu davette ve devamda da çerçeveli (`ghost`).
 * Masaüstünde de aynı: durum değişince butonun rengi zıplamıyor.
 *
 * Siluet girişte bir kez soldan sağa açılır (silme, `clip-path`; çizgi
 * kesiği Chrome'da `non-scaling-stroke` ile bozuk, bkz. PuzzleChart).
 */
type Game = { key: string; state: PuzzleState };

export function PuzzleTeaser({ day, number, labels }: { day: string; number: number; labels: StockPuzzleLabels }) {
  const progress = useSyncExternalStore(subscribeStorage, progressSnapshot, () => null);
  const statsValue = useSyncExternalStore(subscribeStorage, statsSnapshot, () => null);
  const today = progress && progress.day === day ? progress : null;
  const guesses = useMemo(() => today?.guesses ?? [], [today]);
  const key = guesses.join("|");
  const used = guesses.length;
  const status = today?.status ?? "playing";
  /* `undefined` yükleniyor, `null` alınamadı. */
  const [points, setPoints] = useState<number[] | null | undefined>(undefined);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/bulmaca", { signal: controller.signal })
      .then((response) => response.json() as Promise<PuzzleTeaserResponse>)
      .then((body) => setPoints(body.ok && body.day === day ? body.points : null))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPoints(null);
      });
    return () => controller.abort();
  }, [day]);

  /* Tahmin varsa durum oyunun ucundan: karolar ve (bitmişse) cevap. */
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetch("/api/bulmaca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, guesses: key.split("|") }),
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<PuzzleResponse>)
      .then((body) => {
        if (body.ok && body.state.day === day) setGame({ key, state: body.state });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [day, key]);

  const state = game && game.key === key ? game.state : null;
  const finished = status !== "playing";
  const stats = statsValue ?? emptyStats();
  const streak = currentStreak(stats, dayNumberOf(day));
  const results = guesses.map((_, i, all) => status === "won" && i === all.length - 1);
  const lastGuess = state?.guesses.filter((row) => !isJoker(row.symbol)).at(-1) ?? null;

  const line =
    status === "won"
      ? fill(labels.homeWon, { n: used, streak: Math.max(1, streak) })
      : status === "lost"
        ? labels.homeLost
        : used > 0
          ? fill(labels.homePlaying, { n: used })
          : labels.homeIdle;
  const action = finished ? labels.homeResult : used > 0 ? labels.homeContinue : labels.homePlay;

  return (
    <Panel data-home-section="puzzle" data-durum={finished ? status : used > 0 ? "playing" : "idle"} className={styles.teaser}>
      <span className={styles.thumb} aria-hidden>
        {points ? <Mini points={points} /> : points === null ? <PuzzlePiece size={24} weight="duotone" className={styles.icon} /> : null}
      </span>

      <div className={styles.copy}>
        <h2 className={styles.title}>{fill(labels.homeTitle, { n: number })}</h2>
        {used === 0 && !finished && <p className={styles.headline}>{labels.homeWaiting}</p>}
        <p className={styles.line}>{line}</p>
      </div>

      <div className={styles.state} data-son={!finished && lastGuess ? "" : undefined}>
        {finished && state?.answer ? (
          <span className={styles.answer}>
            <LogoTile symbol={state.answer.symbol} logoUrl={state.answer.logoUrl} size="sm" />
            <span className={styles.answerNames}>
              <span className={styles.answerName}>{state.answer.name}</span>
              <span className={styles.answerSymbol}>{state.answer.symbol}</span>
            </span>
          </span>
        ) : null}
        {finished ? (
          <ResultGrid rows={state?.guesses ?? null} count={used} label={fill(labels.guessCount, { n: used })} />
        ) : (
          <span className={styles.meter}>
            <GuessDots results={results} label={fill(labels.guessCount, { n: used })} />
            <span className={styles.chips}>
              <span className={styles.chip}>{fill(labels.homeLeft, { n: MAX_GUESSES - used })}</span>
              <span className={styles.chip}>
                {state ? fill(labels.homeClues, { n: state.clues.length, total: state.clues.length + state.upcoming.length }) : labels.homeFirstClue}
              </span>
            </span>
          </span>
        )}
        {!finished && lastGuess && <LastGuess row={lastGuess} labels={labels} />}
      </div>

      <div className={styles.record} title={labels.statsNote}>
        <span className={styles.streak}>
          <span className={cn(styles.streakValue, "numeral")}>{streak}</span>
          <span className={styles.streakLabel}>{labels.streak}</span>
        </span>
        <ol className={styles.dist} aria-label={labels.distribution}>
          {Array.from({ length: MAX_GUESSES }, (_, i) => {
            const count = stats.distribution[i] ?? 0;
            const max = Math.max(1, ...stats.distribution);
            return (
              <li key={i} data-today={status === "won" && used === i + 1 ? "" : undefined} title={`${labels.distribution}: ${i + 1} → ${count}`}>
                <span aria-hidden className={styles.col}>
                  <span className={styles.bar} style={{ transform: `scaleY(${count / max})` }} />
                </span>
                <span aria-hidden className={styles.key}>{i + 1}</span>
                <span className="sr-only">{`${i + 1}: ${count}`}</span>
              </li>
            );
          })}
        </ol>
        {finished && <Countdown day={day} labels={labels} />}
      </div>

      <ButtonLink href="/bulmaca" variant="ghost" prefetch={false} className={styles.action}>
        {action}
        <ArrowRight aria-hidden size={15} weight="bold" />
      </ButtonLink>
    </Panel>
  );
}

/** Son tahminin dört karosu — oyundaki renklerle, değersiz minyatür. */
function LastGuess({ row, labels }: { row: GuessRow; labels: StockPuzzleLabels }) {
  return (
    <span className={styles.last}>
      <span className={styles.lastHead}>
        <span className={styles.lastLabel}>{labels.homeLast}</span>
        <span className={styles.lastSymbol}>{row.symbol}</span>
      </span>
      <span className={styles.tiles}>
        {TILE_KINDS.map((kind) => {
          const tile = row.tiles[kind];
          const grade = tile ? (tile.grade ?? "far") : "none";
          const spoken = [labels.tile[kind], tile ? labels.grade[tile.grade ?? "far"] : labels.noData].join(": ");
          return (
            <span key={kind} className={styles.tile} data-grade={grade} title={spoken}>
              {tile?.toward === "up" && kind !== "sector" && <ArrowUp aria-hidden size={10} weight="bold" />}
              {tile?.toward === "down" && kind !== "sector" && <ArrowDown aria-hidden size={10} weight="bold" />}
              <span className="sr-only">{spoken}</span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** Renkli sonuç ızgarası; uçtan yanıt gelene kadar aynı boyda boş kareler. */
function ResultGrid({ rows, count, label }: { rows: GuessRow[] | null; count: number; label: string }) {
  return (
    <span role="img" aria-label={label} className={styles.grid}>
      {Array.from({ length: count }, (_, index) => {
        const row = rows?.[index];
        return (
          <span key={index} className={styles.gridRow}>
            {row && isJoker(row.symbol) ? (
              <span className={styles.jokerSquare} />
            ) : (
              TILE_KINDS.map((kind) => (
                <span key={kind} className={styles.square} data-grade={!row ? "wait" : row.tiles[kind] ? (row.tiles[kind]?.grade ?? "far") : "none"} />
              ))
            )}
          </span>
        );
      })}
    </span>
  );
}

function Countdown({ day, labels }: { day: string; labels: StockPuzzleLabels }) {
  const now = useNow();
  const target = useMemo(() => nextPuzzleAt(Date.parse(`${day}T12:00:00Z`)).getTime(), [day]);
  return (
    <span className={styles.next}>
      <span className={styles.nextLabel}>{labels.next}</span>
      <span className={cn(styles.nextTime, "numeral")}>{now === null ? "" : countdownText(target - now, labels)}</span>
    </span>
  );
}

/** Siluetin minyatürü — oyundaki çizimin dili: tonlu alan ve mürekkep
    çizgi, kulvar ortada. */
function Mini({ points }: { points: number[] }) {
  const width = 100;
  const height = 40;
  const pad = 4;
  const coords = points.map((value, i) => [(i / (points.length - 1)) * width, pad + (1 - value) * (height - pad * 2)] as const);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = coords[coords.length - 1] ?? [width, height / 2];
  return (
    <svg className={styles.mini} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} className={styles.lane} vectorEffect="non-scaling-stroke" />
      <path d={area} className={styles.area} />
      <path d={path} className={styles.path} vectorEffect="non-scaling-stroke" />
      <line x1={lastX} x2={lastX} y1={lastY} y2={lastY} className={styles.end} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
