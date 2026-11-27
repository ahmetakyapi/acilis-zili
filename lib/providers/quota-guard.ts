/**
 * ALPACA KOTA KORUMASI (27 Kasım, sahibinin isteği: "Alpaca limiti doluyor,
 * düzeltir misin, tekrar yaşanmasın").
 *
 * Koşu Bekçisi 27 Kasım 15:08 UTC'de bildirdi: son bir saatte 143 istek 429
 * almış, kalan hak 0–1 (`/api/health`). Ücretsiz plan dakikada 200 istek ve
 * hesap başına; site her sayfada kendi sembol listesiyle anlık görüntü ve
 * gerçek zamanlı IEX isteği atıyor (Next'in veri önbelleği ADRES başına,
 * farklı sembol kombinasyonları önbelleği paylaşmıyor). Kotaya yaklaşınca
 * istekler azalmıyor, tersine artıyordu: bayat paketin önbelleksiz
 * tekrarı (`fetchQuotes` → `retaze`, `overlayRealtime`) ve 429'dan sonraki
 * iki yeniden deneme (18 Kasım, rate-limit.ts) dolu pencereye yeni istek
 * ekliyordu.
 *
 * KURAL: Alpaca her gerçek yanıtta kalan hakkı (`X-Ratelimit-Remaining`) ve
 * pencerenin sıfırlanma anını (`X-Ratelimit-Reset`, unix saniye) veriyor.
 * Kalan hak `SAVE_BELOW`a inince ya da 429 gelince pencere sıfırlanana
 * kadar KORUMA: önbelleksiz ek istek atılmaz (çağıran önbellekteki pakete
 * düşer — hepsi `!ok`ta zaten düşüyor), önbellekli istek eldeki kaydı
 * tazelemeden kullanır, 429'da yeniden deneme yapılmaz. Sıfırlanma başlığı
 * yoksa 429'dan sonra `COOLDOWN_FALLBACK_MS`, düşük kalan haktan sonra en
 * çok `WINDOW_MS`.
 *
 * Saf modül; testler tests/quota-guard.test.ts.
 */

export type QuotaReading = {
  /** Son gerçek yanıttaki kalan hak; bilinmiyorsa null. */
  remaining: number | null;
  /** O yanıtın anı (ms). */
  remainingAt: number | null;
  /** Pencerenin sıfırlanma anı (ms); başlık yoksa null. */
  resetAt: number | null;
  /** Son 429'un anı (ms). */
  lastRateLimitedAt: number | null;
};

/** Dakikalık 200'ün bu kadarı kalınca koruma başlar (opsiyon ve kurumsal işlem kapıları da aynı kotayı kullanıyor). */
export const SAVE_BELOW = 25;
/** 429'dan sonra sıfırlanma başlığı yoksa bekleme. */
export const COOLDOWN_FALLBACK_MS = 15_000;
/** Korumadayken önbellekli isteğin en kısa tazelik süresi (saniye): Next eldeki kaydı bu kadar eski olsa da taze sayar, ağa çıkmaz. */
export const SAVING_REVALIDATE_SECONDS = 300;
/** Kota penceresi: bir dakika. Düşük kalan hak okuması bundan eskiyse geçersiz. */
export const WINDOW_MS = 60_000;

export function quotaSaving(reading: QuotaReading, nowMs: number): boolean {
  const { remaining, remainingAt, resetAt, lastRateLimitedAt } = reading;
  if (lastRateLimitedAt !== null) {
    const until = resetAt !== null && resetAt > lastRateLimitedAt ? Math.min(resetAt, lastRateLimitedAt + WINDOW_MS) : lastRateLimitedAt + COOLDOWN_FALLBACK_MS;
    if (nowMs < until) return true;
  }
  if (remaining !== null && remainingAt !== null && remaining <= SAVE_BELOW) {
    const until = resetAt !== null && resetAt > remainingAt ? Math.min(resetAt, remainingAt + WINDOW_MS) : remainingAt + WINDOW_MS;
    if (nowMs < until) return true;
  }
  return false;
}

/** `X-Ratelimit-Reset` (unix saniye; bazı sağlayıcılar ms) → ms; geçersizse null. */
export function resetHeaderMs(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000;
}

/** İstek türü — sağlık izinde "kotayı ne yiyor" sorusunun cevabı. */
export function alpacaRequestKind(url: string): string {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  if (path.includes("/corporate-actions")) return "corporate";
  if (path.includes("/options")) return "options";
  if (path.endsWith("/snapshots")) return "snapshots";
  if (path.includes("/bars/latest")) return "latest-bars";
  if (path.includes("/bars")) return "bars";
  if (path.includes("/trades")) return "trades";
  if (path.includes("/quotes")) return "quotes";
  return "other";
}
