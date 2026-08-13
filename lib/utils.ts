import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ölçü künyelerini Title Case'e çeker — TÜRKÇE DOĞRU biçimde.
 *
 * `text-transform: capitalize` ve `String.toUpperCase()` bu iş için YASAK
 * (bkz. CLAUDE.md): ikisi de `i → I` üretir, oysa Türkçede `i → İ`. Burada
 * dönüşüm `toLocaleUpperCase("tr-TR")` ile yapılıyor ve yalnızca ilk harfe
 * dokunuluyor — kelimenin geri kalanı olduğu gibi kalıyor, böylece "NAND"
 * ya da "FAVÖK" bozulmuyor.
 *
 * NEREDE KULLANILIR: yalnızca ÖLÇÜ KÜNYELERİ — metrik kartının ve grafik
 * künyesinin değer altındaki tek satırlık etiketi. Bunları ajan yazıyor ve
 * kayıttan kayda yazımı değişiyor ("Çeyreklik daralma" / "Rekor · Öngörü");
 * aynı kartın içinde iki ayrı imla duruyordu. Rutin promptu da artık Title
 * Case istiyor, bu katman onu garantiye alıyor.
 *
 * NEREDE KULLANILMAZ: paragraflar, özet, detaylı değerlendirme, güçlü
 * yönler/riskler maddeleri. Onlar cümledir ve cümle düzeni korunur.
 *
 * Sayı, işaret ve kısaltma taşıyan parçalara dokunulmaz: "%372", "▲",
 * "8,97", "Mr", "EPS" olduğu gibi geçer.
 */
const TITLE_SMALL_WORDS: Record<string, ReadonlySet<string>> = {
  tr: new Set(["ve", "ile", "için", "de", "da", "ki", "mi", "mı", "mu", "mü", "idi", "ise", "ya", "veya"]),
  en: new Set(["a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "vs", "with", "at", "by"]),
};

export function titleCaseLabel(text: string, locale: string): string {
  const small = TITLE_SMALL_WORDS[locale === "tr" ? "tr" : "en"];
  const upperLocale = locale === "tr" ? "tr-TR" : "en-US";
  return text
    .split(/(\s+)/)
    .map((token, index) => {
      if (!token.trim()) return token;
      // Rakam ya da harf olmayan bir şey taşıyorsa yazarın yazdığı gibi kalır.
      if (/[\d%$·▲▼~/]/.test(token)) return token;
      // Zaten büyük harfli kısaltma.
      if (token === token.toLocaleUpperCase(upperLocale)) return token;
      const word = index === 0 ? token : token;
      if (index > 0 && small.has(word.toLocaleLowerCase(upperLocale))) {
        return word.toLocaleLowerCase(upperLocale);
      }
      return word.charAt(0).toLocaleUpperCase(upperLocale) + word.slice(1);
    })
    .join("");
}

/** Piyasa yönü — renk ve işaret kararları hep bunun üzerinden verilir. */
export type Direction = "up" | "down" | "flat";

export function directionOf(change: number | null | undefined): Direction {
  if (change === null || change === undefined || Number.isNaN(change)) return "flat";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

const DIRECTION_TEXT: Record<Direction, string> = {
  up: "text-up",
  down: "text-down",
  flat: "text-muted",
};

const DIRECTION_WASH: Record<Direction, string> = {
  up: "bg-up-wash text-up",
  down: "bg-down-wash text-down",
  flat: "bg-surface-sunken text-muted",
};

export function directionText(d: Direction) {
  return DIRECTION_TEXT[d];
}

export function directionWash(d: Direction) {
  return DIRECTION_WASH[d];
}

/** 1234.5 → "1.234,50" (tr) / "1,234.50" (en) */
/**
 * F/K — fiyat ÷ hisse başı kâr (TTM).
 *
 * SAĞLAYICININ HAZIR `peTTM` DEĞERİ KULLANILMIYOR ve gerekçesi ölçüldü:
 * Finnhub o oranı kendi tarafında, geriden gelen bir fiyatla hesaplıyor.
 * 8 Ağustos 2026'da bakıldığında SNDK için `peTTM × epsTTM` çarpımı 1.144 $
 * veriyordu, oysa aynı anda kotasyon 1.212 $'dı — oran %5,6 bayattı. MU'da
 * fark daha küçüktü ama aynı yöndeydi (867 $ / 878 $).
 *
 * Ekranda bunun bedeli şu: sayfanın üstünde "şu an 1.212 $" yazarken hemen
 * altındaki F/K başka bir fiyattan kuruluyor. Aynı sayfada iki fiyat, üstelik
 * hangisinin hangisi olduğu söylenmeden. Oranı burada kendimiz kurunca
 * bölen de bölünen de sayfanın gösterdiği sayı oluyor ve okuyucu isterse
 * çarpıp doğrulayabiliyor.
 *
 * Doğrulama: canlı fiyat ÷ epsTTM ile MU 19,87 · SNDK 16,63 çıkıyor; aynı
 * günün bağımsız tablosunda 19,80 ve 16,43. Kalan fark TTM penceresinin
 * kapanış çeyreğinden geliyor, fiyattan değil.
 *
 * Zarardaki şirkette (epsTtm ≤ 0) oran tanımsız — `null` döner, hücre hiç
 * basılmaz. Eksi bir F/K ekranda "ucuz" gibi okunuyor.
 */
export function peRatioOf(
  price: number | null | undefined,
  epsTtm: number | null | undefined,
): number | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  if (typeof epsTtm !== "number" || !Number.isFinite(epsTtm) || epsTtm <= 0) {
    return null;
  }
  return price / epsTtm;
}

export function formatPrice(
  value: number | null | undefined,
  locale: string,
  opts: { currency?: boolean; digits?: number } = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { currency = false, digits = 2 } = opts;
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return currency ? `$${formatted}` : formatted;
}

/**
 * Yüzde işaretinin yeri DİLE bağlı: Türkçede sayıdan önce (%372, −%0,37),
 * İngilizcede sonra (372%, −0.37%).
 *
 * Site uzun süre iki dilde de sonuna yazıyordu. Yanlış olduğu bilanço
 * sayfasında görünür oldu: ajanın yazdığı serbest metinler kurala uyup
 * "%372" derken, bizim biçimlendirdiğimiz aynı sayı yan hücrede "372%"
 * çıkıyordu. Aynı kartta iki yazım.
 */
/**
 * İşaretle sayı arasındaki dar boşluk — U+202F (dar bağlantısız boşluk).
 *
 * "+%2.902" ve "≈187,53" gibi dizelerde işaret sayıya yapışık duruyordu ve
 * ikisi tek bir simge gibi okunuyordu. Normal boşluk kullanılamaz: satır
 * sonuna denk geldiğinde işaret üst satırda, sayı alt satırda kalır ve
 * "−" tek başına bir tire gibi görünür. U+202F hem dar hem bölünmez.
 *
 * Yönü ▲/▼ ile veren yerlerde ok ayrı bir düğümde durur ve boşluğu
 * `gap-*` verir; bu sabit yalnızca dizeye gömülü işaretler içindir.
 */
export const SIGN_GAP = " ";

function withPercent(formatted: string, locale: string, sign = "") {
  const lead = sign ? `${sign}${SIGN_GAP}` : "";
  return locale === "tr" ? `${lead}%${formatted}` : `${lead}${formatted}%`;
}

/**
 * Değişim yüzdesi — işaret her zaman gösterilir.
 *
 * `digits` fiyat değişimi için 2'de kalır ama bilanço büyümeleri üç haneli
 * olabiliyor ve "+372,00%" ondalıkları gürültü; oralarda 0–1 hane isteniyor.
 */
export function formatPercent(
  value: number | null | undefined,
  locale: string,
  digits = 2,
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return withPercent(formatted, locale, sign);
}

/**
 * İşARETSİZ yüzde — 372 → "%372" / "372%".
 *
 * Yanında zaten ▲/▼ oku duran değerler için. `formatPercent` işareti her
 * zaman basıyor ve ok ile birleşince "▲ +372%" gibi iki kez yön bildiren bir
 * dize çıkıyordu.
 */
export function formatPercentPlain(
  value: number | null | undefined,
  locale: string,
  digits = 1,
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  return withPercent(formatted, locale);
}

/** Mutlak değişim — 2.41 → "+2,41" */
export function formatChange(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign ? `${sign}${SIGN_GAP}${formatted}` : formatted;
}

/** Piyasa değeri — 3210000000 → "3,21 T" */
export function formatCompact(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const units =
    locale === "tr"
      ? [
          { v: 1e12, s: "T" },
          { v: 1e9, s: "Mr" },
          { v: 1e6, s: "Mn" },
          { v: 1e3, s: "B" },
        ]
      : [
          { v: 1e12, s: "T" },
          { v: 1e9, s: "B" },
          { v: 1e6, s: "M" },
          { v: 1e3, s: "K" },
        ];
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    maximumFractionDigits: 2,
  });
  for (const unit of units) {
    if (abs >= unit.v) return `${nf.format(value / unit.v)} ${unit.s}`;
  }
  return nf.format(value);
}

/** Hacim — tam sayı, binlik ayraçlı */
export function formatVolume(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

/** "az önce" / "3 dk önce" — veri tazeliği damgası için. */
export function timeAgo(date: Date | string, locale: string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);

  if (seconds < 45) return locale === "tr" ? "az önce" : "just now";
  const rtf = new Intl.RelativeTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    numeric: "auto",
  });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (seconds >= secondsInUnit) {
      return rtf.format(-Math.floor(seconds / secondsInUnit), unit);
    }
  }
  return rtf.format(-seconds, "second");
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z][A-Z.-]{0,9}$/.test(symbol);
}

/**
 * Dışarıya açılan bağlantıları süzer — yalnızca http(s) geçer.
 *
 * `href` değerlerinin hepsi bizim yazdığımız metinden gelmiyor: haber ve
 * şirket sitesi adresleri sağlayıcıdan, mercek yazılarının kaynak listesi
 * ise /api/mercek ucundan geliyor. Zod'un `.url()` doğrulaması bu iş için
 * yeterli değil — `new URL()` tabanlı olduğu için `javascript:alert(1)` de
 * geçerli bir URL sayılıyor ve `<a href>` içine konduğunda tıklandığında
 * çalışan bir betiğe dönüşüyor.
 *
 * Gerçekleşme ihtimali düşük (uçlar secret'la korunuyor, sağlayıcılar
 * güvenilir) ama bedeli tek satır ve React'in JSX kaçışı bu vektörü
 * kapatmıyor — href öznitelikleri kaçışın kapsamı dışında.
 *
 * Geçmeyen adres null döner; çağıran taraf bağlantıyı düz metne düşürür.
 */
export function safeExternalUrl(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.href
      : null;
  } catch {
    // Göreli ya da bozuk adres — dış bağlantı olarak kullanılamaz.
    return null;
  }
}

/* --------------------------------------------------------------------------
   Tarih ve çift saat gösterimi
   Kaynaklar ET (New York) yayınlar; kullanıcı Türkiye'de okur. Tarihler
   Türkiye alışkanlığına göre ("6 Ağustos Perşembe"), saatler ET · TR çifti
   olarak gösterilir.
   -------------------------------------------------------------------------- */

/** "2026-08-06" → "6 Ağustos Perşembe" / "Thursday, August 6" */
export function formatEtDateLong(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (locale === "tr") {
    const day = new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date);
    const weekday = new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      timeZone: "UTC",
    }).format(date);
    return `${day} ${weekday}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "2026-08-06" → "06.08.2026" / "08/06/2026" */
export function formatEtDateShort(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split("-");
  return locale === "tr" ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
}

/**
 * "2026-08-06" → "6 Ağu" / "Aug 6"
 *
 * Dar sütunlarda tam tarih ("06.08.2026") komşu sütuna taşıyordu; yıl zaten
 * her satırda aynı ve bilgi taşımıyor. Yılı gerçekten gereken yerlerde
 * `formatEtDateShort` duruyor.
 */
export function formatEtDateCompact(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

const TR_TIME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * ET saatini Türkiye saatiyle eşler.
 * Dönüş: { et: "08:30", tr: "15:30" } — DST farkları utcDate üzerinden doğru.
 */
export function dualTime(utcDate: Date, etTime: string): { et: string; tr: string } {
  return { et: etTime, tr: TR_TIME.format(utcDate) };
}

/**
 * Haber gerçekten bu şirketle mi ilgili?
 *
 * `news.symbols` alanı her zaman haberin KONUSUNU söylemiyor: günlük senkron,
 * en büyük şirketlerin haber uçlarını tek tek geziyor ve sağlayıcı sembol
 * döndürmediğinde kaydı çekildiği sembolle damgalıyor. Sonuç: "Palantir, AMD,
 * Coherent, SpaceX…" başlıklı genel bir piyasa yazısı MU etiketiyle
 * duruyor. Künyeye Micron logosu koyduğumuz anda bu sessiz bir yanlıştan
 * görünür bir yanlışa dönüştü.
 *
 * Bu yüzden logo, ancak şirket BAŞLIKTA gerçekten geçiyorsa gösterilir:
 * sembolün kendisi ya da şirket adının ilk kelimesi ("Micron Technology Inc"
 * → "micron"). Geçmiyorsa nötr sembol karosu kalır — eksik bilgi, yanlış
 * bilgiden iyidir.
 */
export function headlineMentions(
  headline: string,
  symbol: string,
  name?: string | null,
): boolean {
  const text = headline.toLowerCase();
  const escaped = symbol.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`).test(text)) return true;

  // Şirket adının ilk kelimesi — "Inc", "Corp" gibi son ekler eşleşme üretmez.
  const first = (name ?? "").trim().split(/[\s,.]+/)[0]?.toLowerCase();
  return Boolean(first && first.length >= 3 && text.includes(first));
}


/**
 * FRED serisinin dönem künyesi: "2026-06" → "Haziran 2026".
 *
 * NEDEN PAYLAŞILAN: makro ekranı bu künyeyi sayının yanına koyuyordu ama ana
 * sayfadaki Makro Özeti paneli koymuyordu — aynı sayı orada 23 puntoyla ve
 * TARİHSİZ duruyordu. TÜFE ve istihdam haftalar geriden yayımlanır; okuyucu
 * büyük puntolu bir sayıyı bugünün verisi sanıyordu. Projenin "bayat veriyi
 * damgasız gösterme" kuralı tam olarak bunu yasaklıyor.
 */
export function formatPeriodLabel(
  period: string | null,
  locale: string,
): string {
  if (!period) return "—";
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${match[1]}-${match[2]}-15T12:00:00Z`));
}
