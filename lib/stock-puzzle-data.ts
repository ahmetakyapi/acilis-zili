import "server-only";

import { createHmac } from "node:crypto";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { symbols as symbolsTable } from "@/lib/schema";
import { ALL_MEMBERS, indexMemberOf, primaryOnly } from "@/db/seed/indices";
import { SYMBOL_ALIASES } from "@/db/seed/aliases";
import { describeSymbol } from "@/db/seed/descriptions";
import { getCompanies, getStatus } from "@/lib/data";
import { getChartBars } from "@/lib/providers";
import { getAllMetrics } from "@/lib/symbol-metrics";
import { sectorLabel } from "@/lib/sectors";
import { foldForSearch } from "@/lib/search-fold";
import type { Locale } from "@/lib/i18n/config";
import {
  MAX_GUESSES,
  POOL_SIZE,
  cluesFor,
  compareGuess,
  dayNumberOf,
  firstSentence,
  pickDaily,
  puzzleNumber,
  silhouetteOf,
  statusOf,
  visibleClues,
  type Clue,
  type GuessRow,
  type PoolOption,
  type PuzzleFacts,
  type PuzzleRank,
  type PuzzleState,
} from "@/lib/stock-puzzle";

/**
 * "Hisseyi Bil" — sunucu tarafı (24 Ekim). Saf kurallar `lib/stock-puzzle.ts`.
 *
 * CEVAP İSTEMCİYE SIZMAZ: sayfa ve `/api/bulmaca` istemciye yalnızca
 * açılmış ipuçlarını ve tahminlerin karşılaştırmasını verir; cevap ancak
 * bulmaca bittiğinde (`status !== "playing"`) yanıta girer. Uç durumsuz:
 * istemci tahmin listesini her istekte yeniden gönderir, sunucu sonucu
 * baştan hesaplar.
 *
 * DURUMSUZ UCUN BEDELİ, AÇIKÇA (25 Ekim düzeltmesi): tek bir POST'la havuzdan
 * altı farklı uydurma tahmin gönderen biri bitmiş bulmacanın yanıtında
 * cevabı görür, sonra kendi tarayıcısında ilk tahminde "bilir". Bu,
 * oyunu kaybetmekle aynı şey DEĞİL; eski yorum öyle diyordu. Uç bunu
 * ayırt edemez: geri yükleme de (`StockPuzzle` → `restoredRef`) birden
 * çok tahmini tek istekte gönderiyor ve sunucu kimin hangi tahmini
 * önceden yaptığını bilmiyor. Bilerek kabul edildi, çünkü kazanılan bir
 * şey yok: skor, seri ve dağılım yalnız o tarayıcıda (localStorage);
 * sunucuda tablo, sıralama ya da ödül yok. Hile yapan yalnız kendi
 * serisini şişirir. Sunucuda skor tutulursa bu kabul geçersiz olur; o gün
 * tahminler sunucuda oturum başına sırayla kaydedilmeli.
 *
 * YARININ CEVABI HESAPLANAMAZ: günün seçimi gizli sırdan türetilen
 * anahtarla (`secretRank`); hiçbir veritabanı yazması yok.
 */

/**
 * Seçim anahtarının sırrı — YENİ ORTAM DEĞİŞKENİ YOK: `AUTH_SECRET`
 * next-auth'un üretimde zaten şart koştuğu değer (ziyaretçi özetinin tuzu
 * da ondan, `lib/analytics.ts`). Anahtar sırrın kendisi değil, ondan HMAC
 * ile türetilmiş bir alt anahtar: sırrın başka bir kullanımıyla
 * karışmaz ve bulmacanın çıktısından geri hesaplanamaz.
 *
 * Yerelde ikisi de boşsa sabit bir geliştirme dizesine düşer — o zaman
 * sıra yine tahmin edilebilir; üretimde bu dala düşülmez (next-auth
 * sırsız açılmıyor). Sır değişirse günün cevabı da değişir; önbellek
 * (`cachedAnswer`) günün ilk seçimini iki gün tuttuğu için o gün oynayan
 * okur etkilenmez, ertesi günden yeni sıra başlar.
 */
let derivedKey: Buffer | null = null;
function puzzleKey(): Buffer {
  if (!derivedKey) {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "gelistirme-bulmaca";
    derivedKey = createHmac("sha256", secret).update("hisseyi-bil:sira:v1").digest();
  }
  return derivedKey;
}

const secretRank: PuzzleRank = (symbol, cycle) =>
  createHmac("sha256", puzzleKey()).update(`${cycle}:${symbol}`).digest("hex");

type PoolEntry = {
  symbol: string;
  /** Endeks tohumundaki kısa ad ("Nvidia"); yoksa sağlayıcının adı. */
  name: string;
  /** Sağlayıcının resmî adı — aramada ikinci ad. */
  legalName: string;
  logoUrl: string | null;
  sector: string | null;
  marketCap: number | null;
};

/**
 * HAVUZ KURALDAN, ELLE YAZILMIŞ LİSTEDEN DEĞİL: endeks üyesi (S&P 500,
 * Nasdaq-100, Dow; birincil hisse sınıfı), GICS sektörü bilinen, dolar
 * cinsinden piyasa değeri olan şirketlerden en büyük `POOL_SIZE`. Elle
 * liste tutulsaydı endeks değiştikçe eskirdi; kural endeks tohumu ve
 * `symbols` tablosuyla kendiliğinden yürüyor. Piyasa değeri `getCompanies`
 * ile aynı hesap (önbellekteki fiyat × hisse sayısı, `liveMarketCap`).
 * 24 Ekim'de 200. sıra 63 milyar dolar (Targa Resources).
 */
async function loadPool(): Promise<PoolEntry[]> {
  const companies = await getCompanies();
  const bySymbol = new Map(companies.map((row) => [row.symbol, row]));
  return primaryOnly(ALL_MEMBERS)
    .filter((member) => Boolean(member.sector))
    .flatMap((member) => {
      const row = bySymbol.get(member.symbol);
      if (!row || row.marketCap === null || row.marketCap <= 0) return [];
      return [{
        symbol: member.symbol,
        name: member.name,
        legalName: row.name,
        logoUrl: row.logoUrl,
        sector: member.sector ?? null,
        marketCap: row.marketCap,
      }];
    })
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, POOL_SIZE);
}

/**
 * Günün cevabı GÜNÜN ANAHTARIYLA ÖNBELLEKTE. Havuz piyasa değeriyle
 * oynuyor; seçim her istekte yeniden yapılsaydı sıranın kenarındaki bir
 * hisse gün içinde havuzdan düştüğünde cevap da değişebilirdi — sabah
 * çözen ile akşam çözen farklı bulmaca oynardı. İlk hesap günü sabitliyor.
 * Boş havuz (veritabanı düşük) FIRLATIR, önbelleğe yazılmaz (CLAUDE.md:
 * hata önbelleğin dışında yakalanır).
 */
const cachedAnswer = unstable_cache(
  async (day: string) => {
    const pool = await loadPool();
    const symbol = pickDaily(pool.map((entry) => entry.symbol), dayNumberOf(day), secretRank);
    if (!symbol) throw new Error("bulmaca havuzu boş");
    return symbol;
  },
  /* v2: seçim gizli anahtara geçti (25 Ekim); v1'in tuttuğu cevap
     herkesin hesaplayabildiği sıradandı. */
  ["stock-puzzle-answer-v2"],
  { revalidate: 2 * 24 * 60 * 60 },
);

export async function dailyAnswer(day: string): Promise<string | null> {
  try {
    return await cachedAnswer(day);
  } catch {
    return null;
  }
}

/** Havuz; cevap havuzdan düşmüşse (piyasa değeri gün içinde) yine içinde. */
async function poolWith(answer: string): Promise<PoolEntry[]> {
  const pool = await loadPool();
  if (pool.some((entry) => entry.symbol === answer)) return pool;
  const companies = await getCompanies();
  const row = companies.find((item) => item.symbol === answer);
  const member = indexMemberOf(answer);
  if (!row) return pool;
  return [...pool, {
    symbol: answer,
    name: member?.name ?? row.name,
    legalName: row.name,
    logoUrl: row.logoUrl,
    sector: member?.sector ?? null,
    marketCap: row.marketCap,
  }];
}

/**
 * Siluet — bir yıllık günlük kapanış, gün başına bir kez hesaplanıp
 * saklanıyor ki gün içinde herkes AYNI şekli görsün (son bar seans
 * boyunca oynuyor). Barlar alınamazsa fırlatır: önbelleğe yazılmaz, ipucu
 * o istekte atlanır (uydurulmaz).
 */
const cachedSilhouette = unstable_cache(
  /* `day` önbellek anahtarına girsin diye argüman (unstable_cache
     argümanları anahtara katıyor); gövdede kullanılmıyor. */
  async (symbol: string, day: string) => {
    if (!day) throw new Error("gün yok");
    const status = await getStatus();
    const bars = await getChartBars(symbol, "1Y", status);
    if (!bars.ok) throw new Error("bar yok");
    const points = silhouetteOf(bars.data.map((bar) => bar.close));
    if (!points) throw new Error("siluet çıkmadı");
    return points;
  },
  ["stock-puzzle-silhouette-v1"],
  { revalidate: 2 * 24 * 60 * 60 },
);

/**
 * Ana sayfa girişinin minyatürü (25 Ekim) — YALNIZ siluet, yani bulmacanın
 * zaten herkese açık İLK ipucu. Ad, sembol, sektör gelmez. Sayfanın
 * HTML'ine girmiyor; giriş onu `/api/bulmaca` GET'inden istiyor
 * (`PuzzleTeaser`), ki ana sayfanın kaynağı bulmacayla ilgili hiçbir veri
 * taşımasın. Siluet alınamazsa null; uydurulmaz.
 */
export async function dailySilhouette(day: string): Promise<number[] | null> {
  const answer = await dailyAnswer(day);
  if (!answer) return null;
  return cachedSilhouette(answer, day).catch(() => null);
}

async function ipoYearOf(symbol: string): Promise<number | null> {
  try {
    const [row] = await db
      .select({ ipoDate: symbolsTable.ipoDate })
      .from(symbolsTable)
      .where(eq(symbolsTable.symbol, symbol))
      .limit(1);
    const year = row?.ipoDate ? Number(String(row.ipoDate).slice(0, 4)) : NaN;
    return Number.isInteger(year) ? year : null;
  } catch {
    return null;
  }
}

async function factsFor(entry: PoolEntry, day: string): Promise<PuzzleFacts> {
  const [silhouette, ipoYear, metrics] = await Promise.all([
    cachedSilhouette(entry.symbol, day).catch(() => null),
    ipoYearOf(entry.symbol),
    getAllMetrics(),
  ]);
  const growth = metrics?.find((row) => row.symbol === entry.symbol)?.metrics.revenueGrowthTTMYoy ?? null;
  return {
    symbol: entry.symbol,
    name: entry.name,
    sector: entry.sector,
    marketCap: entry.marketCap,
    ipoYear,
    revenueGrowth: growth,
    silhouette,
  };
}

/** Sektör ipucu ekrana dilin adıyla iner. */
function localizeClue(clue: Clue, locale: Locale): Clue {
  return clue.kind === "sector" ? { ...clue, sector: sectorLabel(clue.sector, locale) ?? clue.sector } : clue;
}

/** Arama kutusunun seçenekleri — alfabetik, cevaptan hiçbir iz taşımadan. */
function poolOptions(pool: readonly PoolEntry[], locale: Locale): PoolOption[] {
  const aliases = new Map<string, string[]>();
  for (const [alias, list] of Object.entries(SYMBOL_ALIASES)) {
    for (const symbol of list) aliases.set(symbol, [...(aliases.get(symbol) ?? []), alias]);
  }
  return [...pool]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map((entry) => ({
      symbol: entry.symbol,
      name: entry.name,
      logoUrl: entry.logoUrl,
      haystack: [entry.symbol, entry.name, entry.legalName, ...(aliases.get(entry.symbol) ?? [])]
        .map((part) => foldForSearch(part, locale))
        .join(" "),
    }));
}

export type PuzzleError = "unavailable" | "unknown-symbol" | "duplicate" | "too-many";

export type PuzzleResult =
  | { ok: true; state: PuzzleState; options: PoolOption[] }
  | { ok: false; error: PuzzleError };

/**
 * Bulmacanın verilen tahminlerle durumu — sayfanın ilk çizimi (boş liste)
 * ve `/api/bulmaca` aynı fonksiyondan geçer.
 */
export async function evaluatePuzzle(day: string, guesses: readonly string[], locale: Locale): Promise<PuzzleResult> {
  const answer = await dailyAnswer(day);
  if (!answer) return { ok: false, error: "unavailable" };
  let pool: PoolEntry[];
  try {
    pool = await poolWith(answer);
  } catch {
    return { ok: false, error: "unavailable" };
  }
  const bySymbol = new Map(pool.map((entry) => [entry.symbol, entry]));
  const target = bySymbol.get(answer);
  if (!target) return { ok: false, error: "unavailable" };

  if (guesses.length > MAX_GUESSES) return { ok: false, error: "too-many" };
  if (new Set(guesses).size !== guesses.length) return { ok: false, error: "duplicate" };

  const rows: GuessRow[] = [];
  for (const symbol of guesses) {
    const entry = bySymbol.get(symbol);
    if (!entry) return { ok: false, error: "unknown-symbol" };
    rows.push({ ...compareGuess(entry, target), name: entry.name, logoUrl: entry.logoUrl });
    /* Doğru tahminden sonrası yok sayılır — oyun orada bitti. */
    if (rows[rows.length - 1].correct) break;
  }

  const status = statusOf(rows);
  const finished = status !== "playing";
  const facts = await factsFor(target, day);
  const all = cluesFor(facts);
  const wrong = rows.filter((row) => !row.correct).length;
  const shown = visibleClues(all, wrong, finished);
  const upcoming = all.slice(shown.length).map((clue) => clue.kind);

  const state: PuzzleState = {
    day,
    number: puzzleNumber(day),
    status,
    clues: shown.map((clue) => localizeClue(clue, locale)),
    upcoming,
    guesses: rows,
  };

  if (finished) {
    const description = await describeSymbol(target.symbol, locale).catch(() => null);
    state.answer = {
      symbol: target.symbol,
      name: target.name,
      logoUrl: target.logoUrl,
      blurb: description ? firstSentence(description) : null,
    };
  }

  return { ok: true, state, options: poolOptions(pool, locale) };
}
