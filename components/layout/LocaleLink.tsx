"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocaleHref } from "./useLocaleHref";

/** Filter links must target their current locale directly. Relying on the
 * preference-cookie redirect adds a network round trip to every selection. */
export function LocaleLink({ href, ...props }: ComponentProps<typeof Link>) {
  const { href: localized } = useLocaleHref();
  const destination = typeof href === "string"
    ? localized(href)
    : href.pathname && !href.host && !href.hostname && !href.protocol
      ? { ...href, pathname: localized(href.pathname) }
      : href;
  return <Link {...props} href={destination} />;
}
