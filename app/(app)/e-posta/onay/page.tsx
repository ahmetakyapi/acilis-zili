import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { confirmEmailAction } from "@/app/actions/email-prefs";
import { EmailTokenForm } from "@/components/notifications/EmailTokenForm";
import { PageHeader, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { confirmTokenValid } from "@/lib/email-notify";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/* E-POSTA ONAYI (16 Ekim) — onay postasındaki bağlantı buraya iner
   (`?anahtar=`). Gerekçe lib/email-notify.ts. Anahtar açılışta denetlenir,
   onay düğmeyle verilir (components/notifications/EmailTokenForm.tsx).
   Sayfa dizine kapalı; anahtar adreste ve `Referrer-Policy` onu dış
   sitelere taşımıyor. */
export const generateMetadata = pageMetadata({
  path: "/e-posta/onay",
  robots: { index: false, follow: false },
  tr: { title: "E-posta Onayı", description: "Bildirim postaları için adresini onayla." },
  en: { title: "Email Confirmation", description: "Confirm your address for notification emails." },
});

export default async function EmailConfirmPage(props: PageProps<"/e-posta/onay">) {
  const [{ t }, search] = await Promise.all([getI18n(), props.searchParams]);
  const P = t.emailNotify.confirmPage;
  const token = typeof search.anahtar === "string" ? search.anahtar : "";
  const valid = token ? await confirmTokenValid(token) : false;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <PageHeader title={P.title} />
      <Panel>
        <PanelHeader title={valid ? P.title : P.invalidTitle} />
        <div className="px-4 py-4 sm:px-5">
          {valid ? (
            <EmailTokenForm
              action={confirmEmailAction}
              hidden={{ anahtar: token }}
              labels={{ lead: P.lead, button: P.button, doneTitle: P.doneTitle, done: P.done, invalid: P.invalid, toSettings: P.toSettings }}
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
