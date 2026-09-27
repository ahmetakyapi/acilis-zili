/**
 * Yazı gövdelerinde OTOMATİK İÇ BAĞLANTI — sözlük terimi ve hisse sembolü.
 *
 * NEDEN: Mercek yazıları ve rehber her gün F/K'dan, getiri eğrisinden,
 * RSI'dan bahsediyor ama okuyucu kavramı bilmiyorsa yazının dışına, bir
 * arama motoruna çıkıyordu. Sözlük sayfaları (`/sozluk/[terim]`) bu açığı
 * kapatıyor; bağlantıyı yazarın elle koyması ise rutinle üretilen metinde
 * hiçbir zaman olmayacaktı. Bağlantıyı çizim koyuyor.
 *
 * TUTUCU OLMASI BİR TASARIM KARARI. Yanlış bir bağlantı hiç bağlantı
 * olmamasından pahalı: "desteklemek" fiilinin destek seviyesine,
 * "yapay zekâ (AI)" parantezinin C3.ai'ın hisse sayfasına gitmesi okuyucuya
 * sitenin metni anlamadığını söyler. Bu yüzden:
 *
 *   - Her hedef yazı boyunca YALNIZCA İLK geçtiği yerde bağlanır. On beş
 *     kez altı çizili "F/K" bir metni okunmaz yapar.
 *   - Büyük harf taşıyan biçim (RSI, F/K, TÜFE) birebir aranır; ancak
 *     kesme işaretli ekle genişler: "F/K'sı", "RSI'ın". "RSIs" eşleşmez.
 *   - Küçük harfli biçim ("getiri eğrisi") büyük/küçük harfe duyarsız
 *     aranır ve Türkçede en çok `TR_SUFFIX_MAX` harflik eki kapsar
 *     ("getiri eğrisinin"); daha uzun bir devam başka bir kelimedir.
 *     İngilizcede yalnızca çoğul eki (-s, -es).
 *   - Sembol YALNIZCA açık kalıpta: `$NVDA` ya da parantez içinde tek
 *     başına "(NVDA)". Düz metindeki büyük harfli kelime sembol sayılmaz
 *     ("ABD", "FED", "ON" hepsi bir şey olabilir). Sembol bilinen sembol
 *     kümesinde olmalı ve en az `SYMBOL_MIN` harf taşımalı.
 *   - Uzun eşleşme kısa olanı yutar: "ters getiri eğrisi" varken içindeki
 *     "getiri eğrisi" ayrı bağlanmaz. Daha önce bağlanmış bir terimin
 *     sonraki geçişi de ALANINI korur — yoksa ikinci "ters getiri eğrisi"nin
 *     içindeki "getiri eğrisi" yanlış hedefe bağlanırdı.
 *
 * Saf modül: React bilmiyor, veritabanı bilmiyor. Çizim tarafı
 * (`ArticleBody`) parçaları bağlantıya çeviriyor; bu dosya yalnızca
 * "nerede, nereye" sorusunu cevaplıyor ve `tests/autolink.test.ts` onu
 * ölçüyor.
 */

export type AutoLinkTerm = {
  slug: string;
  /** O dildeki yüzey biçimleri — `content/glossary` → `match`. */
  forms: readonly string[];
};

export type AutoLinkPiece = string | { text: string; href: string };

export type AutoLinker = {
  /** Metni düz ve bağlantılı parçalara böler; hedefler yazı boyunca bir kez. */
  split(text: string): AutoLinkPiece[];
  /**
   * Yazarın kendi yazdığı bağlantı. Aynı hedefe ikinci bir bağlantı
   * verilmez: gövde "[NVDA](/hisse/NVDA)" diyorsa sonraki "(NVDA)" düz kalır.
   */
  claim(href: string): void;
};

/** Türkçe ekin en uzun hâli: "eğrisi|nin" 3, "arz|ından" 5. Daha uzunu
    başka bir kelime ("likidite|sizlik"). */
const TR_SUFFIX_MAX = 5;

/** "$X" ya da "(X)" tek harfliyse sembol sayılmaz — "(A)" bir madde imi. */
const SYMBOL_MIN = 2;

/**
 * Sembol kümesinde BULUNAN ama metinde neredeyse hiç sembol anlamında
 * geçmeyen kısaltmalar. "(AI)" C3.ai'ın, "(IT)" Gartner'ın, "(ON)" onsemi'nin
 * sembolü; Türkçe metinde üçü de başka bir şey demek. Liste yalnızca
 * parantez kalıbına uygulanıyor: `$AI` yazan yazar sembolü kastetmiştir.
 */
const PAREN_STOPLIST: ReadonlySet<string> = new Set([
  "AI", "IT", "ON", "ALL", "ARE", "NOW", "BE", "CAN", "SO", "GO", "HE", "IS",
  "ABD", "USA", "US", "EU", "AB", "UK", "IMF", "ECB", "BOJ", "FED", "SEC",
  "CEO", "CFO", "CTO", "IPO", "EPS", "ETF", "GDP", "CPI", "PCE", "PPI",
  "FOMC", "NFP", "PMI", "ISM", "GAAP", "ROE", "ROA", "YOY", "QOQ", "TL",
  "USD", "EUR", "TRY", "GPU", "CPU", "HBM", "AR", "VR", "EV", "ESG", "API",
]);

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const LETTER = /\p{L}/u;
const APOSTROPHES = new Set(["'", "\u2019"]);
/**
 * Önünde bu işaretler varsa eşleşme bir BİLEŞİĞİN parçası: "Yİ-ÜFE"nin
 * içindeki "ÜFE" ABD üretici fiyatlarına, "EV/EBITDA"nın içindeki "EBITDA"
 * tek başına FAVÖK'e gitmemeli. Uzun biçim sözlükte varsa zaten o kazanıyor;
 * bu kural sözlükte OLMAYAN bileşiklerin içini korur.
 */
const COMPOUND_JOINERS = new Set(["-", "/", "."]);
const SYMBOL_BODY = "[A-Z]{1,5}(?:\\.[A-Z])?";

type Candidate = { start: number; end: number; key: string; href: string };

/**
 * Metni dile göre küçültür — AYNI UZUNLUKTA. `toLowerCase()` "İ"yi iki kod
 * birimine ("i̇") çeviriyor ve indeksler kayıyordu; harf harf küçültüp
 * uzunluğu değişeni olduğu gibi bırakmak eşleşme konumlarını korur.
 */
export function lowerSameLength(text: string, locale: string): string {
  const tag = locale === "en" ? "en-US" : "tr-TR";
  let out = "";
  for (const ch of text) {
    const lower = ch.toLocaleLowerCase(tag);
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

/**
 * Eşleşmenin bittiği yerden ekleri yürür; kabul edilirse bağlantının
 * bittiği indeksi, edilmezse -1 döndürür.
 */
function extendEnd(
  text: string,
  end: number,
  exact: boolean,
  locale: string,
): number {
  let at = end;
  /* Kesme işaretli ek: "F/K'sı", "piyasa değeri'nin" değil ama "EPS'in".
     İki dilde de kabul — İngilizcede iyelik ("EPS's"). */
  if (APOSTROPHES.has(text[at] ?? "") && LETTER.test(text[at + 1] ?? "")) {
    at += 1;
    while (at < text.length && LETTER.test(text[at])) at += 1;
    return isWordChar(text[at]) ? -1 : at;
  }
  if (!exact) {
    if (locale === "en") {
      /* Yalnızca çoğul: "yield curves", "straddles". */
      if (text.startsWith("es", at) && !isWordChar(text[at + 2])) return at + 2;
      if (text[at] === "s" && !isWordChar(text[at + 1])) return at + 1;
    } else {
      let letters = 0;
      while (at < text.length && LETTER.test(text[at]) && letters <= TR_SUFFIX_MAX) {
        at += 1;
        letters += 1;
      }
      if (letters > TR_SUFFIX_MAX) return -1;
    }
  }
  return isWordChar(text[at]) ? -1 : at;
}

export function createAutoLinker({
  locale,
  terms,
  symbols,
  excludeTerm,
}: {
  locale: string;
  terms: readonly AutoLinkTerm[];
  /** Bilinen semboller (büyük harf). Boşsa sembol bağlantısı hiç yok. */
  symbols: ReadonlySet<string>;
  /** Kendi sözlük sayfasında terim kendine bağlanmaz. */
  excludeTerm?: string;
}): AutoLinker {
  const used = new Set<string>();
  if (excludeTerm) used.add(`t:${excludeTerm}`);

  const forms = terms.flatMap((term) =>
    term.forms
      .filter((form) => form.trim().length > 0)
      .map((form) => {
        const exact = form !== lowerSameLength(form, locale);
        return {
          key: `t:${term.slug}`,
          href: `/sozluk/${term.slug}`,
          exact,
          needle: exact ? form : lowerSameLength(form, locale),
        };
      }),
  );

  function termCandidates(text: string): Candidate[] {
    const lowered = lowerSameLength(text, locale);
    const out: Candidate[] = [];
    for (const form of forms) {
      const haystack = form.exact ? text : lowered;
      let from = 0;
      for (;;) {
        const start = haystack.indexOf(form.needle, from);
        if (start < 0) break;
        from = start + 1;
        const before = text[start - 1];
        if (isWordChar(before) || COMPOUND_JOINERS.has(before ?? "")) continue;
        const end = extendEnd(text, start + form.needle.length, form.exact, locale);
        if (end < 0) continue;
        out.push({ start, end, key: form.key, href: form.href });
      }
    }
    return out;
  }

  function symbolCandidates(text: string): Candidate[] {
    if (symbols.size === 0) return [];
    const out: Candidate[] = [];
    const accept = (symbol: string, paren: boolean) =>
      symbol.replace(".", "").length >= SYMBOL_MIN &&
      symbols.has(symbol) &&
      !(paren && PAREN_STOPLIST.has(symbol));

    for (const match of text.matchAll(new RegExp(`\\$(${SYMBOL_BODY})(?![A-Za-z0-9])`, "g"))) {
      const start = match.index;
      if (isWordChar(text[start - 1])) continue;
      const symbol = match[1];
      if (!accept(symbol, false)) continue;
      out.push({
        start,
        end: start + match[0].length,
        key: `s:${symbol}`,
        href: `/hisse/${symbol}`,
      });
    }
    for (const match of text.matchAll(new RegExp(`\\((${SYMBOL_BODY})\\)`, "g"))) {
      const symbol = match[1];
      if (!accept(symbol, true)) continue;
      /* Bağlantı parantezin İÇİNDE: parantez cümlenin noktalaması. */
      const start = match.index + 1;
      out.push({
        start,
        end: start + symbol.length,
        key: `s:${symbol}`,
        href: `/hisse/${symbol}`,
      });
    }
    return out;
  }

  return {
    claim(href) {
      const term = /^\/sozluk\/([^/?#]+)/.exec(href);
      if (term) used.add(`t:${decodeURIComponent(term[1])}`);
      const symbol = /^\/hisse\/([^/?#]+)/.exec(href);
      if (symbol) used.add(`s:${decodeURIComponent(symbol[1]).toUpperCase()}`);
    },

    split(text) {
      if (!text) return [text];
      const candidates = [...termCandidates(text), ...symbolCandidates(text)].sort(
        (a, b) => a.start - b.start || b.end - a.end,
      );
      const pieces: AutoLinkPiece[] = [];
      let cursor = 0;
      let blockedUntil = 0;
      for (const candidate of candidates) {
        if (candidate.start < blockedUntil) continue;
        /* Kullanılmış hedef de alanını tutuyor — gerekçe dosya başında. */
        blockedUntil = candidate.end;
        if (used.has(candidate.key)) continue;
        used.add(candidate.key);
        if (candidate.start > cursor) pieces.push(text.slice(cursor, candidate.start));
        pieces.push({
          text: text.slice(candidate.start, candidate.end),
          href: candidate.href,
        });
        cursor = candidate.end;
      }
      if (cursor < text.length) pieces.push(text.slice(cursor));
      return pieces.length > 0 ? pieces : [text];
    },
  };
}
