import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatRange, riskReward } from "@/lib/technical";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import styles from "./Technical.module.css";

type Cell = { kind: "entry" | "target" | "stop" | "sellLevel" | "support" | "resistance"; label: string; value: string | null };

/**
 * Plan şeridi — okuyucunun üç sorusu, üç hücre.
 *
 * Seviyeler bir süre çizginin altında lejant olarak duruyordu: "Stop ·
 * Alım Bölgesi · Hedefler" ve 11 punto sayılar. Sorunun kendisi yazılı
 * değildi; okuyucu "alım bölgesi"nin alım yeri olduğunu, "hedef"in satış
 * yeri olduğunu kendi çeviriyordu. Hücreler soruyu başlık olarak taşıyor
 * (NEREDEN ALINIR / NEREDE SATILIR / NEREDE VAZGEÇİLİR) ve sayı büyük.
 *
 * Görüşe göre hücreler değişiyor:
 *   · alım planı varsa (AL, bölgeli TUT): alım · satış · vazgeçme, altında
 *     risk/getiri oranı — bölgenin üst ucundan ölçülür (bkz. `riskReward`).
 *   · SAT: tepkide satış seviyeleri ve en yakın destek — alım hücresi yok,
 *     çünkü plan alım planı değil.
 *   · bölgesiz TUT: en yakın destek ve direnç — izlenecek iki seviye.
 *
 * "Bu Yayında Yok" hücresi boş bırakılmıyor: AL'da hedef zorunlu ama TUT'ta
 * bölge var hedef olmayabilir; sessiz bir boşluk "unutulmuş" gibi okunur.
 */
export function PlanStrip({
  verdict,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  size = "sm",
  locale,
  t,
}: {
  verdict: VerdictKey;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  /** `lg` detay kapağında: daha büyük sayı, üç sütun her genişlikte. */
  size?: "sm" | "lg";
  locale: Locale;
  t: Dictionary;
}) {
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  /* PARA BİRİMİ LİSTEDE BİR KEZ, SONDA. Üç hedef üç kez "$" taşıyınca
     "Nerede Satılır" hücresi sayfanın en uzun satırı oluyordu ve 390
     pikselde etiketin üstüne dayanıyordu. Hepsi aynı para biriminde;
     tekrarlanan sembol bilgi değil gürültü. `formatRange` ile aynı karar. */
  /* AYRAÇ KENDİNDEN ÖNCEKİ SAYIYA BAĞLI. Ayraç ayrı bir kardeş olarak
     yazılıyordu ve satır ondan ÖNCE kırılabiliyordu: masaüstünde üç hedef
     sütuna sığmayınca "941,65 · 955,70" üstte, "· 989,96 $" altta kalıyordu —
     baştaki nokta satırı kırık gösteriyor. Ayraç artık sayıyla aynı kutuda
     ve kutu `nowrap`: kırılma yalnızca öğelerin ARASINDA olabiliyor, dolayısıyla
     nokta satır sonunda kalıyor. Bir sayı ile onu izleyen nokta hiç ayrılmıyor. */
  const list = (values: readonly number[]) =>
    values.length === 0 ? null : values.map((value, index) => (
      <span key={value} className={styles.planItem}>
        {index === values.length - 1 ? money(value) : formatPrice(value, locale)}
        {index < values.length - 1 && <span className={styles.planSep} aria-hidden> · </span>}
      </span>
    ));
  const hasEntry = entryLow !== null && entryHigh !== null;

  let cells: { kind: Cell["kind"]; label: string; value: React.ReactNode }[];
  if (verdict === "sell") {
    cells = [
      { kind: "sellLevel", label: t.technical.planSellLevels, value: list(targets.length ? targets : resistances) },
      { kind: "support", label: t.technical.planNearestSupport, value: supports[0] !== undefined ? money(supports[0]) : null },
    ];
  } else if (hasEntry) {
    cells = [
      { kind: "entry", label: t.technical.planEntry, value: formatRange(entryLow, entryHigh, locale) },
      { kind: "target", label: t.technical.planTargets, value: list(targets) },
      { kind: "stop", label: t.technical.planStop, value: stop !== null ? money(stop) : null },
    ];
  } else {
    cells = [
      { kind: "support", label: t.technical.planNearestSupport, value: supports[0] !== undefined ? money(supports[0]) : null },
      { kind: "resistance", label: t.technical.planNearestResistance, value: resistances[0] !== undefined ? money(resistances[0]) : null },
      ...(targets.length ? [{ kind: "target" as const, label: t.technical.planTargets, value: list(targets) }] : []),
    ];
  }

  const rr = hasEntry ? riskReward(entryHigh, stop, targets) : null;

  return (
    <div className={cn(styles.planStrip, size === "lg" && styles.planStripLg)}>
      <dl className={styles.planCells} style={{ "--cells": cells.length } as React.CSSProperties}>
        {cells.map((cell) => (
          <div key={cell.kind} className={styles.planCell} data-kind={cell.kind}>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind={cell.kind} />
              {cell.label}
            </dt>
            <dd className={cn("numeral", cell.value === null && styles.planEmpty)}>
              {cell.value ?? t.technical.planNone}
            </dd>
          </div>
        ))}
      </dl>
      {rr && (
        <p className={styles.planRisk}>
          <span>{t.technical.riskReward}</span>
          <b className="numeral">{t.technical.riskRewardValue.replace("{n}", formatPrice(rr.ratio, locale, { digits: 1 }))}</b>
          <span className="numeral text-down">{t.technical.riskPct.replace("{n}", formatPercentPlain(rr.riskPct, locale, 1))}</span>
          <span className="numeral text-up">{t.technical.rewardPct.replace("{n}", formatPercentPlain(rr.rewardPct, locale, 1))}</span>
        </p>
      )}
    </div>
  );
}
