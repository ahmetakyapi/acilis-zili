import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16'da `middleware` yerini `proxy` aldı.
 *
 * Burada yalnızca oturum çerezinin varlığına bakılır — ucuz bir ön eleme.
 * Gerçek doğrulama sayfa ve server action'larda `auth()` ile yapılır.
 */

/* `/admin` BİLEREK BU LİSTEDE DEĞİL. Buradaki koruma girişe yönlendiriyor ve
   "giriş yap, sonra /admin'e devam edeceksin" demek, olmayan bir kapının VAR
   olduğunu söylemek olurdu. Panelin kapısı `app/admin/layout.tsx` içinde ve
   yetkisiz herkese — giriş yapmışa da yapmamışa da — 404 döndürüyor. */
const PROTECTED = ["/favoriler", "/ayarlar"];
const AUTH_ROUTES = ["/giris", "/kayit"];

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = hasSessionCookie(request);

  if (!signedIn && PROTECTED.some((route) => pathname.startsWith(route))) {
    const url = new URL("/giris", request.url);
    url.searchParams.set("devam", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/favoriler/:path*", "/ayarlar/:path*", "/giris", "/kayit"],
};
