import Link from "next/link";
import { DatePicker } from "@/components/ui/DatePicker";
import { Suspense } from "react";
import {
  PageHeader,
  Segment,
  SegmentItem,
} from "@/components/ui/primitives";
import {
  AdminCell,
  AdminEmpty,
  AdminPanel,
  AdminPanelError,
  AdminPanelSkeleton,
  AdminPanelTitle,
  AdminRow,
  AdminTable,
} from "@/components/admin/AdminUI";
import { YazilarTabs } from "@/components/admin/YazilarTabs";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import {
  getBriefDateRange,
  getRecentBriefs,
  getWritingCounts,
  type BriefItem,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin";
import {
  adminDayIn,
  adminStamp,
  adminWeekRange,
  agoLabel,
} from "@/lib/admin-format";
import { TR_ZONE, zoneDateKey } from "@/lib/session-clock";
import { cn } from "@/lib/utils";

/**
 * Yazılar → Bültenler.
 *
 * Mercek listesinden AYRI BİR SAYFA: ikisi alt alta duruyordu ve mercek
 * listesi kırk satır olduğu için bültene bakmaya gelen kişi her seferinde
 * ilgilenmediği kırk satırı geçiyordu. Gerekçenin tamamı kardeş sayfanın
 * (`app/admin/yazilar/page.tsx`) başındaki yorumda.
 *
 * ÜÇ SÜZGEÇ, ÜÇÜ DE ADRESTE. Liste iki dönemi birlikte taşıyor ve haftada
 * bir yazılan bülten süzgeçsiz pencereye her zaman girmiyordu — süzgeç
 * olmadan haftalık bir bülteni panelden düzeltmenin yolu yoktu. Satır artık
 * BÜLTEN BAŞINA, dil başına değil (lib/admin-data.ts → `BriefItem`): iki
 * dil tek satırda, her dil kendi editörüne gidiyor. Tarih süzgeci de aynı
 * sorunun öteki ucu: arşiv aylar öncesine gidiyor ve oraya kaydırarak
 * ulaşılamıyor.
 *
 * ÜÇ SÜTUN (23 Eylül denetimi). Tablo altı sütundu — Tarih, Manşet, Dil,
 * Dönem, Yazan, Yazılma — ve 390'da 312 piksellik kapta 520 piksel
 * duruyordu: Dil sütunu ortasından kesiliyor, Dönem, Yazan ve Yazılma
 * tümüyle ekran dışında kalıyordu. İkisi bilgi taşımıyordu ("Yazan" 24/24
 * "Rutin", "Dönem" 22/24 "Günlük"); kalanlar rozet oldu ve yalnızca
 * istisnada çiziliyor. Üç sütun telefonda kabına sığıyor; sabit ilk sütun
 * ve kenar solması, bir gün sığmazsa diye yerinde (CLAUDE.md "Kaydırma
 * saklanmaz").
 */

/** Listede en çok kaç satır — fazlası süzgeçle bulunuyor. */
const TAVAN = 24;

/**
 * Tablonun kaydırmaya geçtiği taban genişlik. 390'da kap 312 piksel ve üç
 * sütun orada sığıyor; bunun altında (320 piksellik telefon, kap 244)
 * manşet sütunu bir sözcük genişliğine iner ve iki satırlık kırpma hiçbir
 * şey göstermez — o genişlikte tablo kayar, tarih sütunu yerinde kalır.
 */
const TABLO_TABAN = 300;

/* İskelet ölçüleri (23 Eylül, önizleme, JavaScript kapalıyken yedek ile
   gerçek panel yan yana ölçüldü). Satır telefonda 95 piksel (iki satır
   manşet + 44 piksellik dil rozetleri), genişte 44,5. Süzgeçler (telefonda
   üç satır, genişte bir), tablo başlığı ve alt künye satır olarak
   sayılıyor; toplam gerçek panelle ±1 piksel: telefonda 2.764 / 2.765,
   genişte 1.341 / 1.342. */
const SATIR_TELEFON = 94.7;
const SATIR_GENIS = 45.2;
const EK_SATIR_TELEFON = 4;
const EK_SATIR_GENIS = 3;

/** Rozet sırası sabit: TR önce — Mercek listesinin "SIRA SABİT" kuralı. */
const DILLER = ["tr", "en"] as const;

/* Her bölümün kendi sekme başlığı: altısı "Yönetim · Açılış Zili"
   paylaşıyordu ve tarayıcı sekmesi, geçmiş, ekran okuyucu bölümleri
   ayıramıyordu. */
export const metadata = { title: adminDocTitle("Bültenler", ADMIN_SECTIONS.writing.title) };

type Donem = "gunluk" | "haftalik";
type Dil = "tr" | "en";

export default async function BriefListPage(
  props: PageProps<"/admin/yazilar/bulten">,
) {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  const search = await props.searchParams;
  const donem: Donem | null =
    search.donem === "haftalik" || search.donem === "gunluk"
      ? search.donem
      : null;
  const dil: Dil | null = search.dil === "en" || search.dil === "tr" ? search.dil : null;
  const tarih =
    typeof search.tarih === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.tarih)
      ? search.tarih
      : null;

  const counts = await getWritingCounts();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Yönetim"
        title={ADMIN_SECTIONS.writing.title}
        subtitle={ADMIN_SECTIONS.writing.subtitle}
        action={
          <YazilarTabs active="bulten" counts={counts.ok ? counts.data : null} />
        }
      />

      {/* Süzgeç ADRESTE: `key` ile Suspense sınırı süzgeç değiştiğinde
          yeniden kuruluyor, yani liste yenilenirken iskelet görünüyor.
          İSKELET GERÇEK PANELİN BOYUNDA — sabit `h-96` (384 piksel) bir
          çubuktu, liste 390'da 2.127 piksel tutarken; ölçüler yukarıda. */}
      <Suspense
        key={`${donem}-${dil}-${tarih}`}
        fallback={
          <>
            <AdminPanelSkeleton
              rows={TAVAN + EK_SATIR_TELEFON}
              rowHeight={SATIR_TELEFON}
              className="sm:hidden"
            />
            <AdminPanelSkeleton
              rows={TAVAN + EK_SATIR_GENIS}
              rowHeight={SATIR_GENIS}
              className="hidden sm:block"
            />
          </>
        }
      >
        <Briefs donem={donem} dil={dil} tarih={tarih} />
      </Suspense>
    </div>
  );
}

async function Briefs({
  donem,
  dil,
  tarih,
}: {
  donem: Donem | null;
  dil: Dil | null;
  tarih: string | null;
}) {
  const [result, aralikResult] = await Promise.all([
    getRecentBriefs(TAVAN, {
      period: donem ? (donem === "haftalik" ? "weekly" : "daily") : undefined,
      locale: dil ?? undefined,
      date: tarih ?? undefined,
    }),
    getBriefDateRange(),
  ]);
  const { items, total } = result.ok ? result.data : { items: [], total: 0 };
  const aralik = aralikResult.ok ? aralikResult.data : { first: null, last: null };
  const bugun = zoneDateKey(new Date(), TR_ZONE);

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

  /* BAŞLIK LİSTENİN KENDİSİ: "Bültenler" yazıyordu, yukarıdaki sekmenin
     aynısı. Şimdi kaç bülten ve hangi dönem — sayı yalnızca liste
     okunduysa ve boş değilse ("0 Bülten" boş durumu ikinci kez söylüyordu). */
  const tur =
    donem === "haftalik"
      ? "Haftalık Bülten"
      : donem === "gunluk"
        ? "Günlük Bülten"
        : "Bülten";
  const baslik =
    !result.ok || items.length === 0
      ? suzgecVar
        ? "Süzgeç Sonucu"
        : "Bültenler"
      : `${total > items.length ? "Son " : ""}${items.length.toLocaleString("tr-TR")} ${tur}`;

  return (
    <AdminPanel>
      <AdminPanelTitle hint="Yayın Gününe Göre En Yeniden Eskiye · Saatler TR · Dil Rozeti O Dilin Editörünü Açar">
        {baslik}
      </AdminPanelTitle>

      {/* SÜZGEÇLER BAŞLIĞIN ALTINDA, KUTUSUZ (23 Eylül denetimi). Başlığın
          `action` yuvasındaydılar ve altı çip 390 pikselde başlığın üstüne
          biniyordu; sonra kendi satırlarına indiler ama panelin içinde
          üçüncü bir kutuya girdiler (kenarlıklı, 14 piksel köşe, ayrı
          zemin) ve çipler sitenin değil bu dosyanın kendi çipiydi (`Suzgec`,
          kenarlığı çubuğa karşı 1,27:1). Kutu 390'da 191 piksel tutuyor,
          tablo ancak y=580'de başlıyordu. Şimdi sitenin `Segment`i, iki
          ray ve tarih formu tek satırda; sığmayan satır sarıyor.

          Görünen etiket Title Case, büyük harf değil ("DÖNEM" yazıyordu);
          ekran okuyucu adı segmentin kendi `label`ından alıyor, görünen
          etiket ona ikinci kez okunmasın diye gizli. Telefonda satırlar alt
          alta dizildiğinde etiket sabit genişlikte: üç denetim aynı hizadan
          başlıyor. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="w-12 shrink-0 text-small font-semibold text-muted lg:w-auto">
            Dönem
          </span>
          <Segment label="Dönem">
            <SegmentItem href={adres({ donem: null })} active={!donem}>
              Tümü
            </SegmentItem>
            <SegmentItem href={adres({ donem: "gunluk" })} active={donem === "gunluk"}>
              Günlük
            </SegmentItem>
            <SegmentItem href={adres({ donem: "haftalik" })} active={donem === "haftalik"}>
              Haftalık
            </SegmentItem>
          </Segment>
        </div>

        <div className="flex items-center gap-2">
          <span aria-hidden className="w-12 shrink-0 text-small font-semibold text-muted lg:w-auto">
            Dil
          </span>
          <Segment label="Dil">
            <SegmentItem href={adres({ dil: null })} active={!dil}>
              İkisi
            </SegmentItem>
            <SegmentItem href={adres({ dil: "tr" })} active={dil === "tr"}>
              TR
            </SegmentItem>
            <SegmentItem href={adres({ dil: "en" })} active={dil === "en"}>
              EN
            </SegmentItem>
          </Segment>
        </div>

        {/* TARİH SÜZGECİ — arşive kaydırarak ulaşılamıyor.
            JAVASCRIPT YOK: düz bir GET formu, tarayıcının kendi takvimi.
            `min`/`max` ARŞİVİN gerçek aralığından geliyor, yani seçici veri
            olmayan bir güne hiç izin vermiyor. Dönem ve dil seçimi gizli
            alanlarla taşınıyor — tarihe atlamak öteki iki süzgeci
            sıfırlamamalı. Geniş ekranda segmentlerden bir saç teliyle
            ayrılıyor: aynı satırda ama başka türden bir denetim. */}
        <form
          action="/admin/yazilar/bulten"
          method="get"
          className="flex flex-wrap items-center gap-2 lg:border-l lg:border-line lg:pl-6"
        >
          {donem && <input type="hidden" name="donem" value={donem} />}
          {dil && <input type="hidden" name="dil" value={dil} />}
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-small font-semibold text-muted lg:w-auto">
              Tarih
            </span>
            {/* SİTENİN TAKVİMİ (26 Eylül): tarayıcının yerel penceresi yerine
                `DatePicker`; seçim formu kendiliğinden gönderiyor, "Git"
                düğmesine gerek kalmadı. */}
            <DatePicker
              name="tarih"
              defaultValue={tarih ?? undefined}
              min={aralik.first ?? undefined}
              max={aralik.last ?? undefined}
              autoSubmit
              aria-label="Tarih"
            />
          </div>
          {suzgecVar && (
            <Link
              href="/admin/yazilar/bulten"
              scroll={false}
              className="inline-flex min-h-11 items-center px-1 text-base font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-10"
            >
              Süzgeci Temizle
            </Link>
          )}
        </form>
      </div>

      {!result.ok ? (
        /* Okunamadı "henüz bülten yazılmamış" değil (lib/admin-data.ts →
           `AdminResult`). */
        <AdminPanelError />
      ) : items.length === 0 ? (
        <AdminEmpty
          title={
            suzgecVar
              ? "Bu süzgeçle eşleşen bülten yok."
              : "Henüz bülten yazılmamış."
          }
        />
      ) : (
        /* HÜCRELER ÜSTTEN HİZALI. Telefonda satır iki satır manşet ve bir
           rozet satırı taşıyor; ortalanmış tarih manşetin ikinci satırının
           yanına düşüyor ve satırın neyle başladığı okunmuyordu. Tek
           satırlık geniş görünümde fark yok. */
        <AdminTable
          label="Bülten arşivi"
          head={["Tarih", "Manşet", "Son Yazma"]}
          minWidth={TABLO_TABAN}
          stickyFirst
          align="top"
        >
          {/* DİL SÜZGECİ BÜLTENİ SEÇİYOR, SATIRINI DEĞİL. Süzgeç bir dönem
              dil satırlarını gruplamadan ÖNCE eliyordu: `dil=en` ile gelen
              bültenin dil listesinde yalnızca "en" vardı ve manşeti
              İngilizceydi — TR kaydı olsa da. Eksik rozeti o yüzden süzgeçli
              görünümde gizleniyordu. Veri katmanı artık grubu süzüyor
              (lib/admin-data.ts → `getRecentBriefs`), rozet her görünümde
              doğru. */}
          {items.map((row) => (
            <BriefRow key={`${row.briefDate}-${row.period}`} row={row} bugun={bugun} />
          ))}
        </AdminTable>
      )}

      <p className="mt-4 border-t border-line pt-3 text-small text-muted">
        {/* SESSİZ KIRPMA YOK: kaç kaydın dışarıda kaldığı yazılı. */}
        {result.ok && total > items.length && (
          <>
            {total.toLocaleString("tr-TR")} bültenin en yenisi{" "}
            {items.length.toLocaleString("tr-TR")} tanesi listede; eskisine
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

function BriefRow({
  row,
  bugun,
}: {
  row: BriefItem;
  /** İstanbul takvim günü — yıl yalnızca başka bir yılsa yazılsın diye. */
  bugun: string;
}) {
  const haftalik = row.period === "weekly";
  const editor = (locale: string) =>
    `/admin/yazilar/bulten/${row.briefDate}?tur=${
      haftalik ? "haftalik" : "gunluk"
    }&dil=${locale}`;
  /* Manşet TÜRKÇE kayda gidiyor (yoksa var olana); her dil rozeti kendi
     editörüne. */
  const anaDil = row.locales[0] ?? "tr";

  /* Haftalık kayıt kapsadığı haftayla — çapası biten haftanın pazartesisi,
     rakamsal tarihi bir pazartesi bülteni gibi okunuyordu. Aralık tek
     parça kalıyor ("14–18 Eyl"), "Haftası" dar sütunda alt satıra
     inebiliyor. */
  const hafta = haftalik ? adminWeekRange(row.briefDate) : null;
  const haftaKesim = hafta ? hafta.lastIndexOf(" ") : -1;

  const stamp = adminStamp(row.generatedAt);
  const saatKesim = stamp.lastIndexOf(" ");

  return (
    <AdminRow>
      {/* TARİH SATIRIN ADI, BAĞLANTI DEĞİL. Tarih ve manşet aynı adrese
          giden iki bağlantıydı; satır başına dört odak durağı (tarih,
          manşet, TR, EN) klavyeyle yirmi dört satırı doksan altı adıma
          çıkarıyordu. Tarih artık `th scope="row"`: ekran okuyucu hücre
          hücre gezerken hangi bültenin satırında olduğunu söylüyor. */}
      <AdminCell rowHeader numeral strong>
        {/* TELEFONDA SABİT GENİŞLİK. Tablo otomatik yerleşimde ve sütun
            payını en uzun içeriğe göre dağıtıyor: "14–18 Eyl Haftası" tek
            satır genişliğini isteyince tarih sütunu 97 piksel alıyor,
            manşete 159 kalıyordu (390, ölçüldü). Kutu "14–18 Eyl"i (50
            piksel) tek satırda tutacak kadar; artan pay manşete gidiyor. */}
        <span className="block w-[3.75rem] sm:w-auto sm:whitespace-nowrap">
          {hafta ? (
            <>
              <span className="whitespace-nowrap">{hafta.slice(0, haftaKesim)}</span>{" "}
              {hafta.slice(haftaKesim + 1)}
            </>
          ) : (
            adminDayIn(row.briefDate, bugun)
          )}
        </span>
      </AdminCell>
      <AdminCell>
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <Link
            href={editor(anaDil)}
            /* Telefonda 44 piksellik gerçek hedef: altındaki dil rozetleri
               de bağlantı ve `.tap-44`in görünmez uzantısı komşu hedefin
               üstüne taşardı (globals.css → `.tap-44`, ikinci madde). */
            className="flex min-h-11 min-w-0 items-start text-strong transition-colors hover:text-primary sm:min-h-0 sm:flex-1 sm:items-center"
          >
            {/* Telefonda iki satır, genişte bir: bültenin kimliği tarih,
                manşet onu tanımaya yardım ediyor — tamamı editörde. */}
            <span className="line-clamp-2 sm:line-clamp-1">{row.headline}</span>
          </Link>
          {/* Rozet satırının 44 piksellik hedefleri görünen rozetten 24
              piksel yüksek; negatif pay o boşluğu hücrenin kendi alt
              dolgusuna bindiriyor — dolgu bağlantı değil, komşu satırın
              hedefine taşmıyor. Genişte bilgi rozetleri dil rozetlerinin
              ÖNÜNE geçiyor: TR ve EN her satırda aynı sağ kenarda durur,
              göz sütun gibi tarar. */}
          <span className="-mb-3 -mt-1.5 flex flex-wrap items-center gap-x-1.5 sm:m-0 sm:shrink-0 sm:flex-nowrap">
            <DilRozetleri row={row} editor={editor} />
            {haftalik && <Rozet className="sm:-order-1">Haftalık</Rozet>}
            {row.elden && <Rozet className="sm:-order-1">Elden Geçti</Rozet>}
            {/* "Rutin" artık yazılmıyor: 24/24 satırda aynıydı. İstisna
                kural tabanlı yedek — rutin o gün yazmamış demek. */}
            {row.generatedBy === "rules" && (
              <Rozet className="sm:-order-1">Kural Tabanlı</Rozet>
            )}
          </span>
        </span>
      </AdminCell>
      {/* SON YAZMA, GÖRELİ SÜRE DEĞİL AN (23 Eylül denetimi). Sütun
          "18 Saat Önce", "42 Saat Önce" yazıyordu; 16:10 TR günlük ve
          pazartesi 09:30 haftalık koşusunun zamanında yazıp yazmadığı
          buradan okunamıyordu. Şimdi İstanbul saatiyle an, göreli süre
          ipucunda.

          "SON" ÇÜNKÜ AN İKİ DİLİN EN YENİSİ ve her kayıtta tazeleniyor —
          rutinin yeniden yazımında da panelden düzeltmede de
          (lib/content-write.ts → `saveBrief`, `generatedAt`). İlk yazım
          anı ayrıca tutulmuyor; "Yazılma" demek bir düzeltmeyi ilk yazım
          gibi gösterirdi. Telefonda gün ve saat iki satır: sütun dar
          kalıyor, manşete yer açılıyor. */}
      <AdminCell align="right">
        <time
          dateTime={row.generatedAt.toISOString()}
          title={agoLabel(row.generatedAt)}
          className="numeral text-small text-muted"
        >
          <span className="block whitespace-nowrap sm:inline">{stamp.slice(0, saatKesim)}</span>{" "}
          <span className="block sm:inline">{stamp.slice(saatKesim + 1)}</span>
        </time>
      </AdminCell>
    </AdminRow>
  );
}

/**
 * TR ve EN — her biri kendi editörüne giden bir bağlantı; olmayan dil
 * pirinç tonda "EN Eksik" (bağlantısız: açılacak kayıt yok).
 */
function DilRozetleri({
  row,
  editor,
}: {
  row: BriefItem;
  editor: (locale: string) => string;
}) {
  return (
    <>
      {DILLER.map((locale) => {
        const etiket = locale === "en" ? "EN" : "TR";
        if (row.locales.includes(locale)) {
          return (
            <Link
              key={locale}
              href={editor(locale)}
              /* Telefonda gerçek 44 piksel, görünen rozet aynı boyda. */
              className="group inline-flex min-h-11 items-center sm:min-h-0"
            >
              <span className="numeral rounded-full bg-primary-wash px-2 py-0.5 text-nano font-bold text-primary-ink transition-colors group-hover:bg-primary group-hover:text-on-primary">
                {etiket}
              </span>
              <span className="sr-only">
                {locale === "en" ? " İngilizcesini düzenle" : " Türkçesini düzenle"}
              </span>
            </Link>
          );
        }
        return (
          <span
            key={locale}
            className="rounded-full bg-brass-wash px-2 py-0.5 text-nano font-bold text-brass-ink"
          >
            {etiket} Eksik
          </span>
        );
      })}
    </>
  );
}

/** Bilgi rozeti — nötr ton; yalnızca doğru olduğunda basılır. */
function Rozet({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full bg-surface-elevated px-2 py-0.5 text-nano font-semibold text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
