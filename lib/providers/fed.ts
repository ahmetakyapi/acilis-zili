import "server-only";
import { cache } from "react";
import { findFomcReleases, parseFedFeed, parseFomcDecision, type FomcDecision } from "@/lib/fomc-statement";

/**
 * Fed'in para politikası basın bültenleri — FOMC olaylarının sonucu (28
 * Ekim). Gerekçe ve ayrıştırma `lib/fomc-statement.ts`.
 *
 * İKİ İSTEK, İKİ ÖMÜR. RSS bir dakikada bir tazelenir (akışın yoklaması 30
 * saniye; Fed'e dakikada en çok bir istek). Bülten sayfası yayımlandıktan
 * sonra DEĞİŞMİYOR; bir gün önbellekli.
 *
 * HATA SESSİZ: Fed yanıt vermezse olay eskisi gibi "Sonuç Bekleniyor" der,
 * akış kırılmaz.
 */

const FEED_URL = "https://www.federalreserve.gov/feeds/press_monetary.xml";
const FEED_REVALIDATE_S = 60;
const STATEMENT_REVALIDATE_S = 24 * 60 * 60;
const FED_TIMEOUT_MS = 6000;
/** Sayfanın Fed'i bekleme sınırı — aşarsa olay o turda bekler, sonraki yoklamada gelir. */
export const FED_WAIT_MS = 4000;

export type FomcRelease = {
  /** Kararın yayım anı (RSS `pubDate`). */
  statementAt: string;
  /** Kalıp okunamadıysa null — bülten var, sayı yok. */
  decision: FomcDecision | null;
  /** Projeksiyonlar (nokta grafiği) bülteni de çıktı mı. */
  projections: boolean;
};

async function fedText(url: string, revalidate: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate, tags: ["day-flow"] },
      signal: AbortSignal.timeout(FED_TIMEOUT_MS),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Verilen ET gününün FOMC kararı; bülten yoksa (henüz ya da hiç) null. */
export const getFomcRelease = cache(async function getFomcRelease(dateEt: string): Promise<FomcRelease | null> {
  const feed = await fedText(FEED_URL, FEED_REVALIDATE_S);
  if (!feed) return null;
  const { statement, projections } = findFomcReleases(parseFedFeed(feed), dateEt);
  if (!statement?.publishedAt) return null;
  const page = await fedText(statement.link, STATEMENT_REVALIDATE_S);
  const decision = page ? parseFomcDecision(page.replace(/<[^>]*>/g, " ")) : null;
  return { statementAt: statement.publishedAt, decision, projections: !!projections };
});
