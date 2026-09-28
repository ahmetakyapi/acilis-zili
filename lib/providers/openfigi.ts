import { fail, ok, type ProviderResult } from "./types";
import { BACKGROUND_TIMEOUT_MS, withTimeout } from "./timeout";

/**
 * OpenFIGI — CUSIP'ten borsa sembolüne (28 Eylül).
 *
 * 13F satırı sembol taşımıyor, yalnızca CUSIP ve şirketin adı. Logo, hisse
 * sayfası bağlantısı ve "bu hisseyi kim tutuyor" sorusu sembol istiyor.
 * OpenFIGI (Bloomberg'in açık eşleme servisi) CUSIP + `exchCode: "US"` ile
 * ABD bileşik sembolünü veriyor: 093712107 → BE.
 *
 * SINIR. Anahtarsız: dakikada 25 istek, istek başına 10 kayıt. Anahtarla
 * (`OPENFIGI_API_KEY`, isteğe bağlı): 6 saniyede 25 istek, istek başına
 * 100 kayıt. Çağıran (lib/investor-sync.ts) eşlemeyi kalıcı tabloda tutuyor
 * ve yalnızca YENİ CUSIP'leri soruyor; bu modül tek bir paketi çözüyor.
 *
 * ÇÖZÜLEMEYEN KAYIT BİR SONUÇ. Tahvil, yurt dışı hisse ya da kapanmış bir
 * şirketin CUSIP'i "eşleşme yok" döner; sembol `null` yazılır ve ekranda
 * şirketin adı durur. Uydurma sembol basılmaz.
 */

const ENDPOINT = "https://api.openfigi.com/v3/mapping";

export function openFigiKey(): string | null {
  return process.env.OPENFIGI_API_KEY || null;
}

/** İstek başına kayıt ve iki istek arası en kısa süre, anahtara göre. */
export function openFigiLimits(): { batch: number; gapMs: number } {
  return openFigiKey() ? { batch: 100, gapMs: 250 } : { batch: 10, gapMs: 2_500 };
}

export type FigiMatch = {
  cusip: string;
  ticker: string | null;
  figi: string | null;
  name: string | null;
  securityType: string | null;
};

type FigiResponse = {
  data?: { figi?: string; ticker?: string; name?: string; securityType?: string; securityType2?: string }[];
  warning?: string;
  error?: string;
}[];

/**
 * OpenFIGI'nin sembol yazımı sitenin yazımına: sınıf ayracı "/" → ".",
 * (BRK/B → BRK.B; `symbols` tablosu ve Finnhub noktalı yazıyor). Saf.
 */
export function normalizeFigiTicker(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const ticker = raw.trim().toUpperCase().replace(/\//g, ".");
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker) ? ticker : null;
}

/**
 * Harfle başlayan kimlik CUSIP değil CINS: ABD dışında kurulmuş şirketin
 * numarası (Aon plc G0403H108, Chubb H1467J104). OpenFIGI onu `ID_CUSIP`
 * olarak sorunca "bulunamadı" diyor; `ID_CINS` ile aynı kayıt ABD
 * sembolüyle (AON) dönüyor. Saf; sınanıyor.
 */
export function figiIdType(cusip: string): "ID_CUSIP" | "ID_CINS" {
  return /^[A-Z]/i.test(cusip) ? "ID_CINS" : "ID_CUSIP";
}

/** Yanıtı sırasıyla CUSIP'lere eşle. Saf; sınanıyor. */
export function parseFigiResponse(cusips: readonly string[], json: FigiResponse): FigiMatch[] {
  return cusips.map((cusip, index) => {
    const entry = json[index];
    /* İlk HİSSE kaydı tercih ediliyor; yoksa ilk kayıt. */
    const list = entry?.data ?? [];
    const pick =
      list.find((item) => /common stock|adr|reit|etp|mlp|depositary|share/i.test(`${item.securityType ?? ""} ${item.securityType2 ?? ""}`)) ??
      list[0];
    return {
      cusip,
      ticker: normalizeFigiTicker(pick?.ticker),
      figi: pick?.figi ?? null,
      name: pick?.name ?? null,
      securityType: pick?.securityType ?? null,
    };
  });
}

export async function mapCusips(cusips: readonly string[]): Promise<ProviderResult<FigiMatch[]>> {
  if (cusips.length === 0) return ok([], "openfigi");
  const key = openFigiKey();
  try {
    const res = await withTimeout(
      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { "X-OPENFIGI-APIKEY": key } : {}),
        },
        body: JSON.stringify(cusips.map((cusip) => ({ idType: figiIdType(cusip), idValue: cusip, exchCode: "US" }))),
        cache: "no-store",
      }),
      BACKGROUND_TIMEOUT_MS,
    );
    if (res.status === 429) return fail("openfigi", "rate-limited", "OpenFIGI 429");
    if (!res.ok) return fail("openfigi", "upstream-error", `OpenFIGI ${res.status}`);
    return ok(parseFigiResponse(cusips, (await res.json()) as FigiResponse), "openfigi");
  } catch (error) {
    return fail("openfigi", "network", error instanceof Error ? error.message : "OpenFIGI isteği düştü");
  }
}
