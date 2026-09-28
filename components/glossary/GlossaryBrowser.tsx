"use client";

import { useDeferredValue, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Graph, MagnifyingGlass, X } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GlyphTile } from "@/components/article/GlyphTile";
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
 * Terimlerin tamamı sunucuda basılıyor; JavaScript kapalıyken liste tam ve
 * süzgeçsiz çalışıyor.
 *
 * ARAMA HARF KATLAYARAK: "fk" F/K'yı, "cekirdek" Çekirdek Enflasyon'u,
 * "withholding" İngilizce sayfada stopajı buluyor. Terim adı, otomatik
 * bağlantı biçimleri ve tanımın ilk cümlesi aranıyor; tanımın tamamı değil
 * — "faiz" yazan birine faizden söz eden kırk terim döndürmek aramayı
 * işe yaramaz yapardı.
 *
 * ÜÇ SÜZGEÇ, TEK SONUÇ (28 Eylül). Kategori kutucukları, harf dizini ve
 * arama birlikte daralıyor. Harf dizini bir kâğıt sözlüğün sayfa kenarı:
 * o harfle başlayan terim yoksa düğme sönük ve basılamıyor, yani okuyucu
 * boş bir listeye hiç düşmüyor. Harfin sönük olup olmadığı öteki iki
 * süzgece göre hesaplanıyor ("Opsiyonlar"da D yalnızca Delta'yı açar).
 *
 * KOMPOZİSYON: her kategoride sözlüğün kendi ağında en çok başvurulan üç
 * terim büyük kartta (seçim sunucuda, `glossaryIncoming`), geri kalanı sıkı
 * bir ızgarada. 150 eş ağırlıklı satır taranmıyordu; öne çıkanlar "bu
 * kategoride önce neyi bilmeliyim" sorusunu cevaplıyor.
 *
 * HAREKET: süzgeç değişince kalan kartlar yeni yerlerine KAYIYOR (Motion
 * `layout="position"`), çıkanlar sönerek yer açıyor. Göz, aradığı terimin
 * listede nereye gittiğini izleyebiliyor; anında yeniden dizilen bir liste
 * her tuşta baştan okunuyordu. Hareketi azaltan okuyucuda kök sağlayıcı
 * (`MotionProvider`, `reducedMotion="user"`) kaymayı kapatıyor.
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
  /** Harf dizinindeki yeri (dile göre büyük harf; alfabe dışıysa "#"). */
  letter: string;
  glyph: string;
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

export function GlossaryBrowser({
  items,
  groups,
  letters,
  locale,
  hero,
  labels,
}: {
  items: GlossaryBrowserItem[];
  groups: GlossaryBrowserGroup[];
  letters: string[];
  locale: string;
  /** Kapağın metni (üst künye, başlık, açıklama) — sunucuda çiziliyor. */
  hero: ReactNode;
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
        {/* KATEGORİ KUTUCUKLARI KAPAĞIN SAĞINDA. Her kutucuk bir süzgeç ve
            aynı zamanda bir ölçü: çubuk kategorinin terim sayısını en
            kalabalık kategoriye göre çiziyor. Sayı gerçek, çubuk süs değil.
            Telefonda şerit yatay kayıyor; dokuz kutucuk alt alta 400
            piksel tutuyordu. */}
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
      </header>

      {/* ARAMA ŞERİDİ YAPIŞKAN (768 ve üstü). Liste 150 terim; aşağıda bir
          kategoriyi okurken aramaya ya da bir harfe dönmek için sayfanın
          başına çıkmak gerekiyordu. Telefonda yapışmıyor: başlık, şerit ve
          alt sekmeler birlikte okuma alanının dörtte birini yiyordu. */}
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
        {/* Sonuç alanının tamamı boşaldığında sayfa düzeyinde bir boş durum:
            CLAUDE.md'nin `EmptyState scene=` kalıbı, ararken bulunamayan
            için "searching" sahnesi. */}
        {byGroup.length === 0 ? (
          <EmptyState title={labels.noResults} hint={labels.noResultsHint} scene="searching" />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {byGroup.map((group) => {
              const Icon = GLOSSARY_CATEGORY_ICONS[group.key];
              return (
                <motion.section
                  key={group.key}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
                        {group.featured.map((item) => (
                          <motion.li
                            key={item.slug}
                            layout="position"
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                            className={styles.featureItem}
                            data-lead={item.featured === 1 && group.featured.length === 3 ? "" : undefined}
                          >
                            <Link href={`/sozluk/${item.slug}`} prefetch={false} className={styles.featureCard}>
                              <GlyphTile glyph={item.glyph} size={item.featured === 1 ? 56 : 44} />
                              <span className={styles.featureTerm}>{item.term}</span>
                              <span className={styles.featureShort}>
                                {item.featured === 1 && group.featured.length === 3 && item.lede ? item.lede : item.short}
                              </span>
                              <span className={styles.featureMeta}>
                                <span className={styles.featureLinks}>
                                  <Graph aria-hidden size={14} weight="bold" />
                                  <span className="numeral">
                                    {labels.links.replace("{count}", String(item.links))}
                                  </span>
                                </span>
                                {item.related.length > 0 && (
                                  <span className={styles.featureRelated}>{item.related.join(", ")}</span>
                                )}
                                <ArrowRight aria-hidden size={15} weight="bold" className={styles.featureArrow} />
                              </span>
                            </Link>
                          </motion.li>
                        ))}
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
                            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                            className="min-w-0"
                          >
                            <Link href={`/sozluk/${item.slug}`} prefetch={false} className={styles.termLink}>
                              <span className={styles.termName}>{item.term}</span>
                              <span className={styles.termShort}>{item.short}</span>
                            </Link>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                </motion.section>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
