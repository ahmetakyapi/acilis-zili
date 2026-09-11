"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, List } from "@phosphor-icons/react/dist/ssr";
import { NAV_ITEMS, isActive } from "./nav-items";
import { useLocaleHref } from "./useLocaleHref";
import styles from "./NavOverflow.module.css";

/** Native disclosure keeps Tab/Enter and link navigation intact. It adds a
 * visible desktop entry to screens previously reachable only in the footer. */
export function NavOverflow({ label, labels }: { label: string; labels: Record<string, string> }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  const { href: L } = useLocaleHref();
  const items = NAV_ITEMS.filter(item => (!item.inMasthead || item.wideOnly) && item.href !== "/menu");
  const ordered = [...items].sort((a, b) => Number(b.href === "/teknik") - Number(a.href === "/teknik"));
  const active = items.some(item => !item.inMasthead && isActive(pathname, item.href));
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target) && ref.current) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  return <details ref={ref} className={styles.menu} data-active={active} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
  }}>
    <summary aria-label={label} title={label}><List size={17} weight="bold" /><span>{label}</span></summary>
    <div className={styles.popover}>
      {ordered.map(item => { const Icon = item.icon; const selected = isActive(pathname, item.href); return <Link key={item.href} href={L(item.href)} prefetch={false} data-featured={item.href === "/teknik"} className={item.wideOnly ? styles.wideOnly : undefined} aria-current={selected ? "page" : undefined} onClick={() => { if (ref.current) ref.current.open = false; }}>
        <Icon size={19} weight="duotone" /><span>{labels[item.href]}</span><ArrowUpRight size={13} />
      </Link>; })}
      <Link href={L("/menu")} className={styles.all} onClick={() => { if (ref.current) ref.current.open = false; }}><List size={17} /><span>{label}</span><ArrowUpRight size={13} /></Link>
    </div>
  </details>;
}
