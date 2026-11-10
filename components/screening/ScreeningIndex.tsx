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
import { SCORE_BAND_FLOORS } from "@/lib/tool-visuals";
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
  /* SIRA AĞIRLIĞA GÖRE (10 Kasım). Kartlar `SCREEN_CATEGORIES` sırasında
     basılıyordu (Büyüme, Kârlılık, Sağlık / Fiyat Gücü, Sahiplik, Katalizör):
     kapaktaki pay cetveli ise ağırlık sırasında, yani aynı sayfada iki ayrı
     sıra vardı; ızgara satırı kartları eş boya gerdiği için de 2 kurallı
     Kârlılık 4 kurallı Büyüme'nin yanında altı 96 piksel boş duruyordu
     (ölçüldü, 1440; iki satırda toplam dört kartın altı boş). Ağırlığa,
     eşitlikte kural sayısına göre dizilince satırlar 4-4-3 ve 2-3-3 kural:
     boş bant satır başına en çok bir kuralın boyu (48 piksel). Eleme her
     zaman başta (tam genişlik kapı). */
  const ordered = [...categories].sort((a, b) => {
    if (a === "gate" || b === "gate") return a === b ? 0 : a === "gate" ? -1 : 1;
    return CATEGORY_WEIGHTS[b] - CATEGORY_WEIGHTS[a] || rules[b].length - rules[a].length;
  });
  return (
    <div className={styles.rules} data-motion-stagger>
      {ordered.map((category) => {
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

/** Bant → puan aralığı (en yüksekten). Eleme/veri yetersiz ayrı aralık açmaz:
    elenen hisse 45'le sınırlanıp zayıf aralığa düşüyor. */
const ZONES = [
  { band: "strong", from: SCORE_BAND_FLOORS.strong, to: 100 },
  { band: "worth", from: SCORE_BAND_FLOORS.worth, to: SCORE_BAND_FLOORS.strong },
  { band: "mixed", from: SCORE_BAND_FLOORS.mixed, to: SCORE_BAND_FLOORS.worth },
  { band: "weak", from: 0, to: SCORE_BAND_FLOORS.mixed },
] as const;

/**
 * PUAN SIRASI — her hisse bir satır, satırın KALIN çubuğu puanı.
 *
 * Kartlar puanı tek tek halkayla veriyor; on altı hissenin birbirine göre
 * nerede durduğu (kaçı aynı bantta, en yüksekle en düşük arası ne kadar)
 * ancak hepsini okuyarak çıkıyordu. Bu blok o soruyu tek bakışta veriyor.
 *
 * 10 Kasım 2026: NOKTALI KULVAR KALKTI. Önceki hâl ("Puanlar Tek Kulvarda",
 * 25 Ekim; 6 Kasım'da bant zeminleri eklendi) tek bir rayın üstünde her
 * hisse için 12 piksellik bir nokta, noktadan çizgiyle bağlanan sembol
 * etiketi (üstte ve altta ikişer satır, çakışma çözücüyle) ve arkada dört
 * bant yıkamasıydı; ray 40'tan başlıyordu. Sahibinin itirazı (Temalar
 * panosundaki çentikler için; "başka buna uyarlanacak ekran varsa onları da
 * yapalım"): "böyle nokta nokta ne anlatıyor anlamıyorum; çizgi grafiği
 * yerine yatayda uzun KALIN çizgi seviyorum." Okurun çözmesi gerekenler:
 * hangi etiket hangi noktanın (79 ile 80 arasındaki üç nokta dört etikete
 * çizgiyle bağlıydı), rayın sıfırdan değil 40'tan başladığı, zeminin bant
 * olduğu.
 *
 * Şimdi: sembol, SIFIRDAN puana uzanan 8 piksellik dolu çubuk (kulvar 5),
 * puan. Çubuğun rengi bandından (görüş paleti: güçlü yeşil, karışık
 * pirinç, zayıf kırmızı; kartlardaki halkayla aynı). Bantların aralığı
 * çizimde değil lejantta yazılı. Satırlar puana göre sıralı; her genişlikte
 * iki sütun (sol sütun üst yarı). Ölçek 0–100: çubuğun boyu puanın kendisi,
 * yakınlaştırma yok. Satır bağlantı DEĞİL: hemen altındaki kartlar aynı
 * on altı hissenin bağlantısı; ikinci bir bağlantı listesi telefonda 44
 * piksellik satır isterdi (ölçüldü, 390: tek sütun bağlantılı liste 662
 * piksel; iki sütun düz satır 318).
 *
 * Çakışma çözücü (`laneLabelLayout`, lib/tool-visuals.ts) artık ekranda
 * kullanılmıyor; testi duruyor.
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
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol));
  return (
    <figure className={styles.lane}>
      <figcaption className={styles.laneHead}>
        <span>{V.laneTitle}</span>
        <span className={styles.laneHint}>{V.laneHint}</span>
      </figcaption>
      <ol className={styles.laneRows} style={{ "--half": Math.ceil(sorted.length / 2) } as CSSProperties} data-draw>
        {sorted.map((row, i) => (
          <li key={row.symbol} className={styles.laneRow} style={{ "--i": i } as CSSProperties}>
            <span className={styles.laneSymbol}>{row.symbol}</span>
            <span className={styles.laneTrack} aria-hidden>
              <i
                className="bar-fill"
                data-band={row.band ?? "limited"}
                style={{ width: `${Math.max(Math.min(100, row.score), 1.5)}%` }}
              />
            </span>
            <b className="numeral">{row.score}</b>
          </li>
        ))}
      </ol>
      {/* Bantların aralığı lejantta (çizimde bölge zemini yok). Zayıf bant
          alt sınırsız: "<50" (6 Kasım, inceleme). */}
      <ul className={styles.zoneLegend}>
        {ZONES.map((zone) => (
          <li key={zone.band} data-band={zone.band}>
            <span className={styles.zoneSwatch} aria-hidden />
            {bands[zone.band]}
            <span className="numeral">
              {zone.band === "strong"
                ? V.zoneFrom.replace("{n}", String(zone.from))
                : zone.band === "weak"
                  ? `<${zone.to}`
                  : `${zone.from}–${zone.to - 1}`}
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

type QuickRow = { symbol: string; name: string; logoUrl: string | null; score: number | null; band: Band | null };

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
