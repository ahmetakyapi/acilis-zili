import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import NextLink from "next/link";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { redirect } from "next/navigation";
import {
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
} from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { DeleteAccount } from "@/components/auth/DeleteAccount";
import { AvatarPicker } from "@/components/auth/AvatarPicker";
import { getUserAvatar } from "@/lib/avatar-data";
import { PreferenceSettings } from "@/components/layout/preference-controls";
import { Panel, PanelHeader, PageHeader } from "@/components/ui/primitives";
import { getI18n, getTheme } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/* Künye sabit Türkçeydi; sayfa zaten oturuma bağlı olduğu için dizine de
   girmemeli. */
export const generateMetadata = pageMetadata({
  path: "/ayarlar",
  robots: { index: false, follow: false },
  tr: {
    title: "Ayarlar",
    description: "Hesap, dil ve tema tercihlerin.",
  },
  en: {
    title: "Settings",
    description: "Your account, language and theme preferences.",
  },
});

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/giris?devam=/ayarlar");

  const [{ locale, t }, theme, avatar] = await Promise.all([
    getI18n(),
    getTheme(),
    session.user.id ? getUserAvatar(session.user.id) : Promise.resolve(null),
  ]);
  const username = session.user.name ?? "";
  const initials = username.slice(0, 2).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US");

  return (
    <MotionExperience className={`${polish.page} ${polish.settings} mx-auto w-full`}>
      <ScrollProgress />
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      <Panel>
        <PanelHeader title={t.settings.account} />
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t.auth.username}</dt>
              <dd className="truncate font-medium text-strong">{username}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t.auth.email}</dt>
              <dd className="truncate text-body">{session.user.email}</dd>
            </div>
          </dl>

          <form action={signOutAction} className="border-t border-line-soft pt-3">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-(--radius-md) px-3 text-sm font-medium text-body transition-colors hover:bg-surface-elevated hover:text-strong"
            >
              <SignOut weight="duotone" size={16} />
              {t.nav.signOut}
            </button>
          </form>

        </div>
      </Panel>

      {/* PROFİL KAROSU (26 Eylül). Hesap başlıkta baş harflerle duruyordu;
          okuyucu artık sitenin kendi çizdiği on altı ikondan birini ve
          yedi renkten birini seçiyor (components/brand/AvatarIcon.tsx).
          Seçim hesabın kendisinde saklanıyor, yani her cihazda aynı. */}
      <Panel>
        <PanelHeader title={t.settings.avatarTitle} />
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <p className="text-small leading-relaxed text-body">{t.settings.avatarHint}</p>
          <AvatarPicker
            initial={avatar ?? { icon: null, color: "blue" }}
            /* Baş harfler KODDA büyütülüyor: CSS `uppercase` Türkçe `i`yi
               `I` yapıyor, `İ` değil. */
            initials={initials}
            username={username}
            labels={{
              initials: t.settings.avatarInitials,
              icon: t.settings.avatarIconLabel,
              color: t.settings.avatarColorLabel,
              saved: t.settings.avatarSaved,
              failed: t.settings.avatarFailed,
              names: t.settings.avatarNames,
              colors: t.settings.avatarColors,
            }}
          />
        </div>
      </Panel>

      {/* GÖRÜNÜM. Künye "dil ve tema tercihlerin" diyordu ve ikisi de yalnızca
          başlıktaki avatarın altındaki panelde duruyordu; tercihi arayan
          okuyucu ayarlara geliyor ve bulamıyordu. Denetimler hesap
          menüsüyle AYNI kod (components/layout/preference-controls.tsx). */}
      <Panel>
        <PanelHeader title={t.settings.appearance} />
        <div className="px-4 py-4 sm:px-5">
          <PreferenceSettings
            initialTheme={theme}
            initialLocale={locale}
            labels={{
              theme: t.settings.theme,
              themeLight: t.settings.themeLight,
              themeDark: t.settings.themeDark,
              language: t.settings.language,
            }}
          />
        </div>
      </Panel>

      {/* Yönetim paneli — yalnızca yetkili hesapta. Menüde de var ama oraya
          ulaşmak için başlıktaki avatarı açmak gerekiyor; ayarlar sayfası
          hesapla ilgili her şeyin toplandığı yer ve panel de hesabın bir
          yetkisi. Etiket sözlüğe girmiyor: panelin kendisi yalnızca Türkçe
          (gerekçe components/admin/AdminUI.tsx'te). */}
      {session.user.role === "admin" && (
        <Panel>
          <PanelHeader title="Yönetim" />
          <div className="px-4 py-4 sm:px-5">
            {/* Dil öneksiz: panel yalnızca Türkçe. `/en/admin` de açılır (proxy
                öneki düşürüyor) ama panelin kendi bağlantıları öneksiz ve
                okuyucu ilk tıklamada Türkçe adrese geçerdi. */}
            <NextLink
              href="/admin"
              className="inline-flex min-h-11 w-fit items-center gap-2 text-base font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-10"
            >
              <SlidersHorizontal weight="duotone" size={16} />
              Yönetim Paneline Git
            </NextLink>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title={t.settings.privacyTitle} />
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
          <p className="text-base leading-relaxed text-body">
            {t.settings.privacyHint}
          </p>
          <Link
            href="/kvkk"
            className="inline-flex w-fit items-center gap-2 text-base font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            <ShieldCheck weight="duotone" size={16} />
            {t.settings.privacyLink}
          </Link>
        </div>
      </Panel>

      {/* HESAP SİLME KENDİ BÖLGESİNDE, SAYFANIN DİBİNDE.
          Hesap panelinin içinde, "Çıkış Yap" düğmesinin hemen altında
          duruyordu: ikisi de hesapla ilgili bir eylem, alt alta, aynı
          kartta — okuyucu çıkış yapmak isterken silmeye basmaktan
          korkuyordu. Üstelik silme düğmesi bir kademe KÜÇÜKTÜ (`sm`), yani
          daha tehlikeli olan eylem daha zor nişan alınıyordu.
          Geri alınamayan eylem, geri alınabilir olanla aynı kutuda
          durmamalı: kendi paneli, sayfanın en altında ve tam ölçüde. */}
      <Panel className="border-down/30">
        <PanelHeader title={t.settings.deleteTitle} />
        <div className="px-4 py-4 sm:px-5">
          <DeleteAccount
            username={username}
            labels={{
              hint: t.settings.deleteHint,
              open: t.settings.deleteOpen,
              confirmLabel: t.settings.deleteConfirmLabel,
              confirmHint: t.settings.deleteConfirmHint,
              passwordLabel: t.auth.password,
              submit: t.settings.deleteSubmit,
              cancel: t.common.cancel,
              warning: t.settings.deleteWarning,
            }}
          />
        </div>
      </Panel>

    </MotionExperience>
  );
}
