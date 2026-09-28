import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import type { MoveSet } from "@/lib/theme-stats";
import { heatOf, squarify } from "@/lib/theme-view";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, formatPercent, NO_VALUE } from "@/lib/utils";
import styles from "./Themes.module.css";

/**
 * Temanın kare haritası — her üye piyasa değeriyle orantılı bir karo,
 * rengi günün hareketi.
 *
 * NEDEN HARİTA: tema tablosu "hangisi ne kadar büyük" ve "bugün hangisi
 * ne yaptı" sorularını iki ayrı sütunda, satır satır okutarak cevaplıyordu.
 * Harita ikisini tek bakışta veriyor: sepetin ağırlığını taşıyan dev
 * şirketler ve onların yönü ilk anda görünüyor. Tablo altta, kesin sayılar
 * için duruyor.
 *
 * `HeatmapGrid` DEĞERLENDİRİLDİ, KULLANILMADI. O sarmal `/piyasalar`ın eşit
 * karolu ızgarası için yazılmış: kartların açılma yönü `nth-child` sütun
 * sayısına bağlı (MarketExperience.module.css). Burada karolar mutlak
 * konumlu ve boyları farklı; sarmaldan geriye yalnızca Escape dinleyicisi
 * kalıyordu. Ortak olan RENK FORMÜLÜ ve eşikler — ikisi de aynı
 * (`heatOf`, `.heat`).
 *
 * YÖN RENGİ YALNIZCA BU SEANSTA (Veri dürüstlüğü 4). Medyana girmeyen ya da
 * son kapanışı anlatan karo nötr tonda: yeşil ve kırmızı "bugün" der.
 *
 * Piyasa değeri karşılaştırılamayan üyeler (ana borsası ABD dışında) alan
 * olarak çizilemez; haritanın altında düz bir satırda duruyorlar.
 *
 * İKİ YERLEŞİM: geniş ekranda yatay, telefonda dikeye yakın bir kap. Tek
 * yerleşimi iki oranda germek alanları korurdu ama karolar telefonda ince
 * uzun şeritlere dönüşüyordu. İkisi de sunucuda hesaplanıyor; biri CSS ile
 * gizli ve erişilebilirlik ağacında yok (`display: none`).
 */

/** Kabın oranları (genişlik / yükseklik) ve karo içeriğine karar vermek
    için varsayılan piksel boyları: 1280'de harita sütunu ≈ 860 × 410,
    390'da ≈ 330 × 347. */
const LAYOUTS = [
  { key: "wide", aspect: 2.1, width: 860, height: 410 },
  { key: "narrow", aspect: 0.95, width: 330, height: 347 },
] as const;
/** Ölçüt sütunu olmayan temada geniş harita tam satırı alıyor (≈ 1190 ×
    458); CSS'teki `aspect-ratio` ile aynı sayı. */
const WIDE_ASPECT_SOLO = 2.6;
const WIDE_SOLO_WIDTH = 1190;

/** Karo boyu eşikleri (piksel). Altında ilgili satır basılmıyor.
    Genişlikler METNİN kendisinden: "+%0,30" 12,5 puntoda ≈ 46 piksel +
    iki yanda 10 dolgu; dört harfli sembol 11 puntoda ≈ 36 + 8. İlk
    eşikler (58 / 30) 390'da yüzdeyi ve "MCHP"yi karonun kenarında
    kesiyordu (karede görüldü). */
const TILE_LG = { w: 120, h: 92 };
const TILE_MD = { w: 70, h: 44 };
const TILE_SM = { w: 44, h: 24 };

export function ThemeTreemap({
  rows,
  moves,
  solo,
  locale,
  labels,
}: {
  rows: ThemeRow[];
  moves: MoveSet | null;
  /** Yanında ölçüt sütunu yok: geniş yerleşim daha yatık. */
  solo: boolean;
  locale: string;
  labels: { unsized: string; lastClose: string };
}) {
  const colored = (index: number) =>
    moves?.basis === "session" && moves.included[index] && rows[index].changePct !== null;
  const sized = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.marketCap !== null && row.marketCap > 0);
  const unsized = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.marketCap === null || row.marketCap <= 0);

  const tone = (index: number) => {
    const change = rows[index].changePct;
    if (!colored(index) || change === null) return { tone: "flat", level: 0 } as const;
    return heatOf(change);
  };

  return (
    <>
      {LAYOUTS.map((base) => {
        const layout =
          solo && base.key === "wide"
            ? { ...base, aspect: WIDE_ASPECT_SOLO, width: WIDE_SOLO_WIDTH, height: WIDE_SOLO_WIDTH / WIDE_ASPECT_SOLO }
            : base;
        const rects = squarify(
          sized.map(({ row }) => row.marketCap!),
          layout.aspect,
        );
        return (
          <div key={layout.key} className={styles.map} data-layout={layout.key} data-motion-stagger>
            {rects.map((rect) => {
              const { row, index } = sized[rect.index];
              const w = (rect.w / 100) * layout.width;
              const h = (rect.h / 100) * layout.height;
              const size =
                w >= TILE_LG.w && h >= TILE_LG.h
                  ? "lg"
                  : w >= TILE_MD.w && h >= TILE_MD.h
                    ? "md"
                    : w >= TILE_SM.w && h >= TILE_SM.h
                      ? "sm"
                      : "xs";
              const heat = tone(index);
              const pct = row.changePct === null ? NO_VALUE : formatPercent(row.changePct, locale);
              const lastClose = row.basis === "lastClose";
              return (
                <Link
                  key={row.symbol}
                  href={`/hisse/${row.symbol}`}
                  prefetch={false}
                  className={styles.tile}
                  data-size={size}
                  aria-label={`${row.symbol} · ${row.name ?? row.symbol} · ${pct}${lastClose ? ` · ${labels.lastClose}` : ""}`}
                  title={`${row.name ?? row.symbol} · ${pct}`}
                  style={{
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.w}%`,
                    height: `${rect.h}%`,
                  }}
                >
                  <span className={styles.heat} data-heat-tone={heat.tone} data-heat-level={heat.level}>
                    {size === "lg" ? (
                      <>
                        <span className={styles.tileHead}>
                          <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" />
                          <span className="min-w-0">
                            <span className={cn("numeral block", styles.tileSymbol)}>{row.symbol}</span>
                            <span className={cn("block", styles.tileName)}>{row.name}</span>
                          </span>
                        </span>
                        <span className={cn("numeral", styles.tilePct, !colored(index) && "text-muted")}>
                          {pct}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className={cn("numeral", styles.tileSymbol)}>{row.symbol}</span>
                        {size === "md" && (
                          <span className={cn("numeral", styles.tilePct, !colored(index) && "text-muted")}>
                            {pct}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })}
      {unsized.length > 0 && (
        <div className={styles.unsized}>
          <span>{labels.unsized}</span>
          {unsized.map(({ row, index }) => {
            const heat = tone(index);
            return (
              <Link
                key={row.symbol}
                href={`/hisse/${row.symbol}`}
                prefetch={false}
                className={cn(styles.heat, styles.unsizedItem)}
                data-heat-tone={heat.tone}
                data-heat-level={heat.level}
              >
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                <span className="numeral">{row.symbol}</span>
                <span className={cn("numeral", styles.tilePct, !colored(index) && "text-muted")}>
                  {row.changePct === null ? NO_VALUE : formatPercent(row.changePct, locale)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
