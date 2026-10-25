import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BacktestPanel,
  ExposurePanel,
  GaugePanel,
  HistoryPanel,
  IndexPanel,
  PositionsDetail,
  RegimePanel,
} from "@/components/risk/DeskPanels";
import { DeskNote } from "@/components/risk/DeskNote";
import { PositionCards, SummaryCards, type PositionRule } from "@/components/risk/PortfolioCards";
import { RulesPanel } from "@/components/risk/RulesPanel";
import styles from "@/components/risk/RiskDesk.module.css";
import { DataStamp, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getMarketDesk } from "@/lib/risk/data";
import { getExposure } from "@/lib/risk/exposure";
import { day, fill } from "@/lib/risk/format";
import { evaluateRule } from "@/lib/risk/rules";
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
 * DÜZEN — KART DÜZENİ (25 Ekim; sahibinin isteği: "kendi portföyünü görüp
 * daha iyi anlayabildiği bir sistem, yan yana kartlar, yatayda bu kadar
 * büyük detaya gerek yok"). Başlık bandı (ad, seans, künye tek satırda;
 * önceki büyük `PageHeader` kutusu 1440'ta 155 piksel tutuyordu) → rejim
 * kartı + dört portföy özeti kartı → pozisyon kartları (ekranın merkezi)
 * → ana göstergeler (altı küçük kart) → rejim geçmişi → geriye dönük test
 * (sinyal kartları) → endeksler → kurallar ve yorum → künyeler → veri
 * damgası. Uzun açıklamalar ve tablolar silinmedi, katlamalara indi.
 * Ölçümler commit gövdesinde ve raporda (1440×900 ilk ekran).
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

  /* Pozisyon kartındaki kural rozeti: yalnız POZİSYON koşulu taşıyan ve
     şu an o pozisyonda doğru olan kurallar (kural panelindeki "Şu An
     Tetikli" ile aynı değerlendirme). Yalnız piyasa koşullu kural bir
     pozisyona ait değildir, kartta basılmaz. */
  const rulesBySymbol = new Map<string, PositionRule[]>();
  if (rules.ok && exp) {
    for (const rule of rules.rules) {
      if (!rule.enabled) continue;
      const outcome = evaluateRule(rule, desk.market, exp.facts);
      for (const symbol of outcome.symbols) {
        const list = rulesBySymbol.get(symbol) ?? [];
        list.push({ label: rule.label, tone: rule.tone });
        rulesBySymbol.set(symbol, list);
      }
    }
  }

  return (
    <div className={styles.desk}>
      <header className={styles.head}>
        <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em]">{T.title}</h1>
        <p className={styles.headMeta}>
          <strong>{fill(T.sessionLine, { date: day(desk.session, locale) })}</strong>
          <span className={styles.advice}>{T.disclaimer}</span>
        </p>
        <p className={styles.headSub}>{desk.barsStale ? T.barsStale : T.subtitle}</p>
      </header>

      <div className={styles.top}>
        <RegimePanel desk={desk} t={T} locale={locale} />
        {exp && exp.positions.length > 0 ? (
          <SummaryCards exposure={exp} t={T} locale={locale} />
        ) : (
          <ExposurePanel result={exposure} t={T} locale={locale} />
        )}
      </div>

      {exp && exp.positions.length > 0 && (
        <PositionCards exposure={exp} rulesBySymbol={rulesBySymbol} t={T} locale={locale}>
          <PositionsDetail exposure={exp} regime={desk.today?.regime ?? null} t={T} locale={locale} />
        </PositionCards>
      )}
      <GaugePanel desk={desk} t={T} locale={locale} />
      <HistoryPanel desk={desk} t={T} locale={locale} />
      <BacktestPanel desk={desk} t={T} locale={locale} />
      <IndexPanel desk={desk} t={T} locale={locale} />

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
