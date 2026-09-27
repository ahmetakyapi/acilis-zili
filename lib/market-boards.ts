import "server-only";

import { cache } from "react";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import type { MarketStatus } from "@/lib/market-hours";

/**
 * Piyasalar ekranının fon panoları — sektörler ve emtia — ile Piyasa
 * Nabzı'nın ortak veri katmanı.
 *
 * ÜÇ PANEL, TEK TUR. Sektör tablosu 11, emtia 8 fonun günlük barını
 * istiyor; nabız da SPY ile TLT'nin. Her biri kendi listesini sorsaydı
 * `getChartBarsMulti` üç ayrı anahtarla üç tur Alpaca'ya giderdi ve aynı
 * sembolün iki panelde iki farklı yaşta barı olabilirdi. Liste burada
 * birleşiyor, istek içinde `cache()` ile bir kez çalışıyor
 * (CLAUDE.md "İstemci ile sunucu sınırı": aynı veri, aynı anahtar).
 */

type EtfEntry = {
  symbol: string;
  nameTr: string;
  nameEn: string;
};

/**
 * SPDR sektör fonları — S&P 500'ün on bir GICS sektörü.
 *
 * Fonlar sektörün VEKİLİ, kendisi değil: her biri sektördeki S&P 500
 * şirketlerini piyasa değeriyle tutuyor ve tek şirket ağırlığına tavan
 * uyguluyor (XLK'da iki devin payı kırpılıyor). Panel künyesi bunu yazar.
 * Adlar /sirketler şeridinin Türkçesiyle aynı (lib/sectors.ts).
 */
export const SECTOR_ETFS: readonly EtfEntry[] = [
  { symbol: "XLK", nameTr: "Teknoloji", nameEn: "Technology" },
  { symbol: "XLF", nameTr: "Finans", nameEn: "Financials" },
  { symbol: "XLV", nameTr: "Sağlık", nameEn: "Health Care" },
  { symbol: "XLY", nameTr: "Tüketim", nameEn: "Consumer Discretionary" },
  { symbol: "XLP", nameTr: "Temel Tüketim", nameEn: "Consumer Staples" },
  { symbol: "XLE", nameTr: "Enerji", nameEn: "Energy" },
  { symbol: "XLI", nameTr: "Sanayi", nameEn: "Industrials" },
  { symbol: "XLB", nameTr: "Hammadde", nameEn: "Materials" },
  { symbol: "XLU", nameTr: "Kamu Hizmetleri", nameEn: "Utilities" },
  { symbol: "XLRE", nameTr: "Gayrimenkul", nameEn: "Real Estate" },
  { symbol: "XLC", nameTr: "İletişim Hizmetleri", nameEn: "Communication Services" },
];

/**
 * Emtia — ETF VEKİLLERİYLE (28 Eylül).
 *
 * README uzun süre "Emtia yok" diyordu ve gerekçesi doğruydu: elimizde
 * spot altın, vadeli petrol ya da bakır fiyatı veren bir kaynak yok.
 * Brent kartı tam bu yüzden kaldırılmıştı — FRED'in spot serisi günlerce
 * geriden geliyordu ve ekranda bir haftalık fiyat büyük puntoyla
 * duruyordu (CLAUDE.md "Veri dürüstlüğü" 2).
 *
 * Dürüst çözüm, ABD borsasında işlem gören ve emtiayı izleyen fonlar:
 * fiyatları aynı konsolide beslemeden, aynı 15 dakikalık gecikmeyle,
 * aynı seans kuralıyla geliyor. Karşılığında satır EMTİANIN DEĞİL FONUN
 * fiyatını yazıyor — "GLD 245 $" bir ons altının fiyatı değil. Bu yüzden
 * her satırın adı fonun kendisi ("GLD · Altın ETF") ve fiyat sütunu
 * karşılaştırma çubuğu taşımıyor; yüzdeler ise gerçekten anlamlı.
 *
 * USO ve UNG vadeli kontrat tutuyor: vade yenileme maliyeti yüzünden uzun
 * dönemde spot fiyattan ayrışıyorlar. Künye bunu söylüyor.
 */
export const COMMODITY_ETFS: readonly EtfEntry[] = [
  { symbol: "GLD", nameTr: "Altın", nameEn: "Gold" },
  { symbol: "SLV", nameTr: "Gümüş", nameEn: "Silver" },
  { symbol: "USO", nameTr: "Ham Petrol", nameEn: "Crude Oil" },
  { symbol: "UNG", nameTr: "Doğal Gaz", nameEn: "Natural Gas" },
  { symbol: "CPER", nameTr: "Bakır", nameEn: "Copper" },
  { symbol: "DBA", nameTr: "Tarım", nameEn: "Agriculture" },
];

/**
 * Spot kripto fonları — ayrı grup. Kripto 7/24 işlem görüyor, fon ise
 * yalnızca borsa saatlerinde: fonun yüzdesi hafta sonunun hareketini
 * pazartesi açılışında topluca gösteriyor. Emtiayla aynı listede durunca
 * bu fark okunmuyordu.
 */
export const CRYPTO_ETFS: readonly EtfEntry[] = [
  { symbol: "IBIT", nameTr: "Bitcoin", nameEn: "Bitcoin" },
  { symbol: "ETHA", nameTr: "Ether", nameEn: "Ether" },
];

/** Nabzın momentum ve güvenli liman bileşenleri. */
export const SENTIMENT_BAR_SYMBOLS = ["SPY", "TLT"] as const;

const BOARD_QUOTE_SYMBOLS = [
  ...SECTOR_ETFS,
  ...COMMODITY_ETFS,
  ...CRYPTO_ETFS,
].map((entry) => entry.symbol);

const BOARD_BAR_SYMBOLS = [...BOARD_QUOTE_SYMBOLS, ...SENTIMENT_BAR_SYMBOLS];

/**
 * Bir yıllık günlük barlar — dönem getirileri ve nabız için.
 *
 * "1Y" aralığı 370 takvim günü geriye gidiyor: YBB tabanı (önceki yılın
 * son kapanışı) ve 125 günlük ortalamanın üstüne altı aylık bir sıra
 * penceresi (lib/sentiment.ts) buna sığıyor.
 */
export const loadBoardBars = cache(async function loadBoardBars(status: MarketStatus) {
  return getChartBarsMulti(BOARD_BAR_SYMBOLS, "1Y", status);
});

/** Fonların kotasyonu — 1G yüzdesi ve fiyat. Tek anahtar, tek tur. */
export async function loadBoardQuotes(status: MarketStatus) {
  return getQuotes(BOARD_QUOTE_SYMBOLS, status);
}
