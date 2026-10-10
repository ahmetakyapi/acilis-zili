"use client";

import { EASE_BRAND_POINTS } from "@/lib/motion";

import { Fragment, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScaleBar } from "@/components/markets/CompareScale";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { LogoTile } from "@/components/ui/primitives";
import { scaleRatios } from "@/lib/compare";
import type { MoveSet } from "@/lib/theme-stats";
import type { ThemeRow } from "@/lib/themes-data";
import {
  cn,
  directionOf,
  directionText,
  formatMoneyCompact,
  formatPercent,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import styles from "./Themes.module.css";

/**
 * Tema tablosu — şirket, son fiyat, günlük değişim, piyasa değeri.
 *
 * Kurallar karşılaştırma tablosundan (`/karsilastir`):
 *
 *   - Karşılaştırılan büyüklük bir de ÇİZGİ: günlük değişim ve piyasa
 *     değerinin altında ölçek çubuğu. Son fiyatta çubuk YOK — farklı
 *     şirketlerin hisse fiyatı karşılaştırılabilir bir ölçü değil.
 *   - Kaydırma saklanmaz: tabloya taban genişlik veriliyor, dar ekranda
 *     kap kayıyor ve şirket sütunu yapışkan kalıyor.
 *
 * GÜNLÜK DEĞİŞİMİN SEANSI (Veri dürüstlüğü 4): yüzde bu seansa ait değilse
 * yön rengini bırakıyor ve altında "Son Kapanış" künyesi duruyor — ana
 * sayfanın dünya piyasaları satırlarıyla aynı dil. Çubuk yalnızca medyana
 * giren (aynı günü anlatan) satırlara basılıyor.
 *
 * SIRALAMA İSTEMCİDE (28 Eylül). Yirmi satırlık bir tablo için sunucuya
 * dönmek ve adrese bir parametre eklemek gereksiz: adres ve arama motoruna
 * giden HTML aynı kalıyor (piyasa değerine göre), başlıktaki düğme yalnızca
 * satırların sırasını değiştiriyor. Ölçek oranları sıralamadan ÖNCE
 * hesaplanıp satıra bağlanıyor; sıra değişince çubuk kendi sayısıyla
 * birlikte taşınıyor. Satırlar yerlerine kayarak geçiyor (`layout`), hareket
 * azaltılmışsa tek karede.
 */

/** Şirket sütununun sabit genişliği ve bir sayı sütununun en darı —
    `/karsilastir` tablosunun ölçüleriyle aynı mantık: 390 pikselde üç
    sayı sütunu kaba sığıyor, altında kayıyor. */
const LABEL_COL_PX = 148;
const VALUE_COL_PX = 76;
const VALUE_COLS = 3;
/** Satır kayma süresi, saniye. */
const ROW_LAYOUT_S = 0.45;

type SortKey = "company" | "price" | "day" | "cap";
type SortDir = "asc" | "desc";

/** İlk tıklamada hangi yön: sayılarda büyükten küçüğe, adda A'dan Z'ye. */
const FIRST_DIR: Record<SortKey, SortDir> = { company: "asc", price: "desc", day: "desc", cap: "desc" };

export function ThemeTable({
  rows,
  benchmark,
  moves,
  locale,
  labels,
}: {
  rows: ThemeRow[];
  benchmark: (ThemeRow & { displayName: string }) | null;
  moves: MoveSet | null;
  locale: string;
  labels: {
    region: string;
    company: string;
    price: string;
    day: string;
    cap: string;
    benchmark: string;
    lastClose: string;
    sortBy: string;
  };
}) {
  const reduced = useMotionPreference();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cap", dir: "desc" });

  const scaled = useMemo(() => {
    const dayScale = scaleRatios(rows.map((row, i) => (moves?.included[i] ? row.changePct : null)));
    const capScale = scaleRatios(rows.map((row) => row.marketCap));
    return rows.map((row, i) => ({
      row,
      dayRatio: dayScale.ratios[i],
      daySigned: dayScale.signed,
      capRatio: capScale.ratios[i],
    }));
  }, [rows, moves]);

  const sorted = useMemo(() => {
    const value = (row: ThemeRow): number | string | null =>
      sort.key === "company"
        ? row.symbol
        : sort.key === "price"
          ? row.price
          : sort.key === "day"
            ? row.changePct
            : row.marketCap;
    const factor = sort.dir === "asc" ? 1 : -1;
    /* Değeri olmayan satır yön ne olursa olsun sonda kalır. */
    return [...scaled].sort((a, b) => {
      const av = value(a.row);
      const bv = value(b.row);
      if (av === null && bv === null) return a.row.symbol.localeCompare(b.row.symbol);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * factor;
      return (av - bv) * factor;
    });
  }, [scaled, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] },
    );

  const header = (key: SortKey, label: string, className: string) => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        className={className}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          className={styles.sortButton}
          data-active={active || undefined}
          data-dir={active ? sort.dir : undefined}
          aria-label={labels.sortBy.replace("{column}", label)}
          onClick={() => toggle(key)}
        >
          {label}
          {active && <ArrowDown weight="bold" size={11} className={styles.sortIcon} aria-hidden />}
        </button>
      </th>
    );
  };

  const renderDay = (row: ThemeRow, ratio: number | null | undefined, signed: boolean) => {
    if (row.changePct === null) return NO_VALUE;
    const lastClose = row.basis === "lastClose";
    return (
      <>
        <span
          className={cn(
            "numeral font-semibold",
            lastClose ? "text-muted" : directionText(directionOf(row.changePct)),
          )}
        >
          {formatPercent(row.changePct, locale)}
        </span>
        {lastClose && (
          <span className="block text-nano leading-tight text-muted">{labels.lastClose}</span>
        )}
        {ratio != null && <ScaleBar ratio={ratio} signed={signed} tone="signal" />}
      </>
    );
  };

  const nameCell = (row: ThemeRow, displayName?: string) => (
    <Link
      href={`/hisse/${row.symbol}`}
      prefetch={false}
      className="flex min-w-0 items-center gap-2.5 py-0.5 transition-colors hover:text-primary"
      /* Şirket kartı (components/ui/CompanyCard.tsx); ölçüt ETF'inin kaydı
         yok, onda kart açılmıyor. */
      data-cc={row.symbol}
    >
      <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
      <span className="min-w-0">
        <span className="numeral block text-small font-bold text-strong">{row.symbol}</span>
        <span className="block truncate text-tiny text-muted">
          {displayName ?? row.name ?? NO_VALUE}
        </span>
      </span>
    </Link>
  );

  const sticky =
    "sticky left-0 z-10 bg-(--panel-fixed) sm:static sm:z-auto sm:bg-transparent";

  return (
    <ScrollEdges
      className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
      tabIndex={0}
      role="region"
      aria-label={labels.region}
      fixedStart
    >
      <table
        className="w-full text-sm"
        style={{ minWidth: `${LABEL_COL_PX + VALUE_COLS * VALUE_COL_PX}px` }}
      >
        <thead>
          <tr className="border-y border-line-soft text-left text-nano text-muted">
            {header("company", labels.company, cn(sticky, "px-4 py-2.5 font-medium sm:px-5"))}
            {header("price", labels.price, "px-2 py-2.5 text-right font-medium sm:px-4")}
            {header("day", labels.day, "px-2 py-2.5 text-right font-medium sm:px-4")}
            {header("cap", labels.cap, "py-2.5 pl-2 pr-4 text-right font-medium sm:pl-4 sm:pr-5")}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {sorted.map(({ row, dayRatio, daySigned, capRatio }) => (
            <motion.tr
              key={row.symbol}
              layout={reduced ? false : "position"}
              transition={{ duration: ROW_LAYOUT_S, ease: EASE_BRAND_POINTS }}
            >
              <th scope="row" className={cn(sticky, "max-w-[220px] px-4 py-2 text-left font-normal sm:px-5")}>
                {nameCell(row)}
              </th>
              <td className="px-2 py-2 text-right align-top text-small sm:px-4 sm:text-base">
                <span className="numeral font-bold text-strong">
                  {row.price !== null ? formatPrice(row.price, locale) : NO_VALUE}
                </span>
              </td>
              <td className="px-2 py-2 text-right align-top text-small sm:px-4 sm:text-base">
                {renderDay(row, dayRatio, daySigned)}
              </td>
              <td className="py-2 pl-2 pr-4 text-right align-top text-small text-body sm:pl-4 sm:pr-5 sm:text-base">
                <span className="numeral">{formatMoneyCompact(row.marketCap, locale)}</span>
                {capRatio != null && <ScaleBar ratio={capRatio} signed={false} />}
              </td>
            </motion.tr>
          ))}
          {benchmark && (
            <Fragment>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={VALUE_COLS + 1}
                  className="bg-surface px-4 py-1.5 text-left sm:px-5"
                >
                  <span className="plate sticky left-4 text-nano">{labels.benchmark}</span>
                </th>
              </tr>
              <tr>
                <th scope="row" className={cn(sticky, "max-w-[220px] px-4 py-2 text-left font-normal sm:px-5")}>
                  {nameCell(benchmark, benchmark.displayName)}
                </th>
                <td className="px-2 py-2 text-right align-top text-small sm:px-4 sm:text-base">
                  <span className="numeral font-bold text-strong">
                    {benchmark.price !== null ? formatPrice(benchmark.price, locale) : NO_VALUE}
                  </span>
                </td>
                <td className="px-2 py-2 text-right align-top text-small sm:px-4 sm:text-base">
                  {/* Ölçüt satırı ölçeğe ve sıralamaya girmiyor: bir fon ile
                      şirketleri aynı çubukta sıralamak, fonu sepetin bir
                      üyesi gibi gösterirdi. */}
                  {renderDay(benchmark, null, false)}
                </td>
                <td className="py-2 pl-2 pr-4 text-right align-top text-small text-muted sm:pl-4 sm:pr-5 sm:text-base">
                  {NO_VALUE}
                </td>
              </tr>
            </Fragment>
          )}
        </tbody>
      </table>
    </ScrollEdges>
  );
}
