import { auth } from "@/auth";
import { DayFlowLoader } from "@/components/today/DayFlow";
import { loadDayFlow, loadSharedDayFlow, loadSharedOtherDay } from "@/lib/day-flow-data";
import { type Dictionary, type Locale } from "@/lib/i18n";

/**
 * Şeridi besleyen iki kaynak: ekonomik takvim ve bugünün bilançoları.
 * Mockup 4a'da ikisi de aynı eksende duruyor — gün gerçekten böyle akıyor,
 * "08:30 istihdam" ile "16:30 AAPL" aynı zaman çizgisinin olayları.
 *
 * Misafir `/api/day-flow` ile aynı TÜRDEN 30 saniyelik notu okur (20 Ekim);
 * notun kendisi ayrı — sayfa ve uç ayrı Turbopack çalışma zamanında, her
 * biri locale başına 30 saniyede en çok bir kez yükler. Gerekçe
 * `loadSharedDayFlow`.
 */
export async function RailSection({ t, locale, heading, otherHeadings }: { t: Dictionary; locale: Locale; heading: React.ReactNode; otherHeadings?: { past: React.ReactNode; future: React.ReactNode } }) {
  const session = await auth();
  const userId = session?.user?.id;
  const initial = await (userId ? loadDayFlow(locale, userId) : loadSharedDayFlow(locale)).catch(() => null);
  /* BOŞ GÜNDE SIRADAKİ İŞLEM GÜNÜ (31 Ekim; gerekçe DayFlow → DayPreview).
     Yalnız bugün gerçekten boşken (eşiğin altında bilanço da yoksa) ve
     okların açtığı oturumsuz görüntünün aynısı — beş dakikalık ortak not,
     oturumlu okuyucuda takip işaretleri o günü açınca gelir. Hata önizlemeyi
     düşürür, sayfayı değil. */
  const preview =
    initial && initial.events.length === 0 && initial.hiddenEarnings === 0 && initial.nextDate
      ? await loadSharedOtherDay(locale, initial.nextDate).catch(() => null)
      : null;
  return <DayFlowLoader key={locale} initial={initial} preview={preview} locale={locale} labels={t.dayFlow} railLabels={t.dayRail} heading={heading} otherHeadings={otherHeadings} />;
}
