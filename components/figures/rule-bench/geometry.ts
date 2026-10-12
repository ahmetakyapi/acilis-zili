import {
  corners,
  cylinder,
  haloOf,
  insetPlan,
  lineOnTop,
  joinPaths,
  planOutline,
  pointsAt,
  ring,
  sideSeam,
  slabOf,
  topMatrix,
  topTicks,
  type Flat,
  type Plan,
  type Point3,
  type SolidPaths,
} from "@/components/iso/iso-kit";
import {
  ARM_H,
  ARM_HALF,
  ARM_LEN,
  ARM_Z,
  BASE,
  BASE_H,
  BLOCK_D,
  BLOCK_H,
  BLOCK_W,
  BLOCK_Y,
  FOOT_H,
  FOOT_R,
  GATE_ARM_X,
  HOUSING_R,
  HOUSING_Z,
  HUB_H,
  HUB_R,
  HUB_Y,
  LAMP_GAP,
  LAMP_H,
  LAMP_R,
  LAMP_Y,
  P,
  PART,
  PART_H,
  PART_Z,
  POST_R,
  POST_Y,
  PROBE_Y,
  RAIL,
  RAIL_H,
  REST_Y,
  ROD_R,
  ROD_TIP,
  RULER,
  RULER_H,
  SLED,
  SLED_H,
  SLED_Z,
  STATIONS,
  stationX,
} from "./view";

/**
 * Bütün statik yollar burada, bir kez. Lamba sayısı kategoriye göre değişir
 * (eleme kapısı 3, büyüme 4 …); geometri sayılar dizisinden kurulur ve aynı
 * diziyle tekrar çağrılınca önbellekten döner. Hareket eden parçalar (kızak,
 * yoklayıcı çubukları, kapı kolu) dinlenme yerinde kurulur; canlı bileşen
 * onları translate ile taşır ya da iki hâlden birini gösterir.
 */

const dots = (points: Point3[]): Flat[] => pointsAt(points, P);
const blockPlan = (index: number): Plan => ({ x: stationX(index) - BLOCK_W / 2, y: BLOCK_Y, w: BLOCK_W, d: BLOCK_D, r: 2 });

/** i. istasyonun j. lambasının merkezi (x); lambalar bloğun ortasına dizilir. */
export const lampX = (index: number, lamp: number, count: number) => stationX(index) + (lamp - (count - 1) / 2) * LAMP_GAP;

export type StationArt = {
  block: SolidPaths;
  seam: string;
  screws: Flat[];
  bezels: string;
  lamps: SolidPaths[];
  post: SolidPaths;
  arm: SolidPaths;
  armLine: string;
  armScrews: Flat[];
  housing: SolidPaths;
  rod: SolidPaths;
};

export type BenchArt = {
  base: {
    halo: string;
    feet: SolidPaths[];
    slab: SolidPaths;
    groove: string;
    screwRings: string;
    screws: Flat[];
    plate: SolidPaths;
    plateRules: string;
    plateScrews: Flat[];
  };
  rail: { stops: SolidPaths[]; bar: SolidPaths; stopScrews: Flat[] };
  ruler: { strip: SolidPaths; edge: string; minor: string; major: string };
  stations: StationArt[];
  sled: { halo: string; plate: SolidPaths; groove: string; part: SolidPaths; label: string };
  gate: { hub: SolidPaths; hubRing: string; rest: SolidPaths; up: SolidPaths; down: SolidPaths };
};

function stationArt(index: number, count: number): StationArt {
  const x = stationX(index);
  const plan = blockPlan(index);
  const top = BLOCK_H;
  const armPlan: Plan = { x: x - ARM_HALF, y: POST_Y - POST_R, w: ARM_HALF * 2, d: PROBE_Y + HOUSING_R - (POST_Y - POST_R), r: 1 };
  return {
    block: slabOf(plan, 0, BLOCK_H, P, 3, 0.8),
    // Gövdenin ön yüzünde kapak birleşim çizgisi: köşeleri sararak, siluette biter.
    seam: sideSeam(plan, 7, P, 3),
    screws: dots(corners(plan, 2.6).map(([px, py]) => [px, py, top])),
    bezels: joinPaths(Array.from({ length: count }, (_, lamp) => ring(lampX(index, lamp, count), LAMP_Y, LAMP_R + 0.9, top, P, 20))),
    lamps: Array.from({ length: count }, (_, lamp) => cylinder(lampX(index, lamp, count), LAMP_Y, LAMP_R, top, LAMP_H, P, 18)),
    post: cylinder(x, POST_Y, POST_R, top, ARM_Z - top, P, 18),
    arm: slabOf(armPlan, ARM_Z, ARM_H, P, 2, 0.5),
    // Kolun sırt çizgisi iki vidanın arasında: iki ucu da bir noktada biter (lines.mjs).
    armLine: lineOnTop([x, POST_Y], [x, PROBE_Y], ARM_Z + ARM_H, P),
    armScrews: dots([
      [x, POST_Y, ARM_Z + ARM_H],
      [x, PROBE_Y, ARM_Z + ARM_H],
    ]),
    housing: cylinder(x, PROBE_Y, HOUSING_R, HOUSING_Z, ARM_Z - HOUSING_Z, P, 22, 0.4),
    rod: cylinder(x, PROBE_Y, ROD_R, ROD_TIP, HOUSING_Z - ROD_TIP, P, 14),
  };
}

const RULER_FROM = -100;
const RULER_TO = 162;

function build(counts: number[]): BenchArt {
  const footAt = corners(BASE, 18);
  const plate: Plan = { x: 120, y: 37.5, w: 44, d: 5, r: 0.8 };
  const sled = SLED;
  const stop = (x: number): Plan => ({ x, y: RAIL.y - 2, w: 5, d: RAIL.d + 4, r: 1 });
  return {
    base: {
      halo: haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P),
      feet: footAt.map(([fx, fy]) => cylinder(fx, fy, FOOT_R, -BASE_H - FOOT_H, FOOT_H, P, 24)),
      slab: slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.2),
      groove: planOutline(insetPlan(BASE, 4.5), 0, P),
      screwRings: joinPaths(corners(BASE, 9).map(([sx, sy]) => ring(sx, sy, 1.6, 0, P, 16))),
      screws: dots(corners(BASE, 9).map(([sx, sy]) => [sx, sy, 0])),
      plate: slabOf(plate, 0, 0.6, P, 2),
      plateRules: joinPaths(
        [0, 1, 2].map((row) => lineOnTop([plate.x + 6, plate.y + 1.3 + row * 1.2], [plate.x + plate.w - (row === 2 ? 18 : 6), plate.y + 1.3 + row * 1.2], 0.6, P)),
      ),
      plateScrews: dots([
        [plate.x + 2.4, plate.y + plate.d / 2, 0.6],
        [plate.x + plate.w - 2.4, plate.y + plate.d / 2, 0.6],
      ]),
    },
    rail: {
      stops: [stop(RAIL.x - 5), stop(RAIL.x + RAIL.w)].map((p) => slabOf(p, 0, RAIL_H + 4, P, 2, 0.5)),
      bar: slabOf(RAIL, 0, RAIL_H, P, 2, 0.6),
      stopScrews: dots([
        [RAIL.x - 2.5, RAIL.y + RAIL.d / 2, RAIL_H + 4],
        [RAIL.x + RAIL.w + 2.5, RAIL.y + RAIL.d / 2, RAIL_H + 4],
      ]),
    },
    ruler: (() => {
      const ticks = topTicks(RULER_FROM, RULER_TO, 5, 5, RULER.y + 1, RULER_H, [2.2, 4.2], P);
      return {
        strip: slabOf(RULER, 0, RULER_H, P, 2),
        edge: lineOnTop([RULER_FROM, RULER.y + 1], [RULER_TO, RULER.y + 1], RULER_H, P),
        minor: ticks.minor,
        major: ticks.major,
      };
    })(),
    stations: Array.from({ length: STATIONS }, (_, index) => stationArt(index, counts[index] ?? 0)),
    sled: {
      halo: haloOf(sled, SLED_Z, SLED_H, P),
      plate: slabOf(sled, SLED_Z, SLED_H, P, 3, 0.6),
      groove: planOutline(insetPlan(sled, 1.4), SLED_Z + SLED_H, P, 3),
      part: slabOf(PART, PART_Z, PART_H, P, 3, 0.8),
      label: topMatrix([PART.x + PART.w / 2, PART.y + PART.d / 2], PART_Z + PART_H, P),
    },
    gate: {
      hub: cylinder(GATE_ARM_X, HUB_Y, HUB_R, 0, HUB_H, P, 24, 0.4),
      hubRing: ring(GATE_ARM_X, HUB_Y, 1.2, HUB_H, P, 14),
      rest: cylinder(GATE_ARM_X, REST_Y, 1.8, 0, HUB_H - 2, P, 16),
      // İki hâl: dik bekleyen kol ve rayın üstüne yatmış kol (ucu dayanak direğinde).
      up: slabOf({ x: GATE_ARM_X - 1.6, y: HUB_Y - 1.6, w: 3.2, d: 3.2, r: 0.8 }, HUB_H, ARM_LEN, P, 2),
      down: slabOf({ x: GATE_ARM_X - 1.6, y: HUB_Y - ARM_LEN + 1.6, w: 3.2, d: ARM_LEN, r: 0.8 }, HUB_H - 2, 3, P, 2, 0.4),
    },
  };
}

const cache = new Map<string, BenchArt>();
export function benchArt(counts: number[]): BenchArt {
  const key = counts.join(",");
  let art = cache.get(key);
  if (!art) cache.set(key, (art = build(counts)));
  return art;
}
