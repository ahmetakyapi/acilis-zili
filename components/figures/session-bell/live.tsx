"use client";

import * as React from "react";
import { iso, translateAlong } from "@/components/iso/iso-kit";
import { IsoFigure } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useReadout, useStillness } from "@/components/iso/react/live";
import { DAY, RING, SWEEP, angleOf, minutesOfAngle, plungeAt, readoutOf, ringAt, strikesBetween, sweepAt, type BellDay, type BellText, type Strike } from "./model";
import { DIAL_RING_R, DIAL_TOP, DIAL_X, DIAL_Y, HEIGHT, P, STROKE, WIDTH, needlePath } from "./view";

/* Hareket (anatomy motion.md): zamana bağlı, kare süresi kitte 1/30 sn ile
   kırpılı. İlk görünüşte günün tekrarı (ibre 00:00'dan şimdiye, yolda zil
   anlarını geçerse çalar), sonra canlı saat. İbre üstel takiple döner
   (τ 0,16 sn); canlıda her 5 sn hedef güncellenir, döngü yerleşince durur.
   Kadranın üstünde gezinmek o saati önizler, ileri giderken zil anını
   geçerse çalar; bırakınca 1,2 sn sonra canlıya döner (dönüşte çalmaz).
   Ekran dışında durur; hareketi azaltana canlı saat, tekrar ve vuruş yok. */
const FOLLOW = 0.16;
const BACK_AFTER = 1.2;
const LIVE_EVERY = 5000;
const STEP = 15;
const JITTER = 0.6;

type Mode = { kind: "sweep"; t: number } | { kind: "live" } | { kind: "preview"; target: number; idle: number } | { kind: "return" };

export function SessionBellLive({
  day,
  text,
  closedName,
  label,
  nowMinutes,
  nowMs,
  plinth,
  dial,
  pin,
  back,
  bell,
  striker,
  front,
}: {
  day: BellDay;
  text: BellText;
  closedName: string | null;
  label: string;
  /** Sunucunun bastığı an (ET dakika) ve o anın zaman damgası. */
  nowMinutes: number;
  nowMs: number;
  plinth: React.ReactNode;
  dial: React.ReactNode;
  /** İbrenin göbek vidası: ibrenin ÜSTÜNDE. */
  pin: React.ReactNode;
  back: React.ReactNode;
  bell: React.ReactNode;
  striker: React.ReactNode;
  front: React.ReactNode;
}) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const inView = useInView(anchor);
  const still = useStillness();
  const svg = React.useRef<SVGGElement>(null);
  const mode = React.useRef<Mode>({ kind: "sweep", t: 0 });
  const shown = React.useRef(nowMinutes);
  const strike = React.useRef<{ age: number; bell: Strike["bell"] } | null>(null);

  const liveMinutes = React.useCallback(() => nowMinutes + (Date.now() - nowMs) / 60000, [nowMinutes, nowMs]);

  const draw = React.useCallback(() => {
    const root = svg.current;
    if (!root) return;
    root.querySelector("[data-needle]")?.setAttribute("d", needlePath(angleOf(shown.current)));
    const s = strike.current;
    const plunge = s ? plungeAt(s.age) : 0;
    const ring = s ? ringAt(s.age) : 0;
    root.querySelector("[data-plunger]")?.setAttribute("transform", plunge ? translateAlong(P, [-STROKE * plunge, 0, 0]) : "");
    root.querySelector("[data-bell]")?.setAttribute("transform", ring ? translateAlong(P, [JITTER * ring, 0, 0]) : "");
    const ringing = Boolean(s && s.age < RING);
    root.querySelectorAll<SVGGElement>("[data-contact]").forEach((contact) => contact.toggleAttribute("data-on", ringing && contact.dataset.contact === s?.bell));
    root.querySelector("[data-wire]")?.toggleAttribute("data-pulse", Boolean(s && s.age < 0.4));
  }, []);

  const tick = React.useCallback(
    (dt: number) => {
      const m = mode.current;
      const before = shown.current;
      let target: number;
      if (m.kind === "sweep") {
        m.t += dt;
        target = sweepAt(m.t, liveMinutes());
        shown.current = target;
        if (m.t >= SWEEP) mode.current = { kind: "live" };
      } else {
        if (m.kind === "preview") {
          m.idle += dt;
          if (m.idle > BACK_AFTER) mode.current = { kind: "return" };
        }
        target = m.kind === "preview" ? m.target : liveMinutes();
        // Önizlemede gece yarısını kısa yoldan geç: hedefi göstergeye en yakın tura taşı.
        const unwrapped = target + Math.round((shown.current - target) / DAY) * DAY;
        shown.current = follow(shown.current, unwrapped, dt, FOLLOW);
        if (mode.current.kind === "return" && Math.abs(shown.current - unwrapped) < 0.5) mode.current = { kind: "live" };
      }
      // Dönüş zilsiz: kadranı geri sarmak ya da önizlemeden canlıya gelmek zil anı değil.
      if (mode.current.kind !== "return") {
        const hit = strikesBetween(before, shown.current, day).at(-1);
        if (hit) strike.current = { age: 0, bell: hit.bell };
      }
      if (strike.current) {
        strike.current.age += dt;
        if (strike.current.age > RING) strike.current = null;
      }
      draw();
      say(readoutOf(mode.current.kind === "preview" ? (mode.current as { target: number }).target : shown.current, day, text, closedName));
      const settled = mode.current.kind === "live" && Math.abs(shown.current - liveMinutes()) < 0.01 && !strike.current;
      return !settled;
    },
    [day, draw, liveMinutes, say, text, closedName],
  );

  const running = inView && !still;
  const kick = useLoop(tick, running);

  // Canlı: 5 sn'de bir ibre DOĞRUDAN yerine konur (0,02°; takip döngüsü
  // ~40 kare harcıyordu, ölçüldü). Döngü yalnız gerçek zil anında uyanır:
  // ibre açılışı ya da kapanışı canlıda geçerse çan vurulur.
  React.useEffect(() => {
    if (!inView) return;
    const timer = window.setInterval(() => {
      if (mode.current.kind !== "live" && !still) return;
      const before = shown.current;
      shown.current = liveMinutes();
      const hit = still ? undefined : strikesBetween(before, shown.current, day).at(-1);
      draw();
      say(readoutOf(shown.current, day, text, closedName));
      if (hit) {
        strike.current = { age: 0, bell: hit.bell };
        kick();
      }
    }, LIVE_EVERY);
    return () => window.clearInterval(timer);
  }, [inView, still, kick, draw, say, liveMinutes, day, text, closedName]);

  // Tekrar yalnız ilk görünüşte ve hareket serbestken: ibre gece yarısından başlar.
  const swept = React.useRef(false);
  React.useEffect(() => {
    if (still) {
      mode.current = { kind: "live" };
      shown.current = liveMinutes();
      strike.current = null;
      draw();
      return;
    }
    if (!running || swept.current) return;
    swept.current = true;
    mode.current = { kind: "sweep", t: 0 };
    shown.current = 0;
    draw();
  }, [running, still, draw, liveMinutes]);

  /** Ekrandaki nokta → kadran düzlemindeki açı (z = kadran yüzü), kadranın dışındaysa null. */
  const angleAt = (clientX: number, clientY: number) => {
    const box = anchor.current?.querySelector("svg")?.getBoundingClientRect();
    if (!box) return null;
    const sx = ((clientX - box.left) / box.width) * WIDTH;
    const sy = ((clientY - box.top) / box.height) * HEIGHT;
    const o = iso([DIAL_X, DIAL_Y, DIAL_TOP], P);
    const ex = iso([DIAL_X + 1, DIAL_Y, DIAL_TOP], P);
    const ey = iso([DIAL_X, DIAL_Y + 1, DIAL_TOP], P);
    const [ax, ay, bx, by] = [ex[0] - o[0], ex[1] - o[1], ey[0] - o[0], ey[1] - o[1]];
    const det = ax * by - bx * ay;
    const dx = ((sx - o[0]) * by - bx * (sy - o[1])) / det;
    const dy = (ax * (sy - o[1]) - (sx - o[0]) * ay) / det;
    if (Math.hypot(dx, dy) > DIAL_RING_R + 6) return null;
    return Math.atan2(dx, -dy);
  };

  const preview = (minutes: number) => {
    const target = ((minutes % DAY) + DAY) % DAY;
    if (still) {
      shown.current = target;
      draw();
      say(readoutOf(target, day, text, closedName));
      return;
    }
    mode.current = { kind: "preview", target, idle: 0 };
    kick();
  };

  const current = () => {
    const m = mode.current;
    return m.kind === "preview" ? m.target : Math.round(shown.current / STEP) * STEP;
  };

  return (
    <div
      ref={anchor}
      className="sb"
      tabIndex={0}
      aria-label={label}
      onPointerMove={(event) => {
        const angle = angleAt(event.clientX, event.clientY);
        if (angle !== null) preview(minutesOfAngle(angle));
      }}
      onPointerDown={(event) => {
        const angle = angleAt(event.clientX, event.clientY);
        if (angle !== null) preview(minutesOfAngle(angle));
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          preview(current() + (event.key === "ArrowRight" ? STEP : -STEP));
        } else if (event.key === "Escape") {
          mode.current = { kind: "return" };
          kick();
        }
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={label}>
        <g ref={svg}>
          {plinth}
          {dial}
          <path data-needle="" className="sb-needle" d={needlePath(angleOf(nowMinutes))} />
          {pin}
          {back}
          {bell}
          {striker}
          {front}
        </g>
      </IsoFigure>
    </div>
  );
}
