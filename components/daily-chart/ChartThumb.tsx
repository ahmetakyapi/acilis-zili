import type { CSSProperties } from "react";
import { LogoTile } from "@/components/ui/primitives";
import { checkChartBlock } from "@/lib/daily-chart";
import { boardTiles, type TileDir } from "@/lib/daily-chart-board";
import { SECTOR_ICONS } from "./sector-icons";
import styles from "./DailyChart.module.css";

type ThumbRow = {
  name: string;
  display: string;
  /** Kulvardaki çubuk: alanın yüzdesi olarak başlangıç ve boy. */
  bar: { start: number; size: number } | null;
  dir: TileDir;
  fund: string | null;
  symbol: string | null;
};

/**
 * Grafiğin küçük hâli — ana sayfa paneli (24 Ekim; 31 Ekim'de yeniden).
 *
 * TAM GRAFİK DEĞİL, ŞEKLİ: `rows` satır, geri kalanı "N Kalem Daha"
 * künyesiyle. 31 Ekim'de sahibinin itirazı: "bu böyle kabul edilemez,
 * logolar olsun, daha görsel ve anlaşılır." Eskiden satır düz metin addı
 * ("Advanced Micro De…" kesik), sayı birimsizdi ("-28,58"), katlanan
 * satırlar ortada çıplak bir "+3"tü. Artık satırlar sayfanın kart diliyle:
 *   · hisse kaleminde şirket logosu ve sembolü (`memberSymbolOf`, yalnız
 *     tek anlamlı eşleşme; eşlenemeyen satır logosuz), sektörde simgesi;
 *   · ad kesilmez (iki satıra iner), değer birimiyle ("−%28,58");
 *   · çubuk adın ALTINDA tam genişlikte 5 piksellik kulvar — ad ile değer
 *     arasına sıkışmış 60 piksellik çubuk okunmuyordu.
 *
 * Sıra ve ölçek sayfanın kartlarıyla aynı hesap (`boardTiles`): düşüş
 * listesinde en sert düşüş başta, ölçek grubun TAMAMINDAN (gösterilmeyen
 * satırlar dahil) — küçük hâl tam grafikten başka bir oran söylemesin.
 * Kesim: tek yönlü grafikte hikâye baştadır, ilk `rows` satır kalır ve
 * künye sonda; karışık grafikte iki uç da hikâyedir, kesim ORTADAN
 * (paylaşım görseli aynı kuralla, `lib/daily-chart-og.tsx`).
 *
 * Bozuk blok hiçbir şey çizmez: yazma yolu bozuk bloğu zaten kabul etmiyor,
 * ama elle düzeltilmiş eski bir kayıt kartı kırmasın.
 */
export function ChartThumb({
  chartMd,
  locale,
  rows = 5,
  logos,
  moreLabel,
}: {
  chartMd: string;
  locale: string;
  rows?: number;
  /** Sembol → logo adresi (`getChartLogos`); yoksa depodaki logo. */
  logos?: Record<string, string | null>;
  /** "{n} Kalem Daha" — arayüz dilinde. */
  moreLabel: string;
}) {
  const check = checkChartBlock(chartMd, locale);
  if (!check.ok) return null;
  const { block } = check;

  if (block.kind === "share") {
    const total = block.items.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return null;
    return (
      <div className={styles.thumb} aria-hidden>
        <div className={styles.shareStrip}>
          {block.items.map((item, index) => (
            <span
              key={index}
              style={{
                width: `${(item.value / total) * 100}%`,
                background: index < 4 ? `var(--share-${index + 1})` : "var(--share-rest)",
              }}
            />
          ))}
        </div>
        {block.items.slice(0, rows).map((item, index) => (
          <div key={index} className={styles.thumbRow}>
            <span className={styles.thumbName}>{item.name}</span>
            <span className={styles.thumbValue}>{item.display}</span>
          </div>
        ))}
      </div>
    );
  }

  let items: ThumbRow[];
  let oneSided = false;
  let zero: number | null = null;
  if (block.kind === "bars") {
    const board = boardTiles(block, locale);
    oneSided = board.trend !== "mixed";
    zero = board.scale && board.scale.zero > 0 && board.scale.zero < 100 ? board.scale.zero : null;
    items = board.tiles.map((tile) => ({
      name: tile.name,
      display: tile.display,
      bar: tile.bar,
      dir: board.signed ? tile.dir : "flat",
      fund: tile.fund,
      symbol: tile.symbol,
    }));
  } else {
    /* `oncesi` yön taşımıyor (iki hâlin büyüklüğü): iki çubuk da nötr ton. */
    const peak = Math.max(Math.abs(block.from.value ?? 0), Math.abs(block.to.value ?? 0), 0.01);
    items = [block.from, block.to].map((side) => ({
      name: side.label,
      display: side.display,
      bar: { start: 0, size: (Math.abs(side.value ?? 0) / peak) * 100 },
      dir: "flat" as const,
      fund: null,
      symbol: null,
    }));
  }

  const cut = items.length > rows;
  const headCount = !cut ? items.length : oneSided ? rows : Math.ceil(rows / 2);
  const head = items.slice(0, headCount);
  const tail = cut && !oneSided ? items.slice(items.length - (rows - headCount)) : [];
  const rest = items.length - head.length - tail.length;
  const more = rest > 0 && (
    <span key="rest" className={styles.more} data-end={oneSided ? "" : undefined}>
      {moreLabel.replace("{n}", String(rest))}
    </span>
  );

  const row = (item: ThumbRow, index: number) => {
    const Icon = item.fund ? SECTOR_ICONS[item.fund] : undefined;
    const code = item.symbol ?? item.fund;
    return (
      <div key={`${index}-${item.name}`} className={styles.thumbRow} style={{ "--i": index } as CSSProperties}>
        <span className={styles.thumbMark}>
          {item.symbol ? (
            <LogoTile symbol={item.symbol} logoUrl={logos?.[item.symbol] ?? null} size="xs" />
          ) : Icon ? (
            <span className={styles.thumbIcon}>
              <Icon size={14} weight="duotone" />
            </span>
          ) : null}
        </span>
        <span className={styles.thumbName}>
          {item.name}
          {code && <span className={styles.thumbCode}>{code}</span>}
        </span>
        <span className={styles.thumbValue} data-tone={item.dir === "flat" ? undefined : item.dir}>
          {item.display}
        </span>
        {item.bar && (
          <span
            className={styles.lane}
            data-zero={zero !== null ? "" : undefined}
            style={zero !== null ? ({ "--zero": `${zero}%` } as CSSProperties) : undefined}
          >
            <span
              className={styles.bar}
              data-tone={item.dir === "flat" ? "neutral" : item.dir}
              data-from={item.dir === "down" ? "right" : undefined}
              style={{ left: `${item.bar.start}%`, width: `${item.bar.size}%` }}
            />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.thumb} aria-hidden>
      {head.map(row)}
      {!oneSided && more}
      {tail.map((item, index) => row(item, head.length + index))}
      {oneSided && more}
    </div>
  );
}
