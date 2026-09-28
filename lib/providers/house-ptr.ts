import { inflateRawSync } from "node:zlib";
import { fail, ok, type ProviderResult } from "./types";
import { BACKGROUND_TIMEOUT_MS, withTimeout } from "./timeout";

/**
 * ABD Temsilciler Meclisi — üyelerin işlem bildirimleri (PTR) (28 Eylül).
 *
 * İKİ ADIM:
 *   1. Yıllık indeks: `financial-pdfs/{yıl}FD.zip` içinde `{yıl}FD.xml`.
 *      Her bildirim bir `Member` kaydı: soyadı, adı, tür (`P` = PTR),
 *      tarih ve belge numarası. ~60 KB; günlük senkronun tek sabit maliyeti.
 *   2. Bildirimin kendisi PDF: `ptr-pdfs/{yıl}/{DocID}.pdf`. Elektronik
 *      verilen PTR'lerin metin katmanı var; `pdfjs-dist` (depoda zaten
 *      kurulu, vergi hesaplayıcının PDF içe aktarması için) onu satırlara
 *      çeviriyor, `parsePtrLines` satırları işlemlere.
 *
 * ZIP İÇİN BAĞIMLILIK YOK. Arşivden tek bir dosya çekiyoruz; merkezi
 * dizini okuyup Node'un `inflateRawSync`iyle açan kırk satır yetiyor
 * (`readZipEntry`). Şifreli ya da ZIP64 arşiv beklenmiyor; gelirse hata
 * değer olarak dönüyor, senkron düşmüyor.
 *
 * TUTAR ARALIK. Bildirim tek bir sayı değil bir aralık veriyor
 * ("$1,000,001 - $5,000,000"); iki uç ayrı tutuluyor, tek sayı uydurulmuyor.
 */

const BASE = "https://disclosures-clerk.house.gov/public_disc";

async function houseFetch(url: string): Promise<ProviderResult<ArrayBuffer>> {
  try {
    const res = await withTimeout(fetch(url, { cache: "no-store" }), BACKGROUND_TIMEOUT_MS);
    if (res.status === 404) return fail("house", "not-found", `${url} bulunamadı`);
    if (!res.ok) return fail("house", "upstream-error", `House ${res.status}`);
    return ok(await res.arrayBuffer(), "house");
  } catch (error) {
    return fail("house", "network", error instanceof Error ? error.message : "House isteği düştü");
  }
}

/* --------------------------------------------------------------------------
   ZIP — merkezi dizinden tek dosya
   -------------------------------------------------------------------------- */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN = 22;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

/** Arşivden adı verilen dosyanın baytları; yoksa null. Saf; sınanıyor. */
export function readZipEntry(zip: Uint8Array, name: string): Uint8Array | null {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - EOCD_MIN; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n += 1) {
    if (cursor + 46 > zip.length || view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) return null;
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const entryName = decoder.decode(zip.subarray(cursor + 46, cursor + 46 + nameLength));
    if (entryName === name) {
      if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) return null;
      const start =
        localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const data = zip.subarray(start, start + compressed);
      if (method === METHOD_STORED) return data;
      if (method === METHOD_DEFLATE) return new Uint8Array(inflateRawSync(data));
      return null;
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/* --------------------------------------------------------------------------
   Yıllık indeks
   -------------------------------------------------------------------------- */

export type HouseFiling = { docId: string; filedAt: string; year: number };

function tagText(block: string, tag: string): string {
  return block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim() ?? "";
}

/** "7/9/2025" → "2025-07-09". */
export function isoFromUsDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

/** Üyenin PTR kayıtları, indeks XML'inden. Saf; sınanıyor. */
export function memberPtrs(xml: string, member: { last: string; first: string }): HouseFiling[] {
  const out: HouseFiling[] = [];
  for (const block of xml.match(/<Member>[\s\S]*?<\/Member>/g) ?? []) {
    if (tagText(block, "Last") !== member.last || tagText(block, "First") !== member.first) continue;
    if (tagText(block, "FilingType") !== "P") continue;
    const docId = tagText(block, "DocID");
    const filedAt = isoFromUsDate(tagText(block, "FilingDate"));
    const year = Number(tagText(block, "Year"));
    if (!/^\d+$/.test(docId) || !filedAt || !Number.isFinite(year)) continue;
    out.push({ docId, filedAt, year });
  }
  return out.sort((a, b) => a.filedAt.localeCompare(b.filedAt));
}

export async function getMemberPtrs(
  year: number,
  member: { last: string; first: string },
): Promise<ProviderResult<HouseFiling[]>> {
  const res = await houseFetch(`${BASE}/financial-pdfs/${year}FD.zip`);
  if (!res.ok) return res;
  const entry = readZipEntry(new Uint8Array(res.data), `${year}FD.xml`);
  if (!entry) return fail("house", "upstream-error", `${year}FD.zip içinde indeks yok`);
  return ok(memberPtrs(new TextDecoder().decode(entry), member), "house");
}

/* --------------------------------------------------------------------------
   PDF → satırlar
   -------------------------------------------------------------------------- */

/** Tablonun sütunları, başlık satırındaki sırayla. */
const COLUMNS = ["ID", "Owner", "Asset", "Transaction", "Date", "Notification", "Amount", "Cap."] as const;
/** Parça sütun başlangıcının bu kadar solunda da olsa o sütuna sayılır. */
const COLUMN_SLACK = 4;
// Denetim karakterleri — NUL dahil; kaynak dosyada kaçış dizisiyle yazılı.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000b-\\u001f]", "g");
/** Aynı satır sayılan dikey sapma, punto. */
const ROW_TOLERANCE = 3;

type Piece = { x: number; y: number; str: string };

/**
 * Sayfanın parçalarını satırlara çevir. Başlık satırı ("ID Owner Asset…")
 * bulunan sayfada her satır SEKİZ HÜCRE olarak, sekmeyle ayrılmış dönüyor:
 * parçalar başlıktaki sütun başlangıçlarına göre hücreye düşüyor. Varlık
 * adı ve tutar iki satıra kırılıyor; hangi parçanın hangi sütuna ait
 * olduğunu boşluk genişliği değil başlığın konumu söylüyor. Saf.
 */
export function pageLines(pieces: readonly Piece[]): string[] {
  const rows: Piece[][] = [];
  for (const piece of [...pieces].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - piece.y) <= ROW_TOLERANCE);
    if (row) row.push(piece);
    else rows.push([piece]);
  }
  rows.sort((a, b) => b[0].y - a[0].y);
  const header = rows.find(
    (row) => row.some((piece) => piece.str.trim() === "Owner") && row.some((piece) => piece.str.trim() === "Asset"),
  );
  const starts = header
    ? COLUMNS.map((name) => header.find((piece) => piece.str.trim() === name)?.x ?? Number.NaN)
    : null;

  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    if (!starts || starts.some((x) => Number.isNaN(x))) {
      return row.map((piece) => piece.str).join(" ").replace(/\s+/g, " ").trim();
    }
    const cells: string[] = COLUMNS.map(() => "");
    for (const piece of row) {
      let column = 0;
      for (let i = 0; i < starts.length; i += 1) if (piece.x >= starts[i] - COLUMN_SLACK) column = i;
      cells[column] = `${cells[column]} ${piece.str}`.trim();
    }
    return cells.map((cell) => cell.replace(/\s+/g, " ").trim()).join("\t");
  });
}

/**
 * PDF'i satırlara (Node). `pdfjs-dist`in `legacy` yapısı Node'da çalışıyor
 * ve çalışanı (worker) aynı süreçte kuruyor; Next sunucu paketine
 * girmemesi için `next.config.ts` → `serverExternalPackages`.
 */
export async function pdfTextLines(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
  });
  const doc = await task.promise;
  const lines: string[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const pieces: Piece[] = [];
      for (const item of content.items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const transform = item.transform as number[];
        /* Küçük büyük harfli etiketlerin ("FILING STATUS") harfleri yazı
           tipinde yok ve NUL karakteri olarak geliyor; boşluğa çevriliyor. */
        pieces.push({ x: transform[4], y: transform[5], str: item.str.replace(CONTROL_CHARS, " ") });
      }
      lines.push(...pageLines(pieces));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return lines;
}

/* --------------------------------------------------------------------------
   Satırlar → işlemler
   -------------------------------------------------------------------------- */

export type PtrTrade = {
  rowNo: number;
  owner: string | null;
  asset: string;
  ticker: string | null;
  assetType: string | null;
  /** "P" | "S" | "S (partial)" | "E" */
  txType: string;
  txDate: string;
  notifiedDate: string | null;
  amountLow: number | null;
  amountHigh: number | null;
  description: string | null;
};

const TX_TYPES = new Set(["P", "S", "S (partial)", "E"]);
const DATE = /^\d{2}\/\d{2}\/\d{4}$/;
/** "F S : New", "D : Purchased…", "C : Loss…" — sayfadaki küçük büyük
    harfli etiketlerin harfleri düşmüş, geriye ilk harf ve iki nokta kalıyor. */
const LABEL = /^([A-Z])(?:\s+[A-Z])*\s*:\s*(.*)$/;

/** "$1,000,001 - $5,000,000" → [1000001, 5000000]; "Over $50,000,000" → [50000000, null]. */
export function parseAmountRange(raw: string): { low: number | null; high: number | null } {
  const text = raw.replace(/\s+/g, " ").trim();
  const range = text.match(/\$([\d,]+(?:\.\d+)?)\s*-\s*\$([\d,]+(?:\.\d+)?)/);
  const num = (value: string) => Number(value.replace(/,/g, ""));
  if (range) return { low: num(range[1]), high: num(range[2]) };
  const over = text.match(/(?:over|>)\s*\$([\d,]+)/i);
  if (over) return { low: num(over[1]), high: null };
  return { low: null, high: null };
}

/** PTR tablosunun satırlarından işlemler. Saf; sınanıyor. */
export function parsePtrLines(lines: readonly string[]): PtrTrade[] {
  const trades: PtrTrade[] = [];
  type Draft = {
    owner: string | null;
    asset: string[];
    amount: string[];
    txType: string;
    txDate: string;
    notified: string | null;
    description: string[];
    comment: string[];
  };
  let draft: Draft | null = null;
  let mode: "asset" | "desc" | "comment" | "other" = "other";

  const finish = () => {
    if (!draft) return;
    const assetText = draft.asset.join(" ").replace(/\s+/g, " ").trim();
    const tickers = [...assetText.matchAll(/\(([A-Z][A-Z0-9.\-]{0,9})\)/g)];
    const ticker = tickers.length > 0 ? tickers[tickers.length - 1][1] : null;
    const assetType = assetText.match(/\[([A-Z]{2})\]/)?.[1] ?? null;
    const name = assetText
      .replace(/\(([A-Z][A-Z0-9.\-]{0,9})\)/g, "")
      .replace(/\[[A-Z]{2}\]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[\s-]+$/, "")
      .trim();
    const { low, high } = parseAmountRange(draft.amount.join(" "));
    const description = [...draft.description, ...draft.comment].join(" ").replace(/\s+/g, " ").trim();
    trades.push({
      rowNo: trades.length + 1,
      owner: draft.owner,
      asset: name || assetText,
      ticker,
      assetType,
      txType: draft.txType,
      txDate: isoFromUsDate(draft.txDate)!,
      notifiedDate: draft.notified ? isoFromUsDate(draft.notified) : null,
      amountLow: low,
      amountHigh: high,
      description: description || null,
    });
    draft = null;
  };

  for (const line of lines) {
    if (/^\*\s*For the complete list/.test(line.replace(/\t/g, " ").trim())) break;
    const cells = line.replace(CONTROL_CHARS, " ").split("\t");
    if (cells.length < COLUMNS.length) continue;
    const [, owner, asset, type, txDate, notified, amount] = cells;
    if (owner === "Owner" || type === "Type" || /^\$200\?/.test(cells[7] ?? "")) continue;

    if (TX_TYPES.has(type) && DATE.test(txDate)) {
      finish();
      draft = {
        owner: owner || null,
        asset: asset ? [asset] : [],
        amount: amount ? [amount] : [],
        txType: type,
        txDate,
        notified: DATE.test(notified) ? notified : null,
        description: [],
        comment: [],
      };
      mode = "asset";
      continue;
    }
    if (!draft) continue;

    const label = asset.match(LABEL);
    if (label) {
      if (label[1] === "D") {
        mode = "desc";
        draft.description.push(label[2]);
      } else if (label[1] === "C") {
        mode = "comment";
        draft.comment.push(label[2]);
      } else {
        mode = "other";
      }
      continue;
    }
    if (mode === "asset") {
      if (asset) draft.asset.push(asset);
      if (amount) draft.amount.push(amount);
    } else if (mode === "desc" && asset) {
      draft.description.push(asset);
    } else if (mode === "comment" && asset) {
      draft.comment.push(asset);
    }
  }
  finish();
  return trades;
}

export async function getPtrTrades(filing: HouseFiling): Promise<ProviderResult<PtrTrade[]>> {
  const res = await houseFetch(`${BASE}/ptr-pdfs/${filing.year}/${filing.docId}.pdf`);
  if (!res.ok) return res;
  try {
    return ok(parsePtrLines(await pdfTextLines(new Uint8Array(res.data))), "house");
  } catch (error) {
    return fail("house", "upstream-error", error instanceof Error ? error.message : "PDF okunamadı");
  }
}

/** Bildirimin okunur adresi — ekrandaki "Kaynak" bağlantısı. */
export function ptrUrl(year: number, docId: string): string {
  return `${BASE}/ptr-pdfs/${year}/${docId}.pdf`;
}
