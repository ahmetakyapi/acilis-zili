import Link from "next/link";
import { cn } from "@/lib/utils";
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

  return (
    <nav
      aria-label={t.earnings.title}
      className={cn(
        // Dar ekranda üç sekme sığmayabilir; kırılmak yerine kayar.
        "-mx-4 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0",
        className,
      )}
    >
      <ul className="flex min-w-max gap-0.5">
        {tabs.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  // -mb-px: alt çizgi çubuğun hairline'ının üstüne otursun,
                  // altına inip 1px kalınlık farkı yaratmasın.
                  "-mb-px inline-flex min-h-11 items-center border-b-2 px-3.5 text-[13.5px] transition-colors sm:px-[18px]",
                  current
                    ? "border-primary font-bold text-primary"
                    : "border-transparent font-medium text-body hover:text-strong",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
