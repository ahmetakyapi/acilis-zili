import { Bell } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { cn } from "@/lib/utils";

/**
 * Başlıktaki zil — /bildirimler'e giden bağlantı ve okunmamış sayısı.
 *
 * Açılır panel DEĞİL bağlantı: liste telefonda tam ekran okunuyor ve
 * hesap menüsünün yanına ikinci bir açılır katman, iki katmanın üst üste
 * binmesini yönetmek demekti. Sayı 9'u geçince "9+"; renk etkileşim mavisi
 * (yön değil, CLAUDE.md renk kuralı). Ekran okuyucuya sayı cümleyle söylenir.
 */
export function NotificationBell({
  unread,
  label,
  unreadLabel,
}: {
  unread: number;
  label: string;
  /** "{n} okunmamış bildirim" */
  unreadLabel: string;
}) {
  const aria = unread > 0 ? `${label} · ${unreadLabel.replace("{n}", String(unread))}` : label;
  return (
    <Link
      href="/bildirimler"
      prefetch={false}
      aria-label={aria}
      title={aria}
      className={cn(
        "tap-44 relative inline-flex size-9 items-center justify-center rounded-full transition-colors",
        unread > 0 ? "text-primary-ink hover:bg-primary-wash" : "text-muted hover:bg-surface-elevated hover:text-strong",
      )}
    >
      <Bell size={19} weight={unread > 0 ? "fill" : "duotone"} aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-[18px] text-on-primary ring-2 ring-(--page-bg)"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
