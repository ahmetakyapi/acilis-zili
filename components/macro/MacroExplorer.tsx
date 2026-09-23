"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./MacroExperience.module.css";

export type ExplorerSeries = {
  id: string;
  title: string;
  latest: string;
  period: string;
  /** Sonraki açıklamanın okunur tarihi; takvimde yoksa null. */
  next: string | null;
  points: { date: string; timestamp: number; value: number; label: string }[];
};

type ExplorerLabels = {
  title: string;
  pick: string;
  latest: string;
  next: string;
  noNext: string;
  history: string;
  empty: string;
};

/**
 * Kapağın iki yarısı: solda başlık ve GÖSTERGE LİSTESİ, sağda seçilenin
 * geçmişi.
 *
 * Sol yarı bir dönem başlık, iki satırlık bir not ve bir bağlantıdan
 * ibaretti; grafiğin yanında 140 piksel boş zemin kalıyordu (1440'ta
 * ölçüldü) ve gösterge yerel bir `<select>` ile seçiliyordu — altı seçenek
 * bir açılır kutunun içinde saklıydı. Liste artık o boşluğun kendisi: altı
 * gösterge adı, dönemi ve son değeriyle alt alta; seçim tek dokunuş ve
 * hepsinin son okuması grafiğe bakmadan görülüyor. Başlık (`intro`)
 * sunucuda çiziliyor ve buraya çocuk olarak geliyor.
 *
 * Her seri kendi birimini ve ölçeğini taşır. Geçmişte bir noktaya bakmak
 * son açıklanan okumayı hiçbir zaman değiştirmez.
 */
export function MacroExplorer({ series, labels, intro }: {
  series: ExplorerSeries[];
  labels: ExplorerLabels;
  intro: ReactNode;
}) {
  const [selected, setSelected] = useState(series[0]?.id);
  const active = series.find((item) => item.id === selected) ?? series[0];
  const panel = useId();
  return <>
    <div className={styles.intro}>
      {intro}
      {active && <div className={styles.seriesList} role="group" aria-label={labels.pick}>
        {series.map((item) => <button
          key={item.id}
          type="button"
          className={styles.seriesRow}
          aria-pressed={item.id === active.id}
          aria-controls={panel}
          onClick={() => setSelected(item.id)}
        >
          <span>{item.title}<small>{item.period}</small></span>
          <strong>{item.latest}</strong>
        </button>)}
      </div>}
    </div>
    {active && <section className={styles.explorer} aria-label={labels.title} id={panel}>
      <p className={styles.explorerLabel}>{labels.title}</p>
      <div className={styles.explorerReading}>
        <div>
          <h2>{active.title}</h2>
          <span>{labels.latest} · {active.period}</span>
          <strong>{active.latest}</strong>
        </div>
        {/* Sonraki açıklama takvime bağlı: bu tarihte ne açıklanacağını
            takvim söylüyor. Havada duran "grafiğin üzerinde gezin" ipucunun
            yeri burasıydı; sürgü kendini zaten anlatıyor. */}
        <div className={styles.explorerNext}>
          <span>{labels.next}</span>
          {active.next
            ? <Link href="/takvim" className="tap-44">{active.next}</Link>
            : <em>{labels.noNext}</em>}
        </div>
      </div>
      <HistoryChart key={active.id} series={active} labels={labels} />
    </section>}
  </>;
}

function HistoryChart({ series, labels }: { series: ExplorerSeries; labels: { history: string; empty: string } }) {
  const points = series.points;
  const [index, setIndex] = useState(Math.max(0, points.length - 1));
  const gradient = useId();
  if (points.length < 2) return <p className={styles.noHistory}>{labels.empty}</p>;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  // Space observations by time, including any gaps in the provider history.
  const firstTime = points[0].timestamp;
  const timeSpan = points.at(-1)!.timestamp - firstTime || 1;
  const coords = points.map((p) => ({ x: 10 + (p.timestamp - firstTime) / timeSpan * 680, y: 130 - (p.value - min) / span * 110 }));
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const current = points[index];
  const cursor = coords[index];
  return <div className={styles.history}>
    <svg viewBox="0 0 700 150" preserveAspectRatio="none" role="img" aria-label={`${series.title} · ${points[0].date} – ${points.at(-1)!.date}`}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const ratio = ((event.clientX - bounds.left) / bounds.width * 700 - 10) / 680;
        const targetTime = firstTime + Math.max(0, Math.min(1, ratio)) * timeSpan;
        const nearest = points.reduce((best, point, i) => Math.abs(point.timestamp - targetTime) < Math.abs(points[best].timestamp - targetTime) ? i : best, 0);
        setIndex(nearest);
      }}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--primary)" stopOpacity=".01" /></linearGradient></defs>
      {[20, 75, 130].map((y) => <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="var(--line-soft)" vectorEffect="non-scaling-stroke" />)}
      <polygon points={`10,150 ${line} 690,150`} fill={`url(#${gradient})`} />
      <polyline className="spark-line" points={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={cursor.x} x2={cursor.x} y1="12" y2="150" stroke="var(--primary)" strokeOpacity=".25" vectorEffect="non-scaling-stroke" />
      <circle cx={cursor.x} cy={cursor.y} r="4" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
    <div className={styles.axis}><span>{points[0].date}</span><span>{points.at(-1)!.date}</span></div>
    <label className={styles.historyLabel}>
      <span>{labels.history}</span><output>{current.date} <strong>{current.label}</strong></output>
      <input type="range" min="0" max={points.length - 1} step="1" value={index} onChange={(event) => setIndex(Number(event.target.value))} aria-label={labels.history} aria-valuetext={`${current.date}: ${current.label}`} />
    </label>
  </div>;
}
