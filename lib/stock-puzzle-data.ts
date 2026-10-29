import "server-only";

import { createHmac } from "node:crypto";
import { unstable_cache } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { symbols as symbolsTable } from "@/lib/schema";
import { ALL_MEMBERS, indexMemberOf, primaryOnly } from "@/db/seed/indices";
import { SYMBOL_ALIASES } from "@/db/seed/aliases";
import { describeSymbol } from "@/db/seed/descriptions";
import { getCompanies, getStatus } from "@/lib/data";
import { getChartBars } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { SUB_INDUSTRIES } from "@/db/seed/sub-industries";
import { etParts } from "@/lib/market-hours";
import { getAllMetrics } from "@/lib/symbol-metrics";
import { sectorLabel } from "@/lib/sectors";
import { foldForSearch } from "@/lib/search-fold";
import type { Locale } from "@/lib/i18n/config";
import {
  MAX_GUESSES,
  POOL_SIZE,
  SILHOUETTE_POINTS,
  axisFor,
  cluesFor,
  compareGuess,
  dayNumberOf,
  isJoker,
  jokerFeedback,
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
  type SilhouetteRange,
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
 * İPUCU KAYNAKLARI VE KAPSAMA (25 Ekim, havuzun 200 şirketinde salt
 * okumayla ölçüldü):
 *   siluet ............ Alpaca günlük barları (`getChartBars` 1Y)  200/200
 *   sektör, endüstri .. endeks tohumu GICS (`db/seed/indices.ts`)  200/200
 *   piyasa değeri ..... `getCompanies` (fiyat × hisse sayısı)       200/200
 *   beta, temettü ..... Finnhub `/stock/metric` (`getKeyMetrics`)   200 / 153
 *   halka arz yılı .... `symbols.ipo_date`, 1980 ve sonrası         139/200
 *   gelir büyümesi .... `symbol_metrics` revenueGrowthTTMYoy        198/200
 *   net kâr marjı ..... `symbol_metrics` netProfitMarginTTM         199/200
 *   harf kutuları, baş harf  sembol ve görünen ad                   200/200
 * Temettü veriminin BOŞ olduğu 47 şirket büyük ölçüde ödemeyenler (AMZN,
 * BRK.B) ama boş alan "ödemiyor" demek değil; ipucu o zaman atlanıyor.
 * Merkez eyaleti ve çalışan sayısı sitenin hiçbir kaynağında yok; logo
 * ipucu da yok: logo adresi (`/logos/SEMBOL.webp`) cevabı açık yazıyor.
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
 * (`cachedAnswer`) günün ilk seçimini saklı tuttuğu için o gün oynayan
 * okur etkilenmez, ertesi günden yeni sıra başlar.
 */
/** Günün cevabı ve siluetinin önbellek ömrü — arşivin ufku kadar. */
const ARCHIVE_CACHE_SECONDS = 400 * 24 * 60 * 60;

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
  /* ARŞİV İÇİN UZUN (25 Ekim): geçmiş günler oynanabiliyor ve bir günün
     cevabı sonradan değişmemeli. İki günlük ömürde, havuz piyasa değeriyle
     kaydıkça dünkü bulmaca bir hafta sonra başka bir hisseye dönebilirdi. */
  { revalidate: ARCHIVE_CACHE_SECONDS },
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
 *
 * v2 (25 Ekim): şekille birlikte ÖLÇÜSÜ de saklanıyor (örneklenen
 * kapanışların en düşüğü/en yükseği, ilk ve son barın günü): üç yanlıştan
 * sonra yüzde ekseni, bitmiş bulmacada fiyat ve tarih ekseni bundan
 * çiziliyor. Ölçü istemciye ancak o zaman iner (`axisFor`, `answer.chart`).
 *
 * ŞEKİL BULMACANIN GÜNÜNDE BİTER: yalnız ET günü bulmacanın gününden
 * ÖNCE olan barlar. Bulmaca TR gece yarısı başlıyor (ET 16:00/17:00, ABD
 * kapanışında ya da sonrasında), yani o günün süren seansı hiç girmiyor:
 * kapak kartı yarım bir günü "kapanış" diye yazmıyor (CLAUDE.md, veri
 * dürüstlüğü 4). Arşiv günü de aynı kuralla o güne kadar çizilir; aradan
 * çok zaman geçtiyse pencerenin başı kısalır (sağlayıcı son bir yılı
 * veriyor), şekil yine o günün son kapanışında biter.
 */
type SilhouetteData = { points: number[]; range: SilhouetteRange };

const etDay = (seconds: number) => etParts(new Date(seconds * 1000)).dateStr;

const cachedSilhouette = unstable_cache(
  /* `day` önbellek anahtarına girsin diye argüman (unstable_cache
     argümanları anahtara katıyor); gövdede kullanılmıyor. */
  async (symbol: string, day: string): Promise<SilhouetteData> => {
    if (!day) throw new Error("gün yok");
    const status = await getStatus();
    const bars = await getChartBars(symbol, "1Y", status);
    if (!bars.ok) throw new Error("bar yok");
    const done = bars.data.filter((bar) => etDay(bar.time) < day);
    const picked = sampleBars(done);
    const points = silhouetteOf(picked.map((bar) => bar.close));
    if (!points || picked.length < 2) throw new Error("siluet çıkmadı");
    const closes = picked.map((bar) => bar.close);
    return {
      points,
      range: {
        low: Math.min(...closes),
        high: Math.max(...closes),
        last: closes[closes.length - 1],
        from: etDay(picked[0].time),
        to: etDay(picked[picked.length - 1].time),
      },
    };
  },
  /* v2: dönen şekil `number[]` → `{ points, range }` (CLAUDE.md: şekli
     değiştiren keyParts sürümünü artırır). */
  ["stock-puzzle-silhouette-v2"],
  /* Arşiv günü de ilk hesaplandığı şekliyle kalsın (cevapla aynı gerekçe). */
  { revalidate: ARCHIVE_CACHE_SECONDS },
);

/** `silhouetteOf`un seçtiği barların aynısı — ölçü şekille aynı noktalardan. */
function sampleBars<T extends { close: number }>(bars: readonly T[]): T[] {
  const clean = bars.filter((bar) => Number.isFinite(bar.close) && bar.close > 0);
  if (clean.length < 2) return [];
  const count = Math.min(SILHOUETTE_POINTS, clean.length);
  return Array.from({ length: count }, (_, i) => clean[Math.round((i * (clean.length - 1)) / (count - 1))]);
}

/**
 * Ana sayfa girişinin minyatürü (25 Ekim) — YALNIZ siluet, yani bulmacanın
 * zaten herkese açık İLK ipucu. Ad, sembol, sektör, ölçü gelmez. Sayfanın
 * HTML'ine girmiyor; giriş onu `/api/bulmaca` GET'inden istiyor
 * (`PuzzleTeaser`), ki ana sayfanın kaynağı bulmacayla ilgili hiçbir veri
 * taşımasın. Siluet alınamazsa null; uydurulmaz.
 */
export async function dailySilhouette(day: string): Promise<number[] | null> {
  const answer = await dailyAnswer(day);
  if (!answer) return null;
  return cachedSilhouette(answer, day)
    .then((data) => data.points)
    .catch(() => null);
}

/**
 * Halka arz yılı ve gelir büyümesi — cevap VE tahminler için tek sorguda
 * (25 Ekim: karşılaştırma karoları tahmin edilen şirketin de değerini
 * istiyor). Okuma düşerse boş harita: karo "bilinmiyor" olur, uydurulmaz.
 */
type Extras = { ipoYear: number | null; revenueGrowth: number | null; netMargin: number | null };

async function extrasFor(symbolList: readonly string[]): Promise<Map<string, Extras>> {
  const out = new Map<string, Extras>(symbolList.map((symbol) => [symbol, { ipoYear: null, revenueGrowth: null, netMargin: null }]));
  if (symbolList.length === 0) return out;
  const [rows, metrics] = await Promise.all([
    db
      .select({ symbol: symbolsTable.symbol, ipoDate: symbolsTable.ipoDate })
      .from(symbolsTable)
      .where(inArray(symbolsTable.symbol, [...symbolList]))
      .catch(() => []),
    getAllMetrics().catch(() => null),
  ]);
  for (const row of rows) {
    const year = row.ipoDate ? Number(String(row.ipoDate).slice(0, 4)) : NaN;
    const entry = out.get(row.symbol);
    if (entry && Number.isInteger(year)) entry.ipoYear = year;
  }
  for (const row of metrics ?? []) {
    const entry = out.get(row.symbol);
    const growth = row.metrics.revenueGrowthTTMYoy;
    if (entry && typeof growth === "number" && Number.isFinite(growth)) entry.revenueGrowth = growth;
    const margin = row.metrics.netProfitMarginTTM;
    if (entry && typeof margin === "number" && Number.isFinite(margin)) entry.netMargin = margin;
  }
  return out;
}

/**
 * Yalnız CEVABIN temettü verimi ve betası — Finnhub `/stock/metric`
 * (`getKeyMetrics`, 24 saat önbellekte; gün başına tek çağrı). Alınamazsa
 * iki ipucu da atlanır.
 */
async function answerMarketFacts(symbol: string): Promise<{ dividendYield: number | null; beta: number | null }> {
  const result = await getKeyMetrics(symbol).catch(() => null);
  if (!result?.ok) return { dividendYield: null, beta: null };
  return { dividendYield: result.data.dividendYield, beta: result.data.beta };
}

function factsFor(
  entry: PoolEntry,
  extras: Extras,
  market: { dividendYield: number | null; beta: number | null },
  silhouette: number[] | null,
): PuzzleFacts {
  return {
    symbol: entry.symbol,
    name: entry.name,
    sector: entry.sector,
    marketCap: entry.marketCap,
    ipoYear: extras.ipoYear,
    revenueGrowth: extras.revenueGrowth,
    silhouette,
    dividendYield: market.dividendYield,
    beta: market.beta,
    industry: indexMemberOf(entry.symbol)?.sub ?? null,
    netMargin: extras.netMargin,
  };
}

/** Endüstrinin ekrandaki adı — ipucu ve aday süzgeci aynı adı görsün. */
function industryLabel(industry: string | null, locale: Locale): string | null {
  if (!industry) return null;
  return locale === "tr" ? SUB_INDUSTRIES[industry]?.tr ?? industry : industry;
}

/** Sektör ve endüstri ipucu ekrana dilin adıyla iner. */
function localizeClue(clue: Clue, locale: Locale): Clue {
  if (clue.kind === "sector") return { ...clue, sector: sectorLabel(clue.sector, locale) ?? clue.sector, gics: clue.sector };
  if (clue.kind === "industry") return { ...clue, industry: industryLabel(clue.industry, locale) ?? clue.industry };
  return clue;
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
      /* Aday süzgecinin girdisi (`fitsClues`): her şirketin kendi kamuya
         açık değeri, ipucuyla aynı biçimde (endüstri dilin adıyla). */
      sector: entry.sector,
      marketCap: entry.marketCap,
      industry: industryLabel(indexMemberOf(entry.symbol)?.sub ?? null, locale),
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
  const real = guesses.filter((symbol) => !isJoker(symbol));
  if (new Set(real).size !== real.length) return { ok: false, error: "duplicate" };

  for (const symbol of guesses) if (!isJoker(symbol) && !bySymbol.has(symbol)) return { ok: false, error: "unknown-symbol" };
  /* Doğru tahminden sonrası yok sayılır — oyun orada bitti. */
  const hit = guesses.indexOf(answer);
  const played = hit >= 0 ? guesses.slice(0, hit + 1) : [...guesses];

  const [extras, silhouette, market] = await Promise.all([
    extrasFor([answer, ...played.filter((symbol) => !isJoker(symbol))]),
    cachedSilhouette(target.symbol, day).catch(() => null),
    answerMarketFacts(target.symbol),
  ]);
  const none: Extras = { ipoYear: null, revenueGrowth: null, netMargin: null };
  const briefOf = (entry: PoolEntry) => ({ ...entry, ...(extras.get(entry.symbol) ?? none) });
  const answerBrief = briefOf(target);

  const rows: GuessRow[] = played.map((symbol) => {
    const entry = bySymbol.get(symbol);
    if (!entry) return { ...jokerFeedback(), name: "", logoUrl: null };
    const feedback = compareGuess(briefOf(entry), answerBrief);
    return {
      ...feedback,
      /* Sektör karosu tahminin sektörünü dilin adıyla yazar. */
      values: { ...feedback.values, sector: sectorLabel(feedback.values.sector, locale) },
      name: entry.name,
      logoUrl: entry.logoUrl,
    };
  });

  const status = statusOf(rows);
  const finished = status !== "playing";
  const all = cluesFor(factsFor(target, answerBrief, market, silhouette?.points ?? null));
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
    axis: shown.some((clue) => clue.kind === "silhouette") ? axisFor(silhouette?.range ?? null, wrong, finished) : null,
  };

  if (finished) {
    const description = await describeSymbol(target.symbol, locale).catch(() => null);
    state.answer = {
      symbol: target.symbol,
      name: target.name,
      logoUrl: target.logoUrl,
      blurb: description ? firstSentence(description) : null,
      chart: silhouette?.range ?? null,
    };
  }

  return { ok: true, state, options: poolOptions(pool, locale) };
}

/**
 * "Hangisi Büyük?" — ikinci oyunun havuzu (29 Ekim; oyun
 * `components/puzzle/BiggerGame.tsx`, kuralları `lib/bigger-game.ts`).
 * Hisseyi Bil'in havuzuyla AYNI 200 şirket ve aynı piyasa değeri hesabı
 * (`loadPool` → `getCompanies`). Bu oyunda gizli bir cevap yok: değerler
 * herkese açık ölçüler, sayfayla birlikte iner; skor yalnız tarayıcıda.
 * Havuz okunamazsa boş liste — sayfa boş durum basar, uydurmaz.
 */
export type BiggerEntry = { symbol: string; name: string; logoUrl: string | null; sector: string | null; marketCap: number };

export async function biggerPool(locale: Locale): Promise<BiggerEntry[]> {
  const pool = await loadPool().catch(() => []);
  return pool.flatMap((entry) =>
    entry.marketCap && entry.marketCap > 0
      ? [{ symbol: entry.symbol, name: entry.name, logoUrl: entry.logoUrl, sector: sectorLabel(entry.sector, locale), marketCap: entry.marketCap }]
      : [],
  );
}
