import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";

/**
 * Olmayan haber — 200 DEĞİL, 404.
 *
 * Sayfa eskiden "haber bulunamadı" kutusunu döndürüp bitiyordu; HTTP durumu
 * 200 kalıyordu. Arama motorları için bu bir "yumuşak 404": adres geçerli
 * sayılıp dizine giriyor, sonra içeriksiz olduğu için sitenin geneline
 * güvensizlik olarak yazılıyor. Haber satırları 90 günde bir budandığı için
 * (cron) bu adresler düzenli olarak ölüyor — yani nadir bir durum değil.
 *
 * Metin sayfaya özgü kaldı: genel 404 "sayfa bulunamadı" der, oysa burada
 * bilinen bir şey var — haber kaldırılmış olabilir, liste hâlâ duruyor.
 */
export default async function NewsNotFound() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto max-w-2xl">
      <EmptyState
        title={t.news.notFound}
        hint={t.news.notFoundHint}
        action={
          <Link href="/haberler" className="text-sm text-primary hover:underline">
            {t.common.back}
          </Link>
        }
      />
    </div>
  );
}
