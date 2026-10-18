import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Skeleton } from "@/components/ui/primitives";
import themeStyles from "@/components/themes/Themes.module.css";
import { TreemapStage } from "@/components/themes/TreemapStage";
import type { Locale } from "@/lib/i18n";
import type { MoveSet } from "@/lib/theme-stats";
import { heatOf, splitSmall, squarify, type HeatTone } from "@/lib/theme-view";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, formatMoneyCompact, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./MarketExperience.module.css";

/**
 * Piyasalar ısı haritası — ağaç düzeni (18 Ekim, sahibinin isteği: "ısı
 * haritası bir tık daha iyi olabilir").
 *
 * NE DEĞİŞTİ. 30 karo eşit boyda bir ızgaradaydı (genişte 15 × 2): NVDA'nın
 * 4,5 T doları ile listenin sonundaki 150 Mr dolarlık şirket aynı yeri
 * tutuyor, "piyasa değerine göre ilk 30" künyesi yalnızca SIRAYI
 * anlatıyordu; kırk karonun yarısı tam doygun kırmızı ya da yeşil bir
 * blok olarak ekranın en ağır yüzeyiydi. Artık karonun ALANI piyasa
 * değeriyle orantılı, rengi günün hareketi — `/tema` haritasının dili.
 *
 * ORTAK OLAN: yerleşim ve gruplama (`squarify`, `splitSmall`,
 * lib/theme-view.ts), renk kademesi (`heatOf`, globals.css → `--heat-*`),
 * karo içeriğinin kapsayıcı sorgusuyla kademelenmesi ve giriş koreografisi
 * (Themes.module.css → `.tile*`, `TreemapStage`). Aynı yüzde iki ekranda
 * aynı tonda, aynı boy eşiğinde aynı içerikle.
 * KENDİNE AİT OLAN: kabın oranı (endeks paneli tam satır; tema haritasının
 * 2,1'i 1280'de 600 piksellik bir kutu demekti), telefonda küçük kalanların
 * çip listesi (tema haritasının 44 piksellik satırları Dow'da 14 satır
 * tutuyordu) ve lejanttan karo vurgusu.
 *
 * YÖN RENGİ YALNIZCA BU SEANSTA (veri dürüstlüğü 4). Izgara her yüzdeyi
 * boyuyordu; açılış öncesinin ilk dakikalarında yarısı dünü, yarısı bu
 * sabahı anlatan yüzdeler aynı haritada aynı renk diliyle duruyordu.
 * Renk artık `sameSessionMoves` kümesine giren karoda; ötekiler nötr tonda,
 * yüzdeleri soluk (tema haritasının kuralı, aynı fonksiyon).
 */

/**
 * Yerleşimler — `aspect` kabın en/boy oranı (CSS'e `--aspect` olarak aynı
 * sayı gider, iki yerde yazılmıyor). `box` yerleşimin gösterildiği EN DAR
 * kap, `max` en geniş kap (piksel); gruplama eşiği en dar kaba göre:
 * en darda sembolü okunan karo her genişlikte okunur.
 *
 * Ölçüldü (18 Ekim, başsız Chrome, haritanın kendi kutusu):
 *   1440 → 1282 × 414, 1280 → 1162 × 375, 1024 → 938 × 303 → geniş oran
 *     3,1 (eski 15 × 2 ızgara 1440'ta 152 piksel boydu);
 *   768 → 682 × 359 → orta oran 1,9 (tema haritasının 640–1199 oranı,
 *     aynı gerekçe: daha yatık oran 768'de karoları 260 piksellik kutuya
 *     sıkıştırıyordu). Orta yerleşimin en küçük karosu 36 × 30 eşiğinde
 *     768'de 31 × 55 piksele inip sembolsüz kalıyordu → eşik 44 × 36;
 *   390 → 328 × 410, 320 → 258 × 323 → telefon oranı 0,8; 390'da dokuz
 *     karo haritada, kalan 21 şirket çip.
 * Yatay taşma 1440/1280/1024/768/390/320'de 0 piksel.
 */
const LAYOUTS = [
  { key: "wide", aspect: 3.1, box: { w: 938, h: 303 }, max: { w: 1340, h: 432 }, min: { w: 36, h: 30 } },
  { key: "mid", aspect: 1.9, box: { w: 562, h: 296 }, max: { w: 860, h: 452 }, min: { w: 44, h: 36 } },
  { key: "narrow", aspect: 0.8, box: { w: 258, h: 323 }, max: { w: 560, h: 700 }, min: { w: 44, h: 34 } },
] as const;

/** Karonun en geniş kapta bile ulaşamayacağı kademenin parçaları hiç
    basılmıyor — gerekçe ThemeTreemap → REACH; sayılar onunla aynı. */
const REACH = {
  logo: { w: 88, h: 66 },
  name: { w: 122, h: 84 },
  foot: { w: 234, h: 132 },
} as const;

type Labels = {
  smallTitle: string;
  unsized: string;
  lastClose: string;
  cap: string;
};

type Tone = { tone: HeatTone; level: 0 | 1 | 2 | 3 | 4 };

/** Lejantla karoyu eşleyen anahtar — `down-3`, `flat-0`, `up-4`. */
export function heatKey(heat: Tone): string {
  return `${heat.tone}-${heat.level}`;
}

/**
 * Renk ölçeği — dokuz kademe, haritanın tokenlarıyla aynı (`.heat`).
 * Kademenin üzerine gelince haritada o kademedeki karolar öne çıkıyor,
 * ötekiler geri çekiliyor ("−%3'ün altında kaç şirket var?" sorusunun
 * cevabı tek bakış). Eşleşme `data-heat-key` ile; JS yok.
 */
export function HeatScale({ locale, label, steps }: { locale: Locale; label: string; steps: string }) {
  const levels = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;
  return (
    <div className={styles.heatLegend} role="img" aria-label={label}>
      <div className={styles.heatSwatches} aria-hidden>
        {levels.map((level) => {
          const heat: Tone = { tone: level < 0 ? "down" : level > 0 ? "up" : "flat", level: Math.abs(level) as Tone["level"] };
          return (
            <i
              key={level}
              className={themeStyles.heat}
              data-heat-tone={heat.tone}
              data-heat-level={heat.level}
              data-heat-key={heatKey(heat)}
            />
          );
        })}
      </div>
      <div className={styles.heatLegendLabels} aria-hidden>
        <span>≤ {formatPercent(-3, locale, 0)}</span>
        <span>0</span>
        <span>≥ {formatPercent(3, locale, 0)}</span>
      </div>
      <span className={styles.heatLegendHint} aria-hidden>{steps}</span>
    </div>
  );
}

export function IndexTreemap({
  rows,
  moves,
  locale,
  labels,
}: {
  /** Piyasa değerine göre sıralı, haritaya girecek satırlar. */
  rows: ThemeRow[];
  moves: MoveSet | null;
  locale: Locale;
  labels: Labels;
}) {
  const colored = (index: number) =>
    moves?.basis === "session" && moves.included[index] && rows[index].changePct !== null;
  const tone = (index: number): Tone => {
    const change = rows[index].changePct;
    if (!colored(index) || change === null) return { tone: "flat", level: 0 };
    return heatOf(change);
  };
  const pctOf = (row: ThemeRow) => (row.changePct === null ? NO_VALUE : formatPercent(row.changePct, locale));
  const sized = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.marketCap !== null && row.marketCap > 0);
  const unsized = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.marketCap === null || row.marketCap <= 0);

  return (
    <TreemapStage className={cn(themeStyles.stage, styles.heatStage)}>
      {LAYOUTS.map((layout) => {
        const weights = sized.map(({ row }) => row.marketCap!);
        const minShare = (layout.min.w * layout.min.h) / (layout.box.w * layout.box.h);
        const { kept, grouped } = splitSmall(weights, minShare);
        /* "DİĞER N" KAROSU YOK (18 Ekim, 390 ve 768'de ölçüldü). Tema
           haritasının grup karosu `squarify`a sıradan bir ağırlık olarak
           girince telefonda 21 küçük şirketin toplamı haritanın EN BÜYÜK
           karosu oldu ve sol üst köşeye — NVDA'nın yerine — oturdu: harita
           "en büyük şirket: Diğer" diye okunuyordu. Dipte sabit bir şerit
           denendi; payı küçük olunca 768'de 682 × 13 piksellik okunmaz bir
           çizgiye, telefonda kalan karoları 27 piksellik ince dilimlere
           çeviriyordu. Harita artık yalnız karoya sığan şirketleri çiziyor
           (alanları BİRBİRİNE oranlı); sığmayanlar haritanın hemen altında,
           başlığı "Haritada Küçük Kalanlar" olan çip listesinde. */
        const rects = squarify(kept.map((i) => weights[i]), layout.aspect);
        const rosterId = `market-heat-small-${layout.key}`;
        const chips = [
          ...grouped.map((i) => sized[i]),
          ...unsized,
        ];
        return (
          <div key={layout.key} className={styles.heatLayout} data-layout={layout.key}>
            <div className={styles.heatMap} style={{ "--aspect": layout.aspect } as CSSProperties}>
              {rects.map((rect, rank) => {
                const place = {
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.w}%`,
                  height: `${rect.h}%`,
                  "--i": rank,
                } as CSSProperties;
                const reach = (step: { w: number; h: number }) =>
                  (rect.w / 100) * layout.max.w >= step.w && (rect.h / 100) * layout.max.h >= step.h;

                const { row, index } = sized[kept[rect.index]];
                const heat = tone(index);
                const pct = pctOf(row);
                const cap = formatMoneyCompact(row.marketCap, locale);
                const price = formatPrice(row.price, locale, { currency: true });
                return (
                  <Link
                    key={row.symbol}
                    href={`/hisse/${row.symbol}`}
                    prefetch={false}
                    className={cn(themeStyles.tile, styles.heatTile)}
                    style={place}
                    data-cc={row.symbol}
                    aria-label={[
                      row.symbol,
                      row.name ?? row.symbol,
                      pct,
                      ...(row.basis === "lastClose" ? [labels.lastClose] : []),
                      price,
                      `${labels.cap} ${cap}`,
                    ].join(" · ")}
                  >
                    <span
                      className={cn(themeStyles.heat, themeStyles.tileFace, styles.heatFace)}
                      data-heat-tone={heat.tone}
                      data-heat-level={heat.level}
                      data-heat-key={heatKey(heat)}
                    >
                      <span className={themeStyles.tileHead}>
                        {reach(REACH.logo) && (
                          <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" className={themeStyles.tileLogo} />
                        )}
                        <span className={themeStyles.tileId}>
                          <span className={cn("numeral", themeStyles.tileSymbol)}>{row.symbol}</span>
                          {row.name && reach(REACH.name) && <span className={themeStyles.tileName}>{row.name}</span>}
                        </span>
                      </span>
                      <span className={cn("numeral", themeStyles.tilePct, !colored(index) && themeStyles.tileMuted)}>{pct}</span>
                      {reach(REACH.foot) && (
                        <span className={themeStyles.tileFoot}>
                          <span className="numeral">{price}</span>
                          <b className="numeral">{cap}</b>
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
            {chips.length > 0 && (
              /* Küçük kalanlar ve piyasa değeri bilinmeyenler — çip olarak.
                 Her çip sembol + yüzde, zemini karonun tonu: harita ile
                 aynı renk dili, satır yerine akan sıra. */
              <div id={rosterId} className={styles.heatRoster}>
                <h3 className={styles.heatRosterTitle}>
                  {grouped.length > 0 ? labels.smallTitle : labels.unsized}{" "}
                  <span className="numeral">{chips.length}</span>
                </h3>
                <ul className={styles.heatChips}>
                  {chips.map(({ row, index }) => {
                    const heat = tone(index);
                    return (
                      <li key={row.symbol}>
                        <Link
                          href={`/hisse/${row.symbol}`}
                          prefetch={false}
                          className={cn(themeStyles.heat, styles.heatChip)}
                          data-cc={row.symbol}
                          data-heat-tone={heat.tone}
                          data-heat-level={heat.level}
                          data-heat-key={heatKey(heat)}
                          aria-label={`${row.symbol} · ${row.name ?? row.symbol} · ${pctOf(row)}`}
                        >
                          <b className="numeral">{row.symbol}</b>
                          <span className={cn("numeral", !colored(index) && themeStyles.tileMuted)}>{pctOf(row)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </TreemapStage>
  );
}

/** Yer tutucunun ağırlıkları — gerçek haritanın kaba biçimi (birkaç dev,
    uzun bir kuyruk). Yapı eşleşsin diye: aynı oran, aynı karo dili. */
const SKELETON_WEIGHTS = [10, 8, 7, 5, 4, 3, 2.6, 2.2, 1.8, 1.5, 1.3, 1.1, 1];

/**
 * Harita yüklenirken — aynı üç yerleşim, aynı `--aspect`. Sekme değişince
 * harita bölümü düz bir plaka değil, haritanın kendi geometrisiyle bekliyor
 * (DetailSkeleton'ın kuralı: yer tutucu yükseklikle değil YAPIYLA eşleşir).
 */
export function HeatSkeleton() {
  return (
    <>
      {LAYOUTS.map((layout) => (
        <div key={layout.key} className={styles.heatLayout} data-layout={layout.key}>
          <div className={styles.heatMap} style={{ "--aspect": layout.aspect } as CSSProperties}>
            {squarify(SKELETON_WEIGHTS, layout.aspect).map((rect) => (
              <span
                key={rect.index}
                className={styles.heatSkeletonTile}
                style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }}
              >
                <Skeleton className="size-full rounded-[8px]" />
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
