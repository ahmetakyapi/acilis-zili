/**
 * İçeriden işlemlerdeki KİŞİ — adın okunuşu ve görevi (28 Eylül).
 *
 * Tablo yalnızca Finnhub'ın verdiği adı basıyordu ("MEHROTRA SANJAY",
 * "Dugle Lynn A") ve okuyucu satırdaki kişinin CEO mu, bağımsız bir yönetim
 * kurulu üyesi mi olduğunu bilemiyordu. Oysa bir CEO'nun satışı ile bir
 * kurul üyesinin satışı aynı şeyi anlatmıyor.
 *
 * GÖREV NEREDEN: Finnhub'ın `/stock/insider-transactions` ucu görev alanı
 * TAŞIMIYOR (28 Eylül, ham yanıt incelendi: name, share, change, tarihler,
 * kod, fiyat, id, isDerivative, currency, source — o kadar). Ama satırın
 * `id`'si Form 4'ün dosya numarası ve SEC'in kendi dosyası kişinin
 * `reportingOwnerRelationship` bloğunu taşıyor: isDirector, isOfficer,
 * isTenPercentOwner, isOther, officerTitle, otherText. Görev oradan okunuyor
 * (lib/providers/sec-form4.ts); bu dosya yalnızca saf hesaplar ve testli.
 *
 * UYDURMA YOK: dosya okunamazsa ya da kişi dosyada bulunamazsa satır yalnızca
 * isimle kalır. Unvan sözlükte yoksa OLDUĞU GİBİ yazılır, tahmin edilmez.
 */

export type OwnerRelationship = {
  /** Dosyadaki ad (`rptOwnerName`). */
  name: string;
  director: boolean;
  officer: boolean;
  tenPercent: boolean;
  other: boolean;
  officerTitle: string | null;
  otherText: string | null;
};

/* --------------------------------------------------------------------------
   Form 4 ayrıştırma
   -------------------------------------------------------------------------- */

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i").exec(block);
  if (!match) return null;
  const value = decodeXml(match[1]!);
  return value === "" ? null : value;
}

/** "1" ya da "true" — Form 4 şeması ikisine de izin veriyor. */
function flag(block: string, name: string): boolean {
  const value = tag(block, name)?.toLowerCase();
  return value === "1" || value === "true";
}

/**
 * Form 4'ün bildirim sahipleri. Ortak dosyalamada (bir fon ve yöneticisi)
 * birden fazla `reportingOwner` bloğu var; hepsi dönüyor, eşleme adla.
 */
export function parseForm4Owners(xml: string): OwnerRelationship[] {
  const out: OwnerRelationship[] = [];
  for (const match of xml.matchAll(/<reportingOwner>([\s\S]*?)<\/reportingOwner>/gi)) {
    const block = match[1]!;
    const name = tag(block, "rptOwnerName");
    if (!name) continue;
    out.push({
      name,
      director: flag(block, "isDirector"),
      officer: flag(block, "isOfficer"),
      tenPercent: flag(block, "isTenPercentOwner"),
      other: flag(block, "isOther"),
      officerTitle: tag(block, "officerTitle"),
      otherText: tag(block, "otherText"),
    });
  }
  return out;
}

/** Ad karşılaştırma anahtarı — büyük/küçük harf ve noktalama farkı sayılmaz. */
export function ownerKey(name: string): string {
  return name
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Satırın kişisini dosyanın sahipleri arasında bulur. Adla eşleşme yoksa ve
 * dosyada TEK sahip varsa o kişidir (dosya numarası zaten o satırın dosyası);
 * birden fazla sahip varken tahmin edilmez.
 */
export function matchOwner(name: string, owners: readonly OwnerRelationship[]): OwnerRelationship | null {
  const key = ownerKey(name);
  return owners.find((owner) => ownerKey(owner.name) === key) ?? (owners.length === 1 ? owners[0]! : null);
}

/* --------------------------------------------------------------------------
   Görev satırı
   -------------------------------------------------------------------------- */

export type InsiderRoleLabels = {
  director: string;
  tenPercent: string;
  /** Görevli ama unvanı yazılmamış (`isOfficer` var, `officerTitle` yok). */
  officer: string;
};

/**
 * Unvanın PARÇALARININ Türkçesi. Unvanlar serbest metin ("EVP, General
 * Counsel and Sec", "President & CEO") ve sonsuz çeşitte; tam unvan eşlemesi
 * yerine parçalara bölünüp her parça sözlükte aranıyor. Parçalardan BİRİ bile
 * bilinmiyorsa unvan olduğu gibi (İngilizce) yazılır: yarısı çevrilmiş bir
 * unvan, çevrilmemişinden kötü okunur. Anahtarlar küçük harf, noktasız.
 */
const TR_TITLE_PARTS: Readonly<Record<string, string>> = {
  ceo: "CEO",
  "chief executive officer": "CEO",
  cfo: "Finans Direktörü (CFO)",
  "chief financial officer": "Finans Direktörü (CFO)",
  coo: "Operasyon Direktörü (COO)",
  "chief operating officer": "Operasyon Direktörü (COO)",
  cto: "Teknoloji Direktörü (CTO)",
  "chief technology officer": "Teknoloji Direktörü (CTO)",
  cao: "Muhasebe Direktörü (CAO)",
  "chief accounting officer": "Muhasebe Direktörü (CAO)",
  "principal accounting officer": "Muhasebeden Sorumlu Yönetici",
  "principal financial officer": "Mali İşlerden Sorumlu Yönetici",
  cio: "Bilgi Teknolojileri Direktörü (CIO)",
  "chief information officer": "Bilgi Teknolojileri Direktörü (CIO)",
  cmo: "Pazarlama Direktörü (CMO)",
  "chief marketing officer": "Pazarlama Direktörü (CMO)",
  cbo: "İş Geliştirme Direktörü (CBO)",
  "chief business officer": "İş Geliştirme Direktörü (CBO)",
  cro: "Gelir Direktörü (CRO)",
  "chief revenue officer": "Gelir Direktörü (CRO)",
  cpo: "Ürün Direktörü (CPO)",
  "chief product officer": "Ürün Direktörü (CPO)",
  clo: "Hukuk Direktörü (CLO)",
  "chief legal officer": "Hukuk Direktörü (CLO)",
  chro: "İnsan Kaynakları Direktörü",
  "chief human resources officer": "İnsan Kaynakları Direktörü",
  "chief people officer": "İnsan Kaynakları Direktörü",
  "chief commercial officer": "Ticari Direktör",
  "chief strategy officer": "Strateji Direktörü",
  "chief administrative officer": "İdari İşler Direktörü",
  "general counsel": "Baş Hukuk Müşaviri",
  secretary: "Şirket Sekreteri",
  "corporate secretary": "Şirket Sekreteri",
  sec: "Şirket Sekreteri",
  treasurer: "Hazine Sorumlusu",
  controller: "Mali Kontrolör",
  "corporate controller": "Mali Kontrolör",
  president: "Başkan",
  chairman: "Yönetim Kurulu Başkanı",
  chair: "Yönetim Kurulu Başkanı",
  chairwoman: "Yönetim Kurulu Başkanı",
  chairperson: "Yönetim Kurulu Başkanı",
  "chairman of the board": "Yönetim Kurulu Başkanı",
  "chair of the board": "Yönetim Kurulu Başkanı",
  "executive chairman": "İcracı Yönetim Kurulu Başkanı",
  "executive chair": "İcracı Yönetim Kurulu Başkanı",
  "vice chairman": "Yönetim Kurulu Başkan Vekili",
  "vice chair": "Yönetim Kurulu Başkan Vekili",
  director: "Yönetim Kurulu Üyesi",
  "independent director": "Bağımsız Yönetim Kurulu Üyesi",
  "lead independent director": "Kıdemli Bağımsız Yönetim Kurulu Üyesi",
  evp: "İcra Başkan Yardımcısı",
  "exec vp": "İcra Başkan Yardımcısı",
  "executive vp": "İcra Başkan Yardımcısı",
  "executive vice president": "İcra Başkan Yardımcısı",
  svp: "Kıdemli Başkan Yardımcısı",
  "sr vp": "Kıdemli Başkan Yardımcısı",
  "senior vp": "Kıdemli Başkan Yardımcısı",
  "sr vice president": "Kıdemli Başkan Yardımcısı",
  "senior vice president": "Kıdemli Başkan Yardımcısı",
  cvp: "Kurumsal Başkan Yardımcısı",
  "corporate vp": "Kurumsal Başkan Yardımcısı",
  "corporate vice president": "Kurumsal Başkan Yardımcısı",
  vp: "Başkan Yardımcısı",
  "vice president": "Başkan Yardımcısı",
  founder: "Kurucu",
  "co-founder": "Kurucu Ortak",
  cofounder: "Kurucu Ortak",
  "10% owner": "%10 Hissedar",
  officer: "Üst Yönetici",
};

/**
 * Unvan yerine "açıklamalara bakın" yazan dosyalar var; o bir unvan değil.
 * Öyle bir kayıtta görev yalnızca `isOfficer` bayrağından okunur.
 */
const NON_TITLES = new Set(["see remarks", "see remarks below", "see remark", "see explanation of responses"]);

function titleKey(part: string): string {
  return part.toLocaleLowerCase("en-US").replace(/\./g, "").replace(/\s+/g, " ").trim();
}

/** Unvan metni gerçekten bir unvan mı ("See Remarks" değil). */
export function usableTitle(title: string | null): string | null {
  if (!title) return null;
  const clean = title.replace(/\s+/g, " ").trim();
  return clean === "" || NON_TITLES.has(titleKey(clean)) ? null : clean;
}

/**
 * Unvanın dile göre yazımı. İngilizcede olduğu gibi; Türkçede parçalar
 * sözlükteyse çevrilir, değilse olduğu gibi. Ayraçlar: virgül kalır,
 * "and", "&" ve "/" → "ve".
 */
export function translateTitle(title: string, locale: "tr" | "en"): string {
  if (locale === "en") return title;
  const pieces = title.split(/(\s*,\s*|\s*&\s*|\s*\/\s*|\s+and\s+)/i);
  const out: string[] = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const piece = pieces[i]!;
    if (i % 2 === 1) {
      out.push(piece.includes(",") ? ", " : " ve ");
      continue;
    }
    const translated = TR_TITLE_PARTS[titleKey(piece)];
    if (translated === undefined) return title;
    out.push(translated);
  }
  return out.join("");
}

/** Unvan zaten kurul görevini söylüyorsa "Yönetim Kurulu Üyesi" tekrarlanmaz. */
function titleCoversBoard(title: string): boolean {
  return /\b(director|chair\w*|board)\b/i.test(title);
}

/**
 * İsmin altındaki görev satırı; hiçbir bayrak yoksa null. Parçalar " · "
 * ile: "CEO ve Yönetim Kurulu Başkanı", "Yönetim Kurulu Üyesi · %10 Hissedar".
 */
export function roleLine(owner: OwnerRelationship, locale: "tr" | "en", labels: InsiderRoleLabels): string | null {
  const parts: string[] = [];
  const title = usableTitle(owner.officerTitle);
  if (title) parts.push(translateTitle(title, locale));
  else if (owner.officer) parts.push(labels.officer);
  if (owner.director && !(title && titleCoversBoard(title))) parts.push(labels.director);
  if (owner.tenPercent && !(title && /10\s*%/.test(title))) parts.push(labels.tenPercent);
  const other = owner.other ? usableTitle(owner.otherText) : null;
  if (other) parts.push(translateTitle(other, locale));
  return parts.length > 0 ? [...new Set(parts)].join(" · ") : null;
}

/* --------------------------------------------------------------------------
   Adın okunuşu
   -------------------------------------------------------------------------- */

/** Tüzel kişi işaretleri — bunlarda sıra değiştirilmez. */
const ENTITY_WORDS =
  /\b(inc|llc|llp|lp|l p|ltd|limited|corp|corporation|co|company|fund|funds|trust|holdings?|partners|partnership|capital|group|management|advisors?|investments?|bank|foundation|plc|nv|sa|ag|gmbh|lllp)\b/i;

/** Tamamen büyük harfle kalması gerekenler ("LLC", "III"). */
const KEEP_UPPER = new Set(["llc", "llp", "lp", "lllp", "plc", "nv", "sa", "ag", "ii", "iii", "iv", "vi", "usa", "us"]);

/** Soyadı öneki ya da unvan eki — varsa sıra güvenle çözülemez. */
const ORDER_BLOCKERS = new Set([
  "van", "von", "der", "den", "de", "del", "della", "di", "da", "du", "dos", "das", "la", "le", "st", "saint", "bin", "al", "el", "ter", "ten",
  "jr", "sr", "ii", "iii", "iv", "md", "phd", "esq",
]);

function fixCase(word: string): string {
  const lower = word.toLocaleLowerCase("en-US");
  if (KEEP_UPPER.has(lower.replace(/\./g, ""))) return word.toLocaleUpperCase("en-US");
  /* Harf, tire ve kesme işaretinden sonra büyür: "O'BRIEN" → "O'Brien",
     "SMITH-JONES" → "Smith-Jones". "MCDONALD" → "Mcdonald" olur; ikinci
     büyük harfi bilmenin yolu yok, sözlükle tahmin edilmiyor. */
  return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("en-US"));
}

/**
 * SEC adını okunur hâle getirir.
 *
 * HARF DÜZENİ: tamamen büyük harfli ad ("MEHROTRA SANJAY") kelime kelime
 * düzeltilir, İngilizce kurallarla (`en-US`; Türkçe `i → İ` tuzağı burada
 * yok çünkü bunlar İngilizce adlar). Küçük harf içeren ad sahibinin yazdığı
 * gibi kalır ("McDonald" bozulmasın).
 *
 * SIRA — KARAR: EDGAR'ın kişi adı "SOYAD AD GÖBEK" düzeninde (Form 4'ün
 * birinci kutusu "(Last) (First) (Middle)" diye soruyor ve `rptOwnerName`
 * EDGAR'daki bu uyumlu addan geliyor). Ama çok kelimeli soyadlarını
 * ("Van Der Berg Jan", "Garcia Lopez Maria") ayırmanın güvenli bir yolu yok.
 * Bu yüzden sıra YALNIZCA iki kalıpta çevriliyor:
 *   - iki kelime: "Mehrotra Sanjay" → "Sanjay Mehrotra"
 *   - üç kelime ve sonuncusu tek harf (göbek adının baş harfi):
 *     "Allen Scott R." → "Scott R. Allen", "Dugle Lynn A" → "Lynn A Dugle"
 * ve yalnızca adda tüzel kişi işareti, soyadı öneki (van, de, al…) ya da
 * ek (Jr, III) yoksa. Virgüllü "Soyad, Ad" açıkça sıralı olduğu için çevrilir.
 * Geri kalan her şey (üç tam kelime, dört kelime) yalnızca harf düzeniyle
 * düzeltilir, sırası bozulmaz: yanlış çevrilmiş bir ad, çevrilmemişinden
 * daha yanıltıcı. Özgün ad hücrenin `title`ında kalıyor.
 */
export function displayInsiderName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name === "") return raw;
  const allUpper = /\p{Lu}/u.test(name) && !/\p{Ll}/u.test(name);
  const cased = allUpper ? name.split(" ").map(fixCase).join(" ") : name;
  if (ENTITY_WORDS.test(cased)) return cased;

  const comma = /^([^,]+),\s*([^,]+)$/.exec(cased);
  if (comma) {
    const [, last, first] = comma;
    return /\b(jr|sr|ii|iii|iv)\b\.?$/i.test(first!) ? cased : `${first} ${last}`;
  }

  const words = cased.split(" ");
  if (words.some((word) => ORDER_BLOCKERS.has(word.toLocaleLowerCase("en-US").replace(/[.,]/g, "")))) return cased;
  if (words.length === 2) return `${words[1]} ${words[0]}`;
  if (words.length === 3 && /^\p{L}\.?$/u.test(words[2]!)) return `${words[1]} ${words[2]} ${words[0]}`;
  return cased;
}
