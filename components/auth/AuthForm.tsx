"use client";

import { useActionState } from "react";
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
  subtitle: string;
  fields: Field[];
  submitLabel: string;
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
  subtitle,
  fields,
  submitLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
  continueTo,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="grid items-stretch gap-8 py-4 lg:grid-cols-[minmax(0,1.1fr)_460px] lg:gap-14 lg:py-10">
      {/* ---- Sol: ürün ne yapıyor ----
           MOBİLDE İKİNCİ SIRADA: "Giriş Yap"a basan biri formu arıyor.
           Tanıtım metni tam ekranı doldurup formu katlamanın altına
           itiyordu; `order` ile mobilde aşağı, geniş ekranda yine sola
           alınıyor. */}
      <div className="order-2 flex flex-col lg:order-1">
        <h1 className="display-ink max-w-[17ch] text-[32px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[46px]">
          {pitchTitle}
        </h1>
        <p className="mt-5 max-w-[52ch] text-base leading-[26px] text-body">
          {pitchBody}
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-10 lg:pt-12">
          {features.map((feature) => (
            <p key={feature} className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-[22px] shrink-0 items-center justify-center rounded-xs bg-up-wash text-xs font-bold text-up"
              >
                ✓
              </span>
              <span className="text-[14.5px] text-body">{feature}</span>
            </p>
          ))}
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
            {privacyNote}
          </p>
        </div>
      </div>

      {/* ---- Sağ: form ---- */}
      <div className="order-1 rounded-xl border border-line bg-surface p-6 sm:p-8 lg:order-2 lg:self-center">
        <h2 className="text-[24px] font-bold tracking-[-0.03em] text-strong sm:text-[28px]">
          {title}
        </h2>
        <p className="mt-2 text-[13.5px] text-body">{subtitle}</p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          {/* Hedef gizli alanla taşınır; sunucu tarafı ayrıca doğrular —
              istemciden gelen bir yola körlemesine yönlendirmek yok. */}
          {continueTo && (
            <input type="hidden" name="devam" value={continueTo} />
          )}
          {fields.map((field) => {
            const hasError = state.field === field.errorKey;
            return (
              <label key={field.name} className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-semibold text-body">
                  {field.label}
                </span>
                <input
                  name={field.name}
                  type={field.type}
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
                {hasError && (
                  <span id={`${field.name}-hata`} className="text-xs text-down">
                    {state.error}
                  </span>
                )}
              </label>
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

          <Button type="submit" disabled={pending} size="lg" className="mt-2">
            {submitLabel}
          </Button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
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
    </div>
  );
}
