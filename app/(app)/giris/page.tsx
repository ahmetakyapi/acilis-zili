import { signInAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { getI18n } from "@/lib/i18n";

export default async function SignInPage() {
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
        title={t.auth.signInTitle}
        subtitle={t.auth.signInSubtitle}
        action={signInAction}
        submitLabel={t.auth.submitSignIn}
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
            name: "password",
            label: t.auth.password,
            type: "password",
            placeholder: "••••••••",
            autoComplete: "current-password",
            errorKey: "password",
          },
        ]}
        altText={t.auth.noAccount}
        altHref="/kayit"
        altLinkLabel={t.nav.signUp}
      />
    </>
  );
}
