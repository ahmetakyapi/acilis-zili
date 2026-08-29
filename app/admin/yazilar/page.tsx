import Link from "next/link";
import { Suspense } from "react";
import {
  AdminCell,
  AdminPanel,
  AdminPanelTitle,
  AdminRow,
  AdminTable,
} from "@/components/admin/AdminUI";
import { Skeleton } from "@/components/ui/primitives";
import {
  getAdminEditedKeys,
  getEditableStories,
  getRecentBriefs,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { agoLabel } from "@/lib/admin-format";
import { formatEtDateShort } from "@/lib/utils";
import { briefRevisionKey } from "@/lib/content-write";

/**
 * Yazılar — panelin DÜZENLEME ekranı.
 *
 * İÇERİK EKRANINDAN AYRILDI ve ayrımın adı şu: İçerik ÖLÇER, Yazılar
 * DEĞİŞTİRİR. İkisi bir dönem tek sayfadaydı ve o sayfa aynı anda hem bir
 * sağlık panosu (kaç yazı var, hangisinin çevirisi eksik, bülten kaç gündür
 * yazılmamış) hem de bir editör girişiydi; iki farklı iş için açılan tek
 * ekran, ikisinde de uzun ve dağınık kalıyordu. Buraya gelen "bir metni
 * düzeltmeye" geliyor.
 *
 * İKİ TÜR, İKİ EDİTÖR. Mercek yazısı `:::` bloklarıyla yazılıyor ve
 * `ArticleBody` ile çiziliyor; bülten `BriefBody`nin mini biçimlendiricisini
 * kullanıyor (## başlık, - madde, **kalın**). Aynı editöre sokmak, birinde
 * çalışan sözdiziminin ötekinde sessizce düz metne dönmesi demekti.
 *
 * BİLANÇO ANALİZİ BURADA YOK, bilerek: analiz serbest metin değil, on beş
 * alanlı yapılandırılmış bir kayıt (çeyreklik gelir dizisi, öngörü, öne
 * çıkan metrikler). Onu bir metin kutusuna indirmek düzenlemek değil,
 * bozmak olurdu; eksik analizler İçerik ekranında listeleniyor ve rutin
 * onları kendi ucundan tamamlıyor.
 */

export default async function StoriesPage(props: PageProps<"/admin/yazilar">) {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  const search = await props.searchParams;
  const donem =
    search.donem === "haftalik" || search.donem === "gunluk"
      ? search.donem
      : null;
  const dil = search.dil === "en" || search.dil === "tr" ? search.dil : null;

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Stories />
      </Suspense>

      {/* Süzgeç ADRESTE: `key` ile Suspense sınırı süzgeç değiştiğinde
          yeniden kuruluyor, yani liste yenilenirken iskelet görünüyor. */}
      <Suspense
        key={`${donem}-${dil}`}
        fallback={<Skeleton className="h-72 w-full rounded-xl" />}
      >
        <Briefs donem={donem} dil={dil} />
      </Suspense>
    </div>
  );
}

/** Süzgeç seçeneği — seçili olan bağlantı değil, düz metin olur. */
function Suzgec({
  secili,
  href,
  children,
}: {
  secili: boolean;
  href: string;
  children: React.ReactNode;
}) {
  const bicim =
    "inline-flex min-h-8 items-center rounded-full px-3 text-tiny font-semibold transition-colors";
  if (secili) {
    return (
      <span
        className={`${bicim} bg-primary text-on-primary`}
        aria-current="true"
      >
        {children}
      </span>
    );
  }
  return (
    /* `scroll={false}`: süzgeç sayfanın ortasında ve her basışta başa
       fırlamak, listeyi karşılaştırarak okumayı imkânsız kılıyordu. */
    <Link
      href={href}
      scroll={false}
      className={`${bicim} border border-line bg-surface text-body hover:border-line-strong hover:text-strong`}
    >
      {children}
    </Link>
  );
}

async function Stories() {
  const [rows, elden] = await Promise.all([
    getEditableStories(40),
    getAdminEditedKeys(),
  ]);

  return (
    <AdminPanel>
      <AdminPanelTitle hint="En Yeniden Eskiye · Satıra Basınca Editör Açılır">
        Mercek Yazıları
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          Henüz mercek yazısı yok.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {rows.map((row) => (
            <li key={row.slug}>
              <Link
                href={`/admin/yazilar/mercek/${row.slug}`}
                className="flex min-h-11 flex-col gap-1 rounded-(--radius-sm) px-2 py-3 transition-colors hover:bg-surface-elevated sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-strong">
                    {row.title}
                  </span>
                  <span className="numeral block truncate text-tiny text-muted">
                    {row.slug}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {/* Diller rozette: iki dilli mi, tek dilde mi kalmış —
                      eksik çeviri listesi İçerik ekranında ayrıca var ama
                      burada da bir bakışta görünüyor. */}
                  {row.locales.map((dil) => (
                    <span
                      key={dil}
                      className="numeral rounded-full bg-primary-wash px-2 py-0.5 text-nano font-bold text-primary-ink"
                    >
                      {dil}
                    </span>
                  ))}
                  {elden.has(row.slug) && (
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-nano font-semibold text-muted">
                      Elden Geçti
                    </span>
                  )}
                  <span className="numeral w-24 text-right text-tiny text-muted">
                    {formatEtDateShort(row.eventDate, "tr")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}

async function Briefs({
  donem,
  dil,
}: {
  donem: "gunluk" | "haftalik" | null;
  dil: "tr" | "en" | null;
}) {
  const [rows, elden] = await Promise.all([
    getRecentBriefs(24, {
      period: donem ? (donem === "haftalik" ? "weekly" : "daily") : undefined,
      locale: dil ?? undefined,
    }),
    getAdminEditedKeys(),
  ]);

  /* Süzgeç adresleri: seçili olmayan boyut korunuyor, yani dönem seçip
     sonra dil seçmek ilkini sıfırlamıyor. */
  const adres = (yeni: { donem?: string | null; dil?: string | null }) => {
    const p = new URLSearchParams();
    const d = yeni.donem === undefined ? donem : yeni.donem;
    const l = yeni.dil === undefined ? dil : yeni.dil;
    if (d) p.set("donem", d);
    if (l) p.set("dil", l);
    const q = p.toString();
    return q ? `/admin/yazilar?${q}` : "/admin/yazilar";
  };

  return (
    <AdminPanel>
      <AdminPanelTitle
        hint="En Yeniden Eskiye · Satıra Basınca Editör Açılır"
        action={
          /* HAFTALIK BÜLTEN SÜZGEÇSİZ ULAŞILAMIYORDU: liste iki dönem ve iki
             dili birlikte taşıyor, yirmi dört satır ancak altı günü
             kapsıyor ve haftada bir yazılan bülten o pencereye çoğu zaman
             hiç girmiyor. */
          <div className="flex flex-wrap items-center gap-1.5">
            <Suzgec secili={!donem} href={adres({ donem: null })}>
              Tümü
            </Suzgec>
            <Suzgec
              secili={donem === "gunluk"}
              href={adres({ donem: "gunluk" })}
            >
              Günlük
            </Suzgec>
            <Suzgec
              secili={donem === "haftalik"}
              href={adres({ donem: "haftalik" })}
            >
              Haftalık
            </Suzgec>
            <span aria-hidden className="mx-1 h-4 w-px bg-line" />
            <Suzgec secili={!dil} href={adres({ dil: null })}>
              İki Dil
            </Suzgec>
            <Suzgec secili={dil === "tr"} href={adres({ dil: "tr" })}>
              TR
            </Suzgec>
            <Suzgec secili={dil === "en"} href={adres({ dil: "en" })}>
              EN
            </Suzgec>
          </div>
        }
      >
        Bültenler
      </AdminPanelTitle>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          {donem || dil
            ? "Bu süzgeçle eşleşen bülten yok."
            : "Henüz bülten yazılmamış."}
        </p>
      ) : (
        /* SATIRIN TAMAMI DEĞİL, TARİH HÜCRESİ BAĞLANTI: tablo hücrelerinin
           tamamını saran bir `<a>` geçersiz HTML olurdu ve satırı tıklanır
           yapan bir istemci betiği, bu ekranın tamamen sunucuda çizilme
           avantajını yakardı. Manşet de aynı yere gidiyor — iki hedef, tek
           adres. */
        <AdminTable
          label="Bülten arşivi"
          head={["Tarih", "Manşet", "Dil", "Dönem", "Yazan", "Yazılma"]}
        >
          {rows.map((row) => {
            const href = `/admin/yazilar/bulten/${row.briefDate}?tur=${
              row.period === "weekly" ? "haftalik" : "gunluk"
            }&dil=${row.locale}`;
            return (
              <AdminRow key={`${row.briefDate}-${row.locale}-${row.period}`}>
                <AdminCell numeral strong>
                  <Link
                    href={href}
                    className="transition-colors hover:text-primary"
                  >
                    {formatEtDateShort(row.briefDate, "tr")}
                  </Link>
                </AdminCell>
                <AdminCell>
                  <Link
                    href={href}
                    className="line-clamp-1 transition-colors hover:text-primary"
                  >
                    {row.headline}
                  </Link>
                </AdminCell>
                <AdminCell>{row.locale === "en" ? "EN" : "TR"}</AdminCell>
                <AdminCell>
                  {row.period === "weekly" ? "Haftalık" : "Günlük"}
                </AdminCell>
                {/* KÜNYE VE İZ AYRI SÜTUN DEĞİL, AYNI HÜCREDE İKİ SATIR.
                    "Yazan" rutinin çalışıp çalışmadığını söylüyor ve
                    panelden düzeltme onu DEĞİŞTİRMİYOR (gerekçe
                    `lib/content-write.ts`te). Ama metne elle dokunulduğunu
                    da görmek gerekiyor; ikisi ayrı şeyler ve ayrı
                    kaynaklardan geliyor. */}
                <AdminCell>
                  {row.generatedBy === "claude" ? "Rutin" : "Kural Tabanlı"}
                  {elden.has(
                    briefRevisionKey(
                      row.briefDate,
                      row.period === "weekly" ? "weekly" : "daily",
                    ),
                  ) && (
                    <span className="block text-tiny text-muted">
                      Elden Geçti
                    </span>
                  )}
                </AdminCell>
                <AdminCell align="right">{agoLabel(row.generatedAt)}</AdminCell>
              </AdminRow>
            );
          })}
        </AdminTable>
      )}

      <p className="mt-4 border-t border-line pt-3 text-small text-muted">
        Yeni bülten ve yeni mercek yazısı rutinlerden geliyor (
        <code>/api/brief</code>, <code>/api/mercek</code>); buradan var olan
        metin düzeltiliyor. İki yol da aynı doğrulamadan ve aynı yazma yolundan
        geçiyor.
      </p>
    </AdminPanel>
  );
}
