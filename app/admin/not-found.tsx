import { ButtonLink, Panel } from "@/components/ui/primitives";

/**
 * Panelin İÇİNDE bulunamayan kayıt.
 *
 * Bir editörde olmayan bir yazı açıldığında (`notFound()`) sitenin genel
 * 404 kartı çıkıyordu: sekmeler kayboluyor, kısayollar okura yönelik
 * (Bugün, Piyasalar…) ve başlık "Yazıyı Düzenle" olarak kalıyordu. Bu sınır
 * layout'un ALTINDA: sekmeler ve kimlik satırı yerinde, çıkış panelin
 * kendisine. Yetkisiz ziyaretçi yine sitenin 404'ünü görüyor, çünkü
 * layout'un kendi `notFound()`u bu sınırın ÜSTÜNDE çözülüyor.
 */
export default function AdminNotFound() {
  return (
    <Panel className="flex flex-col items-start gap-3 p-6 sm:p-7">
      <h1 className="text-title font-bold tracking-[-0.025em] text-strong">Kayıt Bulunamadı</h1>
      <p className="max-w-[60ch] text-base leading-relaxed text-body">
        Bu adreste bir kayıt yok. Yazı silinmiş, adresi değişmiş ya da istenen
        dilde henüz hiç yazılmamış olabilir.
      </p>
      <div className="mt-1 flex flex-wrap gap-2.5">
        <ButtonLink href="/admin/yazilar">Yazılara Dön</ButtonLink>
        <ButtonLink href="/admin" variant="ghost">Özete Dön</ButtonLink>
      </div>
    </Panel>
  );
}
