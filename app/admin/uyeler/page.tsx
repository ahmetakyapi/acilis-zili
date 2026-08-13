import Link from "next/link";
import { Suspense } from "react";
import {
  AdminCell,
  AdminPanel,
  AdminPanelTitle,
  AdminRow,
  AdminTable,
  RankList,
  StatBox,
  StatGrid,
} from "@/components/admin/AdminUI";
import { Skeleton } from "@/components/ui/primitives";
import {
  getMemberSummary,
  getMostWatchedSymbols,
  getRecentMembers,
  getSignupSeries,
} from "@/lib/admin-data";
import { formatEtDateShort } from "@/lib/utils";

/**
 * Üyeler.
 *
 * E-POSTA ADRESİ GÖSTERİLMİYOR ve sorgusu bile yapılmıyor (lib/admin-data.ts).
 * Panelin cevapladığı sorular — kaç kişi, ne zaman geldi, liste kurmuş mu,
 * hangi hisseleri izliyor — hiçbirinde e-posta gerekmiyor. Gerekmeyen kişisel
 * veriyi ekrana basmamak, KVKK metninde yazdığımız duruşun kod tarafı.
 */

export default function MembersPage() {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <Summary />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
          <RecentMembers />
        </Suspense>
        <div className="flex flex-col gap-5">
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <WatchedSymbols />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
            <SignupCurve />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Summary() {
  const s = await getMemberSummary();
  const activeShare =
    s.total > 0 ? Math.round((s.withWatchlistItems / s.total) * 100) : 0;

  return (
    <StatGrid>
      <StatBox label="Toplam Üye" value={s.total.toLocaleString("tr-TR")} />
      <StatBox
        label="Son 7 Gün"
        value={s.last7.toLocaleString("tr-TR")}
        sub="yeni kayıt"
      />
      <StatBox
        label="Son 30 Gün"
        value={s.last30.toLocaleString("tr-TR")}
        sub="yeni kayıt"
      />
      <StatBox
        label="Liste Kurmuş"
        value={s.withWatchlistItems.toLocaleString("tr-TR")}
        sub={`üyelerin %${activeShare}'ı`}
      />
    </StatGrid>
  );
}

async function RecentMembers() {
  const rows = await getRecentMembers(30);

  return (
    <AdminPanel>
      <AdminPanelTitle hint="En yeniden eskiye · e-posta gösterilmez">
        Son Kaydolanlar
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">
          Henüz kayıtlı üye yok.
        </p>
      ) : (
        <AdminTable head={["Kullanıcı", "Kayıt", "Dil", "Sembol"]}>
          {rows.map((row) => (
            <AdminRow key={row.id}>
              <AdminCell strong>
                {row.username}
                {row.role === "admin" && (
                  <span className="ml-2 rounded-full bg-primary-wash px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-primary">
                    Yönetici
                  </span>
                )}
              </AdminCell>
              <AdminCell mono>
                {formatEtDateShort(
                  row.createdAt.toISOString().slice(0, 10),
                  "tr",
                )}
              </AdminCell>
              <AdminCell>{row.locale === "en" ? "İngilizce" : "Türkçe"}</AdminCell>
              <AdminCell align="right" mono strong={row.symbolCount > 0}>
                {row.symbolCount}
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </AdminPanel>
  );
}

async function WatchedSymbols() {
  const rows = await getMostWatchedSymbols(15);
  return (
    <AdminPanel>
      <AdminPanelTitle hint="Kaç ayrı üyenin listesinde">
        En Çok Takip Edilenler
      </AdminPanelTitle>
      <RankList
        rows={rows.map((r) => ({
          key: r.symbol,
          label: r.name ? `${r.symbol} · ${r.name}` : r.symbol,
          href: `/hisse/${r.symbol}`,
          value: r.members,
        }))}
        emptyLabel="Henüz kimse listesine sembol eklememiş."
      />
    </AdminPanel>
  );
}

/**
 * Kayıt eğrisi — grafik değil, sayı çizgisi.
 *
 * Otuz günün çoğu sıfır olan bir seride çizgi grafiği yalancı bir hikâye
 * anlatıyor: tek bir kayıt, ölçek 0–1 olduğu için tavana vuran bir sıçrama
 * gibi görünüyor. Sayılar tek tek yazılıyor; hangi gün kaç kişi geldiyse o.
 */
async function SignupCurve() {
  const series = await getSignupSeries(30);
  const withSignups = series.filter((p) => p.signups > 0).reverse();
  const total = series.reduce((sum, p) => sum + p.signups, 0);

  return (
    <AdminPanel>
      <AdminPanelTitle hint="Son 30 gün">Kayıt Günleri</AdminPanelTitle>
      {withSignups.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">
          Son 30 günde yeni kayıt yok.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-body">
            Son 30 günde{" "}
            <span className="font-semibold text-strong">{total}</span> kayıt,{" "}
            {withSignups.length} ayrı güne yayılmış.
          </p>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {withSignups.slice(0, 10).map((point) => (
              <li key={point.day} className="flex justify-between gap-4">
                <span className="text-body">
                  {formatEtDateShort(point.day, "tr")}
                </span>
                <span className="font-semibold tabular-nums text-strong">
                  {point.signups}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 border-t border-line pt-3 text-[12px] text-muted">
        Yeni yönetici eklemek için:{" "}
        <code className="rounded bg-surface-elevated px-1.5 py-0.5">
          npx tsx scripts/make-admin.mts kullanıcıadı
        </code>
      </p>
      <p className="mt-1.5 text-[12px] text-muted">
        <Link href="/kvkk" className="text-primary hover:text-primary-hover">
          KVKK Metni
        </Link>{" "}
        · hangi verinin neden tutulduğu orada yazılı.
      </p>
    </AdminPanel>
  );
}
