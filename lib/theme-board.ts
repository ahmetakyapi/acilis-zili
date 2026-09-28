import { cache } from "react";
import type { LogoMember, SpreadPoint } from "@/components/themes/ThemeVisuals";
import { THEMES } from "@/content/themes";
import { getStatus, getSymbolNames } from "@/lib/data";
import { logoSrc } from "@/lib/logos";
import { getQuotes } from "@/lib/providers";
import { median, sameSessionMoves } from "@/lib/theme-stats";
import { spreadScale } from "@/lib/theme-view";
import { katilimMembers, katilimPool, themeRow } from "@/lib/themes-data";

/**
 * Temalar panosu — `/tema` dizininin ve ana sayfanın temalar bandının
 * ORTAK veri katmanı (28 Eylül).
 *
 * Hesap `/tema/page.tsx` içindeydi; ana sayfa da aynı sıralamayı
 * göstermeye başlayınca buraya taşındı. İki ekran aynı fonksiyonu okuyor,
 * yani "günün en güçlü teması" iki yerde iki ayrı cevap veremez.
 *
 * TEK KOTASYON ÇAĞRISI: bütün temaların üyeleri tek anahtarda soruluyor
 * (`getQuotes` sıralı sembol dizesiyle önbellekli). NVDA üç temada birden
 * duruyor; üç ayrı çağrı üç ayrı fiyat anı demekti ve aynı hisse aynı
 * ekranda üç medyana üç farklı yüzdeyle girebilirdi. `cache()` istek
 * içinde tek hesap: dizinin üç Suspense sınırı da ana sayfanın bandı da
 * aynı sonucu okuyor.
 */

export type ThemeCard = {
  theme: (typeof THEMES)[number];
  members: LogoMember[];
  /** Katılım listesi taranana kadar üye sayısı bilinmiyor. */
  count: number | null;
  /** Medyana giren (aynı seansı anlatan) üyelerin hareketi. */
  points: SpreadPoint[];
  basis: "session" | "lastClose" | null;
  median: number | null;
  up: number | null;
  down: number | null;
};

export type ThemeBoard = {
  cards: ThemeCard[];
  /** Dağılım şeritlerinin ortak ölçeği; yedekte bilinmiyor. */
  scale: number | null;
  leader: string | null;
  laggard: string | null;
};

/**
 * Yedek kartlar — sayısız, editoryal sırayla. Kartların metni ve elle
 * seçilmiş temaların logoları durağan (content/themes.ts, depodaki logo
 * dosyaları); yalnızca sayılar veriye bağlı. Yedek bu yüzden gerçek
 * ızgarayla aynı şekli basıyor ve sayılar inince hiçbir şey kaymıyor.
 */
export function themePlaceholders(): ThemeCard[] {
  return THEMES.map((theme) => ({
    theme,
    members:
      theme.symbols === "katilim"
        ? []
        : theme.symbols.map((symbol) => ({ symbol, logoUrl: logoSrc(symbol, null) })),
    count: theme.symbols === "katilim" ? null : theme.symbols.length,
    points: [],
    basis: null,
    median: null,
    up: null,
    down: null,
  }));
}

export const loadThemeBoard = cache(async function loadThemeBoard() {
  const status = await getStatus();
  const pool = await katilimPool();

  const all = [
    ...new Set(THEMES.flatMap((theme) => (theme.symbols === "katilim" ? pool : [...theme.symbols]))),
  ];
  const [quotesResult, names] = await Promise.all([
    getQuotes(all, status),
    getSymbolNames(all),
  ]);
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const cards: ThemeCard[] = await Promise.all(
    THEMES.map(async (theme) => {
      const members =
        theme.symbols === "katilim"
          ? await katilimMembers(pool, quotes, names)
          : [...theme.symbols];
      const rows = members.map((symbol) => themeRow(symbol, quotes, names, status));
      const moves = sameSessionMoves(rows);
      const values = moves?.values ?? [];
      return {
        theme,
        members: rows.map((row) => ({ symbol: row.symbol, logoUrl: row.logoUrl })),
        count: members.length,
        points: moves
          ? rows.flatMap((row, i) =>
              moves.included[i] ? [{ symbol: row.symbol, change: row.changePct! }] : [],
            )
          : [],
        basis: moves?.basis ?? null,
        median: moves ? median(values) : null,
        up: moves ? values.filter((value) => value > 0).length : null,
        down: moves ? values.filter((value) => value < 0).length : null,
      };
    }),
  );

  /* Sıralama ve ortak ölçek yalnızca AYNI SEANSI anlatan medyanlardan:
     son kapanışa kalmış bir temanın medyanı bu seansın medyanlarıyla aynı
     çizgiye konmuyor. */
  const sessionCount = cards.filter((card) => card.basis === "session").length;
  const scaleBasis: "session" | "lastClose" = sessionCount > 0 ? "session" : "lastClose";
  const comparable = cards.filter((card) => card.basis === scaleBasis && card.median !== null);
  const scale = spreadScale(comparable.flatMap((card) => card.points.map((point) => point.change)));

  /* Günün öne çıkanı yalnızca canlı seansta ve en az iki tema varken:
     son kapanışa "günün en güçlüsü" demek dünü bugün diye anlatmak olurdu. */
  const ranked = scaleBasis === "session" && comparable.length >= 2
    ? [...comparable].sort((a, b) => b.median! - a.median!)
    : [];

  const board: ThemeBoard = {
    cards,
    scale,
    leader: ranked[0]?.theme.slug ?? null,
    laggard: ranked.length > 1 ? ranked[ranked.length - 1].theme.slug : null,
  };
  return { board, scaleBasis, comparable, quotesResult };
});
