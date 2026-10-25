import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { DataStamp, EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import styles from "@/components/probabilities/Probabilities.module.css";
import { OddsStrip, type StripTile } from "@/components/probabilities/OddsStrip";
import {
  CARD_ANCHORS,
  CpiPanel,
  ElectionPanel,
  FedPanel,
  NotesPanel,
  PathPanel,
  RecessionPanel,
  dayMonth,
} from "@/components/probabilities/ProbabilityPanels";
import { etOf, shareText } from "@/components/probabilities/ProbabilityParts";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getNextFomc } from "@/lib/macro-data";
import { pageMetadata } from "@/lib/page-meta";
import { composeLead, headlineOdds, leadFacts, type FedMove, type ProbabilitySnapshot } from "@/lib/probabilities";
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
 * EKRAN SIRASI (CLAUDE.md): başlık → tepe şeridi (dört kadran; veriden
 * cümle ekran okuyucuya) + olasılık ≠ kesinlik ve damga → ölçü ızgarası:
 * Fed, ara seçim, resesyon (yığın çubuk + 30 günlük çizgi) → beklenen faiz
 * patikası → aylık enflasyon → künyeler paneli (dört kart: fiyat =
 * olasılık, kaynak, bahis değil, renkler; tam metin katlı) → damga →
 * rehber ipucu.
 *
 * GÖRSEL TUR (25 Ekim, sahibinin sözü: "üstteki yazı ve alttaki kartlar
 * daha görsel olmalı ve kompakt hissettirmeli"). Hedef: 1440×900 ve
 * 1280×800'de başlık + şerit + üç kartın tamamı kaydırmasız (önce seçim
 * kartının dibi 1307'deydi, görünür alan 863'te bitiyor; ölçüm commit
 * mesajında). Üç satırlık kalın cümle şeride dönüştü.
 *
 * İKİNCİ GÖRSEL TUR (25 Ekim, sahibinin sözü: "bu kısımları da daha görsel
 * ve daha iyi seviyeye getirebiliriz"; künye için "alan çok büyük").
 * Kadranlar büyüdü, sayı halkanın içinde, 24 saat rozeti; Fed lejantı tek
 * satır çip; resesyon kartında Evet/Hayır çubuğunun yerine 1980'den bu
 * yana NBER resesyonlarının şeridi; faiz patikası 346 → 225 piksel (bant +
 * adım rozetleri); "Bu Sayılar Nedir" 427 → 200 piksel (dört kart, tam
 * metin katlamada). İlk ekran hedefi korundu: 1440×900'de kartların dibi
 * 771, 1280×800'de 721 (TR) / 728 (EN).
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
  const tiles = snapshot ? stripTiles(snapshot, locale, t) : [];
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
          <div className={styles.top}>
            <OddsStrip tiles={tiles} summary={lead} locale={locale} t={t} />
            <div className={styles.topNote}>
              <p>{p.certainty}</p>
              {stamp}
            </div>
          </div>

          <div className={styles.cards} data-probe="cards">
            <FedPanel snapshot={snapshot} fomc={fomc} locale={locale} t={t} />
            <ElectionPanel snapshot={snapshot} locale={locale} t={t} />
            <RecessionPanel snapshot={snapshot} locale={locale} t={t} />
          </div>
          <PathPanel snapshot={snapshot} fomc={fomc} locale={locale} t={t} />
          <CpiPanel snapshot={snapshot} locale={locale} t={t} />
          <NotesPanel t={t} locale={locale} />
          {stamp}
        </>
      )}

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["sahin-guvercin", "faiz-tahvil", "enflasyon"]} />
    </MotionExperience>
  );
}

/** Şeridin kadranları: veri `headlineOdds`ten (testli), burada yalnız ad ve çapa. */
function stripTiles(snapshot: ProbabilitySnapshot, locale: Locale, t: Dictionary): StripTile[] {
  const p = t.probabilities;
  return headlineOdds(snapshot).map((tile) => {
    const label =
      tile.kind === "fed"
        ? tile.strikeAt
          ? p.stripFed.replace("{date}", dayMonth(etOf(tile.strikeAt).date, locale))
          : p.fedTitle
        : tile.kind === "recession"
          ? p.stripRecession
          : p[tile.kind];
    const anchor = tile.kind === "fed" ? CARD_ANCHORS.fed : tile.kind === "recession" ? CARD_ANCHORS.recession : CARD_ANCHORS.election;
    return { ...tile, label, href: `#${anchor}` };
  });
}

/** Şeridin ekran okuyucu özeti — şablon + veri (`composeLead`, testli). */
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
