"use client";

import * as React from "react";
import { iso, translateAlong } from "@/components/iso/iso-kit";
import { IsoFigure } from "@/components/iso/react/draw";
import { follow, useInView, useLoop, useStillness } from "@/components/iso/react/live";
import {
  DAY,
  HOLD,
  LEAD,
  RING,
  SWEEP,
  angleOf,
  dayPlan,
  clockOf,
  countdownOf,
  minutesOfAngle,
  moveLeg,
  planAt,
  planLength,
  plungeAt,
  ringAt,
  sessionAt,
  sessionPlan,
  strikesBetween,
  sweepAt,
  type BellDay,
  type BellText,
  type Leg,
  type SessionKind,
  type Strike,
} from "./model";
import { DIAL_RING_R, DIAL_TOP, DIAL_X, DIAL_Y, HEIGHT, P, STROKE, WIDTH, needlePath } from "./view";

/* Hareket (anatomy motion.md): zamana bağlı, kare süresi kitte 1/30 sn ile
   kırpılı. İlk görünüşte günün tekrarı (ibre 00:00'dan şimdiye, yolda zil
   anlarını geçerse çalar), sonra canlı saat: ibre 5 sn'de bir doğrudan
   yerine konur, döngü yalnız olayda uyanır.
   ÜÇÜNCÜ SÜRÜM (12 Ekim, sahibinin itirazı: "tıkladığı gibi değişmesin,
   smooth olsun; zil çalmak ne işe yarıyor anlamadım"): ibre hiçbir yere
   ışınlanmıyor, her hareket yumuşak başlayıp duran bir bacak (model.ts →
   `Leg`). Üst bilgi ve çizelgedeki "şimdi" imi İBREYİ izliyor, hedefi
   değil: saat yolda akıyor. Seans düğmesi o seansı oynatır, zil yolda
   açılışı ya da kapanışı geçince gerçekten çalar ve sahnede "Açılış Zili ·
   16:30" bildirimi belirir. "Zili Çal" (anlamsız tek vuruş) kalktı, yerine
   "Günü Oynat": iki zil sırayla. Oynatma bitince 4 sn bekler, yumuşakça
   şimdiye döner. Kadranın üstünde fareyle gezinmek o saati izler.
   Ekran dışında durur; hareketi azaltana canlı saat, tekrar ve yürüyüş yok
   (seans düğmesi ibreyi doğrudan seansın başına koyar). */
const HOVER_FOLLOW = 0.22;
const BACK_AFTER = 6;
const LIVE_EVERY = 5000;
const STEP = 15;
const JITTER = 0.6;
const TOAST_MS = 2400;

type PlanKind = Exclude<SessionKind, "closed"> | "day" | "dial" | "return";
type Mode =
  | { kind: "sweep"; t: number }
  | { kind: "live" }
  | { kind: "hover"; target: number; idle: number }
  | { kind: "play"; what: PlanKind; legs: Leg[]; t: number; total: number; hold: number };

export type BellChip = { kind: Exclude<SessionKind, "closed">; name: string; tr: string; ny: string; from: number; to: number };

export type BellLabels = {
  previewing: string;
  playingDay: string;
  back: string;
  play: string;
  playing: string;
  openBell: string;
  closeBell: string;
  note: string;
  closedNote: string | null;
  chipsLabel: string;
};

const BellIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 3a5 5 0 0 0-5 5v3.2L3.6 14h12.8L15 11.2V8a5 5 0 0 0-5-5Zm-2 12.5a2 2 0 0 0 4 0" />
  </svg>
);

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
  const toastTimer = React.useRef<number | undefined>(undefined);
  const stillTimer = React.useRef<number | undefined>(undefined);

  const liveMinutes = React.useCallback(() => nowMinutes + (Date.now() - nowMs) / 60000, [nowMinutes, nowMs]);

  /** Zil anı bildirimi: "Açılış Zili · 16:30 TR". Sahnenin üstünde 2,4 sn. */
  const toast = React.useCallback(
    (hit: Strike) => {
      const el = root.current;
      const note = el?.querySelector("[data-toast]");
      if (!el || !note) return;
      // Yalnız birincil saat (TR'de İstanbul): iki saat bildirimi iki satıra taşıyordu.
      note.textContent = `${hit.bell === "open" ? labels.openBell : labels.closeBell} · ${clockOf(hit.at, day, text).split(" · ")[0]}`;
      el.setAttribute("data-toasting", "");
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => el.removeAttribute("data-toasting"), TOAST_MS);
    },
    [day, text, labels],
  );

  /** Üst bilgi, etkin seans, çizelgedeki "şimdi" imi ve oynatma düğmesi: hepsi ibrenin gösterdiği saatten. */
  const paint = React.useCallback(
    (minutes: number) => {
      const el = root.current;
      if (!el) return;
      const m = mode.current;
      const exploring = m.kind === "hover" || (m.kind === "play" && m.what !== "return");
      const kind = sessionAt(minutes, day);
      const badge = el.querySelector<HTMLElement>("[data-badge]");
      if (badge) {
        badge.dataset.kind = kind;
        badge.textContent = text.sessions[kind];
      }
      const clock = el.querySelector("[data-clock]");
      if (clock) clock.textContent = clockOf(minutes, day, text);
      const count = el.querySelector("[data-count]");
      if (count) {
        count.textContent = exploring
          ? m.kind === "play" && m.what === "day"
            ? labels.playingDay
            : labels.previewing
          : countdownOf(Date.now(), minutes, day, nextOpenMs, nextCloseMs, text);
      }
      el.toggleAttribute("data-previewing", exploring);
      el.querySelectorAll<HTMLElement>("[data-chip]").forEach((chip) => {
        chip.toggleAttribute("data-active", chip.dataset.chip === kind);
        chip.toggleAttribute("data-playing", m.kind === "play" && m.what === chip.dataset.chip && m.t < m.total);
      });

      // Çizelgedeki im: seansın kutusunda saatin payı kadar; seans dışında uçta, sönük.
      const line = el.querySelector<HTMLElement>("[data-line]");
      const marker = el.querySelector<HTMLElement>("[data-marker]");
      if (line && marker) {
        const m0 = ((minutes % DAY) + DAY) % DAY;
        const segs = [...line.querySelectorAll<HTMLElement>("[data-chip]")];
        let x = 0;
        let out = true;
        for (const seg of segs) {
          const from = Number(seg.dataset.from);
          const to = Number(seg.dataset.to);
          if (m0 >= from && m0 < to) {
            x = seg.offsetLeft + ((m0 - from) / (to - from)) * seg.offsetWidth;
            out = false;
            break;
          }
        }
        if (out && segs.length) {
          const last = segs[segs.length - 1];
          x = m0 >= Number(last.dataset.to) && m0 < DAY ? last.offsetLeft + last.offsetWidth : segs[0].offsetLeft;
        }
        marker.style.transform = `translateX(${x.toFixed(1)}px)`;
        marker.toggleAttribute("data-out", out);
      }

      const playBtn = el.querySelector<HTMLElement>("[data-play]");
      if (playBtn) {
        const playing = m.kind === "play" && m.what === "day" && m.t < m.total;
        playBtn.toggleAttribute("data-playing", playing);
        playBtn.style.setProperty("--p", playing ? String(Math.min(1, m.t / m.total)) : "0");
        const text = playBtn.querySelector("[data-play-label]");
        if (text) text.textContent = playing ? labels.playing : labels.play;
      }
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
    const el = root.current;
    if (el) {
      el.toggleAttribute("data-ringing", ringing);
      if (ringing && s) el.dataset.strike = s.bell;
      else delete el.dataset.strike;
    }
  }, []);

  const startReturn = React.useCallback(() => {
    const legs = [moveLeg(shown.current, liveMinutes())];
    mode.current = { kind: "play", what: "return", legs, t: 0, total: planLength(legs), hold: 0 };
  }, [liveMinutes]);

  const tick = React.useCallback(
    (dt: number) => {
      const m = mode.current;
      const before = shown.current;
      let ringing = true;
      if (m.kind === "sweep") {
        m.t += dt;
        shown.current = sweepAt(m.t, liveMinutes());
        if (m.t >= SWEEP) mode.current = { kind: "live" };
      } else if (m.kind === "hover") {
        m.idle += dt;
        const unwrapped = m.target + Math.round((shown.current - m.target) / DAY) * DAY;
        shown.current = follow(shown.current, unwrapped, dt, HOVER_FOLLOW);
        if (m.idle > BACK_AFTER) startReturn();
      } else if (m.kind === "play") {
        m.t += dt;
        const at = planAt(m.legs, m.t);
        shown.current = at.minutes;
        ringing = at.ring;
        if (at.done) {
          if (m.what === "return") {
            mode.current = { kind: "live" };
            shown.current = liveMinutes();
          } else {
            m.hold += dt;
            if (m.hold > HOLD) startReturn();
          }
        }
      } else {
        shown.current = liveMinutes();
      }
      // Taşıma ve dönüş zilsiz: oraya gitmek zil anı değil.
      if (ringing) {
        const hit = strikesBetween(before, shown.current, day).at(-1);
        if (hit) {
          strike.current = { age: 0, bell: hit.bell };
          toast(hit);
        }
      }
      if (strike.current) {
        strike.current.age += dt;
        if (strike.current.age > RING) strike.current = null;
      }
      draw();
      paint(shown.current);
      const now = mode.current;
      const settled = now.kind === "live" && Math.abs(shown.current - liveMinutes()) < 0.01 && !strike.current;
      return !settled;
    },
    [day, draw, liveMinutes, paint, startReturn, toast],
  );

  const running = inView && !still;
  const kick = useLoop(tick, running);

  // Canlı: 5 sn'de bir ibre doğrudan yerine konur (0,02°); döngü yalnız gerçek
  // zil anında uyanır: ibre açılışı ya da kapanışı canlıda geçerse çan vurulur.
  React.useEffect(() => {
    if (!inView) return;
    const timer = window.setInterval(() => {
      if (mode.current.kind !== "live") return;
      const before = shown.current;
      shown.current = liveMinutes();
      const hit = still ? undefined : strikesBetween(before, shown.current, day).at(-1);
      draw();
      paint(shown.current);
      if (hit) {
        strike.current = { age: 0, bell: hit.bell };
        toast(hit);
        kick();
      }
    }, LIVE_EVERY);
    return () => window.clearInterval(timer);
  }, [inView, still, kick, draw, paint, liveMinutes, day, toast]);

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

  // Pencere boyu değişince im yeniden yerleşir (kutular genişledi).
  React.useEffect(() => {
    const onResize = () => paint(shown.current);
    window.addEventListener("resize", onResize);
    paint(shown.current);
    return () => window.removeEventListener("resize", onResize);
  }, [paint]);

  React.useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(stillTimer.current);
    },
    [],
  );

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

  /** Hareketsiz: ibre doğrudan konur, yoldaki ilk zil bildirilir, 6 sn sonra şimdiye. */
  const placeStill = (minutes: number, hits: Strike[]) => {
    mode.current = { kind: "hover", target: minutes, idle: 0 };
    shown.current = minutes;
    draw();
    paint(minutes);
    if (hits[0]) toast(hits[0]);
    window.clearTimeout(stillTimer.current);
    stillTimer.current = window.setTimeout(() => goLive(), BACK_AFTER * 1000);
  };

  const play = (what: PlanKind, legs: Leg[]) => {
    if (!legs.length) return;
    if (still) {
      const walk = legs[legs.length - 1];
      placeStill(walk.from + LEAD, strikesBetween(walk.from, walk.to, day));
      return;
    }
    mode.current = { kind: "play", what, legs, t: 0, total: planLength(legs), hold: 0 };
    kick();
  };

  const hover = (minutes: number) => {
    const target = ((minutes % DAY) + DAY) % DAY;
    if (still) return;
    const m = mode.current;
    if (m.kind === "play" && m.what !== "return" && m.t < m.total) return;
    mode.current = { kind: "hover", target, idle: 0 };
    kick();
  };

  const tapDial = (minutes: number) => {
    const target = ((minutes % DAY) + DAY) % DAY;
    if (still) {
      placeStill(target, []);
      return;
    }
    play("dial", [moveLeg(shown.current, target)]);
  };

  function goLive() {
    window.clearTimeout(stillTimer.current);
    if (still) {
      mode.current = { kind: "live" };
      shown.current = liveMinutes();
      draw();
      paint(shown.current);
      return;
    }
    startReturn();
    kick();
  }

  const current = () => Math.round(shown.current / STEP) * STEP;

  return (
    <div ref={root} className="sb">
      <div className="sb-head">
        <span className="sb-badge" data-badge="" data-kind={sessionAt(nowMinutes, day)}>
          {text.sessions[sessionAt(nowMinutes, day)]}
        </span>
        <span className="sb-clock" data-clock="">
          {clockOf(nowMinutes, day, text)}
        </span>
        <span className="sb-count">
          <BellIcon />
          <span data-count="" aria-live="polite">
            {countdownOf(nowMs, nowMinutes, day, nextOpenMs, nextCloseMs, text)}
          </span>
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
          if (angle !== null) hover(minutesOfAngle(angle));
        }}
        onPointerDown={(event) => {
          const angle = angleAt(event.clientX, event.clientY);
          if (angle !== null) tapDial(minutesOfAngle(angle));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            event.preventDefault();
            tapDial(current() + (event.key === "ArrowRight" ? STEP * 4 : -STEP * 4));
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
        <span className="sb-toast" aria-live="polite">
          <BellIcon />
          <span data-toast="" />
        </span>
      </div>

      {chips.length > 0 ? (
        <div className="sb-controls">
          <div className="sb-line" data-line="" role="group" aria-label={labels.chipsLabel}>
            {chips.map((chip) => (
              <button
                key={chip.kind}
                type="button"
                className="sb-seg"
                data-chip={chip.kind}
                data-from={chip.from}
                data-to={chip.to}
                data-active={sessionAt(nowMinutes, day) === chip.kind ? "" : undefined}
                onClick={() => play(chip.kind, sessionPlan(shown.current, { kind: chip.kind, from: chip.from, to: chip.to }))}
              >
                <span className="sb-seg-name">{chip.name}</span>
                <span className="sb-seg-time">{chip.tr}</span>
                <span className="sb-seg-sub">{chip.ny}</span>
                <span className="sb-seg-bar" aria-hidden="true">
                  {chip.kind === "regular" ? (
                    <>
                      <i className="sb-mark" data-at="open">
                        <BellIcon />
                      </i>
                      <i className="sb-mark" data-at="close">
                        <BellIcon />
                      </i>
                    </>
                  ) : null}
                </span>
              </button>
            ))}
            <span className="sb-marker" data-marker="" aria-hidden="true" />
          </div>
          <button type="button" className="sb-play" data-play="" onClick={() => play("day", dayPlan(shown.current, day))}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M6.5 4.6v10.8a.8.8 0 0 0 1.2.7l8.6-5.4a.8.8 0 0 0 0-1.4L7.7 3.9a.8.8 0 0 0-1.2.7Z" />
            </svg>
            <span data-play-label="">{labels.play}</span>
          </button>
        </div>
      ) : null}
      <p className="sb-note">{labels.closedNote ?? labels.note}</p>
    </div>
  );
}
