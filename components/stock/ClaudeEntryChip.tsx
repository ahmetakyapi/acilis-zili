import { ArrowDown, ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { hasAnalysisAccess } from "@/lib/ai-analysis-access";
import { FOCUS_OF, type AnalysisFocus } from "@/lib/ai-analysis-core";
import { listSymbolReports, type ReportSummary } from "@/lib/ai-analysis-reports";
import { getDictionary, type Locale } from "@/lib/i18n";
import { insightsConfigured } from "@/lib/stock-insights";
import { cn } from "@/lib/utils";
import styles from "./ClaudeEntryChip.module.css";

/**
 * KÜNYE ŞERİDİNDE CLAUDE (25 Ekim UX turu). Şirket sayfasında "Şirket
 * Analizi" paneli telefonda y=6.277'de, 1280'de 3.468'de; "Yeni Analiz
 * Oluştur" 32 piksellik bir düğme olarak 3.542'de duruyordu (denetim
 * ölçümü). Okur Claude'un bu hisse hakkında ne dediğini ya da yeni bir
 * analiz başlatabileceğini ancak sayfanın dibine inince öğreniyordu.
 *
 * Bu çip tek satırlık, İKİNCİL bir giriş: ekranın birincil eylemi yine
 * tam karttaki düğme (ClaudeCta), kart yerinde kalıyor. Çip ya son raporu
 * açar ("Claude Raporu · TUT · Aç") ya da yeni analize götürür ("Claude
 * ile Analiz"); ikisini birden basmaz.
 *
 * Kim neyi görür — ClaudeCta'nın kuralıyla BİREBİR (orada `claudeState`;
 * dışa açık olmadığı için aynı iki `cache`li sorgu burada da soruluyor,
 * istek içinde ek tur yok): rapor okumak herkese açık, yeni analiz hakkı
 * olana ve misafire (Claude sayfası giriş ister). Hakkı olmayan oturumlu
 * okura rapor yoksa çip hiç basılmaz — tam kartın "boş vitrin yok" kuralı.
 *
 * Bağlantılar `rel="nofollow"`: /claude/* kişisel ve `noindex` (gerekçe
 * ClaudeCta.tsx → `claudeHref`). Rapor bağlantısı raporun KİMLİĞİYLE
 * açılır (`rapor=`): Claude sayfası odağı rapordan çıkarıyor, çipin ayrıca
 * odak bilmesine gerek yok.
 */
/** Okuyanın hakkı ve hissenin raporları — iki sorgu da istek içinde `cache`li. */
async function entryState(symbol: string) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const [reports, canGenerate] = await Promise.all([
    listSymbolReports(symbol, viewerId).catch(() => [] as ReportSummary[]),
    viewerId ? hasAnalysisAccess(viewerId).catch(() => false) : Promise.resolve(false),
  ]);
  return { reports, canGenerate, signedIn: viewerId !== null };
}

/**
 * Önden başlat: çip, onu basan bileşenin (StockHeader) kendi beklemeleri
 * bittikten SONRA çizilir; sorgular o ana kalırsa başlığa bir Neon turu
 * eklenirdi. Başlık kotasyonu beklerken bunu çağırıyor, çip geldiğinde
 * `cache` aynı sözü döndürüyor.
 */
export function preloadClaudeEntry(symbol: string) {
  void entryState(symbol).catch(() => null);
}

export async function ClaudeEntryChip({
  symbol,
  locale,
  focus,
  className,
}: {
  symbol: string;
  locale: Locale;
  /** Verilirse yalnız o odağın raporu; verilmezse hangi odakta olursa en yenisi. */
  focus?: AnalysisFocus;
  className?: string;
}) {
  const { reports, canGenerate, signedIn } = await entryState(symbol);
  const latest = reports.find((report) => !focus || FOCUS_OF[report.horizon] === focus) ?? null;
  const canAsk = canGenerate || !signedIn;
  if (!latest && !canAsk) return null;

  const dict = getDictionary(locale);
  const t = dict.stockEntry;
  const base = `/claude/${encodeURIComponent(symbol)}`;

  if (latest) {
    const verdict = dict.aiAnalysis.verdicts[latest.verdict];
    return (
      <Link
        href={`${base}?sekme=rapor&rapor=${encodeURIComponent(latest.id)}`}
        rel="nofollow"
        prefetch={false}
        aria-label={t.claudeReportLabel.replace("{verdict}", verdict)}
        className={cn("tap-44", styles.chip, className)}
        data-verdict={latest.verdict}
      >
        <Sparkle className={styles.spark} size={14} weight="fill" aria-hidden />
        {/* Telefonda kısa ad: şeritte uzun ad tek başına satırı dolduruyor,
            yanındaki çipin kenar solması görünmüyordu (EN 239/250 piksel). */}
        <span className={cn(styles.label, styles.long)}>{t.claudeReport}</span>
        <span className={cn(styles.label, styles.short)}>{t.claudeShort}</span>
        <span aria-hidden className={styles.dot}>·</span>
        <b className={styles.verdict}>{verdict}</b>
        <span aria-hidden className={styles.dot}>·</span>
        <span className={styles.go}>{t.claudeOpen}</span>
        <ArrowRight className={styles.arrow} size={13} weight="bold" aria-hidden />
      </Link>
    );
  }

  const odak = focus === "selection" ? "secim" : "teknik";
  return (
    <Link
      href={`${base}?odak=${odak}&sekme=yeni`}
      rel="nofollow"
      prefetch={false}
      className={cn("tap-44", styles.chip, className)}
    >
      <Sparkle className={styles.spark} size={14} weight="fill" aria-hidden />
      <span className={styles.go}>{t.claudeCreate}</span>
      <ArrowRight className={styles.arrow} size={13} weight="bold" aria-hidden />
    </Link>
  );
}

/* Panelin kimliği components/stock/AskStock.tsx → `ANCHOR`. Oradan içe
   aktarılamıyor: `"use client"` modülün dışa aktardığı değer sunucuya
   istemci referansı olarak gelir (CLAUDE.md). İkisi birlikte değişir. */
const ASK_ANCHOR = "bu-hisseye-sor";

/**
 * "Bu Hisseye Sor" çapası (25 Ekim UX turu). Panel telefonda y=3.172'de,
 * 1280'de 1.854'te — okurun aklına soru künyeyi okurken geliyor. Çapa aynı
 * sayfada, panelin yerine iner; panel yalnız Claude anahtarı varken basılıyor
 * (`insightsConfigured`), çapa da öyle — boş yere inen bağlantı olmasın.
 */
export function AskStockChip({ locale, className }: { locale: Locale; className?: string }) {
  if (!insightsConfigured()) return null;
  const t = getDictionary(locale).stockEntry;
  return (
    <a href={`#${ASK_ANCHOR}`} className={cn("tap-44", styles.chip, styles.quiet, className)}>
      <span className={styles.go}>{t.ask}</span>
      <ArrowDown className={styles.arrow} size={13} weight="bold" aria-hidden />
    </a>
  );
}
