/**
 * Bilanço detayının panelleri arasında paylaşılan iki parça.
 *
 * Sayfa panel bileşenlerine bölünene kadar (`components/earnings/report/`)
 * bunlar sayfa dosyasının başındaydı; kapak, ölçü rayı, görüş şeridi ve
 * CEO şeridi aynı etiket sınıfını okuyor.
 */

/**
 * Küçük etiket (büyük harfe ÇEVRİLMEZ, 24 Eylül; `.plate` ile aynı gerekçe) — `.plate`'in rengi serbest bırakılmış hâli.
 *
 * Bu sabit, `.plate` KATMANSIZ yazıldığı dönemden kalma: o zaman yanına
 * yazılan `text-primary` hiç uygulanmıyordu, çünkü katmansız bir kural
 * `@layer utilities` içindeki yardımcıyı her zaman eziyor. Tuzağın kanonik
 * anlatımı `app/globals.css` → "KATMAN — @layer components" bloğunda ve
 * sorun ORADA çözüldü: `.plate` artık katmanlı, yani renk yardımcısı
 * geçiyor. Sabit yine de duruyor çünkü punto da farklı (`text-nano`
 * ile `.plate`in 0.6875rem'i aynı şey değil); çağrı yerleri üstüne kendi
 * puntosunu yazıyor. Sadeleştirmek isteyen önce o farkı ölçsün.
 */
export const PLATE_LABEL =
  "text-nano font-bold leading-none tracking-[0.02em]";

/** Hedefe uzaklık ve hangi fiyattan ölçüldüğü. */
export type Upside = { pct: number; basis: "today" | "report" };
