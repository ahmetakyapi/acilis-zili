import { cache } from "react";
import { etDateTimeToUtc } from "@/lib/market-hours";

/**
 * SEC EDGAR — bilanço sonuçlarının ANLIK bildirimi (2 Ekim).
 *
 * NEDEN. Bugünün Akışı bir bilançoyu "Açıklandı" diye ancak Finnhub'ın
 * takvimine EPS düştüğünde işaretliyordu; o da sonuçtan dakikalar, kimi
 * zaman saatler sonra. Sahibinin örneği Finviz'in "şirket açıkladığı an"
 * duyurusuydu — o anın kaynağı Finviz değil, şirketin SEC'e yatırdığı 8-K
 * formunun 2.02 maddesi ("Results of Operations and Financial Condition").
 * EDGAR bunu yatırıldığı dakika, ücretsiz ve yeniden yayın serbest olarak
 * veriyor; Finviz'in verisi ise kopyalanamaz (kullanım koşulları).
 * Ölçüldü: MU'nun 30 Eylül bildirimi kayıtta 20:02 UTC (23:02 TR).
 *
 * İKİ UÇ, İKİ ÖNBELLEK.
 *  - `company_tickers.json` (~800 KB): sembol → CIK. Günde bir yenileniyor.
 *  - `submissions/CIK##########.json`: şirketin son bildirimleri, `items`
 *    ve kabul anıyla. 60 saniye önbellekli: akış 30 saniyede bir soruyor,
 *    SEC'e şirket başına dakikada en çok bir istek gidiyor (sınır saniyede
 *    10). Yalnızca o gün bilanço açıklayan ve akışta görünen şirketler
 *    soruluyor — gün başına bir avuç sembol.
 *
 * KİMLİK BAŞLIĞI ZORUNLU. SEC, `User-Agent`ında iletişim bilgisi olmayan
 * istekleri 403 ile reddediyor. Değer `SEC_USER_AGENT` ortam değişkeninden
 * ("Ad e-posta"); depo herkese açık, kişisel e-posta koda yazılmıyor.
 *
 * KABUL SAATİ JSON'DAN OKUNMUYOR. `acceptanceDateTime` "Z" (UTC) diye
 * işaretli ama kaymış: MU'da 4, ACN ve NKE'de 8 saat (ölçüldü, 1 Ekim —
 * EDGAR dizin sayfası ACN için 06:42 ET diyor, JSON 14:42Z). Gün JSON'un
 * `filingDate`inden (ET takvim günü, kaymıyor), saat bildirimin kendi
 * başlığından (`ACCEPTANCE-DATETIME`, ET). Başlık yatırıldıktan sonra
 * değişmiyor; gün boyu önbellekli. Başlık okunamazsa saat yazılmıyor —
 * uydurma kesinlik yok (CLAUDE.md, veri dürüstlüğü 1).
 *
 * HATA SESSİZ. Bildirim bir HIZLANDIRICI: bulunamazsa akış eskisi gibi
 * Finnhub'ı bekliyor, hiçbir şey kırılmıyor.
 */

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SUBMISSIONS_URL = (cik: string) => `https://data.sec.gov/submissions/CIK${cik}.json`;
const TICKERS_REVALIDATE_S = 24 * 60 * 60;
const SUBMISSIONS_REVALIDATE_S = 60;
/** 8-K maddesi: faaliyet sonuçları ve finansal durum — bilanço bülteni. */
const RESULTS_ITEM = "2.02";

function userAgent(): string {
  return process.env.SEC_USER_AGENT?.trim() || "AcilisZili/1.0 (https://aciliszili.com)";
}

async function secJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Bildirim başlığındaki kabul anı (ET, "YYYYMMDDHHMMSS") → ISO UTC. */
async function acceptanceTime(cik: string, accession: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${accession}-index-headers.html`,
      { headers: { "User-Agent": userAgent() }, next: { revalidate: TICKERS_REVALIDATE_S }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const match = /ACCEPTANCE-DATETIME&gt;(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(await res.text());
    if (!match) return null;
    const [, y, m, d, hh, mm] = match;
    return etDateTimeToUtc(`${y}-${m}-${d}`, `${hh}:${mm}`).toISOString();
  } catch {
    return null;
  }
}

/** Sembol → 10 haneli CIK. İstek içinde tek tur (`cache`). */
const tickerTable = cache(async (): Promise<Map<string, string> | null> => {
  const data = await secJson<Record<string, { cik_str: number; ticker: string }>>(TICKERS_URL, TICKERS_REVALIDATE_S);
  if (!data) return null;
  const map = new Map<string, string>();
  for (const row of Object.values(data)) map.set(row.ticker.toUpperCase(), String(row.cik_str).padStart(10, "0"));
  return map;
});

type Submissions = {
  filings?: {
    recent?: {
      accessionNumber: string[];
      form: string[];
      items: string[];
      filingDate: string[];
    };
  };
};

export type EarningsFiling = {
  /** Kabul anı, ISO (UTC) — başlık okunamadıysa null. */
  acceptedAt: string | null;
  /** Bildirimin EDGAR dizin sayfası — basın bülteni (Ex-99.1) orada. */
  url: string;
};

/**
 * Şirketin `dateEt` gününe ait 8-K / 2.02 bildirimi; yoksa null.
 *
 * Gün `filingDate` (ET): açılış öncesi bilançolar sabah 07:00 ET civarı,
 * kapanış sonrası 16:05 civarı yatırılıyor — ikisi de aynı ET gününde.
 * (17:30 ET'den sonra yatırılan bildirim EDGAR'da ertesi iş gününe yazılır;
 * bilanço bültenleri o saatten önce.) `8-K/A` (düzeltme) sayılmıyor: ilk bildirim zaten görüldü.
 */
export const getEarningsFiling = cache(async function getEarningsFiling(
  symbol: string,
  dateEt: string,
): Promise<EarningsFiling | null> {
  const table = await tickerTable();
  /* EDGAR sembolde nokta yerine tire kullanıyor (BRK.B → BRK-B). */
  const cik = table?.get(symbol.toUpperCase()) ?? table?.get(symbol.toUpperCase().replace(".", "-"));
  if (!cik) return null;
  const data = await secJson<Submissions>(SUBMISSIONS_URL(cik), SUBMISSIONS_REVALIDATE_S);
  const recent = data?.filings?.recent;
  if (!recent) return null;
  /* Liste yeniden eskiye; ilk birkaç düzine kayıt bugünü kapsıyor. */
  for (let i = 0; i < Math.min(recent.form.length, 40); i++) {
    if (recent.form[i] !== "8-K") continue;
    const items = (recent.items[i] ?? "").split(",").map((item) => item.trim());
    if (!items.includes(RESULTS_ITEM)) continue;
    const day = recent.filingDate[i]!;
    if (day < dateEt) break;
    if (day !== dateEt) continue;
    const accession = recent.accessionNumber[i]!;
    return {
      acceptedAt: await acceptanceTime(cik, accession),
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${accession}-index.htm`,
    };
  }
  return null;
});
