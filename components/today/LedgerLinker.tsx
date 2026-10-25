"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./BriefLedger.module.css";

/**
 * METİN ↔ BANT BAĞI (25 Ekim görsel zirve).
 *
 * Bülten "SPY %0,52 düştü" diyor; bant aynı fonun kulvarını çiziyor. Bu
 * bileşen ikisini birbirine bağlıyor:
 *   - Metindeki geçişin (`data-ledger-ref`) üstüne gelince ya da dokununca
 *     yanında bandın özeti açılıyor ("S&P 500 −%0,52 · 23 Eki Seans Kapanışı") ve
 *     bant ekrandaysa karşılığı vurgulanıyor. Okuyucu bandı geride bıraktığı
 *     uzun metnin ortasında yukarı dönmek zorunda kalmıyor.
 *   - Banttaki öğenin (`data-ledger-key`) üstüne gelince ya da klavyeyle
 *     odaklanınca metindeki bütün geçişleri vurgulanıyor.
 *
 * TEK DİNLEYİCİ, KABIN KENDİSİNDE. Geçişler sunucuda çizilmiş düz `span`;
 * her birine istemci bileşeni koymak bülten başına onlarca hidrasyon adası
 * demekti. Olaylar kapta yakalanıyor (`closest`), durum yalnızca açık
 * ayrıntının kendisi.
 *
 * ERİŞİLEBİLİRLİK. Açılan ayrıntı bandın görünür metninin kopyası
 * (`aria-hidden`); ekran okuyucu ve klavye aynı bilgiyi bandın kendisinde
 * buluyor. Esc ve kaydırma ayrıntıyı kapatıyor.
 *
 * DOKUNMATİKTE KAPATMA (25 Ekim son düzeltme). Ayrıntı yalnız başka bir
 * geçişe dokununca değişiyordu; aynı geçişe ikinci dokunuş onu yeniden
 * açıyor, metnin dışına dokunuş hiçbir şey yapmıyordu (`click` kabın
 * dışında hiç gelmiyor). Artık aynı geçişe ikinci dokunuş kapatıyor,
 * geçiş dışındaki her dokunuş da belge düzeyindeki `pointerdown`la
 * (PosterStage kalıbı, components/day-poster/PosterStage.tsx).
 */

type Tip = { key: string; text: string; x: number; y: number; below: boolean };

/** Ayrıntı kutusunun ekran kenarına en yakın ortası (yarım genişlik + pay). */
const TIP_EDGE = 140;
/** Geçişin üstünde bu kadar yer yoksa ayrıntı altına açılır. */
const TIP_ROOM = 64;

function escapeKey(key: string) {
  return typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/"/g, '\\"');
}

export function LedgerLinker({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  /** Son dokunuşun türü — `click` olayı bunu taşımıyor. */
  const pointer = useRef<string>("mouse");

  const highlight = useCallback((key: string | null) => {
    const el = root.current;
    if (!el) return;
    el.querySelectorAll("[data-ledger-active]").forEach((node) => node.removeAttribute("data-ledger-active"));
    if (!key) return;
    const k = escapeKey(key);
    el.querySelectorAll(`[data-ledger-key="${k}"], [data-ledger-ref="${k}"]`).forEach((node) =>
      node.setAttribute("data-ledger-active", ""),
    );
  }, []);

  const open = useCallback((target: HTMLElement) => {
    const key = target.dataset.ledgerRef;
    const el = root.current;
    if (!key || !el) return;
    const item = el.querySelector<HTMLElement>(`[data-ledger-key="${escapeKey(key)}"]`);
    const text = item?.dataset.ledgerSummary;
    if (!text) return;
    const rect = target.getBoundingClientRect();
    const width = window.innerWidth;
    const x = Math.min(Math.max(rect.left + rect.width / 2, TIP_EDGE), Math.max(TIP_EDGE, width - TIP_EDGE));
    const below = rect.top < TIP_ROOM;
    setTip({ key, text, x, y: below ? rect.bottom : rect.top, below });
  }, []);

  const close = useCallback(() => {
    setTip(null);
    highlight(null);
  }, [highlight]);

  /* Açıkken kaydırma, Esc ve geçiş dışına dokunuş kapatır; kapalıyken
     dinleyici yok. Geçişin kendisine dokunuşu `onClick` karara bağlıyor. */
  useEffect(() => {
    if (!tip) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onDown = (event: PointerEvent) => {
      const inside = event.target instanceof Element && event.target.closest("[data-ledger-ref]");
      if (!inside || !root.current?.contains(inside)) close();
    };
    window.addEventListener("scroll", close, { passive: true, once: true });
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [tip, close]);

  const nodeOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>("[data-ledger-ref], [data-ledger-key]") : null;

  return (
    <div
      ref={root}
      className={className}
      onPointerOver={(event) => {
        const node = nodeOf(event.target);
        if (!node) return;
        highlight(node.dataset.ledgerRef ?? node.dataset.ledgerKey ?? null);
        if (node.dataset.ledgerRef && event.pointerType === "mouse") open(node);
      }}
      onPointerOut={(event) => {
        const node = nodeOf(event.target);
        if (!node || (event.relatedTarget instanceof Node && node.contains(event.relatedTarget))) return;
        if (event.pointerType === "mouse") close();
      }}
      onPointerDown={(event) => {
        pointer.current = event.pointerType;
      }}
      onClick={(event) => {
        /* Dokunmatikte üstüne gelme yok: dokunuş açar, aynı geçişe ikinci
           dokunuş kapatır (fareyle üstüne gelince zaten açık; tıklama onu
           kapatmasın). Dışarı dokunuş belge dinleyicisinde. */
        const node = nodeOf(event.target);
        const key = node?.dataset.ledgerRef;
        if (!node || !key) return;
        if (tip?.key === key && pointer.current !== "mouse") {
          close();
          return;
        }
        highlight(key);
        open(node);
      }}
      onFocus={(event) => {
        const node = nodeOf(event.target);
        if (node?.dataset.ledgerKey) highlight(node.dataset.ledgerKey);
      }}
      onBlur={() => highlight(null)}
    >
      {children}
      {tip && (
        <span
          aria-hidden
          className={styles.tip}
          data-below={tip.below ? "" : undefined}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </span>
      )}
    </div>
  );
}
