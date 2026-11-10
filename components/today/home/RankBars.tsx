import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { FoldToggle } from "@/components/ui/FoldToggle";
import type { Locale } from "@/lib/i18n";
import { cn, formatPercent, NO_VALUE } from "@/lib/utils";
import styles from "./MarketTexture.module.css";

/**
 * SIRALI KALIN ÇUBUKLAR — "Sektörler ve Temalar" bandının TEK çizimi
 * (10 Kasım 2026, sahibinin sözü: "böyle nokta nokta ne anlatıyor
 * anlamıyorum; yatayda uzun kalın çizgi seviyorum" — `.claude/rules/
 * arayuz.md` → Görsel Dil, "Büyüklük KALIN YATAY ŞERİTLE okunur").
 *
 * Bant üç ayrı dil konuşuyordu: sektörlerde dev yüzdelerin altında soluk
 * DİKEY sütunlar, temalarda 5 piksellik ince çubuklar, uç kartlarında üye
 * ÇENTİKLERİ. Artık sektör de tema da aynı satır: ad solda, ortak sıfır
 * ekseninden değere uzanan 12 piksellik dolu çubuk, yüzde sağ sütunda.
 * İki liste iki ayrı ölçek (sektör ±%1, tema ±%3 oynuyor; ortak cetvelde
 * sektör çubukları çizgiye inerdi) ama aynı kural.
 *
 * SIFIR EKSENİ VERİDEN. Eksen kulvarın ortasında sabit değil: düşüşün
 * aralıktaki payı kadar içeride (`down / span`). Hepsi düşen bir günde
 * eksen sağ kenarda ve çubuklar kulvarın tamamını kullanıyor; ortada sabit
 * eksen o gün kulvarın yarısını boş bırakırdı (10 Kasım canlısı: 1
 * yükselen, 10 düşen). Eksen satırların arasından kesintisiz geçen tek
 * çizgi (`.rbTrack::before` satır aralığını da boyar).
 *
 * ÖLÇEĞİN TABANI `floor` (yüzde puan): taban olmasa ±%0,2'lik sakin günün
 * en uzun çubuğu %3'lük günün çubuğuyla aynı boyda dururdu (10 Ekim,
 * `SECTOR_SCALE_FLOOR`).
 *
 * ÇUBUK YALNIZ KARŞILAŞTIRILABİLENE. `bar: false` satır (bu seansta işlem
 * görmemiş fon, ortak kümenin dışındaki tema) çubuksuz: başka bir günün
 * hareketi bugünün cetveline konmaz (ekran kuralı: "karşılaştırılamayan
 * ölçüde çubuk HİÇ basılmaz"). Yerinde sakin bir künye durur (`note`,
 * "Son Kapanış").
 *
 * UÇLAR. Sıralamanın ilk ve son çubuklu satırı yönünün hafif tonunda bir
 * zemin alıyor: en güçlü ve en zayıf tek bakışta seçiliyor.
 *
 * HAREKET: çubuk `bar-fill` (globals; `scaleX`), liste `data-draw` ile
 * ekrana girince bir kez; kademe `--step`, toplamı 440 ms (12 satır).
 * Düşen çubuğun kaynağı eksen tarafı (sağ) — modülde yalnız
 * `transform-origin` ve gecikme.
 */
export type RankRow = {
  key: string;
  href: string;
  name: string;
  /** Mono künye (fon sembolü); geniş ekranda adın yanında. */
  sub?: string;
  value: number | null;
  /** Değer ortak ölçekte mi (çubuk çizilir mi). */
  bar: boolean;
  /** Çubuksuz satırda değer yazılsın mı (son kapanıştaki fon: evet, soluk). */
  showValue?: boolean;
  /** Çubuğun yerindeki sakin künye ("Son Kapanış"). */
  note?: string;
};

export function RankBars({
  rows,
  floor,
  locale,
  foldId,
  phoneEnds,
  more,
  less,
}: {
  rows: readonly RankRow[];
  floor: number;
  locale: Locale;
  /** Telefonda katlama anahtarının kimliği (sayfada tekil). */
  foldId: string;
  /** Telefonda (<640) iki uçtan bu kadar satır açık; ortası katlı. */
  phoneEnds: number;
  /** Katlama anahtarının iki sözü (`t.compact`). */
  more: string;
  less: string;
}) {
  const values = rows.filter((row) => row.bar && row.value !== null).map((row) => row.value!);
  const up = Math.max(0, ...values);
  const down = Math.max(0, ...values.map((value) => -value));
  const span = Math.max(up + down, floor);
  const zero = (down / span) * 100;
  const ranked = values.length;
  /* Telefonda açık satırlar değeri olanların iki ucu; yedekte (hiç değer
     yok) baştan aynı sayıda satır — katlı kutu veri gelmeden de son
     boyunda (25 Ekim, /tema). Çubuksuz satırlar sıralamanın dibinde ve uç
     sayılmıyor: ön seansta "en zayıf üç" yerine üç tire görünüyordu. */
  const phoneShown = (index: number) =>
    ranked > 0 ? index < phoneEnds || (index >= ranked - phoneEnds && index < ranked) : index < phoneEnds * 2;
  const hidden = rows.filter((_, index) => !phoneShown(index)).length;

  return (
    <FoldToggle id={foldId} hiddenCount={hidden} more={more} less={less} phone>
      <ol className={styles.rb} data-draw style={{ "--zero": `${zero}%` } as CSSProperties}>
        {rows.map((row, index) => {
          const drawn = row.bar && row.value !== null && row.value !== 0;
          const size = drawn ? (Math.abs(row.value!) / span) * 100 : 0;
          const sign = row.value !== null && row.value < 0 ? "down" : row.value !== null && row.value > 0 ? "up" : "flat";
          const printed = row.value !== null && (row.bar || row.showValue);
          const end = ranked >= 2 && row.bar ? (index === 0 ? "top" : index === ranked - 1 ? "bottom" : undefined) : undefined;
          return (
            <li key={row.key} data-fold={phoneShown(index) ? undefined : ""}>
              <Link
                href={row.href}
                prefetch={false}
                className={styles.rbRow}
                data-sign={printed ? sign : "flat"}
                data-end={end}
                data-quiet={printed && !row.bar ? "" : undefined}
              >
                <span className={styles.rbName}>
                  <span>{row.name}</span>
                  {row.sub ? <span className={styles.rbSub}>{row.sub}</span> : null}
                </span>
                <span className={styles.rbTrack} data-note={row.note && !drawn ? "" : undefined} aria-hidden={row.note && !drawn ? undefined : true}>
                  {drawn ? (
                    <i
                      className={cn("bar-fill", styles.rbBar)}
                      style={{
                        ...(row.value! > 0 ? { left: `${zero}%` } : { right: `${100 - zero}%` }),
                        width: `${size}%`,
                        ...({ "--i": index } as CSSProperties),
                      }}
                    />
                  ) : row.note ? (
                    <span className={styles.rbNote}>{row.note}</span>
                  ) : null}
                </span>
                <b className={cn("numeral", styles.rbValue)}>{printed ? formatPercent(row.value!, locale) : NO_VALUE}</b>
              </Link>
            </li>
          );
        })}
      </ol>
    </FoldToggle>
  );
}
