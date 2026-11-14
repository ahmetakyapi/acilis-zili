import { foldForSearch } from "@/lib/search-fold";

/* ==========================================================================
   ⌘K — site içi katalog araması (saf mantık)

   Palet yalnız sembol, rehber ve mercek buluyordu (14 Kasım). Sözlüğün yüz
   elli terimi, temalar, ünlü yatırımcılar ve araç sayfaları (Vergi
   Hesaplayıcı, Takvim, Hisse Tarayıcı…) paletten erişilemezdi: "stopaj" ya
   da "buffett" yazan okur "sonuç yok" görüyordu.

   Bu dosya YALNIZ eşleştirir ve sıralar: girdi düz kayıt listesi, çıktı
   türüne göre gruplu sonuç. Kataloğu kuran `lib/search-site.ts`, uç
   `app/api/search/route.ts`. Veritabanı, sağlayıcı, sözlük yok; testi
   `tests/search-catalog.test.ts`.

   KATALOG İSTEMCİYE GİTMEZ. Dört tür iki dilde ~200 kayıt ve tanım
   cümleleriyle birlikte onlarca kilobayt; arama uçta yapılır, palete yalnız
   eşleşen birkaç satır döner. Bu modül de istemci demetine girmez (palet
   yalnız tiplerini okur).
   ========================================================================== */

/** Türler — grupların eşitlikteki sırası da bu. */
export const SITE_KINDS = ["page", "glossary", "theme", "investor"] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export type SiteEntry = {
  kind: SiteKind;
  /** Dil öneksiz yol; öneki palet ekler (`withLocale`). */
  href: string;
  title: string;
  /** Satırın ikinci, soluk satırı. ARANMAZ (gerekçe `matchScore`). */
  detail: string;
  /** Başlıkta geçmeyen eşanlamlılar: "stopaj" → Vergi Hesaplayıcı. */
  keywords?: readonly string[];
  /** Kapılı ekran: uç, erişimi olmayana bu kaydı hiç döndürmez. */
  gate?: "risk";
};

/** Palete giden satır — katalog kaydının görünen dört alanı. */
export type SiteHit = Pick<SiteEntry, "kind" | "href" | "title" | "detail">;

/** Yanıttaki grup: tür, o dildeki Title Case başlık, satırlar. */
export type SiteGroup = { kind: SiteKind; label: string; hits: SiteHit[] };

/**
 * Tür başına tavan. Palet tek bir düz liste: sekiz sembol ve dört yazıyla
 * birlikte en çok 26 satır. Sayfa ve terim dörder (okurun aradığı çoğu zaman
 * ilk ikide), tema ve yatırımcı üçer (on tema, on altı kişi: daha fazlası
 * eşleşiyorsa sorgu zaten çok kısa).
 */
export const SITE_CAPS: Record<SiteKind, number> = { page: 4, glossary: 4, theme: 3, investor: 3 };

/** Tek harfte katalog aranmaz: yalnız sembol ön eki anlamlı. */
export const SITE_MIN_QUERY = 2;

/**
 * "İçerir" eşleşmesi için en kısa sorgu. İki harf ("ta") onlarca başlığın
 * ortasında geçer; kısa sorguda yalnız baştan eşleşme sayılır (sembol
 * aramasındaki "kısa sorguda ad araması yok" kuralının eşi, route.ts).
 */
const CONTAINS_MIN = 3;

type Folded = { spaced: string; compact: string };

/**
 * Kelime kelime katlar: "Fiyat/Kazanç Oranı (F/K)" → "fiyat kazanc orani f k".
 * Harf kuralı `foldForSearch` ile TEK: Türkçe küçültme (`tr-TR`; "İ" → "i",
 * "I" → "ı" → "i"), aksan ayıklama. Dil parametresi hep "tr": Türkçe
 * küçültme + noktasız "ı"nın noktalıya inmesi İngilizce metinde de doğru
 * sonucu verir ("Index" → "index"); `en-US` ile katlansaydı İngilizce
 * arayüzde yazılan "ISI" ile "ısı" ayrı düşerdi.
 */
export function foldWords(text: string): string {
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => foldForSearch(word, "tr"))
    .filter(Boolean)
    .join(" ");
}

function fold(text: string): Folded {
  const spaced = foldWords(text);
  return { spaced, compact: spaced.replaceAll(" ", "") };
}

/** Eşleşme kademesi: 0 tam, 1 önek, 2 bir kelimenin başı, 3 içerir. */
function tier(hay: Folded, needle: Folded): number | null {
  /* Bitişik hâl yalnız TAM ve ÖNEK kademesinde: "fk" → "F/K", "riskmasasi"
     → "Risk Masası". "İçerir"de bitişik aransaydı kelime sınırını aşan
     tesadüfler eşleşirdi ("risk masasi" içinde "kma"). */
  if (hay.spaced === needle.spaced || hay.compact === needle.compact) return 0;
  if (hay.spaced.startsWith(needle.spaced) || hay.compact.startsWith(needle.compact)) return 1;
  if (` ${hay.spaced}`.includes(` ${needle.spaced}`)) return 2;
  if (needle.compact.length >= CONTAINS_MIN && hay.spaced.includes(needle.spaced)) return 3;
  return null;
}

export type SiteIndexRow = { entry: SiteEntry; title: Folded; keys: Folded[]; order: number };
export type SiteIndex = readonly SiteIndexRow[];

/** Kataloğu bir kez katlar; uç dil başına saklar (`lib/search-site.ts`). */
export function indexSite(entries: readonly SiteEntry[]): SiteIndex {
  return entries.map((entry, order) => ({
    entry,
    title: fold(entry.title),
    keys: (entry.keywords ?? []).map(fold).filter((key) => key.compact),
    order,
  }));
}

/**
 * Kaydın puanı; küçük olan önde, eşleşmiyorsa `null`.
 *
 * SIRA: tam eşleşme > önek > kelime başı > içerir. Aynı kademede BAŞLIK
 * eşanlamlının önünde: 0 başlık tam, 1 eşanlamlı tam, 2 başlık önek, 3
 * eşanlamlı önek, 4/5 kelime başı, 6/7 içerir.
 *
 * İKİNCİ SATIR ARANMAZ. Sözlük tanımları birbirinin terimini anıyor:
 * "enflasyon" pek çok tanımda geçiyor ve terimin kendisi o yığının içinde
 * kaybolurdu. Tanımda geçip başlıkta geçmeyen kelime, gerekiyorsa eşanlamlı
 * olarak yazılır.
 */
function matchScore(row: SiteIndexRow, needle: Folded): number | null {
  let best: number | null = null;
  const title = tier(row.title, needle);
  if (title !== null) best = title * 2;
  for (const key of row.keys) {
    const found = tier(key, needle);
    if (found !== null && (best === null || found * 2 + 1 < best)) best = found * 2 + 1;
  }
  return best;
}

export type SiteResult = {
  /** Eşleşmesi olan türler; en iyi eşleşmesi iyi olan önde. */
  groups: { kind: SiteKind; hits: SiteEntry[] }[];
  /**
   * En iyi eşleşme TAM mı (başlık ya da eşanlamlı sorgunun kendisi).
   * Uç bunu, sorgu birebir bir sembol DEĞİLSE katalog gruplarını
   * sembollerin önüne almak için kullanır: "takvim" yazan okur ilk satırda
   * Takvim'i görür, adında "takvim" geçen bir şirketi değil. Önek yetmez:
   * "tes" Tesla'nın önüne bir sözlük terimini koymamalı.
   */
  exact: boolean;
};

const EMPTY: SiteResult = { groups: [], exact: false };

export function searchSite(
  index: SiteIndex,
  query: string,
  options: { caps?: Record<SiteKind, number>; allow?: (entry: SiteEntry) => boolean } = {},
): SiteResult {
  const needle = fold(query);
  if (needle.compact.length < SITE_MIN_QUERY) return EMPTY;
  const caps = options.caps ?? SITE_CAPS;

  const byKind = new Map<SiteKind, { row: SiteIndexRow; score: number }[]>();
  for (const row of index) {
    if (options.allow && !options.allow(row.entry)) continue;
    const score = matchScore(row, needle);
    if (score === null) continue;
    const list = byKind.get(row.entry.kind);
    if (list) list.push({ row, score });
    else byKind.set(row.entry.kind, [{ row, score }]);
  }

  const groups = SITE_KINDS.flatMap((kind) => {
    const list = byKind.get(kind);
    if (!list) return [];
    /* Eşit puanda kısa başlık önde ("Faiz", "Faiz Dışı Gelir"den önce:
       sorgu başlığın daha büyük kısmını karşılıyor), sonra katalog sırası. */
    list.sort(
      (a, b) =>
        a.score - b.score ||
        a.row.title.compact.length - b.row.title.compact.length ||
        a.row.order - b.row.order,
    );
    return [{ kind, best: list[0].score, hits: list.slice(0, caps[kind]).map((item) => item.row.entry) }];
  });
  /* `sort` kararlı: eşit en iyi puanda SITE_KINDS sırası korunur. */
  groups.sort((a, b) => a.best - b.best);

  return {
    groups: groups.map(({ kind, hits }) => ({ kind, hits })),
    exact: groups.length > 0 && groups[0].best <= 1,
  };
}
