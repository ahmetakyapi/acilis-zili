/**
 * SEANS ZİLİ — saf model (DOM yok, test: tests/session-bell.test.ts).
 *
 * Nesne açıklamanın kendisi (anatomy): 24 saatlik bir kadran New York
 * saatini gösterir; üstünde günün seansları yay olarak çizili (ön seans,
 * asıl seans, akşam seansı). Asıl seansın iki ucunda birer kontak var: ibre
 * kontağın üstünden geçince devre kapanır, kablodaki darbe bobine ulaşır,
 * dövücü çanı vurur. Açılışta ve kapanışta, yani gerçek zil anlarında.
 *
 * Saatler lib/market-hours.ts'in sonucundan gelir (yarım gün, tatil, hafta
 * sonu dahil); burada yalnız dakika aritmetiği var. Sabit saat yazılmaz.
 */

export const DAY = 24 * 60;

export type BellDay = {
  /** Bugün işlem var mı (tatil ve hafta sonu hayır). */
  tradingToday: boolean;
  /** ET dakika: ön seans başı, açılış, kapanış (yarım günde erken), akşam sonu. */
  preOpen: number;
  open: number;
  close: number;
  afterClose: number;
  /** TR saatinin ET'den farkı (dakika; yaz saati geçişlerinde değişir). */
  trOffset: number;
};

export type Segment = { kind: "pre" | "regular" | "after"; from: number; to: number };
export type SessionKind = Segment["kind"] | "closed";
export type Strike = { at: number; bell: "open" | "close" };

/** Günün seans yayları. İşlem olmayan günde boş: kadranda yay yok, zil çalmaz. */
export function segments(day: BellDay): Segment[] {
  if (!day.tradingToday) return [];
  return [
    { kind: "pre", from: day.preOpen, to: day.open },
    { kind: "regular", from: day.open, to: day.close },
    { kind: "after", from: day.close, to: day.afterClose },
  ];
}

/** Kadranın açısı (radyan): 00:00 kadranın arkasında (−y), saat yönünde. */
export const angleOf = (minutes: number) => (((minutes % DAY) + DAY) % DAY / DAY) * Math.PI * 2;

/** Açıdan dakikaya (kadrana dokunulunca). 15 dakikalık çentiğe oturur. */
export function minutesOfAngle(angle: number, snap = 15) {
  const turn = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return (Math.round(((turn / (Math.PI * 2)) * DAY) / snap) * snap) % DAY;
}

export function sessionAt(minutes: number, day: BellDay): SessionKind {
  const m = ((minutes % DAY) + DAY) % DAY;
  return segments(day).find((segment) => m >= segment.from && m < segment.to)?.kind ?? "closed";
}

/**
 * İbre `from`dan `to`ya ileri giderken geçtiği ziller. Geri giderken zil
 * çalmaz (kadranı geri sarmak açılışı yeniden yaşatmaz). Gece yarısını
 * geçen tur desteklenir; bir turdan uzun yol tek tur sayılır.
 */
export function strikesBetween(from: number, to: number, day: BellDay): Strike[] {
  if (!day.tradingToday || to <= from) return [];
  const out: Strike[] = [];
  const span = Math.min(to - from, DAY);
  for (const [bell, at] of [
    ["open", day.open],
    ["close", day.close],
  ] as const) {
    // `from`dan sonraki ilk `at` (gün katları kadar ileri)
    const next = at + Math.ceil((from + 1e-9 - at) / DAY) * DAY;
    if (next - from <= span) out.push({ at: next, bell });
  }
  return out.sort((a, b) => a.at - b.at);
}

/* Vuruş zarfı (sn). Dövücü 60 ms'de çana gider, 220 ms'de döner; çan
   1,2 sn titrer (sönümlü sinüs, 14 Hz). Ses yok: sitede ses kaldırıldı. */
export const PLUNGE_OUT = 0.06;
export const PLUNGE_BACK = 0.22;
export const RING = 1.2;
const RING_HZ = 14;

/** Dövücünün çana doğru yolu (0 dinlenme, 1 temas), vuruşun yaşına göre. */
export function plungeAt(age: number) {
  if (age < 0 || age >= PLUNGE_OUT + PLUNGE_BACK) return 0;
  if (age < PLUNGE_OUT) return age / PLUNGE_OUT;
  const back = (age - PLUNGE_OUT) / PLUNGE_BACK;
  return 1 - back * back * (3 - 2 * back);
}

/** Çanın titreşimi (−1..1 çarpı genlik): vuruştan sonra söner, sonunda tam 0. */
export function ringAt(age: number) {
  if (age < PLUNGE_OUT || age >= RING) return 0;
  const t = age - PLUNGE_OUT;
  const decay = Math.exp(-t * 4.2) * (1 - t / (RING - PLUNGE_OUT));
  return Math.sin(t * RING_HZ * Math.PI * 2) * decay;
}

/* İlk görünüşte günün tekrarı: ibre 00:00'dan şimdiye 3,2 sn'de gelir
   (ease-in-out-quart), yolda açılış ya da kapanışı geçerse zil çalar. */
export const SWEEP = 3.2;
const inOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
export const sweepAt = (t: number, now: number) => now * inOutQuart(Math.min(1, Math.max(0, t / SWEEP)));

export type BellText = {
  sessions: Record<SessionKind, string>;
  /** "{tr} TR · {ny} NY" sırası dile göre (TR önce, EN'de NY önce). */
  clock: string;
  /** "{d} sonra açılış" gibi geri sayım kalıpları ve süre birimleri. */
  toOpen: string;
  toClose: string;
  units: { day: string; hour: string; minute: string };
};

export const hhmm = (minutes: number) => {
  const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** "18:50 TR · 11:50 NY": iki saat, sıra dile göre. */
export const clockOf = (minutes: number, day: BellDay, text: Pick<BellText, "clock">) =>
  text.clock.replace("{tr}", hhmm(minutes + day.trOffset)).replace("{ny}", hhmm(minutes));

/** Süre: "1 g 14 sa", "4 sa 10 dk", "8 dk". Saniye yok (5 sn'de bir yazılıyor). */
export function durationOf(ms: number, units: BellText["units"]) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / DAY);
  const hours = Math.floor((minutes % DAY) / 60);
  const rest = minutes % 60;
  if (days > 0) return hours > 0 ? `${days} ${units.day} ${hours} ${units.hour}` : `${days} ${units.day}`;
  if (hours > 0) return rest > 0 ? `${hours} ${units.hour} ${rest} ${units.minute}` : `${hours} ${units.hour}`;
  return `${rest} ${units.minute}`;
}

/**
 * Sıradaki zil ve ona kalan süre. Zamanlar `getMarketStatus`ın
 * `nextOpen`/`nextClose`u: tatil ve yarım gün orada çözülmüş. Asıl seanstayken
 * kapanış zili, değilse açılış zili.
 */
export function nextBellOf(nowMs: number, minutes: number, day: BellDay, nextOpenMs: number, nextCloseMs: number) {
  const regular = sessionAt(minutes, day) === "regular";
  return { bell: regular ? ("close" as const) : ("open" as const), ms: (regular ? nextCloseMs : nextOpenMs) - nowMs };
}

export function countdownOf(nowMs: number, minutes: number, day: BellDay, nextOpenMs: number, nextCloseMs: number, text: BellText) {
  const next = nextBellOf(nowMs, minutes, day, nextOpenMs, nextCloseMs);
  return (next.bell === "close" ? text.toClose : text.toOpen).replace("{d}", durationOf(next.ms, text.units));
}
