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

/**
 * Sütun ızgarasının biçimi — İKİ ızgarada da birebir aynı olmak zorunda.
 *
 * Sütunlar ve altlarındaki dönem etiketleri ayrı iki `<ul>`: aradaki yatay
 * kural kesintisiz bir çizgi olmalı, sütun sütun bölünmüş parçalar değil.
 * Ama ayrı olmaları hizayı elle tutmayı gerektiriyordu ve tutulmamıştı —
 * sütun şeridinde sağ dolgu ve öngörü nefesi vardı, etiket şeridinde yoktu.
 * Tek sabit ikisini birden besliyor; biri değişirse öteki kendiliğinden
 * değişir.
 */
const GRID_SHAPE = "gap-1.5 pr-2 sm:gap-2 sm:pr-3";

/** Öngörü sütununun komşusundan aldığı nefes — margin değil dolgu, gerekçe altta. */
const PROJECTED_INSET = "pl-1.5 sm:pl-3";

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
        {/* Sağda iç dolgu: son sütun ÖNGÖRÜ sütunu ve etiketi sütundan geniş
            olduğu için ortalandığında sağa taşıyor. Dolgu o taşmayı yutuyor.
            Izgara çizgileri `inset-x-0` ile tam genişlikte kalıyor —
            onların kenara kadar gitmesi doğru. */}
        <ul
          className={cn("relative grid h-full items-end", GRID_SHAPE)}
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
                  "flex h-full flex-col justify-end",
                  /* Öngörü sütunu gerçekleşenlerden bir nefes uzakta durur:
                     kesikli çerçeve onu tür olarak ayırıyor ama komşusuna
                     bitişikken aynı serinin devamı gibi okunuyordu.

                     Nefes MARGIN değil DOLGU: margin `mx-auto`nun sol yarısını
                     eziyor ve sütunu hücrede ortalanmaktan çıkarıyordu.
                     Dolgu, hücrenin içini daraltıyor; içerideki kutu yine
                     ortalanıyor ve alttaki dönem etiketi aynı dolguyu alarak
                     birebir aynı yere düşüyor. */
                  bar.projected && PROJECTED_INSET,
                )}
              >
                {/* Sütunun kendi kutusu. Alttaki dönem etiketi de AYNI
                    ölçülerde bir kutuya giriyor (`mx-auto` + aynı üst sınır),
                    böylece hizalama iki ızgarada da yapısal olarak garanti —
                    elle verilen bir kaydırmaya bağlı değil. */}
                <div
                  className="mx-auto flex w-full flex-col justify-end gap-1.5"
                  style={{ maxWidth: MAX_BAR_WIDTH }}
                >
                  {/* Etiket sütundan GENİŞ olabiliyor: öngörü sütununda tek
                      sayı değil bir aralık yazıyor ("18,0–18,2") ve sütun
                      390px'te ~50px kalıyor.

                      Bir dönem bu yüzden ilk sütun sola, son sütun sağa
                      ÇAPALANIYORDU; son sütunda üstüne elle bir kaydırma da
                      ekleniyordu. Sonuç, tam olarak kaçınılmak istenen şeydi:
                      öngörü etiketi kendi sütununun ortasında durmuyordu.

                      Artık istisnasız hepsi ortalı. Taşma iki yana simetrik
                      dağılıyor ve komşu sütunun ÜSTÜNDEKİ boş alana giriyor;
                      son sütunda şeridin sağ dolgusu, ilk sütunda panelin
                      kendi dolgusu onu yutuyor. */}
                  <div className="relative h-[18px] w-full">
                    <p
                      className={cn(
                        /* Mutlak konum: kutu akışta kaldığı sürece sütun
                           genişliğine sıkışıyor ve nowrap metin taşıp
                           ızgarayı bozuyordu. Sabit yükseklik sütun
                           hizasını koruyor. */
                        "numeral absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-[13px] font-bold",
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
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Dönem etiketleri sütunlarla AYNI ızgara geometrisini taşır: aynı
          sütun sayısı, aynı boşluk, aynı sağ dolgu, öngörü sütununda aynı
          iç dolgu ve içeride aynı üst sınırlı kutu. Bir dönem bu ızgarada
          sağ dolgu ve öngörü nefesi yoktu; alttaki "1Ç FY27Ö" ile üstündeki
          sütun birbirinden kayıyordu. İkisi tek bir sabitten besleniyor
          (GRID_SHAPE) ki biri değişip öteki unutulmasın. */}
      <ul
        className={cn("grid border-t border-line pt-2", GRID_SHAPE)}
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, index) => (
          <li
            key={`${bar.label}-label-${index}`}
            className={cn(bar.projected && PROJECTED_INSET)}
          >
            {/* KESİLMİYOR, SARIYOR. Telefonda hücre ~41px kalıyor ve
                "1Ç FY27Ö" 11,5 puntoda ~52px: `truncate` onu "1Ç FY…"
                yapıyordu, yani grafiğin okunması için gereken tek bilgiyi —
                hangi çeyrek — siliyordu. Etiketler boşluktan doğal olarak
                iki satıra iniyor ("1Ç" / "FY27Ö") ve altı sütunda da aynı
                davrandığı için şerit hizalı kalıyor.

                Sütun kutusunun üst sınırı buraya UYGULANMIYOR: hizayı
                değiştirmiyor (ikisi de aynı hücrede ortalı) ama etiketi
                gereksiz yere daha da daraltırdı. */}
            <span
              className={cn(
                "block text-center text-[11.5px] font-semibold leading-[1.25]",
                bar.projected ? "text-primary" : "text-muted",
              )}
            >
              {bar.label}
            </span>
          </li>
        ))}
      </ul>

      <ChartFooter stats={footer} locale={locale} />
    </section>
  );
}
