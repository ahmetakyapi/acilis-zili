"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown, DotsThree } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/primitives";
import { EASE_BRAND_POINTS, exitOf } from "@/lib/motion";
import { cn } from "@/lib/utils";
import styles from "./Portfolio.module.css";

/**
 * Portföy kapağındaki ikincil eylemlerin "Diğer" menüsü (25 Ekim).
 *
 * KAPAKTA DÖRT DÜĞME ÜÇ SATIRDI. Pozisyon Ekle, PDF'ten İçe Aktar, Vergi
 * Hesaplayıcıya Aktar ve Portföy Analizi aynı ağırlıkta yan yana diziliyordu:
 * 390'da üç satır (y 248→396, 148 piksel), 1280'de bile iki satır (Portföy
 * Analizi alta düşüyordu; ölçüldü). Birincil eylem dördünden biri gibi
 * okunuyordu. Şimdi Pozisyon Ekle tek dolu düğme, yanında bu menü; geniş
 * ekranda Portföy Analizi de satırda kalıyor (menüdeki kopyası orada gizli).
 *
 * KALIP `AccountMenu`: tetikleyici `aria-expanded`, panel aynı giriş eğrisi
 * ve `exitOf` çıkışı, Escape ve dışarı dokunuş kapatır, Escape odağı
 * tetikleyiciye geri verir. Panel bir `menu` değil (içindekiler sıradan
 * düğme ve bağlantı; ok tuşu yönetimi vaat etmiyoruz) — `aria-haspopup`
 * yok, `aria-controls` var.
 *
 * Bir öğeye basmak menüyü kapatır: İçe Aktar kendi penceresini açıyor,
 * Vergi ve Analiz başka sayfaya gidiyor; açık kalan menü pencerenin
 * arkasında asılı kalıyordu.
 */
/** Panelin en geniş hâli (15rem) + 16 piksel kenar payı. */
const PANEL_ROOM = 256;

export function HeroMoreActions({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  /* Panel sağa yaslı açılır; tetikleyici satırın başına sardıysa (320'de
     Diğer ikinci satıra iniyor, x=37) sağa yaslı 240 piksellik panel ekranın
     solundan 92 piksel taşıyordu — ölçüldü. Açılırken bir kez ölçülür. */
  const [align, setAlign] = useState<"left" | "right">("right");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className={styles.more}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (!open) {
            const rect = triggerRef.current?.getBoundingClientRect();
            setAlign(rect && rect.right < PANEL_ROOM ? "left" : "right");
          }
          setOpen(!open);
        }}
        className={buttonClass({ variant: "ghost", size: "md" })}
      >
        <DotsThree size={16} weight="bold" aria-hidden />
        {label}
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden
          className={cn("transition-transform duration-300 ease-brand", open && "rotate-180")}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="more-panel"
            id={panelId}
            role="group"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: exitOf(0.16) }}
            transition={{ duration: 0.16, ease: EASE_BRAND_POINTS }}
            style={{ transformOrigin: `top ${align}` }}
            data-align={align}
            className={styles.morePanel}
            onClick={(event) => {
              if ((event.target as Element).closest("a, button")) close(false);
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
