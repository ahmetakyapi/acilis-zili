import { signUpAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { getI18n } from "@/lib/i18n";

export default async function SignUpPage() {
  const { t } = await getI18n();

  return (
    <>
      <AuthForm
        pitchTitle={t.auth.pitchTitle}
        pitchBody={t.auth.pitchBody}
        features={[
          t.auth.featureLists,
          t.auth.featureAlerts,
          t.auth.featureBrief,
          t.auth.featureFree,
        ]}
        privacyNote={t.auth.privacyNote}
        title={t.auth.signUpTitle}
        subtitle={t.auth.signUpSubtitle}
        action={signUpAction}
        submitLabel={t.auth.submitSignUp}
        fields={[
          {
            name: "username",
            label: t.auth.username,
            type: "text",
            placeholder: t.auth.usernamePlaceholder,
            autoComplete: "username",
            errorKey: "username",
          },
          {
            name: "email",
            label: t.auth.email,
            type: "email",
            placeholder: t.auth.emailPlaceholder,
            autoComplete: "email",
            errorKey: "email",
          },
          {
            name: "password",
            label: t.auth.password,
            type: "password",
            placeholder: t.auth.passwordPlaceholder,
            autoComplete: "new-password",
            errorKey: "password",
          },
          {
            name: "passwordConfirm",
            label: t.auth.passwordConfirm,
            type: "password",
            placeholder: "••••••••",
            autoComplete: "new-password",
            errorKey: "passwordConfirm",
          },
        ]}
        altText={t.auth.hasAccount}
        altHref="/giris"
        altLinkLabel={t.nav.signIn}
      />
    </>
  );
}
