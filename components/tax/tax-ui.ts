/**
 * Sayfanın üç panelinin başlık sınıfı (Tax.module.css → `.panelHead`).
 *
 * Ayrı ve `"use client"` OLMAYAN bir modülde: sabit hem istemci
 * hesaplayıcıda hem sunucu sayfasında okunuyor. İstemci modülünden dışa
 * aktarılan bir değer sunucu bileşenine dize olarak değil istemci
 * referansı olarak gelir (CLAUDE.md "İstemci ile sunucu sınırı").
 */
export const PANEL_TITLE = "display-ink display-ink-tight w-fit text-heading font-bold tracking-[-0.02em]";
