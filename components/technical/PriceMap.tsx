import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { distancePct, formatRange, ladderOf, priceMapLayout, type MapRung, type TechnicalCopy } from "@/lib/technical";
import { cn, directionOf, directionText, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./Technical.module.css";

/** Etiket başına ayrılan dikey yer. Bütün satırlar aynı yükseklikte. */
const ROW_GAP = 46;
const MIN_HEIGHT = 360;
const MAX_HEIGHT = 720;

/**
 * Fiyat haritası — seviyeler dikey eksende, fiyata ORANTILI.
 *
 * Merdivenin (eşit aralıklı satırlar) yerine geldi. Orada 2 dolar uzaktaki
 * destek ile 20 dolar uzaktaki hedef aynı mesafede duruyordu ve "hedef uzak,
 * stop yakın" bilgisi yalnızca yüzde sütununda yaşıyordu. Haritada her
 * seviye kendi yerinde: alım bölgesi bir bant, stopun altı gölgeli (plan
 * orada geçersiz), şu anki fiyat kesikli bir çizgiyle bütün haritayı
 * kesiyor. Sıra ve uzaklık ilk bakışta okunuyor.
 *
 * Çakışan etiketler `priceMapLayout` ile itiliyor; işaret gerçek yerinde
 * kalır, etiket kayar ve ince bir bağ ikisini birleştirir.
 *
 * NOTLAR HARİTANIN İÇİNDE DEĞİL ALTINDA. Bir dönem her not kendi seviyesinin
 * satırına giriyordu ve satırlar ÇAKIŞIYORDU: itme algoritması her satıra
 * sabit `ROW_GAP` ayırıyor ama notlu bir satır 390 pikselde üç satıra
 * sarıp 104 piksele çıkıyordu (ölçüldü: dört çakışma, en kötüsü 39 piksel;
 * "Alım Bölgesi"nin notu "Stop"un fiyatının üstüne biniyordu). Notun
 * yüksekliği sarmaya, sarma genişliğe bağlı — sunucu bunu bilemez, yani
 * sabit bir pay vermek tahmin olurdu. Haritanın işi sıralama ve uzaklık;
 * "bu seviye nereden geldi" bir cümle ve cümlenin yeri listedir. Artık her
 * satır aynı yükseklikte (33 piksel) ve 46 piksellik ayrım her zaman yeter.
 *
 * Yükseklik satır sayısından hesaplanıyor (ölçmeye gerek yok): her satıra
 * `ROW_GAP` piksel, alt sınır 360, üst 720. Uzaklık fiyattan seviyeye
 * (LevelLadder'daki gerekçe): hedef için artı, stop için eksi.
 */
export function PriceMap({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  copy,
  verdict,
  priceLabel,
  lang,
  locale,
  t,
}: {
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  copy: TechnicalCopy;
  verdict: VerdictKey;
  priceLabel: string;
  /** Notların dili — İngilizce sayfada çevrilmemiş metin Türkçe okunur. */
  lang: string;
  locale: Locale;
  t: Dictionary;
}) {
  const levels = ladderOf({ entryLow, entryHigh, stop, targets, supports, resistances });
  if (levels.length + (price !== null ? 1 : 0) < 2) return null;

  const rows = levels.length + (price !== null ? 1 : 0);
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rows * ROW_GAP + 40));
  const { rungs, scale } = priceMapLayout(levels, price, { height, gap: ROW_GAP });
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const sellSide = verdict === "sell";

  const labelOf = (rung: MapRung): string => {
    switch (rung.kind) {
      case "target":
        return (sellSide ? t.technical.sellLevel : t.technical.target).replace("{n}", String(rung.order ?? 1));
      case "resistance":
        return t.technical.resistance;
      case "entry":
        return t.technical.entryZone;
      case "support":
        return t.technical.support;
      case "stop":
        return t.technical.stop;
      case "price":
        return priceLabel;
    }
  };

  /* Notlar seviye sırasına göre: hedefler, alım bölgesi, stop. Yalnızca
     yazılmış olanlar listeye giriyor; hiçbiri yoksa liste hiç basılmıyor. */
  const noteList = rungs
    .map((rung) => ({
      /* Hedef notu ÜÇ hedefi birden anlatıyor ("ilk iki hedef … üçüncüsü …")
         ama ilk hedefin satırına bağlı; "Hedef 1" diye etiketlenince not
         yalnız o seviyeyi tarif ediyormuş gibi okunuyordu. */
      label: rung.kind === "target" ? (sellSide ? t.technical.planTargets : t.technical.targetsLabel) : labelOf(rung),
      text: noteOf(rung, copy),
    }))
    .filter((item): item is { label: string; text: string } => item.text !== null);

  const entryTop = entryLow !== null && entryHigh !== null ? scale(entryHigh) : null;
  const entryBottom = entryLow !== null && entryHigh !== null ? scale(entryLow) : null;
  const stopY = stop !== null ? scale(stop) : null;
  const priceY = price !== null ? scale(price) : null;

  return (
    <>
    <div className={styles.map} style={{ height }} data-verdict={verdict}>
      {/* ---- Eksen: bantlar ve ray ---- */}
      <div className={styles.mapRail} aria-hidden>
        {stopY !== null && (
          /* "Plan Geçersiz" yazısı DİKEY ve 75 piksel yer istiyor (ölçüldü).
             Stop haritanın dibine yakınsa altında kalan bölge o kadar
             değil — 39 piksellik bir şeride 75 piksellik yazı konunca 47
             piksel taşıyıp notların üstüne biniyordu. Bölge dar kaldığında
             tarama deseni ve kesikli çizgi tek başına kalıyor: "buradan
             aşağısı plan dışı" bilgisi zaten stop satırının kendisinde. */
          <span className={styles.mapVoid} style={{ top: stopY }}>
            {height - stopY >= 90 && <i>{t.technical.zoneBelowStop}</i>}
          </span>
        )}
        {entryTop !== null && entryBottom !== null && (
          <span className={styles.mapBand} style={{ top: entryTop, height: Math.max(6, entryBottom - entryTop) }} />
        )}
        <span className={styles.mapLine} />
      </div>
      {priceY !== null && <span className={styles.mapPriceLine} style={{ top: priceY }} aria-hidden />}

      {/* ---- Basamaklar ---- */}
      <ol className={styles.mapRungs}>
        {rungs.map((rung) => {
          const kind = rung.kind === "target" && sellSide ? "sellLevel" : rung.kind;
          const reference = rung.kind === "entry" && rung.high !== undefined ? rung.high : rung.price;
          const distance = rung.kind === "price" ? null : distancePct(reference, price);
          const value =
            rung.kind === "entry" && rung.high !== undefined
              ? formatRange(rung.price, rung.high, locale)
              : money(rung.price);
          const shifted = Math.abs(rung.labelY - rung.markY) > 1;
          return (
            <li key={`${rung.kind}-${rung.price}`} className={styles.mapRung} data-kind={kind} style={{ top: rung.labelY }}>
              <span aria-hidden className={styles.mapMark} style={{ top: rung.markY - rung.labelY }} />
              {shifted && (
                <span
                  aria-hidden
                  className={styles.mapLink}
                  style={{
                    top: Math.min(0, rung.markY - rung.labelY),
                    height: Math.abs(rung.markY - rung.labelY),
                  }}
                />
              )}
              <span className={styles.mapLabel}>{labelOf(rung)}</span>
              <span className={cn(styles.mapPrice, "numeral")}>{value}</span>
              <span className={cn(styles.mapDistance, "numeral", distance !== null && directionText(directionOf(distance)))}>
                {distance !== null ? formatPercent(distance, locale, 1) : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
    {noteList.length > 0 && (
      /* Tanım listesi: terim seviyenin adı, tanım nereden geldiği. Dar
         ekranda alt alta, geniş ekranda iki sütun — makale kutularındaki
         `**Etiket:**` kalıbıyla aynı okuma biçimi. */
      <dl className={styles.mapNotes} lang={lang}>
        {noteList.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.text}</dd>
          </div>
        ))}
      </dl>
    )}
    </>
  );
}

function noteOf(level: { kind: string; order?: number }, copy: TechnicalCopy): string | null {
  if (level.kind === "entry") return copy.entryNote ?? null;
  if (level.kind === "stop") return copy.stopNote ?? null;
  if (level.kind === "target" && level.order === 1) return copy.targetsNote ?? null;
  return null;
}
