"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { HeroAccent } from "@/components/motion/HeroAccent";
import { ChipStrip } from "@/components/ui/ChipStrip";
import { EmptyState } from "@/components/ui/primitives";
import type { GlossaryCategoryKey } from "@/content/glossary";
import { foldForSearch } from "@/lib/search-fold";
import { GLOSSARY_ALL_ICON, GLOSSARY_CATEGORY_ICONS } from "./category-icons";
import styles from "./Glossary.module.css";

/**
 * Sözlük dizini — İSTEMCİDE SÜZÜLEN liste.
 *
 * Süzgeç adrese yazılmıyor, bilerek: yüz elli terimlik bir listede
 * "stopaj" yazan okuyucunun aradığı şey bir terim sayfası, paylaşılacak bir
 * süzülmüş liste değil. Adrese yazmak her tuşta bir gezinme (ya da sığ
 * güncelleme ve onun uçuştaki gezinmeyi öldürme tuzağı, CLAUDE.md) demekti.
 *
 * ARAMA HARF KATLAYARAK: "fk" F/K'yı, "cekirdek" Çekirdek Enflasyon'u,
 * "withholding" İngilizce sayfada stopajı buluyor. Terim adı, slug ve
 * otomatik bağlantı biçimleri aranıyor; tanımın tamamı değil — "faiz" yazan
 * birine faizden söz eden kırk terim döndürmek aramayı işe yaramaz yapardı.
 *
 * ÜÇ SÜZGEÇ, TEK SONUÇ. Kategori kutucukları, harf dizini ve arama birlikte
 * daralıyor. O harfle başlayan terim yoksa düğme sönük ve basılamıyor,
 * yani okuyucu boş bir listeye hiç düşmüyor.
 *
 * İKİ HÂL: ATLAS VE SONUÇ (28 Eylül, ikinci tur). İlk tur yüz elli terimin
 * hepsini sekiz bölümde alt alta basıyordu: sayfa 1280'de 7.441, 390'da
 * 15.469 piksel boyundaydı ve sözlük bir keşif yüzeyi değil, kaydırılarak
 * geçilen bir başvuru listesiydi. Süzgeç yokken artık bir ATLAS var: sekiz
 * kategori iki sütunlu bir ızgarada, her birinde sözlüğün ağında en çok
 * başvurulan üç terim kavram çizimiyle, kalanı bir `details` içinde. Bir
 * süzgeç açılınca (kategori, harf ya da arama) eski sonuç düzeni geliyor:
 * o zaman okuyucu bir şey arıyor ve her eşleşmeyi görmeli.
 *
 * KARTLAR, ATLAS DEĞİL (29 Eylül, üçüncü tur). Atlas her kategoride üç
 * terimi tanımıyla, kalan yüz yirmi küsurunu kapalı bir `details` arkasında
 * yalnızca adla gösteriyordu; okuyucu bir terimin ne demek olduğunu görmek
 * için ya kutuyu açıp adı tahmin ediyor ya da detaya gidip dönüyordu. Dizin
 * artık KENDİ BAŞINA YETİYOR: yüz ellisinin hepsi küçük bir kartta, tanımın
 * ilk cümlesiyle açıkta. Detay sayfası kalıyor (otomatik bağlantının hedefi,
 * dizinlenen sayfa, örnek kutusu, kavram çizimi, ilişki ağı); kartın tamamı
 * oraya giden bir bağlantı. Sayfa uzadı (ölçüm: 1440'ta 3.100'den 7.995'e,
 * 390'da 5.937'den 18.829'a) ama bu uzunluk okunan metin, kaydırılarak
 * geçilen ad listesi değil; süzgeçler ve harf dizini (768 ve üstünde) yapışkan şeritte.
 * Dördüncü tur (aynı gün): 390'daki boy kabul edilemezdi. Telefonda
 * bölümler katlanıyor (CategorySection), 1024 ve üstünde kart sıkı, 1280
 * ve üstünde dört sütun. Sonuç: 1440'ta 6.137, 1024'te 7.502, 390'da
 * 3.199 piksel (altbilgi dahil; 1440'ta 577, 390'da 1.317'si altbilgi).
 * Kartta kavram işareti YOK: 42 piksellik karo 1440'ta kart başına bir
 * satır, 390'da iki satır tanım yiyordu ve kategori simgesi bölüm başında
 * zaten duruyor. İşaret günün teriminde ve detay sayfasında kalıyor.
 *
 * BAĞLANTILAR DOM'DA KALIYOR. Yüz elli kartın hepsi sunucuda basılıyor;
 * arama motoru hepsini görüyor, JavaScript kapalıyken okuyucu her terimi
 * görüp tıklayabiliyor. Kategori düğmeleri JS ister ama hiçbir terim
 * yalnızca onların arkasında değil.
 *
 * HAREKET: süzgeç değişince kalan kartlar yeni yerlerine KAYIYOR (Motion
 * `layout="position"`), çıkanlar sönerek yer açıyor; hareketi azaltan
 * okuyucuda kök sağlayıcı (`MotionProvider`, `reducedMotion="user"`)
 * kaymayı kapatıyor. Kayma YALNIZCA SÜZÜLMÜŞ görünümde: süzgeçsiz dizin
 * yüz elli düz `li`, her süzgeç değişiminde yüz elli düğümün konumunu
 * ölçtürmesin (tümüne dönüşün kare süresi ölçüldü, rapor `.tmp-sozluk2.mjs`).
 */

export type GlossaryBrowserItem = {
  slug: string;
  term: string;
  category: GlossaryCategoryKey;
  /** Kartın metni: tanımın ilk cümlesi. */
  short: string;
  /** Adın ve biçimlerin katlanmış hâli — sunucuda bir kez kuruluyor. */
  haystack: string;
  /** Harf dizinindeki yeri (dile göre büyük harf). */
  letter: string;
};

export type GlossaryBrowserGroup = {
  key: GlossaryCategoryKey;
  label: string;
  count: number;
  /** Katlanmış bölümün özeti: en çok başvurulan üç terimin kısa adı. */
  preview: string;
};

/** Bölümlerin katlanmadığı genişlik — Glossary.module.css `.fold` ile aynı sınır. */
const FOLD_WIDE_QUERY = "(min-width: 768px)";

/** Süzgeç değişince sonuçlar yalnızca şerit yapışıkken başa alınır. */
const SCROLL_SETTLE_PX = 4;
const EASE = [0.22, 1, 0.36, 1] as const;

export function GlossaryBrowser({
  items,
  groups,
  letters,
  locale,
  hero,
  spotlight,
  labels,
}: {
  items: GlossaryBrowserItem[];
  groups: GlossaryBrowserGroup[];
  letters: string[];
  locale: string;
  /** Kapağın metin kabı (üst künye, başlık, açıklama, ölçüler) — sunucuda çiziliyor. */
  hero: ReactNode;
  /** Kapağın sağındaki günün terimi — sunucuda seçiliyor ve çiziliyor. */
  spotlight: ReactNode;
  labels: {
    filterLabel: string;
    filterPlaceholder: string;
    categoryLabel: string;
    allCategories: string;
    noResults: string;
    noResultsHint: string;
    count: string;
    letterLabel: string;
    clear: string;
    clearQuery: string;
    openCategory: string;
    scrollPrev: string;
    scrollNext: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GlossaryCategoryKey | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const deferred = useDeferredValue(query);
  const resultsRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  /* KIRPILAN TANIM `title` TAŞIYOR. Kartın tanımı satır tavanında
     kesiliyorsa (dört sütunda 150 kartın ~20'si) tam cümle ipucu olarak
     okunabilsin. Hangi kartın kesildiği genişliğe bağlı, sunucu bilemez:
     kap boyu değişince (genişlik, süzgeç, açılan bölüm) yeniden ölçülüyor.
     Kapalı bölümdeki kart ölçülmüyor (boyu yok, `title`ı da gereksiz). */
  useEffect(() => {
    const root = resultsRef.current;
    if (!root) return;
    let frame = 0;
    const mark = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.querySelectorAll<HTMLElement>("[data-short]").forEach((short) => {
          const card = short.parentElement;
          if (!card) return;
          const clipped = short.clientHeight > 0 && short.scrollHeight > short.clientHeight + 1;
          if (clipped) card.title = short.textContent ?? "";
          else card.removeAttribute("title");
        });
      });
    };
    const observer = new ResizeObserver(mark);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  /* Geniş ekranda katlanan bölüm YOK: CSS `::details-content` ile kapalı
     `details`in içeriğini gösteriyor, yani ilk karede JS beklenmiyor. O
     seçiciyi tanımayan tarayıcıda (Safari 18.4 öncesi) kapalı `details`
     geniş ekranda da kapalı kalırdı; orada bölümler JS ile açılıyor. */
  useEffect(() => {
    if (CSS.supports("selector(::details-content)")) return;
    const media = window.matchMedia(FOLD_WIDE_QUERY);
    const sync = () => {
      if (!media.matches) return;
      resultsRef.current?.querySelectorAll<HTMLDetailsElement>("details[data-fold]").forEach((fold) => {
        fold.open = true;
      });
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const needle = foldForSearch(deferred, locale);
  /* Harfin açık olup olmadığı kategori ve aramaya göre; sonuç listesi
     buna bir de harfi ekliyor. İki süzme tek geçişte. */
  const { visible, available } = useMemo(() => {
    const base = items.filter(
      (item) =>
        (category === null || item.category === category) &&
        (needle === "" || item.haystack.includes(needle)),
    );
    return {
      available: new Set(base.map((item) => item.letter)),
      visible: letter === null ? base : base.filter((item) => item.letter === letter),
    };
  }, [items, category, needle, letter]);

  const maxCount = Math.max(1, ...groups.map((group) => group.count));
  const filtered = query !== "" || category !== null || letter !== null;
  /* Atlas yalnızca hiçbir süzgeç yokken. Arama kutusu boşaltıldığı anda
     değil, ertelenmiş değer boşaldığında döner: yazarken atlas ile sonuç
     arasında gidip gelmesin. */
  const browsing = needle === "" && category === null && letter === null;

  const byGroup = groups
    .map((group) => {
      const members = visible.filter((item) => item.category === group.key);
      return { ...group, members, total: members.length };
    })
    .filter((group) => group.total > 0);

  /* Süzgeç şerit yapışıkken değişirse (okuyucu listenin ortasında) sonuçlar
     şeridin altına alınır; yoksa yeni liste görüş alanının üstünde kalıp
     okuyucu boş bir alana bakıyordu. Sayfanın başındayken kaydırma yok. */
  const settle = () => {
    const results = resultsRef.current;
    const toolbar = toolbarRef.current;
    if (!results || !toolbar) return;
    if (results.getBoundingClientRect().top >= toolbar.getBoundingClientRect().bottom - SCROLL_SETTLE_PX) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    results.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };

  const pickCategory = (key: GlossaryCategoryKey | null) => {
    setCategory((current) => (current === key ? null : key));
    setLetter(null);
    settle();
  };
  const pickLetter = (value: string) => {
    setLetter((current) => (current === value ? null : value));
    settle();
  };
  const clearAll = () => {
    setQuery("");
    setCategory(null);
    setLetter(null);
  };

  const countLabel = (count: number) => labels.count.replace("{count}", String(count));
  const AllIcon = GLOSSARY_ALL_ICON;

  return (
    <div className={styles.browser}>
      <header className={`${styles.hero} page-frame`}>
        <HeroAccent />
        {hero}
        {spotlight}
      </header>

      {/* KATEGORİ ŞERİDİ. Her kutucuk bir süzgeç ve aynı zamanda bir ölçü:
          çubuk kategorinin terim sayısını en kalabalık kategoriye göre
          çiziyor. Kapaktaki 3×3 ızgaradan tek satıra indi (yer günün
          terimine kaldı); sığmadığı genişlikte yatay kayıyor. */}
      <ChipStrip
        activeKey={category}
        className={styles.categories}
        scrollLabels={{ prev: labels.scrollPrev, next: labels.scrollNext }}
      >
        <div role="group" aria-label={labels.categoryLabel} className={styles.categoryGrid}>
          <button
            type="button"
            aria-pressed={category === null}
            aria-current={category === null ? "true" : undefined}
            onClick={() => pickCategory(null)}
            className={styles.categoryTile}
          >
            <AllIcon aria-hidden size={20} weight="duotone" />
            <span className={styles.categoryName}>{labels.allCategories}</span>
            <span className={`${styles.categoryCount} numeral`}>{countLabel(items.length)}</span>
            {/* "Tümü" kutucuğunun çubuğu bir PAY: sekiz kategori, terim
                sayısıyla orantılı. */}
            <span aria-hidden className={styles.categoryBar} data-share>
              {groups.map((group, index) => (
                <span
                  key={group.key}
                  style={{ width: `${(group.count / items.length) * 100}%`, "--tile": index } as CSSProperties}
                />
              ))}
            </span>
          </button>
          {groups.map((group, index) => {
            const Icon = GLOSSARY_CATEGORY_ICONS[group.key];
            const active = category === group.key;
            return (
              <button
                key={group.key}
                type="button"
                aria-pressed={active}
                aria-current={active ? "true" : undefined}
                onClick={() => pickCategory(group.key)}
                className={styles.categoryTile}
                style={{ "--tile": index } as CSSProperties}
              >
                <Icon aria-hidden size={20} weight="duotone" />
                <span className={styles.categoryName}>{group.label}</span>
                <span className={`${styles.categoryCount} numeral`}>{countLabel(group.count)}</span>
                <span aria-hidden className={styles.categoryBar}>
                  <span style={{ width: `${(group.count / maxCount) * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </ChipStrip>

      {/* ARAMA ŞERİDİ YAPIŞKAN (768 ve üstü). Telefonda yapışmıyor: başlık,
          şerit ve alt sekmeler birlikte okuma alanının dörtte birini
          yiyordu. */}
      <div ref={toolbarRef} className={styles.toolbar}>
        <label className={styles.searchField}>
          <MagnifyingGlass aria-hidden size={19} />
          <span className="sr-only">{labels.filterLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLetter(null);
            }}
            placeholder={labels.filterPlaceholder}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={labels.clearQuery}
              className={styles.clearQuery}
            >
              <X aria-hidden size={14} weight="bold" />
            </button>
          )}
        </label>
        <ChipStrip
          activeKey={letter}
          className={styles.letters}
          scrollLabels={{ prev: labels.scrollPrev, next: labels.scrollNext }}
        >
          <div role="group" aria-label={labels.letterLabel} className={styles.letterRow}>
            {letters.map((value) => {
              const active = letter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  aria-current={active ? "true" : undefined}
                  disabled={!active && !available.has(value)}
                  onClick={() => pickLetter(value)}
                  className={styles.letter}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </ChipStrip>
        <p className={styles.resultCount} aria-live="polite">
          <span className="numeral">{countLabel(visible.length)}</span>
          {filtered && (
            <button type="button" onClick={clearAll} className={styles.clearAll}>
              {labels.clear}
            </button>
          )}
        </p>
      </div>

      <div ref={resultsRef} className={styles.results}>
        <AnimatePresence initial={false} mode="popLayout">
          {browsing ? (
            <motion.div
              key="atlas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className={styles.atlas}
            >
              {byGroup.map((group, index) => (
                <CategorySection
                  key={group.key}
                  group={group}
                  order={index}
                  countLabel={countLabel}
                  openLabel={labels.openCategory}
                  onOpen={() => pickCategory(group.key)}
                />
              ))}
            </motion.div>
          ) : byGroup.length === 0 ? (
            /* Sonuç alanının tamamı boşaldığında sayfa düzeyinde bir boş
               durum: CLAUDE.md'nin `EmptyState scene=` kalıbı. */
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: EASE }}
            >
              <EmptyState title={labels.noResults} hint={labels.noResultsHint} scene="searching" />
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className={styles.resultList}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {byGroup.map((group) => (
                  <ResultSection key={group.key} group={group} countLabel={countLabel} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type Group = GlossaryBrowserGroup & {
  members: GlossaryBrowserItem[];
  total: number;
};

/**
 * Terim kartı — ad, sağ üstte ok, altında tanımın ilk cümlesi. Kartın
 * tamamı detaya giden bağlantı. Kısa tanım en çok dört satır
 * (`line-clamp`, gerekçesi ve ölçümü Glossary.module.css `.cardShort`);
 * ilk cümleler 35-223 harf.
 */
function TermCard({ item }: { item: GlossaryBrowserItem }) {
  return (
    <Link href={`/sozluk/${item.slug}`} prefetch={false} className={styles.card} data-card>
      <span className={styles.cardName} data-name>
        {item.term}
      </span>
      <ArrowUpRight aria-hidden size={14} weight="bold" className={styles.cardArrow} />
      <span className={styles.cardShort} data-short>
        {item.short}
      </span>
    </Link>
  );
}

function SectionHead({
  group,
  countLabel,
}: {
  group: Group;
  countLabel: (count: number) => string;
}) {
  const Icon = GLOSSARY_CATEGORY_ICONS[group.key];
  return (
    <div className={styles.sectionHead}>
      <span aria-hidden className={styles.sectionIcon}>
        <Icon size={18} weight="duotone" />
      </span>
      <h2 id={`sozluk-${group.key}`}>{group.label}</h2>
      <span className={`${styles.sectionCount} numeral`}>{countLabel(group.total)}</span>
    </div>
  );
}

/**
 * Süzgeçsiz dizinde bir kategori: başlık, sayı, "Kategoriyi Aç" ve bütün
 * terimleri kart ızgarasında. Düz `li` — kayma hareketi yalnızca süzülmüş
 * görünümde (bkz. dosya başı).
 *
 * TELEFONDA KATLANIYOR (29 Eylül, dördüncü tur). Yüz elli kart 390'da
 * sayfayı 18.829 piksele çıkarıyordu. 768 altında her kategori kapalı bir
 * `details`: özet satırında simge, ad, terim sayısı ve en çok başvurulan
 * üç terimin kısa adı, yani kapalıyken de bölümün ne olduğu okunuyor.
 * Kartlar DOM'da (arama motoru ve JS'siz okuyucu için), yalnızca kapalı.
 * 768 ve üstünde aynı `details` CSS ile hep açık ve özet satırı düz bir
 * başlık; "Kategoriyi Aç" düğmesi özetin DIŞINDA (özetin içindeki düğme
 * hem katlamayı hem süzgeci tetikliyor ve ekran okuyucuda düğme içinde
 * düğme oluyordu), geniş ekranda başlığın sağına oturuyor. Süzülmüş
 * görünüm hiç katlanmıyor: okuyucu bir şey aradıysa her eşleşmeyi görmeli.
 */
function CategorySection({
  group,
  order,
  countLabel,
  openLabel,
  onOpen,
}: {
  group: Group;
  order: number;
  countLabel: (count: number) => string;
  openLabel: string;
  onOpen: () => void;
}) {
  const Icon = GLOSSARY_CATEGORY_ICONS[group.key];
  return (
    <section
      aria-labelledby={`sozluk-${group.key}`}
      className={styles.section}
      data-motion-reveal
      style={{ "--tile": order } as CSSProperties}
    >
      <details className={styles.fold} data-fold>
        <summary className={`${styles.sectionHead} ${styles.foldHead}`}>
          <span aria-hidden className={styles.sectionIcon}>
            <Icon size={18} weight="duotone" />
          </span>
          {/* Özetin içeriği yalnızca metin + başlık olabilir (kap `div`/
              `span` içinde `h2` geçersiz): yerleşim özetin kendi ızgarasında. */}
          <h2 id={`sozluk-${group.key}`}>{group.label}</h2>
          <span className={styles.foldPreview}>{group.preview}</span>
          <span className={`${styles.sectionCount} numeral`}>{countLabel(group.total)}</span>
          <CaretDown aria-hidden size={14} weight="bold" className={styles.foldCaret} />
        </summary>
        <ul className={styles.cards}>
          {group.members.map((item) => (
            <li key={item.slug} className={styles.cardItem}>
              <TermCard item={item} />
            </li>
          ))}
        </ul>
      </details>
      <button type="button" onClick={onOpen} className={styles.sectionOpen}>
        {openLabel}
        <ArrowRight aria-hidden size={13} weight="bold" />
      </button>
    </section>
  );
}

/** Süzgeç açıkken bir kategorinin eşleşmeleri — aynı kart dili, kayarak yerleşen. */
function ResultSection({
  group,
  countLabel,
}: {
  group: Group;
  countLabel: (count: number) => string;
}) {
  return (
    <motion.section
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      aria-labelledby={`sozluk-${group.key}`}
      className={styles.section}
    >
      <SectionHead group={group} countLabel={countLabel} />
      <ul className={styles.cards}>
        <AnimatePresence initial={false} mode="popLayout">
          {group.members.map((item) => (
            <motion.li
              key={item.slug}
              layout="position"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: EASE }}
              className={styles.cardItem}
            >
              <TermCard item={item} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}
