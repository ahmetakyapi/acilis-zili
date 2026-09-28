import { secUserAgent } from "@/lib/investors";
import { fail, ok, type ProviderResult } from "./types";
import { BACKGROUND_TIMEOUT_MS, withTimeout } from "./timeout";

/**
 * SEC EDGAR — kurumsal yöneticilerin 13F bildirimleri (28 Eylül).
 *
 * ÜÇ ADIM, ÜÇ ADRES:
 *   1. `data.sec.gov/submissions/CIK##########.json` — yöneticinin bütün
 *      dosyaları, paralel dizilerde (`form`, `accessionNumber`, …). Günlük
 *      senkronun tek sabit maliyeti bu: yatırımcı başına bir istek.
 *   2. Dosyanın `index.json`u — bilgi tablosunun ADI fondan fona değişiyor
 *      (`43981.xml`, `BGLLCQ22026.xml`); `primary_doc.xml` olmayan tek XML o.
 *   3. `primary_doc.xml` (kapak: dönem, toplam, düzeltme türü) ve bilgi
 *      tablosunun kendisi.
 *
 * KİMLİK ŞART. SEC başlıksız ve tarayıcı kimliğiyle gelen isteğe 403
 * dönüyor; `User-Agent` bir kurum adı ve iletişim adresi istiyor. Sınır
 * saniyede 10 istek; burada istekler arasına en az 125 ms konuyor (≤ 8/sn).
 *
 * AYRIŞTIRMA ÖNEKTEN BAĞIMSIZ. Bilgi tablosunun etiketleri kimi dosyada
 * `ns1:infoTable`, kimisinde `infoTable`; ad alanı öneki fondan fona
 * değişiyor. Tam bir XML ayrıştırıcısı bağımlılık demekti; 13F'in yapısı
 * düz ve derinliği sabit, düzenli ifade yetiyor.
 */

const SEC_MIN_GAP_MS = 125;
let lastSecCall = 0;

async function secFetch(url: string): Promise<Response> {
  const wait = lastSecCall + SEC_MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastSecCall = Date.now();
  return withTimeout(
    fetch(url, {
      headers: { "User-Agent": secUserAgent() ?? "", Accept: "application/json, application/xml, text/xml" },
      cache: "no-store",
    }),
    BACKGROUND_TIMEOUT_MS,
  );
}

async function secText(url: string): Promise<ProviderResult<string>> {
  if (!secUserAgent()) return fail("sec", "missing-key", "SEC_USER_AGENT tanımlı değil");
  try {
    const res = await secFetch(url);
    if (res.status === 404) return fail("sec", "not-found", `${url} bulunamadı`);
    if (res.status === 429 || res.status === 403) return fail("sec", "rate-limited", `SEC ${res.status}`);
    if (!res.ok) return fail("sec", "upstream-error", `SEC ${res.status}`);
    return ok(await res.text(), "sec");
  } catch (error) {
    return fail("sec", "network", error instanceof Error ? error.message : "SEC isteği düştü");
  }
}

/* --------------------------------------------------------------------------
   1. Dosya listesi
   -------------------------------------------------------------------------- */

export type SecFilingRef = {
  cik: number;
  accession: string;
  /** "13F-HR" | "13F-HR/A" | "13F-NT" … */
  form: string;
  filedAt: string;
  /** Dönem sonu, "YYYY-MM-DD". */
  period: string;
};

type Submissions = {
  filings?: {
    recent?: {
      form?: string[];
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
    };
  };
};

/** Yalnızca 13F aileleri, yeniden eskiye. Saf; sınanıyor. */
export function thirteenFFilings(cik: number, json: Submissions): SecFilingRef[] {
  const recent = json.filings?.recent;
  if (!recent?.form || !recent.accessionNumber) return [];
  const out: SecFilingRef[] = [];
  for (let i = 0; i < recent.form.length; i += 1) {
    const form = recent.form[i];
    if (!form?.startsWith("13F")) continue;
    const period = recent.reportDate?.[i] ?? "";
    const filedAt = recent.filingDate?.[i] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period) || !/^\d{4}-\d{2}-\d{2}$/.test(filedAt)) continue;
    out.push({ cik, accession: recent.accessionNumber[i], form, filedAt, period });
  }
  return out.sort((a, b) => b.filedAt.localeCompare(a.filedAt) || b.accession.localeCompare(a.accession));
}

export async function getSecFilings(cik: number): Promise<ProviderResult<SecFilingRef[]>> {
  const url = `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`;
  const res = await secText(url);
  if (!res.ok) return res;
  try {
    return ok(thirteenFFilings(cik, JSON.parse(res.data) as Submissions), "sec");
  } catch {
    return fail("sec", "upstream-error", "SEC dosya listesi okunamadı");
  }
}

/* --------------------------------------------------------------------------
   2-3. Tek dosya: kapak + bilgi tablosu
   -------------------------------------------------------------------------- */

export type RawHolding = {
  issuer: string;
  titleOfClass: string | null;
  cusip: string;
  value: number;
  amount: number;
  amountType: "SH" | "PRN";
  putCall: "call" | "put" | null;
};

export type Holding = {
  cusip: string;
  position: "long" | "call" | "put";
  issuer: string;
  titleOfClass: string | null;
  amount: number;
  amountType: "SH" | "PRN";
  /** Dolar. */
  value: number;
};

export type FilingCover = {
  period: string | null;
  amendment: "restatement" | "new-holdings" | null;
  valueTotal: number | null;
  entryTotal: number | null;
};

export type ParsedFiling = {
  cover: FilingCover;
  holdings: Holding[];
  valueTotal: number;
  valueScaled: boolean;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ENTITIES[name])
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .trim();
}

/** `<ns1:tag>…</ns1:tag>` ya da `<tag>…</tag>` — önek ne olursa olsun. */
function field(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${tag}>`, "i"));
  return match ? decode(match[1]) : null;
}

function numberOf(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

/** Bilgi tablosunun ham satırları. Saf; sınanıyor. */
export function parseInfoTable(xml: string): RawHolding[] {
  const rows: RawHolding[] = [];
  const blocks = xml.match(/<(?:[\w-]+:)?infoTable(?:\s[^>]*)?>[\s\S]*?<\/(?:[\w-]+:)?infoTable>/gi) ?? [];
  for (const block of blocks) {
    const cusip = field(block, "cusip")?.toUpperCase();
    const value = numberOf(field(block, "value"));
    const amount = numberOf(field(block, "sshPrnamt"));
    if (!cusip || value === null || amount === null) continue;
    const type = field(block, "sshPrnamtType")?.toUpperCase() === "PRN" ? "PRN" : "SH";
    const putCallRaw = field(block, "putCall")?.toLowerCase() ?? null;
    rows.push({
      issuer: field(block, "nameOfIssuer") ?? cusip,
      titleOfClass: field(block, "titleOfClass"),
      cusip,
      value,
      amount,
      amountType: type,
      putCall: putCallRaw === "call" ? "call" : putCallRaw === "put" ? "put" : null,
    });
  }
  return rows;
}

/** "06-30-2026" → "2026-06-30". */
function isoFromSec(raw: string | null): string | null {
  const match = raw?.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}

/** Kapak sayfası. Saf; sınanıyor. */
export function parseCover(xml: string): FilingCover {
  const type = field(xml, "amendmentType")?.toUpperCase() ?? null;
  return {
    period: isoFromSec(field(xml, "periodOfReport")) ?? isoFromSec(field(xml, "reportCalendarOrQuarter")),
    amendment: type === "RESTATEMENT" ? "restatement" : type === "NEW HOLDINGS" ? "new-holdings" : null,
    valueTotal: numberOf(field(xml, "tableValueTotal")),
    entryTotal: numberOf(field(xml, "tableEntryTotal")),
  };
}

/**
 * DEĞER BİRİMİ — dolar mı, bin dolar mı (dosya bazında).
 *
 * SEC 2023'ten beri `value` alanını DOLAR istiyor ama bazı yöneticiler hâlâ
 * bin dolar yazıyor: Baupost ve Duquesne 2026 2. çeyrekte (AMZN'de değer ÷
 * adet = 0,238 — yani hisse başına 24 sent). Algılama satırların MEDYAN
 * "değer ÷ adet" oranına bakıyor: dolar yazan bir dosyada bu hisse fiyatı
 * mertebesinde (onlarca, yüzlerce), bin yazanda binde biri. Eşik 2: fiyatı
 * 2 doların altında hisselerden oluşan bir portföy bu listede yok, bin
 * yazan bir dosyada da medyan hissenin 2.000 dolar olması gerekirdi.
 *
 * Yalnızca HİSSE satırları (SH) sayılıyor: tahvil (PRN) satırında adet
 * yerine anapara duruyor ve oran fiyat değil.
 */
export const VALUE_SCALE_THRESHOLD = 2;

export function detectValueScale(rows: readonly RawHolding[]): 1 | 1000 {
  const ratios = rows
    .filter((row) => row.amountType === "SH" && row.amount > 0 && row.value > 0)
    .map((row) => row.value / row.amount)
    .sort((a, b) => a - b);
  if (ratios.length === 0) return 1;
  const mid = Math.floor(ratios.length / 2);
  const median = ratios.length % 2 === 0 ? (ratios[mid - 1] + ratios[mid]) / 2 : ratios[mid];
  return median < VALUE_SCALE_THRESHOLD ? 1000 : 1;
}

/**
 * Satırları pozisyona topla: aynı CUSIP + aynı tür (hisse / alım / satım
 * opsiyonu) tek satır. Fonlar alt yöneticiler için aynı hisseyi birden çok
 * satırda yazıyor (Berkshire'da AAPL yedi satır). Saf; sınanıyor.
 */
export function aggregateHoldings(rows: readonly RawHolding[], scale: 1 | 1000): Holding[] {
  const map = new Map<string, Holding>();
  for (const row of rows) {
    const position = row.putCall ?? "long";
    const key = `${row.cusip}|${position}`;
    const current = map.get(key);
    if (current) {
      current.amount += row.amount;
      current.value += row.value * scale;
    } else {
      map.set(key, {
        cusip: row.cusip,
        position,
        issuer: row.issuer,
        titleOfClass: row.titleOfClass,
        amount: row.amount,
        amountType: row.amountType,
        value: row.value * scale,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function archiveBase(ref: Pick<SecFilingRef, "cik" | "accession">): string {
  return `https://www.sec.gov/Archives/edgar/data/${ref.cik}/${ref.accession.replace(/-/g, "")}`;
}

/** Bilgi tablosunun dosya adı: `primary_doc.xml` olmayan XML. Saf; sınanıyor. */
export function infoTableName(index: { directory?: { item?: { name?: string }[] } }): string | null {
  const names = (index.directory?.item ?? []).map((item) => item.name ?? "");
  return names.find((name) => /\.xml$/i.test(name) && name.toLowerCase() !== "primary_doc.xml") ?? null;
}

export async function getSecFiling(ref: SecFilingRef): Promise<ProviderResult<ParsedFiling>> {
  const base = archiveBase(ref);
  const indexRes = await secText(`${base}/index.json`);
  if (!indexRes.ok) return indexRes;
  let tableName: string | null;
  try {
    tableName = infoTableName(JSON.parse(indexRes.data));
  } catch {
    return fail("sec", "upstream-error", `${ref.accession} indeksi okunamadı`);
  }

  const coverRes = await secText(`${base}/primary_doc.xml`);
  if (!coverRes.ok) return coverRes;
  const cover = parseCover(coverRes.data);

  /* Bilgi tablosu olmayan bir HR yok sayılmıyor: boş portföy bir sonuçtur
     (fon her şeyi satmış olabilir) ve dosya tekrar tekrar sorulmasın diye
     yine yazılıyor. */
  let raw: RawHolding[] = [];
  if (tableName) {
    const tableRes = await secText(`${base}/${tableName}`);
    if (!tableRes.ok) return tableRes;
    raw = parseInfoTable(tableRes.data);
  }
  const scale = detectValueScale(raw);
  const holdings = aggregateHoldings(raw, scale);
  return ok(
    {
      cover,
      holdings,
      valueTotal: holdings.reduce((sum, holding) => sum + holding.value, 0),
      valueScaled: scale === 1000,
    },
    "sec",
  );
}

/** Dosyanın SEC'teki okunur sayfası — ekrandaki "Kaynak" bağlantısı. */
export function secFilingUrl(cik: number, accession: string): string {
  return `${archiveBase({ cik, accession })}/${accession}-index.html`;
}
