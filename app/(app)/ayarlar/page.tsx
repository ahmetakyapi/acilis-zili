import { redirect } from "next/navigation";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/giris?devam=/ayarlar");

  const { t } = await getI18n();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="self-start text-[26px] font-bold tracking-[-0.03em] text-strong sm:text-[34px]">
        {t.settings.title}
      </h1>

      <Panel>
        <PanelHeader title={t.settings.account} />
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t.auth.username}</dt>
              <dd className="font-medium text-strong">{session.user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t.auth.email}</dt>
              <dd className="text-body">{session.user.email}</dd>
            </div>
          </dl>

          <form action={signOutAction} className="border-t border-line-soft pt-3">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) px-3 text-sm font-medium text-down transition-colors hover:bg-down-wash"
            >
              <SignOut weight="duotone" size={16} />
              {t.nav.signOut}
            </button>
          </form>
        </div>
      </Panel>

      <p className="text-xs text-muted">{t.data.delayedNote}</p>
    </div>
  );
}
