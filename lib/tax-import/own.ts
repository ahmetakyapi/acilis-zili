import type { ImportedDividend, ImportedTrade, ImportResult } from "./core";
import { parseAmount } from "./core";

/**
 * VERGİ HESAPLAYICISININ KENDİ DÖKÜMÜ (9 Ekim).
 *
 * Hesaplayıcı hiçbir şey saklamıyor ve "CSV indirmek bunun için var"
 * diyordu; ama indirilen dosya geri yüklendiğinde genel tanıyıcıya düşüyor
 * ve hiçbir satır seçili gelmiyordu — yedek bir oturumu geri getirmiyordu.
 *
 * Dosya bir SONUÇ tablosu: her satır FIFO'nun eşleştirdiği bir parça
 * (sembol, alış günü, satış günü, adet, kurlar, lira tutarları), altında
 * temettüler. Geri yüklemede her parça bir alış + bir satış oluyor;
 * komisyon parçanın dolar maliyetine/gelirine zaten katılı (MatchedLot),
 * yani fiyat komisyon dahil yazılıyor ve sonuç birebir aynı çıkıyor.
 *
 * İKİ SÜRÜM: 9 Ekim'den sonra dosya parçanın DOLAR maliyetini ve gelirini
 * de taşıyor (son iki sütun). Eski dosyada o sütunlar yok; dolar tutarı
 * lira tutarı ÷ o günün kuru olarak geri türetiliyor (lira tutarı zaten
 * dolar × kur diye hesaplanmıştı). Kur boşsa o satır atlanıyor — sayı
 * uydurulmuyor.
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SYMBOL = /^[A-Z][A-Z.-]{0,9}$/;

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cell);
      cell = "";
    } else cell += ch;
  }
  out.push(cell);
  return out.map((value) => value.trim());
}

function rows(text: string): { cells: string[][]; decimal: "," | "." } {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((line) => line.trim() !== "");
  /* TR dökümü noktalı virgül + virgüllü ondalık, EN virgül + nokta (toCsv). */
  const sep = lines.some((line) => line.includes(";")) ? ";" : ",";
  return { cells: lines.map((line) => splitLine(line, sep)), decimal: sep === ";" ? "," : "." };
}

const isLotRow = (cells: string[]) =>
  cells.length >= 11 && SYMBOL.test(cells[0]) && ISO.test(cells[1]) && ISO.test(cells[2]) && /\d/.test(cells[3]);

/** Dosya bu hesaplayıcının dökümü mü — en az bir parça satırı yeter. */
export function looksLikeOwnCsv(text: string): boolean {
  return rows(text).cells.some(isLotRow);
}

export function parseOwnCsv(text: string): ImportResult {
  const { cells, decimal } = rows(text);
  const num = (value: string | undefined) => (value === undefined || value === "" ? null : parseAmount(value, decimal));
  const trades: ImportedTrade[] = [];
  const dividends: ImportedDividend[] = [];
  const skipped: ImportResult["skipped"] = [];

  for (const row of cells) {
    const source = row.join(" · ");
    if (isLotRow(row)) {
      const quantity = num(row[3]);
      const buyRate = num(row[4]);
      const sellRate = num(row[5]);
      const costTl = num(row[6]);
      const proceedsTl = num(row[9]);
      const costUsd = num(row[11]) ?? (costTl !== null && buyRate ? costTl / buyRate : null);
      const proceedsUsd = num(row[12]) ?? (proceedsTl !== null && sellRate ? proceedsTl / sellRate : null);
      if (!quantity || quantity <= 0 || costUsd === null || proceedsUsd === null) {
        skipped.push({ source, reason: "unreadable" });
        continue;
      }
      const base = { symbol: row[0], quantity, commissionUsd: 0, currency: "USD", flags: [], source };
      trades.push({ ...base, side: "buy", date: row[1], priceUsd: costUsd / quantity, stamp: `${row[1]}|own-buy|${trades.length}` });
      trades.push({ ...base, side: "sell", date: row[2], priceUsd: proceedsUsd / quantity, stamp: `${row[2]}|own-sell|${trades.length}` });
      continue;
    }
    /* Temettü satırı: sembol, ödeme günü, brüt dolar, stopaj yüzdesi, … */
    if (row.length >= 4 && SYMBOL.test(row[0]) && ISO.test(row[1])) {
      const grossUsd = num(row[2]);
      const pct = num(row[3]);
      if (grossUsd === null || grossUsd <= 0) continue;
      dividends.push({
        symbol: row[0],
        date: row[1],
        grossUsd,
        withheldUsd: pct === null ? null : (grossUsd * pct) / 100,
        currency: "USD",
        flags: pct === null ? ["noWithholding"] : [],
        source,
      });
    }
  }
  return { broker: "acilis-zili", trades, dividends, skipped };
}
