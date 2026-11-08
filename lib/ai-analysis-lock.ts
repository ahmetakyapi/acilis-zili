/*
 * CLAUDE ANALİZİ: KİLİT, SOĞUMA VE İŞ BÜTÇESİ (8 Kasım 2026, örtük durum
 * makinesi denetimi § 5). Saf modül — `server-only` dışında ki hem test hem
 * istemci (analiz masasının geri sayımı) okuyabilsin.
 *
 * `ai_analysis_access` satırının iki sütunu (`lock_id`, `lock_until`) dört
 * hâli birlikte taşıyor; SQL'in kendisi (`lib/ai-analysis-quota.ts`)
 * DEĞİŞMEDİ, bu dosya yalnız aynı satırı TEK yerde okur:
 *   - idle     — kilit yok ya da süresi geçmiş, iş kimliği boş
 *   - running  — `lock_id` dolu, `lock_until > now`: hesapta iş sürüyor
 *   - expired  — `lock_id` dolu, `lock_until <= now`: süreç öldü, kurtarma
 *                (`recoverExpiredAnalysis`) isteği `failed` yapıp hakkı iade eder
 *   - cooldown — `lock_id` boş, `lock_until > now`: başarısız işin ardından
 *                `releaseAnalysis`in koyduğu kısa bekleme; `reserveAnalysis`
 *                bu sürede 429 `busy` döndürür
 * Soğuma eskiden istemciye hiç gelmiyordu: GET yalnız "sürüyor"u söylüyordu,
 * masa "Tekrar Dene"yi hemen açıyor, basan okur bir dakika boyunca ekranında
 * olmayan "başka bir analiz sürüyor" hatasını alıyordu.
 */

type AccessPhase = "idle" | "running" | "expired" | "cooldown";

/**
 * Sınır SQL'le aynı: `reserveAnalysis` `lock_until < now()` iken kilit alır,
 * kayıt `lock_until > now()` iken yayınlanır; eşitlikte iş artık süren iş
 * sayılmaz. `lock_id` dolu ama `lock_until` boş satır SQL'de üretilmez;
 * rezervasyon onu boş sayar, burada da `idle`.
 */
export function accessPhase(row: { lockId: string | null; lockUntil: Date | null } | null | undefined, now: Date | number): AccessPhase {
  if (!row?.lockUntil) return "idle";
  const live = row.lockUntil.getTime() > (typeof now === "number" ? now : now.getTime());
  if (row.lockId) return live ? "running" : "expired";
  return live ? "cooldown" : "idle";
}

/** Soğumanın bitişi (ISO) — yalnız `cooldown` hâlinde; istemcinin geri sayımı bunu okur. */
export function cooldownUntil(row: { lockId: string | null; lockUntil: Date | null } | null | undefined, now: Date | number): string | null {
  return accessPhase(row, now) === "cooldown" ? row!.lockUntil!.toISOString() : null;
}

/* İŞ BÜTÇESİ — KİLİT SÜRESİNDEN TÜRER. Eskiden kilit (4 dk, SQL'de elle) ile
   model çağrısının süresi (140 sn) ayrı yazılmıştı ve öncesindeki veri turu
   (`getLiveQuotes`, barlar, haber, tarama) sınırsızdı. `maxDuration` VPS'te
   uygulanmıyor (aynı tespit `app/api/cron/alarmlar/route.ts`); iş kilidi
   aşarsa okurun herhangi bir sayfa görüntülemesi kurtarmayı tetikliyor,
   isteği `failed` yapıp hakkı iade ediyor, iş sonra bitince kayıt `forbidden`
   düşüyordu: Claude ücreti ödenmiş, rapor atılmış. Artık kilit tek sabit,
   işin her adımı ondan türeyen bir son ana (`deadline`) bağlı; bütçe aşılırsa
   iş kendisi düşer ve `releaseAnalysis` hakkı iade eder. */

/** Kilit süresi — SQL'deki `lock_until = now() + …` buradan yazılır. */
export const LOCK_MS = 4 * 60_000;
/** Başarısız iş sonrası bekleme (iade edilen hak hemen ikinci ücretli denemeye dönmesin). */
export const COOLDOWN_MS = 60_000;
/** Bütçe bittikten sonra kilit dolmadan kalan pay: kullanım kaydı, sonuç UPDATE'i, kilidin bırakılması ve uygulama ile veritabanı saati arasındaki kayma. */
export const SAVE_MARGIN_MS = 20_000;
/** İşin toplam bütçesi: rezervasyondan sonuç kaydına kadar. */
export const JOB_BUDGET_MS = LOCK_MS - SAVE_MARGIN_MS;
/** Model çağrısının duvar saati sınırı (rota 180 sn, kilit 4 dk; eski not: veri toplamaya ~30 sn bırakır). */
export const MODEL_TIMEOUT_MS = 140_000;
/** Yeniden deneme yalnız bu süre içinde düşen ilk denemeye (ms). */
export const RETRY_WINDOW_MS = 20_000;
export const RETRY_DELAY_MS = 2_000;
/** Model tarafının en kötü yolu: pencerenin sonunda düşen ilk deneme + bekleme + tam süreli ikinci deneme. */
export const MODEL_WORST_MS = RETRY_WINDOW_MS + RETRY_DELAY_MS + MODEL_TIMEOUT_MS;
/** Veri turunun payı: modelin en kötü yolundan artanı (58 sn). Kotasyon, barlar, haber ve tarama bunun içinde. */
export const DATA_BUDGET_MS = JOB_BUDGET_MS - MODEL_WORST_MS;
/** İkinci denemeye bundan az süre kalıyorsa denenmez: kısa kesilen ücretli çağrı boşa para. */
export const MIN_MODEL_MS = 30_000;

/** Son ana kalan süre (ms, eksiye düşmez). */
export function budgetLeft(deadline: number, now = Date.now()) {
  return Math.max(0, deadline - now);
}

/**
 * Sinyal almayan sağlayıcı çağrılarını süreyle keser: süre dolunca `code`
 * hatasıyla reddeder. Alttaki istek sürer ama sonucu kimse beklemez; geç
 * gelen reddi yutulur (işlenmemiş ret günlüğü kirletmesin).
 */
export function withinBudget<T>(work: Promise<T>, ms: number, code: string): Promise<T> {
  if (ms <= 0) {
    work.catch(() => { /* süre yok: sonuç beklenmiyor */ });
    return Promise.reject(new Error(code));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(code)), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}
