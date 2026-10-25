import { PageShare } from "@/components/article/PageShare";
import { GuideHint } from "@/components/article/GuideHint";
import { BrokerNeutrality, BrokerNotes, BrokerSources } from "@/components/brokers/BrokerNotes";
import { BrokerCardsPanel } from "@/components/brokers/BrokerCardsPanel";
import { BrokerLinePanel } from "@/components/brokers/BrokerLinePanel";
import { BrokerTable } from "@/components/brokers/BrokerTable";
import { RevealFoldAnchor } from "@/components/brokers/RevealFoldAnchor";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { DataStamp, PageHeader, Panel } from "@/components/ui/primitives";
import styles from "@/components/brokers/Brokers.module.css";
import { BROKERS, BROKERS_CHECKED } from "@/content/brokers";
import { formatIsoDate } from "@/lib/fx";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

export const generateMetadata = pageMetadata({
  path: "/araci-kurumlar",
  tr: {
    title: "Aracı Kurum Karşılaştırması: ABD Hissesi Ücretleri",
    description:
      "Midas, İş Yatırım, Garanti BBVA Yatırım, Yapı Kredi Yatırım, QNB Invest, Gedik, İnfo Yatırım ve Interactive Brokers: ABD hissesi komisyonu, asgari ücret, saklama, kesirli hisse, veri ve lisans. Her hücre kurumun resmî tarifesinden, kaynağıyla.",
  },
  en: {
    title: "Broker Comparison: US Stock Fees From Türkiye",
    description:
      "US stock commission, minimum fee, custody, fractional shares, data and licence at eight brokers serving Turkish residents. Every cell from the broker's official fee schedule, with its source.",
  },
});

/**
 * /araci-kurumlar — ARACI KURUM KARŞILAŞTIRMASI (24 Ekim).
 *
 * Neden var: Türkçe kaynakların çoğu aracı kurumların kendisi ya da
 * kurumlardan pay alan sayfalar. Bu sayfa hiçbir kurumu önermiyor; tek
 * işi tarifeleri aynı tabloya, kaynağıyla koymak. Veri ve üç kural
 * (uydurma yok, her hücrenin kaynağı ve günü, çelişki gösterilir)
 * `content/brokers.ts` başında.
 *
 * Ekran düzeni (CLAUDE.md):
 *   kompakt başlık → alımına göre komisyon (ana görsel; tepe cümlesi
 *   panonun başında, künye ve katlı varsayımlar dibinde) → kurum kartları
 *   ve yan yana karşılaştırma (BrokerCards) → "Ayrıntılar" paneli: üç
 *   katlı satır (Tüm Tarife Ayrıntıları, Tabloda Olmayanlar, Kaynaklar) +
 *   katlanmayan tarafsızlık künyesi → DataStamp → GuideHint.
 *
 * KOMPAKT TUR (25 Ekim). Sahibi: "Burası da çok yer kaplıyor; daha az yer
 * kaplatalım, detayları görmek isteyen açarak baksın." Açıklama, varsayım
 * ve kaynak blokları varsayılan katlı (`BrokerFold`, tek kalıp); kapak
 * küçüldü; ölçümler `BrokerLinePanel` başında.
 *
 * Sunucuda, ağsız: veri depoda. İstemci JS'i `ScrollEdges`, kaydırıcı,
 * cümle ve kartlar; üçü aynı tutarı paylaşıyor (`broker-view-state.ts`).
 * Hesap sunucuda, istemci yalnız seçiyor. Sayfa adresi sunucuda okumuyor
 * (sıra ve seçim istemcide adresten): statik kalıyor.
 */
export default async function BrokersPage() {
  const { locale, t } = await getI18n();
  const L = t.brokers;

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <RevealFoldAnchor />
      <PageHeader
        className={styles.masthead}
        title={L.title}
        subtitle={L.subtitle}
        share={<PageShare path="/araci-kurumlar" title={L.title} locale={locale} t={t} />}
      />

      <BrokerLinePanel brokers={BROKERS} locale={locale} t={t} />

      <BrokerCardsPanel brokers={BROKERS} locale={locale} t={t} />

      {/* Kaynak katmanı: üç katlı satır tek panelde, aralarında saç teli. */}
      <Panel id="ayrintilar" className="scroll-mt-28">
        <div className={styles.stack}>
          <BrokerTable brokers={BROKERS} locale={locale} t={t} />
          <BrokerNotes t={t} locale={locale} />
          <BrokerSources brokers={BROKERS} locale={locale} t={t} />
        </div>
        <div className="border-t border-line-soft">
          <BrokerNeutrality t={t} />
        </div>
      </Panel>

      <DataStamp
        source={L.stampSource}
        note={L.stampChecked.replace("{date}", formatIsoDate(BROKERS_CHECKED, locale, "long"))}
        locale={locale}
        labels={t.data}
      />

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["araci-kurum-secimi", "bankadan-araci-kuruma-gecis", "irlanda-etf-mi-abd-etf-mi"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
