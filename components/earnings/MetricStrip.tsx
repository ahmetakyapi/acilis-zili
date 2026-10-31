import { reactionRatio } from "@/lib/analysis-visuals";
import { cn } from "@/lib/utils";
import styles from "./MetricStrip.module.css";

/** Sıfırı ortada ölçü şeridi — gerekçe MetricStrip.module.css başında. */
export function MetricStrip({ value, scale, className }: { value: number; scale: number; className?: string }) {
  const ratio = reactionRatio(value, scale);
  return (
    <span aria-hidden className={cn(styles.strip, className)}>
      <span
        className={styles.fill}
        data-tone={ratio >= 0 ? "up" : "down"}
        data-over={Math.abs(value) > scale || undefined}
        style={{
          left: ratio >= 0 ? "50%" : `${50 + ratio * 50}%`,
          width: `${Math.max(Math.abs(ratio) * 50, 1)}%`,
        }}
      />
    </span>
  );
}
