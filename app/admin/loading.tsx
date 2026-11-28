"use client";

import { usePathname } from "next/navigation";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { AdminPanelSkeleton, StatGridSkeleton } from "@/components/admin/AdminUI";
import { TrafficChartSkeleton } from "@/components/admin/TrafficChart";
import { ADMIN_SECTIONS, ADMIN_TAB_ORDER } from "@/lib/admin-sections";

/**
 * Yönetim bölümlerinin anlık bekleme hâli (28 Kasım).
 *
 * NEDEN VAR. Sahibinin sözü: "yönetim kısmı çok geç dönüyor", "hatta böyle
 * kalıyor" — sekmeye basınca ortada "Açılış Zili · Yükleniyor" kartı
 * duruyor, eski sayfa sönük kalıyordu. Segmentte `loading.tsx` yoktu ve
 * App Router o zaman gezinmeyi sayfanın KABUĞU sunucuda bitene dek
 * bekletiyor; adres değişmiyor, `RouteProgress` adres değişince söndüğü
 * için kart da kalıyor (420 ms'den sonra açılır, 30 sn'lik frene kadar).
 * Sayfaların panelleri zaten ayrı `<Suspense>` adalarında ama ada ancak
 * kabuk inince görünüyordu; kabuğun önünde `requireAdmin()` sorgusu ve
 * yanıtın ilk parçası vardı. Bu dosya Next'in ÖN YÜKLEDİĞİ bekleme
 * sınırı: sekme bağlantısı görünürken indirilir, tıklamada adres o anda
 * değişir, kart hiç açılmaz (`SLOW_AFTER` dolmadan söner) ve yerinde
 * bölümün kendi başlığı + iskeleti durur. Paneller geldikçe iskeletin
 * yerine kendi adalarından iner.
 *
 * İSTEMCİ BİLEŞENİ, ÇÜNKÜ BAŞLIK GERÇEK. Bekleme hâli bütün bölümler için
 * tek dosya; hangi bölüme gidildiğini yalnız adres söylüyor. Başlık ve tek
 * cümle `ADMIN_SECTIONS`tan, sayfanın kendi `PageHeader`ıyla aynı — sayfa
 * inince başlık kıpırdamıyor, yalnız iskeletler dolu panellere dönüyor.
 * Gövde Özet ve Trafik'te o sayfanın KENDİ yer tutucularının dizeleri
 * (ölçüldü, aşağıda); ötekilerde tek nötr panel.
 *
 * 404 DURUMU KORUNUYOR. `(app)` segmenti `loading.tsx`i bilinçli kaldırdı:
 * bekleme sınırı yanıtı erken başlatıp `notFound()`u 200 ile döndürüyordu
 * (soft 404, arama motoru zararı). Burada iki fark var: (1) yetkisizi 404'e
 * düşüren kapı LAYOUT'ta (`getAdmin`) ve layout bu sınırın DIŞINDA — yanıt
 * kapıdan önce başlamıyor, yetkisiz istek yine gerçek 404 alıyor; (2) panel
 * `robots: noindex` ve dizine girmiyor, sayfa içi `notFound()` (silinmiş
 * moderasyon kaydı) 200 + `noindex` ile dönse de tarama zararı yok.
 */

/** Adresin bölümü — tam eşleşme; editör gibi alt sayfalar `null`. */
function sectionOf(pathname: string) {
  for (const key of ADMIN_TAB_ORDER) {
    if (ADMIN_SECTIONS[key].href === pathname) return key;
  }
  return null;
}

export default function AdminLoading() {
  const pathname = usePathname();
  const key = sectionOf(pathname);

  /* Alt sayfa (yazı editörü, moderasyon kaydı): başlığı sayfanın kendisi
     belirliyor, tahmin edilmiyor — yalnız nötr panel. */
  if (!key) {
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <AdminPanelSkeleton rows={6} />
      </div>
    );
  }

  const section = ADMIN_SECTIONS[key];

  if (key === "overview") {
    /* app/admin/page.tsx'in yer tutucularıyla aynı dizeler: kutular
       (çizgili ilk iki kutu), not satırı, Dikkat (2 satır + şerit). */
    return (
      <div className="flex flex-col gap-6" aria-busy>
        <PageHeader title={section.title} subtitle={section.subtitle} />
        <div className="flex flex-col gap-3">
          <StatGridSkeleton boxes={4} visual={[0, 1]} />
          <div className="flex h-[2lh] items-center text-small leading-relaxed">
            <Skeleton className="h-2.5 w-96 max-w-full" />
          </div>
        </div>
        <AdminPanelSkeleton rows={2} rowHeight={59} pulse />
      </div>
    );
  }

  if (key === "traffic") {
    /* app/admin/trafik/page.tsx'in yer tutucuları: kutular (dördüncünün
       künyesi telefonda iki satır) ve grafik paneli. Başlığın sağındaki
       aralık denetimi henüz yok; yeri rayın boyunda bir çubukla tutuluyor. */
    return (
      <div className="flex flex-col gap-5" aria-busy>
        <PageHeader
          title={section.title}
          subtitle={section.subtitle}
          action={<Skeleton className="h-11 w-[300px] max-w-full rounded-full sm:h-[38px]" />}
        />
        <StatGridSkeleton wrapOnPhone={[3]} />
        <div className="panel min-w-0 p-5 sm:p-6" aria-hidden>
          <div className="mb-5 grid gap-y-1.5">
            <div className="box-content flex h-[1lh] items-center pb-[0.06em] text-lead font-bold">
              <Skeleton className="h-[0.7em] w-40" />
            </div>
            <div className="flex h-[1lh] items-center text-small leading-relaxed">
              <Skeleton className="h-2.5 w-72 max-w-full" />
            </div>
          </div>
          <TrafficChartSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" aria-busy>
      <PageHeader title={section.title} subtitle={section.subtitle} />
      <AdminPanelSkeleton rows={6} />
    </div>
  );
}
