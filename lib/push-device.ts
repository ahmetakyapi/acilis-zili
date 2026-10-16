/**
 * Cihaz künyesi — Ayarlar'daki listede hangi satırın hangi cihaz olduğunu
 * söylemeye yeter ("Chrome · Android"). Saf ve iki yerden okunuyor: sayfa
 * (`navigator.userAgent`, components/notifications/PushSettings.tsx) ve
 * service worker'ın yenileme ucu (`User-Agent` başlığı, app/api/push/yenile).
 * İki kopya olsaydı aynı cihaz iki ayrı adla görünürdü.
 */
export function deviceLabel(ua: string): string {
  const os = /iPhone|iPad/.test(ua)
    ? /iPad/.test(ua)
      ? "iPad"
      : "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "Mac"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "";
  return [browser, os].filter(Boolean).join(" · ").slice(0, 60);
}
