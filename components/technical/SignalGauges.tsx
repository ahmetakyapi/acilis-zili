import type { Locale } from "@/lib/i18n";
import { arcPoint, RSI_ZONES, rsiFraction, trendScale, volumeScale } from "@/lib/technical-visuals";
import { formatPrice } from "@/lib/utils";
import styles from "./SignalGauges.module.css";

/**
 * KAPAKTAKİ GÖSTERGE ÇİZİMLERİ (8 Kasım, sahibinin isteği: "çok daha görsel,
 * daha anlaşılabilir").
 *
 * Kapağın gösterge özeti üç kelimeydi ("Aşağı", "Aşırı Satım", "Yoğun") ve
 * kelimenin dayandığı sayı küçük künyede kalıyordu; okuyucu "aşırı satım"ın
 * ne kadar aşırı olduğunu, "yoğun"un ne kadar yoğun olduğunu göremiyordu.
 * Her kelimenin üstünde artık kendi ölçeği:
 *   · TREND — fiyat ile 50 ve 200 günlük ortalama AYNI eksende (ortalamalar
 *     çentik, fiyat koyu mürekkep nokta — merdivendeki imleçle aynı), fiyattan
 *     en yakın ortalamaya yön renginde şerit.
 *   · MOMENTUM — gerçek bir RSI yayı: 0–100, 30'un altı ve 70'in üstü
 *     göstergenin kendi bölgeleri (soluk yön tonu), değer yayın üstünde
 *     nokta ve ortada sayı.
 *   · HACİM — son seansın 20 günlük ortalamaya oranı bir şerit; ortalama
 *     (1×) çentik, oran sağda ("2,7×").
 * Sayıların hepsi fotoğraftan (`snapshot`) ve fiyattan; geometri saf
 * aritmetik (`lib/technical-visuals.ts`, testli). Çizimler `aria-hidden`:
 * kelime ve künye metinde, ekran okuyucu onları okuyor.
 *
 * GİRİŞ: şeritler soldan, yay baştan çizilir, nokta en son oturur — bir
 * kez, `--ease-brand`; hareketi azaltana son kare (CSS).
 */

const pct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

export function TrendGauge({
  price,
  sma50,
  sma200,
  labels,
}: {
  price: number | null;
  sma50: number | null;
  sma200: number | null;
  labels: { avg50: string; avg200: string };
}) {
  const scale = trendScale(price, sma50, sma200);
  if (!scale) return null;
  const marks = [
    { key: "50", at: scale.sma50, label: labels.avg50 },
    { key: "200", at: scale.sma200, label: labels.avg200 },
  ].filter((mark): mark is { key: string; at: number; label: string } => mark.at !== null);
  /* Şerit fiyattan EN YAKIN ortalamaya: "ortalamanın ne kadar altında/üstünde". */
  const nearest = marks.reduce((best, mark) => (Math.abs(mark.at - scale.price) < Math.abs(best.at - scale.price) ? mark : best));
  const from = Math.min(nearest.at, scale.price);
  const width = Math.abs(nearest.at - scale.price);
  return (
    <div className={styles.linear} aria-hidden>
      <span className={styles.lane} />
      <span
        className={styles.fill}
        data-tone={scale.price < nearest.at ? "down" : "up"}
        data-from={scale.price < nearest.at ? "end" : "start"}
        style={{ left: pct(from), width: pct(width) }}
      />
      {marks.map((mark) => {
        /* İki ortalama yakınsa etiketleri birbirinden UZAĞA yaslanıyor: "50G"
           çentiğin solunda, "200G" sağında — ortalı iki etiket üst üste
           biniyordu (eksen ~180 piksel, etiket ~26; %20'den yakın). */
        const other = marks.find((m) => m !== mark);
        const close = other !== undefined && Math.abs(other.at - mark.at) < 0.2;
        const align = close ? (mark.at < other.at || (mark.at === other.at && mark.key === "50") ? "end" : "start") : undefined;
        return (
          <span key={mark.key} className={styles.tick} data-align={align} style={{ left: pct(mark.at) }}>
            <small>{mark.label}</small>
          </span>
        );
      })}
      <span className={styles.dot} style={{ left: pct(scale.price) }} />
    </div>
  );
}

/* Yay geometrisi: viewBox 0 0 100 58, merkez (50, 52), yarıçap 42. */
const CX = 50;
const CY = 52;
const R = 42;

function arc(from: number, to: number): string {
  const a = arcPoint(from, CX, CY, R);
  const b = arcPoint(to, CX, CY, R);
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${R},${R} 0 0 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

export function RsiGauge({ rsi, tone, locale }: { rsi: number; tone: "up" | "down" | "flat"; locale: Locale }) {
  const value = rsiFraction(rsi);
  const point = arcPoint(value, CX, CY, R);
  const low = RSI_ZONES.oversold / 100;
  const high = RSI_ZONES.overbought / 100;
  return (
    <svg className={styles.rsi} viewBox="0 0 100 58" aria-hidden>
      <path className={styles.rsiLane} d={arc(0, 1)} />
      <path className={styles.rsiZone} data-zone="oversold" d={arc(0, low)} />
      <path className={styles.rsiZone} data-zone="overbought" d={arc(high, 1)} />
      {value > 0.005 && <path className={styles.rsiValue} data-tone={tone} d={arc(0, value)} pathLength={1} />}
      <circle className={styles.rsiDot} cx={point.x.toFixed(2)} cy={point.y.toFixed(2)} r={4.5} />
      <text className={styles.rsiText} x={CX} y={CY - 2} textAnchor="middle">
        {formatPrice(rsi, locale, { digits: 0 })}
      </text>
    </svg>
  );
}

export function VolumeGauge({ ratio, heavy, label, locale }: { ratio: number; heavy: boolean; label: string; locale: Locale }) {
  const { fill, average } = volumeScale(ratio);
  return (
    <div className={styles.volume} aria-hidden>
      <div className={styles.linear}>
        <span className={styles.lane} />
        <span className={styles.fill} data-tone={heavy ? "primary" : "flat"} data-from="start" style={{ left: 0, width: pct(fill) }} />
        <span className={styles.tick} style={{ left: pct(average) }}>
          <small>{label}</small>
        </span>
      </div>
      <b className="numeral">{formatPrice(ratio, locale, { digits: 1 })}×</b>
    </div>
  );
}
