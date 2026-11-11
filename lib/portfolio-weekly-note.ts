import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { checkPortfolioWeekNote, portfolioWeekInput, type PortfolioWeek, type WeeklyLot, type WeeklyMove } from "@/lib/portfolio-weekly";
import { portfolioPositions, users } from "@/lib/schema";
import { callClaude, insightsConfigured } from "@/lib/stock-insights";
import { weeklyMoves, type DigestData } from "@/lib/weekly-digest";

/**
 * Haftalık portföy karnesinin okuması ve Claude notu (11 Kasım). Hesap
 * saf modülde (lib/portfolio-weekly.ts, gerekçeler orada); çağıran pazar
 * postası (app/api/cron/haftalik-posta).
 *
 * NÖBET İŞİ: çağrı kimliksiz (lib/claude-budget.ts — nöbet tavanın
 * tamamını kullanabilir), okur başına haftada bir, önbellek anahtarı okur +
 * hafta + dil + girdinin özeti: saatlik tekrar koşuları ve deneme postası
 * ikinci kez ödemez. Koşu başına tavan `PORTFOLIO_WEEKLY_NOTE_CAP`
 * (varsayılan 40; takip notunun 60'ıyla birlikte pazar sabahı en çok 100
 * çağrı, günlük ortak tavan 150 ve pazar sabahı hisse sayfası trafiği
 * düşük). Tavanı aşan, notu düşen ya da Claude'a ulaşamayan okurun bölümü
 * sayılarla, metinsiz gider.
 *
 * SİTE SAHİBİ: rol veritabanından okunur (`role = admin`; oturum yok,
 * `getAdmin` burada çalışmaz). Sahibe açık görüş yazılır (tavsiye denetimi
 * kapalı, sayı denetimi açık) — gerekçe lib/portfolio-scan-model.ts →
 * "KİŞİSEL PLAN". Önbellek anahtarı ayrı ("plan").
 */

export const portfolioWeeklyNoteCap = () => {
  const raw = Number(process.env.PORTFOLIO_WEEKLY_NOTE_CAP);
  return Number.isFinite(raw) && raw >= 0 && process.env.PORTFOLIO_WEEKLY_NOTE_CAP?.trim() ? Math.floor(raw) : 40;
};

/** Alıcıların lotları, tek sorgu; okunamazsa null (bölüm basılmaz). */
export async function portfolioLots(userIds: readonly string[]): Promise<Map<string, WeeklyLot[]> | null> {
  if (userIds.length === 0) return new Map();
  try {
    const rows = await db
      .select({ userId: portfolioPositions.userId, symbol: portfolioPositions.symbol, quantity: portfolioPositions.quantity, boughtAt: portfolioPositions.boughtAt })
      .from(portfolioPositions)
      .where(inArray(portfolioPositions.userId, [...userIds]));
    const out = new Map<string, WeeklyLot[]>();
    for (const row of rows) {
      const quantity = Number(row.quantity);
      if (!(quantity > 0)) continue;
      const list = out.get(row.userId) ?? [];
      list.push({ symbol: row.symbol, quantity, boughtAt: row.boughtAt });
      out.set(row.userId, list);
    }
    return out;
  } catch (error) {
    console.error("[portföy karnesi] pozisyonlar okunamadı", error);
    return null;
  }
}

/** Alıcılar arasında site sahibi olanlar. */
export async function ownerIds(userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, [...userIds]), eq(users.role, "admin")));
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/** Tutulan sembollerin haftası — tek seferde (bar önbelleği ortak), endekslerle aynı ölçü.
 *  11 Kasım: yalnız haftanın iki ucunu okur — cuma portföy özeti
 *  (app/api/cron/portfoy-ozeti) DigestData kurmadan İÇİNDEKİ haftayı sorar. */
export async function heldMoves(
  symbols: Iterable<string>,
  data: Pick<DigestData, "pastMonday" | "pastFriday">,
  now: Date,
): Promise<Map<string, WeeklyMove>> {
  const list = [...new Set(symbols)].slice(0, 200);
  if (list.length === 0) return new Map();
  const moves = await weeklyMoves(list, data.pastMonday, data.pastFriday, now).catch(() => []);
  return new Map(moves.map((m) => [m.symbol, { changePct: m.changePct, price: m.price }]));
}

const SYSTEM = {
  tr: `Açılış Zili'nin pazar postasında okurun KENDİ PORTFÖYÜNÜN haftasını 2-3 cümleyle okuyorsun (en çok 55 kelime): portföy haftayı nasıl kapattı (S&P 500 verilmişse ona göre), haftayı en çok hangi pozisyonlar taşıdı, yeni haftada bilanço açıklayacak pozisyon varsa hangisi ve hangi gün.

HUKUKİ ÇİZGİ (kesin): kişiye özel al/sat önerisi SPK lisanslı yatırım danışmanlığıdır, bu site lisanslı değildir. Hiçbir hisseyi almayı, satmayı, eklemeyi, azaltmayı, tutmayı ÖNERME; "almalısın", "öneririm", "düşünebilirsin", "dikkatli olmalısın" gibi kalıplar ve emir kipi YASAK. Yalnız gözlem yaz.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, sebep ya da olay yazma; hesap yapma. Sayıyı verilen biçimde aynen yaz. Tutar, adet, maliyet yazma (verilmedi).
- Fiyat yönü tahmini yok. Sakin, günlük Türkçe; "sen" diye hitap et. Ünlem, emoji, madde işareti yok.`,
  en: `You read the week of the reader's OWN PORTFOLIO in 2-3 sentences (at most 55 words) for Açılış Zili's Sunday email: how the portfolio closed the week (against the S&P 500 if given), which positions drove it most, and which holdings report earnings next week and on what day, if any.

LEGAL LINE (strict): personalised buy/sell advice is licensed investment advisory and this site is not licensed. Never recommend buying, selling, adding, trimming or holding anything; phrases like "you should", "I recommend", "consider buying" and imperatives are FORBIDDEN. Write observations only.

Rules:
- Use ONLY the data given; no number, date, cause or event that is not given; no computation. Copy numbers exactly as formatted. No amounts, share counts or costs (none are given).
- No price predictions. Calm, plain English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

/* Sahibin okuması: aynı veri, açık görüş serbest. Hukuki çizgi bilinçli olarak YOK. */
const OWNER_SYSTEM = {
  tr: `${SYSTEM.tr.split("HUKUKİ ÇİZGİ")[0]}Bu metni yalnız portföyün sahibi okuyor ve açıkça görüşünü istiyor: haftanın tablosundan çıkardığın görüşü net yaz (ör. hangi pozisyonda kârın bir kısmını almak, hangisinde bilanço öncesi temkinli olmak mantıklı). Fiyat seviyesi uydurma.

Kurallar:
- YALNIZ verilen veriyi kullan; verilmeyen sayı, tarih, sebep ya da olay yazma; hesap yapma. Sayıyı verilen biçimde aynen yaz.
- Kesin fiyat tahmini yok. Sakin, günlük Türkçe; "sen" diye hitap et. Ünlem, emoji, madde işareti yok.`,
  en: `${SYSTEM.en.split("LEGAL LINE")[0]}Only the portfolio's owner reads this and explicitly asks for your view: state the view you draw from the week clearly (e.g. where taking some profit or caution before earnings makes sense). Never invent price levels.

Rules:
- Use ONLY the data given; no number, date, cause or event that is not given; no computation. Copy numbers exactly as formatted.
- No certain price predictions. Calm, plain English; address the reader as "you". No exclamation marks, emoji or bullets.`,
} as const;

const Schema = z.object({ text: z.string() });

const dayLabelOf = (locale: Locale) => (date: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

/** Haftanın okuması; yazılamazsa null (bölüm metinsiz gider). */
export async function portfolioWeekNote(userId: string, locale: Locale, week: PortfolioWeek, data: DigestData, owner: boolean): Promise<string | null> {
  if (!insightsConfigured()) return null;
  const day = dayLabelOf(locale);
  const sp = data.indices.find((i) => i.symbol === "SPY");
  const input = portfolioWeekInput(week, locale, { pastWeek: `${day(data.pastMonday)} – ${day(data.pastFriday)}`, sp500: sp?.changePct ?? null, dayLabel: day });
  const digest = createHash("sha256").update(input).digest("hex").slice(0, 16);
  try {
    return await unstable_cache(
      async () => {
        const out = await callClaude((owner ? OWNER_SYSTEM : SYSTEM)[locale], Schema, input);
        if (!out) throw new Error("no-output");
        const checked = checkPortfolioWeekNote(out.text, input, locale, { adviceAllowed: owner });
        if (!checked.ok) throw new Error(checked.reason);
        return checked.text;
      },
      ["portfolio-weekly-v1", owner ? "plan" : "read", userId, data.thisMonday, locale, digest],
      { revalidate: 7 * 24 * 3600, tags: ["portfolio-weekly"] },
    )();
  } catch (error) {
    console.error(`[portföy karnesi] ${userId}: ${error instanceof Error ? error.message : "?"}`);
    return null;
  }
}
