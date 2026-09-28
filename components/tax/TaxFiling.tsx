import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ChartLineUp,
  Coins,
  FileCsv,
  FileText,
  IdentificationCard,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel } from "@/components/ui/primitives";
import { dayNumber, formatIsoDate } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import { TAX_YEAR_LIST, TAX_YEARS } from "@/lib/tax";
import type { TaxLabels } from "./TaxCalculator";
import { PANEL_TITLE } from "./tax-ui";
import styles from "./Tax.module.css";

/* --------------------------------------------------------------------------
   Kapak: üç soru
   -------------------------------------------------------------------------- */

/**
 * Kapağın sağ yanı: okuyucunun üç sorusu, üç bağlantı.
 *
 * Eski kapak yalnızca başlık ve bir açıklamaydı; okuyucu ilk ekranda ne
 * yapacağını değil, sayfanın ne olduğunu öğreniyordu. Şimdi ilk ekran
 * sorunun kendisi. İki satır hesaplayıcıya iniyor ve SEKMEYİ de seçiyor
 * (`data-tax-path`, dinleyici TaxCalculator'da); üçüncüsü takvime.
 *
 * Sunucuda çizilir ve düz `#çapa` bağlantısıdır: JavaScript yokken de
 * doğru yere kaydırır.
 */
export function TaxPaths({ labels }: { labels: TaxLabels }) {
  const P = labels.paths;
  const items = [
    { href: "#satis", path: "sale", icon: ChartLineUp, title: P.saleTitle, hint: P.saleHint },
    { href: "#temettu", path: "dividend", icon: Coins, title: P.dividendTitle, hint: P.dividendHint },
    { href: "#takvim", path: undefined, icon: CalendarCheck, title: P.filingTitle, hint: P.filingHint },
  ] as const;
  return (
    <nav aria-label={P.label}>
      <ul className={styles.paths}>
        {items.map((item, index) => (
          <li key={item.href} style={{ "--i": index } as React.CSSProperties}>
            <a href={item.href} data-tax-path={item.path} className={styles.path}>
              <span className={styles.pathIcon} aria-hidden>
                <item.icon size={22} weight="duotone" />
              </span>
              <span className="min-w-0">
                <span className={styles.pathTitle}>{item.title}</span>
                <span className={styles.pathHint}>{item.hint}</span>
              </span>
              <ArrowRight size={18} weight="bold" className={styles.pathArrow} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* --------------------------------------------------------------------------
   Takvim, yer ve belgeler
   -------------------------------------------------------------------------- */

/** Takvimde işlem yılı sütunu iki birim, öbür dört düğüm birer birim. */
const TIMELINE_UNITS = 6;
const NODE_AT = [0, 2, 3, 4, 5].map((unit) => unit / TIMELINE_UNITS);

/**
 * Hangi yılın takvimi: beyan sürecinin SON günü (ikinci taksit) henüz
 * geçmemiş en eski vergi yılı. 28 Eylül 2026'da 2025 gelirinin ikinci
 * taksidi (31 Temmuz 2026) geçti, yani ekran 2026 gelirini gösteriyor.
 */
function currentTaxYear(today: string): number {
  const ascending = [...TAX_YEAR_LIST].sort((a, b) => a - b);
  return ascending.find((year) => `${TAX_YEARS[year].filingYear}-07-31` >= today) ?? TAX_YEAR_LIST[0];
}

/**
 * Bugünün raydaki yeri: iki düğüm arasında gerçek günle doğrusal. Sütunlar
 * eşit değil ama her aralığın İÇİ orantılı, yani iğne yalan söylemiyor —
 * yalnızca aralıkların boyu ölçekli değil (Mart'taki üç tarih yan yana
 * sığsın diye). İlk düğümden önce 0, son düğümden sonra son düğüm.
 */
function todayAt(today: string, dates: readonly string[]): number {
  const t = dayNumber(today);
  const days = dates.map(dayNumber);
  if (t <= days[0]) return 0;
  for (let i = 1; i < days.length; i += 1) {
    if (t <= days[i]) {
      const share = (t - days[i - 1]) / (days[i] - days[i - 1]);
      return NODE_AT[i - 1] + share * (NODE_AT[i] - NODE_AT[i - 1]);
    }
  }
  return NODE_AT[NODE_AT.length - 1];
}

function dayMonth(date: string, locale: Locale): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * "Ne zaman, nereye, hangi belgeyle" — okuyucunun üçüncü sorusu.
 *
 * Eski sayfada bu cevap "Bilmen Gerekenler" altında dördüncü paragraftı.
 * Şimdi kendi paneli: üstte takvim, altta iki sütun (nereye, belgeler).
 * Tarihler UYDURULMADI: beyan 1-31 Mart, taksitler 31 Mart ve 31 Temmuz,
 * 1042-S 15 Mart — hepsi sayfanın önceki metninden ve kaynaklarından
 * (lib/tax.ts başı, [IRS] ve [MSİ]). Yıl vergi kurallarından geliyor.
 */
export function TaxFiling({ labels, locale, today }: { labels: TaxLabels; locale: Locale; today: string }) {
  const F = labels.filing;
  const year = currentTaxYear(today);
  const filing = TAX_YEARS[year].filingYear;
  const fill = (text: string) => text.replace("{year}", String(year)).replace("{filing}", String(filing));

  const miles = [
    { date: `${year}-01-01`, name: F.tradeYear, when: F.tradeYearDate.replace("{year}", String(year)) },
    { date: `${filing}-03-01`, name: F.open, when: formatIsoDate(`${filing}-03-01`, locale, "long") },
    { date: `${filing}-03-15`, name: F.form, when: F.formDate.replace("{date}", dayMonth(`${filing}-03-15`, locale)) },
    { date: `${filing}-03-31`, name: F.deadline, when: formatIsoDate(`${filing}-03-31`, locale, "long") },
    { date: `${filing}-07-31`, name: F.second, when: formatIsoDate(`${filing}-07-31`, locale, "long") },
  ];
  const at = todayAt(today, miles.map((mile) => mile.date));
  const passed = miles.filter((mile) => mile.date <= today).length;
  const todayText = formatIsoDate(today, locale);

  const docs = [
    { icon: Receipt, name: F.docStatement, body: F.docStatementBody },
    { icon: FileText, name: F.docForm, body: F.docFormBody },
    { icon: IdentificationCard, name: F.docW8, body: F.docW8Body, href: "/rehber/w-8ben", link: F.readW8 },
    { icon: FileCsv, name: F.docCsv, body: F.docCsvBody },
  ];

  return (
    <Panel id="takvim" className={styles.calc}>
      <div className={styles.panelHead}>
        <h2 className={PANEL_TITLE}>{F.title}</h2>
      </div>
      <div className="flex flex-col gap-8 px-4 pb-6 pt-3 sm:px-7 sm:pb-8">
        <p className="max-w-3xl text-sm leading-relaxed text-body">{fill(F.lead)}</p>

        <section aria-label={fill(F.timelineLabel)}>
          <div className={styles.timelineWrap} style={{ "--today": at } as React.CSSProperties}>
            {/* Ray ve iğne süs değil ölçü: dolgunun ucu bugünün yeri. */}
            <span className={styles.rail} aria-hidden>
              <span className={styles.railFill} data-motion-draw="line" />
            </span>
            <span className={styles.todayFloat}>
              <span className={styles.todayPin}>
                {F.today} · {todayText}
              </span>
            </span>
            <ol className={styles.timeline}>
              {miles.map((mile, index) => (
                <FragmentWithToday key={mile.date} showToday={index === passed} label={`${F.today} · ${todayText}`}>
                  <li className={styles.mile} data-done={mile.date <= today}>
                    <span className={styles.mileDot} aria-hidden />
                    <span className={styles.mileName}>{mile.name}</span>
                    <span className={styles.mileDate}>{mile.when}</span>
                  </li>
                </FragmentWithToday>
              ))}
              {passed === miles.length && (
                <li className={styles.todayRow}>
                  <span className={styles.todayPin}>{`${F.today} · ${todayText}`}</span>
                </li>
              )}
            </ol>
          </div>
          <p className="mt-6 text-small leading-relaxed text-muted">{F.installments}</p>
        </section>

        <div className={styles.filingGrid}>
          <section>
            <h3 className={styles.subTitle}>{F.whereTitle}</h3>
            <p className="text-sm leading-relaxed text-body">{F.whereBody}</p>
            <div className="mt-2 flex flex-wrap gap-x-5">
              <a
                href="https://hazirbeyan.gib.gov.tr"
                target="_blank"
                rel="noreferrer noopener"
                className={styles.inlineLink}
              >
                {F.whereLink}
                <ArrowUpRight size={13} weight="bold" aria-hidden />
              </a>
              <Link href="/rehber/yurt-disi-hisse-vergisi" className={styles.inlineLink}>
                {F.readGuide}
                <ArrowRight size={13} weight="bold" aria-hidden />
              </Link>
            </div>
          </section>
          <section>
            <h3 className={styles.subTitle}>{F.docsTitle}</h3>
            <ul className={styles.checklist} data-motion-stagger>
              {docs.map((doc) => (
                <li key={doc.name} className={styles.check}>
                  <span className={styles.checkIcon} aria-hidden>
                    <doc.icon size={16} weight="duotone" />
                  </span>
                  <span className="min-w-0">
                    <span className={styles.checkName}>{doc.name}</span>
                    <span className={styles.checkBody}>{doc.body}</span>
                    {doc.href && (
                      <Link href={doc.href} className={styles.inlineLink}>
                        {doc.link}
                        <ArrowRight size={13} weight="bold" aria-hidden />
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Telefonda "Bugün" satırı, geçmiş düğümlerle gelecek düğümlerin ARASINA
 * girer (sırası tarihten). Genişte bu satır gizli; yerini raydaki iğne
 * alıyor. İkisi aynı anda görünmüyor, yani ekran okuyucu tek birini duyar.
 */
function FragmentWithToday({
  showToday,
  label,
  children,
}: {
  showToday: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {showToday && (
        <li className={styles.todayRow}>
          <span className={styles.todayPin}>{label}</span>
        </li>
      )}
      {children}
    </>
  );
}
