import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n";
import type { MoveSet } from "@/lib/theme-stats";
import { heatOf, splitSmall, squarify, type HeatTone } from "@/lib/theme-view";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, formatMoneyCompact, formatPercent, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./Themes.module.css";
import { TreemapStage, type PeekData } from "./TreemapStage";

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
 * HER ÜYE TANINIR (28 Eylül). İlk hâlde karonun içeriğine sunucu, tahmini
 * piksel boyuna bakarak karar veriyordu ve eşiğin altındaki karolar boş
 * kalıyordu: yapay zekâ temasında ALAB ve SMCI yalnızca renkli birer
 * kareydi, NOW'da sembol vardı ama yüzde yoktu. Şimdi iki katman var:
 *   1. İçerik karonun GERÇEK boyuna göre CSS kapsayıcı sorgularıyla
 *      kademeleniyor (büyük: logo, sembol, ad, büyük yüzde, pay ve
 *      piyasa değeri; orta: logo, sembol, ad, yüzde; küçük: sembol ve
 *      yüzde). Tahmin yok; 768'de de 1440'ta da karo neye sığıyorsa o.
 *   2. Sembolü bile sığmayacak kadar küçük üyeler tek bir "Diğer N"
 *      karosunda, alanı toplam piyasa değerleri kadar; haritanın altında
 *      her biri adıyla listeleniyor (gerekçe `splitSmall`).
 * Üzerine gelince, odaklanınca ya da parmakla dokununca karonun künye
 * kartı açılıyor: ad, son fiyat, günlük değişim, piyasa değeri, temadaki
 * payı. Kart tek ve paylaşılan (`TreemapStage`, gerekçe orada); karo
 * künyesini `data-peek`te taşıyor.
 *
 * `HeatmapGrid` DEĞERLENDİRİLDİ, KULLANILMADI. O sarmal `/piyasalar`ın eşit
 * karolu ızgarası için yazılmış: kartların açılma yönü `nth-child` sütun
 * sayısına bağlı. Burada karolar mutlak konumlu ve boyları farklı; kartın
 * yatay yönü karonun haritadaki yerinden sunucuda hesaplanıyor. Ortak olan
 * RENK FORMÜLÜ ve eşikler (`heatOf`, globals.css → `--heat-*`).
 *
 * YÖN RENGİ YALNIZCA BU SEANSTA (Veri dürüstlüğü 4). Medyana girmeyen ya da
 * son kapanışı anlatan karo nötr tonda: yeşil ve kırmızı "bugün" der.
 *
 * Piyasa değeri karşılaştırılamayan üyeler (ana borsası ABD dışında) alan
 * olarak çizilemez; haritanın altında ayrı bir satırda duruyorlar.
 *
 * İKİ YERLEŞİM: geniş ekranda yatay, telefonda dikeye yakın bir kap. Tek
 * yerleşimi iki oranda germek alanları korurdu ama karolar telefonda ince
 * uzun şeritlere dönüşüyordu. İkisi de sunucuda hesaplanıyor; biri CSS ile
 * gizli ve erişilebilirlik ağacında yok (`display: none`).
 */

/**
 * Yerleşimler. `aspect` kabın en/boy oranı (CSS'teki `aspect-ratio` ile
 * aynı sayı); `box` yerleşimin gösterildiği EN DAR kap, piksel. Gruplama
 * eşiği o kaba göre: en darda sembolü okunan karo her genişlikte okunur.
 * Ölçüldü (28 Eylül): geniş yerleşim 640'ta ≈ 550 × 290 (1200'ün altında
 * oran 1,9), telefon yerleşimi 360'ta ≈ 294 × 368.
 */
const LAYOUTS = [
  { key: "wide", aspect: 2.1, soloAspect: 2.6, box: { w: 550, h: 290 }, max: { w: 1300, h: 620 }, min: { w: 36, h: 30 } },
  { key: "narrow", aspect: 0.8, soloAspect: 0.8, box: { w: 294, h: 368 }, max: { w: 640, h: 800 }, min: { w: 48, h: 40 } },
] as const;

/**
 * Karonun EN GENİŞ kapta bile ulaşamayacağı kademenin parçaları hiç
 * basılmıyor. İçerik kademesini CSS seçiyor, ama gizli bir logo karosu da
 * indiriliyor ve hidrasyona giriyor: yirmi üyeli Katılım temasında iki
 * yerleşimde kırk logo, çoğu hiçbir genişlikte görünmeyecek. `max`
 * yerleşimin gösterildiği en büyük kap (iki boyut ayrı ayrı en büyük
 * alındığı için cömert bir üst sınır); eşikler Themes.module.css'teki
 * kapsayıcı sorgularıyla aynı sayılar + 4 piksel dolgu.
 */
const REACH = {
  logo: { w: 88, h: 66 },
  name: { w: 122, h: 84 },
  foot: { w: 234, h: 132 },
} as const;

/** Grup karosunda gösterilen logo sayısı. */
const GROUP_LOGOS = 4;
/** Künye kartının yatay yönü: karonun ortası kabın bu yüzdelerinin
    dışındaysa kart karonun kenarına yaslanır, taşmaz. */
const CARD_EDGE = { start: 32, end: 68 } as const;

type Labels = {
  unsized: string;
  lastClose: string;
  small: string;
  smallTitle: string;
  share: string;
  cap: string;
  open: string;
};

type Tone = { tone: HeatTone; level: 0 | 1 | 2 | 3 | 4 };

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
  locale: Locale;
  labels: Labels;
}) {
  const colored = (index: number) =>
    moves?.basis === "session" && moves.included[index] && rows[index].changePct !== null;
  const sized = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.marketCap !== null && row.marketCap > 0);
  const unsized = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.marketCap === null || row.marketCap <= 0);
  const sizedTotal = sized.reduce((sum, { row }) => sum + row.marketCap!, 0);

  const tone = (index: number): Tone => {
    const change = rows[index].changePct;
    if (!colored(index) || change === null) return { tone: "flat", level: 0 };
    return heatOf(change);
  };
  const pctOf = (row: ThemeRow) => (row.changePct === null ? NO_VALUE : formatPercent(row.changePct, locale));

  return (
    <TreemapStage className={styles.stage} labels={{ cap: labels.cap, share: labels.share, open: labels.open }}>
      {LAYOUTS.map((layout) => {
        const weights = sized.map(({ row }) => row.marketCap!);
        const minShare = (layout.min.w * layout.min.h) / (layout.box.w * layout.box.h);
        const { kept, grouped } = splitSmall(weights, minShare);
        const groupWeight = grouped.reduce((sum, i) => sum + weights[i], 0);
        /* Grup karosu ağırlık dizisinin SONUNDA; `squarify` alanına göre
           sıralayıp yerini kendisi seçiyor. */
        const rects = squarify(
          [...kept.map((i) => weights[i]), ...(grouped.length > 0 ? [groupWeight] : [])],
          solo ? layout.soloAspect : layout.aspect,
        );
        const rosterId = `theme-small-${layout.key}`;
        return (
          <div key={layout.key} className={styles.mapLayout} data-layout={layout.key}>
            <div className={styles.map}>
              {rects.map((rect, rank) => {
                const center = rect.x + rect.w / 2;
                const place = {
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.w}%`,
                  height: `${rect.h}%`,
                  "--i": rank,
                } as CSSProperties;
                const reach = (step: { w: number; h: number }) =>
                  (rect.w / 100) * layout.max.w >= step.w && (rect.h / 100) * layout.max.h >= step.h;
                const cardX = center < CARD_EDGE.start ? "start" : center > CARD_EDGE.end ? "end" : "center";

                if (rect.index >= kept.length) {
                  const members = grouped.map((i) => sized[i].row);
                  const label = labels.small.replace("{count}", String(members.length));
                  return (
                    <a
                      key="group"
                      href={`#${rosterId}`}
                      className={cn(styles.tile, styles.groupTile)}
                      style={place}
                      aria-label={`${label}: ${members.map((row) => row.symbol).join(", ")}`}
                    >
                      <span className={styles.tileFace}>
                        <span className={styles.groupLogos} aria-hidden>
                          {members.slice(0, GROUP_LOGOS).map((row) => (
                            <LogoTile key={row.symbol} symbol={row.symbol} logoUrl={row.logoUrl} size="xs" />
                          ))}
                        </span>
                        <span className={styles.groupLabel}>{label}</span>
                        <span className={styles.groupCount} aria-hidden>
                          +{members.length}
                        </span>
                      </span>
                    </a>
                  );
                }

                const { row, index } = sized[kept[rect.index]];
                const heat = tone(index);
                const pct = pctOf(row);
                const muted = !colored(index);
                const lastClose = row.basis === "lastClose";
                const share = formatPercentPlain((row.marketCap! / sizedTotal) * 100, locale);
                const cap = formatMoneyCompact(row.marketCap, locale);
                const price = formatPrice(row.price, locale, { currency: true });
                const peek: PeekData = {
                  symbol: row.symbol,
                  name: row.name ?? row.symbol,
                  price,
                  pct,
                  tone: muted || row.changePct === null ? "flat" : row.changePct > 0 ? "up" : row.changePct < 0 ? "down" : "flat",
                  cap,
                  share,
                  note: lastClose ? labels.lastClose : "",
                };
                return (
                  <Link
                    key={row.symbol}
                    href={`/hisse/${row.symbol}`}
                    prefetch={false}
                    className={styles.tile}
                    style={place}
                    data-card-x={cardX}
                    data-peek={JSON.stringify(peek)}
                    aria-label={[
                      row.symbol,
                      row.name ?? row.symbol,
                      pct,
                      ...(lastClose ? [labels.lastClose] : []),
                      price,
                      `${labels.cap} ${cap}`,
                      `${labels.share} ${share}`,
                    ].join(" · ")}
                  >
                    <span
                      className={cn(styles.heat, styles.tileFace)}
                      data-heat-tone={heat.tone}
                      data-heat-level={heat.level}
                    >
                      <span className={styles.tileHead}>
                        {reach(REACH.logo) && (
                          <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" className={styles.tileLogo} />
                        )}
                        <span className={styles.tileId}>
                          <span className={cn("numeral", styles.tileSymbol)}>{row.symbol}</span>
                          {row.name && reach(REACH.name) && <span className={styles.tileName}>{row.name}</span>}
                        </span>
                      </span>
                      <span className={cn("numeral", styles.tilePct, muted && styles.tileMuted)}>{pct}</span>
                      {reach(REACH.foot) && (
                        <span className={styles.tileFoot}>
                          <span>
                            {labels.share} <b className="numeral">{share}</b>
                          </span>
                          <b className="numeral">{cap}</b>
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
            {grouped.length > 0 && (
              <Roster
                id={rosterId}
                title={labels.smallTitle}
                items={grouped.map((i) => {
                  const { row, index } = sized[i];
                  return { row, heat: tone(index), muted: !colored(index), pct: pctOf(row) };
                })}
              />
            )}
          </div>
        );
      })}
      {unsized.length > 0 && (
        <Roster
          title={labels.unsized}
          items={unsized.map(({ row, index }) => ({ row, heat: tone(index), muted: !colored(index), pct: pctOf(row) }))}
        />
      )}
    </TreemapStage>
  );
}

/**
 * Haritanın altındaki ad listesi — karosu olmayan ya da karosu gruba
 * katılan üyeler. Her satırda logo, sembol, AD ve yüzde; yüzdenin zemini
 * karonun ısı tonu, yani satır haritanın bir parçası gibi okunuyor.
 */
function Roster({
  id,
  title,
  items,
}: {
  id?: string;
  title: string;
  items: { row: ThemeRow; heat: Tone; muted: boolean; pct: string }[];
}) {
  return (
    <div id={id} className={styles.roster}>
      <h3 className={styles.rosterTitle}>
        {title} <span className="numeral">{items.length}</span>
      </h3>
      <ul className={styles.rosterList}>
        {items.map(({ row, heat, muted, pct }) => (
          <li key={row.symbol} className="min-w-0">
            <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.rosterItem}>
              <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
              <span className={styles.rosterText}>
                <b className="numeral">{row.symbol}</b>
                <small>{row.name ?? row.symbol}</small>
              </span>
              <span
                className={cn("numeral", styles.heat, styles.rosterPct, muted && styles.tileMuted)}
                data-heat-tone={heat.tone}
                data-heat-level={heat.level}
              >
                {pct}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
