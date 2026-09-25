"use client";

import { useEffect, useSyncExternalStore, useTransition } from "react";
import { usePathname } from "next/navigation";
import { withLocale } from "@/lib/i18n/routing";
import {
  setLocalePreference,
  setThemePreference,
} from "@/app/actions/preferences";
import { LOCALES, type Locale, type Theme } from "@/lib/i18n/config";
import {
  startRouteProgress,
  stopRouteProgress,
} from "@/components/layout/RouteProgress";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Tema ve dil denetimleri — İKİ YERDE, TEK KOD.

   Hesap menüsünde doğdular ve bir süre yalnızca orada yaşadılar. Ayarlar
   sayfasının künyesi "Hesap, dil ve tema tercihlerin" diyordu ama sayfada
   ne dil ne tema vardı: tercihi arayan okuyucu ayarlara gidiyor, orada
   bulamıyor ve avatarın altındaki paneli ancak tesadüfen keşfediyordu.
   Denetimler buraya taşındı ki iki yüzey aynı mantığı (DOM'a anında yazma,
   çerezi arkada kaydetme, dilde tam sayfa gezinmesi) ayrı ayrı yeniden
   yazmasın.

   TEMANIN TEK DOĞRULUK KAYNAĞI <html data-theme>: anti-FOUC betiği React'ten
   önce yazar, seçim doğrudan DOM'a yazar, bileşen özniteliği dinleyerek
   çizer. Tercih arka planda çereze kaydedilir — tıklama anında görsel değişir.
   -------------------------------------------------------------------------- */

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/**
 * Tema önizlemesinin renkleri — SABİT, token değil.
 *
 * "Hardcoded renk yasak" kuralının bilinçli tek istisnası. Swatch'ın işi o
 * temanın nasıl göründüğünü göstermek; token kullanılsaydı iki maket de O AN
 * AÇIK OLAN temanın renklerini alır ve "Açık" ile "Koyu" birbirinin aynısı
 * çizilirdi. Değerler `globals.css` içindeki `--page-bg`, kart yüzeyi ve
 * `--primary` ile birebir aynı; orası değişirse burası da değişmeli.
 */
const THEME_SPECIMEN = {
  light: { page: "#f7f9fb", card: "#ffffff", ink: "#d7dee6", accent: "#0d74c4" },
  dark: { page: "#070d16", card: "#141d29", ink: "#2a3542", accent: "#35b8ff" },
} as const;

/** Sürmekte olan tema geçişi — üst üste tıklamada temizliği yalnızca
    sonuncusu yapsın diye (bkz. `pickTheme`). */
let activeThemeTransition: ViewTransition | null = null;

/** Açık/koyu seçimi — `<html data-theme>`i dinler ve ona yazar. */
export function useThemePreference(initialTheme: Theme) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    readTheme,
    () => initialTheme,
  );

  const pickTheme = (
    next: Theme,
    event?: React.MouseEvent<HTMLElement>,
  ) => {
    if (next === readTheme()) return;
    const root = document.documentElement;
    // Görsel değişim tıklama anında, çerez arka planda. Sunucuyu beklersek
    // tema geç dönüyor ve düğme donmuş gibi duruyor.
    const apply = () => root.setAttribute("data-theme", next);
    void setThemePreference(next);

    /* YENİ TEMA TIKLANAN YERDEN YAYILIYOR. İki tema arasında anlık geçiş
       bütün ekranı tek karede çeviriyordu — göz neyin değiştiğini değil
       yalnızca bir parlamayı görüyordu. View Transitions eski ekranın bir
       fotoğrafını tutup yenisini tıklanan maketten büyüyen bir dairenin
       içinde açıyor: değişimin kaynağı ile sonucu aynı hareketin iki ucu.
       Tarayıcı desteklemiyorsa ya da okuyucu hareketi azaltıyorsa geçiş
       eskisi gibi anlık. Kök sınıf (`theme-switching`) animasyonu YALNIZCA
       bu geçişe bağlıyor; başka bir view transition eklenirse etkilenmez.
       Stil: globals.css → "Tema geçişi". */
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) {
      apply();
      return;
    }
    if (event) {
      const box = event.currentTarget.getBoundingClientRect();
      root.style.setProperty("--theme-x", `${box.left + box.width / 2}px`);
      root.style.setProperty("--theme-y", `${box.top + box.height / 2}px`);
    }
    root.classList.add("theme-switching");
    const transition = document.startViewTransition(apply);
    activeThemeTransition = transition;
    /* ÜST ÜSTE İKİ TIKLAMA. Geçiş sürerken öteki temaya basılınca tarayıcı
       ilk geçişi atlıyor ve onun `finished`i hemen çözülüyor. Temizlik
       koşulsuz olsaydı sınıfı İKİNCİ geçiş hâlâ oynarken silerdi ve
       tarayıcının varsayılan çapraz solması araya girerdi. Sınıfı yalnızca
       en son başlayan geçiş kaldırır. */
    void transition.finished.finally(() => {
      if (activeThemeTransition !== transition) return;
      activeThemeTransition = null;
      root.classList.remove("theme-switching");
    });
  };

  return { theme, pickTheme };
}

/** Dil seçimi — çerezi yazar, sonra aynı sayfanın öteki diline gider. */
export function useLocalePreference(initialLocale: Locale) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();

  /* Dil değişimi bir gezinme DEĞİL — adres aynı kalıyor, çerez yazılıyor ve
     sunucu ağacı yeniden çiziliyor. `RouteProgress` tıklamaları dinleyerek
     çalıştığı için bunu göremiyor; göstergeyi geçişin kendisine bağlıyoruz. */
  useEffect(() => {
    if (pending) startRouteProgress();
    else stopRouteProgress();
  }, [pending]);

  const pickLocale = (next: Locale) => {
    if (next === initialLocale) return;
    /* Geçiş gövdesi ASENKRON. `startTransition(() => void action())` yazılırsa
       gövde `undefined` döndürdüğü için React geçişi o anda bitmiş sayıyor:
       `pending` bir kare true olup hemen false'a düşüyor ve gösterge hiç
       görünmüyordu. Söz döndürülünce geçiş sunucu eylemi bitene kadar açık
       kalıyor — React 19'un asenkron geçişleri. */
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
       bilinçli bir eylem; doğruluk hızdan önce gelir. Çerez de yazılıyor ama
       ikincil: önekSİZ adreslerde tercihi hatırlatan şey o. */
    startTransition(async () => {
      await setLocalePreference(next);
      window.location.assign(withLocale(pathname, next));
    });
  };

  return { pending, pickLocale };
}

/**
 * Dil segmenti — iki düğme, seçili olan dolu.
 *
 * GERÇEK YÜKSEKLİK, `.tap-44` DEĞİL: iki düğme `overflow-hidden` bir kabın
 * içinde (ortak yuvarlak köşeyi o kırpıyor) ve orada sözde öğeyle yapılan
 * hedef genişletmesi de kırpılır. Segment zaten kendi satırında; telefonda
 * 44 piksele çıkması menüyü bozmuyor, rahatlatıyor.
 */
export function LocaleSegment({
  current,
  onPick,
}: {
  current: Locale;
  onPick: (next: Locale) => void;
}) {
  return (
    <span className="flex overflow-hidden rounded-md border border-line bg-surface-solid">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => onPick(locale)}
          aria-pressed={locale === current}
          className={cn(
            "min-h-11 px-3 text-tiny uppercase transition-colors sm:min-h-8",
            locale === current
              ? "bg-primary font-bold text-on-primary"
              : "text-muted hover:text-strong",
          )}
        >
          {locale}
        </button>
      ))}
    </span>
  );
}

/**
 * Tema seçeneği — o temanın minik bir sayfa maketi.
 *
 * Zemin, üstünde bir kart, kartın içinde bir accent şerit ve iki metin
 * satırı. Seçili olan accent çerçeveyle işaretli ve adı altında yazılı —
 * maket tek başına bilmece kalmıyor.
 */
export function ThemeChoice({
  variant,
  label,
  active,
  onClick,
}: {
  variant: "light" | "dark";
  label: string;
  active: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const spec = THEME_SPECIMEN[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-md border p-1.5 transition-colors",
        active
          ? "border-primary bg-primary-wash"
          : "border-line bg-surface-solid hover:border-line-strong",
      )}
    >
      <span
        aria-hidden
        className="flex h-[40px] w-full items-center rounded-xs px-[7px]"
        style={{ background: spec.page }}
      >
        <span
          className="flex w-full flex-col gap-[3px] rounded-[4px] p-[5px]"
          style={{ background: spec.card }}
        >
          <span
            className="h-[3px] w-[55%] rounded-full"
            style={{ background: spec.accent }}
          />
          <span
            className="h-[3px] w-full rounded-full"
            style={{ background: spec.ink }}
          />
          <span
            className="h-[3px] w-[70%] rounded-full"
            style={{ background: spec.ink }}
          />
        </span>
      </span>
      <span
        className={cn(
          "text-tiny font-semibold",
          active ? "text-primary" : "text-body",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * Ayarlar sayfasının Görünüm paneli — hesap menüsündeki tercih bloğunun
 * sayfa ölçüsündeki karşılığı. Satırlar hesap panelindeki `dl` ile aynı
 * düzende: solda etiket, sağda denetim; maketler dar ekranda da iki sütun.
 */
export function PreferenceSettings({
  initialTheme,
  initialLocale,
  labels,
}: {
  initialTheme: Theme;
  initialLocale: Locale;
  labels: {
    theme: string;
    themeLight: string;
    themeDark: string;
    language: string;
  };
}) {
  const { theme, pickTheme } = useThemePreference(initialTheme);
  const { pickLocale } = useLocalePreference(initialLocale);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="text-muted">{labels.theme}</span>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-64">
          {(
            [
              { key: "light", text: labels.themeLight },
              { key: "dark", text: labels.themeDark },
            ] as const
          ).map(({ key, text }) => (
            <ThemeChoice
              key={key}
              variant={key}
              label={text}
              active={theme === key}
              onClick={(event) => pickTheme(key, event)}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-line-soft pt-4">
        <span className="text-muted">{labels.language}</span>
        <LocaleSegment current={initialLocale} onPick={pickLocale} />
      </div>
    </div>
  );
}
