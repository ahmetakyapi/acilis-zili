import Link from "next/link";
import { Suspense } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { PageHeader, buttonClass } from "@/components/ui/primitives";
import {
  AdminEmpty,
  AdminPanel,
  AdminPanelSkeleton,
  AdminPanelTitle,
  adminInput,
} from "@/components/admin/AdminUI";
import { YazilarTabs } from "@/components/admin/YazilarTabs";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import {
  getAdminEditedKeys,
  getEditableStories,
  getWritingCounts,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { ADMIN_READ_ERROR, adminStamp, agoLabel } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

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
 * kırk satırı geçiyordu. Sekme denetimi paylaşılan bir layout'ta DEĞİL, iki
 * liste sayfasının her biri kendi `PageHeader`ında basıyor: editörler aynı
 * segmentin altında ve orada sekme istenmiyor (bilançolar ekranındaki
 * kuralın aynısı).
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

/** Rozet sırası sabit: TR önce (lib/admin-data.ts → `getEditableStories`). */
const DILLER = ["TR", "EN"] as const;

/* İskelet ölçüleri (23 Eylül, önizleme, JavaScript kapalıyken yedek ile
   gerçek panel yan yana ölçüldü). Satır telefonda 64 piksel (saat kendi
   sütununda, başlık iki satır), genişte 61 (başlık + slug). Arama satırı ve
   alt künye iki satır olarak sayılıyor; toplam gerçek panelle ±1 piksel:
   telefonda 2.796 / 2.797, genişte 2.662 / 2.663. */
const EK_SATIR = 2;
const SATIR_TELEFON = 63.9;
const SATIR_GENIS = 60.5;

/* Her bölümün kendi sekme başlığı: altısı "Yönetim · Açılış Zili"
   paylaşıyordu ve tarayıcı sekmesi, geçmiş, ekran okuyucu bölümleri
   ayıramıyordu. */
export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.writing.title) };

export default async function StoriesPage(props: PageProps<"/admin/yazilar">) {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  const search = await props.searchParams;
  const ara = typeof search.ara === "string" ? search.ara.slice(0, 80) : "";
  const counts = await getWritingCounts();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Yönetim"
        title={ADMIN_SECTIONS.writing.title}
        subtitle={ADMIN_SECTIONS.writing.subtitle}
        action={
          <YazilarTabs active="mercek" counts={counts.ok ? counts.data : null} />
        }
      />

      {/* `key` ile Suspense sınırı arama değiştiğinde yeniden kuruluyor,
          yani liste yenilenirken iskelet görünüyor. İSKELET GERÇEK PANELİN
          BOYUNDA: sabit `h-96` bir çubuktu, oysa kırk satırlık liste 1440'ta
          2.618, 390'da 4.440 piksel — liste gelince sayfa aşağı fırlıyordu.
          Satır boyu iki genişlikte farklı (ölçüm yukarıda), o yüzden iki
          iskelet, biri telefonda biri genişte görünür. */}
      <Suspense
        key={ara}
        fallback={
          <>
            <AdminPanelSkeleton
              rows={TAVAN + EK_SATIR}
              rowHeight={SATIR_TELEFON}
              className="sm:hidden"
            />
            <AdminPanelSkeleton
              rows={TAVAN + EK_SATIR}
              rowHeight={SATIR_GENIS}
              className="hidden sm:block"
            />
          </>
        }
      >
        <Stories ara={ara} />
      </Suspense>
    </div>
  );
}

async function Stories({ ara }: { ara: string }) {
  const [result, elden] = await Promise.all([
    getEditableStories(TAVAN, { search: ara || undefined }),
    getAdminEditedKeys(),
  ]);
  const { rows, total } = result.ok ? result.data : { rows: [], total: 0 };
  /* Slug ASCII kebab; eşleşmeyi `ilike` gibi dil kuralı OLMADAN küçültüp
     arıyoruz — Türkçe küçültme "I"yı "ı" yapar ve ASCII slug'da hiç
     eşleşmez. */
  const aranan = ara.trim().toLowerCase();

  /* BAŞLIK LİSTENİN KENDİSİ. Burada "Mercek Yazıları" yazıyordu ve 95
     piksel yukarıdaki sekme etiketinin aynısıydı; neyin listelendiğini
     (kaç tane, hangi kesit) söyleyen bir şey yoktu. Sayı yalnızca liste
     okunduysa ve boş değilse: "0 Eşleşen Yazı" başlığı, altındaki boş
     durum cümlesini ikinci kez ve daha kaba söylüyordu. */
  const baslik =
    !result.ok || rows.length === 0
      ? ara
        ? "Arama Sonucu"
        : "Mercek Yazıları"
      : ara
        ? `${total.toLocaleString("tr-TR")} Eşleşen Yazı`
        : total > rows.length
          ? `Son ${rows.length.toLocaleString("tr-TR")} Yazı`
          : `${rows.length.toLocaleString("tr-TR")} Yazı`;

  return (
    <AdminPanel>
      <AdminPanelTitle hint="En Yeniden Eskiye · Saatler TR · Satır Editörü Açar">
        {baslik}
      </AdminPanelTitle>

      {/* ARAMA OLMADAN ESKİ YAZIYA ULAŞILAMIYORDU: liste kırk satırla
          kırpılı ve arşiv büyüyor. Düz bir GET formu — JavaScript yok,
          tarayıcının kendi gönderimi, adres paylaşılabilir.

          BAŞLIĞIN YANINDA DEĞİL ALTINDA, kendi satırında (23 Eylül). Başlığın
          `action` yuvasındaydı ve o yuva ızgaranın `auto` sütunu: 390'da
          genişleyen kutu başlık sütununu sıfıra itti ve "Mercek Yazıları"
          aramanın ALTINDA kaldı (ölçüldü, iki öğe üst üste). Bülten
          sekmesindeki süzgeç satırıyla aynı yerde; iki liste aynı sırayla
          okunuyor: başlık, denetim, satırlar. */}
      <form
        action="/admin/yazilar"
        method="get"
        role="search"
        className="mb-4 flex items-center gap-2"
      >
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-80">
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
            className={cn(adminInput, "h-11 w-full pl-9 sm:h-10")}
          />
        </label>
        <button type="submit" className={buttonClass({ variant: "ghost" })}>
          Ara
        </button>
        {ara && (
          <Link
            href="/admin/yazilar"
            className="inline-flex min-h-11 shrink-0 items-center px-1 text-base font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-10"
          >
            Temizle
          </Link>
        )}
      </form>

      {!result.ok ? (
        /* Okunamadı "henüz yazı yok" değil (lib/admin-data.ts → `AdminResult`). */
        <p className="py-6 text-center text-base text-brass-ink">{ADMIN_READ_ERROR}</p>
      ) : rows.length === 0 ? (
        <AdminEmpty
          title={ara ? `“${ara}” ile eşleşen yazı yok.` : "Henüz mercek yazısı yok."}
        />
      ) : (
        <ul className="-mx-2 flex flex-col divide-y divide-line-soft">
          {rows.map((row) => {
            /* DİL ROZETİ YALNIZCA EKSİKSE (23 Eylül denetimi). Kırk
               satırın kırkında "TR EN" yazıyordu: hep aynı olan bir rozet
               bilgi taşımıyor, asıl önemli olanı — bir dilin EKSİK olduğu
               satırı — kalabalığın içinde saklıyordu. Şimdi rozet yalnızca
               istisnada ve pirinç tonda. */
            const eksik = DILLER.filter((dil) => !row.locales.includes(dil));
            const eldenGecti = elden.has(row.slug);
            /* SLUG TELEFONDA YALNIZCA ARAMAYI O KARŞILADIYSA. Her satırda
               ikinci bir satır harcıyordu (390'da satır 105 piksel, sayfa
               4.852); slug'ı bilen tek kişi onu aramaya yazan kişi, ve
               eşleşmenin nereden geldiğini o zaman görmek istiyor. */
            const slugGorunur = aranan !== "" && row.slug.includes(aranan);
            const stamp = row.publishedAt ? adminStamp(row.publishedAt) : null;
            const bosluk = stamp ? stamp.lastIndexOf(" ") : -1;
            return (
              <li key={row.slug}>
                <Link
                  /* BAĞLANTI SATIRIN DİLİNİ TAŞIYOR. Editör artık adresteki
                     dil kayıtta yoksa 404 veriyor (yanlış dilin üstüne yazma
                     yolu kapandı); bağlantı dilsiz kalırsa yalnızca İngilizce
                     kaydı olan bir slug listede görünüp tıklanınca 404 verirdi. */
                  href={`/admin/yazilar/mercek/${row.slug}${row.locales.includes("TR") ? "" : "?dil=en"}`}
                  /* İKİ SÜTUN, HER GENİŞLİKTE. Telefonda satır alt alta
                     diziliyordu ve saat rozetlerin peşinden geliyordu: sağ
                     kenarları 179–187 piksel arasında dalgalanıyordu.
                     Şimdi saat kendi sütununda, sağa yaslı ve başlığın ilk
                     satırıyla aynı taban çizgisinde: kırk satırın kırkında
                     tek sağ kenar (390'da 351, 1440'ta 1355 piksel). */
                  className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-(--radius-sm) px-2 py-3 transition-colors hover:bg-surface-elevated sm:gap-x-6"
                >
                  <span className="min-w-0">
                    {/* DAR EKRANDA BAŞLIK KIRPILMIYOR, SARIYOR. `truncate`
                        tek satıra kilitliyor ve 390 pikselde uzun başlıkların
                        yarısı "…" oluyordu — listede yazıyı ayırt eden tek
                        şey başlık. Geniş ekranda satır düzeni yatay olduğu
                        için orada kırpma kalıyor. */}
                    <span className="block text-base font-semibold text-strong sm:truncate">
                      {row.title}
                    </span>
                    {(eksik.length > 0 || eldenGecti) && (
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                        <Rozetler eksik={eksik} elden={eldenGecti} />
                      </span>
                    )}
                    <span
                      className={cn(
                        "numeral min-w-0 items-center gap-2 text-tiny text-muted",
                        slugGorunur ? "flex" : "hidden sm:flex",
                      )}
                    >
                      <span className="truncate">{row.slug}</span>
                      {(eksik.length > 0 || eldenGecti) && (
                        <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                          <Rozetler eksik={eksik} elden={eldenGecti} />
                        </span>
                      )}
                    </span>
                  </span>
                  {/* SÜTUN SIRALAMA ANAHTARINI GÖSTERİYOR. Burada olay
                      tarihi yazıyordu ama liste yayın anına göre sıralı ve
                      ikisi aynı şey değil: künye "en yeniden eskiye" derken
                      görünen tarih bir artıp bir azalıyordu. Olay tarihi
                      editörün künye kutusunda duruyor.

                      AN, GÖRELİ SÜRE DEĞİL (23 Eylül denetimi). Sütun
                      yalnızca "9 / 23 / 35 / 47 Saat Önce" yazıyordu; kesin
                      an bir `title`daydı, sunucunun diliminde (üretimde UTC,
                      üç saat geride) ve saniyesiyle, dokunmatikte de hiç
                      açılmıyordu. 11:30 ve 23:30 TR koşularının zamanında
                      yazıp yazmadığı bu sütundan okunuyor, o yüzden görünen
                      metin İstanbul saatiyle an ("Bugün 01:39"), göreli süre
                      ipucunda. Telefonda gün ve saat iki satır: sütun dar
                      kalıyor, başlığa yer açılıyor. */}
                  {row.publishedAt && stamp ? (
                    <time
                      dateTime={row.publishedAt.toISOString()}
                      title={agoLabel(row.publishedAt)}
                      className="numeral w-12 text-right text-tiny text-muted sm:w-28"
                    >
                      <span className="block sm:inline">{stamp.slice(0, bosluk)}</span>{" "}
                      <span className="block sm:inline">{stamp.slice(bosluk + 1)}</span>
                    </time>
                  ) : (
                    <span className="w-12 text-right text-tiny text-muted sm:w-28">—</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* SESSİZ KIRPMA YOK. Liste tavana dayandığında kaçının dışarıda
          kaldığı yazılı — yoksa kırk satır "hepsi bu" diye okunuyor. */}
      {result.ok && total > rows.length && (
        <p className="mt-4 border-t border-line pt-3 text-small text-muted">
          {ara
            ? `Eşleşen ${total.toLocaleString("tr-TR")} yazının en yenisi ${rows.length.toLocaleString("tr-TR")} tanesi listede; aramayı daraltarak eskisine ulaşabilirsin.`
            : `${total.toLocaleString("tr-TR")} yazının en yenisi ${rows.length.toLocaleString("tr-TR")} tanesi listede. Aradığın yazı burada yoksa yukarıdaki kutudan başlığıyla ara.`}
        </p>
      )}
    </AdminPanel>
  );
}

/** Satırın istisna rozetleri — eksik dil (pirinç) ve panelden düzeltilmiş. */
function Rozetler({
  eksik,
  elden,
}: {
  eksik: readonly string[];
  elden: boolean;
}) {
  return (
    <>
      {eksik.map((dil) => (
        <span
          key={dil}
          className="rounded-full bg-brass-wash px-2 py-0.5 text-nano font-bold text-brass-ink"
        >
          {dil} Eksik
        </span>
      ))}
      {elden && (
        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-nano font-semibold text-muted">
          Elden Geçti
        </span>
      )}
    </>
  );
}
