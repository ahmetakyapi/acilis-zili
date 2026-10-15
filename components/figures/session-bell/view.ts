import { boxCorners, fitProjection, iso, type Plan, type Point3 } from "@/components/iso/iso-kit";

/**
 * Seans Zili'nin dünyası: x tezgâh boyunca (solda kadran, sağda çan), y
 * derinlik (+y okuyucuya yakın), z yukarı. Birim ~1 px. Azimut 55.
 */

export const WIDTH = 640;
export const HEIGHT = 330;
export const AZIMUTH = 55;

export const PLINTH: Plan = { x: -132, y: -62, w: 252, d: 124, r: 10 };
export const PLINTH_H = 10;
export const FOOT_R = 7;
export const FOOT_H = 4;

/** Kadran: taban halkası, yüz, çentikler, seans yayları, kontaklar, ibre. */
export const DIAL_X = -60;
export const DIAL_Y = 2;
export const DIAL_RING_R = 49;
export const DIAL_RING_H = 2;
export const DIAL_R = 45;
export const DIAL_TOP = DIAL_RING_H + 2.4;
export const TICK_R = 43.5;
/** Seans dilimlerinin yarıçapı: çentik halkasının hemen içi. */
export const WEDGE_R = 39.4;
export const CONTACT_R = 1.9;
export const CONTACT_H = 1.4;
export const HUB_R = 3.6;
export const HUB_H = 2.4;
export const NEEDLE_R = 41;
export const NEEDLE_TAIL = 6;
export const NEEDLE_Z = DIAL_TOP + HUB_H - 0.4;

/** Çan boyunduruğu: önde ve arkada iki direk, üstte travers, çan ortada asılı. */
export const BELL_X = 52;
export const BELL_Y = 0;
export const BELL_Z = 24;
export const POST_W = 10;
export const POST_D = 8;
export const POST_Y = 34;
export const POST_H = 76;
export const BAR_H = 8;
export const HANGER_R = 2.8;

/** Bobin ve dövücü: kendi ayağında, çanın sağında; dövücü −x yönünde çana gider. */
export const STAND: Plan = { x: 92, y: -8, w: 16, d: 16, r: 2 };
export const STAND_H = 21;
export const COIL: Plan = { x: 88, y: -9.5, w: 24, d: 19, r: 3 };
export const COIL_H = 13;
export const STRIKE_Z = BELL_Z + 5;
export const HEAD_R = 3;
/** Dinlenmede dövücünün başı ile çanın ağzı arasındaki boşluk; vuruş bu kadar. */
export const STROKE = 2.4;

const fitPoints: Point3[] = [
  ...boxCorners(PLINTH, -PLINTH_H - FOOT_H, 0),
  [BELL_X - POST_W / 2, -POST_Y - POST_D, POST_H + BAR_H],
  [BELL_X + POST_W / 2, POST_Y + POST_D, POST_H + BAR_H],
];

/* Pay 18 → 10 (15 Ekim): makine kutusunda dört yanda 18 piksellik ölü hava
   taşıyordu ve telefonda zaten küçük olan sahneyi bir kademe daha
   küçültüyordu. 10 ile figür ~%5 büyüyor; overflow görünür (bell.css),
   taşma yok (390 ve 1280'de ölçüldü). */
export const P = fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 10, azimuth: AZIMUTH });
export const at = (point: Point3) => iso(point, P);

/** Kadranda açıdaki nokta (0 = −y, saat yönü; radialTicks ile aynı kural). */
export const onDial = (angle: number, radius: number): [number, number] => [
  DIAL_X + radius * Math.sin(angle),
  DIAL_Y - radius * Math.cos(angle),
];

const fine = (value: number) => Math.round(value * 10) / 10;

/**
 * İbre: ucu sivri, kuyruğu karşı ağırlıklı ince bir levha. Dönme bir ekran
 * dönüşümüyle yapılamaz (z ekseni çevresinde); açı başına yeniden kurulur,
 * bu yüzden ağır kit modülleri yerine yalnız `iso` ile burada. Sunucu da
 * istemci de aynı fonksiyonu çağırır.
 */
export function needlePath(angle: number) {
  const along = (r: number, side: number): Point3 => {
    const [x, y] = onDial(angle, r);
    return [x + side * Math.cos(angle), y + side * Math.sin(angle), NEEDLE_Z];
  };
  // Kuyruk küt ve kısa: sivri kuyruk ok ucu gibi okunup ibreyi ters gösteriyordu.
  const points = [along(NEEDLE_R, 0), along(3, 1.3), along(-NEEDLE_TAIL, 1.5), along(-NEEDLE_TAIL, -1.5), along(3, -1.3)];
  return `M${points.map((point) => at(point).map(fine).join(" ")).join("L")}Z`;
}
