import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { riskReward } from "@/lib/technical";
import { formatPercentPlain, formatPrice } from "@/lib/utils";
import { LevelTrack, type TrackSegment } from "./LevelTrack";
import styles from "./Technical.module.css";

type Leg = { key: string; name: string; tone: TrackSegment["tone"]; abs: number; pct: number; side: "start" | "end" };

/**
 * Plan rayı — liste kartında planın TEK çizimi (23 Eylül).
 *
 * Kartta alt alta iki yatay çizim vardı: risk şeridi (oran, çapa, ölçekli
 * çubuk, iki bacak) ve seviye çizgisi. Çubuğun kırmızı ve yeşil bacakları
 * tam olarak çizgideki çentiklerin ARASINDAKİ parçalardı, yani aynı
 * geometri iki kez basılıyordu ve CSS kaydı ikisinin "tek bir bileşik çizim
 * gibi" okunduğunu kabul edip araya 16 piksel koymuştu. Bedeli 1440'ta plan
 * satırının 212 pikselinden 112'si, 320'de risk bloğu tek başına 99 piksel
 * (ölçüldü). Artık üç satır, tek çizim: künye, ray, bacaklar.
 *
 * Risk şeridinin dört kararı burada yaşamaya devam ediyor:
 *   · ORAN VE ÇAPA. Yüzdeler bölgenin tepesinden ölçülüyor ama hemen üstte
 *     "Son Fiyat 928,88 $" duruyor ve okuyucu yüzdeyi ondan sanıyordu —
 *     aradaki fark MU'da on iki dolardı. Çapa adıyla yazılı.
 *   · HAM TUTAR. "%3,0" soyut, "27,84 $" değil; hisse fiyatını bilmeyen
 *     okuyucu yüzdeyi paraya çeviremiyor. İkisi yan yana.
 *   · ÖLÇEK. "1 : 0,3" bir sayı olarak okunmuyordu, iki bacağın GENİŞLİĞİ
 *     okunuyor. Bacaklar artık rayın kendi fiyat ekseninde, yani uzunlukları
 *     tutarlarla orantılı ve seviyelerle aynı yerde.
 *   · Çizim yalnızca görsel; sayıların tamamı bacak satırında.
 *
 * SAT VE BÖLGESİZ TUT DA BACAK ALIYOR. SAT kartında risk şeridi yoktu ve
 * ızgaranın paylaşılan satırı komşu AL/TUT kartlarına göre açıldığı için
 * kartın içinde 46 ve 47 piksellik iki boş cep kalıyordu (1440, ONDS,
 * ölçüldü). Boşluk esnetilmez, doldurulur: fiyattan en yakın satış
 * seviyesine ("Tepkiye") ve en yakın desteğe ("Desteğe") uzaklık. İkisi de
 * mevcut sayılardan; oran YOK, çünkü bu bir alım planı değil. Seviye fiyatın
 * yanlış tarafına düşmüşse (tepki seviyesi geçilmiş, destek kırılmış) o
 * bacak hiç basılmıyor — ters işaretli bir uzaklık yazmak yerine susmak.
 */
export function PlanRail({
  verdict,
  price,
  snapshotPrice,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  locale,
  t,
}: {
  verdict: VerdictKey;
  price: number | null;
  /** Analiz anındaki fiyat; yalnızca canlı fiyattan farklıysa verilir. */
  snapshotPrice: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  locale: Locale;
  t: Dictionary;
}) {
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const hasEntry = entryLow !== null && entryHigh !== null;
  const rr = hasEntry ? riskReward(entryHigh, stop, targets) : null;

  let segments: TrackSegment[] = [];
  let legs: Leg[] = [];
  let head: React.ReactNode = null;

  if (rr && stop !== null) {
    const firstTarget = rr.anchor + rr.rewardAbs;
    segments = [
      { from: rr.anchor, to: stop, tone: "down" },
      { from: rr.anchor, to: firstTarget, tone: "up" },
    ];
    legs = [
      { key: "risk", name: t.technical.riskLeg, tone: "down", abs: rr.riskAbs, pct: rr.riskPct, side: "start" },
      { key: "reward", name: t.technical.rewardLeg, tone: "up", abs: rr.rewardAbs, pct: rr.rewardPct, side: "end" },
    ];
    head = (
      <>
        <span>{t.technical.riskReward}</span>
        <b className="numeral">{t.technical.riskRewardValue.replace("{n}", formatPrice(rr.ratio, locale, { digits: 1 }))}</b>
        {/* Çapanın sayısı dar rayda düşüyor (CSS, `.riskAnchorValue`):
            320'de künye iki satıra sarıyordu ve düşen sayı bir satır
            yukarıda alım aralığının üst ucu olarak zaten yazılı. Ad
            kalıyor — yüzdenin nereden ölçüldüğü söylenmeden eksik.
            Noktadan önceki boşluk bölünmez: künye sarınca ikinci satır
            noktayla başlamasın (sayfa künyesiyle aynı karar, page.tsx). */}
        <span className={styles.riskAnchor}>
          {t.technical.riskAnchorLabel}
          <span className={styles.riskAnchorValue}>{"\u00A0· "}{money(rr.anchor)}</span>
        </span>
      </>
    );
  } else if (!hasEntry && price !== null && price > 0) {
    /* Fiyattan seviyeye: yukarıda en yakın satış seviyesi (SAT) ya da
       direnç (bölgesiz TUT), aşağıda en yakın destek. Hücrelerle aynı
       kaynak: SAT'ta hedefler yoksa dirençler (`PlanStrip` ile aynı kural),
       destek `supports[0]`. */
    const upper = verdict === "sell" ? (targets.length ? targets : resistances) : resistances;
    const above = [...upper].filter((level) => level > price).sort((a, b) => a - b)[0];
    const support = supports[0] !== undefined && supports[0] < price ? supports[0] : undefined;
    if (above !== undefined) {
      segments.push({ from: price, to: above, tone: verdict === "sell" ? "down" : "flat" });
      legs.push({
        key: "above",
        name: verdict === "sell" ? t.technical.planToSellLevel : t.technical.planToResistance,
        tone: verdict === "sell" ? "down" : "flat",
        abs: above - price,
        pct: ((above - price) / price) * 100,
        side: "end",
      });
    }
    if (support !== undefined) {
      segments.push({ from: price, to: support, tone: "flat" });
      legs.unshift({
        key: "support",
        name: t.technical.planToSupport,
        tone: "flat",
        abs: price - support,
        pct: ((price - support) / price) * 100,
        side: "start",
      });
    }
    if (legs.length) head = <span>{t.technical.levelsNote}</span>;
  }

  return (
    <div className={styles.rail} data-has-legs={legs.length > 0 || undefined}>
      {head && <p className={styles.riskHead}>{head}</p>}
      <LevelTrack
        price={price}
        entryLow={entryLow}
        entryHigh={entryHigh}
        stop={stop}
        targets={targets}
        supports={supports}
        resistances={resistances}
        verdict={verdict}
        segments={segments}
        snapshotPrice={snapshotPrice}
      />
      {legs.length > 0 && (
        <p className={styles.riskLegs}>
          {legs.map((leg) => (
            <span key={leg.key} data-leg={leg.key} data-tone={leg.tone} data-side={leg.side}>
              <span className={styles.riskName}>{leg.name}</span>
              <b className="numeral">{money(leg.abs)}</b>
              <span className={styles.planSep} aria-hidden>·</span>
              <span className="numeral">{formatPercentPlain(leg.pct, locale, 1)}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
