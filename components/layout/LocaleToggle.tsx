"use client";

import { useEffect, useTransition } from "react";
import { setLocalePreference } from "@/app/actions/preferences";
import {
  startRouteProgress,
  stopRouteProgress,
} from "@/components/layout/RouteProgress";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * TR/EN segmenti — seçili olan `--srf2` dolgulu.
 *
 * YALNIZCA MASAÜSTÜ. Telefondaki tek kareli sürüm kaldırıldı: dil değişimi
 * artık hesap menüsünün içinde, tema seçimiyle aynı satır düzeninde duruyor
 * (`AccountMenu`). Mobil başlıkta yalnızca aramaya ve hesaba yer var.
 */
export function LocaleToggle({
  initial,
  label,
}: {
  initial: Locale;
  label: string;
}) {
  const [pending, startTransition] = useTransition();

  /* Dil değişimi bir gezinme DEĞİL: adres aynı kalıyor, çerez yazılıyor ve
     sunucu bileşenlerinin tamamı yeniden çiziliyor. Bu yüzden `RouteProgress`
     içindeki tıklama dinleyicisi bunu göremiyor ve ekranda saniyenin üçte
     ikisi boyunca hiçbir şey olmuyordu. Göstergeyi elle yakıp geçiş bitince
     söndürüyoruz. */
  useEffect(() => {
    if (pending) startRouteProgress();
    else stopRouteProgress();
  }, [pending]);

  const select = (locale: Locale) => {
    if (locale === initial) return;
    /* Geçiş gövdesi ASENKRON olmalı: senkron gövde `undefined` döndürünce
       React geçişi anında bitmiş sayıyor, `pending` bir kare true kalıp
       düşüyordu — ne buradaki soluklaşma ne de üstteki gösterge görünüyordu.
       (React 19 asenkron geçişleri.) */
    startTransition(async () => {
      await setLocalePreference(locale);
    });
  };

  return (
    <span
      className={cn(
        "flex overflow-hidden rounded-lg border border-line text-xs",
        pending && "opacity-60",
      )}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => select(locale)}
          aria-label={`${label}: ${locale.toUpperCase()}`}
          aria-pressed={locale === initial}
          disabled={pending}
          className={cn(
            "px-[9px] py-1.5 uppercase transition-colors",
            locale === initial
              ? "bg-surface-elevated font-semibold text-strong"
              : "text-body hover:text-strong",
          )}
        >
          {locale}
        </button>
      ))}
    </span>
  );
}
