import styles from "../stock.module.css";
import { DataError, EmptyState } from "@/components/ui/primitives";
import { PriceRail, type RailMark } from "@/components/ui/PriceRail";
import { getStatus, getSymbolNames } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getChartBars, getQuote } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { cn, directionOf, directionText, formatPercent, formatPrice, NO_VALUE, hareketliOrtalama } from "@/lib/utils";
import { week52Band } from "./shared";

/**
 * Hareketli ortalamalar — 50, 100 ve 200 günlük.
 *
 * NE SÖYLER: fiyatın kendi son elli/yüz/iki yüz günlük ortalamasına göre
 * nerede durduğu. Teknik analizin en yaygın üç penceresi; sitenin geri
 * kalanı gibi burada da bir tavsiye yok, yalnızca hesaplanmış bir ölçü.
 *
 * VERİ: `getChartBars(symbol, "1Y")` — 254 günlük bar (ölçüldü), 200'lük
 * pencere oradan doluyor. "5Y" KULLANILMIYOR: o aralık topluşturulmuş
 * (5 yıl için yalnızca 262 bar) ve barları günlük değil.
 *
 * FİYAT KOTASYONDAN, son bardan değil. Sayfa başlığı, grafik okuması ve bu
 * panel aynı sayıyı yazsın diye — aynı gerekçe grafik künyesinde de yazılı;
 * son barın kapanışı ile son işlem tanımı gereği farklı sayılar.
 *
 * PENCERE DOLMAZSA SATIR "—". Yeni halka arz olmuş bir şirkette 200 günlük
 * geçmiş yok ve yarım pencereden "200 günlük ortalama" üretmek uydurma
 * kesinlik olurdu (bkz. lib/utils.ts → `hareketliOrtalama`).
 */
export async function MovingAverages({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [barsResult, quoteResult, metricsResult, meta] = await Promise.all([
    getChartBars(symbol, "1Y", status),
    getQuote(symbol, status),
    /* 52 hafta bandı buradan — Anahtar Metrikler aynı ucu aynı parametreyle
       çağırıyor, `finnhubFetch` altı saat önbellekli: yeni tur yok. */
    getKeyMetrics(symbol),
    getSymbolNames([symbol]),
  ]);

  if (!barsResult.ok) return <DataError message={t.data.failed} />;

  const closes = barsResult.data.map((bar) => bar.close);
  const quote = quoteResult.ok ? quoteResult.data : null;
  const price = quote?.price ?? null;

  const pencereler = [50, 100, 200] as const;
  const satirlar = pencereler.map((pencere) => ({
    pencere,
    deger: hareketliOrtalama(closes, pencere),
  }));

  /* Hiçbiri hesaplanamadıysa panel boş bir liste basmıyor: sebebi tek
     satırda söyleniyor. */
  if (satirlar.every((s) => s.deger === null)) {
    return (
      <EmptyState
        compact
        title={t.stock.movingAveragesShort.replace(
          "{n}",
          String(closes.length),
        )}
      />
    );
  }

  /* TEK CETVEL (24 Eylül). Ortalamalar ±en büyük sapma üzerine SİMETRİK
     izlerde çiziliyordu — NVDA'nın üç ortalaması da artıdaydı ve her izin
     sol yarısı daima boştu. Artık ortalamalar ve canlı fiyat tek eksende
     (`PriceRail`); zeminde 52 haftalık bant gölge olarak duruyor ki
     ortalamaların yılın neresine düştüğü görünsün. Bandın uçları ETİKETSİZ:
     sayılar profil kartındaki 52 hafta satırında yazılı, burada tekrar
     edilmiyor. Bant yoksa (ADR, BRK.B) cetvel yalnızca ortalamaları taşır. */
  const m = metricsResult.ok ? metricsResult.data : null;
  const band = week52Band(m, price, meta[symbol]?.currency ?? null);

  const marks: RailMark[] = [];
  if (band?.onRail) {
    marks.push({ kind: "band", from: band.low, to: band.high, tone: "range" });
  }
  satirlar.forEach(({ pencere, deger }, index) => {
    if (deger === null) return;
    marks.push({
      kind: "tick",
      at: deger,
      tone: price !== null ? (price >= deger ? "up" : "down") : "flat",
      label: t.stock.movingAverageShort.replace("{n}", String(pencere)),
      /* Üst, alt, üst: yakın duran ortalamaların etiketleri ayrı satırlara
         düşüyor (NVDA'da 50G ile 100G arası 3,74 $). */
      side: index % 2 === 0 ? "above" : "below",
    });
  });
  if (price !== null) {
    marks.push({ kind: "point", at: price, variant: "live", value: formatPrice(price, locale), side: "below" });
  }

  return (
    /* ÜST DOLGU YOK. Başlığın kendi `py-4` alt dolgusu (16px) buradaki
       `py-3` (12) ve satırın `py-2` (8) ile üst üste biniyordu: başlık
       metniyle ilk ortalama arasında 36 piksel saf boşluk vardı ve kart
       üç satırlık içeriğe göre şişkin duruyordu. Başlık `pb-1.5`e indi,
       gövdenin üst dolgusu tümüyle kalktı; satırın kendi `py-2`si zaten
       nefes alacak kadar. Ölçüldü: kart 245 → 190 piksel. */
    <div className={styles.averagesBody}>
      <PriceRail marks={marks} className={styles.averagesRail} />
      {/* Çizim `aria-hidden`; her sayısı bu listede metin olarak da var. */}
      <dl className={styles.averageRows}>
        <div className={styles.averageRow}>
          <dt>{t.stock.currentQuote}</dt>
          <dd className="numeral text-sm font-semibold text-strong">
            {formatPrice(price, locale, { currency: true })}
          </dd>
        </div>
        {satirlar.map(({ pencere, deger }) => {
          /* Fark yalnızca İKİSİ de varken yazılıyor; ortalama yoksa fiyatla
             kıyaslanacak bir şey de yok. */
          const fark =
            deger !== null && price !== null && deger > 0
              ? ((price - deger) / deger) * 100
              : null;
          return (
            <div key={pencere} className={styles.averageRow}>
              <dt>{t.stock.movingAverageRow.replace("{n}", String(pencere))}</dt>
              <dd className="flex items-baseline gap-2.5">
                <span className="numeral text-sm text-body">
                  {deger !== null
                    ? formatPrice(deger, locale, { currency: true })
                    : NO_VALUE}
                </span>
                {fark !== null && (
                  <span
                    className={cn(
                      "numeral w-14 shrink-0 text-right text-tiny font-semibold",
                      directionText(directionOf(fark)),
                    )}
                  >
                    {formatPercent(fark, locale)}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className={styles.cardNote}>
        {t.stock.movingAveragesNote}
      </p>
    </div>
  );
}
