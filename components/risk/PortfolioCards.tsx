import Link from "next/link";
import { Warning, TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { VerdictPill } from "@/components/ui/VerdictPill";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { dodgeLabels } from "@/lib/broker-board";
import type { Dictionary } from "@/lib/i18n";
import type { Exposure, PositionRow } from "@/lib/risk/exposure";
import { fill, num, pct, rounded, signedPct, type Loc } from "@/lib/risk/format";
import { MA_WINDOWS, POSITION_VOL_PCTILE, type MaWindow } from "@/lib/risk/thresholds";
import type { RuleTone } from "@/lib/risk/rules";
import { sectorLabel } from "@/lib/sectors";
import desk from "./RiskDesk.module.css";
import styles from "./PortfolioCards.module.css";

/**
 * RİSK MASASI — PORTFÖY KARTLARI (25 Ekim, kart düzeni).
 *
 * Sahibinin isteği: "kendi portföyünü görüp daha iyi anlayabildiği bir
 * sistem; yan yana kartlar; yatayda bu kadar büyük detaylara gerek yok".
 * Önceki düzende portföy tek satır dört sayı ve on bir sütunlu bir tabloydu;
 * şimdi her pozisyon kendi kartında ve tablo "Tablo Görünümü" katlamasında
 * duruyor (veri kaybolmadı, yer değiştirdi).
 *
 * Sunucuda çizilir, istemci JS'i yok. Renk anlamı: kart ve halka tonu rejim
 * üçlüsünden (sakin / gergin / stres, `data-tone`), yön renkleri yalnız 200
 * GO uzaklığının işaretinde, nötr büyüklük markanın yumuşak mavisinde
 * (`--primary-soft`); sayılar metin renginde. 31 Ekim: "Ortalamaların
 * Altında" çubukları da ton üçlüsünde (100 GO gergin, 200 GO stres — kart
 * tonunun eşikleri), oynaklık dilimi bölgeli ölçekte (aşağıda).
 */

type T = Dictionary["riskDesk"];
type Common = { t: T; locale: Loc };

const PERCENT = 100;
/** Beta kadranının en küçük tavanı: SPY (1) ölçeğin ortasında dursun. */
const BETA_SCALE_MIN = 2;
/** Halka çevresi `pathLength` ile 100 birim: dilim doğrudan yüzde. */
const RING = 100;
/** Kadran yayı: merkez (50, 50), yarıçap 40. */
const ARC_R = 40;
const ARC_CX = 50;
const ARC_CY = 50;
/** Minyatürün çizim yüksekliği (piksel; viewBox ile bire bir) ve iç payı. */
const TRAIL_H = 76;
const TRAIL_PAD = 6;
/** Uç etiketleri arasındaki en az dikey aralık (piksel; nano puntonun satırı). */
const LABEL_GAP = 13;
/** 200 GO farkı şeridinin ortak tavan basamakları (±yüzde). */
const DISTANCE_STEPS = [10, 20, 30, 50, 100] as const;
/** Sektör kartında adıyla yazılan en çok sektör. */
const SECTOR_LEGEND = 3;

const VERDICT_TEXT = { tr: { buy: "AL", hold: "TUT", sell: "SAT" }, en: { buy: "BUY", hold: "HOLD", sell: "SELL" } } as const;
/** Rejim ölçeğinin basamak sayısı: Sakin · Gergin · Stres. */
const TONE_STEPS = [0, 1, 2] as const;

/** Değerin işaret yönü, gösterilen yuvarlakla (−0,0 renk almaz). */
function dirOf(value: number | null, digits = 1): "up" | "down" | undefined {
  if (value === null) return undefined;
  const shown = rounded(value, digits);
  return shown > 0 ? "up" : shown < 0 ? "down" : undefined;
}

function toneOfPctile(p: number | null): 0 | 1 | 2 | undefined {
  if (p === null) return undefined;
  return p >= POSITION_VOL_PCTILE.stress ? 2 : p >= POSITION_VOL_PCTILE.tense ? 1 : 0;
}

/**
 * Oynaklık dilimi ölçeği: 0–100, üç bölge (sakin / gergin / stres; eşikler
 * `POSITION_VOL_PCTILE`) ve değerin işareti — rejim kartındaki skor
 * ölçeğinin dili. Bulunduğu bölge dolu, ötekiler soluk.
 *
 * NEDEN HALKA DEĞİL (31 Ekim). Özet kartında dilim bir halkaydı; sakin
 * tonun yumuşak yeşili açık temada zemine çok yakın, %26'lık yay "boş
 * halka" gibi okunuyordu ve 80/95 eşiklerinin nerede olduğunu söylemiyordu.
 * Bölgeli şerit hem yeri hem eşiği gösteriyor; kartlardaki dilim de aynı
 * çizimle okunuyor.
 */
function PctileScale({ value, label, ticks = false }: { value: number; label: string; ticks?: boolean }) {
  const tone = toneOfPctile(value);
  const zones = [
    { tone: 0, size: POSITION_VOL_PCTILE.tense },
    { tone: 1, size: POSITION_VOL_PCTILE.stress - POSITION_VOL_PCTILE.tense },
    { tone: 2, size: PERCENT - POSITION_VOL_PCTILE.stress },
  ] as const;
  const at = Math.min(PERCENT, Math.max(0, value));
  return (
    <span className={styles.pScale} data-ticks={ticks || undefined} role="img" aria-label={label}>
      <span className={styles.pZones} aria-hidden>
        {zones.map((z) => (
          <i key={z.tone} data-tone={z.tone} data-on={z.tone === tone || undefined} style={{ flexGrow: z.size }} />
        ))}
      </span>
      <span className={styles.pMark} style={{ left: `${at}%` }} aria-hidden />
      {ticks && (
        <b className={styles.pValue} style={{ left: `${at}%` }} aria-hidden>
          {Math.round(at)}
        </b>
      )}
      {ticks && (
        <span className={styles.pTicks} aria-hidden>
          <span style={{ left: "0%" }}>0</span>
          <span style={{ left: `${POSITION_VOL_PCTILE.tense}%` }}>{POSITION_VOL_PCTILE.tense}</span>
          <span style={{ left: `${POSITION_VOL_PCTILE.stress}%` }}>{POSITION_VOL_PCTILE.stress}</span>
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------- özet kartları */

function arcPoint(fraction: number): { x: number; y: number } {
  const angle = Math.PI * Math.min(1, Math.max(0, fraction));
  return { x: ARC_CX - ARC_R * Math.cos(angle), y: ARC_CY - ARC_R * Math.sin(angle) };
}

const ARC_PATH = `M${ARC_CX - ARC_R} ${ARC_CY} A${ARC_R} ${ARC_R} 0 0 1 ${ARC_CX + ARC_R} ${ARC_CY}`;

function BetaGauge({ value, label }: { value: number; label: string }) {
  const max = Math.max(BETA_SCALE_MIN, Math.ceil(value));
  const fraction = Math.max(0, value) / max;
  const market = arcPoint(1 / max);
  const end = arcPoint(fraction);
  return (
    <svg className={styles.gauge} viewBox="0 0 100 56" role="img" aria-label={label}>
      <path className={styles.arcTrack} d={ARC_PATH} pathLength={RING} />
      <path className={styles.arcFill} d={ARC_PATH} pathLength={RING} strokeDasharray={`${fraction * RING} ${RING}`} />
      <line className={styles.arcTick} x1={market.x} y1={market.y} x2={ARC_CX + (market.x - ARC_CX) * 0.72} y2={ARC_CY + (market.y - ARC_CY) * 0.72} />
      <circle className={styles.arcEnd} cx={end.x} cy={end.y} r={4} />
    </svg>
  );
}

/** Sektör halkası: en büyük sektör yumuşak mavi, kalanlar soluk; 2 birim aralık. */
function SectorRing({ sectors, label }: { sectors: Exposure["sectors"]; label: string }) {
  const GAP = sectors.length > 1 ? 2 : 0;
  /* Her dilimin başlangıcı: öncekilerin toplamı (render içinde atama yok). */
  const starts = sectors.map((_, i) => sectors.slice(0, i).reduce((sum, s) => sum + s.weight, 0));
  return (
    <svg className={styles.ring} viewBox="0 0 48 48" role="img" aria-label={label}>
      <circle className={styles.ringTrack} cx={24} cy={24} r={19} pathLength={RING} />
      {sectors.map((s, i) => {
        const len = Math.max(0, s.weight - GAP);
        return (
          <circle
            key={s.sector ?? "none"}
            className={i === 0 ? styles.ringFill : styles.ringRest}
            cx={24}
            cy={24}
            r={19}
            pathLength={RING}
            strokeDasharray={`${len} ${RING - len}`}
            strokeDashoffset={-(starts[i] ?? 0)}
          />
        );
      })}
    </svg>
  );
}

/* ORTALAMANIN ALTINDAKİ PAYIN TONU (31 Ekim). Üç çubuk da yumuşak maviydi;
   "%100 altında" ile "%40 altında" aynı renkte büyüklük gibi duruyordu, oysa
   bu bir risk okumasıdır. Kart tonunun eşikleriyle aynı dil: 100 GO altı
   gergin, 200 GO altı stres (`positionTone`); 50 GO tonun girdisi değil,
   nötr büyüklük olarak yumuşak mavide kalır. */
const BELOW_TONE: Record<MaWindow, 1 | 2 | undefined> = { 50: undefined, 100: 1, 200: 2 };

export function SummaryCards({ exposure, t, locale }: Common & { exposure: Exposure }) {
  const T = t.cards;
  const beta = exposure.beta?.value ?? null;
  const vol = exposure.vol20?.value ?? null;
  const volP = exposure.volPctile?.value ?? null;
  const top = exposure.sectors[0];
  /* 200 GO'nun üstündekilerden ona en yakın olan: "%0" okumasının neden
     sınırda olduğunu tek satırda söyler (25 Ekim'de SNDK +%0,1). */
  const nearest = exposure.positions
    .filter((p) => p.below[200] === false && p.ma[200].distance !== null)
    .sort((a, b) => a.ma[200].distance! - b.ma[200].distance!)[0];
  const maLabel: Record<MaWindow, string> = { 50: t.indices.ma50, 100: t.indices.ma100, 200: t.indices.ma200 };
  const sectorName = (s: Exposure["sectors"][number]) => sectorLabel(s.sector, locale) ?? t.positions.unclassified;
  const sectorList = exposure.sectors.map((s) => `${sectorName(s)} ${pct(s.weight, locale)}`).join(", ");
  return (
    <section className={styles.summary} aria-labelledby="risk-summary">
      <h2 id="risk-summary" className="sr-only">
        {T.summaryTitle}
      </h2>
      <div className={styles.tile}>
        <h3 className={styles.tileTitle}>{T.betaTitle}</h3>
        <div className={styles.tileBody}>
          <p className={styles.tileValue}>{num(beta, locale)}</p>
          {beta !== null && <BetaGauge value={beta} label={fill(T.betaGauge, { v: num(beta, locale), max: Math.max(BETA_SCALE_MIN, Math.ceil(beta)) })} />}
        </div>
        <p className={styles.tileLabel}>{beta !== null ? fill(T.betaLabel, { v: num(beta, locale) }) : fill(T.covered, { v: pct(0, locale, 0) })}</p>
      </div>
      <div className={styles.tile}>
        <h3 className={styles.tileTitle}>{T.volTitle}</h3>
        <div className={styles.tileBody}>
          <p className={styles.tileValue}>{pct(vol, locale)}</p>
          {volP !== null && (
            <span className={styles.tileScale}>
              <PctileScale value={volP} ticks label={fill(T.volRing, { p: num(volP, locale, 0) })} />
            </span>
          )}
        </div>
        <p className={styles.tileLabel}>
          {fill(T.volLabel, { p: num(volP, locale, 0) })} · {t.exposure.atr} {pct(exposure.atrPct?.value, locale, 2)}
        </p>
      </div>
      <div className={styles.tile}>
        <h3 className={styles.tileTitle}>{T.belowTitle}</h3>
        <div className={styles.belowBars}>
          {MA_WINDOWS.map((w) => {
            const b = exposure.below[w];
            const share = b.covered > 0 ? (b.weight / b.covered) * PERCENT : null;
            const tone = BELOW_TONE[w];
            return (
              <div key={w} className={styles.belowRow}>
                <span>{maLabel[w]}</span>
                <span className={desk.lane} data-tone={tone}>
                  {share !== null && <span className={`${desk.laneFill} ${tone !== undefined ? styles.toneFill : ""}`} style={{ width: `${share}%` }} />}
                </span>
                <b>{share === null ? num(null, locale) : pct(b.weight, locale, 0)}</b>
              </div>
            );
          })}
        </div>
        <p className={styles.tileLabel}>
          {nearest
            ? fill(T.belowLabel, { s: nearest.symbol, v: signedPct(nearest.ma[200].distance, locale) })
            : fill(T.covered, { v: pct(exposure.below[200].covered, locale, 0) })}
        </p>
      </div>
      <div className={styles.tile}>
        <h3 className={styles.tileTitle}>{T.sectorTitle}</h3>
        <div className={styles.tileBody}>
          <p className={styles.tileValue}>{top ? pct(top.weight, locale) : num(null, locale)}</p>
          {exposure.sectors.length > 0 && <SectorRing sectors={exposure.sectors} label={fill(T.sectorRing, { list: sectorList })} />}
        </div>
        {/* SEKTÖR LEJANTI (31 Ekim): yalnız en büyük sektörün adı yazıyordu;
            halkanın soluk dilimi neyin payı, okunmuyordu. İlk üç sektör
            halkadaki rengiyle (en büyüğü yumuşak mavi, kalanlar soluk). */}
        {exposure.sectors.length > 0 && (
          <ul className={styles.sectorLegend}>
            {exposure.sectors.slice(0, SECTOR_LEGEND).map((s, i) => (
              <li key={s.sector ?? "none"} data-lead={i === 0 || undefined}>
                <span title={sectorName(s)}>{sectorName(s)}</span>
                <b>{pct(s.weight, locale)}</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ pozisyon kartı */

const MA_DASH: Record<MaWindow, string | undefined> = { 50: undefined, 100: "5 3", 200: "1.5 2.5" };

/**
 * Üç aylık kapanış ve 50/100/200 GO.
 *
 * OKUNUR MİNYATÜR (31 Ekim; sahibinin itirazı: etiketler "sağda üst üste
 * yığılmış, okunmuyor"). Etiketler yüzdeyle konumlanıyor ve yalnız aşağı
 * itiliyordu; 56 piksellik çizimde üçü bir arada kalınca alt kenarı aşıp
 * çizginin ucundan kopuyordu. Artık çizim sabit piksel yükseklikte
 * (viewBox ile bire bir, `TRAIL_H`), etiketler `dodgeLabels` ile iki
 * yönlü ayrılıyor (sıra korunur, sınır içinde kalır) ve her etiketin
 * önünde kendi çizgisinin deseni (düz / kesik / noktalı): hangi çizginin
 * hangi ortalama olduğu desene bakarak okunuyor. Fiyat yumuşak mavi ve
 * kalın, ortalamalar saç teli; son kapanış uçta nokta. Etiketler ve nokta
 * HTML'de: SVG genişliğe gerilir, yazı ve daire gerilmesin.
 */
function Trail({ row, label }: { row: PositionRow; label: string }) {
  const { closes, ma } = row.trail;
  if (closes.length < 2) return null;
  const W = 200;
  const H = TRAIL_H;
  const values = [...closes, ...MA_WINDOWS.flatMap((w) => ma[w].filter((v): v is number => v !== null))];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const y = (v: number) => TRAIL_PAD + (1 - (v - min) / span) * (H - 2 * TRAIL_PAD);
  const x = (i: number) => (i / (closes.length - 1)) * W;
  const path = (series: readonly (number | null)[]) => {
    let d = "";
    let pen = false;
    series.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const ends = MA_WINDOWS.flatMap((w) => {
    const last = ma[w].at(-1);
    return last == null ? [] : [{ w, y: y(last) }];
  });
  const placed = dodgeLabels(
    ends.map((e) => e.y),
    LABEL_GAP,
    LABEL_GAP / 2,
    H - LABEL_GAP / 2,
  );
  const lastClose = closes[closes.length - 1]!;
  return (
    <div className={styles.trail}>
      <div className={styles.trailPlot}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
          {MA_WINDOWS.map((w) => (
            <path key={w} className={styles.trailMa} d={path(ma[w])} strokeDasharray={MA_DASH[w]} vectorEffect="non-scaling-stroke" />
          ))}
          <path className={styles.trailLine} d={path(closes)} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={styles.trailDot} style={{ top: `${y(lastClose)}px` }} aria-hidden />
      </div>
      <span className={styles.trailLabels} aria-hidden>
        {ends.map((e, k) => (
          <span key={e.w} style={{ top: `${placed[k]}px` }}>
            <svg viewBox="0 0 12 4" className={styles.trailSwatch}>
              <line x1={0} y1={2} x2={12} y2={2} strokeDasharray={MA_DASH[e.w]} />
            </svg>
            {e.w}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Ortak ölçek tavanları: bütün kartlar aynı şeridi okusun (CompareScale ilkesi). */
type Scales = { beta: number; distance: number };

function scalesOf(rows: readonly PositionRow[]): Scales {
  const betaPeak = Math.max(0, ...rows.map((r) => r.beta ?? 0));
  const distancePeak = Math.max(0, ...rows.map((r) => Math.abs(r.ma[200].distance ?? 0)));
  return {
    beta: Math.max(BETA_SCALE_MIN, Math.ceil(betaPeak)),
    distance: DISTANCE_STEPS.find((step) => distancePeak <= step) ?? DISTANCE_STEPS[DISTANCE_STEPS.length - 1],
  };
}

export type PositionRule = { label: string; tone: RuleTone };

function PositionCard({ row, rules, scales, t, locale }: Common & { row: PositionRow; rules: readonly PositionRule[]; scales: Scales }) {
  const T = t.cards;
  const flags: { label: string; kind: "up" | "down" }[] = [];
  if (row.cross === "golden") flags.push({ label: t.indices.golden, kind: "up" });
  if (row.cross === "death") flags.push({ label: t.indices.death, kind: "down" });
  for (const w of [100, 200] as const) if (row.crossedBelow[w]) flags.push({ label: fill(t.indices.crossedBelow, { w }), kind: "down" });
  const d200 = row.ma[200].distance;
  const dir = dirOf(d200);
  /* 200 GO şeridi sıfır ortada: dolgu ortadan değere, tavana yapışır. */
  const reach = d200 === null ? 0 : (Math.min(scales.distance, Math.abs(d200)) / scales.distance) * (PERCENT / 2);
  const betaShare = row.beta === null ? null : (Math.min(scales.beta, Math.max(0, row.beta)) / scales.beta) * PERCENT;
  return (
    <article className={styles.card} data-tone={row.tone} data-position-card={row.symbol}>
      <header className={styles.cardHead}>
        <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
        <div className={styles.cardId}>
          <h3 className={styles.cardSymbol}>{row.symbol}</h3>
          <span className={styles.cardName} title={row.name}>
            {row.name}
          </span>
        </div>
        <span className={styles.cardWeight} title={T.weightLabel}>
          <small>{T.weightLabel}</small>
          <b>{pct(row.weight, locale)}</b>
          <span className={styles.weightLane} aria-hidden>
            <span style={{ width: `${Math.min(PERCENT, row.weight)}%` }} />
          </span>
        </span>
      </header>

      <div className={styles.cardFigure}>
        <p className={styles.cardValue}>{pct(row.atrPct, locale, 2)}</p>
        {/* REJİM ÖLÇEĞİ (30 Ekim): renkli nokta + kelimeydi; artık üç
            basamaklı küçük bir ölçek, bulunduğu basamak dolu. Kelime
            yanında: renk tek başına anlam taşımıyor. 31 Ekim: hap tonun
            hafif zemininde, tepe şeridiyle aynı renk ailesinde (şerit,
            ölçek ve hap aynı şeyi söylüyor); kart telefonda tek sütun,
            kelime artık orada da sığıyor. */}
        <span className={styles.toneChip} title={T.toneNote}>
          <span className={styles.toneMeter} aria-hidden>
            {TONE_STEPS.map((step) => (
              <i key={step} data-on={step <= row.tone || undefined} />
            ))}
          </span>
          {t.regime.points[row.tone]}
        </span>
        <p className={styles.cardValueLabel} title={T.atrSub}>
          {T.atr}
        </p>
      </div>

      <p className={styles.trailTitle}>{T.chartTitle}</p>
      <Trail row={row} label={fill(T.chartLabel, { s: row.symbol })} />

      {/* ÖLÇÜLER ÇİZİMLE (31 Ekim): üç ölçü yalnız rakamdı; 3,38 ile 4,10
          betanın farkı göze gelmiyordu. Her ölçünün altında kendi şeridi,
          tavanı BÜTÜN kartlarda ortak (`scalesOf`): beta 0'dan ortak
          tavana, SPY (1) çentik; 200 GO farkı sıfır ortada, yön renginde;
          oynaklık dilimi kartın tonuyla aynı eşiklerde bölgeli ölçek. */}
      <dl className={styles.cardStats}>
        <div>
          <dt title={T.betaHint}>{T.beta}</dt>
          <dd>
            {num(row.beta, locale)}
            <span className={styles.meter} aria-hidden>
              {betaShare !== null && <span className={styles.meterFill} style={{ width: `${betaShare}%` }} />}
              <span className={styles.meterTick} style={{ left: `${PERCENT / scales.beta}%` }} />
            </span>
          </dd>
        </div>
        <div>
          <dt title={T.to200Hint}>{T.to200}</dt>
          <dd title={d200 === null ? T.noMa200 : undefined}>
            <span className={desk.dir} data-dir={dir}>
              {signedPct(d200, locale)}
            </span>
            <span className={styles.meter} aria-hidden>
              {d200 !== null && (
                <span
                  className={styles.meterFill}
                  data-dir={dir}
                  style={dir === "down" ? { left: `${PERCENT / 2 - reach}%`, width: `${reach}%` } : { left: "50%", width: `${reach}%` }}
                />
              )}
              <span className={styles.meterTick} style={{ left: "50%" }} />
            </span>
          </dd>
        </div>
        <div>
          <dt title={T.pctileHint}>{T.pctile}</dt>
          <dd>
            {num(row.vol20Pctile, locale, 0)}
            {row.vol20Pctile !== null ? (
              <PctileScale value={row.vol20Pctile} label={fill(T.volRing, { p: num(row.vol20Pctile, locale, 0) })} />
            ) : (
              <span className={styles.meter} aria-hidden />
            )}
          </dd>
        </div>
      </dl>

      {/* UYARILAR İKONLU SATIR (31 Ekim): gri kutudan çıktı (CLAUDE.md
          "uyarı hap yığını değil ikonlu satır"); kutu her kartta farklı
          boyda bir blok açıyordu. Saç teliyle ayrılmış düz satırlar: kural
          uyarısı kullanıcının seçtiği tonla (ünlem), ortalama kesişi yön
          okuyla. */}
      {(rules.length > 0 || flags.length > 0) && (
        <ul className={styles.alerts}>
          {rules.map((r) => (
            <li key={r.label} data-tag={r.tone} title={T.ruleTitle}>
              <Warning aria-hidden weight="fill" />
              {r.label}
            </li>
          ))}
          {flags.map((f) => (
            <li key={f.label} data-flag={f.kind}>
              {f.kind === "up" ? <TrendUp aria-hidden weight="bold" /> : <TrendDown aria-hidden weight="bold" />}
              {f.label}
            </li>
          ))}
        </ul>
      )}

      {/* GÖRÜŞLER ve UYARILAR AYRI (30 Ekim). Hepsi aynı noktalı haptı ve
          dört-beş hap alt alta yığılınca kartın yarısı etiket oluyordu;
          görüş ile kural uyarısı aynı ağırlıkta okunuyordu. Görüşler
          sitenin görüş hapı (VerdictPill, yön ikonlu), uyarılar ikonlu
          sade satırlar. 31 Ekim: görüşler kartın DİBİNDE (`margin-top:
          auto`), iki eşit sütunda — ızgara satırındaki kartlar eşit boyda,
          haplar komşu kartlarla aynı hatta ve aynı genişlikte. */}
      {(row.technical || row.earnings) && (
        <div className={styles.cardVerdicts}>
          {row.technical && (
            <Link href={row.technical.href} className={`${styles.verdictLink} tap-44`} title={t.positions.viewTitle}>
              <VerdictPill
                verdict={row.technical.verdict}
                label={`${t.positions.technicalShort} ${VERDICT_TEXT[locale][row.technical.verdict]}`}
                size="xs"
                className="w-full justify-center"
              />
              <span className="sr-only"> · {t.positions.viewTitle}</span>
            </Link>
          )}
          {row.earnings && (
            <Link
              href={row.earnings.href}
              className={`${styles.verdictLink} tap-44`}
              title={`${t.positions.earningsView} · ${row.earnings.period}`}
            >
              <VerdictPill
                verdict={row.earnings.verdict}
                label={`${t.positions.earningsShort} ${VERDICT_TEXT[locale][row.earnings.verdict]}`}
                size="xs"
                className="w-full justify-center"
              />
              <span className="sr-only"> · {t.positions.earningsView}</span>
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

export function PositionCards({
  exposure,
  rulesBySymbol,
  t,
  locale,
  children,
}: Common & {
  exposure: Exposure;
  rulesBySymbol: ReadonlyMap<string, PositionRule[]>;
  /** Kartların altında: tablo katlaması, sıralama, künyeler. */
  children?: React.ReactNode;
}) {
  const scales = scalesOf(exposure.positions);
  return (
    <Panel>
      <PanelHeader
        title={t.cards.title}
        meta={fill(t.exposure.positions, { n: exposure.positions.length })}
        action={
          <Link href="/portfoy" className={`${desk.inlineLink} tap-44`}>
            {t.exposure.link}
          </Link>
        }
      />
      <div className={desk.panelBody}>
        <div className={styles.cards}>
          {exposure.positions.map((row) => (
            <PositionCard key={row.symbol} row={row} rules={rulesBySymbol.get(row.symbol) ?? []} scales={scales} t={t} locale={locale} />
          ))}
        </div>
        <p className={desk.foot}>{t.cards.toneNote}</p>
        {children}
      </div>
    </Panel>
  );
}
