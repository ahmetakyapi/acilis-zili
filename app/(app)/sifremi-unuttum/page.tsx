import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { requestPasswordResetAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { emailConfigured } from "@/lib/email";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/* ŞİFREMİ UNUTTUM (9 Ekim) — gerekçe lib/schema.ts → passwordResets.
   E-posta servisi bağlı değilse sayfa YOK (404): gönderilemeyen bir
   bağlantıyı isteyen form tıklamayı yutardı. Oturum açıksa ayarlara. */
export const generateMetadata = pageMetadata({
  path: "/sifremi-unuttum",
  robots: { index: false, follow: false },
  tr: { title: "Şifreni Sıfırla", description: "Şifreni yenilemek için e-postana bir bağlantı iste." },
  en: { title: "Reset Your Password", description: "Request a link to set a new password." },
});

export default async function ForgotPasswordPage() {
  if (!emailConfigured()) notFound();
  const session = await auth();
  if (session?.user) redirect("/ayarlar");
  const { t } = await getI18n();
  const R = t.passwordReset;

  return (
    <AuthForm
      showPasswordLabel={t.auth.showPassword}
      hidePasswordLabel={t.auth.hidePassword}
      pitchTitle={t.auth.pitchTitle}
      pitchBody={t.auth.pitchBody}
      features={[t.auth.featureLists, t.auth.featureAlerts, t.auth.featureBrief, t.auth.featureFree]}
      privacyNote={t.auth.privacyNote}
      title={R.requestTitle}
      subtitle={R.requestSubtitle}
      action={requestPasswordResetAction}
      submitLabel={R.requestSubmit}
      submittingLabel={t.common.submitting}
      fields={[
        {
          name: "email",
          label: R.email,
          type: "email",
          placeholder: R.emailPlaceholder,
          autoComplete: "email",
          errorKey: "email",
        },
      ]}
      altText={R.remembered}
      altHref="/giris"
      altLinkLabel={R.backToSignIn}
    />
  );
}
