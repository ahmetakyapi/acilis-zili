"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import styles from "./Workbench.module.css";

/**
 * Portföyün açılır penceresi — ekleme, düzenleme ve içe aktarma bunda.
 *
 * YERLİ `<dialog>` + `showModal()`: odak tuzağı, Escape, arka planın
 * etkisizleşmesi ve üst katman tarayıcıdan geliyor; elle yazılmış bir odak
 * tuzağı yok. Tarih seçicinin penceresi de üst katmanda (Popover API) ve bu
 * pencere açıkken onun ÜSTÜNE çıkabiliyor.
 *
 * TELEFONDA ALT ÇEKMECE: ekranın dibine yapışık, başparmağın eriştiği yerde;
 * gönder düğmesi çekmecenin altında sabit. Geniş ekranda ortada bir levha.
 *
 * Kapanış animasyonu: `open` false olunca levha önce aşağı kayıyor, sonra
 * `close()` çağrılıyor ve `onClosed` içeriği söküyor. Hareketi azaltana
 * doğrudan kapanır.
 */

/** Kapanış kayması — CSS'teki `sheet-out` süresiyle aynı. */
const CLOSE_MS = 200;

export function PortfolioSheet({
  open,
  onClose,
  onClosed,
  title,
  closeLabel,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
  title: string;
  closeLabel: string;
  size?: "md" | "lg";
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    /* Kapanış animasyonu sürerken (CLOSE_MS) yeniden açılırsa diyalog hâlâ
       açık: eski koşul (`open && !dialog.open`) hiçbir dala girmiyor,
       `data-closing` kalıyor ve levha ekran dışında görünmez dururken
       modal sayfayı kilitliyordu (28 Eylül denetimi). Zamanlayıcıyı
       efektin temizliği zaten iptal ediyor; işaret burada siliniyor. */
    if (open && dialog.open) {
      delete dialog.dataset.closing;
      return;
    }
    if (open && !dialog.open) {
      delete dialog.dataset.closing;
      dialog.showModal();
      /* React `autoFocus`u diyalog açılmadan (görünmezken) uyguluyor; açılış
         sonrası odağı içeriğin işaretlediği alana biz veriyoruz.
         DOKUNMATİKTE OTOMATİK ODAK YOK (29 Eylül). Telefonda levha alttan
         kayarak geliyor ve odak `showModal()`ın hemen ardından, levha henüz
         ekranın altındayken veriliyordu: iOS görünmeyen alanı görünür yapmak
         için sayfayı kaydırıp büyütüyor, klavye levhanın açılışının üstüne
         açılıyordu ("popup açılırken saçma bir zoom"). Dokunmatikte okuyucu
         alana kendisi dokunuyor; klavyeyle gelen masaüstünde odak yerinde. */
      if (window.matchMedia("(pointer: fine)").matches) {
        dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
      }
      return;
    }
    if (!open && dialog.open) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        dialog.close();
        return;
      }
      dialog.dataset.closing = "";
      const timer = window.setTimeout(() => dialog.close(), CLOSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  /* KLAVYE AÇIKKEN LEVHA GÖRÜNÜR ALANDA (29 Eylül). iOS Safari klavye
     açılınca yerleşim alanını küçültmüyor, üstüne çiziyor: dibe sabitli
     levha klavyenin arkasında kalıyor, Safari de odaktaki alanı göstermek
     için bütün sayfayı yukarı itiyordu — levha ekranın dışına sıçrıyor,
     "Portföye Ekle" klavyenin altında kalıyordu. `visualViewport` gerçekten
     görünen dikdörtgeni veriyor: levhanın dibi klavyenin üstüne, boyu da
     görünen alana oturuyor. Klavye yokken iki değer de sıfır/tam boy ve
     CSS'teki varsayılan geçerli. Android Chrome yerleşimi zaten küçültüyor
     (`interactive-widget`), orada fark sıfır çıkıyor. */
  useEffect(() => {
    const dialog = ref.current;
    const viewport = window.visualViewport;
    if (!open || !dialog || !viewport) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      dialog.style.setProperty("--sheet-bottom", `${Math.round(covered)}px`);
      dialog.style.setProperty("--sheet-room", `${Math.round(viewport.height)}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      dialog.style.removeProperty("--sheet-bottom");
      dialog.style.removeProperty("--sheet-room");
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(styles.sheet, size === "lg" && styles.sheetLg)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        delete ref.current?.dataset.closing;
        onClosed();
      }}
      onPointerDown={(event) => {
        /* Levhanın DIŞINA (karartmaya) basmak kapatır. Hedef diyaloğun
           kendisi ve nokta kutunun dışında olmalı: levhanın iç boşluğuna
           basmak da hedef olarak diyaloğu verebiliyor. */
        if (event.target !== ref.current) return;
        const box = ref.current.getBoundingClientRect();
        const outside =
          event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        if (outside) onClose();
      }}
    >
      <div className={styles.sheetInner}>
        <header className={styles.sheetHead}>
          <span className={styles.grabber} aria-hidden />
          <h2 id={titleId} className={styles.sheetTitle}>
            {title}
          </h2>
          <button type="button" className={styles.iconButton} aria-label={closeLabel} onClick={onClose}>
            <X size={18} weight="bold" aria-hidden />
          </button>
        </header>
        <div className={styles.sheetBody} data-sheet-body>{children}</div>
        {footer && <footer className={styles.sheetFoot}>{footer}</footer>}
      </div>
    </dialog>
  );
}
