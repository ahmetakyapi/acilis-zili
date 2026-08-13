import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, SignOut } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { DeleteAccount } from "@/components/auth/DeleteAccount";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/* Künye sabit Türkçeydi; sayfa zaten oturuma bağlı olduğu için dizine de
   girmemeli. */
export const generateMetadata = pageMetadata({
  path: "/ayarlar",
  robots: { index: false, follow: false },
  tr: {
    title: "Ayarlar",
    description: "Hesap, dil ve tema tercihlerin.",
  },
  en: {
    title: "Settings",
    description: "Your account, language and theme preferences.",
  },
});

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/giris?devam=/ayarlar");

  const { t } = await getI18n();
  const username = session.user.name ?? "";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="display-ink self-start text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">
        {t.settings.title}
      </h1>

      <Panel>
        <PanelHeader title={t.settings.account} />
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t.auth.username}</dt>
              <dd className="truncate font-medium text-strong">{username}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t.auth.email}</dt>
              <dd className="truncate text-body">{session.user.email}</dd>
            </div>
          </dl>

          <form action={signOutAction} className="border-t border-line-soft pt-3">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) px-3 text-sm font-medium text-body transition-colors hover:bg-surface-elevated hover:text-strong"
            >
              <SignOut weight="duotone" size={16} />
              {t.nav.signOut}
            </button>
          </form>

          <DeleteAccount
            username={username}
            labels={{
              title: t.settings.deleteTitle,
              hint: t.settings.deleteHint,
              open: t.settings.deleteOpen,
              confirmLabel: t.settings.deleteConfirmLabel,
              confirmHint: t.settings.deleteConfirmHint,
              passwordLabel: t.auth.password,
              submit: t.settings.deleteSubmit,
              cancel: t.common.cancel,
              warning: t.settings.deleteWarning,
            }}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={t.settings.privacyTitle} />
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <p className="text-[13px] leading-relaxed text-body">
            {t.settings.privacyHint}
          </p>
          <Link
            href="/kvkk"
            className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            <ShieldCheck weight="duotone" size={16} />
            {t.settings.privacyLink}
          </Link>
        </div>
      </Panel>

      <p className="text-xs text-muted">{t.data.delayedNote}</p>
    </div>
  );
}
