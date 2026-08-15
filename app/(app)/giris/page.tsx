import { signInAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { getI18n } from "@/lib/i18n";

import { pageMetadata } from "@/lib/page-meta";

/* KİŞİSEL/OTURUM SAYFASI — DİZİNE GİRMEZ. robots.txt'te `Disallow` vardı ama
   o yalnızca taramayı engelliyor, indekslemeyi değil; üstelik engellenen bir
   sayfanın `noindex` etiketi hiç okunamıyordu. Engel kaldırıldı, etiket
   buraya kondu. */
export const generateMetadata = pageMetadata({
  path: "/giris",
  robots: { index: false, follow: false },
  tr: { title: "Giriş Yap", description: "Takip listelerine dönmek için giriş yap." },
  en: { title: "Sign In", description: "Sign in to get back to your watchlists." },
});

export default async function SignInPage(props: PageProps<"/giris">) {
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
        title={t.auth.signInTitle}
        subtitle={t.auth.signInSubtitle}
        action={signInAction}
        submitLabel={t.auth.submitSignIn}
        submittingLabel={t.common.submitting}
        fields={[
          {
            name: "username",
            label: t.auth.identifier,
            type: "text",
            placeholder: t.auth.identifierPlaceholder,
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
