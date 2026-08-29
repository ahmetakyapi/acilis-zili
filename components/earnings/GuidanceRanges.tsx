import {
  ChartFooter,
  type FooterStat,
} from "@/components/earnings/ChartFooter";
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
 * Eksen ORTA NOKTAYA GÖRE YÜZDE SAPMA ve kartın tamamında ORTAK. Satırlar
 * farklı birimlerde (milyar dolar, yüzde, dolar) ortak bir sayı ekseninde
 * buluşamaz — ama oranda buluşur. Ayrıntı ve neden değiştiği aşağıda.
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

/**
 * Eksen: ORTA NOKTAYA GÖRE YÜZDE SAPMA.
 *
 * Çubuk bir dönem yalnızca piyasa beklentisi VARKEN çiziliyordu ve bunun iyi
 * bir sebebi vardı: eksen her satırda kendi işaretlerine göre kuruluyordu,
 * beklenti yoksa işaretler bandın iki ucundan ibaret kalıyor ve eksen tam o
 * bandı çevreleyecek şekilde açılıyordu. Sonuç, ölçü ne olursa olsun
 * birebir aynı uzunlukta bir çubuktu — veri gibi görünen ama hiçbir şey
 * söylemeyen bir süs.
 *
 * Ama çizmemek de bir bedel ödetiyordu: kayıtların dörtte üçünde piyasa
 * beklentisi yok (30 öngörü satırının 23'ü), yani kart çoğu zaman
 * göstergesini gösterip hiçbir çubuk çizmiyordu — okuyucuya bir grafik
 * vaat edip vermiyordu.
 *
 * ÇÖZÜM EKSENİ DEĞİŞTİRMEK. Satırlar farklı birimlerde (milyar dolar, yüzde,
 * dolar) ortak bir sayı ekseninde buluşamaz — ama ORANDA buluşur. Her satır
 * kendi orta noktasına göre yüzde sapmayla çiziliyor ve eksen kartın
 * tamamında ORTAK: en geniş sapma neyse o, ekseni belirliyor.
 *
 * Böylece çubuğun uzunluğu gerçek bir şey söylüyor — şirket kendine ne
 * kadar hareket alanı bırakmış. "18,0–18,2" dar bir çubuk (±%0,6),
 * "150–200" geniş bir çubuk (±%14). Beklenti varsa aynı eksende, orta
 * noktadan sapması kadar uzağa konuyor; bandın içinde mi dışında mı sorusu
 * yine tek bakışta cevaplanıyor.
 */
/** Eksenin iki ucundaki pay — işaret kenara yapışmasın. */
const AXIS_PAD = 1.15;

/** Orta nokta sıfıra çok yakınsa oran anlamını yitirir; o satır çizilmez. */
const MIN_MIDPOINT = 1e-9;

/** Bir satırın orta noktaya göre yarı genişliği ve beklenti sapması. */
function relativeSpread(row: GuidanceRow): {
  mid: number;
  half: number;
  consensusOffset: number | null;
} | null {
  const lo = Math.min(row.low, row.high);
  const hi = Math.max(row.low, row.high);
  const mid = (lo + hi) / 2;
  if (!Number.isFinite(mid) || Math.abs(mid) < MIN_MIDPOINT) return null;
  const consensus = row.consensus ?? null;
  return {
    mid,
    half: (hi - lo) / 2 / Math.abs(mid),
    consensusOffset:
      consensus !== null && Number.isFinite(consensus)
        ? (consensus - mid) / Math.abs(mid)
        : null,
  };
}

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
  axisNote,
  verdictLabels,
  formatRange,
  formatPercent,
  footer = [],
  locale,
  className,
}: {
  rows: GuidanceRow[];
  title: string;
  legendRange: string;
  legendConsensus: string;
  /* Yokluk açıklaması SATIR SATIR DEĞİL, bir kez lejantta: kayıtların
     çoğunda beklenti yok ve satır başına bir cümle yazmak kartın yarısını
     aynı ifadeyle dolduruyordu. Açıklamanın tamamı `axisNote` içinde. */
  /** "Çubuklar orta noktaya göre ölçekli · eksen ±{value}" */
  axisNote: string;
  /** Eksen ucundaki yüzdeyi okuyucunun dilinde yazar. */
  formatPercent: (value: number) => string;
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

  /* Eksen kartın TAMAMINDA ortak: en geniş sapma neyse ölçeği o kuruyor.
     Satır satır kurulan bir eksen bütün çubukları aynı uzunlukta çizerdi —
     karşılaştırma da tam olarak burada doğuyor. */
  const spreads = rows.map(relativeSpread);
  const maxOffset = Math.max(
    ...spreads.flatMap((s) =>
      s ? [s.half, Math.abs(s.consensusOffset ?? 0)] : [],
    ),
    0,
  );
  const axis = maxOffset > 0 ? maxOffset * AXIS_PAD : 0;

  /* Beklenti göstergesi yalnızca EN AZ BİR satırda karşılığı varsa yazılır.
     Kayıtların çoğunda piyasa beklentisi yok ve gösterge her koşulda
     basıldığı için kart olmayan bir işareti tarif ediyordu. */
  const hasConsensus = spreads.some((s) => s?.consensusOffset != null);

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface-solid p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 className="text-read font-bold text-strong">{title}</h2>
        <div className="flex items-center gap-3 text-tiny text-muted">
          {/* LEJANT İŞARETLERİ BARDAKİLERİN AYNISI. Mavi olan bir ARALIK —
              iki ucu olan yatay bir şerit; kısa bir hap onu bir nokta gibi
              gösteriyordu. Siyah olan bir KONUM — aşağıyı gösteren üçgen. */}
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-6 rounded-full bg-primary" />
            {legendRange}
          </span>
          {hasConsensus && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="flex flex-col items-center">
                <span className="block h-0 w-0 border-x-[6px] border-t-[9px] border-x-transparent border-t-strong" />
                <span className="block h-[4px] w-[2px] bg-strong" />
              </span>
              {legendConsensus}
            </span>
          )}
        </div>
      </div>

      {/* Satırlar kartın boyuna YAYILIYOR — ama yalnızca üç ve üstünde.
          Yanındaki sütun grafiği kartla birlikte uzuyor ve iki kart aynı
          hizada bitiyor; satırlar yukarıda toplanınca altta kocaman bir
          boşluk kalıyordu. Yayılma iki satırda da denendi ve bu sefer boşluk
          kartın ORTASINA yığıldı (iki satır arası yüz piksel) — o yüzden
          eşik üç. Üç satırda araların büyümesi ferahlık, ikide kopukluk.

          İki satırlı kartta satırlar ORTALANIYOR: fazla alan altta tek
          parça halinde birikince (yüz piksel) kart yarıda kesilmiş gibi
          duruyordu. Ortalama aynı boşluğu ikiye bölüyor, satırlar başlıkla
          künyenin arasında dengede duruyor ve hiçbir yerde delik açmıyor. */}
      <ul
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-4",
          rows.length >= 3 ? "justify-between" : "justify-center",
        )}
      >
        {rows.map((row, index) => {
          const lo = Math.min(row.low, row.high);
          const hi = Math.max(row.low, row.high);
          /* `!= null`: alan hem eksik hem açıkça null olabiliyor (bkz.
             lib/schema.ts jsonb tipleri). `!== undefined` null'ı geçiriyor
             ve nokta eksenin dışına düşüyordu. */
          const consensus = row.consensus ?? null;
          const spread = spreads[index];
          /* Ortak eksende konum: orta nokta her zaman %50'de, sapma iki yana
             simetrik açılıyor. Eksen yoksa (tek satır ve o da tek değer)
             çubuk çizilmiyor — çizilecek bir genişlik yok. */
          const pos = (offset: number) =>
            axis > 0 ? 50 + (offset / axis) * 50 : 50;

          const derived = row.evaluation
            ? null
            : judge(lo, hi, consensus, verdictLabels);
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
                <span className="text-base font-bold text-strong">
                  {row.label}
                </span>
                <span className="numeral whitespace-nowrap text-read font-bold text-strong">
                  {formatRange(lo, hi, row.unit)}
                </span>
              </div>

              {/* Çubuk her satırda çizilir — eksen ortak olduğu için artık
                  bir şey söylüyor: bandın uzunluğu şirketin kendine bıraktığı
                  hareket alanı, konumu ise beklentiyle arasındaki fark. */}
              {spread && axis > 0 && (
                /* ÜÇ İŞARET, ÜÇ AYRI DİL. Üçü de çubuğun içindeyken hangisinin
                   ne olduğu okunmuyordu: piyasa beklentisi siyah bir kapsül
                   olarak bandın İÇİNE düşüyor, orta nokta da ince bir çizgi
                   olarak aynı yerde duruyordu — iki farklı soruya iki farklı
                   cevap, aynı biçimde.

                   Artık:
                     · ARALIK yatay mavi şerit — iki ucu var, uzunluğu bir
                       şey söylüyor.
                     · PİYASA BEKLENTİSİ şeridin DIŞINDA, üstünde duran ve
                       aşağıyı gösteren bir üçgen. Bir konum işareti; şeridin
                       parçası değil, ona bakıyor.
                     · ORTA NOKTA şeridin içine kesilmiş açık bir yarık —
                       eksenin çapası, bandın kendi ortası.
                   Üst dolgu üçgeni barındırıyor. */
                <div className="relative w-full pt-3.5">
                  {/* İŞARET ÜÇGEN + ŞERİDİ KESEN ÇİZGİ.
                      Önce yalnızca şeridin İÇİNDE duran siyah bir kapsüldü ve
                      orta nokta çizgisiyle karışıyordu; sonra şeridin üstünde
                      duran bir üçgene çevrildi ama üçgen tek başına on iki
                      piksellik şeridin yanında küçük kalıyordu.

                      Şimdi ikisi birden: üstte üçgen, altında şeridi baştan
                      sona kesen iki piksellik dikey çizgi. Beraber tek bir
                      nesne — "piyasa tam ŞURAYI bekliyordu".

                      ORTA NOKTAYLA KARIŞMIYOR, çünkü ikisi artık ayrı dilde:
                      beklenti KOYU ve dolu bir çizgi, üstünde de bir üçgen
                      taşıyor; orta nokta ise kartın zemin renginde bir
                      BOŞLUK — şeridi kesen bir çentik. Biri ekleniyor, öteki
                      çıkarılıyor.

                      Çizgi şeridin üstüne biniyor (`z` sırası: bardan sonra
                      çiziliyor), mavinin üstünde `--strong` ile açık ara
                      görünür duruyor ve gri rayda da öyle. */}
                  {spread.consensusOffset !== null && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 z-10 flex -translate-x-1/2 flex-col items-center"
                      style={{ left: `${pos(spread.consensusOffset)}%` }}
                    >
                      <span className="block h-0 w-0 border-x-[6px] border-t-[9px] border-x-transparent border-t-strong" />
                      <span className="block w-[2px] flex-1 rounded-full bg-strong" />
                    </span>
                  )}
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
                        style={{ left: "50%" }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 rounded-full bg-primary"
                        style={{
                          left: `${pos(-spread.half)}%`,
                          width: `${Math.max(2, pos(spread.half) - pos(-spread.half))}%`,
                        }}
                      />
                    )}
                    {/* ORTA NOKTA YARIĞI EN ÜSTTE. Band orta noktaya göre
                      simetrik kurulduğu için yarık her zaman mavinin
                      üstüne düşüyor ve kartın zemin renginde olduğu için
                      şeridi kesiyormuş gibi okunuyor. Eski ince gri çizgi
                      mavinin altında kalıp görünmüyordu, yani "Orta Nokta
                      3,15" yazısının barda hiçbir karşılığı yoktu. */}
                    {lo !== hi && (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-surface-solid"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Bağlam nötr, yargı renkli. Tek parça renkli bir satır
                  "orta nokta 10,55" gibi tarafsız bir bilgiyi de kırmızıya
                  boyuyordu; okuyucu neyin değerlendirme olduğunu ayırt
                  edemiyordu. */}
              {(note || evaluation) && (
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-tiny">
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

      {/* EKSEN YAZILIYOR. Çubuğun uzunluğu kart içinde GÖRECELİ: en geniş
          bant ekseni belirliyor ve öteki bantlar ona göre kısalıyor. Bu satır
          olmadan uzun bir çubuk "geniş aralık" diye okunuyordu, oysa yalnızca
          "bu karttaki en geniş bant" demek. Ucundaki yüzde, çubukları mutlak
          olarak da okunur kılıyor. */}
      {axis > 0 && (
        <p className="-mt-1 text-tiny text-muted">
          {axisNote.replace("{value}", formatPercent(axis * 100))}
        </p>
      )}

      <ChartFooter stats={footer} locale={locale} />
    </section>
  );
}
