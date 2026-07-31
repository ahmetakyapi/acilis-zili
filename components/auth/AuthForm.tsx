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
  title: string;
  subtitle: string;
  fields: Field[];
  submitLabel: string;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  altText: string;
  altHref: string;
  altLinkLabel: string;
};

export function AuthForm({
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
    <div className="mx-auto w-full max-w-sm">
      <h1 className="notched inline-block text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-soft">{subtitle}</p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {fields.map((field) => {
          const hasError = state.field === field.errorKey;
          return (
            <label key={field.name} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-soft">{field.label}</span>
              <input
                name={field.name}
                type={field.type}
                required
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                aria-invalid={hasError || undefined}
                className={cn(
                  "h-11 rounded-(--radius-sm) border bg-surface px-3 text-sm text-strong outline-none transition-colors placeholder:text-muted focus:border-line-focus",
                  hasError ? "border-down" : "border-line",
                )}
              />
              {hasError && <span className="text-xs text-down">{state.error}</span>}
            </label>
          );
        })}

        {state.field === "form" && state.error && (
          <p className="rounded-(--radius-sm) bg-down-wash px-3 py-2 text-sm text-down">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 inline-flex h-11 items-center justify-center rounded-(--radius-md) bg-primary text-sm font-medium text-white transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </form>

      <p className="mt-5 text-sm text-soft">
        {altText}{" "}
        <Link href={altHref} className="font-medium text-primary hover:underline">
          {altLinkLabel}
        </Link>
      </p>
    </div>
  );
}
