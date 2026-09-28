import { fail, ok, type ProviderResult } from "./types";
import { BACKGROUND_TIMEOUT_MS, withTimeout } from "./timeout";

/**
 * ARK Invest — altı aktif ETF'nin günlük pozisyon dosyaları (28 Eylül).
 *
 * Herkese açık, anahtarsız CSV; her işlem günü sabah (TR öğlene doğru)
 * yenileniyor. Sütunlar: date, fund, company, ticker, cusip, shares,
 * market value ($), weight (%). Sayılar tırnaklı ve binlik virgüllü
 * ("2,141,056", "$796,708,348.16", "9.12%"); dosyanın sonunda tek hücrelik
 * uzun bir yasal not satırı var. Sembolü olmayan satır (varant, nakit
 * benzeri) `ticker` boş gelir ve null yazılır.
 *
 * Üç dosyanın adında `&` var ve yolda `%26` olarak kodlanıyor. Bir ön
 * araştırma adı `&amp;` diye (HTML kaçışıyla) not etmişti; o biçim 404
 * dönüyor (28 Eylül, denendi).
 */

const BASE = "https://assets.ark-funds.com/fund-documents/funds-etf-csv/";

export const ARK_FUNDS = [
  { fund: "ARKK", file: "ARK_INNOVATION_ETF_ARKK_HOLDINGS.csv" },
  { fund: "ARKW", file: "ARK_NEXT_GENERATION_INTERNET_ETF_ARKW_HOLDINGS.csv" },
  { fund: "ARKQ", file: "ARK_AUTONOMOUS_TECH._%26_ROBOTICS_ETF_ARKQ_HOLDINGS.csv" },
  { fund: "ARKG", file: "ARK_GENOMIC_REVOLUTION_ETF_ARKG_HOLDINGS.csv" },
  { fund: "ARKF", file: "ARK_BLOCKCHAIN_%26_FINTECH_INNOVATION_ETF_ARKF_HOLDINGS.csv" },
  { fund: "ARKX", file: "ARK_SPACE_%26_DEFENSE_INNOVATION_ETF_ARKX_HOLDINGS.csv" },
] as const;

export type ArkRow = {
  /** YYYY-MM-DD */
  asOf: string;
  fund: string;
  company: string;
  ticker: string | null;
  cusip: string;
  shares: number;
  marketValue: number;
  weight: number;
};

/** Tırnaklı alanları doğru bölen tek satırlık CSV ayrıştırıcı. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function number(raw: string): number {
  return Number(raw.replace(/[$,%\s]/g, ""));
}

/** "09/28/2026" → "2026-09-28"; tanınmayan biçimde null. */
function isoDate(raw: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/** Dosyanın metninden satırlar. Başlık, yasal not ve bozuk satır atlanıyor. */
export function parseArkCsv(text: string): ArkRow[] {
  const rows: ArkRow[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells.length < 8) continue;
    const [date, fund, company, ticker, cusip, shares, value, weight] = cells;
    const asOf = isoDate(date);
    const parsedShares = number(shares);
    if (!asOf || !cusip.trim() || !Number.isFinite(parsedShares)) continue;
    rows.push({
      asOf,
      fund: fund.trim(),
      company: company.trim(),
      ticker: ticker.trim() || null,
      cusip: cusip.trim(),
      shares: parsedShares,
      marketValue: number(value) || 0,
      weight: number(weight) || 0,
    });
  }
  return rows;
}

export async function getArkHoldings(file: string): Promise<ProviderResult<ArkRow[]>> {
  try {
    const res = await withTimeout(
      fetch(BASE + file, { headers: { Accept: "text/csv" }, cache: "no-store" }),
      BACKGROUND_TIMEOUT_MS,
    );
    if (!res.ok) return fail("ark", "upstream-error", `ARK ${res.status}`);
    const rows = parseArkCsv(await res.text());
    if (rows.length === 0) return fail("ark", "empty", "ARK dosyası boş ya da okunamadı");
    return ok(rows, "ark");
  } catch (error) {
    return fail("ark", "network", error instanceof Error ? error.message : "ARK isteği düştü");
  }
}
