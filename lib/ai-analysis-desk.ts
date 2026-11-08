/**
 * Analiz masasının durum satırı ve düğme adı — saf, test edilebilir
 * (`tests/ai-analysis-desk.test.ts`). Bileşen: components/ai/ClaudeWorkbench.tsx.
 *
 * Kart en fazla BİR durum satırı gösterir (25 Ekim): üst üste üç kutu
 * (bekleme, sürüyor, hata) eylemi ilk ekranın dışına itiyordu. Öncelik:
 * hata > hesapta sürüyor > hak bitti > önerilen bekleme. Beklemenin eylemi
 * düğmenin kendisidir ("Yine de Başlat"); öteki hâllerde düğme ya kapalıdır
 * ya da yeniden denemeye döner.
 *
 * SOĞUMA (8 Kasım): başarısız işten sonra hesapta bir dakikalık bekleme var
 * (`lib/ai-analysis-lock.ts` → `accessPhase` "cooldown"). Eskiden masa onu
 * bilmiyor, "Tekrar Dene"yi hemen açıyordu; basan okur 429 alıyordu. Şimdi
 * soğuma sürerken düğme kilitli ve kalan süreyi gösterir (`cooldown: true`).
 * Öncelik: hata > sürüyor > hak bitti > soğuma > önerilen bekleme; hata
 * satırı görünürken de düğme soğuma bitene dek kilitli kalır.
 */
type DeskNote = "error" | "running" | "quota" | "cooldown" | "early" | null;
type DeskLabel = "start" | "startAnyway" | "retry";

/** Hata kodunda yeniden deneme anlamlı mı: kota ve bağlantı belirsizliği hariç. */
export const RETRYABLE = new Set(["busy", "data-unavailable", "analysis-failed"]);

export function deskState({ errorCode, inProgress, remaining, early, cooldownMs = 0 }: {
  /** `null`: hata yok; boş dize: tanınmayan / bağlantı hatası. */
  errorCode: string | null; inProgress: boolean; remaining: number | null; early: boolean;
  /** Soğumanın kalan süresi (ms); 0 ya da yoksa soğuma yok. */
  cooldownMs?: number;
}): { note: DeskNote; label: DeskLabel; disabled: boolean; retry: boolean; cooldown: boolean } {
  const quotaOut = remaining === 0;
  const retry = errorCode !== null && RETRYABLE.has(errorCode);
  // Süren iş ve biten hak soğumanın önüne geçer: o hâllerde geri sayım bir şey vaat etmez.
  const cooldown = cooldownMs > 0 && !inProgress && !quotaOut;
  const note: DeskNote = errorCode !== null ? "error" : inProgress ? "running" : quotaOut ? "quota" : cooldown ? "cooldown" : early ? "early" : null;
  const label: DeskLabel = retry || note === "cooldown" ? "retry" : early && errorCode === null ? "startAnyway" : "start";
  return { note, label, disabled: inProgress || quotaOut || cooldown, retry, cooldown };
}

/*
 * MASANIN İSTEMCİ DURUMU (8 Kasım): `ClaudeWorkbench`te dört ayrı boolean
 * (`launching`, `busy`, `done`, `error`) vardı; `done && !busy` gibi anlamsız
 * birleşimler yalnız çağrı sırasıyla engelleniyordu. Tek durum, tek geçiş
 * tablosu:
 *
 *   idle | error ── launch ──▶ launching ── film ──▶ filming
 *   launching | filming ── succeed ──▶ done      (film perdeyi açar, rapora gidilir)
 *   launching | filming ── fail ─────▶ error     (masa geri gelir, hata satırı)
 *
 * Tabloda olmayan geçiş yok sayılır (ör. sonuç büzülmeden önce geldiyse
 * gecikmeli `film` olayı `done`ı geri almaz). Soğuma ayrı alan: sunucunun
 * söylediği bitiş anı; `launch` onu temizler.
 */
export type DeskRun = "idle" | "launching" | "filming" | "done" | "error";
export type DeskError = { code: string; text: string };
export type DeskMachine = { run: DeskRun; error: DeskError | null; cooldownUntil: number | null };
export type DeskEvent =
  | { type: "launch" }
  | { type: "film" }
  | { type: "succeed" }
  | { type: "fail"; error: DeskError }
  | { type: "cooldown"; until: number | null };

export function deskReducer(state: DeskMachine, event: DeskEvent): DeskMachine {
  switch (event.type) {
    case "launch":
      return state.run === "idle" || state.run === "error" ? { run: "launching", error: null, cooldownUntil: null } : state;
    case "film":
      return state.run === "launching" ? { ...state, run: "filming" } : state;
    case "succeed":
      return state.run === "launching" || state.run === "filming" ? { ...state, run: "done", error: null } : state;
    case "fail":
      return state.run === "launching" || state.run === "filming" ? { ...state, run: "error", error: event.error } : state;
    case "cooldown":
      return { ...state, cooldownUntil: event.until };
  }
}

/** Film sahnesi mi görünüyor (eski `busy`): istek sürerken ve sonuç geldikten sonra perde açılana dek. */
export const deskFilming = (run: DeskRun) => run === "filming" || run === "done";
