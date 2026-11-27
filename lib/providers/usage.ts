import { quotaSaving, resetHeaderMs } from "./quota-guard";
import { responseDate } from "./types";

/**
 * Sağlayıcı kotasının İZİ — `/api/health` için, süreç belleğinde.
 *
 * NEDEN BELLEKTE. Sağlık ucu sağlayıcıyı YOKLAMIYOR (gerekçe `lib/health.ts`:
 * dakikada bir soran izleyici Finnhub'ın 60/dk kotasını yerdi). Kotanın
 * durumu zaten her yanıtta geçiyor; üç sağlayıcının tek fetch kapısı
 * (`finnhubFetch`, `alpacaFetch`, `fredFetch`; Alpaca opsiyon ve kurumsal
 * işlem kapıları da, kota ortak) yanıtı buraya bildiriyor.
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

type UsageProvider = "finnhub" | "alpaca" | "fred";

type Track = {
  lastOkAt: Date | null;
  lastRateLimitedAt: Date | null;
  /** Son bir saatteki 429'lar — dakikalık pencere aşımı mı, sürekli mi. */
  rateLimited: number[];
  remaining: number | null;
  remainingAt: Date | null;
  /** Kota penceresinin sıfırlanma anı (`X-Ratelimit-Reset`), kalan hakla aynı yanıttan. */
  resetAt: number | null;
  /** Son bir saatte sağlayıcıya GERÇEKTEN giden istekler, türüne göre (27 Kasım; önbellekten gelen yanıt sayılmaz). */
  network: Map<string, number[]>;
};

const startedAt = new Date();
const tracks = new Map<UsageProvider, Track>();

function track(provider: UsageProvider): Track {
  let held = tracks.get(provider);
  if (!held) {
    held = { lastOkAt: null, lastRateLimitedAt: null, rateLimited: [], remaining: null, remainingAt: null, resetAt: null, network: new Map() };
    tracks.set(provider, held);
  }
  return held;
}

const HOUR_MS = 3600_000;

/** Önbellekten gelen yanıtı ayırma payı: `Date` başlığı bundan eskiyse yanıt gerçek istek değil. */
const NETWORK_SLACK_MS = 10_000;

export function noteProviderResponse(provider: UsageProvider, res: Response, now: Date = new Date(), kind?: string): void {
  const held = track(provider);
  const stamp = responseDate(res) ?? now;
  /* GERÇEK İSTEK SAYACI (27 Kasım): kotayı hangi istek türünün yediği
     `/api/health`te görünsün. Next'in veri önbelleğinden gelen yanıtın
     `Date`i eski; o sayılmaz. */
  if (kind && Math.abs(now.getTime() - stamp.getTime()) <= NETWORK_SLACK_MS) {
    const list = (held.network.get(kind) ?? []).filter((at) => now.getTime() - at < HOUR_MS);
    list.push(now.getTime());
    held.network.set(kind, list);
  }
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
      held.resetAt = resetHeaderMs(res.headers.get("x-ratelimit-reset"));
    }
  }
}

/** Testler için: iz sıfırlanır. */
export function resetProviderUsageForTests(): void {
  tracks.clear();
}

/**
 * Kota koruması açık mı (gerekçe lib/providers/quota-guard.ts). Alpaca
 * kapıları her istekten önce sorar.
 */
export function providerSaving(provider: UsageProvider, now: Date = new Date()): boolean {
  const held = tracks.get(provider);
  if (!held) return false;
  return quotaSaving(
    {
      remaining: held.remaining,
      remainingAt: held.remainingAt?.getTime() ?? null,
      resetAt: held.resetAt,
      lastRateLimitedAt: held.lastRateLimitedAt?.getTime() ?? null,
    },
    now.getTime(),
  );
}

type ProviderUsage = {
  lastOkAt: string | null;
  lastRateLimitedAt: string | null;
  rateLimitedLastHour: number;
  remaining: number | null;
  remainingAt: string | null;
  /** Kota koruması şu an açık mı. */
  saving: boolean;
  /** Son bir saatte gerçek istek sayısı, türüne göre (çoktan aza). */
  requestsLastHour: Record<string, number>;
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
      saving: providerSaving(provider, now),
      requestsLastHour: Object.fromEntries(
        [...held.network.entries()]
          .map(([kind, list]) => [kind, list.filter((at) => now.getTime() - at < HOUR_MS).length] as const)
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1]),
      ),
    };
  };
  return {
    since: startedAt.toISOString(),
    providers: { finnhub: read("finnhub"), alpaca: read("alpaca"), fred: read("fred") },
  };
}
