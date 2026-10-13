import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "./db";
import { earningsCalendar, earningsOverrides } from "./schema";
import { addEtDays, todayEt } from "./market-hours";
import { guncelBilanco } from "./data";

/**
 * Bilanço takviminin ELLE DÜZELTME katmanı.
 *
 * SORUN (13 Ekim, canlı tarama): NVDA'nın Kasım ortasındaki bilançosu teknik
 * bağlamda yoktu, SNDK/SPCX/PLTR/NBIS/RKLB/ONDS'un tarihi vardı ama penceresi
 * (bmo/amc) boştu. Rutin doğru tarihi şirketin yatırımcı sayfasından
 * buluyordu ama yazacak bir yeri yoktu; her koşuda yeniden arıyordu.
 *
 * KURAL: elle girilen kayıt sağlayıcının ÖNÜNE geçer. Sağlayıcı aynı tarihi
 * ve aynı pencereyi söyleyince kayıt kendiliğinden kapanır (artık gereksiz);
 * farklı bir şey söylerse `conflict` olur — yine öne geçer, ama bağlam ucu
 * iki tarihi de yazar ki rutin kaynağı yeniden doğrulasın. Sağlayıcı aynı
 * tarihi verip pencereyi BOŞ bırakırsa kayıt açık kalır: pencereyi taşıyan
 * yalnızca o.
 *
 * "Aynı rapor" ölçütü tarih yakınlığı: aynı sembolün ±`SAME_REPORT_DAYS`
 * içindeki sağlayıcı satırı aynı çeyreğin raporudur. Çeyreklik raporlar
 * ~90 gün arayla; 45 gün iki raporu karıştırmaz.
 *
 * Tablo yoksa (migration inmeden) okuma yolu sessizce sağlayıcı satırlarına
 * düşer — CLAUDE.md, "kod migration'dan önce yayına inebilir".
 */

export const SAME_REPORT_DAYS = 45;
/** Rapor gününden bu kadar sonra elle kayıt kapanır: gerçekleşen rakamlar
    sağlayıcının, tarih artık haber değil. */
const CLOSE_AFTER_DAYS = 7;

export type OverrideRow = typeof earningsOverrides.$inferSelect;
export type DateSource = "provider" | "manual";

/** Birleştirmenin beklediği asgari satır — `earnings_calendar` ya da seçilmiş alt kümesi. */
type ProviderLike = { symbol: string; reportDate: string; hour: string | null };

export type MergedEarnings<T extends ProviderLike> = T & {
  dateSource: DateSource;
  /** `conflict` durumunda sağlayıcının söylediği; yoksa null. */
  conflict: { providerDate: string | null; providerHour: string | null } | null;
  sourceUrl: string | null;
};

function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
}

/**
 * SAF birleştirme. `provider` [from, to] aralığındaki sağlayıcı satırları,
 * `overrides` açık (active/conflict) elle kayıtlar — aralığın ±45 gün
 * dışını da kapsamalı, çünkü aralık DIŞINA taşınmış bir raporun aralık
 * içindeki eski sağlayıcı satırı da düşmeli. `synth` sağlayıcıda karşılığı
 * olmayan elle kayıttan satır üretir.
 */
export function mergeEarnings<T extends ProviderLike>(
  provider: readonly T[],
  overrides: readonly OverrideRow[],
  range: { from: string; to: string },
  synth: (override: OverrideRow) => T,
): MergedEarnings<T>[] {
  const open = overrides.filter((row) => row.status === "active" || row.status === "conflict");
  const covered = (row: ProviderLike) =>
    open.some((o) => o.symbol === row.symbol && dayDiff(o.reportDate, row.reportDate) <= SAME_REPORT_DAYS);

  const out: MergedEarnings<T>[] = provider
    .filter((row) => !covered(row))
    .map((row) => ({ ...row, dateSource: "provider" as const, conflict: null, sourceUrl: null }));

  for (const o of open) {
    if (o.reportDate < range.from || o.reportDate > range.to) continue;
    /* Sağlayıcının aynı günlü satırı varsa beklenti/gerçekleşen alanları
       ondan kalır; tarih ve pencere elle kayıttan. */
    const base = provider.find((row) => row.symbol === o.symbol && row.reportDate === o.reportDate) ?? synth(o);
    out.push({
      ...base,
      reportDate: o.reportDate,
      hour: o.timing,
      dateSource: "manual",
      conflict: o.status === "conflict" ? { providerDate: o.providerDate, providerHour: o.providerHour } : null,
      sourceUrl: o.sourceUrl,
    });
  }
  return out.sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.symbol.localeCompare(b.symbol));
}

/**
 * Açık elle kayıtlar — aralığın ±45 gün genişletilmiş hâli (gerekçe
 * `mergeEarnings`). Tablo yoksa boş.
 */
export async function loadOpenOverrides(
  from: string,
  to: string,
  symbols?: readonly string[],
): Promise<OverrideRow[]> {
  try {
    return await db
      .select()
      .from(earningsOverrides)
      .where(
        and(
          ne(earningsOverrides.status, "closed"),
          gte(earningsOverrides.reportDate, addEtDays(from, -SAME_REPORT_DAYS)),
          lte(earningsOverrides.reportDate, addEtDays(to, SAME_REPORT_DAYS)),
          symbols ? inArray(earningsOverrides.symbol, [...symbols]) : undefined,
        ),
      );
  } catch {
    return [];
  }
}

/** Sağlayıcı satırı olmayan elle kayıt için `earnings_calendar` biçiminde satır. */
export function synthCalendarRow(o: OverrideRow): typeof earningsCalendar.$inferSelect {
  return {
    id: o.id,
    symbol: o.symbol,
    reportDate: o.reportDate,
    hour: o.timing,
    epsEstimate: null,
    epsActual: null,
    revenueEstimate: null,
    revenueActual: null,
    quarter: null,
    year: null,
    updatedAt: o.updatedAt,
  };
}

/** Kayıt için verilecek karar — saf, test edilebilir. */
export function judgeOverride(
  o: Pick<OverrideRow, "reportDate" | "timing">,
  providerRows: readonly { reportDate: string; hour: string | null }[],
  today: string,
): { status: "active" | "closed" | "conflict"; closedReason: string | null; providerDate: string | null; providerHour: string | null } {
  if (o.reportDate < addEtDays(today, -CLOSE_AFTER_DAYS)) {
    return { status: "closed", closedReason: "past", providerDate: null, providerHour: null };
  }
  const near = providerRows
    .filter((row) => dayDiff(row.reportDate, o.reportDate) <= SAME_REPORT_DAYS)
    .sort((a, b) => dayDiff(a.reportDate, o.reportDate) - dayDiff(b.reportDate, o.reportDate))[0];
  if (!near) return { status: "active", closedReason: null, providerDate: null, providerHour: null };
  const seen = { providerDate: near.reportDate, providerHour: near.hour };
  if (near.reportDate !== o.reportDate) return { status: "conflict", closedReason: null, ...seen };
  if (near.hour === o.timing) return { status: "closed", closedReason: "provider-match", ...seen };
  // Aynı gün, pencere boş: pencereyi taşıyan elle kayıt — açık kalır.
  if (!near.hour) return { status: "active", closedReason: null, ...seen };
  return { status: "conflict", closedReason: null, ...seen };
}

/**
 * Açık kayıtları sağlayıcının güncel satırlarıyla uzlaştırır. Günlük cron
 * takvimi yazdıktan sonra ve yazma ucu her POST'tan sonra çağırıyor.
 * Tablo yoksa `null` (rapora "tablo yok" düşsün, sessiz sıfır değil).
 */
export async function reconcileOverrides(
  today: string = todayEt(),
): Promise<{ open: number; closed: number; conflict: number } | null> {
  let open: OverrideRow[];
  try {
    open = await db.select().from(earningsOverrides).where(ne(earningsOverrides.status, "closed"));
  } catch {
    return null;
  }
  const tally = { open: 0, closed: 0, conflict: 0 };
  if (open.length === 0) return tally;

  const symbols = [...new Set(open.map((row) => row.symbol))];
  const provider = await db
    .select({ symbol: earningsCalendar.symbol, reportDate: earningsCalendar.reportDate, hour: earningsCalendar.hour })
    .from(earningsCalendar)
    .where(inArray(earningsCalendar.symbol, symbols));

  const now = new Date();
  for (const o of open) {
    const verdict = judgeOverride(o, provider.filter((row) => row.symbol === o.symbol), today);
    if (verdict.status === "closed") tally.closed++;
    else if (verdict.status === "conflict") tally.conflict++;
    else tally.open++;
    if (
      verdict.status === o.status &&
      verdict.providerDate === o.providerDate &&
      verdict.providerHour === o.providerHour
    ) continue;
    await db
      .update(earningsOverrides)
      .set({
        status: verdict.status,
        closedReason: verdict.closedReason,
        providerDate: verdict.providerDate,
        providerHour: verdict.providerHour,
        updatedAt: now,
        closedAt: verdict.status === "closed" ? now : null,
      })
      .where(eq(earningsOverrides.id, o.id));
  }
  return tally;
}

/**
 * Bağlam uçlarının ortak okuma yolu: sağlayıcı satırları + elle düzeltme.
 * `symbols` verilirse yalnız o semboller.
 */
export async function getEarningsWithOverrides(
  from: string,
  to: string,
  symbols?: readonly string[],
): Promise<MergedEarnings<typeof earningsCalendar.$inferSelect>[]> {
  const [provider, overrides] = await Promise.all([
    db
      .select()
      .from(earningsCalendar)
      .where(
        and(
          gte(earningsCalendar.reportDate, from),
          lte(earningsCalendar.reportDate, to),
          symbols ? inArray(earningsCalendar.symbol, [...symbols]) : undefined,
          // Revize edilmiş tarihin ölü satırı düşer (gerekçe `guncelBilanco`).
          guncelBilanco,
        ),
      ),
    loadOpenOverrides(from, to, symbols),
  ]);
  return mergeEarnings(provider, overrides, { from, to }, synthCalendarRow);
}

/** Bağlam ucunun yanıtına giren kaynak alanları — üç uçta aynı biçim. */
export function sourceFields(row: { dateSource: DateSource; conflict: MergedEarnings<ProviderLike>["conflict"]; sourceUrl: string | null }) {
  return {
    date_source: row.dateSource,
    ...(row.dateSource === "manual" ? { source_url: row.sourceUrl } : {}),
    ...(row.conflict
      ? { date_conflict: { provider_date: row.conflict.providerDate, provider_timing: row.conflict.providerHour } }
      : {}),
  };
}
