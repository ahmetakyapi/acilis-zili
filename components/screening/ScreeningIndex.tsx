import type { CSSProperties } from "react";
import {
  ChartLineUp,
  Coins,
  Funnel,
  Heartbeat,
  MagnifyingGlass,
  Megaphone,
  Prohibit,
  Question,
  Scales,
  Star,
  TrendUp,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Dictionary } from "@/lib/i18n";
import { CATEGORY_WEIGHTS, ELIMINATED_CAP, type Band, type CheckId, type ScreenCategory } from "@/lib/screening";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { laneLabelLayout, SCORE_BAND_FLOORS } from "@/lib/tool-visuals";
import { MiniDial } from "./ScreenVisuals";
import styles from "./ScreeningIndex.module.css";

/**
 * /hisse-secimi giriş sayfasının görsel katmanı (25 Ekim görsel turu).
 *
 * Kurallar paneli yedi metin bloğuydu: başlık, paragraf, kural listesi —
 * hepsi aynı gri tonda alt alta. Her kategori artık kendi kartı: ikon,
 * puandaki ağırlığı bir halka olarak (yüzde, kategorinin puana katkısı),
 * neden önemli olduğu ve kuralları. Eleme ayrı bir şerit: puana girmiyor,
 * kapı görevi görüyor — kartlarla aynı kalıba sokulsa öteki altısıyla eşit
 * bir "kategori" gibi okunurdu.
 */

const ICONS: Record<ScreenCategory, Icon> = {
  gate: Funnel,
  growth: TrendUp,
  profitability: Coins,
  health: Heartbeat,
  strength: ChartLineUp,
  ownership: UsersThree,
  catalyst: Megaphone,
};

const RING = 2 * Math.PI * 15;

function WeightRing({ weight, label }: { weight: number; label: string }) {
  return (
    <span className={styles.ring} title={label}>
      <svg viewBox="0 0 36 36" aria-hidden>
        <circle className={styles.ringTrack} cx="18" cy="18" r="15" />
        <circle
          className={styles.ringFill}
          cx="18"
          cy="18"
          r="15"
          strokeDasharray={`${(weight / 100) * RING} ${RING}`}
        />
      </svg>
      <b className="numeral">{weight}</b>
    </span>
  );
}

export function RuleCards({
  categories,
  rules,
  S,
  V,
}: {
  categories: readonly ScreenCategory[];
  rules: Record<ScreenCategory, CheckId[]>;
  S: Dictionary["screening"];
  V: Dictionary["toolVisuals"]["screening"];
}) {
  return (
    <div className={styles.rules} data-motion-stagger>
      {categories.map((category) => {
        const Glyph = ICONS[category];
        const gate = category === "gate";
        return (
          <section key={category} className={styles.rule} data-gate={gate || undefined}>
            <div className={styles.ruleHead}>
              <span className={styles.icon} aria-hidden>
                <Glyph size={20} weight="duotone" />
              </span>
              <div className={styles.ruleTitle}>
                <h3>{S.categories[category]}</h3>
                <span>
                  {gate
                    ? V.gateNote.replace("{cap}", String(ELIMINATED_CAP))
                    : V.rulesCount.replace("{n}", String(rules[category].length))}
                </span>
              </div>
              {!gate && (
                <WeightRing
                  weight={CATEGORY_WEIGHTS[category]}
                  label={`${V.weightShare}: ${S.weight.replace("{n}", String(CATEGORY_WEIGHTS[category]))}`}
                />
              )}
            </div>
            <p className={styles.why}>{S.categoryWhy[category]}</p>
            <ul className={styles.list}>
              {rules[category].map((id) => (
                <li key={id}>
                  <b>{S.checks[id].name}</b>
                  <span>{S.checks[id].rule}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Kapak: 100 puanın paylaşımı
   ------------------------------------------------------------------------- */

/**
 * AĞIRLIK BİR PAY, ÇUBUK DEĞİL (6 Kasım). Kapak altı ayrı çubuktu, her biri
 * en büyük ağırlığa (30) göre doluydu: "Büyüme" tam dolu görünüyor, altı
 * çubuğun toplamının 100 olduğu hiçbir yerden okunmuyordu; çubuklar da
 * yumuşak mavideydi (mavi = etkileşim; ağırlık bir büyüklük). Şimdi tek
 * cetvel 0–100 ve her kategori o cetvelde KENDİ DİLİMİNİ tutuyor: dilim
 * bir öncekinin bittiği yerden başlıyor (şelale), son dilim tam 100'de
 * bitiyor. Payın büyüklüğü dilimin boyu, toplamı cetvelin kendisi; renk
 * nötr mürekkep (görüş değil, büyüklük). Sayı satırın sağında birimiyle.
 * Cetvelin 0/100 uç künyesi yok: üstteki cümle "100 üzerinden" diyor ve
 * kapağın sağ sütunu sol sütundan uzun kalıyordu (1440'ta +20 px).
 */
export function WeightShare({
  weights,
  names,
  V,
}: {
  weights: readonly { key: string; weight: number }[];
  names: Record<string, string>;
  V: Dictionary["toolVisuals"]["screening"];
}) {
  const total = weights.reduce((sum, item) => sum + item.weight, 0) || 1;
  const starts = weights.map((_, i) => weights.slice(0, i).reduce((sum, item) => sum + item.weight, 0));
  return (
    <figure className={styles.share}>
      <figcaption className={styles.shareHint}>{V.weightsHint.replace("{n}", String(total))}</figcaption>
      <ol className={styles.shareRows}>
        {weights.map((item, i) => {
          const from = (starts[i] / total) * 100;
          return (
            <li key={item.key} className={styles.shareRow}>
              <span className={styles.shareName}>{names[item.key]}</span>
              <b className={`numeral ${styles.shareValue}`}>{V.weightPoints.replace("{n}", String(item.weight))}</b>
              <span className={styles.shareRail} aria-hidden>
                {/* `--i`: giriş kademesi (CSS share-in). */}
                <span style={{ left: `${from}%`, width: `${(item.weight / total) * 100}%`, "--i": i } as CSSProperties} />
              </span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

/* -------------------------------------------------------------------------
   Hızlı bakış: puan kulvarı
   ------------------------------------------------------------------------- */

/** Kulvarın alt ucu en az bu; daha düşük puan varsa onlu yuvarlanarak iner. */
const LANE_FLOOR = 40;

/**
 * Etiket yerleşiminin kırılımları. `track`: o kırılımdaki EN DAR kulvar
 * (piksel) — çakışmasızlık oradan büyüğe taşınıyor (gerekçe
 * `laneLabelLayout`). Ölçüldü (6 Kasım, gerçek sayfa, .tmp ölçüm betiği):
 * kulvar 320'de 250, 360'ta 290, 640'ta 558, 1100'de 1002 piksel; payla
 * aşağı yuvarlandı. Telefonda iki satır 70+ piksel kaydırıyordu (etiket
 * noktasından kopuk), üç satırda en büyük kayma 15–25 piksel: uzak satırın
 * çizgisi yakın etiketin arkasından geçiyor (CSS `.laneTag` zemini).
 */
const LANE_FITS = [
  { key: "p", track: 248, gap: 4, maxRows: 3, maxShift: 34 },
  { key: "m", track: 540, gap: 4, maxRows: 2, maxShift: 30 },
  { key: "w", track: 960, gap: 4, maxRows: 2, maxShift: 26 },
] as const;

/** Etiket mono puntoda (11 px): genişlik harf sayısından kesin çıkıyor —
    sunucu ölçemiyor, çakışma çözücü tahminle değil hesapla çalışsın.
    Mono ~0,6 em; 6,7 px pay bırakıyor, +4 px iki yan nefes. */
const LABEL_CHAR = 6.7;
const LABEL_PAD = 4;
/** Dikey ölçüler (piksel) — CSS'teki `.laneTag` / `.leader` hesaplarıyla aynı:
    satır aralığı, raydan yakın etiketin kenarına uzaklık, etiket boyu, kenar payı. */
const ROW_PITCH = 18;
const LEAD = 22;
const TAG_H = 14;
const EDGE = 10;

/** Bant → kulvar bölgesi (en düşükten). Eleme/veri yetersiz bölge açmaz:
    elenen hisse 45'le sınırlanıp zayıf bölgeye düşüyor. */
const ZONES = [
  { band: "weak", to: SCORE_BAND_FLOORS.mixed },
  { band: "mixed", to: SCORE_BAND_FLOORS.worth },
  { band: "worth", to: SCORE_BAND_FLOORS.strong },
  { band: "strong", to: 100 },
] as const;

/**
 * PUANLAR TEK KULVARDA. Kartlar puanı tek tek halkayla veriyordu; on altı
 * hissenin birbirine göre nerede durduğu (kaçı aynı bantta, en yüksekle en
 * düşük arası ne kadar) ancak hepsini okuyarak çıkıyordu. Kulvarda her hisse
 * bir nokta, rengi bandından (görüş paleti: güçlü yeşil, karışık pirinç,
 * zayıf kırmızı — kartlardaki halkayla aynı).
 * Kulvarın alt ucu 40 ya da en düşük puanın altındaki onluk: 0'dan başlasa
 * on altı nokta sağ çeyreğe yığılırdı; uçlar yazılı.
 *
 * 6 Kasım turu: BANTLAR ZEMİNDE. Eşikler kulvarın altında kesik çentikti ve
 * bant adları çentiğin altına yazılıyordu — hangi aralığın hangi bant olduğu
 * çıkarım istiyordu. Şimdi her bant kulvarın arkasında kendi tonunda bir
 * bölge (yüzde 6–9'luk yıkama, kart halkasının rengi), adı bölgenin altında
 * aynı mürekkeple; eşik sayıları eksende sınırın tam altında. Etiketler
 * çakışma çözücüyle (`laneLabelLayout`) üstte ve altta tek sıra; nokta ile
 * etiket arasındaki çizgi kesişmiyor.
 */
export function ScoreLane({
  rows,
  bands,
  V,
}: {
  rows: { symbol: string; score: number; band: Band | null }[];
  bands: Dictionary["screening"]["bands"];
  V: Dictionary["toolVisuals"]["screening"];
}) {
  if (rows.length < 2) return null;
  const min = Math.min(...rows.map((row) => row.score));
  const lo = Math.min(LANE_FLOOR, Math.floor((min - 5) / 10) * 10);
  const pos = (score: number) => ((Math.min(100, Math.max(lo, score)) - lo) / (100 - lo)) * 100;
  const positions = rows.map((row) => pos(row.score));
  const items = rows.map((row, i) => ({ at: positions[i], width: row.symbol.length * LABEL_CHAR + LABEL_PAD }));

  const plot: Record<string, string> = {};
  const tagVars: Record<string, string | number>[] = rows.map(() => ({}));
  for (const fit of LANE_FITS) {
    const places = laneLabelLayout(items, fit);
    const used = Math.max(...places.map((place) => place.row)) + 1;
    const above = Math.ceil(used / 2);
    const below = Math.floor(used / 2);
    const railY = EDGE + LEAD + TAG_H + (above - 1) * ROW_PITCH;
    plot[`--rail-y-${fit.key}`] = `${railY}px`;
    plot[`--plot-h-${fit.key}`] = `${railY + (below ? LEAD + TAG_H + (below - 1) * ROW_PITCH : 12) + EDGE}px`;
    places.forEach((place, i) => {
      const vars = tagVars[i];
      vars[`--x-${fit.key}`] = place.shift;
      vars[`--xa-${fit.key}`] = Math.max(1, Math.abs(place.shift));
      vars[`--fx-${fit.key}`] = place.shift < 0 ? -1 : 1;
      vars[`--s-${fit.key}`] = place.row % 2 === 0 ? -1 : 1;
      vars[`--lv-${fit.key}`] = Math.floor(place.row / 2);
    });
  }

  const zones = ZONES.map((zone, i) => {
    const start = i === 0 ? lo : ZONES[i - 1].to;
    return { band: zone.band, start, end: zone.to, left: pos(start), width: pos(zone.to) - pos(start) };
  }).filter((zone) => zone.width > 0);
  const ticks = [lo, ...zones.slice(0, -1).map((zone) => zone.end), 100];

  return (
    <figure className={styles.lane}>
      <figcaption className={styles.laneHead}>
        <span>{V.laneTitle}</span>
        <span className={styles.laneHint}>{V.laneHint}</span>
      </figcaption>
      <div className={styles.lanePlot} style={plot as CSSProperties} aria-hidden>
        {zones.map((zone) => (
          <span key={zone.band} className={styles.zone} data-band={zone.band} style={{ left: `${zone.left}%`, width: `${zone.width}%` }} />
        ))}
        <span className={styles.rail} />
        {rows.map((row, i) => (
          <span key={row.symbol} className={styles.leader} style={{ "--at": positions[i], ...tagVars[i] } as CSSProperties}>
            <svg viewBox="0 0 1 1" preserveAspectRatio="none">
              <line x1="0" y1="1" x2="1" y2="0" vectorEffect="non-scaling-stroke" />
            </svg>
          </span>
        ))}
        {rows.map((row, i) => (
          <span
            key={row.symbol}
            className={styles.dot}
            data-band={row.band ?? "limited"}
            style={{ left: `${positions[i]}%`, "--i": i } as CSSProperties}
          />
        ))}
        {rows.map((row, i) => (
          <span key={row.symbol} className={styles.laneTag} data-band={row.band ?? "limited"} style={{ "--at": positions[i], ...tagVars[i] } as CSSProperties}>
            {row.symbol}
          </span>
        ))}
      </div>
      <div className={styles.laneAxis} aria-hidden>
        {ticks.map((tick, i) => (
          <span
            key={tick}
            className={`numeral ${styles.tick}`}
            data-edge={i === 0 ? "start" : i === ticks.length - 1 ? "end" : undefined}
            style={{ left: `${pos(tick)}%` }}
          >
            {tick}
          </span>
        ))}
        {zones.map((zone) => (
          <span key={zone.band} className={styles.zoneName} data-band={zone.band} style={{ left: `${zone.left}%`, width: `${zone.width}%` }}>
            {bands[zone.band]}
          </span>
        ))}
      </div>
      {/* Telefonda bölge adları sığmıyor (15 puanlık bölge ~60 piksel):
          aynı bilgi aralığıyla bir lejant olarak. */}
      <ul className={styles.zoneLegend}>
        {[...zones].reverse().map((zone) => (
          <li key={zone.band} data-band={zone.band}>
            <span className={styles.zoneSwatch} aria-hidden />
            {bands[zone.band]}
            <span className="numeral">
              {zone.band === "strong" ? V.zoneFrom.replace("{n}", String(zone.start)) : `${zone.start}–${zone.end - 1}`}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* -------------------------------------------------------------------------
   Hızlı bakış: kartlar
   ------------------------------------------------------------------------- */

const BAND_ICONS: Record<Band, Icon> = {
  strong: Star,
  worth: MagnifyingGlass,
  mixed: Scales,
  weak: XCircle,
  eliminated: Prohibit,
  limited: Question,
};

export type QuickRow = { symbol: string; name: string; logoUrl: string | null; score: number | null; band: Band | null };

/**
 * HIZLI BAKIŞ KARTI (6 Kasım). Bant kartın tepesindeki 3 piksellik şeritte
 * (bilanço, teknik ve risk kartlarıyla aynı dil) ve altta ikonlu satırda:
 * renk tek başına taşımasın, şekil de söylesin (VerdictPill gerekçesi).
 * Logo sembolün satırında, halkayla aynı hatta; şirket adı kartın tam
 * genişliğinde — üç sütunun ortasındayken 1440'ta 96 piksele düşüp
 * "Advanced Micro De..." diye kesiliyordu.
 */
export function QuickCards({ rows, bands }: { rows: readonly QuickRow[]; bands: Dictionary["screening"]["bands"] }) {
  return (
    <ul className={styles.quick}>
      {rows.map((row) => {
        const Glyph = row.band ? BAND_ICONS[row.band] : null;
        return (
          <li key={row.symbol}>
            <Link href={`/hisse-secimi/${row.symbol}`} className={styles.quickCard} data-band={row.band ?? "limited"} data-motion-action>
              <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
              <strong className={styles.quickSymbol}>{row.symbol}</strong>
              <MiniDial score={row.score} band={row.band} />
              <span className={styles.quickCo} title={row.name}>{row.name}</span>
              {row.band && Glyph && (
                <span className={styles.quickBand}>
                  <Glyph size={14} weight={row.band === "strong" ? "fill" : "bold"} aria-hidden />
                  {bands[row.band]}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
