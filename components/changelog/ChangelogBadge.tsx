"use client";

import { useEffect, useSyncExternalStore } from "react";
import { shouldBadge } from "@/lib/changelog-seen";
import { cn } from "@/lib/utils";
import { baselineSnapshot, isUnseen, markSeen, seenServerSnapshot, seenSnapshot, subscribeSeen } from "./seen-store";
import styles from "./Changelog.module.css";

/** Bugünün UTC günü — rozetin "taze mi" kıyası gün hassasiyetinde. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Okurun görmediği yenilik varsa küçük işaret (25 Ekim).
 *
 * İki biçim:
 *   `pill` — satırın yanında "Yeni" yazan hap (Daha Fazla paneli, /menu).
 *   `dot`  — dar yerde 6 piksellik nokta (şeritteki "Daha Fazla", mobil
 *            alt çubuğun Menü sekmesi). Şeridin sığma ölçüsü 1280'de 58
 *            piksel boşluk bırakıyor (nav-items.ts); "Yeni" yazısı oraya
 *            sığmaz. Nokta süs değil durum: okunmamış bir şey var. Ekran
 *            okuyucu için yanında gizli metin.
 *
 * Sunucuda ve hidrasyonda hiçbir şey basılmaz (`seenServerSnapshot`
 * `undefined`), depo okununca bir kez daha çizilir — hidrasyon farkı yok.
 */
export function ChangelogBadge({
  latest,
  label,
  variant,
  className,
}: {
  latest: string;
  label: string;
  variant: "pill" | "dot";
  className?: string;
}) {
  const seen = useSyncExternalStore(subscribeSeen, seenSnapshot, seenServerSnapshot);
  if (seen === undefined || !shouldBadge(latest, seen, todayUtc())) return null;
  if (variant === "dot") {
    return (
      <span className={cn(styles.badgeDot, className)}>
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return <span className={cn(styles.badgePill, className)}>{label}</span>;
}

/** /yenilikler açılınca en son giriş okundu sayılır — rozetler söner. */
export function MarkChangelogSeen({ latest }: { latest: string }) {
  useEffect(() => {
    markSeen(latest);
  }, [latest]);
  return null;
}

/**
 * Sayfadaki "Yeni" rozeti (25 Ekim kompakt düzen): giriş okurun bu
 * ziyaretten önce görmediği bir sürümse kartın ve satırın yanında küçük hap.
 * Kıyas ziyaret başındaki değerle (`baselineSnapshot`): sayfa açılınca
 * yazılan "görüldü" rozetleri aynı anda söndürmesin. Sunucuda ve hidrasyonda
 * basılmaz; yer ayrılmadığı için hap satırın SONUNDA durur, öndeki metni
 * itmez (CLS ölçüldü).
 */
export function UnseenPill({
  date,
  latest,
  label,
  srLabel,
  className,
}: {
  date: string;
  latest: string;
  label: string;
  srLabel: string;
  className?: string;
}) {
  const baseline = useSyncExternalStore(subscribeSeen, baselineSnapshot, seenServerSnapshot);
  if (baseline === undefined || !isUnseen(date, baseline, latest, todayUtc())) return null;
  return (
    <span className={cn(styles.badgePill, className)} title={srLabel}>
      {label}
      <span className="sr-only">, {srLabel}</span>
    </span>
  );
}
