import styles from "@/components/calendar/CalendarExperience.module.css";
import { ImpactDots } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Önem hapı — yükselen çubuklar + düzeyin adı ("Yüksek", "Orta", "Düşük").
 *
 * NEDEN (6 Kasım, sahibinin ekran görüntüsü: "etki noktaları siyah ve
 * sıkışık"). Takvimin satırları önemi yalnızca üç noktayla söylüyordu;
 * düzey sayılarak okunuyordu ve renk (mürekkep koyuluğu) tek başına
 * taşıyamıyordu. Hap düzeyi üç yoldan söylüyor: çubuğun boyu, tonu ve adı.
 * Zemin de düzeyle koyulaşıyor (yüksek `--surface-sunken`, orta/düşük
 * zeminsiz) — satırlar arasında yüksek etkili olanlar göz gezdirirken
 * seçiliyor, ama kart zemini nötr kalıyor (görsel dil).
 *
 * Ad görünür metin; `ImpactDots`ın kendi `sr-only` adı burada çift
 * okunmasın diye çubuklar `aria-hidden` bir kabın içinde.
 */
export function ImpactTag({
  importance,
  label,
  className,
}: {
  importance: string;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn(styles.impactTag, className)} data-impact={importance}>
      <span aria-hidden className={styles.impactBars}>
        <ImpactDots importance={importance} label={label} />
      </span>
      {label}
    </span>
  );
}
