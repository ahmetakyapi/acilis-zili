import { fail, ok, type ProviderResult } from "./types";
import { withTimeout } from "./timeout";

/**
 * TCMB — Türkiye Cumhuriyet Merkez Bankası günlük döviz kurları.
 *
 * NEDEN BU ÜRÜNDE BİR KUR VAR: Buradaki her fiyat dolar. Türkiye'den ABD
 * borsasına yatırım yapan biri için "NVDA %3 arttı" tek başına yarım cümle —
 * lira karşılığındaki getiri kurla birlikte oluşuyor ve kur çoğu zaman
 * hissenin kendisinden daha çok oynuyor. Rehberde `kur-riski` yazısı bunu
 * anlatıyordu ama ekranda gösterecek bir sayı yoktu.
 *
 * NEDEN TCMB: Anahtar istemiyor, kotası yok ve Türkiye'de referans kabul
 * edilen kur bu. Alternatifleri elendi — Alpaca'nın ücretsiz katmanında FX
 * yok, Finnhub'ın forex uçları ücretli, FRED'in günlük TRY serisi
 * (DEXTUS ailesi) yayından kalktı.
 *
 * NE OLMADIĞI: Canlı kur değil. TCMB gün içinde TEK bir bülten yayımlar
 * (iş günleri ~15:30 TSİ) ve hafta sonu/tatilde son iş gününün bülteni
 * durur. Bu yüzden dönen veri bültenin tarihini taşır ve ekranda o tarih
 * yazılır — "anlık kur" iddiası taşımıyoruz. Serbest piyasa kuru bundan
 * birkaç kuruş sapar.
 */

const TODAY_URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

/** Bülten günde bir kez değişiyor; yarım saatlik tazelik fazlasıyla yeterli. */
const REVALIDATE_SECONDS = 1800;

export type UsdTryRate = {
  /** Döviz alış — TCMB'nin "ForexBuying" alanı. */
  buying: number;
  /** Döviz satış — gösterimde kullanılan taraf. */
  selling: number;
  /** Bültenin tarihi, "YYYY-MM-DD". Bugün olmak zorunda değil. */
  bulletinDate: string;
};

/**
 * "31.07.2026" → "2026-07-31". Biçim bozuksa null döner ve kart düşer;
 * tarihi okunamayan bir kuru göstermek, damgasız veri göstermek olur.
 */
function parseBulletinDate(raw: string | undefined): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw?.trim() ?? "");
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/** TCMB ondalık ayracı olarak nokta kullanıyor; yine de boş alan gelebiliyor. */
function parseAmount(raw: string | undefined): number | null {
  const value = Number.parseFloat(raw?.trim() ?? "");
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extract(block: string, tag: string): string | undefined {
  return new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block)?.[1];
}

/**
 * Günün USD/TRY kuru.
 *
 * XML tek bir para birimi için okunuyor, o yüzden ayrıştırıcı kütüphane
 * yerine hedefli iki desen yeterli: önce USD bloğu kesiliyor, sonra iki alan
 * okunuyor. Yanıt biçimi değişirse eşleşme başarısız olur ve kart sessizce
 * düşer — yanlış bir kur göstermektense hiç göstermemek.
 */
export async function getUsdTry(): Promise<ProviderResult<UsdTryRate>> {
  let res: Response;
  try {
    /* Süre sınırı — gerekçe lib/providers/timeout.ts'te. */
    res = await withTimeout(
      fetch(TODAY_URL, {
        headers: { accept: "application/xml" },
        next: { revalidate: REVALIDATE_SECONDS, tags: ["fx"] },
      }),
    );
  } catch (error) {
    return fail(
      "tcmb",
      "network",
      error instanceof Error ? error.message : "TCMB'ye ulaşılamadı",
    );
  }

  if (!res.ok) {
    return fail("tcmb", "upstream-error", `TCMB ${res.status}`);
  }

  /* GÖVDE OKUMASI DA SARMAL İÇİNDE. Bir süre dışarıdaydı ve tek başına
     bütün siteyi düşürebiliyordu: `fetch` başlıkları aldıktan sonra dönüyor,
     gövde ise akmaya devam ediyor. TCMB bağlantıyı gövde ortasında keserse
     (`socket hang up` / `TypeError: terminated`) hata buradan yukarı
     fırlıyor, sunucu bileşeni çöküyor ve okuyucu kur kartı yerine
     global-error ekranını görüyordu — kartın "sessizce düşmesi" gereken bir
     durumda. */
  let xml: string;
  try {
    xml = await res.text();
  } catch (error) {
    return fail(
      "tcmb",
      "network",
      error instanceof Error ? error.message : "TCMB yanıtı okunamadı",
    );
  }

  const usdBlock = /<Currency[^>]*Kod="USD"[^>]*>([\s\S]*?)<\/Currency>/.exec(
    xml,
  )?.[1];
  if (!usdBlock) {
    return fail("tcmb", "empty", "Bültende USD bloğu bulunamadı");
  }

  const selling = parseAmount(extract(usdBlock, "ForexSelling"));
  const buying = parseAmount(extract(usdBlock, "ForexBuying"));
  const bulletinDate = parseBulletinDate(
    /<Tarih_Date[^>]*\sTarih="([^"]+)"/.exec(xml)?.[1],
  );

  if (selling === null || buying === null || bulletinDate === null) {
    return fail("tcmb", "empty", "Bülten beklenen alanları taşımıyor");
  }

  return ok({ buying, selling, bulletinDate }, "tcmb");
}
