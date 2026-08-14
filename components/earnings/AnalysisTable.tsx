"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import {
  foldForSearch,
  verdictPillClass,
  verdictTextClass,
  type AnalysisRowView,
  type CellTone,
} from "@/lib/analysis";
import { LogoTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Son Analizler tablosu — arama kutusuyla birlikte.
 *
 * İSTEMCİ bileşeni, çünkü arama her tuş vuruşunda süzmeli. Sunucu tarafı bir
 * filtre `?ara=` ile de yapılabilirdi ama her harfte bir gezinme demekti;
 * elli-altmış satırlık bir listede bunun karşılığı yok.
 *
 * Sözlüğün tamamı istemciye TAŞINMIYOR: hücre metinleri sunucuda hesaplanıp
 * `AnalysisRowView` olarak geliyor (bkz. `lib/analysis.ts` →
 * `toAnalysisRowView`), buraya yalnızca basılacak dizeler ve on beş etiket
 * ulaşıyor. Biçimlendirme de böylece sunucuda ve dile göre kalıyor.
 *
 * Sayı hücreleri mono `.figure` DEĞİL, tabular `.numeral`. Dokuz sütunluk
 * yoğun bir satırda daktilo genişliğindeki rakamlar hem yer yiyor hem de
 * satırı gürültülü gösteriyordu; mono, metrik kartlarındaki büyük tek
 * sayılarda kalıyor. Grafik etiketleri de aynı yolu izledi.
 *
 * Gerçek bir `<table>` değil: satırın tamamı tıklanabilir olmalı ve `<tr>`
 * üzerine yayılan bağlantı hiçbir tarayıcıda güvenilir çalışmıyor. Izgara
 * rollerle duyuruluyor, hücre genişlikleri sabit — sayı sütunları satırdan
 * satıra aynı hizada kalsın diye. Dar ekranda tablo YATAY kayar; dokuz
 * sütunu üst üste yığmak satırı bir kartın kötü taklidine çeviriyordu.
 */

export type AnalysisTableLabels = {
  /** Yatay kaydırılan kabın adı — klavyeyle odaklanınca duyurulur. */
  tableRegion: string;
  colSymbol: string;
  colCompany: string;
  colReported: string;
  colRevenue: string;
  colEps: string;
  colReaction: string;
  colScore: string;
  colVerdict: string;
  colCard: string;
  cardLink: string;
  searchPlaceholder: string;
  /** "{query}" yer tutucusu taşır. */
  searchEmpty: string;
  searchClear: string;
  /** "{count}" yer tutucusu taşır. */
  resultCount: string;
};

const COLS = {
  symbol: "w-[104px] shrink-0",
  company: "min-w-[190px] flex-1",
  reported: "w-[124px] shrink-0",
  revenue: "w-28 shrink-0 text-right",
  eps: "w-[124px] shrink-0 text-right",
  reaction: "w-[86px] shrink-0 text-right",
  score: "w-[78px] shrink-0 text-center",
  verdict: "w-14 shrink-0 text-center",
  card: "w-[70px] shrink-0 text-right",
} as const;

function toneClass(tone: CellTone): string {
  return tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted";
}

export function AnalysisTable({
  rows,
  labels,
  highlightFirst = false,
  toolbar,
}: {
  rows: AnalysisRowView[];
  labels: AnalysisTableLabels;
  /** İlk satır "Günün Analizi" olarak ayrıca gösteriliyorsa işaretlenir. */
  highlightFirst?: boolean;
  /** Arama kutusunun yanına giren sunucu tarafı denetimler (sıralama). */
  toolbar?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = foldForSearch(query.trim());
    if (!needle) return rows;
    /* Boşlukla ayrılmış her parça ayrı aranıyor: "sandisk 4ç" da bulsun. */
    const parts = needle.split(/\s+/);
    return rows.filter((row) => parts.every((part) => row.search.includes(part)));
  }, [rows, query]);

  const searching = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
          <MagnifyingGlass
            weight="duotone"
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={labels.searchPlaceholder}
            className={cn(
              "h-10 w-full min-w-0 rounded-md border border-line bg-surface pl-9 pr-9 text-[13px] text-strong",
              "placeholder:text-muted focus:border-line-focus focus:outline-none",
              // Safari'nin kendi temizleme düğmesi bizimkiyle üst üste biniyor.
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={labels.searchClear}
              className="absolute right-2 inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-elevated hover:text-strong"
            >
              <X weight="bold" size={12} />
            </button>
          )}
        </label>

        {searching && (
          <span className="numeral shrink-0 text-[12px] text-muted">
            {labels.resultCount.replace("{count}", String(visible.length))}
          </span>
        )}

        {toolbar && <div className="ml-auto shrink-0">{toolbar}</div>}
      </div>

      <div className="panel overflow-hidden">
        {/* KAYDIRMA KABI KLAVYEYLE ERİŞİLEBİLİR. Tablo 1180px genişliğinde ve
            kendi kabında yatay kayıyor; Chrome ve Safari kaydırılabilir kaplara
            kendiliğinden odak VERMİYOR (Firefox veriyor). Yani fare
            kullanmayan biri sağdaki sütunlara — puan, karne, tarih — hiç
            ulaşamıyordu. `tabIndex={0}` kabı bir durağa çeviriyor, `role`
            ve `aria-label` de onu adlandırıyor: ekran okuyucu "kaydırılabilir
            bölge, Analizler" diyor ve ok tuşları çalışıyor. */}
        {/* ÇUBUK GÖRÜNÜR (`scroll-x-hint`), gizli değil. 390px'lik telefonda
            kap 352px ve içerik 1180px: içeriğin yalnızca %30'u görünüyor ve
            gelir, EPS, tepki, skor, karar sütunlarının hepsi ekran dışında
            kalıyor. Gizli çubuk burada "devamı var" işaretini de siliyordu;
            `scroll-x-hint` tam bu durum için yazılmış ince bir çubuk. */}
        <div
          className="scroll-x-hint overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label={labels.tableRegion}
        >
          <div className="min-w-[1180px]" role="table">
            <div
              role="row"
              className="flex items-center gap-4 border-b border-line px-4 py-3.5 text-[11px] font-bold text-muted sm:px-[22px]"
            >
              <span role="columnheader" className={COLS.symbol}>
                {labels.colSymbol}
              </span>
              <span role="columnheader" className={COLS.company}>
                {labels.colCompany}
              </span>
              <span
                role="columnheader"
                className={cn(COLS.reported, "whitespace-nowrap")}
              >
                {labels.colReported}
              </span>
              <span
                role="columnheader"
                className={cn(COLS.revenue, "whitespace-nowrap")}
              >
                {labels.colRevenue}
              </span>
              <span role="columnheader" className={cn(COLS.eps, "whitespace-nowrap")}>
                {labels.colEps}
              </span>
              <span
                role="columnheader"
                className={cn(COLS.reaction, "whitespace-nowrap")}
              >
                {labels.colReaction}
              </span>
              <span role="columnheader" className={COLS.score}>
                {labels.colScore}
              </span>
              <span role="columnheader" className={COLS.verdict}>
                {labels.colVerdict}
              </span>
              <span role="columnheader" className={COLS.card}>
                {labels.colCard}
              </span>
            </div>

            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-body sm:px-[22px]">
                {labels.searchEmpty.replace("{query}", query.trim())}
              </p>
            ) : (
              visible.map((row, index) => (
                /* SATIR BİR BAĞLANTI DEĞİL, İÇİNDE BAĞLANTI TAŞIYOR.
                   Önce `<Link role="row">` yazılıydı ve `role="row"`
                   elemanın kendi `link` rolünü TAMAMEN eziyordu: ekran
                   okuyucu satırı bağlantı olarak duyurmuyor, bağlantı
                   listesinde göstermiyor, "bağlantıya git" komutlarıyla
                   ulaşılamıyordu — Tab'lanabiliyor ama odaklandığında
                   yalnızca "satır" deniyordu.

                   Artık satır `div[role="row"]`, tıklama alanı ise sembol
                   hücresindeki gerçek bağlantının mutlak konumlu kaplaması.
                   Bağlantı satırın tamamını kaplıyor, görünüm değişmiyor. */
                <div
                  key={row.key}
                  role="row"
                  className={cn(
                    "relative flex items-center gap-4 border-b border-line-soft px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-elevated sm:px-[22px]",
                    highlightFirst && !searching && index === 0 && "bg-primary-tint",
                  )}
                >
                  <Link
                    href={row.href}
                    prefetch={false}
                    aria-label={row.linkLabel}
                    className="absolute inset-0 z-10 rounded-(--radius-sm)"
                  />
                  {/* Logo + sembol tek hücrede: tablo satırı yalnızca sayı
                      dizisiyken hepsi birbirinin aynıydı, logo satırı bir
                      bakışta tanınır kılıyor. */}
                  <span
                    role="cell"
                    className={cn(COLS.symbol, "flex items-center gap-2.5")}
                  >
                    <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                    <span
                      className={cn(
                        "text-[13.5px] font-bold",
                        highlightFirst && !searching && index === 0
                          ? "text-primary"
                          : "text-strong",
                      )}
                    >
                      {row.symbol}
                    </span>
                  </span>
                  <span
                    role="cell"
                    className={cn(COLS.company, "truncate text-[13.5px] text-body")}
                  >
                    <b className="font-bold text-strong">{row.company}</b>
                    {" · "}
                    {row.periodLabel}
                  </span>
                  <span
                    role="cell"
                    className={cn(
                      COLS.reported,
                      "whitespace-nowrap text-[12.5px] text-muted",
                    )}
                  >
                    {row.reported}
                  </span>
                  <span
                    role="cell"
                    className={cn(
                      COLS.revenue,
                      "numeral whitespace-nowrap text-[13.5px] font-bold",
                      toneClass(row.revenueTone),
                    )}
                  >
                    {row.revenue}
                  </span>
                  <span
                    role="cell"
                    className={cn(
                      COLS.eps,
                      "numeral whitespace-nowrap text-[13.5px] font-bold",
                      toneClass(row.epsTone),
                    )}
                  >
                    {row.eps}
                  </span>
                  <span
                    role="cell"
                    className={cn(
                      COLS.reaction,
                      "numeral whitespace-nowrap text-[13.5px] font-bold",
                      toneClass(row.reactionTone),
                    )}
                  >
                    {row.reaction}
                  </span>
                  <span role="cell" className={cn(COLS.score, "flex justify-center")}>
                    <span
                      className={cn(
                        "numeral rounded-full px-2.5 py-[3.5px] text-[12.5px] font-bold",
                        verdictPillClass(row.verdict),
                      )}
                    >
                      {row.score}
                    </span>
                  </span>
                  <span
                    role="cell"
                    className={cn(
                      COLS.verdict,
                      "text-[13.5px] font-bold",
                      verdictTextClass(row.verdict),
                    )}
                  >
                    {row.verdictText}
                  </span>
                  <span
                    role="cell"
                    className={cn(
                      COLS.card,
                      "text-[12.5px] font-semibold text-primary",
                    )}
                  >
                    {labels.cardLink}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
