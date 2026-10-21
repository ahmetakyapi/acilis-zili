"use client";

import { useEffect, useRef, useState } from "react";
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
 * yeniden çizilirse (okundu sayma `refresh()`) sunucunun değeri esas.
 *
 * YALNIZ GÖRÜNEN ÖRNEK SORAR (20 Ekim). `AppShell` hesap menüsünü — zil
 * dahil — iki başlığa birden basıyor (masaüstü ve mobil; biri CSS ile
 * gizli), yani iki örnek bağlı ve her gezinmede aynı sayıyı İKİ kez
 * soruyordu: dakikada 15 sayfa görüntülemede kişi başı sınır (30/60 sn)
 * doluyor, uç 429 dönüyor ve zil sessizce donuyordu. Gizli başlıktaki
 * örnek (`display: none` → kutusu yok) sormuyor. İlk bağlanışta da
 * sorulmuyor: düzenin verdiği `unread` o an zaten taze.
 *
 * GÖRÜNÜR OLAN ÖRNEK HEMEN SORAR (20 Ekim). Sayı örnek başına durum; gizli
 * örnek sormayınca kendi sayısı da eskiyordu — iPad'i dikeyden yataya
 * çevirmek ya da pencereyi 1024'ün üstüne çekmek öbür başlığı açıyor, zil
 * bir sonraki gezinmeye ya da beş dakikalık tura kadar eski sayıyı
 * gösteriyordu. `ResizeObserver` kutunun 0'dan açıldığı anı yakalayıp bir
 * kez sorduruyor; kırılma noktası (`lg`) koda yazılmıyor, başlıklar hangi
 * ölçüde yer değiştirirse değiştirsin çalışır. Görünürken görünür kalan
 * örnekte (ilk gözlem bildirimi dahil) sormaz — yalnız gizliden görünüre.
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
  const anchor = useRef<HTMLAnchorElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      if (!anchor.current?.getClientRects().length) return;
      try {
        const response = await fetch("/api/bildirimler/sayi", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { unread?: unknown };
        if (alive && typeof data.unread === "number") setCount(data.unread);
      } catch {
        /* ağ yoksa son bilinen sayı kalır */
      }
    };
    if (mounted.current) void refresh();
    mounted.current = true;
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    /* Gizliden görünüre geçiş: yalnız kutu yokken var olduğunda sorar. */
    const hasBox = () => Boolean(anchor.current?.getClientRects().length);
    let shown = hasBox();
    const observer = new ResizeObserver(() => {
      const now = hasBox();
      if (now && !shown) void refresh();
      shown = now;
    });
    if (anchor.current) observer.observe(anchor.current);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      observer.disconnect();
    };
  }, [pathname]);

  const spoken = (count === 1 ? unreadOneLabel : unreadLabel).replace("{n}", String(count));
  const aria = count > 0 ? `${label} · ${spoken}` : label;
  return (
    <Link
      ref={anchor}
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
