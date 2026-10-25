import { asc, desc, sql } from "drizzle-orm";
import { db } from "./db";
import { stories } from "./schema";
import type { StoryIndexRow } from "./data";

/**
 * Mercek yazısının altındaki "Arşivden Diğer Yazılar" — ZAMAN KOMŞULARI
 * (25 Ekim).
 *
 * Önceden her yazı arşivin EN YENİ üç yazısını gösteriyordu, yani 160
 * yazının hepsi aynı üç adrese bağlanıyordu. Canlıda TR haritasındaki
 * sayfalar tek tek tarandı: 162 mercek yazısının 65'ine sitenin hiçbir
 * sayfasından bağlantı yoktu (yalnız site haritası ve `?adet=` zinciri),
 * medyan gelen bağlantı 1. Google bu tür sayfaları "keşfedildi, henüz
 * dizinde değil" kuyruğunda bekletiyor.
 *
 * Komşu seçimi: bir yeni, iki eski. Her yazı kendinden hemen eski yazıya
 * bağlandığı için en yeni yazıdan başlayan zincir arşivin tamamına iniyor;
 * okuyucu açısından da "sonra ne oldu / öncesinde ne vardı" anlamlı.
 * Eski taraf sırası (olay günü, yayın anı) — aynı gün birden çok yazı
 * olabiliyor.
 *
 * YENİ TARAF SONRAKİ OLAY GÜNÜNDEN (25 Ekim, ikinci ölçüm). İlk sürümde
 * "yeni" de (olay günü, yayın anı) sırasıyla seçiliyordu: 14 Ekim sabahı
 * yayımlanan ASML yazısının yeni komşusu aynı akşamki 14 Ekim CoreWeave
 * yazısıydı ve liste "14, 13, 13 Ekim" okunuyordu; ekranda yalnız gün
 * yazdığı için okuyucu yeni yazıyı hiç görmüyordu. Artık yeni komşu olay
 * günü KESİN sonra olan ilk yazı. Yetimsizlik buna bağlı değil: her yazı
 * hemen ardılının ESKİ tarafında birinci sırada (ardılın en az iki eski
 * yeri var). Simülasyon (25 Ekim, canlı tablo salt okuma, sorgu
 * pencereleri birebir, `neighborsAmong`): TR ve EN'de 163'er yazı, gelen
 * bağlantısız 0, medyan 2, en çok 7; son günden eski 162 yazının 162'sinde
 * yeni komşu var; pencereli seçim tüm tabloyla seçimle aynı, yanlış dilde
 * satır 0.
 */
export const NEIGHBOR_COUNT = 3;

/** Aday penceresi: komşu sayısının kaç katı satır çekilir (iki dil, kayan anlar). */
export const WINDOW_FACTOR = 4;

/** Yeni taraftan kaç tane; kalan eski taraftan. Bir taraf eksikse öteki doldurur. */
const NEWER_SHARE = 1;

type Row = StoryIndexRow & { publishedAt: Date };

/**
 * Saf seçim: `newer` yakından uzağa (eskiden yeniye), `older` yakından
 * uzağa (yeniden eskiye) sıralı gelir. Dönüş ekran sırası: yeni → eski.
 */
export function pickNeighbors<T extends { slug: string }>(
  newer: readonly T[],
  older: readonly T[],
  count = NEIGHBOR_COUNT,
): T[] {
  const newerTake = Math.min(newer.length, Math.max(NEWER_SHARE, count - older.length));
  const olderTake = Math.min(older.length, count - newerTake);
  return [...newer.slice(0, newerTake).reverse(), ...older.slice(0, olderTake)];
}

type Keyed = { slug: string; locale: string; eventDate: string; publishedAt: Date };

/** (olay günü, yayın anı) sırası; olay günü `YYYY-MM-DD` dizesi. */
function compareKey(a: Keyed, b: Keyed): number {
  if (a.eventDate !== b.eventDate) return a.eventDate < b.eventDate ? -1 : 1;
  return a.publishedAt.getTime() - b.publishedAt.getTime();
}

/**
 * Saf komşu seçimi, aday satırlardan (iki dil karışık). Veritabanı yolu
 * yalnız aday penceresini daraltır; kural burada: yeni taraf olay günü
 * KESİN sonra olanlar, eski taraf (olay günü, yayın anı) önce olanlar.
 */
export function neighborsAmong<T extends Keyed>(
  rows: readonly T[],
  current: { slug: string; eventDate: string; publishedAt: Date },
  locale: string,
  count = NEIGHBOR_COUNT,
): T[] {
  const self = { ...current, locale };
  /* ÖNCE DİL, SONRA SIRA. İki dilin yayın anı günlerce ayrışabiliyor
     (Ağustos yazılarında EN çevirisi 1-4 gün sonra): sıra karışık satırlarla
     kurulunca "hemen önceki" yazı EN satırının anına göre seçiliyor ve
     29 Temmuz'un bir yazısı TR'de hiçbir sayfadan bağlantı almıyordu
     (simülasyon, 25 Ekim). Slug başına okuyucunun satırı seçilip sıra o
     satırın anıyla kuruluyor; bir slug böylece tek tarafa düşüyor. */
  const pages = preferLocale(
    rows.filter((row) => row.slug !== current.slug),
    locale,
  );
  const newer = pages
    .filter((row) => row.eventDate > current.eventDate)
    .sort(compareKey);
  const older = pages
    .filter((row) => compareKey(row, self) < 0)
    .sort((a, b) => compareKey(b, a));
  return pickNeighbors(newer, older, count);
}

/** Slug başına tek satır: istenen dil varsa o, yoksa orijinal (getStories kuralı). */
export function preferLocale<T extends { slug: string; locale: string }>(
  rows: readonly T[],
  locale: string,
): T[] {
  const bySlug = new Map<string, T>();
  for (const row of rows) {
    const held = bySlug.get(row.slug);
    if (!held || (held.locale !== locale && row.locale === locale)) bySlug.set(row.slug, row);
  }
  return [...bySlug.values()];
}

const columns = {
  slug: stories.slug,
  title: stories.title,
  dek: stories.dek,
  eventDate: stories.eventDate,
  symbols: stories.symbols,
  readMinutes: stories.readMinutes,
  locale: stories.locale,
  updatedAt: stories.updatedAt,
  publishedAt: stories.publishedAt,
};

/**
 * Okunamazsa boş liste: bölüm sayfanın asıl işi değil, düşmesi yazıyı
 * düşürmemeli (liste kartlarındaki yutma kuralı, `lib/data.ts`).
 */
export async function getStoryNeighbors(
  current: { slug: string; eventDate: string; publishedAt: Date },
  locale: string,
): Promise<StoryIndexRow[]> {
  /* Seçim `neighborsAmong`ta; sorgular yalnız aday penceresi. Dil başına
     iki satır düşüyor ve iki dilin anı ayrışabiliyor: pencere dört kat
     (simülasyon bu pencereyle koşuldu). */
  const take = NEIGHBOR_COUNT * WINDOW_FACTOR;
  try {
    const [newer, older] = await Promise.all([
      db
        .select(columns)
        .from(stories)
        .where(sql`${stories.eventDate} > ${current.eventDate}::date and ${stories.slug} <> ${current.slug}`)
        .orderBy(asc(stories.eventDate), asc(stories.publishedAt))
        .limit(take),
      db
        .select(columns)
        .from(stories)
        /* Pencere GÜNLE kesiliyor, anla değil: aynı günün öteki dildeki
           satırı penceredeyse seçim okuyucunun satırına bakar; anla
           kesilince yalnız öteki dilin satırı kalıp başlık yanlış dilde
           basılıyordu (simülasyonda EN'de 3 satır). */
        .where(sql`${stories.eventDate} <= ${current.eventDate}::date and ${stories.slug} <> ${current.slug}`)
        .orderBy(desc(stories.eventDate), desc(stories.publishedAt))
        .limit(take),
    ]);
    return neighborsAmong([...newer, ...older] as Row[], current, locale);
  } catch (error) {
    console.error(`[veri] getStoryNeighbors okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
