import { Fragment } from "react";
import { cn, tieCurrency, tieFigures, titleCaseLabel } from "@/lib/utils";
import styles from "@/components/earnings/EarningsReport.module.css";

/**
 * Altı metrik kartı — karnedeki 3×2 ızgaranın sayfa karşılığı.
 *
 * Eskiden sağ kolonda etiket–değer listesiydi ve sayfanın en önemli
 * rakamları, yanındaki dokuz paragraflık metnin gölgesinde kalıyordu.
 * Kart olarak ve ana kolonda: değer 21px, altında renkli tek satır bağlam.
 * Rakamı gören okuyucu metne inmek zorunda değil.
 *
 * Etiket de değer de SERBEST METİN, çünkü hangi ölçünün öne çıkacağı
 * şirkete göre değişiyor: bankada net faiz marjı, bellek üreticisinde brüt
 * marj. Site biçimlendirmiyor, analiz yazarken karar veriliyor.
 *
 * TEK istisna alttaki bağlam satırı: onun yazımı kayıttan kayda değişiyordu
 * ("▲ %372 yıllık" ile "Rekor · Öngörü %79-81 idi" yan yana) ve aynı ızgarada
 * iki ayrı imla duruyordu. `titleCaseLabel` onu Türkçe doğru biçimde
 * eşitliyor; sayı, işaret ve kısaltmalara dokunmuyor.
 */

export type Metric = {
  label: string;
  value: string;
  note?: string | null;
  tone?: string | null;
};

export function MetricCards({
  metrics,
  locale,
  className,
}: {
  metrics: Metric[];
  /** Büyük harf dönüşümü dile bağlı: Türkçede i → İ. */
  locale: string;
  className?: string;
}) {
  if (metrics.length === 0) return null;
  return (
    <ul
      data-motion-stagger
      data-count={metrics.length}
      className={cn(
        styles.metricGrid,
        className,
      )}
    >
      {metrics.map((metric) => (
        <li
          key={metric.label}
          className={styles.metricItem}
        >
          {/* Kart `SpotlightCard` içindeydi: imleci izleyen radyal bir
              ışık ve üzerine gelince 4 piksel kalkış. Kart bağlantı değil;
              imleç altında kıpırdayan bağlantısız bir panel tıklanabilir
              gibi okunuyordu (tek hover dili `.panel-hover`, yalnızca
              bağlantıda). Derinlik tonla — düz kart. */}
          <div className={styles.metricCard}>
          <div className={styles.metricTop}>
          <p className={styles.metricLabel}>
            {tieFigures(metric.label)}
          </p>
          </div>
          {/* DEĞER BAĞLANMIYOR. "18,60 Mr $" dar kartta sığmıyor ve
              bölünmez yapılırsa `overflow-wrap:anywhere` onu rastgele bir
              yerden ("18,60 M" / "r $") kesiyor. Sarması gerekiyorsa
              birimin başından sarsın; künyede ise bağ doğru, orada satır
              zaten uzun ve tek başına kalan simge yazım hatası gibi
              okunuyor. */}
          <p className={cn(styles.metricValue, "figure")}>
            {tieCurrency(metric.value)}
          </p>
          {metric.note && (
            /* Bağlam satırı KIRILMAZ: "▲ Yıllık %372 · Beklenti Üstü" iki
               satıra düşünce kartlar farklı yükseklikte kalıyor ve ızgara
               tırtıklı görünüyordu. Sığmazsa kesilir. */
            <p className={cn(styles.metricNote, "text-small font-bold")}>
              <MetricNote note={metric.note} tone={metric.tone} locale={locale} />
            </p>
          )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ölçü kartının bağlam satırı — RENK YÖNÜ SÖYLER, YARGIYI DEĞİL.
 *
 * NEDEN (24 Eylül): satırın tamamı kaydın `tone` alanıyla boyanıyordu ve
 * `tone` bir YARGI: ADBE'nin "Kalan Edim Yükümlülüğü" kartında "▲ %8 ·
 * Gelirden Yavaş" KIRMIZI yazıyordu — yukarı oklu kırmızı bir sayı. Tema
 * yeşil ile kırmızıyı yalnızca yukarı ve aşağıya veriyor.
 *
 * Kural: oklu (▲ ▼ + −) parça işaretinin rengini alır. Kaydın yargısı okla
 * aynı yöndeyse satırın geri kalanı eskisi gibi o renkte ("▲ %13 Yıllık ·
 * Beklenti 6,69 Mr $" yeşil). Ters yöndeyse yargı cümlesi ("Gelirden
 * Yavaş") renksiz, nötr bir çipe iniyor: bilgi kalıyor, renk yalan
 * söylemiyor. Ok yoksa satır kaydın tonunda — orada renk ile işaret
 * çelişemiyor. Kapaktaki iki öncü ölçü de aynı bileşenden geçiyor.
 */
export function MetricNote({
  note,
  tone,
  locale,
  neutralClass = "text-primary",
}: {
  note: string;
  tone?: string | null;
  locale: string;
  /** Tonsuz satırın rengi: kartta `text-primary`, kapakta mürekkep tonu. */
  neutralClass?: string;
}) {
  const parts = titleCaseLabel(note, locale)
    .split(/\s+·\s+/)
    .map((part) => tieFigures(part.trim()))
    .filter(Boolean);
  const toneKey = tone === "up" || tone === "down" ? tone : null;
  const toneClass = toneKey === "up" ? "text-up" : toneKey === "down" ? "text-down" : neutralClass;
  const signedIndex = parts.findIndex((part) => /^[▲▼+−]/.test(part));
  if (signedIndex < 0) return <span className={toneClass}>{parts.join(" · ")}</span>;

  const sign = /^[▲+]/.test(parts[signedIndex]) ? "up" : "down";
  const conflict = toneKey !== null && toneKey !== sign;
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && !conflict && <span className={toneKey ? toneClass : neutralClass}> · </span>}
          {index > 0 && conflict && " "}
          {index === signedIndex ? (
            <span className={sign === "up" ? "text-up" : "text-down"}>{part}</span>
          ) : conflict ? (
            <span className="inline-block rounded-xs bg-surface-elevated px-1.5 font-semibold text-body">
              {part}
            </span>
          ) : (
            <span className={toneKey ? toneClass : neutralClass}>{part}</span>
          )}
        </Fragment>
      ))}
    </>
  );
}
