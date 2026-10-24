"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, PuzzlePiece } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink, Panel } from "@/components/ui/primitives";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import type { PuzzleTeaserResponse } from "@/app/api/bulmaca/route";
import { currentStreak, dayNumberOf } from "@/lib/stock-puzzle";
import { GuessDots } from "./GuessDots";
import { progressSnapshot, statsSnapshot, subscribeStorage } from "./puzzle-storage";
import styles from "./PuzzleTeaser.module.css";

/**
 * Ana sayfadaki bulmaca girişi (24 Ekim; 25 Ekim'de yeniden kuruldu).
 *
 * İKİ KOLONLU IZGARANIN DIŞINDA (seans zili figürünün ardında): kolonlar
 * ölçülü bir dengede (`FillColumn`) ve araya giren bir panel ötekinde kendi
 * boyu kadar boşluk açardı. Durum ("çözüldü mü") bu tarayıcıdan okunuyor;
 * sunucu çiziminde ve depo boşken davet cümlesi.
 *
 * İKİNCİL BAĞLANTI, BİRİNCİL DÜĞME DEĞİL (25 Ekim, 390'da ölçüldü): giriş
 * seans zili figürünün hemen altında ve figürün "Günü Oynat"ı da tam
 * genişlik birincil düğme; telefonda iki mavi tam genişlik düğme üst üste
 * duruyordu ve hangisinin sayfanın asıl eylemi olduğu okunmuyordu. Birincil
 * eylem bulmacanın kendi sayfasında; burada hayalet düğme.
 *
 * MASKELİ SİLUET (25 Ekim): 1280'de giriş 1200 piksellik şeritte tek satır
 * metin ve bir düğmeydi. Şimdi solda günün siluetinin minyatürü: bulmacanın
 * zaten herkese açık İLK ipucu, sağ ucu (yılın son ayları) maskeyle
 * soluyor; merak uyandırıyor, cevabı vermiyor. Veri sayfanın HTML'inde
 * değil, `/api/bulmaca` GET'inden geliyor (yalnız noktalar; ad, sembol,
 * sektör yok). Gelmezse yerinde bulmaca simgesi.
 */
export function PuzzleTeaser({ day, number, labels }: { day: string; number: number; labels: StockPuzzleLabels }) {
  const progress = useSyncExternalStore(subscribeStorage, progressSnapshot, () => null);
  const stats = useSyncExternalStore(subscribeStorage, statsSnapshot, () => null);
  const today = progress && progress.day === day ? progress : null;
  const used = today?.guesses.length ?? 0;
  const status = today?.status ?? "playing";
  /* `undefined` yükleniyor, `null` alınamadı. */
  const [points, setPoints] = useState<number[] | null | undefined>(undefined);

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

  const line =
    status === "won"
      ? labels.homeWon
          .replace("{n}", String(used))
          .replace("{streak}", String(stats ? currentStreak(stats, dayNumberOf(day)) : 1))
      : status === "lost"
        ? labels.homeLost
        : used > 0
          ? labels.homePlaying.replace("{n}", String(used))
          : labels.homeIdle;
  const action = status !== "playing" ? labels.homeResult : used > 0 ? labels.homeContinue : labels.homePlay;
  const results = (today?.guesses ?? []).map((_, i, all) => status === "won" && i === all.length - 1);

  return (
    <Panel data-home-section="puzzle" className={styles.teaser}>
      <span className={styles.thumb} aria-hidden>
        {points ? <Mini points={points} /> : points === null ? <PuzzlePiece size={22} weight="duotone" className={styles.icon} /> : null}
      </span>
      <div className={styles.copy}>
        <h2 className={styles.title}>{labels.homeTitle.replace("{n}", String(number))}</h2>
        <p className={styles.line}>{line}</p>
      </div>
      <div className={styles.foot}>
        <GuessDots results={results} label={labels.guessCount.replace("{n}", String(used))} />
        <ButtonLink href="/bulmaca" variant="ghost" prefetch={false} className={styles.action}>
          {action}
          <ArrowRight aria-hidden size={15} weight="bold" />
        </ButtonLink>
      </div>
    </Panel>
  );
}

/** Siluetin minyatürü — oyundaki çizimin aynısı, kulvar üstünde ince
    mürekkep çizgi; sağ uç CSS maskesiyle soluyor. */
function Mini({ points }: { points: number[] }) {
  const width = 100;
  const height = 32;
  const pad = 3;
  const path = points
    .map((value, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = pad + (1 - value) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className={styles.mini} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} className={styles.lane} vectorEffect="non-scaling-stroke" />
      <path d={path} className={styles.path} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
