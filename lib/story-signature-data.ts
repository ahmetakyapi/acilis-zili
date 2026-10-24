import { inArray, sql } from "drizzle-orm";
import { parseBlocks } from "@/components/article/parse-blocks";
import { db } from "./db";
import { stories } from "./schema";
import {
  pickSignature,
  SIGNATURE_PRIORITY,
  signaturePattern,
  type SignatureBlock,
} from "./story-signature";

/**
 * Arşiv kartlarının imza blokları — `slug:locale` → blok (24 Ekim).
 *
 * GÖVDE ÇEKİLMİYOR. Kartın imzası için 24-600 yazının gövdesini (ortalama
 * 8 KB) indirmek liste sayfasını gövde sayfası kadar ağırlaştırırdı.
 * Postgres her aday türün İLK bloğunu kendisi kesip veriyor (kalıp ve
 * doğruluk ölçümü `signaturePattern`): satır başına ortalama 427 bayt,
 * arşivin tamamı 322 satırda tek sorgu ~1 sn (soğuk Neon, yerelden ölçüldü;
 * sayfa en çok 600 yazı basıyor, varsayılan 24).
 *
 * Satır, listenin GÖSTERDİĞİ dildeki sürüm: çevirisi olmayan yazı kartta
 * orijinaliyle duruyor, imzası da orijinalinden. Sorgu düşerse boş harita
 * döner — kartlar bugünkü logo şeridine iner, sayfa çökmez.
 */
export async function getStorySignatures(
  rows: readonly { slug: string; locale: string }[],
): Promise<Map<string, SignatureBlock>> {
  const out = new Map<string, SignatureBlock>();
  if (rows.length === 0) return out;
  const wanted = new Set(rows.map((row) => `${row.slug}:${row.locale}`));
  try {
    const found = await db
      .select({
        slug: stories.slug,
        locale: stories.locale,
        flow: sql<string | null>`substring(${stories.bodyMd} from ${signaturePattern("flow")})`,
        shift: sql<string | null>`substring(${stories.bodyMd} from ${signaturePattern("shift")})`,
        bars: sql<string | null>`substring(${stories.bodyMd} from ${signaturePattern("bars")})`,
        stats: sql<string | null>`substring(${stories.bodyMd} from ${signaturePattern("stats")})`,
        chart: sql<string | null>`substring(${stories.bodyMd} from ${signaturePattern("chart")})`,
      })
      .from(stories)
      .where(inArray(stories.slug, [...new Set(rows.map((row) => row.slug))]));

    for (const row of found) {
      const key = `${row.slug}:${row.locale}`;
      if (!wanted.has(key)) continue;
      /* Adaylar öncelik sırasıyla tek metne diziliyor; seçim yine
         ayrıştırılmış bloklardan (`pickSignature`), yani yazı sayfasındaki
         çizimle aynı ayrıştırıcıdan geçiyor. */
      const markdown = SIGNATURE_PRIORITY.map((kind) => row[kind])
        .filter((part): part is string => Boolean(part))
        .join("\n\n");
      const block = markdown ? pickSignature(parseBlocks(markdown, row.locale)) : null;
      if (block) out.set(key, block);
    }
  } catch (error) {
    const mesaj = error instanceof Error ? error.message : String(error);
    console.error(`[veri] getStorySignatures okunamadı: ${mesaj}`);
  }
  return out;
}
