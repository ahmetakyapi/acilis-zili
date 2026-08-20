import { LogoTile } from "@/components/ui/primitives";
import { cn, directionOf, directionText, formatPercent } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";

/* --------------------------------------------------------------------------
   Olay eğrisi — mercek yazısının görseli.

   NEDEN BU. Bu yazıların fotoğrafı yok ve olmayacak (CLAUDE.md: telif riski
   ve dekoratif bir görsel finans metnine hiçbir şey katmıyor). Telifi bizde
   olan iki gerçek malzeme var: şirket logoları ve o şirketin fiyat serisi.
   Arşiv kartları logoyu ve tek bir rakamı kullanıyor; burada eksik olanı,
   yani eğrinin kendisini çiziyoruz.

   ÇİZGİ OLAYDA RENK DEĞİŞTİRİYOR — işaret bu. İlk tasarımda eğri olay
   gününde BAŞLIYORDU ve ana sayfadaki manşet çoğu zaman DÜNKÜ olayı
   anlattığı için elde tek bar kalıyordu: kutu ya hiç çizilmiyor ya da düz
   gri bir çizgi olarak duruyordu. Şimdi pencere olaydan öncesini de
   kapsıyor — solda sessiz gri bir "önce", olay gününde bir nokta, oradan
   sağa yön rengiyle "sonra" — ve renk olayın kendi gününden BİR ÖNCEKİ
   kapanışta başlıyor, yani renkli bölüm olayın hareketini de içeriyor.
   Okuyucu tek bakışta hem olayın nereye düştüğünü hem ne yaptığını
   görüyor; uzun metnin tezinin resmi bu.

   Olay penceresi aşarsa (yazı üç aydan eski bir olayı anlatıyorsa) eğri yine
   olay gününde başlıyor; o zaman "önce" bölümü hiç yok ve gerek de yok.

   SUNUCUDA ÇİZİLİYOR. İstemci JS'i yok: birkaç düzine noktalık bir seri için
   satır içi SVG hem daha hafif hem ilk boyada hazır. `preserveAspectRatio`
   varsayılanda bırakıldı — `none` kullanılsaydı olay noktası genişliğe göre
   elipse dönerdi.
   -------------------------------------------------------------------------- */

/** Çizim alanı. Kap ne kadar genişse SVG oranını koruyarak ölçekleniyor. */
const VIEW_W = 320;
const VIEW_H = 96;
/* Nokta sağ uca düştüğünde (olay dünse) kenara yapışmasın. */
const PAD_X = 9;
const PAD_TOP = 10;
/** Eğrinin en düşük noktası ile taban çizgisi arasındaki nefes. */
const PAD_BOTTOM = 14;
const BASELINE_Y = VIEW_H - 3;
/** Alan dolgusu — Sparkline ile aynı ağırlık, çizgiyi bastırmıyor. */
const AREA_OPACITY = 0.09;
/** Eğrinin okunabilmesi için gereken en az kapanış sayısı. */
export const MIN_CURVE_POINTS = 10;
/**
 * Olaydan ÖNCE gösterilen en fazla işlem günü — kabaca bir ay.
 *
 * Bağlam olmadan tek başına bir kıvrım bir şey söylemiyor: "olaydan sonra
 * düştü" ancak "öncesinde neredeydi" bilinince bir cümle oluyor.
 *
 * ÜÇ AY DENENDİ VE UZUNDU: yazı dünkü olayı anlattığında renkli bölüm 66
 * günün son 1/66'sı kalıyor, yani gözle seçilmiyordu — ekranda üç aylık gri
 * bir kıvrım ve ucunda görünmeyen bir işaret duruyordu. Bir ay, hem "son
 * durum" için yeterli hem de tek günü görünür bırakıyor. Olay bir aydan
 * eskiyse pencere zaten olay gününde başlıyor ve bu sınır devreye girmiyor.
 */
const CONTEXT_BARS = 22;
/**
 * Olayın barlarla eşleşmesi için tanınan boşluk.
 *
 * Olay gününden sonraki İLK işlem günü taban sayılıyor; hafta sonu ve tatil
 * payı buradan geliyor. Boşluk bundan büyükse seri olayın gününe hiç
 * uzanmıyor demektir ve hiçbir şey döndürülmüyor — uydurulmuş bir taban
 * üzerinden yüzde üretmektense boş bırakmak doğru.
 */
const MAX_EVENT_GAP_SECONDS = 10 * 86400;

export type CurvePoint = { close: number };

export type EventCurve = {
  points: CurvePoint[];
  /** Olay gününün `points` içindeki sırası; 0 ise "önce" bölümü yok. */
  eventIndex: number;
  /** Pencerenin ilk gününün takvim tarihi (YYYY-MM-DD). */
  startDate: string | null;
  /** Pencerenin son gününün takvim tarihi (YYYY-MM-DD). */
  endDate: string | null;
  /** Olaydan bugüne getiri; olay son bar ise (yazı taze) null. */
  sinceEvent: number | null;
  /**
   * Olay GÜNÜNÜN kendi değişimi — bir önceki kapanışa göre.
   *
   * Ana sayfadaki manşet çoğu zaman dünkü olayı anlatıyor ve o durumda
   * "olaydan bugüne" diye bir aralık yok: elde tek bar var. Anlatılmaya
   * değer sayı o günün kendi hareketi ("Moderna %177 yükseldi") ve zaten
   * yazının konusu da o.
   */
  eventChange: number | null;
};

const EMPTY: EventCurve = {
  points: [],
  eventIndex: 0,
  startDate: null,
  endDate: null,
  sinceEvent: null,
  eventChange: null,
};

/**
 * Günlük barlardan olayı ortalayan pencerenin çıkarılması.
 *
 * KURAL TEK YERDE: hem bu eğri hem /mercek arşivindeki "olaydan bugüne"
 * rakamı buradan geçiyor. İkisi ayrı yazılıyken aralarında sessiz bir fark
 * vardı — arşivdeki sürüm, olay çekilen barlardan (bir yıl) daha eskiyse
 * serinin en eski barını taban alıyor ve çıkan sayıyı yine "olaydan bugüne"
 * diye yazıyordu.
 */
export function curveFromEvent(
  bars: readonly { time: number; close: number }[] | undefined,
  eventDate: string,
): EventCurve {
  if (!bars || bars.length < 2) return EMPTY;

  const eventTs = Date.parse(`${eventDate}T00:00:00Z`) / 1000;
  if (!Number.isFinite(eventTs)) return EMPTY;

  const eventAt = bars.findIndex((bar) => bar.time >= eventTs);
  if (eventAt < 0) return EMPTY;
  if (bars[eventAt].time - eventTs > MAX_EVENT_GAP_SECONDS) return EMPTY;

  const start = Math.min(eventAt, Math.max(0, bars.length - CONTEXT_BARS));
  const window = bars.slice(start);
  const base = bars[eventAt];
  const last = bars[bars.length - 1];

  const prev = eventAt > 0 ? bars[eventAt - 1] : null;
  /* Günlük barlar 04:00Z damgalı, yani New York'ta gece yarısı — ISO'nun ilk
     on karakteri barın takvim gününü doğru veriyor. */
  const dayOf = (bar: { time: number }) =>
    new Date(bar.time * 1000).toISOString().slice(0, 10);

  return {
    points: window.map((bar) => ({ close: bar.close })),
    eventIndex: eventAt - start,
    startDate: dayOf(window[0]),
    endDate: dayOf(last),
    sinceEvent:
      base.close > 0 && base.time !== last.time
        ? ((last.close - base.close) / base.close) * 100
        : null,
    eventChange:
      prev && prev.close > 0
        ? ((base.close - prev.close) / prev.close) * 100
        : null,
  };
}

export function StoryCurve({
  symbol,
  name,
  logoUrl,
  points,
  eventIndex,
  sinceEvent,
  eventChange,
  startLabel,
  endLabel,
  sinceLabel,
  eventDayLabel,
  eventDateLabel,
  locale,
  className,
}: {
  symbol: string;
  name?: string | null;
  logoUrl?: string | null;
  points: CurvePoint[];
  eventIndex: number;
  sinceEvent: number | null;
  eventChange: number | null;
  /** Eğrinin sol ucu — pencerenin başladığı gün, "8 Tem". */
  startLabel: string;
  /** Eğrinin sağ ucu — SON KAPANIŞIN günü. "bugün" yazılmıyor: açılış
      öncesinde son günlük bar dünküdür ve o etiket bir gün fazla taze
      görünüyordu. */
  endLabel: string;
  /** "olaydan bugüne" — aralık varken. */
  sinceLabel: string;
  /** "olay günü" — yazı taze, aralık henüz yokken. */
  eventDayLabel: string;
  /** Yalnızca ekran okuyucu için: noktanın hangi güne düştüğü. */
  eventDateLabel: string;
  locale: Locale;
  className?: string;
}) {
  if (points.length < MIN_CURVE_POINTS) return null;

  /* HANGİ SAYI YAZILIYOR. Olaydan sonra kapanmış seans varsa "olaydan
     bugüne"; yoksa olayın kendi günü. İkisi de gerçek, künye hangisi
     olduğunu söylüyor. */
  const value = sinceEvent ?? eventChange;
  const valueLabel = sinceEvent !== null ? sinceLabel : eventDayLabel;
  const tone = directionOf(value);
  const stroke =
    tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--flat)";

  const values = points.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const innerW = VIEW_W - PAD_X * 2;
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  const coords = values.map((close, index) => {
    const x = PAD_X + (index / (values.length - 1)) * innerW;
    const y = PAD_TOP + innerH - ((close - min) / span) * innerH;
    return [x, y] as const;
  });

  const at = Math.min(Math.max(eventIndex, 0), coords.length - 1);
  /* Renk OLAYIN GÜNÜNDEN BİR ÖNCEKİ kapanışta başlıyor: renkli bölüm böylece
     olayın kendi hareketini de kapsıyor. Olay son bar olduğunda (yazı taze)
     tek renkli çizgi kalıyordu, yani eğri hiçbir şey söylemiyordu. */
  const colorFrom = Math.max(0, at - 1);
  const path = (from: number, to: number) =>
    coords
      .slice(from, to)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

  /* "Sonra" bölümü olay noktasından BAŞLIYOR (`at`, `at + 1` değil): iki
     parça aynı noktayı paylaşmazsa çizgide bir piksellik boşluk kalıyor. */
  const before = colorFrom > 0 ? path(0, colorFrom + 1) : "";
  const after = path(colorFrom, coords.length);
  const [eventX, eventY] = coords[at];
  const [colorX] = coords[colorFrom];
  const areaAfter = `${colorX.toFixed(1)},${BASELINE_Y} ${after} ${(PAD_X + innerW).toFixed(1)},${BASELINE_Y}`;
  /* ALAN DOLGUSU YALNIZCA RENKLİ BÖLÜM GENİŞSE. Yazı dünkü olayı
     anlattığında renkli kısım iki bardan ibaret ve dolgu, eğrinin sağ ucunda
     dar dikey bir blok olarak çıkıyor: bir bölgeyi "işaretlenmiş" gibi
     gösteriyor, oysa anlatılan tek bir günün hareketi. O durumda çizgi ve
     nokta zaten yetiyor. */
  const areaShown = (coords.length - 1 - colorFrom) / (coords.length - 1) > 0.2;

  /* Ekran okuyucu eğriyi göremez; cümle onun yerine geçiyor. */
  const alt =
    value !== null
      ? `${symbol} · ${eventDateLabel} · ${valueLabel} ${formatPercent(value, locale)}`
      : `${symbol} · ${startLabel} → ${endLabel}`;

  return (
    <figure
      className={cn(
        /* Kendi yüzeyi var ama gölgesi yok: derinlik ton farkıyla kuruluyor
           (CLAUDE.md). Kenarlık accent'in en soluk hâli — kutu, üstünde
           durduğu degrade panelden bir kademe öne çıkıyor. */
        "flex flex-col gap-3 overflow-hidden rounded-xl border border-primary-faint bg-surface-solid p-3.5",
        className,
      )}
    >
      {/* Kim ve ne kadar — eğriden ÖNCE, çünkü kimin eğrisi olduğu
          bilinmeden şekli bir şey anlatmıyor. */}
      <figcaption className="flex items-center gap-2.5">
        <LogoTile symbol={symbol} logoUrl={logoUrl} size="md" />
        <span className="min-w-0 flex-1">
          <span className="numeral block text-small font-bold leading-tight text-strong">
            {symbol}
          </span>
          {name && (
            <span className="block truncate text-nano leading-tight text-muted">
              {name}
            </span>
          )}
        </span>
        {value !== null && (
          <span className="shrink-0 text-right">
            <span
              className={cn(
                "numeral block text-lead font-bold leading-none tracking-[-0.02em]",
                directionText(tone),
              )}
            >
              {formatPercent(value, locale)}
            </span>
            <span className="mt-1 block text-micro uppercase tracking-[0.07em] text-muted">
              {valueLabel}
            </span>
          </span>
        )}
      </figcaption>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={alt}
        className="h-auto w-full"
      >
        <title>{alt}</title>
        {/* Alan dolgusu YALNIZCA olaydan sonra: "önce" bölümü bağlam,
            okunacak bölge değil. */}
        {areaShown && (
          <polygon points={areaAfter} fill={stroke} opacity={AREA_OPACITY} />
        )}
        <line
          x1={PAD_X}
          y1={BASELINE_Y}
          x2={PAD_X + innerW}
          y2={BASELINE_Y}
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {before && (
          <polyline
            points={before}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* Olay gününden tabana inen kesikli iz: nokta tek başına serinin
            bir tepesi gibi okunuyordu, bu onu bir ANA çeviriyor. */}
        <line
          x1={eventX}
          y1={eventY}
          x2={eventX}
          y2={BASELINE_Y}
          stroke={stroke}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.45"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={after}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Tek nokta, olay gününde. Sağ uca da kondu ve kaldırıldı:
            "bugün" etiketi o işi zaten yapıyor ve iki nokta eğriyi bir
            ölçüm aletine çeviriyordu. */}
        <circle
          cx={eventX}
          cy={eventY}
          r="3.5"
          fill={stroke}
          stroke="var(--surface-solid)"
          strokeWidth="2"
        />
      </svg>

      {/* Eksenin iki ucu. Sağ uç tarih değil KELİME: bu eğrinin aralığı
          okuyucunun seçebileceği bir şey değil, yazının kendisi tarafından
          belirlenmiş. */}
      <div className="numeral -mt-1 flex items-baseline justify-between text-micro text-muted">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </figure>
  );
}
