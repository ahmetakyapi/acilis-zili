import { Fragment } from "react";
import Link from "next/link";
import type { PublishDay } from "@/lib/admin-data";
import { BRIEF_PUBLISH_TR } from "@/lib/data";
import { adminDay } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import { AdminEmpty } from "@/components/admin/AdminUI";
import { Skeleton } from "@/components/ui/primitives";

/**
 * Yayın ritmi takvimi — hangi gün ne yazıldı, hangi gün boş kaldı.
 *
 * NEDEN VAR: panel "bugünün bülteni var mı" sorusunu cevaplıyordu ama
 * "geçen ay hangi günler boş kaldı" sorusunu değil. Bir rutin birkaç gün
 * durup sonra devam ettiğinde geriye dönüp bakmanın hiçbir yolu yoktu.
 * Izgara boşlukları tek bakışta gösteriyor; dolu bir güne basmak kaydını
 * açıyor, yani geçmişe gitmenin yolu da bu.
 *
 * ÜÇ ŞERİDİN BEKLENTİSİ FARKLI ve tek bir dolu/boş durumu ikisinde yalan
 * söylerdi:
 *
 *   · BÜLTEN HER GÜN bekleniyor, hafta sonu dahil. Bu satır bir dönem
 *     "hafta sonu ve tatilde boş olması eksik değil" diyordu ve o günler
 *     gri zeminde, hiçbir zaman kırmızı olmuyordu. Kural yalnızca geriye
 *     dönük doldurma promptundaydı; rutin tablosu "her gün 16:10 TR" diyor
 *     ve ölçüldü (23 Eylül): 03 Ağu–23 Eyl arası 52 hücrenin 52'si hafta
 *     sonu dahil yazılmış. Kaçırılan bir cumartesi artık kırmızı; bugünün
 *     16:10'u pay ile geçip kayıt yoksa hücre "Gecikti" (sarı). Beklenti
 *     lib/routine-schedule.ts'te, Sistem sayfasıyla aynı yerde. Bülten
 *     şeridinde bu yüzden "hafta sonu" hâli HİÇ YOK.
 *   · MERCEK günde İKİ koşum (11:30 ve 23:30 TR) ama koşullu: anlatmaya
 *     değer olay yoksa yazmıyor. Hücre adet gösteriyor, yargı vermiyor;
 *     boş gün "Beklenmiyordu", hafta sonu da dahil (rutin hafta sonu da
 *     koşuyor).
 *   · ANALİZ yalnızca aday çeyrek varsa yazılıyor ve aday geçmişi
 *     tutulmuyor — boş bir gün "yazılmadı" değil, "aday yoktu" olabilir.
 *     Bu yüzden o şeritte boş hücre nötr. "Hafta Sonu ve Tatil" yalnızca
 *     BURADA anlam taşıyor: borsa kapalıyken bilanço açıklanmıyor.
 *
 * ÜÇÜ YAN YANA, ALT ALTA DEĞİL. Şeritler bir dönem alt alta duruyordu ve
 * karşılaştırma o düzende çalışmıyordu: "mercek yazılmayan hafta bülten de
 * eksik miydi" sorusu, iki ızgaranın aynı SÜTUNUNA bakmayı gerektiriyor ve
 * alt alta dizilmiş şeritlerde o sütunlar birbirinden yüz piksel uzaktaydı.
 * Yan yana dizilince aynı hafta üç şeritte de aynı yatay konumda duruyor.
 *
 * HÜCRE 20 PİKSELDEN 28'E ÇIKTI. Küçük hâlinde adet yazısı 10 punto idi ve
 * ızgara okunacak bir tablo değil, bakılacak bir doku gibi duruyordu; üç
 * şerit yan yana gelince genişlik de bunu kaldırıyor.
 *
 * RENK TEK TAŞIYICI DEĞİL: dolu hücre hem renk hem adet yazısı taşıyor,
 * eksik hücre de kendi işaretini. Hücrenin `title`ı tam tarihi ve durumu
 * söylüyor; ızgarayı hiç okuyamayan için altında aynı bilgi metin olarak
 * duran bir künye var.
 *
 * HER İŞARET KOMŞUSUNA KARŞI 3:1 (23 Eylül denetimi, WCAG 1.4.11). Durumların
 * yarısı neredeyse görünmüyordu: haftalık noktası (`bg-chart-b`, pirinç)
 * dolu mavi hücrenin üstünde 1,16:1 (koyu 1,54), "hafta sonu" zemini
 * (`bg-surface-sunken`) panele karşı 1,09:1 (koyu 1,07) ölçüldü; bugünün
 * hücresi de "beklenmiyordu" hücresiyle birebir aynı çiziliyordu. Şimdi her
 * hâlin ölçülen bir taşıyıcısı var — değerler `HAL_SINIFI` ve `HaftalikIsaret`
 * yanında.
 */

/** Izgara pazartesi başlıyor; sütundaki sıra bu dizinin sırası. */
export const GUNLER = [
  { kisa: "Pt", ad: "Pazartesi" },
  { kisa: "Sa", ad: "Salı" },
  { kisa: "Ça", ad: "Çarşamba" },
  { kisa: "Pe", ad: "Perşembe" },
  { kisa: "Cu", ad: "Cuma" },
  { kisa: "Ct", ad: "Cumartesi" },
  { kisa: "Pz", ad: "Pazar" },
] as const;

type Serit = "daily" | "stories" | "analyses";

/* Künyede SAAT VAR, EK YOK: "16:10'da" gibi bir ek saatin okunuşuna bağlı
   ve saat `BRIEF_PUBLISH_TR`den geliyor — sabit bir ek, saat değiştiği gün
   yanlış olurdu (Trafik ekranının "EK SABİT YAZILAMAZ" kararı). */
const SERITLER = [
  {
    key: "daily" as const,
    baslik: "Günlük Bülten",
    not: `Her Gün ${BRIEF_PUBLISH_TR.daily} TR`,
  },
  {
    key: "stories" as const,
    baslik: "Mercek Yazısı",
    not: "Koşullu · Günde En Çok İki Koşum",
  },
  {
    key: "analyses" as const,
    baslik: "Bilanço Analizi",
    not: "Koşullu · Aday Çeyrek Varsa Yazılır",
  },
] satisfies { key: Serit; baslik: string; not: string }[];

/**
 * Hücrenin ortak ölçüsü — üç şerit de aynı ızgaraya oturmak zorunda.
 *
 * DAR EKRANDA 32, `lg`DE 28 PİKSEL. Şeritler `lg` altında alt alta ve tam
 * genişlikte duruyor, yani orada yer var; `lg`de üçü yan yana geliyor ve
 * kolon başına ~298 piksel düşüyor. Ölçüldü: 32 piksel + 4 piksel aralıkla
 * sekiz hafta 8×32 + 7×4 + 24 (gün etiketleri) = 308 piksel, 390 piksellik
 * telefonda kaba düşen 314 pikselin içinde. `lg`de aynı hesap 28+3 ile 269.
 * Dokunma hedefi böylece telefonda 32 piksele çıkıyor ve komşusuyla arası
 * 4 piksel — WCAG 2.5.8'in 24 piksellik dairelerini örtüştürmeyen aralık.
 */
const HUCRE =
  "flex h-8 w-8 items-center justify-center rounded-sm text-tiny font-bold lg:h-7 lg:w-7";

type Hal = "written" | "filled" | "missed" | "late" | "today" | "none" | "off";

/**
 * Hâlin çizimi. Oranlar panel zeminine (açık #fff, koyu #101a28) karşı,
 * 23 Eylül'de ölçüldü; ölçüm betiği `data-state` kancasını okuyor.
 *
 *   · `none` — BEKLENMİYORDU. `border-line` 1,22:1 idi ve boş hücre ızgarada
 *     seçilmiyordu; `border-line-strong` bir ton koyu (1,41:1, koyu 1,89).
 *     Nötr bir hâl, 3:1 aranmıyor: yazı yok ve yokluğu bir sorun değil.
 *   · `off` — HAFTA SONU VE TATİL, yalnızca bilanço şeridi. `surface-sunken`
 *     zemin 1,09:1'di ve "beklenmiyordu" hücresinden ayrılmıyordu (ikisi de
 *     boş kare). Şimdi `--text-muted` mürekkebiyle ince bir tarama: çizgi
 *     panele karşı 5,57:1 (koyu 5,82) ve hâl rengine değil DOKUYA dayanıyor
 *     — renk körü okur da "boş" ile "kapalı"yı ayırıyor.
 *   · `today` — BUGÜN kesikli `border-primary` (4,87:1, koyu 7,87): gün
 *     sürüyor, hüküm yok.
 *     "Beklenmiyordu" ile aynı çiziliyordu; okur bugünün hangi hücre
 *     olduğunu sütunu sayarak buluyordu.
 *   · `late` — Gecikti, pirinç: bugünün 16:10 TR'si pay ile geçti.
 */
const HAL_SINIFI: Record<Hal, string> = {
  written: "bg-primary text-on-primary",
  filled: "bg-primary text-on-primary",
  missed: "border border-down bg-down-wash",
  late: "border border-brass bg-brass-wash",
  today: "border border-dashed border-primary",
  none: "border border-line-strong",
  off: "border border-line-strong bg-[repeating-linear-gradient(135deg,var(--text-muted)_0_1px,transparent_1px_5px)]",
};

function halOf(gun: PublishDay, serit: Serit): Hal {
  if (serit === "daily") {
    if (gun.dailyState === "written") return "written";
    if (gun.dailyState === "missed") return "missed";
    if (gun.dailyState === "late") return "late";
    return gun.isToday ? "today" : "none";
  }
  const adet = serit === "stories" ? gun.stories : gun.analyses;
  if (adet > 0) return "filled";
  if (gun.isToday) return "today";
  /* Tatil YALNIZCA bilanço şeridinde: mercek rutini hafta sonu da
     koşuyor ve boş bir cumartesi orada sıradan bir "beklenmiyordu". */
  if (serit === "analyses" && gun.offDay) return "off";
  return "none";
}

type HucreCizici = (serit: Serit, gun: PublishDay | undefined, gunNo: number) => React.ReactNode;

/**
 * Şeritlerin iskeleti — gerçek ızgara ve yer tutucusu AYNI düzeni çiziyor,
 * yalnızca hücre farklı. Yer tutucu elle ölçülmüş bir çubuk olsaydı iki
 * düzen ayrı düşerdi (gerekçe AdminUI → `AdminPanelSkeleton`).
 */
function Seritler({ haftalar, hucre }: { haftalar: (PublishDay | undefined)[][]; hucre: HucreCizici }) {
  return (
    /* Üç şerit üç kolonda. Ölçü `lg`de: sekiz hafta × 28 piksel + 7 × 3
       piksel aralık = 245, artı gün etiketleri sütunu 24 = 269 piksel;
       kolon başına ~298 piksel düşüyor. `lg` altında şeritler alt alta ve
       hücre 32 piksele çıkıyor (gerekçe `HUCRE`de). `scroll-x` iki durumda
       da duruyor: hafta sayısı büyürse ilk kırılan yer burası. */
    <div data-rhythm-strips className="grid gap-5 lg:grid-cols-3">
      {SERITLER.map((serit) => (
        <div key={serit.key} className="flex min-w-0 flex-col gap-2">
          <p className="flex flex-col gap-0.5">
            <span className="text-base font-semibold text-strong">{serit.baslik}</span>
            <span className="text-tiny text-muted">{serit.not}</span>
          </p>

          <div className="flex gap-1.5">
            {/* Gün başlıkları solda tek sütun: yedi sütunun üstüne yazmak
                üç şeritte üç kez tekrar demekti. */}
            <div aria-hidden className="flex shrink-0 flex-col gap-1 pt-[1px] lg:gap-[3px]">
              {GUNLER.map((g) => (
                <span key={g.kisa} className="flex h-8 items-center text-tiny text-muted lg:h-7">
                  {g.kisa}
                </span>
              ))}
            </div>

            {/* Haftalar sütun sütun, en eskiden yeniye — okuma yönü zamanla
                aynı. */}
            <div className="scroll-x flex min-w-0 flex-1 gap-1 lg:gap-[3px]">
              {haftalar.map((hafta, h) => (
                <div key={hafta[0]?.day ?? h} className="flex flex-col gap-1 lg:gap-[3px]">
                  {Array.from({ length: 7 }, (_, i) => (
                    <Fragment key={hafta[i]?.day ?? `bos-${i}`}>
                      {hucre(serit.key, hafta[i], i)}
                    </Fragment>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublishGrid({ days }: { days: PublishDay[] }) {
  if (days.length === 0) {
    return <AdminEmpty title="Ritim için henüz yeterli kayıt yok." />;
  }

  /* Izgara pazartesi başlıyor (haftalık bülten pazartesi yazılıyor), yani
     satırlar yediye tam bölünüyor ve ilk hücre her zaman pazartesi. */
  const haftalar: PublishDay[][] = [];
  for (let i = 0; i < days.length; i += 7) haftalar.push(days.slice(i, i + 7));

  return (
    <div className="flex flex-col gap-5">
      <Seritler
        haftalar={haftalar}
        hucre={(serit, gun, gunNo) =>
          gun ? (
            <Hucre gun={gun} serit={serit} gunAdi={GUNLER[gunNo].ad} />
          ) : (
            <span aria-hidden className="h-8 w-8 rounded-sm lg:h-7 lg:w-7" />
          )
        }
      />
      <Gosterge />
    </div>
  );
}

/**
 * Izgaranın yer tutucusu — aynı şeritler, aynı gösterge, hücreler iskelet.
 * Sekiz tam hafta: bu haftanın kalan günleri gerçekte boş ama yükseklik
 * yedi satırda aynı, yer tutucunun işi de o.
 */
export function PublishGridSkeleton({ weeks }: { weeks: number }) {
  const haftalar: undefined[][] = Array.from({ length: weeks }, () => Array.from({ length: 7 }, () => undefined));
  return (
    <div className="flex flex-col gap-5">
      <Seritler
        haftalar={haftalar}
        hucre={() => <Skeleton className="h-8 w-8 rounded-sm lg:h-7 lg:w-7" />}
      />
      <Gosterge />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Gösterge
   -------------------------------------------------------------------------- */

/** Göstergenin küçük hücresi — ızgaradaki hücrenin 14 piksellik kopyası. */
function Ornek({ hal, children }: { hal: Hal; children?: React.ReactNode }) {
  return (
    <span
      aria-hidden
      data-swatch={hal}
      /* Köşe hücreyle ORANTILI (8/28 → 4/14): `rounded-xs` 14 piksellik
         karede 6 piksel ve kare daireye dönüyordu — gösterge hücreye değil
         noktaya benziyordu. */
      className={cn("relative size-3.5 shrink-0 rounded-[4px]", HAL_SINIFI[hal])}
    >
      {children}
    </span>
  );
}

/**
 * İŞARETLERİN ANLAMI YAZILI — renk tek taşıyıcı değil.
 *
 * "Yazılmadı — Beklenmiyordu Da" idi: bağlaç büyük harfle (CLAUDE.md: "da"
 * küçük kalır) ve iki hükmü tek etikete sıkıştırıyordu. Şimdi tek sözcük,
 * "Beklenmiyordu" — boş hücrenin söylediği tam olarak bu.
 */
function Gosterge() {
  const ogeler: { key: string; ornek: React.ReactNode; ad: string }[] = [
    { key: "written", ornek: <Ornek hal="written" />, ad: "Yazıldı" },
    { key: "missed", ornek: <Ornek hal="missed" />, ad: "Beklenirken Yazılmadı" },
    { key: "late", ornek: <Ornek hal="late" />, ad: "Gecikti" },
    { key: "today", ornek: <Ornek hal="today" />, ad: "Bugün" },
    { key: "none", ornek: <Ornek hal="none" />, ad: "Beklenmiyordu" },
    { key: "off", ornek: <Ornek hal="off" />, ad: "Hafta Sonu ve Tatil" },
    {
      key: "weekly",
      ornek: (
        <Ornek hal="written">
          <HaftalikIsaret durum="written" hucreDolu kucuk />
        </Ornek>
      ),
      ad: "Haftalık Bülten Yazıldı",
    },
    {
      key: "weekly-missing",
      ornek: (
        <Ornek hal="written">
          <HaftalikIsaret durum="missing" hucreDolu kucuk />
        </Ornek>
      ),
      ad: "Haftalık Bülten Yazılmadı",
    },
  ];
  return (
    <ul data-legend className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-tiny text-muted">
      {ogeler.map((oge) => (
        <li key={oge.key} className="inline-flex items-center gap-1.5">
          {oge.ornek}
          {oge.ad}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------------
   Hücre
   -------------------------------------------------------------------------- */

/**
 * Haftalık bültenin işareti — yazıldığı PAZARTESİNİN sağ üst köşesinde.
 *
 * `on-primary` NOKTA, DOLU HÜCREDE. Nokta pirinçti (`bg-chart-b`) ve dolu
 * mavi hücrenin üstünde 1,16:1 ölçüldü (koyu 1,54) — haftalık bilginin tek
 * taşıyıcısı neredeyse görünmüyordu. `on-primary` hücrenin kendi yazı
 * rengi: açıkta beyaz / #0d74c4 4,87:1, koyuda #06121f / #35b8ff 8,48:1.
 * Hücre dolu değilse (o pazartesinin günlüğü eksik) zemin açık bir yıkama;
 * orada nokta `primary` — kırmızı yıkamaya karşı 4,12:1 (koyu 6,73:1).
 *
 * YAZILMADIYSA KIRMIZI NOKTA, `on-primary` HALKAYLA. Kırmızı dolu mavinin
 * üstünde 1,25:1 kalıyor (koyu 1,34; iki doygun renk, yakın parlaklık);
 * halka ikisini ayırıyor — halka hücreye karşı 4,87:1 (koyu 8,48:1),
 * kırmızı halkaya karşı 6,08:1 (koyu 6,34:1). Ölçüm yapay bir ızgarayla,
 * kaçırılmış bir cumartesi ve eksik bir haftalıkla alındı.
 */
function HaftalikIsaret({
  durum,
  hucreDolu,
  kucuk = false,
}: {
  durum: "written" | "missing";
  hucreDolu: boolean;
  /** Gösterge örneğinde — 14 piksellik karede. */
  kucuk?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-weekly={durum}
      className={cn(
        "absolute rounded-full",
        kucuk ? "right-0.5 top-0.5 size-1.5" : "right-1 top-1 size-2",
        durum === "written"
          ? hucreDolu
            ? "bg-on-primary"
            : "bg-primary"
          : cn("bg-down", hucreDolu && (kucuk ? "ring-[1.5px] ring-on-primary" : "ring-2 ring-on-primary")),
      )}
    />
  );
}

/**
 * Hücrenin anlamı `title`da DEĞİL, erişilebilir metinde.
 *
 * `title` yalnızca farenin üzerinde durduğu makinede çalışıyor: dokunmatikte
 * hiç açılmıyor, klavyeyle odaklanınca da çoğu tarayıcıda çıkmıyor. Izgara
 * telefonda da okunuyor ve orada hücrenin ne dediğini öğrenmenin bir yolu
 * yoktu. Metin `sr-only` bir span'de duruyor — ekran okuyucu okuyor, `title`
 * da faredekiler için yerinde kalıyor.
 *
 * Tarih GÜN ADIYLA ("19 Eyl Cumartesi"): kaçırılan bir günün hafta sonu mu
 * olduğu, hücreyi satırından okuyamayan için de söylenmeli.
 */
function hucreMetni(tarih: string, serit: Serit, gun: PublishDay, hal: Hal) {
  if (serit === "daily") {
    /* Saatin yanında ek YOK ("16:10 TR'de" değil "beklenen saat 16:10
       TR"): "bekleniyor"un önündeki "'de" 16:10'un okunuşuyla uyuşmuyordu
       ve saat sabitten geldiği için her ek bir gün yanlış olacaktı. */
    const durum =
      hal === "written"
        ? "yazıldı"
        : hal === "missed"
          ? "yazılmadı"
          : hal === "late"
            ? `gecikti, beklenen saat ${BRIEF_PUBLISH_TR.daily} TR`
            : hal === "today"
              ? `bugün, beklenen saat ${BRIEF_PUBLISH_TR.daily} TR`
              : "henüz beklenmiyor";
    return `${tarih} · Günlük bülten: ${durum}${
      gun.weekly
        ? " · biten haftanın bülteni de bu gün yazıldı"
        : gun.weeklyMissing
          ? " · biten haftanın bülteni yazılmadı"
          : ""
    }`;
  }
  const adet = serit === "stories" ? gun.stories : gun.analyses;
  const tur = serit === "stories" ? "Mercek yazısı" : "Bilanço analizi";
  const durum =
    adet > 0
      ? `${adet} kayıt`
      : hal === "today"
        ? "bugün henüz yok"
        : hal === "off"
          ? "borsa kapalı"
          : "yazılmadı";
  return `${tarih} · ${tur}: ${durum}`;
}

function Hucre({ gun, serit, gunAdi }: { gun: PublishDay; serit: Serit; gunAdi: string }) {
  const hal = halOf(gun, serit);
  const metin = hucreMetni(`${adminDay(gun.day)} ${gunAdi}`, serit, gun, hal);
  const adet = serit === "stories" ? gun.stories : serit === "analyses" ? gun.analyses : 0;

  const kutu = (
    <span
      data-state={hal}
      title={metin}
      className={cn("relative", serit !== "daily" && "numeral", HUCRE, HAL_SINIFI[hal])}
    >
      {/* Bülten hücresinde YAZI YOK. Her dolu hücre bir "•" taşıyordu:
          hiçbir şey saymayan, hiçbir durumu ayırmayan bir işaret — elli bir
          hücrede elli bir kez tekrar eden gürültü. Adet yalnızca mercek ve
          analizde, orada gerçekten bir sayı. */}
      {adet > 0 && <span aria-hidden>{adet}</span>}
      {/* Bülten tek şeritte iki kaydı taşıyor: günlük her gün, haftalık
          yalnızca pazartesi. Hücre günlüğü gösteriyor, haftalık bültenin
          YAZILDIĞI pazartesiye bir işaret düşüyor — ayrı bir şerit sekiz
          haftada yalnızca sekiz dolu hücre çizerdi. Hâl veri katmanından
          (`PublishDay.weekly` çapa + 7'de), beklenti tek yerde. */}
      {serit === "daily" && (gun.weekly || gun.weeklyMissing) && (
        <HaftalikIsaret durum={gun.weekly ? "written" : "missing"} hucreDolu={hal === "written"} />
      )}
      <span className="sr-only">{metin}</span>
    </span>
  );

  /* GEÇMİŞE GİTMENİN YOLU: dolu bülten hücresi o günün kaydını YÖNETİMDEKİ
     bülten listesinde açıyor (iki dil, iki editör bağlantısı). Sitedeki
     `/bulten` sayfasına gidiyordu — düzeltme yapılacak yer orası değil ve
     panelden çıkılıyordu (23 Eylül denetimi). `donem=gunluk`: pazartesi
     hücresinin günü haftalık bir çapayla da eşleşir ve o kayıt BİR SONRAKİ
     pazartesi yazılan bültendir; hücre yalnızca kendi günlüğünü açıyor.
     Boş hücre bağlantı olmuyor — gidilecek bir kayıt yok.

     `prefetch={false}`: ızgarada elli küsur bağlantı ve hepsi ilk ekranda;
     üretimde görünür her bağlantı için bir ön yükleme isteği gidiyordu.
     Bunlara nadiren basılıyor.

     DOKUNMA HEDEFİ HÜCRENİN KENDİSİ ve bu bilinçli. Hedefi görünmez
     dolguyla büyütmenin iki yolu da burada işe yaramıyor: `.tap-44`
     hücreler alt alta dizili olduğu için bir alttakinin hedefini yutar,
     negatif marjla genişletmek de komşularla ÖRTÜŞEN hedefler üretir —
     takvimde bunun anlamı "yanlış güne basmak" ve düzeltmeye çalıştığımız
     şeyin ta kendisi. Çözüm hücreyi gerçekten büyütmek (`HUCRE` ölçüsü) ve
     aralığı açmak; hedefler ayrı kalıyor. */
  return serit === "daily" && gun.daily ? (
    <Link
      href={`/admin/yazilar/bulten?tarih=${gun.day}&donem=gunluk`}
      prefetch={false}
      className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
    >
      {kutu}
    </Link>
  ) : (
    kutu
  );
}
