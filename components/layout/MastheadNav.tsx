"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Locale } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { isActive } from "./nav-items";
import { usePriorityStrip } from "./usePriorityStrip";

export type MastheadStripItem = {
  href: string;
  /** Şeritteki etiket — Teknik'te kısa ad. */
  label: string;
  /** Taşıp panele indiğinde yazılan tam ad. */
  full: string;
  hint: string;
  /** Taşma önceliği, 1 en son taşar. */
  rank: number;
};

export type MastheadMoreItem = { href: string; label: string; hint: string };

/** Panelin genişliği rem cinsinden — sınıftaki `w-60` ile aynı sayı. */
const PANEL_REM = 15;

/**
 * Masaüstü şeridi — yedi sekme ve "Daha Fazla".
 *
 * "BURADASIN" TEK DİLDE. Eskiden iki ayrı dil vardı: aktif sekme nötr bir
 * zemin alıyordu (kabuğa karşı 1,14:1, neredeyse görünmez) ve Menü hapı
 * mavi zemin, mavi kenar, mavi ikon. Artık konum yalnızca mürekkep ve çizgi:
 * etiket `--primary-ink`, altında hairline'ın üstüne binen 2px `--primary`
 * işaret. Sayfa içi sekmelerle (TabItem, TabUnderline) aynı dil. Zemin
 * yalnızca geçici etkileşimde, o da panelin satırlarında.
 *
 * İŞARET KAYMIYOR, YENİ SEKMEDE ÇİZİLİYOR. Paylaşılan `layoutId` ile kayan
 * çizgi değerlendirildi ve reddedildi: ana sayfadan (işaretsiz) dönüşte çizgi
 * önceki render'ın konumundan kayarak geliyordu. İşaret her sekmenin kendi
 * öğesi; CSS girişi (`masthead-mark-in`) yalnızca belirdiği yerde oynuyor.
 *
 * PANEL BİR MENÜ DEĞİL, AÇILIR GEZİNME. `role="menu"` yok: içindekiler
 * bağlantı ve ekran okuyucu onları bağlantı olarak duymalı (gerekçe
 * AccountMenu'de). Üzerine gelmeyle açılmaz; tıklama ve klavye.
 */
export function MastheadNav({
  locale,
  label,
  moreLabel,
  strip,
  more,
}: {
  locale: Locale;
  label: string;
  moreLabel: string;
  strip: readonly MastheadStripItem[];
  more: readonly MastheadMoreItem[];
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hidden = usePriorityStrip(navRef, moreRef);

  /* Rota değişince panel kendiliğinden kapanıyor: açıklık "hangi adreste
     açıldı" olarak tutuluyor ve adres değişince eşleşme bozuluyor. Efekt
     içinde setState yok (AccountMenu'deki kalıp). */
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const close = useCallback((focusTrigger: boolean) => {
    setOpenedAt(null);
    if (focusTrigger) buttonRef.current?.focus();
  }, []);

  /* SAĞA TAŞARSA SAĞDAN HİZALANIR. Panel etiketin sol kenarından açılıyor;
     büyütülmüş yazıda (24px kök, 1024) genişliği 360 piksele çıkıyor ve
     düğme sağa kaydığı için panelin sağ yarısı pencerenin dışında
     kalıyordu (ölçüldü). Karar açılış anında veriliyor, efektte değil. */
  const [alignEnd, setAlignEnd] = useState(false);
  const openPanel = () => {
    const more = moreRef.current;
    if (more) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const right = more.getBoundingClientRect().left + PANEL_REM * rem;
      setAlignEnd(right > document.documentElement.clientWidth - rem);
    }
    setOpenedAt(pathname);
  };

  const overflow = strip.filter((item) => hidden.has(item.href));
  const rows: MastheadMoreItem[] = [
    ...overflow.map((item) => ({ href: item.href, label: item.full, hint: item.hint })),
    ...more,
  ];
  const activeRow = rows.find((row) => isActive(pathname, row.href)) ?? null;

  /* Dinleyiciler yalnızca panel açıkken bağlı. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !moreRef.current?.contains(event.target)) setOpenedAt(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const rowLinks = () => [...(panelRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openPanel();
      /* Panel bir sonraki karede DOM'da. */
      requestAnimationFrame(() => rowLinks()[0]?.focus());
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
    }
  }

  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const links = rowLinks();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const move = (next: number) => {
      event.preventDefault();
      links[(next + links.length) % links.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(links.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }

  return (
    <nav ref={navRef} aria-label={label} className="relative flex h-full min-w-0">
      {/* `content-start` + `h-full` ŞART: JS kapalıyken ya da yazı büyükken
          sığmayan sekme bütün olarak kırpılan ikinci satıra düşüyor; satırlar
          ortak yüksekliğe gerilmiyor. +1px, işaretin hairline'ın üstüne
          binmesi için. */}
      <ul className="relative flex h-[calc(100%+1px)] min-w-0 flex-wrap content-start overflow-clip">
        {strip.map((item) => {
          const active = !hidden.has(item.href) && isActive(pathname, item.href);
          const overflowed = hidden.has(item.href);
          return (
            <li
              key={item.href}
              data-strip-href={item.href}
              data-strip-rank={item.rank}
              data-overflow={overflowed || undefined}
              className={cn("relative h-full shrink-0", overflowed && "invisible absolute")}
            >
              <Link
                href={withLocale(item.href, locale)}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "masthead-link relative flex h-full items-center px-(--masthead-tab-px) text-base font-bold xl:text-read",
                  active ? "text-primary-ink" : "text-body hover:text-strong",
                )}
              >
                {/* TABAN ÇİZGİSİ. Marka adı 19, etiket 13/14 piksel ve ikisi de
                    ortalanıyor: küçük punto merkeze göre daha yukarıda
                    oturuyordu. 2 piksellik kaydırmayla fark 0,4 (1024) ve 0,6
                    (1440) piksel — metin aralığıyla ölçüldü. */}
                <span className="translate-y-0.5">{item.label}</span>
                {active && <span aria-hidden className="masthead-mark" />}
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        ref={moreRef}
        className="relative h-[calc(100%+1px)] shrink-0"
        onBlur={(event) => {
          if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenedAt(null);
        }}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={open ? "masthead-more" : undefined}
          onClick={() => (open ? setOpenedAt(null) : openPanel())}
          onKeyDown={onButtonKeyDown}
          data-open={open || undefined}
          className={cn(
            "masthead-link relative flex h-full items-center gap-1 px-(--masthead-tab-px) text-base font-bold xl:text-read",
            activeRow ? "text-primary-ink" : open ? "text-strong" : "text-body hover:text-strong",
          )}
        >
          <span className="translate-y-0.5">
            {moreLabel}
            {activeRow && <span className="sr-only">: {activeRow.label}</span>}
          </span>
          <CaretDown
            size={10}
            weight="bold"
            aria-hidden
            className={cn("translate-y-0.5 transition-transform", open && "rotate-180")}
          />
          {activeRow && <span aria-hidden className="masthead-mark" />}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              id="masthead-more"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: alignEnd ? "top right" : "top left" }}
              onKeyDown={onPanelKeyDown}
              className={cn(
                "absolute top-[calc(100%+0.5rem)] z-40 w-60 rounded-xl border border-line bg-overlay-surface p-1.5 shadow-(--shadow-overlay)",
                alignEnd
                  ? "right-[calc(var(--masthead-tab-px)-1rem)]"
                  : "left-[calc(var(--masthead-tab-px)-1rem)]",
              )}
            >
              <ul className="flex flex-col">
                {rows.map((row, index) => {
                  const current = activeRow?.href === row.href;
                  return (
                    <li key={row.href}>
                      {index === overflow.length && overflow.length > 0 && (
                        <div aria-hidden className="mx-2.5 my-1 h-px bg-line-soft" />
                      )}
                      <Link
                        href={withLocale(row.href, locale)}
                        prefetch={false}
                        aria-current={current ? "page" : undefined}
                        onClick={() => setOpenedAt(null)}
                        className="masthead-row relative flex min-h-13 flex-col justify-center gap-0.5 rounded-md px-2.5 py-2 hover:bg-surface focus-visible:bg-surface"
                      >
                        <span className={cn("text-base font-semibold", current ? "text-primary-ink" : "text-strong")}>
                          {row.label}
                        </span>
                        <span className="truncate text-tiny text-muted">{row.hint}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
