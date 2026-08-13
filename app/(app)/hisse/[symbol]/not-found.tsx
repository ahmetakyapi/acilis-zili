import { EmptyState } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";

/**
 * Geçersiz sembol — gerçek 404. Gerekçe: `haberler/[id]/not-found.tsx`.
 *
 * YALNIZCA geçersiz sembol buraya düşer. Sağlayıcı kotası dolduğunda
 * gösterilen "şimdi bakılamıyor" ekranı sayfanın kendisinde kalır ve 200
 * döner: o adres GEÇERLİ, sadece o an veri yok. 404 dönseydi kotanın dolu
 * olduğu bir gün gerçek hisse sayfaları dizinden düşerdi.
 */
export default async function StockNotFound() {
  const { t } = await getI18n();

  return <EmptyState title={t.stock.notFound} hint={t.stock.notFoundHint} />;
}
