import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { unsubscribeAction } from "@/app/actions/email-prefs";
import { EmailTokenForm } from "@/components/notifications/EmailTokenForm";
import { PageHeader, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { isUnsubscribeScope, unsubscribeTokenValid } from "@/lib/email-notify";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/* ABONELİKTEN ÇIK (16 Ekim) — bildirim postalarının altındaki bağlantı.
   Girişsiz: anahtar satır başına sabit ve tahmin edilemez
   (lib/schema.ts → emailPrefs.unsubToken). Posta istemcisinin kendi
   "Abonelikten Çık" düğmesi ayrı yoldan, tek tıkla:
   app/api/e-posta/ayril/route.ts. */
export const generateMetadata = pageMetadata({
  path: "/e-posta/ayril",
  robots: { index: false, follow: false },
  tr: { title: "Abonelikten Çık", description: "Bildirim postalarını kapat." },
  en: { title: "Unsubscribe", description: "Turn off notification emails." },
});

export default async function UnsubscribePage(props: PageProps<"/e-posta/ayril">) {
  const [{ t }, search] = await Promise.all([getI18n(), props.searchParams]);
  const P = t.emailNotify.unsubscribePage;
  const token = typeof search.anahtar === "string" ? search.anahtar : "";
  const scope = isUnsubscribeScope(search.kapsam) ? search.kapsam : "all";
  const valid = token ? await unsubscribeTokenValid(token) : false;
  const lead = scope === "alerts" ? P.leadAlerts : scope === "weekly" ? P.leadWeekly : P.leadAll;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageHeader title={P.title} />
      <Panel>
        <PanelHeader title={valid ? P.title : P.invalidTitle} />
        <div className="px-4 py-4 sm:px-5">
          {valid ? (
            <EmailTokenForm
              action={unsubscribeAction}
              hidden={{ anahtar: token, kapsam: scope }}
              labels={{ lead, button: P.button, doneTitle: P.doneTitle, done: P.done, invalid: P.invalid, toSettings: P.toSettings }}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-base leading-relaxed text-body">{P.invalid}</p>
              <Link href="/ayarlar#e-posta" className={buttonClass({ variant: "ghost", className: "w-fit" })}>
                {P.toSettings}
              </Link>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
