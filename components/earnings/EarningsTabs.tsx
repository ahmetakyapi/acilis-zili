import { TabBar, TabItem } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";

/**
 * Bilançolar ekranının sekme çubuğu.
 *
 * Üçü de aynı konunun görünümü, ayrı bölümler değil: takvim ne zaman
 * açıklanacağını, analizler açıklandıktan sonra ne anlama geldiğini, takip
 * sekmesi de ikisinin yalnızca favorilere daralmış hâlini gösterir.
 *
 * Çubuk paylaşılan bir layout'ta DEĞİL, üç sayfanın her biri kendi basıyor:
 * `/bilancolar/[symbol]/[period]` de aynı segmentin altında ve orada sekme
 * istemiyoruz — detay sayfası listenin bir görünümü değil, ayrı bir yer.
 */
export type EarningsTab = "calendar" | "analyses" | "watchlist";

export function EarningsTabs({
  active,
  t,
  className,
}: {
  active: EarningsTab;
  t: Dictionary;
  className?: string;
}) {
  const tabs: { key: EarningsTab; href: string; label: string }[] = [
    { key: "calendar", href: "/bilancolar", label: t.earnings.tabCalendar },
    {
      key: "analyses",
      href: "/bilancolar/analizler",
      label: t.earnings.tabAnalyses,
    },
    { key: "watchlist", href: "/bilancolar/takip", label: t.earnings.tabWatchlist },
  ];

  /* Çubuğun erişilebilirlik etiketi BÖLÜMÜN adı. "Bilanço Takvimi" idi ve
     üç sekmede de aynı etiket duyuruluyordu — Analizler sekmesindeyken ekran
     okuyucu "Bilanço Takvimi, sekme listesi" diyordu. */
  return (
    <TabBar label={t.analysis.title} className={className}>
      {tabs.map((tab) => (
        <TabItem
          key={tab.key}
          href={tab.href}
          active={tab.key === active}
          underlineId="earnings-tabs"
        >
          {tab.label}
        </TabItem>
      ))}
    </TabBar>
  );
}
