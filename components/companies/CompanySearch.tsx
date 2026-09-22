"use client";

import Form from "next/form";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
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
    {/* AYRI ETİKET SATIRI YOK. "Şirket Bul" kendi satırını kaplıyor ve altında
        dolgulu, mavi düğmeli bir form kutusu duruyordu: dizinin kapağında bu
        bir ARAÇ olmalı, doldurulacak bir form değil. Etiket görünmez ama
        ekran okuyucuya duruyor; gönderme düğmesi alanın içinde, yalnızca
        simge — klavyede zaten Enter gönderiyor. */}
    <label className="sr-only" htmlFor="company-query">{labels.searchLabel}</label>
    <div className={styles.searchField}>
      <MagnifyingGlass aria-hidden size={17} />
      <input key={query} id="company-query" name="q" type="search" defaultValue={query}
        placeholder={labels.searchPlaceholder} maxLength={100} autoComplete="off" />
      <button type="submit" aria-label={labels.searchSubmit}>
        <ArrowRight aria-hidden size={15} weight="bold" />
      </button>
    </div>
    <input type="hidden" name="sirala" value={sort} />
    <input type="hidden" name="yon" value={direction} />
    {sector && <input type="hidden" name="sektor" value={sector} />}
  </Form>;
}
