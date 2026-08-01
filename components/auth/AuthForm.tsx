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
    <div className="mx-auto flex w-full max-w-sm flex-col items-center">
      {/* Marka başlığı — kapı tabelası */}
      <Link href="/" className="flex flex-col items-center gap-2.5 text-center">
        <BellMark size={34} />
        <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.16em] text-strong">
          {brandName}
        </span>
        <span className="plate text-[9px] normal-case tracking-[0.08em]">
          {tagline}
        </span>
      </Link>

      <div className="panel mt-6 w-full p-6 shadow-(--shadow-raised) sm:p-7">
        <h1 className="text-xl font-bold tracking-tight text-strong">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-soft">{subtitle}</p>

        <form action={formAction} className="mt-5 flex flex-col gap-4">
          {fields.map((field) => {
            const hasError = state.field === field.errorKey;
            return (
              <label key={field.name} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-body">
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
                    "h-11 rounded-(--radius-md) border bg-surface-elevated px-3.5 text-sm text-strong shadow-none outline-none transition-colors placeholder:text-muted focus:border-line-focus focus:ring-2 focus:ring-primary-wash",
                    hasError ? "border-down" : "border-line",
                  )}
                />
                {hasError && (
                  <span className="text-xs text-down">{state.error}</span>
                )}
              </label>
            );
          })}

          {state.field === "form" && state.error && (
            <p className="rounded-(--radius-md) bg-down-wash px-3.5 py-2.5 text-sm text-down">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 inline-flex h-11 items-center justify-center rounded-(--radius-md) bg-primary text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>

        <p className="mt-5 border-t border-line-soft pt-4 text-center text-sm text-soft">
          {altText}{" "}
          <Link
            href={altHref}
            className="font-semibold text-primary hover:underline"
          >
            {altLinkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
