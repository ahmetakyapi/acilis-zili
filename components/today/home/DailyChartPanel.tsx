import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { ChartThumb } from "@/components/daily-chart/ChartThumb";
import styles from "@/components/daily-chart/DailyChart.module.css";
import { getLatestDailyChart } from "@/lib/daily-chart-data";
import { getChartLogos } from "@/lib/daily-chart-day";
import { checkChartBlock, dailyChartHref } from "@/lib/daily-chart";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";
import { sessionTitle } from "@/lib/session-age";

/**
 * Günün Grafiği — ana sayfanın yan kolonunda küçük giriş (24 Ekim).
 *
 * YAN KOLONDA, çünkü içerik okunacak bir metin değil bir ölçü: grafiğin
 * küçük hâli ve başlığı. Tam metin ve tam grafik kendi sayfasında. Kayıt
 * yoksa (tablo henüz yok ya da rutin yazmadı) panel HİÇ basılmıyor — boş
 * kutu yok, `FillColumn` kolonu kendisi dengeliyor (TechnicalPanel kalıbı).
 *
 * TARİH HER ZAMAN YAZILI: panel "bugün" demiyor, grafiğin anlattığı seansı
 * söylüyor (CLAUDE.md "Veri dürüstlüğü" — eski veri tarihsiz durmaz).
 * 28 Ekim'den beri tarihin önünde göreli gün künyesi ("Dünkü Seans",
 * gerekçe `SessionAgeTag.tsx`): tarih tek başına seans açıkken dünü
 * bugünden ayırmıyordu. 6 Kasım'da künye kalktı, göreli gün başlıkta
 * (gerekçe aşağıda, `DailyChartCard`).
 */
export async function DailyChartPanel({ locale, t, nowMs }: { locale: Locale; t: Dictionary; nowMs: number }) {
  const latest = await getLatestDailyChart(locale);
  if (!latest) return null;
  /* Hisse kalemlerinin logoları (31 Ekim, sahibinin isteği: "logolar
     olsun"); eşleme ve yedek düzeni `getChartLogos`ta. */
  const logos = await getChartLogos(latest.chartMd, latest.locale);
  return <DailyChartCard chart={latest} logos={logos} locale={locale} t={t} nowMs={nowMs} />;
}

/**
 * Panelin çizimi, verisiz (6 Kasım): ana sayfa yukarıdaki okumayla basar;
 * ayrı durması, kartın sahte kayıtla ölçülebilmesi için.
 *
 * BAŞLIK TEK HAT (6 Kasım). 28 Ekim'den beri başlığın yanında "Dünkü
 * Seans" künyesi, sonra tarih, sonra "Arşiv" duruyordu; 31 Ekim'den beri
 * başlığın kendisi de göreli günü söylüyor ("Dünün Grafiği",
 * `sessionTitle`) ve künye onu tekrarlıyordu: 420 piksellik kolonda
 * "Dünün Grafiği · Dünkü Seans · 5 Kasım Perşembe · Arşiv" dört öğe, hap
 * zemini başlıkla yarışıyordu. Göreli gün artık yalnız başlıkta; tarih
 * künyede sessiz (veri dürüstlüğü: tarih yine her zaman yazılı).
 * `SessionAgeTag` Son Seansın Silueti'nde kalıyor — orada başlık günü
 * söylemiyor.
 *
 * Grafik başlığının altında bloğun etiketi ("Nasdaq 100'ün En Çok
 * Düşenleri, Günlük Değişim %"): satırların neyi ölçtüğünü söyleyen tek
 * yer (sayfada `caption`).
 */
export function DailyChartCard({
  chart,
  logos,
  locale,
  t,
  nowMs,
}: {
  chart: { chartDate: string; locale: string; title: string; chartMd: string };
  logos: Record<string, string | null>;
  locale: Locale;
  t: Dictionary;
  nowMs: number;
}) {
  const href = dailyChartHref(chart.chartDate);
  const check = checkChartBlock(chart.chartMd, chart.locale);
  const label = check.ok && check.block.label ? check.block.label : null;
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title={sessionTitle(chart.chartDate, locale, t.dailyChart.homeTitles, nowMs)}
        meta={formatEtDateLong(chart.chartDate, locale)}
        action={<PanelLink href="/gunun-grafigi">{t.dailyChart.homeAll}</PanelLink>}
      />
      <div className={styles.homeBody} lang={chart.locale}>
        <div className={styles.homeHead}>
          <Link href={href} className={styles.homeTitle}>
            {chart.title}
          </Link>
          {label && <p className={styles.homeLabel}>{label}</p>}
        </div>
        <ChartThumb
          chartMd={chart.chartMd}
          locale={chart.locale}
          rows={5}
          logos={logos}
          labels={t.dailyChart}
          href={href}
          label={label ?? chart.title}
        />
      </div>
    </Panel>
  );
}
