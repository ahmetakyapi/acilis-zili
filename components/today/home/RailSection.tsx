import { auth } from "@/auth";
import { DayFlowLoader } from "@/components/today/DayFlow";
import { loadDayFlow } from "@/lib/day-flow-data";
import { type Dictionary, type Locale } from "@/lib/i18n";

/**
 * Şeridi besleyen iki kaynak: ekonomik takvim ve bugünün bilançoları.
 * Mockup 4a'da ikisi de aynı eksende duruyor — gün gerçekten böyle akıyor,
 * "08:30 istihdam" ile "16:30 AAPL" aynı zaman çizgisinin olayları.
 */
export async function RailSection({ t, locale, heading }: { t: Dictionary; locale: Locale; heading: React.ReactNode }) {
  const session = await auth();
  const initial = await loadDayFlow(locale, session?.user?.id).catch(() => null);
  return <DayFlowLoader key={locale} initial={initial} locale={locale} labels={t.dayFlow} railLabels={t.dayRail} heading={heading} />;
}
