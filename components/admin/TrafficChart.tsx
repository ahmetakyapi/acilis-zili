import type { TrafficPoint } from "@/lib/admin-data";
import { formatEtDateShort } from "@/lib/utils";

/**
 * Günlük trafik — sunucuda çizilen SVG, istemci JS'i sıfır.
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
 * Uç noktalarda daire YOK, çünkü daire esnerken elipse dönerdi — son
 * değerler grafiğin üstünde yazıyla duruyor, orada daha da okunur.
 *
 * ETKİLEŞİM JS'SİZ: her günün üzerinde saydam bir vuruş alanı ve içinde
 * `<title>` var — tarayıcı kendi ipucunu gösteriyor. Altındaki `<details>`
 * tablo görünümü aynı sayıları metin olarak veriyor; grafiği okuyamayan
 * hiç kimse veriden mahrum kalmıyor.
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
  if (points.length < 2) {
    return (
      <p className="py-10 text-center text-[13px] text-muted">
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
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => PAD_T + innerH - (v / top) * innerH;

  const viewsLine = points.map((p, i) => `${x(i).toFixed(1)},${y(p.views).toFixed(1)}`);
  const visitorsLine = points.map(
    (p, i) => `${x(i).toFixed(1)},${y(p.visitors).toFixed(1)}`,
  );
  const area = `0,${y(0)} ${viewsLine.join(" ")} ${W},${y(0)}`;

  const last = points[points.length - 1];
  const totalViews = points.reduce((sum, p) => sum + p.views, 0);
  const slotW = W / (points.length - 1);
  const midIndex = Math.floor((points.length - 1) / 2);

  return (
    <figure className="m-0">
      {/* Lejant iki seri için ŞART: kimlik hiçbir zaman yalnızca renkle
          taşınmaz. Renk kutusu işaretin yanında, metin ise mürekkep
          renginde — etiketin kendisi seri rengini giymiyor. */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-[12.5px]">
        <span className="inline-flex items-center gap-2 text-body">
          <span aria-hidden className="h-[3px] w-4 rounded-full bg-chart-a" />
          Görüntüleme
          <span className="font-semibold tabular-nums text-strong">
            {last.views.toLocaleString("tr-TR")}
          </span>
        </span>
        <span className="inline-flex items-center gap-2 text-body">
          <span aria-hidden className="h-[3px] w-4 rounded-full bg-chart-b" />
          Tekil Ziyaretçi
          <span className="font-semibold tabular-nums text-strong">
            {last.visitors.toLocaleString("tr-TR")}
          </span>
        </span>
        <span className="text-[11.5px] text-muted">son gün</span>
      </div>

      <div className="relative">
        {/* Tavan etiketi, ızgara çizgisinin tam üstüne yüzdeyle
            konumlanıyor — her genişlikte doğru yerde durur. */}
        <span
          className="pointer-events-none absolute left-0 -translate-y-full text-[11px] tabular-nums text-muted"
          style={{ top: `${(PAD_T / H) * 100}%` }}
        >
          {top.toLocaleString("tr-TR")}
        </span>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-36 w-full sm:h-44"
          role="img"
          aria-label={`Son ${points.length} günün trafiği. Toplam ${totalViews} görüntüleme. Son gün ${last.views} görüntüleme, ${last.visitors} tekil ziyaretçi.`}
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

          <polygon points={area} fill="var(--chart-a-fill)" />
          <polyline
            points={viewsLine.join(" ")}
            fill="none"
            stroke="var(--chart-a)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={visitorsLine.join(" ")}
            fill="none"
            stroke="var(--chart-b)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Vuruş alanları — JS yok, tarayıcının kendi ipucu. */}
          {points.map((p, i) => (
            <rect
              key={p.day}
              x={Math.max(0, x(i) - slotW / 2)}
              y={0}
              width={slotW}
              height={H}
              fill="transparent"
              className="hover:fill-(--primary-tint)"
            >
              <title>{`${formatEtDateShort(p.day, locale)} · ${p.views} görüntüleme · ${p.visitors} tekil ziyaretçi`}</title>
            </rect>
          ))}
        </svg>
      </div>

      {/* Tarih ekseni HTML'de: üç etiket. Otuz günün hepsini yazmak
          okunmayan bir duvar üretiyor. */}
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted">
        <span>{formatEtDateShort(points[0].day, locale)}</span>
        <span>{formatEtDateShort(points[midIndex].day, locale)}</span>
        <span>{formatEtDateShort(last.day, locale)}</span>
      </div>

      {/* Tablo görünümü — grafiğin okunamadığı her durumda aynı sayılar. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] text-muted hover:text-body">
          Sayıları Tablo Olarak Gör
        </summary>
        <div className="scroll-x mt-2 max-h-64 overflow-auto">
          <table className="w-full text-[12.5px]">
            <caption className="sr-only">
              Gün gün görüntüleme ve tekil ziyaretçi
            </caption>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.05em] text-muted">
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
                  <td className="py-1 text-right tabular-nums text-strong">
                    {p.views.toLocaleString("tr-TR")}
                  </td>
                  <td className="py-1 text-right tabular-nums text-body">
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
