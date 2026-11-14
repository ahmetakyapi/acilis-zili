import type { CSSProperties } from "react";
import type { VerdictKey } from "@/lib/analysis";
import { spreadLabels } from "@/lib/technical-visuals";
import { cn } from "@/lib/utils";
import styles from "./TechnicalPlan.module.css";

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

/* ÇENTİK ADLARI (10 Kasım gece). Etiketler rayın altında tek satır; yakın
   çentiklerin adları itilir (`spreadLabels`, kapak ölçeğiyle aynı yardımcı),
   çentik yerinde kalır. Pay rayın oranı: en dar ray 246 piksel (320'lik
   telefon), en uzun ad ("Hedef 1", "Direnç") ~46 piksel + 8 boşluk → 0,22;
   uçlarda yarım etiket payı 0,09. En çok dört ad: üçüncü hedef ve ikincil
   destek/dirençler adsız, sessiz çentik (sayıları plan şeridinde). */
const NAME_GAP = 0.22;
const NAME_EDGE = 0.09;
const NAMED_TARGETS = 2;

/** Çentik adları — `PlanRail` sözlükten verir. */
export type TrackNames = { stop: string; zone: string; target: string; sell: string; support: string; resistance: string };

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
 * ATLAS DİLİ: NOKTA DEĞİL KALIN ÇUBUK, ÇENTİKLER ADLI (10 Kasım 2026, gece;
 * sahibinin sözü: "nokta nokta ne anlatıyor anlamıyorum; yatayda uzun kalın
 * çizgi seviyorum" ve ana oturumun kararı: "okur çentiğin ne olduğunu
 * lejantta aramasın"). Rayda altı ayrı im vardı: kulvar, bant, yön renginde
 * iki bacak (risk kırmızı, getiri yeşil), renkli çentikler, analiz anının
 * halkası ve fiyatın 14 piksellik NOKTASI; hiçbirinin adı yazılı değildi
 * (adlar yandaki plan şeridinde, eşleştirme okura kalıyordu). Şimdi teknik
 * atlasının satırıyla aynı tek okuma (`PlanAtlasView`):
 *   · TABANDAN FİYATA 8 piksellik dolu çubuk (ortak `value-bar`): taban
 *     stop; stop yoksa fiyatın altındaki en yakın destek (atlasın SAT
 *     satırıyla aynı sıfır), o da yoksa ölçeğin solu. Çubuğun ucu "şimdi" — koyu, kalın bir
 *     dik im. Fiyat stopun altındaysa çubuk stoptan SOLA uzar, düşüş
 *     tonunda.
 *   · Stop, hedefler ve (plansız kartta) en yakın destek ile direnç çubuğun
 *     ÜSTÜNDE ince koyu çentik (`value-notch`) ve ADI altında yazılı; ad
 *     anlam rengini taşır (stop/tepki düşüş, hedef yükseliş). Alım bölgesi
 *     bir aralık olduğu için bant, adı ortasında.
 *   · Yön renkli bacaklar (`segments`) rayda ÇİZİLMİYOR: çubukla üst üste
 *     üçüncü bir katmandı. Bacakların sayıları altındaki satırda aynen
 *     duruyor (`PlanRail`); uzunlukları artık adlı çentiklerin arasından
 *     okunuyor. `segments` prop'u yalnız ölçeği genişletir (bacağın ucu
 *     eksende kalsın).
 *   · Noktanın halkadan yola çıkma hareketi (`data-travel-from`) kalktı:
 *     hareket veriyi çizen öğede — çubuk tabandan fiyata dolar
 *     (`data-motion-draw="line"`); halka (analiz anı) yerinde duruyor.
 *
 * `size="lg"` PROP'U DA KALKTI: CSS'teki `lg` ölçüsü detay kapağından
 * çizgi çıkarılırken silinmişti (TechnicalPlan.module.css → "`lg` ÖLÇÜSÜ
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
  names,
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
  /** Çentik adları; verilmezse çentikler adsız kalır. */
  names?: TrackNames;
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

  const share = (value: number) => (value - lo) / (hi - lo);

  /* Çubuk: tabandan fiyata. Taban stop; stop yoksa fiyatın altındaki en
     yakın destek (atlasın SAT satırıyla aynı sıfır; alttaki "Desteğe" bacağı
     çubuğun boyu olur); o da yoksa ölçeğin solu. */
  const supportBelow = price === null ? undefined : [...supports].filter((v) => v <= price).sort((x, y) => y - x)[0];
  const base = stop ?? (showLevels ? supportBelow : undefined) ?? lo;
  const below = price !== null && price < base;

  /* Adlı çentikler ve adsız (sessiz) kalanlar. */
  type Named = { key: string; at: number; name: string; kind: "stop" | "target" | "sellLevel" | "support" | "resistance" | "zone"; notch: boolean };
  const named: Named[] = [];
  const quiet: { key: string; at: number }[] = [];
  if (stop !== null) named.push({ key: "stop", at: share(stop), name: names?.stop ?? "", kind: "stop", notch: true });
  if (hasEntry) named.push({ key: "zone", at: share((entryLow + entryHigh) / 2), name: names?.zone ?? "", kind: "zone", notch: false });
  targets.forEach((value, index) => {
    if (index < NAMED_TARGETS) {
      named.push({ key: `t-${value}`, at: share(value), name: ((sellSide ? names?.sell : names?.target) ?? "").replace("{n}", String(index + 1)), kind: targetKind, notch: true });
    } else quiet.push({ key: `t-${value}`, at: share(value) });
  });
  if (showLevels) {
    /* En yakın destek ve direnç adlı (bacak satırının anlattığı ikisi);
       ötekiler sessiz çentik. */
    const nearSupport = price === null ? undefined : [...supports].filter((v) => v <= price).sort((x, y) => y - x)[0] ?? [...supports].sort((x, y) => y - x)[0];
    const nearResistance = price === null ? undefined : [...resistances].filter((v) => v >= price).sort((x, y) => x - y)[0] ?? [...resistances].sort((x, y) => x - y)[0];
    for (const value of supports) {
      if (value === nearSupport) named.push({ key: `s-${value}`, at: share(value), name: names?.support ?? "", kind: "support", notch: true });
      else quiet.push({ key: `s-${value}`, at: share(value) });
    }
    for (const value of resistances) {
      if (value === nearResistance) named.push({ key: `r-${value}`, at: share(value), name: names?.resistance ?? "", kind: "resistance", notch: true });
      else quiet.push({ key: `r-${value}`, at: share(value) });
    }
  }
  const labelled = names ? named.filter((mark) => mark.name) : [];
  const spread = spreadLabels(labelled.map((mark) => mark.at), NAME_GAP, NAME_EDGE, 1 - NAME_EDGE);

  return (
    <div className={styles.track} aria-hidden data-named={labelled.length > 0 || undefined}>
      <span className={cn("value-lane", styles.trackLine)} />
      {stop !== null && <span className={styles.trackVoid} style={{ width: pos(stop) }} />}
      {/* BANT ÇUBUĞUN ALTINDA, OPAK (23 Eylül kararı; o gün "bacakların
          altında"). Bant alan, çubuk veri: bant önce ve kartın yüzeyine
          karışmış opak tonla çiziliyor, çubuk üstünden geçiyor. */}
      {hasEntry && (
        <span
          className={styles.trackBand}
          style={{
            left: pos(entryLow),
            width: `max(6px, calc(${pos(entryHigh)} - ${pos(entryLow)}))`,
          }}
        />
      )}
      {/* En az 4 piksel: fiyat tabanın dibindeyken de çubuğun yönü görünsün. */}
      {price !== null && (
        <span
          className="value-bar"
          data-motion-draw="line"
          data-end={below ? "start" : "end"}
          data-tone={below ? "down" : undefined}
          style={{
            left: pos(Math.min(base, price)),
            width: `max(4px, calc(${pos(Math.max(base, price))} - ${pos(Math.min(base, price))}))`,
            transformOrigin: below ? "right center" : "left center",
          }}
        />
      )}
      {quiet.map((mark) => (
        <span key={mark.key} className="value-notch" data-quiet style={{ left: `${mark.at * 100}%` }} />
      ))}
      {named.filter((mark) => mark.notch).map((mark) => (
        <span key={mark.key} className="value-notch" style={{ left: `${mark.at * 100}%` }} />
      ))}
      {/* En dar rayda (240) bile sığan halka koşulsuz; ötekiler eşiğini
          taşıyor. */}
      {then !== null && (
        <span
          className={styles.trackThen}
          data-fit={thenFit === THEN_RAIL_TIERS[0] ? undefined : thenFit}
          style={{ left: pos(then) }}
        />
      )}
      {/* "Şimdi": çubuğun ucunda koyu dik im (nokta değil). */}
      {price !== null && <span className={styles.trackNow} style={{ left: pos(price) }} />}
      {labelled.map((mark, index) => (
        <span
          key={`n-${mark.key}`}
          className={styles.trackName}
          data-kind={mark.kind}
          /* İtilen adın kayması rayın oranında; `cqw` rayın kendi genişliği
             (kap `.rail`, `container-type: inline-size`). */
          style={{ left: `${mark.at * 100}%`, "--shift": `${((spread[index]! - mark.at) * 100).toFixed(2)}cqw` } as CSSProperties}
        >
          {mark.name}
        </span>
      ))}
    </div>
  );
}
