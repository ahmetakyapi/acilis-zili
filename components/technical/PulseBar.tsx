"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Technical.module.css";

export type PulseSlice = {
  key: string;
  /** "AL", "TUT", "SAT", "Bekliyor". */
  label: string;
  /** "7 Hisse". */
  countLabel: string;
  /** "%47". */
  share: string;
  count: number;
};

/**
 * Görüş dağılımının oran çubuğu — dilimin üstüne gelince (telefonda
 * dokununca) balonda o görüşün adı, hisse sayısı ve payı (30 Eylül,
 * sahibinin isteği).
 *
 * NEDEN: telefonda logo satırları gizli (gerekçe Technical.module.css →
 * "TELEFONDA LOGO SATIRLARI YOK") ve dağılımdan geriye yalnızca renkli bir
 * çubuk kalıyordu. Rengin hangi görüş olduğu ve kaç hisse tuttuğu hiçbir
 * yerde yazmıyordu; çubuk bir oran gösteriyor ama okunamıyordu. İlk ekran
 * bütçesi değişmesin diye sayılar kalıcı bir satıra değil, isteğe bağlı
 * bir balona konuldu — çubuğun kendisi aynı 10 piksel.
 *
 * Dilimler düğme: klavyede odakla açılıyor, ekran okuyucu etiketi okuyor.
 * Görünür şerit 10 piksel ama dokunma alanı dikeyde 36 piksel; dilimler
 * yan yana olduğu için yatayda genişletilmiyor.
 */
export function PulseBar({ slices, className }: { slices: readonly PulseSlice[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  /* Son basışın işaretçisi: farede tıklama balonu açık TUTAR (üzerine
     gelince zaten açıldı), dokunuşta aç/kapa. */
  const pointer = useRef<string>("");

  /* Dışarı dokunmak balonu kapatıyor. Yalnızca açıkken dinleniyor. */
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const visible = slices.filter((slice) => slice.count > 0);

  return (
    <div ref={root} className={className} data-motion-stagger>
      {visible.map((slice, index) => {
        const edge = index === 0 ? "start" : index === visible.length - 1 ? "end" : undefined;
        const isOpen = open === slice.key;
        return (
          <button
            key={slice.key}
            type="button"
            className={styles.pulseSlice}
            data-verdict={slice.key}
            data-edge={edge}
            data-open={isOpen ? "" : undefined}
            style={{ flexGrow: slice.count }}
            aria-label={`${slice.label}: ${slice.countLabel}, ${slice.share}`}
            /* Dokunmatikte `pointerenter` dokunuşla birlikte geliyor ve
               ardından gelen tıklama balonu hemen geri kapatırdı; üzerine
               gelme yalnızca gerçek imleçte açıyor. */
            onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(slice.key)}
            onPointerLeave={(event) => event.pointerType === "mouse" && setOpen((current) => (current === slice.key ? null : current))}
            onFocus={(event) => event.currentTarget.matches(":focus-visible") && setOpen(slice.key)}
            onBlur={() => setOpen((current) => (current === slice.key ? null : current))}
            onPointerDown={(event) => {
              pointer.current = event.pointerType;
            }}
            onClick={() =>
              setOpen((current) => (pointer.current === "mouse" || current !== slice.key ? slice.key : null))
            }
          >
            <span data-motion-draw="line" />
            {isOpen && (
              <span className={styles.pulseTip} role="tooltip">
                <b>{slice.label}</b>
                <span className="numeral">{slice.countLabel}</span>
                <span className="numeral">{slice.share}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
