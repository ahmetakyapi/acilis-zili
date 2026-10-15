import * as React from "react";
import { SessionBellLive } from "./live";
import { angleOf, segments, type BellDay, type BellText } from "./model";
import type { BellChip, BellLabels } from "./live";
import {
  BAND_R,
  CX,
  CY,
  ELAPSED_R,
  NUM_R,
  TICK_MAJOR_R1,
  TICK_R0,
  TICK_R1,
  arcPath,
  point,
} from "./view";

/**
 * Kadranın YÜZÜ sunucuda çizilir (statik kısım); ibre, geçen-gün yayı ve
 * okuma istemcide yaşar (live.tsx). Dördüncü sürümün gerekçesi view.ts
 * başında: izometrik makine kalktı, cepheden tek kadran.
 *
 * Ressam sırası arkadan öne: çentikler ve rakamlar → halka rayı → seans
 * bantları → zil imleri. Zil imlerinin çınlama dalgaları da burada, sönük;
 * vuruş anında CSS açıyor (bell.css → data-strike).
 */

const fine = (value: number) => Math.round(value * 100) / 100;

function BellGlyph() {
  /* BellIcon'un (live.tsx) 20'lik kutusu; im 26 piksellik dairede. */
  return (
    <path
      d="M10 3a5 5 0 0 0-5 5v3.2L3.6 14h12.8L15 11.2V8a5 5 0 0 0-5-5Zm-2 12.5a2 2 0 0 0 4 0"
      transform="translate(-10 -10)"
    />
  );
}

export function SessionBellArt({
  day,
  text,
  labels,
  chips,
  label,
  nowMinutes,
  nowMs,
  nextOpenMs,
  nextCloseMs,
  stamp,
}: {
  day: BellDay;
  text: BellText;
  labels: BellLabels;
  chips: BellChip[];
  label: string;
  nowMinutes: number;
  nowMs: number;
  nextOpenMs: number;
  nextCloseMs: number;
  /** Kadrana kazınmış etiket ("NY"). */
  stamp: string;
}) {
  const bands = segments(day);

  /* Saat çentikleri: 24 çentik, altı saatte bir uzun + rakam. Rakamlar NY
     saati — kadranın ekseni o (model.ts başı); TR karşılıkları seans
     kartlarında zaten yazılı. */
  const ticks: React.ReactNode[] = [];
  const numerals: React.ReactNode[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const angle = angleOf(hour * 60);
    const major = hour % 6 === 0;
    const [x0, y0] = point(angle, TICK_R0).map(fine);
    const [x1, y1] = point(angle, major ? TICK_MAJOR_R1 : TICK_R1).map(fine);
    ticks.push(
      <line
        key={hour}
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        className="sb2-tick"
        data-major={major || undefined}
      />,
    );
    if (major) {
      const [nx, ny] = point(angle, NUM_R).map(fine);
      numerals.push(
        <text key={hour} x={nx} y={ny} className="sb2-num">
          {String(hour).padStart(2, "0")}
        </text>,
      );
    }
  }

  /* KÖKTE `key` VAR (15 Ekim): yüz sunucuda doğup `face` PROP'uyla istemci
     bileşene iniyor; Flight'tan çözülen öğe dondurulmuş geldiği için
     istemcinin statik `validateChildKeys` işareti üstüne yazılamıyor ve
     React kardeş listesinde "unique key" uyarısı basıyordu. Açık anahtar
     uyarıyı kökünden susturur; çizime etkisi yok. */
  const face = (
    <g key="face">
      {ticks}
      {numerals}
      {/* Halka rayı: günün 24 saati. İşlem olmayan günde yalnız ray var —
          bant yok, zil çalmaz (model.segments). */}
      <circle cx={CX} cy={CY} r={BAND_R} className="sb2-track" />
      {bands.map((band) => (
        <path
          key={band.kind}
          d={arcPath(band.from, band.to, BAND_R)}
          className="sb2-band"
          data-kind={band.kind}
        />
      ))}
      {/* Geçen gün: gece yarısından ibreye incecik bir yay — istemci
          `pathLength`li dairenin ofsetini yazar. Taban tam daire, sönük. */}
      <circle cx={CX} cy={CY} r={ELAPSED_R} pathLength={1} className="sb2-elapsed" data-elapsed="" transform={`rotate(-90 ${CX} ${CY})`} />
      {/* Okumanın plakası: tonla bir basamak (gölge yok) — rakamlar kendi
          zemininde otursun. Kazınmış eksen etiketi üstünde. */}
      <circle cx={CX} cy={CY} r={66} className="sb2-plate" />
      <text x={CX} y={CY - 34} className="sb2-stamp">
        {stamp}
      </text>
      {/* Zil imleri: AÇILIŞ ve KAPANIŞ halkanın üstünde. İbre üstünden
          geçince im çınlar (bell.css: sallanma + iki dalga). */}
      {day.tradingToday &&
        ([
          ["open", day.open],
          ["close", day.close],
        ] as const).map(([bell, at]) => {
          const [bx, by] = point(angleOf(at), BAND_R).map(fine);
          return (
            <g key={bell} className="sb2-bellmark" data-bellmark={bell} transform={`translate(${bx} ${by})`}>
              <circle className="sb2-wave" r={14} />
              <circle className="sb2-wave" data-late="" r={14} />
              <circle className="sb2-bellface" r={13} />
              <BellGlyph />
            </g>
          );
        })}
    </g>
  );

  return (
    <SessionBellLive
      day={day}
      text={text}
      labels={labels}
      chips={chips}
      label={label}
      nowMinutes={nowMinutes}
      nowMs={nowMs}
      nextOpenMs={nextOpenMs}
      nextCloseMs={nextCloseMs}
      face={face}
    />
  );
}
