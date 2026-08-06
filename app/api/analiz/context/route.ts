import { NextResponse } from "next/server";
import { and, desc, gte, inArray, lte } from "drizzle-orm";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { earningsAnalyses, earningsCalendar, symbols } from "@/lib/schema";
import { addEtDays, todayEt } from "@/lib/market-hours";

/**
 * Analiz rutini için bağlam paketi.
 *
 * Rutin bu ucu çeker ve iki soruyu cevaplar:
 *   1. Son günlerde hangi BÜYÜK şirketler bilanço açıkladı?
 *   2. Hangilerini zaten yazdım, hangi dilde eksiğim var?
 *
 * Uç bir sıra ÖNERİR ama seçmez: aday listesi piyasa değerine göre sıralı
 * gelir, hangisinin yazılacağına rutin karar verir. Talimatı
 * docs/claude-rutinler.md § 4'te.
 *
 * Rakamlar burada YALNIZCA takvimin bildiği kadarıyla var (sağlayıcının
 * beklenti/gerçekleşen alanları); rutin bunları başlangıç noktası sayar ve
 * gerçek verileri şirketin resmi bülteninden doğrular.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

/** Aday havuzu: bu piyasa değerinin altındaki şirket analiz edilmiyor. */
const MIN_MARKET_CAP = 20e9;
/** Geriye bakış penceresi — bir haftadan eski bilanço artık haber değil. */
const LOOKBACK_DAYS = 7;

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days"));
  const lookback =
    Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 60
      ? Math.floor(daysParam)
      : LOOKBACK_DAYS;

  const today = todayEt();
  const from = addEtDays(today, -lookback);

  const reported = await db
    .select()
    .from(earningsCalendar)
    .where(
      and(
        gte(earningsCalendar.reportDate, from),
        lte(earningsCalendar.reportDate, today),
      ),
    )
    .orderBy(desc(earningsCalendar.reportDate));

  const symbolList = [...new Set(reported.map((row) => row.symbol))];

  const [profiles, existing] = await Promise.all([
    symbolList.length > 0
      ? db
          .select({
            symbol: symbols.symbol,
            name: symbols.name,
            exchange: symbols.exchange,
            industry: symbols.industry,
            marketCap: symbols.marketCap,
            currency: symbols.currency,
          })
          .from(symbols)
          .where(inArray(symbols.symbol, symbolList))
      : Promise.resolve([]),
    db
      .select({
        symbol: earningsAnalyses.symbol,
        period: earningsAnalyses.period,
        periodLabel: earningsAnalyses.periodLabel,
        locale: earningsAnalyses.locale,
        reportDate: earningsAnalyses.reportDate,
        verdict: earningsAnalyses.verdict,
        score: earningsAnalyses.score,
      })
      .from(earningsAnalyses)
      .orderBy(desc(earningsAnalyses.reportDate))
      .limit(400),
  ]);

  const profileOf = new Map(profiles.map((row) => [row.symbol, row]));

  /* Aynı analiz iki dilde iki satır — rutin için analiz başına TEK kayıt ve
     dillerin listesi kullanışlı: "hangisinin İngilizcesi eksik" tek bakışta
     görünür, geri doldurma da buradan beslenir. */
  const grouped = new Map<
    string,
    {
      symbol: string;
      period: string;
      period_label: string;
      report_date: string;
      verdict: string;
      score: number;
      locales: string[];
    }
  >();
  for (const row of existing) {
    const key = `${row.symbol}:${row.period}`;
    const held = grouped.get(key);
    if (held) {
      if (!held.locales.includes(row.locale)) held.locales.push(row.locale);
    } else {
      grouped.set(key, {
        symbol: row.symbol,
        period: row.period,
        period_label: row.periodLabel,
        report_date: row.reportDate,
        verdict: row.verdict,
        score: row.score,
        locales: [row.locale],
      });
    }
  }

  const analyzed = new Set(existing.map((row) => row.symbol));

  const candidates = reported
    .map((row) => {
      const profile = profileOf.get(row.symbol);
      /* Piyasa değeri yalnızca USD cinsinden karşılaştırılabilir; yabancı
         para birimli profiller elenir (TSM/TWD gibi). */
      const marketCap =
        profile?.currency === "USD" ? (profile.marketCap ?? null) : null;
      return {
        symbol: row.symbol,
        company: profile?.name ?? null,
        exchange: profile?.exchange ?? null,
        industry: profile?.industry ?? null,
        market_cap: marketCap,
        report_date: row.reportDate,
        timing: row.hour,
        quarter: row.quarter,
        year: row.year,
        eps_estimate: row.epsEstimate,
        eps_actual: row.epsActual,
        revenue_estimate: row.revenueEstimate,
        revenue_actual: row.revenueActual,
        already_analyzed: analyzed.has(row.symbol),
      };
    })
    .filter((row) => (row.market_cap ?? 0) >= MIN_MARKET_CAP)
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));

  return NextResponse.json({
    today_et: today,
    window_et: { from, to: today },
    min_market_cap: MIN_MARKET_CAP,
    /* Son bir haftada açıklamış büyük şirketler, piyasa değerine göre sıralı.
       `already_analyzed` true olanlar atlanır ya da güncellenir. */
    candidates,
    /* Zaten yazılmış analizler — `locales` hangi dillerin mevcut olduğunu
       söyler; "en" eksikse çevirisi bekleniyor. */
    existing_analyses: [...grouped.values()],
  });
}
