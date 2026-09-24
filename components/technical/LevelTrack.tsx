import type { VerdictKey } from "@/lib/analysis";
import styles from "./Technical.module.css";

/* Halka ile nokta arasındaki en küçük mesafe. MU'da fiyat analizden beri
   %0,45 yol almıştı ve bu 380 piksellik rayda 7 piksel ediyordu: 8
   piksellik halka 14 piksellik noktanın ve halkasının altında tamamen
   kayboluyordu (1440, ölçüldü). Altında halka da yolculuk da yok; metin
   künyesi (TechnicalCard) duruyor.

   EŞİK PİKSELLE, EKSEN PAYIYLA DEĞİL (23 Eylül). Eşik eksenin %3,5'iydi ve
   "dar kartta 9, geniş kartta 13 piksel — halka noktanın yanında seçiliyor"
   diye yazılmıştı; seçilmiyordu. Noktanın dış halkası 11 piksel (7 + 3 + 1),
   halkanın yarıçapı 4: merkezler arası 15'in altında halka noktanın
   halkasına biniyor. Ölçülen (TR, 23 Eylül): 320'de RKLB 11, MRVL 9 —
   halkanın merkezi noktanın altında; 390'da 14 ve 12, halka yarım; 1440'ta
   MRVL 15, kenar kenara. Okuyucuya bir çizim hatası gibi görünüyordu.
   Gereken mesafe artık 17 piksel (15 + 2 boşluk). Rayın genişliği sunucuda
   bilinmiyor; halka, sığdığı en dar ray eşiğini taşıyor (`data-fit`) ve
   kap sorgusu (`.rail`) daha dar rayda onu gizliyor. Ray 320'de 246, 390'da
   316, 1440'ta 382, 1024'te 433 piksel (ölçüldü). */
const THEN_CLEAR_PX = 17;
const THEN_RAIL_TIERS = [240, 300, 380] as const;

/** Rayın üstüne çizilen bir bacak: `from` ölçümün başladığı yer (çapa). */
export type TrackSegment = { from: number; to: number; tone: "up" | "down" | "flat" };

/**
 * Seviye çizgisi — stop, alım bölgesi, hedefler ve fiyat tek eksende.
 *
 * ÖLÇEK SEVİYELERE GÖRE, SIFIRA GÖRE DEĞİL. Eksen en düşük ile en yüksek
 * seviye arasında; %6 pay ile uçlar kenara yapışmıyor. Sıfırdan çizilen
 * bir eksende 212 ile 216 arasındaki alım bölgesi tek bir çizgiye inerdi.
 *
 * Çizim yalnızca görsel (`aria-hidden`). Sayıların kendisi çizginin
 * yanındaki plan şeridinde (`PlanStrip`) ve rayın bacak satırında
 * (`PlanRail`) metin olarak duruyor; çizginin kendi lejantı vardı ve aynı
 * sayılar iki kez basılıyordu, kaldırıldı.
 *
 * STOPUN SOLU GÖLGELİ: orası planın geçersiz olduğu bölge. Bant ve gölge
 * birlikte "buradan alınır, buranın altında vazgeçilir"i tek bakışta
 * söylüyor; çentikler seviyenin tam yerini veriyor.
 *
 * SAT GÖRÜŞÜNDE HEDEF, HEDEF DEĞİL. Rutin SAT'ta da `targets` yazıyor ama
 * orada anlamı "tepkide satılabilecek direnç" (docs/claude-rutinler.md § 5).
 * Bir dönem AL hedefleriyle aynı yeşil çentikle çiziliyordu: SAT kartı
 * okuyucuya yükseliş hedefi gösteriyordu. SAT'ta düşüş tonuyla basılıyor.
 *
 * BACAKLAR EKSENİN ÜSTÜNDE (23 Eylül). Risk şeridi bu çizginin hemen
 * üstünde AYRI bir çubuktu ve aynı geometriyi ikinci kez çiziyordu: kırmızı
 * bacak stoptan bölgenin tepesine, yeşil bacak oradan ilk hedefe — ikisi de
 * bu eksendeki çentiklerin arasındaki parçalar. Bacaklar artık eksenin
 * kendisine boyanıyor; aynı ölçekte olduklarından uzunlukları tutarlarla
 * zaten orantılı, ayrı bir `flex-grow` hesabına gerek kalmadı. Her bacak
 * çapasından dışa doğru çiziliyor (risk sola, getiri sağa).
 *
 * ANALİZ ANINDAKİ FİYAT (`snapshotPrice`). Kartın fiyatı canlı, cümlesi
 * yazıldığı andan; ONDS kartı "7,61'in altında" derken üstünde 7,73
 * duruyordu. İçi boş halka fiyatın plan yazılırken nerede olduğunu, dolu
 * nokta şimdi nerede olduğunu gösteriyor; arada ne kadar yol alındığı
 * okunuyor. Giriş hareketinde nokta halkadan kalkıp yerine gidiyor
 * (`data-travel-from`, `TechnicalBoard`); azaltılmış harekette ve
 * JavaScript'siz yalnızca iki işaret durur.
 *
 * `size="lg"` PROP'U DA KALKTI: CSS'teki `lg` ölçüsü detay kapağından
 * çizgi çıkarılırken silinmişti (Technical.module.css → "`lg` ÖLÇÜSÜ
 * KALKTI"), prop hiçbir şeye bağlı değildi.
 */
export function LevelTrack({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  verdict,
  segments = [],
  snapshotPrice = null,
}: {
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  verdict: VerdictKey;
  /** Eksene boyanan bacaklar (risk/getiri ya da fiyattan seviyeye). */
  segments?: readonly TrackSegment[];
  /** Analiz anındaki fiyat — yalnızca canlı fiyattan anlamlı ölçüde farklıysa. */
  snapshotPrice?: number | null;
}) {
  const hasEntry = entryLow !== null && entryHigh !== null;
  const sellSide = verdict === "sell";
  /* Alım planı yoksa (SAT ya da bölgesiz TUT) eksen destek ve dirençlerle
     kuruluyor. Koşulda hedef YOK: SAT hedefli geldiğinde de destek ve direnç
     eksende kalmalı, yoksa çizgide fiyat ve satış seviyeleri tek başına
     kalıyordu. */
  const showLevels = !hasEntry && stop === null;
  const points = [
    price,
    snapshotPrice,
    entryLow,
    entryHigh,
    stop,
    ...targets,
    ...(showLevels ? [...supports, ...resistances] : []),
    ...segments.flatMap((segment) => [segment.from, segment.to]),
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = (max - min) * 0.06 || max * 0.02;
  const lo = min - pad;
  const hi = max + pad;
  const pos = (value: number) => `${((value - lo) / (hi - lo)) * 100}%`;
  const targetKind = sellSide ? "sellLevel" : "target";
  const thenShare = snapshotPrice !== null && price !== null ? Math.abs(snapshotPrice - price) / (hi - lo) : 0;
  const thenFit = THEN_RAIL_TIERS.find((tier) => tier * thenShare >= THEN_CLEAR_PX);
  const then = thenFit !== undefined ? snapshotPrice : null;

  return (
    <div className={styles.track} aria-hidden>
      <span className={styles.trackLine} />
      {stop !== null && <span className={styles.trackVoid} style={{ width: pos(stop) }} />}
      {/* BANT BACAKLARIN ALTINDA, OPAK (23 Eylül). Bacaklardan sonra ve
          yarı saydam boyanıyordu: risk bacağı stoptan bölgenin TEPESİNE
          uzandığı için kırmızı çizgi bandın içinden soluk bir leke olarak
          görünüyordu (MU, 1440, ekran görüntüsü). Bant artık alan, bacak
          veri: bant önce ve kartın yüzeyine karışmış opak tonla çiziliyor
          (eksen altında kalıyor), bacak üstünden net bir çizgi olarak
          geçip bölgenin tepesinde bitiyor. */}
      {hasEntry && (
        <span
          className={styles.trackBand}
          data-motion-draw="line"
          style={{
            left: pos(entryLow),
            width: `max(6px, calc(${pos(entryHigh)} - ${pos(entryLow)}))`,
          }}
        />
      )}
      {/* Bacak en az 4 piksel: 1 : 8 gibi bir kurulumda kısa bacak
          tamamen kaybolmasın (bant için aynı karar, 6 piksel). */}
      {segments.map((segment) => (
        <span
          key={`${segment.tone}-${segment.from}-${segment.to}`}
          className={styles.trackSeg}
          data-tone={segment.tone}
          data-motion-draw="line"
          style={{
            left: pos(Math.min(segment.from, segment.to)),
            width: `max(4px, calc(${pos(Math.max(segment.from, segment.to))} - ${pos(Math.min(segment.from, segment.to))}))`,
            transformOrigin: segment.from <= segment.to ? "left center" : "right center",
          }}
        />
      ))}
      {showLevels &&
        [...supports.map((v) => ["support", v] as const), ...resistances.map((v) => ["resistance", v] as const)].map(
          ([kind, value]) => (
            <span key={`${kind}-${value}`} className={styles.trackTick} data-kind={kind} style={{ left: pos(value) }} />
          ),
        )}
      {stop !== null && (
        <span className={styles.trackTick} data-kind="stop" style={{ left: pos(stop) }} />
      )}
      {targets.map((value) => (
        <span key={`t-${value}`} className={styles.trackTick} data-kind={targetKind} style={{ left: pos(value) }} />
      ))}
      {/* En dar rayda (240) bile sığan halka koşulsuz; ötekiler eşiğini
          taşıyor. `data-travel-ring`: gizlenen halkadan nokta da yola
          çıkmıyor (`TechnicalBoard`). */}
      {then !== null && (
        <span
          className={styles.trackThen}
          data-travel-ring
          data-fit={thenFit === THEN_RAIL_TIERS[0] ? undefined : thenFit}
          style={{ left: pos(then) }}
        />
      )}
      {/* `spark-dot`: ortak sistemin nokta girişi — bant çizildikten sonra
          fiyat yerine oturuyor. Ortalama `margin` ile, `transform` ile değil:
          giriş animasyonu dönüşümü yönetiyor, ikisi çakışınca nokta bitişte
          yarım genişlik sıçrıyordu. Yolculuk da aynı sebeple `left` ile. */}
      {price !== null && (
        <span
          className={`${styles.trackPrice} spark-dot`}
          style={{ left: pos(price) }}
          data-travel-from={then !== null ? pos(then) : undefined}
        />
      )}
    </div>
  );
}
