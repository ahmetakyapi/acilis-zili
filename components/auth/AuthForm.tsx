"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import styles from "./AuthExperience.module.css";
import { useActionState, useState } from "react";
import Link from "next/link";
import type { AuthFormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Field = {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  autoComplete?: string;
  errorKey: AuthFormState["field"];
};

type AuthFormProps = {
  pitchTitle: string;
  pitchBody: string;
  features: string[];
  privacyNote: string;
  title: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  /** Gönderim sürerken düğmede yazan metin. */
  submittingLabel: string;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  altText: string;
  altHref: string;
  altLinkLabel: string;
  /** Giriş sonrası dönülecek yol — sunucu tarafında ayrıca doğrulanır. */
  continueTo?: string;
};

/**
 * Giriş/kayıt — mockup 4j'deki iki kolonlu bölünme: solda ürünün ne yaptığı,
 * sağda form. Marka işareti masthead'de zaten duruyor, kartın tepesinde
 * tekrarlanmaz.
 *
 * Mockup'ta görünen "Google ile devam et", "Beni hatırla" ve "Parolamı
 * unuttum" burada YOK — hiçbiri kurulu değil ve çalışmayan düğme çizmek
 * tasarıma uymaktan daha kötü.
 */
export function AuthForm({
  pitchTitle,
  pitchBody,
  features,
  privacyNote,
  title,
  showPasswordLabel,
  hidePasswordLabel,
  subtitle,
  fields,
  submitLabel,
  submittingLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
  continueTo,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  return (
    <MotionExperience className={styles.layout}>
      {/* ---- Sol: ürün ne yapıyor ----
           MOBİLDE İKİNCİ SIRADA: "Giriş Yap"a basan biri formu arıyor.
           Tanıtım metni tam ekranı doldurup formu katlamanın altına
           itiyordu; `order` ile mobilde aşağı, geniş ekranda yine sola
           alınıyor. */}
      <div className={styles.pitch}>
        <h2 className="display-ink">
          {pitchTitle}
        </h2>
        <p className="mt-5 max-w-[52ch] text-base leading-[26px] text-body">
          {pitchBody}
        </p>

        <div className={styles.features} data-motion-stagger>
          {features.map((feature, index) => (
            <p key={feature} className={styles.feature}>
              <span aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-read text-body">{feature}</span>
            </p>
          ))}
          <p className="mt-2.5 text-small leading-relaxed text-muted">
            {privacyNote}
          </p>
        </div>
      </div>

      {/* ---- Sağ: form ---- */}
      <div className={styles.formCard}>
        {/* The form action is the page heading, including the form-first mobile layout. */}
        <h1>
          {title}
        </h1>
        <p className="mt-2 text-base text-body">{subtitle}</p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          {/* Hedef gizli alanla taşınır; sunucu tarafı ayrıca doğrular —
              istemciden gelen bir yola körlemesine yönlendirmek yok. */}
          {continueTo && (
            <input type="hidden" name="devam" value={continueTo} />
          )}
          {fields.map((field) => {
            const hasError = state.field === field.errorKey;
            return (
              <div key={field.name} className={styles.field}>
                <label htmlFor={`auth-${field.name}`}>
                  {field.label}
                </label>
                <div className={styles.inputWrap} data-password={field.type === "password"}>
                <input
                  id={`auth-${field.name}`}
                  name={field.name}
                  type={field.type === "password" && visiblePasswords[field.name] ? "text" : field.type}
                  required
                  placeholder={field.placeholder}
                  autoComplete={field.autoComplete}
                  /* Kullanıcı adı ve e-posta alanlarında OTOMATİK BÜYÜTME
                     KAPALI. Mobil klavye ilk harfi kendiliğinden büyütüyordu
                     ve Türkçe klavyede o harf "İ" olduğunda kayıt "kullanıcı
                     adı biçimi" hatası veriyor, giriş ise eşleşmiyordu
                     (normalizasyon lib/utils.ts'te; bu da aynı sorunun
                     kaynağını kesiyor). Şifre alanına dokunulmuyor —
                     orada büyük harf kullanıcının tercihidir. */
                  autoCapitalize={field.type === "password" ? undefined : "none"}
                  autoCorrect={field.type === "password" ? undefined : "off"}
                  aria-invalid={hasError || undefined}
                  /* Hata metni alana BAĞLANIYOR. Bağlanmadan önce ekran
                     okuyucu alana odaklandığında yalnızca etiketi duyuyor,
                     "şifre en az 8 karakter olmalı" satırını hiç görmüyordu. */
                  aria-describedby={hasError ? `${field.name}-hata` : undefined}
                  className={cn(
                    "h-11 rounded-md border bg-overlay-surface px-3.5 text-sm text-strong outline-none transition-shadow placeholder:text-muted focus:border-primary/50 focus:shadow-[0_0_0_3px_var(--primary-tint)]",
                    hasError ? "border-down" : "border-line-strong",
                  )}
                />
                {field.type === "password" && <button
                  type="button"
                  className={styles.visibility}
                  aria-label={visiblePasswords[field.name] ? hidePasswordLabel : showPasswordLabel}
                  aria-pressed={Boolean(visiblePasswords[field.name])}
                  aria-controls={`auth-${field.name}`}
                  onClick={() => setVisiblePasswords((current) => ({ ...current, [field.name]: !current[field.name] }))}
                >
                  {visiblePasswords[field.name] ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>}
                </div>
                {hasError && (
                  <span id={`${field.name}-hata`} className="text-xs text-down">
                    {state.error}
                  </span>
                )}
              </div>
            );
          })}

          {state.field === "form" && state.error && (
            /* CANLI BÖLGE. Sunucu eylemi dönünce sayfa yeniden çizilmiyor,
               yalnızca bu satır beliriyordu: ekran okuyucu kullanıcısı "Giriş
               Yap"a bastıktan sonra hiçbir şey duymuyor, formun neden
               gönderilmediğini anlamıyordu. Aynı desen hesap silmede zaten
               doğru yazılmıştı. */
            <p
              role="alert"
              className="rounded-md bg-down-wash px-3.5 py-2.5 text-sm text-down"
            >
              {state.error}
            </p>
          )}

          {/* BEKLEME GÖRÜNÜYOR. Düğme yalnızca `disabled` oluyor ve
              soluklaşıyordu; metin değişmiyor, dönen bir gösterge yoktu.
              Kayıtta bcrypt 12 tur artı iki veritabanı sorgusu çalışıyor,
              yani bekleme yüzlerce milisaniye — kullanıcı formun donduğunu
              sanıp tekrar tıklıyor, tıklama engelli olduğu için hiçbir şey
              olmuyor ve "bozuk" hissi büyüyordu. */}
          <Button type="submit" disabled={pending} size="lg" className="mt-2">
            {pending && (
              <span
                aria-hidden
                className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
            {pending ? submittingLabel : submitLabel}
          </Button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-base text-muted">
          {altText}{" "}
          {/* Cümle içinde ama dokunulabilir: 16px yüksekliğindeydi ve giriş
              ile kayıt arasında geçiş yapmanın TEK yolu bu bağlantı.
              `inline-flex` + dikey dolgu hedefi 40px'e çıkarıyor; negatif
              margin cümlenin satır yüksekliğini bozmuyor. */}
          <Link
            href={altHref}
            className="-my-2 inline-flex min-h-10 items-center py-2 font-semibold text-primary hover:text-primary-hover"
          >
            {altLinkLabel}
          </Link>
        </p>
      </div>
    </MotionExperience>
  );
}
