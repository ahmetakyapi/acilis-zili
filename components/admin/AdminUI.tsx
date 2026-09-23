import { Children, isValidElement } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";

/**
 * Yönetim panelinin kendi parçaları.
 *
 * DİL: panel yalnızca Türkçe. Sitenin geri kalanı sözlükten besleniyor ve o
 * kural yerinde duruyor; burası okuyucuya değil SAHİBİNE bakan bir ekran ve
 * iki dilli tutmak sözlüğe seksen anahtar daha ekler, hiçbiri hiçbir zaman
 * İngilizce okunmaz. Karar bilinçli, unutulmuş değil.
 *
 * Parçalar `components/ui/primitives.tsx` yerine ayrı duruyor çünkü
 * ÖLÇÜLERİ farklı: panel yoğun bir veri ekranı, okuma ekranı değil. Sayı
 * kutuları daha sıkı, tablolar daha küçük puntolu.
 *
 * MALZEME İSE SİTENİN KENDİSİ — kopyalanmıyor, çağrılıyor (23 Eylül
 * denetimi). Bu dosya bir dönem sitenin yüzeylerini aynı tokenlarla elden
 * yeniden kuruyordu ve kopya siteyle birlikte değişmedi: site panelleri
 * beyaza ve 18 piksellik köşeye geçtiğinde yönetimin 22 paneli hâlâ %2,7'lik
 * bir mürekkep ve 16 piksel köşeydi, yani sayfa zemininden KOYU. Şimdi
 * panel `.panel`, boş durum `EmptyState`, yer tutucu `Skeleton`, kayan
 * tablo kabı `ScrollEdges`; site değişirse panel de değişiyor.
 */

/* --------------------------------------------------------------------------
   Kutular
   -------------------------------------------------------------------------- */

export function AdminPanel({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** Sayfa içi çapa — pano satırları doğrudan ilgili panele iniyor. */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        /* SİTENİN PANEL YÜZEYİ (23 Eylül denetimi). Panel `bg-surface` idi:
           %2,7 opak bir mürekkep, yani sayfa zemininden KOYU (ölçüldü:
           panel rgb(240,243,245), zemin rgb(247,249,251)) — sitenin
           yükseltilmiş beyaz panellerinin tersi. Şimdi aynı `.panel`:
           `--premium-surface`, `--radius-panel`, saç teli kenarlık.
           `min-w-0`: ızgara sütunu içerikle genişlemesin — Üyeler
           ekranında tablo sütunu 390'da 562 piksele itiyordu.
           ÇAPA PAYI BURADA DEĞİL, `html`de: yapışkan sekme bandının payı
           globals.css'te (`data-admin-shell`) ve çapaya inen her şey onu
           alıyor. Panel bir de `scroll-mt-24` taşıyordu; iki pay toplanıyor
           ve `#çapa` ile inilen panel bandın 108 piksel altında, boşlukta
           duruyordu. */
        "panel min-w-0 p-5 sm:p-6",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function AdminPanelTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    /* BAŞLIK BİR KADEME BÜYÜDÜ ve künyeyle arası açıldı. Panel başlığı ile
       künye 13/12,5 puntoyla neredeyse aynı boydaydı; ikisi tek bir gri blok
       gibi okunuyor, gözün panele girdiği yer belli olmuyordu. Başlık artık
       15,5 punto ve künye 12,5'te kalıyor — hiyerarşi ölçüden geliyor,
       renkten değil.

       IZGARA, SARMA DEĞİL (23 Eylül). Başlık ve künye bir blok, eylem onun
       yanında sarılan bir öğeydi: künye uzunsa (Trafik panelinde 233 piksel)
       eylem 390'da üçüncü satıra, sola yaslı düşüyordu; öteki panellerde
       sağ üstte. Şimdi eylem her genişlikte başlığın satırında, sağda;
       künye altında iki sütunu kaplıyor.

       `w-fit`: küresel `main h2` degradesi başlığın KUTUSUNA boyanıyor ve
       kutu künye kadar genişti — kısa başlıklar degradenin yalnızca lacivert
       ucunu alıyordu (sitenin PanelHeader'ı aynı sebeple `w-fit`). */
    <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5">
      <h2 className="display-ink-tight w-fit text-lead font-bold tracking-[-0.02em] text-strong">
        {children}
      </h2>
      {action && <div className="col-start-2 row-start-1 self-start">{action}</div>}
      {hint && (
        <p className="col-span-2 text-small leading-relaxed text-muted">{hint}</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Boş durum
   -------------------------------------------------------------------------- */

/**
 * Panelin içindeki boş durum — sitenin `EmptyState`i, dar dolguyla.
 *
 * BEŞ BOŞ DURUM BİÇİMİ VARDI (23 Eylül denetimi): "Kayıt yok" (ortalı,
 * noktasız), "Eksik yok." (büyük punto), "Henüz kayıtlı üye yok." (başka
 * bir dolgu), "Her şey yolunda — …" (noktalı), "Dış yönlendirme kaydı
 * yok — …". Aynı cevap beş ekranda beş ayrı kılıkta duruyordu. Artık tek
 * kılık; metin bir CÜMLE, o yüzden cümle düzeninde ve noktalı.
 *
 * Yalnızca okuma BAŞARILIYKEN basılır: okunamayan veri boş veri değildir,
 * "kayıt yok" demek bir sorgu hatasını sakin bir güne çevirirdi.
 */
export function AdminEmpty({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return <EmptyState compact title={title} hint={hint} className={className} />;
}

/* --------------------------------------------------------------------------
   Girdi
   -------------------------------------------------------------------------- */

/**
 * Yönetimdeki bütün girdi kutularının görünümü — editör alanları, tarih
 * seçicileri, arama.
 *
 * SINIRI GÖRÜNÜR, ODAĞI BELİRGİN (23 Eylül denetimi). Kutular `bg-surface`
 * üstünde `border-line` taşıyordu ve panel `bg-surface` idi: dolgu panele
 * karşı 1,05:1 (koyu 1,14), kenarlık 1,22:1 (koyu 1,37) ölçüldü — kutunun
 * nerede başladığı zor seçiliyordu. Odak yalnızca bir piksellik kenarlığın
 * renk değişimiydi (`outline-none`). Şimdi zemin katı yüzey, kenarlık bir
 * ton koyu ve odak sitenin 2 piksellik halkası.
 *
 * ÖLÇÜ ÇAĞIRANDA: editör alanı `w-full py-2.5`, tarih seçici `h-11
 * sm:h-9`. Bu dize yalnızca malzemeyi taşıyor.
 */
export const adminInput =
  "rounded-(--radius-md) border border-line-strong bg-surface-solid px-3 text-base text-strong transition-colors placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--line-focus)";

/* --------------------------------------------------------------------------
   Durum noktası
   -------------------------------------------------------------------------- */

/**
 * Sağlık tonu.
 *
 * `info` (Koşullu): ne sorun ne sağlık — isteğe bağlı bir anahtarın boş
 * olması gibi, bir KOŞULA bağlı durumlar. Bunları `down`a yazmak panonun
 * tek kırmızı satırını gerçek olmayan bir soruna harcıyordu (Anthropic
 * anahtarı: çeviri önce DeepL'i deniyor, bu anahtar yedek).
 */
export type HealthTone = "ok" | "warn" | "down" | "idle" | "info";

export function HealthDot({ tone }: { tone: HealthTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        tone === "ok" && "bg-up",
        tone === "warn" && "bg-brass",
        tone === "down" && "bg-down",
        tone === "idle" && "bg-muted",
        tone === "info" && "bg-primary",
      )}
    />
  );
}

/**
 * Noktayı METNİN İLK SATIRINA hizalar. Satırlar `mt-[5px]` ile elle
 * kaydırılıyordu ve nokta ilk satırın 6 piksel altında, taban çizgisinde
 * duruyordu (pano, ölçüldü; Sistem listesinde 11 piksel). Kutunun
 * yüksekliği bir satır (`1lh`), nokta onun ortasında — punto değişse de
 * hizada kalır. Sitenin `ImpactDot`u aynı kalıpla çalışıyor.
 */
export function HealthMark({ tone }: { tone: HealthTone }) {
  return (
    <span aria-hidden className="flex h-[1lh] shrink-0 items-center">
      <HealthDot tone={tone} />
    </span>
  );
}

/** Rengin taşıdığı anlam metinle de yazılır — renk tek başına bilgi taşımaz. */
export const HEALTH_LABEL: Record<HealthTone, string> = {
  ok: "Sağlıklı",
  warn: "Dikkat",
  down: "Sorunlu",
  idle: "Beklemede",
  info: "Koşullu",
};

/**
 * Durum sözcüğünün mürekkebi. Yalnızca İLGİ İSTEYEN iki ton renk alıyor;
 * sağlıklı, beklemede ve koşullu satırın sözcüğü gri kalıyor — liste
 * tarandığında göz yalnızca sorunlara takılsın.
 */
const HEALTH_INK: Record<HealthTone, string> = {
  ok: "text-muted",
  warn: "text-brass-ink",
  down: "text-down",
  idle: "text-muted",
  info: "text-muted",
};

/* --------------------------------------------------------------------------
   Sayı kutusu
   -------------------------------------------------------------------------- */

export type StatTone = "neutral" | "up" | "down";

/**
 * Kutunun gövdesi ve değer satırı — yer tutucu da AYNI dizelerden
 * çiziliyor, ikisi ayrı düşmesin diye.
 */
const STAT_BOX = "flex min-w-0 flex-col rounded-(--radius-panel) border px-4 py-4 sm:px-5";
const STAT_VALUE = "mt-2 text-heading font-bold leading-[1.05] tracking-[-0.03em]";
const STAT_SURFACE = {
  neutral: "border-line bg-(--premium-surface)",
  warn: "border-brass/35 bg-brass-wash",
  down: "border-down/30 bg-down-wash",
} as const;

/**
 * Tek ölçü. Değişim yüzdesi VARSA gösterilir, uydurulmaz: karşılaştırılacak
 * önceki dönem yoksa (ölçüm yeni kurulmuşsa) satır hiç çizilmez. Sıfırdan
 * bir sayıya çıkışı "%∞ artış" diye yazmak da bir tür uydurma kesinlik.
 *
 * DEĞİŞİM İLE DURUM AYRI (23 Eylül denetimi). Sistem ekranı "Sağlıklı",
 * "Kontrol Et", "Sorun Yok" sözcüklerini `delta` yuvasına yazıyordu: yüzde
 * değişimi için kurulmuş yeşil/kırmızı rakam dili bir durum sözcüğü
 * taşıyor, "Sağlıklı" bir artış, "Kontrol Et" bir düşüş gibi okunuyordu.
 * `delta` artık YALNIZCA değişim ("+%40", "+3"); durum `status` ile
 * sağlık satırlarının dilinde yazılıyor — nokta ve sözcük.
 *
 * OKUNAMADI SIFIR DEĞİLDİR. Veri katmanı hatayı yutup sıfır döndürdüğünde
 * kutu "0" yazıyor, okur da "hiç yok" diye okuyordu. `state="unavailable"`
 * değeri tireye, künyeyi "Veri Alınamadı"ya çeviriyor.
 *
 * RENK YALNIZCA DURUM SÖYLENDİĞİNDE. Kutu nötr panel yüzeyinde; `warn` ya
 * da `down` bir durum bildiren kutu o tonun zeminine geçiyor. Ton `state`
 * ile açıkça verilebilir, verilmezse `status`tan geliyor — ilgi isteyen bir
 * durumu söyleyen kutu, rengini ayrıca istemek zorunda kalmasın.
 */
export function StatBox({
  label,
  value,
  sub,
  delta,
  status,
  state,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Yalnızca DEĞİŞİM — yüzde ya da adet farkı. Durum sözcüğü buraya yazılmaz. */
  delta?: { text: string; tone: StatTone; srLabel: string } | null;
  /** Kutunun söylediği DURUM — "Sağlıklı", "İlgi Bekliyor". Nokta + sözcük. */
  status?: { tone: HealthTone; label: string } | null;
  state?: "unavailable" | "warn" | "down";
}) {
  const unavailable = state === "unavailable";
  const surface =
    state === "warn" || state === "down"
      ? state
      : !unavailable && (status?.tone === "warn" || status?.tone === "down")
        ? status.tone
        : "neutral";
  const meta = unavailable || Boolean(delta) || Boolean(status) || Boolean(sub);

  return (
    /* NÖTR YÜZEY (23 Eylül). Kutular başlık bandıyla aynı mavi geçişi
       taşıyordu: ilk ekranda beş özdeş accent yüzey vardı ve bandın kendi
       notu "cesaret bir kez harcanıyor" diyordu. Artık sitenin panel yüzeyi;
       renk yalnızca durum bildiren kutuda. */
    <div className={cn(STAT_BOX, STAT_SURFACE[surface])}>
      {/* Künye Title Case, büyük harfe ÇEVRİLMİYOR: `uppercase` Türkçede
          yanlış büyütüyor ve site künyeleri 23 Eylül'de bu dile geçti. */}
      <p className="text-small font-semibold text-muted">{label}</p>
      {/* `tabular-nums` YOK. Kutu içinde hizalanacak ikinci bir sayı olmadığı
          için sabit genişlikli rakamların tek etkisi noktalama işaretlerini
          de o genişliğe çekmekti: "1,0" ekranda "1 , 0", "11:00" ise
          "11 : 00" diye okunuyordu.

          PUNTO IZGARANIN, KUTUNUN DEĞİL. Uzun değerler kendi kutusunda bir
          kademe küçülüyordu ve aynı sıradaki dört değer iki boyda, iki ayrı
          taban çizgisinde duruyordu (Sistem: 19 ve 24 piksel, ölçüldü).
          Küçültmeye artık `StatGrid` karar veriyor, bütün kutular için
          birlikte.

          SATIR ARALIĞI SARDIĞINDA AÇILIYOR. `leading-none` tek satırlık bir
          sayı için doğru — büyük puntoda satır kutusu rakamın kendisi kadar
          olmalı. Ama değer sarınca (dar kutuda "Ana Seans Açık", "Tatil ·
          Şükran Günü") iki satır üst üste yapışıyor, harflerin altı üsttekinin
          içine giriyordu. `leading-[1.05]` tek satırda gözle fark edilmiyor,
          iki satırda nefes açıyor. */}
      <p
        data-stat-value
        className={cn(STAT_VALUE, unavailable ? "text-muted" : "text-strong")}
      >
        {unavailable ? "—" : value}
      </p>
      {/* KÜNYE KISA TUTULUR, KIRPILMAZ. Bir kutunun künyesi üç satıra
          sarınca ızgara satırı dört kutuyu da o boya geriyor, üçünün dibinde
          55 piksel boş kalıyordu (pano, 1440). Çözüm kırpmak değil (başlık
          kuralı: "sığmayınca satır atlar, kesmez"; `title` dokunmatikte
          hiç görünmüyor) — künyeler tek satıra sığacak kadar kısa yazılıyor,
          tanımlar kutunun değil sayfanın notunda.

          SATIR YOKSA BOŞLUĞU DA YOK. Künyesiz kutu altında sekiz piksellik
          boş bir satır aralığı taşıyordu (Üyeler, 390: 93 piksellik kutunun
          dibi). Izgara satırı kutuları zaten eşit boya geriyor.

          `items-start`, `items-baseline` değil: satırdaki her öğe aynı
          puntoda ve durum öğesinin ilk parçası metinsiz bir nokta kutusu —
          taban çizgisi hizası onu metnin dibine oturtuyordu. */}
      {meta && (
        <div className="mt-2 flex min-w-0 flex-wrap items-start gap-x-2 gap-y-0.5 text-small">
          {!unavailable && delta && (
            <span
              className={cn(
                "numeral shrink-0 font-semibold",
                delta.tone === "up" && "text-up",
                delta.tone === "down" && "text-down",
                delta.tone === "neutral" && "text-muted",
              )}
            >
              {delta.text}
              {/* Yön ekran okuyucuya da söyleniyor: "−%12" işareti gören için
                  açık ama sesletimde tire kaybolabiliyor. */}
              <span className="sr-only"> ({delta.srLabel})</span>
            </span>
          )}
          {!unavailable && status && (
            <span className="inline-flex shrink-0 items-start gap-1.5 font-semibold text-body">
              <HealthMark tone={status.tone} />
              {status.label}
            </span>
          )}
          {unavailable ? (
            <span className="font-semibold text-brass-ink">Veri Alınamadı</span>
          ) : (
            sub && <span className="text-muted">{sub}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Bu uzunluğu aşan bir değer ("Bugün Koştu", "Tümü Sağlıklı") ızgarayı bir kademe küçültür. */
const STAT_VALUE_MAX = 9;

/**
 * Sütun sınıfları — TAM YAZILI: Tailwind sınıfları kaynakta birebir arıyor,
 * `lg:grid-cols-${n}` gibi kurulan bir ad üretilen CSS'e hiç girmez.
 *
 * TEK SAYILI IZGARADA İLK KUTU TELEFONDA İKİ SÜTUN. Beş kutu telefonda
 * 2+2+1 diziliyor ve sonuncunun yanında yarım satırlık bir delik
 * kalıyordu (Üyeler, 390: 170 × 121 piksel). İlk kutu iki sütunu
 * kaplayınca 1+2+2 — ya da üç kutuda 1+2 — delik yok. İlk kutu, ekranın
 * en önemli ölçüsü olduğu için geniş olanı.
 */
const STAT_COLS = {
  3: "sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1",
  4: "lg:grid-cols-4",
  5: "sm:grid-cols-3 lg:grid-cols-5 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1",
} as const;

/**
 * Sayı kutularının ızgarası.
 *
 * SÜTUN SAYISI KUTU SAYISINA GÖRE. Izgara sabit dört sütundu ve Üyeler
 * ekranında beş kutu var: beşincisi tek başına ikinci satıra düşüyor, o
 * satırın kalan dörtte üçü boş kalıyordu — ekranın en üstünde, en çok
 * bakılan yerde. Beş kutulu ızgara `lg`de beş sütuna açılıyor, orta
 * kırılımda üçe bölünüyor (3+2); üç kutulu ızgara `sm`den itibaren tek
 * satır.
 *
 * DEĞER PUNTOSU IZGARANIN KARARI. Değerlerden biri metinse (tarih, "Ön
 * Seans", "Bugün Koştu") bütün kutular bir kademe küçülüyor; tek tek
 * küçülünce aynı satırda 19 ve 24 piksellik değerler yan yana duruyordu.
 * Karar kutuların `value`sundan kendiliğinden çıkıyor; kutular başka bir
 * bileşenle sarılıysa ızgara onları göremez ve `compact` elle verilir.
 */
export function StatGrid({
  children,
  cols = 4,
  compact,
}: {
  children: React.ReactNode;
  cols?: 3 | 4 | 5;
  /** Verilmezse değerlerin uzunluğundan hesaplanır. */
  compact?: boolean;
}) {
  const small =
    compact ??
    Children.toArray(children).some(
      (child) =>
        isValidElement<{ value?: unknown }>(child) &&
        typeof child.props.value === "string" &&
        child.props.value.length > STAT_VALUE_MAX,
    );
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3.5",
        STAT_COLS[cols],
        small && "[&_[data-stat-value]]:text-title",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Sayı ızgarasının yer tutucusu — GERÇEK IZGARAYI, GERÇEK KUTUDAN çiziyor.
 *
 * Yer tutucular tek bir yüksekliği sabitlenmiş çubuktu ve o ölçü yalnızca
 * masaüstünde doğruydu: telefonda ızgara iki kolona iniyor, gerçek yükseklik
 * ikiye üçe katlanıyor ve akış inince altındaki her şey aşağı sıçrıyordu.
 * Aynı ızgarayı boş kutularla çizmek, sabit bir piksel değeri yazmadan her
 * kırılımda doğru boyu veriyor.
 *
 * SATIRLAR PİKSELLE DEĞİL SATIR YÜKSEKLİĞİYLE (23 Eylül). Kutu elle
 * yazılmış çubuk boylarıyla kuruluyordu (18 / 28 / 18) ve değer çubuğu
 * gerçek satırdan uzundu: 24 × 1,05 = 25,2 piksel yerine 28. Yer tutucu
 * 114, gerçek kutu 111,2 piksel ölçüldü. Şimdi her satır kutunun KENDİ
 * dizeleriyle ve `h-[1lh]` ile çiziliyor — punto değişirse ikisi birlikte
 * değişiyor. Zemin sitenin `.skeleton`ı.
 */
export function StatGridSkeleton({
  boxes = 4,
  cols = 4,
  compact = false,
}: {
  boxes?: number;
  cols?: 3 | 4 | 5;
  /** Gerçek ızgara küçük puntoya geçecekse (metin değerli ızgara). */
  compact?: boolean;
}) {
  return (
    <StatGrid cols={cols} compact={compact}>
      {Array.from({ length: boxes }, (_, i) => (
        /* Satırlar `div`, kutunun `p`leri değil: `Skeleton` bir `div` ve
           `p`nin içinde geçersiz — tarayıcı sunucu HTML'ini ayrıştırırken
           `p`yi erkenden kapatıyor, çubuk satırın DIŞINA düşüyordu (ölçüldü:
           kutu 144 piksel, gerçeği 111,2). */
        <div key={i} aria-hidden className={cn(STAT_BOX, STAT_SURFACE.neutral)}>
          <div className="flex h-[1lh] items-center text-small">
            <Skeleton className="h-2.5 w-20" />
          </div>
          <div data-stat-value className={cn(STAT_VALUE, "flex h-[1lh] items-center")}>
            <Skeleton className="h-[0.8em] w-24" />
          </div>
          <div className="mt-2 flex h-[1lh] items-center text-small">
            <Skeleton className="h-2.5 w-28" />
          </div>
        </div>
      ))}
    </StatGrid>
  );
}

/* --------------------------------------------------------------------------
   Sağlık satırı
   -------------------------------------------------------------------------- */

/** Sağlık satırlarının listesi — satırlar arasında saç teli. */
export function HealthList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col divide-y divide-line", className)}>
      {children}
    </ul>
  );
}

/**
 * Tek sağlık satırı — Özet'in "Dikkat İsteyenler"i ve Sistem'in listeleri
 * AYNI satırı çiziyor.
 *
 * İKİ EKRAN, İKİ SATIR VARDI. Sistem: solda nokta, ad, not; sağda değer ve
 * durum sözcüğü. Özet: ad · durum, altında "değer — not" diye tek bir
 * birleştirilmiş cümle. Aynı kontrol iki ekranda iki ayrı kılıkta
 * okunuyordu ve noktalar da iki ayrı yükseklikteydi (+6 ve +11 piksel,
 * ölçüldü). Artık tek düzen: solda nokta, ad ve not; sağda ölçülen
 * büyüklük ve durum sözcüğü.
 *
 * `href` verilirse satır bir bağlantı: sorunu gören yöneticinin bir sonraki
 * adımı ilgili panel. Hedef telefonda 44 piksel.
 *
 * `tint`: ilgi isteyen satır (warn, down) kendi tonunun zeminine geçiyor —
 * uzun bir listede sorunlar taranmadan görünsün. Zemin satırın İÇ kutusunda,
 * satır aralarındaki saç teli yerinde kalıyor; iç kutu `RankList`
 * satırlarıyla aynı 10 piksel dışa taşıyor, metin panel başlığının hizasında.
 */
export function HealthRow({
  tone,
  label,
  note,
  value,
  status,
  href,
  tint = false,
}: {
  tone: HealthTone;
  label: string;
  /** Ad altındaki cümle — neden bu durumda olduğu. */
  note?: React.ReactNode;
  /** Ölçülen büyüklük — "3 Saat Önce", "1.018 Kayıt". */
  value?: React.ReactNode;
  /** Durum sözcüğü; verilmezse `HEALTH_LABEL[tone]`. */
  status?: string;
  href?: string;
  tint?: boolean;
}) {
  const hasValue = value !== undefined && value !== null && value !== "";
  const word = (
    <span className={cn("text-tiny", HEALTH_INK[tone])}>
      {status ?? HEALTH_LABEL[tone]}
    </span>
  );
  const body = (
    <>
      <span className="flex min-w-0 items-start gap-2.5">
        <HealthMark tone={tone} />
        <span className="min-w-0">
          <span className="block font-semibold text-strong">{label}</span>
          {note && <span className="block text-small text-muted">{note}</span>}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end text-right">
        {hasValue && <span className="numeral font-semibold text-body">{value}</span>}
        {/* Değer yoksa sözcük adın satırına ortalanıyor — küçük punto tek
            başına üste yapışıp adın satırından kopuk duruyordu. */}
        {hasValue ? word : <span className="flex h-[1lh] items-center">{word}</span>}
      </span>
    </>
  );
  const row = cn(
    "-mx-2.5 flex items-start justify-between gap-4 rounded-(--radius-sm) px-2.5 py-2 text-base",
    tint && tone === "warn" && "bg-brass-wash",
    tint && tone === "down" && "bg-down-wash",
  );

  return (
    <li className="py-1 first:pt-0 last:pb-0">
      {href ? (
        <Link
          href={href}
          className={cn(
            row,
            "min-h-11 transition-colors sm:min-h-0",
            !(tint && (tone === "warn" || tone === "down")) && "hover:bg-surface-elevated",
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

/* --------------------------------------------------------------------------
   Sıralı liste — "en çok okunan sayfalar" gibi
   -------------------------------------------------------------------------- */

export type RankRow = {
  key: string;
  label: string;
  /** Satırın tıklanabilir olduğu yer — yoksa düz metin. */
  href?: string;
  value: number;
  /** İkinci sayı, künye olarak sağda: tekil ziyaretçi gibi. */
  secondary?: string;
};

/** Payın yazımı: sıfırdan büyük ama yüzde birin altındaki pay "%0" değil. */
function shareLabel(value: number, total: number): string {
  const pct = (value / total) * 100;
  if (value > 0 && pct < 1) return "<%1";
  return `%${Math.round(pct)}`;
}

/**
 * Sıralı liste — "en çok okunan sayfalar" gibi.
 *
 * ÇUBUK SATIRIN ZEMİNİ DEĞİL, ALTINDAKİ İNCE ŞERİT.
 *
 * Dolgu bir dönem satırın arka planıydı (`bg-primary-wash`) ve iki sorun
 * birden üretiyordu. Birincisi görünürlük: o token panel yüzeyinden ancak
 * 1,1–1,3 kat ayrışıyor, yani çubuk neredeyse yok. Depoda bu tam olarak
 * bilinen bir hata — `--bar` tokeni "gece temasında çubuklar 1,35'e düşüp
 * kayboluyordu" diye ayrıca açılmış ve bu liste onu hiç kullanmıyordu.
 * İkincisi okunabilirlik: metin çubuğun üstünde durduğu için dolgu
 * koyulaştırılamıyordu — koyulaştırınca kontrast AA eşiğinin altına
 * düşüyordu. Yani çubuk ya görünmez ya metin okunmaz oluyordu.
 *
 * Şerit satırın ALTINA inince ikisi de çözülüyor: dolgu artık tam accent
 * renkte, üstünde metin olmadığı için kontrast kısıtı yok, metin de temiz
 * bir zeminde duruyor. Ayrı bir bar SÜTUNU değil — o, satır yüksekliğini
 * ikiye katlayıp okuma yönünü bölüyordu; şerit satırın kendi genişliğinde
 * ve üç piksel.
 *
 * SAYI SÜTUNU SABİT GENİŞLİKTE. Değerler sağa yaslıydı ama genişlikleri
 * satırdan satıra değiştiği için sütun kenarı zikzak çiziyordu; on beş
 * satırlık bir listede göz her satırda sayıyı yeniden arıyordu.
 *
 * UZUN LİSTE KATLANIR (`hiddenAfter`). On beş satırlık iki liste telefonda
 * 1.200 piksel tutuyordu (Trafik, 390). İlk N satırdan sonrası yerli bir
 * `<details>`in içinde: JavaScript gerekmiyor, klavyeyle açılıyor, ekran
 * okuyucu açık/kapalı durumunu kendisi duyuruyor. `hiddenOn="mobile"`
 * katlamayı yalnızca telefona uyguluyor — geniş ekranda liste zaten
 * yanındaki panelle aynı boyda ve katlamak yalnızca bir tık eklerdi.
 */
export function RankList({
  rows,
  emptyLabel = "Kayıt yok.",
  scale = "max",
  showShare,
  hiddenAfter,
  hiddenOn = "all",
}: {
  rows: RankRow[];
  /** Boş listenin cümlesi — yalnızca okuma başarılıyken basılır. */
  emptyLabel?: string;
  /**
   * `max`: çubuk en büyük satıra göre — sıralama listeleri.
   * `total`: çubuk BÜTÜNÜN payı — cihaz, dil gibi parça–bütün kırılımları.
   * "Masaüstü 1.786" %100'lük çubuk çiziyordu, gerçek payı %73'tü; okur
   * payı elle bölerek buluyordu.
   */
  scale?: "max" | "total";
  /**
   * Payı sayının yanında yazar ("%73") — her zaman BÜTÜNE göre, çubuğun
   * ölçeğinden bağımsız: en büyük satıra göre bir yüzdenin okunacak bir
   * anlamı yok. Verilmezse `scale="total"` ile açık.
   */
  showShare?: boolean;
  /** Bu kadar satırdan sonrası "Tümünü Gör"ün içinde. */
  hiddenAfter?: number;
  /** Katlama her genişlikte mi, yalnızca telefonda mı. */
  hiddenOn?: "all" | "mobile";
}) {
  if (rows.length === 0) return <AdminEmpty title={emptyLabel} />;

  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = Math.max(
    rows.reduce((sum, r) => sum + r.value, 0),
    1,
  );
  const share = showShare ?? scale === "total";
  const cut =
    hiddenAfter !== undefined && hiddenAfter > 0 && rows.length > hiddenAfter
      ? hiddenAfter
      : rows.length;
  const shown = rows.slice(0, cut);
  const rest = rows.slice(cut);

  const renderRow = (row: RankRow) => {
    /* SIFIR SIFIR ÇİZİLİR. Taban `Math.max(2, …)` idi ve değeri sıfır
       olan satıra da %2'lik bir çubuk çiziyordu — bileşen genel, "hiç"
       ile "çok az" aynı görünmemeli. */
    const width = Math.round((row.value / (scale === "total" ? total : max)) * 100);
    const body = (
      <>
        {/* SATIRIN ASIL BİLGİSİ TELEFONDA KIRPILIYORDU. Daralan tek
            öğe etiket: künye `shrink-0`, sayı `w-16 shrink-0`. 390
            pikselde etikete ~100 piksel kalıyor ve
            "/bilancolar/[symbol]/[period]" ile "/bilancolar/analizler"
            aynı görünüyordu. Künye dar ekranda ALT SATIRA iniyor, yani
            etiket satırın tamamını alıyor; `title` da kırpılan hâlin
            tamamını veriyor. */}
        <span className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate" title={row.label}>
            {row.label}
          </span>
          {row.secondary && (
            <span className="numeral hidden shrink-0 text-tiny text-muted sm:inline">
              {row.secondary}
            </span>
          )}
          {share && (
            <span className="numeral w-10 shrink-0 text-right text-small font-semibold text-muted">
              {shareLabel(row.value, total)}
            </span>
          )}
          <span className="numeral w-16 shrink-0 text-right text-read font-bold text-strong">
            {row.value.toLocaleString("tr-TR")}
          </span>
        </span>
        {row.secondary && (
          <span className="numeral text-tiny text-muted sm:hidden">
            {row.secondary}
          </span>
        )}
        <span
          aria-hidden
          /* Ray `--bar` tokeninde: o token zaten "gece temasında çubuklar
             kayboluyordu" diye açılmış ve tam bu iş için ayarlı.
             Opaklık modifikatörü YOK — token kendi alfasını taşıyor,
             üstüne bir kat daha koymak rayı görünmez yapıyordu. */
          className="block h-[3px] w-full overflow-hidden rounded-full bg-bar"
        >
          {/* Dolgu da geçişli: koyudan yumuşağa. Uzun çubuklarda düz
              tek renk yassı duruyordu; geçiş çubuğa yön veriyor ve
              ucunun nerede olduğu daha kolay okunuyor. */}
          <span
            className="block h-full rounded-full bg-[linear-gradient(90deg,var(--primary-deep),var(--primary))]"
            style={{ width: `${width}%` }}
          />
        </span>
      </>
    );

    /* DOKUNMA HEDEFİ 44 PİKSEL — yalnızca bağlantı dalında. `.tap-44`
       BURADA KULLANILMAZ: satırlar alt alta ve sözde öğe bir alttaki
       satırın hedefini kapardı, gerekçe app/globals.css'te yazılı. */
    return (
      <li key={row.key}>
        {row.href ? (
          <Link
            href={row.href}
            className="flex min-h-11 flex-col justify-center gap-1.5 rounded-(--radius-sm) px-2.5 py-2.5 text-base text-body transition-colors hover:bg-surface-elevated sm:min-h-0"
          >
            {body}
          </Link>
        ) : (
          <div className="flex flex-col justify-center gap-1.5 rounded-(--radius-sm) px-2.5 py-2.5 text-base text-body">
            {body}
          </div>
        )}
      </li>
    );
  };

  return (
    /* `-mx-2.5`: satırın dolgusu hover zemini için; metin ve çubuk panel
       başlığıyla aynı sol kenarda (dolgu yüzünden 10 piksel içerideydi). */
    <div className="-mx-2.5">
      <ol className="flex flex-col">{shown.map(renderRow)}</ol>
      {rest.length > 0 && (
        <>
          {/* Geniş ekranda katlanmayan kalan satırlar — aynı liste, kaldığı
              sıradan. Telefonda `hidden`: erişilebilirlik ağacında da yok,
              aynı satırlar aşağıdaki katlamada ikinci kez okunmuyor. */}
          {hiddenOn === "mobile" && (
            <ol start={cut + 1} className="hidden flex-col sm:flex">
              {rest.map(renderRow)}
            </ol>
          )}
          <details className={cn("group/rank", hiddenOn === "mobile" && "sm:hidden")}>
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-(--radius-sm) px-2.5 text-small font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-9 [&::-webkit-details-marker]:hidden">
              <span className="group-open/rank:hidden">Tümünü Gör</span>
              <span className="numeral font-normal text-muted group-open/rank:hidden">
                {rest.length} Satır Daha
              </span>
              <span className="hidden group-open/rank:inline">Daha Az Göster</span>
              <CaretDown
                size={12}
                weight="bold"
                aria-hidden
                className="transition-transform group-open/rank:rotate-180"
              />
            </summary>
            <ol start={cut + 1} className="flex flex-col">
              {rest.map(renderRow)}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Tablo
   -------------------------------------------------------------------------- */

export function AdminTable({
  head,
  label,
  children,
  minWidth = 520,
  stickyFirst = false,
}: {
  head: string[];
  /** Kaydırılabilir bölgenin adı — ekran okuyucu bunu duyurur. */
  label: string;
  children: React.ReactNode;
  /**
   * Tablonun kaydırmaya geçtiği taban genişlik (piksel). Sabit 520'ydi ve
   * dört sütunlu Üyeler tablosu 1024'te kabından 7 piksel genişti — son
   * sütun fark edilmeyen bir kaydırmanın arkasında kırpılıyordu. Sütun
   * sayısı tablodan tabloya değişiyor, taban da.
   */
  minWidth?: number;
  /**
   * İlk sütun kayarken yerinde kalsın — "Kaydırma saklanmaz" (CLAUDE.md):
   * sağa kaydıran okur satırın kime ait olduğunu kaybetmesin.
   */
  stickyFirst?: boolean;
}) {
  return (
    /* Dar ekranda tablo KENDİ kabında kayar. Sayfa gövdesinin yatay
       kaymasına izin verilmiyor (globals.css'te html/body kilitli) ve
       dolayısıyla geniş içerik kendi kaydırmasını kendisi taşımak zorunda. */
    /* KAYDIRMA KABI KLAVYEYLE ODAKLANABİLİR. Kap kayıyordu ama `tabindex`
       taşımadığı için klavyeyle gezen okuyucu sağdaki sütunlara HİÇ
       ulaşamıyordu — fare ya da dokunma olmadan tablonun yarısı erişilemez
       kalıyordu (WCAG 2.1.1). `role="region"` + ad, ekran okuyucunun da
       "kaydırılabilir bir bölge" diye duyurmasını sağlıyor. */
    /* "DEVAMI VAR" İKİ KANALDAN. İnce çubuk (`scroll-x-hint`) masaüstünde
       görünüyor ama telefonda HİÇ çizilmiyor: dokunmatik kaydırma çubuğu
       bir kaplama ve yalnızca parmak kayarken beliriyor. Ölçüldü (23 Eylül,
       390): Bülten tablosu 312 piksellik kapta 520 piksel, Üyeler 348'de
       520 — çubuk 0 piksel, maske yok, gizli sütunlara dair hiçbir işaret
       yok. `ScrollEdges` kesilen kenarı soldurarak telefonda da söylüyor;
       sabit ilk sütunlu tabloda yalnızca sağ kenar soluyor (gerekçe
       ScrollEdges'te). Odak halkası maskeyi kaldırıyor (globals.css). */
    /* `-mx-1 px-1` KALKTI: tablo kabından 8 piksel geniş duruyordu ve
       1024'te son sütunu 7 piksellik, fark edilmeyen bir kaydırmanın
       arkasında kırpıyordu (Üyeler, ölçüldü). */
    <ScrollEdges
      fixedStart={stickyFirst}
      className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table
        className={cn(
          "w-full border-collapse text-base",
          /* Sabit sütunun zemini panelin kendi zemini (`--premium-surface`,
             opak): altından kayan sayılar etiketin içinden okunmuyor ve
             kaydırılmamış tabloda solda ayrı bir şerit görünmüyor. Sağ
             dolgu, kayan sütunun rakamları etiketin dibine yapışmasın diye. */
          stickyFirst &&
            "[&_tr>*:first-child]:sticky [&_tr>*:first-child]:left-0 [&_tr>*:first-child]:z-[1] [&_tr>*:first-child]:bg-(--premium-surface) [&_tr>*:first-child]:pr-3",
        )}
        style={{ minWidth }}
      >
        <thead>
          <tr className="border-b border-line-strong text-left">
            {head.map((cell, i) => (
              <th
                key={cell}
                scope="col"
                /* Title Case künye, büyük harf değil — sayı kutularıyla aynı. */
                className={cn(
                  "pb-2.5 text-small font-semibold text-muted",
                  i > 0 && "pl-3",
                  i === head.length - 1 && "text-right",
                )}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </ScrollEdges>
  );
}

export function AdminRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-b border-line last:border-0">{children}</tr>;
}

export function AdminCell({
  children,
  align = "left",
  strong,
  numeral,
  rowHeader,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  strong?: boolean;
  /**
   * Ayırıcı taşıyan sayı hücresi — tarih, binlik noktalı adet.
   *
   * Prop bir dönem `mono` adını taşıyordu ve hiçbir mono aile
   * uygulamıyordu: ad yaptığı işi yanlış söylüyordu. Uyguladığı şey
   * sitenin `.numeral` sınıfı, adı da o.
   *
   * `.numeral` yalnızca harf aralığını sıkıştırır — RAKAM HİZASI GERİ
   * GELMEZ. Kök `font-variant-numeric` ayarı ölçülerek kapatılmıştı
   * ("$1.258,58" → "$1 . 258 , 58"). Hizayı bu hücrelerde `text-right`
   * sağlıyor, sınıf değil.
   */
  numeral?: boolean;
  /** Satırı TANIMLAYAN ilk hücre — `th scope="row"` olarak basılır. */
  rowHeader?: boolean;
}) {
  /* Satır başlığı işaretlenmemişti: hücre hücre gezen ekran okuyucu
     kullanıcısı "13.08.2026 · 4" duyuyor ama hangi üyenin satırında
     olduğunu bilmiyordu. */
  const Tag = rowHeader ? "th" : "td";
  return (
    <Tag
      scope={rowHeader ? "row" : undefined}
      className={cn(
        "py-3 pl-3 first:pl-0",
        align === "right" && "text-right",
        strong ? "font-semibold text-strong" : "text-body",
        numeral && "numeral",
        rowHeader && "text-left font-semibold",
      )}
    >
      {children}
    </Tag>
  );
}

/* --------------------------------------------------------------------------
   Panel iskeleti
   -------------------------------------------------------------------------- */

/**
 * Akışla gelen panelin yer tutucusu — GERÇEK PANELİN iskeleti.
 *
 * Yedekler sabit yükseklikli gri çubuklardı (h-64, h-96) ve gerçek
 * panellerin çeyreği kadardı: 878 piksellik liste 256 piksellik bir
 * çubuktan geliyor, aralık seçimi her tıklamada sayfayı çöktürüp yeniden
 * büyütüyordu (Trafik, Üyeler, İçerik — ölçüldü). Aynı yüzey, başlık
 * bloğu ve gerçek satır sayısı × satır yüksekliği.
 *
 * Başlık bloğu `AdminPanelTitle`ın kendi puntolarıyla ve `h-[1lh]` ile
 * çiziliyor — elle yazılmış çubuk boyları punto değişince eskiyordu. Zemin
 * sitenin `.skeleton`ı, sayı kutularınınkiyle aynı.
 */
export function AdminPanelSkeleton({
  rows = 5,
  rowHeight = 50,
  hint = true,
  className,
}: {
  rows?: number;
  /**
   * Tek satırın piksel yüksekliği. Ölçülen: RankList 50 (künyeli satır
   * telefonda 72,5), notlu sağlık satırı 62,5.
   */
  rowHeight?: number;
  /** Gerçek başlığın altında künye satırı var mı. */
  hint?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("panel min-w-0 p-5 sm:p-6", className)} aria-hidden>
      <div className="mb-5 grid gap-y-1.5">
        {/* `pb-[0.06em]`: gerçek başlık degrade mürekkebin alt payını
            taşıyor (`.display-ink`, inen harfler kırpılmasın diye); payı
            olmayan yer tutucu blok 1 piksel kısa ölçüldü. */}
        <div className="box-content flex h-[1lh] items-center pb-[0.06em] text-lead font-bold">
          <Skeleton className="h-[0.7em] w-40" />
        </div>
        {hint && (
          <div className="flex h-[1lh] items-center text-small leading-relaxed">
            <Skeleton className="h-2.5 w-56 max-w-full" />
          </div>
        )}
      </div>
      <div className="flex flex-col">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center" style={{ height: rowHeight }}>
            {/* Satırlar farklı boyda — eş boy çubuklar bir liste gibi
                değil bir ızgara deseni gibi okunuyordu. */}
            <div className="w-full" style={{ maxWidth: `${88 - (i % 4) * 12}%` }}>
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
