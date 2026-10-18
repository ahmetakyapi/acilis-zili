import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpenText,
  ClockCounterClockwise,
  IdentificationCard,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { DataStamp, Panel } from "@/components/ui/primitives";
import { formatLira } from "@/lib/fx";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { progressiveTax, US_WITHHOLDING, type TaxYearRules } from "@/lib/tax";
import { MONEY_GAP } from "@/lib/utils";
import type { TaxLabels } from "./TaxCalculator";
import { currentTaxYear, dayMonth } from "./TaxFiling";
import { PANEL_TITLE } from "./tax-ui";
import styles from "./Tax.module.css";

/** Sözlük cümlesindeki `{ad}` yer tutucularını doldurur. */
function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), text);
}

/**
 * "2026'da Ne Değişti" kartının yılı. Kartın başlığı ve gövdesi sözlükte
 * 2026'yı ADIYLA anlatıyor; anahtar bilgiler de aynı yılın kaydından
 * (`TAX_YEARS[2026]`, önceki yıl `TAX_YEARS[2025]`) okunuyor. Takvimin yılı
 * (`currentTaxYear`) 2027'ye geçtiğinde kartın sayıları başlıktan kopmasın
 * diye buraya bağlanmadı; metin yenilenince bu sabit de yenilenir.
 */
const CHANGES_YEAR = 2026;

/**
 * "BİLMEN GEREKENLER" (18 Ekim, sahibinin "daha görsel" isteği).
 *
 * Eski hâl: solda iki sütunlu düz bir tarife tablosu, sağda üç kapalı
 * açılır satır. Okuyucu hiçbir bilgiyi açmadan göremiyordu ve tarife
 * "oran basamak basamak artar" fikrini değil, beş satırlık bir listeyi
 * anlatıyordu.
 *
 * Şimdi:
 *  - Solda tarife bir MERDİVEN: her dilim bir sütun, yüksekliği oranı
 *    (en üst oran = tam boy). Altında aynı tarifeden geçen tek bir örnek
 *    matrah: dilim dilim vergi, marjinal ile ortalama oran iki ince
 *    çizgide (CLAUDE.md "karşılaştırılan büyüklük bir de çizgi").
 *    Örnek matrah UYDURMA DEĞİL: tarifenin orta diliminin üst sınırı
 *    (2026'da 1.000.000 TL); vergi `progressiveTax` ile hesaplanıyor.
 *  - Sağda üç kart: anahtar bilgi kapalıyken de görünür (stopaj oranları
 *    `US_WITHHOLDING`, 1042-S günü takvimle aynı tarihten, tarife ve sınırın
 *    önceki yıla göre değişimi `TaxYearRules`tan), uzun metin "Ayrıntılar"
 *    altında. Kaynaklar artık kapalı değil: beş bağlantı tek bakışta.
 *
 * Takvim bu panelde TEKRARLANMADI: aynı tarihler hemen üstteki "Ne Zaman,
 * Nereye" panelinde; W-8BEN kartı oraya bağlanıyor.
 */
export function TaxGuide({
  labels,
  dataLabels,
  locale,
  today,
  years,
}: {
  labels: TaxLabels;
  dataLabels: Dictionary["data"];
  locale: Locale;
  today: string;
  years: Record<number, TaxYearRules>;
}) {
  const L = labels;
  const S = L.sections;
  const G = L.guide;
  const year = currentTaxYear(today, years);
  const filing = years[year].filingYear;
  const money = (value: number) => formatLira(value, locale, 0);
  const pct = (value: number) => (locale === "tr" ? `%${value}` : `${value}%`);

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

  const changes = years[CHANGES_YEAR];
  const before = years[CHANGES_YEAR - 1];
  const changeFacts =
    changes && before
      ? [
          { label: G.firstBracket, now: changes.brackets[0]?.upTo, was: before.brackets[0]?.upTo },
          { label: G.dividendLimit, now: changes.dividendThreshold, was: before.dividendThreshold },
        ]
      : [];

  return (
    <Panel aria-labelledby="vergi-bilmen">
      <div className={styles.panelHead}>
        <h2 id="vergi-bilmen" className={PANEL_TITLE}>
          {L.guideTitle}
        </h2>
      </div>
      <div className={styles.guideGrid}>
        <TariffStairs labels={L} locale={locale} year={year} rules={years[year]} />

        <div className={styles.guideCards} data-motion-stagger>
          {/* W-8BEN: iki oran yan yana ve aynı ölçekte iki ince çizgi; 1042-S
              günü takvim panelinin düğümüyle aynı tarih ve aynı cümle. */}
          <article className={styles.guideCard}>
            <GuideCardHead icon={<IdentificationCard size={20} weight="duotone" />} title={S.w8Title} />
            <dl className={styles.facts} data-cols="3">
              {[
                { label: G.w8With, value: US_WITHHOLDING.w8ben },
                { label: G.w8Without, value: US_WITHHOLDING.none },
              ].map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd className="numeral">{pct(fact.value)}</dd>
                  <span className={styles.factTrack} aria-hidden data-motion-track>
                    <span
                      className={styles.factBar}
                      data-motion-draw="line"
                      style={{ width: `${(fact.value / US_WITHHOLDING.none) * 100}%` }}
                    />
                  </span>
                </div>
              ))}
              <div>
                <dt>{G.formBy}</dt>
                <dd className={styles.factDate}>
                  {L.filing.formDate.replace("{date}", dayMonth(`${filing}-03-15`, locale))}
                </dd>
                <a href="#takvim" className={styles.inlineLink}>
                  {G.calendarLink}
                  <ArrowDown size={13} weight="bold" aria-hidden />
                </a>
              </div>
            </dl>
            <details className={styles.more}>
              <summary>
                {G.details}
                <Plus size={14} weight="bold" aria-hidden />
              </summary>
              <p>{S.w8Body}</p>
            </details>
          </article>

          <article className={styles.guideCard}>
            <GuideCardHead icon={<ClockCounterClockwise size={20} weight="duotone" />} title={S.changesTitle} />
            {changeFacts.length > 0 && (
              <dl className={styles.facts} data-cols="2">
                {changeFacts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd className="numeral">{fact.now ? money(fact.now) : "—"}</dd>
                    {fact.was ? (
                      <span className={styles.factWas}>
                        <span className="numeral">{fill(G.changesFrom, { year: CHANGES_YEAR - 1, value: money(fact.was) })}</span>
                      </span>
                    ) : null}
                  </div>
                ))}
              </dl>
            )}
            <details className={styles.more}>
              <summary>
                {G.details}
                <Plus size={14} weight="bold" aria-hidden />
              </summary>
              <p>{S.changesBody}</p>
            </details>
          </article>

          <article className={styles.guideCard}>
            <GuideCardHead
              icon={<BookOpenText size={20} weight="duotone" />}
              title={S.sourcesTitle}
              tag={fill(G.sourcesCount, { count: sources.length })}
            />
            <ul className={styles.sourceList}>
              {sources.map(([label, href]) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noreferrer noopener" className={styles.source}>
                    <span className="min-w-0">
                      <span className={styles.sourceName}>{label}</span>
                      <span className={styles.sourceHost}>{new URL(href).hostname.replace(/^www\./, "")}</span>
                    </span>
                    <ArrowUpRight size={14} weight="bold" className={styles.sourceArrow} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
      {/* Künye panelin dibinde, hairline ile: kaynak adıyla, saat YOK.
          Kurlar ve endeks tarayıcıda, hesap anında çekiliyor; sunucunun
          bir "güncellendi" anı yazması, olmayan bir çekim anını varmış
          gibi gösterirdi. UYARI SAYFANIN DİBİNDE DE (29 Eylül, sahibinin
          kararı): hesap yapmadan yalnızca adımları ve tarifeyi okuyan için
          de sayfa bir tahmin olduğunu söyleyerek bitsin. */}
      <div className="mt-6 flex flex-col gap-2 border-t border-line px-4 py-3 sm:px-7">
        <p className="text-small leading-relaxed text-muted">
          <strong className="font-semibold text-strong">{L.notAdvice}.</strong> {L.notAdviceFoot}
        </p>
        <DataStamp source={L.dataNote} locale={locale} labels={dataLabels} />
      </div>
    </Panel>
  );
}

function GuideCardHead({ icon, title, tag }: { icon: React.ReactNode; title: string; tag?: string }) {
  return (
    <div className={styles.guideCardHead}>
      <span className={styles.guideIcon} aria-hidden>
        {icon}
      </span>
      <h3 className={styles.guideCardTitle}>{title}</h3>
      {tag && <span className={styles.exampleTag}>{tag}</span>}
    </div>
  );
}

/** "190 B ₺" / "₺190K" — dar ekranda eksenin kısa hâli. */
function compactLira(value: number, locale: Locale): string {
  const body = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
  return locale === "tr" ? `${body}${MONEY_GAP}₺` : `₺${body}`;
}

/**
 * TARİFE MERDİVENİ.
 *
 * Sütunlar EŞİT genişlikte (sıra ölçeği), yükseklik oran / en üst oran.
 * Gelir ekseni doğrusal çizilmedi: 2026'da dördüncü dilim 4.300.000 TL
 * genişliğinde, ilk dilimin 22 katı; ilk üç basamak birkaç piksele
 * sıkışırdı — sonuçtaki `BracketScale` aynı gerekçeyle eşit basamaklı.
 * Eksen etiketleri her sütunun ALT sınırı, sütunun sol kenarında; dar
 * kapta (400 pikselin altı, ölçüm Tax.module.css'te) kısa yazım
 * ("190 B ₺"); tam aralık ekran okuyucu metninde.
 *
 * Basamak dili ince: sütun `--line-soft` tonunda bir blok, tepesinde
 * 5 piksellik şerit (kulvar dili). Örnek matrahın geçtiği dilimler mavi
 * tonda — sonuç kartındaki "Tarifedeki Yerin" ölçeğiyle aynı renk anlamı
 * (matrahın kapladığı dilim).
 */
function TariffStairs({
  labels,
  locale,
  year,
  rules,
}: {
  labels: TaxLabels;
  locale: Locale;
  year: number;
  rules: TaxYearRules;
}) {
  const G = labels.guide;
  const brackets = rules.brackets;
  const money = (value: number) => formatLira(value, locale, 0);
  const pct = (value: number) => {
    const body = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 2 }).format(value);
    return locale === "tr" ? `%${body}` : `${body}%`;
  };
  const top = Math.max(...brackets.map((bracket) => bracket.ratePct));
  const lowerOf = (index: number) => (index === 0 ? 0 : (brackets[index - 1].upTo ?? 0));

  /* Örnek matrah: orta dilimin üst sınırı (2026: 1.000.000 TL). */
  const sampleIndex = Math.floor((brackets.length - 1) / 2);
  const sample = brackets[sampleIndex]?.upTo ?? 0;
  const tax = progressiveTax(sample, brackets);
  const effective = sample > 0 ? (tax / sample) * 100 : 0;
  const marginal = brackets[sampleIndex]?.ratePct ?? 0;
  const slices = brackets.slice(0, sampleIndex + 1).map((bracket, index) => {
    const amount = Math.min(sample, bracket.upTo ?? sample) - lowerOf(index);
    return { rate: bracket.ratePct, amount, tax: (amount * bracket.ratePct) / 100 };
  });

  return (
    <section className={styles.tariff} aria-labelledby="vergi-tarife">
      <h3 id="vergi-tarife" className={styles.subTitle}>
        {labels.bracketTableTitle.replace("{year}", String(year))}
      </h3>
      <p className={styles.tariffLead}>{G.tariffLead}</p>

      <figure className={styles.stairsFigure}>
        <ol
          className={styles.stairs}
          style={{ "--n": brackets.length } as React.CSSProperties}
          aria-label={fill(G.ladderLabel, { year, count: brackets.length })}
        >
          {brackets.map((bracket, index) => {
            const lower = lowerOf(index);
            return (
              <li key={index} className={styles.stair} data-sample={index <= sampleIndex || undefined}>
                <span className="sr-only">
                  {bracket.upTo === null
                    ? fill(G.sliceOver, { from: money(lower), rate: bracket.ratePct })
                    : fill(G.sliceRange, { from: money(lower), to: money(bracket.upTo), rate: bracket.ratePct })}
                </span>
                <span className={styles.stairPlot} aria-hidden>
                  <span className={`${styles.stairRate} numeral`}>{pct(bracket.ratePct)}</span>
                  <span
                    className={styles.stairBlock}
                    data-motion-draw="bar"
                    style={{ "--h": bracket.ratePct / top } as React.CSSProperties}
                  />
                </span>
                <span className={styles.stairAxis} aria-hidden>
                  <span className={`${styles.stairFull} numeral`}>{money(lower)}</span>
                  <span className={`${styles.stairShort} numeral`}>{lower === 0 ? money(0) : compactLira(lower, locale)}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <figcaption className={styles.stairsKey}>
          <span>
            <i data-tone="sample" aria-hidden />
            {G.sampleKey}
          </span>
          <span>
            <i aria-hidden />
            {G.restKey}
          </span>
        </figcaption>
      </figure>

      {/* Örnek: dilim dilim vergi, sonra iki oran aynı ölçekte (0 – en üst
          oran). Ortalama oranın marjinalden düşük olduğu çizgiden okunuyor. */}
      {sample > 0 && (
        <div className={styles.sample}>
          <h4 className={styles.sampleTitle}>{fill(G.sampleTitle, { amount: money(sample) })}</h4>
          <p className={styles.sampleLead}>{fill(G.sampleLead, { count: slices.length })}</p>
          <ol className={styles.slices}>
            {slices.map((slice) => (
              <li key={slice.rate}>
                <span className={styles.sliceRate}>{fill(G.sliceName, { rate: slice.rate })}</span>
                <span className={`${styles.sliceAmount} numeral`}>
                  {money(slice.amount)} × {pct(slice.rate)}
                </span>
                <span className={`${styles.sliceTax} numeral`}>{money(slice.tax)}</span>
              </li>
            ))}
            <li data-total>
              <span className={styles.sliceRate}>{G.sliceTotal}</span>
              <span />
              <span className={`${styles.sliceTax} numeral`}>{money(tax)}</span>
            </li>
          </ol>
          <dl className={styles.rates}>
            {[
              { label: G.marginal, hint: G.marginalHint, value: marginal, tone: "marginal" },
              { label: G.effective, hint: G.effectiveHint, value: effective, tone: "effective" },
            ].map((rate) => (
              <div key={rate.tone}>
                <dt>{rate.label}</dt>
                <dd className="numeral">{pct(Math.round(rate.value * 100) / 100)}</dd>
                <span className={styles.factTrack} aria-hidden data-motion-track>
                  <span
                    className={styles.factBar}
                    data-tone={rate.tone}
                    data-motion-draw="line"
                    style={{ width: `${(rate.value / top) * 100}%` }}
                  />
                </span>
                <span className={styles.rateHint}>{rate.hint}</span>
              </div>
            ))}
          </dl>
          <p className={styles.sampleLead}>{G.sampleNote}</p>
        </div>
      )}

      <p className="mt-3 text-small leading-relaxed text-muted">
        {labels.how.tariffSource.replace("{source}", rules.source[locale === "tr" ? "tr" : "en"])}
      </p>
      <a href="#satis" className={styles.inlineLink}>
        {G.calcLink}
        <ArrowUp size={13} weight="bold" aria-hidden />
      </a>
    </section>
  );
}
