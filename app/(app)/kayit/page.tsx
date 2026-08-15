import { signUpAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { getI18n } from "@/lib/i18n";

import { pageMetadata } from "@/lib/page-meta";

/* KİŞİSEL/OTURUM SAYFASI — DİZİNE GİRMEZ. robots.txt'te `Disallow` vardı ama
   o yalnızca taramayı engelliyor, indekslemeyi değil; üstelik engellenen bir
   sayfanın `noindex` etiketi hiç okunamıyordu. Engel kaldırıldı, etiket
   buraya kondu. */
export const generateMetadata = pageMetadata({
  path: "/kayit",
  robots: { index: false, follow: false },
  tr: { title: "Hesap Oluştur", description: "Kendi takip listeni kurmak için hesap aç." },
  en: { title: "Create Account", description: "Create an account to build your own watchlist." },
});

export default async function SignUpPage(props: PageProps<"/kayit">) {
  const [{ t }, search] = await Promise.all([getI18n(), props.searchParams]);
  const continueTo =
    typeof search.devam === "string" ? search.devam : undefined;

  return (
    <>
      <AuthForm
        continueTo={continueTo}
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
        submittingLabel={t.common.submitting}
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
