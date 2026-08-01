"use client";

import { useActionState } from "react";
import Link from "next/link";
import { BellMark } from "@/components/brand/BellMark";
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
  brandName: string;
  tagline: string;
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  altText: string;
  altHref: string;
  altLinkLabel: string;
};

/**
 * Giriş/kayıt kartı — markanın kapısı.
 * Zil işareti + slogan üstte, form tek kolonda; hata alanın hemen altında
 * konuşur. Başlıklar Title Case, süs işareti yok.
 */
export function AuthForm({
  brandName,
  tagline,
  title,
  subtitle,
  fields,
  submitLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    /* Gazetenin künye sayfası: marka, manşet çizgisi, slogan rayı, sonra form.
       Kutu yok — form sayfanın kendi zemininde durur. */
    <div className="mx-auto w-full max-w-[400px]">
      <Link href="/" className="flex items-center gap-2.5">
        <BellMark size={26} />
        <span className="text-[19px] font-semibold tracking-[-0.02em] text-ink">
          {brandName}
        </span>
      </Link>

      <div className="rule-head mt-4" />
      <p className="py-2.5 text-[12.5px] uppercase tracking-[0.08em] text-dim">
        {tagline}
      </p>
      <div className="rule-thin" />

      <div className="mt-10 w-full">
        <h6 className="kicker mb-2.5">{subtitle}</h6>
        <h1 className="text-[32px] leading-[1.1] tracking-[-0.02em]">{title}</h1>

        <form action={formAction} className="mt-7 flex flex-col gap-4">
          {fields.map((field) => {
            const hasError = state.field === field.errorKey;
            return (
              <label key={field.name} className="flex flex-col gap-1.5">
                <span className="text-[13px] text-dim">{field.label}</span>
                <input
                  name={field.name}
                  type={field.type}
                  required
                  placeholder={field.placeholder}
                  autoComplete={field.autoComplete}
                  aria-invalid={hasError || undefined}
                  className={cn(
                    "h-11 border bg-transparent px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-up",
                    hasError ? "border-down" : "border-rule",
                  )}
                />
                {hasError && (
                  <span className="text-xs text-down">{state.error}</span>
                )}
              </label>
            );
          })}

          {state.field === "form" && state.error && (
            <p className="border-l-2 border-down bg-down-wash px-3.5 py-2.5 text-sm text-down">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex h-11 items-center justify-center bg-btn text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>

        <p className="mt-7 border-t border-hairline pt-5 text-center text-[13.5px] text-dim">
          {altText}{" "}
          <Link href={altHref} className="font-semibold text-up hover:underline">
            {altLinkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
