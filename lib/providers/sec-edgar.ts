import { cache } from "react";
import { secUserAgent } from "@/lib/investors";
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
 * istekleri 403 ile reddediyor. Başlık 13F ve Form 4 uçlarıyla ortak:
 * `secUserAgent` (lib/investors.ts — varsayılan kodda, sahibinin kararı;
 * `SEC_USER_AGENT` tanımlıysa o öncelikli).
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

async function secJson<T>(url: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": secUserAgent(), Accept: "application/json" },
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
      { headers: { "User-Agent": secUserAgent() }, next: { revalidate: TICKERS_REVALIDATE_S }, signal: AbortSignal.timeout(6000) },
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

/**
 * Hisse sayısı geçmişi — sulandırma ölçüsü (3 Ekim, hisse seçimi).
 *
 * `dei:EntityCommonStockSharesOutstanding`: her 10-Q/10-K (yabancı
 * şirketlerde 20-F) kapağındaki dolaşımdaki hisse sayısı. `companyconcept`
 * ucu tek kavramı veriyor (~10 KB); `companyfacts` megabaytlarca ve Next'in
 * veri önbelleğine sığmıyor. Kapak sayısı dosya gününe ait, bölünme
 * düzeltmesi yok — yıllık karşılaştırma bölünme yılında yanıltır; çağıran
 * onu bir sinyal olarak kullanıyor, kesin hüküm olarak değil. Bulunamazsa
 * null (hata sessiz, kural "veri yok" der).
 */
export const getSharesSeries = cache(async function getSharesSeries(
  symbol: string,
): Promise<{ kind: "cover" | "annual"; rows: { end: string; value: number }[] } | null> {
  const table = await tickerTable();
  const cik = table?.get(symbol.toUpperCase()) ?? table?.get(symbol.toUpperCase().replace(".", "-"));
  if (!cik) return null;
  type Row = { end?: unknown; start?: unknown; val?: unknown; form?: unknown };
  const concept = (taxonomy: string, tag: string) =>
    secJson<{ units?: { shares?: unknown } }>(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${tag}.json`,
      TICKERS_REVALIDATE_S,
    ).then((data) => {
      /* Yapı her şirkette aynı değil (KO'da `units.shares` boş bir nesne
         geldi) — dizi değilse yok sayılıyor. */
      const rows = data?.units?.shares;
      return Array.isArray(rows) ? (rows as Row[]) : [];
    });
  const valid = (row: Row): row is { end: string; start?: string; val: number; form?: string } =>
    typeof row.val === "number" && row.val > 0 && typeof row.end === "string";

  /* Kapak serisi ancak GÜNCELSE: bazı şirketler (Ford) sayıyı yıllar önce
     hisse sınıfı bazında yazmaya geçti ve sınıfsız seri orada bitiyor. */
  const cover = (await concept("dei", "EntityCommonStockSharesOutstanding")).filter(valid);
  const coverLatest = cover.reduce((max, row) => (row.end > max ? row.end : max), "");
  if (cover.length >= 2 && (Date.now() - Date.parse(coverLatest)) / 86_400_000 <= 200) {
    return { kind: "cover" as const, rows: cover.map((row) => ({ end: row.end, value: row.val })) };
  }

  /* YEDEK: yıllık raporun seyreltilmiş ağırlıklı ortalama hisse sayısı.
     Yalnızca 10-K'nın tam yıllık dönemi (başlangıç-bitiş ~1 yıl): çeyreklik
     ve yılbaşından bugüne satırları aynı dosyada karışık geliyor. İki
     ardışık mali yıl `sharesChangeYoY`ın penceresine düşüyor. */
  const annual = (await concept("us-gaap", "WeightedAverageNumberOfDilutedSharesOutstanding"))
    .filter(valid)
    .filter((row) => {
      if (row.form !== "10-K" || typeof row.start !== "string") return false;
      const days = (Date.parse(row.end) - Date.parse(row.start)) / 86_400_000;
      return days > 350 && days < 380;
    });
  if (annual.length === 0) return null;
  const byEnd = new Map(annual.map((row) => [row.end, row.val]));
  return { kind: "annual" as const, rows: [...byEnd.entries()].map(([end, value]) => ({ end, value })) };
});
