"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { INDEX_EVENT, type IndexTickerPatch } from "@/components/today/index-event";
import { Pause, Play } from "@phosphor-icons/react/dist/ssr";
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
  /** Canlı yamanın anahtarı (endeks sembolü); yoksa öğe yamalanmaz. */
  id?: string;
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
  /**
   * Aynı anahtarı taşıyan ardışık gruplar AYNI SAYFADA durur (her biri
   * tek sayfaya sığıyorsa). Kur tek başına bir sayfaydı: 1400 piksellik
   * bantta 253 piksellik tek değer, altı saniye boyunca bandın %80'i boş
   * (1440'ta ölçüldü). Tahvil ile kur artık yan yana.
   */
  sharePage?: string;
};

const WIDE_QUERY = "(min-width: 640px)";
/* Şeridin GÖRÜNDÜĞÜ eşik — `lg`. `WIDE_QUERY` bundan ayrı ve sayfa başına
   kaç öğe sığdığını söylüyor; ikisi karıştırılmamalı. */
const SHOWN_QUERY = "(min-width: 1024px)";
const ROTATE_MS = 6000;
const FADE_MS = 400;

type Segment = { key: string; caption?: string; showChange: boolean; items: TickerItem[] };
type Page = { segments: Segment[]; share?: string };

function paginate(groups: TickerGroup[], wide: boolean): Page[] {
  const pages: Page[] = [];
  for (const group of groups) {
    const size = Math.max(1, wide ? group.wideSize : group.narrowSize);
    const showChange = wide || !group.hideChangeNarrow;
    const whole = group.items.length <= size;
    const last = pages.at(-1);
    if (whole && group.sharePage && last?.share === group.sharePage) {
      last.segments.push({ key: group.key, caption: group.caption, showChange, items: group.items });
      continue;
    }
    for (let i = 0; i < group.items.length; i += size) {
      pages.push({
        segments: [{ key: `${group.key}-${i}`, caption: group.caption, showChange, items: group.items.slice(i, i + size) }],
        share: whole ? group.sharePage : undefined,
      });
    }
  }
  return pages;
}

/** Ana sayfanın kahramanı — endeksleri zaten büyük puntoyla gösteren blok. */
const HERO_ID = "piyasa-ozeti";

export function MarketTicker({
  groups: initialGroups,
  labels,
  skipGroups = [],
}: {
  groups: TickerGroup[];
  /**
   * Kahraman görünürdeyken döngüden çıkan gruplar. Ana sayfanın ilk
   * ekranında dört endeks iki kez duruyordu: kahramanın kartlarında 26
   * puntoyla ve hemen altta şeritte. Kahraman ekrandayken şerit tahvil ve
   * kurla başlıyor; kahraman kaydırılıp gidince tam döngüye dönüyor.
   * Kahramanı olmayan sayfalarda hiçbir şey değişmiyor.
   */
  skipGroups?: string[];
  /** Duraklatma düğmesinin erişilebilir adı — iki durumu da taşır. */
  labels: { pause: string; resume: string };
}) {
  const [page, setPage] = useState(0);
  const pathname = usePathname();
  /* Kartlar tazelendikçe gelen dizeler (`IndexLive`); ilk paket sunucudan. */
  const [patch, setPatch] = useState<IndexTickerPatch>({});
  const [heroInView, setHeroInView] = useState(false);
  const skipKey = skipGroups.join("|");

  useEffect(() => {
    const onPatch = (event: Event) => {
      const detail = (event as CustomEvent<IndexTickerPatch>).detail;
      if (detail) setPatch(detail);
    };
    window.addEventListener(INDEX_EVENT, onPatch);
    return () => window.removeEventListener(INDEX_EVENT, onPatch);
  }, []);

  useEffect(() => {
    const hero = document.getElementById(HERO_ID);
    if (!hero || skipKey === "" || !("IntersectionObserver" in window)) {
      const id = window.setTimeout(() => setHeroInView(false), 0);
      return () => window.clearTimeout(id);
    }
    const observer = new IntersectionObserver(([entry]) => {
      setHeroInView(entry.isIntersecting);
      setPage(0);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [pathname, skipKey]);

  const groups = useMemo(
    () =>
      initialGroups
        .filter((group) => !(heroInView && skipKey.split("|").includes(group.key)))
        .map((group) => ({
          ...group,
          items: group.items.map((item) =>
            item.id && patch[item.id] ? { ...item, ...patch[item.id] } : item,
          ),
        })),
    [initialGroups, heroInView, skipKey, patch],
  );
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

  /* HAREKETİ DURDURMANIN BİR YOLU OLMALI (WCAG 2.2.2). Şerit altı saniyede
     bir kendi kendine sayfa değiştiriyor.
     Üç kapı var: imleç şeridin üstündeyken duruyor, `prefers-reduced-motion:
     reduce` seçili cihazda hiç başlamıyor, ve AÇIK BİR DÜĞME var.
     Düğme sonradan eklendi çünkü ilk iki kapı klavye kullanan okuyucuya
     ulaşmıyordu: `onFocusCapture` ile "içeride bir şey odaktayken dur"
     kuralı yazılıydı ama şeridin içinde odaklanabilir HİÇBİR öğe yoktu,
     yani o kapı fiilen kapalıydı. Ölçütün istediği şey de zaten keşfedilebilir
     bir denetim; gizli bir davranış değil. */
  const [durduruldu, setDurduruldu] = useState(false);
  /** Okuyucunun açık tercihi — imleç ayrıldığında geri açılmaz. */
  const [elleDurduruldu, setElleDurduruldu] = useState(false);
  const [azHareket, setAzHareket] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAzHareket(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (pageCount <= 1 || !onScreen || durduruldu || elleDurduruldu || azHareket)
      return;
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
      if (fade !== undefined) {
        window.clearTimeout(fade);
        /* SÖNME ORTASINDA DURULURSA ŞERİT GÖRÜNMEZ KALIYORDU.
           Döngü önce `visible`ı false yapıyor, `FADE_MS` sonra sıradaki
           gruba geçip yeniden yakıyor. Duraklatma (imleç, duraklat düğmesi,
           `prefers-reduced-motion`, sekmenin görünürden çıkması) tam o
           pencerede gelirse temizlik zamanlayıcıyı iptal ediyor ve "yeniden
           yak" adımı HİÇ çalışmıyordu: şerit `opacity-0`da kalıyor, yeri
           37 piksel boş duruyor ve duraklat düğmesine basan okuyucu şeridi
           dondurmak yerine kaybediyordu. Yalnızca gerçekten bekleyen bir
           sönme varsa geri yakılıyor. */
        setVisible(true);
      }
    };
  }, [pageCount, onScreen, durduruldu, elleDurduruldu, azHareket]);

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
      onMouseEnter={() => setDurduruldu(true)}
      onMouseLeave={() => setDurduruldu(false)}
      onFocusCapture={() => setDurduruldu(true)}
      onBlurCapture={() => setDurduruldu(false)}
      className="chrome fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+63px)] z-20 hidden border-t pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:bottom-0 lg:block"
    >
      <div
        className={cn(
          /* ÖĞE ARASI, ÖĞE İÇİNDEKİNİN BEŞ KATI. Aralık 20 pikseldi ve bir
             öğenin İÇİ 6: iki ölçü birbirine yeterince uzak olmadığı için
             şerit tek bir kesintisiz akış gibi okunuyordu, "Nasdaq 100 · QQQ
             708,91 −%0,05 S&P 500 · SPY" diye. Sayıyı etiketine bağlayan da,
             komşu endeksten ayıran da aynı büyüklükteki boşluktu.

             Yeni ölçüler ölçümle seçildi, tahminle değil. Şeridin EN DAR
             hâli 1024 piksel: dört endeksli grup orada 852 piksel yer
             kaplıyordu, kullanılabilir alan 976. Üç aralık 32'ye ve sekiz
             öğe-içi aralık 8'e çıkınca içerik 908'e geliyor, pay 68 kalıyor;
             sağdaki duraklat düğmesi (28px + 4px kenar) düşülünce 36 piksel
             açıklık var. `overflow-hidden` olduğu için bu payın var olması
             ŞART, yoksa son endeks sessizce kesilirdi.

             ARALIĞIN BÜYÜDÜĞÜ EŞİK, ÖĞE SAYISININ ARTTIĞI EŞİKLE ÇAKIŞMIYOR
             ve bu bir tesadüf değil, kontrol edildi: `lg` (1024) şeridin
             GÖRÜNDÜĞÜ eşikle aynı, `WIDE_QUERY` ise 640. Yani şerit
             göründüğü her an zaten `wide` ve sayfa başına dört endeks
             basıyor; "aralık büyümüş ama öğe de çoğalmış" diye bir bant yok.
             1280'den sonra kap 1400'de sabitlendiği için aralık 40'a
             çıkıyor; orada pay 260 pikselin altına hiç inmiyor. */
          "mx-auto flex h-9 max-w-[1400px] items-center gap-3 overflow-hidden px-[18px] text-small transition-opacity motion-reduce:transition-none sm:gap-5 sm:px-6 sm:text-base lg:gap-8 xl:gap-10 xl:px-10",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        {/* DEĞERLER ÇİZGİYLE AYRILIYOR. Aralık tek başına öğeleri ayırıyordu
            ve bant, sayıların üstünde yüzen bir metin satırı gibi
            okunuyordu. Öğeler arası saç teli (aralığın ortasında, genişlik
            eklemiyor) ve grupları ayıran daha koyu bir çizgi bandı bir
            gösterge tahtasına çeviriyor. Künye büyük harf değil, Title
            Case — sitenin öteki künyeleriyle aynı. */}
        {shown.segments.map((segment, segmentIndex) => (
          <span
            key={segment.key}
            className={cn(
              "flex shrink-0 items-center gap-3 sm:gap-5 lg:gap-8 xl:gap-10",
              segmentIndex > 0 &&
                "relative before:absolute before:inset-y-[-6px] before:-left-4 before:w-px before:bg-(--line-strong) xl:before:-left-5",
            )}
          >
            {segment.caption && (
              <span className="shrink-0 text-tiny font-semibold text-muted">
                {segment.caption}
              </span>
            )}
            {segment.items.map((item, itemIndex) => (
              <span
                key={item.label}
                className={cn(
                  "relative flex shrink-0 items-center gap-2",
                  (itemIndex > 0 || segment.caption) &&
                    "before:absolute before:inset-y-0.5 before:-left-4 before:w-px before:bg-(--line-soft) xl:before:-left-5",
                )}
              >
                <span className="text-muted">{item.label}</span>
                <span className="numeral font-semibold text-body">{item.value}</span>
                {segment.showChange && item.change && (
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
          </span>
        ))}
      </div>

      {/* Duraklatma düğmesi mutlak konumda: şeridin akışına girip değerleri
          kaydırmıyor, ama Tab sırasında yerinde duruyor ve odak halkası
          görünüyor. Tek sayfa varsa dönecek bir şey de yok, basılmıyor. */}
      {/* Hangi sayfadayız: bant kendi kendine dönüyor ve okuyucu bunun
          bir döngü olduğunu ancak değerler değişince fark ediyordu. İki
          nokta döngünün kendisini gösteriyor; duraklatma düğmesinin
          hemen solunda. */}
      {pageCount > 1 && (
        <span aria-hidden className="absolute inset-y-0 right-10 my-auto flex h-1.5 items-center gap-1.5">
          {pages.map((_, index) => (
            <span
              key={index}
              className={cn(
                "size-1.5 rounded-full transition-colors motion-reduce:transition-none",
                index === page % pageCount ? "bg-(--primary)" : "bg-(--line-strong)",
              )}
            />
          ))}
        </span>
      )}
      {pageCount > 1 && (
        <button
          type="button"
          onClick={() => setElleDurduruldu((v) => !v)}
          aria-pressed={elleDurduruldu}
          aria-label={elleDurduruldu ? labels.resume : labels.pause}
          className="absolute inset-y-0 right-1 my-auto inline-flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-elevated hover:text-strong"
        >
          {elleDurduruldu ? (
            <Play weight="fill" size={11} aria-hidden />
          ) : (
            <Pause weight="fill" size={11} aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
