"use client";

import { useSyncExternalStore } from "react";
import { withLocale } from "@/lib/i18n/routing";
import {
  LOCALES,
  LOCALE_COOKIE,
  THEME_COOKIE,
  type Locale,
  type Theme,
} from "@/lib/i18n/config";
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

/**
 * Tercih çerezini TARAYICIDA yazar — server action DEĞİL (20 Ekim).
 *
 * İkisi de `app/actions/preferences.ts`teki eylemlerle yazılıyordu. Next 16'da
 * eylem içinde çerez yazmak isteği "yeniden doğrulandı" sayıyor: yanıt O ANKİ
 * sayfayı bütün düzenleriyle sunucuda yeniden çiziyor (hisse sayfasında
 * kotasyon, veritabanı, sağlayıcılar) ve istemci yönlendirici önbelleğini
 * siliyor — yalnız bir çerez için. Üst üste iki tema tıklamasında ilk eylemin
 * ağacı `data-theme`i eski değere çekip ekranı bir an geri çeviriyordu; dil
 * değişimi de tam sayfa yüklemesinden önce eski dildeki bu boş çizimi
 * bekliyordu. İki çerez de `httpOnly` değil (proxy ve `global-error` okuyor),
 * yani tarayıcıda yazmak eşdeğer. Ömür proxy'nin yazdığıyla aynı, bir yıl
 * (`LOCALE_COOKIE_MAX_AGE`, `proxy.ts`).
 */
function writePreference(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
}

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
  dark: { page: "#08101a", card: "#161f2c", ink: "#2a3542", accent: "#3cb7fb" },
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
    // Görsel değişim tıklama anında, çerez tarayıcıda; sunucu hiç
    // beklenmiyor. Beklersek tema geç dönüyor ve düğme donmuş gibi duruyor.
    const apply = () => {
      root.setAttribute("data-theme", next);
      /* Tarayıcı çubuğu da ürünün temasını izler (`generateViewport`,
         app/layout.tsx). Eylemin sunucu çizimi bu etiketi yan etkiyle
         tazeliyordu; eylem kalkınca (20 Ekim) değer yeni temanın
         `--page-bg`sinden okunuyor — iki yerde yaşayan renge üçüncü bir
         kopya eklemeden. */
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", getComputedStyle(root).getPropertyValue("--page-bg").trim());
    };
    writePreference(THEME_COOKIE, next);

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
  const pickLocale = (next: Locale) => {
    if (next === initialLocale) return;
    /* Gösterge elle açılıyor: `RouteProgress` bağlantı tıklamalarını
       dinliyor, bir düğmeden çıkan `location.assign`i görmüyor. Eskiden
       sunucu eyleminin geçişine (`useTransition`) bağlıydı; eylem kalkınca
       (20 Ekim, bkz. `writePreference`) bekleyecek bir geçiş de kalmadı. */
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
       ikincil: önekSİZ adreslerde tercihi hatırlatan şey o.

       O ANKİ adres TAZELENMEZ, doğrudan yeni dilin adresine gidilir:
       `/en/...`te kalıp tazelemek proxy'de çerezi sessizce `en`e geri
       yazıyordu ("önekli adrese gelmek de bir dil seçimidir", proxy.ts).

       SORGU VE ÇAPA TAŞINIR (20 Ekim): ekran durumu adreste yaşıyor
       (karşılaştırmanın sembolleri ve aralığı, dizinin süzgeci ve sıralaması)
       ve yalnız yol taşınınca dil değişimi o durumu sıfırlıyordu. Sorgu
       değerleri dilden bağımsız kodlar; öteki dilde olmayan bir çapa
       yok sayılıyor. */
    writePreference(LOCALE_COOKIE, next);
    startRouteProgress();
    /* Geri tuşu sayfayı bfcache'ten dondurulmuş hâliyle getirirse gösterge
       açık kalır ve sayfa 10 saniyelik frene kadar soluk durur. */
    window.addEventListener(
      "pageshow",
      (event) => {
        if (event.persisted) stopRouteProgress();
      },
      { once: true },
    );
    const { pathname, search, hash } = window.location;
    window.location.assign(withLocale(pathname, next) + search + hash);
  };

  return { pickLocale };
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
