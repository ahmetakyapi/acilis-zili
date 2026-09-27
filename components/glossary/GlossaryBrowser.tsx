"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { foldForSearch } from "@/lib/search-fold";
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
 */

export type GlossaryBrowserItem = {
  slug: string;
  term: string;
  category: string;
  short: string;
  /** Adın ve biçimlerin katlanmış hâli — sunucuda bir kez kuruluyor. */
  haystack: string;
};

export type GlossaryBrowserGroup = { key: string; label: string };

export function GlossaryBrowser({
  items,
  groups,
  locale,
  labels,
}: {
  items: GlossaryBrowserItem[];
  groups: GlossaryBrowserGroup[];
  locale: string;
  labels: {
    filterLabel: string;
    filterPlaceholder: string;
    categoryLabel: string;
    allCategories: string;
    noResults: string;
    count: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const deferred = useDeferredValue(query);

  const needle = foldForSearch(deferred, locale);
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === null || item.category === category) &&
          (needle === "" || item.haystack.includes(needle)),
      ),
    [items, category, needle],
  );

  const byGroup = groups
    .map((group) => ({
      ...group,
      items: visible.filter((item) => item.category === group.key),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <label className={styles.searchField}>
          <MagnifyingGlass aria-hidden size={17} />
          <span className="sr-only">{labels.filterLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={labels.filterPlaceholder}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
          />
        </label>
        {/* ÇİPLER DÜĞME, BAĞLANTI DEĞİL — süzgeç adrese yazılmıyor
            (gerekçe dosya başında). Dar ekranda satır atlıyor; sekiz
            kategori iki-üç satıra sığıyor, kaydırma gerekmiyor. */}
        <div role="group" aria-label={labels.categoryLabel} className="flex flex-wrap gap-2">
          {[{ key: null, label: labels.allCategories }, ...groups].map((group) => {
            const active = category === group.key;
            return (
              <button
                key={group.key ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(group.key)}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-[11px] py-[5px] text-tiny transition-colors sm:min-h-8",
                  active
                    ? "bg-primary font-semibold text-on-primary"
                    : "bg-surface-elevated text-body hover:text-strong",
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>
        <p className="text-tiny text-muted" aria-live="polite">
          {labels.count.replace("{count}", String(visible.length))}
        </p>
      </div>

      {byGroup.length === 0 ? (
        <Panel className="px-4 py-6 sm:px-5">
          <p className="text-base text-body">{labels.noResults}</p>
        </Panel>
      ) : (
        byGroup.map((group) => (
          <Panel key={group.key}>
            <PanelHeader
              title={group.label}
              meta={labels.count.replace("{count}", String(group.items.length))}
            />
            <ul className={styles.termGrid}>
              {group.items.map((item) => (
                <li key={item.slug} className="min-w-0">
                  <Link
                    href={`/sozluk/${item.slug}`}
                    prefetch={false}
                    className={styles.termLink}
                  >
                    <span className="block text-base font-bold text-strong">{item.term}</span>
                    <span className="mt-0.5 line-clamp-2 block text-small leading-snug text-muted">
                      {item.short}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
