import { cache } from "react";
import { unstable_cache } from "next/cache";
import { desc } from "drizzle-orm";
import { db } from "./db";
import { probabilitySnapshots } from "./schema";
import { fetchKalshiSnapshot } from "./providers/kalshi";
import { isFresh, isSnapshot, type ProbabilitySnapshot } from "./probabilities";

/**
 * Olasılıklar — okuma ve yazma (25 Ekim). Saf mantık `lib/probabilities.ts`.
 *
 * OKUMA SIRASI:
 * 1. Tablodaki en son anlık görüntü (cron günde bir yazıyor). 36 saatten
 *    eskiyse kullanılmaz (veri dürüstlüğü 2: eski veri büyük puntoyla yok).
 * 2. Tablo yoksa (migration uygulanmadı), boşsa ya da kayıt bayatsa
 *    önbellekli CANLI okuma: `unstable_cache`, altı saatte bir tazelenir.
 *    Okuyucu isteği sağlayıcıya gitmez; en kötü hâlde altı saatte bir istek.
 *    Kod migration'dan önce yayına indiğinde sayfa boş açılmasın diye.
 * 3. İkisi de yoksa null — panel "veri alınamadı" der, sayfa çökmez.
 *
 * HATA ÖNBELLEĞİN DIŞINDA: canlı okuma hata fırlatır (boş görüntü
 * saklanmaz), yakalama aşağıda.
 */

export type ProbabilityBoard = {
  snapshot: ProbabilitySnapshot;
  /** "table": cron'un yazdığı kayıt; "live": önbellekli canlı yedek. */
  origin: "table" | "live";
};

/** Canlı yedeğin ömrü — günlük kaydın yokluğunda bile günde dört istek. */
const LIVE_REVALIDATE_SECONDS = 6 * 60 * 60;

/**
 * DÜŞEN KAYNAĞA ARA (devre kesici). Hata önbelleğe girmiyor; kaynak düşükken
 * her istek canlı okumayı yeniden deneyip zaman aşımını (12 sn) bekleyecekti.
 * Künye Takvim'de ve Makro'da da basıldığı için o sayfalar da beklerdi.
 * Başarısız denemeden sonra 15 dakika canlı okuma denenmez; süreç başına
 * (VPS'te tek süreç) bir bayrak yeter.
 */
const LIVE_RETRY_AFTER_MS = 15 * 60 * 1000;
let liveFailedAt = 0;

function yutuldu(kaynak: string, error: unknown): void {
  const mesaj = error instanceof Error ? error.message : String(error);
  console.error(`[olasılıklar] ${kaynak}: ${mesaj}`);
}

/** Postgres "relation does not exist" — Drizzle hatayı `cause` içine sarıyor. */
export function isMissingTable(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === "42P01" || codeOf(cause) === "42P01";
}

/** En son kayıt; tablo yoksa ya da okunamazsa hata FIRLATIR (cron ayırt ediyor). */
export async function readLatestSnapshot(): Promise<{ snapshot: ProbabilitySnapshot; takenAt: Date } | null> {
  const [row] = await db
    .select({ payload: probabilitySnapshots.payload, takenAt: probabilitySnapshots.takenAt })
    .from(probabilitySnapshots)
    .orderBy(desc(probabilitySnapshots.takenAt))
    .limit(1);
  if (!row || !isSnapshot(row.payload)) return null;
  return { snapshot: row.payload, takenAt: row.takenAt };
}

export async function saveSnapshot(snapshot: ProbabilitySnapshot): Promise<void> {
  await db.insert(probabilitySnapshots).values({
    takenAt: new Date(snapshot.takenAt),
    source: snapshot.source,
    payload: snapshot,
  });
}

const loadLive = unstable_cache(
  async function loadLiveProbabilities(): Promise<ProbabilitySnapshot> {
    return fetchKalshiSnapshot();
  },
  /* Sürümlü anahtar (CLAUDE.md): dönen şekil değişirse `-v2`. */
  ["probability-live-v1"],
  { revalidate: LIVE_REVALIDATE_SECONDS },
);

export const getProbabilityBoard = cache(async function getProbabilityBoard(): Promise<ProbabilityBoard | null> {
  try {
    const latest = await readLatestSnapshot();
    if (latest && isFresh(latest.snapshot)) return { snapshot: latest.snapshot, origin: "table" };
  } catch (error) {
    if (!isMissingTable(error)) yutuldu("tablo", error);
  }
  if (Date.now() - liveFailedAt < LIVE_RETRY_AFTER_MS) return null;
  try {
    const live = await loadLive();
    return isFresh(live) ? { snapshot: live, origin: "live" } : null;
  } catch (error) {
    liveFailedAt = Date.now();
    yutuldu("canlı", error);
    return null;
  }
});
