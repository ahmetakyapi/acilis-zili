"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthFormState } from "@/app/actions/auth";
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
      {/* ---- Sol: ürün ne yapıyor ---- */}
      <div className="flex flex-col">
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
                className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] bg-up-wash text-xs font-bold text-up"
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
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:self-center">
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
                  aria-invalid={hasError || undefined}
                  className={cn(
                    "h-11 rounded-[10px] border bg-overlay-surface px-3.5 text-sm text-strong outline-none transition-shadow placeholder:text-muted focus:border-primary/50 focus:shadow-[0_0_0_3px_var(--primary-tint)]",
                    hasError ? "border-down" : "border-line-strong",
                  )}
                />
                {hasError && (
                  <span className="text-xs text-down">{state.error}</span>
                )}
              </label>
            );
          })}

          {state.field === "form" && state.error && (
            <p className="rounded-[10px] bg-down-wash px-3.5 py-2.5 text-sm text-down">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-[10px] bg-primary text-[14.5px] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-45"
          >
            {submitLabel}
          </button>
        </form>

        <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
          {altText}{" "}
          <Link
            href={altHref}
            className="font-semibold text-primary hover:text-primary-hover"
          >
            {altLinkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
