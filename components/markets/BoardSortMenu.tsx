"use client";

import { useEffect, useRef } from "react";
import { CaretDown, CaretUp, Check, SortDescending } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { cn } from "@/lib/utils";
import styles from "./BoardTable.module.css";

export type BoardSortItem = {
  key: string;
  label: string;
  /** Sunucuda sıralanan tablo: aynı `?sirala=` adresi (başlıktaki bağlantının aynısı). */
  href?: string;
  active: boolean;
};

/**
 * Telefonda sıralama seçicisi (10 Kasım 2026, gece; sahibinin sözü:
 * "listeleri kaydırmadan kullanalım, kompakt olsun").
 *
 * NEDEN: telefonda tablo artık bir LİSTE (BoardTable.module.css →
 * "TELEFON: KOMPAKT LİSTE"); sütun başlığı satırı yok, sıralama
 * bağlantıları onunla gitti. Başlık satırının yerinde tek satırlık bir
 * şerit: solda "Sırala: Değişim ↓" butonu, sağda satırın iki sayısının ne
 * olduğu ("Değişim · Fiyat"). Buton aynı `?sirala=` adreslerini açar
 * (`scroll={false}`), istemcide sıralanan tabloda (`onSelect`, tema tablosu)
 * aynı durumu değiştirir. Etkin ölçüye yeniden basmak yönü çevirir —
 * başlıktaki bağlantının davranışı.
 *
 * NASIL: `<details>`: JS gelmeden açılır, seçenekler gerçek bağlantı.
 * İstemci yalnız dışarı basınca ve Esc'te kapatır. Menünün kendisi 640+
 * genişlikte hiç görünmez (`display:none`) — orada başlık satırı var;
 * ekran okuyucu ikisini aynı anda duymaz (telefonda başlık satırı gizli).
 * `data-sort-link`: `RowFlip` satır konumlarını bu basışta da kaydeder.
 */
export function BoardSortMenu({
  items,
  dir,
  label,
  caption,
  ascLabel,
  descLabel,
  onSelect,
}: {
  items: BoardSortItem[];
  dir: "asc" | "desc";
  /** "Sırala" */
  label: string;
  /** Satırın sağ sütunundaki iki sayının adı ("Değişim · Fiyat"). */
  caption?: string;
  ascLabel: string;
  descLabel: string;
  onSelect?: (key: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const active = items.find((item) => item.active) ?? items[0];

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const outside = (event: PointerEvent) => {
      if (box.open && event.target instanceof Node && !box.contains(event.target)) box.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && box.open) {
        box.open = false;
        box.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const DirIcon = dir === "desc" ? CaretDown : CaretUp;
  const dirText = dir === "desc" ? descLabel : ascLabel;

  return (
    <div className={styles.sortBar}>
      <details ref={ref} className={styles.sortMenu}>
        <summary className={styles.sortSummary}>
          <SortDescending aria-hidden size={16} weight="bold" className={styles.sortSummaryIcon} />
          <span className={styles.sortSummaryLabel}>{label}:</span>
          <span className={styles.sortSummaryValue}>{active?.label}</span>
          <DirIcon aria-hidden size={12} weight="fill" className={styles.sortSummaryDir} />
          <span className="sr-only">{dirText}</span>
        </summary>
        <ul className={styles.sortList}>
          {items.map((item) => {
            const body = (
              <>
                <span>{item.label}</span>
                {item.active ? (
                  <span className={styles.sortItemState}>
                    <DirIcon aria-hidden size={12} weight="fill" />
                    <span className="sr-only">{dirText}</span>
                    <Check aria-hidden size={14} weight="bold" />
                  </span>
                ) : null}
              </>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    scroll={false}
                    className={styles.sortItem}
                    data-active={item.active || undefined}
                    aria-current={item.active ? "true" : undefined}
                    data-sort-link
                    onClick={() => {
                      if (ref.current) ref.current.open = false;
                    }}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.sortItem}
                    data-active={item.active || undefined}
                    aria-pressed={item.active}
                    data-sort-link
                    onClick={() => {
                      if (ref.current) ref.current.open = false;
                      onSelect?.(item.key);
                    }}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      {caption && <p className={cn("numeral", styles.sortCaption)}>{caption}</p>}
    </div>
  );
}
