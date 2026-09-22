"use client";

import Form from "next/form";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { startRouteProgress } from "@/components/layout/RouteProgress";
import type { Dictionary } from "@/lib/i18n";
import styles from "./CompanyDirectory.module.css";

/** Search the complete directory on the server, before sorting and pagination. */
export function CompanySearch({ action, query, sector, sort, direction, labels }: {
  action: string; query: string; sector?: string; sort: string; direction: string;
  labels: Dictionary["companies"];
}) {
  return <Form action={action} scroll={false} prefetch={false} role="search"
    className={styles.search}
    onSubmit={event => {
      const params = new URLSearchParams();
      new FormData(event.currentTarget).forEach((value, key) => {
        if (typeof value === "string") params.append(key, value);
      });
      const target = `${action}?${params}`;
      if (target !== `${window.location.pathname}${window.location.search}`) startRouteProgress(target);
    }}>
    <label htmlFor="company-query">{labels.searchLabel}</label>
    <div className={styles.searchField}>
      <MagnifyingGlass aria-hidden size={18} />
      <input key={query} id="company-query" name="q" type="search" defaultValue={query}
        placeholder={labels.searchPlaceholder} maxLength={100} autoComplete="off" />
      <button type="submit">{labels.searchSubmit}</button>
    </div>
    <input type="hidden" name="sirala" value={sort} />
    <input type="hidden" name="yon" value={direction} />
    {sector && <input type="hidden" name="sektor" value={sector} />}
  </Form>;
}
