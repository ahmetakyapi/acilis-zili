import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { percentAlertState, percentAlerts, priceAlertState, priceAlerts } from "@/lib/schema";
import type { NotifyReport } from "@/lib/notifications";

/**
 * ALARM DURUMU — "devreye giriş" (`armed_at`) ve "bildirildi"
 * (`notified_at`, `notify_attempts`). Gerekçe lib/schema.ts →
 * priceAlertState; evre kararı lib/alert-phase.ts.
 *
 * TABLO YOKKEN ESKİ DAVRANIŞ (migration 0043 deploy'da uygulanmıyor;
 * kalıp lib/avatar-data.ts). Okuyan `null` alır ve eski hâle düşer:
 * devreye giriş = `created_at`, bildirim durumu bilinmez, yeniden deneme
 * yok. Yazan `"missing"` alır; yüzde alarmını yeniden kuran eylem o zaman
 * `created_at`i eskisi gibi ileri çeker (app/actions/alerts.ts).
 *
 * ÇİFT BİLDİRİM YOK. Yeniden deneme yalnız İLK denemesi kaydedilmiş
 * (`notify_attempts = 1`) ve hiçbir kanalı teslim etmemiş tetiğe yapılır;
 * deneme koşullu UPDATE ile sahiplenilir, üst üste binen iki tarama aynı
 * tetiği iki kez denemez. Kanalların kendi tekrarsızlığı da var: push
 * etiketi alarm başına (`alert-<id>`, cihazda öncekinin yerine geçer),
 * posta defteri `alert:<id>:<tetik anı>` anahtarıyla ikinci gönderimi
 * reddeder. Gelen kutusu satırı ilk denemede yazılmışsa tetik zaten
 * "bildirildi"dir ve tekrar seçilmez. İlk deneme FIRLADIYSA (sonuç
 * bilinmiyor; kutu satırı yazılmış olabilir) tavan doldurulur, tekrar
 * yok (`firstNotifyRecord`). Durum satırı hiç yazılamamışsa
 * (kesinti, tablo sonradan geldi) tetik denenmez — sonucu bilinmeyen
 * bildirimi körü körüne tekrarlamak, kaçırmaktan kötü.
 */

export type AlertKind = "price" | "percent";

/** Tetikten bu kadar sonra yeniden deneme yok: bayat alarm bildirimi haber değil. */
export const NOTIFY_RETRY_WINDOW_MS = 15 * 60_000;
/**
 * Tetikten en az bu kadar sonra: aynı taramada (ya da az önce sayfada)
 * düşen bildirim saniyeler içinde, büyük olasılıkla süren aynı kesintiye
 * yeniden gönderilmesin — tekrar bir SONRAKİ taramaya (5 dk) kalır.
 */
export const NOTIFY_RETRY_MIN_AGE_MS = 2 * 60_000;
/** İlk deneme + bir tekrar. */
export const NOTIFY_MAX_ATTEMPTS = 2;

const ms = (value: Date | string): number => (value instanceof Date ? value.getTime() : Date.parse(value));

type RetryInput = {
  triggeredAt: Date | string | null;
  notifiedAt: Date | string | null;
  notifyAttempts: number;
};

/**
 * Bu tetiğin bildirimi yeniden denenmeli mi — saf karar (testli).
 * Tetik var, bildirilmemiş, ilk deneme kaydedilmiş ama tavan dolmamış,
 * tetik [asgari yaş, pencere] aralığında (gelecekteki tetik — saat
 * kayması — da dışarıda).
 */
export function needsNotifyRetry(row: RetryInput, now: Date | number): boolean {
  if (row.triggeredAt == null || row.notifiedAt != null) return false;
  if (!(row.notifyAttempts >= 1 && row.notifyAttempts < NOTIFY_MAX_ATTEMPTS)) return false;
  const age = (typeof now === "number" ? now : now.getTime()) - ms(row.triggeredAt);
  return Number.isFinite(age) && age >= NOTIFY_RETRY_MIN_AGE_MS && age <= NOTIFY_RETRY_WINDOW_MS;
}

export function pickNotifyRetries<T extends RetryInput>(rows: readonly T[], now: Date | number): T[] {
  return rows.filter((row) => needsNotifyRetry(row, now));
}

/** En az bir kanal teslim etti mi. Fırlatan bildirim (`null`) teslim sayılmaz. */
export function deliveredAny(report: NotifyReport | null | undefined): boolean {
  return report != null && (report.inbox || report.push > 0 || report.email);
}

/** Postgres "relation does not exist" — Drizzle hatayı `cause` içine sarıyor. */
export function isMissingTable(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause = typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === "42P01" || codeOf(cause) === "42P01";
}

const stateTable = (kind: AlertKind) => (kind === "price" ? priceAlertState : percentAlertState);

/** Tablo yoksa sessiz, başka hatada iz bırakır — iki durumda da sonuç aynı (eski davranış). */
function swallow(where: string, error: unknown): void {
  if (!isMissingTable(error)) console.error(`[alarm] durum ${where}`, error);
}

export type StateWrite = "ok" | "missing" | "error";

/**
 * Alarmların devreye giriş anları (yalnız dolu olanlar). `null` = tablo
 * yok ya da okunamadı: çağıran `created_at`e düşer.
 */
export async function readArmedAt(kind: AlertKind, ids: readonly string[]): Promise<Map<string, Date> | null> {
  if (ids.length === 0) return new Map();
  const table = stateTable(kind);
  try {
    const rows = await db
      .select({ alertId: table.alertId, armedAt: table.armedAt })
      .from(table)
      .where(and(inArray(table.alertId, [...ids]), isNotNull(table.armedAt)));
    return new Map(rows.flatMap((row) => (row.armedAt ? [[row.alertId, row.armedAt] as const] : [])));
  } catch (error) {
    swallow("okunamadı", error);
    return null;
  }
}

/**
 * Yeniden kurmada: devreye giriş anını yazar, önceki tetiğin bildirim
 * izini sıfırlar (yeni tetik eski "1 deneme, bildirilmedi" kaydını devralıp
 * çift bildirime yol açmasın). `armedAt: null` = `created_at` geçerli.
 */
export async function resetAlertState(kind: AlertKind, alertId: string, armedAt: Date | null): Promise<StateWrite> {
  const table = stateTable(kind);
  const now = new Date();
  try {
    await db
      .insert(table)
      .values({ alertId, armedAt, notifiedAt: null, notifyAttempts: 0, updatedAt: now })
      .onConflictDoUpdate({
        target: table.alertId,
        set: { armedAt, notifiedAt: null, notifyAttempts: 0, updatedAt: now },
      });
    return "ok";
  } catch (error) {
    swallow("yazılamadı (yeniden kurma)", error);
    return isMissingTable(error) ? "missing" : "error";
  }
}

/**
 * İlk denemenin kaydı — saf karar (testli). Rapor `null` = bildirim
 * FIRLADI: gelen kutusu yazılmış olabilir, sonuç bilinmiyor; deneme tavanı
 * doldurulur ki tarama aynı tetiği ikinci kez göndermesin.
 */
export function firstNotifyRecord(
  report: NotifyReport | null,
  now: Date,
): { notifiedAt: Date | null; notifyAttempts: number } {
  if (report == null) return { notifiedAt: null, notifyAttempts: NOTIFY_MAX_ATTEMPTS };
  return { notifiedAt: deliveredAny(report) ? now : null, notifyAttempts: 1 };
}

/**
 * Tetiğin İLK bildirim denemesinin sonucu. `armed_at`a dokunmaz.
 * Düşerse yalnız günlük: satırsız tetik yeniden denenmez (başlıktaki kural).
 */
export async function recordFirstNotify(kind: AlertKind, alertId: string, report: NotifyReport | null): Promise<void> {
  const table = stateTable(kind);
  const now = new Date();
  const record = firstNotifyRecord(report, now);
  try {
    await db
      .insert(table)
      .values({ alertId, ...record, updatedAt: now })
      .onConflictDoUpdate({ target: table.alertId, set: { ...record, updatedAt: now } });
  } catch (error) {
    swallow("yazılamadı (ilk bildirim)", error);
  }
}

/** Yeniden denemeyi sahiplenir: yalnız görülen deneme sayısı hâlâ geçerliyse. */
async function claimRetry(kind: AlertKind, alertId: string, seenAttempts: number): Promise<boolean> {
  const table = stateTable(kind);
  try {
    const rows = await db
      .update(table)
      .set({ notifyAttempts: sql`${table.notifyAttempts} + 1`, updatedAt: new Date() })
      .where(and(eq(table.alertId, alertId), isNull(table.notifiedAt), eq(table.notifyAttempts, seenAttempts)))
      .returning({ alertId: table.alertId });
    return rows.length > 0;
  } catch (error) {
    swallow("yazılamadı (tekrar sahiplenme)", error);
    return false;
  }
}

async function markNotified(kind: AlertKind, alertId: string): Promise<void> {
  const table = stateTable(kind);
  const now = new Date();
  try {
    await db.update(table).set({ notifiedAt: now, updatedAt: now }).where(eq(table.alertId, alertId));
  } catch (error) {
    swallow("yazılamadı (bildirildi)", error);
  }
}

export type PriceRetry = {
  kind: "price";
  id: string;
  userId: string;
  symbol: string;
  direction: string;
  target: string;
  triggeredAt: Date;
  triggeredPrice: string | null;
  notifiedAt: Date | null;
  notifyAttempts: number;
};

export type PercentRetry = {
  kind: "percent";
  id: string;
  userId: string;
  symbol: string;
  direction: string;
  thresholdPct: string;
  triggeredAt: Date;
  triggeredPct: string | null;
  notifiedAt: Date | null;
  notifyAttempts: number;
};

/**
 * Bildirimi yeniden denenecek tetikler. SQL kabaca süzer, son söz
 * `pickNotifyRetries`te (testli kural tek yerde). Tablo yoksa boş.
 */
export async function loadNotifyRetries(now: Date): Promise<(PriceRetry | PercentRetry)[]> {
  const since = new Date(now.getTime() - NOTIFY_RETRY_WINDOW_MS);
  const out: (PriceRetry | PercentRetry)[] = [];
  try {
    const rows = await db
      .select({
        id: priceAlerts.id,
        userId: priceAlerts.userId,
        symbol: priceAlerts.symbol,
        direction: priceAlerts.direction,
        target: priceAlerts.target,
        triggeredAt: priceAlerts.triggeredAt,
        triggeredPrice: priceAlerts.triggeredPrice,
        notifiedAt: priceAlertState.notifiedAt,
        notifyAttempts: priceAlertState.notifyAttempts,
      })
      .from(priceAlertState)
      .innerJoin(priceAlerts, eq(priceAlerts.id, priceAlertState.alertId))
      .where(
        and(
          isNull(priceAlertState.notifiedAt),
          lt(priceAlertState.notifyAttempts, NOTIFY_MAX_ATTEMPTS),
          gte(priceAlerts.triggeredAt, since),
        ),
      );
    for (const row of rows) if (row.triggeredAt) out.push({ ...row, kind: "price", triggeredAt: row.triggeredAt });
  } catch (error) {
    swallow("okunamadı (fiyat tekrarı)", error);
  }
  try {
    const rows = await db
      .select({
        id: percentAlerts.id,
        userId: percentAlerts.userId,
        symbol: percentAlerts.symbol,
        direction: percentAlerts.direction,
        thresholdPct: percentAlerts.thresholdPct,
        triggeredAt: percentAlerts.triggeredAt,
        triggeredPct: percentAlerts.triggeredPct,
        notifiedAt: percentAlertState.notifiedAt,
        notifyAttempts: percentAlertState.notifyAttempts,
      })
      .from(percentAlertState)
      .innerJoin(percentAlerts, eq(percentAlerts.id, percentAlertState.alertId))
      .where(
        and(
          isNull(percentAlertState.notifiedAt),
          lt(percentAlertState.notifyAttempts, NOTIFY_MAX_ATTEMPTS),
          gte(percentAlerts.triggeredAt, since),
        ),
      );
    for (const row of rows) if (row.triggeredAt) out.push({ ...row, kind: "percent", triggeredAt: row.triggeredAt });
  } catch (error) {
    swallow("okunamadı (yüzde tekrarı)", error);
  }
  return pickNotifyRetries(out, now);
}

/**
 * Tek tetiğin bildirimini bir kez daha dener: sahiplen → gönder → teslim
 * edildiyse işaretle. `send` bildirimi kurar (tarama yükü bilir); döndürdüğü
 * rapor `null`sa (fırladı) teslim sayılmaz. Sahiplenemezse `null` döner.
 */
export async function retryNotify(
  row: { kind: AlertKind; id: string; notifyAttempts: number },
  send: () => Promise<NotifyReport | null>,
): Promise<NotifyReport | null> {
  if (!(await claimRetry(row.kind, row.id, row.notifyAttempts))) return null;
  const report = await send();
  if (deliveredAny(report)) await markNotified(row.kind, row.id);
  return report;
}
