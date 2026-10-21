import { unstable_cache } from "next/cache";
import { cache } from "react";
import { secUserAgent } from "@/lib/investors";
import { etDateTimeToUtc } from "@/lib/market-hours";
import { SEC_MIN_GAP_MS, secTurn } from "./sec-gate";

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
 *    ve kabul anıyla. Sonuç (sembol, gün) başına SÜREÇ HAFIZASINDA
 *    (`lookups`, gerekçe orada): akış 30 saniyede bir soruyor, SEC'e şirket
 *    başına dakikada en çok bir istek gidiyor (sonucu gelmiş satırda on
 *    dakikada bir) ve her istek ortak SEC sırasından geçiyor (`sec-gate.ts`,
 *    sınır saniyede 10). Yalnızca o gün bilanço açıklayan, akışta görünen ve
 *    bildirimi henüz bulunmamış şirketler yoklanıyor — yoğun bir bilanço
 *    gününde 20-30 sembol. Hafıza da sıra da Turbopack çalışma zamanı başına:
 *    sayfa (SSR akışı) ile `/api/day-flow` ayrı `lookups` tutuyor, aynı
 *    şirket iki yandan da yoklanabilir (ölçüm `lib/day-flow-data.ts` →
 *    `loadSharedDayFlow`).
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
/** Bildirim yoklamasının tazeliği — `lookups` hafızasının süresi. */
const LOOKUP_TTL_MS = 60_000;
/** Sonucu gelmiş (`settled`) satırın bağlantı yoklaması — gerekçe `lookups`ta. */
const SETTLED_TTL_MS = 10 * 60_000;
/** 8-K maddesi: faaliyet sonuçları ve finansal durum — bilanço bülteni. */
const RESULTS_ITEM = "2.02";

/** `revalidate` null: veri önbelleği YOK, istek ortak SEC sırasından geçer —
    bildirim yolu; önbelleği `lookups` (aşağıda). */
async function secJson<T>(url: string, revalidate: number | null): Promise<T | null> {
  try {
    if (revalidate === null) await secTurn();
    const res = await fetch(url, {
      headers: { "User-Agent": secUserAgent(), Accept: "application/json" },
      ...(revalidate === null ? { cache: "no-store" as const } : { next: { revalidate } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Bildirim başlığındaki kabul anı (ET, "YYYYMMDDHHMMSS") → ISO UTC.
    Bulunan bildirim başına bir kez (`lookups`); o yüzden önbelleksiz ve sıralı. */
async function acceptanceTime(cik: string, accession: string): Promise<string | null> {
  try {
    await secTurn();
    const res = await fetch(
      `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${accession}-index-headers.html`,
      { headers: { "User-Agent": secUserAgent() }, cache: "no-store", signal: AbortSignal.timeout(6000) },
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

/** Sembol → 10 haneli CIK. İstek içinde tek tur (`cache`); istekler arası
    TTL'li modül memo'su — gerekçe sec-form4.ts'teki eş kopyada (15 Ekim). */
let tickerMemo: { at: number; map: Map<string, string> } | null = null;
const tickerTable = cache(async (): Promise<Map<string, string> | null> => {
  if (tickerMemo && Date.now() - tickerMemo.at < TICKERS_REVALIDATE_S * 1000) return tickerMemo.map;
  const data = await secJson<Record<string, { cik_str: number; ticker: string }>>(TICKERS_URL, TICKERS_REVALIDATE_S);
  if (!data) return null;
  const map = new Map<string, string>();
  for (const row of Object.values(data)) map.set(row.ticker.toUpperCase(), String(row.cik_str).padStart(10, "0"));
  tickerMemo = { at: Date.now(), map };
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
async function lookupFiling(symbol: string, dateEt: string): Promise<EarningsFiling | null> {
  const table = await tickerTable();
  /* EDGAR sembolde nokta yerine tire kullanıyor (BRK.B → BRK-B). */
  const cik = table?.get(symbol.toUpperCase()) ?? table?.get(symbol.toUpperCase().replace(".", "-"));
  if (!cik) return null;
  const data = await secJson<Submissions>(SUBMISSIONS_URL(cik), null);
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
}

/* HAFIZA SÜREÇTE, VERİ ÖNBELLEĞİNDE DEĞİL (20 Ekim). `submissions` 60
   saniyelik `fetch` önbelleğindeydi ve "şirket başına dakikada bir istek"
   sayılıyordu; iki delik vardı. Oturumsuz akış `unstable_cache` içinde
   koşuyordu ve orada Next her `fetch`i önbelleksiz yapıyordu (patch-fetch:
   `force-no-store`) — iki dilde 30 saniyede bir, gösterilen her şirket için
   AYNI ANDA bir istek. (Bu delik akışın kendi tarafında da kapandı: misafir
   akışı artık süreç notunda, `loadSharedDayFlow`, `lib/day-flow-data.ts`.)
   Dışarıda, yani oturumlu okuyucunun sekme başına yoklamasında, aynı anda
   dolan kayıtlar aynı anda bayatlayıp arka plan yenilemelerini birlikte
   ateşliyordu; bunlar Next'in içinden çıktığı için hiçbir sıraya girmezdi —
   hafızanın bugünkü gerekçesi bu. Sonuç artık (gün, sembol) başına burada,
   ağa çıkan her istek `secTurn`den geçiyor. Bayat kayıt BEKLETMEZ: yenisi
   gelene dek eskisi döner (veri önbelleğinin davranışı). Süren yoklama
   varken yenisi AÇILMAZ: sıra uzasa da aynı şirket için ikinci istek
   birikmez.

   NE SIKLIKLA. Kabul saatiyle bulunan bildirim değişmez, gün boyu bir daha
   sorulmaz. Sonucu gelmemiş satır dakikada bir yoklanır. `settled` (sonucu
   Finnhub'dan ya da yayımlanmış analizden gelmiş) satır yalnız bağlantısı
   için on dakikada bir (`SETTLED_TTL_MS`): 6-K yatıran yabancı şirketlerde
   (TSM, ASML) 8-K hiç gelmiyor, dakikada bir sormak sırayı boşuna doldurur.
   DONDURULMAZ (20 Ekim): ilk sürüm `settled` satırı elindeki kayıtta
   bırakıyordu; satır sonuçlanmadan önce boş bir yoklama aldıysa (bülten
   16:00, yoklama 16:07, 8-K 16:08, EPS 16:08) ya da SEC bir kez düştüyse
   "SEC Bildirimi" bağlantısı gün boyu gelmiyordu. Tek ek yoklama da yetmez:
   EPS 8-K'dan önce düşebilir. */
type Lookup = {
  at: number;
  current: Promise<EarningsFiling | null>;
  /** Yenileme sürerken dönen önceki tur; tur bitince null. */
  previous: Promise<EarningsFiling | null> | null;
  found: boolean;
  /** `current` sonuçlandı mı — sürerken yeni yoklama açılmaz. */
  done: boolean;
};

const lookups = new Map<string, Lookup>();

function remembered(entry: Lookup): Promise<EarningsFiling | null> {
  return entry.previous ?? entry.current;
}

export const getEarningsFiling = cache(async function getEarningsFiling(
  symbol: string,
  dateEt: string,
  settled = false,
): Promise<EarningsFiling | null> {
  const key = `${dateEt}:${symbol.toUpperCase()}`;
  const held = lookups.get(key);
  const ttl = settled ? SETTLED_TTL_MS : LOOKUP_TTL_MS;
  if (held && (held.found || !held.done || Date.now() - held.at < ttl)) {
    return remembered(held);
  }
  const entry: Lookup = {
    at: Date.now(),
    current: lookupFiling(symbol, dateEt).catch(() => null),
    previous: held ? remembered(held) : null,
    found: false,
    done: false,
  };
  void entry.current.then((filing) => {
    entry.found = Boolean(filing?.acceptedAt);
    entry.previous = null;
    entry.done = true;
  });
  /* Önceki günlerin kayıtları atılıyor: hafıza günün sembolleriyle sınırlı. */
  for (const old of lookups.keys()) if (!old.startsWith(`${dateEt}:`)) lookups.delete(old);
  lookups.set(key, entry);
  return remembered(entry);
});

type ConceptRow = { end?: unknown; start?: unknown; val?: unknown; form?: unknown };

/** Kavram okumasının ortak SEC sırasındaki en uzun bekleyişi — hızlı
    bakışın ~16 kapak okumasının boş sıraya sığacağı pay (275 ms'de 4,4 sn;
    gerekçe aşağıda). */
const CONCEPT_WAIT_MS = 16 * SEC_MIN_GAP_MS;

/* KAVRAM OKUMASI SIRADAN GEÇİYOR (20 Ekim). `companyconcept` 24 saatlik
   `fetch` önbelleğindeydi ve "seyrek" sayılıp sırasız gidiyordu; değildi:
   /hisse-secimi'nin hızlı bakışı teknik listedeki ~16 hisseyi aynı anda
   puanlıyor; önbellek soğukken ya da birlikte dolup 24 saatte bir birlikte
   bayatlayan kayıtlar arkada yenilenirken tek çizim SEC'e ~16 isteği AYNI
   ANDA, kapağı eski olanlarda bir o kadar da yedek kavram için açıyordu.
   Sıra veri önbelleği isabetini ayırt edemediği için (`sec-gate.ts`) okuma
   `unstable_cache`e alındı: geri çağrı yalnız ağa çıkacağı zaman koşuyor
   ve orada sıraya giriyor; isabet sırasız ve beklemesiz, bayat kayıt hemen
   döner ve arkada yenilenir.
   Çizim yolu olduğu için bütçeli (`CONCEPT_WAIT_MS`, Form 4 ile aynı kural):
   sıra daha uzunsa boşluk ayrılmaz ve okuma FIRLATIR. Kavramı hiç yazmamış
   şirketin 404'ü kalıcı yanıttır ve boş liste olarak saklanır; ağ hatası,
   429 ve dolu sıra saklanmaz (CLAUDE.md "hata önbelleğin DIŞINDA") —
   çağıran yakalar, kural o çizimde "veri yok" der, sonraki çizim yeniden
   sorar. Önbelleğe ham yanıt değil yalnız kullanılan dört alan giriyor. */
const loadConcept = unstable_cache(
  async function loadConcept(cik: string, taxonomy: string, tag: string): Promise<ConceptRow[]> {
    if (!(await secTurn(CONCEPT_WAIT_MS))) throw new Error("sec-queue-full");
    const res = await fetch(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${taxonomy}/${tag}.json`, {
      headers: { "User-Agent": secUserAgent(), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`SEC ${res.status}`);
    const data = (await res.json()) as { units?: { shares?: unknown } } | null;
    /* Yapı her şirkette aynı değil (KO'da `units.shares` boş bir nesne
       geldi) — dizi değilse yok sayılıyor. */
    const rows = data?.units?.shares;
    if (!Array.isArray(rows)) return [];
    return (rows as ConceptRow[]).map(({ end, start, val, form }) => ({ end, start, val, form }));
  },
  /* Sürümlü anahtar: önbellek dağıtımlar arası ortak (CLAUDE.md). */
  ["sec-companyconcept-v1"],
  { revalidate: TICKERS_REVALIDATE_S },
);

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
  const concept = (taxonomy: string, tag: string) =>
    loadConcept(cik, taxonomy, tag).catch((): ConceptRow[] => []);
  const valid = (row: ConceptRow): row is { end: string; start?: string; val: number; form?: string } =>
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
