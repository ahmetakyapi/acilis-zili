"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getStatus } from "@/lib/data";
import { db } from "@/lib/db";
import { isIsoDate, TCMB_MIN_DATE } from "@/lib/fx";
import { etParts, isSessionTrade } from "@/lib/market-hours";
import { MAX_POSITIONS } from "@/lib/portfolio-data";
import { getChartBars, getQuotes } from "@/lib/providers";
import { getUsdTryAt, istanbulToday } from "@/lib/providers/fx-history";
import { rateLimit } from "@/lib/rate-limit";
import { portfolioOrder, portfolioPositions, portfolioSales } from "@/lib/schema";
import { planFifoSale } from "@/lib/portfolio-sales";
import { isValidSymbol } from "@/lib/utils";

/**
 * Portföy eylemleri — ekleme, düzenleme, silme, geri alma, ekstreden
 * toplu ekleme ve fiyat önerisi.
 *
 * Her eylem oturumu KENDİSİ doğruluyor (proxy yalnızca ön eleme) ve
 * kimlik oturumdan geliyor, formdan değil: başkasının pozisyonunu silmek
 * ya da düzeltmek için kimliğini bilmek yetmiyor, satır `user_id` ile de
 * eşleşmeli.
 *
 * Girdi Zod ile doğrulanıyor; takip listesi eylemleriyle aynı tavan
 * mantığı (gerekçe `app/actions/watchlist.ts` → "Yazma tavanları"):
 * giriş yapmış tek bir hesap döngüyle yüz binlerce satır yazamasın.
 *
 * TABLO YOKSA (migration henüz uygulanmadıysa) yazma düşüyor ve okuyucu
 * kısa bir hata alıyor; sayfa zaten "şu an açılamıyor" durumunda.
 *
 * ŞEMA DEĞİŞMEDİ. Yeni akışın her parçası (düzenleme, geri alma, toplu
 * ekleme) var olan `portfolio_positions` satırıyla yapılıyor; migration
 * gerekmiyor. Tek istisna elle sıra (2 Ekim): o kendi tablosunda
 * (`portfolio_order`, migration 0025) ve tablo yokken liste varsayılan
 * sırada kalıyor — pozisyon okuması etkilenmiyor.
 */

export type PortfolioError = "invalid" | "limit" | "rateLimited" | "failed" | "signedOut";

export type PortfolioActionState = {
  status: "idle" | "saved" | "error";
  error?: PortfolioError;
  /** Yeni satırın kimliği — liste onu vurgulayarak getiriyor. */
  id?: string;
  /** Hangi alan hatalı — hata o alanın altına yazılıyor. */
  field?: "symbol" | "quantity" | "costUsd" | "boughtAt" | "priceUsd" | "soldAt";
  /** Satışta adet fazlaysa: o gün elde olan adet (FIFO'nun tüketebileceği). */
  available?: number;
};

/** Dakikada yazma tavanı — elle form doldurmanın hızı bunun çok altında. */
const WRITE_LIMIT = 30;
const WRITE_WINDOW_MS = 60_000;
/** Fiyat önerisi okuma; yazmadan ayrı kova, sembol ve gün değiştikçe çağrılıyor. */
const SUGGEST_LIMIT = 60;
/** Makul üst sınırlar: bir milyar adet, on milyon dolarlık hisse fiyatı. */
const MAX_QUANTITY = 1_000_000_000;
const MAX_PRICE_USD = 10_000_000;
/** Sütunların saklayabildiği en küçük değer: adet `numeric(20,8)`, fiyat `numeric(20,6)`. */
const MIN_QUANTITY = 1e-8;
const MIN_PRICE_USD = 1e-6;
const MAX_NOTE = 120;
const DAY_MS = 86_400_000;
/** Öneri için sorulan gün ile son kapanış arasındaki en uzun boşluk: dört
 *  günlük bir bayram artı hafta sonu. Daha uzunu tatil değil veri deliği. */
const MAX_GAP_DAYS = 5;

/* Sayı alanları metin olarak geliyor; virgüllü ondalık da kabul ("12,5").
   İstemci dilin kuralıyla çözüp NOKTALI gönderiyor (`lib/decimal-input.ts`);
   buradaki virgül desteği yalnızca tarayıcı dışından gelen çağrı için. */
const decimal = z
  .union([z.string(), z.number()])
  .transform((raw) => (typeof raw === "number" ? raw : Number(raw.trim().replace(",", "."))))
  .pipe(z.number().finite());

const PositionInput = z.object({
  symbol: z
    .string()
    .trim()
    .transform((raw) => raw.toUpperCase())
    .refine((value) => isValidSymbol(value)),
  /* ALT SINIR SÜTUNUN ÖLÇEĞİ (28 Eylül denetimi). `positive()` 0,000000001
     adedi geçiriyordu; `numeric(20,8)` onu 0'a yuvarlıyor ve tabloda sıfır
     adetlik satır oluşuyordu. Fiyat da `numeric(20,6)`. */
  quantity: decimal.pipe(z.number().min(MIN_QUANTITY).max(MAX_QUANTITY)),
  costUsd: decimal.pipe(z.number().min(MIN_PRICE_USD).max(MAX_PRICE_USD)),
  boughtAt: z.string().refine((value) => isIsoDate(value)),
  note: z.string().trim().max(MAX_NOTE).optional(),
});

type PositionFields = z.infer<typeof PositionInput>;

/* Tarih aralığı: TCMB arşivinin anlamlı başlangıcı ile bugün. Öncesi eski
   lira (gerekçe `TCMB_MIN_DATE`), sonrası henüz yaşanmadı. */
function dateInRange(date: string): boolean {
  return date >= TCMB_MIN_DATE && date <= istanbulToday();
}

function fieldOf(error: z.ZodError): PortfolioActionState["field"] {
  const key = error.issues[0]?.path[0];
  return key === "symbol" || key === "quantity" || key === "costUsd" || key === "boughtAt" ? key : undefined;
}

function readForm(formData: FormData) {
  return {
    symbol: String(formData.get("symbol") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    costUsd: String(formData.get("costUsd") ?? ""),
    boughtAt: String(formData.get("boughtAt") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

async function sessionUser(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function parsePosition(raw: unknown): { ok: true; data: PositionFields } | { ok: false; state: PortfolioActionState } {
  const parsed = PositionInput.safeParse(raw);
  if (!parsed.success) return { ok: false, state: { status: "error", error: "invalid", field: fieldOf(parsed.error) } };
  if (!dateInRange(parsed.data.boughtAt)) return { ok: false, state: { status: "error", error: "invalid", field: "boughtAt" } };
  return { ok: true, data: parsed.data };
}

async function countPositions(userId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(portfolioPositions)
    .where(eq(portfolioPositions.userId, userId));
  return total;
}

const toRow = (userId: string, input: PositionFields) => ({
  userId,
  symbol: input.symbol,
  quantity: String(input.quantity),
  costUsd: String(input.costUsd),
  boughtAt: input.boughtAt,
  note: input.note ? input.note : null,
});

/* --------------------------------------------------------------------------
   Tek pozisyon: ekle, düzelt
   -------------------------------------------------------------------------- */

export async function addPositionAction(
  _prev: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };

  /* Anahtar IP değil KULLANICI: yazma oturuma bağlı. */
  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  const parsed = parsePosition(readForm(formData));
  if (!parsed.ok) return parsed.state;

  let id: string;
  try {
    if ((await countPositions(userId)) >= MAX_POSITIONS) return { status: "error", error: "limit" };
    const [row] = await db
      .insert(portfolioPositions)
      .values(toRow(userId, parsed.data))
      .returning({ id: portfolioPositions.id });
    id = row.id;
  } catch {
    return { status: "error", error: "failed" };
  }

  revalidatePath("/portfoy");
  return { status: "saved", id };
}

export async function updatePositionAction(
  _prev: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return { status: "error", error: "invalid" };

  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  const parsed = parsePosition(readForm(formData));
  if (!parsed.ok) return parsed.state;

  try {
    const row = toRow(userId, parsed.data);
    const updated = await db
      .update(portfolioPositions)
      .set({ symbol: row.symbol, quantity: row.quantity, costUsd: row.costUsd, boughtAt: row.boughtAt, note: row.note })
      .where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)))
      .returning({ id: portfolioPositions.id });
    if (updated.length === 0) return { status: "error", error: "failed" };
  } catch {
    return { status: "error", error: "failed" };
  }

  revalidatePath("/portfoy");
  return { status: "saved", id };
}

/* --------------------------------------------------------------------------
   Sil ve geri al

   Silme HEMEN yapılıyor, geri alma satırı AYNI KİMLİKLE geri yazıyor. Öteki
   yol (satırı gizleyip silmeyi birkaç saniye geciktirmek) okuyucu o arada
   sayfadan çıkarsa silmeyi kaybediyordu: ekranda silinmiş görünen satır bir
   sonraki ziyarette geri gelirdi. Geri alınan satırın kimliği aynı kaldığı
   için liste onu yerinde, zıplamadan geri koyuyor.
   -------------------------------------------------------------------------- */

export async function deletePositionAction(id: string): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };
  if (!z.string().uuid().safeParse(id).success) return { status: "error", error: "invalid" };

  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  try {
    await db
      .delete(portfolioPositions)
      .where(and(eq(portfolioPositions.id, id), eq(portfolioPositions.userId, userId)));
  } catch {
    return { status: "error", error: "failed" };
  }
  revalidatePath("/portfoy");
  return { status: "saved" };
}

export async function restorePositionAction(position: {
  id: string;
  symbol: string;
  quantity: number;
  costUsd: number;
  boughtAt: string;
  note: string | null;
}): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };
  if (!z.string().uuid().safeParse(position.id).success) return { status: "error", error: "invalid" };

  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  const parsed = parsePosition({ ...position, note: position.note ?? "" });
  if (!parsed.ok) return parsed.state;

  try {
    if ((await countPositions(userId)) >= MAX_POSITIONS) return { status: "error", error: "limit" };
    /* Kimlik başka bir hesabın satırıyla çakışamaz (uuid birincil anahtar,
       silinmiş satırın kimliği); çakışırsa yazma düşer ve hiçbir şey olmaz. */
    await db
      .insert(portfolioPositions)
      .values({ ...toRow(userId, parsed.data), id: position.id })
      .onConflictDoNothing();
  } catch {
    return { status: "error", error: "failed" };
  }
  revalidatePath("/portfoy");
  return { status: "saved", id: position.id };
}

/* --------------------------------------------------------------------------
   Ekstreden toplu ekleme

   Dosya sunucuya GELMİYOR: PDF tarayıcıda okunuyor, buraya yalnızca
   okuyucunun onayladığı satırlar (sembol, adet, fiyat, gün) geliyor ve her
   biri tek satırlık eklemeyle AYNI şemadan geçiyor. Tek bir bozuk satır
   bütün partiyi reddediyor: yarısı yazılmış bir aktarım, okuyucunun neyin
   girip neyin girmediğini ekrandan çıkaramayacağı bir portföy bırakırdı.
   -------------------------------------------------------------------------- */

/** Tek aktarımın satır tavanı — hesabın tavanıyla aynı. */
const IMPORT_MAX = MAX_POSITIONS;

export async function importPositionsAction(
  items: { symbol: string; quantity: number; costUsd: number; boughtAt: string; note?: string }[],
): Promise<PortfolioActionState & { ids?: string[] }> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };
  if (!Array.isArray(items) || items.length === 0 || items.length > IMPORT_MAX) {
    return { status: "error", error: items?.length > IMPORT_MAX ? "limit" : "invalid" };
  }

  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  const rows: PositionFields[] = [];
  for (const item of items) {
    const parsed = parsePosition(item);
    if (!parsed.ok) return parsed.state;
    rows.push(parsed.data);
  }

  let ids: string[];
  try {
    if ((await countPositions(userId)) + rows.length > MAX_POSITIONS) return { status: "error", error: "limit" };
    const inserted = await db
      .insert(portfolioPositions)
      .values(rows.map((row) => toRow(userId, row)))
      .returning({ id: portfolioPositions.id });
    ids = inserted.map((row) => row.id);
  } catch {
    return { status: "error", error: "failed" };
  }

  revalidatePath("/portfoy");
  return { status: "saved", ids };
}

/** Aktarımı geri almak: az önce eklenen satırları topluca siler. */
export async function removePositionsAction(ids: string[]): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };
  const valid = Array.isArray(ids) ? ids.filter((id) => z.string().uuid().safeParse(id).success).slice(0, IMPORT_MAX) : [];
  if (valid.length === 0) return { status: "error", error: "invalid" };

  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  try {
    await db
      .delete(portfolioPositions)
      .where(and(inArray(portfolioPositions.id, valid), eq(portfolioPositions.userId, userId)));
  } catch {
    return { status: "error", error: "failed" };
  }
  revalidatePath("/portfoy");
  return { status: "saved" };
}

/* --------------------------------------------------------------------------
   Fiyat ve kur önerisi

   Okuyucu alış fiyatını çoğu zaman ezbere bilmiyor; aracı kurumun
   uygulamasını açıp bakıyordu. Seçtiği gün için elimizdeki GERÇEK sayıyı
   öneriyoruz ve NE OLDUĞUNU söylüyoruz:
     - geçmiş bir gün → o günün resmi kapanışı (günlük bar)
     - o gün seans yoksa (hafta sonu, tatil) → ÖNCEKİ işlem gününün
       kapanışı, kendi tarihiyle ("26 Eyl Kapanışı")
     - bugün ve seans açık → son işlem fiyatı, ancak seansa aitse ve bayat
       değilse (CLAUDE.md veri dürüstlüğü 4); bayatsa hiç önerilmiyor
     - bir yıldan eski gün → günlük bar yok, öneri yok; uydurulmuyor
   Öneri alana KENDİLİĞİNDEN yazılmıyor: okuyucu "Kullan"a basıyor.
   Kur: alış gününün TCMB döviz alış kuru — TL maliyetin önizlemesi için,
   tablo aynı kuru `loadPortfolio` ile kullanıyor.
   -------------------------------------------------------------------------- */

export type PriceSuggestion = {
  price: { kind: "close" | "previousClose" | "last"; value: number; date: string } | null;
  fx: { rate: number; bulletinDate: string } | null;
};

export async function suggestPriceAction(symbolRaw: string, date: string): Promise<PriceSuggestion> {
  const empty: PriceSuggestion = { price: null, fx: null };
  const userId = await sessionUser();
  if (!userId) return empty;
  const symbol = String(symbolRaw ?? "").trim().toUpperCase();
  if (!isValidSymbol(symbol) || !isIsoDate(date) || !dateInRange(date)) return empty;
  const limited = rateLimit(`portfolio-suggest:${userId}`, SUGGEST_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return empty;

  const status = await getStatus();
  const [fxResult, price] = await Promise.all([getUsdTryAt(date), suggestPrice(symbol, date, status)]);
  return {
    price,
    fx: fxResult.ok ? { rate: fxResult.data.buying, bulletinDate: fxResult.data.bulletinDate } : null,
  };
}

async function suggestPrice(
  symbol: string,
  date: string,
  status: Awaited<ReturnType<typeof getStatus>>,
): Promise<PriceSuggestion["price"]> {
  if (date === status.sessionDate && status.isRegularOpen) {
    const quotes = await getQuotes([symbol], status);
    const quote = quotes.ok && !quotes.stale ? quotes.data[symbol] : undefined;
    if (!quote || !isSessionTrade(quote.tradedAt, status)) return null;
    return { kind: "last", value: quote.price, date };
  }
  const bars = await getChartBars(symbol, "1Y", status);
  if (!bars.ok || bars.data.length === 0) return null;
  let best: { value: number; date: string } | null = null;
  for (const bar of bars.data) {
    const day = etParts(new Date(bar.time * 1000)).dateStr;
    /* Bugünün barı seans açıkken yarım bir gün: kapanış değil. */
    if (day === status.sessionDate && status.isRegularOpen) continue;
    if (day > date) break;
    best = { value: bar.close, date: day };
  }
  if (!best) return null;
  /* Barların ilki sorulan günden sonraysa (bir yıldan eski gün) `best` boş
     kalıyor; ilk bar sorulan günden ÖNCEYSE ama arada bir hafta varsa bu
     bir tatil değil veri deliği — öneri yok. */
  const gapDays = (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${best.date}T12:00:00Z`)) / DAY_MS;
  if (gapDays > MAX_GAP_DAYS) return null;
  return { kind: best.date === date ? "close" : "previousClose", value: best.value, date: best.date };
}

/* --------------------------------------------------------------------------
   Sıra (2 Ekim)

   `ids` okuyucunun verdiği sıra; `null` varsayılana dönüş ("En Büyük Üstte")
   ve satırı siliyor. Kayda yalnızca okuyucunun KENDİ pozisyonlarının
   kimlikleri giriyor: formdan gelen yabancı bir kimlik sessizce düşüyor.
   Tablo yoksa (migration 0025) yazma düşüyor, liste varsayılan sırada kalıyor.
   -------------------------------------------------------------------------- */

export async function savePortfolioOrderAction(ids: string[] | null): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };

  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  try {
    if (ids === null) {
      await db.delete(portfolioOrder).where(eq(portfolioOrder.userId, userId));
    } else {
      const parsed = z.array(z.string().uuid()).max(MAX_POSITIONS).safeParse(ids);
      if (!parsed.success) return { status: "error", error: "invalid" };
      const owned = await db
        .select({ id: portfolioPositions.id })
        .from(portfolioPositions)
        .where(and(eq(portfolioPositions.userId, userId), inArray(portfolioPositions.id, parsed.data.length ? parsed.data : ["00000000-0000-0000-0000-000000000000"])));
      const mine = new Set(owned.map((row) => row.id));
      const positionIds = [...new Set(parsed.data)].filter((id) => mine.has(id));
      await db
        .insert(portfolioOrder)
        .values({ userId, positionIds })
        .onConflictDoUpdate({ target: portfolioOrder.userId, set: { positionIds, updatedAt: new Date() } });
    }
  } catch {
    return { status: "error", error: "failed" };
  }
  revalidatePath("/portfoy");
  return { status: "saved" };
}

/* --------------------------------------------------------------------------
   Satış (9 Ekim) — gerekçe `lib/schema.ts` → portfolioSales

   Satış SEMBOLE yapılıyor, satıra değil: hangi partiden düşüleceğine İLK
   GİREN İLK ÇIKAR karar veriyor (`planFifoSale`). Tükenen parti siliniyor,
   kısmen tükenen partinin adedi azalıyor ve her tüketilen parti kendi
   maliyetiyle `portfolio_sales`e yazılıyor. Hepsi TEK `batch`te: Neon'un
   HTTP sürücüsünde bu bir işlem (transaction); yarısı yazılmış bir satış —
   partisi silinmiş ama kaydı olmayan — mümkün değil.
   -------------------------------------------------------------------------- */

const SaleInput = z.object({
  symbol: z
    .string()
    .trim()
    .transform((raw) => raw.toUpperCase())
    .refine((value) => isValidSymbol(value)),
  quantity: decimal.pipe(z.number().min(MIN_QUANTITY).max(MAX_QUANTITY)),
  priceUsd: decimal.pipe(z.number().min(MIN_PRICE_USD).max(MAX_PRICE_USD)),
  soldAt: z.string().refine((value) => isIsoDate(value)),
});

function saleFieldOf(error: z.ZodError): PortfolioActionState["field"] {
  const key = error.issues[0]?.path[0];
  return key === "quantity" || key === "priceUsd" || key === "soldAt" ? key : undefined;
}

export async function sellPositionAction(
  _prev: PortfolioActionState,
  formData: FormData,
): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };
  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  const parsed = SaleInput.safeParse({
    symbol: String(formData.get("symbol") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    priceUsd: String(formData.get("priceUsd") ?? ""),
    soldAt: String(formData.get("soldAt") ?? ""),
  });
  if (!parsed.success) return { status: "error", error: "invalid", field: saleFieldOf(parsed.error) };
  const input = parsed.data;
  if (!dateInRange(input.soldAt)) return { status: "error", error: "invalid", field: "soldAt" };

  const saleId = crypto.randomUUID();
  try {
    const lots = await db
      .select()
      .from(portfolioPositions)
      .where(and(eq(portfolioPositions.userId, userId), eq(portfolioPositions.symbol, input.symbol)))
      .orderBy(portfolioPositions.boughtAt, portfolioPositions.createdAt);
    const plan = planFifoSale(
      lots.map((row) => ({
        id: row.id,
        quantity: Number(row.quantity),
        costUsd: Number(row.costUsd),
        boughtAt: row.boughtAt,
        note: row.note,
      })),
      input.quantity,
      input.soldAt,
    );
    if (!plan.ok) {
      return {
        status: "error",
        error: "invalid",
        field: plan.reason === "noLots" ? "soldAt" : "quantity",
        available: plan.available,
      };
    }

    const [first, ...rest] = plan.steps.flatMap((step) => [
      step.exhausted
        ? db
            .delete(portfolioPositions)
            .where(and(eq(portfolioPositions.id, step.lot.id), eq(portfolioPositions.userId, userId)))
        : db
            .update(portfolioPositions)
            .set({ quantity: String(step.lot.quantity - step.take) })
            .where(and(eq(portfolioPositions.id, step.lot.id), eq(portfolioPositions.userId, userId))),
      db.insert(portfolioSales).values({
        userId,
        saleId,
        symbol: input.symbol,
        quantity: String(step.take),
        priceUsd: String(input.priceUsd),
        soldAt: input.soldAt,
        costUsd: String(step.lot.costUsd),
        boughtAt: step.lot.boughtAt,
        note: step.lot.note,
      }),
    ]);
    await db.batch([first, ...rest]);
  } catch {
    return { status: "error", error: "failed" };
  }

  revalidatePath("/portfoy");
  return { status: "saved", id: saleId };
}

/**
 * Satışı geri alır: partiler pozisyonlara geri döner. Aynı sembol, alış
 * günü ve maliyette bir parti hâlâ duruyorsa (kısmi satış) adedi ona
 * ekleniyor; yoksa parti yeniden açılıyor. Kayıtlar siliniyor. Tek `batch`.
 */
export async function undoSaleAction(saleId: string): Promise<PortfolioActionState> {
  const userId = await sessionUser();
  if (!userId) return { status: "error", error: "signedOut" };
  if (!z.string().uuid().safeParse(saleId).success) return { status: "error", error: "invalid" };
  const limited = rateLimit(`portfolio:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS);
  if (!limited.allowed) return { status: "error", error: "rateLimited" };

  try {
    const parts = await db
      .select()
      .from(portfolioSales)
      .where(and(eq(portfolioSales.saleId, saleId), eq(portfolioSales.userId, userId)));
    if (parts.length === 0) return { status: "error", error: "invalid" };
    const symbol = parts[0].symbol;
    const lots = await db
      .select()
      .from(portfolioPositions)
      .where(and(eq(portfolioPositions.userId, userId), eq(portfolioPositions.symbol, symbol)));
    const opened = parts.filter(
      (part) => !lots.some((lot) => lot.boughtAt === part.boughtAt && Math.abs(Number(lot.costUsd) - Number(part.costUsd)) < 1e-9),
    ).length;
    if (opened > 0 && (await countPositions(userId)) + opened > MAX_POSITIONS) return { status: "error", error: "limit" };

    const statements = parts.map((part) => {
      const lot = lots.find(
        (row) => row.boughtAt === part.boughtAt && Math.abs(Number(row.costUsd) - Number(part.costUsd)) < 1e-9,
      );
      return lot
        ? db
            .update(portfolioPositions)
            .set({ quantity: String(Number(lot.quantity) + Number(part.quantity)) })
            .where(and(eq(portfolioPositions.id, lot.id), eq(portfolioPositions.userId, userId)))
        : db.insert(portfolioPositions).values({
            userId,
            symbol: part.symbol,
            quantity: part.quantity,
            costUsd: part.costUsd,
            boughtAt: part.boughtAt,
            note: part.note,
          });
    });
    const [first, ...rest] = [
      ...statements,
      db.delete(portfolioSales).where(and(eq(portfolioSales.saleId, saleId), eq(portfolioSales.userId, userId))),
    ];
    await db.batch([first, ...rest]);
  } catch {
    return { status: "error", error: "failed" };
  }

  revalidatePath("/portfoy");
  return { status: "saved" };
}

