import Link from "next/link";
import { Suspense } from "react";
import {
  AdminCell,
  AdminPanel,
  AdminPanelTitle,
  AdminRow,
  AdminTable,
} from "@/components/admin/AdminUI";
import { YazilarTabs } from "@/components/admin/YazilarTabs";
import { Skeleton } from "@/components/ui/primitives";
import {
  getAdminEditedKeys,
  getBriefDateRange,
  getRecentBriefs,
  getWritingCounts,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import { agoLabel } from "@/lib/admin-format";
import { formatEtDateShort } from "@/lib/utils";
import { briefRevisionKey } from "@/lib/content-write";
import { cn } from "@/lib/utils";

/**
 * Yazılar → Bültenler.
 *
 * Mercek listesinden AYRI BİR SAYFA: ikisi alt alta duruyordu ve mercek
 * listesi kırk satır olduğu için bültene bakmaya gelen kişi her seferinde
 * ilgilenmediği kırk satırı geçiyordu. Gerekçenin tamamı kardeş sayfanın
 * (`app/admin/yazilar/page.tsx`) başındaki yorumda.
 *
 * ÜÇ SÜZGEÇ, ÜÇÜ DE ADRESTE. Liste iki dönem ve iki dili birlikte taşıyor;
 * yirmi dört satır ancak altı günü kapsıyor ve haftada bir yazılan bülten o
 * pencereye çoğu zaman HİÇ girmiyordu — süzgeç olmadan haftalık bir bülteni
 * panelden düzeltmenin yolu yoktu. Tarih süzgeci de aynı sorunun ötekiucu:
 * arşiv aylar öncesine gidiyor ve oraya kaydırarak ulaşılamıyor.
 */

/** Listede en çok kaç satır — fazlası süzgeçle bulunuyor. */
const TAVAN = 24;

export default async function BriefListPage(
  props: PageProps<"/admin/yazilar/bulten">,
) {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  const search = await props.searchParams;
  const donem =
    search.donem === "haftalik" || search.donem === "gunluk"
      ? search.donem
      : null;
  const dil = search.dil === "en" || search.dil === "tr" ? search.dil : null;
  const tarih =
    typeof search.tarih === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.tarih)
      ? search.tarih
      : null;

  const counts = await getWritingCounts();

  return (
    <div className="flex flex-col gap-5">
      <YazilarTabs active="bulten" counts={counts} />

      {/* Süzgeç ADRESTE: `key` ile Suspense sınırı süzgeç değiştiğinde
          yeniden kuruluyor, yani liste yenilenirken iskelet görünüyor. */}
      <Suspense
        key={`${donem}-${dil}-${tarih}`}
        fallback={<Skeleton className="h-96 w-full rounded-xl" />}
      >
        <Briefs donem={donem} dil={dil} tarih={tarih} />
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
  /* 44 piksel dokunma hedefi: çipler yan yana sarıyor ve `.tap-44` bir
     alttaki satırın hedefini çalardı — gerçek yükseklik veriliyor. */
  const bicim =
    "inline-flex min-h-11 items-center rounded-full px-3.5 text-base font-semibold transition-colors sm:min-h-8 sm:px-3 sm:text-tiny";
  if (secili) {
    return (
      <span
        className={cn(bicim, "bg-primary text-on-primary")}
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
      className={cn(
        bicim,
        "border border-line bg-surface text-body hover:border-line-strong hover:text-strong",
      )}
    >
      {children}
    </Link>
  );
}

async function Briefs({
  donem,
  dil,
  tarih,
}: {
  donem: "gunluk" | "haftalik" | null;
  dil: "tr" | "en" | null;
  tarih: string | null;
}) {
  const [{ rows, total }, elden, aralik] = await Promise.all([
    getRecentBriefs(TAVAN, {
      period: donem ? (donem === "haftalik" ? "weekly" : "daily") : undefined,
      locale: dil ?? undefined,
      date: tarih ?? undefined,
    }),
    getAdminEditedKeys(),
    getBriefDateRange(),
  ]);

  /* Süzgeç adresleri: seçili olmayan boyut korunuyor, yani dönem seçip
     sonra dil seçmek ilkini sıfırlamıyor. */
  const adres = (yeni: {
    donem?: string | null;
    dil?: string | null;
    tarih?: string | null;
  }) => {
    const p = new URLSearchParams();
    const d = yeni.donem === undefined ? donem : yeni.donem;
    const l = yeni.dil === undefined ? dil : yeni.dil;
    const t = yeni.tarih === undefined ? tarih : yeni.tarih;
    if (d) p.set("donem", d);
    if (l) p.set("dil", l);
    if (t) p.set("tarih", t);
    const q = p.toString();
    return q ? `/admin/yazilar/bulten?${q}` : "/admin/yazilar/bulten";
  };

  const suzgecVar = Boolean(donem || dil || tarih);

  return (
    <AdminPanel>
      <AdminPanelTitle hint="En Yeniden Eskiye · Satıra Basınca Editör Açılır">
        Bültenler
      </AdminPanelTitle>

      {/* SÜZGEÇLER BAŞLIĞIN YANINDA DEĞİL ALTINDA. `action` yuvasında
          duruyorlardı ve altı çip 390 pikselde başlığın üstüne biniyordu;
          kendi satırlarında hem sarabiliyorlar hem de dokunma hedefleri
          birbirini ezmiyor. */}
      <div className="mb-5 flex flex-col gap-3 rounded-(--radius-lg) border border-line bg-surface-elevated p-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="text-tiny font-semibold uppercase tracking-[0.06em] text-muted">
            Dönem
          </span>
          <Suzgec secili={!donem} href={adres({ donem: null })}>
            Tümü
          </Suzgec>
          <Suzgec secili={donem === "gunluk"} href={adres({ donem: "gunluk" })}>
            Günlük
          </Suzgec>
          <Suzgec
            secili={donem === "haftalik"}
            href={adres({ donem: "haftalik" })}
          >
            Haftalık
          </Suzgec>

          <span
            aria-hidden
            className="mx-1 hidden h-4 w-px bg-line sm:inline-block"
          />

          <span className="text-tiny font-semibold uppercase tracking-[0.06em] text-muted">
            Dil
          </span>
          <Suzgec secili={!dil} href={adres({ dil: null })}>
            İkisi
          </Suzgec>
          <Suzgec secili={dil === "tr"} href={adres({ dil: "tr" })}>
            TR
          </Suzgec>
          <Suzgec secili={dil === "en"} href={adres({ dil: "en" })}>
            EN
          </Suzgec>
        </div>

        {/* TARİH SÜZGECİ — arşive kaydırarak ulaşılamıyor.
            JAVASCRIPT YOK: düz bir GET formu, tarayıcının kendi takvimi.
            `min`/`max` ARŞİVİN gerçek aralığından geliyor, yani seçici veri
            olmayan bir güne hiç izin vermiyor. Dönem ve dil seçimi gizli
            alanlarla taşınıyor — tarihe atlamak öteki iki süzgeci
            sıfırlamamalı. */}
        <form
          action="/admin/yazilar/bulten"
          method="get"
          className="flex flex-wrap items-center gap-2 border-t border-line pt-3 lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
        >
          {donem && <input type="hidden" name="donem" value={donem} />}
          {dil && <input type="hidden" name="dil" value={dil} />}
          <label className="flex items-center gap-2">
            <span className="text-tiny font-semibold uppercase tracking-[0.06em] text-muted">
              Tarih
            </span>
            <input
              type="date"
              name="tarih"
              defaultValue={tarih ?? undefined}
              min={aralik.first ?? undefined}
              max={aralik.last ?? undefined}
              className="numeral h-11 rounded-(--radius-md) border border-line bg-surface px-3 text-base text-strong outline-none focus:border-line-focus sm:h-9"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center rounded-(--radius-md) border border-line bg-surface px-4 text-base font-semibold text-body transition-colors hover:border-line-strong hover:text-strong sm:h-9"
          >
            Git
          </button>
          {suzgecVar && (
            <Link
              href="/admin/yazilar/bulten"
              scroll={false}
              className="inline-flex h-11 items-center px-1 text-base font-semibold text-primary transition-colors hover:text-primary-hover sm:h-9"
            >
              Süzgeci Temizle
            </Link>
          )}
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          {suzgecVar
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
                    className="inline-flex min-h-11 items-center transition-colors hover:text-primary sm:min-h-0"
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
        {/* SESSİZ KIRPMA YOK: kaç kaydın dışarıda kaldığı yazılı. */}
        {total > rows.length && (
          <>
            {total.toLocaleString("tr-TR")} kaydın en yenisi{" "}
            {rows.length.toLocaleString("tr-TR")} tanesi listede — eskisine
            tarih süzgeciyle ulaşılıyor.{" "}
          </>
        )}
        Yeni bülten ve yeni mercek yazısı rutinlerden geliyor (
        <code>/api/brief</code>, <code>/api/mercek</code>); buradan var olan
        metin düzeltiliyor. İki yol da aynı doğrulamadan ve aynı yazma yolundan
        geçiyor.
      </p>
    </AdminPanel>
  );
}
