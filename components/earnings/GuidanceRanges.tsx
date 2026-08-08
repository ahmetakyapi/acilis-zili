import { ChartFooter, type FooterStat } from "@/components/earnings/ChartFooter";
import { cn } from "@/lib/utils";

/**
 * Gelecek çeyrek şirket öngörüsü — yatay aralık barları.
 *
 * Her satır bir ölçü: şirketin verdiği alt–üst bandı dolu bar, piyasa
 * beklentisi onun üstündeki nokta. Sayfadaki en yoğun bilgi burada:
 * "şirket ne diyor" ile "piyasa ne bekliyordu" arasındaki fark, hissenin
 * neden düştüğünü tek bakışta gösteriyor — üç paragraf metin aynı şeyi
 * anlatmak için üç paragraf sürüyordu.
 *
 * Ölçek satır başına AYRI hesaplanıyor: gelir milyar dolar, marj yüzde,
 * hisse başı kâr dolar — üçünü ortak eksene oturtmak anlamsız. Eksen
 * bandın ve beklentinin ikisini de kapsayacak şekilde %12 payla açılıyor;
 * pay olmadan bandın ucundaki nokta kenara yapışıyordu.
 */

export type GuidanceRow = {
  label: string;
  low: number;
  high: number;
  consensus?: number | null;
  unit?: string | null;
  /** Nötr bağlam: "Orta nokta 10,55 · Piyasa Beklentisi 10,82". */
  note?: string | null;
  /** Renkli yargı: "Aralığın Üstünde ▼" / "Uyumlu ✓". */
  evaluation?: string | null;
  tone?: string | null;
};

const PAD_RATIO = 0.12;

/** Renkli yargının metinleri — okuyucunun dilinde gelir. */
export type GuidanceVerdictLabels = {
  /** Piyasa beklentisi şirketin bandının ÜSTÜNDE: şirket az öngördü. */
  above: string;
  /** Beklenti bandın ALTINDA: şirket beklentiden fazlasını öngördü. */
  below: string;
  /** Beklenti bandın içinde. */
  inline: string;
};

/**
 * Renkli yargı kayıtta yoksa SAYILARDAN türetilir.
 *
 * `evaluation` alanı sonradan eklendi; ondan önce yazılmış kayıtlarda
 * öngörü satırlarının tamamı gri duruyor ve "şirket beklentiyi karşıladı mı"
 * sorusu ancak üç sayı karşılaştırılarak cevaplanıyordu. Oysa cevap zaten
 * kayıtta: bandın iki ucu ve piyasa beklentisi orada. Uydurma değil,
 * karşılaştırma.
 */
function judge(
  lo: number,
  hi: number,
  consensus: number | null,
  labels: GuidanceVerdictLabels,
): { text: string; tone: "up" | "down" } | null {
  if (consensus === null) return null;
  if (consensus > hi) return { text: `${labels.above} ▼`, tone: "down" };
  if (consensus < lo) return { text: `${labels.below} ▲`, tone: "up" };
  return { text: `${labels.inline} ✓`, tone: "up" };
}

/**
 * Eski kayıtların not metninden yargı cümlesini ayıklar.
 *
 * `evaluation` yokken ajan yargıyı notun sonuna ekliyordu ("… · Beklenti
 * aralığın üstünde"). Türetilmiş yargıyı da basınca aynı şey iki kez
 * yazılıyor. Nötr parçaların hepsi sayı taşır ("Orta nokta 10,55"), yargı
 * cümlesi taşımaz — ayıklama bu farka bakıyor.
 */
function stripJudgment(note: string): string {
  const parts = note
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1 && !/\d/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(" · ");
}

export function GuidanceRanges({
  rows,
  title,
  legendRange,
  legendConsensus,
  verdictLabels,
  formatRange,
  footer = [],
  locale,
  className,
}: {
  rows: GuidanceRow[];
  title: string;
  legendRange: string;
  legendConsensus: string;
  verdictLabels: GuidanceVerdictLabels;
  /** Aralığın TAMAMINI biçimlendirir — birim iki kez yazılmasın diye tek
      çağrı: "10,3 – 10,8 Mr $", "%83 – %85". */
  formatRange: (low: number, high: number, unit?: string | null) => string;
  footer?: FooterStat[];
  /** ChartFooter'a geçer — not satırının Title Case'i dile bağlı. */
  locale: string;
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-[16px] border border-line bg-surface-solid p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h3 className="text-[14.5px] font-bold text-strong">{title}</h3>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-3 rounded-full bg-primary" />
            {legendRange}
          </span>
          <span className="flex items-center gap-1.5">
            {/* Gösterge işareti bandın üstündeki İŞARETİN aynısı: yuvarlak
                bir nokta çizilip barda kapsül göstermek, okuyucuya iki ayrı
                şey varmış gibi geliyordu. */}
            <span aria-hidden className="h-3 w-[5px] rounded-full bg-strong" />
            {legendConsensus}
          </span>
        </div>
      </div>

      {/* Satırlar kartın boyuna YAYILIYOR — ama yalnızca üç ve üstünde.
          Yanındaki sütun grafiği sabit yükseklikte ve kart onunla aynı boya
          çekiliyor; satırlar yukarıda toplanınca altta kocaman bir boşluk
          kalıyordu. Yayılma iki ölçüde denendi ve bu sefer boşluk kartın
          ORTASINA yığıldı (iki satır arası yüz piksel) — o yüzden eşik üç.
          Üç satırda araların büyümesi ferahlık, ikide kopukluk. */}
      <ul
        className={cn(
          "flex flex-col gap-4",
          rows.length >= 3 && "min-h-0 flex-1 justify-between",
        )}
      >
        {rows.map((row, index) => {
          const lo = Math.min(row.low, row.high);
          const hi = Math.max(row.low, row.high);
          /* `!= null`: alan hem eksik hem açıkça null olabiliyor (bkz.
             lib/schema.ts jsonb tipleri). `!== undefined` null'ı geçiriyor
             ve nokta eksenin dışına düşüyordu. */
          const consensus = row.consensus ?? null;
          const marks = [lo, hi, ...(consensus !== null ? [consensus] : [])];
          const min = Math.min(...marks);
          const max = Math.max(...marks);
          const span = max - min || Math.abs(max) || 1;
          const axisMin = min - span * PAD_RATIO;
          const axisMax = max + span * PAD_RATIO;
          const pos = (value: number) =>
            ((value - axisMin) / (axisMax - axisMin)) * 100;

          const derived = row.evaluation ? null : judge(lo, hi, consensus, verdictLabels);
          const evaluation = row.evaluation ?? derived?.text ?? null;
          const tone = row.evaluation ? row.tone : (derived?.tone ?? null);
          const note = row.note
            ? derived
              ? stripJudgment(row.note)
              : row.note
            : null;

          return (
            <li key={`${row.label}-${index}`} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[13.5px] font-bold text-strong">
                  {row.label}
                </span>
                <span className="numeral whitespace-nowrap text-[15px] font-bold text-strong">
                  {formatRange(lo, hi, row.unit)}
                </span>
              </div>

              <div className="relative h-3 w-full rounded-full bg-surface-elevated">
                {lo === hi ? (
                  /* Şirket aralık değil TEK bir sayı verdiyse band çizilmez:
                     genişliği sıfır olan bir bandı görünür kılmak için
                     verilen asgari pay, eksenin ortasında rastgele duran
                     mavi bir noktaya dönüşüyordu. Beklenti işaretiyle aynı
                     biçim — ikisi de tek bir değer gösteriyor. */
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-[17px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                    style={{ left: `${pos(lo)}%` }}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 rounded-full bg-primary"
                    style={{
                      left: `${pos(lo)}%`,
                      width: `${Math.max(2, pos(hi) - pos(lo))}%`,
                    }}
                  />
                )}
                {consensus !== null && (
                  /* İşaret bandın ÜSTÜNE biniyor ve kendi zemin renginde bir
                     halka taşıyor: bandın içine düştüğünde maviye karışıp
                     kayboluyordu. Yuvarlak nokta yerine DİKEY kapsül —
                     nokta bir veri işareti gibi okunuyordu, oysa bu bir
                     eşik: "piyasa tam burayı bekliyordu". */
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-[17px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-strong ring-2 ring-surface"
                    style={{ left: `${pos(consensus)}%` }}
                  />
                )}
              </div>

              {/* Bağlam nötr, yargı renkli. Tek parça renkli bir satır
                  "orta nokta 10,55" gibi tarafsız bir bilgiyi de kırmızıya
                  boyuyordu; okuyucu neyin değerlendirme olduğunu ayırt
                  edemiyordu. */}
              {(note || evaluation) && (
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11.5px]">
                  {note && <span className="text-muted">{note}</span>}
                  {evaluation && (
                    <span
                      className={cn(
                        "font-bold",
                        tone === "up"
                          ? "text-up"
                          : tone === "down"
                            ? "text-down"
                            : "text-primary",
                      )}
                    >
                      {evaluation}
                    </span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <ChartFooter stats={footer} locale={locale} />
    </section>
  );
}
