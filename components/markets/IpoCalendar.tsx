import { Suspense } from "react";
import styles from "./IpoCalendar.module.css";
/* `LocaleLink`, `next/link` DEĞİL: çıplak bağlantı /en/takvim'de sembol
   adreslerini öneksiz basıyordu ("/hisse/AMRO") ve sayfa yalnızca dil
   çerezi sayesinde İngilizce kalıyordu; adres dili taşımıyordu. */
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { getIpoCalendar } from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatRange } from "@/lib/technical";
import {
  formatCompact,
  formatEtDateLong,
  formatMoneyCompact,
  withCurrency,
} from "@/lib/utils";

/**
 * Halka arz takvimi — önümüzdeki altı hafta.
 *
 * Ekonomik takvimin ALTINDA, tam genişlikte kart ızgarası (29 Eylül). Bir
 * dönem takvimin yanında 360 piksellik bir kolondu: ekran ≥1100'de ikiye
 * bölünüyor, üç-altı satırlık küçük bir liste için takvim 940 piksele
 * sıkışıyor ve kolon ay görünümünde 1.700 piksel boş sarkıyordu (1440,
 * ölçüldü: takvim 889, halka arz 318). Sahibi "boşa ekranı kaplıyor"
 * dedi. Artık takvim tam genişlik, halka arzlar onun altında bir kart
 * ızgarası: her kartta gün tek bakışta (büyük rakam), sembol, durum, ad,
 * fiyat aralığı ve büyüklük.
 *
 * Sağlayıcı bazı kayıtları fiyat aralığı ve adet belirlenmeden yayımlıyor
 * (status: expected). O alanlar boş bırakılıyor — tahmin edilmiyor. Durum
 * rozeti de bunu açıkça söylüyor: "beklenen" ile "fiyatlandı" farklı
 * şeylerdir ve fark, katılım kararını doğrudan etkiler.
 */

const WEEKS_AHEAD = 6;
const MAX_ROWS = 12;


/**
 * Fiyat aralığı sağlayıcıdan METİN geliyor ("7.06", "18.00-20.00") ve
 * olduğu gibi basılıyordu: TR'de "18.00-20.00 $" hemen altındaki
 * "805 Mn $" ile aynı satırda iki ayrı ondalık dili konuşuyordu (390,
 * ölçüldü). Yalnızca metin bir ya da iki SAYIDAN ibaretse yerelleşiyor ve
 * sitenin öteki fiyat aralıklarıyla aynı biçime giriyor (`formatRange`:
 * "18,00 – 20,00 $", simge bir kez). Sayı olmayan her şey olduğu gibi
 * kalır; tahmin edilmez.
 */
function priceRangeLabel(raw: string, locale: Locale): string {
  const parts = raw.split("-").map((part) => part.trim());
  const numbers = parts.map(Number);
  if (parts.length > 2 || parts.some((part) => part === "") || numbers.some((n) => !Number.isFinite(n))) {
    return withCurrency(raw, locale);
  }
  return formatRange(numbers[0], numbers[numbers.length - 1], locale);
}

/**
 * Borsa adını kısaltır.
 *
 * Sağlayıcı "NASDAQ Global Select", "NYSE American" gibi tam pazar adları
 * veriyor; dar sütunda hepsi "NASDAQ Glo..." diye kırpılıyordu. Pazar
 * segmenti bu ekranda bilgi taşımıyor — borsanın kendisi taşıyor.
 */
function shortExchange(value: string | null): string | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if (upper.includes("NASDAQ")) return "NASDAQ";
  if (upper.includes("NYSE")) return "NYSE";
  return value.split(/[ ,]/)[0];
}

export function IpoCalendar({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <Panel>
      <PanelHeader title={t.ipo.title} meta={t.ipo.window} />
      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[112px] w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <IpoList locale={locale} t={t} />
      </Suspense>
    </Panel>
  );
}

async function IpoList({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const result = await getIpoCalendar(today, addEtDays(today, WEEKS_AHEAD * 7));

  /* SAĞLAYICI HATASI İLE BOŞ SONUÇ AYRI ŞEYLER — ikisi aynı daldaydı.
     `t.ipo.empty` bir OLGU İDDİASI: "Bu aralıkta planlanmış halka arz yok",
     alt satırı da "Sağlayıcı takvimi henüz yeni kayıt yayımlamadı" diyerek
     sağlayıcının YANIT VERDİĞİNİ söylüyor. Finnhub düştüğünde kullanıcı bu
     iki cümleyi okuyup gerçekten halka arz olmadığına inanıyordu.
     CLAUDE.md § Veri dürüstlüğü: bilinmeyen, "yok" diye yazılmaz. */
  if (!result.ok) {
    return <EmptyState title={t.common.noData} hint={t.common.noDataHint} />;
  }

  if (result.data.length === 0) {
    return <EmptyState title={t.ipo.empty} hint={t.ipo.emptyHint} />;
  }

  const rows = result.data.slice(0, MAX_ROWS);

  const statusLabel: Record<string, string> = {
    expected: t.ipo.statusExpected,
    priced: t.ipo.statusPriced,
    filed: t.ipo.statusFiled,
  };

  const intl = locale === "en" ? "en-US" : "tr-TR";
  /* Tarih ET günü ("YYYY-AA-GG"); öğlen UTC'den okununca hiçbir saat
     diliminde gün kaymıyor. */
  const dayParts = (iso: string) => {
    const date = new Date(`${iso}T12:00:00Z`);
    const part = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(intl, { ...options, timeZone: "UTC" }).format(date);
    return { day: part({ day: "numeric" }), month: part({ month: "short" }), weekday: part({ weekday: "short" }) };
  };

  return (
    <>
      <ul className={`${styles.list} grid grid-cols-1 gap-2 px-4 pb-4 min-[420px]:grid-cols-2 sm:px-5 md:grid-cols-3 xl:grid-cols-4`}>
        {rows.map((row, index) => {
          const when = dayParts(row.date);
          const exchange = shortExchange(row.exchange);
          const status = row.status ? statusLabel[row.status.toLowerCase()] ?? row.status : null;
          return (
            <li
              key={`${row.symbol}-${row.date}`}
              /* Telefonda aynı günün ardışık satırı günü tekrar basmıyor
                 (IpoCalendar.module.css). */
              data-same-day={index > 0 && rows[index - 1]!.date === row.date ? "" : undefined}
              className={`${styles.row} flex min-w-0 flex-col gap-2.5 rounded-xl border border-line-soft bg-surface-sunken px-3.5 py-3 transition-colors hover:border-line`}
            >
              <span className={`${styles.top} flex items-start justify-between gap-2`}>
                {/* Gün tek bakışta: büyük rakam, yanında ay ve gün adı. */}
                <span className={`${styles.date} flex items-baseline gap-1.5`} aria-label={formatEtDateLong(row.date, locale)}>
                  <b className="numeral text-[22px] font-bold leading-none tracking-tight text-strong">{when.day}</b>
                  <span className="text-tiny font-semibold leading-tight text-body">
                    {when.month}
                    <span className="text-muted"> · {when.weekday}</span>
                  </span>
                </span>
                {status && (
                  <span className={`${styles.status} shrink-0 rounded-full border border-line-soft bg-surface px-[7px] py-px text-nano font-semibold text-body`}>
                    {status}
                  </span>
                )}
              </span>
              <span className={`${styles.id} min-w-0`}>
                <Link
                  href={`/hisse/${row.symbol}`}
                  className="tap-44 numeral text-base font-bold text-strong transition-colors hover:text-primary"
                >
                  {row.symbol}
                </Link>
                <span className="block truncate text-small leading-tight text-body" title={row.name}>
                  {row.name}
                </span>
              </span>
              {/* BİLİNMEYEN ALAN BOŞ KALIR, TİRE BASILMAZ: fiyat aralığı ya
                  da büyüklük yoksa satır yalnızca bildiğini yazıyor. */}
              <span className={`${styles.figs} mt-auto flex items-baseline justify-between gap-2 border-t border-line-soft pt-2`}>
                <span className="numeral min-w-0 truncate text-small font-semibold text-strong">
                  {row.priceRange ? priceRangeLabel(row.priceRange, locale) : exchange}
                </span>
                <span className="numeral shrink-0 text-nano text-muted">
                  {row.totalValue
                    ? formatMoneyCompact(row.totalValue, locale)
                    : row.shares
                      ? `${formatCompact(row.shares, locale)} ${t.ipo.shares}`
                      : row.priceRange
                        ? exchange
                        : null}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
        {t.ipo.hint}
      </p>
    </>
  );
}
