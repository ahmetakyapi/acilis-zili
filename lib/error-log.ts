import { desc, gte, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { appErrors } from "./schema";
import { addEtDays, todayEt } from "./market-hours";
import {
  ERROR_MESSAGE_MAX,
  ERROR_RETENTION_DAYS,
  ERROR_ROUTE_MAX,
  ERROR_STACK_MAX,
  errorFingerprint,
  scrubErrorText,
  type ErrorKind,
} from "./error-log-core";

/**
 * Kendi barındırdığımız hata günlüğü — yazma, okuma ve budama.
 *
 * TABLO YOKKEN SESSİZ. `app_errors` migration'la geliyor ve migration'lar
 * dağıtımdan sonra elle uygulanıyor (CLAUDE.md "Bilinmesi gerekenler"):
 * kod tablodan önce yayına inebilir. Yazan taraf hatayı yutuyor — hata
 * günlüğünün kendisi bir hata üretip okuyucunun isteğini düşüremez.
 * Okuyan taraf "tablo yok"u AYRI söylüyor (`missingTable`), çünkü panelde
 * "hata yok" demek migration'ın unutulduğunu gizlerdi.
 *
 * Sunucu hataları `instrumentation.ts` → `onRequestError`ten, istemci
 * hataları hata sınırlarından `/api/hata` üzerinden geliyor.
 */

const HOUR_MS = 3_600_000;

export type ErrorInput = {
  kind: ErrorKind;
  route: string;
  digest: string | null;
  message: string;
  /** Yalnızca sunucu hatasında; istemcininki hiç yazılmıyor. */
  stack: string | null;
};

/**
 * Bir hatayı günün satırına işler: yoksa açar, varsa sayacı artırır.
 * Hiçbir koşulda fırlatmaz.
 */
export async function recordError(input: ErrorInput): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const message = scrubErrorText(input.message || "Bilinmeyen hata", ERROR_MESSAGE_MAX);
    const now = new Date();
    await db
      .insert(appErrors)
      .values({
        day: todayEt(now),
        kind: input.kind,
        route: input.route.slice(0, ERROR_ROUTE_MAX) || "/",
        digest: input.digest?.slice(0, 64) ?? null,
        fingerprint: errorFingerprint(input.kind, input.digest, message),
        message,
        stack:
          input.kind === "server" && input.stack
            ? scrubErrorText(input.stack, ERROR_STACK_MAX)
            : null,
        at: now,
        lastAt: now,
      })
      .onConflictDoUpdate({
        target: [appErrors.day, appErrors.kind, appErrors.route, appErrors.fingerprint],
        set: { count: sql`${appErrors.count} + 1`, lastAt: now },
      });
    return true;
  } catch {
    return false;
  }
}

/** Postgres "relation does not exist" — Drizzle hatayı `cause` içine sarıyor. */
function isMissingTable(error: unknown): boolean {
  const codeOf = (value: unknown): unknown =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : undefined;
  return codeOf(error) === "42P01" || codeOf(cause) === "42P01";
}

export type ErrorRead<T> =
  | { ok: true; data: T }
  | { ok: false; missingTable: boolean };

export type ErrorGroup = {
  kind: ErrorKind;
  route: string;
  fingerprint: string;
  digest: string | null;
  message: string;
  /** Pencere boyunca toplam görülme. */
  count: number;
  /** Kaç ayrı günde görüldü. */
  days: number;
  firstAt: Date;
  lastAt: Date;
};

/**
 * Pencere içindeki hatalar, gün satırları birleştirilmiş: aynı rota + aynı
 * parmak izi tek grup. Son görülmeye göre, en yenisi üstte.
 */
export async function getErrorGroups(days: number, limit: number): Promise<ErrorRead<ErrorGroup[]>> {
  try {
    const from = addEtDays(todayEt(), -(days - 1));
    const rows = await db
      .select({
        kind: appErrors.kind,
        route: appErrors.route,
        fingerprint: appErrors.fingerprint,
        digest: sql<string | null>`max(${appErrors.digest})`,
        message: sql<string>`max(${appErrors.message})`,
        count: sql<number>`sum(${appErrors.count})::int`,
        days: sql<number>`count(distinct ${appErrors.day})::int`,
        firstAt: sql<string>`min(${appErrors.at})`,
        lastAt: sql<string>`max(${appErrors.lastAt})`,
      })
      .from(appErrors)
      .where(gte(appErrors.day, from))
      .groupBy(appErrors.kind, appErrors.route, appErrors.fingerprint)
      .orderBy(desc(sql`max(${appErrors.lastAt})`))
      .limit(limit);
    return {
      ok: true,
      data: rows.map((row) => ({
        kind: row.kind === "client" ? "client" : "server",
        route: row.route,
        fingerprint: row.fingerprint,
        digest: row.digest,
        message: row.message,
        count: Number(row.count),
        days: Number(row.days),
        /* Toplama fonksiyonunun sonucu Drizzle'ın kolon eşlemesinden
           geçmiyor, ham dize geliyor (bkz. lib/admin-data.ts → toDate). */
        firstAt: new Date(row.firstAt),
        lastAt: new Date(row.lastAt),
      })),
    };
  } catch (error) {
    return { ok: false, missingTable: isMissingTable(error) };
  }
}

/** Son `hours` saatte görülen hata sayısı (tekrarlar dahil) ve grup sayısı. */
export async function getErrorCountSince(
  hours: number,
): Promise<ErrorRead<{ total: number; groups: number }>> {
  try {
    const since = new Date(Date.now() - hours * HOUR_MS);
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${appErrors.count}), 0)::int`,
        groups: sql<number>`count(*)::int`,
      })
      .from(appErrors)
      .where(gte(appErrors.lastAt, since));
    return { ok: true, data: { total: Number(row?.total ?? 0), groups: Number(row?.groups ?? 0) } };
  } catch (error) {
    return { ok: false, missingTable: isMissingTable(error) };
  }
}

/**
 * 30 günden eski satırları siler — GÜNLÜK CRON'DAN çağrılır
 * (`app/api/cron/daily/route.ts`, sayfa ölçümünün budama adımının yanı).
 *
 * Silinen satır sayısını ya da cron raporuna yazılacak hata dizesini
 * döndürür; fırlatmaz. Tablo yoksa 0: silinecek bir şey yok.
 */
export async function purgeOldErrors(now: Date = new Date()): Promise<number | string> {
  try {
    const cutoff = addEtDays(todayEt(now), -ERROR_RETENTION_DAYS);
    const deleted = await db.delete(appErrors).where(lt(appErrors.day, cutoff));
    return deleted.rowCount ?? 0;
  } catch (error) {
    if (isMissingTable(error)) return 0;
    return `hata: ${error instanceof Error ? error.message : "?"}`;
  }
}
