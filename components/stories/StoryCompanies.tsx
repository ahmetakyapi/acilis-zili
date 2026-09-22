import { cache } from "react";
/* `LocaleLink`: çıplak `next/link` /en/mercek'te şirket adreslerini öneksiz
   basıyordu — halka arz takvimindeki hatanın aynısı. */
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "./StoryDetail.module.css";
import { LogoTile } from "@/components/ui/primitives";
import { getStatus, getSymbolNames } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { getChartBarsMulti } from "@/lib/providers";
import { storySinceEvent, type StoryClose } from "@/lib/story-market";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatPercent,
  formatPrice,
} from "@/lib/utils";

/* --------------------------------------------------------------------------
   Yazıda geçen şirketler — gövdenin sonunda, olaydan bugüne getirileriyle.

   İKİ AŞAMA. Adlar ve logolar kapağın zaten sorduğu `getSymbolNames`
   anahtarından geliyor (istek içi önbellek, ek tur yok) ve HEMEN basılıyor;
   getiriler bir yıllık günlük barlardan hesaplanıyor ve `Suspense` ile akıyor.
   Yedek aynı satırları değersiz basıyor: satır yüksekliği sabit (44), değer
   geldiğinde hiçbir şey kaymıyor ve sağlayıcı yavaşsa bile şirket
   bağlantıları ekranda.

   NEDEN GÜNCEL YÜZDE DEĞİL. Yazı olay gününün rakamlarını basıyor (Intel
   +%12,53). Yanına bugünün yüzdesini koymak aynı şirketin iki farklı
   yüzdesini yan yana dizerdi (veri dürüstlüğü 3-4). "Olaydan bugüne" Mercek
   listesinin zaten kullandığı ölçü.

   YALNIZCA TAMAMLANMIŞ KAPANIŞ. Günlük barların sonuncusu seans sürerken
   bitmemiş mum olabiliyor, açılıştan önce de dünün kapanışı. Seri
   `lastStoryClose`un kabul ettiği son kapanışta kesiliyor ve künye o günü
   yazıyor ("22 Eyl Kapanışı"): "bugüne" kelimesi hangi güne kadar
   olduğunu tek başına söylemiyordu. Bu yüzden seans içinde listedeki
   rakamdan farklı olabilir — o fark künyede yazılı.
   -------------------------------------------------------------------------- */

/** Bloğun en çok gösterdiği şirket; artanı sayıyla söylenir. */
const COMPANIES_MAX = 6;

type CompanyValue =
  | { kind: "since"; pct: number; close: StoryClose }
  | { kind: "close"; close: StoryClose };

type CompanyRow = {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  value: CompanyValue | null;
};

type Labels = Pick<
  Dictionary["stories"],
  "relatedSymbols" | "sinceEvent" | "lastClose" | "closeOn" | "moreCompaniesMany"
>;

/* İSTEK İÇİNDE TEK ÇEKİM. `getChartBarsMulti` `cache()`li değil; blok
   akış yedeğiyle birlikte ya da ileride ikinci bir yerde çizilirse
   sağlayıcıya ikinci kez gitmesin. Anahtar sıralı sembol dizesi; `status`
   `cache()`li `getStatus`in aynı nesnesi. */
const companyBars = cache((key: string, status: Awaited<ReturnType<typeof getStatus>>) =>
  getChartBarsMulti(key.split(","), "1Y", status).catch(
    () => ({}) as Awaited<ReturnType<typeof getChartBarsMulti>>,
  ),
);

/** Adlar ve logolar — akış beklenirken de, akıştan sonra da aynı kaynak. */
async function namedRows(symbols: string[]): Promise<Omit<CompanyRow, "value">[]> {
  const meta = await getSymbolNames(symbols);
  return symbols.slice(0, COMPANIES_MAX).map((symbol) => ({
    symbol,
    name: meta[symbol]?.name ?? null,
    logoUrl: meta[symbol]?.logoUrl ?? null,
  }));
}

export async function StoryCompanies({
  symbols,
  eventDate,
  locale,
  labels,
}: {
  symbols: string[];
  eventDate: string;
  locale: Locale;
  labels: Labels;
}) {
  const shown = symbols.slice(0, COMPANIES_MAX);
  const [status, rows] = await Promise.all([getStatus(), namedRows(symbols)]);
  const bars = await companyBars([...shown].sort().join(","), status);

  /* Kural `storySinceEvent`te (lib/story-market): tamamlanmış son
     kapanışa kadar, ilk olay sonrası kapanıştan önce sayı yok — liste ve
     şirket sayfası da aynı fonksiyonu okuyor. Ölçülen çelişkiler orada. */
  const withValues: CompanyRow[] = rows.map((row) => {
    const { pct, close } = storySinceEvent(bars[row.symbol], eventDate, status);
    if (!close || pct === null) return { ...row, value: null };
    return { ...row, value: { kind: "since", pct, close } };
  });

  return (
    <CompaniesView
      rows={withValues}
      total={symbols.length}
      locale={locale}
      labels={labels}
    />
  );
}

/** Akış beklenirken: aynı satırlar, değer yok. */
export async function StoryCompaniesFallback({
  symbols,
  locale,
  labels,
}: {
  symbols: string[];
  locale: Locale;
  labels: Labels;
}) {
  const rows = await namedRows(symbols);
  return (
    <CompaniesView
      rows={rows.map((row) => ({ ...row, value: null }))}
      total={symbols.length}
      locale={locale}
      labels={labels}
      pending
    />
  );
}

function CompaniesView({
  rows,
  total,
  locale,
  labels,
  pending = false,
}: {
  rows: CompanyRow[];
  total: number;
  locale: Locale;
  labels: Labels;
  pending?: boolean;
}) {
  const valued = rows.filter((row) => row.value !== null);
  const allClose = valued.length > 0 && valued.every((row) => row.value?.kind === "close");
  /* Künyenin günü: satırların en yeni kapanışı. Bir sembolün kapanışı
     ötekilerden eskiyse (işlem görmediği bir gün) o satır kendi gününü
     değerin altına yazıyor. */
  const stampDate = valued.reduce<string | null>(
    (latest, row) =>
      row.value && (!latest || row.value.close.date > latest) ? row.value.close.date : latest,
    null,
  );
  const rest = total - rows.length;
  /* Hiç değer yoksa künye bir ölçü ADI da yazmıyor ("Olaydan Bugüne"
     boş bir sütunun başlığı olurdu); yer tutucu iki satır yüksekliği
     koruyor, akış gelince başlık uzamıyor. */
  const blankStamp = !pending && valued.length === 0;

  return (
    <section className={styles.companies} aria-busy={pending || undefined}>
      <div className={styles.companiesHead}>
        <p className={styles.companiesTitle}>{labels.relatedSymbols}</p>
        <p className={styles.companiesStamp}>
          <span>{blankStamp ? "\u00a0" : allClose ? labels.lastClose : labels.sinceEvent}</span>
          {/* Yedekte boş ama yer tutan satır: değer gelince başlık uzamıyor. */}
          <span>
            {!stampDate
              ? "\u00a0"
              : allClose
                ? formatEtDateCompact(stampDate, locale)
                : labels.closeOn.replace("{date}", formatEtDateCompact(stampDate, locale))}
          </span>
        </p>
      </div>
      <ul>
        {rows.map((row) => {
          const value = row.value;
          const ownDate =
            value && stampDate && value.close.date !== stampDate
              ? formatEtDateCompact(value.close.date, locale)
              : null;
          return (
            <li key={row.symbol}>
              <Link href={`/hisse/${row.symbol}`} className={styles.companyRow}>
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
                <span className={styles.companyName}>
                  <span className="numeral">{row.symbol}</span>
                  {row.name && <span>{row.name}</span>}
                </span>
                <span
                  className={cn(
                    "numeral",
                    styles.companyValue,
                    value?.kind === "since"
                      ? directionText(directionOf(value.pct))
                      : "text-strong",
                  )}
                >
                  {value?.kind === "since" && formatPercent(value.pct, locale)}
                  {value?.kind === "close" && (
                    <>
                      {formatPrice(value.close.price, locale, { currency: true })}
                      {!allClose && <small>{labels.lastClose}</small>}
                    </>
                  )}
                  {ownDate && <small>{ownDate}</small>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <p className={styles.companiesMore}>
          {labels.moreCompaniesMany.replace("{count}", String(rest))}
        </p>
      )}
    </section>
  );
}
