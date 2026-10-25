/**
 * Rehber ilerlemesi — saf mantık (25 Ekim, öğrenme araçlarının görsel turu).
 *
 * Okunan yazılar YALNIZ okurun tarayıcısında tutulur (hesap yok, sunucuya
 * gitmez): depo `components/guide/guide-progress-store.ts`. Bu modül
 * deponun ham dizesini çözer ve yol haritasının sorduğu üç şeyi hesaplar:
 * bölüm başına kaç yazı okundu, toplam kaç, sıradaki okunmamış yazı hangisi.
 * `"use client"` DEĞİL: sunucu da (testler de) aynı fonksiyonları okur.
 *
 * Depo elle bozulabilir ya da eski bir sürümden kalmış olabilir; çözücü
 * dizi olmayanı, dize olmayanı ve artık müfredatta bulunmayan adı sessizce
 * atar. Boş ya da okunamayan depo "hiç okunmamış" demektir, hata değil.
 */

/** Depoda tutulan en fazla ad — müfredat 31 yazı; elle şişirilmiş depoya tavan. */
export const READ_LIST_CAP = 200;

export function parseReadList(raw: string | null | undefined, known?: ReadonlySet<string>): string[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) continue;
    if (known && !known.has(item)) continue;
    seen.add(item);
    if (seen.size >= READ_LIST_CAP) break;
  }
  return [...seen];
}

/** Okunan listeye bir ad ekler; zaten varsa aynı diziyi döndürür (yazma gereksiz). */
export function withRead(list: readonly string[], slug: string): readonly string[] {
  if (list.includes(slug)) return list;
  return [...list, slug].slice(-READ_LIST_CAP);
}

export type ProgressArticle = { slug: string; topic: string };

export type TopicProgress = { topic: string; read: number; total: number };

/** Konu başına okunan / toplam — konular müfredattaki ilk görünüş sırasıyla. */
export function topicProgress(articles: readonly ProgressArticle[], read: ReadonlySet<string>): TopicProgress[] {
  const byTopic = new Map<string, TopicProgress>();
  for (const article of articles) {
    const entry = byTopic.get(article.topic) ?? { topic: article.topic, read: 0, total: 0 };
    entry.total += 1;
    if (read.has(article.slug)) entry.read += 1;
    byTopic.set(article.topic, entry);
  }
  return [...byTopic.values()];
}

/**
 * Sıradaki okunmamış yazı — müfredat sırasında ilk okunmamış. Hiç okunmamışsa
 * `null` (okur henüz başlamadı: "Baştan Başla" zaten kapakta), hepsi
 * okunmuşsa da `null`.
 */
export function nextUnread<T extends ProgressArticle>(articles: readonly T[], read: ReadonlySet<string>): T | null {
  if (read.size === 0) return null;
  return articles.find((article) => !read.has(article.slug)) ?? null;
}

/**
 * Bölümün seviye aralığı, sıra numarası olarak — yol haritasındaki üç
 * basamaklı seviye çubuğu (Temel · Orta · İleri) hangi basamakların dolu
 * çizileceğini buradan okur. `order` kolaydan zora tüm seviyeler, `levels`
 * bölümde gerçekten geçenler. Bölümde tanınan seviye yoksa `null`: çubuk
 * basılmaz, boş bir çubuk "seviyesiz" diye yanlış okunurdu.
 */
export function levelRange(levels: readonly string[], order: readonly string[]): [number, number] | null {
  const indexes = levels.map((level) => order.indexOf(level)).filter((index) => index >= 0);
  if (indexes.length === 0) return null;
  return [Math.min(...indexes), Math.max(...indexes)];
}
