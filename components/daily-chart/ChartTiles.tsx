import type { CSSProperties } from "react";
import { ArrowRight, TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { DailyChartBlock } from "@/lib/daily-chart";
import { boardTiles, percentDisplay, ringGradient, ringSlices, tileTiers, type BoardTile } from "@/lib/daily-chart-board";
import { LogoTile } from "@/components/ui/primitives";
import type { DailyChartLabels } from "@/lib/i18n/dictionaries/daily-chart";
import { cn, formatPercent } from "@/lib/utils";
import { SECTOR_ICONS } from "./sector-icons";
import styles from "./ChartBoard.module.css";

/** Ölçek kartının uç künyesi tek ondalık ("−1,9", "+2,6"). */
const AXIS_DIGITS = 1;
/** `oncesi` değişim rozeti tek ondalık (makale çizimiyle aynı). */
const DELTA_DIGITS = 1;

/**
 * Ana kartın görseli — bloğun türüne göre KART DİLİ (25 Ekim, kart turu).
 *
 * - `bar`: her satır bir küçük kart (simge ya da şirket logosu, ad, sembol,
 *   iri değer, kartın dibinde sıfırdan iki yöne ince çubuk). Izgara
 *   hikâyenin sırasıyla (`boardTiles`): karışıkta yüksekten düşüğe, düşüş
 *   listesinde en sert düşüş başta. Uç kartlar küçük bir etiketle NEDEN
 *   vurgulu olduğunu söylüyor ("En Çok Düşen", 31 Ekim — eskiden Dell ile
 *   Intel'in kırmızı yıkaması açıklamasızdı).
 * - Ölçek künyesi (işaretli blok): çubukların ortak ekseni (uçlar ve sıfır).
 *   31 Ekim'den beri sütun sayısı kalem sayısına göre seçiliyor
 *   (`tileTiers`): künye ızgaraya yalnız TEK boş hücreyi dolduruyorsa
 *   giriyor (11 sektör, 6×2), yoksa ızgaranın altında ince bir ölçek satırı.
 *   8 hissede künye ikinci satırda yetim kalıyordu.
 * - `pay`: halka + her dilim bir kart (ton karosu, ad, değer).
 * - `oncesi`: iki iri sayı kartı ve aralarında değişim kartı.
 *
 * Renk yalnız işaretten (`--up` / `--down`); nötr blokta çubuk markanın
 * yumuşak mavisi, sayı metin renginde (site geneli renk kararı, 25 Ekim).
 * Yüzde blokta değer birimiyle ("−%10,77", `percentDisplay`).
 */
export function ChartTiles({
  block,
  locale,
  label,
  labels,
  logos,
}: {
  block: DailyChartBlock;
  /** Grafiğin dili (kaydın dili; sayılar onun yazılışıyla). */
  locale: string;
  /** Listenin ekran okuyucu adı. */
  label: string;
  labels: DailyChartLabels;
  /** Sembol → logo adresi (`getChartLogos`); yoksa depodaki logo. */
  logos?: Record<string, string | null>;
}) {
  if (block.kind === "share") return <ShareTiles block={block} label={label} />;
  if (block.kind === "shift") return <ShiftTiles block={block} locale={locale} labels={labels} />;

  const { tiles, scale, signed, percent } = boardTiles(block, locale);
  const tiers = tileTiers(tiles.length, scale !== null);
  const axis = (value: number) => {
    if (value === 0) return "0";
    const digits = Math.abs(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-US", {
      maximumFractionDigits: AXIS_DIGITS,
      minimumFractionDigits: AXIS_DIGITS,
    });
    return percent ? percentDisplay(`${value > 0 ? "+" : "-"}${digits}`, locale) : `${value > 0 ? "+" : "−"}${digits}`;
  };
  /* Basamak başına sütun ve künyenin yeri CSS değişkeni olarak; container
     query'ler bunları seçiyor (ChartBoard.module.css → SEKTÖR KARTLARI). */
  const layout: Record<string, string | number> = {};
  tiers.forEach((tier, index) => {
    layout[`--cols-${index}`] = tier.cols;
    layout[`--in-${index}`] = tier.legendInGrid ? "block" : "none";
    layout[`--out-${index}`] = tier.legendInGrid ? "none" : "flex";
  });
  if (scale) layout["--zero"] = `${scale.zero}%`;

  const legendLane = scale && (
    <span className={styles.scaleAxis}>
      <span className={styles.lane}>
        {scale.lo < 0 && <span className={styles.scaleBar} data-dir="down" style={{ left: 0, width: `${scale.zero}%` }} />}
        {scale.hi > 0 && <span className={styles.scaleBar} data-dir="up" style={{ left: `${scale.zero}%`, width: `${100 - scale.zero}%` }} />}
      </span>
      <span className={styles.scaleTicks}>
        <span>{scale.lo < 0 ? axis(scale.lo) : ""}</span>
        <span className={styles.scaleZero}>0</span>
        <span>{scale.hi > 0 ? axis(scale.hi) : ""}</span>
      </span>
    </span>
  );

  return (
    <div className={styles.tilesWrap} style={layout as CSSProperties}>
      <ol className={styles.tiles} aria-label={label}>
        {tiles.map((tile, index) => (
          <li key={`${index}-${tile.name}`} className="min-w-0" style={{ "--i": index } as CSSProperties}>
            <Tile tile={tile} signed={signed} labels={labels} logos={logos} />
          </li>
        ))}
        {scale && (
          <li className={cn("min-w-0", styles.scaleCell)} aria-hidden style={{ "--i": tiles.length } as CSSProperties}>
            {/* Kartın yapısı sektör kartıyla aynı (ad, alt satır, kulvar) ki
                satır yüksekliğini o belirlemesin; açıklama `title`da. */}
            <div className={styles.scaleTile} title={labels.board.scaleNote}>
              <span className={styles.scaleTitle}>{labels.board.scaleTitle}</span>
              {legendLane}
            </div>
          </li>
        )}
      </ol>
      {scale && (
        /* Izgaranın altındaki ince ölçek: kulvarı TEK KARTIN kulvarı
           genişliğinde (sütun sayısından), yanında ne olduğu. */
        <div className={styles.scaleRow} aria-hidden>
          <span className={styles.scaleKey}>{legendLane}</span>
          <span className={styles.scaleText}>
            <span className={styles.scaleRowTitle}>{labels.board.scaleTitle}</span> {labels.board.scaleNote}
          </span>
        </div>
      )}
    </div>
  );
}

function Tile({
  tile,
  signed,
  labels,
  logos,
}: {
  tile: BoardTile;
  signed: boolean;
  labels: DailyChartLabels;
  logos?: Record<string, string | null>;
}) {
  const Icon = tile.fund ? SECTOR_ICONS[tile.fund] : undefined;
  const code = tile.fund ?? tile.symbol;
  const RoleIcon = tile.dir === "down" || tile.role === "smallest" ? TrendDown : TrendUp;
  const body = (
    <>
      <span className={styles.tileHead}>
        {tile.symbol ? (
          <LogoTile symbol={tile.symbol} logoUrl={logos?.[tile.symbol] ?? null} size="xs" />
        ) : (
          Icon && (
            <span className={styles.tileIcon} aria-hidden>
              <Icon size={16} weight="duotone" />
            </span>
          )
        )}
        <span className={styles.tileName}>{tile.name}</span>
      </span>
      {tile.role && (
        <span className={styles.tileRole} data-dir={signed ? tile.dir : "flat"}>
          <RoleIcon size={12} weight="bold" aria-hidden />
          {labels.board.roles[tile.role]}
        </span>
      )}
      <span className={styles.tileFoot}>
        <span className={cn(styles.tileValue, tile.dir === "up" ? "text-up" : tile.dir === "down" ? "text-down" : "text-strong")}>
          {tile.display}
        </span>
        {code && <span className={styles.tileSymbol}>{code}</span>}
      </span>
      {tile.bar && (
        <span className={styles.lane} data-zero={signed ? "" : undefined} aria-hidden>
          {tile.bar.size > 0 && (
            <span
              className={styles.bar}
              data-dir={signed ? tile.dir : "neutral"}
              style={{ "--start": `${tile.bar.start}%`, "--size": `${tile.bar.size}%` } as CSSProperties}
            />
          )}
        </span>
      )}
    </>
  );
  const attrs = { "data-rank": tile.rank ?? undefined, "data-emph": tile.emphasis ? "" : undefined, "data-dir": tile.dir };
  return code ? (
    <Link href={`/hisse/${code}`} prefetch={false} className={styles.tile} data-link="" {...attrs}>
      {body}
    </Link>
  ) : (
    <div className={styles.tile} {...attrs}>
      {body}
    </div>
  );
}

function ShareTiles({ block, label }: { block: Extract<DailyChartBlock, { kind: "share" }>; label: string }) {
  const slices = ringSlices(block.items);
  if (slices.length === 0) return null;
  const [top] = slices;
  return (
    <div className={styles.share}>
      <div className={styles.ring} style={{ background: ringGradient(slices) }} aria-hidden>
        <span className={styles.ringHole}>
          <span className={styles.ringValue}>{top.display}</span>
          <span className={styles.ringName}>{top.name}</span>
        </span>
      </div>
      <ol className={styles.shareTiles} aria-label={label}>
        {slices.map((slice, index) => (
          <li key={`${index}-${slice.name}`} className={styles.shareTile} style={{ "--i": index } as CSSProperties}>
            <span
              className={styles.swatch}
              aria-hidden
              style={{ background: slice.tone === 0 ? "var(--share-rest)" : `var(--share-${slice.tone})` }}
            />
            <span className={styles.tileName}>{slice.name}</span>
            <span className={cn(styles.tileValue, "text-strong")}>{slice.display}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ShiftTiles({
  block,
  locale,
  labels,
}: {
  block: Extract<DailyChartBlock, { kind: "shift" }>;
  locale: string;
  labels: DailyChartLabels;
}) {
  const peak = Math.max(Math.abs(block.from.value ?? 0), Math.abs(block.to.value ?? 0), 0);
  const tone = block.deltaPct === null ? "flat" : block.deltaPct > 0 ? "up" : block.deltaPct < 0 ? "down" : "flat";
  const side = (value: (typeof block)["from"], index: number) => (
    <div className={styles.shiftCard} style={{ "--i": index } as CSSProperties}>
      <span className={styles.shiftLabel}>{value.label}</span>
      <span className={styles.shiftValue}>{value.display}</span>
      {peak > 0 && (
        <span className={styles.lane} aria-hidden>
          <span
            className={styles.bar}
            data-dir="neutral"
            style={{ "--start": "0%", "--size": `${(Math.abs(value.value ?? 0) / peak) * 100}%` } as CSSProperties}
          />
        </span>
      )}
    </div>
  );
  return (
    <div className={styles.shift}>
      {side(block.from, 0)}
      <span className={styles.shiftArrow} aria-hidden>
        <ArrowRight size={20} weight="bold" />
      </span>
      {side(block.to, 1)}
      {block.deltaPct !== null && (
        <div className={styles.shiftDelta} data-dir={tone} style={{ "--i": 2 } as CSSProperties}>
          <span className={styles.shiftLabel}>{labels.board.shiftChange}</span>
          <span className={cn(styles.shiftValue, tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-strong")}>
            {formatPercent(block.deltaPct, locale, DELTA_DIGITS)}
          </span>
        </div>
      )}
    </div>
  );
}
