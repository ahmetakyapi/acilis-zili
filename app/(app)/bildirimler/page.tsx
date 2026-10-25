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
import { InboxItemLink, InboxNewBadge } from "@/components/notifications/InboxLatch";
import { MarkInboxRead } from "@/components/notifications/MarkInboxRead";
import { Button, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { getInbox, type NotificationKind } from "@/lib/notifications";
import { pageMetadata } from "@/lib/page-meta";
import { getUserSubscriptions } from "@/lib/push";
import { displayZone, formatInZone } from "@/lib/session-clock";
import { countByKind, groupByDay } from "@/lib/feed-visuals";
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
const KIND_ORDER: readonly NotificationKind[] = ["alert", "percent", "earnings", "post_approved", "post_rejected"];

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
  const F = t.feedVisuals.inbox;
  /* GÜN GÜN (25 Ekim, görsel tur): liste okurun dilimindeki gün başlıklarına
     bölünür, satırda yalnız saat kalır; panelin tepesinde tek cümle ve türe
     göre sayım şeridi (ikon + adet) — "neyim var" ilk bakışta. */
  const days = groupByDay(inbox.items, zone);
  const kinds = countByKind(inbox.items, KIND_ORDER);
  const dayFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dayName = (day: string, offset: number) =>
    offset === 0 ? F.today : offset === -1 ? F.yesterday : dayFormat.format(new Date(`${day}T12:00:00Z`));

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
          <PanelHeader title={L.title} meta={unread > 0 ? L.unreadMeta.replace("{n}", String(unread)) : undefined} />
          <p className="-mt-1.5 px-4 pb-3 text-read leading-relaxed text-body sm:px-5">
            {(unread > 0 ? F.summary : F.summaryRead)
              .replace("{n}", String(inbox.items.length))
              .replace("{unread}", String(unread))}
          </p>
          {/* Tür şeridi: ikon + ad + adet; satırdaki ikonla aynı karo. */}
          <ul aria-label={F.kindsLabel} className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
            {kinds.map(({ kind, count }) => {
              const Icon = ICON[kind] ?? BellRinging;
              return (
                <li
                  key={kind}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-surface-sunken py-1 pl-1 pr-3 text-small"
                >
                  <span aria-hidden className="grid size-7 place-items-center rounded-full bg-surface-solid text-body">
                    <Icon size={15} weight="duotone" />
                  </span>
                  <span className="font-semibold text-body">{L.kinds[kind]}</span>
                  <span className="numeral font-bold text-strong">{count}</span>
                </li>
              );
            })}
          </ul>
          {days.map((group) => (
            <section key={group.day} aria-labelledby={`gun-${group.day}`} className="border-t border-line-soft">
              <h3
                id={`gun-${group.day}`}
                data-ink="plain"
                className="flex items-baseline justify-between gap-3 bg-surface-sunken px-4 py-2 text-small font-bold text-strong sm:px-5"
              >
                {dayName(group.day, group.dayOffset)}
                <span className="numeral text-tiny font-medium text-muted">{group.items.length}</span>
              </h3>
              <ul className="divide-y divide-line-soft">
                {group.items.map((item) => {
                  const Icon = ICON[item.kind] ?? BellRinging;
                  return (
                    <li key={item.id}>
                      <InboxItemLink
                        href={item.url}
                        isNew={!item.read}
                        className="flex items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-primary-tint sm:px-5"
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
                            <InboxNewBadge isNew={!item.read} label={L.newBadge} />
                          </span>
                          <span className="mt-0.5 block text-small leading-relaxed text-body [overflow-wrap:anywhere]">
                            {item.body}
                          </span>
                          <span className="mt-1 block text-tiny text-muted">
                            {L.kinds[item.kind]} · {formatInZone(item.createdAt, zone)}
                          </span>
                        </span>
                      </InboxItemLink>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
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
