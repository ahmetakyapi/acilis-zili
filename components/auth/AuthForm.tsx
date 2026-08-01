"use client";

import { useActionState } from "react";
import Link from "next/link";
import { DottedLeader } from "@/components/ui/primitives";
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

export type AuthPitch = {
  title: string;
  body: string;
  /** Nokta liderli fihrist — ne veriyoruz, karşılığı ne. */
  features: { label: string; value: string }[];
  privacyNote: string;
};

type AuthFormProps = {
  title: string;
  subtitle: string;
  pitch: AuthPitch;
  fields: Field[];
  submitLabel: string;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  altText: string;
  altHref: string;
  altLinkLabel: string;
};

/**
 * Giriş/kayıt — gazetenin abonelik sayfası (HANDOFF §5, ekran 2j).
 *
 * Solda ürünün vaadi ve nokta liderli fihrist, sağda form; ikisini dikey bir
 * kural ayırır. Marka künyesi burada tekrar edilmez — sayfanın üstündeki
 * manşet zaten taşıyor. Dar ekranda vaat üste, form altına iner.
 */
export function AuthForm({
  title,
  subtitle,
  pitch,
  fields,
  submitLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-0">
      {/* ---- Vaat ---- */}
      <section className="flex flex-col lg:pr-14">
        <h1 className="max-w-[15ch] text-[2.25rem] leading-[1.08] tracking-[-0.024em] sm:text-[3rem]">
          {pitch.title}
        </h1>
        <p className="mt-6 max-w-[50ch] text-[16px] leading-[1.75] text-dim sm:text-[17px]">
          {pitch.body}
        </p>

        <div className="mt-auto pt-10">
          {pitch.features.map((feature) => (
            <DottedLeader
              key={feature.label}
              label={feature.label}
              value={feature.value}
              className="text-[16px]"
            />
          ))}
          <p className="mt-5 text-[13px] leading-relaxed text-faint">
            {pitch.privacyNote}
          </p>
        </div>
      </section>

      {/* ---- Form ---- */}
      <section className="bg-surface-elevated p-6 sm:p-8 lg:border-l lg:border-rule lg:pl-14">
        <h6 className="kicker mb-2.5">{subtitle}</h6>
        <h2 className="text-[28px] leading-[1.1] tracking-[-0.02em] sm:text-[32px]">
          {title}
        </h2>

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
                    "h-11 border bg-page px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-up",
                    hasError ? "border-down" : "border-rule",
                  )}
                />
                {hasError && (
                  <span className="text-[13px] text-down">{state.error}</span>
                )}
              </label>
            );
          })}

          {state.field === "form" && state.error && (
            <p className="border-l-2 border-down px-3.5 py-2.5 text-[14px] text-down">
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
      </section>
    </div>
  );
}
