import { FEED_DELAY_MINUTES, type MarketStatus } from "./market-hours";
import type { Locale } from "./i18n/config";

/**
 * TELEGRAM GÖNDERİCİSİNİN SAATİ — saf, test edilir (24 Ekim).
 *
 * `/api/cron/telegram` beş dakikada bir koşar ve her koşuda "şimdi
 * gönderilecek ne var" diye sorar (alarm taramasının kalıbı). Pencereler
 * SABİT SAAT DEĞİL, seansın kendi anlarından: açılış `status.nextOpen`,
 * kapanış `status.closeMinutes` (yarım gün dahil), bitiş `status.sessionEnd`
 * — hepsi `lib/market-hours.ts`ten. Yaz saati farkı (açılış yazın 16:30,
 * kışın 17:30 TR) kendiliğinden doğru.
 *
 * Tekrar gönderimi pencere değil DEFTER önler (`telegram_posts`, anahtar
 * `postKey`); pencere yalnız "ne zaman denenir" sorusu.
 */

export type PostKind = "acilis" | "kapanis" | "mercek" | "makro";

/** Açılıştan kaç dakika önce denemeye başlanır. */
export const PRE_OPEN_LEAD_MINUTES = 15;
/**
 * Bülten yazılmadıysa en son bu kadar dakika kala bültensiz gider.
 * Günlük bülten 16:10 TR'de yazılıyor (lib/data.ts → BRIEF_PUBLISH_TR);
 * kışın açılışa 80 dakika var, yazın 20 — yani yazın pencere bülteni
 * çoğu gün yakalar, yakalayamazsa takvim yine açılıştan önce kanalda olur.
 */
export const PRE_OPEN_FINAL_MINUTES = 5;
/**
 * Kapanıştan kaç dakika sonra denenir: beslemenin gecikmesi
 * (`FEED_DELAY_MINUTES`, 15) + kapanış müzayedesinin tape'e düşme payı
 * (15). Daha erken sorulan gün barı seansın son çeyreğini kaçırabilir.
 */
export const CLOSE_SETTLE_MINUTES = FEED_DELAY_MINUTES + 15;
/** Yeni Mercek yazısı ve açıklanan makro veri bu kadar saat "yeni" sayılır. */
export const FRESH_HOURS = 6;

const MINUTE_MS = 60_000;

type StatusClock = Pick<
  MarketStatus,
  "tradingToday" | "etDate" | "etMinutes" | "sessionDate" | "closeMinutes" | "nextOpen" | "sessionEnd"
>;

/**
 * Açılış öncesi pencere: bugün işlem günü ve açılışa `PRE_OPEN_LEAD_MINUTES`
 * ya da daha az kaldı. `final`: bülten beklenmeden gönderilecek son an.
 * `nextOpen` bugünün açılışı olmalı — gece yarısından sonraki saatlerde
 * (ET) bir sonraki açılış aynı gün; hafta sonu `tradingToday` zaten false.
 */
export function preOpenWindow(status: StatusClock, now: Date): { due: boolean; final: boolean } {
  const left = status.nextOpen.getTime() - now.getTime();
  const due =
    status.tradingToday &&
    left > 0 &&
    left <= PRE_OPEN_LEAD_MINUTES * MINUTE_MS;
  return { due, final: due && left <= PRE_OPEN_FINAL_MINUTES * MINUTE_MS };
}

/**
 * Kapanış sonrası pencere: bugünün seansı kapandı, beslemenin payı geçti ve
 * akşam seansının (+ gecikme) sonu gelmedi. Anlatılan seans BUGÜN olmalı —
 * gece yarısından sonra (ET) `sessionDate` dünü gösterir ve o mesaj zaten
 * gitti ya da kaçtı; ertesi sabah dünün kapanışını göndermek haber değil.
 */
export function closeWindow(status: StatusClock, now: Date): boolean {
  return (
    status.tradingToday &&
    status.sessionDate === status.etDate &&
    status.etMinutes >= status.closeMinutes + CLOSE_SETTLE_MINUTES &&
    now.getTime() < status.sessionEnd.getTime()
  );
}

/** `at` son `FRESH_HOURS` içinde mi (gelecekteki an da değil). */
export function isFresh(at: Date | null, now: Date, hours: number = FRESH_HOURS): boolean {
  if (!at) return false;
  const age = now.getTime() - at.getTime();
  return age >= 0 && age <= hours * 60 * MINUTE_MS;
}

/** Defter anahtarı: `telegram:{tür}:{anahtar}:{dil}`. */
export function postKey(kind: PostKind, id: string, locale: Locale): string {
  return `telegram:${kind}:${id}:${locale}`;
}

/**
 * "Büyük makro veri" — kanala ayrı mesajla düşen olay aileleri
 * (`eventFamily`, lib/day-flow.ts). TÜFE, çekirdek TÜFE, Fed faiz kararı,
 * tarım dışı istihdam ve işsizlik oranı: sitenin takviminde "high" olan ve
 * gerçekleşen değeri FRED'den okunabilenler. Basın toplantısı ve nokta
 * grafiği bir SAYI açıklamadığı için yok.
 */
export const MAJOR_MACRO = new Set(["cpi", "core-cpi", "fomc-rate", "nfp", "unemployment"]);
