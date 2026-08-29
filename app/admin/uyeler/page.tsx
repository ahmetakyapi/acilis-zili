import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
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
import { agoLabel } from "@/lib/admin-format";

/**
 * Üyeler.
 *
 * E-POSTA ADRESİ GÖSTERİLMİYOR ve sorgusu bile yapılmıyor (lib/admin-data.ts).
 * Panelin cevapladığı sorular — kaç kişi, ne zaman geldi, liste kurmuş mu,
 * hangi hisseleri izliyor — hiçbirinde e-posta gerekmiyor. Gerekmeyen kişisel
 * veriyi ekrana basmamak, KVKK metninde yazdığımız duruşun kod tarafı.
 */

export default async function MembersPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
        <Summary />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
          <RecentMembers />
        </Suspense>
        <div className="flex flex-col gap-6">
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
  const activeRate =
    s.total > 0 ? Math.round((s.activeLast30 / s.total) * 100) : 0;

  return (
    <StatGrid>
      <StatBox label="Toplam Üye" value={s.total.toLocaleString("tr-TR")} />
      <StatBox
        label="Son 7 Gün"
        value={s.last7.toLocaleString("tr-TR")}
        sub="Yeni Kayıt"
      />
      <StatBox
        label="Son 30 Gün"
        value={s.last30.toLocaleString("tr-TR")}
        sub="Yeni Kayıt"
      />
      {/* KAYITLI İLE KULLANAN AYRI. "Toplam Üye" tek başına geçmişi
          ölçüyor: otuz kayıtlı hesabın yirmi beşi bir daha hiç girmediyse o
          sayı bugün hakkında bir şey söylemiyor. Bu kutu son otuz günde
          giriş yapanı sayıyor.
          Damga yeni eklendi, yani ondan önce açılmış hesaplarda `null` —
          künye bunu SÖYLÜYOR, yoksa sayı olduğundan düşük görünür ve
          sebebi anlaşılmaz. */}
      <StatBox
        label="Aktif Üye"
        value={s.activeLast30.toLocaleString("tr-TR")}
        sub={
          s.neverSeen > 0
            ? `Son 30 Günde Giriş · ${s.neverSeen} Hesapta Henüz Damga Yok`
            : `Son 30 Günde Giriş · Üyelerin %${activeRate}'ı`
        }
      />
      <StatBox
        label="Liste Kurmuş"
        value={s.withWatchlistItems.toLocaleString("tr-TR")}
        sub={`Üyelerin %${activeShare}'ı`}
      />
    </StatGrid>
  );
}

async function RecentMembers() {
  const rows = await getRecentMembers(30);

  return (
    <AdminPanel>
      <AdminPanelTitle hint="En Yeniden Eskiye · E-posta Gösterilmez">
        Son Kaydolanlar
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          Henüz kayıtlı üye yok.
        </p>
      ) : (
        <AdminTable label="Son kaydolan üyeler" head={["Kullanıcı", "Kayıt", "Son Giriş", "Dil", "Sembol"]}>
          {rows.map((row) => (
            <AdminRow key={row.id}>
              <AdminCell strong rowHeader>
                {row.username}
                {row.role === "admin" && (
                  <span className="ml-2 rounded-full bg-primary-wash px-2 py-0.5 text-nano font-semibold uppercase tracking-[0.05em] text-primary-ink">
                    Yönetici
                  </span>
                )}
              </AdminCell>
              {/* Tarih ET gününden geliyor, `toISOString()` (UTC) DEĞİL:
                  bir üye 12 Ağustos 21:30 ET'de kaydolduğunda UTC zaten
                  13 Ağustos oluyordu ve bu tablo "13.08" derken hemen
                  yanındaki kayıt eğrisi (ET ile grupluyor) aynı kaydı
                  "12.08" satırında gösteriyordu. Yaz saatinde her günün
                  20:00-24:00 ET aralığı — günün altıda biri — bir gün
                  ileri görünüyordu. */}
              <AdminCell numeral>
                {formatEtDateShort(row.createdOn, "tr")}
              </AdminCell>
              {/* "Hiç" ile "eski" ayrı: damga eklenmeden önce açılmış
                  hesapta giriş olmuş olabilir ama kaydı yok — o yüzden
                  boş hücre değil, açıkça söyleniyor. */}
              <AdminCell numeral>
                {row.lastSeenAt ? agoLabel(row.lastSeenAt) : "—"}
              </AdminCell>
              <AdminCell>{row.locale === "en" ? "İngilizce" : "Türkçe"}</AdminCell>
              <AdminCell align="right" numeral strong={row.symbolCount > 0}>
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
      <AdminPanelTitle hint="Kaç Ayrı Üyenin Listesinde">
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
        <p className="py-6 text-center text-base text-muted">
          Son 30 günde yeni kayıt yok.
        </p>
      ) : (
        <>
          <p className="mb-3 text-base text-body">
            Son 30 günde{" "}
            <span className="font-semibold text-strong">{total}</span> kayıt,{" "}
            {withSignups.length} ayrı güne yayılmış.
          </p>
          <ul className="flex flex-col gap-1.5 text-base">
            {withSignups.slice(0, 10).map((point) => (
              <li key={point.day} className="flex justify-between gap-4">
                <span className="text-body">
                  {formatEtDateShort(point.day, "tr")}
                </span>
                <span className="numeral font-semibold text-strong">
                  {point.signups}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 border-t border-line pt-3 text-small text-muted">
        Yeni yönetici eklemek için:{" "}
        <code className="rounded bg-surface-elevated px-1.5 py-0.5">
          npx tsx scripts/make-admin.mts kullanıcıadı
        </code>
      </p>
      <p className="mt-1.5 text-small text-muted">
        <Link href="/kvkk" className="text-primary hover:text-primary-hover">
          KVKK Metni
        </Link>{" "}
        · hangi verinin neden tutulduğu orada yazılı.
      </p>
    </AdminPanel>
  );
}
