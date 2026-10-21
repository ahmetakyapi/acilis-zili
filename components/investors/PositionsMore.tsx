"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PositionRow, type PositionRowView } from "./PositionRow";
import styles from "./Investors.module.css";

/* --------------------------------------------------------------------------
   13F tablosunun kalanı — açılana kadar ÇİZİLMEYEN satırlar (20 Ekim).

   Bu bölüm bir `<details>` idi: kapalı görünüyor ama içindeki her satır
   sunucuda tam hâliyle çiziliyor, HTML'e ve RSC yüküne İKİ KEZ yazılıyordu.
   Bridgewater ~bin pozisyon taşıyor; satır başına bir `LocaleLink` ve bir
   `LogoImage` (ikisi de istemci bileşeni, logonun harf yedeği sunucuda
   çizilip prop olarak gidiyor) — yani /yatirimcilar/ray-dalio, okuyucunun
   belki hiç açmayacağı ~975 satır için ~2.000 istemci bileşenini indirip
   hidrate ediyordu. Aynı desen `AlsoReporting`te ölçülmüş ve düzeltilmişti
   (1.354 gizli çip = 1,13 MB HTML); buradaki satırlar o çiplerden ağır.

   Satırlar artık istemciye VERİ olarak geliyor: biçimlenmiş birkaç dize
   (`PositionRowView`), düğüm ağacı değil. Düğmeye basılınca aynı satır
   bileşeniyle çiziliyor; kapalıyken ne DOM'da ne hidrasyonda yer kaplıyor.

   Bedeli `AlsoReporting`teki gibi: JS gelmeden bölüm açılmıyor ve kalan
   satırlar sayfa metninde (sayfa içi arama, tarayıcı) yok. Portföyün en
   büyük pozisyonları, haritası ve çeyreğin hareketleri sunucuda çizilmiş
   hâlde yerinde; kalan, ağırlığı en küçük kuyruk.

   Katlama bastığın yerde açılıyor: düğme `aria-expanded` taşıyor,
   `ExpandInPlace` onu tanıyor (CLAUDE.md "Küçük ama kritik").
   -------------------------------------------------------------------------- */

export function PositionsMore({
  rows,
  label,
  compared,
}: {
  rows: PositionRowView[];
  label: string;
  compared: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <div className={styles.tableMore}>
      <button
        type="button"
        className={styles.tableMoreToggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && (
        <div className={styles.tableScroll}>
          <table className={cn(styles.table, styles.positions)} data-compared={compared || undefined}>
            <tbody>
              {rows.map((row) => (
                <PositionRow key={row.cusip} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
