"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrafficPoint } from "@/lib/admin-data";
import { formatEtDateShort } from "@/lib/utils";

/**
 * Günlük trafik — SVG çizim, üstünde imleçle okunan bir satır.
 *
 * FORM SEÇİMİ: iki seri, aynı birim (adet), aynı eksen. Görüntüleme her
 * zaman tekil ziyaretçiden BÜYÜK ya da eşit — biri diğerinin alt kümesi.
 * Bu yüzden yığılmış bar YANLIŞ olurdu (toplamları anlamsız); iki çizgi,
 * altında yalnızca görüntülemenin alan dolgusu var. Alanın kendisi de bir
 * ikincil kodlama: iki seriyi renk körlüğünde bile ayırıyor.
 *
 * TEK EKSEN. İki ölçüyü ayrı ölçeklerde çizmek (çift eksen) grafiklerin en
 * yaygın hatası: iki eğrinin kesişme noktası eksen seçimine bağlı olur ve
 * hiçbir şey anlatmaz. İkisi de adet olduğu için buna gerek de yok.
 *
 * BÜTÜN METİN SVG'NİN DIŞINDA. Bir süre eksen etiketleri `<text>` olarak
 * çizildi ve telefonda okunmuyordu: 720 birimlik viewBox 350 piksellik bir
 * ekrana sığarken 11 puntoluk yazı da yarı yarıya küçülüyor, beş piksellik
 * bir lekeye dönüyordu. Yazının SVG içinde olmasının hiçbir faydası yoktu —
 * HTML'de her genişlikte aynı boyda duruyor.
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
 * örterdi. İmleç yokken aynı satır SON GÜNÜ gösteriyor, yani boş kalmıyor
 * ve okuyucu satırın ne olduğunu etkileşime girmeden öğreniyor.
 *
 * Bedeli dürüstçe: yönetim paneline küçük bir istemci bileşeni iniyor.
 * Panel oturum arkasında, tek dilde ve bir araç — genel sayfaların yük
 * bütçesi buraya uygulanmıyor.
 *
 * DOKUNMATİK VE KLAVYE DE OKUYOR. Parmakla dokunmak okumayı açıyor, grafiğin
 * dışına dokunmak temizliyor (hisse grafiğinin dersi: temizlenmezse okuma
 * artık bakılmayan bir günü göstermeye devam ediyor). Klavyede grafik bir
 * durak ve ok tuşları günler arasında geziyor — yerel ipucunun hiç
 * veremediği şey buydu.
 *
 * Altındaki `<details>` tablo görünümü duruyor: grafiği hiç okuyamayan da
 * aynı sayılara metin olarak ulaşıyor.
 */

const W = 720;
const H = 200;
const PAD_T = 10;
const PAD_B = 4;

export function TrafficChart({
  points,
  locale,
}: {
  points: TrafficPoint[];
  locale: "tr" | "en";
}) {
  const [okunan, setOkunan] = useState<number | null>(null);
  const kap = useRef<HTMLDivElement>(null);

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
     gelmiyor: parmak kalkınca okuma ekranda kalıyor ve okuyucu artık
     bakmadığı bir günün sayısını görmeye devam ediyor. Aynı ders hisse
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

  if (noktaSayisi < 2) {
    return (
      <p className="py-10 text-center text-base text-muted">
        Grafik için henüz yeterli gün yok. Ölçüm ilk ziyaretle başlar.
      </p>
    );
  }

  /* Ölçek tepe değere göre, üstüne bir tık pay bırakılarak. Sıfırdan
     başlıyor: adet grafiğinde tabanı kırpmak farkları olduğundan büyük
     gösterir ve bu, sayıyı yanlış okutmanın en kolay yolu. */
  const peak = Math.max(...points.map((p) => p.views), 1);
  const top = niceCeiling(peak);
  const innerH = H - PAD_T - PAD_B;
  const x = (i: number) => (i / (noktaSayisi - 1)) * W;
  const y = (v: number) => PAD_T + innerH - (v / top) * innerH;

  const viewsLine = points.map((p, i) => `${x(i).toFixed(1)},${y(p.views).toFixed(1)}`);
  const visitorsLine = points.map(
    (p, i) => `${x(i).toFixed(1)},${y(p.visitors).toFixed(1)}`,
  );
  const area = `0,${y(0)} ${viewsLine.join(" ")} ${W},${y(0)}`;

  /* BUGÜN KESİKLİ. Serinin son günü henüz TAMAMLANMADI ve düz bir çizgiyle
     çizilince tamamlanmış günlerden ayırt edilemiyor: sabah bakan yönetici
     yarım günün sayısını düşüş sanıyordu. Gün seriden ÇIKARILMIYOR —
     çıkarmak eksiği gizlemek olurdu; kesik çizgi eksik olduğunu söylüyor.
     Son parça ayrı çiziliyor, gerisi düz kalıyor. */
  const bugunVar = points[noktaSayisi - 1].isToday;
  const sonParcaViews = bugunVar
    ? viewsLine.slice(noktaSayisi - 2).join(" ")
    : null;
  const sonParcaVisitors = bugunVar
    ? visitorsLine.slice(noktaSayisi - 2).join(" ")
    : null;
  const tamViews = bugunVar ? viewsLine.slice(0, noktaSayisi - 1) : viewsLine;
  const tamVisitors = bugunVar
    ? visitorsLine.slice(0, noktaSayisi - 1)
    : visitorsLine;

  const last = points[noktaSayisi - 1];
  const totalViews = points.reduce((sum, p) => sum + p.views, 0);
  const slotW = W / (noktaSayisi - 1);
  const midIndex = Math.floor((noktaSayisi - 1) / 2);

  /* Okuma satırı imleç yokken SON GÜNÜ gösteriyor — boş bir satır, okuyucuya
     satırın ne işe yaradığını da söylemez. */
  const gosterilen = okunan === null ? last : points[okunan];
  const seciliMi = okunan !== null;

  const klavye = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOkunan(null);
      return;
    }
    const yon =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (yon === 0) return;
    event.preventDefault();
    setOkunan((onceki) => {
      const taban = onceki === null ? noktaSayisi - 1 : onceki;
      return Math.min(noktaSayisi - 1, Math.max(0, taban + yon));
    });
  };

  return (
    <figure className="m-0">
      {/* OKUMA SATIRI. Lejant ve okuma aynı satırda: kimlik hiçbir zaman
          yalnızca renkle taşınmaz, o yüzden renk kutusu işaretin yanında ve
          metin mürekkep renginde — etiketin kendisi seri rengini giymiyor.
          Sayılar `tabular-nums`: imleç gezerken rakam genişliği değişirse
          satır titriyor. */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-small">
        <span className="inline-flex items-center gap-2 text-body">
          <span aria-hidden className="h-[3px] w-4 rounded-full bg-chart-a" />
          Görüntüleme
          <span className="numeral font-semibold text-strong">
            {gosterilen.views.toLocaleString("tr-TR")}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 text-body">
          <span aria-hidden className="h-[3px] w-4 rounded-full bg-chart-b" />
          Tekil Ziyaretçi
          <span className="numeral font-semibold text-strong">
            {gosterilen.visitors.toLocaleString("tr-TR")}
          </span>
        </span>
        {/* Hangi günü okuduğu YAZILI. Sayıyı gösterip gününü söylememek,
            okuyucunun imlecin nerede durduğunu tahmin etmesini istemek
            olurdu. `aria-live`: klavyeyle gezen okuyucu değişimi duyar. */}
        <span
          aria-live="polite"
          className={
            seciliMi
              ? "numeral text-tiny font-semibold text-primary"
              : "numeral text-tiny text-muted"
          }
        >
          {seciliMi
            ? formatEtDateShort(gosterilen.day, locale) +
              (gosterilen.isToday ? " · sürüyor" : "")
            : bugunVar
              ? "bugün · sürüyor"
              : "son gün"}
        </span>
      </div>

      <div className="relative" ref={kap}>
        {/* Tavan etiketi, ızgara çizgisinin tam üstüne yüzdeyle
            konumlanıyor — her genişlikte doğru yerde durur. */}
        <span
          className="numeral pointer-events-none absolute left-0 -translate-y-full text-tiny text-muted"
          style={{ top: `${(PAD_T / H) * 100}%` }}
        >
          {top.toLocaleString("tr-TR")}
        </span>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-36 w-full touch-pan-y rounded-(--radius-sm) outline-none focus-visible:ring-2 focus-visible:ring-(--line-focus) sm:h-44"
          role="img"
          tabIndex={0}
          aria-label={`Son ${noktaSayisi} günün trafiği. Toplam ${totalViews} görüntüleme. Son gün ${last.views} görüntüleme, ${last.visitors} tekil ziyaretçi. Ok tuşlarıyla gün gün okunur.`}
          onKeyDown={klavye}
          onPointerMove={(event) => setOkunan(konumdanIndeks(event.clientX))}
          onPointerDown={(event) => setOkunan(konumdanIndeks(event.clientX))}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") setOkunan(null);
          }}
          onBlur={() => setOkunan(null)}
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
            x1="0"
            y1={y(0)}
            x2={W}
            y2={y(0)}
            stroke="var(--line-strong)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {/* SESSİZ GÜN BANTLARI EN GERİDE. Hafta sonu ve tatil günlerinde
              trafik planlı olarak düşük; bantsız grafikte cumartesi çukurunu
              gören yönetici "trafik mi düştü, ölçüm mü bozuldu" diye ayırt
              edemiyordu. Bant bir ZEMİN, tek taşıyıcı değil: çizgi zaten
              üstünde ve tablo görünümü aynı sayıları veriyor. */}
          {points.map((p, i) =>
            p.offDay ? (
              <rect
                key={`off-${p.day}`}
                x={Math.max(0, x(i) - slotW / 2)}
                y={PAD_T}
                width={slotW}
                height={y(0) - PAD_T}
                fill="var(--surface-sunken)"
              />
            ) : null,
          )}

          <polygon points={area} fill="var(--chart-a-fill)" />
          <polyline
            points={tamViews.join(" ")}
            fill="none"
            stroke="var(--chart-a)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={tamVisitors.join(" ")}
            fill="none"
            stroke="var(--chart-b)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {sonParcaViews && (
            <polyline
              points={sonParcaViews}
              fill="none"
              stroke="var(--chart-a)"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {sonParcaVisitors && (
            <polyline
              points={sonParcaVisitors}
              fill="none"
              stroke="var(--chart-b)"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* İMLEÇ ÇİZGİSİ VE İŞARETLER. Daireler `vectorEffect` almıyor
              çünkü `preserveAspectRatio="none"` altında esneyip elipse
              dönerlerdi; onun yerine yatayda ölçekten bağımsız kalan ince
              bir dikdörtgen ve ölçeği ters çevrilmiş küçük daireler
              yerine — en sade çözüm: işaretler de dikdörtgen. Kare bir
              işaret elips olmuyor, yalnızca genişliği değişiyor ve o da
              `non-scaling-stroke` ile sabit kalıyor. */}
          {seciliMi && (
            <g pointerEvents="none">
              <line
                x1={x(okunan)}
                y1={PAD_T}
                x2={x(okunan)}
                y2={y(0)}
                stroke="var(--line-strong)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={x(okunan) - slotW / 6}
                y={y(gosterilen.views) - 3}
                width={slotW / 3}
                height={6}
                fill="var(--chart-a)"
              />
              <rect
                x={x(okunan) - slotW / 6}
                y={y(gosterilen.visitors) - 3}
                width={slotW / 3}
                height={6}
                fill="var(--chart-b)"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Tarih ekseni HTML'de: üç etiket. Otuz günün hepsini yazmak
          okunmayan bir duvar üretiyor. */}
      <div className="numeral mt-1.5 flex justify-between text-tiny text-muted">
        <span>{formatEtDateShort(points[0].day, locale)}</span>
        <span>{formatEtDateShort(points[midIndex].day, locale)}</span>
        <span>{formatEtDateShort(last.day, locale)}</span>
      </div>

      {/* İŞARETLERİN ANLAMI YAZILI. Kesik çizgi ve gri bant, açıklaması
          olmadan yalnızca bir görsel fark; ne anlama geldikleri burada. */}
      {(bugunVar || points.some((p) => p.offDay)) && (
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-tiny text-muted">
          {bugunVar && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-[3px] w-4 rounded-full bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_4px,transparent_4px_7px)]"
              />
              Bugün · Gün Sürüyor
            </span>
          )}
          {points.some((p) => p.offDay) && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-3 w-4 rounded-xs bg-surface-sunken"
              />
              Hafta Sonu ve Tatil
            </span>
          )}
        </p>
      )}

      {/* Tablo görünümü — grafiğin okunamadığı her durumda aynı sayılar. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-small text-muted hover:text-body">
          Sayıları Tablo Olarak Gör
        </summary>
        <div className="scroll-x mt-2 max-h-64 overflow-auto">
          <table className="w-full text-small">
            <caption className="sr-only">
              Gün gün görüntüleme ve tekil ziyaretçi
            </caption>
            <thead>
              <tr className="text-left text-tiny uppercase tracking-[0.05em] text-muted">
                <th scope="col" className="pb-1">
                  Gün
                </th>
                <th scope="col" className="pb-1 text-right">
                  Görüntüleme
                </th>
                <th scope="col" className="pb-1 text-right">
                  Ziyaretçi
                </th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.day} className="border-t border-line">
                  <td className="py-1 text-body">
                    {formatEtDateShort(p.day, locale)}
                  </td>
                  <td className="numeral py-1 text-right text-strong">
                    {p.views.toLocaleString("tr-TR")}
                  </td>
                  <td className="numeral py-1 text-right text-body">
                    {p.visitors.toLocaleString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Tepe değeri okunur bir yuvarlak sayıya çıkarır: 137 → 150, 1.240 → 1.500. */
function niceCeiling(value: number): number {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}
