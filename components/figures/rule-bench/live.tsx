"use client";

import * as React from "react";
import { translateAlong } from "@/components/iso/iso-kit";
import { IsoFigure } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useReadout, useStillness } from "@/components/iso/react/live";
import { HOME, finalPose, lastStop, loopLength, readoutOf, tourAt, START, TRAVEL, DWELL, type BenchData, type BenchText, type Pose } from "./model";
import { BLOCK_D, BLOCK_H, BLOCK_Y, DIP, HEIGHT, P, PITCH, PROBE_Y, ROD_TIP, WIDTH, at, stationX } from "./view";

/* Hareket (anatomy motion.md): zamana bağlı, kare süresi kitte 1/30 sn ile
   kırpılı. İmleç HEDEF koyar, kızak üstel takiple izler (τ 0,18 sn). Boşta
   tur dokunulmazsa 1,4 sn sonra başlar; dokunuşta durur, bırakılınca 3,6 sn
   sonra kızak son durağa döner ve tur son pozun beklemesinden sürer
   (sıçrama yok). Ekran dışında döngü durur; hareketi azaltana son poz,
   girdiye yine cevap verir (atlayarak). */
const FOLLOW = 0.18;
const TOUR_FIRST = 1.4;
const TOUR_BACK = 3.6;
const USER_DIP = 0.55;

type Mode = { kind: "tour"; t: number } | { kind: "user"; target: number; since: number; dipAt: number | null } | { kind: "return"; target: number };

export function RuleBenchLive({
  data,
  text,
  label,
  base,
  backRow,
  rail,
  carriage,
  probes,
  gate,
}: {
  data: BenchData;
  text: BenchText;
  label: string;
  base: React.ReactNode;
  backRow: React.ReactNode;
  rail: React.ReactNode;
  carriage: React.ReactNode;
  probes: React.ReactNode;
  gate: React.ReactNode;
}) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const inView = useInView(anchor);
  const still = useStillness();
  const svg = React.useRef<SVGGElement>(null);
  const mode = React.useRef<Mode>({ kind: "tour", t: -TOUR_FIRST });
  const pose = React.useRef<Pose>(finalPose(data));
  const last = lastStop(data);
  const runEnd = START + (last + 1) * (TRAVEL + DWELL);

  const apply = React.useCallback(
    (next: Pose) => {
      const root = svg.current;
      if (!root) return;
      pose.current = next;
      root.querySelector("[data-carriage]")?.setAttribute("transform", translateAlong(P, [stationX(next.carriage), 0, 0]));
      root.querySelectorAll<SVGGElement>("[data-rod]").forEach((rod) => {
        const dip = next.dips[Number(rod.dataset.rod)] ?? 0;
        rod.setAttribute("transform", dip > 0 ? translateAlong(P, [0, 0, -DIP * dip]) : "");
      });
      root.querySelectorAll<SVGGElement>("[data-lamp]").forEach((lamp) => {
        const [station, index] = lamp.dataset.lamp!.split("-").map(Number);
        if (index < (next.lit[station] ?? 0)) lamp.dataset.on = "";
        else delete lamp.dataset.on;
      });
      root.querySelector("[data-arm='up']")?.setAttribute("visibility", next.armDown ? "hidden" : "visible");
      root.querySelector("[data-arm='down']")?.setAttribute("visibility", next.armDown ? "visible" : "hidden");
    },
    [],
  );

  /** Künye: kızak bir istasyonda duruyorsa o istasyon, yoksa bütün tezgâh. */
  const speak = React.useCallback(
    (station: number | null) => say(readoutOf(data, station, text)),
    [data, text, say],
  );

  const tick = React.useCallback(
    (dt: number) => {
      const m = mode.current;
      if (m.kind === "tour") {
        m.t += dt;
        if (m.t < 0) return true;
        const next = tourAt(m.t, data);
        apply(next);
        const local = m.t % loopLength(data);
        const docked = Math.abs(next.carriage - Math.round(next.carriage)) < 0.02 && next.carriage >= 0;
        speak(local >= START && local < runEnd && docked ? Math.round(next.carriage) : null);
        return true;
      }
      const target = m.target;
      const carriage = follow(pose.current.carriage, target, dt, FOLLOW);
      const final = finalPose(data);
      let dips = final.dips;
      if (m.kind === "user") {
        m.since += dt;
        if (carriage === target && m.dipAt === null) m.dipAt = m.since;
        if (m.dipAt !== null) {
          const age = (m.since - m.dipAt) / USER_DIP;
          const dip = age < 1 ? Math.sin(Math.PI * age) : 0;
          dips = final.dips.map((_, index) => (index === target ? dip : 0));
        }
        apply({ ...final, carriage, dips });
        if (m.since > TOUR_BACK) mode.current = { kind: "return", target: last };
        return true;
      }
      apply({ ...final, carriage });
      if (carriage === target) {
        // Son durağa döndü: tur son pozun beklemesinden sürer.
        mode.current = { kind: "tour", t: runEnd };
        speak(null);
      }
      return true;
    },
    [apply, data, last, runEnd, speak],
  );

  const running = inView && !still;
  const kick = useLoop(tick, running);

  // Hareketi azaltılmış: son poz, tur yok. Tercih değişirse de son poza dön.
  React.useEffect(() => {
    if (still) {
      apply(finalPose(data));
      speak(null);
    }
  }, [still, apply, data, speak]);

  // Turun ilk karesi: lambalar söner, kızak eve gelir; sunucu son pozu basmıştı.
  // Yalnız figür görünür olduğunda ve hareket serbestken.
  const started = React.useRef(false);
  React.useEffect(() => {
    if (!running || started.current) return;
    started.current = true;
    apply({ ...finalPose(data), carriage: HOME, lit: data.stations.map(() => 0), armDown: false, dips: data.stations.map(() => 0) });
  }, [running, apply, data]);

  const choose = React.useCallback(
    (station: number) => {
      const target = data.eliminated ? 0 : Math.max(0, Math.min(data.stations.length - 1, station));
      speak(target);
      if (still) {
        apply({ ...finalPose(data), carriage: target });
        return;
      }
      const m = mode.current;
      if (m.kind === "user" && m.target === target) {
        m.since = 0;
        return;
      }
      mode.current = { kind: "user", target, since: 0, dipAt: null };
      kick();
    },
    [apply, data, kick, speak, still],
  );

  /** İmlecin altındaki istasyon: gövde merkezine ve yoklayıcının ucuna EKRANDA
   *  en yakın olan. Yalnız yatay mesafe yanlış seçiyordu: izometride gövde ile
   *  yoklayıcı farklı x'te durur (+y okuyucuya doğru sola iner). */
  const stationAt = (clientX: number, clientY: number) => {
    const box = anchor.current?.querySelector("svg")?.getBoundingClientRect();
    if (!box) return null;
    const x = ((clientX - box.left) / box.width) * WIDTH;
    const y = ((clientY - box.top) / box.height) * HEIGHT;
    let best = 0;
    let gap = Infinity;
    for (let index = 0; index < data.stations.length; index++) {
      for (const point of [at([stationX(index), BLOCK_Y + BLOCK_D / 2, BLOCK_H / 2]), at([stationX(index), PROBE_Y, ROD_TIP])]) {
        const d = Math.hypot(point[0] - x, point[1] - y);
        if (d < gap) [best, gap] = [index, d];
      }
    }
    return gap < PITCH * P.scale ? best : null;
  };

  const current = () => {
    const m = mode.current;
    return m.kind === "user" ? m.target : Math.max(0, Math.round(pose.current.carriage));
  };

  return (
    <div
      ref={anchor}
      className="rb"
      tabIndex={0}
      aria-label={label}
      onPointerMove={(event) => {
        const station = stationAt(event.clientX, event.clientY);
        if (station !== null) choose(station);
      }}
      onPointerDown={(event) => {
        const station = stationAt(event.clientX, event.clientY);
        if (station !== null) choose(station);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          choose(current() + (event.key === "ArrowRight" ? 1 : -1));
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          choose(event.key === "Home" ? 0 : data.stations.length - 1);
        }
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={label}>
        <g ref={svg}>
          {base}
          {backRow}
          {rail}
          <g data-carriage="" transform={translateAlong(P, [stationX(last), 0, 0])}>
            {carriage}
          </g>
          {probes}
          {gate}
        </g>
      </IsoFigure>
    </div>
  );
}
