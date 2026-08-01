import { signInAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { getI18n } from "@/lib/i18n";

export default async function SignInPage() {
  const { t } = await getI18n();

  return (
    <div className="py-6">
      <AuthForm
        pitch={{
          title: t.auth.pitchTitle,
          body: t.auth.pitchBody,
          features: [
            { label: t.auth.featureLists, value: t.auth.featureFree },
            { label: t.auth.featureAlerts, value: t.auth.featureFree },
            { label: t.auth.featureBrief, value: t.auth.featureFree },
          ],
          privacyNote: t.auth.privacyNote,
        }}
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
    </div>
  );
}
