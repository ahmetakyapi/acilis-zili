import { formatLira } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import { US_WITHHOLDING, type TaxYearRules } from "@/lib/tax";
import type { TaxLabels } from "./TaxCalculator";
import { currentTaxYear } from "./TaxFiling";
import styles from "./Tax.module.css";

/**
 * KAPAĞIN SOL KOLONUNDAKİ ÜÇ ÖLÇÜ (6 Kasım, sahibinin sözü: "kapakta iki
 * kolon dengesi"). 1440'ta sağdaki üç kısayol kartı 230 piksel, solda
 * başlık + açıklama + Paylaş 162 piksel tutuyordu; kapak ortalandığı için
 * sol kolonun altında ve üstünde ~35'er piksel boşluk kalıyordu. Boşluk
 * esnetilmedi, DOLDURULDU (CLAUDE.md "Boşluk esnetilmez, doldurulur"):
 * okuyucunun üç sorusunun her birine tek sayılık cevap — stopaj oranı,
 * temettü beyan sınırı, beyan ayı. Ölçüm `Tax.module.css` → `.coverFacts`.
 *
 * SAYI UYDURULMAZ: stopaj `US_WITHHOLDING`, sınır ve beyan yılı takvim
 * paneliyle AYNI vergi yılının kaydından (`currentTaxYear`). Sınır önceki
 * yıldan taşınmışsa (`thresholdCarriedFrom`) künye taşınan yılı yazar.
 */
export function TaxCover({
  labels,
  locale,
  today,
  years,
}: {
  labels: TaxLabels;
  locale: Locale;
  today: string;
  years: Record<number, TaxYearRules>;
}) {
  const C = labels.cover;
  const rules = years[currentTaxYear(today, years)];
  const pct = (value: number) => (locale === "tr" ? `%${value}` : `${value}%`);
  const facts = [
    { name: C.withholding, value: pct(US_WITHHOLDING.w8ben) },
    {
      name: C.threshold.replace("{year}", String(rules.thresholdCarriedFrom ?? rules.year)),
      value: formatLira(rules.dividendThreshold, locale, 0),
    },
    { name: C.filing.replace("{year}", String(rules.year)), value: C.filingValue.replace("{filing}", String(rules.filingYear)) },
  ];
  return (
    <dl className={styles.coverFacts} aria-label={C.label}>
      {facts.map((fact) => (
        <div key={fact.name}>
          <dt>{fact.name}</dt>
          <dd className="numeral">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
