import {
  ChartLineUp,
  Coins,
  Funnel,
  Heartbeat,
  Megaphone,
  TrendUp,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Dictionary } from "@/lib/i18n";
import { CATEGORY_WEIGHTS, ELIMINATED_CAP, type Band, type CheckId, type ScreenCategory } from "@/lib/screening";
import { labelRows, SCORE_BAND_FLOORS } from "@/lib/tool-visuals";
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

/** Kulvarın alt ucu en az bu; daha düşük puan varsa onlu yuvarlanarak iner. */
const LANE_FLOOR = 40;
/** Etiketlerin yatay en küçük aralığı (kulvar yüzdesi) — geniş ekran. */
const LABEL_GAP = 7;
/** Telefonda: 340 piksellik kulvarda dört harflik sembol ~%9 tutuyor
    (390'da ölçüldü, 25 Ekim: %7 ile "INTC" ve "BE" üst üste biniyordu). */
const LABEL_GAP_PHONE = 11;
const ROWS_PHONE = 5;
/** Geniş ekranda etiket satırı — 768'de üçüyle "INTC" ve "BE" üst üste biniyordu. */
const ROWS_WIDE = 4;

/**
 * PUANLAR TEK KULVARDA. Kartlar puanı tek tek halkayla veriyordu; on altı
 * hissenin birbirine göre nerede durduğu (kaçı aynı bantta, en yüksekle en
 * düşük arası ne kadar) ancak hepsini okuyarak çıkıyordu. Kulvarda her hisse
 * bir nokta, rengi bandından (görüş paleti: güçlü yeşil, karışık pirinç,
 * zayıf kırmızı — kartlardaki halkayla aynı), çentikler bant eşikleri.
 * Kulvarın alt ucu 40 ya da en düşük puanın altındaki onluk: 0'dan başlasa
 * on altı nokta sağ çeyreğe yığılırdı; uçlar yazılı.
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
  const labelRow = labelRows(positions, LABEL_GAP, ROWS_WIDE);
  const labelRowPhone = labelRows(positions, LABEL_GAP_PHONE, ROWS_PHONE);
  const notches = [
    { at: SCORE_BAND_FLOORS.mixed, label: bands.mixed },
    { at: SCORE_BAND_FLOORS.worth, label: bands.worth },
    { at: SCORE_BAND_FLOORS.strong, label: bands.strong },
  ].filter((n) => n.at > lo);
  return (
    <figure className={styles.lane}>
      <figcaption className={styles.laneHead}>
        <span>{V.laneTitle}</span>
        <span className={styles.laneHint}>{V.laneHint}</span>
      </figcaption>
      <div className={styles.laneTrack} aria-hidden>
        {notches.map((n) => (
          <span key={n.at} className={styles.notch} style={{ left: `${pos(n.at)}%` }}>
            <span className={`numeral ${styles.notchValue}`}>{n.at}</span>
            <span className={styles.notchLabel}>{n.label}</span>
          </span>
        ))}
        <span className={styles.rail} />
        {rows.map((row, i) => (
          <span
            key={row.symbol}
            className={styles.dot}
            data-band={row.band ?? "limited"}
            data-row={labelRow[i]}
            data-row-phone={labelRowPhone[i]}
            style={{ left: `${positions[i]}%`, ["--i" as string]: i }}
          >
            <span className={styles.dotLabel}>{row.symbol}</span>
          </span>
        ))}
      </div>
      <div className={`numeral ${styles.laneEnds}`} aria-hidden>
        <span>{lo}</span>
        <span>100</span>
      </div>
    </figure>
  );
}
