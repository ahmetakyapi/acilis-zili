/**
 * Sayfanın üç panelinin başlık sınıfı (Tax.module.css → `.panelHead`).
 *
 * Ayrı ve `"use client"` OLMAYAN bir modülde: sabit hem istemci
 * hesaplayıcıda hem sunucu sayfasında okunuyor. İstemci modülünden dışa
 * aktarılan bir değer sunucu bileşenine dize olarak değil istemci
 * referansı olarak gelir (CLAUDE.md "İstemci ile sunucu sınırı").
 */
export const PANEL_TITLE = "display-ink display-ink-tight w-fit text-heading font-bold tracking-[-0.02em]";

/**
 * Hesaplayıcının satır biçimi. Burada, çünkü iki istemci modülü paylaşıyor:
 * hesaplayıcının kendisi ve ekstreden aktarımın önizlemesi
 * (`StatementImport`, ayrı bir parça olarak yükleniyor). Alanlar METİN:
 * okuyucunun yazdığı hâl, sayıya hesap anında çevriliyor.
 */
export type TradeRow = {
  id: string;
  side: "buy" | "sell";
  symbol: string;
  date: string;
  quantity: string;
  price: string;
  commission: string;
};

export type DividendRow = {
  id: string;
  symbol: string;
  date: string;
  gross: string;
  /**
   * "statement": ekstrede yazan kesinti oranı (`statementPct`). Aracı kurum
   * %20 ya da %30'dan farklı bir oran kestiyse hesaplayıcı onu kullanıyor;
   * iki hazır seçenekten birine yuvarlamak ekstrede olmayan bir sayı olurdu.
   */
  withholding: "w8ben" | "none" | "statement";
  statementPct: number | null;
};
