import { CompanyCardData } from "@/components/ui/CompanyCard";
import { companyCardRecord, type CompanyCardExtra } from "@/lib/company-card";
import { getStatus, getSymbolNames, type SymbolMeta } from "@/lib/data";
import { getI18n, type Dictionary } from "@/lib/i18n";
import type { MarketStatus } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import type { Quote } from "@/lib/providers/types";

/**
 * Bir yüzeyin şirket kartı kayıtları — sunucuda hazırlanıp tek istemci
 * kartına (`CompanyCardHost`) veri olarak iniyor. HTML'e düğüm basmıyor.
 *
 * NEREDEN GELİYOR, NEREYE GİDİYOR. Logolar ve karolar yalnızca
 * `data-cc={sembol}` taşıyor (`LogoTile card`, ya da bağlantının kendisinde
 * öznitelik); bu bileşen aynı sayfaya sembol başına bir kayıt bırakıyor.
 * Gerekçe ve bedel `CompanyCard.tsx` başında.
 *
 * KOTASYON SAYFANIN KENDİSİNDEN. Yüzeyin elinde bir paket varsa `quotes`
 * ile veriyor: kart karonun yanında AYNI sayıyı yazmalı (CLAUDE.md "aynı
 * sayı iki yerde aynı kaynaktan"). Paket verilmezse (`undefined`) bu
 * bileşen sembollerin kotasyonunu kendisi soruyor — yalnızca fiyat
 * göstermeyen yüzeyler (logo mozaiği, yatırımcı portföyü) için; oralarda
 * yan yana duran ikinci bir yüzde yok. `null` "fiyatsız kart" demek.
 * Kendi soran çağrı yerleri kaydı `<Suspense fallback={null}>` içinde
 * basıyor: kotasyon turu sayfanın ilk baytını bekletmesin.
 *
 * ÖLÇÜM (28 Eylül, üretim derlemesi, tarayıcının aldığı HTML, gzip -9).
 * Sayfanın tamamı canlı veriyle aynı derlemede istekten isteğe ±2 KB
 * oynuyor (/piyasalar üç ardışık istekte 68.387 / 72.460 / 70.049), o
 * yüzden bedel kayıtların sayfadan çıkarılmasıyla ölçüldü (marjinal gzip):
 *   /piyasalar             78 kayıt  5.883 B — ama ısı haritasının 30 hücre
 *                          kartı kalktı: ham HTML 819 KB → ~744 KB, sayfanın
 *                          gzip'i önce 68.998, sonra 68.387-72.460 (gürültü içinde)
 *   /yatirimcilar          43 kayıt  2.254 B (sayfa 40.438 → 43.417)
 *   /tema/siber-guvenlik   40 kayıt  2.322 B (sayfa 34.425 → 37.025)
 *   /tema                  66 kayıt  2.827 B
 *   /teknik                15 kayıt    906 B (eski balon 1.602 B idi)
 *   /hisse/NVDA             8 kayıt    405 B
 * Kayıt başına ~45-75 B gzip; eski balon işaretlemesi logo başına ~110 B
 * idi. Kayıt YALNIZCA GÖRÜNEN logolar için basılıyor (açılır bölümdeki
 * satırlar, telefonda gizli yerleşim sayılmıyor).
 */
export async function CompanyCards({
  symbols,
  quotes,
  names,
  status,
  set,
  extras,
}: {
  symbols: readonly string[];
  /** Sayfanın paketi; `undefined` → kendisi sorar, `null` → fiyatsız. */
  quotes?: Record<string, Quote> | null;
  names?: Record<string, SymbolMeta>;
  status?: MarketStatus;
  /** Aynı sembolün bu yüzeye özgü kartı (bkz. `cardKey`). */
  set?: string;
  /** Yüzeye özgü satırlar; sözlüğü olmayan çağıran (alt ad alanıyla
      çalışan bir bileşen) etiketleri işlevle, tam sözlükten alır. */
  extras?: Record<string, CompanyCardExtra> | ((t: Dictionary) => Record<string, CompanyCardExtra>);
}) {
  const unique = [...new Set(symbols)];
  if (unique.length === 0) return null;
  const [{ locale, t }, marketStatus] = await Promise.all([
    getI18n(),
    status ? Promise.resolve(status) : getStatus(),
  ]);
  const [meta, pack] = await Promise.all([
    names ? Promise.resolve(names) : getSymbolNames(unique),
    quotes !== undefined ? Promise.resolve(quotes) : getQuotes(unique, marketStatus).then((result) => (result.ok ? result.data : null)),
  ]);
  const ctx = { names: meta, quotes: pack, status: marketStatus, locale, t };
  const extra = typeof extras === "function" ? extras(t) : extras;
  const cards = unique.map((symbol) => companyCardRecord(symbol, ctx, extra?.[symbol]));
  return <CompanyCardData cards={cards} set={set} />;
}
