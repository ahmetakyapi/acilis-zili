import { boxCorners, fitProjection, iso, type Plan, type Point3 } from "@/components/iso/iso-kit";

/**
 * Tezgâhın dünyası: x tezgâh boyunca (kızağın yolu), y derinlik (+y okuyucuya
 * yakın), z yukarı. Birim ~1 px. Kamera azimut 60: uzun kenar yatayda okunur.
 */

export const WIDTH = 640;
export const HEIGHT = 250;
export const AZIMUTH = 60;

export const STATIONS = 7;
export const PITCH = 46;
/** i. istasyonun merkezi (x). Kesirli dizin kızağın ara yerleri içindir. */
export const stationX = (index: number) => (index - (STATIONS - 1) / 2) * PITCH;

export const BASE: Plan = { x: -182, y: -48, w: 364, d: 92, r: 8 };
export const BASE_H = 8;
export const FOOT_H = 4;
export const FOOT_R = 6.5;

/** Ray: kızağın kaydığı çelik çubuk. */
export const RAIL: Plan = { x: -170, y: 14, w: 340, d: 10, r: 1.5 };
export const RAIL_H = 4;
/** Rayın önündeki cetvel şeridi. */
export const RULER: Plan = { x: -104, y: 28, w: 270, d: 8, r: 1 };
export const RULER_H = 1;

/** İstasyon gövdesi (mastar bloğu). */
export const BLOCK_W = 31;
export const BLOCK_Y = -38;
export const BLOCK_D = 16;
export const BLOCK_H = 20;
/** Lambalar bloğun üstünde, ön yarıda; yoklayıcının direği arka yarıda. */
export const LAMP_Y = -26.5;
export const LAMP_R = 2.8;
export const LAMP_H = 1.4;
export const LAMP_GAP = 7.2;
export const POST_Y = -33.5;
export const POST_R = 2.6;
export const ARM_Z = 27;
export const ARM_H = 3;
export const ARM_HALF = 2.2;
/** Yoklayıcının gövdesi rayın ortasında asılı; çubuk iner. */
export const PROBE_Y = 19;
export const HOUSING_R = 3.6;
export const HOUSING_Z = 21;
export const ROD_R = 1.3;
export const ROD_TIP = 15.5;
/** Yoklayıcının inişi: uç parçanın üstüne değer (15,5 → 13,5). */
export const DIP = 2;

/** Kızak ve iş parçası (hisse). x = 0'da kurulur, translate ile taşınır. */
export const SLED: Plan = { x: -12, y: 12.5, w: 24, d: 13, r: 2 };
export const SLED_Z = RAIL_H;
export const SLED_H = 3;
export const PART: Plan = { x: -8.5, y: 14, w: 17, d: 10, r: 1.6 };
export const PART_Z = SLED_Z + SLED_H;
export const PART_H = 6.5;

/** Eleme kapısının kolu: kapı ile ikinci istasyon arasında, rayın önündeki
 *  göbekten; dik bekler, elenince rayın üstüne yatar. */
export const GATE_ARM_X = stationX(0) + PITCH / 2;
export const HUB_Y = 33;
export const HUB_R = 3.2;
export const ARM_LEN = 26;
export const HUB_H = 10;
export const REST_Y = 8.5;

const fitPoints: Point3[] = [
  ...boxCorners(BASE, -BASE_H - FOOT_H, 0),
  ...boxCorners({ x: stationX(0) - BLOCK_W / 2, y: BLOCK_Y, w: stationX(STATIONS - 1) - stationX(0) + BLOCK_W, d: BLOCK_D, r: 0 }, 0, ARM_Z + ARM_H),
  [GATE_ARM_X, HUB_Y, HUB_H + ARM_LEN],
];

export const P = fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 16, azimuth: AZIMUTH });
export const at = (point: Point3) => iso(point, P);
