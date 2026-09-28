/**
 * ONDALIK SAYI GİRİŞİ — ekstre hücresi ve form alanı için TEK kural. SAF.
 *
 * Türkçede nokta BİNLİK ayracıdır: "1.845211" bir Türk okuyucuya bir milyon
 * sekiz yüz kırk beş bin diye okunur. Hesaplayıcının alanları bir dönem
 * değeri `String(sayı)` ile yazıyordu (portföyden aktarım, ekstreden
 * aktarım) ve TR arayüzde kesirli adet "1.845211", fiyat "243.1" görünüyordu
 * (28 Eylül, önizleme ekran görüntüsünde yakalandı). Artık alana yazılan her
 * değer `formatDecimalInput` ile dilin ayracını taşıyor, okunan her değer
 * `parseDecimalInput` ile dilin kuralına göre çözülüyor.
 *
 * `type="number"` KULLANILMIYOR: gösterdiği ayraç tarayıcının yerel
 * ayarına bağlı (Türkçe sayfada İngilizce Chrome nokta gösterir) ve
 * geçersiz girişte değeri boş dize olarak veriyor. Alanlar metin +
 * `inputMode="decimal"`.
 */

/**
 * Ekstre sayısı → number. Biçim belgenin diline göre değişiyor:
 *   TR  "1.234,56"  "12,5"   "0,0125"
 *   EN  "1,234.56"  "12.5"   "(1.00)" (IBKR eksiyi parantezle de yazar)
 * İki ayraç birden varsa SONDAKİ ondalıktır — dil bilinmese de kesin.
 * Tek ayraçta karar `decimal` ipucuyla: TR belgesinde virgül ondalık,
 * EN belgesinde nokta. İpucuna aykırı tek ayraç ancak tam üçlü basamak
 * gruplarıysa binlik sayılır ("1.234" TR'de bin iki yüz otuz dört).
 * Okunamayan her şey null — sıfır değil.
 */
export function parseAmount(raw: string | undefined | null, decimal: "," | "." = "."): number | null {
  if (raw === undefined || raw === null) return null;
  let text = raw.trim().replace(/[\s  ]/g, "");
  if (text === "" || text === "-" || text === "--") return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/^(USD|US\$|\$)/i, "").replace(/(USD|\$)$/i, "");
  if (/^[-−–]/.test(text)) {
    negative = !negative;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }
  text = text.replace(/^(USD|US\$|\$)/i, "");
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    const thousands = dec === "," ? "." : ",";
    normalized = text.split(thousands).join("").replace(dec, ".");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const groups = /^\d{1,3}([.,]\d{3})+$/.test(text);
    const count = text.split(sep).length - 1;
    if (sep === decimal && count === 1) normalized = text.replace(sep, ".");
    else if (groups) normalized = text.split(sep).join("");
    else if (count === 1) normalized = text.replace(sep, ".");
    else return null;
  } else {
    normalized = text;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/**
 * Okuyucunun yazdığı sayı. Kural (`decimal` = dilin ondalık ayracı; TR ",",
 * EN "."):
 *   1. İki ayraç birden varsa SONDAKİ ondalıktır: "1.845,50" = 1845,5 ve
 *      "1,845.50" = 1845.5 — iki dilde de kesin.
 *   2. Tek bir dilin-ayracı varsa ondalıktır: TR "1,845211", EN "243.1".
 *   3. Öteki ayraç tek başına geldiyse (TR'de nokta, EN'de virgül): tam
 *      üçlü basamak gruplarıysa BİNLİKTİR, değilse ONDALIK sayılır.
 *        TR "1.845"     → 1845       (binlik: Türkçe yazımın kendisi)
 *        TR "1.234.567" → 1234567
 *        TR "243.1"     → 243,1      (üçlü grup değil → ondalık)
 *        TR "1.845211"  → 1,845211
 *        EN "1,845"     → 1845       EN "1,5" → 1.5
 *   BELİRSİZ OLAN TEK DURUM üçüncü kuralın ilk satırı: TR'de "1.845" hem
 *   "bin sekiz yüz kırk beş" hem (İngilizce alışkanlıkla) "1,845" olabilir.
 *   Karar Türkçe yazımdan yana: Türkçe arayüzde nokta binliktir. Bu yüzden
 *   alan, belirsiz girişte okunan değeri altında yazıyor (`isAmbiguous`),
 *   okuyucu yanlış anlaşıldığını görebilsin.
 * Boş, "-" ya da bozuk giriş null — sıfır değil.
 */
export function parseDecimalInput(raw: string, locale: string): number | null {
  return parseAmount(raw, locale === "tr" ? "," : ".");
}

/** Üçüncü kuralın belirsiz hâli: "1.845" (TR) ya da "1,845" (EN). */
export function isAmbiguous(raw: string, locale: string): boolean {
  const other = locale === "tr" ? "." : ",";
  const text = raw.trim();
  return text.includes(other) && !text.includes(other === "." ? "," : ".") && /^[-+]?\d{1,3}([.,]\d{3})+$/.test(text);
}

/** Alana yazılacak hâl: dilin ondalık ayracı, binlik ayracı YOK (düzenlerken
 *  kayan gruplar imleci şaşırtıyor), en fazla `maxFraction` ondalık. Dolar
 *  tutarı `money` ile en az iki ondalık taşır ("243,10"), adet taşımaz. */
export function formatDecimalInput(
  value: number,
  locale: string,
  { money = false, maxFraction = DEFAULT_FRACTION }: { money?: boolean; maxFraction?: number } = {},
): string {
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    useGrouping: false,
    minimumFractionDigits: money ? CENTS : 0,
    maximumFractionDigits: maxFraction,
  }).format(value);
}

/** Dolar tutarının en az ondalığı. */
const CENTS = 2;

/** Kesirli hisse adedi sekiz ondalık taşıyabiliyor. */
const DEFAULT_FRACTION = 8;
