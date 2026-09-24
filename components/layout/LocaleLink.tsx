"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocaleHref } from "./useLocaleHref";

/** Filter links must target their current locale directly. Relying on the
 * preference-cookie redirect adds a network round trip to every selection. */
export function LocaleLink({
  href,
  prefetchOnIntent,
  ...props
}: ComponentProps<typeof Link> & {
  /**
   * Tam ön yükleme yalnızca NİYETTE: görünürken hafif (`auto`), fare üstüne
   * gelince ya da dokunuş başlayınca tam. Next'in `unstable_dynamicOnHover`
   * seçeneği; `next/link`in tip tanımı onu henüz dışa açmıyor, o yüzden tek
   * bir yerde, burada sarılı. Gerekçe başlık sekmelerinde (MastheadNav).
   */
  prefetchOnIntent?: boolean;
}) {
  const { href: localized } = useLocaleHref();
  const destination = typeof href === "string"
    ? localized(href)
    : href.pathname && !href.host && !href.hostname && !href.protocol
      ? { ...href, pathname: localized(href.pathname) }
      : href;
  const intent = prefetchOnIntent
    ? ({ prefetch: null, unstable_dynamicOnHover: true } as Record<string, unknown>)
    : {};
  return <Link {...props} {...intent} href={destination} />;
}
