import type { CSSProperties } from "react";
import { checkChartBlock } from "@/lib/daily-chart";
import { boardKeys, mosaicCells, type TileRole } from "@/lib/daily-chart-board";
import { cn } from "@/lib/utils";
import styles from "./DailyChart.module.css";

/**
 * Arşiv kartının minyatürü (25 Ekim, kart turu): grafiğin kartları küçük
 * kareler hâlinde, hikâyenin sırasıyla (karışıkta yüksekten düşüğe, düşüş
 * listesinde en sert düşüş solda); ton yön, koyuluk büyüklük
 * (`mosaicCells`). Altında günün iki ucu, sayısıyla (`boardKeys`, sayfanın
 * künye kartlarıyla aynı hesap) ve 31 Ekim'den beri ucun adıyla ("En Çok
 * Düşen"): adın tek başına durduğu kartta düşüş listesinin sağ ucu "en
 * güçlü" sanılabiliyordu. Okunacak grafik değil, bir günü başlığından önce
 * şekliyle tanımak için; bozuk blok hiçbir şey çizmez.
 */
export function ChartMosaic({
  chartMd,
  locale,
  roles,
}: {
  chartMd: string;
  locale: string;
  /** Uçların adı (arayüz dilinde, `board.roles`); yoksa yalnız ad. */
  roles?: Record<TileRole, string>;
}) {
  const check = checkChartBlock(chartMd, locale);
  if (!check.ok) return null;
  const cells = mosaicCells(check.block);
  const extremes = boardKeys(check.block, locale).filter((key) => key.kind === "extreme");
  return (
    <>
      <span className={styles.mosaic} style={{ "--n": cells.length } as CSSProperties} aria-hidden>
        {cells.map((cell, index) => (
          <span key={index} data-dir={cell.dir} style={{ "--w": cell.weight.toFixed(3) } as CSSProperties} />
        ))}
      </span>
      {extremes.length > 0 && (
        <span className={styles.extremes} lang={locale}>
          {extremes.map((key, index) =>
            key.kind === "extreme" ? (
              <span key={index} className={styles.extreme}>
                {roles && key.role !== "share" && <span className={styles.extremeRole}>{roles[key.role]}</span>}
                <span className={styles.extremeName}>{key.name}</span>
                <span className={cn(styles.extremeValue, key.dir === "up" ? "text-up" : key.dir === "down" ? "text-down" : "text-strong")}>
                  {key.display}
                </span>
              </span>
            ) : null,
          )}
        </span>
      )}
    </>
  );
}
