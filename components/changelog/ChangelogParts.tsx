import { ArrowRight, ArrowUpRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { entryAnchor, entryDateLabel, monthAnchor, type ChangeEntry, type ChangeItem, type ChangeMonth } from "@/lib/changelog";
import { formatIsoMonth } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import type { ChangelogLabels } from "@/lib/i18n/dictionaries/changelog";
import { withLocale } from "@/lib/i18n/routing";
import fold from "@/components/ui/FoldToggle.module.css";
import styles from "./Changelog.module.css";

/** Telefonda öne çıkan sürümün açık gelen blok sayısı — kalanı katlı. */
const PHONE_OPEN_BLOCKS = 6;

/* Sunucu bileşenleri — istemci JS'i yok. Tek istemci parçaları rozet,
   okundu işareti ve katlamadaki çapayı açan küçük dinleyici (aynı klasör). */

/** "{n} Giriş" / "1 Entry" — İngilizcede tekil ayrı. */
function countLabel(n: number, many: string, one: string): string {
  return (n === 1 ? one : many).replace("{n}", String(n));
}

const intlLocale = (locale: Locale) => (locale === "tr" ? "tr-TR" : "en-US");

/** "22 Ekim" — yıl ay başlığında zaten yazıyor. */
function dayMonth(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function weekday(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

/** Maddenin "Dene" bağlantısı — dış adres (Telegram) yeni sekmede. */
function TryLink({ item, label, locale }: { item: ChangeItem; label: string; locale: Locale }) {
  if (!item.href) return null;
  const aria = `${label}: ${item.title}`;
  if (/^https?:\/\//.test(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={aria} className={`tap-44 ${styles.tryLink}`}>
        {label}
        <ArrowUpRight weight="bold" size={12} aria-hidden />
      </a>
    );
  }
  return (
    <Link href={withLocale(item.href, locale)} prefetch={false} aria-label={aria} className={`tap-44 ${styles.tryLink}`}>
      {label}
      <ArrowRight weight="bold" size={12} aria-hidden />
    </Link>
  );
}

function KindTag({ item, L }: { item: ChangeItem; L: ChangelogLabels }) {
  return (
    <span className={styles.kind} data-kind={item.kind}>
      {L.kind[item.kind]}
    </span>
  );
}

/**
 * EN SON SÜRÜM — sayfanın ana görseli (ekran düzeni 3). Başlık izinli tek
 * degrade yer (kısa display başlık); maddeler `--surface` tonunda bloklar,
 * çerçevesiz. Panelin dibinde künye: bu listenin neyi kapsadığı.
 */
export function LatestRelease({ entry, locale, L }: { entry: ChangeEntry; locale: Locale; L: ChangelogLabels }) {
  const headingId = "yenilikler-son-surum";
  return (
    <Panel id={entryAnchor(entry.date)} aria-labelledby={headingId}>
      <div className={styles.latestHead}>
        {/* Çok satırlı manşet: degrade satır satır (`data-ink="lines"`,
            globals.css); kutu boyunca yayılınca telefonda ikinci satır başka
            tonda başlıyordu. */}
        <h2 id={headingId} data-ink="lines" className="text-heading font-bold tracking-[-0.02em]">
          <span className="ink-line">{entry.title}</span>
        </h2>
        <p className={styles.latestMeta}>
          <span>{L.latestTitle}</span>
          <time dateTime={entry.date}>{entryDateLabel(entry, locale)}</time>
          <span>{countLabel(entry.items.length, L.itemCount, L.itemCountOne)}</span>
        </p>
        <p className={styles.latestSummary}>{entry.summary}</p>
      </div>
      {/* TELEFONDA İLK ALTI BLOK (25 Ekim, ölçüldü): on beş blok tek sütunda
          390'da ~4.000 piksel ve zaman çizelgesi ekranın çok altında
          kalıyordu. Kalanlar sunucuda yine çiziliyor, `data-more` ile katlı;
          JS'siz onay kutusu + etiket (FoldToggle kalıbı, aynı stil). 640'tan
          itibaren katlama yok. FoldToggle'ın kendisi kullanılmadı: geniş
          ekranda `display:revert` blokların `flex`ini liste öğesine
          çeviriyordu. */}
      <div className={fold.fold}>
        {entry.items.length > PHONE_OPEN_BLOCKS && (
          <input type="checkbox" id="yenilikler-son-tumu" className={`sr-only ${fold.foldInput} ${styles.moreToggle}`} />
        )}
        <ul className={styles.latestGrid}>
          {entry.items.map((item, index) => (
            <li key={item.title} className={styles.block} data-more={index >= PHONE_OPEN_BLOCKS || undefined}>
              <span className={styles.itemHead}>
                <KindTag item={item} L={L} />
              </span>
              <h3 className={styles.blockTitle}>{item.title}</h3>
              <p className={styles.blockBody}>{item.body}</p>
              <TryLink item={item} label={L.try} locale={locale} />
            </li>
          ))}
        </ul>
        {entry.items.length > PHONE_OPEN_BLOCKS && (
          <label htmlFor="yenilikler-son-tumu" className={`${fold.foldButton} ${styles.moreButton}`}>
            <span className={fold.foldMore}>
              {L.showMore.replace("{n}", String(entry.items.length - PHONE_OPEN_BLOCKS))}
            </span>
            <span className={fold.foldLess}>{L.showLess}</span>
            <CaretDown className={fold.foldIcon} size={14} weight="bold" aria-hidden />
          </label>
        )}
      </div>
      <p className={styles.note}>{L.footnote}</p>
    </Panel>
  );
}

/** Bir ay — panel, `h2` ay adı, girişler gün sütunuyla. */
export function MonthPanel({ month, locale, L }: { month: ChangeMonth; locale: Locale; L: ChangelogLabels }) {
  const title = formatIsoMonth(month.month, locale);
  return (
    <Panel id={monthAnchor(month.month)} aria-label={title} className={styles.month}>
      <PanelHeader
        title={title}
        meta={countLabel(month.entries.length, L.entryCount, L.entryCountOne)}
        className="border-b border-line-soft"
      />
      <ol className={styles.entries}>
        {month.entries.map((entry) => (
          <li key={entry.date} id={entryAnchor(entry.date)} className={styles.entry}>
            <p className={styles.when}>
              <time dateTime={entry.date} className={styles.whenDay}>
                {entry.from ? entryDateLabel(entry, locale).replace(/,? \d{4}$/, "") : dayMonth(entry.date, locale)}
              </time>
              <span className={styles.whenWeek}>{weekday(entry.date, locale)}</span>
            </p>
            <div className="min-w-0">
              <h3 data-ink="lines" className={styles.entryTitle}>
                <span className="ink-line">{entry.title}</span>
              </h3>
              <p className={styles.entrySummary}>{entry.summary}</p>
              <ul className={styles.items}>
                {entry.items.map((item) => (
                  <li key={item.title} className={styles.item}>
                    <span className={styles.itemHead}>
                      <KindTag item={item} L={L} />
                      <span className={styles.itemTitle}>{item.title}</span>
                    </span>
                    <span className={styles.itemBody}>{item.body}</span>
                    <TryLink item={item} label={L.try} locale={locale} />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/**
 * "DAHA ESKİ" — JS'siz yerli `<details>` (bölüm açılışı globals.css'teki
 * `::details-content` geçişiyle). Kapalıyken bile içerik sunucu HTML'inde:
 * sayfa içi arama ve arama motoru eski girişleri görüyor. Açıldığında
 * bastığın yerden aşağı uzar (`ExpandInPlace`, kökte bağlı).
 */
export function OlderMonths({
  months,
  locale,
  L,
}: {
  months: readonly ChangeMonth[];
  locale: Locale;
  L: ChangelogLabels;
}) {
  if (months.length === 0) return null;
  const count = months.reduce((sum, month) => sum + month.entries.length, 0);
  const names = months.map((month) => formatIsoMonth(month.month, locale));
  return (
    <details className={styles.older}>
      <summary>
        <span className="min-w-0">
          <span className={styles.olderTitle}>{L.olderTitle}</span>
          <span className={styles.olderMeta}>
            {names.join(", ")} · {countLabel(count, L.entryCount, L.entryCountOne)}
          </span>
        </span>
        <CaretDown className={styles.olderIcon} size={16} weight="bold" aria-hidden />
      </summary>
      <div className={styles.olderBody}>
        {months.map((month) => (
          <MonthPanel key={month.month} month={month} locale={locale} L={L} />
        ))}
      </div>
    </details>
  );
}
