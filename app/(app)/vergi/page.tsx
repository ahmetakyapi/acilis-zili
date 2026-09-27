import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { TaxCalculator } from "@/components/tax/TaxCalculator";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
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
 * yalnızca iskeleti, metni ve kaynakları sunucuda çiziyor. Kaynakların
 * kendisi ve her kuralın kesinlik notu `lib/tax.ts` başında.
 *
 * Ekran sırası kurala göre: başlık → seçim şeridi (yıl, kur günü, uyarı) →
 * işlemler → ölçüler (satış kazancı) → endeks → temettü → metin (bilmen
 * gerekenler) → künye → rehber.
 */
export default async function TaxPage() {
  const { locale, t } = await getI18n();
  const L = t.lira.tax;
  const S = L.sections;

  const sections: [string, string][] = [
    [S.changesTitle, S.changesBody],
    [S.timelineTitle, S.timelineBody],
    [S.w8Title, S.w8Body],
    [S.ruleTitle, S.ruleBody],
    [S.fifoTitle, S.fifoBody],
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

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader eyebrow={L.eyebrow} title={L.title} subtitle={L.subtitle} />

      <TaxCalculator labels={L} locale={locale} indexAuto={isEvdsConfigured()} today={istanbulToday()} />

      <Panel>
        <PanelHeader title={L.guideTitle} />
        <div className="flex flex-col gap-5 px-4 pb-5 sm:px-5">
          {sections.map(([title, body]) => (
            <section key={title} className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold text-strong">{title}</h3>
              <p className="max-w-3xl text-sm leading-relaxed text-body">{body}</p>
            </section>
          ))}
          <section className="flex flex-col gap-1.5">
            <h3 className="text-base font-bold text-strong">{S.sourcesTitle}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {sources.map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center text-primary transition-colors hover:text-primary-hover sm:min-h-7"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <p className="border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
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
