import { createHash } from "node:crypto";
import { adviceMatches } from "@/lib/advice-guard";
import { istanbulDay } from "@/lib/ai-analysis-core";
import { ungroundedNumbers } from "@/lib/ai-grounding";

/**
 * "Bu Hisseye Sor"un SAF parçaları (24 Ekim) — soru temizliği, okur
 * kotası, kaynak künyesi ve yanıtın kabul kararı. Sunucu modülü
 * `lib/stock-question.ts` bunları çağırır, testler doğrudan
 * (tests/stock-question.test.ts).
 */

/** Okur başına günlük soru hakkı (İstanbul günü; analiz kotasıyla aynı gün sınırı). */
export const QUESTION_DAILY_LIMIT = 10;
/**
 * Okur başına günlük BOŞA GİDEN deneme tavanı (24 Ekim düzeltmesi): Claude'a
 * gidilmiş ama yanıtı okura basılmamış sorular (sayı denetimi, tavsiye
 * denetimi, boş çıktı). Gerekçe aşağıda, "Okur kotası".
 */
export const QUESTION_DAILY_MISSES = 5;
export const QUESTION_MIN_CHARS = 3;
export const QUESTION_MAX_CHARS = 300;

/**
 * Yanıtın dayanabileceği veri blokları — sayfanın panelleriyle bire bir.
 * Model hangilerini kullandığını bu adlarla söyler; okura sözlükteki
 * etiketleriyle "Yararlanılan Veri" künyesi olarak basılır. Girdide olmayan
 * blok künyeye giremez (`usedSources`).
 */
export const ASK_SOURCES = ["session", "valuation", "scorecard", "analysts", "earnings", "nextEarnings", "dividends", "news", "notes"] as const;
export type AskSource = (typeof ASK_SOURCES)[number];

const CONTROL_BELOW = 0x20;
const DELETE = "\u007f";

/** Soru metni: kontrol karakterleri ve fazla boşluk atılır; çok kısa ya da uzunsa null. */
export function normalizeQuestion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = Array.from(raw, (ch) => (ch.charCodeAt(0) < CONTROL_BELOW || ch === DELETE ? " " : ch))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < QUESTION_MIN_CHARS || text.length > QUESTION_MAX_CHARS) return null;
  return text;
}

/**
 * Önbellek anahtarının soru parçası: büyük/küçük harf ve sondaki noktalama
 * yanıtı değiştirmez ("Temettü ödüyor mu?" ile "temettü ödüyor mu" aynı).
 * Küçültme dile göre (`tr-TR`: İ → i, I → ı); `toLowerCase` Türkçede yanlış.
 */
export function questionKey(question: string, locale: "tr" | "en"): string {
  const folded = question
    .toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR")
    .replace(/[\s?!.…]+$/u, "")
    .trim();
  return createHash("sha256").update(folded).digest("hex").slice(0, 16);
}

/* ---------------------------------------------------------------------------
   Okur kotası

   SÜREÇ BELLEĞİNDE, TABLO YOK. Var olan kota (`ai_analysis_access`,
   lib/ai-analysis-quota.ts) yönetimin tek tek açtığı analiz hakkı: satır
   yoksa hak da yok, kilit dört dakikalık rapor işine göre. Oturum açmış her
   okura açık bir soru kutusuna uymuyor ve tabloya sütun eklemek yasak
   (CLAUDE.md, migration). Sitenin öteki Claude sınırları da bellekte
   (lib/claude-budget.ts; sunucu tek süreç): yeniden başlatma sayacı
   sıfırlar, en kötü durumda okur o gün birkaç soru fazla sorar. Maliyetin
   asıl tavanı yine ortak bütçe (`memberClient`, genel tavan) — kota okura
   GÖRÜNEN, öngörülebilir sınır.

   BOŞA GİDEN DENEME AYRI SAYILIR (24 Ekim düzeltmesi). Denetimden düşen
   yanıt haktan yemiyordu (okur yanıt görmedi, kusur bizde) ama Claude
   çağrısı yine ödenmişti: modeli bilerek dayanaksız sayıya ya da tavsiyeye
   zorlayan soru dizisi günlük 10 tavanı sınırsızca aşabiliyordu. İki yol
   vardı: başarısızı yarım hak saymak ya da ayrı bir sayaç. Ayrı sayaç
   seçildi: dürüst okur nadir bir düşüşte hakkından HİÇ kaybetmez (yarım
   sayım onu bizim kusurumuz için cezalandırırdı), sistemi zorlayan ise
   beşinci boş denemede o günün kalan hakkını kaybeder. Okur başına günlük
   en kötü çağrı sayısı böylece 10 + 5 = 15 ile sınırlı.
   --------------------------------------------------------------------------- */

export type QuestionQuota = {
  /** Bugün kalan hak. */
  left(userId: string): number;
  /** Bir hak düşer; hak yoksa false. */
  charge(userId: string): boolean;
  /** Boşa giden bir deneme yazılır; tavan dolunca o gün `left` sıfır. */
  miss(userId: string): void;
};

/* Sayaç yalnız bugünün kaydını tutar: dünkü kayıt okunurken sıfır sayılır,
   ilk yazmada üzerine yazılır. Okur başına tek satır; tablo okur sayısıyla
   sınırlı, ayrıca süpürme gerekmiyor. */

export type QuotaStore = Map<string, { day: string; n: number; misses?: number }>;

export function createQuestionQuota(
  used: QuotaStore = new Map(),
  limit = QUESTION_DAILY_LIMIT,
  now: () => Date = () => new Date(),
  missLimit = QUESTION_DAILY_MISSES,
): QuestionQuota {
  const today = (userId: string) => {
    const day = istanbulDay(now());
    const entry = used.get(userId);
    return entry && entry.day === day ? { day, n: entry.n, misses: entry.misses ?? 0 } : { day, n: 0, misses: 0 };
  };
  const left = (userId: string) => {
    const entry = today(userId);
    return entry.misses >= missLimit ? 0 : Math.max(0, limit - entry.n);
  };
  return {
    left,
    charge: (userId) => {
      if (left(userId) <= 0) return false;
      const entry = today(userId);
      used.set(userId, { ...entry, n: entry.n + 1 });
      return true;
    },
    miss: (userId) => {
      const entry = today(userId);
      used.set(userId, { ...entry, misses: entry.misses + 1 });
    },
  };
}

/** Modelin söylediği kaynaklardan girdide gerçekten olanlar; tekrarsız, sayfa sırasıyla. */
export function usedSources(claimed: readonly string[], available: ReadonlySet<AskSource>): AskSource[] {
  const wanted = new Set(claimed);
  return ASK_SOURCES.filter((source) => wanted.has(source) && available.has(source));
}

/** Atıf yapılan haberler: geçerli dizin, tekrarsız, en çok üç. */
export function citedNews(indices: readonly number[], count: number, max = 3): number[] {
  return [...new Set(indices)].filter((i) => Number.isInteger(i) && i >= 0 && i < count).slice(0, max);
}

export type ModelAnswer = { verdict: "answered" | "advice" | "not_in_data"; answer: string };

export type AnswerDecision =
  | { kind: "answered" | "advice"; text: string; charge: true }
  | { kind: "unanswerable"; reason: "not-in-data" | "empty" | "ungrounded" | "advice-pattern"; missing?: string[]; charge: boolean };

/**
 * Yanıt okura gider mi. Sayı denetimi `grounding` metnine karşı (girdinin
 * haber dizinleri ATILMIŞ hâli — lib/stock-insights.ts → `groundingOf`
 * gerekçesi: 0–9 dizinleri uydurulmuş küçük sayıları geçirirdi). Soru
 * metni denetimde YOK: okurun "fiyat 500 olur mu" sorusundaki 500 yanıta
 * kaynak olamaz.
 *
 * TAVSİYE DENETİMİ (24 Ekim düzeltmesi): prompt al/sat önerisini yasaklıyor
 * ama prompt bir rica; portföy notunun son kontrolü (lib/advice-guard.ts)
 * burada da koşar. Yönlendirme kalıbı yakalanırsa metin HİÇ basılmaz, okur
 * sabit "cevaplayamıyorum" cümlesini görür. "advice" hükmündeki ret
 * cümlesi de denetlenir: "tavsiye veremem" geçer, "almanı öneririm" düşer.
 *
 * Hak düşer mi: model veriyle yanıtladıysa, tavsiyeyi geri çevirdiyse ya da
 * verinin yetmediğini söylediyse evet (gerçek bir yanıt aldı). Sayı ya da
 * tavsiye denetimi düşürdüyse veya metin boşsa HAYIR: okur yanıt görmedi.
 * O deneme yine de boşa giden deneme sayacına yazılır (`QuestionQuota.miss`).
 */
export function decideAnswer(out: ModelAnswer, grounding: string, locale: "tr" | "en"): AnswerDecision {
  if (out.verdict === "not_in_data") return { kind: "unanswerable", reason: "not-in-data", charge: true };
  const text = out.answer.trim();
  if (!text) return { kind: "unanswerable", reason: "empty", charge: false };
  const missing = ungroundedNumbers(text, grounding);
  if (missing.length > 0) return { kind: "unanswerable", reason: "ungrounded", missing, charge: false };
  const advice = adviceMatches(text, locale);
  if (advice.length > 0) return { kind: "unanswerable", reason: "advice-pattern", missing: advice, charge: false };
  return { kind: out.verdict, text, charge: true };
}
