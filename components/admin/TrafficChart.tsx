"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrafficPoint } from "@/lib/admin-data";
import { METRIC, adminDay } from "@/lib/admin-format";
import { cn, formatEtDateShort } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";

/**
 * Günlük trafik — SVG çizim, üstünde imleçle okunan bir satır.
 *
 * FORM SEÇİMİ: iki seri, aynı birim (adet). Görüntüleme her zaman tekil
 * ziyaretçiden BÜYÜK ya da eşit — biri diğerinin alt kümesi. Bu yüzden
 * yığılmış bar YANLIŞ olurdu (toplamları anlamsız).
 *
 * İKİ ŞERİT, İKİ TAVAN — ÇİFT EKSEN DEĞİL (23 Eylül denetimi). İki seri bir
 * dönem aynı eksendeydi ("ikisi de adet, ayrı ölçeğe gerek yok") ve bedeli
 * ölçüldü: 30 günlük pencerede görüntüleme tepesi 706, ziyaretçi tepesi 25;
 * 750'lik ölçekte ziyaretçi çizgisi tabandan 5,5 piksel yükseliyordu (390'da
 * 4,5) — sarı çizgi x ekseni gibi okunuyordu. Çift eksen de çözüm değil:
 * iki eğrinin kesişme noktası eksen seçimine bağlı olur ve hiçbir şey
 * anlatmaz. Şimdi iki KÜÇÜK ÇOKLU: görüntüleme kendi tavanıyla üstte,
 * ziyaretçi altında 56 piksellik ayrı bir şeritte, kendi tavan etiketiyle.
 * Her şeritte tek birim, tek ölçek; aynı x ekseni, aynı imleç.
 *
 * BÜTÜN METİN SVG'NİN DIŞINDA. Bir süre eksen etiketleri `<text>` olarak
 * çizildi ve telefonda okunmuyordu: 720 birimlik viewBox 350 piksellik bir
 * ekrana sığarken 11 puntoluk yazı da yarı yarıya küçülüyor, beş piksellik
 * bir lekeye dönüyordu. Yazının SVG içinde olmasının hiçbir faydası yoktu —
 * HTML'de her genişlikte aynı boyda duruyor. "Ölçüm Yok" bandı da aynı
 * sebeple HTML: `preserveAspectRatio="none"` altında bir SVG deseni iki
 * eksende farklı gerilir, taramanın açısı ekran genişliğiyle değişirdi.
 *
 * `preserveAspectRatio="none"` + sabit yükseklik: grafik dar ekranda da
 * okunur bir yükseklikte kalıyor. Çizgi kalınlıkları `non-scaling-stroke`
 * ile sabit; esneyen tek şey geometri ve dikey ölçek zaten görecelidir.
 *
 * ---- İMLEÇ OKUMASI: NEDEN ARTIK JS VAR ----
 *
 * Bu bileşen bir dönem sunucuda çiziliyordu ve etkileşimi SVG `<title>`
 * öğesiydi — yani tarayıcının kendi ipucu. "İstemci JS'i sıfır" iyi bir
 * takastı ama bedeli okuyucuya çıkıyordu: yerel ipucu yaklaşık bir saniye
 * gecikmeyle açılıyor, işletim sisteminin fontuyla ve sitenin hiçbir
 * biçimlendirmesini almadan çiziliyor, dokunmatikte HİÇ açılmıyor ve
 * klavyeyle ulaşılamıyor. Otuz günlük bir eğride tek bir günün sayısını
 * öğrenmek için altındaki tabloyu açmak gerekiyordu.
 *
 * Artık sitenin hisse grafiğiyle aynı kalıp: imleç grafikte gezerken ÜSTTE
 * SABİT bir okuma satırı o günün tarihini ve iki sayısını gösteriyor. Satır
 * grafiğin üstünde ve sabit — üstte yüzen bir kutu imlecin altındaki veriyi
 * örterdi. İmleç yokken aynı satır SON TAM GÜNÜ gösteriyor, yani boş
 * kalmıyor ve okuyucu satırın ne olduğunu etkileşime girmeden öğreniyor.
 *
 * Bedeli dürüstçe: yönetim paneline küçük bir istemci bileşeni iniyor.
 * Panel oturum arkasında, tek dilde ve bir araç — genel sayfaların yük
 * bütçesi buraya uygulanmıyor.
 *
 * DOKUNMATİK VE KLAVYE DE OKUYOR. Parmakla dokunmak okumayı açıyor ve okuma
 * parmak kalkınca YERİNDE KALIYOR; grafiğin dışına dokunmak temizliyor
 * (hisse grafiğinin dersi: temizlenmezse okuma artık bakılmayan bir günü
 * göstermeye devam ediyor). Klavyede grafik bir durak: ok tuşları gün gün,
 * Page Up/Down haftalık, Home ve End uçlara — yerel ipucunun hiç veremediği
 * şey buydu.
 *
 * Altındaki `<details>` tablo görünümü duruyor: grafiği hiç okuyamayan da
 * aynı sayılara metin olarak ulaşıyor.
 *
 * DİL SABİT, TÜRKÇE. Tarihler bir dönem sitenin dil çerezine bağlıydı ve
 * İngilizce çerezle pano "08/25/2026" yazıyordu, kalan her etiket Türkçeyken
 * (23 Eylül denetimi). Panel yalnızca Türkçe (components/admin/AdminUI.tsx
 * başı); `locale` alanı bu yüzden kaldırıldı, hiçbir çağıran onu geçmiyordu.
 */

/* ---- ORTAK DİZELER — grafik ve yer tutucusu (`TrafficChartSkeleton`) ----
   Yer tutucu grafiğin boylarını elle kopyalıyordu ve iki kopya ayrı düştü:
   Özet'in yer tutucusu `h-36` ve `mt-6` yazıyordu, grafik `h-32` ve `mt-5`
   — 390'da akış inince panel 20 piksel sıçrıyordu. Boy veren her dize
   artık tek yerde; grafik değişirse yer tutucusu da onunla değişiyor. */

/** Okuma satırı: lejant, okunan gün ve bugünün çipi. Telefonda iki satıra sarıyor. */
const READING_ROW = "mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-small";
const READING_ITEM = "inline-flex items-baseline gap-2";
const TODAY_CHIP =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-tiny sm:ml-auto";
/** Görüntüleme şeridinin ekrandaki boyu. */
const VIEWS_LANE = "block h-32 w-full sm:h-48";
/** Ziyaretçi şeridi ve üstündeki aralık (`LANE_H` ile birebir). */
const VISITORS_GAP = "mt-5";
const VISITORS_LANE = "block h-14 w-full";
const AXIS_ROW = "numeral mt-1.5 flex justify-between text-tiny";
const KEY_ROW = "mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-tiny";
const TABLE_DETAILS = "mt-2";
/** 44 piksel telefonda — gerekçesi `<summary>`nin yanında. */
const TABLE_SUMMARY = "inline-flex min-h-11 w-fit items-center text-small sm:min-h-9";

/** Görüntüleme şeridinin viewBox'ı. */
const W = 720;
const H = 200;
const PAD_T = 10;
const PAD_B = 4;

/**
 * Ziyaretçi şeridi — viewBox ekrandaki boyuyla BİREBİR (`h-14`, 56 piksel),
 * yani şeridin içindeki her birim bir piksel. Tavan tabandan 48 piksel
 * yukarıda.
 */
const LANE_H = 56;
const LANE_PAD_T = 6;
const LANE_PAD_B = 2;

/**
 * Şeridin tavan etiketi. Zemini panelin kendi yüzeyi ve "Ölçüm Yok"
 * taramasının ÜSTÜNDE (`z-[1]`): 90 günlük pencerede iki etiket de taralı
 * bandın içine düşüyor ve tarama çizgileri harflerin arasından geçiyordu.
 */
const CEILING_LABEL =
  "numeral pointer-events-none absolute left-0 z-[1] -translate-y-full rounded-xs bg-(--premium-surface) pr-1.5 text-tiny text-muted";

/** Klavyede Page Up/Down bir hafta atlıyor. */
const WEEK = 7;

/** Tablonun hafta günü sütunu: "Cmt", "Paz". Tarih ET takvim günü, saat dilimi yok. */
const WEEKDAY = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" });

/** Hafta günü ve tatil notu: "Cmt", "Pzt · Tatil", "Çar · Sürüyor". */
function dayNote(p: TrafficPoint): string {
  const date = new Date(`${p.day}T12:00:00Z`);
  const name = WEEKDAY.format(date);
  if (p.isToday) return `${name} · Sürüyor`;
  /* Hafta sonu adından belli; hafta içi sessiz gün yalnızca tatil olabilir. */
  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
  return p.offDay && !weekend ? `${name} · Tatil` : name;
}

export function TrafficChart({
  points: okunanSeri,
}: {
  /**
   * `null`: seri OKUNAMADI — boş seriden ayrı. Okunamayan seri "ölçüm ilk
   * ziyaretle başlar" cümlesine düşüyordu ve yöneticiye ölçümün hiç
   * başlamadığını söylüyordu (23 Eylül denetimi, lib/admin-data.ts →
   * `AdminResult`).
   */
  points: TrafficPoint[] | null;
}) {
  const [okunan, setOkunan] = useState<number | null>(null);
  const kap = useRef<HTMLDivElement>(null);

  const points = okunanSeri ?? [];
  const noktaSayisi = points.length;

  const konumdanIndeks = useCallback(
    (clientX: number) => {
      const el = kap.current;
      if (!el || noktaSayisi < 2) return null;
      const kutu = el.getBoundingClientRect();
      if (kutu.width <= 0) return null;
      const oran = (clientX - kutu.left) / kutu.width;
      const i = Math.round(oran * (noktaSayisi - 1));
      return Math.min(noktaSayisi - 1, Math.max(0, i));
    },
    [noktaSayisi],
  );

  /* GRAFİĞİN DIŞINA DOKUNUNCA OKUMA TEMİZLENİR. Dokunmatikte `pointerleave`
     gelmiyor: parmak kalkınca okuma ekranda kalıyor — bu İSTENEN davranış,
     dokunmak okumayı iğnelemek demek — ve okuyucu başka bir yere dokunana
     kadar o günü görüyor. Dışarıya dokunmak onu kaldırıyor. Aynı ders hisse
     grafiğinde de yazılı. */
  useEffect(() => {
    if (okunan === null) return;
    const disaridaBasildi = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const el = kap.current;
      if (el && event.target instanceof Node && el.contains(event.target)) return;
      setOkunan(null);
    };
    document.addEventListener("pointerdown", disaridaBasildi);
    return () => document.removeEventListener("pointerdown", disaridaBasildi);
  }, [okunan]);

  if (okunanSeri === null) {
    return (
      <p className="py-10 text-center text-base text-brass-ink">
        Trafik verisi okunamadı.
      </p>
    );
  }

  /* İlk ÖLÇÜLEN gün. Ondan önceki günler sıfır değil, bilinmiyor
     (lib/admin-data.ts → `TrafficPoint.measured`). */
  const ilk = points.findIndex((p) => p.measured);

  if (noktaSayisi < 2 || ilk === -1) {
    return (
      <p className="py-10 text-center text-base text-muted">
        Bu aralıkta ölçülmüş gün yok. Ölçüm ilk ziyaretle başlar.
      </p>
    );
  }

  /* Ölçek tepe değere göre, üstüne bir tık pay bırakılarak. Sıfırdan
     başlıyor: adet grafiğinde tabanı kırpmak farkları olduğundan büyük
     gösterir ve bu, sayıyı yanlış okutmanın en kolay yolu. Her şerit KENDİ
     tepesine göre. */
  const top = niceCeiling(Math.max(...points.map((p) => p.views), 1));
  /* Şeridin tavanı DAHA SIK basamaklı: şerit 48 piksel ve ızgara çizgisi
     yok, yuvarlak bir tavanın boşa harcadığı pay burada görünür bir kayıp.
     7 günlük pencerede tepe 11: kaba basamakla tavan 15, tepe 35 piksel;
     sık basamakla tavan 12, tepe 44 piksel. */
  const laneTop = niceCeiling(Math.max(...points.map((p) => p.visitors), 1), true);
  const innerH = H - PAD_T - PAD_B;
  const laneInnerH = LANE_H - LANE_PAD_T - LANE_PAD_B;
  const x = (i: number) => (i / (noktaSayisi - 1)) * W;
  const y = (v: number) => PAD_T + innerH - (v / top) * innerH;
  const ly = (v: number) => LANE_PAD_T + laneInnerH - (v / laneTop) * laneInnerH;

  /* BUGÜN KESİKLİ. Serinin son günü henüz TAMAMLANMADI ve düz bir çizgiyle
     çizilince tamamlanmış günlerden ayırt edilemiyor: sabah bakan yönetici
     yarım günün sayısını düşüş sanıyordu. Gün seriden ÇIKARILMIYOR —
     çıkarmak eksiği gizlemek olurdu; kesik çizgi eksik olduğunu söylüyor.
     Düz çizgi böylece BİREBİR üstteki kutuların penceresi (tam günler,
     lib/admin-data.ts → `getTrafficSeries`), kesik son parça bugün. */
  const bugunVar = points[noktaSayisi - 1].isToday;
  const sonTam = bugunVar ? noktaSayisi - 2 : noktaSayisi - 1;

  /* ÖLÇÜM ÖNCESİNE ÇİZGİ ÇİZİLMEZ (23 Eylül denetimi). 90 günlük pencere
     26 Haziran'dan başlıyor, ilk kayıt 13 Ağustos: boş günler sıfırla
     dolduruluyordu ve grafiğin sol yarısı düz bir sıfır trafik çizgisiydi
     (1440'ta çizgi ilk ölçülen günün 691 piksel solundan başlıyordu). O
     aralık artık taralı bir "Ölçüm Yok" bandı; çizgiler ilk ölçülen günden
     başlıyor. */
  const seri = (deger: (p: TrafficPoint) => number, yy: (v: number) => number) =>
    points.map((p, i) => `${x(i).toFixed(1)},${yy(deger(p)).toFixed(1)}`);
  const viewsLine = seri((p) => p.views, y);
  const visitorsLine = seri((p) => p.visitors, ly);
  const tamParca = (line: string[]) =>
    sonTam >= ilk ? line.slice(ilk, sonTam + 1).join(" ") : "";
  const kesikParca = (line: string[]) =>
    bugunVar && sonTam >= ilk ? line.slice(sonTam).join(" ") : "";
  const alan = (line: string[], taban: number) =>
    `${x(ilk).toFixed(1)},${taban} ${line.slice(ilk).join(" ")} ${W},${taban}`;

  const slotW = W / (noktaSayisi - 1);
  const midIndex = Math.floor((noktaSayisi - 1) / 2);
  const last = points[noktaSayisi - 1];
  const sonTamGun = sonTam >= ilk ? points[sonTam] : last;
  /* Tam günlerin toplamı — üstteki "Görüntüleme" kutusuyla AYNI sayı. */
  const tamGunler = points.slice(ilk, sonTam + 1);
  const toplamViews = tamGunler.reduce((sum, p) => sum + p.views, 0);
  const toplamVisitors = tamGunler.reduce((sum, p) => sum + p.visitors, 0);
  /* Taralı bandın sağ kenarı: ilk ölçülen günün diliminin sol kenarı. */
  const olcumsuzGenislik = ilk > 0 ? ((ilk - 0.5) / (noktaSayisi - 1)) * 100 : 0;

  /* VARSAYILAN OKUMA SON TAM GÜN (23 Eylül denetimi). Satır imleç yokken
     bugünü gösteriyordu: gün sürüyor ve sabah bakıldığında "Görüntüleme 30
     · Ziyaretçi 2" — grafiğin en görünür sayıları en az temsil edici
     olanlardı. Bugünün sayısı kaybolmuyor, yanında ayrı ve sönük bir çipte. */
  const gosterilen = okunan === null ? sonTamGun : points[okunan];
  const seciliMi = okunan !== null;
  const olculmedi = !gosterilen.measured;

  const klavye = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOkunan(null);
      return;
    }
    /* Klavye ölçülen aralıkta geziyor: ölçüm öncesindeki kırk dokuz boş
       günü tek tek geçmek (90 gün) hiçbir sayı vermiyordu. Home ilk
       ÖLÇÜLEN güne iniyor. */
    const hedef = (taban: number): number | null => {
      switch (event.key) {
        case "ArrowRight":
          return taban + 1;
        case "ArrowLeft":
          return taban - 1;
        case "PageUp":
          return taban - WEEK;
        case "PageDown":
          return taban + WEEK;
        case "Home":
          return ilk;
        case "End":
          return noktaSayisi - 1;
        default:
          return null;
      }
    };
    const taban = okunan === null ? sonTam : okunan;
    const sonraki = hedef(taban);
    if (sonraki === null) return;
    event.preventDefault();
    setOkunan(Math.min(noktaSayisi - 1, Math.max(ilk, sonraki)));
  };

  const imlec = seciliMi ? x(okunan) : null;

  return (
    <figure className="m-0">
      {/* OKUMA SATIRI. Lejant ve okuma aynı satırda: kimlik hiçbir zaman
          yalnızca renkle taşınmaz, o yüzden renk kutusu işaretin yanında ve
          metin mürekkep renginde — etiketin kendisi seri rengini giymiyor.
          Sayılar `.numeral`: imleç gezerken rakam genişliği değişirse
          satır titriyor. Adlar `METRIC`ten: aynı ölçü dört adla basılıyordu. */}
      <div className={READING_ROW}>
        <span className={cn(READING_ITEM, "text-body")}>
          <span aria-hidden className="h-[3px] w-4 self-center rounded-full bg-chart-a" />
          {METRIC.views}
          <span className="numeral font-semibold text-strong">
            {olculmedi ? "—" : gosterilen.views.toLocaleString("tr-TR")}
          </span>
        </span>
        <span className={cn(READING_ITEM, "text-body")}>
          <span aria-hidden className="h-[3px] w-4 self-center rounded-full bg-chart-b" />
          {METRIC.dailyVisitors}
          <span className="numeral font-semibold text-strong">
            {olculmedi ? "—" : gosterilen.visitors.toLocaleString("tr-TR")}
          </span>
        </span>
        {/* Hangi günü okuduğu YAZILI. Sayıyı gösterip gününü söylememek,
            okuyucunun imlecin nerede durduğunu tahmin etmesini istemek
            olurdu.

            CANLI BÖLGE SAYILARI DA SÖYLÜYOR. `aria-live` yalnızca bu
            span'deydi ve içinde sadece tarih vardı: ok tuşlarıyla gün gün
            gezen okuyucu "27 Ağustos", "26 Ağustos" diye tarih duyuyor ama
            hiçbir sayı duymuyordu — grafiğin tamamı sessizdi. Sayılar
            yanındaki iki kutuda ve onlar canlı DEĞİL. `sr-only` bir özet
            aynı bölgenin içinde duruyor; görsel künye olduğu gibi kalıyor.

            KÜNYE DE TITLE CASE: "bugün · sürüyor" idi ve aynı bileşenin
            gösterge satırı "Hafta Sonu ve Tatil" yazıyordu. */}
        <span
          aria-live="polite"
          className={
            seciliMi
              ? "numeral text-tiny font-semibold text-primary"
              : "numeral text-tiny text-muted"
          }
        >
          <span aria-hidden>
            {adminDay(gosterilen.day)}
            {olculmedi
              ? " · Ölçüm Yok"
              : gosterilen.isToday
                ? " · Sürüyor"
                : seciliMi
                  ? ""
                  : " · Son Tam Gün"}
          </span>
          <span className="sr-only">
            {adminDay(gosterilen.day)}
            {olculmedi
              ? ": ölçüm yok"
              : `${gosterilen.isToday ? " (gün sürüyor)" : ""}: ${gosterilen.views.toLocaleString("tr-TR")} görüntüleme, ${gosterilen.visitors.toLocaleString("tr-TR")} ziyaretçi`}
          </span>
        </span>
        {bugunVar && (
          /* Bugünün sayısı ayrı bir çipte, sönük: tamamlanmamış bir günün
             büyüklüğü tam günlerle aynı puntoda yarışmıyor. Birim görünür
             metinde yok — satırın ilk ölçüsü görüntüleme ve çip onun bugünkü
             hâli; "Görüntüleme" eki çipi 390'da üçüncü satıra itiyordu. */
          <span className={cn(TODAY_CHIP, "bg-surface-elevated text-muted")}>
            Bugün Şimdiye Kadar
            <span className="numeral font-semibold text-body">
              {last.views.toLocaleString("tr-TR")}
            </span>
            <span className="sr-only">görüntüleme</span>
          </span>
        )}
      </div>

      {/* ETKİLEŞİM YÜZEYİ İKİ ŞERİDİ BİRDEN SARIYOR: imleç, dokunma ve
          klavye tek bir durak; iki şeridin imleç çizgisi aynı x'te. */}
      <div
        ref={kap}
        className="relative touch-pan-y rounded-(--radius-sm) outline-none focus-visible:ring-2 focus-visible:ring-(--line-focus) focus-visible:ring-offset-4 focus-visible:ring-offset-(--premium-surface)"
        role="img"
        tabIndex={0}
        aria-label={`Günlük trafik, ${adminDay(points[ilk].day)} ile ${adminDay(last.day)} arası. ${tamGunler.length} tam günde ${toplamViews.toLocaleString("tr-TR")} görüntüleme. ${adminDay(sonTamGun.day)}: ${sonTamGun.views.toLocaleString("tr-TR")} görüntüleme, ${sonTamGun.visitors.toLocaleString("tr-TR")} ziyaretçi. Ok tuşlarıyla gün gün, Home ve End ile ilk ve son güne gidilir.`}
        onKeyDown={klavye}
        onPointerMove={(event) => setOkunan(konumdanIndeks(event.clientX))}
        onPointerDown={(event) => setOkunan(konumdanIndeks(event.clientX))}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setOkunan(null);
        }}
        /* PARMAK KAYDIRMAYA DÖNERSE OKUMA SİLİNİYOR. `touch-pan-y` sayfayı
           dikey kaydırmaya izin veriyor ve tarayıcı kaydırmayı üstlendiği
           anda `pointercancel` atıp `pointerup`/`pointerleave` ATMIYOR.
           İşlenmediği için okuma satırı, artık dokunulmayan bir günü
           göstermeye devam ediyordu — grafikte dokunulan okumanın aralık
           değişince temizlenmesiyle aynı kural.

           `pointerup` OKUMAYI SİLMİYOR (23 Eylül denetimi). Bir dönem
           siliyordu ve dokunmatikte bir dokunuş HİÇBİR ŞEY göstermiyordu:
           390'da 29 Ağu'ya dokunulurken okuma "706 görüntüleme", parmak
           kalktıktan 300 ms sonra yeniden bugündü. Yukarıdaki "dışarıya
           dokununca temizlenir" kuralı o yüzden hiç çalışmıyordu. */
        onPointerCancel={() => setOkunan(null)}
        onBlur={() => setOkunan(null)}
      >
        {/* GÖRÜNTÜLEME ŞERİDİ. Tavan etiketi, ızgara çizgisinin tam üstüne
            yüzdeyle konumlanıyor — her genişlikte doğru yerde durur. Etiket
            şeridin ÖLÇÜSÜNÜ adıyla söylüyor: iki şerit iki ayrı ölçekte ve
            hangi sayının hangi şeride ait olduğu renge bırakılmıyor. */}
        <div className="relative">
          <span
            className={CEILING_LABEL}
            style={{ top: `${(PAD_T / H) * 100}%` }}
          >
            {top.toLocaleString("tr-TR")} {METRIC.views}
          </span>
          <svg
            data-lane="views"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className={VIEWS_LANE}
            aria-hidden
          >
            {/* Izgara geride: iki yatay çizgi yeter — tavan ve taban. */}
            <line
              x1="0"
              y1={y(top)}
              x2={W}
              y2={y(top)}
              stroke="var(--line)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <line
              data-zero
              x1="0"
              y1={y(0)}
              x2={W}
              y2={y(0)}
              stroke="var(--line-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <OffDays points={points} ilk={ilk} x={x} slotW={slotW} y0={PAD_T} y1={y(0)} />
            <polygon points={alan(viewsLine, y(0))} fill="var(--chart-a-fill)" />
            <SeriesLine points={tamParca(viewsLine)} stroke="var(--chart-a)" />
            <SeriesLine points={kesikParca(viewsLine)} stroke="var(--chart-a)" dashed />
            {imlec !== null && (
              <Cursor
                x={imlec}
                y0={PAD_T}
                y1={y(0)}
                mark={olculmedi ? null : y(gosterilen.views)}
                stroke="var(--chart-a)"
              />
            )}
          </svg>
        </div>

        {/* ZİYARETÇİ ŞERİDİ — kendi tavanıyla. Ölçüldü (30 gün, 1440):
            tepe 25 ziyaretçi eski ortak ölçekte 5,5 piksel yüksekti, burada
            46 piksel (tavan 26). */}
        <div className={cn("relative", VISITORS_GAP)}>
          <span
            className={CEILING_LABEL}
            style={{ top: `${(LANE_PAD_T / LANE_H) * 100}%` }}
          >
            {laneTop.toLocaleString("tr-TR")} {METRIC.dailyVisitors}
          </span>
          <svg
            data-lane="visitors"
            viewBox={`0 0 ${W} ${LANE_H}`}
            preserveAspectRatio="none"
            className={VISITORS_LANE}
            aria-hidden
          >
            <line
              data-zero
              x1="0"
              y1={ly(0)}
              x2={W}
              y2={ly(0)}
              stroke="var(--line-strong)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <OffDays points={points} ilk={ilk} x={x} slotW={slotW} y0={LANE_PAD_T} y1={ly(0)} />
            {/* Şeridin dolgusu çizginin kendi renginden, düşük opaklıkla —
                ayrı bir dolgu tokeni yok ve renk yine tokenden geliyor. */}
            <polygon points={alan(visitorsLine, ly(0))} fill="var(--chart-b)" fillOpacity={0.14} />
            <SeriesLine points={tamParca(visitorsLine)} stroke="var(--chart-b)" />
            <SeriesLine points={kesikParca(visitorsLine)} stroke="var(--chart-b)" dashed />
            {imlec !== null && (
              <Cursor
                x={imlec}
                y0={LANE_PAD_T}
                y1={ly(0)}
                mark={olculmedi ? null : ly(gosterilen.visitors)}
                stroke="var(--chart-b)"
              />
            )}
          </svg>
        </div>

        {ilk > 0 && (
          /* ÖLÇÜM YOK BANDI — iki şeridi birden kaplıyor, çizgi yok. */
          <div
            data-unmeasured
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center rounded-(--radius-sm) bg-[repeating-linear-gradient(135deg,var(--line-strong)_0_1px,transparent_1px_7px)]"
            style={{ width: `${olcumsuzGenislik}%` }}
          >
            <span className="rounded-full bg-(--premium-surface) px-2 py-0.5 text-tiny font-semibold text-muted">
              Ölçüm Yok
            </span>
          </div>
        )}
      </div>

      {/* Tarih ekseni HTML'de: üç etiket. Otuz günün hepsini yazmak
          okunmayan bir duvar üretiyor. Okunur tarih ("25 Ağu"), rakamsal
          değil: yıl her etikette tekrar ediyor ve hiçbir şey eklemiyordu
          (lib/admin-format.ts → `adminDay`). */}
      <div data-axis className={cn(AXIS_ROW, "text-muted")}>
        <span>{adminDay(points[0].day)}</span>
        <span>{adminDay(points[midIndex].day)}</span>
        <span>{adminDay(last.day)}</span>
      </div>

      {/* İŞARETLERİN ANLAMI YAZILI. Kesik çizgi, gri bant ve tarama,
          açıklaması olmadan yalnızca bir görsel fark; ne anlama geldikleri
          burada. */}
      {(bugunVar || ilk > 0 || points.some((p) => p.offDay)) && (
        <p className={cn(KEY_ROW, "text-muted")}>
          {bugunVar && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-[3px] w-4 rounded-full bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_4px,transparent_4px_7px)]"
              />
              Bugün · Gün Sürüyor
            </span>
          )}
          {points.some((p, i) => p.offDay && i >= ilk) && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-4 rounded-xs bg-surface-sunken" />
              Hafta Sonu ve Tatil
            </span>
          )}
          {ilk > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-3 w-4 rounded-xs bg-[repeating-linear-gradient(135deg,var(--line-strong)_0_1px,transparent_1px_4px)]"
              />
              Ölçüm Yok
            </span>
          )}
        </p>
      )}

      {/* Tablo görünümü — grafiğin okunamadığı her durumda aynı sayılar. */}
      <details className={TABLE_DETAILS}>
        {/* 44 PİKSEL: `<summary>` çıplak bir metin satırıydı ve yüksekliği
            18 piksele iniyordu. Altında ve üstünde başka hedef yok, yani
            `min-h-11` komşusunu ezmiyor. */}
        <summary className={cn(TABLE_SUMMARY, "cursor-pointer text-muted hover:text-body")}>
          Sayıları Tablo Olarak Gör
        </summary>
        {/* KAYDIRMA KABI KLAVYEYLE ODAKLANABİLİR — `AdminTable`daki kuralın
            aynısı: 30 günlük pencerede ~780 piksellik tablo 256 piksele
            sıkışıyor ve içinde odaklanabilir hiçbir şey olmadığı için
            klavyeyle gezen okuyucu ilk on günün ötesine hiç ulaşamıyordu
            (WCAG 2.1.1).

            `max-w-xl`: dört sütunluk tablo 1440'ta panelin tamamına
            yayılıyordu ve tarih ile sayısı arasında 1.500 piksel vardı;
            göz satırı izlerken kayboluyor. */}
        <div
          className="scroll-x mt-2 max-h-64 max-w-xl overflow-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
          tabIndex={0}
          role="region"
          aria-label="Gün gün trafik tablosu"
        >
          <table className="w-full text-small">
            <caption className="sr-only">
              Gün gün görüntüleme ve ziyaretçi; ölçüm öncesi günler tabloda yok
            </caption>
            {/* Başlıklar Title Case, büyük harfe çevrilmiyor — `AdminTable`
                ile aynı dil. Başlık satırı kayarken yerinde kalıyor. */}
            <thead className="sticky top-0 bg-(--premium-surface)">
              <tr className="text-left font-semibold text-muted">
                <th scope="col" className="pb-1.5">
                  Tarih
                </th>
                {/* HAFTA GÜNÜ SÜTUNU: gri hafta sonu bantlarının metin
                    karşılığı — tabloyu okuyan da cumartesi çukurunu
                    görüyor. */}
                <th scope="col" className="pb-1.5 pl-3">
                  Gün
                </th>
                <th scope="col" className="pb-1.5 pl-3 text-right">
                  {METRIC.views}
                </th>
                <th scope="col" className="pb-1.5 pl-3 text-right">
                  {METRIC.dailyVisitors}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Yoğun tablo: rakamsal tarih burada kalıyor. Ölçüm öncesi
                  günler yazılmıyor — sayıları yok, sıfır değil. */}
              {points
                .slice(ilk)
                .reverse()
                .map((p) => (
                  <tr key={p.day} className="border-t border-line">
                    <th scope="row" className="py-1 text-left font-normal text-body">
                      <span className="numeral">{formatEtDateShort(p.day, "tr")}</span>
                    </th>
                    <td className="py-1 pl-3 text-muted">{dayNote(p)}</td>
                    <td className="numeral py-1 pl-3 text-right text-strong">
                      {p.views.toLocaleString("tr-TR")}
                    </td>
                    <td className="numeral py-1 pl-3 text-right text-body">
                      {p.visitors.toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
            </tbody>
            {/* TAM GÜNLERİN TOPLAMI — üstteki kutularla AYNI sayılar.
                Tablo bugünü de listeliyor; toplamı bugünsüz yazılıyor ki
                okuyucu satırları toplayıp kutuyla karşılaştırdığında aynı
                sayıyı bulsun (veri dürüstlüğü § 3). Ziyaretçi sütununun
                toplamı ziyaretçi-günüdür: kimlik her gün döndüğü için
                günlük tekillerin toplamı. */}
            {tamGunler.length > 1 && (
              <tfoot>
                <tr className="border-t border-line-strong font-semibold">
                  <th scope="row" colSpan={2} className="py-1.5 text-left text-body">
                    {tamGunler.length} Tam Gün
                  </th>
                  <td className="numeral py-1.5 pl-3 text-right text-strong">
                    {toplamViews.toLocaleString("tr-TR")}
                  </td>
                  <td className="numeral py-1.5 pl-3 text-right text-body">
                    {toplamVisitors.toLocaleString("tr-TR")}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </details>
    </figure>
  );
}

/**
 * Grafiğin yer tutucusu — panelin başlığı HARİÇ, grafiğin gövdesi.
 *
 * GRAFİĞİN YANINDA DURUYOR, SAYFALARDA DEĞİL. Özet ve Trafik ekranı aynı
 * grafiği çiziyor ve ikisi de yer tutucusunu kendi yazıyordu; iki kopya
 * grafikten ayrı düştü (Özet `h-36` ve `mt-6`, grafik `h-32` ve `mt-5`).
 * Boylar artık grafiğin kendi dizelerinden geliyor (dosyanın başındaki
 * ortak dizeler). Başlık bloğu sayfanın: Özet'in başlığında bir bağlantı
 * var, Trafik'inkinde yok.
 *
 * OKUMA SATIRI GERÇEK METİNLE, GÖRÜNMEZ. Satır dar kapta sarıyor (390'da
 * iki satır, genişte bir) ve nerede saracağı öğelerin genişliğine bağlı.
 * Sabit genişlikli çubuklar başka bir noktada sarabilirdi; aynı sözcükleri
 * saydam basmak aynı genişliği, dolayısıyla aynı sarmayı veriyor. Çubuk o
 * metnin üstünde.
 *
 * Ölçüm Yok işaretinin açıklaması burada YOK: yalnızca ölçüm öncesine uzanan
 * pencerede (90 gün) basılıyor ve yer tutucu veriyi bilmiyor. Telefonda o
 * pencerede panel akış inince bir satır (16 piksel) uzuyor.
 */
export function TrafficChartSkeleton() {
  return (
    <div aria-hidden>
      <div className={READING_ROW}>
        <SkeletonText className={READING_ITEM}>
          <span className="h-[3px] w-4 self-center" />
          {METRIC.views}
          <span className="numeral font-semibold">000</span>
        </SkeletonText>
        <SkeletonText className={READING_ITEM}>
          <span className="h-[3px] w-4 self-center" />
          {METRIC.dailyVisitors}
          <span className="numeral font-semibold">00</span>
        </SkeletonText>
        <SkeletonText className="numeral text-tiny">00 Eyl · Son Tam Gün</SkeletonText>
        {/* Çip kendi dolgusuyla: hap biçimini kırpma veriyor (`.skeleton`
            kendi köşe yarıçapını taşıyor ve `rounded-full`u eziyor). */}
        <span className={cn(TODAY_CHIP, "relative overflow-hidden text-transparent select-none")}>
          Bugün Şimdiye Kadar
          <span className="numeral font-semibold">00</span>
          <span className="skeleton absolute inset-0" />
        </span>
      </div>
      <Skeleton className={VIEWS_LANE} />
      <Skeleton className={cn(VISITORS_GAP, VISITORS_LANE)} />
      <div className={AXIS_ROW}>
        <SkeletonText>00 Ağu</SkeletonText>
        <SkeletonText>00 Eyl</SkeletonText>
        <SkeletonText>00 Eyl</SkeletonText>
      </div>
      <div className={KEY_ROW}>
        <SkeletonText>Bugün · Gün Sürüyor</SkeletonText>
        <SkeletonText>Hafta Sonu ve Tatil</SkeletonText>
      </div>
      <div className={TABLE_DETAILS}>
        <div className={TABLE_SUMMARY}>
          <SkeletonText>Sayıları Tablo Olarak Gör</SkeletonText>
        </div>
      </div>
    </div>
  );
}

/**
 * Saydam metin + üstünde ince bir çubuk: genişlik metnin, görünüm yer
 * tutucunun. Çubuk `span` — `Skeleton` bir `div` ve satır içi öğenin içinde
 * geçersiz.
 */
function SkeletonText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex items-center text-transparent select-none", className)}>
      {children}
      <span className="skeleton absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2" />
    </span>
  );
}

/**
 * SESSİZ GÜN BANTLARI EN GERİDE. Hafta sonu ve tatil günlerinde trafik
 * planlı olarak düşük; bantsız grafikte cumartesi çukurunu gören yönetici
 * "trafik mi düştü, ölçüm mü bozuldu" diye ayırt edemiyordu. Bant bir ZEMİN,
 * tek taşıyıcı değil: çizgi zaten üstünde ve tablo görünümü aynı sayıları
 * (ve hafta gününü) veriyor. Ölçüm öncesinde bant yok — orada tarama var.
 */
function OffDays({
  points,
  ilk,
  x,
  slotW,
  y0,
  y1,
}: {
  points: TrafficPoint[];
  ilk: number;
  x: (i: number) => number;
  slotW: number;
  y0: number;
  y1: number;
}) {
  return (
    <>
      {points.map((p, i) =>
        p.offDay && i >= ilk ? (
          <rect
            key={`off-${p.day}`}
            x={Math.max(0, x(i) - slotW / 2)}
            y={y0}
            width={slotW}
            height={y1 - y0}
            fill="var(--surface-sunken)"
          />
        ) : null,
      )}
    </>
  );
}

function SeriesLine({
  points,
  stroke,
  dashed = false,
}: {
  points: string;
  stroke: string;
  dashed?: boolean;
}) {
  if (!points) return null;
  return (
    <polyline
      points={points}
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeDasharray={dashed ? "4 3" : undefined}
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/**
 * İMLEÇ ÇİZGİSİ VE İŞARET, ÖLÇEKTEN BAĞIMSIZ.
 * `preserveAspectRatio="none"` altında geometri iki eksende farklı
 * ölçekleniyor: daire elipse döner, dikdörtgenin de GENİŞLİĞİ ekrana göre
 * değişir. İşaretler bir dönem dikdörtgendi ve yorumu "genişliği
 * `non-scaling-stroke` ile sabit kalıyor" diyordu — o koruma dolgu (`fill`)
 * taşıyan bir `rect`e UYGULANMIYOR, çünkü kural yalnızca çizgi kalınlığına
 * bakıyor. Ölçüldü: `?gun=90` + 390 piksel ekranda işaret 1,2 × 4,3
 * piksele iniyor, yani imleç çizgisinden ayırt edilemiyor. Sıfır uzunluklu
 * bir `line` + yuvarlak uç, dolgu değil ÇİZGİ kalınlığı olduğu için
 * `non-scaling-stroke`un kapsamına giriyor: her ölçekte 7 piksellik bir
 * daire, elipse de dönmüyor. Ölçülmemiş günde işaret yok, yalnızca çizgi.
 */
function Cursor({
  x,
  y0,
  y1,
  mark,
  stroke,
}: {
  x: number;
  y0: number;
  y1: number;
  mark: number | null;
  stroke: string;
}) {
  return (
    <g pointerEvents="none">
      <line
        x1={x}
        y1={y0}
        x2={x}
        y2={y1}
        stroke="var(--line-strong)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {mark !== null && (
        <line
          x1={x}
          y1={mark}
          x2={x}
          y2={mark}
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

/**
 * Tepe değeri okunur bir yuvarlak sayıya çıkarır: 137 → 150, 1.240 → 1.500.
 * `fine`: basamak yarım değil beşte bir — 11 → 12, 137 → 140.
 */
function niceCeiling(value: number, fine = false): number {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / (fine ? 5 : 2);
  return Math.ceil(value / step) * step;
}
