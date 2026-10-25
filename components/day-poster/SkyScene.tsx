"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import {
  SKY_MODES,
  buildingPath,
  skylineLayout,
  tagCovers,
  valueTag,
  type District,
  type SkyBuilding,
  type SkyLabel,
  type SkyLayout,
  type SkyModeName,
  type SkyRow,
  type SkyStock,
  type SkyValueTag,
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
 *   - ŞERİTTE BÜYÜK KART YALNIZ LOGOLU BİNADA (25 Ekim, "Silüet: etiket"
 *     turu; sahibi: ipucu logolu şirketlerde olsun). ETİKETSİZ BİNANIN
 *     DEĞERİ (25 Ekim gece, "Silüet: değer" turu; sahibi: "Artık diğer
 *     çubuklardaki değerler de yazabilir"): şeritte etiketsiz binaya gelince
 *     binanın TAM ucunda küçük bir değer etiketi (sembol + yüzde, logo ve
 *     kart yok; yerleşimi `valueTag`, lib/day-skyline.ts). Şehir sönmüyor,
 *     mahalle öne çıkmıyor: bina yalnız hafifçe aydınlanıyor (ışık sütunu
 *     ve kontur); etiketin altında kalan çatı etiketi o an sönüyor
 *     (`tagCovers`), iki yazı üst üste binmiyor. Posterde (ayrıntı ekranı)
 *     her binada büyük kart kalıyor.
 *   - İpucu ETİKETİN hizasında: yükselende etiketin üstünde, düşende
 *     altında (etiket yoksa çatıda). Eskiden çatıya açılıyordu; yana
 *     kaymış etiketle bina arasında kalıp ikisinden de kopuk duruyordu.
 *   - Tıklama: HER binada o şirketin sayfası (logolu ve logosuz tutarlı);
 *     şeritte BOŞLUKTA poster (şeridin başlığındaki "Posteri Aç" bağlantısı
 *     aynı yere gidiyor: klavye ve ekran okuyucu için asıl yol o).
 *     Dokunmatikte ilk dokunuş değeri (ipucunu) açar, aynı binaya ikinci
 *     dokunuş sayfayı; ipucundaki bağlantı da sayfayı.
 *   - Klavye: sahne tek sekme durağı (Tab sahneye girer, bir sonraki Tab
 *     sahneden çıkar); ok tuşları BÜTÜN binaları okuma sırasıyla geziyor
 *     (logoluda kart, ötekinde değer etiketi; canlı bölge her binada
 *     "SEMBOL, Ad, yüzde"), Enter şirketin sayfası, Esc kapatır.
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
      liveRef.current.textContent = i === null ? "" : `${stocks[i].symbol}, ${stocks[i].name}, ${pct(stocks[i].change)}`;
    },
    [stocks, pct],
  );

  const openStock = useCallback((i: number) => router.push(href(`/hisse/${stocks[i].symbol}`)), [router, href, stocks]);
  const openEmpty = useCallback(() => {
    if (emptyHref) router.push(href(emptyHref));
  }, [router, href, emptyHref]);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
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
                tags={variant === "strip"}
                hoverDistrict={district}
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
  tags,
  hoverDistrict,
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
  /** Etiketsiz binada büyük kart yerine değer etiketi (şerit). */
  tags: boolean;
  /** Fareyle üzerine gelinen mahalle adı. */
  hoverDistrict: string | null;
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
  const pointer = useRef<{ type: string; was: number | null }>({ type: "mouse", was: null });
  /* İSABET. Fare binanın SÜTUNUNU tutuyor (bina 2 birim de olsa dikey
     şeridin tamamı hedef; dataviz: isabet alanı işaretten büyük); çatı
     etiketi (logo karosu) de binasının hedefi. Şeritte boşluk tıklaması
     posteri açtığı için sütun gökte sonsuza uzanmıyor: binanın ucundan
     `REACH` birim ötesi boşluk. Her bina hedef (25 Ekim gece; etiket
     turunda şeritte yalnız etiketliler hedefti). */
  const targets = row.buildings;
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
  /* Şeritte etiketsiz binanın değer etiketi; altında kalan çatı etiketleri
     o an sönüyor. */
  const tag = useMemo<SkyValueTag | null>(
    () => (tags && activeB && !activeLabel ? valueTag(activeB, stocks[activeB.i], SKY_MODES[layout.mode]) : null),
    [tags, activeB, activeLabel, stocks, layout.mode],
  );
  const covered = useMemo(() => (tag ? new Set(tagCovers(tag, row.labels)) : null), [tag, row.labels]);
  /* Etkin binanın mahallesi de öne çıkıyor (klavyeyle gezerken nerede
     olduğun belli); değer etiketinde öne çıkmıyor (hafif dokunuş). */
  const focusDistrict = hoverDistrict ?? (activeB && !tag ? stocks[activeB.i].district : null);
  /* Ufkun sahnedeki yeri (kesir): gök üstünde, su altında. */
  const horizon = -row.top / height;
  /* Tabela ızgarası: sokak, mahalle, sokak … (sahne eninin yüzdesi). */
  const pctW = (w: number) => `${((Math.max(0, w) / layout.width) * 100).toFixed(4)}%`;
  const columns = row.districts
    .flatMap((span, j) => [pctW(span.x0 - (j === 0 ? 0 : row.districts[j - 1].x1)), pctW(span.x1 - span.x0)])
    .concat(pctW(layout.width - (row.districts.at(-1)?.x1 ?? 0)))
    .join(" ");

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
            pointer.current = { type: event.pointerType, was: active };
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
            /* Dokunmatik: binaya ilk dokunuş değeri (ipucunu) açtı, AYNI
               binaya ikinci dokunuş sayfasını açıyor; boşluğa dokunuş açık
               bir ipucunu kapatıyor, ipucu yokken posteri açıyor. */
            if (b && pointer.current.was === b.i) onOpen(b.i);
            else if (!b && pointer.current.was === null) onEmpty?.();
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
          <SkyCity layout={layout} row={row} rowIndex={rowIndex} stocks={stocks} district={focusDistrict} dimmed={activeB !== null && !tag} />
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
            muted={covered}
          />
          {tag && <ValueTag tag={tag} stock={stocks[tag.i]} font={SKY_MODES[layout.mode].font} pct={pct} />}
        </svg>
        {activeB && !tag && (
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
      <ul className={styles.districts} style={{ gridTemplateColumns: columns }} aria-hidden>
        {row.districts.map((span, j) => (
          <li
            key={span.key}
            className={styles.district}
            data-sky-district=""
            data-on={focusDistrict === span.key || undefined}
            data-off={focusDistrict !== null && focusDistrict !== span.key ? "" : undefined}
            style={{ gridColumn: j * 2 + 2 }}
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

/* ------------------------------------------------------------ DEĞER ETİKETİ */

/** Bağ çizgisinin çatıdaki noktası (birim) — çatı etiketininkiyle aynı. */
const TAG_ANCHOR_R = 2.4;
/** Sembol ile yüzde arası (punto katı) ve taban çizgisi (satırın kesri). */
const TAG_SPACE = 0.35;
const TAG_BASELINE = 0.8;

/**
 * Etiketsiz binanın değeri: sembol (metin mürekkebi) ve yüzde (yön
 * renginde), binanın ucunda. Kart yok; metnin çevresinde panelin zemin
 * tonunda ince bir hale var, binaların üstünde de okunuyor. Yeri
 * `valueTag`ten (lib/day-skyline.ts).
 */
function ValueTag({ tag, stock, font, pct }: { tag: SkyValueTag; stock: SkyStock; font: number; pct: (value: number) => string }) {
  const tone = stock.change > 0 ? styles.up : stock.change < 0 ? styles.down : styles.flat;
  const line = tag.h / tag.lines;
  const base = (n: number) => tag.y + line * n + line * TAG_BASELINE;
  return (
    <g className={styles.valueTag} data-sky-tag="">
      {tag.leader && (
        <>
          <line
            className={styles.tagLeader}
            x1={tag.leader.x}
            x2={tag.leader.x}
            y1={tag.leader.y1}
            y2={tag.leader.y2}
            vectorEffect="non-scaling-stroke"
          />
          <circle className={styles.tagAnchor} cx={tag.leader.x} cy={tag.leader.y1} r={TAG_ANCHOR_R} />
        </>
      )}
      {tag.lines === 1 ? (
        <text className={styles.tagText} x={tag.cx} y={base(0)} fontSize={font} textAnchor="middle">
          <tspan className={styles.tagSymbol}>{stock.symbol}</tspan>
          <tspan className={cn(styles.tagValue, tone)} dx={font * TAG_SPACE}>
            {pct(stock.change)}
          </tspan>
        </text>
      ) : (
        <>
          <text className={cn(styles.tagText, styles.tagSymbol)} x={tag.cx} y={base(0)} fontSize={font} textAnchor="middle">
            {stock.symbol}
          </text>
          <text className={cn(styles.tagText, styles.tagValue, tone)} x={tag.cx} y={base(1)} fontSize={font} textAnchor="middle">
            {pct(stock.change)}
          </text>
        </>
      )}
    </g>
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
