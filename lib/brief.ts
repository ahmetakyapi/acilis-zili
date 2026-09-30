/**
 * Bülten — paylaşılan tipler.
 *
 * Burada bir dönem sunucu tarafı bülten ÜRETİMİ de vardı: ANTHROPIC_API_KEY
 * varsa Claude, yoksa kural tabanlı bir madde listesi. Günlük cron bunu her
 * gün 13:30'da iki dilde yazıyordu ve BİLEREK KALDIRILDI: mekanik özet günün
 * slotunu dolduruyor, kart 16:00'ya kadar onu "BUGÜN" rozetiyle gösteriyor
 * ve elle yazılmış dünkü bültenle eskime notu hiç görünmüyordu. Bülteni
 * yalnızca claude.ai rutini yazar (16:10 TR, POST /api/brief); o saate kadar
 * kart en son bülteni tarihini söyleyen notla gösterir.
 *
 * Arşivdeki eski kayıtlar `generated_by = "rules"` değerini taşımaya devam
 * eder; ekrandaki "Kural Tabanlı" etiketi onlar için duruyor.
 */

export type BriefPeriod = "daily" | "weekly";

/**
 * Bir bülten sayısının KALICI adresi (dil öneksiz).
 *
 * Sayılar bir dönem yalnızca `/bulten?tarih=` ile açılıyordu ve o adresin
 * canonical'ı `/bulten`dı: arama motoru için yüzlerce sayı tek bir sayfaydı,
 * hiçbiri kendi başına dizine giremiyordu. Beslemenin bağlantıları da aynı
 * sorgulu adrese gidiyordu. Artık her sayının kendi yolu var; eski sorgulu
 * adres buraya kalıcı yönlendiriliyor.
 *
 * Haftalık ayrı bir segmentte: aynı pazartesi hem günlük hem haftalık kayıt
 * taşıyabiliyor, tarih tek başına sayıyı belirlemiyor.
 */
export function briefHref(date: string, period: BriefPeriod): string {
  return period === "weekly" ? `/bulten/haftalik/${date}` : `/bulten/${date}`;
}

/** Sayı adresindeki tarih — başka bir biçim segmentte 404 olur. */
export const BRIEF_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `## Başlık` ya da tek başına `**Başlık**` → başlık metni; değilse null.
 *
 * Hem ekrandaki bülten gövdesi (BriefBody) hem RSS beslemesi kullanıyor.
 * Beslemede öğe açıklaması gövdenin ilk dolu satırını HAM alıyordu ve
 * bültenler bölüm başlığıyla başladığı için okuyucularda "## Geçen Hafta"
 * görünüyordu; kural tek yerde durunca ikisi birbirinden ayrı düşmüyor.
 */
export function headingOf(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.startsWith("## ")) return trimmed.slice(3).trim();
  const bold = /^\*\*([^*]+)\*\*$/.exec(trimmed);
  return bold ? bold[1].trim() : null;
}

/**
 * Bültenin özet cümlesi — başlık satırları atlanır, işaretleme temizlenir.
 *
 * RSS açıklaması ve paylaşım kartı için. Markdown'ın tamamını göndermek
 * işaretlemeyi de taşımak demek ve okuyucular onu ham gösteriyor.
 */
export function briefSummary(bodyMd: string): string {
  for (const line of bodyMd.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || headingOf(trimmed)) continue;
    // Liste işareti ve kalın vurgu okunur metne dönüşmüyor, kaldırılıyor;
    // bağlantı yalnızca etiketiyle kalıyor (bülten arşivi ve RSS ham
    // "[AutoZone](/hisse/AZO)" basıyordu).
    return trimmed
      .replace(/^[-*]\s+/, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*/g, "")
      .replace(/(^|[\s("'“])\*(?=\S)([^*]+?)\*(?=$|[\s.,;:!?)"'”])/g, "$1$2");
  }
  return "";
}

/** A preview ends after a complete paragraph/list, with enough text to read.
 * Raw line counts alone treated two tiny list items like two paragraphs.
 * Keep the existing minimum-line preference, then extend to a natural boundary.
 */
export function briefPreviewCut(lines: string[], minimumLines = 4): number {
  const minimum = Math.max(1, minimumLines);
  const textLength = (line: string) => line.replace(/^\s*(?:##\s+|-\s+)/, "").replace(/\*\*/g, "").trim().length;
  let length = 0;
  for (let index = 0; index < lines.length; index++) {
    length += textLength(lines[index]);
    if (index + 1 < minimum || length < 900 || headingOf(lines[index])) continue;
    // A heading stays with its first paragraph; a contiguous list stays whole.
    if (lines[index + 1]?.trim().startsWith("- ")) continue;
    const remainder = lines.slice(index + 1);
    // A tiny tail does not earn a disclosure control of its own.
    return remainder.length <= 1 || remainder.reduce((sum, line) => sum + textLength(line), 0) < 240
      ? lines.length : index + 1;
  }
  return lines.length;
}

/** Telefon önizlemesinin hedef uzunluğu (okunur karakter). Ölçüm ve
 *  gerekçe `briefPhoneCut` üstünde.
 *  400 → 600 (30 Eylül, sahibinin isteği: "mobilde bir tık büyümeli").
 *  400'de önizleme giriş + iki notta kesiliyordu ve kart günün özeti için
 *  kısa kalıyordu; 600 tipik bültende bir not daha açıyor. Masaüstü
 *  kesmesini (en az 900) hâlâ geçmiyor, telefon kesmesi anlamını koruyor. */
export const BRIEF_PHONE_PREVIEW_CHARS = 600;

/**
 * Telefonun ikinci kesme noktası (28 Eylül). Masaüstü önizlemesi en az 900
 * karakter okutuyor (`briefPreviewCut`); telefonun 310 piksellik
 * sütununda bu, 390'da 1.058, 360'ta 1.080 piksellik bir kart demekti ve
 * sayfanın en uzun bloğuydu. Telefonda önizleme giriş paragrafı ve onu
 * izleyen ilk not kadar: günün ana mesajı (başlık ve giriş) her zaman
 * açıkta, gerisi aynı "Tümünü Gör" katlamasının içinde.
 *
 * KESME HER ZAMAN SATIR SINIRINDA: bültende her satır tam bir paragraf ya
 * da madde, yani yarım cümle kalmıyor. Üç ek kural:
 *   - Giriş paragrafı (başlık olmayan ilk satır) ve bir satır daha kalır.
 *   - Başlık ilk paragrafından, ":" ile biten giriş ibaresi ardındaki
 *     listeden ve tablo satırları birbirinden ayrılmaz.
 *   - Maddeler ARASINDA kesilebilir (her madde bütün kalır); telefonda
 *     listenin tamamını açıkta tutmak kesmeyi anlamsızlaştırırdı.
 * Sonuç masaüstü kesmesinden erken değilse `desktopCut` döner: telefon
 * masaüstünden UZUN bir önizleme göstermez, kesme de eklenmez.
 */
export function briefPhoneCut(lines: string[], desktopCut: number, budget = BRIEF_PHONE_PREVIEW_CHARS): number {
  const textLength = (line: string) => line.replace(/^\s*(?:##\s+|-\s+)/, "").replace(/\*\*/g, "").trim().length;
  const isTable = (line: string | undefined) => Boolean(line?.trim().startsWith("|"));
  const lede = lines.findIndex((line) => !headingOf(line) && !line.trim().startsWith("- ") && !isTable(line));
  if (lede < 0) return desktopCut;
  let length = 0;
  for (let index = 0; index < Math.min(desktopCut, lines.length); index++) {
    length += textLength(lines[index]);
    if (index < lede + 1 || length < budget) continue;
    const line = lines[index].trim();
    if (headingOf(line)) continue;
    if (line.endsWith(":")) continue;
    if (isTable(line) && isTable(lines[index + 1])) continue;
    return Math.min(index + 1, desktopCut);
  }
  return desktopCut;
}
