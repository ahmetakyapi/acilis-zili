"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Alt bilgi şeridi — her ekranın en altında duran ince bant.
 *
 * Kayan (marquee) bir şerit değil: kayan yazı okurken gözü sürekli takip
 * etmeye zorluyor. Bunun yerine bir grup değer duruyor, belirli aralıkla
 * yumuşak bir geçişle bir sonraki gruba dönüyor — bakınca okunuyor,
 * bakmayınca rahatsız etmiyor. `prefers-reduced-motion` açıkken geçiş
 * efekti düşer ama döngü sürer.
 *
 * Sayfalama GRUP SINIRLARINA saygı duyar: tahvil vadeleri hep bir arada ve
 * aynı sırada döner, endekslerin arasına karışmaz. Grup başına kaç değer
 * gösterileceği ayrı ayrı verilir, çünkü "Nasdaq 100 686,13 +0,37%" ile
 * "2Y 3,84% ▲0,02" aynı yeri kaplamıyor.
 */

export type TickerItem = {
  label: string;
  value: string;
  /** Yön rengi için; null ise nötr yazılır. */
  changePct: number | null;
  /** Değişim metni (yüzde ya da puan). */
  change?: string | null;
};

export type TickerGroup = {
  key: string;
  /** Grubun başına yazılan sessiz künye — "ABD Tahvili" gibi. */
  caption?: string;
  items: TickerItem[];
  /** Dar ekranda bir sayfada kaç değer sığıyor. */
  narrowSize: number;
  /** Geniş ekranda bir sayfada kaç değer sığıyor. */
  wideSize: number;
  /**
   * Dar ekranda değişim sütununu düşür. Tahvillerde üçünü aynı sayfada
   * tutabilmenin bedeli bu: 390px'e üç vade + üç delta sığmıyor, seviyeler
   * sığıyor. Vadelerin bölünüp ayrı sayfalara dağılmasındansa deltayı
   * geniş ekrana bırakmak tercih edildi.
   */
  hideChangeNarrow?: boolean;
};

const WIDE_QUERY = "(min-width: 640px)";
/* Şeridin GÖRÜNDÜĞÜ eşik — `lg`. `WIDE_QUERY` bundan ayrı ve sayfa başına
   kaç öğe sığdığını söylüyor; ikisi karıştırılmamalı. */
const SHOWN_QUERY = "(min-width: 1024px)";
const ROTATE_MS = 6000;
const FADE_MS = 400;

type Page = { caption?: string; showChange: boolean; items: TickerItem[] };

function paginate(groups: TickerGroup[], wide: boolean): Page[] {
  const pages: Page[] = [];
  for (const group of groups) {
    const size = Math.max(1, wide ? group.wideSize : group.narrowSize);
    const showChange = wide || !group.hideChangeNarrow;
    for (let i = 0; i < group.items.length; i += size) {
      pages.push({
        caption: group.caption,
        showChange,
        items: group.items.slice(i, i + size),
      });
    }
  }
  return pages;
}

export function MarketTicker({ groups }: { groups: TickerGroup[] }) {
  const [page, setPage] = useState(0);
  const [visible, setVisible] = useState(true);
  // Sunucu geniş varsayar; dar ekranda ilk ölçümde daralır. CSS ile gizlemek
  // işe yaramıyor — gizlenen değerler döngüde hiç sıra alamıyor.
  const [wide, setWide] = useState(true);
  /* Şerit telefonda CSS ile gizli ama bileşen ayakta: döngü çalışmaya devam
     ediyor ve altı saniyede bir GÖRÜNMEYEN bir DOM'u yeniden çiziyordu.
     Sunucu geniş varsayıyor (işaretleme aynı kalsın, mobilde bir kare bile
     görünmesin), ölçüm sonrası dar ekranda döngü hiç kurulmuyor. */
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const wideQuery = window.matchMedia(WIDE_QUERY);
    const shownQuery = window.matchMedia(SHOWN_QUERY);
    const apply = () => {
      setWide(wideQuery.matches);
      setOnScreen(shownQuery.matches);
    };
    const id = window.setTimeout(apply, 0);
    wideQuery.addEventListener("change", apply);
    shownQuery.addEventListener("change", apply);
    return () => {
      window.clearTimeout(id);
      wideQuery.removeEventListener("change", apply);
      shownQuery.removeEventListener("change", apply);
    };
  }, []);

  const pages = paginate(groups, wide);
  const pageCount = Math.max(1, pages.length);

  useEffect(() => {
    if (pageCount <= 1 || !onScreen) return;
    /* İÇTEKİ ZAMANLAYICI DA TEMİZLENİYOR. Kimliği tutulmuyordu: `pageCount`
       değiştiğinde (ekran döndürme, veri güncellemesi) askıda kalan geri
       çağrı ESKİ `pageCount` kapanışıyla ateşleniyor ve sayfa indeksi
       tutarsız kalabiliyordu. */
    let fade: number | undefined;
    const cycle = window.setInterval(() => {
      // Önce söndür, geçiş bitince sıradaki gruba geç ve yeniden yak.
      setVisible(false);
      fade = window.setTimeout(() => {
        setPage((current) => (current + 1) % pageCount);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => {
      window.clearInterval(cycle);
      if (fade !== undefined) window.clearTimeout(fade);
    };
  }, [pageCount, onScreen]);

  if (pages.length === 0) return null;

  // Ölçü değişince sayfa sayısı da değişir; taşan indeks başa sarılır.
  const shown = pages[page % pageCount];

  return (
    /* TELEFONDA GİZLİ.
       Şerit 37px ve hemen altında 64px'lik sekme çubuğu duruyordu: 844px'lik
       bir ekranda sabit alt katman %12, yapışkan başlıkla birlikte ekranın
       beşte biri kroma gidiyordu. Taşıdığı dört endeks zaten alt çubuktaki
       "Piyasa" sekmesinin bir dokunuş ötesinde ve ana sayfanın kart
       ızgarasında; okuma alanını daraltmasına değmiyor. Masaüstünde yer bol,
       orada sayfanın dibinde kalıyor ve ortam bilgisi olarak işe yarıyor. */
    <div
      aria-live="off"
      className="chrome fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+63px)] z-20 hidden border-t pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:bottom-0 lg:block"
    >
      <div
        className={cn(
          "mx-auto flex h-9 max-w-[1400px] items-center gap-3 overflow-hidden px-[18px] text-small transition-opacity motion-reduce:transition-none sm:gap-5 sm:px-6 sm:text-base xl:px-10",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        {shown.caption && (
          <span className="shrink-0 text-nano font-bold uppercase tracking-[0.09em] text-muted">
            {shown.caption}
          </span>
        )}
        {shown.items.map((item) => (
          <span key={item.label} className="flex shrink-0 items-center gap-1.5">
            <span className="text-muted">{item.label}</span>
            <span className="numeral font-semibold text-body">{item.value}</span>
            {shown.showChange && item.change && (
              <span
                className={cn(
                  "numeral",
                  item.changePct === null || item.changePct === 0
                    ? "text-muted"
                    : item.changePct > 0
                      ? "text-up"
                      : "text-down",
                )}
              >
                {item.change}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
