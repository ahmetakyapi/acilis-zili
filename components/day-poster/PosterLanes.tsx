import type { CSSProperties } from "react";
import type { PosterMove } from "@/lib/day-poster";
import { cn, directionOf, directionText } from "@/lib/utils";
import styles from "./PosterLanes.module.css";

/**
 * POSTERİN KULVARLARI — etiketli (25 Ekim).
 *
 * İlk sürümde kulvarlar mürekkep tuvalindeydi ve hiçbirinin adı yoktu
 * (sahibinin 390 piksellik ekran görüntüsü: on beş çizgi, tek etiket yok).
 * Şimdi her kulvar bir liste satırı: sırası, adı, fonu, şeridi ve değeri
 * aynı satırda — okuyucu lejanta ya da tabloya bakmadan okuyor. Liste
 * gerçek bir `ol`: ekran okuyucu "1 Enerji XLE +%2,60" duyuyor; ayrı bir
 * tabloya gerek kalmadı (sahne ile tablo aynı sayıları iki kez basıyordu).
 *
 * İKİ DÜZEN, KABIN ENİNE GÖRE (container query, ekranın değil): dar kapta
 * ad ve değer üstte, şerit altında tam en; geniş kapta tek satır
 * (ad | şerit | değer). Poster sayfasında sütun 900'ün üstünde ikiye
 * bölünüyor ve kap eni ekranın enini izlemiyor.
 *
 * Şeridin dili sitenin grafik dili (CLAUDE.md): `--line-soft` kulvar
 * üstünde 5 piksel, sıfır çizgisi `--line-strong`, renk yalnız işaretten,
 * ölçek bütün kulvarlarda TEK (`posterScale`) ve üstte eksen künyesiyle
 * yazılı. Tam sıfır nötr: şerit basılmıyor.
 */
export function PosterLanes({
  moves,
  scale,
  name,
  percent,
  axis,
  ranked = true,
  label,
  className,
}: {
  moves: readonly PosterMove[];
  scale: number;
  name: (symbol: string) => string;
  /** İşaretli yüzde: "+%2,60". */
  percent: (value: number) => string;
  /** Eksen künyesi: sol uç, sıfır, sağ uç ("−%2,6", "0", "+%2,6"). */
  axis: readonly [string, string, string];
  ranked?: boolean;
  /** Listenin ekran okuyucu adı. */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn(styles.wrap, className)}>
      <div className={styles.axis} aria-hidden>
        <span className={styles.axisTrack}>
          <span>{axis[0]}</span>
          <span>{axis[1]}</span>
          <span>{axis[2]}</span>
        </span>
      </div>
      <ol className={styles.lanes} aria-label={label}>
        {moves.map((move, index) => {
          const length = (Math.min(Math.abs(move.change), scale) / scale) * 50;
          const dir = directionOf(move.change);
          return (
            <li key={move.symbol} className={styles.row} style={{ "--i": index } as CSSProperties}>
              <span className={styles.rank}>{ranked ? index + 1 : ""}</span>
              <span className={styles.name}>
                {name(move.symbol)}
                <span className={styles.symbol}>{move.symbol}</span>
              </span>
              <span className={styles.track} aria-hidden>
                {dir !== "flat" && (
                  <span
                    className={cn(styles.bar, dir === "up" ? styles.barUp : styles.barDown)}
                    style={{ "--len": `${length}%` } as CSSProperties}
                  />
                )}
              </span>
              <span className={cn(styles.value, directionText(dir))}>{percent(move.change)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Ölçü ızgarasındaki tek şerit — sayının altında aynı ölçekle çizgisi
 * (sahibinin 25 Ekim ilkesi: "sayıyı yalnız yazma, çiz"). Kulvarlarla aynı
 * ölçek ve aynı dil; S&P 500'ün −%0,52'si ile en zayıf sektörün −%1,92'si
 * yan yana boyla karşılaştırılıyor.
 */
export function MiniLane({ change, scale, className }: { change: number; scale: number; className?: string }) {
  const length = (Math.min(Math.abs(change), scale) / scale) * 50;
  const dir = directionOf(change);
  return (
    <span className={cn(styles.mini, className)} aria-hidden>
      {dir !== "flat" && (
        <span
          className={cn(styles.bar, dir === "up" ? styles.barUp : styles.barDown)}
          style={{ "--len": `${length}%` } as CSSProperties}
        />
      )}
    </span>
  );
}
