import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AdminPanel, AdminPanelTitle } from "@/components/admin/AdminUI";
import { StoryEditor } from "@/components/admin/StoryEditor";
import { DilAnahtari, EditorBasligi } from "@/components/admin/editor-parts";
import { getStoryBySlug, getStoryLocales } from "@/lib/data";
import { listStoryRevisions } from "@/app/actions/content";
import { previewStoryBody } from "@/app/actions/content-preview";
import { adminDayYear, adminStamp } from "@/lib/admin-format";
import { adminDocTitle } from "@/lib/admin-sections";
import { withLocale } from "@/lib/i18n/routing";

/**
 * Mercek yazısı editörü.
 *
 * YALNIZCA VAR OLAN SLUG'I DÜZENLER. Panelden yeni yazı üretilmiyor: yeni
 * yazı rutinin işi, panelin işi düzeltmek. Kayıt yoksa 404 — yetkisiz
 * isteğin gördüğü şeyin aynısı, panelin varlığını ele vermiyor.
 *
 * DİL ADRESTE DEĞİL SORGUDA (`?dil=en`). Aynı slug iki dilde iki ayrı satır
 * ve ikisi ayrı ayrı düzenlenebilmeli; slug'ı dille birleştirmek adresi
 * `/admin/yazilar/mercek/leopold-tasfiyesi-en` gibi sahte bir kimliğe
 * çevirirdi.
 *
 * BAŞLIK HİYERARŞİSİ: `h1` kayıt ("Mercek Yazısı · 22 Eyl 2026"), `h2`
 * düzenlenen satır ("Türkçe Metin" — slug+dil bir satır), `h3` parçalar
 * (Gövde, Önizleme, Künye, Sürüm Geçmişi). Başlık bir dönem yazının
 * kendi başlığını `h2` olarak basıyordu ve aynı metin hemen altında
 * kutunun içinde duruyordu; düzenlenirken ikisi iki ayrı hâlde okunuyordu.
 */

/* Ayraç ve tarih BÖLÜNMÜYOR: 390'da başlık "Mercek Yazısı / · 22 Eyl 2026"
   diye kırılıyor, ikinci satır ayraçla başlıyordu. Kırılma yalnızca
   ayraçtan SONRA olabiliyor. */
const kayitAdi = (eventDate: string) =>
  `Mercek Yazısı\u00a0· ${adminDayYear(eventDate).replace(/ /g, "\u00a0")}`;

/* Mutlak ve Türkçe: panel Türkçe ve kökün şablonu İngilizce çerezle
   "Opening Bell" ekliyordu (lib/admin-sections.ts). Kayıt sayfanın
   kapısından geçmeden okunmuyor — başlık yetkisiz isteğe bir slug'ın
   varlığını söylemesin. */
export async function generateMetadata(
  props: PageProps<"/admin/yazilar/mercek/[slug]">,
): Promise<Metadata> {
  await requireAdmin();
  const { slug } = await props.params;
  const search = await props.searchParams;
  const row = await getStoryBySlug(slug, search.dil === "en" ? "en" : "tr");
  return {
    title: adminDocTitle(row ? kayitAdi(row.eventDate) : "Mercek Yazısı", "Yazılar"),
    robots: { index: false, follow: false },
  };
}

export default async function StoryEditorPage(
  props: PageProps<"/admin/yazilar/mercek/[slug]">,
) {
  await requireAdmin();

  const { slug } = await props.params;
  const search = await props.searchParams;
  const locale = search.dil === "en" ? "en" : "tr";

  const row = await getStoryBySlug(slug, locale);
  if (!row) notFound();
  /* ADRESTEKİ DİL KAYITTA YOKSA EKRAN YALAN SÖYLÜYORDU. `getStoryBySlug`
     istenen dili bulamazsa ÖTEKİ satırı döndürüyor (lib/data.ts: `rows.find(...)
     ?? rows[0]`) — çevirisi olmayan bir yazıda `?dil=en` açılınca ekran
     TÜRKÇE kaydı gösterip künyesine "İngilizce" yazıyordu. Editörün gizli
     `locale` alanı da satırın kendi dilini taşıdığı için kaydetmek Türkçe
     orijinalin ÜZERİNE yazıyordu: bir veri kaybı, üstelik sessiz. Adres bir
     iddia; kayıt onu karşılamıyorsa 404 doğru cevap. */
  if (row.locale !== locale) notFound();

  /* Sürümler, öteki dilin varlığı ve İLK ÖNİZLEME kayıtla aynı turda:
     üçü birbirinden bağımsız. Önizleme istemcinin ilk POST'unu bekliyordu
     ve bölge açılışta 256 pikselden 804'e sıçrıyordu (gerekçe
     editor-parts.tsx → `useOnizleme`). */
  const [revisions, locales, ilkOnizleme] = await Promise.all([
    listStoryRevisions(slug, locale),
    getStoryLocales(slug),
    previewStoryBody(row.bodyMd, locale),
  ]);
  const adres = (dil: "tr" | "en") =>
    locales.includes(dil)
      ? `/admin/yazilar/mercek/${slug}${dil === "en" ? "?dil=en" : ""}`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <EditorBasligi
        geri="/admin/yazilar"
        tur="Mercek"
        baslik={kayitAdi(row.eventDate)}
        aciklama="Yayındaki yazıyı düzelt; slug ve dil değişmez, yeni yazı burada açılmaz."
        eylem={<DilAnahtari dil={locale} tr={adres("tr")} en={adres("en")} />}
      />

      <AdminPanel>
        <AdminPanelTitle
          hint={`${row.slug} · Son Güncelleme ${row.updatedAt ? adminStamp(row.updatedAt) : "—"}`}
        >
          {locale === "en" ? "İngilizce Metin" : "Türkçe Metin"}
        </AdminPanelTitle>

        {/* ANAHTAR YOK, bilerek: `key={updatedAt}` kaydetmeden sonra
            editörü yeniden kuruyor ve "Kaydedildi"yi siliyordu. Yeni
            taslağı editör kendisi karşılıyor — gerekçe StoryEditor'da. */}
        <StoryEditor
          revisions={revisions}
          ilkOnizleme={ilkOnizleme}
          /* YAYINDAKİ HÂL KAYDIN DİLİNDE (23 Eylül denetimi). İngilizce
             editörün bağlantısı öneksiz `/mercek/…` idi; önek yoksa dil
             çerezden okunuyor ve sahibinin çerezi Türkçe — İngilizceyi
             düzelten yönetici Türkçe sayfayı açıp denetliyordu. */
          canliAdres={withLocale(`/mercek/${row.slug}`, locale)}
          draft={{
            slug: row.slug,
            locale: row.locale,
            title: row.title,
            dek: row.dek,
            bodyMd: row.bodyMd,
            eventDate: row.eventDate,
            symbols: row.symbols ?? [],
            sources: row.sources ?? [],
            readMinutes: row.readMinutes ?? 1,
            updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
          }}
        />
      </AdminPanel>
    </div>
  );
}
