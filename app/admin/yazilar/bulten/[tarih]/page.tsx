import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AdminPanel, AdminPanelTitle } from "@/components/admin/AdminUI";
import { BriefEditor } from "@/components/admin/BriefEditor";
import { DilAnahtari, EditorBasligi } from "@/components/admin/editor-parts";
import { briefLocalesFor, getBriefForEdit } from "@/lib/admin-data";
import { listBriefRevisions } from "@/app/actions/content";
import { previewBriefBody } from "@/app/actions/content-preview";
import { adminDayYear, adminStamp, adminWeekRange } from "@/lib/admin-format";
import { adminDocTitle } from "@/lib/admin-sections";
import { withLocale } from "@/lib/i18n/routing";

/**
 * Bülten editörü.
 *
 * KİMLİK ÜÇ PARÇA: tarih adreste, dönem ve dil sorguda (`?tur=haftalik&dil=en`).
 * Üçünü de adrese gömmek `/admin/yazilar/bulten/2026-08-29-haftalik-en` gibi
 * sahte bir kimlik üretirdi; mercek editöründe dil için verilen kararın
 * aynısı. Dönem sorguda çünkü aynı TARİHE iki kayıt düşebiliyor — pazartesi
 * hem o günün günlüğünü hem haftanın haftalığını taşıyor.
 *
 * SORGU TÜRKÇE (`tur=haftalik`), sitenin `/bulten` adresiyle aynı sözcük:
 * panelde `period=weekly`, sitede `tur=haftalik` yazmak aynı şeyin iki adı
 * demekti ve ikisi arasında gidip gelen kişi her seferinde çeviri yapardı.
 *
 * YALNIZCA VAR OLAN KAYDI DÜZENLER. Kayıt yoksa 404 — yeni bülten yazmak
 * rutinin işi, panelin işi düzeltmek.
 */

/**
 * BAŞLIK TARİH, MANŞET DEĞİL. Manşet zaten formun ilk kutusunda ve
 * düzenlenirken değişiyor; başlıkta da durursa aynı metin iki yerde iki
 * farklı hâlde okunur. Tarih ise kaydın kimliği.
 *
 * RAKAMSAL TARİH DEĞİL, DÖNEM ADIYLA (23 Eylül denetimi). "22.09.2026
 * Bülteni" yazıyordu — rakamsal tarih yalnızca yoğun tablo hücrelerinde
 * (lib/utils.ts) — ve haftalık kayıt pazartesi çapasıyla aynı kalıba
 * düşüyordu: "14.09.2026 Bülteni" o pazartesinin bülteni gibi okunuyordu,
 * oysa 14–18 Eylül haftasını anlatıyor.
 */
const kayitAdi = (tarih: string, period: "daily" | "weekly") =>
  /* Kırılma yalnızca ayraçtan sonra — gerekçe mercek editörünün sayfasında. */
  period === "weekly"
    ? `Haftalık Bülten\u00a0· ${adminWeekRange(tarih)}`
    : `Günlük Bülten\u00a0· ${adminDayYear(tarih).replace(/ /g, "\u00a0")}`;

const tarihMi = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/* Mutlak ve Türkçe; kimlik adresin kendisinde olduğu için kayıt okunmuyor. */
export async function generateMetadata(
  props: PageProps<"/admin/yazilar/bulten/[tarih]">,
): Promise<Metadata> {
  await requireAdmin();
  const { tarih } = await props.params;
  const search = await props.searchParams;
  const period = search.tur === "haftalik" ? "weekly" : "daily";
  return {
    title: adminDocTitle(tarihMi(tarih) ? kayitAdi(tarih, period) : "Bülten", "Yazılar"),
    robots: { index: false, follow: false },
  };
}

/** Kim yazdı — `daily_briefs.generated_by`. */
const YAZAR: Record<string, string> = {
  claude: "Rutin Yazdı",
  rules: "Kural Tabanlı Yedek",
  admin: "Panelde Yazıldı",
};

export default async function BriefEditorPage(
  props: PageProps<"/admin/yazilar/bulten/[tarih]">,
) {
  await requireAdmin();

  const { tarih } = await props.params;
  const search = await props.searchParams;
  const period = search.tur === "haftalik" ? "weekly" : "daily";
  const locale = search.dil === "en" ? "en" : "tr";
  if (!tarihMi(tarih)) notFound();

  const row = await getBriefForEdit(tarih, locale, period);
  if (!row) notFound();

  /* Sürümler, öteki dilin varlığı ve ilk önizleme AYNI TURDA: üçü
     birbirinden bağımsız. */
  const [revisions, locales, ilkOnizleme] = await Promise.all([
    listBriefRevisions(tarih, period, locale),
    briefLocalesFor(tarih, period),
    previewBriefBody(row.bodyMd),
  ]);

  const tur = period === "weekly" ? "haftalik" : "gunluk";
  const adres = (dil: "tr" | "en") =>
    locales.includes(dil) ? `/admin/yazilar/bulten/${tarih}?tur=${tur}&dil=${dil}` : null;

  /* YAZAN İLE SON KAYIT AYRI (23 Eylül denetimi). Künye "Rutin Yazdı ·
     <saat>" diyordu ama saat her kayıtta ilerliyordu, panelden de: 11:42'de
     düzeltilen bülten "Rutin Yazdı · 11:42" okunuyordu. Damga artık yalnızca
     rutin yazınca ilerliyor (lib/content-write.ts → `saveBrief`); panelin
     düzeltmesi, üzerine yazdığı sürümün `replacedAt`inde duruyor ve en yeni
     sürümü panel değiştirdiyse burada ayrıca yazılıyor. */
  const sonSurum = revisions[0];
  const paneldeDuzeltildi =
    sonSurum?.replacedBy === "admin" &&
    new Date(sonSurum.replacedAt).getTime() > row.generatedAt.getTime()
      ? new Date(sonSurum.replacedAt)
      : null;
  const kunye = [
    `${YAZAR[row.generatedBy] ?? "Yazan Bilinmiyor"} ${adminStamp(row.generatedAt)}`,
    paneldeDuzeltildi && `Panelde Düzeltildi ${adminStamp(paneldeDuzeltildi)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <EditorBasligi
        geri="/admin/yazilar/bulten"
        tur="Bülten"
        baslik={kayitAdi(row.briefDate, period)}
        aciklama="Yayındaki bülteni düzelt; tarih, dönem ve dil değişmez."
        eylem={<DilAnahtari dil={locale} tr={adres("tr")} en={adres("en")} />}
      />

      <AdminPanel>
        <AdminPanelTitle hint={kunye}>
          {locale === "en" ? "İngilizce Metin" : "Türkçe Metin"}
        </AdminPanelTitle>

        {/* Anahtar yok — gerekçe StoryEditor'da; bültenin yeni taslağı
            neyle tanıdığı BriefEditor'da. */}
        <BriefEditor
          revisions={revisions}
          ilkOnizleme={ilkOnizleme}
          /* Yayındaki hâl kaydın dilinde — gerekçe mercek editöründe. */
          canliAdres={withLocale(
            `/bulten?${period === "weekly" ? "tur=haftalik&" : ""}tarih=${row.briefDate}`,
            locale,
          )}
          draft={{
            date: row.briefDate,
            locale: row.locale,
            period: row.period === "weekly" ? "weekly" : "daily",
            headline: row.headline,
            bodyMd: row.bodyMd,
            generatedBy: row.generatedBy,
            generatedAt: row.generatedAt.toISOString(),
          }}
        />
      </AdminPanel>
    </div>
  );
}
