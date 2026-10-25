/**
 * Analiz masasının durum satırı ve düğme adı — saf, test edilebilir
 * (`tests/ai-analysis-desk.test.ts`). Bileşen: components/ai/ClaudeWorkbench.tsx.
 *
 * Kart en fazla BİR durum satırı gösterir (25 Ekim): üst üste üç kutu
 * (bekleme, sürüyor, hata) eylemi ilk ekranın dışına itiyordu. Öncelik:
 * hata > hesapta sürüyor > hak bitti > önerilen bekleme. Beklemenin eylemi
 * düğmenin kendisidir ("Yine de Başlat"); öteki hâllerde düğme ya kapalıdır
 * ya da yeniden denemeye döner.
 */
export type DeskNote = "error" | "running" | "quota" | "early" | null;
export type DeskLabel = "start" | "startAnyway" | "retry";

/** Hata kodunda yeniden deneme anlamlı mı: kota ve bağlantı belirsizliği hariç. */
export const RETRYABLE = new Set(["busy", "data-unavailable", "analysis-failed"]);

export function deskState({ errorCode, inProgress, remaining, early }: {
  /** `null`: hata yok; boş dize: tanınmayan / bağlantı hatası. */
  errorCode: string | null; inProgress: boolean; remaining: number | null; early: boolean;
}): { note: DeskNote; label: DeskLabel; disabled: boolean; retry: boolean } {
  const quotaOut = remaining === 0;
  const retry = errorCode !== null && RETRYABLE.has(errorCode);
  const note: DeskNote = errorCode !== null ? "error" : inProgress ? "running" : quotaOut ? "quota" : early ? "early" : null;
  const label: DeskLabel = retry ? "retry" : early && errorCode === null ? "startAnyway" : "start";
  return { note, label, disabled: inProgress || quotaOut, retry };
}
