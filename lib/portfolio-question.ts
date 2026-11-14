import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { ClaudeBudgetError, memberClient, ownerClient } from "@/lib/claude-budget";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getPortfolioAnalysis } from "@/lib/portfolio-analysis";
import {
  computeScenario,
  decidePortfolioAnswer,
  formatScenario,
  measureCatalog,
  parseScenario,
  pickMeasures,
  PORTFOLIO_QUESTION_DAILY_LIMIT,
  PORTFOLIO_QUESTION_DAILY_MISSES,
  PortfolioAnswerSchema,
  pickFollowUps,
  scenarioKey,
  unavailableScenario,
  type MeasureCard,
  type QuestionContext,
} from "@/lib/portfolio-question-core";
import { formatMeasure } from "@/lib/portfolio-risk";
import { dayLabel, gather, holdingsOf } from "@/lib/portfolio-scan";
import { scanInput, scanRows } from "@/lib/portfolio-scan-model";
import { GROUNDING, NO_ADVICE, NUMBERS, OWNER_VIEW, UNTRUSTED_READER, VOICE } from "@/lib/claude-prompt-rules";
import { portfolioStarters, type PortfolioStarterCopy } from "@/lib/portfolio-question-suggest";
import { callClaude, expectedLastSession, upcomingEarnings } from "@/lib/stock-insights";
import { createQuestionQuota, questionKey, type QuotaStore } from "@/lib/stock-question-core";
import { formatPercentPlain, formatPercentText } from "@/lib/utils";

/**
 * PORTFÖYÜNE SOR (11 Kasım, sahibinin isteği) — okurun kendi portföyü
 * hakkındaki düz cümlelik sorusunu YALNIZ sunucunun o portföy için
 * topladığı veriden yanıtlar. Kalıp "Bu Hisseye Sor" (lib/stock-question.ts):
 * aynı soru temizliği, aynı kota yapısı (süreç belleğinde, `globalThis`),
 * aynı uçuştaki soru kilidi, aynı kabul kuralı.
 *
 * GİRDİ — günlük portföy taramasının veri toplaması (lib/portfolio-scan.ts →
 * `holdingsOf`, `gather`; 11 Kasım'da bunun için dışa açıldı) ve girdi
 * biçimi (`scanInput`): pozisyon başına ağırlık, son seans / 5 / 21 seans,
 * maliyete göre, üç aylık banttaki yer, yaklaşan bilanço (10 gün), sitenin
 * teknik görüşü, son manşetler, sektör dağılımı. Üstüne risk ölçüleri
 * (lib/portfolio-analysis.ts → `getPortfolioAnalysis`; risk ekranının
 * hesabı, istek içi önbellekli) ve soru bir senaryoysa sunucunun
 * hesapladığı "scenario" bloğu (lib/portfolio-question-core.ts). Canlı
 * kotasyon girdide YOK: her sayı son tamamlanmış seansın kapanışından
 * (yazma katmanı, veri dürüstlüğü 4-5).
 *
 * DOĞRULUK — çıktıdaki her sayı girdide geçmeli; geçmeyen yanıt HİÇ
 * basılmaz, okur nazik bir hata görür ve hakkı düşmez. Model hesap yapmaz:
 * senaryonun önce/sonra ölçülerini sunucu verir. Üyede tavsiye denetimi
 * (lib/advice-guard.ts); site sahibinde (`getAdmin`) açık görüş serbest,
 * sayı denetimi yine açık — kalıp lib/portfolio-scan.ts → `PLAN_SYSTEM`.
 *
 * MALİYET — oturum ister; okur başına günde `PORTFOLIO_QUESTION_DAILY_LIMIT`
 * soru ve `PORTFOLIO_QUESTION_DAILY_MISSES` boşa giden deneme; çağrı okurun
 * bütçe kimliğiyle (`memberClient`, `MEMBER_DAILY_CALLS` — taramayla ve
 * hisse sorusuyla ortak). Aynı soru + aynı portföy (pozisyon parmak izi) +
 * aynı seans + aynı dil önbellekten gelir ve HAK DÜŞMEZ.
 */

export type PortfolioAskAnswer = {
  kind: "answered" | "advice" | "unanswerable" | "scenario-unavailable";
  paragraphs: string[];
  measures: MeasureCard[];
  /** Sorunun bir kısmı veride yok. */
  partial: boolean;
  /** Site sahibinin açık görüşlü yanıtı. */
  owner: boolean;
  /** Verinin anlattığı son tamamlanmış seansın ET günü. */
  session: string;
  /** Claude'un önerdiği takip soruları (denetimden geçmiş). */
  followUps: string[];
};

/** Sohbetin önceki adımları (en yeni sonda) — yalnız bağlam, sayı kaynağı değil. */
export type PortfolioTurn = { question: string; answer: string };
const MAX_TURNS = 3;
const TURN_ANSWER_CHARS = 600;

export type PortfolioAskResult =
  | { ok: true; answer: PortfolioAskAnswer; remaining: number }
  | { ok: false; reason: "quota" | "busy" | "budget" | "empty" | "data" | "unverified" | "error"; remaining: number };

/* Sayaç `globalThis`te — gerekçe lib/stock-question.ts (Turbopack sayfa ve
   `/api` ucunu ayrı çalışma zamanlarına koyuyor). Hisse sorusundan AYRI
   depo: iki kutunun hakları birbirini yemez. */
const shared = globalThis as typeof globalThis & { __azPortfolioQuestionQuota?: QuotaStore; __azOwnerQuestionQuota?: QuotaStore; __azPortfolioQuestionInflight?: Set<string> };
shared.__azPortfolioQuestionQuota ??= new Map();
shared.__azPortfolioQuestionInflight ??= new Set();

/* Sahibin ayrı kotası (11 Kasım): danışmanla sohbet bir oturumda birkaç tur
   sürüyor; üyenin 5 sorusu ilk adımda bitiyordu. Bütçe kimliği de ayrı
   (`ownerClient`, lib/claude-budget.ts → OWNER_DAILY_CALLS). */
export const OWNER_QUESTION_DAILY_LIMIT = 30;
shared.__azOwnerQuestionQuota ??= new Map();
export const ownerQuestionQuota = createQuestionQuota(shared.__azOwnerQuestionQuota, OWNER_QUESTION_DAILY_LIMIT, undefined, 8);

export const portfolioQuestionQuota = createQuestionQuota(
  shared.__azPortfolioQuestionQuota,
  PORTFOLIO_QUESTION_DAILY_LIMIT,
  undefined,
  PORTFOLIO_QUESTION_DAILY_MISSES,
);
const inflight = shared.__azPortfolioQuestionInflight;

const ANSWER_TTL_S = 12 * 3600;

/* İSTEM (14 Kasım turu; kalıp lib/stock-question.ts → SYSTEM):
   - Girdi şeması blok blok anlatılıyor; cevap İLK cümlede.
   - TAKİP SORULARI hesaplanabilir olmalı: model "MU'yu azaltsam ne olur?"
     gibi TUTARSIZ bir senaryo öneriyordu; okur basınca "hesaplayamıyorum"
     görüyordu (ayrıştırıcı tek hisse + net eylem ister,
     lib/portfolio-question-core.ts → `parseScenario`). Kalıplar istemde.
   - Ortak kurallar lib/claude-prompt-rules.ts'ten; üyede tavsiye çizgisi,
     sahipte açık görüş (`OWNER_VIEW`). */
const INPUT_TR = `<girdi>
- question: okurun sorusu. conversation (varsa): önceki sorular ve senin kısa yanıtların; yalnız göndermeleri çözmek için ("onu", "peki ya MU").
- portfolio: okurun portföyü, son TAMAMLANMIŞ seansın kapanışlarıyla. null olan alan YOK demektir.
  - session, positionCount, sectorCount; portfolio: portföyün son seansı, son beş seansı ve ilk beş pozisyonun payı (top5Weight).
  - positions: ağırlık sırasıyla pozisyonlar: weight, lastSession, lastFiveSessions, last21Sessions, sinceAverageCost (ortalama maliyete göre), threeMonthRange (üç aylık bandın neresinde), earningsSoon (yaklaşan bilanço günü), siteTechnicalView (sitenin teknik görüşü), recentHeadlines.
  - sectors: sektör payları. benchmark: kıyas endeksinin adı.
  - risk: bugünkü ağırlıklarla geçen yılın ölçüleri (oynaklık, beta, en büyük düşüş, etkin pozisyon sayısı, ortalama korelasyon, temettü verimi, bilanço açıklayacakların payı). Okurun gerçek geçmiş getirisi değildir.
  - scenario (varsa): sitenin hesapladığı senaryo; before ve after değerleri, varsayımıyla.
- Tutar, adet ve maliyet tutarı girdide YOK; sorulursa bulunmadığını söyle.
</girdi>`;

const INPUT_EN = `<input>
- question: the reader's question. conversation (when present): earlier questions and your short answers; use it only to resolve references ("it", "what about MU").
- portfolio: the reader's portfolio at the closes of the last COMPLETED session. A null field means the data does NOT exist.
  - session, positionCount, sectorCount; portfolio: the portfolio's last session, last five sessions and the share of the top five positions (top5Weight).
  - positions: positions by weight: weight, lastSession, lastFiveSessions, last21Sessions, sinceAverageCost (against average cost), threeMonthRange (place in the three-month range), earningsSoon (the upcoming earnings day), siteTechnicalView (the site's technical view), recentHeadlines.
  - sectors: sector shares. benchmark: the name of the benchmark index.
  - risk: measures over the past year at today's weights (volatility, beta, maximum drawdown, effective number of positions, average correlation, dividend yield, share reporting earnings). They are not the reader's actual past return.
  - scenario (when present): a scenario computed by the site; before and after values with the assumption.
- Amounts, share counts and cost amounts are NOT in the input; if asked, say they are not available.
</input>`;

const outputTr = (owner: boolean) => `<cikti>
- verdict: "answered" (veriyle yanıtlanıyor)${owner ? "" : `, "advice" (soru al/sat/tut, hedef fiyat ya da "yükselir mi" gibi bir tavsiye ya da tahmin istiyor)`}, "not_in_data" (veride sorunun HİÇBİR kısmının karşılığı yok ya da soru bu portföyle ilgili değil), "scenario_unavailable" (soru bir senaryo — "X'i satsam", "Y eklesem" — ama girdide "scenario" yok ya da "computable": false).
- paragraphs: bir ile üç kısa paragraf, toplam en çok 120 kelime. İLK CÜMLE sorunun cevabıdır (hangi pozisyon, ne kadar, evet/hayır); sonraki cümleler dayanağı verir. Soruyu tekrar etme, "verilere göre" diye başlama, sorulmayan pozisyonları sıralama. "not_in_data" ve "scenario_unavailable"da boş bırak.
- measures: yanıtın dayandığı ölçülerin kimlikleri, en çok altı, önem sırasıyla. Biçim: "portfolio.<alan>", "<SEMBOL>.<alan>" (weight, lastSession, lastFiveSessions, last21Sessions, sinceAverageCost), "risk.<alan>", "scenario.<alan>" (symbolWeight, top5Weight, largest, effectivePositions, sectorWeight).
- partial: sorunun bir kısmı veride yoksa true; eksik olanı yanıtta tek cümleyle söyle.
- followUps: okurun bu yanıttan sonra sorabileceği iki ya da üç kısa soru (her biri en çok on iki kelime), birinci tekil şahısla. Her biri TEK şey sorar, birbirinden farklı bir açıdan (ağırlık, hareket, risk, bilanço, senaryo) ve bu yanıtta zaten cevaplanmış şeyi sormaz. Yalnız girdinin yanıtlayabileceği sorular. Senaryo sorusu sitenin hesaplayabildiği kalıpta olmalı: okurun KENDİ pozisyonlarından tek hisse ve net eylem ("…tamamını satsam", "…yarısını satsam", "…iki katına çıkarsam"); tutarsız ("biraz azaltsam") ya da iki hisseli senaryo önerme. Soruda girdide olmayan sayı yazma.${owner ? "" : " Tavsiye isteyen soru önerme."}
</cikti>`;

const outputEn = (owner: boolean) => `<output>
- verdict: "answered" (the data answers it)${owner ? "" : `, "advice" (the question asks for buy/sell/hold advice, a price target or a prediction)`}, "not_in_data" (the data covers NO part of the question, or the question is not about this portfolio), "scenario_unavailable" (the question is a scenario — "if I sell X", "if I add Y" — but the input has no "scenario" or it has "computable": false).
- paragraphs: one to three short paragraphs, at most 120 words in total. The FIRST SENTENCE is the answer (which position, how much, yes/no); the following sentences give the basis. Do not restate the question, do not open with "based on the data", do not list positions nobody asked about. Empty for "not_in_data" and "scenario_unavailable".
- measures: ids of the measures the answer relies on, at most six, most important first. Format: "portfolio.<field>", "<SYMBOL>.<field>" (weight, lastSession, lastFiveSessions, last21Sessions, sinceAverageCost), "risk.<field>", "scenario.<field>" (symbolWeight, top5Weight, largest, effectivePositions, sectorWeight).
- partial: true if part of the question is not in the data; say what is missing in one sentence.
- followUps: two or three short questions (at most twelve words each) the reader could ask after this answer, in the first person. Each asks ONE thing, from a different angle (weight, moves, risk, earnings, scenario), and none asks what this answer already covered. Only questions the input can answer. A scenario question must be in a form the site can compute: one stock from the reader's OWN positions and a clear action ("What if I sell all of …?", "What if I sell half of …?", "What if I double …?"); never a vague ("trim a bit") or two-stock scenario. No number in a question that is not in the input.${owner ? "" : " Never suggest a question that asks for advice."}
</output>`;

const SCENARIO_TR = `Senaryo: girdide "scenario" varsa ve "computable": true ise hesabı SİTE yaptı; önce (before) ve sonra (after) değerlerini aynen aktar, varsayımı (assumption) bir cümleyle an. "computable": false ise verdict "scenario_unavailable".`;
const SCENARIO_EN = `Scenario: if the input has "scenario" with "computable": true, the SITE did the math; report the before and after values exactly and mention the assumption in one sentence. If "computable": false, the verdict is "scenario_unavailable".`;
const TECH_TR = `Sitenin teknik görüşünü KAYNAĞIYLA aktar ("sitenin teknik görüşü SAT"), kendi görüşün gibi değil.`;
const TECH_EN = `Attribute the site's technical view ("the site's technical view is SELL"), never as your own.`;

const SYSTEM = {
  tr: `Açılış Zili'nde (ABD hisselerini izleyen Türk bireysel yatırımcılar için bir site) "Portföyüne Sor" kutusunu yanıtlıyorsun. Okurun KENDİ portföyü hakkındaki sorusunu YALNIZ verilen JSON'daki portföy verisiyle yanıtla.

HUKUKİ ÇİZGİ (kesin): Türkiye'de kişiye özel al/sat önerisi SPK lisanslı yatırım danışmanlığıdır ve bu site lisanslı değildir. Soru tavsiye istiyorsa verdict "advice": ilk cümle kısa ret ("Tavsiye veremem."), ardından soruyla ilgili veri; okurun al/sat kipindeki sözlerini tekrar etme. Senaryo yanıtında gözlem dili kullan ("satılması durumunda").

${INPUT_TR}

${outputTr(false)}

<kurallar>
- ${GROUNDING.tr}
- ${NUMBERS.tr}
- ${SCENARIO_TR}
- ${NO_ADVICE.tr}
- ${TECH_TR}
- ${UNTRUSTED_READER.tr}
- ${VOICE.tr} "Sen" diye hitap et. Madde işareti ve başlık yok.
</kurallar>`,
  en: `You answer the "Ask Your Portfolio" box on Açılış Zili (a site for Turkish individual investors following US stocks). Answer the reader's question about their OWN portfolio using ONLY the portfolio data in the supplied JSON.

LEGAL LINE (strict): in Türkiye, personalised buy/sell advice is licensed investment advisory and this site is not licensed. If the question asks for advice, the verdict is "advice": open with a short refusal ("I can't give advice."), then give the data relevant to the question; do not repeat the reader's buy/sell wording. In scenario answers use observational wording ("in the case of selling").

${INPUT_EN}

${outputEn(false)}

<rules>
- ${GROUNDING.en}
- ${NUMBERS.en}
- ${SCENARIO_EN}
- ${NO_ADVICE.en}
- ${TECH_EN}
- ${UNTRUSTED_READER.en}
- ${VOICE.en} Address the reader as "you". No bullets or headings.
</rules>`,
} as const;

/* SAHİBİN AÇIK GÖRÜŞÜ — gerekçe lib/portfolio-scan-model.ts → "KİŞİSEL
   PLAN". Hukuki çizgi ve tavsiye kuralı bilerek YOK: metin yalnız site
   sahibine, kendi portföyü için basılıyor; sayı denetimi aynen açık,
   seviye/fiyat uydurulamaz (girdide olmayan sayı metni düşürür). */
const OWNER_SYSTEM = {
  tr: `Açılış Zili'nde "Portföyüne Sor" kutusunu yanıtlıyorsun. Bu oturum portföyün SAHİBİNİN ve açıkça görüşünü istiyor: sorarsa ekle / tut / azalt / sat görüşünü net söyle; gerekçe veriden (ağırlık, momentum, maliyete göre durum, banttaki yer, bilanço tarihi, sitenin teknik görüşü). Görüşlü yanıt da verdict "answered".

${INPUT_TR}

${outputTr(true)}

<kurallar>
- ${GROUNDING.tr}
- ${NUMBERS.tr}
- ${SCENARIO_TR}
- ${OWNER_VIEW.tr}
- ${TECH_TR}
- ${UNTRUSTED_READER.tr}
- ${VOICE.tr} "Sen" diye hitap et. Madde işareti ve başlık yok.
</kurallar>`,
  en: `You answer the "Ask Your Portfolio" box on Açılış Zili. This session belongs to the portfolio's OWNER, who explicitly asks for your view: if asked, state clearly whether you would add, hold, trim or sell; ground the view in the data (weight, momentum, position vs cost, place in the range, earnings date, the site's technical view). An opinionated answer is also verdict "answered".

${INPUT_EN}

${outputEn(true)}

<rules>
- ${GROUNDING.en}
- ${NUMBERS.en}
- ${SCENARIO_EN}
- ${OWNER_VIEW.en}
- ${TECH_EN}
- ${UNTRUSTED_READER.en}
- ${VOICE.en} Address the reader as "you". No bullets or headings.
</rules>`,
} as const;

/** Risk ekranının ölçüleri, okurun dilinde biçimlenmiş; hesap yoksa null. */
async function riskBlock(holdings: { symbol: string; quantity: number }[], locale: Locale): Promise<Record<string, string | null> | null> {
  const analysis = await getPortfolioAnalysis(holdings).catch(() => null);
  const risk = analysis?.risk;
  if (!risk) return null;
  const r = risk.risk;
  return {
    window: r ? `${r.sessions} ${locale === "en" ? "sessions" : "seans"}` : null,
    annualVolatility: r ? formatPercentPlain(r.volatility, locale, 1) : null,
    benchmarkVolatility: r ? formatPercentPlain(r.benchmarkVolatility, locale, 1) : null,
    beta: r ? formatMeasure(r.beta, locale, 2) : null,
    maxDrawdown: r ? formatPercentText(r.maxDrawdown.depth, locale, 1) : null,
    effectivePositions: formatMeasure(risk.concentration.effectiveCount, locale, 1),
    averageCorrelation: risk.correlation ? formatMeasure(risk.correlation.average, locale, 2) : null,
    dividendYield: risk.dividends ? formatPercentPlain(risk.dividends.yieldPct, locale, 2) : null,
    earningsNext30Days: risk.earnings.weeks.length ? formatPercentPlain(risk.earnings.totalWeight, locale, 0) : null,
  };
}

/**
 * Okurun sorusu. Kota ve uçuştaki soru burada; uç (app/api/ai/portfoy-sor)
 * kimlik, köken, bot ve soru denetimini yapmış olarak çağırır.
 */
export async function askPortfolio(userId: string, question: string, locale: Locale, history: readonly PortfolioTurn[] = []): Promise<PortfolioAskResult> {
  /* Sahip kendi kotasıyla (danışmanla sohbet); kim olduğu sorgudan önce. */
  const ownerFirst = (await getAdmin())?.userId === userId;
  const quota = ownerFirst ? ownerQuestionQuota : portfolioQuestionQuota;
  const remaining = () => quota.left(userId);
  if (remaining() <= 0) return { ok: false, reason: "quota", remaining: 0 };
  if (inflight.has(userId)) return { ok: false, reason: "busy", remaining: remaining() };
  inflight.add(userId);
  /* Geri çağrı modele gittiyse Claude'a gidildi; önbellekten gelen yanıtta hak düşmez. */
  let wrote = false;
  try {
    const holdings = await holdingsOf(userId);
    if (!holdings) return { ok: false, reason: "empty", remaining: remaining() };
    const session = await expectedLastSession();
    const owner = ownerFirst;
    const inputs = await gather(holdings, locale);
    const rows = scanRows(inputs);
    /* Taramayla aynı eşik: pozisyonların yarısı ölçülemiyorsa yanıt yarım veriye dayanırdı. */
    if (rows.length < 1 || rows.length * 2 < holdings.length) return { ok: false, reason: "data", remaining: remaining() };

    const base = JSON.parse(
      scanInput(rows, session, locale, dayLabel(locale), {
        newsBySymbol: new Map(inputs.map((h) => [h.symbol, h.news])),
        technicalBySymbol: new Map(inputs.map((h) => [h.symbol, h.technical?.headline ?? null])),
      }),
    ) as Record<string, unknown> & { positions: QuestionContext["positions"]; sectors: { sector: string; weight: string }[] };
    const risk = await riskBlock(holdings.map(([symbol, h]) => ({ symbol, quantity: h.quantity })), locale);
    const largestSector = base.sectors[0] ? `${base.sectors[0].sector} ${base.sectors[0].weight}` : null;

    const turns = history.slice(-MAX_TURNS).map((t) => ({ question: t.question.slice(0, 300), answer: t.answer.slice(0, TURN_ANSWER_CHARS) }));
    const turnsKey = turns.length ? createHash("sha256").update(JSON.stringify(turns)).digest("hex").slice(0, 12) : "-";
    const parsed = parseScenario(question, rows.map((r) => r.symbol));
    let scenario: QuestionContext["scenario"] = null;
    if (parsed.status === "unparsed") scenario = unavailableScenario(parsed.reason, locale);
    else if (parsed.status === "parsed") {
      const result = computeScenario(rows.map((r) => ({ symbol: r.symbol, value: r.value, sector: r.sector })), parsed.action);
      scenario = result ? formatScenario(result, locale) : unavailableScenario("data", locale);
    }

    const context = {
      ...base,
      /* Kıyasın ADI girdide (14 Kasım): risk bloğu "benchmarkVolatility"
         veriyor ama adını vermiyordu; "S&P 500'ün oynaklığı" diyen doğru
         yanıt, 500 girdide geçmediği için sayı denetiminden düşüyordu
         (risk notu aynı alanı zaten taşıyor, lib/portfolio-analysis-note.ts). */
      benchmark: "S&P 500",
      risk: risk ? { ...risk, largestSector } : largestSector ? { largestSector } : null,
      ...(scenario ? { scenario } : {}),
    };
    const input = JSON.stringify(context);
    const t = getDictionary(locale).portfolioAsk;
    const catalog = measureCatalog(context as QuestionContext, { scopes: t.scopes, measures: t.measures, arrow: t.arrow });
    const fingerprint = createHash("sha256")
      .update(holdings.map(([s, h]) => `${s}:${h.quantity}:${h.cost.toFixed(4)}`).join("|"))
      .digest("hex")
      .slice(0, 16);

    const answer = await unstable_cache(
      async (): Promise<PortfolioAskAnswer> => {
        const out = await callClaude(
          (owner ? OWNER_SYSTEM : SYSTEM)[locale],
          PortfolioAnswerSchema,
          JSON.stringify({ question, ...(turns.length ? { conversation: turns } : {}), portfolio: context }),
          owner ? ownerClient(userId) : memberClient(userId),
        );
        wrote = true;
        if (!out) throw new Error("no-output");
        const decision = decidePortfolioAnswer(out, input, locale, { adviceAllowed: owner });
        /* Denetimden düşen yanıt ÖNBELLEĞE GİRMEZ ve hak düşmez (aşağıda `miss`). */
        if (decision.kind === "rejected") throw new RejectedAnswer(decision.reason, decision.missing);
        if (!("paragraphs" in decision))
          return { kind: decision.kind, paragraphs: [], measures: [], partial: false, owner, session, followUps: pickFollowUps(out.followUps, input, locale, owner) };
        return {
          kind: decision.kind,
          paragraphs: decision.paragraphs,
          measures: pickMeasures(out.measures, catalog),
          partial: decision.partial,
          owner,
          session,
          followUps: pickFollowUps(out.followUps, input, locale, owner),
        };
      },
      /* Anahtar: kullanıcı + soru + portföy parmak izi + seans + dil +
         sahiplik + senaryo ayrıştırması. Kullanıcı kimliği 14 Kasım'da girdi
         (portföy güvenlik denetimi): yanıt sızmıyordu ama önbellek isabetinde
         hak düşmediği için "bu portföy bu soruyu sordu mu" bilgisi
         okunabiliyordu; kişisel sonuç veren öteki altı anahtar da kimlikli. */
      /* v2 (11 Kasım): takip soruları ve sohbet bağlamı; bağlamın özeti anahtarda. */
      /* v4 (14 Kasım): istem yeniden yazıldı (cevap ilk cümlede, girdi şeması, takip sorusu kuralları); girdiye `benchmark` girdi. */
      ["portfolio-question-v4", userId, owner ? "owner" : "member", locale, session, fingerprint, questionKey(question, locale), scenarioKey(parsed), turnsKey],
      { revalidate: ANSWER_TTL_S, tags: ["portfolio-question"] },
    )();
    if (wrote) quota.charge(userId);
    return { ok: true, answer, remaining: remaining() };
  } catch (error) {
    if (error instanceof RejectedAnswer) {
      quota.miss(userId);
      console.error(`[portföyüne sor] ${error.reason} (${error.missing.join(" ")})`);
      return { ok: false, reason: "unverified", remaining: remaining() };
    }
    if (error instanceof ClaudeBudgetError) return { ok: false, reason: "budget", remaining: remaining() };
    /* Claude'a gidildi ama çıktı gelmedi: çağrı ödendi, boşa giden deneme. */
    if (wrote) quota.miss(userId);
    console.error(`[portföyüne sor] ${error instanceof Error ? error.message : "?"}`);
    return { ok: false, reason: "error", remaining: remaining() };
  } finally {
    inflight.delete(userId);
  }
}

/**
 * Hazır sorular (14 Kasım) — ekran çizilirken, Claude çağrısı OLMADAN.
 * Kural ve gerekçe lib/portfolio-question-suggest.ts. Ağırlık ekranın
 * kendi değerlerinden (yalnız "en büyük pozisyon ağır mı" eşiği için; metne
 * sayı geçmez), yaklaşan bilanço taramanın sorduğu aynı takvimden
 * (`upcomingEarnings`, 10 gün). Takvim okunamazsa bilanço sorusu çıkmaz.
 */
export async function portfolioStarterQuestions(
  positions: readonly { symbol: string; valueUsd: number | null }[],
  sectorCount: number,
  owner: boolean,
  copy: PortfolioStarterCopy,
): Promise<string[]> {
  const bySymbol = new Map<string, number>();
  for (const p of positions) bySymbol.set(p.symbol, (bySymbol.get(p.symbol) ?? 0) + Math.max(0, p.valueUsd ?? 0));
  const total = [...bySymbol.values()].reduce((sum, value) => sum + value, 0);
  const ahead = await Promise.all([...bySymbol.keys()].map((symbol) => upcomingEarnings(symbol).catch(() => null)));
  return portfolioStarters(
    {
      positionCount: bySymbol.size,
      largestWeightPct: total > 0 ? (Math.max(...bySymbol.values()) / total) * 100 : null,
      sectorCount,
      earningsSoonCount: ahead.filter(Boolean).length,
      owner,
    },
    copy,
  ).map((item) => item.text);
}

class RejectedAnswer extends Error {
  constructor(
    readonly reason: string,
    readonly missing: string[],
  ) {
    super(reason);
  }
}
