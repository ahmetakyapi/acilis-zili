import Link from "next/link";
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

  return (
    /* Çıkış yolu: dizin. Ekran `action` almadığı için tek bir bağlantı bile
       taşımıyordu — okuyucu ortalanmış iki cümleyle baş başa kalıyordu. */
    <EmptyState
      titleAs="h1"
      title={t.stock.notFound}
      hint={t.stock.notFoundHint}
      action={
        <Link
          href="/sirketler"
          className="text-sm font-semibold text-primary hover:underline"
        >
          {t.nav.companies}
        </Link>
      }
    />
  );
}
