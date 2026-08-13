import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { LOCALE_HEADER, splitLocale, withLocale } from "@/lib/i18n/routing";

/**
 * Next.js 16'da `middleware` yerini `proxy` aldı.
 *
 * İki iş yapıyor:
 *
 * 1. DİL ÖNEKİNİ ÇÖZER. `/en/piyasalar` isteği sunucuda `/piyasalar`
 *    sayfasına YENİDEN YAZILIR ve dil bir istek başlığıyla taşınır. Tarayıcının
 *    adresi `/en/...` olarak kalır — yani İngilizce içeriğin gerçek, paylaşılabilir
 *    ve dizine girebilir bir adresi olur. Gerekçenin tamamı `lib/i18n/routing.ts`'te.
 *
 * 2. OTURUM ÖN ELEMESİ. Yalnızca çerezin VARLIĞINA bakar — ucuz bir kapı.
 *    Gerçek doğrulama sayfa ve server action'larda `auth()` ile yapılır.
 */

const PROTECTED = ["/favoriler", "/ayarlar"];
const AUTH_ROUTES = ["/giris", "/kayit"];

/* `/admin` BİLEREK BU LİSTEDE DEĞİL. Buradaki koruma girişe yönlendiriyor ve
   "giriş yap, sonra /admin'e devam edeceksin" demek, olmayan bir kapının VAR
   olduğunu söylemek olurdu. Panelin kapısı `app/admin/layout.tsx` içinde ve
   yetkisiz herkese — giriş yapmışa da yapmamışa da — 404 döndürüyor. */

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token")
  );
}

export function proxy(request: NextRequest) {
  const { locale, path } = splitLocale(request.nextUrl.pathname);
  const signedIn = hasSessionCookie(request);

  /* Yönlendirmeler DİLİ KORUR: `/en/favoriler`den girişe atılan okuyucu
     `/en/giris`e gider, Türkçeye düşmez. */
  const prefix = locale ? `/${locale}` : "";

  if (!signedIn && PROTECTED.some((route) => path.startsWith(route))) {
    const url = new URL(`${prefix}/giris`, request.url);
    url.searchParams.set("devam", `${prefix}${path}`);
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_ROUTES.some((route) => path.startsWith(route))) {
    return NextResponse.redirect(new URL(prefix || "/", request.url));
  }

  if (!locale) {
    /* ÖNEK YOKSA ÇEREZE BAKILIR — ve varsayılan dışı bir tercih varsa okuyucu
       kendi dilinin ADRESİNE yönlendirilir.

       Bunun sebebi tutarlılık: adres tek gerçek kaynak olmalı. Çerez sayfayı
       İngilizce çizip adres önekSİZ kalsaydı, o sayfadaki her bağlantı, her
       canonical ve `usePathname()`e bakan her istemci bileşeni "burası
       Türkçe" derdi. Yönlendirmeyle önek geri geliyor ve site içi gezinme
       önek düşürse bile kendini düzeltiyor.

       Çerezin rolü artık tek: "geçen sefer İngilizce seçmiştim" demek. */
    const preferred = request.cookies.get(LOCALE_COOKIE)?.value;
    if (isLocale(preferred) && preferred !== DEFAULT_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = withLocale(path, preferred);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  /* Önek varsa sayfa dosyası önekSİZ yolda duruyor: istek oraya yazılıyor ve
     dil başlıkla taşınıyor. Başlık İSTEĞE ekleniyor (yanıta değil): sayfa onu
     `headers()` ile okuyor, tarayıcıya hiç gitmiyor. */
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);

  const url = request.nextUrl.clone();
  url.pathname = path;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  /* Dil öneki HER rotada geçerli olduğu için eşleşme geniş; statik dosyalar,
     görsel iyileştirici ve Next'in kendi varlıkları dışarıda tutuluyor. */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|logos/|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)",
  ],
};
