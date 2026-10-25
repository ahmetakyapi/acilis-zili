import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { DataStamp, EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import styles from "@/components/probabilities/Probabilities.module.css";
import { ElectionPanel, FedPanel, NotesPanel, OtherPanel, PathPanel, dayMonth } from "@/components/probabilities/ProbabilityPanels";
import { etOf, shareText } from "@/components/probabilities/ProbabilityParts";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getNextFomc } from "@/lib/macro-data";
import { pageMetadata } from "@/lib/page-meta";
import { composeLead, leadFacts, type FedMove, type ProbabilitySnapshot } from "@/lib/probabilities";
import { getProbabilityBoard } from "@/lib/probability-data";
import { probabilitiesEn, probabilitiesTr } from "@/lib/i18n/dictionaries/probabilities";

export const generateMetadata = pageMetadata({
  path: "/olasiliklar",
  tr: { title: probabilitiesTr.title, description: probabilitiesTr.metaDescription },
  en: { title: probabilitiesEn.title, description: probabilitiesEn.metaDescription },
});

/**
 * Olasılıklar (25 Ekim, sahibinin isteği: "ABD ara seçimleri tahmini,
 * faiz artırma ihtimali; o tarz olayları da oradan takip edebileceğimiz bir
 * alan"). Piyasaların Fed kararına, 2026 ara seçimine ve büyük makro
 * olaylara biçtiği olasılıklar — kaynak ve saatiyle.
 *
 * EKRAN SIRASI (CLAUDE.md): başlık → veriden tek cümle (+ olasılık ≠
 * kesinlik) ve damga → Fed ile seçim yan yana (büyük sayı, yığın çubuk,
 * 30 günlük çizgi) → beklenen faiz patikası → diğer olaylar → künyeler
 * paneli (ne olduğu, kaynak, bahis bağlantısı yok kuralı) → damga →
 * rehber ipucu.
 *
 * VERİ: `lib/probability-data.ts` (günlük tablo; yoksa altı saatlik
 * önbellekli canlı okuma). Hedef aralık ve FOMC günü makro kartıyla aynı
 * kaynaktan (`getNextFomc`: takvim + FRED) — aynı sayı iki yerde aynı
 * kaynaktan (veri dürüstlüğü 3).
 *
 * BAHİS DEĞİL: sayfada kontrat ya da platform bağlantısı yok; gerekçe
 * lib/probabilities.ts başında.
 */
export default async function ProbabilitiesPage() {
  const { locale, t } = await getI18n();
  const p = t.probabilities;
  const [board, fomc] = await Promise.all([getProbabilityBoard(), getNextFomc().catch(() => null)]);
  const snapshot = board?.snapshot ?? null;
  const lead = snapshot ? leadOf(snapshot, locale, t) : null;
  const stamp = snapshot ? (
    <DataStamp labels={t.data} source={p.sourceLabel} at={snapshot.takenAt} locale={locale} note={p.daily} />
  ) : null;

  return (
    <MotionExperience className={`${polish.page} ${styles.scope}`}>
      <ScrollProgress />
      <PageHeader
        title={p.title}
        subtitle={p.subtitle}
        share={snapshot ? <PageShare path="/olasiliklar" title={p.title} locale={locale} t={t} compactOnMobile align="right" /> : undefined}
      />

      {!snapshot ? (
        <Panel>
          <EmptyState title={p.noData} hint={p.noDataHint} scene="chart" />
        </Panel>
      ) : (
        <>
          <div className={styles.lead}>
            {lead && <p className={styles.leadText}>{lead}</p>}
            <p className={styles.leadNote}>{p.certainty}</p>
            {stamp}
          </div>

          <div className={styles.duo}>
            <FedPanel snapshot={snapshot} fomc={fomc} locale={locale} t={t} />
            <ElectionPanel snapshot={snapshot} locale={locale} t={t} />
          </div>
          <PathPanel snapshot={snapshot} fomc={fomc} locale={locale} t={t} />
          <OtherPanel snapshot={snapshot} locale={locale} t={t} />
          <NotesPanel t={t} />
          {stamp}
        </>
      )}

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["sahin-guvercin", "faiz-tahvil", "enflasyon"]} />
    </MotionExperience>
  );
}

/** Tepedeki tek cümle — şablon + veri (`composeLead`, testli). */
function leadOf(snapshot: ProbabilitySnapshot, locale: Locale, t: Dictionary): string | null {
  const p = t.probabilities;
  const facts = leadFacts(snapshot);
  const sentence = composeLead(
    facts,
    {
      fed: p.leadFed,
      congressSame: p.leadCongressSame,
      congressSplit: p.leadCongressSplit,
      congressOne: p.leadCongressOne,
      congressResult: p.leadCongressResult,
      join: p.leadJoin,
      joinResults: p.leadJoinResults,
    },
    {
      percent: (value) => shareText(value, locale),
      date: (iso) => dayMonth(etOf(iso).date, locale),
      move: (move: FedMove) => p.leadMove[move],
      party: (key) => p.leadParty[key as "dem" | "rep"] ?? key,
      partyName: (key) => p.parties[key as "dem" | "rep"] ?? key,
      chamber: (kind) => p.leadChamber[kind],
    },
  );
  /* "Piyasa fiyatlarına göre" yalnız olasılık varken: sonuçlanmış meclis
     bir fiyat değil, kesinleşmiş sonuç. */
  if (!sentence) return null;
  return facts.fed || facts.house || facts.senate ? `${p.leadPrefix}${sentence}` : sentence;
}
