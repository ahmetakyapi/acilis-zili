import { NextResponse } from "next/server";
import { and, desc, gte, inArray, lte } from "drizzle-orm";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { earningsAnalyses, earningsCalendar, symbols } from "@/lib/schema";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { sectorGroupOf } from "@/lib/sectors";

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

/**
 * Aday havuzunun eşikleri — tek sayı değil, iki kademe.
 *
 * Teknoloji ve altyapı tarafında evren daha hızlı değişiyor: 100–200 milyar
 * bandındaki bir yarı iletken, veri merkezi ya da güç altyapısı şirketinin
 * çeyreği, aynı büyüklükteki bir perakendecininkinden çok daha fazla şey
 * anlatıyor. Öteki sektörlerde aynı bandın çoğu "sıradan iyi çeyrek"
 * oluyor ve analiz yazmaya değmiyor.
 */
const CAP_TECH_INFRA = 100e9;
const CAP_GENERAL = 200e9;

/**
 * Eşiğe bakılmaksızın aday sayılan şirketler.
 *
 * Yapay zekâ, uzay ve enerji altyapısının inşa katmanı: hepsi 100 milyarın
 * belirgin altında (NBIS 48, BE 64, RKLB 45, CRWV 39 milyar $) ama
 * bilançoları o eşiğin üstündeki pek çok şirketten daha çok konuşuluyor.
 * Eşiği bunları yakalayacak kadar indirmek yüzlerce sıradan şirketi de içeri
 * alırdı; adla saymak hem dar hem dürüst.
 *
 * ASTS'in `symbols` tablosunda henüz profili yok (piyasa değeri null) —
 * liste bilinçli olarak profile DEĞİL sembole bakıyor ki profil gelene kadar
 * da aday kalsın. Cron her gün 15 eksik profili dolduruyor.
 */
const ALWAYS_ELIGIBLE = new Set(["NBIS", "BE", "RKLB", "ASTS", "CRWV"]);

/**
 * "Teknoloji ve altyapı" kümesi.
 *
 * İki sektör grubu doğrudan giriyor; kalanı endüstri adıyla ekleniyor çünkü
 * GICS taksonomisi bu kategoriyi tam karşılamıyor — Rocket Lab "Aerospace &
 * Defense", Bloom Energy "Electrical Equipment", Constellation Energy
 * "Utilities" altında duruyor ve üçü de bu işin altyapısı.
 */
const TECH_INFRA_GROUPS = new Set(["teknoloji", "yari-iletken"]);
const TECH_INFRA_INDUSTRIES = new Set([
  // Uzay ve savunma
  "Aerospace & Defense",
  // Güç ve elektrik ekipmanı
  "Electrical Equipment",
  "Electrical Components & Equipment",
  "Heavy Electrical Equipment",
  // Elektrik üretimi — veri merkezi talebinin ucu buraya çıkıyor
  "Utilities",
  "Electric Utilities",
  "Multi-Utilities",
  "Independent Power Producers & Energy Traders",
  "Renewable Electricity",
  // Şebekeyi ve veri merkezini fiziksel olarak kuranlar
  "Construction & Engineering",
  // Bağlantı katmanı
  "Communications",
  "Telecommunication",
  "Alternative Carriers",
  "Integrated Telecommunication Services",
  "Wireless Telecommunication Services",
  // Veri merkezinin kendisi
  "Data Center REITs",
]);

function isTechInfra(industry: string | null): boolean {
  if (industry && TECH_INFRA_INDUSTRIES.has(industry)) return true;
  return TECH_INFRA_GROUPS.has(sectorGroupOf(industry).key);
}

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
    .flatMap((row) => {
      const profile = profileOf.get(row.symbol);
      /* Piyasa değeri yalnızca USD cinsinden karşılaştırılabilir; yabancı
         para birimli profiller elenir (TSM/TWD gibi). */
      const marketCap =
        profile?.currency === "USD" ? (profile.marketCap ?? null) : null;
      const industry = profile?.industry ?? null;
      const techInfra = isTechInfra(industry);
      const watched = ALWAYS_ELIGIBLE.has(row.symbol);
      const threshold = techInfra ? CAP_TECH_INFRA : CAP_GENERAL;
      if (!watched && (marketCap ?? 0) < threshold) return [];

      return [{
        symbol: row.symbol,
        company: profile?.name ?? null,
        exchange: profile?.exchange ?? null,
        industry,
        market_cap: marketCap,
        /* Adayın hangi kapıdan girdiği: eşiği geçtiği için mi, yoksa adı
           listede olduğu için mi. Rutin sıralama kararını buna bakarak
           veriyor. */
        tier: watched
          ? ("izlenen" as const)
          : techInfra
            ? ("teknoloji-altyapi" as const)
            : ("genel" as const),
        threshold: watched ? null : threshold,
        report_date: row.reportDate,
        timing: row.hour,
        quarter: row.quarter,
        year: row.year,
        eps_estimate: row.epsEstimate,
        eps_actual: row.epsActual,
        revenue_estimate: row.revenueEstimate,
        revenue_actual: row.revenueActual,
        already_analyzed: analyzed.has(row.symbol),
      }];
    })
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));

  return NextResponse.json({
    today_et: today,
    window_et: { from, to: today },
    thresholds: {
      "teknoloji-altyapi": CAP_TECH_INFRA,
      genel: CAP_GENERAL,
      izlenen: [...ALWAYS_ELIGIBLE],
    },
    /* Son bir haftada açıklamış, eşiği geçen ya da adı listede olan
       şirketler; piyasa değerine göre sıralı. `already_analyzed` true
       olanlar atlanır ya da güncellenir. */
    candidates,
    /* Zaten yazılmış analizler — `locales` hangi dillerin mevcut olduğunu
       söyler; "en" eksikse çevirisi bekleniyor. */
    existing_analyses: [...grouped.values()],
  });
}
