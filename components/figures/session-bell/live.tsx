"use client";

import * as React from "react";
import { iso, translateAlong } from "@/components/iso/iso-kit";
import { IsoFigure } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useStillness } from "@/components/iso/react/live";
import {
  DAY,
  RING,
  SWEEP,
  angleOf,
  clockOf,
  countdownOf,
  minutesOfAngle,
  plungeAt,
  ringAt,
  sessionAt,
  strikesBetween,
  sweepAt,
  type BellDay,
  type BellText,
  type SessionKind,
  type Strike,
} from "./model";
import { DIAL_RING_R, DIAL_TOP, DIAL_X, DIAL_Y, HEIGHT, P, STROKE, WIDTH, needlePath } from "./view";

/* Hareket (anatomy motion.md): zamana bağlı, kare süresi kitte 1/30 sn ile
   kırpılı. İlk görünüşte günün tekrarı (ibre 00:00'dan şimdiye, yolda zil
   anlarını geçerse çalar), sonra canlı saat: ibre 5 sn'de bir doğrudan
   yerine konur, döngü yalnız olayda uyanır. Seans düğmesi ya da kadrana
   dokunmak o saati önizler (ileri giderken zil anını geçerse çalar);
   "Şimdiye Dön" ya da 6 sn dokunulmazsa canlıya döner (dönüş zilsiz).
   "Zili Çal" çanı bir kez vurur. Ekran dışında durur; hareketi azaltana
   canlı saat, tekrar ve vuruş yok. */
const FOLLOW = 0.16;
const BACK_AFTER = 6;
const LIVE_EVERY = 5000;
const STEP = 15;
const JITTER = 0.6;

type Mode = { kind: "sweep"; t: number } | { kind: "live" } | { kind: "preview"; target: number; idle: number } | { kind: "return" };

export type BellChip = { kind: Exclude<SessionKind, "closed">; name: string; tr: string; ny: string; from: number };

export type BellLabels = {
  previewing: string;
  back: string;
  ring: string;
  note: string;
  closedNote: string | null;
  chipsLabel: string;
};

export function SessionBellLive({
  day,
  text,
  labels,
  chips,
  label,
  nowMinutes,
  nowMs,
  nextOpenMs,
  nextCloseMs,
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
  labels: BellLabels;
  chips: BellChip[];
  label: string;
  /** Sunucunun bastığı an (ET dakika) ve o anın zaman damgası. */
  nowMinutes: number;
  nowMs: number;
  nextOpenMs: number;
  nextCloseMs: number;
  plinth: React.ReactNode;
  dial: React.ReactNode;
  /** İbrenin göbek vidası: ibrenin ÜSTÜNDE. */
  pin: React.ReactNode;
  back: React.ReactNode;
  bell: React.ReactNode;
  striker: React.ReactNode;
  front: React.ReactNode;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const stage = React.useRef<HTMLDivElement>(null);
  const inView = useInView(stage);
  const still = useStillness();
  const svg = React.useRef<SVGGElement>(null);
  const mode = React.useRef<Mode>({ kind: "sweep", t: 0 });
  const shown = React.useRef(nowMinutes);
  const strike = React.useRef<{ age: number; bell: Strike["bell"] } | null>(null);

  const liveMinutes = React.useCallback(() => nowMinutes + (Date.now() - nowMs) / 60000, [nowMinutes, nowMs]);

  /** Üst bilgi: seans rozeti, iki saat, geri sayım ya da önizleme; etkin seans düğmesi. */
  const paint = React.useCallback(
    (minutes: number) => {
      const el = root.current;
      if (!el) return;
      const previewing = mode.current.kind === "preview";
      const kind = sessionAt(minutes, day);
      const badge = el.querySelector<HTMLElement>("[data-badge]");
      if (badge) {
        badge.dataset.kind = kind;
        badge.textContent = text.sessions[kind];
      }
      const clock = el.querySelector("[data-clock]");
      if (clock) clock.textContent = clockOf(minutes, day, text);
      const count = el.querySelector("[data-count]");
      if (count) count.textContent = previewing ? labels.previewing : countdownOf(Date.now(), minutes, day, nextOpenMs, nextCloseMs, text);
      el.toggleAttribute("data-previewing", previewing);
      el.querySelectorAll<HTMLElement>("[data-chip]").forEach((chip) => chip.toggleAttribute("data-active", chip.dataset.chip === kind));
    },
    [day, text, labels, nextOpenMs, nextCloseMs],
  );

  const draw = React.useCallback(() => {
    const g = svg.current;
    if (!g) return;
    g.querySelector("[data-needle]")?.setAttribute("d", needlePath(angleOf(shown.current)));
    const s = strike.current;
    const plunge = s ? plungeAt(s.age) : 0;
    const ring = s ? ringAt(s.age) : 0;
    g.querySelector("[data-plunger]")?.setAttribute("transform", plunge ? translateAlong(P, [-STROKE * plunge, 0, 0]) : "");
    g.querySelector("[data-bell]")?.setAttribute("transform", ring ? translateAlong(P, [JITTER * ring, 0, 0]) : "");
    const ringing = Boolean(s && s.age < RING);
    g.querySelectorAll<SVGGElement>("[data-contact]").forEach((contact) => contact.toggleAttribute("data-on", ringing && contact.dataset.contact === s?.bell));
    g.querySelector("[data-wire]")?.toggleAttribute("data-pulse", Boolean(s && s.age < 0.4));
    root.current?.toggleAttribute("data-ringing", ringing);
  }, []);

  const tick = React.useCallback(
    (dt: number) => {
      const m = mode.current;
      const before = shown.current;
      if (m.kind === "sweep") {
        m.t += dt;
        shown.current = sweepAt(m.t, liveMinutes());
        if (m.t >= SWEEP) mode.current = { kind: "live" };
      } else {
        if (m.kind === "preview") {
          m.idle += dt;
          if (m.idle > BACK_AFTER) mode.current = { kind: "return" };
        }
        const target = m.kind === "preview" ? m.target : liveMinutes();
        // Gece yarısını kısa yoldan geç: hedefi göstergeye en yakın tura taşı.
        const unwrapped = target + Math.round((shown.current - target) / DAY) * DAY;
        shown.current = follow(shown.current, unwrapped, dt, FOLLOW);
        if (mode.current.kind === "return" && Math.abs(shown.current - unwrapped) < 0.5) mode.current = { kind: "live" };
      }
      // Dönüş zilsiz: önizlemeden canlıya gelmek zil anı değil.
      if (mode.current.kind !== "return") {
        const hit = strikesBetween(before, shown.current, day).at(-1);
        if (hit) strike.current = { age: 0, bell: hit.bell };
      }
      if (strike.current) {
        strike.current.age += dt;
        if (strike.current.age > RING) strike.current = null;
      }
      draw();
      const now = mode.current;
      paint(now.kind === "preview" ? now.target : shown.current);
      const settled = now.kind === "live" && Math.abs(shown.current - liveMinutes()) < 0.01 && !strike.current;
      return !settled;
    },
    [day, draw, liveMinutes, paint],
  );

  const running = inView && !still;
  const kick = useLoop(tick, running);

  // Canlı: 5 sn'de bir ibre doğrudan yerine konur (0,02°); döngü yalnız gerçek
  // zil anında uyanır: ibre açılışı ya da kapanışı canlıda geçerse çan vurulur.
  React.useEffect(() => {
    if (!inView) return;
    const timer = window.setInterval(() => {
      if (mode.current.kind !== "live" && !still) return;
      const before = shown.current;
      shown.current = liveMinutes();
      const hit = still ? undefined : strikesBetween(before, shown.current, day).at(-1);
      draw();
      paint(shown.current);
      if (hit) {
        strike.current = { age: 0, bell: hit.bell };
        kick();
      }
    }, LIVE_EVERY);
    return () => window.clearInterval(timer);
  }, [inView, still, kick, draw, paint, liveMinutes, day]);

  // Tekrar yalnız ilk görünüşte ve hareket serbestken: ibre gece yarısından başlar.
  const swept = React.useRef(false);
  React.useEffect(() => {
    if (still) {
      mode.current = { kind: "live" };
      shown.current = liveMinutes();
      strike.current = null;
      draw();
      paint(shown.current);
      return;
    }
    if (!running || swept.current) return;
    swept.current = true;
    mode.current = { kind: "sweep", t: 0 };
    shown.current = 0;
    draw();
  }, [running, still, draw, paint, liveMinutes]);

  /** Ekrandaki nokta → kadran düzlemindeki açı (z = kadran yüzü), kadranın dışındaysa null. */
  const angleAt = (clientX: number, clientY: number) => {
    const box = stage.current?.querySelector("svg")?.getBoundingClientRect();
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
      mode.current = { kind: "preview", target, idle: 0 };
      shown.current = target;
      draw();
      paint(target);
      return;
    }
    mode.current = { kind: "preview", target, idle: 0 };
    kick();
  };

  const goLive = () => {
    if (still) {
      mode.current = { kind: "live" };
      shown.current = liveMinutes();
      draw();
      paint(shown.current);
      return;
    }
    mode.current = { kind: "return" };
    kick();
  };

  const ring = () => {
    if (still) {
      // Hareketsiz vuruş: çan titremez, kontak ve rozet 1,2 sn yanar.
      const bell = sessionAt(shown.current, day) === "regular" ? "close" : "open";
      root.current?.setAttribute("data-ringing", "");
      svg.current?.querySelector(`[data-contact="${bell}"]`)?.setAttribute("data-on", "");
      window.setTimeout(() => {
        root.current?.removeAttribute("data-ringing");
        svg.current?.querySelectorAll("[data-contact]").forEach((contact) => contact.removeAttribute("data-on"));
      }, RING * 1000);
      return;
    }
    strike.current = { age: 0, bell: sessionAt(shown.current, day) === "regular" ? "close" : "open" };
    kick();
  };

  const current = () => {
    const m = mode.current;
    return m.kind === "preview" ? m.target : Math.round(shown.current / STEP) * STEP;
  };

  return (
    <div ref={root} className="sb">
      <div className="sb-head">
        <span className="sb-badge" data-badge="" data-kind={sessionAt(nowMinutes, day)}>
          {text.sessions[sessionAt(nowMinutes, day)]}
        </span>
        <span className="sb-clock" data-clock="">
          {clockOf(nowMinutes, day, text)}
        </span>
        <span className="sb-count" data-count="" aria-live="polite">
          {countdownOf(nowMs, nowMinutes, day, nextOpenMs, nextCloseMs, text)}
        </span>
        <button type="button" className="sb-back" onClick={goLive}>
          {labels.back}
        </button>
      </div>

      <div
        ref={stage}
        className="sb-stage"
        tabIndex={0}
        aria-label={label}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
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
          } else if (event.key === "Escape") goLive();
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

      {chips.length > 0 ? (
        <div className="sb-chips" role="group" aria-label={labels.chipsLabel}>
          {chips.map((chip) => (
            <button
              key={chip.kind}
              type="button"
              className="sb-chip"
              data-chip={chip.kind}
              data-active={sessionAt(nowMinutes, day) === chip.kind ? "" : undefined}
              onClick={() => preview(chip.from)}
            >
              <span className="sb-chip-name">{chip.name}</span>
              <span className="sb-chip-time">{chip.tr}</span>
              <span className="sb-chip-sub">{chip.ny}</span>
            </button>
          ))}
          <button type="button" className="sb-ring" onClick={ring}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 3a5 5 0 0 0-5 5v3.2L3.6 14h12.8L15 11.2V8a5 5 0 0 0-5-5Zm-2 12.5a2 2 0 0 0 4 0" />
            </svg>
            {labels.ring}
          </button>
        </div>
      ) : null}
      <p className="sb-note">{labels.closedNote ?? labels.note}</p>
    </div>
  );
}
