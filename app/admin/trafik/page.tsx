import Link from "next/link";
import { Suspense } from "react";
import {
  AdminPanel,
  AdminPanelTitle,
  RankList,
  StatBox,
  StatGrid,
} from "@/components/admin/AdminUI";
import { TrafficChart } from "@/components/admin/TrafficChart";
import { Skeleton } from "@/components/ui/primitives";
import {
  getDeviceSplit,
  getLocaleSplit,
  getSignedInShare,
  getTopPaths,
  getTopReferrers,
  getTopRoutes,
  getTrackingRange,
  getTrafficSeries,
  getTrafficTotals,
} from "@/lib/admin-data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getLocale } from "@/lib/i18n";
import { deltaOf } from "@/lib/admin-format";
import { cn, formatEtDateShort } from "@/lib/utils";

/**
 * Trafik.
 *
 * PENCERE URL'DE (`?gun=7|30|90`) — paylaşılabilir ve geri tuşuyla gezilebilir
 * olması için, ve sunucuda hesaplandığı için istemciye tek satır JS inmiyor.
 */

const WINDOWS = [7, 30, 90] as const;
type WindowDays = (typeof WINDOWS)[number];

function windowOf(raw: string | string[] | undefined): WindowDays {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return (WINDOWS as readonly number[]).includes(value)
    ? (value as WindowDays)
    : 30;
}

export default async function TrafficPage(props: PageProps<"/admin/trafik">) {
  const search = await props.searchParams;
  const days = windowOf(search.gun);

  return (
    <div className="flex flex-col gap-5">
      <nav
        aria-label="Zaman aralığı"
        className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1"
      >
        {WINDOWS.map((option) => (
          <Link
            key={option}
            href={`/admin/trafik?gun=${option}`}
            /* Sayfa içi filtre — App Router her gezinmede en üste kaydırıyor
               ve sayfanın ortasındaki aralığı değiştiren okuyucu başa
               fırlıyordu. */
            scroll={false}
            aria-current={option === days ? "true" : undefined}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center rounded-md text-base font-semibold transition-colors",
              option === days
                ? "bg-surface-elevated text-strong"
                : "text-muted hover:text-body",
            )}
          >
            Son {option} Gün
          </Link>
        ))}
      </nav>

      <Suspense
        key={`sum-${days}`}
        fallback={<Skeleton className="h-24 w-full rounded-xl" />}
      >
        <Totals days={days} />
      </Suspense>

      <Suspense
        key={`chart-${days}`}
        fallback={<Skeleton className="h-72 w-full rounded-xl" />}
      >
        <Chart days={days} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-2">
        <Suspense
          key={`routes-${days}`}
          fallback={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          <Routes days={days} />
        </Suspense>
        <Suspense
          key={`paths-${days}`}
          fallback={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          <Paths days={days} />
        </Suspense>
        <Suspense
          key={`ref-${days}`}
          fallback={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          <Referrers days={days} />
        </Suspense>
        <Suspense
          key={`split-${days}`}
          fallback={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          <Splits days={days} />
        </Suspense>
      </div>
    </div>
  );
}

async function Totals({ days }: { days: WindowDays }) {
  const today = todayEt();
  const [current, previous, range] = await Promise.all([
    getTrafficTotals(addEtDays(today, -(days - 1)), today),
    getTrafficTotals(addEtDays(today, -(days * 2 - 1)), addEtDays(today, -days)),
    getTrackingRange(),
  ]);

  const perVisitor =
    current.visitors > 0
      ? (current.views / current.visitors).toFixed(1).replace(".", ",")
      : "—";

  return (
    <StatGrid>
      <StatBox
        label="Görüntüleme"
        value={current.views.toLocaleString("tr-TR")}
        sub={`son ${days} gün`}
        delta={deltaOf(current.views, previous.views)}
      />
      <StatBox
        label="Tekil Ziyaretçi"
        value={current.visitors.toLocaleString("tr-TR")}
        sub={`son ${days} gün`}
        delta={deltaOf(current.visitors, previous.visitors)}
      />
      <StatBox
        label="Kişi Başı Sayfa"
        value={perVisitor}
        sub="ziyaretçi başına görüntüleme"
      />
      <StatBox
        label="Ölçüm Başlangıcı"
        value={range.firstDay ? formatEtDateShort(range.firstDay, "tr") : "—"}
        sub={
          range.firstDay
            ? `${range.rows.toLocaleString("tr-TR")} kayıt`
            : "henüz kayıt yok"
        }
      />
    </StatGrid>
  );
}

async function Chart({ days }: { days: WindowDays }) {
  const [series, locale] = await Promise.all([
    getTrafficSeries(days),
    getLocale(),
  ]);
  return (
    <AdminPanel>
      <AdminPanelTitle hint={`Son ${days} gün · ET takvim günü`}>
        Günlük Trafik
      </AdminPanelTitle>
      <TrafficChart points={series} locale={locale} />
    </AdminPanel>
  );
}

async function Routes({ days }: { days: WindowDays }) {
  const rows = await getTopRoutes(days, 12);
  return (
    <AdminPanel>
      <AdminPanelTitle hint="Dinamik sayfalar şablonlarında toplanır">
        Bölümler
      </AdminPanelTitle>
      <RankList
        rows={rows.map((r) => ({
          key: r.key,
          label: r.key,
          value: r.views,
          secondary: `${r.visitors} kişi`,
        }))}
      />
    </AdminPanel>
  );
}

async function Paths({ days }: { days: WindowDays }) {
  const rows = await getTopPaths(days, 15);
  return (
    <AdminPanel>
      <AdminPanelTitle hint="Tek tek adresler — hangi hisse, hangi yazı">
        Sayfalar
      </AdminPanelTitle>
      <RankList
        rows={rows.map((r) => ({
          key: r.key,
          label: r.key,
          /* Satır sitedeki gerçek sayfaya gider: paneli okurken "bu sayfa
             nasıl görünüyordu" sorusu hemen orada cevaplanıyor. */
          href: r.key,
          value: r.views,
          secondary: `${r.visitors} kişi`,
        }))}
      />
    </AdminPanel>
  );
}

async function Referrers({ days }: { days: WindowDays }) {
  const rows = await getTopReferrers(days, 12);
  return (
    <AdminPanel>
      <AdminPanelTitle hint="Yalnızca alan adı — arama terimi saklanmaz">
        Nereden Geliniyor
      </AdminPanelTitle>
      <RankList
        rows={rows.map((r) => ({
          key: r.key,
          label: r.key,
          value: r.views,
          secondary: `${r.visitors} kişi`,
        }))}
        emptyLabel="Dış yönlendirme kaydı yok — gelenler adresi doğrudan açmış."
      />
    </AdminPanel>
  );
}

async function Splits({ days }: { days: WindowDays }) {
  const [devices, locales, signed] = await Promise.all([
    getDeviceSplit(days),
    getLocaleSplit(days),
    getSignedInShare(days),
  ]);

  const DEVICE_LABEL: Record<string, string> = {
    mobile: "Mobil",
    tablet: "Tablet",
    desktop: "Masaüstü",
  };
  const LOCALE_LABEL: Record<string, string> = {
    tr: "Türkçe",
    en: "İngilizce",
  };

  const total = signed.signedIn + signed.anonymous;
  const signedShare = total > 0 ? Math.round((signed.signedIn / total) * 100) : 0;

  return (
    <AdminPanel>
      <AdminPanelTitle hint="Cihaz, dil ve üyelik kırılımı">Okuyucu</AdminPanelTitle>

      <div className="flex flex-col gap-5">
        <div>
          <h3 className="mb-1.5 text-tiny font-semibold uppercase tracking-[0.06em] text-muted">
            Cihaz
          </h3>
          <RankList
            rows={devices.map((d) => ({
              key: d.key,
              label: DEVICE_LABEL[d.key] ?? d.key,
              value: d.views,
            }))}
          />
        </div>

        <div>
          <h3 className="mb-1.5 text-tiny font-semibold uppercase tracking-[0.06em] text-muted">
            Dil
          </h3>
          <RankList
            rows={locales.map((l) => ({
              key: l.key,
              label: LOCALE_LABEL[l.key] ?? l.key,
              value: l.views,
            }))}
          />
        </div>

        <div>
          <h3 className="mb-1.5 text-tiny font-semibold uppercase tracking-[0.06em] text-muted">
            Üyelik
          </h3>
          <p className="text-base text-body">
            Görüntülemelerin{" "}
            <span className="font-semibold text-strong">%{signedShare}</span>
            {"'ı giriş yapmış okuyuculardan geliyor."}
          </p>
          <p className="mt-1 text-small text-muted">
            {signed.signedIn.toLocaleString("tr-TR")} üye ·{" "}
            {signed.anonymous.toLocaleString("tr-TR")} ziyaretçi
          </p>
        </div>
      </div>
    </AdminPanel>
  );
}
