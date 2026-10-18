import {
  ArrowDown,
  ArrowsLeftRight,
  CalendarCheck,
  ChartLineUp,
  NotePencil,
  Percent,
  Sigma,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { Panel, buttonClass } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import {
  bracketIndexOf,
  INDEXATION_THRESHOLD,
  lotResult,
  progressiveTax,
  US_WITHHOLDING,
  type TaxYearRules,
} from "@/lib/tax";
import { formatPrice } from "@/lib/utils";
import type { TaxLabels } from "./TaxCalculator";
import { currentTaxYear } from "./TaxFiling";
import { PANEL_TITLE, TAX_EXAMPLE } from "./tax-ui";
import styles from "./Tax.module.css";

/** Sözlük cümlesindeki `{ad}` yer tutucularını doldurur. */
function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), text);
}

/** Adımların simgeleri, sırayla: gir, çevir, endeksle, topla, dilim, beyan. */
const STEP_ICONS = [NotePencil, ArrowsLeftRight, ChartLineUp, Sigma, Percent, CalendarCheck] as const;

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
 * ADIMLAR + ÇALIŞILMIŞ ÖRNEK (18 Ekim, sahibinin "çok daha görsel" isteği).
 * Eski hâl 1200 pikselden geniş ekranda altı sütunluk bir metin şeridiydi:
 * her sütun ~150 piksel, gövdeler beş-yedi satıra kırılıyordu ve okuyucu
 * adımları bir sayıya bağlayamıyordu. Şimdi solda simgeli dikey ray (adım
 * gövdeleri aynen duruyor), sağda aynı altı adımdan geçen tek bir örnek
 * satış: her satır adımının numarasını taşıyor, TL tutarlar sonuç kartının
 * şelalesiyle aynı ince çubuk dilinde (kulvar + şerit). Örnek sayılar
 * `lib/tax.ts`in KENDİ fonksiyonlarından geçiyor (`lotResult`,
 * `progressiveTax`), yani kural değişirse örnek de değişir. Kur ve endeks
 * varsayımsal; kart bunu başlığının yanında rozetle söylüyor (`TAX_EXAMPLE`).
 * Yerleşim ölçümü `.howGrid` kuralının yanında (Tax.module.css).
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
        <div className={styles.howGrid}>
          <ol className={styles.how} aria-label={H.label} data-motion-stagger>
            {steps.map((step, index) => {
              const Icon = STEP_ICONS[index];
              return (
                <li key={step.title} className={styles.howStep}>
                  <span className={styles.howNode} aria-hidden>
                    <Icon size={18} weight="duotone" />
                    <span className={styles.howNum}>{index + 1}</span>
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
              );
            })}
          </ol>
          <TaxExample labels={labels} locale={locale} rules={rules} />
        </div>
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

type ExampleRow = {
  step: number;
  name: string;
  value: string;
  note?: string;
  bar?: { from: number; span: number; tone: "cost" | "index" | "proceeds" | "up" };
  strong?: boolean;
};

/**
 * ÇALIŞILMIŞ ÖRNEK — bir satış, altı adım. Satırlar adımın numarasını
 * taşır (aynı adımın ikinci satırında numara tekrarlanmaz); çubuklar aynı
 * TL ölçeğinde, en büyük tutar satış bedeli.
 *
 * "Örnekle Dene" düz bir çapa: `data-tax-example` taşıyor, hesaplayıcının
 * belge dinleyicisi (TaxCalculator → "Kapaktaki üç soru") tıklamayı
 * yakalayıp aynı işlemi forma dolduruyor. JavaScript yokken yalnızca
 * hesaplayıcıya kaydırır.
 */
function TaxExample({ labels, locale, rules }: { labels: TaxLabels; locale: Locale; rules: TaxYearRules }) {
  const H = labels.how;
  const E = TAX_EXAMPLE;
  const lira = (value: number) => formatLira(Math.round(value), locale, 0);
  const usd = (value: number) => formatPrice(value, locale, { currency: true, digits: 0 });
  const rate = (value: number) => formatLira(value, locale, 2);

  const costUsd = E.quantity * E.buyPrice;
  const proceedsUsd = E.quantity * E.sellPrice;
  const lot = lotResult(
    {
      sellId: "ornek-s",
      buyId: "ornek-b",
      symbol: H.exampleSymbol,
      buyDate: E.buyDate,
      sellDate: E.sellDate,
      quantity: E.quantity,
      costUsd,
      proceedsUsd,
    },
    E.buyRate,
    E.sellRate,
    /* Oran iki endeksin bölümü; anlatım yalnızca oranı biliyor. */
    100,
    100 * E.indexRatio,
  );
  const costTl = lot.costTl ?? 0;
  const taxCostTl = lot.taxCostTl ?? 0;
  const proceedsTl = lot.proceedsTl ?? 0;
  const gainTl = lot.gainTl ?? 0;
  const tax = progressiveTax(gainTl, rules.brackets);
  const bracketRate = rules.brackets[bracketIndexOf(gainTl, rules.brackets)].ratePct;
  const scale = Math.max(costTl, taxCostTl, proceedsTl) || 1;
  const indexPct = Math.round((E.indexRatio - 1) * 100);

  const rows: ExampleRow[] = [
    { step: 1, name: labels.stepBuy, value: usd(costUsd), note: fill(H.exTradeNote, { qty: E.quantity, price: usd(E.buyPrice) }) },
    { step: 1, name: labels.stepSell, value: usd(proceedsUsd), note: fill(H.exTradeNote, { qty: E.quantity, price: usd(E.sellPrice) }) },
    {
      step: 2,
      name: labels.flowCostTl,
      value: lira(costTl),
      note: `${usd(costUsd)} × ${rate(E.buyRate)}`,
      bar: { from: 0, span: costTl / scale, tone: "cost" },
    },
    {
      step: 2,
      name: labels.flowProceeds,
      value: lira(proceedsTl),
      note: `${usd(proceedsUsd)} × ${rate(E.sellRate)}`,
      bar: { from: 0, span: proceedsTl / scale, tone: "proceeds" },
    },
    {
      step: 3,
      name: labels.flowIndexed,
      value: lira(taxCostTl),
      note: labels.flowIndexUp.replace("{pct}", String(indexPct)),
      bar: { from: costTl / scale, span: Math.max(0, taxCostTl - costTl) / scale, tone: "index" },
    },
    {
      step: 4,
      name: labels.flowGain,
      value: formatLira(Math.round(gainTl), locale, 0, true),
      note: fill(H.exGainNote, { amount: lira(proceedsTl - costTl) }),
      bar: { from: taxCostTl / scale, span: Math.max(0, gainTl) / scale, tone: "up" },
    },
    { step: 5, name: labels.estTax, value: lira(tax), note: fill(H.exTaxNote, { rate: bracketRate }), strong: true },
    {
      step: 6,
      name: H.exFile,
      value: fill(H.exFileValue, { filing: rules.filingYear }),
      note: fill(H.exFileNote, { half: lira(tax / 2) }),
    },
  ];

  return (
    <section className={styles.example} aria-labelledby="vergi-ornek">
      <div className={styles.exampleHead}>
        <h3 id="vergi-ornek" className={styles.exampleTitle}>
          {fill(H.exampleTitle, { qty: E.quantity, symbol: H.exampleSymbol })}
        </h3>
        <span className={styles.exampleTag}>{H.exampleTag}</span>
      </div>
      <p className={styles.exampleLead}>{H.exampleLead}</p>
      <ol className={styles.exampleRows} data-motion-stagger>
        {rows.map((row, index) => {
          const first = index === 0 || rows[index - 1].step !== row.step;
          return (
            <li
              key={`${row.step}-${row.name}`}
              className={styles.exampleRow}
              data-first={first || undefined}
              data-strong={row.strong || undefined}
            >
              <span className={styles.exampleStep} aria-hidden>
                {first ? row.step : ""}
              </span>
              <span className={styles.flowName}>{row.name}</span>
              <span className={`${styles.flowValue} numeral`}>{row.value}</span>
              {row.bar && (
                <span className={styles.track} aria-hidden>
                  <span
                    className={styles.bar}
                    data-tone={row.bar.tone}
                    style={{ "--from": row.bar.from, "--span": row.bar.span } as React.CSSProperties}
                  />
                </span>
              )}
              {row.note && <span className={styles.flowNote}>{row.note}</span>}
            </li>
          );
        })}
      </ol>
      <div className={styles.exampleFoot}>
        <a href="#satis" data-tax-example className={buttonClass({ variant: "ghost", size: "sm" })}>
          <Sparkle size={14} weight="duotone" aria-hidden />
          {H.exampleTry}
        </a>
        <span className={styles.help}>{H.exampleTryHint}</span>
      </div>
    </section>
  );
}
