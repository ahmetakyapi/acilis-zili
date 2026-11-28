/**
 * Yönetim trafiğinin saf hesapları — veritabanına dokunmaz, testi
 * `tests/admin-traffic.test.ts`. Sorgular `lib/admin-data.ts`te.
 *
 * TEK TARAMA, ÇOK PENCERE (28 Kasım). Özet ve Trafik ekranları aynı tablo
 * için ayrı ayrı `count(*)` + `count(distinct visitor_hash)` sorguları
 * atıyordu: Özet'te iki yedi günlük pencere ve otuz günlük seri, Trafik'te
 * dört pencere (güncel, önceki, dün, bir hafta önce) ve seri. 26 Kasım'dan
 * beri bot trafiği tabloyu günde ~44.000 satır büyütüyor (önce ~400) ve her
 * sorgu kendi aralığını yeniden tarıyordu; 90 günlük Trafik ekranı aynı
 * satırları beş kez okuyordu. Artık tek gün gün sayım iniyor
 * (`getTrafficDays`) ve pencerelerin toplamı buradan.
 *
 * ZİYARETÇİ-GÜNÜ GÜNLERİN TOPLAMIDIR, YAKLAŞIM DEĞİL. `visitorHash` girdi
 * olarak ET gününü alıyor (lib/analytics.ts → `visitorHash`): aynı kişinin
 * iki ayrı gündeki özeti farklı, yani bir penceredeki
 * `count(distinct visitor_hash)` birebir günlük tekillerin toplamı (64
 * bitlik özette günler arası çakışma ihmal edilebilir).
 */

/** Bir ET gününün sayımı. */
export type DayCount = {
  /** "YYYY-MM-DD" ET */
  day: string;
  views: number;
  /** O günün tekil ziyaretçisi (özet her gün döner). */
  visitors: number;
};

/**
 * GERÇEK TEKİL KİŞİ SAYISI ÜRETİLEMEZ ve bu bilinçli bir tasarım sonucu:
 * `visitorHash` her gün döner (lib/schema.ts), yani iki günün kaydı
 * birbirine bağlanamaz — gizliliğin bedeli tam olarak bu. Dolayısıyla çok
 * günlük pencerede sayılan şey KİŞİ değil ZİYARETÇİ-GÜNÜ: her gün gelen on
 * sadık okuyucu doksan günlük pencerede 900 satır üretir.
 *
 * Alan adı bunu söylüyor; ekran etiketleri de öyle (lib/admin-format.ts →
 * `METRIC`). Ölçüyü düzeltmek mümkün değilken adını düzeltmemek, sayının
 * yalan söylemesi demekti.
 */
export type TrafficTotals = {
  views: number;
  /** Ziyaretçi-günü — aynı kişi her gün yeniden sayılır. */
  visitorDays: number;
};

/**
 * `from`–`to` (iki uç dahil, ET günü) penceresinin toplamı. Kaydı olmayan
 * gün sıfır katkı verir; pencere dizinin dışına taşarsa taşan kısım sıfır —
 * kapsamı çağıran söyler (önceki dönem eksik ölçüldüyse kıyas zaten
 * `deltaOf`ta düşüyor).
 */
export function sumDays(rows: readonly DayCount[], from: string, to: string): TrafficTotals {
  let views = 0;
  let visitorDays = 0;
  for (const row of rows) {
    if (row.day < from || row.day > to) continue;
    views += row.views;
    visitorDays += row.visitors;
  }
  return { views, visitorDays };
}

/**
 * Önbellekli tam günler ile canlı bugünü tek diziye dizer — gün sırasıyla,
 * aynı gün iki kaynakta varsa canlı olan kazanır (gece yarısı dönümünde
 * önbellek bir gün geriden gelebilir).
 */
export function mergeDays(cached: readonly DayCount[], live: readonly DayCount[]): DayCount[] {
  const byDay = new Map<string, DayCount>();
  for (const row of cached) byDay.set(row.day, row);
  for (const row of live) byDay.set(row.day, row);
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
