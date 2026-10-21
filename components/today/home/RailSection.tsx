import { auth } from "@/auth";
import { DayFlowLoader } from "@/components/today/DayFlow";
import { loadDayFlow, loadSharedDayFlow } from "@/lib/day-flow-data";
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
  return <DayFlowLoader key={locale} initial={initial} locale={locale} labels={t.dayFlow} railLabels={t.dayRail} heading={heading} otherHeadings={otherHeadings} />;
}
