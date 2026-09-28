import "server-only";

import type { CompanyCardRecord } from "@/components/ui/CompanyCard";
import { indexMemberOf } from "@/db/seed/indices";
import { companySector } from "@/lib/company-sector";
import { liveMarketCap, type SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { logoSrc } from "@/lib/logos";
import { displayBasis, quoteBasis, type MarketStatus } from "@/lib/market-hours";
import type { Quote } from "@/lib/providers/types";
import { industryLabel } from "@/lib/sectors";
import { formatMoneyCompact, formatPercent, formatPrice, SIGN_GAP } from "@/lib/utils";

/**
 * Şirket kartının kaydı — SUNUCUDA, biçimlenmiş dizelerle.
 *
 * Neden sunucuda: sektör server-only endeks tohumundan (`companySector`),
 * piyasa değeri canlı hesaptan (`liveMarketCap`), künye seans mantığından
 * (`quoteBasis`) geliyor. İstemciye yalnızca sonuç dizeleri iniyor.
 */

/** Yüzeyin kayda eklediği ya da değiştirdiği alanlar. */
export type CompanyCardExtra = {
  /**
   * Fiyatı YÜZEY veriyor (teknik fotoğrafın fiyatı gibi) — kotasyon yerine.
   * `basis` o fiyatın künyesi ("Analiz Anında"); verilmezse künye yok.
   */
  price?: { value: number | null; changePct: number | null; change?: number | null; basis?: string; live?: boolean };
  badge?: CompanyCardRecord["badge"];
  facts?: [string, string][];
  foot?: string;
};

export type CompanyCardContext = {
  names: Record<string, SymbolMeta>;
  /** Sayfanın KENDİ kotasyon paketi; null ise kartta fiyat yok. */
  quotes: Record<string, Quote> | null;
  /** Paket bugüne ait ama YAŞLI (`QuoteResult.stale`, bkz. `packCurrent`). */
  stale: boolean;
  status: MarketStatus;
  locale: Locale;
  t: Dictionary;
};

/** Sektör ve varsa alt sektör: "Bilgi Teknolojisi · Yarı İletkenler". */
function sectorLine(symbol: string, meta: SymbolMeta | undefined, locale: Locale): string | null {
  const sector = companySector(symbol, meta?.industry, locale);
  const sub = industryLabel(indexMemberOf(symbol)?.sub, locale);
  if (sector && sub && sub !== sector) return `${sector} · ${sub}`;
  return sector ?? sub;
}

function signedMoney(value: number, locale: Locale): string {
  const body = formatPrice(value, locale, { currency: true });
  return value > 0 ? `+${SIGN_GAP}${body}` : body;
}

export function companyCardRecord(
  symbol: string,
  ctx: CompanyCardContext,
  extra: CompanyCardExtra = {},
): CompanyCardRecord {
  const { names, quotes, stale, status, locale, t } = ctx;
  const meta = names[symbol];
  const quote = quotes?.[symbol];
  const card: CompanyCardRecord = { symbol };

  if (meta?.name) card.name = meta.name;
  /* Depoda logosu olan sembolde adres yazılmıyor: `LogoTile` onu sembolden
     buluyor. Yalnızca uzak adrese düşen sembol adres taşıyor. */
  const local = logoSrc(symbol, null);
  const remote = logoSrc(symbol, meta?.logoUrl ?? null);
  if (!local && remote) card.logo = remote;

  const sector = sectorLine(symbol, meta, locale);
  if (sector) card.sector = sector;

  /* Piyasa değeri sayfanın kotasyonuyla CANLI hesaplanıyor — aynı şirket
     iki ekranda iki piyasa değeri taşımasın (`/sirketler`, tema ekranı
     aynı fonksiyonu kullanıyor). Yalnızca USD; yabancı para biriminde
     `SymbolMeta.marketCap` zaten null. */
  const cap = liveMarketCap(meta, quote?.price);
  if (cap !== null && cap > 0) card.cap = formatMoneyCompact(cap, locale);

  const tone = (changePct: number | null, session: boolean) => {
    /* YÖN RENGİ YALNIZCA BU SEANSTA (Veri dürüstlüğü 4). Son kapanışı
       anlatan değişim nötr yazılıyor, künyesi adıyla söylüyor: yeşil ve
       kırmızı "bugün" der. Renk yalnızca işaretten — bir yargı değil. */
    if (!session || changePct === null || changePct === 0) return;
    card.dir = changePct > 0 ? "up" : "down";
  };

  if (extra.price) {
    const { value, changePct, change, basis, live } = extra.price;
    if (value !== null) {
      card.price = formatPrice(value, locale, { currency: true });
      if (changePct !== null) card.pct = formatPercent(changePct, locale);
      if (change !== null && change !== undefined) card.amount = signedMoney(change, locale);
      if (basis) card.basis = basis;
      tone(changePct, live ?? false);
    }
  } else if (quote) {
    /* KÜNYE SEANSI KANITLIYOR (CLAUDE.md "Veri dürüstlüğü" 4). Hangi seansı
       anlattığına `quoteBasis` karar veriyor — `isSessionTrade` üzerine
       kurulu tek kaynak; yeni bir kural yazılmıyor. */
    const basis = quoteBasis(quote, status);
    card.price = formatPrice(quote.price, locale, { currency: true });
    if (quote.changePct !== null) card.pct = formatPercent(quote.changePct, locale);
    if (quote.change !== null) card.amount = signedMoney(quote.change, locale);
    /* KÜNYE "ŞİMDİ"Yİ DE KANITLIYOR (28 Eylül denetimi): seans kapandıktan
       sonra "Seans İçi" yerine "Seans Kapanışı", yaşlı pakette "Son Fiyat"
       ve yön rengi yok — gerekçe `displayBasis` üzerinde. */
    const shown = displayBasis(basis, stale, status);
    card.basis =
      shown === "session"
        ? t.companyCard.session
        : shown === "sessionClose"
          ? t.companyCard.sessionClose
          : shown === "pre-market"
            ? t.companyCard.preMarket
            : shown === "after-hours"
              ? t.companyCard.afterHours
              : shown === "lastPrice"
                ? t.market.lastPrice
                : t.companyCard.lastClose;
    tone(quote.changePct, shown !== "lastClose" && shown !== "lastPrice");
  }

  if (extra.badge) card.badge = extra.badge;
  if (extra.facts?.length) card.facts = extra.facts;
  if (extra.foot) card.foot = extra.foot;
  return card;
}
