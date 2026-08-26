import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Kendi punto adlarımız — `--text-*` tokenlarının ölçü olanları.
 *
 * BUNLARI twMerge'E TANITMAK ZORUNLUYUZ. Birleştirici `text-xs`, `text-sm`
 * gibi KENDİ bildiği adları punto sayıyor; tanımadığı `text-small` ise
 * RENK varsayıyor. Bizim renk tokenlarımız da aynı önekle yazıldığı için
 * (`text-body`, `text-strong`, `text-muted`) ikisi tek gruba düşüyor ve
 * çakışma kuralı gereği SONUNCUSU kazanıyordu:
 *
 *     cn("text-small font-semibold", "text-body")  →  "font-semibold text-body"
 *
 * Yani punto sınıfı sessizce siliniyor ve eleman gövdeden miras kalan 16px
 * ile çiziliyordu. Ekranda görülen buydu: sektör çipleri, analiz şeridindeki
 * karar rozetleri, takvim künyeleri — hepsi olmaları gerekenden büyüktü ve
 * kodda doğru sınıf yazılı olduğu için sorun görünmüyordu.
 *
 * Renkler listede YOK, olmamalı: tanımadığı `text-*` adını twMerge zaten
 * renk sayıyor, yani eski davranış onlarda doğruydu.
 */
const TEXT_SIZES = [
  "micro",
  "nano",
  "tiny",
  "small",
  "base",
  "read",
  "lead",
  "title",
  "heading",
  "subdisplay",
  "display",
  "hero",
] as const;

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...TEXT_SIZES] }] } },
});

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
 * veriyordu, oysa aynı anda kotasyon 1.212 $'dı — oran %5,6 eski fiyattan
 * geliyordu. MU'da
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

/**
 * Sayı ile para simgesi arasındaki BÖLÜNMEZ boşluk (U+00A0).
 * Türkçe yazımda simge sayıdan sonra ve arada boşlukla durur; satır sonunda
 * ayrılmamalı, yoksa dolar işareti tek başına bir alt satıra düşüyor.
 */
const MONEY_GAP = "\u00A0";

/**
 * DOLAR İŞARETİNİN YERİ DİLE BAĞLI — Türkçede sayıdan SONRA (507,12 $),
 * İngilizcede ÖNCE ($507.12).
 *
 * Site iki dilde de öne yazıyordu. Yanlış olduğu, yüzde işaretinde olduğu
 * gibi, kendi ürettiğimiz sayı ile yazılan metnin yan yana düştüğü yerde
 * görüldü: bilanço analizinde ajanın yazdığı ölçü kartları "9,12 Mr $"
 * derken hemen üstündeki künye "$403 Mr" diyordu — aynı ekranda iki imla.
 * İngilizce kayıtlarda ajan da öne yazıyor ("$9.12B"), yani dile bağlı kural
 * her iki tarafta da metinle uyuşuyor.
 */
export function withCurrency(
  body: string,
  locale: string,
  /**
   * ISO para birimi kodu. Verilmezse ya da USD ise dolar simgesi kullanılır.
   *
   * DOLAR VARSAYILAMAZ. Finnhub'ın metrik ve profil uçları sayıları şirketin
   * ANA BORSASININ para biriminde veriyor; site ise hepsini `$` ile basıyordu.
   * /hisse/TSM'de başlıkta ADR fiyatı "419,55 $" dururken hemen altındaki
   * tabloda "52 Hafta En Yüksek 2.535,00 $" yazıyordu — okuyucu, fiyatı
   * 52 haftalık en düşüğünün üçte biri olan bir hisse görüyordu. Sayı yanlış
   * değildi, para birimi yanlıştı (2.535 TWD).
   *
   * Kod bilinmiyorsa simge yerine kodun kendisi yazılır; "TWD" demek "$"
   * demekten hem doğru hem de okuyucuya daha çok şey söylüyor.
   */
  code?: string | null,
): string {
  if (!code || code === "USD") {
    return locale === "tr" ? `${body}${MONEY_GAP}$` : `$${body}`;
  }
  return `${body}${MONEY_GAP}${code}`;
}

/**
 * EKSİ İŞARETİ SİMGENİN ÖNÜNDE — "−$0.19" / "−0,19 $", "$-0.19" değil.
 *
 * İşaret sayının parçası olarak biçimlendirilip başına dolar konunca ortaya
 * "$-0,19" çıkıyordu: zarar açıklayan şirketlerin hisse başı kârı analiz
 * tablosunda böyle yazılıyordu ve dolarla tire yan yana bir kısa çizgi gibi
 * okunuyor, sayının negatif olduğu bir bakışta seçilmiyordu. Sitenin yüzde
 * biçimi aynı sorunu çoktan çözmüştü (`−%0,37`); para birimi de aynı işareti
 * (U+2212) ve aynı dar boşluğu kullanıyor.
 */
export function formatPrice(
  value: number | null | undefined,
  locale: string,
  /** `currency: true` dolar demek; ISO kodu verilirse o para birimi yazılır. */
  opts: { currency?: boolean | string; digits?: number } = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { currency = false, digits = 2 } = opts;
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (!currency) return nf.format(value);
  const body = withCurrency(
    nf.format(Math.abs(value)),
    locale,
    typeof currency === "string" ? currency : null,
  );
  return value < 0 ? `−${SIGN_GAP}${body}` : body;
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

/**
 * Piyasa değeri — 3210000000 → "3,21 Mr", 1e12 → "1,00 T"
 *
 * ÜÇ ANLAMLI HANE, ondalık sayısı sabit değil. `maximumFractionDigits: 2`
 * yeterli görünüyordu ama sütun hâlinde okununca dağılıyordu: tam trilyonluk
 * bir şirket "1 T", yanındaki "1,11 T" yazıyor ve ikisi aynı ölçekte
 * olmadıkları izlenimini veriyordu. Ondalık hane artık büyüklüğe göre
 * seçiliyor — 1–9 arası iki, 10–99 arası bir, 100'den büyükte sıfır:
 *
 *   1,00 T · 4,32 T · 875 Mr · 54,3 Mr · 3,21 Mr · 612 Mn
 *
 * HER YERE İKİ ONDALIK KOYULMADI çünkü "875,00 Mr" olmayan bir kesinlik
 * iddia ediyor: sayı hisse adedi × fiyattan geliyor ve son iki hanesi
 * gün içinde zaten oynuyor. Üç anlamlı hane hem sütunu hizalı tutuyor hem
 * de sayının gerçekten taşıdığı bilgiyi yazıyor.
 */
/**
 * Kısaltılmış dolar tutarı — "$403 Mr", "−$1,20 Mr".
 *
 * SİMGE HER YERDE AYNI YERDE. Aynı büyüklük sitede iki farklı biçimde
 * yazılıyordu: piyasalar ve şirketler dizininde "$70,4 Mr", bilanço
 * analizinde ve hisse künyesinde "70,4 Mr $". Aynı şirketin piyasa değeri
 * iki ekranda iki imlayla duruyordu. Simge önde, çünkü fiyatlar da öyle
 * yazılıyor (`formatPrice` → "$507,12") ve iki biçim arasında seçim
 * yapılacaksa sayının başındaki simge sitenin geri kalanıyla uyuyor.
 *
 * Eksi işareti — para birimi kuralının aynısı — simgenin ÖNÜNDE.
 */
export function formatMoneyCompact(
  value: number | null | undefined,
  locale: string,
  /**
   * ISO para birimi kodu — verilmezse dolar. `formatPrice` ile aynı gerekçe:
   * sağlayıcının bilanço tahminleri de şirketin ana borsasının parasında
   * geliyor ve dolar sanılıyordu. /hisse/TSM'de "Gelir Beklentisi 1,47 T $"
   * yazıyordu — bir çeyrekte bir buçuk trilyon dolar; sayı TWD idi.
   */
  code?: string | null,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const body = withCurrency(
    formatCompact(Math.abs(value), locale),
    locale,
    code,
  );
  return value < 0 ? `−${SIGN_GAP}${body}` : body;
}

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
          /* "Bin", "B" DEĞİL. Kısaltma Türkçede doğru ama bu site ABD
             borsasını anlatıyor ve okuduğu her kaynakta "B" milyar demek:
             aynı takvim ekranında milyarlar "Mr" ile yazılırken bir hücrede
             "428 B $" görmek, 428 bin dolarlık geliri 428 milyar gibi
             okutuyordu. Yazılı hâli kısaltmanın bütün belirsizliğini
             kaldırıyor ve iki karakter uzun. */
          { v: 1e3, s: "Bin" },
        ]
      : [
          { v: 1e12, s: "T" },
          { v: 1e9, s: "B" },
          { v: 1e6, s: "M" },
          { v: 1e3, s: "K" },
        ];
  /** 1–9 → 2 hane, 10–99 → 1, 100+ → 0. Toplam her zaman üç anlamlı hane. */
  const digitsFor = (scaled: number) => {
    const size = Math.abs(scaled);
    if (size >= 100) return 0;
    if (size >= 10) return 1;
    return 2;
  };
  const nf = (digits: number) =>
    new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  for (let i = 0; i < units.length; i += 1) {
    if (abs < units[i]!.v) continue;
    let unit = units[i]!;
    let scaled = value / unit.v;
    /* Yuvarlama üst birime taşabilir: 999.996 Mr, sıfır ondalıkla "1.000 Mr"
       olurdu — doğrusu "1,00 T". Taşma varsa bir üst birime geçilir. */
    if (i > 0 && Math.abs(Number(scaled.toFixed(digitsFor(scaled)))) >= 1000) {
      unit = units[i - 1]!;
      scaled = value / unit.v;
    }
    return `${nf(digitsFor(scaled)).format(scaled)} ${unit.s}`;
  }
  return nf(digitsFor(value)).format(value);
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

/**
 * Kullanıcı adını tek bir biçime indirger — TÜRKÇE "İ" DAHİL.
 *
 * Düz `toLowerCase()` yetmiyor: Türkçe klavyede yazılan büyük "İ"yi JS
 * "i̇" yapıyor, yani "i" harfinin arkasına ayrı bir birleşen nokta
 * ekliyor. Sonuç iki yerde birden kırılıyordu — kayıtta `^[a-z0-9_]{3,20}$`
 * doğrulaması patlıyor ve kullanıcı "kullanıcı adı biçimi" hatası alıyor,
 * girişte ise ad eşleşmeyip "hatalı kullanıcı adı veya şifre" dönüyor.
 * Mobilde ilk harf kendiliğinden büyüdüğü için bu yol kazara değil, TİPİK
 * akış.
 *
 * `İ → I` ve `ı → i` eşlemeleri küçültmeden ÖNCE yapılıyor: sonra yapılsa
 * "İ" zaten bozulmuş oluyor. NFKC normalizasyonu ayrı yazılmış birleşen
 * noktayı da tek koda topluyor.
 */
/**
 * Sayıya göre tekil/çoğul biçim seçer.
 *
 * Dört etiket İngilizcede yalnızca çoğul yazılmıştı ve tek şirketin bilanço
 * açıkladığı gün — takvimde sık — başlık "1 companies" yazıyordu; arama tek
 * analiz döndürünce "1 analyses" çıkıyordu. Türkçe tarafta sorun yok, orada
 * sayıdan sonra çoğul eki gelmiyor: iki değer de aynı yazılıyor ve bu
 * fonksiyon hangisini seçerse seçsin sonuç değişmiyor.
 *
 * Sözlükte `eventOne`/`eventMany` çifti bu iş için zaten vardı; desen
 * yalnızca dört yere uygulanmamıştı.
 */
export function plural(count: number, one: string, many: string): string {
  return Math.abs(count) === 1 ? one : many;
}

export function normalizeUsername(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .toLowerCase()
    .trim();
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
 * büyük puntolu bir sayıyı bugünün verisi sanıyordu. Projenin "eski veriyi
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


/**
 * Ekonomik olay değeri — `economic_events.actual` / `.forecast`.
 *
 * Sütun `text` ve içinde sağlayıcının yazdığı ham dize duruyor ("2.7", "129",
 * "3.1%"). İki yer bu değeri basıyordu ve ikisi farklı davranıyordu: takvim
 * ekranı ondalık ayracını yerelleştiriyor, ana sayfadaki Gün Şeridi ise dizeyi
 * olduğu gibi yazıyordu. Aynı TÜFE rakamı bir ekranda "2,7" ötekinde "2.7"
 * görünüyordu — okuyucu için iki farklı sayı.
 *
 * BİRİM KAYITTAN GELİYOR ve YAZILIYOR. Bir dönem yalnızca "%" tanınıyordu;
 * `unit` sütunundaki öteki değer olan "bin" hiç basılmıyordu ve tarım dışı
 * istihdam ekranda çıplak "57" ya da "−23" olarak duruyordu — okuyucu 57 bin
 * kişilik bir değişimi 57 kişi sanıyordu. Veritabanında 60 kayıt "bin", 32
 * kayıt "%" taşıyor, 17'sinde birim yok; birimi olmayanda hâlâ hiçbir şey
 * uydurulmuyor.
 *
 * Yalnızca dizge baştan sona sayıysa ondalık ayracı yerelleşir; "%" işareti
 * dile göre yerleşir, öteki birimler sayının ardına yazılır. Sayı olmayan
 * her şey olduğu gibi basılır.
 */
const PLAIN_NUMBER_VALUE = /^-?\d+(\.\d+)?$/;

export function formatEventValue(
  raw: string | null | undefined,
  unit: string | null | undefined,
  locale: string,
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (!PLAIN_NUMBER_VALUE.test(trimmed)) return trimmed;

  /* SAHTE HASSASİYET KIRPILIYOR. Sağlayıcı hesaplanmış serilerde tam
     duyarlık döndürüyor ("3.46353") ve ekranda "%3,46353" çıkıyordu; oysa
     kurumun açıkladığı rakam iki hanelidir ve kalan basamaklar bizim
     hesabımızın gürültüsü. Ham veride daha az hane varsa artırılmıyor —
     yalnızca tavan konuyor. */
  const rawDigits = trimmed.includes(".") ? trimmed.split(".")[1].length : 0;
  const digits = Math.min(rawDigits, 2);
  const shown = formatPrice(Number(trimmed), locale, { digits });
  if (unit === "%") return withPercent(shown, locale);
  const birim = unit?.trim();
  if (!birim) return shown;
  /* "bin" İngilizcede "K": kaynak dizesi Türkçe yazılı ama ekranın dili
     okuyucununki. Tanımadığımız bir birim gelirse olduğu gibi geçiyor. */
  const yazi = birim === "bin" && locale !== "tr" ? "K" : birim;
  return `${shown}${MONEY_GAP}${yazi}`;
}
