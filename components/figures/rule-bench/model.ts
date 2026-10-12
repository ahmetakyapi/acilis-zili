/**
 * KURAL TEZGÂHI — saf model (DOM yok, test: tests/rule-bench.test.ts).
 *
 * Nesne açıklamanın kendisi (anatomy): hisse bir iş parçası olarak rayda yedi
 * istasyondan geçer. İlki eleme kapısı; kalırsa kapının kolu iner ve parça
 * orada durur. Her istasyonun üstündeki lambalar o kategorinin kurallarıdır:
 * istasyonun yoklayıcısı parçaya iner, lambalar birer birer yanar.
 *
 * Her sayı lib/screening.ts'in sonucundan gelir; figür hiçbir şey hesaplamaz,
 * yalnız gösterir. Puan ve bant raporun kendi değerleri.
 */

import type { CheckStatus } from "@/lib/screening";

export type BenchStation = {
  id: string;
  name: string;
  /** Kategori puanı (0–100); eleme kapısında ve ölçülemeyende null. */
  score: number | null;
  statuses: CheckStatus[];
};

export type BenchData = {
  symbol: string;
  stations: BenchStation[];
  score: number | null;
  eliminated: boolean;
};

export type BenchText = {
  passed: string; // "Geçen {n}"
  warned: string;
  failed: string;
  missing: string;
  score: string; // "Puan {n}"
  gatePass: string;
  gateFail: string;
};

/** Bir pozun bütün hâli: kızağın yeri (istasyon dizini, kesirli), her istasyonun
 *  yoklayıcı inişi (0–1), kaç lambası yandı ve kapı kolu. */
export type Pose = {
  carriage: number;
  dips: number[];
  lit: number[];
  armDown: boolean;
};

/* Zaman çizelgesi (sn). Kızak istasyonlar arasında 0,6 sn'de yol alır
   (ekran boyunca taşıma, ease-in-out); istasyonda 0,9 sn kalır: yoklayıcı
   0,2 sn'de iner, lambalar 90 ms arayla yanar, 0,25 sn'de kalkar. Son pozda
   4 sn durur, sonra 0,8 sn'de baştan alır. */
export const START = 0.6;
export const TRAVEL = 0.6;
export const DWELL = 0.9;
export const DIP_IN = 0.2;
export const LAMP_GAP = 0.09;
export const DIP_OUT = 0.25;
export const HOLD = 4;
export const RESET = 0.8;

/** Kızağın başladığı yer: rayın sol ucu, kapının hemen solu (dizin cinsinden;
 *  sol durdurucuya değmeden). */
export const HOME = -0.42;

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const inOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

/** Kızağın uğradığı son istasyon: elendiyse kapı (0), yoksa sonuncusu. */
export const lastStop = (data: BenchData) => (data.eliminated ? 0 : data.stations.length - 1);

/** Tur bittiğinde ve sunucuda basılan poz: bütün lambalar yanık, kızak son durakta. */
export function finalPose(data: BenchData): Pose {
  const last = lastStop(data);
  return {
    carriage: last,
    dips: data.stations.map(() => 0),
    lit: data.stations.map((station, index) => (index <= last ? station.statuses.length : 0)),
    armDown: data.eliminated,
  };
}

export function loopLength(data: BenchData) {
  return START + (lastStop(data) + 1) * (TRAVEL + DWELL) + HOLD + RESET;
}

/** Boşta tur: t anındaki poz. Deterministik; aynı t aynı pozu verir. */
export function tourAt(t: number, data: BenchData): Pose {
  const n = data.stations.length;
  const last = lastStop(data);
  const time = t % loopLength(data);
  const pose: Pose = { carriage: HOME, dips: Array(n).fill(0), lit: Array(n).fill(0), armDown: false };
  const runEnd = START + (last + 1) * (TRAVEL + DWELL);

  if (time >= runEnd) {
    const final = finalPose(data);
    // Son bekleme, sonra sıfırlama: lambalar söner, kızak eve döner.
    if (time < runEnd + HOLD) return final;
    const back = inOutQuart(clamp((time - runEnd - HOLD) / RESET));
    return { ...final, carriage: final.carriage + (HOME - final.carriage) * back, lit: final.lit.map(() => 0), armDown: false };
  }
  if (time < START) return pose;

  const into = time - START;
  const leg = Math.floor(into / (TRAVEL + DWELL));
  const local = into - leg * (TRAVEL + DWELL);
  for (let index = 0; index < leg; index++) pose.lit[index] = data.stations[index].statuses.length;

  if (local < TRAVEL) {
    pose.carriage = leg - 1 + inOutQuart(local / TRAVEL);
    if (leg === 0) pose.carriage = HOME + (0 - HOME) * inOutQuart(local / TRAVEL);
    return pose;
  }
  pose.carriage = leg;
  const dwell = local - TRAVEL;
  const count = data.stations[leg].statuses.length;
  const outAt = DIP_IN + count * LAMP_GAP + 0.1;
  pose.dips[leg] = dwell < DIP_IN ? inOutQuart(dwell / DIP_IN) : dwell < outAt ? 1 : 1 - inOutQuart(clamp((dwell - outAt) / DIP_OUT));
  pose.lit[leg] = Math.min(count, Math.max(0, Math.floor((dwell - DIP_IN) / LAMP_GAP) + 1));
  if (dwell < DIP_IN) pose.lit[leg] = 0;
  // Elendiyse kol, kapının lambaları yandıktan sonra iner.
  if (data.eliminated && leg === 0 && pose.lit[0] === count) pose.armDown = true;
  return pose;
}

const count = (statuses: CheckStatus[], status: CheckStatus) => statuses.filter((s) => s === status).length;

/** Künye: istasyona özgü ya da (index null) bütün tezgâh. Sıfır olan sayaç yazılmaz. */
export function readoutOf(data: BenchData, index: number | null, text: BenchText): string {
  if (index !== null) {
    const station = data.stations[index];
    if (index === 0) return `${station.name} · ${data.eliminated ? text.gateFail : text.gatePass}`;
    const parts = [station.name];
    if (station.score !== null) parts.push(text.score.replace("{n}", String(Math.round(station.score))));
    parts.push(...tally(station.statuses, text));
    return parts.join(" · ");
  }
  const parts = data.score !== null ? [text.score.replace("{n}", String(data.score))] : [];
  // Elenen parça kapıdan geçmez: bütün tezgâhın sayımı değil kapının hükmü.
  if (data.eliminated) return [...parts, `${data.stations[0].name} · ${text.gateFail}`].join(" · ");
  const all = data.stations.flatMap((station) => station.statuses);
  return [...parts, ...tally(all, text)].join(" · ");
}

function tally(statuses: CheckStatus[], text: BenchText): string[] {
  return (
    [
      [text.passed, count(statuses, "pass")],
      [text.warned, count(statuses, "warn")],
      [text.failed, count(statuses, "fail")],
      [text.missing, count(statuses, "na")],
    ] as const
  )
    .filter(([, n]) => n > 0)
    .map(([label, n]) => label.replace("{n}", String(n)));
}
