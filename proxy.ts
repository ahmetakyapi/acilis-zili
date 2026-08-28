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

/** Dil çerezinin ömrü — `app/actions/preferences.ts` ile aynı. */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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
  const response = NextResponse.rewrite(url, { request: { headers } });

  /* ÖNEKLİ ADRESE GELMEK DE BİR DİL SEÇİMİDİR — çerez burada yazılıyor.
     Yukarıdaki not "site içi gezinme önek düşürse bile kendini düzeltiyor"
     diyor ve bu, ÇEREZİ OLAN okuyucu için doğru. Çerezi olmayan için değildi:
     arama sonucundan ya da paylaşılan bir bağlantıdan `/en/...` açan okuyucu,
     önek taşımayan ilk bağlantıya bastığı anda sessizce Türkçeye düşüyordu.
     Ölçüldü — İngilizce sayfalarda önek taşımayan bağlantı sayısı sayfa
     başına 37 ile 96 arasında, yani düşüş neredeyse kaçınılmazdı.

     Çerez yalnızca EKSİKSE ya da FARKLIYSA yazılıyor: her istekte
     `Set-Cookie` göndermek yanıtı önbelleklenemez hâle getirirdi.

     BESLEME BU KORUMANIN DIŞINDA KALIYORDU. Koşul çerezi olmayan istemciyi
     korumuyor — `undefined !== "en"` her seferinde doğru, yani /en/feed.xml'e
     gelen HER yanıt `Set-Cookie` taşıyordu ve besleme hiçbir zaman kenar
     önbelleğine girmiyordu. Bir RSS istemcisi çerez taşımaz ve zaten çereze
     ihtiyacı yok: beslemenin dili adresin kendisinde. Yazmayı orada atlamak
     hem yanıtı önbelleklenebilir kılıyor hem de anlamsız bir çerezi
     göndermiyor. */
  if (
    path !== "/feed.xml" &&
    request.cookies.get(LOCALE_COOKIE)?.value !== locale
  ) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  /* Dil öneki HER rotada geçerli olduğu için eşleşme geniş; statik dosyalar,
     görsel iyileştirici ve Next'in kendi varlıkları dışarıda tutuluyor.

     `api/`, `robots.txt`, `sitemap.xml` ve `manifest.webmanifest` DE dışarıda.
     Next 16'da `proxy` Edge'de değil Node.js çalışma zamanında koşuyor, yani
     her çalışması bir fonksiyon çağrısı; bu dört yol ise dili hiç
     kullanmıyor (`robots.ts`, `sitemap.ts` ve `manifest.ts` dosyalarında
     `getLocale` çağrısı yok, denetlendi).

     API için bu bir davranış değişikliği DEĞİL. İstemciden atılan çağrıların
     hepsi öneksiz (`/api/olcum`, `/api/search`, `/api/chart/...`), yani
     `LOCALE_HEADER` o uçlara zaten ulaşmıyordu. Dili okuyan iki uç var
     (`/api/search`, `/api/takvim`) ve ikisi de `getLocale()` kullanıyor;
     o fonksiyon başlık yoksa ÇEREZE düşüyor ve düşmeye devam ediyor.

     Kazanç bunun da ötesinde: yukarıdaki çerez yönlendirmesi, İngilizce
     tercihli okuyucunun `/api/search` çağrısına 307 dönüp onu
     `/en/api/search`e yolluyordu — ölçüldü. Her arama tuşuna basışta bir
     gidiş-dönüş ve iki fonksiyon çalıştırması boşa gidiyordu.

     `feed.xml` LİSTEDE YOK, bilerek: o gerçekten `LOCALE_HEADER` okuyor
     (route.ts:62) ve `/en/feed.xml` İngilizce yayın vermeye devam etmeli. */
  matcher: [
    "/((?!api/|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|_next/static|_next/image|favicon.ico|icon.svg|apple-icon|logos/|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)",
  ],
};
