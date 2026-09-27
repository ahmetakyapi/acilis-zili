import { cn } from "@/lib/utils";
import { PLATE_LABEL } from "./shared";

/**
 * Künye rayı — manşetin altındaki sakin ölçü şeridi.
 *
 * Çukur zemin ve boşluk ayrımı çiziyor, dikey hairline yok: hücre sayısı
 * kayda göre değiştiği için ray satır atlayabiliyor ve çizgiler o zaman
 * ikinci satırın ilk hücresinin soluna, boşlukta duran bir hairline
 * bırakıyordu.
 *
 * `note` ölçünün PENCERESİ ya da BÖLENİ: "son 12 ay", "$105,61",
 * "ileriye dönük 3 yıl". Bir sayının ne zamana ait olduğu ya da neye
 * bölündüğü bu sayfada asla tahmine bırakılmıyor.
 */
export type Fact = {
  label: string;
  value: string;
  note?: string | null;
  tone?: "up" | "down";
};

/* Sütun sayısı hücre sayısını izliyor: sabit bir sütun sayısı, ray dolmadığı
   günlerde satır sonunda boşluk bırakıyordu. En çok beş hücre olur —
   piyasa değeri, yıllık getiri, F/K, PEG, net kâr marjı.

   Sınıflar birebir yazılı; Tailwind kaynağı metin olarak tarıyor ve şablonla
   üretilen sınıf adları derlemeye girmiyor. */
const RAIL_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

export function FactRail({ facts }: { facts: (Fact | false | null)[] }) {
  const list = facts.filter((fact): fact is Fact => Boolean(fact));
  if (list.length === 0) return null;

  return (
    /* DAR EKRANDA IZGARA DEĞİL SATIR.
       İki sütunlu ızgarada hücreye ~150 piksel düşüyor ve etiket büyük harf +
       geniş aralıkla yazıldığı için ("1 YILLIK GETİRİ") tek başına o genişliği
       dolduruyordu; parantezli künye ikinci satıra, sayı üçüncü satıra
       düşüyordu. Dört ölçü 400 piksellik bir blok oluyordu.
       Telefonda her ölçü tek satır: solda adı ve koşulu, sağda sayısı. Aynı
       kalıp hisse sayfasının seans haritasında ve karşılaştırmanın şirket
       künyesinde de var — dar ekranda ızgara yerine satır, bu depoda artık
       yerleşik bir çözüm. Geniş ekranda ızgara yerinde duruyor. */
    <dl
      className={cn(
        "rounded-lg bg-surface-sunken px-4 py-3 sm:grid sm:gap-x-5 sm:gap-y-4 sm:px-5 sm:py-3.5",
        "divide-y divide-line-soft sm:divide-y-0",
        RAIL_COLS[Math.min(list.length, 5)],
      )}
    >
      {list.map((fact) => (
        /* SAYILAR AYNI ÇİZGİDE. Hücreler yalnızca bir kutuydu ve etiketi iki
           satıra sarkan ölçünün sayısı, yanındakinden bir satır aşağı
           düşüyordu: telefonda "F/K 46,5" ile "NET KÂR MARJI %30,1" ızgaranın
           aynı satırındayken farklı yüksekliklerde duruyordu. Hücre artık
           sütun ve sayı `mt-auto` ile alta yaslı; ızgara satırı zaten eşit
           yükseklik veriyor. */
        <div
          key={fact.label}
          className="flex min-w-0 items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0 sm:flex-col sm:items-stretch sm:justify-start sm:gap-0 sm:py-0"
        >
          {/* Etiket ve künye 10px'ti ve okunmuyordu — ray zaten sakin bir
              katman, bir de puntoyu kısınca fısıltıya dönüşüyordu. */}
          <dt className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className={cn(PLATE_LABEL, "text-tiny text-muted")}>
              {fact.label}
            </span>
            {/* Künye PARANTEZ İÇİNDE. Etiketin yanında çıplak dururken ikisi
                tek bir uzun etiket gibi okunuyordu ("PİYASA DEĞERİ bugün");
                parantez, ölçünün adı ile o ölçünün koşulunu ayırıyor. */}
            {fact.note && (
              <span className="shrink-0 text-tiny font-medium text-muted">
                ({fact.note})
              </span>
            )}
          </dt>
          <dd
            className={cn(
              /* Satır düzeninde sayı sağ uçta ve bir punto küçük; ızgarada
                 eski yerinde ve eski boyunda. */
              "figure shrink-0 text-lead font-bold leading-none tracking-[-0.03em] sm:mt-auto sm:pt-1.5 sm:text-title",
              fact.tone === "up" && "text-up",
              fact.tone === "down" && "text-down",
              !fact.tone && "text-strong",
            )}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
