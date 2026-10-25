import type { CSSProperties } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { DailyChartBlock } from "@/lib/daily-chart";
import { boardTiles, ringGradient, ringSlices, type BoardTile } from "@/lib/daily-chart-board";
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
 * - `bar`: her satır bir küçük kart (simge, ad, sembol, iri değer, kartın
 *   dibinde sıfırdan iki yöne ince çubuk). Izgara yüksekten düşüğe sıralı;
 *   en güçlü ve en zayıf kart yön tonuyla vurgulu. İşaretli blokta son
 *   hücre ÖLÇEK KARTI: çubukların ortak ekseni (uçlar ve sıfır) — kartlar
 *   ayrı ayrı dursa da çubukların neden karşılaştırılabildiğini söylüyor
 *   ve 11 sektörlük günde ızgarayı 6×2'ye tamamlıyor.
 * - `pay`: halka + her dilim bir kart (ton karosu, ad, değer).
 * - `oncesi`: iki iri sayı kartı ve aralarında değişim kartı.
 *
 * Renk yalnız işaretten (`--up` / `--down`); nötr blokta çubuk markanın
 * yumuşak mavisi, sayı metin renginde (site geneli renk kararı, 25 Ekim).
 */
export function ChartTiles({
  block,
  locale,
  label,
  labels,
}: {
  block: DailyChartBlock;
  /** Grafiğin dili (kaydın dili; sayılar onun yazılışıyla). */
  locale: string;
  /** Listenin ekran okuyucu adı. */
  label: string;
  labels: DailyChartLabels;
}) {
  if (block.kind === "share") return <ShareTiles block={block} label={label} />;
  if (block.kind === "shift") return <ShiftTiles block={block} locale={locale} labels={labels} />;

  const { tiles, scale, signed } = boardTiles(block);
  const axis = (value: number) =>
    value === 0 ? "0" : `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: AXIS_DIGITS, minimumFractionDigits: AXIS_DIGITS })}`;

  return (
    <div className={styles.tilesWrap} style={scale ? ({ "--zero": `${scale.zero}%` } as CSSProperties) : undefined}>
      <ol className={styles.tiles} aria-label={label}>
        {tiles.map((tile, index) => (
          <li key={`${index}-${tile.name}`} className="min-w-0" style={{ "--i": index } as CSSProperties}>
            <Tile tile={tile} signed={signed} />
          </li>
        ))}
        {scale && (
          <li className={cn("min-w-0", styles.scaleCell)} aria-hidden style={{ "--i": tiles.length } as CSSProperties}>
            {/* Kartın yapısı sektör kartıyla aynı (ad, alt satır, kulvar) ki
                satır yüksekliğini o belirlemesin; açıklama `title`da. */}
            <div className={styles.scaleTile} title={labels.board.scaleNote}>
              <span className={styles.scaleTitle}>{labels.board.scaleTitle}</span>
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
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

function Tile({ tile, signed }: { tile: BoardTile; signed: boolean }) {
  const Icon = tile.fund ? SECTOR_ICONS[tile.fund] : undefined;
  const body = (
    <>
      <span className={styles.tileHead}>
        {Icon && (
          <span className={styles.tileIcon} aria-hidden>
            <Icon size={16} weight="duotone" />
          </span>
        )}
        <span className={styles.tileName}>{tile.name}</span>
      </span>
      <span className={styles.tileFoot}>
        <span className={cn(styles.tileValue, tile.dir === "up" ? "text-up" : tile.dir === "down" ? "text-down" : "text-strong")}>
          {tile.display}
        </span>
        {tile.fund && <span className={styles.tileSymbol}>{tile.fund}</span>}
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
  return tile.fund ? (
    <Link href={`/hisse/${tile.fund}`} prefetch={false} className={styles.tile} data-rank={tile.rank ?? undefined} data-dir={tile.dir} data-link="">
      {body}
    </Link>
  ) : (
    <div className={styles.tile} data-rank={tile.rank ?? undefined} data-dir={tile.dir}>
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
