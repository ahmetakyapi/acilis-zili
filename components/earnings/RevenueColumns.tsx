import { ChartFooter, type FooterStat } from "@/components/earnings/ChartFooter";
import { cn } from "@/lib/utils";

/**
 * Çeyreklik gelir sütun grafiği — sunucuda çizilir, istemci JS'i yok.
 *
 * Tek seri, tek soru: "gelir hangi hızla büyüyor?" Sütunlar soldan sağa
 * koyulaşıyor (`--share-4` → `--share-1`): renk basamağı zamanı taşıyor, en
 * yeni çeyrek en koyu. Öngörü sütunu KESİKLİ çerçeveli ve içi boş — henüz
 * gerçekleşmemiş bir sayının dolu bir sütunla aynı ağırlıkta durması, o
 * sayıyı ölçülmüş gibi gösteriyordu.
 *
 * BİRİM BAŞLIKTA, sütunlarda değil. Her sütunun üstünde "1,9 Mr $" yazınca
 * altı çeyrekte altı kez aynı iki kelime tekrar ediyor ve sayının kendisi
 * kayboluyordu; başlıkta bir kez söyleyip sütunlarda çıplak sayı bırakmak
 * hem daha sessiz hem daha okunur.
 *
 * `note` YALNIZCA öngörü sütununda basılır — orada tek bir sayı değil bir
 * aralık ("10,3–10,8") gösterilmesi gerekiyor. Gerçekleşen sütunlarda not
 * yok sayılır: birkaç kayıtta ajan oraya yıllık değişimi yazmıştı ("▲ %5")
 * ve grafik gelirin kendisini hiç göstermeden beş kez değişim oranı basıyordu.
 * Değişim oranının yeri kartın altındaki künye (`ChartFooter`).
 *
 * Sayılar mono DEĞİL, tabular Archivo (`.numeral`): mono `.figure` metrik
 * kartlarına ait — grafikteki etiketler orada bir tablo satırı gibi değil,
 * çizimin parçası gibi durmalı.
 *
 * Arkadaki yatay ızgara çizgileri sütun yüksekliklerini kıyaslanabilir
 * kılıyor: çizgisiz bir grupta "bu ötekinin iki katı mı" sorusu gözle
 * cevaplanmıyordu.
 *
 * Etiketler SVG dışında, HTML olarak basılıyor: SVG `<text>` font yüklenene
 * kadar ölçüsüz kalıyor ve sütunun üstünde kayıyor (skor halkasındaki
 * sayının HTML olmasıyla aynı gerekçe).
 */

export type RevenueBar = {
  label: string;
  value: number;
  projected?: boolean | null;
  /** Öngörü sütununun üstünde yazan ARALIK metni ("10,3–10,8"); gerçekleşen
      sütunlarda yok sayılır, orada her zaman değerin kendisi yazılır. */
  note?: string | null;
};

/** Sütun renkleri, en eskiden en yeniye — beşten fazlası en koyuda kalır. */
const SHADES = [
  "var(--share-4)",
  "var(--share-4)",
  "var(--share-3)",
  "var(--share-2)",
  "var(--share-1)",
] as const;

const CHART_HEIGHT = 208;
/** Izgara çizgisi oranları; taban çizgisini alttaki hairline zaten veriyor. */
const GRID = [1, 0.75, 0.5, 0.25];
/**
 * Sütun genişliğinin ÜST sınırı.
 *
 * Sütunlar hücrenin tamamını kaplıyordu: 600 piksellik bir kartta altı
 * çeyrek demek 90 piksel eninde, 150 piksel boyunda sütunlar demek — grafik
 * tombul duruyor ve yükseklik farkları eziliyordu. Sınır konunca sütun dar
 * kalıyor, artan yer boşluğa gidiyor ve oran karnedekine dönüyor. Dar
 * ekranda hücre bu sınırın altına düştüğünde sınır kendiliğinden devre
 * dışı kalır (`max-width`), sütun hücreyi doldurur.
 */
const MAX_BAR_WIDTH = 62;

export function RevenueColumns({
  bars,
  title,
  legendActual,
  legendProjected,
  format,
  footer = [],
  locale,
  className,
}: {
  bars: RevenueBar[];
  /** Birimi de taşır: "Çeyreklik Gelir (milyar $)". */
  title: string;
  legendActual: string;
  legendProjected: string;
  /** Sütun üstündeki ÇIPLAK sayı — birim başlıkta, burada değil. */
  format: (value: number) => string;
  footer?: FooterStat[];
  /** ChartFooter'a geçer — not satırının Title Case'i dile bağlı. */
  locale: string;
  className?: string;
}) {
  if (bars.length === 0) return null;

  const max = Math.max(...bars.map((bar) => bar.value));
  if (!Number.isFinite(max) || max <= 0) return null;

  const actualCount = bars.filter((bar) => !bar.projected).length;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-[16px] border border-line bg-surface-solid p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 className="text-[14.5px] font-bold text-strong">{title}</h2>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ background: "var(--share-1)" }}
            />
            {legendActual}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-[2px] border border-dashed border-primary"
            />
            {legendProjected}
          </span>
        </div>
      </div>

      <div className="relative" style={{ height: CHART_HEIGHT + 22 }}>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0"
          style={{ height: CHART_HEIGHT }}
        >
          {GRID.map((ratio) => (
            <span
              key={ratio}
              className="absolute inset-x-0 border-t border-line-soft"
              style={{ bottom: `${ratio * 100}%` }}
            />
          ))}
        </div>

        {/* Sütunlar CSS ızgarasıyla: SVG'de sabit genişlik varsayımı yapmadan
            her sütun eşit pay alıyor ve dar ekranda kendiliğinden daralıyor.
            Dar boşluk = kalın sütun; karnedeki oran. */}
        {/* Sağda iç dolgu: son sütun ÖNGÖRÜ sütunu ve etiketi ("2,06-2,09
            Mr $") sütundan geniş olduğu için sağa yaslanınca panelin
            kenarına yapışıyor, köşeye sıkışmış gibi duruyordu. Dolgu bütün
            şeridi bir tık içeri alıyor. Izgara çizgileri `inset-x-0` ile
            tam genişlikte kalıyor — onların kenara kadar gitmesi doğru. */}
        <ul
          className="relative grid h-full items-end gap-1.5 pr-2 sm:gap-2 sm:pr-3"
          style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
        >
          {bars.map((bar, index) => {
            const ratio = Math.max(0.02, bar.value / max);
            const shade =
              SHADES[
                Math.min(SHADES.length - 1, SHADES.length - actualCount + index)
              ] ?? SHADES[SHADES.length - 1];
            return (
              <li
                key={`${bar.label}-${index}`}
                className={cn(
                  "mx-auto flex h-full w-full flex-col justify-end gap-1.5",
                  /* Öngörü sütunu gerçekleşenlerden bir nefes uzakta durur:
                     kesikli çerçeve onu tür olarak ayırıyor ama komşusuna
                     bitişikken aynı serinin devamı gibi okunuyordu. */
                  bar.projected && "ml-1.5 sm:ml-3",
                )}
                style={{ maxWidth: MAX_BAR_WIDTH }}
              >
                {/* Etiket sütundan GENİŞ olabiliyor: öngörü sütununda bir
                    aralık yazıyor ("10,3-10,8 Mr $") ve sütun 390px'te ~50px.
                    `text-right` tek başına yetmedi — kutu sütun genişliğinde
                    kaldığı için nowrap metin kutudan taşıyor ve telefonda
                    panelin sağ kenarını aşıp ekranın dışına çıkıyordu.

                    `w-max` kutuyu metnin kendi genişliğine getiriyor,
                    `ml-auto` onu sütunun sağ kenarına yaslıyor: fazlalık
                    artık dışarı değil, İÇERİ — komşu sütunun üstündeki boş
                    alana doğru taşıyor. İlk sütunda ayna simetriği. */}
                <div className="relative h-[18px] w-full">
                  <p
                    className={cn(
                      /* MUTLAK konum, akış değil. Kutu akışta kaldığı sürece
                         sütun genişliğine sıkışıyor ve nowrap metin sağa
                         taşıyordu; `ml-auto` da işe yaramaz çünkü otomatik
                         margin negatif olamıyor. Mutlak konumda kutu sütunun
                         SAĞ KENARINA çapalanıyor ve fazlalık sola, komşu
                         sütunun üstündeki boş alana akıyor. Sabit yükseklik
                         sütun hizasını koruyor. */
                      "numeral absolute bottom-0 whitespace-nowrap text-[13px] font-bold",
                      /* Son sütunun etiketi sağ kenara ÇAPALI ama iki
                         piksel dışarı taşıyor: öngörü etiketi ("2,06-2,09")
                         sütundan geniş olduğu için tam çapalandığında sola,
                         komşu sütunun üstüne doğru kayık duruyor ve kendi
                         sütununun ortasından belirgin biçimde sola düşüyordu.
                         Negatif kaydırma onu kendi sütununa geri getiriyor;
                         panelin sağ dolgusu (pr-2/pr-3) taşmayı yutuyor. */
                      index === 0
                        ? "left-0"
                        : index === bars.length - 1
                          ? "right-0 translate-x-1.5 sm:translate-x-2.5"
                          : "left-1/2 -translate-x-1/2",
                      bar.projected ? "text-primary" : "text-strong",
                    )}
                  >
                    {bar.projected
                      ? (bar.note ?? format(bar.value))
                      : format(bar.value)}
                  </p>
                </div>
                <div
                  className={cn(
                    "w-full rounded-t-[3px]",
                    bar.projected &&
                      "border border-dashed border-primary bg-primary-tint",
                  )}
                  style={{
                    height: Math.round(ratio * CHART_HEIGHT),
                    ...(bar.projected ? {} : { background: shade }),
                  }}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <ul
        className="grid gap-1.5 border-t border-line pt-2 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, index) => (
          <li
            key={`${bar.label}-label-${index}`}
            className={cn(
              "truncate text-center text-[11.5px] font-semibold",
              bar.projected ? "text-primary" : "text-muted",
            )}
          >
            {bar.label}
          </li>
        ))}
      </ul>

      <ChartFooter stats={footer} locale={locale} />
    </section>
  );
}
