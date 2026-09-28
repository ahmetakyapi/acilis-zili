import { ArrowDown } from "@phosphor-icons/react/dist/ssr";
import { Panel, buttonClass } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import { INDEXATION_THRESHOLD, US_WITHHOLDING, type TaxYearRules } from "@/lib/tax";
import type { TaxLabels } from "./TaxCalculator";
import { currentTaxYear } from "./TaxFiling";
import { PANEL_TITLE } from "./tax-ui";
import styles from "./Tax.module.css";

/** Sözlük cümlesindeki `{ad}` yer tutucularını doldurur. */
function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), text);
}

/**
 * "NASIL HESAPLANIR" — hesaplayıcıdan ÖNCE gelen anlatım (29 Eylül).
 *
 * Sahibinin isteği: sayfa önce nasıl yapıldığını anlatsın, sonra altta
 * yapılmaya başlansın. Eski sayfada kapaktan hemen sonra boş bir form
 * duruyordu ve kuralların kendisi en altta, kapalı açılır satırlardaydı
 * ("Kur ve Endeksleme Kuralı", "Hangi Alış Satılmış Sayılır"). O iki satır
 * buraya taşındı ve oradan kaldırıldı: aynı kural iki yerde yazılmıyor.
 *
 * SAYI UYDURULMAZ. Adımlardaki her eşik koddaki sabitten okunuyor:
 * endeksleme eşiği `INDEXATION_THRESHOLD`, stopaj `US_WITHHOLDING`, dilimler
 * ve temettü sınırı o vergi yılının `TaxYearRules` kaydı. Yıl, takvim
 * panelininkiyle aynı (`currentTaxYear`) — iki panel farklı yıl anlatmasın.
 * Sınır önceki yıldan taşınmışsa (`thresholdCarriedFrom`) cümle taşınan
 * yılı adıyla yazıyor.
 *
 * Kutu içinde kutu yok: adımlar panelin hairline ritminde, numaralı düğüm
 * ve ince bir rayla bağlı. Genişte yatay şerit, dar ekranda dikey liste.
 */
export function TaxHow({
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
  const H = labels.how;
  const year = currentTaxYear(today, years);
  const rules = years[year];
  const rates = rules.brackets.map((bracket) => bracket.ratePct);
  const money = (value: number) => formatLira(value, locale, 0);

  const steps: { title: string; body: string; link?: { href: string; text: string } }[] = [
    { title: H.step1Title, body: H.step1Body },
    { title: H.step2Title, body: H.step2Body },
    { title: H.step3Title, body: fill(H.step3Body, { pct: Math.round(INDEXATION_THRESHOLD * 100) }) },
    {
      title: H.step4Title,
      body: fill(H.step4Body, {
        threshold: money(rules.dividendThreshold),
        thresholdYear: rules.thresholdCarriedFrom ?? year,
      }),
    },
    {
      title: H.step5Title,
      body: fill(H.step5Body, {
        first: money(rules.brackets[0]?.upTo ?? 0),
        min: Math.min(...rates),
        max: Math.max(...rates),
        w8: US_WITHHOLDING.w8ben,
        none: US_WITHHOLDING.none,
      }),
    },
    {
      title: H.step6Title,
      body: fill(H.step6Body, { year, filing: rules.filingYear }),
      link: { href: "#takvim", text: H.step6Link },
    },
  ];

  return (
    <Panel id="nasil" className={styles.calc} aria-labelledby="vergi-nasil">
      <div className={styles.panelHead}>
        <h2 id="vergi-nasil" className={PANEL_TITLE}>
          {H.title}
        </h2>
      </div>
      <div className="px-4 pb-6 pt-3 sm:px-7 sm:pb-7">
        <p className="max-w-3xl text-sm leading-relaxed text-body">{fill(H.lead, { year })}</p>
        <ol className={styles.how} aria-label={H.label} data-how-steps data-motion-stagger>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.howStep}>
              <span className={styles.howNode} aria-hidden>
                {index + 1}
              </span>
              <h3 className={styles.howTitle}>{step.title}</h3>
              <p className={styles.howBody}>{step.body}</p>
              {step.link && (
                <a href={step.link.href} className={styles.inlineLink}>
                  {step.link.text}
                  <ArrowDown size={13} weight="bold" aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ol>
        {/* Anlatımın sonu hesaplayıcının başı: düz çapa, JavaScript
            yokken de kaydırır. Sekme SEÇMEZ (`data-tax-path` yok) — okuyucu
            hangi hesabı yapacağını hesaplayıcının kendi anahtarında seçiyor. */}
        <div className={styles.howFoot}>
          <a href="#satis" className={buttonClass({ size: "md" })}>
            {H.start}
            <ArrowDown size={16} weight="bold" aria-hidden />
          </a>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Tarifenin durağan hâli — sayfanın dibinde, başvuru için.
 *
 * Sonuçtaki `BracketTable` matrahın düştüğü dilimi işaretliyor ve yalnızca
 * bir hesap varken görünüyor; bu tablo hesaptan bağımsız, iki sütun (aralık,
 * oran). Aynı tablo sınıfını kullanıyor, satırların hepsi "ulaşılmış" tonda.
 */
export function TaxTariff({
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
  const year = currentTaxYear(today, years);
  const rules = years[year];
  const money = (value: number) => formatLira(value, locale, 0);
  return (
    <section className={styles.tariff} aria-labelledby="vergi-tarife">
      <h3 id="vergi-tarife" className={styles.subTitle}>
        {labels.bracketTableTitle.replace("{year}", String(year))}
      </h3>
      <table className={`${styles.bracketTable} ${styles.tariffTable}`}>
        <thead>
          <tr>
            <th scope="col">{labels.bracketRange}</th>
            <th scope="col">{labels.bracketRate}</th>
          </tr>
        </thead>
        <tbody>
          {rules.brackets.map((bracket, index) => {
            const lower = index === 0 ? 0 : (rules.brackets[index - 1].upTo ?? 0);
            return (
              <tr key={index} data-reached>
                <th scope="row" className="numeral">
                  {bracket.upTo === null
                    ? labels.bracketOver.replace("{amount}", money(lower))
                    : `${money(lower)} – ${money(bracket.upTo)}`}
                </th>
                <td className="numeral">{locale === "tr" ? `%${bracket.ratePct}` : `${bracket.ratePct}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-small leading-relaxed text-muted">
        {labels.how.tariffSource.replace("{source}", rules.source[locale === "tr" ? "tr" : "en"])}
      </p>
    </section>
  );
}
