import { TabBar, TabItem } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import styles from "@/components/motion/DirectoryExperience.module.css";

/**
 * Bilançolar ekranının sekme çubuğu.
 *
 * Üçü de aynı konunun görünümü, ayrı bölümler değil: takvim ne zaman
 * açıklanacağını, analizler açıklandıktan sonra ne anlama geldiğini, takip
 * sekmesi de ikisinin yalnızca favorilere daralmış hâlini gösterir.
 *
 * HAFTALIK DÖRDÜNCÜ SEKME (29 Eylül). `/bilancolar/hafta` bir dönem
 * bilinçli olarak sekme DEĞİLDİ: paylaşılacak bir görselin sayfasıydı ve
 * telefonda üç sekme satırı dolduruyordu. Sahibi haftayı ayrı bir sekmede
 * istedi ve sayfa artık bir görünüm: en büyükler ızgarası ve haftanın tam
 * takvimi. Takvim sekmesi BUGÜNDEN ileri kayan bir pencere, haftalık sekme
 * pazartesi–cuma sabit bir hafta (geçen günlerin gerçekleşenleriyle).
 * Telefonda 390'da dört sekme sığıyor, 360'ta çubuk kayıyor (`TabBar`);
 * ölçü `app/(app)/bilancolar/hafta/page.tsx` başında.
 *
 * Çubuk paylaşılan bir layout'ta DEĞİL, dört sayfanın her biri kendi basıyor:
 * `/bilancolar/[symbol]/[period]` de aynı segmentin altında ve orada sekme
 * istemiyoruz — detay sayfası listenin bir görünümü değil, ayrı bir yer.
 */
export type EarningsTab = "calendar" | "week" | "analyses" | "watchlist";

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
    /* Takvimin hemen yanında: ikisi de "ne zaman" sorusu, biri kayan
       pencere biri sabit hafta. */
    { key: "week", href: "/bilancolar/hafta", label: t.earningsWeek.tab },
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
    <TabBar label={t.analysis.title} className={`${styles.tabs} ${className ?? ""}`}>
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
