"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { cn } from "@/lib/utils";

/**
 * Başlıktaki zil — /bildirimler'e giden bağlantı ve okunmamış sayısı.
 *
 * Açılır panel DEĞİL bağlantı: liste telefonda tam ekran okunuyor ve
 * hesap menüsünün yanına ikinci bir açılır katman, iki katmanın üst üste
 * binmesini yönetmek demekti. Sayı 9'u geçince "9+"; renk etkileşim mavisi
 * (yön değil, CLAUDE.md renk kuralı). Ekran okuyucuya sayı cümleyle söylenir.
 *
 * SAYI CANLI (16 Ekim). İlk değer düzenden geliyor ama App Router düzeni
 * gezinmede yeniden çizmiyor; seans içinde tetiklenen alarm sayfa yeniden
 * yüklenene kadar zilde görünmüyordu. Sekme görünür olunca, sayfa değişince
 * ve görünürken beş dakikada bir `/api/bildirimler/sayi` sorulur. Düzen
 * yeniden çizilirse (okundu sayma `revalidatePath`) sunucunun değeri esas.
 */
const POLL_MS = 5 * 60_000;

export function NotificationBell({
  unread,
  label,
  unreadLabel,
  unreadOneLabel,
}: {
  unread: number;
  label: string;
  /** "{n} okunmamış bildirim" */
  unreadLabel: string;
  /** Tekil — İngilizcede "1 unread notification". */
  unreadOneLabel: string;
}) {
  const [count, setCount] = useState(unread);
  /* Düzen yeniden çizilip yeni bir değer verirse (okundu sayma) o esas —
     önceki prop'la karşılaştırıp çizim sırasında eşitlenir (efekt değil). */
  const [given, setGiven] = useState(unread);
  if (unread !== given) {
    setGiven(unread);
    setCount(unread);
  }
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/bildirimler/sayi", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { unread?: unknown };
        if (alive && typeof data.unread === "number") setCount(data.unread);
      } catch {
        /* ağ yoksa son bilinen sayı kalır */
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  const spoken = (count === 1 ? unreadOneLabel : unreadLabel).replace("{n}", String(count));
  const aria = count > 0 ? `${label} · ${spoken}` : label;
  return (
    <Link
      href="/bildirimler"
      prefetch={false}
      aria-label={aria}
      title={aria}
      className={cn(
        "tap-44 relative inline-flex size-9 items-center justify-center rounded-full transition-colors",
        count > 0 ? "text-primary-ink hover:bg-primary-wash" : "text-muted hover:bg-surface-elevated hover:text-strong",
      )}
    >
      <Bell size={19} weight={count > 0 ? "fill" : "duotone"} aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-[18px] text-on-primary ring-2 ring-(--page-bg)"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
