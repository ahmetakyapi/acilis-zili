"use client";

import { useDeferredValue, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CaretDown, Graph, MagnifyingGlass, X } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { HeroAccent } from "@/components/motion/HeroAccent";
import { ChipStrip } from "@/components/ui/ChipStrip";
import { EmptyState } from "@/components/ui/primitives";
import type { GlossaryCategoryKey } from "@/content/glossary";
import type { GlossaryMotif } from "@/content/glossary/marks";
import { foldForSearch } from "@/lib/search-fold";
import { GLOSSARY_ALL_ICON, GLOSSARY_CATEGORY_ICONS } from "./category-icons";
import { TermMark } from "./TermMark";
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
 * BAĞLANTILAR DOM'DA KALIYOR. Kapalı `details` içindeki bağlantılar HTML'de
 * duruyor; arama motoru yüz ellisini de görüyor ve JavaScript kapalıyken
 * okuyucu her kategoriyi elle açabiliyor. Kategori düğmeleri JS ister ama
 * hiçbir terim yalnızca onların arkasında değil.
 *
 * HAREKET: süzgeç değişince kalan kartlar yeni yerlerine KAYIYOR (Motion
 * `layout="position"`), çıkanlar sönerek yer açıyor; hareketi azaltan
 * okuyucuda kök sağlayıcı (`MotionProvider`, `reducedMotion="user"`)
 * kaymayı kapatıyor. Kavram çizimleri `MotionExperience`in `arc` kalıbıyla
 * görünüme girince çiziliyor.
 */

export type GlossaryBrowserItem = {
  slug: string;
  term: string;
  category: GlossaryCategoryKey;
  short: string;
  /** Büyük kartın metni: tanımın ilk iki cümlesi (yalnızca öne çıkan ilk terimde). */
  lede?: string;
  /** Adın ve biçimlerin katlanmış hâli — sunucuda bir kez kuruluyor. */
  haystack: string;
  /** Harf dizinindeki yeri (dile göre büyük harf). */
  letter: string;
  motif: GlossaryMotif;
  /** Kaç terim buna bağlanıyor. */
  links: number;
  /** Kategorideki öne çıkma sırası: 1 büyük kart, 2-3 orta kart, 0 sıkı ızgara. */
  featured: number;
  /** Öne çıkan kartta ilişkili terimlerin adları (en çok üç). */
  related: string[];
};

export type GlossaryBrowserGroup = { key: GlossaryCategoryKey; label: string; count: number };

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
  /** Kapağın metni (üst künye, başlık, açıklama, ölçüler) — sunucuda çiziliyor. */
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
    links: string;
    openCategory: string;
    moreTerms: string;
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
      return {
        ...group,
        featured: members
          .filter((item) => item.featured > 0)
          .sort((a, b) => a.featured - b.featured),
        rest: members.filter((item) => item.featured === 0),
        total: members.length,
      };
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
        <div className={`${styles.heroCopy} page-heading-copy`}>{hero}</div>
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
                <AtlasBlock
                  key={group.key}
                  group={group}
                  order={index}
                  labels={labels}
                  countLabel={countLabel}
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
                  <ResultSection key={group.key} group={group} labels={labels} countLabel={countLabel} />
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
  featured: GlossaryBrowserItem[];
  rest: GlossaryBrowserItem[];
  total: number;
};

/**
 * Atlasın bir kategorisi. Öne çıkan üç terim satır olarak (kart içinde
 * kart değil: blok kendisi yüzey, satırlar tonla ayrılıyor), kalanı
 * `details` içinde iki sütunlu bir ad dizini. Başlıktaki düğme kategoriyi
 * süzgeç olarak açıyor: orada her terimin tanım cümlesi de görünüyor.
 */
function AtlasBlock({
  group,
  order,
  labels,
  countLabel,
  onOpen,
}: {
  group: Group;
  order: number;
  labels: { openCategory: string; moreTerms: string };
  countLabel: (count: number) => string;
  onOpen: () => void;
}) {
  const Icon = GLOSSARY_CATEGORY_ICONS[group.key];
  return (
    <section
      aria-labelledby={`sozluk-${group.key}`}
      className={styles.atlasBlock}
      data-motion-reveal
      style={{ "--tile": order } as CSSProperties}
    >
      <div className={styles.atlasHead}>
        <span aria-hidden className={styles.sectionIcon}>
          <Icon size={20} weight="duotone" />
        </span>
        <div className="min-w-0">
          <h2 id={`sozluk-${group.key}`}>{group.label}</h2>
          <span className={`${styles.atlasCount} numeral`}>{countLabel(group.total)}</span>
        </div>
        <button type="button" onClick={onOpen} className={styles.atlasOpen}>
          {labels.openCategory}
          <ArrowRight aria-hidden size={14} weight="bold" />
        </button>
      </div>

      <ol className={styles.atlasFeatured} data-motion-stagger>
        {group.featured.map((item) => (
          <li key={item.slug} data-lead={item.featured === 1 ? "" : undefined}>
            <Link href={`/sozluk/${item.slug}`} prefetch={false} className={styles.atlasTerm}>
              <TermMark motif={item.motif} size={item.featured === 1 ? "lg" : "md"} draw />
              <span className="min-w-0">
                <span className={styles.atlasName}>{item.term}</span>
                <span className={styles.atlasShort}>{item.short}</span>
              </span>
              <ArrowRight aria-hidden size={15} weight="bold" className={styles.atlasArrow} />
            </Link>
          </li>
        ))}
      </ol>

      {group.rest.length > 0 && (
        <details className={styles.atlasMore}>
          <summary>
            <span className="numeral">{labels.moreTerms.replace("{count}", String(group.rest.length))}</span>
            <CaretDown aria-hidden size={14} weight="bold" className={styles.atlasCaret} />
          </summary>
          <ul className={styles.atlasList}>
            {group.rest.map((item) => (
              <li key={item.slug}>
                <Link href={`/sozluk/${item.slug}`} prefetch={false} className={styles.atlasLink}>
                  {item.term}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Süzgeç açıkken bir kategorinin eşleşmeleri — öne çıkanlar kartta, kalanı ızgarada. */
function ResultSection({
  group,
  labels,
  countLabel,
}: {
  group: Group;
  labels: { links: string };
  countLabel: (count: number) => string;
}) {
  const Icon = GLOSSARY_CATEGORY_ICONS[group.key];
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
      <div className={styles.sectionHead}>
        <span aria-hidden className={styles.sectionIcon}>
          <Icon size={20} weight="duotone" />
        </span>
        <h2 id={`sozluk-${group.key}`}>{group.label}</h2>
        <span className={`${styles.sectionCount} numeral`}>{countLabel(group.total)}</span>
      </div>

      {group.featured.length > 0 && (
        <ul className={styles.featured} data-count={group.featured.length}>
          <AnimatePresence initial={false} mode="popLayout">
            {group.featured.map((item) => {
              const lead = item.featured === 1 && group.featured.length === 3;
              return (
                <motion.li
                  key={item.slug}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className={styles.featureItem}
                  data-lead={lead ? "" : undefined}
                >
                  <Link href={`/sozluk/${item.slug}`} prefetch={false} className={styles.featureCard}>
                    <TermMark motif={item.motif} size={lead ? "lg" : "md"} draw />
                    <span className={styles.featureTerm}>{item.term}</span>
                    <span className={styles.featureShort}>{lead && item.lede ? item.lede : item.short}</span>
                    <span className={styles.featureMeta}>
                      <span className={styles.featureLinks}>
                        <Graph aria-hidden size={14} weight="bold" />
                        <span className="numeral">{labels.links.replace("{count}", String(item.links))}</span>
                      </span>
                      {item.related.length > 0 && (
                        <span className={styles.featureRelated}>{item.related.join(", ")}</span>
                      )}
                      <ArrowRight aria-hidden size={15} weight="bold" className={styles.featureArrow} />
                    </span>
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {group.rest.length > 0 && (
        <ul className={styles.compact}>
          <AnimatePresence initial={false} mode="popLayout">
            {group.rest.map((item) => (
              <motion.li
                key={item.slug}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.26, ease: EASE }}
                className="min-w-0"
              >
                <Link href={`/sozluk/${item.slug}`} prefetch={false} className={styles.termLink}>
                  <TermMark motif={item.motif} size="sm" />
                  <span className="min-w-0">
                    <span className={styles.termName}>{item.term}</span>
                    <span className={styles.termShort}>{item.short}</span>
                  </span>
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.section>
  );
}
