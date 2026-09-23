import Link from "next/link";
import { Suspense } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/primitives";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import { requireAdmin } from "@/lib/admin";
import {
  AdminCell,
  AdminEmpty,
  AdminPanel,
  AdminPanelError,
  AdminPanelSkeleton,
  AdminPanelTitle,
  AdminReadStamp,
  AdminRow,
  AdminTable,
  RankList,
  StatBox,
  StatGrid,
  StatGridSkeleton,
} from "@/components/admin/AdminUI";
import {
  getMemberSummary,
  getMostWatchedSymbols,
  getRecentMembers,
  getSignupSeries,
  type WatchedSymbol,
} from "@/lib/admin-data";
import { todayEt } from "@/lib/market-hours";
import { adminDay, adminDayIn, agoLabel } from "@/lib/admin-format";

/**
 * Üyeler.
 *
 * E-POSTA ADRESİ GÖSTERİLMİYOR ve sorgusu bile yapılmıyor (lib/admin-data.ts).
 * Panelin cevapladığı sorular — kaç kişi, ne zaman geldi, liste kurmuş mu,
 * hangi hisseleri izliyor — hiçbirinde e-posta gerekmiyor. Gerekmeyen kişisel
 * veriyi ekrana basmamak, KVKK metninde yazdığımız duruşun kod tarafı.
 */

/* Her bölümün kendi sekme başlığı: altısı "Yönetim · Açılış Zili"
   paylaşıyordu ve tarayıcı sekmesi, geçmiş, ekran okuyucu bölümleri
   ayıramıyordu. */
export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.members.title) };

/** Tabloya basılan en yeni hesap sayısı — dolduğunda başlık künyesi söylüyor. */
const MEMBER_LIMIT = 30;

/**
 * "En Çok Takip Edilenler" kaç sembol okuyor. On beşti ve on beşin on ikisi
 * tek üyeliydi; o kuyruk artık çubuk değil çip satırı, yani satır başına
 * 50 değil ~30 piksel — kırk sembol çip satırında birkaç satır tutuyor.
 */
const WATCHED_LIMIT = 40;

export default async function MembersPage() {
  /* Yetki kapısı SAYFADA da: layout yumuşak gezinmede yeniden koşmuyor. */
  await requireAdmin();

  return (
    /* SIRA: SAYILAR → ÜYE TABLOSU → TAKİP | KAYIT GÜNLERİ (23 Eylül
       denetimi). Tablo solda, iki panel sağda üst üsteydi ve ızgara satırı
       tabloyu sağ kolonun boyuna geriyordu: beş satırlık tablonun altında
       794 piksel boş panel (1440 ve 1024, ölçüldü). 1024'te de tablo
       kabından 7 piksel genişti ve son sütunu kırpıyordu. Tablo artık tam
       genişlikte — otuz satıra kadar büyüyen tek liste o — ve altındaki iki
       panel `items-start` ile yan yana, hiçbiri öbürünün boyuna
       gerilmiyor.

       TABAN ŞABLON `minmax(0,1fr)`. Şablonsuz ızgara telefonda örtük bir
       `auto` sütun açıyordu; sütun içeriğin en küçük genişliğine, 562
       piksele büyüdü ve 354 piksellik kapta her panel sağdan kesildi
       (390, ölçüldü). */
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Yönetim"
        title={ADMIN_SECTIONS.members.title}
        subtitle={ADMIN_SECTIONS.members.subtitle}
      />
      {/* "Aktif Okur"un künyesi ("Son 30 Gün · 3 Hesapta Kayıt Yok", 181
          piksel) telefonda iki satır; yer tutucu da (AdminUI →
          `StatGridSkeleton`). Damgasız hesap kalmadığında künye tek satıra
          iner; o gün bu dizi boşalır. */}
      <Suspense fallback={<StatGridSkeleton boxes={4} cols={4} wrapOnPhone={[2]} />}>
        <Summary />
      </Suspense>

      {/* Yer tutucu ölçüleri 1440'taki gerçek panellerden (başlık bloğu ve
          dolgu 118,5 piksel): tablo, başlık satırı ve künyeleriyle 462 =
          118,5 + 8 × 43; takip listesi 397 ≈ 118,5 + 5 × 55; kayıt günleri
          171 ≈ 118,5 + 2 × 26.
          Telefonda iki panel ayrı boyda (390, ölçüldü; başlık bloğu ve
          dolgu orada 112,5): tablo 478 = 112,5 + 8 × 45,7; takip listesi
          463,5 = 112,5 + 5 × 70,2 — tek üyeli semboller 44 piksellik
          çiplerle üç sıra. Tek boylu yer tutucu akış inince 97 piksel kısa
          kalıyordu. */}
      <Suspense
        fallback={
          <>
            <AdminPanelSkeleton rows={8} rowHeight={45.7} className="sm:hidden" />
            <AdminPanelSkeleton rows={8} rowHeight={43} className="hidden sm:block" />
          </>
        }
      >
        <RecentMembers />
      </Suspense>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-start">
        <Suspense
          fallback={
            <>
              <AdminPanelSkeleton rows={5} rowHeight={70.2} className="sm:hidden" />
              <AdminPanelSkeleton rows={5} rowHeight={55} className="hidden sm:block" />
            </>
          }
        >
          <WatchedSymbols />
        </Suspense>
        <Suspense fallback={<AdminPanelSkeleton rows={2} rowHeight={26} />}>
          <SignupCurve />
        </Suspense>
      </div>

      {/* Kaynak adı yok: sayfadaki her sayı aynı veritabanından. Açık kalan
          bir sekmede "24 Gün Önce" gibi göreli künyelerin hangi ana göre
          yazıldığını bu satır söylüyor. */}
      <AdminReadStamp />
    </div>
  );
}

async function Summary() {
  const result = await getMemberSummary();
  /* Okunamadı "0 üye" değil: kutuların hepsi tire ve "Veri Alınamadı". */
  if (!result.ok) {
    return (
      <StatGrid cols={4}>
        {["Toplam Üye", "Yeni Kayıt", "Aktif Okur", "Liste Kuran Okur"].map((label) => (
          <StatBox key={label} label={label} value="—" state="unavailable" />
        ))}
      </StatGrid>
    );
  }
  const s = result.data;
  /* ORANLAR YÖNETİCİSİZ (lib/admin-data.ts → `MemberSummary.readers`):
     sahibinin hesapları okur kitlesinin payına karışıyordu. Yöneticisiz
     sayının adı "Okur" ve ilk kutu bu ayrımı sayıyla tanımlıyor
     ("3 Okur · 2 Yönetici"); oran kutularının künyesi ayrıca "Yöneticiler
     Hariç" demek zorunda kalmıyor.

     ORAN EKSİZ YAZILIR. "Üyelerin %40'ı" sabit bir "ı" taşıyordu ve yalnızca
     kırk için doğruydu: %33'ı, %50'ı, %10'ı hepsi yanlış (ek sayının
     okunuşuna bağlı). Trafik sayfasının Üyelik notundaki kural: cümle eki
     hiç istemeyecek biçimde kurulur — "Oran %33". */
  const rate = (part: number) => `Oran %${Math.round((part / s.readers) * 100)}`;

  return (
    /* DÖRT KUTU, BEŞ DEĞİL. "Son 7 Gün" ve "Son 30 Gün" iki ayrı kutuydu ve
       ikisi de yeni kaydı sayıyordu; telefonda beş kutu üç satır tuttu ve
       ızgara 398 piksel ölçüldü — ilk veri paneli ekranın altında. Aynı
       ölçünün iki penceresi tek kutuda: değer 30 gün (altındaki Kayıt
       Günleri paneliyle aynı sayı), 7 gün künyede. Telefonda 2 + 2.

       KÜNYELER TEK SATIR — 1440 ve 1024'te. "Son 30 Günde Giriş · 3
       Hesapta Henüz Damga Yok" üç satıra sarıyor ve ızgara satırını bütün
       kutular için geriyordu (1024: beş kutu 157 piksel). Telefonda 138
       piksellik künye alanına tek satır sığmıyor; iki satır orada kabul. */
    <StatGrid cols={4}>
      <StatBox
        label="Toplam Üye"
        value={s.total.toLocaleString("tr-TR")}
        sub={
          s.admins > 0
            ? `${s.readers.toLocaleString("tr-TR")} Okur · ${s.admins.toLocaleString("tr-TR")} Yönetici`
            : undefined
        }
      />
      <StatBox
        label="Yeni Kayıt"
        value={s.last30.toLocaleString("tr-TR")}
        sub={`Son 30 Gün · 7 Günde ${s.last7.toLocaleString("tr-TR")}`}
      />
      {/* KAYITLI İLE KULLANAN AYRI. "Toplam Üye" tek başına geçmişi
          ölçüyor: otuz kayıtlı hesabın yirmi beşi bir daha hiç girmediyse o
          sayı bugün hakkında bir şey söylemiyor. Bu kutu son otuz günde
          giriş yapan okuru sayıyor.
          Damga yeni eklendi, yani ondan önce açılmış hesaplarda `null` —
          künye bunu SÖYLÜYOR, yoksa sayı olduğundan düşük görünür ve
          sebebi anlaşılmaz. Oran ancak damgasız hesap kalmadığında anlamlı;
          o zamana kadar künyenin yeri eksik damgaya ait. */}
      <StatBox
        label="Aktif Okur"
        value={s.readersActiveLast30.toLocaleString("tr-TR")}
        sub={
          s.neverSeen > 0
            ? `Son 30 Gün · ${s.neverSeen.toLocaleString("tr-TR")} Hesapta Kayıt Yok`
            : s.readers > 0
              ? `Son 30 Gün · ${rate(s.readersActiveLast30)}`
              : "Son 30 Gün"
        }
      />
      <StatBox
        label="Liste Kuran Okur"
        value={s.readersWithWatchlistItems.toLocaleString("tr-TR")}
        sub={s.readers > 0 ? rate(s.readersWithWatchlistItems) : "Okur Yok"}
      />
    </StatGrid>
  );
}

async function RecentMembers() {
  const result = await getRecentMembers(MEMBER_LIMIT);
  const rows = result.ok ? result.data : [];
  const today = todayEt();
  const now = new Date();

  return (
    <AdminPanel>
      <AdminPanelTitle
        hint={
          rows.length === MEMBER_LIMIT
            ? `En Yeni ${MEMBER_LIMIT} Hesap · E-posta Gösterilmez`
            : "En Yeniden Eskiye · E-posta Gösterilmez"
        }
      >
        Son Kaydolanlar
      </AdminPanelTitle>

      {!result.ok ? (
        <AdminPanelError />
      ) : rows.length === 0 ? (
        <AdminEmpty title="Henüz kayıtlı üye yok." />
      ) : (
        /* DÖRT SÜTUN, DİL SÜTUNU YOK. Her satırı "Türkçe" diyen bir sütun
           71 piksel tutuyor ve 1024'te tabloyu kabından taşırıyordu; bilgi
           yalnızca istisnada var. İngilizce okuyan üyenin adının yanında
           "EN" çipi duruyor.

           TELEFONDA KAYAR, SAKLAMAZ (CLAUDE.md, "Kaydırma saklanmaz").
           Taban 440 piksel: kullanıcı adı ve çipi (~190), iki tarih sütunu
           ve sayı. 390'daki 314 piksellik kapta tablo kendi kabında kayıyor,
           kullanıcı sütunu yerinde duruyor ve sağ kenar soluyor. */
        <AdminTable
          label="Son kaydolan üyeler"
          head={["Kullanıcı", "Kayıt", "Son Giriş", "Sembol"]}
          minWidth={440}
          stickyFirst
        >
          {rows.map((row) => (
            <AdminRow key={row.id}>
              <AdminCell strong rowHeader>
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  {row.username}
                  {/* Rozet Title Case, büyük harfe çevrilmiyor: `uppercase`
                      "Yönetici"yi "YÖNETİCİ" yapıyordu ve panelin geri
                      kalanı Title Case künye dilinde. */}
                  {row.role === "admin" && (
                    <span className="rounded-full bg-primary-wash px-2 py-0.5 text-tiny font-semibold text-primary-ink">
                      Yönetici
                    </span>
                  )}
                  {row.locale === "en" && (
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-tiny font-semibold text-muted">
                      EN
                    </span>
                  )}
                </span>
              </AdminCell>
              {/* Tarih ET gününden geliyor, `toISOString()` (UTC) DEĞİL:
                  bir üye 12 Ağustos 21:30 ET'de kaydolduğunda UTC zaten
                  13 Ağustos oluyordu ve bu tablo "13.08" derken hemen
                  yanındaki kayıt eğrisi (ET ile grupluyor) aynı kaydı
                  "12.08" satırında gösteriyordu. Yaz saatinde her günün
                  20:00-24:00 ET aralığı — günün altıda biri — bir gün
                  ileri görünüyordu.
                  OKUNUR TARİH (23 Eylül): "29.08.2026" panelin öbür
                  ekranlarındaki "29 Ağu" ile iki ayrı sözlük gibi
                  duruyordu. Yıl yalnızca bu yıl değilse yazılıyor. */}
              <AdminCell numeral>
                <span className="whitespace-nowrap">{adminDayIn(row.createdOn, today)}</span>
              </AdminCell>
              {/* "Hiç" ile "eski" ayrı: damga eklenmeden önce açılmış
                  hesapta giriş olmuş olabilir ama kaydı yok — o yüzden
                  boş hücre değil, açıkça söyleniyor. Hücre bir dönem "—"
                  basıyordu ve bu yorumun söylediğini yapmıyordu; ifade
                  Aktif Okur kutusunun künyesiyle aynı: "Kayıt Yok". */}
              <AdminCell numeral>
                {row.lastSeenAt ? (
                  <span className="whitespace-nowrap">{agoLabel(row.lastSeenAt, now)}</span>
                ) : (
                  <span className="whitespace-nowrap text-muted">Kayıt Yok</span>
                )}
              </AdminCell>
              <AdminCell align="right" numeral strong={row.symbolCount > 0}>
                {row.symbolCount}
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}

      {/* KÜNYELER PANELİN DİBİNDE, saç teliyle (CLAUDE.md, "Ekran düzeni"
          6). Yönetici ekleme komutu bir dönem Kayıt Günleri panelindeydi —
          o panelin konusuyla ilgisi yok — ve kod parçası kelimenin
          ortasından sarıyordu ("make-" / "admin.mts"); telefonda kabından
          taşıyordu. Komut artık ilgili tablonun altında, açılır bir
          künyede ve tek satır: sığmazsa kendi kabında kayıyor. */}
      <div className="mt-4 flex flex-col border-t border-line pt-2 text-small text-muted">
        {/* KVKK bağlantısı telefonda 44 piksel: satır içi bir bağlantıydı ve
            hedefi 15 piksel ölçüldü. */}
        <p>
          <Link
            href="/kvkk"
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:text-primary-hover sm:min-h-8"
          >
            KVKK Metni
          </Link>{" "}
          · hangi verinin neden tutulduğu orada yazılı.
        </p>
        <details className="group/admin-cli">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-8 [&::-webkit-details-marker]:hidden">
            Yönetici Ekleme
            <CaretDown
              size={12}
              weight="bold"
              aria-hidden
              className="transition-transform group-open/admin-cli:rotate-180"
            />
          </summary>
          <p className="mt-1">Komut satırında, üyenin kullanıcı adıyla:</p>
          {/* Telefonda bir kademe küçük: 12 pikselde komut 312 piksellik
              kaptan 19 piksel taşıyordu (390, ölçüldü) ve kaydırması
              yalnızca masaüstünde görünüyor. */}
          <pre className="scroll-x-hint mt-2 rounded-(--radius-sm) bg-surface-elevated px-3 py-2 text-tiny text-body sm:text-small">
            <code className="whitespace-nowrap">npx tsx scripts/make-admin.mts kullanıcıadı</code>
          </pre>
        </details>
      </div>
    </AdminPanel>
  );
}

/**
 * Şirket adının hukuki son eki — "Inc", "Corp", "NV".
 *
 * Aynı listede "Marvell Technology Inc" ile "RGTI" yan yana duruyordu (23
 * Eylül denetimi): ek ayırt edici değil, yalnızca satırı uzatıyor ve
 * telefonda adın kendisini kırptırıyordu. Yalnızca SONDAKİ ek siliniyor;
 * "Trust", "Group" gibi adın parçası olan sözcükler kalıyor.
 */
const LEGAL_SUFFIX = /[,\s]+(?:Inc|Corp|Corporation|Co|Ltd|Plc|N\.?V|S\.?A|AG|SE)\.?$/i;

function watchedLabel(row: WatchedSymbol): string {
  const name = row.name?.replace(LEGAL_SUFFIX, "").trim();
  return name ? `${row.symbol} · ${name}` : row.symbol;
}

async function WatchedSymbols() {
  const result = await getMostWatchedSymbols(WATCHED_LIMIT);
  if (!result.ok) {
    return (
      <AdminPanel>
        <AdminPanelTitle hint="Kaç Ayrı Üyenin Listesinde">En Çok Takip Edilenler</AdminPanelTitle>
        <AdminPanelError />
      </AdminPanel>
    );
  }

  const { rows, total } = result.data;
  /* SIRALAMA ANCAK FARK VARSA. On beş satırın on ikisi "1 üye"de eşitti ve
     on iki özdeş yarım çubuk 600 piksel boyunca hiçbir sıralama
     anlatmıyordu. Çubuk yalnızca birden fazla üyenin izlediği sembollerde;
     tek üyenin listesindekiler bir çip satırı, alfabetik (eşitlik veri
     katmanında sembolle bozuluyor). */
  const ranked = rows.filter((r) => r.members > 1);
  const single = rows.filter((r) => r.members === 1);
  const more = total - rows.length;

  return (
    <AdminPanel>
      <AdminPanelTitle hint="Kaç Ayrı Üyenin Listesinde">En Çok Takip Edilenler</AdminPanelTitle>
      {rows.length === 0 ? (
        <AdminEmpty title="Henüz kimse listesine sembol eklememiş." />
      ) : (
        <>
          {ranked.length > 0 && (
            <RankList
              rows={ranked.map((r) => ({
                key: r.symbol,
                label: watchedLabel(r),
                href: `/hisse/${r.symbol}`,
                value: r.members,
              }))}
              hiddenAfter={10}
            />
          )}
          {single.length > 0 && (
            <div className={ranked.length > 0 ? "mt-3 border-t border-line pt-4" : undefined}>
              <p className="text-small font-semibold text-muted">
                Tek Üyenin Listesinde ·{" "}
                <span className="numeral">{single.length.toLocaleString("tr-TR")} Sembol</span>
              </p>
              {/* Çip telefonda 44 piksel: yan yana dizilen dokunma
                  hedefleri, FilterChip'in ölçüsü. Ad `title`da — sembol
                  kimliği zaten taşıyor, ad yalnızca üzerine gelindiğinde. */}
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {single.map((r) => (
                  <li key={r.symbol}>
                    <Link
                      href={`/hisse/${r.symbol}`}
                      title={r.name?.replace(LEGAL_SUFFIX, "").trim() || undefined}
                      className="inline-flex min-h-11 items-center rounded-full bg-surface-elevated px-3 text-small font-semibold text-body transition-colors hover:text-strong sm:min-h-8"
                    >
                      {r.symbol}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* SESSİZ KIRPMA YOK — kayıt eğrisindeki kural. */}
          {more > 0 && (
            <p className="mt-3 text-small text-muted">
              En Çok {rows.length.toLocaleString("tr-TR")} ·{" "}
              {more.toLocaleString("tr-TR")} Sembol Daha
            </p>
          )}
        </>
      )}
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
  const result = await getSignupSeries(30);
  const series = result.ok ? result.data : [];
  const withSignups = series.filter((p) => p.signups > 0).reverse();
  const total = series.reduce((sum, p) => sum + p.signups, 0);
  /* Künye pencerenin KENDİSİ: "Son 30 Gün" yazıyordu ve hemen altındaki
     cümle de "Son 30 günde" diyordu. Tarih aralığı hem tekrarı kaldırıyor
     hem pencerenin nerede başladığını söylüyor (ET günleri, Son 30 Gün
     kutusuyla aynı pencere — lib/admin-data.ts → `memberWindowStart`). */
  const range =
    series.length > 0
      ? `${adminDay(series[0].day)} – ${adminDay(series[series.length - 1].day)}`
      : "Son 30 Gün";

  return (
    <AdminPanel>
      <AdminPanelTitle hint={range}>Kayıt Günleri</AdminPanelTitle>
      {!result.ok ? (
        <AdminPanelError />
      ) : withSignups.length === 0 ? (
        <AdminEmpty title="Son 30 günde yeni kayıt yok." />
      ) : (
        <>
          <p className="mb-3 text-base text-body">
            Son 30 günde{" "}
            <span className="font-semibold text-strong">{total}</span> kayıt,{" "}
            {withSignups.length} ayrı güne yayılmış.
          </p>
          {/* `max-w-xs`: tarih ile sayı panelin iki ucundaydı ve tek satırlık
              listede aralarında 313 piksel boşluk kalıyordu (1440). */}
          <ul className="flex max-w-xs flex-col gap-1.5 text-base">
            {withSignups.slice(0, 10).map((point) => (
              <li key={point.day} className="flex justify-between gap-4">
                <span className="text-body">{adminDay(point.day)}</span>
                <span className="numeral font-semibold text-strong">{point.signups}</span>
              </li>
            ))}
          </ul>
          {/* SESSİZ KIRPMA YOK. Üstteki cümle "N ayrı güne yayılmış" diyor
              ama liste en yeni ondan sonrasını basmıyordu; okuyan sayıyı
              satırlarla doğrulayamıyordu. */}
          {withSignups.length > 10 && (
            <p className="mt-2 text-small text-muted">
              En Yeni 10 Gün · {withSignups.length - 10} Gün Daha
            </p>
          )}
        </>
      )}
    </AdminPanel>
  );
}
