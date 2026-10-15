import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { redirect } from "next/navigation";
import {
  BellRinging,
  CalendarCheck,
  CheckCircle,
  Percent,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { markInboxReadAction } from "@/app/actions/inbox";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MarkInboxRead } from "@/components/notifications/MarkInboxRead";
import { Button, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { getInbox, type NotificationKind } from "@/lib/notifications";
import { pageMetadata } from "@/lib/page-meta";
import { getUserSubscriptions } from "@/lib/push";
import { displayZone, formatInZone } from "@/lib/session-clock";
import { cn } from "@/lib/utils";

/* Kişisel ekran — dizine girmez (künye + NOINDEX_PATHS). */
export const generateMetadata = pageMetadata({
  path: "/bildirimler",
  robots: { index: false, follow: false },
  tr: { title: "Bildirimler", description: "Alarmların, bilanço hatırlatmaların ve yazılarınla ilgili gelişmeler." },
  en: { title: "Notifications", description: "Your alerts, earnings reminders and post updates." },
});

/**
 * Bildirim merkezi — gerekçe lib/schema.ts → notifications. Satır türüne
 * göre ikon; renk yalnız "geri gönderildi"de uyarı (down), kalanı nötr —
 * bildirim bir yön değil (CLAUDE.md renk kuralı).
 */
const ICON: Record<NotificationKind, typeof BellRinging> = {
  alert: BellRinging,
  percent: Percent,
  earnings: CalendarCheck,
  post_approved: CheckCircle,
  post_rejected: WarningCircle,
};

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/bildirimler");

  const { locale, t } = await getI18n();
  const L = t.inbox;
  const [inbox, push] = await Promise.all([getInbox(session.user.id), getUserSubscriptions(session.user.id)]);
  const unread = inbox.items.filter((item) => !item.read).length;
  const zone = displayZone(locale);
  const dayFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: zone,
    day: "numeric",
    month: "short",
  });

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <MarkInboxRead unread={unread} />
      <PageHeader
        title={L.title}
        subtitle={L.subtitle}
        action={
          unread > 0 ? (
            <form action={markInboxReadAction}>
              <Button type="submit" variant="ghost">
                {L.markAll}
              </Button>
            </form>
          ) : undefined
        }
      />

      {!inbox.available ? (
        <EmptyState title={L.title} hint={L.unavailable} />
      ) : inbox.items.length === 0 ? (
        <EmptyState scene="heroSleep" title={L.emptyTitle} hint={L.emptyHint} />
      ) : (
        <Panel>
          <PanelHeader title={L.title} meta={unread > 0 ? L.bellUnread.replace("{n}", String(unread)) : undefined} />
          <ul className="divide-y divide-line-soft">
            {inbox.items.map((item) => {
              const Icon = ICON[item.kind] ?? BellRinging;
              return (
                <li key={item.id}>
                  <Link
                    href={item.url}
                    className={cn(
                      "flex items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-primary-tint sm:px-5",
                      !item.read && "bg-primary-tint/60",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-9 shrink-0 place-items-center rounded-[11px] border",
                        item.kind === "post_rejected"
                          ? "border-down/30 bg-down/10 text-down"
                          : "border-primary-faint bg-primary-tint text-primary-ink",
                      )}
                    >
                      <Icon size={18} weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-base font-semibold text-strong">{item.title}</span>
                        {!item.read && (
                          <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold leading-[18px] text-on-primary">
                            {L.newBadge}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-small leading-relaxed text-body [overflow-wrap:anywhere]">
                        {item.body}
                      </span>
                      <span className="mt-1 block text-tiny tabular-nums text-muted">
                        {L.kinds[item.kind]} · {dayFormat.format(item.createdAt)} {formatInZone(item.createdAt, zone)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* Push kapalıysa yolu panelin içinde, hairline üstünde söyle. */}
          {push.available && push.subscriptions.length === 0 && (
            <p className="border-t border-line-soft px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
              {L.pushHint}{" "}
              <Link href="/ayarlar#bildirimler" className="font-semibold text-primary hover:text-primary-hover">
                {L.pushLink}
              </Link>
            </p>
          )}
        </Panel>
      )}
    </MotionExperience>
  );
}
