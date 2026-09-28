import { Plus } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { TaxCalculator } from "@/components/tax/TaxCalculator";
import { getTaxYears } from "@/lib/tax-data";
import { PANEL_TITLE } from "@/components/tax/tax-ui";
import { TaxFiling, TaxPaths } from "@/components/tax/TaxFiling";
import taxStyles from "@/components/tax/Tax.module.css";
import { Panel } from "@/components/ui/primitives";
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
 * Kapak üçünü de ilk ekranda soruyor; sonra ekran düzeni kuralı: seçim
 * (sekme) → ana görsel ve ölçüler (sonuç kartı) → metin → künyeler.
 */
export default async function TaxPage() {
  const { locale, t } = await getI18n();
  const L = t.lira.tax;
  const S = L.sections;
  const today = istanbulToday();

  const sections: [string, string][] = [
    [S.ruleTitle, S.ruleBody],
    [S.w8Title, S.w8Body],
    [S.fifoTitle, S.fifoBody],
    [S.changesTitle, S.changesBody],
  ];
  const sources: [string, string][] = [
    [L.sources.dki, "https://intvrg.gib.gov.tr/hazirbeyan/assets/pdf/digerKazancIratlar2025.pdf"],
    [
      L.sources.msi,
      "https://intvrg.gib.gov.tr/hazirbeyan/assets/pdf/DUYURU_UNIVERSAL_2026_2026_menkulsermayeiradi.pdf",
    ],
    [
      L.sources.ykb,
      "https://www.yapikredi.com.tr/medium/file/yabanci-hisse-senedi-gelirlerinde-2026-yili-vergi-durumu_71999/view",
    ],
    [L.sources.turmob, "https://www.turmob.org.tr/ekutuphane/Read/f07edf9b-2575-47d4-b426-22a67e02df53"],
    [L.sources.irs, "https://www.irs.gov/instructions/i1042s"],
  ];

  /* Vergi yılları: koddakiler + GİB'den otomatik okunan yeniler. */
  const years = await getTaxYears();

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <DirectoryHeader
        eyebrow={L.eyebrow}
        title={L.title}
        description={L.subtitle}
        visual={<TaxPaths labels={L} />}
      />

      <TaxCalculator labels={L} locale={locale} indexAuto={isEvdsConfigured()} today={today} years={years} />

      <TaxFiling labels={L} locale={locale} today={today} years={years} />

      {/* METİN AÇILIR SATIRLARDA. Eski sayfada beş paragraf art arda
          açıktı ve hesaplayıcının altında bir metin duvarı gibi duruyordu;
          okuyucu soruyu başlıktan seçip yalnızca onu açıyor. Kaynaklar
          korunuyor ve kendi satırında. */}
      <Panel>
        <div className={taxStyles.panelHead}>
          <h2 className={PANEL_TITLE}>{L.guideTitle}</h2>
        </div>
        <div className={`${taxStyles.faqWrap} pt-2`}>
        <ul className={taxStyles.faq}>
          {sections.map(([title, body]) => (
            <li key={title}>
              <details>
                <summary>
                  {title}
                  <Plus size={16} weight="bold" aria-hidden />
                </summary>
                <p>{body}</p>
              </details>
            </li>
          ))}
          <li>
            <details>
              <summary>
                {S.sourcesTitle}
                <Plus size={16} weight="bold" aria-hidden />
              </summary>
              <ul className="flex flex-col">
                {sources.map(([label, href]) => (
                  <li key={href}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-11 items-center text-primary transition-colors hover:text-primary-hover sm:min-h-8"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        </ul>
        </div>
        <p className="mt-2 border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-7">
          {L.dataNote}
        </p>
      </Panel>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["yurt-disi-hisse-vergisi", "w-8ben", "kur-riski"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
