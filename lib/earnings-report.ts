import type { Locale } from "@/lib/i18n";
import type { AnalysisKpi, AnalysisSegment } from "@/lib/schema";
import {
  formatCompact,
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  MONEY_GAP,
  SIGN_GAP,
} from "@/lib/utils";

/**
 * Bilanço detay sayfasının saf yardımcıları — tarih tahmini okuma, madde
 * başındaki tarihi ayırma ve öngörü aralığının yazımı.
 *
 * Hepsi bir dönem sayfa dosyasının içindeydi (2.197 satır). Sayfa panel
 * bileşenlerine bölünürken buraya taşındılar: ikisi birden fazla panelin
 * ortak ihtiyacı, üçü de DOM'suz birim testine açık mantık
 * (`tests/earnings-report.test.ts`). Gövdeler taşınırken değişmedi.
 */

const MONTHS: Record<string, number> = {
  oca: 1, şub: 2, sub: 2, mar: 3, nis: 4, may: 5, haz: 6, tem: 7, ağu: 8, agu: 8,
  eyl: 9, eki: 10, kas: 11, ara: 12,
  jan: 1, feb: 2, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Tam ay adları — madde başındaki tarihi bir konu başlığından ayırmak için. */
const MONTH_NAMES = new Set([
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos",
  "eylül", "ekim", "kasım", "aralık",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
]);

/**
 * Kaydın serbest metin tahmini ("~21-22 Eylül 2026", "~Aralık 2026",
 * "Late October 2026") bugünden geride mi?
 *
 * Metnin gösterebileceği EN GEÇ gün alınıyor: gün yoksa ayın sonu, ay da
 * yoksa yılın sonu. Böylece "~Aralık 2026" Aralık bitene kadar geçmiş
 * sayılmıyor. Yıl okunamazsa cevap "hayır" — tarih çözülemiyorsa bir
 * tahmini gizlemek, onu yanlışlıkla geçmiş saymaktan az zararlı değil ama
 * kayıt her zaman yıl yazıyor (rutin şeması).
 */
export function estimateIsPast(text: string, today: string): boolean {
  const lower = text.toLocaleLowerCase("tr-TR");
  const year = lower.match(/20\d{2}/)?.[0];
  if (!year) return false;
  const month = lower
    .split(/[^a-zçğıöşü]+/)
    .map((word) => MONTHS[word.slice(0, 3)])
    .find((value) => value !== undefined);
  const days = (lower.replace(year, "").match(/\b\d{1,2}\b/g) ?? [])
    .map(Number)
    .filter((day) => day >= 1 && day <= 31);
  const lastDay = month
    ? days.length > 0
      ? Math.max(...days)
      : new Date(Date.UTC(Number(year), month, 0)).getUTCDate()
    : 31;
  const latest = `${year}-${String(month ?? 12).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return latest < today;
}

/**
 * Öngörü aralığının tam metni: "10,3 – 10,8 Mr $" · "%83 – %85".
 *
 * İki ayrıntı burada karara bağlanıyor:
 *
 * ONDALIK HANE ölçeğe göre. Aynı kartta gelir (10,3 milyar), hisse başı kâr
 * (44 $) ve marj (%83) yan yana duruyor; hepsine iki hane vermek "10,30 Mr $"
 * gibi sahte bir hassasiyet üretiyor, hepsine sıfır vermek 44 ile 46
 * arasındaki farkı siliyordu.
 *
 * YÜZDE İŞARETİ dile göre yer değiştirir ve aralığın İKİ ucuna da yazılır:
 * Türkçede "%83 – %85", İngilizcede "83% – 85%". Birim ise aralığın yalnızca
 * SONUNDA durur — "10,3 Mr $ – 10,8 Mr $" aynı bilgiyi iki kez söylüyordu.
 */
export function formatGuidanceRange(
  low: number,
  high: number,
  unit: string | undefined,
  locale: Locale,
): string {
  const { a, b, withUnit } = guidanceParts(low, high, unit, locale);
  /* Şirket bant değil tek sayı verdiyse (ya da üç haneye rağmen ikisi aynı
     kalıyorsa) "2,16 – 2,16" yerine tek değer yazılır. */
  if (a === b) return withUnit(a);
  if (unit === "%") return `${withUnit(a)} – ${withUnit(b)}`;
  return `${a} – ${withUnit(b)}`;
}

/**
 * Şeridin iki ucundaki etiketler: başlıktaki aralıkla AYNI hane sayısı,
 * her uçta kendi birimi ("6,80 Mr $" · "6,85 Mr $"). Gerekçe
 * GuidanceRanges → `formatEnds`.
 */
export function guidanceEnds(
  low: number,
  high: number,
  unit: string | undefined,
  locale: Locale,
): [string, string] {
  const { a, b, withUnit } = guidanceParts(low, high, unit, locale);
  return [withUnit(a), withUnit(b)];
}

/** Aralığın iki ucu ortak hane sayısıyla ve birim ekleyici — kural aşağıda. */
function guidanceParts(
  low: number,
  high: number,
  unit: string | undefined,
  locale: Locale,
): { a: string; b: string; withUnit: (value: string) => string } {
  /* HANE SAYISI ŞİRKETİN VERDİĞİ SAYIDAN ÇIKIYOR — ölçekten değil.
     
     Burada ölçek tabanlı bir kural vardı (100'den büyükse 0, 10'dan
     büyükse 1, değilse 2 hane) ve iki yönde birden bozuyordu. Otuz
     analizin on altı kaleminde ekrandaki bant şirketin açıkladığından
     FARKLI çıkıyordu:

       AMGN  yönetim 15,80–17,08 dedi, ekranda "15,8 – 17,1"
       HWM   yönetim 2,565–2,585 dedi, ekranda "2,56 – 2,58"
       APP   yönetim 2,055–2,085 dedi, ekranda "2,06 – 2,08"
       PLTR  yönetim 1,292–1,296 dedi, ekranda "1,29 – 1,30"

     Yani hem bant daralıyor/kayıyor hem de yanında ayrıca hesaplanan
     "orta nokta" ekrandaki iki ucun ortası olmaktan çıkıyordu: okuyucu
     aritmetiği tutturamıyordu.

     Ters yönde de uyduruyordu: bir uç ondalıklıysa İKİSİNE de iki hane
     veriyordu — "%7,00 – %8,50", oysa yönetim "%7–8,5" dedi.

     Yeni kural: her ucu TAM gösteren en az hane sayısı, ikisinin büyüğü.
     Ortak hane sayısı bilinçli — bir aralığın iki ucunu farklı
     hassasiyetle yazmak ("2,16 – 2,164") sayıyı hatalı gösteriyor.
     Üçte duruluyor; ötesi şirketin verdiği bir şey değil. */
  const gerekliHane = (value: number) => {
    for (let d = 0; d <= 3; d += 1) {
      if (Math.abs(Number(value.toFixed(d)) - value) < 1e-9) return d;
    }
    return 3;
  };
  const d = Math.max(gerekliHane(low), gerekliHane(high));

  const a = formatPrice(low, locale, { digits: d });
  const b = formatPrice(high, locale, { digits: d });

  /* Yüzde işaretinin yeri dile bağlı ve HER İKİ uca da yazılıyor; ötekilerde
     birim yalnızca sonda bir kez geçiyor ("2,160 – 2,164 Mr $"). */
  function withUnit(value: string): string {
    if (unit === "%") return locale === "tr" ? `%${value}` : `${value}%`;
    return unit ? `${value} ${unit}` : value;
  }

  return { a, b, withUnit };
}

/**
 * "Aralık 2026: Yeni ürün…" → { date: "Aralık 2026", text: "Yeni ürün…" }.
 *
 * Yalnızca iki noktadan önceki parça bir TARİH gibi okunuyorsa (yıl ya da
 * ay adı taşıyor, 40 karakteri geçmiyor) ayrılıyor; "Yapay zekâ: …" gibi
 * bir konu başlığı tarih sayılmıyor ve madde düz kalıyor.
 */
export function splitLeadingDate(point: string): { date: string; text: string } | null {
  const match = point.match(/^([^:]{2,40}):\s+([\s\S]+)$/);
  if (!match) return null;
  const head = match[1].trim();
  const lower = head.toLocaleLowerCase("tr-TR");
  const looksLikeDate =
    /20\d{2}/.test(head) ||
    /\b(?:Q[1-4]|[1-4]Ç)\s?(?:FY)?\s?\d{2}/i.test(head) ||
    lower.split(/[^a-zçğıöşü]+/).some((word) => MONTH_NAMES.has(word));
  return looksLikeDate ? { date: head, text: match[2] } : null;
}

/* ---------------------------------------------------------------------------
   Ekler — segment payları ve KPI değerleri
   --------------------------------------------------------------------------- */

/**
 * Segment toplamı ile konsolide gelir arasındaki kabul edilen fark.
 *
 * Şirketler segment tablosunu kendi yuvarlamasıyla veriyor; binde birlik
 * bir fark bir çelişki değil. Yüzde birin üstü öyle: eliminasyon ya da
 * "diğer" satırı tabloda yok demektir ve künye bunu söylüyor.
 */
export const SEGMENT_TOTAL_TOLERANCE = 0.01;

export type SegmentShare = AnalysisSegment & { share: number };

/**
 * Segmentlerin payları — BÜYÜKTEN KÜÇÜĞE ve SEGMENT TOPLAMI üzerinden.
 *
 * Konsolide gelire bölmek daha doğal görünüyordu ama iki yönde yanlış
 * sonuç veriyordu: eliminasyonu olan şirkette paylar toplamı %100'ü aşar,
 * "diğer" satırı yazılmamış şirkette %100'e ulaşmaz. Pay çubukları bir
 * BÜTÜNÜN parçası olarak okunuyor; bütün, tabloda gördüğün satırların
 * toplamı olmalı. Konsolide gelirle fark varsa künye onu ayrıca yazıyor
 * (`segmentTotalDiffers`).
 */
export function segmentShares(segments: AnalysisSegment[]): {
  rows: SegmentShare[];
  total: number;
} {
  const total = segments.reduce((sum, segment) => sum + segment.revenue, 0);
  const rows = segments
    .map((segment) => ({ ...segment, share: total > 0 ? segment.revenue / total : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  return { rows, total };
}

/** Segment toplamı konsolide gelirden `SEGMENT_TOTAL_TOLERANCE`tan fazla mı sapıyor. */
export function segmentTotalDiffers(total: number, revenue: number | null | undefined): boolean {
  if (revenue === null || revenue === undefined || revenue <= 0) return false;
  return Math.abs(total - revenue) / revenue > SEGMENT_TOTAL_TOLERANCE;
}

/**
 * KPI değerinin yazımı — birim sayıdan KOPMAZ.
 *
 * "USD" para kısaltmasıyla ("$4,2 Mr"), "%" düzey olarak (artıda işaretsiz,
 * eksi işaretli — marj bir değişim değil), başka her birim sayma birimi
 * olarak sayının arkasına bölünmez boşlukla ("301 Mn abone"). Sayı ham
 * geliyor; kısaltma sitenin kendi biçimi (`formatCompact`), yani "Mn"/"M"
 * dile göre.
 */
export function kpiValueText(kpi: Pick<AnalysisKpi, "value" | "unit">, locale: Locale): string {
  const unit = kpi.unit.trim();
  if (unit.toUpperCase() === "USD" || unit === "$") {
    return formatMoneyCompact(kpi.value, locale);
  }
  if (unit === "%") {
    return kpi.value < 0
      ? formatPercent(kpi.value, locale, 1)
      : formatPercentPlain(kpi.value, locale, 1);
  }
  /* Bin altındaki TAM sayı ondalıksız: `formatCompact` 10–99 aralığına bir
     hane veriyor ve "96 gün" ekranda "96,0 gün" oluyordu — şirketin
     yazmadığı bir kesinlik. */
  const number =
    Math.abs(kpi.value) < THOUSAND && Number.isInteger(kpi.value)
      ? new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US").format(kpi.value)
      : formatCompact(kpi.value, locale);
  return `${number}${MONEY_GAP}${unit}`;
}

const THOUSAND = 1000;

/** Yıllık değişim: "▲ %12,4" — ok ile sayı arası dar, bölünmez boşluk. */
export function yoyText(value: number, locale: Locale): string {
  return `${value >= 0 ? "▲" : "▼"}${SIGN_GAP}${formatPercentPlain(value, locale, 1)}`;
}

/**
 * Satır içi biçimi ayıklanmış düz metin — liste kartının tek satırlık
 * ipucu için. `RichText`in tanıdığı iki kalıp (`[metin](/adres)` ve
 * `**kalın**`) metne iner: kartın tamamı zaten bir bağlantı ve iç içe
 * bağlantı geçersiz HTML olurdu.
 */
export function plainInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}
