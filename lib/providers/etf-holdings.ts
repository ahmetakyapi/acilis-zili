import { inflateRawSync } from "node:zlib";
import { secUserAgent } from "@/lib/investors";
import { fail, ok, type ProviderResult } from "./types";
import { BACKGROUND_TIMEOUT_MS, withTimeout } from "./timeout";

/**
 * ETF'LERİN İÇİ — hangi hisseler, hangi ağırlıkla (4 Ekim 2026).
 *
 * Fiyat sağlayıcıları (Alpaca, Finnhub) fonun içeriğini vermiyor. İçerik
 * yalnızca fonu çıkaran kurumun kendi dosyasında ya da SEC'e verilen
 * portföy beyanında var. Kaynak fon başına AYRI, çünkü her ihraççı kendi
 * biçiminde yayımlıyor (lib/etf-holdings-data.ts → `HOLDINGS_SOURCES`):
 *
 *   - State Street (SPY, DIA, XLK…): günlük .xlsx. Anahtarsız.
 *   - Roundhill (DRAM): günlük CSV, dosya adında tarih (AAGGYYYY).
 *   - Tema (NASA): günlük CSV; adı tarih taşıyor ve sayfadan okunuyor.
 *   - SEC N-PORT (QQQ): Invesco günlük dosyayı otomatik isteğe kapatıyor
 *     (406, 4 Ekim'de denendi: tarayıcı başlıklarıyla da). Elde kalan resmî
 *     kaynak fonun SEC'e verdiği çeyreklik beyan; tarihi her zaman
 *     ekranda yazıyor çünkü üç aya kadar eski olabiliyor.
 *
 * iShares (IWM) bu tura girmedi: CSV ucu otomatik isteğe aynı başlıkla
 * bazen CSV, bazen ürün sayfasının HTML'ini döndürüyor (4 Ekim, ölçüldü).
 * Güvenilmeyen kaynak ekranda "veri yok"tan kötü.
 *
 * Sağlayıcı sözleşmesi: throw etmez, hata bir değer olarak döner.
 */

export type HoldingRow = {
  /** ABD sembolü; yurt dışı kod, swap ya da nakit benzeri kalemde null. */
  ticker: string | null;
  name: string;
  /** Yüzde (8,45 → 8.45). */
  weight: number;
  cusip: string | null;
};

export type HoldingsFile = {
  /** Portföyün tarihi, YYYY-MM-DD. */
  asOf: string;
  rows: HoldingRow[];
};

const US_TICKER = /^[A-Z]{1,5}(\.[A-Z])?$/;

function usTicker(raw: string | null | undefined): string | null {
  const ticker = raw?.trim().toUpperCase().replace(/\//g, ".") ?? "";
  return US_TICKER.test(ticker) ? ticker : null;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  return withTimeout(fetch(url, { cache: "no-store", ...init }), BACKGROUND_TIMEOUT_MS);
}

/* ==========================================================================
   Küçük biçim yardımcıları
   ========================================================================== */

/** Tırnaklı alanları doğru bölen tek satırlık CSV ayrıştırıcı. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells;
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
}

/**
 * .xlsx bir zip arşivi. Kütüphane eklemek yerine merkez dizinden tek bir
 * girdiyi okuyoruz: State Street dosyası 20-60 KB ve yalnızca iki girdisi
 * lazım (paylaşılan dizeler ve ilk sayfa). Sıkıştırma yöntemi 8 (deflate)
 * ya da 0 (yok).
 */
export function readZipEntry(zip: Buffer, name: string): string | null {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 66_000); i -= 1) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  for (let n = 0; n < count; n += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(offset + 10);
    const compressed = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const entry = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (entry === name) {
      const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(dataStart, dataStart + compressed);
      if (method === 0) return data.toString("utf8");
      if (method === 8) return inflateRawSync(data).toString("utf8");
      return null;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** İlk sayfanın hücreleri, satır satır, sütun harfine göre. */
export function readXlsxRows(zip: Buffer): Record<string, string>[] | null {
  const sheet = readZipEntry(zip, "xl/worksheets/sheet1.xml");
  if (!sheet) return null;
  const shared = readZipEntry(zip, "xl/sharedStrings.xml") ?? "";
  const strings = [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decodeXml(m[1].replace(/<[^>]+>/g, "")),
  );
  const rows: Record<string, string>[] = [];
  for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: Record<string, string> = {};
    for (const cell of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, column, attrs, body = ""] = cell;
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1];
      if (value !== undefined && attrs.includes('t="s"')) cells[column] = strings[Number(value)] ?? "";
      else if (value !== undefined) cells[column] = decodeXml(value);
      else if (inline !== undefined) cells[column] = decodeXml(inline);
    }
    rows.push(cells);
  }
  return rows;
}

/* ==========================================================================
   State Street (SPDR)
   ========================================================================== */

/**
 * Sayfa düzeni (4 Ekim'de üç fonda doğrulandı: SPY, XLK, DIA):
 *   Fund Name: … / Ticker Symbol: … / Holdings: "As of 01-Oct-2026"
 *   Name | Ticker | Identifier | SEDOL | Weight | Sector | Shares Held | …
 * Ağırlık sütunu sayı olmayan ilk satırda pozisyonlar bitiyor; altında
 * yasal metinler var. "US DOLLAR" (ticker "-") nakit kalemi atlanıyor.
 */
export function parseSsgaRows(rows: Record<string, string>[]): HoldingsFile | null {
  const asOfCell = rows.find((row) => row.A?.startsWith("Holdings"))?.B ?? "";
  const date = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(asOfCell);
  const month = date ? MONTHS[date[2].toLowerCase()] : undefined;
  if (!date || !month) return null;
  const asOf = `${date[3]}-${month}-${date[1].padStart(2, "0")}`;

  const header = rows.findIndex((row) => row.A === "Name" && row.E === "Weight");
  if (header < 0) return null;
  const holdings: HoldingRow[] = [];
  for (const row of rows.slice(header + 1)) {
    const weight = Number(row.E);
    if (!row.A || row.E === undefined || row.E === "" || !Number.isFinite(weight)) break;
    if (row.B === "-" || /^US DOLLAR$/i.test(row.A)) continue;
    holdings.push({ ticker: usTicker(row.B), name: row.A.trim(), weight, cusip: row.C?.trim() || null });
  }
  return holdings.length > 0 ? { asOf, rows: holdings } : null;
}

export async function getSsgaHoldings(symbol: string): Promise<ProviderResult<HoldingsFile>> {
  const url = `https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-${symbol.toLowerCase()}.xlsx`;
  try {
    const res = await get(url);
    if (!res.ok) return fail("ssga", "upstream-error", `State Street ${res.status}`);
    const rows = readXlsxRows(Buffer.from(await res.arrayBuffer()));
    const parsed = rows ? parseSsgaRows(rows) : null;
    return parsed ? ok(parsed, "ssga") : fail("ssga", "empty", "State Street dosyası okunamadı");
  } catch (error) {
    return fail("ssga", "network", error instanceof Error ? error.message : "State Street isteği düştü");
  }
}

/* ==========================================================================
   Roundhill (DRAM)
   ========================================================================== */

/**
 * Tek dosya, bütün Roundhill fonları: `Account` sütunu fonu söylüyor.
 *
 * SWAP'LAR DAYANAK HİSSEYLE BİRLEŞİYOR. DRAM Micron'u üç satırda tutuyor:
 * hissenin kendisi (%0,64) ve iki toplam getiri swap'ı (%15,58 + %9,88).
 * Swap satırının kimliği dayanağın kimliğiyle başlıyor ("595112103 TRS
 * 052427 GS"), yani ilk sözcük ortak anahtar. Roundhill'in kendi "Top
 * Holdings" tablosu da böyle hesaplıyor (sayfadaki not: "weight
 * calculation combines stock position with position held via total return
 * swaps"). Aynı ada sahip iki menkul (Samsung adi + imtiyazlı, SK hynix
 * Kore hissesi + ABD ADR'si) de tek satırda toplanıyor.
 *
 * Hazine bonosu, para piyasası fonu, döviz ve "Cash & Other" satırları
 * pozisyon değil, swap'ların teminatı: listeden çıkıyor. Bu yüzden hisse
 * ağırlıklarının toplamı %100'ü geçebiliyor (swap kaldıraç gibi çalışıyor);
 * panel künyesi bunu yazıyor.
 */
export function parseRoundhillCsv(text: string, fund: string): HoldingsFile | null {
  const lines = text.split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? "");
  const col = (name: string) => header.indexOf(name);
  const [iDate, iAccount, iTicker, iCusip, iName, iWeight, iMoney] = [
    col("Date"), col("Account"), col("StockTicker"), col("CUSIP"), col("SecurityName"), col("Weightings"), col("MoneyMarketFlag"),
  ];
  if ([iDate, iAccount, iTicker, iCusip, iName, iWeight].some((index) => index < 0)) return null;

  type Group = { key: string; name: string | null; swapName: string; ticker: string | null; weight: number };
  const groups = new Map<string, Group>();
  let asOf: string | null = null;
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells[iAccount]?.trim() !== fund) continue;
    const name = cells[iName]?.trim() ?? "";
    const cusip = cells[iCusip]?.trim() ?? "";
    if (cells[iMoney]?.trim() === "Y" || /^cash\b|treasury bill/i.test(name) || cusip.startsWith("CASH")) continue;
    const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(cells[iDate]?.trim() ?? "");
    if (date) asOf = `${date[3]}-${date[1]}-${date[2]}`;
    const weight = Number((cells[iWeight] ?? "").replace(/[%,\s]/g, ""));
    if (!Number.isFinite(weight)) continue;
    const key = cusip.split(/\s+/)[0];
    const isSwap = /\bTRS\b/.test(cusip) || /SWAP/i.test(name);
    const group = groups.get(key) ?? { key, name: null, swapName: "", ticker: null, weight: 0 };
    group.weight += weight;
    if (isSwap) group.swapName ||= name.replace(/[\s-]*SWAP.*$/i, "").replace(/,$/, "").trim();
    else group.name ||= name;
    group.ticker ||= usTicker(cells[iTicker]);
    groups.set(key, group);
  }
  if (!asOf || groups.size === 0) return null;

  /* Aynı adlı grupları birleştir (adi + imtiyazlı, yerel hisse + ADR). */
  const byName = new Map<string, HoldingRow>();
  for (const group of groups.values()) {
    const name = group.name ?? group.swapName;
    const key = name.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "");
    const existing = byName.get(key);
    if (existing) {
      existing.weight += group.weight;
      existing.ticker ||= group.ticker;
    } else {
      byName.set(key, { ticker: group.ticker, name, weight: group.weight, cusip: /^[0-9A-Z]{9}$/.test(group.key) ? group.key : null });
    }
  }
  return { asOf, rows: [...byName.values()].filter((row) => row.weight > 0) };
}

export async function getRoundhillHoldings(fund: string, today: Date = new Date()): Promise<ProviderResult<HoldingsFile>> {
  /* Dosya adı portföy tarihini taşıyor (AAGGYYYY); hafta sonu ve tatilde
     yeni dosya yok. Bugünden geriye en fazla yedi gün deneniyor — sitenin
     kendi betiği de aynı şeyi yapıyor (on beş deneme). */
  try {
    for (let back = 0; back < 7; back += 1) {
      const day = new Date(today.getTime() - back * 86_400_000);
      const stamp = `${String(day.getUTCMonth() + 1).padStart(2, "0")}${String(day.getUTCDate()).padStart(2, "0")}${day.getUTCFullYear()}`;
      const res = await get(`https://www.roundhillinvestments.com/assets/data/FilepointRoundhill.40RU.RU_Holdings_${stamp}.csv`);
      if (!res.ok) continue;
      const text = await res.text();
      /* Olmayan tarih 404 değil, 200 ile sitenin HTML'ini döndürüyor. */
      if (!text.startsWith("Date,")) continue;
      const parsed = parseRoundhillCsv(text, fund);
      /* Dosyanın İÇİNDEKİ tarih bir sonraki iş günü (2 Ekim Cuma dosyası
         "10/05/2026" yazıyor: pazartesinin sepeti). Ekranda gelecek bir
         tarih durmasın diye portföy tarihi dosyanın yayın günü. */
      if (parsed) return ok({ ...parsed, asOf: day.toISOString().slice(0, 10) }, "roundhill");
    }
    return fail("roundhill", "empty", "Roundhill dosyası bulunamadı");
  } catch (error) {
    return fail("roundhill", "network", error instanceof Error ? error.message : "Roundhill isteği düştü");
  }
}

/* ==========================================================================
   Tema (NASA)
   ========================================================================== */

/**
 * Sütunlar: holdings_date, ticker, cusip, proper_name, shares,
 * market_value, percent_of_nav (KESİR: 0.1658 = %16,58), is_cash, country,
 * sector. "SPACEX SPV" bir sembol değil, SpaceX'e özel amaçlı araç
 * üzerinden tutulan pay; yurt dışı kodlar ("3491 TT") sembol sayılmıyor.
 */
export function parseTemaCsv(text: string): HoldingsFile | null {
  const lines = text.split(/\r?\n/);
  const header = splitCsvLine(lines[0] ?? "");
  const col = (name: string) => header.indexOf(name);
  const [iDate, iTicker, iCusip, iName, iPct, iCash] = [
    col("holdings_date"), col("ticker"), col("cusip"), col("proper_name"), col("percent_of_nav"), col("is_cash"),
  ];
  if ([iDate, iTicker, iName, iPct].some((index) => index < 0)) return null;
  let asOf: string | null = null;
  const rows: HoldingRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    if (iCash >= 0 && cells[iCash]?.trim() === "1") continue;
    const weight = Number(cells[iPct]) * 100;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(cells[iDate]?.trim() ?? "")) asOf = cells[iDate].trim();
    const cusip = iCusip >= 0 ? cells[iCusip]?.trim() ?? "" : "";
    rows.push({
      ticker: usTicker(cells[iTicker]),
      name: cells[iName]?.trim() || cells[iTicker]?.trim() || "",
      weight,
      cusip: /^[0-9A-Z]{9}$/.test(cusip) ? cusip : null,
    });
  }
  return asOf && rows.length > 0 ? { asOf, rows } : null;
}

export async function getTemaHoldings(fund: string): Promise<ProviderResult<HoldingsFile>> {
  try {
    const page = await get(`https://temaetfs.com/${fund.toLowerCase()}`);
    if (!page.ok) return fail("tema", "upstream-error", `Tema ${page.status}`);
    const html = await page.text();
    const link = new RegExp(`https://temaetfs\\.com/hubfs/Website/Holdings/${fund}-holdings-\\d{8}\\.csv`, "i").exec(html)?.[0];
    if (!link) return fail("tema", "empty", "Tema sayfasında pozisyon dosyası yok");
    const res = await get(link);
    if (!res.ok) return fail("tema", "upstream-error", `Tema ${res.status}`);
    const parsed = parseTemaCsv(await res.text());
    return parsed ? ok(parsed, "tema") : fail("tema", "empty", "Tema dosyası okunamadı");
  } catch (error) {
    return fail("tema", "network", error instanceof Error ? error.message : "Tema isteği düştü");
  }
}

/* ==========================================================================
   SEC N-PORT (QQQ)
   ========================================================================== */

/**
 * Fonun son NPORT-P beyanı. `repPdDate` portföyün tarihi (çeyrek sonu
 * ayı); beyan o tarihten ~60 gün sonra herkese açılıyor. Satırlar sembol
 * TAŞIMIYOR, yalnızca ad ve CUSIP: sembol veri katmanında kalıcı CUSIP
 * tablosundan (13F için kurulan `cusip_tickers`) eşleniyor.
 */
export function parseNport(xml: string): HoldingsFile | null {
  const asOf = /<repPdDate>(\d{4}-\d{2}-\d{2})<\/repPdDate>/.exec(xml)?.[1];
  if (!asOf) return null;
  const rows: HoldingRow[] = [];
  for (const match of xml.matchAll(/<invstOrSec>([\s\S]*?)<\/invstOrSec>/g)) {
    const body = match[1];
    const tag = (name: string) => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body)?.[1]?.trim() ?? "";
    if (tag("assetCat") !== "EC" || tag("payoffProfile") === "Short") continue;
    const weight = Number(tag("pctVal"));
    if (!Number.isFinite(weight) || weight <= 0) continue;
    const cusip = tag("cusip");
    rows.push({ ticker: null, name: decodeXml(tag("name")), weight, cusip: /^[0-9A-Z]{9}$/.test(cusip) ? cusip : null });
  }
  return rows.length > 0 ? { asOf, rows } : null;
}

export async function getNportHoldings(cik: string): Promise<ProviderResult<HoldingsFile>> {
  const headers = { "User-Agent": secUserAgent(), Accept: "application/json" };
  try {
    const padded = cik.padStart(10, "0");
    const list = await get(`https://data.sec.gov/submissions/CIK${padded}.json`, { headers });
    if (!list.ok) return fail("sec", "upstream-error", `SEC ${list.status}`);
    const json = (await list.json()) as {
      filings?: { recent?: { form?: string[]; accessionNumber?: string[]; primaryDocument?: string[] } };
    };
    const recent = json.filings?.recent;
    const index = recent?.form?.findIndex((form) => form === "NPORT-P") ?? -1;
    const accession = index >= 0 ? recent?.accessionNumber?.[index] : undefined;
    if (!accession) return fail("sec", "empty", "N-PORT beyanı bulunamadı");
    const document = recent?.primaryDocument?.[index]?.replace(/^.*\//, "") || "primary_doc.xml";
    const res = await get(
      `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, "")}/${document}`,
      { headers: { "User-Agent": secUserAgent() } },
    );
    if (!res.ok) return fail("sec", "upstream-error", `SEC ${res.status}`);
    const parsed = parseNport(await res.text());
    return parsed ? ok(parsed, "sec") : fail("sec", "empty", "N-PORT okunamadı");
  } catch (error) {
    return fail("sec", "network", error instanceof Error ? error.message : "SEC isteği düştü");
  }
}
