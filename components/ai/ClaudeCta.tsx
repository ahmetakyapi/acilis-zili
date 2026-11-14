import { auth } from "@/auth";
import { getDictionary } from "@/lib/i18n";
import { hasAnalysisAccess } from "@/lib/ai-analysis-access";
import { listSymbolReports, type ReportSummary } from "@/lib/ai-analysis-reports";
import { FOCUS_OF, type AnalysisFocus } from "@/lib/ai-analysis-core";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { ButtonLink, Panel, PanelHeader } from "@/components/ui/primitives";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { initialsOf } from "@/lib/avatars";
import { getHolidays } from "@/lib/data";
import { editionClock, isTechnicalSymbol, nextEdition } from "@/lib/technical";
import styles from "./Claude.module.css";

const odakOf = (focus: AnalysisFocus) => (focus === "technical" ? "teknik" : "secim");
/* Bağlantılar `rel="nofollow"`: /claude/* kişisel, `noindex` bir ekran
   (next.config.ts → NOINDEX_PATHS) ve her hisse × odak × sekme ayrı adres
   — taranmaya çağırmak tarama bütçesini dizine hiç girmeyecek sayfalara
   harcıyordu (22 Ekim, Search Console). */
const claudeHref = (symbol: string, focus: AnalysisFocus, tab: "rapor" | "yeni") =>
  `/claude/${encodeURIComponent(symbol)}?odak=${odakOf(focus)}&sekme=${tab}`;

/** Okuyanın hakkı ve bu hissenin raporları — panel ile küçük eylem aynı iki sorguyu paylaşır (ikisi de `cache`li). */
async function claudeState(symbol: string) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const [reports, canGenerate] = await Promise.all([
    listSymbolReports(symbol, viewerId).catch(() => [] as ReportSummary[]),
    viewerId ? hasAnalysisAccess(viewerId).catch(() => false) : Promise.resolve(false),
  ]);
  const latestOf = (focus: AnalysisFocus) => reports.find(r => FOCUS_OF[r.horizon] === focus) ?? null;
  return { canGenerate, signedIn: viewerId !== null, latestOf };
}

/** Yayın notu: saat ("15:45 TR") satır sonunda bölünmez ve kalın (390'da "15:45" / "TR" diye bölünüyordu). */
function EditionText({ text, time }: { text: string; time: string }) {
  const [before, after = ""] = text.split("{time}");
  return <span>{before}<b className="whitespace-nowrap font-semibold text-strong">{time}</b>{after}</span>;
}

/** Teknik odakta ve yazılı teknik analizi olan hissede sıradaki yayın: Claude'dan önce onu beklemek mümkün. */
export async function editionNote(symbol: string, locale: "tr" | "en") {
  if (!isTechnicalSymbol(symbol)) return null;
  const next = nextEdition(new Date(), await getHolidays().catch(() => []));
  return next ? editionClock(next.at, locale) : null;
}

/**
 * Şirket Analizi paneli (araç Claude). YER, 11 Ekim'de iki kez değişti:
 * önce sayfanın en üstündeydi ("okumadan ikinci görüş"), sonra okumanın
 * sonuna indi; telefonda 7.000. piksele düştü (teknik sayfada 10.641'in
 * 6.876'sı, ölçüldü) ve sahibi "çok aşağıda, üstte bir yerde olmalı" dedi.
 * Artık sayfanın KAPAĞININ hemen altında: önce sitenin kendi özeti
 * (görüş, plan ya da kural kontrolü), hemen ardından Claude — üstte ama
 * okumanın önünde değil.
 *
 * Panel misafire de basılır; misafir "Claude ile Analiz Et"e basınca
 * Claude sayfası girişi ister. Hakkı olmayan oturumlu okuyucuya rapor
 * yoksa panel çizilmez.
 *
 * Teknik odakta, sitenin yazılı teknik analizi olan hissede panel
 * sıradaki yayını söyler (günde üç kez, `nextEdition`): okuyucu yeni bir
 * Claude raporu istemek yerine onu bekleyebilir (sahibinin isteği).
 *
 * Veri ve yetki burada, çizim `ClaudeCtaView`de: görünüm sahte veriyle
 * önizlenebilir (olcum skill'i). Yetki, kota ve kilit mantığına bu dosya
 * dokunmaz; band yalnız "rapor var mı, okur isteyebilir mi" bilir. Üretimi
 * süren rapor ve dolan kota Claude sayfasının kendi ekranındadır
 * (`ClaudeWorkbench`); band onlar için sorgu yapmaz.
 */
export async function ClaudeCta({ symbol, locale, focus }: { symbol: string; locale: "tr" | "en"; focus: AnalysisFocus | "both" }) {
  const { canGenerate, signedIn, latestOf } = await claudeState(symbol);
  const focuses: AnalysisFocus[] = focus === "both" ? ["technical", "selection"] : [focus];
  // Misafire de: düğme Claude sayfasına, o sayfa girişi ister. Hakkı olmayan oturumlu okuyucuya boş vitrin yok.
  const canAsk = canGenerate || !signedIn;
  if (!canAsk && focuses.every(f => !latestOf(f))) return null;
  const edition = focuses.includes("technical") ? await editionNote(symbol, locale) : null;
  return <ClaudeCtaView symbol={symbol} locale={locale} focus={focus} canAsk={canAsk} edition={edition}
    reports={focuses.flatMap(f => { const latest = latestOf(f); return latest ? [{ focus: f, latest }] : []; })} />;
}

/**
 * BANDIN ÇİZİMİ — sade hâli (14 Kasım 2026, ikinci tur).
 *
 * ÖNCE: her odak çukur zeminli bir kart satırıydı ve HER satırda iki buton
 * vardı ("Raporu Aç" + "Yeni Analiz Oluştur"); iki odaklı şirket sayfasında
 * dört buton, ikisi aynı işi yapan birincil buton. Rapor yoksa iki ayrı
 * "Bu odakta henüz rapor yok." bandı ve iki "Claude ile Analiz Et"
 * diziliyordu. Karar 20 piksel / 800 ağırlıkta, haftalar önceki raporun
 * tarihi hemen altında 13 pikseldi: bandın en büyük puntosu eski bir görüşe
 * gidiyordu (Veri Dürüstlüğü 2).
 *
 * ŞİMDİ:
 * - Raporu olan odak başına TEK düz satır (kutu değil, kıl çizgi): puan
 *   halkası · görüş hapı (`VerdictPill`, sitenin her yerindeki AL/TUT/SAT)
 *   · künye tonunda odak, tarih ve oluşturan · "Raporu Aç". Satırda tek
 *   bağlantı var (karar ayrıca bağlantı değil).
 * - "Yeni Analiz Oluştur" panel başlığının sağında TEK buton. Odak seçimi
 *   butonun açtığı akışta duruyor: Claude sayfasının "Yeni Analiz" sekmesi
 *   odağı kendisi sorar (`app/(app)/claude/[symbol]/page.tsx` → "ODAK
 *   SEÇENEKLERİ", `?odak=`); band sayfanın odağını (iki odaklıda teknik)
 *   ön seçili gönderir. Raporu olmayan odak için ayrı satır basılmaz.
 * - Rapor hiç yoksa tek cümle + tek buton; alttaki açıklama cümlesi o
 *   durumda yinelenmez (cümlenin kendisi o).
 * - Halka 48 → 40, karar 20/800 → hap (12/700), tarih 13 → 12 piksel.
 *
 * Ölçüm modül CSS'inde (`Claude.module.css` → "Claude paneli").
 */
export function ClaudeCtaView({ symbol, locale, focus, reports, canAsk, edition }: {
  symbol: string; locale: "tr" | "en"; focus: AnalysisFocus | "both";
  /** Raporu olan odaklar, basılacak sırayla. */
  reports: { focus: AnalysisFocus; latest: ReportSummary }[];
  canAsk: boolean;
  edition: string | null;
}) {
  const t = getDictionary(locale).aiAnalysis;
  const date = (iso: string) => new Date(iso).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
  const askFocus: AnalysisFocus = focus === "both" ? "technical" : focus;
  const empty = reports.length === 0;

  return <Panel className={styles.ctaPanel}>
    <PanelHeader
      title={t.cta.title}
      meta={<span className={styles.ctaTool}>{t.cta.tool}</span>}
      action={canAsk && !empty
        ? <ButtonLink href={claudeHref(symbol, askFocus, "yeni")} rel="nofollow" variant="primary" size="sm">{t.cta.newAnalysis}</ButtonLink>
        : undefined}
    />
    {empty ? <div className={styles.ctaEmpty}>
      <p>{focus === "both" ? t.cta.companyHint : t.cta.hint}</p>
      <ButtonLink href={claudeHref(symbol, askFocus, "yeni")} rel="nofollow" variant="primary" size="sm">{t.cta.create}</ButtonLink>
    </div> : <ul className={styles.ctaRows}>
      {reports.map(({ focus: f, latest }) => <li key={f} className={styles.ctaRow}>
        {latest.score !== null
          ? <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={40} />
          : <span className={styles.ctaRingEmpty} aria-hidden />}
        <div className={styles.ctaLine}>
          <span className={styles.ctaHead}>
            {latest.verdict === "insufficient"
              ? <strong className={styles.ctaPlain}>{t.verdicts.insufficient}</strong>
              : <VerdictPill verdict={latest.verdict} label={t.verdicts[latest.verdict]} size="sm" />}
            <b>{f === "technical" ? t.focus.technical : t.focus.selection}</b>
          </span>
          <span className={styles.ctaStamp}>
            <span className="numeral">{date(latest.generatedAt)} · TR</span>
            {latest.author && <span className={styles.ctaAuthor}>
              <AvatarTile icon={latest.author.icon} color={latest.author.color} initials={initialsOf(latest.author.name, locale)} className={styles.ctaAvatar} />
              <span className="sr-only">{t.claude.timeline.author}: </span>{latest.author.name}
            </span>}
          </span>
        </div>
        <ButtonLink href={claudeHref(symbol, f, "rapor")} rel="nofollow" variant="ghost" size="sm">{t.cta.open}</ButtonLink>
      </li>)}
    </ul>}
    {(edition || !empty) && <div className={styles.ctaNotes}>
      {edition && <p className={styles.ctaEdition}>
        <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        <EditionText text={t.cta.editions} time={edition} />
      </p>}
      {!empty && <p className={styles.ctaHint}>{t.cta.hint}</p>}
    </div>}
  </Panel>;
}

/**
 * Kartın içindeki Claude düğmesi: şirket sayfasındaki teknik analiz kartı ve
 * teknik fotoğraf paneli. GÖRÜNÜR BİR DÜĞME (11 Ekim, sahibinin itirazı:
 * görüş satırındaki tonlu hap, dar kartta "Claude" ya da yalnız ikon,
 * "düğme olduğu anlaşılmıyor"). Düz mavi zemin, tam ad, sonda ok.
 *
 * `block`: kartın dibinde tam genişlik ve HER ZAMAN basılır — misafire de
 * (Claude sayfası giriş ister). Kartın boyu böylece okuyana göre değişmiyor
 * ve yedeği tek ölçüyle tutuluyor (stock.module.css → .technicalSkeleton).
 * Satır içi kullanımda hak ve rapor yoksa hiç basılmaz.
 */
export async function ClaudeAction({ symbol, locale, focus, className, block = false, label }: {
  symbol: string; locale: "tr" | "en"; focus: AnalysisFocus; className?: string; block?: boolean;
  /** Yeni analiz düğmesinin adı ("Bu Şirketi Analiz Et"); verilmezse "Claude ile Analiz Et". */
  label?: string;
}) {
  const { canGenerate, latestOf } = await claudeState(symbol);
  const latest = latestOf(focus);
  if (!block && !canGenerate && !latest) return null;
  const t = getDictionary(locale).aiAnalysis;
  const openReport = !canGenerate && !!latest;
  return <Link href={claudeHref(symbol, focus, openReport ? "rapor" : "yeni")} rel="nofollow"
    className={[styles.ctaAction, block && styles.ctaActionBlock, className].filter(Boolean).join(" ")}>
    <svg className={styles.ctaSpark} viewBox="0 0 24 24" aria-hidden><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" /></svg>
    <span className={styles.ctaActionText}>{openReport ? t.cta.actionOpen : label ?? t.cta.create}</span>
    <svg className={styles.ctaArrow} viewBox="0 0 24 24" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" /></svg>
  </Link>;
}

/**
 * Şirket sayfasında, sitenin yazılı teknik analizi OLMAYAN hissede teknik
 * kartın yerine (11 Ekim, sahibinin isteği: "teknik analiz kartı yoksa
 * analiz kartı çıkmaz; bu şirketi analiz et gibi bir kart"). Aynı yer,
 * aynı ağırlık: profil kartının altı. Varsa son Claude raporunun özeti,
 * yoksa ne yapacağını söyleyen tek cümle; dipte tam genişlik düğme.
 *
 * Her okuyucuya basılır (misafire de; Claude sayfası giriş ister) ki kartın
 * boyu sabit kalsın ve yedeği tek ölçüyle tutulsun (.claudeCardSkeleton).
 */
export async function ClaudeCompanyCard({ symbol, locale }: { symbol: string; locale: "tr" | "en" }) {
  const { latestOf } = await claudeState(symbol);
  const t = getDictionary(locale).aiAnalysis;
  const latest = latestOf("technical") ?? latestOf("selection");
  const date = (iso: string) => new Date(iso).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
  return <section className={styles.companyCard} data-verdict={latest?.verdict}>
    <div className={styles.companyHead}>
      {/* `text-read`: büyük başlığın üst im kaydırması (globals.css) bu kartta gerekmiyor. */}
      <h2 className="text-read font-bold">{t.cta.title}</h2>
      <span className={styles.companyTool}>{t.cta.tool}</span>
    </div>
    {latest ? <div className={styles.companyLatest}>
      {latest.score !== null
        ? <ScoreRing score={latest.score} verdict={latest.verdict === "insufficient" ? "hold" : latest.verdict} size={40} />
        : <span className={styles.ctaRing} aria-hidden />}
      <span className={styles.ctaBody}>
        <span className={styles.companyVerdict}>{t.verdicts[latest.verdict]}</span>
        <span className={styles.ctaMeta}>{FOCUS_OF[latest.horizon] === "technical" ? t.focus.technical : t.focus.selection} · {date(latest.generatedAt)} · TR</span>
      </span>
    </div> : <p className={styles.companyHint}>{t.cta.companyHint}</p>}
    <ClaudeAction symbol={symbol} locale={locale} focus={latest ? FOCUS_OF[latest.horizon] : "technical"} block label={t.cta.analyzeCompany} />
  </section>;
}
