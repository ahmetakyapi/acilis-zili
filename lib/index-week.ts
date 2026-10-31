import { todayEt } from "@/lib/market-hours";

/** Kartın yedek çizgisi kaç seansın hareketini anlatıyor. */
export const WEEK_SESSIONS = 5;

export type WeekLine = {
  /** Kapanışlar, eskiden yeniye — `WEEK_SESSIONS + 1` nokta (beş hareket). */
  points: { value: number }[];
  /** İlk kapanıştan son kapanışa yüzde değişim. */
  changePct: number;
};

/**
 * ENDEKS KARTININ YEDEK ÇİZGİSİ — son beş seansın kapanışları (31 Ekim).
 *
 * Kartın asıl çizgisi seansın gün içi şekli ve o yalnızca yüzde bu seansı
 * anlatıyorsa çiziliyor (`IndexLive` → "KIVILCIM ÇİZGİSİ SAYIYLA AYNI
 * SEANSI ANLATMALI"). Paket bayatken ya da kotasyonun dayanağı "Son
 * Kapanış" iken kart grafiksiz, düz bir fiyat kutusuna iniyordu. Yedek
 * çizgi günlük barlardan: altı kapanış, yani beş seansın hareketi.
 *
 * AYNI SEANS KURALI BURADA DA GEÇERLİ: çizginin son kapanışı, kartta
 * yazan fiyatın işlem gününe ait olmalı. Son günlük barın ET günü
 * kotasyonun `tradedAt` gününe eşit değilse (bar serisi bir gün geride,
 * ya da kotasyon önbellekten gelmiş eski bir gün) çizgi hiç çizilmiyor —
 * yoksa sayı bir günü, çizginin ucu başka bir günü anlatırdı.
 */
export function weekLine(
  bars: readonly { time: number; value: number }[],
  tradedAt: string | null,
  sessions: number = WEEK_SESSIONS,
): WeekLine | null {
  if (!tradedAt) return null;
  const traded = Date.parse(tradedAt);
  const last = bars.at(-1);
  if (!Number.isFinite(traded) || !last) return null;
  if (todayEt(new Date(last.time * 1000)) !== todayEt(new Date(traded))) return null;
  const shown = bars.slice(-(sessions + 1));
  if (shown.length < sessions + 1) return null;
  const first = shown[0]!.value;
  const end = shown.at(-1)!.value;
  if (!(first > 0) || !Number.isFinite(end)) return null;
  return { points: shown.map((bar) => ({ value: bar.value })), changePct: (end / first - 1) * 100 };
}
