import { responseDate } from "./types";

/**
 * Sağlayıcı kotasının İZİ — `/api/health` için, süreç belleğinde.
 *
 * NEDEN BELLEKTE. Sağlık ucu sağlayıcıyı YOKLAMIYOR (gerekçe `lib/health.ts`:
 * dakikada bir soran izleyici Finnhub'ın 60/dk kotasını yerdi). Kotanın
 * durumu zaten her yanıtta geçiyor; üç sağlayıcının tek fetch kapısı
 * (`finnhubFetch`, `alpacaFetch`, `fredFetch`) yanıtı buraya bildiriyor.
 * Sunucu tek süreç (VPS, systemd), yani bellek bütün trafiği görüyor;
 * yeniden başlatmada sıfırlanıyor ve rapor `since` ile bunu söylüyor.
 *
 * ÖNBELLEKTEN GELEN YANIT. Next'in veri önbelleği eski yanıtı başlıklarıyla
 * geri veriyor; "son başarılı çekme" bu yüzden yanıtın `Date` başlığından
 * (sağlayıcının ürettiği an) okunuyor, çağrı anından değil — aynı ölçü
 * `responseDate`in kotasyon tazeliğinde kullandığı. Kalan kota başlığı
 * (`X-Ratelimit-Remaining`, Finnhub ve Alpaca gönderiyor) da o anla
 * damgalanıyor ki eski bir sayı güncel sanılmasın.
 */

export type UsageProvider = "finnhub" | "alpaca" | "fred";

type Track = {
  lastOkAt: Date | null;
  lastRateLimitedAt: Date | null;
  /** Son bir saatteki 429'lar — dakikalık pencere aşımı mı, sürekli mi. */
  rateLimited: number[];
  remaining: number | null;
  remainingAt: Date | null;
};

const startedAt = new Date();
const tracks = new Map<UsageProvider, Track>();

function track(provider: UsageProvider): Track {
  let held = tracks.get(provider);
  if (!held) {
    held = { lastOkAt: null, lastRateLimitedAt: null, rateLimited: [], remaining: null, remainingAt: null };
    tracks.set(provider, held);
  }
  return held;
}

const HOUR_MS = 3600_000;

export function noteProviderResponse(provider: UsageProvider, res: Response, now: Date = new Date()): void {
  const held = track(provider);
  const stamp = responseDate(res) ?? now;
  if (res.status === 429) {
    held.lastRateLimitedAt = now;
    held.rateLimited = held.rateLimited.filter((at) => now.getTime() - at < HOUR_MS);
    held.rateLimited.push(now.getTime());
  } else if (res.ok && (!held.lastOkAt || stamp > held.lastOkAt)) {
    held.lastOkAt = stamp;
  }
  const remaining = Number(res.headers.get("x-ratelimit-remaining"));
  if (res.headers.has("x-ratelimit-remaining") && Number.isFinite(remaining)) {
    if (!held.remainingAt || stamp >= held.remainingAt) {
      held.remaining = remaining;
      held.remainingAt = stamp;
    }
  }
}

export type ProviderUsage = {
  lastOkAt: string | null;
  lastRateLimitedAt: string | null;
  rateLimitedLastHour: number;
  remaining: number | null;
  remainingAt: string | null;
};

export function providerUsage(now: Date = new Date()): {
  since: string;
  providers: Record<UsageProvider, ProviderUsage>;
} {
  const read = (provider: UsageProvider): ProviderUsage => {
    const held = track(provider);
    return {
      lastOkAt: held.lastOkAt?.toISOString() ?? null,
      lastRateLimitedAt: held.lastRateLimitedAt?.toISOString() ?? null,
      rateLimitedLastHour: held.rateLimited.filter((at) => now.getTime() - at < HOUR_MS).length,
      remaining: held.remaining,
      remainingAt: held.remainingAt?.toISOString() ?? null,
    };
  };
  return {
    since: startedAt.toISOString(),
    providers: { finnhub: read("finnhub"), alpaca: read("alpaca"), fred: read("fred") },
  };
}
