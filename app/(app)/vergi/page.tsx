import { PageShare } from "@/components/article/PageShare";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { TaxCalculator } from "@/components/tax/TaxCalculator";
import { getTaxYears } from "@/lib/tax-data";
import { TaxFiling, TaxPaths } from "@/components/tax/TaxFiling";
import { TaxHow } from "@/components/tax/TaxHow";
import { TaxGuide } from "@/components/tax/TaxGuide";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { isEvdsConfigured } from "@/lib/providers/evds";
import { istanbulToday } from "@/lib/providers/fx-history";

export const generateMetadata = pageMetadata({
  path: "/vergi",
  tr: {
    title: "Yurt Dışı Hisse Vergisi Hesaplayıcı",
    description:
      "ABD hisse satış kazancını ve temettüyü TCMB döviz alış kuru, Yİ-ÜFE endekslemesi ve ilk giren ilk çıkar yöntemiyle liraya çevir. Kayıt yok, hesap tarayıcında.",
  },
  en: {
    title: "Foreign Stock Tax Calculator",
    description:
      "Convert US stock gains and dividends into lira under Turkish tax rules: CBRT buying rate, PPI indexation and first in, first out. Nothing is stored.",
  },
});

/**
 * /vergi — YURT DIŞI HİSSE VERGİSİ.
 *
 * Hesap tümüyle istemcide (`components/tax/TaxCalculator.tsx`); bu sayfa
 * iskeleti, kapağı, takvimi ve kaynakları sunucuda çiziyor. Kaynakların
 * kendisi ve her kuralın kesinlik notu `lib/tax.ts` başında. Sunucu kısmı
 * veri beklemiyor: tek okuma bugünün tarihi, ağ yok.
 *
 * Sayfa okuyucunun üç sorusuna göre dizili (28 Eylül):
 *   1. "Sattığım hisse için vergi çıkar mı?"  → hesaplayıcı, Hisse Satışı
 *   2. "Temettüyü beyan etmem gerekiyor mu?"  → hesaplayıcı, Temettü
 *   3. "Ne zaman, nereye, hangi belgeyle?"    → takvim paneli
 * Kapak üçünü de ilk ekranda soruyor.
 *
 * ÖNCE ANLATIM, SONRA HESAP (29 Eylül, sahibinin isteği; 25 Ekim'de
 * değişti, aşağıda). Eski sıra:
 *   kapak → Nasıl Hesaplanır (altı adım, sonunda "Hesaplamaya Başla"
 *   çapası) → hesaplayıcı (ekstre, giriş, sonuç) → takvim ve belgeler
 *   (hesaptan sonra beyan) → tarife merdiveni + üç kart (TaxGuide) → DataStamp →
 *   GuideHint.
 * Takvim anlatımın içine alınmadı: 600 piksellik takvim ve belge listesi
 * hesaplayıcıyı ikinci ekranın da altına itiyordu. Anlatımın altıncı adımı
 * onu özetleyip çapayla bağlanıyor. Kuralları anlatan iki açılır satır
 * (kur/endeksleme, ilk giren ilk çıkar) adımlara taşındı ve SSS'den
 * kaldırıldı — aynı kural iki yerde yazılmıyor.
 *
 * ÖNCE HESAP, ANLATIM KATLI ALTINDA (25 Ekim, sahibinin isteği: birincil
 * eylem kaydırmadan görünsün). Yukarıdaki sırada hesaplayıcının ilk alanı
 * 390×844'te y=2962, 1280×800'de y=1729'du; arada 1.883 (390) / 954
 * (1280) piksellik anlatım vardı. Yeni sıra:
 *   kapak (üç soru) → hesaplayıcı → Nasıl Hesaplanır (ilk iki adım açık,
 *   kalanı katlı) → takvim ve belgeler → TaxGuide → GuideHint.
 * Anlatım silinmedi: boş sonuçtaki "Nasıl Hesaplanır" bağlantısı onu
 * açarak iner (`TaxHowReveal`). Kapağın `#satis`/`#temettu`/`#takvim`
 * çapaları ve rehberin `/vergi#satis` bağlantısı aynı. Ölçümler
 * `TaxHow.tsx` başında.
 */
export default async function TaxPage() {
  const { locale, t } = await getI18n();
  const L = t.lira.tax;
  const today = istanbulToday();

  /* Vergi yılları: koddakiler + GİB'den otomatik okunan yeniler. */
  const years = await getTaxYears();

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      {/* PAYLAŞ AÇIKLAMANIN ARDINDA (18 Ekim). Başlığın sağındayken
          (`shareInTitle`) kapağın sağ kolonu üç bağlantıyla dolu olduğu için
          düğme sol kolonun ortasında, başlıkla bağlantılar arasında boşlukta
          yüzüyordu (sahibinin ekran görüntüsü). Görselli kapaklardaki gibi
          (/tema/[slug]) açıklamanın altında, sola yaslı. */}
      <DirectoryHeader
        share={<PageShare path="/vergi" title={L.title} locale={locale} t={t} />}
        title={L.title}
        description={L.subtitle}
        visual={<TaxPaths labels={L} />}
      />

      <TaxCalculator labels={L} locale={locale} indexAuto={isEvdsConfigured()} today={today} years={years} />

      <TaxHow labels={L} locale={locale} today={today} years={years} />

      <TaxFiling labels={L} locale={locale} today={today} years={years} />

      {/* BİLMEN GEREKENLER (18 Ekim): tarife merdiveni + üç kart. Eski
          hâl (düz tablo ve üç kapalı açılır satır) ve yeni kurgunun
          gerekçesi `components/tax/TaxGuide.tsx` başında. */}
      <TaxGuide labels={L} dataLabels={t.data} locale={locale} today={today} years={years} />

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["yurt-disi-hisse-vergisi", "w-8ben", "kur-riski", "bankadan-araci-kuruma-gecis"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
