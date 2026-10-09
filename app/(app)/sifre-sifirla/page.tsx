import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { resetPasswordAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { PageHeader, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { emailConfigured } from "@/lib/email";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { resetTokenOwner } from "@/lib/password-reset";

/* YENİ ŞİFRE (9 Ekim) — e-postadaki bağlantı buraya iner
   (`?anahtar=`). Anahtar sayfa açılırken de denetleniyor: süresi dolmuş
   bir bağlantıda okuyucu önce iki şifre yazıp SONRA "geçersiz" duymasın.
   Eylem yine kendisi denetliyor (sayfa ile gönderim arasında süre
   dolabilir). Bağlantı adreste duruyor; sayfa dizine kapalı ve
   `Referrer-Policy` dış sitelere adresi taşımıyor. */
export const generateMetadata = pageMetadata({
  path: "/sifre-sifirla",
  robots: { index: false, follow: false },
  tr: { title: "Yeni Şifre Belirle", description: "Hesabın için yeni bir şifre belirle." },
  en: { title: "Set a New Password", description: "Set a new password for your account." },
});

export default async function ResetPasswordPage(props: PageProps<"/sifre-sifirla">) {
  const [{ t }, search] = await Promise.all([getI18n(), props.searchParams]);
  const R = t.passwordReset;
  const token = typeof search.anahtar === "string" ? search.anahtar : "";
  const valid = token ? (await resetTokenOwner(token)) !== null : false;

  if (!valid) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <PageHeader title={R.resetTitle} />
        <Panel>
          <PanelHeader title={R.invalidTitle} />
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
            <p className="text-base leading-relaxed text-body">{R.invalid}</p>
            <div className="flex flex-wrap gap-2">
              {emailConfigured() && (
                <Link href="/sifremi-unuttum" className={buttonClass({ className: "w-fit" })}>
                  {R.requestAgain}
                </Link>
              )}
              <Link href="/giris" className={buttonClass({ variant: "ghost", className: "w-fit" })}>
                {R.backToSignIn}
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <AuthForm
      showPasswordLabel={t.auth.showPassword}
      hidePasswordLabel={t.auth.hidePassword}
      pitchTitle={t.auth.pitchTitle}
      pitchBody={t.auth.pitchBody}
      features={[t.auth.featureLists, t.auth.featureAlerts, t.auth.featureBrief, t.auth.featureFree]}
      privacyNote={t.auth.privacyNote}
      title={R.resetTitle}
      subtitle={R.resetSubtitle}
      action={resetPasswordAction}
      submitLabel={R.resetSubmit}
      submittingLabel={t.common.submitting}
      hidden={{ anahtar: token }}
      fields={[
        {
          name: "password",
          label: R.newPassword,
          type: "password",
          placeholder: "••••••••",
          autoComplete: "new-password",
          errorKey: "password",
        },
        {
          name: "passwordConfirm",
          label: R.confirmPassword,
          type: "password",
          placeholder: "••••••••",
          autoComplete: "new-password",
          errorKey: "passwordConfirm",
        },
      ]}
      altText={R.remembered}
      altHref="/giris"
      altLinkLabel={R.backToSignIn}
    />
  );
}
