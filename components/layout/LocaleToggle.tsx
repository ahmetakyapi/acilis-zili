"use client";

import { useEffect, useTransition } from "react";
import { usePathname } from "next/navigation";
import { setLocalePreference } from "@/app/actions/preferences";
import { withLocale } from "@/lib/i18n/routing";
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
  const pathname = usePathname();

  /* Dil değişimi artık BİR GEZİNME: aynı sayfanın öteki dildeki adresine
     gidiliyor (`/piyasalar` ↔ `/en/piyasalar`). Çerez de yazılıyor ama artık
     ikincil — önekSİZ adreslerde tercihi hatırlatan şey o.

     `RouteProgress`in tıklama dinleyicisi programatik gezinmeyi göremiyor,
     bu yüzden gösterge elle yakılıp söndürülüyor. */
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
    /* TAM SAYFA GEZİNMESİ — `router.push` DEĞİL.
       Dil değişimi bir rota değişimi değil, BÜTÜN AĞACIN değişimi: `<html
       lang>` ve masthead kök düzende çiziliyor ve App Router istemci
       gezinmesinde kök düzeni yeniden çizmiyor. Üstelik istemci yönlendirici
       önbelleği aynı adresi eski dildeki yanıtıyla tutuyordu.

       Ölçüldü: `/en/piyasalar`dan TR'ye dönüldüğünde adres `/piyasalar`
       oluyor ve çerez `tr` yazılıyor ama ekranda "Markets" duruyordu; sonraki
       sayfada gövde Türkçe geliyor, masthead İngilizce kalıyordu — yani
       sayfanın yarısı bir dilde, yarısı ötekinde.

       Tam gezinme bir tur ağ maliyeti demek ama dil değişimi ender ve
       bilinçli bir eylem; doğruluk hızdan önce gelir. */
    startTransition(async () => {
      await setLocalePreference(locale);
      window.location.assign(withLocale(pathname, locale));
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
