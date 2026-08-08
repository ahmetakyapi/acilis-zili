"use client";

import { useCallback, useSyncExternalStore, useTransition } from "react";
import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";
import { setThemePreference } from "@/app/actions/preferences";
import type { Theme } from "@/lib/i18n/config";

/**
 * <html data-theme> tek doğruluk kaynağıdır: anti-FOUC script React'ten önce
 * yazar, toggle doğrudan DOM'a yazar, bileşen attribute'u dinleyerek çizer.
 * Tercih arka planda çereze kaydedilir — tıklama anında görsel değişir.
 */

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return value === "light" ? "light" : "dark";
}

export function ThemeToggle({
  initial,
  label,
}: {
  initial: Theme;
  label: string;
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initial);
  const [, startTransition] = useTransition();

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    startTransition(() => {
      void setThemePreference(next);
    });
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-body transition-colors hover:border-line-strong hover:text-strong lg:size-[34px] lg:rounded-[9px]"
    >
      {theme === "dark" ? (
        <Sun weight="duotone" size={16} />
      ) : (
        <Moon weight="duotone" size={16} />
      )}
    </button>
  );
}
