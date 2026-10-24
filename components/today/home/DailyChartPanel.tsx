import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { ChartThumb } from "@/components/daily-chart/ChartThumb";
import styles from "@/components/daily-chart/DailyChart.module.css";
import { getLatestDailyChart } from "@/lib/daily-chart-data";
import { dailyChartHref } from "@/lib/daily-chart";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";

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
 */
export async function DailyChartPanel({ locale, t }: { locale: Locale; t: Dictionary }) {
  const latest = await getLatestDailyChart(locale);
  if (!latest) return null;
  const href = dailyChartHref(latest.chartDate);
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title={t.dailyChart.title}
        meta={formatEtDateLong(latest.chartDate, locale)}
        action={<PanelLink href="/gunun-grafigi">{t.dailyChart.homeAll}</PanelLink>}
      />
      <div className={styles.homeBody} lang={latest.locale}>
        <Link href={href} className={styles.homeTitle}>
          {latest.title}
        </Link>
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          <ChartThumb chartMd={latest.chartMd} locale={latest.locale} rows={5} />
        </Link>
      </div>
    </Panel>
  );
}
