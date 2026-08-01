import { Skeleton } from "@/components/ui/primitives";

/**
 * Gezinme iskeleti — tüm (app) rotalarını kapsar.
 *
 * Bu dosya olmadan Next.js, yeni sayfanın sunucu bileşenleri bitene kadar
 * eski ekranda bekliyordu: tıklama ile ilk boyama arasında hiçbir geri
 * bildirim yoktu ve gezinme "yavaş" hissettiriyordu. Bir yükleme sınırı
 * olduğunda `<Link>` ön yüklemesi de bu sınıra kadar çalışıyor, yani
 * tıklamanın karşılığı anında geliyor.
 *
 * Şekil kasten genel: sayfa başlığı, birkaç kart ve bir tablo/pano. Rotaya
 * özel iskelet yapmak yerine sakin bir yer tutucu tercih edildi — hızlı
 * çözülen sayfalarda göz alışkanlığını bozmuyor.
 */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-9 w-52 max-w-[70%] rounded-xl" />
        <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>

      <Skeleton className="h-[420px] w-full rounded-2xl" />
    </div>
  );
}
