import Link from "next/link";
import { Suspense } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { AdminPanel, AdminPanelTitle } from "@/components/admin/AdminUI";
import { YazilarTabs } from "@/components/admin/YazilarTabs";
import { Skeleton } from "@/components/ui/primitives";
import {
  getAdminEditedKeys,
  getEditableStories,
  getWritingCounts,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { agoLabel } from "@/lib/admin-format";

/**
 * Yazılar → Mercek yazıları.
 *
 * İÇERİK EKRANINDAN AYRILDI ve ayrımın adı şu: İçerik ÖLÇER, Yazılar
 * DEĞİŞTİRİR. İkisi bir dönem tek sayfadaydı ve o sayfa aynı anda hem bir
 * sağlık panosu (kaç yazı var, hangisinin çevirisi eksik, bülten kaç gündür
 * yazılmamış) hem de bir editör girişiydi; iki farklı iş için açılan tek
 * ekran, ikisinde de uzun ve dağınık kalıyordu. Buraya gelen "bir metni
 * düzeltmeye" geliyor.
 *
 * İKİ TÜR ARTIK İKİ SEKME. Mercek listesi burada, bülten listesi
 * `/admin/yazilar/bulten`te. Tek sayfada alt alta duruyorlardı ve mercek
 * listesi kırk satır olduğu için bültenlere ulaşmak sayfanın dibine kadar
 * kaydırmak demekti — bültene bakmaya gelen kişi her seferinde ilgilenmediği
 * kırk satırı geçiyordu. Sekme çubuğu paylaşılan bir layout'ta DEĞİL, iki
 * liste sayfasının her biri kendi basıyor: editörler aynı segmentin altında
 * ve orada sekme istenmiyor (bilançolar ekranındaki kuralın aynısı).
 *
 * İKİ TÜR, İKİ EDİTÖR. Mercek yazısı `:::` bloklarıyla yazılıyor ve
 * `ArticleBody` ile çiziliyor; bülten `BriefBody`nin mini biçimlendiricisini
 * kullanıyor (## başlık, - madde, **kalın**). Aynı editöre sokmak, birinde
 * çalışan sözdiziminin ötekinde sessizce düz metne dönmesi demekti.
 *
 * BİLANÇO ANALİZİ BURADA YOK, bilerek: analiz serbest metin değil, on beş
 * alanlı yapılandırılmış bir kayıt (çeyreklik gelir dizisi, öngörü, öne
 * çıkan metrikler). Onu bir metin kutusuna indirmek düzenlemek değil,
 * bozmak olurdu; eksik analizler İçerik ekranında listeleniyor ve rutin
 * onları kendi ucundan tamamlıyor.
 */

/** Listede en çok kaç yazı — fazlası aramayla bulunuyor. */
const TAVAN = 40;

export default async function StoriesPage(props: PageProps<"/admin/yazilar">) {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  const search = await props.searchParams;
  const ara = typeof search.ara === "string" ? search.ara.slice(0, 80) : "";
  const counts = await getWritingCounts();

  return (
    <div className="flex flex-col gap-5">
      <YazilarTabs active="mercek" counts={counts} />

      {/* `key` ile Suspense sınırı arama değiştiğinde yeniden kuruluyor,
          yani liste yenilenirken iskelet görünüyor. */}
      <Suspense
        key={ara}
        fallback={<Skeleton className="h-96 w-full rounded-xl" />}
      >
        <Stories ara={ara} />
      </Suspense>
    </div>
  );
}

async function Stories({ ara }: { ara: string }) {
  const [{ rows, total }, elden] = await Promise.all([
    getEditableStories(TAVAN, { search: ara || undefined }),
    getAdminEditedKeys(),
  ]);

  return (
    <AdminPanel>
      <AdminPanelTitle
        hint="En Son Yayımlanandan Eskiye · Satıra Basınca Editör Açılır"
        action={
          /* ARAMA OLMADAN ESKİ YAZIYA ULAŞILAMIYORDU: liste kırk satırla
             kırpılı ve arşiv büyüyor. Düz bir GET formu — JavaScript yok,
             tarayıcının kendi gönderimi, adres paylaşılabilir. */
          <form
            action="/admin/yazilar"
            method="get"
            className="flex w-full items-center gap-2 sm:w-auto"
          >
            <label className="relative flex min-w-0 flex-1 items-center sm:w-64 sm:flex-none">
              <span className="sr-only">Yazılarda ara</span>
              <MagnifyingGlass
                aria-hidden
                weight="bold"
                size={15}
                className="pointer-events-none absolute left-3 text-muted"
              />
              <input
                type="search"
                name="ara"
                defaultValue={ara}
                maxLength={80}
                placeholder="Başlık ya da slug'da ara"
                className="h-11 w-full rounded-(--radius-md) border border-line bg-surface pl-9 pr-3 text-base text-strong outline-none transition-colors placeholder:text-muted focus:border-line-focus sm:h-9"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center rounded-(--radius-md) border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:h-9"
            >
              Ara
            </button>
            {ara && (
              <Link
                href="/admin/yazilar"
                className="inline-flex h-11 shrink-0 items-center px-1 text-base font-semibold text-primary transition-colors hover:text-primary-hover sm:h-9"
              >
                Temizle
              </Link>
            )}
          </form>
        }
      >
        Mercek Yazıları
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          {ara ? `“${ara}” ile eşleşen yazı yok.` : "Henüz mercek yazısı yok."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {rows.map((row) => (
            <li key={row.slug}>
              <Link
                href={`/admin/yazilar/mercek/${row.slug}`}
                className="flex min-h-11 flex-col gap-1.5 rounded-(--radius-sm) px-2 py-3 transition-colors hover:bg-surface-elevated sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1">
                  {/* DAR EKRANDA BAŞLIK KIRPILMIYOR, SARIYOR. `truncate` tek
                      satıra kilitliyor ve 390 pikselde uzun başlıkların
                      yarısı "…" oluyordu — listede yazıyı ayırt eden tek
                      şey başlık. Geniş ekranda satır düzeni yatay olduğu
                      için orada kırpma kalıyor. */}
                  <span className="block text-base font-semibold text-strong sm:truncate">
                    {row.title}
                  </span>
                  <span className="numeral block truncate text-tiny text-muted">
                    {row.slug}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {/* Diller rozette: iki dilli mi, tek dilde mi kalmış —
                      eksik çeviri listesi İçerik ekranında ayrıca var ama
                      burada da bir bakışta görünüyor. */}
                  {row.locales.map((dil) => (
                    <span
                      key={dil}
                      className="numeral rounded-full bg-primary-wash px-2 py-0.5 text-nano font-bold text-primary-ink"
                    >
                      {dil}
                    </span>
                  ))}
                  {elden.has(row.slug) && (
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-nano font-semibold text-muted">
                      Elden Geçti
                    </span>
                  )}
                  {/* SÜTUN SIRALAMA ANAHTARINI GÖSTERİYOR. Burada olay
                      tarihi yazıyordu ama liste yayın anına göre sıralı ve
                      ikisi aynı şey değil: künye "en yeniden eskiye" derken
                      görünen tarih bir artıp bir azalıyordu. Olay tarihi
                      editörün künye kutusunda duruyor. */}
                  <span
                    className="numeral text-tiny text-muted sm:w-24 sm:text-right"
                    title={
                      row.publishedAt
                        ? row.publishedAt.toLocaleString("tr-TR")
                        : undefined
                    }
                  >
                    {row.publishedAt ? agoLabel(row.publishedAt) : "—"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* SESSİZ KIRPMA YOK. Liste tavana dayandığında kaçının dışarıda
          kaldığı yazılı — yoksa kırk satır "hepsi bu" diye okunuyor. */}
      {total > rows.length && (
        <p className="mt-4 border-t border-line pt-3 text-small text-muted">
          {total.toLocaleString("tr-TR")} yazının en yenisi{" "}
          {rows.length.toLocaleString("tr-TR")} tanesi listede. Aradığın yazı
          burada yoksa yukarıdaki kutudan başlığıyla ara.
        </p>
      )}
    </AdminPanel>
  );
}
