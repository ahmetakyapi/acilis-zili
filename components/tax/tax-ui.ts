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

/**
 * ÖRNEK İŞLEM (18 Ekim) — "Nasıl Hesaplanır" panelinin çalışılmış örneği ve
 * hesaplayıcının "Örnekle Dene" düğmesi aynı işlemi anlatıyor.
 *
 * Sembol bilerek GERÇEK DEĞİL (`ORNEK` / `SAMPLE`, sözlükte): gerçek bir
 * hissenin o günkü fiyatını uydurmak, sayfada hiç gerçekleşmemiş bir işlem
 * kaydı bırakırdı. Adet ve fiyatlar okuyucunun yazacağı türden girdi.
 *
 * Kurlar ve Yİ-ÜFE oranı YALNIZCA anlatımda kullanılıyor; yuvarlak ve
 * varsayımsal sayılar, panel bunu künyesinde söylüyor. Hesaplayıcıya
 * doldurulan örnek ise gerçek TCMB bültenleriyle hesaplanıyor (tarihler iş
 * günü: 15 Mart 2024 Cuma, 15 Haziran 2026 Pazartesi), yani iki sonuç farklı
 * çıkar: anlatım aritmetiği gösteriyor, hesaplayıcı sonucu.
 */
export const TAX_EXAMPLE = {
  quantity: 10,
  buyPrice: 150,
  sellPrice: 210,
  buyDate: "2024-03-15",
  sellDate: "2026-06-15",
  /** Yalnız anlatımda: varsayımsal kurlar ve endeks oranı. */
  buyRate: 32,
  sellRate: 40,
  indexRatio: 1.45,
} as const;
