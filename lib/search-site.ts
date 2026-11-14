import { NAV_ITEMS } from "@/components/layout/nav-items";
import { glossaryTerms } from "@/content/glossary";
import { THEMES, themeDek, themeTitle } from "@/content/themes";
import { INVESTORS, investorFirm } from "@/lib/investors";
import type { Locale } from "@/lib/i18n/config";
import tr from "@/lib/i18n/dictionaries/tr";
import en from "@/lib/i18n/dictionaries/en";
import { indexSite, type SiteEntry, type SiteIndex } from "@/lib/search-catalog";

/* ==========================================================================
   ⌘K — site içi katalog (14 Kasım)

   Paletin aradığı dört türün kayıtları, eldeki durağan kaynaklardan: yeni
   tablo, sağlayıcı ya da elle tutulan ikinci bir liste YOK.

   - Sayfalar: `NAV_ITEMS` (masthead, "Daha Fazla" ve /menu'nün okuduğu
     dizi) + gezinmede satırı olmayan birkaç ekran (`EXTRA_PAGES`). Menüye
     yeni ekran eklenince aramaya da girer; eşanlamlıları sözlükte
     (`searchPalette.keywords`), eksik kalırsa `tests/search-site.test.ts`
     düşer.
   - Sözlük: `content/glossary` — terim, tanımın başı, otomatik bağlantının
     yüzey biçimleri (`match`: "F/K", "fiyat/kazanç") eşanlamlı olarak.
   - Temalar: `content/themes.ts`.
   - Yatırımcılar: `lib/investors.ts`.

   SUNUCUDA KALIR. Bu modül sözlüğün tamamını ve iki dilin metinlerini
   içeri alıyor; palet (istemci) onu İÇE AKTARMAZ, yalnız uç okur
   (`app/api/search/route.ts`). Eşleştirme ve sıra `lib/search-catalog.ts`te.

   Dil sözlükleri `getDictionary` ile değil doğrudan okunuyor: `lib/i18n`
   `next/headers`ı içeri alıyor ve bu modül testte Next olmadan çalışıyor.
   ========================================================================== */

type Dictionary = typeof tr;
const DICTIONARIES: Record<Locale, Dictionary> = { tr, en };

type PageSource = {
  href: string;
  label: (t: Dictionary) => string;
  hint?: (t: Dictionary) => string;
  gate?: "risk";
};

/**
 * Gezinme dizisinde ikinci satırı (ipucu) olmayan iki öğenin ipucu.
 * Paletin satırı iki satırlı; tek satır kalan sayfa listede hizayı bozar.
 */
const NAV_HINTS: Record<string, (t: Dictionary) => string> = {
  "/": (t) => t.searchPalette.hints.today,
  "/menu": (t) => t.searchPalette.hints.menu,
};

/**
 * Gezinme dizisinde satırı olmayan ama okurun adıyla arayacağı ekranlar.
 * Kişisel ve oturum isteyen sayfalar (yazılarım, zil raporu) yok: misafire
 * giriş duvarı gösteren sonuç, sonuç değil. Ayarlar misafire de açık (tema,
 * dil).
 */
const EXTRA_PAGES: readonly PageSource[] = [
  {
    href: "/bulmaca/hangisi-buyuk",
    label: (t) => t.stockPuzzle.games.biggerTitle,
    hint: (t) => t.searchPalette.hints.bigger,
  },
  { href: "/ayarlar", label: (t) => t.nav.settings, hint: (t) => t.menu.hintSettings },
  { href: "/hakkinda", label: (t) => t.about.title, hint: (t) => t.searchPalette.hints.about },
];

/** Aranan sayfalar — gezinme dizisi + ekler. Test ve katalog buradan okur. */
export const SITE_PAGES: readonly PageSource[] = [
  ...NAV_ITEMS.map((item) => ({
    href: item.href,
    label: item.label,
    hint: item.hint ?? NAV_HINTS[item.href],
    gate: item.gate,
  })),
  ...EXTRA_PAGES,
];

/** Tanımın palete giden kısmı: satır tek satır ve kırpılıyor, tamamı yük. */
const DETAIL_MAX = 110;

function clip(text: string): string {
  if (text.length <= DETAIL_MAX) return text;
  const cut = text.slice(0, DETAIL_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export function siteEntries(locale: Locale): SiteEntry[] {
  const t = DICTIONARIES[locale];
  const keywords: Record<string, readonly string[]> = t.searchPalette.keywords;

  const pages: SiteEntry[] = SITE_PAGES.map((page) => ({
    kind: "page",
    href: page.href,
    title: page.label(t),
    detail: page.hint?.(t) ?? "",
    keywords: keywords[page.href] ?? [],
    ...(page.gate ? { gate: page.gate } : {}),
  }));

  const glossary: SiteEntry[] = glossaryTerms(locale).map((term) => ({
    kind: "glossary",
    href: `/sozluk/${term.slug}`,
    title: term.term,
    detail: clip(term.definition),
    /* Slug da aranır: Türkçe kısaltma İngilizce arayüzde de bulur ("fk"). */
    keywords: [...term.match, term.slug],
  }));

  const themes: SiteEntry[] = THEMES.map((theme) => ({
    kind: "theme",
    href: `/temalar/${theme.slug}`,
    title: themeTitle(theme, locale),
    detail: clip(themeDek(theme, locale)),
    /* Öteki dildeki ad da: İngilizce arayüzde "yapay zeka" yazan okur. */
    keywords: [theme.titleTr, theme.titleEn, theme.slug],
  }));

  const investors: SiteEntry[] = INVESTORS.map((investor) => ({
    kind: "investor",
    href: `/yatirimcilar/${investor.slug}`,
    title: investor.name,
    detail: investorFirm(investor, locale),
    /* Soyadı tek başına TAM eşleşme sayılsın ("buffett"); kurum adıyla da
       bulunur ("berkshire", "scion"). */
    keywords: [investor.name.split(" ").at(-1) ?? investor.name, investor.firm, investor.firmEn ?? ""],
  }));

  return [...pages, ...glossary, ...themes, ...investors];
}

/* Dizin dil başına bir kez kurulur ve süreç boyunca yaşar: kaynakların
   hepsi derlemeyle gelen durağan modüller, bayatlayacak bir şey yok. */
const INDEX = new Map<Locale, SiteIndex>();

export function siteIndex(locale: Locale): SiteIndex {
  let index = INDEX.get(locale);
  if (!index) {
    index = indexSite(siteEntries(locale));
    INDEX.set(locale, index);
  }
  return index;
}
