"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import {
  buildingPath,
  skylineLayout,
  type District,
  type SkyBuilding,
  type SkyLabel,
  type SkyLayout,
  type SkyModeName,
  type SkyRow,
  type SkyStock,
} from "@/lib/day-skyline";
import type { StoryTone } from "@/lib/day-poster-story";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatMoneyCompact, formatPercent } from "@/lib/utils";
import { SkyCity, SkyDefs, SkyLabels } from "./SkyMarks";
import styles from "./SkyScene.module.css";

/**
 * SİLUETİN SAHNESİ — ana sayfanın şeridi (`variant="strip"`) ve Günün
 * Posteri'nin büyük siluetinin (`variant="poster"`) ORTAK etkileşimli
 * hâli (25 Ekim, "Silüet" turu). Yerleşim saf modülde
 * (`lib/day-skyline.ts`), çizim `SkyMarks.tsx`'te; burada sahnenin
 * penceresi (gök + su), etkileşim ve giriş.
 *
 * NEDEN ORTAK. Şerit sunucuda kendi çizimini basıyordu (etkileşimsiz, tek
 * bağlantı), poster ayrı bir istemci bileşeniydi; sahibi ikisini aynı
 * doğrultuda istedi. İki yüzey artık aynı gök, yansıma, çatı ışığı ve
 * pencere ritmini, aynı logo karosunu, aynı ipucunu ve klavyeyi kullanıyor;
 * yalnız düzenleri (`modes`) ve şeridin boşluk tıklaması farklı.
 *
 * NEDEN SVG + HTML. Binalar ve etiketler SVG (sunucuda basılıyor, JS'siz
 * de son hâliyle okunuyor, `viewBox` kabın enine ölçekleniyor, sayfa
 * kaymıyor). Gök ve su HTML katmanı: su sahnenin altından mahalle
 * tabelalarının arkasına kadar iniyor ve tabelalar HTML (ad satır
 * atlayabiliyor).
 *
 * OKUMA KATMANLARI:
 *   - Bakış: siluetin şekli; büyük şirketlerin ve uçların çatısında logo,
 *     sembol ve yüzde.
 *   - Keşif: binaya gel ya da dokun → bina aydınlanır (öteki binalar söner,
 *     binanın sütununda ince bir ışık), ipucunda logo, ad, yüzde, sektör ve
 *     piyasa değeri. Mahalle adına gel → o mahalle öne çıkar.
 *   - ŞERİTTE YALNIZ ETİKETLİ BİNALAR (25 Ekim, "Silüet: etiket" turu).
 *     Sahibi: ipucu logolu şirketlerde olsun, etiketsiz binada şeritte
 *     ipucu yok, ayrıntılar posterde. Şeritte etiketsiz binaya gelmek hiçbir
 *     şey yakmıyor; tıklaması boşluk gibi posteri açıyor. Posterde
 *     (ayrıntı ekranı) her bina etkileşimli kalıyor.
 *   - İpucu ETİKETİN hizasında: yükselende etiketin üstünde, düşende
 *     altında (etiket yoksa çatıda). Eskiden çatıya açılıyordu; yana
 *     kaymış etiketle bina arasında kalıp ikisinden de kopuk duruyordu.
 *   - Tıklama: binada o şirketin sayfası; şeritte BOŞLUKTA poster (şeridin
 *     başlığındaki "Posteri Aç" bağlantısı aynı yere gidiyor: klavye ve
 *     ekran okuyucu için asıl yol o). Dokunmatikte ilk dokunuş ipucunu
 *     açar, ipucundaki bağlantı sayfayı.
 *   - Klavye: sahne odaklanabilir; ok tuşları binaları okuma sırasıyla
 *     geziyor (ipucu ve canlı bölge birlikte), Enter şirketin sayfası, Esc
 *     kapatır. Şeritte yalnız GÖRÜNEN düzenin etiketli binaları arasında
 *     (düzenler etiketi farklı seçiyor; görüneni kap sorgusu belirliyor).
 *
 * HAREKET (bir kez, ekrana girince): gök tonu belirir, mahalleler ufuktan
 * sırayla yükselir, yansıma ardından suya iner, logolar en son oturur
 * (`SkyMarks.module.css`, zaman çizelgesi `RISE_*`). Hareketi azaltana
 * son kare.
 */

type SkyText = Dictionary["daySignature"]["skyline"];

/** Yüzde basamağı — posterin geri kalanıyla aynı. */
const PERCENT_DIGITS = 2;
/** Sokakta (iki mahalle arası) hedef yok: binaya en çok bu kadar (sahne eninin kesri). */
const HIT_SLACK = 0.012;
/** Şeritte binanın ucundan bu kadar ötesi (birim) boşluk sayılıyor. */
const REACH = 16;
/** Etkin binanın ışık sütununun bina kenarından taşması (birim). */
const BEAM_PAD = 3;

export function SkyScene({
  variant,
  modes,
  stocks,
  districts,
  names,
  logos,
  sized,
  locale,
  text,
  tone,
  label,
  emptyHref,
}: {
  variant: "strip" | "poster";
  modes: readonly SkyModeName[];
  stocks: SkyStock[];
  districts: District[];
  /** Mahalle anahtarı → okunur ad. */
  names: Record<string, string>;
  /** Sembol → logo adresi (yalnız depoda olanlar). */
  logos: Record<string, string>;
  sized: boolean;
  locale: Locale;
  text: SkyText;
  /** Günün tonu: gök şafak (yükseliş), alacakaranlık (düşüş) ya da arası. */
  tone: StoryTone;
  /** Sahnenin ekran okuyucu adı. */
  label: string;
  /** Şeritte boşluk tıklamasının gittiği yer (poster). */
  emptyHref?: string;
}) {
  const router = useRouter();
  const { href } = useLocaleHref();
  const rootRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const pct = useCallback((value: number) => formatPercent(value, locale, PERCENT_DIGITS), [locale]);

  const layouts = useMemo(() => modes.map((mode) => skylineLayout({ stocks, districts, mode })), [modes, stocks, districts]);
  /* Soldan sağa okuma sırası: bütün düzenlerde aynı (sıralar mahalle
     sırasının bitişik parçaları). */
  const order = useMemo(() => districts.flatMap((d) => d.members), [districts]);
  /* Düzen başına etkileşimli binalar: şeritte yalnız etiketliler (okuma
     sırasıyla), posterde hepsi (`null`). */
  const labelsOnly = variant === "strip";
  const interactive = useMemo(
    () =>
      layouts.map((layout) => {
        if (!labelsOnly) return null;
        const labelled = new Set(layout.rows.flatMap((row) => row.labels.map((label) => label.i)));
        return order.filter((i) => labelled.has(i));
      }),
    [layouts, labelsOnly, order],
  );

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
      { threshold: 0.2 },
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

  const openStock = useCallback((i: number) => router.push(href(`/hisse/${stocks[i].symbol}`)), [router, href, stocks]);
  const openEmpty = useCallback(() => {
    if (emptyHref) router.push(href(emptyHref));
  }, [router, href, emptyHref]);

  /* Klavyenin gezdiği sıra: görünen düzenin etkileşimli binaları. */
  const keyOrder = (): readonly number[] => {
    const shown = rootRef.current
      ? [...rootRef.current.querySelectorAll<HTMLElement>("[data-mode]")].find((el) => el.getClientRects().length > 0)
      : undefined;
    const index = shown ? modes.indexOf(shown.dataset.mode as SkyModeName) : -1;
    return (index >= 0 ? interactive[index] : null) ?? order;
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const order = keyOrder();
    if (order.length === 0) return;
    const at = active === null ? -1 : order.indexOf(active);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = order[Math.min(order.length - 1, at + 1)];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = order[Math.max(0, at - 1)];
    else if (event.key === "Home") next = order[0];
    else if (event.key === "End") next = order[order.length - 1];
    else if (event.key === "Enter" && active !== null) {
      event.preventDefault();
      openStock(active);
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

  /* Etkin binanın mahallesi de öne çıkıyor (klavyeyle gezerken nerede
     olduğun belli). */
  const focusDistrict = district ?? (active !== null ? stocks[active].district : null);

  return (
    <div ref={rootRef} className={styles.root} data-variant={variant} data-tone={tone} data-sky-scene="">
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
        {layouts.map((layout, m) => (
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
                interactive={interactive[m]}
                focusDistrict={focusDistrict}
                onActive={setActive}
                onDistrict={setDistrict}
                onOpen={openStock}
                onEmpty={emptyHref ? openEmpty : undefined}
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
  interactive,
  focusDistrict,
  onActive,
  onDistrict,
  onOpen,
  onEmpty,
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
  /** Etkileşimli binalar (şeritte etiketliler); `null` hepsi. */
  interactive: readonly number[] | null;
  focusDistrict: string | null;
  onActive: (i: number | null) => void;
  onDistrict: (key: string | null) => void;
  onOpen: (i: number) => void;
  onEmpty?: () => void;
  pct: (value: number) => string;
  text: SkyText;
  sized: boolean;
  locale: Locale;
}) {
  const height = row.bottom - row.top;
  const pointer = useRef<{ type: string; hadTip: boolean }>({ type: "mouse", hadTip: false });
  /* İSABET. Fare binanın SÜTUNUNU tutuyor (bina 2 birim de olsa dikey
     şeridin tamamı hedef; dataviz: isabet alanı işaretten büyük); çatı
     etiketi (logo karosu) de binasının hedefi. Şeritte boşluk tıklaması
     posteri açtığı için sütun gökte sonsuza uzanmıyor: binanın ucundan
     `REACH` birim ötesi boşluk. Şeritte yalnız etiketli binalar hedef;
     etiketsiz bina boşluk sayılıyor (tıklaması posteri açıyor). */
  const targets = useMemo(() => {
    if (!interactive) return row.buildings;
    const allowed = new Set(interactive);
    return row.buildings.filter((b) => allowed.has(b.i));
  }, [row.buildings, interactive]);
  const hit = (event: PointerEvent<SVGSVGElement>): SkyBuilding | null => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * layout.width;
    const y = row.top + ((event.clientY - box.top) / box.height) * height;
    const onLabel = row.labels.find((l) => x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
    if (onLabel) return targets.find((b) => b.i === onLabel.i) ?? null;
    let best: SkyBuilding | null = null;
    let dist = Infinity;
    for (const b of targets) {
      const d = x < b.x ? b.x - x : x > b.x + b.w ? x - b.x - b.w : 0;
      if (d < dist) {
        dist = d;
        best = b;
      }
    }
    if (!best || dist > layout.width * HIT_SLACK) return null;
    if (onEmpty) {
      const top = best.dir === 1 ? -best.h : best.dir === -1 ? 0 : -best.h / 2;
      const bottom = best.dir === 1 ? 0 : best.dir === -1 ? best.h : best.h / 2;
      if (y < top - REACH || y > bottom + REACH) return null;
    }
    return best;
  };
  const activeB = active === null ? null : (targets.find((b) => b.i === active) ?? null);
  const activeLabel = activeB ? (row.labels.find((label) => label.i === activeB.i) ?? null) : null;
  /* Ufkun sahnedeki yeri (kesir): gök üstünde, su altında. */
  const horizon = -row.top / height;

  return (
    <div className={styles.row} style={{ "--hz": horizon.toFixed(4) } as CSSProperties}>
      <div className={styles.stage}>
        <span className={styles.sky} aria-hidden />
        <span className={styles.water} aria-hidden />
        <svg
          viewBox={`0 ${row.top.toFixed(2)} ${layout.width} ${height.toFixed(2)}`}
          className={styles.svg}
          aria-hidden
          onPointerMove={(event) => {
            pointer.current.type = event.pointerType;
            if (event.pointerType !== "mouse") return;
            const b = hit(event);
            onActive(b ? b.i : null);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") onActive(null);
          }}
          onPointerDown={(event) => {
            pointer.current = { type: event.pointerType, hadTip: active !== null };
            if (event.pointerType === "mouse") return;
            const b = hit(event);
            onActive(b ? b.i : null);
          }}
          onClick={(event) => {
            const b = hit(event as unknown as PointerEvent<SVGSVGElement>);
            if (pointer.current.type === "mouse") {
              if (b) onOpen(b.i);
              else onEmpty?.();
              return;
            }
            /* Dokunmatik: binaya dokunuş ipucunu açtı; boşluğa dokunuş
               açık bir ipucunu kapatıyor, ipucu yokken posteri açıyor. */
            if (!b && !pointer.current.hadTip) onEmpty?.();
          }}
        >
          <SkyDefs layout={layout} row={row} rowIndex={rowIndex} />
          {activeB && (
            <rect
              className={styles.beam}
              x={activeB.x - BEAM_PAD}
              y={row.top}
              width={activeB.w + BEAM_PAD * 2}
              height={height}
              rx={BEAM_PAD}
            />
          )}
          <SkyCity layout={layout} row={row} rowIndex={rowIndex} stocks={stocks} district={focusDistrict} dimmed={activeB !== null} />
          {activeB && (
            <path
              d={buildingPath(activeB)}
              className={cn(styles.focus, activeB.dir === 1 ? styles.up : activeB.dir === -1 ? styles.down : styles.flat)}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <SkyLabels
            layout={layout}
            row={row}
            rowIndex={rowIndex}
            stocks={stocks}
            logos={logos}
            pct={pct}
            district={focusDistrict}
            active={active}
          />
        </svg>
        {activeB && (
          <Tip
            b={activeB}
            label={activeLabel}
            row={row}
            layout={layout}
            stock={stocks[activeB.i]}
            district={names[stocks[activeB.i].district] ?? ""}
            logo={logos[stocks[activeB.i].symbol]}
            pct={pct}
            text={text}
            sized={sized}
            locale={locale}
          />
        )}
      </div>
      <ul className={styles.districts} aria-hidden>
        {row.districts.map((span) => (
          <li
            key={span.key}
            className={styles.district}
            data-sky-district=""
            data-on={focusDistrict === span.key || undefined}
            data-off={focusDistrict !== null && focusDistrict !== span.key ? "" : undefined}
            style={{ left: `${(span.x0 / layout.width) * 100}%`, width: `${((span.x1 - span.x0) / layout.width) * 100}%` }}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") onDistrict(span.key);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") onDistrict(null);
            }}
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
  label,
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
  /** Binanın etiketi: ipucu onun hizasında açılıyor. */
  label: SkyLabel | null;
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
  /* Etiketin ekseninde (binanınkinden en çok `LABEL_MAX_SHIFT` uzak);
     yükselende etiketin (yoksa çatının) üstünde, düşende altında. */
  const f = (label ? label.x + label.w / 2 : b.x + b.w / 2) / layout.width;
  const edge = label ? (b.dir === -1 ? label.y + label.h : label.y) : b.dir === -1 ? b.h : -b.h;
  const top = ((edge - row.top) / height) * 100;
  const style = {
    left: `${f * 100}%`,
    top: `${top}%`,
    "--tip-x": `${-f * 100}%`,
  } as CSSProperties;
  return (
    <div className={styles.tip} data-dir={b.dir === -1 ? "down" : "up"} style={style} role="presentation">
      <span className={styles.tipHead}>
        {logo ? <Image src={logo} alt="" width={28} height={28} unoptimized className={styles.tipLogo} /> : null}
        <span className={styles.tipId}>
          <span className={styles.tipSymbol}>{stock.symbol}</span>
          <span className={styles.tipName}>{stock.name}</span>
        </span>
        <span className={cn(styles.tipValue, directionText(directionOf(stock.change)))}>{pct(stock.change)}</span>
      </span>
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
