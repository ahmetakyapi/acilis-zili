import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BacktestPanel,
  ExposurePanel,
  GaugePanel,
  HistoryPanel,
  IndexPanel,
  PositionsPanel,
  RegimePanel,
} from "@/components/risk/DeskPanels";
import { DeskNote } from "@/components/risk/DeskNote";
import { RulesPanel } from "@/components/risk/RulesPanel";
import styles from "@/components/risk/RiskDesk.module.css";
import { DataStamp, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getMarketDesk } from "@/lib/risk/data";
import { getExposure } from "@/lib/risk/exposure";
import { day, fill } from "@/lib/risk/format";
import { getRiskViewer, listAlerts, listRules } from "@/lib/risk/store";

/**
 * RİSK MASASI (25 Ekim) — kişiye özel ekran, sitenin kabuğunda.
 *
 * ERİŞİMİ OLMAYANA 404, başlık dahil. Oturumsuz okur da, erişimi olmayan
 * üye de aynı "sayfa yok" cevabını alır; giriş sayfasına yönlendirmek ya da
 * "yetkiniz yok" demek ekranın VAR OLDUĞUNU söylerdi (yönetim panelinin
 * gerekçesi, app/admin/layout.tsx). Üst bilgi de erişime bağlı: 404'ün
 * `<title>`ı "Risk Masası" deseydi varlık oradan sızardı. Dizine hiç
 * girmez, menüde yalnız erişimi olana görünür, site haritasında yok.
 *
 * SINIR: ekran ölçer ve koşul bildirir; hiçbir öğesi al, sat, ekle ya da
 * çıkar demez. Kural etiketleri kullanıcının yazdığı adlardır; pozisyonun
 * yanındaki AL/TUT/SAT sitenin herkese açık genel görüşüdür (künyeli).
 *
 * DÜZEN (CLAUDE.md "Ekran düzeni"): başlık → künye şeridi → ana görsel
 * (rejim, ana göstergeler, maruziyet özeti; 1440×900'de ilk ekranda) →
 * geçmiş ve ölçü tabloları → kurallar ve yorum → künyeler → veri damgası.
 */

const META = pageMetadata({
  path: "/risk",
  robots: { index: false, follow: false },
  tr: { title: "Risk Masası", description: "Kişisel risk masası." },
  en: { title: "Risk Desk", description: "Personal risk desk." },
});

export async function generateMetadata(): Promise<Metadata> {
  const viewer = await getRiskViewer();
  if (!viewer) return { robots: { index: false, follow: false } };
  return META();
}

export default async function RiskPage() {
  const viewer = await getRiskViewer();
  if (!viewer) notFound();
  const { t, locale: rawLocale } = await getI18n();
  const locale = rawLocale === "en" ? "en" : "tr";
  const T = t.riskDesk;
  const desk = await getMarketDesk();
  const [exposure, rules, alerts] = await Promise.all([
    getExposure(viewer.userId, desk),
    listRules(viewer.userId),
    listAlerts(viewer.userId),
  ]);
  const exp = exposure.ok ? exposure.exposure : null;

  return (
    <div className={styles.desk}>
      <PageHeader title={T.title} subtitle={T.subtitle} />
      <p className={styles.strip}>
        <strong>{fill(T.sessionLine, { date: day(desk.session, locale) })}</strong>
        <span className={styles.advice}>{T.disclaimer}</span>
        {desk.barsStale && <span>{T.barsStale}</span>}
      </p>

      <div className={styles.hero}>
        <RegimePanel desk={desk} t={T} locale={locale} />
        <div className={styles.side}>
          <GaugePanel desk={desk} t={T} locale={locale} />
          <ExposurePanel result={exposure} t={T} locale={locale} />
        </div>
      </div>

      <HistoryPanel desk={desk} t={T} locale={locale} />
      <IndexPanel desk={desk} t={T} locale={locale} />
      {exp && exp.positions.length > 0 && <PositionsPanel exposure={exp} regime={desk.today?.regime ?? null} t={T} locale={locale} />}
      <BacktestPanel desk={desk} t={T} locale={locale} />

      <div className={styles.pair}>
        <RulesPanel rules={rules} alerts={alerts} market={desk.market} positions={exp?.facts ?? []} t={T} locale={locale} />
        <Panel>
          <PanelHeader title={T.note.title} />
          <div className={styles.panelBody}>
            <p className={`${styles.ruleMeta} mb-3`}>{T.note.hint}</p>
            <DeskNote t={T.note} locale={locale} />
          </div>
        </Panel>
      </div>

      <Panel>
        <div className={styles.closing}>
          <p className={styles.disclaimerText}>{T.footer.disclaimer}</p>
          <p className={styles.foot}>{T.footer.sources}</p>
        </div>
      </Panel>
      <DataStamp labels={t.data} source="alpaca" at={desk.sources.barsAt} locale={locale} />
    </div>
  );
}
