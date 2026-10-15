import * as G from "@/components/iso/lathe.mjs";
import {
  corners,
  cylinder,
  haloOf,
  insetPlan,
  joinPaths,
  lineOnTop,
  onTop,
  planOutline,
  pointsAt,
  radialTicks,
  ring,
  sideSeam,
  slabOf,
  topMatrix,
  type Flat,
  type Plan,
  type Point3,
  type SolidPaths,
} from "@/components/iso/iso-kit";
import { angleOf, segments, type BellDay, type Segment } from "./model";
import {
  BAR_H,
  BELL_X,
  BELL_Y,
  BELL_Z,
  COIL,
  COIL_H,
  CONTACT_H,
  CONTACT_R,
  DIAL_R,
  DIAL_RING_H,
  DIAL_RING_R,
  DIAL_TOP,
  DIAL_X,
  DIAL_Y,
  FOOT_H,
  FOOT_R,
  HANGER_R,
  HEAD_R,
  HUB_H,
  HUB_R,
  P,
  PLINTH,
  PLINTH_H,
  POST_D,
  POST_H,
  POST_W,
  POST_Y,
  STAND,
  STAND_H,
  STRIKE_Z,
  STROKE,
  TICK_R,
  WEDGE_R,
  at,
  onDial,
} from "./view";

/**
 * Bütün statik yollar, gün başına bir kez: seans yayları ve kontakların yeri
 * günün takvimine bağlı (yarım günde kapanış erken). Hareket edenler —
 * ibre, dövücü, çanın titreşimi — dinlenme yerinde kurulur; canlı bileşen
 * ibreyi yeniden çizer, ötekileri translate ile taşır.
 */

const dots = (points: Point3[]): Flat[] => pointsAt(points, P);

/** Çanın kesiti (s: ağızdan taca, r: yarıçap). Eğri düğümler yumuşak işaretli:
 *  lathe gölgeyi basamaksız çizer (anatomy craft: "staircase" yok). */
const BELL_PROFILE: [number, number, number?][] = [
  [0, 22.4],
  [1.2, 22.8],
  [2.8, 22, 1],
  [8, 18.4, 1],
  [16, 15.6, 1],
  [25, 14.1, 1],
  [32, 12.2, 1],
  [36.4, 8.6, 1],
  [38.6, 3.6, 1],
  [39, 0],
];
export const BELL_HEIGHT = 39;
/** Dövücünün vurduğu yükseklikte (s = 5) çanın yarıçapı. */
const R_AT_STRIKE = 20.9;

function arcPoints(segment: Segment, radius: number) {
  const a0 = angleOf(segment.from);
  let a1 = angleOf(segment.to);
  if (a1 <= a0) a1 += Math.PI * 2;
  const steps = Math.max(6, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 96));
  return Array.from({ length: steps + 1 }, (_, index) => onDial(a0 + ((a1 - a0) * index) / steps, radius));
}

/** Seans dilimi: göbekten kenar yayına kapalı bir pasta dilimi (kadran yüzünde, dolgulu). */
const wedgePath = (segment: Segment, radius: number) => onTop([[DIAL_X, DIAL_Y], ...arcPoints(segment, radius)], DIAL_TOP, P, true);

function build(day: BellDay) {
  const post = (y: number): Plan => ({ x: BELL_X - POST_W / 2, y: y - POST_D / 2, w: POST_W, d: POST_D, r: 1.2 });
  const foot = (y: number): Plan => ({ x: BELL_X - 9, y: y - 7, w: 18, d: 14, r: 1.5 });
  const backY = BELL_Y - POST_Y;
  const frontY = BELL_Y + POST_Y;
  const bar: Plan = { x: BELL_X - POST_W / 2 - 1, y: backY - POST_D / 2 - 2, w: POST_W + 2, d: POST_Y * 2 + POST_D + 4, r: 1.5 };
  const F = G.frameOf([BELL_X, BELL_Y, BELL_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const plate: Plan = { x: -118, y: 44, w: 46, d: 8, r: 1 };
  const terminal: [number, number] = [-12, 36];
  const days = segments(day);
  const contactAt = (minutes: number) => onDial(angleOf(minutes), WEDGE_R - 4);
  const strikeAxis = G.frameAlong([COIL.x, BELL_Y, STRIKE_Z], [-1, 0, 0]);
  const headX = BELL_X + R_AT_STRIKE + STROKE + HEAD_R;

  return {
    plinth: {
      halo: haloOf(PLINTH, -PLINTH_H - FOOT_H, PLINTH_H, P),
      feet: corners(PLINTH, 20).map(([fx, fy]) => cylinder(fx, fy, FOOT_R, -PLINTH_H - FOOT_H, FOOT_H, P, 24)),
      slab: slabOf(PLINTH, -PLINTH_H, PLINTH_H, P, 8, 1.4),
      seam: sideSeam(PLINTH, -PLINTH_H / 2, P, 8),
      groove: planOutline(insetPlan(PLINTH, 5), 0, P),
      screwRings: joinPaths(corners(PLINTH, 10).map(([sx, sy]) => ring(sx, sy, 1.7, 0, P, 16))),
      screws: dots(corners(PLINTH, 10).map(([sx, sy]) => [sx, sy, 0])),
      plate: slabOf(plate, 0, 0.6, P, 2),
      plateRules: joinPaths([0, 1, 2].map((row) => lineOnTop([plate.x + 6, plate.y + 1.8 + row * 1.6], [plate.x + plate.w - (row === 2 ? 20 : 6), plate.y + 1.8 + row * 1.6], 0.6, P))),
      plateScrews: dots([
        [plate.x + 2.4, plate.y + plate.d / 2, 0.6],
        [plate.x + plate.w - 2.4, plate.y + plate.d / 2, 0.6],
      ]),
    },
    dial: {
      ringBase: cylinder(DIAL_X, DIAL_Y, DIAL_RING_R, 0, DIAL_RING_H, P, 72, 0.6),
      face: cylinder(DIAL_X, DIAL_Y, DIAL_R, DIAL_RING_H, DIAL_TOP - DIAL_RING_H, P, 72, 0.5),
      bezel: ring(DIAL_X, DIAL_Y, DIAL_R - 1.6, DIAL_TOP, P, 72),
      ticks: radialTicks(DIAL_X, DIAL_Y, TICK_R, 96, 4, DIAL_TOP, [1.8, 3.6], P),
      // Çentiklerin dibinde iç halka: her çentik bir çizgide biter (lines.mjs).
      tickRing: ring(DIAL_X, DIAL_Y, TICK_R - 3.6, DIAL_TOP, P, 72),
      arcTrack: ring(DIAL_X, DIAL_Y, WEDGE_R, DIAL_TOP, P, 72),
      // Renkli dilimler kadranı okutuyor: hangi saat hangi seans bir bakışta.
      wedges: days.map((segment) => ({ kind: segment.kind, d: wedgePath(segment, WEDGE_R) })),
      arcs: days.map((segment) => ({ kind: segment.kind, d: onTop(arcPoints(segment, WEDGE_R), DIAL_TOP, P) })),
      contacts: day.tradingToday ? [day.open, day.close].map((m) => cylinder(...contactAt(m), CONTACT_R, DIAL_TOP, CONTACT_H, P, 14)) : [],
      hub: cylinder(DIAL_X, DIAL_Y, HUB_R, DIAL_TOP, HUB_H, P, 24, 0.4),
      hubPin: dots([[DIAL_X, DIAL_Y, DIAL_TOP + HUB_H]]),
      label: topMatrix([DIAL_X, DIAL_Y + 17], DIAL_TOP, P),
      /* Saat rakamları (15 Ekim): kadran yalnız çentik ve renkli dilimdi;
         "hangi saat nerede" sorusunu dışarıdaki seans kartları cevaplıyordu
         ama kadranın KENDİSİ cevaplamıyordu — "ne anlatıyor" şikâyetinin
         kökü. Dört ana saat NY ekseninde (00 tepede, model.ts), dilimlerin
         içinde r=32,5'te: çentik halkasına (39,9) değmiyor, göbekten (3,6)
         uzak. */
      hours: [0, 6, 12, 18].map((hour) => ({
        text: String(hour).padStart(2, "0"),
        transform: topMatrix(onDial(angleOf(hour * 60), 32.5), DIAL_TOP, P),
      })),
      terminal: cylinder(terminal[0], terminal[1], 2.2, 0, 4.5, P, 16),
      terminalRing: ring(terminal[0], terminal[1], 1, 4.5, P, 12),
    },
    yoke: {
      backFoot: slabOf(foot(backY), 0, 2, P, 2),
      frontFoot: slabOf(foot(frontY), 0, 2, P, 2),
      // Her ayağın vidası kendi direğinin katmanında: arka ayağınkiler ön
      // katmanda çizilince çanın gövdesinin ÜSTÜNDE iki nokta duruyordu (3× bakışta görüldü).
      backScrews: dots(corners(foot(backY), 2.4).map(([fx, fy]) => [fx, fy, 2] as Point3)),
      frontScrews: dots(corners(foot(frontY), 2.4).map(([fx, fy]) => [fx, fy, 2] as Point3)),
      back: slabOf(post(backY), 2, POST_H - 2, P, 2, 0.6),
      front: slabOf(post(frontY), 2, POST_H - 2, P, 2, 0.6),
      frontSeam: sideSeam(post(frontY), 14, P, 2),
      bar: slabOf(bar, POST_H, BAR_H, P, 2, 0.8),
      barScrews: dots([backY, frontY, BELL_Y].map((y) => [BELL_X, y, POST_H + BAR_H] as Point3)),
    },
    bell: {
      halo: haloOf({ x: BELL_X - 18, y: BELL_Y - 18, w: 36, d: 36, r: 18 }, 0, 1, P),
      hanger: cylinder(BELL_X, BELL_Y, HANGER_R, BELL_Z + BELL_HEIGHT - 1, POST_H - (BELL_Z + BELL_HEIGHT - 1), P, 18),
      body: G.solidOf(BELL_PROFILE, F, P) as SolidPaths,
      lip: G.arcOf(F, 2.8, 22, P, { slope: -0.4 }) as string,
      band: G.arcOf(F, 25, 14.1, P, { slope: -0.2 }) as string,
    },
    striker: {
      stand: slabOf(STAND, 0, STAND_H, P, 2, 0.5),
      standScrews: dots(corners(STAND, 2.6).map(([sx, sy]) => [sx, sy, 0])),
      coil: slabOf(COIL, STAND_H, COIL_H, P, 3, 0.8),
      coilSeams: joinPaths([4, 8].map((dz) => sideSeam(COIL, STAND_H + dz, P, 3))),
      coilScrews: dots(corners(COIL, 3).map(([cx, cy]) => [cx, cy, STAND_H + COIL_H])),
      rod: G.disc(0, COIL.x - headX, 1.4, strikeAxis, P) as SolidPaths,
      head: G.sphereOf([headX, BELL_Y, STRIKE_Z], HEAD_R, P) as SolidPaths,
    },
    wire: {
      from: at([terminal[0], terminal[1], 4.5]),
      via: [
        at([8, 52, 0.4]),
        at([84, 52, 0.4]),
        at([100, 30, 0.4]),
      ],
      to: at([100, STAND.y + STAND.d, 8]),
    },
  };
}

export type BellArt = ReturnType<typeof build>;

const cache = new Map<string, BellArt>();
export function bellArt(day: BellDay): BellArt {
  const key = `${day.tradingToday}:${day.preOpen}:${day.open}:${day.close}:${day.afterClose}`;
  let art = cache.get(key);
  if (!art) cache.set(key, (art = build(day)));
  return art;
}
