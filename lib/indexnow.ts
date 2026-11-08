import { after } from "next/server";
import { withLocale } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/config";
import { INDEXABLE, SITE_URL } from "@/lib/site";

/**
 * INDEXNOW (8 Kasım, sahibinin isteği: "görüntüleme almamız çok önemli";
 * kaynak: sayiyla.com "Google ve yapay zekâda nasıl çıkılır" § 8 — Bing'in
 * yapay zekâ özetleri ve Copilot atıfları için yeni ya da güncellenen
 * sayfanın IndexNow ile bildirilmesi öneriliyor).
 *
 * Yazma yolunda (`lib/content-write.ts`) yeni ya da DEĞİŞEN mercek, bülten
 * ve Günün Grafiği adresi Bing/Yandex/Seznam'ın ortak ucuna bildirilir.
 * Google IndexNow kullanmıyor; onun için site haritası (`app/sitemap.ts`)
 * ve gerçek `lastModified` yeterli.
 *
 * ANAHTAR SIR DEĞİL: protokol gereği herkese açık bir dosyada duruyor
 * (`public/<anahtar>.txt`, içeriği anahtarın kendisi) ve ucun sahiplik
 * kanıtı o dosya. Değiştirilirse dosya da aynı adla değişmeli.
 *
 * Yalnız dizine açık üretimde (`INDEXABLE`) ve üretim derlemesinde çalışır;
 * bildirim yanıtı beklemez (`after`), düşerse yazma işini etkilemez.
 */
export const INDEXNOW_KEY = "39163b52df27297ab6cfce66231be6e2";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Dil öneksiz yollar × diller → mutlak adresler (tekrarsız, sıralı). */
export function indexNowUrls(paths: readonly string[], locales: readonly Locale[]): string[] {
  const urls = new Set<string>();
  for (const path of paths) for (const locale of locales) urls.add(`${SITE_URL}${withLocale(path, locale)}`);
  return [...urls].sort();
}

/** Ucun beklediği gövde (protokol: host, key, keyLocation, urlList). */
export function indexNowBody(urls: readonly string[]) {
  return {
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: [...urls],
  };
}

async function send(urls: readonly string[]): Promise<void> {
  try {
    await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowBody(urls)),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
  } catch {
    /* Bildirim bir ipucu; düşerse site haritası aynı adresi zaten taşıyor. */
  }
}

/** Yeni ya da değişen adresleri bildir — yanıtı beklemeden. */
export function notifyIndexNow(urls: readonly string[]): void {
  if (!INDEXABLE || process.env.NODE_ENV !== "production" || urls.length === 0) return;
  try {
    after(() => send(urls));
  } catch {
    /* İstek kapsamı dışı (betik): doğrudan, beklemeden. */
    void send(urls);
  }
}
