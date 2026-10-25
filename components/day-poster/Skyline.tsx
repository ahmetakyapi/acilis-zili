"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import {
  buildingPath,
  clipMark,
  skylineLayout,
  type District,
  type SkyBuilding,
  type SkyLayout,
  type SkyModeName,
  type SkyRow,
  type SkyStock,
} from "@/lib/day-skyline";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatMoneyCompact, formatPercent } from "@/lib/utils";
import { SkyLabels, SkyDefs } from "./SkyMarks";
import styles from "./Skyline.module.css";

/**
 * GÜNÜN SİLUETİ — sahnenin etkileşimli hâli (`/gun/[tarih]`, `/gun`).
 * Yerleşim saf modülde (`lib/day-skyline.ts`, gerekçesi orada); bu bileşen
 * onu çiziyor ve okutuyor.
 *
 * NEDEN SVG. Yüz bina ve on beş etiket SVG için hafif ve üç şey
 * kazandırıyor: sunucuda basılıyor (JS'siz de son hâliyle okunuyor), her
 * sıra `viewBox` ile kabın enine ölçekleniyor (yer tutucu yok, sayfa
 * kaymıyor), renkler CSS token'ından (tema değişince yeniden çizim yok).
 *
 * DÖRT DÜZEN, HEPSİ BASILI (`SKY_MODES`): telefon (üç sıra), tablet (iki
 * sıra), masaüstü ve geniş ekran (tek sıra). Görüneni kabın eni seçiyor
 * (CSS kap sorgusu, Skyline.module.css); görünmeyen `display:none`.
 *
 * OKUMA KATMANLARI:
 *   - Bakış: siluetin şekli. Hangi mahalle ufkun üstünde, hangisi suda;
 *     büyük şirketlerin çatısında logoları ve yüzdeleri.
 *   - Keşif: binaya gel ya da dokun → ipucu (logo, ad, değer, sektör,
 *     piyasa değeri); ipucundaki bağlantı şirketin sayfasını açıyor.
 *     İşaretçi binanın SÜTUNUNU tutuyor (bina 2 piksel de olsa dikey
 *     şeridin tamamı hedef; dataviz: isabet alanı işaretten büyük).
 *   - Klavye: sahne odaklanabilir; ok tuşları binaları soldan sağa
 *     geziyor (ipucu ve canlı bölge birlikte), Enter şirketin sayfasını
 *     açıyor. Tam liste "Tüm Şirketler"de, sektör sektör tablo (WCAG tablo
 *     ikizi).
 *
 * HAREKET: sahne ekrana girince binalar ufuktan sırayla yükseliyor ya da
 * suya iniyor (`delay`, `--ease-brand`, toplam ~1 sn), etiketler binalar
 * oturunca. Bir kez; hareketi azaltana son kare (CSS gizlemeyi yalnız
 * `no-preference`te yapıyor).
 */

type SkyText = Dictionary["daySignature"]["skyline"];

/** Sayfanın düzenleri — Skyline.module.css'teki kap sorgularıyla aynı sıra. */
const PAGE_MODES = ["narrow", "medium", "wide", "xwide"] as const satisfies readonly SkyModeName[];
/** Yüzde basamağı — posterin geri kalanıyla aynı. */
const PERCENT_DIGITS = 2;

export function Skyline({
  stocks,
  districts,
  names,
  logos,
  sized,
  locale,
  text,
  adv,
  dec,
}: {
  stocks: SkyStock[];
  districts: District[];
  /** Mahalle anahtarı → okunur ad. */
  names: Record<string, string>;
  /** Sembol → logo adresi (yalnız depoda olanlar). */
  logos: Record<string, string>;
  sized: boolean;
  locale: Locale;
  text: SkyText;
  adv: number;
  dec: number;
}) {
  const router = useRouter();
  const { href } = useLocaleHref();
  const rootRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const pct = useCallback((value: number) => formatPercent(value, locale, PERCENT_DIGITS), [locale]);

  const layouts = useMemo(
    () => PAGE_MODES.map((mode) => skylineLayout({ stocks, districts, mode })),
    [stocks, districts],
  );
  /* Soldan sağa okuma sırası: bütün düzenlerde aynı (sıralar mahalle
     sırasının bitişik parçaları). */
  const order = useMemo(() => districts.flatMap((district) => district.members), [districts]);

  /* GİRİŞ — sahne ekrana girince bir kez. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const open = () => root.setAttribute("data-in", "");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      open();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        open();
        io.disconnect();
      },
      { threshold: 0.15 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  /* Dokunmatikte ipucu, sahnenin dışına dokununca kapanıyor. */
  useEffect(() => {
    if (active === null) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node) || !rootRef.current?.contains(event.target)) setActive(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  const announce = useCallback(
    (i: number | null) => {
      if (!liveRef.current) return;
      liveRef.current.textContent = i === null ? "" : `${stocks[i].symbol}, ${stocks[i].name}: ${pct(stocks[i].change)}`;
    },
    [stocks, pct],
  );

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = active === null ? -1 : order.indexOf(active);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = order[Math.min(order.length - 1, at + 1)];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = order[Math.max(0, at - 1)];
    else if (event.key === "Home") next = order[0];
    else if (event.key === "End") next = order[order.length - 1];
    else if (event.key === "Enter" && active !== null) {
      event.preventDefault();
      router.push(href(`/hisse/${stocks[active].symbol}`));
      return;
    } else if (event.key === "Escape") {
      setActive(null);
      announce(null);
      return;
    } else return;
    event.preventDefault();
    setActive(next ?? null);
    announce(next ?? null);
  };

  const label = text.sceneLabel.replace("{adv}", String(adv)).replace("{dec}", String(dec));

  return (
    <div ref={rootRef} className={styles.skyline} data-skyline="">
      <div
        className={styles.scene}
        tabIndex={0}
        role="group"
        aria-label={label}
        onKeyDown={onKey}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(null);
        }}
      >
        {layouts.map((layout) => (
          <div key={layout.mode} className={styles.mode} data-mode={layout.mode}>
            {layout.rows.map((row, r) => (
              <SkyRowView
                key={r}
                layout={layout}
                row={row}
                rowIndex={r}
                stocks={stocks}
                names={names}
                logos={logos}
                active={active}
                onActive={setActive}
                onOpen={(i) => router.push(href(`/hisse/${stocks[i].symbol}`))}
                pct={pct}
                text={text}
                sized={sized}
                locale={locale}
              />
            ))}
          </div>
        ))}
      </div>
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <div className={styles.listWrap}>
        <button type="button" className={styles.listToggle} aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
          {listOpen ? text.allStocksClose : `${text.allStocks} (${stocks.length})`}
        </button>
        {listOpen && <StockTable stocks={stocks} districts={districts} names={names} text={text} pct={pct} locale={locale} sized={sized} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ SIRA */

function SkyRowView({
  layout,
  row,
  rowIndex,
  stocks,
  names,
  logos,
  active,
  onActive,
  onOpen,
  pct,
  text,
  sized,
  locale,
}: {
  layout: SkyLayout;
  row: SkyRow;
  rowIndex: number;
  stocks: SkyStock[];
  names: Record<string, string>;
  logos: Record<string, string>;
  active: number | null;
  onActive: (i: number | null) => void;
  onOpen: (i: number) => void;
  pct: (value: number) => string;
  text: SkyText;
  sized: boolean;
  locale: Locale;
}) {
  const height = row.bottom - row.top;
  const pointerType = useRef<string>("mouse");
  const hit = (event: PointerEvent<SVGSVGElement>): SkyBuilding | null => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * layout.width;
    let best: SkyBuilding | null = null;
    let dist = Infinity;
    for (const b of row.buildings) {
      const d = x < b.x ? b.x - x : x > b.x + b.w ? x - b.x - b.w : 0;
      if (d < dist) {
        dist = d;
        best = b;
      }
    }
    /* Sokakta (iki mahalle arası) hedef yok. */
    return dist <= layout.width * 0.012 ? best : null;
  };
  const activeB = active === null ? null : (row.buildings.find((b) => b.i === active) ?? null);

  return (
    <div className={styles.row}>
      <div className={styles.stage}>
        <svg
          viewBox={`0 ${row.top.toFixed(2)} ${layout.width} ${height.toFixed(2)}`}
          className={styles.svg}
          aria-hidden
          onPointerMove={(event) => {
            pointerType.current = event.pointerType;
            if (event.pointerType !== "mouse") return;
            const b = hit(event);
            onActive(b ? b.i : null);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") onActive(null);
          }}
          onPointerDown={(event) => {
            pointerType.current = event.pointerType;
            if (event.pointerType === "mouse") return;
            const b = hit(event);
            onActive(b ? b.i : null);
          }}
          onClick={(event) => {
            if (pointerType.current !== "mouse") return;
            const b = hit(event as unknown as PointerEvent<SVGSVGElement>);
            if (b) onOpen(b.i);
          }}
        >
          <SkyDefs layout={layout} row={row} rowIndex={rowIndex} />
          <rect className={styles.water} x={0} y={0} width={layout.width} height={row.downH} />
          <g className={styles.buildings}>
            {row.buildings.map((b) => (
              <path
                key={b.i}
                d={buildingPath(b)}
                className={cn(styles.b, b.dir === 1 ? styles.up : b.dir === -1 ? styles.down : styles.flat)}
                data-sky-building=""
                data-dir={b.dir}
                style={{ "--d": `${b.delay.toFixed(3)}s` } as CSSProperties}
              />
            ))}
            {row.buildings
              .filter((b) => b.clip)
              .map((b) => {
                const m = clipMark(b);
                return <rect key={`c${b.i}`} className={styles.cut} x={m.x} y={m.y} width={m.w} height={m.h} />;
              })}
          </g>
          <line className={styles.horizon} x1={0} x2={layout.width} y1={0} y2={0} />
          {activeB && (
            <path
              d={buildingPath(activeB)}
              className={cn(styles.focus, activeB.dir === 1 ? styles.up : activeB.dir === -1 ? styles.down : styles.flat)}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <SkyLabels layout={layout} row={row} rowIndex={rowIndex} stocks={stocks} logos={logos} pct={pct} className={styles.labels} />
        </svg>
        {activeB && <Tip b={activeB} row={row} layout={layout} stock={stocks[activeB.i]} district={names[stocks[activeB.i].district] ?? ""} logo={logos[stocks[activeB.i].symbol]} pct={pct} text={text} sized={sized} locale={locale} />}
      </div>
      <ul className={styles.districts} aria-hidden>
        {row.districts.map((span) => (
          <li
            key={span.key}
            className={styles.district}
            data-sky-district=""
            style={{ left: `${(span.x0 / layout.width) * 100}%`, width: `${((span.x1 - span.x0) / layout.width) * 100}%` }}
          >
            <span className={styles.districtName}>{names[span.key] ?? span.key}</span>
            <span className={cn(styles.districtValue, directionText(directionOf(span.change)))}>{pct(span.change)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ İPUCU */

function Tip({
  b,
  row,
  layout,
  stock,
  district,
  logo,
  pct,
  text,
  sized,
  locale,
}: {
  b: SkyBuilding;
  row: SkyRow;
  layout: SkyLayout;
  stock: SkyStock;
  district: string;
  logo: string | undefined;
  pct: (value: number) => string;
  text: SkyText;
  sized: boolean;
  locale: Locale;
}) {
  const height = row.bottom - row.top;
  const f = (b.x + b.w / 2) / layout.width;
  /* Yükselende çatının üstünde, düşende tabanın altında. */
  const edge = b.dir === -1 ? b.h : -b.h;
  const top = ((edge - row.top) / height) * 100;
  const style = {
    left: `${f * 100}%`,
    top: `${top}%`,
    "--tip-x": `${-f * 100}%`,
  } as CSSProperties;
  return (
    <div className={styles.tip} data-dir={b.dir === -1 ? "down" : "up"} style={style} role="presentation">
      <span className={styles.tipHead}>
        {logo ? <Image src={logo} alt="" width={20} height={20} unoptimized className={styles.tipLogo} /> : null}
        <span className={styles.tipSymbol}>{stock.symbol}</span>
        <span className={cn(styles.tipValue, directionText(directionOf(stock.change)))}>{pct(stock.change)}</span>
      </span>
      <span className={styles.tipName}>{stock.name}</span>
      <span className={styles.tipMeta}>
        {district}
        {stock.cap !== null && sized ? ` · ${text.tipCap.replace("{cap}", formatMoneyCompact(stock.cap, locale))}` : ""}
      </span>
      {b.clip && <span className={styles.tipMeta}>{text.tipClip}</span>}
      <Link href={`/hisse/${stock.symbol}`} className={styles.tipLink}>
        {stock.symbol} →
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ TABLO */

function StockTable({
  stocks,
  districts,
  names,
  text,
  pct,
  locale,
  sized,
}: {
  stocks: SkyStock[];
  districts: District[];
  names: Record<string, string>;
  text: SkyText;
  pct: (value: number) => string;
  locale: Locale;
  sized: boolean;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{text.colStock}</th>
            <th scope="col" className={styles.num}>{text.colChange}</th>
            {sized && <th scope="col" className={styles.num}>{text.colCap}</th>}
          </tr>
        </thead>
        <tbody>
          {districts.map((district) => (
            <Fragment key={district.key}>
              <tr className={styles.groupRow}>
                <th scope="colgroup" colSpan={sized ? 3 : 2}>
                  {names[district.key] ?? district.key}{" "}
                  <span className={directionText(directionOf(district.change))}>{pct(district.change)}</span>
                </th>
              </tr>
              {district.members.map((i) => (
                <tr key={stocks[i].symbol}>
                  <td>
                    <Link href={`/hisse/${stocks[i].symbol}`} className={styles.tableLink}>
                      <span className={styles.tableSymbol}>{stocks[i].symbol}</span>
                      <span className={styles.tableName}>{stocks[i].name}</span>
                    </Link>
                  </td>
                  <td className={cn(styles.num, directionText(directionOf(stocks[i].change)))}>{pct(stocks[i].change)}</td>
                  {sized && <td className={styles.num}>{stocks[i].cap !== null ? formatMoneyCompact(stocks[i].cap, locale) : ""}</td>}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
