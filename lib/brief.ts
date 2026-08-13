/**
 * Bülten — paylaşılan tipler.
 *
 * Burada bir dönem sunucu tarafı bülten ÜRETİMİ de vardı: ANTHROPIC_API_KEY
 * varsa Claude, yoksa kural tabanlı bir madde listesi. Günlük cron bunu her
 * gün 13:30'da iki dilde yazıyordu ve BİLEREK KALDIRILDI: mekanik özet günün
 * slotunu dolduruyor, kart 16:00'ya kadar onu "BUGÜN" rozetiyle gösteriyor
 * ve elle yazılmış dünkü bültenle eskime notu hiç görünmüyordu. Bülteni
 * yalnızca claude.ai rutini yazar (16:00 TR, POST /api/brief); o saate kadar
 * kart en son bülteni tarihini söyleyen notla gösterir.
 *
 * Arşivdeki eski kayıtlar `generated_by = "rules"` değerini taşımaya devam
 * eder; ekrandaki "Kural Tabanlı" etiketi onlar için duruyor.
 */

export type BriefPeriod = "daily" | "weekly";

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
    // Liste işareti ve kalın vurgu okunur metne dönüşmüyor, kaldırılıyor.
    return trimmed.replace(/^[-*]\s+/, "").replace(/\*\*/g, "");
  }
  return "";
}
