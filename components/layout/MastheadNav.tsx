"use client";

import { EASE_BRAND_POINTS, exitOf } from "@/lib/motion";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { Locale } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";
import { ChangelogBadge } from "@/components/changelog/ChangelogBadge";
import { puzzleDayKey, puzzleNumber } from "@/lib/stock-puzzle";
import { isActive, MORE_GROUPS, NAV_ITEMS, type MoreGroup } from "./nav-items";
import styles from "./MastheadMore.module.css";
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

export type MastheadMoreItem = { href: string; label: string; hint: string; group: MoreGroup };

/** Yenilikler satırı ve rozeti — sunucuda çözülen metinler ve en son giriş günü. */
export type ChangelogNavLabels = {
  href: string;
  label: string;
  hint: string;
  /** Satırdaki hap: "Yeni". */
  badge: string;
  /** Noktanın ekran okuyucu metni. */
  badgeLabel: string;
  /** En son girişin günü ("2026-10-25"). */
  latest: string;
};

/** Panelin genişliği rem cinsinden — MastheadMore.module.css `.panel` ile aynı sayı. */
const PANEL_REM = 64;
/** Panelin pencere kenarına en az uzaklığı, rem. */
const EDGE_REM = 1;
/** Araçlar bandının altındaki sütunlar, sırayla (MORE_GROUPS'tan "tools" dışı). */
const COLUMNS = MORE_GROUPS.filter((group) => group !== "tools");
/** Satırın yanında canlı künye taşıyan hedef: bugünün bulmaca numarası. */
const PUZZLE_HREF = "/bulmaca";

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
 *
 * İKİ SÜTUN, ÜÇ GRUP (28 Eylül). Panel tek sütunda on satırdı ve 900
 * piksellik bir liste oluyordu; hangi satırın veri ekranı, hangisinin
 * okuma olduğu ayırt edilmiyordu. Solda "Veri ve Ekranlar", sağda "Öğren"
 * ile "Oku". Şeritten taşan sekmeler sol grubun başına iniyor. Klavye
 * sırası belge sırası: önce sol sütun, sonra sağ.
 *
 * 11 Ekim: üstte bir bant daha — "Analiz Araçları" (Hisse Seçimi,
 * Karşılaştır), iki sütuna yayılan iki büyük kart. Gerekçe nav-items.ts →
 * MORE_GROUPS.
 *
 * 25 EKİM: MEGA PANEL. Sahibinin ekran görüntüsünde panel 736 piksel
 * genişlik, ~860 piksel boydu (ölçüldü: içerik 864) ve 900 piksellik
 * ekranda kaydırılıyordu; gruplar ekranın türüne göreydi ve Olasılıklar
 * cümle düzeninde bir ipucuyla "Her Gün"ün dibinde tek başına duruyordu.
 * Şimdi: üstte üç yatay araç karosu, altında NİYETE göre dört sütun (Her
 * Gün, Piyasa, Portföy ve Maliyet, Öğren ve Oku), dipte Yenilikler. Her
 * grubun ikon karosu kendi tonunda (renkler /yenilikler'in alan renkleriyle
 * aynı anlamda: piyasa `--chart-a`, kişisel `--chart-b`). Ölçüm
 * MastheadMore.module.css başında.
 *
 * İKİNCİ TUR (25 Ekim): dört sütun eşit dört satır, dipteki Yenilikler
 * satırı "Öğren ve Oku"ya taşındı (gerekçe nav-items.ts → MORE_GROUPS);
 * araç karoları tek satır ipucuyla alçak, bulmaca numarası gövde fontunda
 * küçük künye hapı. Klavye sırası yine belge sırası: bant, sonra sütunlar
 * soldan sağa.
 */
export function MastheadNav({
  locale,
  label,
  moreLabel,
  strip,
  more,
  groups,
  puzzleNumber: puzzleLabel,
  changelog,
}: {
  locale: Locale;
  label: string;
  moreLabel: string;
  strip: readonly MastheadStripItem[];
  more: readonly MastheadMoreItem[];
  groups: Record<MoreGroup, string>;
  /** "Bulmaca #{n}" — Hisseyi Bil satırının künyesi. */
  puzzleNumber: string;
  changelog: ChangelogNavLabels;
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

  /* PANEL PENCEREYE SIĞDIRILIR (25 Ekim). Eskiden etiketin sol
     kenarından açılıyor, sağa taşarsa sağdan hizalanıyordu; 64rem'lik mega
     panel 1280'de iki yöne de sığmıyor (düğmenin solu ~808). Şimdi panel
     düğmenin altında başlamak ister; sağ kenarı başlığın kabını (logo ile
     hesap düğmesi arası) aşacaksa sola kaydırılır ve kabın sağ kenarına
     hizalanır, sol kenarı pencereden 1rem içeride kalır; büyütülmüş yazıda
     genişlik pencereye iner (CSS `min()`). Hesap açılış anında ve pencere
     boyu değişince, efektte değil. `origin`: ölçek girişinin merkezi
     düğmenin hizası — panel düğmeden "açılıyor". */
  const [place, setPlace] = useState<{ left: number; origin: number } | null>(null);
  const measurePlace = useCallback(() => {
    const more = moreRef.current;
    if (!more) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const viewport = document.documentElement.clientWidth;
    const width = Math.min(PANEL_REM * rem, viewport - 2 * EDGE_REM * rem);
    const box = more.getBoundingClientRect();
    const edge = EDGE_REM * rem;
    const frame = navRef.current?.parentElement?.getBoundingClientRect();
    const right = Math.min(viewport - edge, frame ? frame.right : viewport - edge);
    const left = Math.max(edge, Math.min(box.left - edge, right - width));
    setPlace({ left: left - box.left, origin: box.left + box.width / 2 - left });
  }, []);
  const openPanel = () => {
    measurePlace();
    setOpenedAt(pathname);
  };

  const overflow = strip.filter((item) => hidden.has(item.href));
  const rows: MastheadMoreItem[] = [
    ...overflow.map((item) => ({ href: item.href, label: item.full, hint: item.hint, group: "market" as const })),
    ...more,
  ];
  const activeRow = rows.find((row) => isActive(pathname, row.href)) ?? null;

  /* Dinleyiciler yalnızca panel açıkken bağlı. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !moreRef.current?.contains(event.target)) setOpenedAt(null);
    };
    /* ESCAPE BELGEDE (28 Eylül denetimi). Tuş yalnızca düğmede ve panelde
       dinleniyordu: fareyle açılıp odağın başka yerde kaldığı durumda
       (Safari düğmeye tıklayınca odak vermiyor) Escape paneli kapatmıyordu.
       Odak panelin içindeyse düğmeye dönüyor, değilse yerinde kalıyor. */
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const inside = moreRef.current?.contains(document.activeElement) ?? false;
      close(inside);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", measurePlace);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measurePlace);
    };
  }, [open, close, measurePlace]);

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
    <nav ref={navRef} aria-label={label} className="masthead-nav relative flex h-full min-w-0">
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
                /* ÖN YÜKLEME NİYETLE (24 Eylül, ölçüldü). Düz `prefetch` her sayfa
                   açılışında bütün sekmelerin TAM sunucu çizimini istiyordu:
                   masaüstünde beş, telefonda dört sayfa — okuyucu hiçbirini
                   açmasa da her ziyarette sunucu, veritabanı ve sağlayıcı o
                   sayfaları da çiziyordu. Artık görünürken yalnızca hafif ön
                   yükleme, tam yükleme fare üstüne geldiğinde ya da dokunuş
                   başladığında (tıklamadan 100-300 ms önce) — geçiş yine anlık. */
                prefetchOnIntent
                aria-current={active ? "page" : undefined}
                className={cn(
                  "masthead-link relative flex h-full items-center px-(--masthead-tab-px) text-base font-semibold xl:text-read",
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
            "masthead-link relative flex h-full items-center gap-1 px-(--masthead-tab-px) text-base font-semibold xl:text-read",
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
          {/* OKUNMAMIŞ YENİLİK NOKTASI (25 Ekim). Yazı değil nokta: şerit
              1280'de 58 piksel boşlukla sığıyor (nav-items.ts ölçüsü),
              "Yeni" hapı sekmeleri aramanın altına iterdi. Okur panelde
              satırdaki hapı görüyor. */}
          <ChangelogBadge
            latest={changelog.latest}
            label={changelog.badgeLabel}
            variant="dot"
            className="right-[calc(var(--masthead-tab-px)-6px)] top-[calc(50%-7px)]"
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              id="masthead-more"
              /* ODAK PANELDE KALIR (28 Eylül denetimi). Paneldeki boş bir
                 yere (grup başlığı, dolgu) tıklanınca düğme odağı kaybediyor,
                 `relatedTarget` null geliyor ve `onBlur` paneli kapatıyordu.
                 `tabIndex={-1}` paneli odaklanabilir yapıyor (Tab sırasına
                 girmeden): tıklama odağı panele veriyor, `contains` doğru. */
              tabIndex={-1}
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97, transition: exitOf(0.16) }}
              transition={{ duration: 0.16, ease: EASE_BRAND_POINTS }}
              style={{ left: place?.left ?? 0, transformOrigin: `${place?.origin ?? 0}px 0` }}
              onKeyDown={onPanelKeyDown}
              className={cn(
                "masthead-dropdown absolute outline-none top-[calc(100%+0.75rem)] z-40 rounded-2xl border border-line bg-overlay-surface shadow-(--shadow-overlay)",
                styles.panel,
              )}
            >
              {(() => {
                /* ARAÇLAR BANDI ÜSTTE (11 Ekim; 25 Ekim'den beri üç YATAY
                   karo, ~64 piksel: dikey kartlar 136 piksel boy alıyordu).
                   Klavye sırası belge sırası: önce bant, sonra sütunlar
                   soldan sağa. */
                const featured = rows.filter((row) => row.group === "tools");
                if (featured.length === 0) return null;
                return (
                  <section aria-label={groups.tools} className={styles.tools}>
                    <h3 className={styles.head}>{groups.tools}</h3>
                    <ul className={styles.toolList}>
                      {featured.map((row) => {
                        const current = activeRow?.href === row.href;
                        const Icon = NAV_ITEMS.find((item) => item.href === row.href)?.icon;
                        return (
                          <li key={row.href} className="min-w-0">
                            <Link
                              href={withLocale(row.href, locale)}
                              prefetch={false}
                              aria-current={current ? "page" : undefined}
                              onClick={() => setOpenedAt(null)}
                              className={cn("masthead-feature-card", styles.tool)}
                            >
                              {Icon && <span className="masthead-feature-icon" aria-hidden><Icon size={20} weight="duotone" /></span>}
                              <span className="min-w-0 flex-1">
                                <span className="block text-read font-bold leading-snug text-strong">{row.label}</span>
                                <span className={cn("mt-0.5 block text-small leading-snug text-muted", styles.toolHint)}>{row.hint}</span>
                              </span>
                              <ArrowUpRight className="masthead-row-arrow" size={14} aria-hidden />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })()}
              <div className={styles.columns}>
                {COLUMNS.map((group) => {
                  const groupRows = rows.filter((row) => row.group === group);
                  if (groupRows.length === 0) return null;
                  return (
                    <section key={group} aria-label={groups[group]} className={styles.column} data-group={group}>
                      <h3 className={styles.head}>
                        <span className={styles.swatch} aria-hidden />
                        {groups[group]}
                      </h3>
                      <ul className="flex flex-col">
                        {groupRows.map((row) => {
                          const current = activeRow?.href === row.href;
                          const Icon = NAV_ITEMS.find((item) => item.href === row.href)?.icon;
                          const lastOverflow = overflow.length > 0 && row.href === overflow[overflow.length - 1].href;
                          /* CANLI KÜNYE: bugünün bulmaca numarası. Saf
                             hesap (TR takvimi, lib/stock-puzzle.ts), veri
                             isteği yok; panel yalnız istemcide açıldığı
                             için sunucu çizimiyle çelişmiyor ve sekme gece
                             yarısını geçse de açılış anının numarası. */
                          const puzzleNo = row.href === PUZZLE_HREF ? puzzleNumber(puzzleDayKey()) : null;
                          const live = puzzleNo !== null ? puzzleLabel.replace("{n}", String(puzzleNo)) : null;
                          return (
                            <li key={row.href} data-divider={lastOverflow || undefined}>
                              <Link
                                href={withLocale(row.href, locale)}
                                prefetch={false}
                                aria-current={current ? "page" : undefined}
                                onClick={() => setOpenedAt(null)}
                                className={cn(
                                  "masthead-row relative flex items-center gap-2.5 rounded-xl hover:bg-surface focus-visible:bg-surface",
                                  styles.row,
                                )}
                              >
                                {Icon && <span className="masthead-row-icon" aria-hidden><Icon size={18} weight="duotone" /></span>}
                                <span className="min-w-0 flex-1">
                                  <span className="flex min-w-0 items-baseline gap-1.5">
                                    <span className={cn("text-base font-semibold leading-snug", current ? "text-primary-ink" : "text-strong")}>
                                      {row.label}
                                    </span>
                                    {/* HAPTA YALNIZ "#2" (25 Ekim, ikinci tur): "Puzzle #2"
                                        sütunda adı ("Guess the Stock") iki satıra
                                        kırıyordu (1280–1920 EN, ölçüldü). Tam künye
                                        `title`da ve ekran okuyucuda. */}
                                    {live && (
                                      <span className={styles.live} title={live}>
                                        <span aria-hidden>#{puzzleNo}</span>
                                        <span className="sr-only">{live}</span>
                                      </span>
                                    )}
                                    {/* Yenilikler artık "Öğren ve Oku"nun satırı; görmediğin
                                        giriş varsa "Yeni" hapı adın yanında (eskiden panelin
                                        dibindeki tek satırdaydı). */}
                                    {row.href === changelog.href && (
                                      <ChangelogBadge latest={changelog.latest} label={changelog.badge} variant="pill" className="self-center" />
                                    )}
                                  </span>
                                  <span className={cn("mt-0.5 block text-tiny leading-snug text-muted", styles.hint)}>{row.hint}</span>
                                </span>
                                <ArrowUpRight className={cn("masthead-row-arrow", styles.rowArrow)} size={14} aria-hidden />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
