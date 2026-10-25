import "server-only";
import { cache } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { riskAccess, riskAlerts, riskRules, users } from "@/lib/schema";
import { ConditionSchema, RULE_TONES, type Condition, type RuleTone } from "./rules";

/**
 * RİSK MASASI — ERİŞİM, KURALLAR, UYARILAR (25 Ekim).
 *
 * ERİŞİM KİŞİYE ÖZEL, VARSAYILAN KAPALI. Yönetici (rolü veritabanında
 * "admin") her zaman erişir; başka bir hesap ancak yöneticinin Üyeler
 * ekranından açtığı `risk_access` satırıyla. Rol TOKEN'dan değil
 * veritabanından okunur (lib/admin.ts'in gerekçesi: yetkisi alınan hesabın
 * token'ı bir gün daha "admin" diyebilir).
 *
 * TABLO YOKKEN SESSİZCE DÜŞER (lib/avatar-data.ts kalıbı): migration
 * deploy'da uygulanmıyor. Erişim okunamazsa yönetici dışında herkes kapalı;
 * kural/uyarı okuması `{ ok: false }` döner ve ekran "henüz kurulmadı" der;
 * yazma eylemi `unavailable` döner.
 */

export type RiskViewer = { userId: string; admin: boolean };

/** Oturumdaki kullanıcının erişimi — yoksa null. İstek içinde bir kez. */
export const getRiskViewer = cache(async function getRiskViewer(): Promise<RiskViewer | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return riskViewerFor(userId);
});

/** Kullanıcı kimliğiyle erişim (cron ve sayfa aynı kuralı kullanır). */
export const riskViewerFor = cache(async function riskViewerFor(userId: string): Promise<RiskViewer | null> {
  let role: string | null = null;
  try {
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!row) return null;
    role = row.role;
  } catch {
    return null;
  }
  if (role === "admin") return { userId, admin: true };
  try {
    const [row] = await db.select({ userId: riskAccess.userId }).from(riskAccess).where(eq(riskAccess.userId, userId)).limit(1);
    return row ? { userId, admin: false } : null;
  } catch {
    /* Tablo yok (migration uygulanmadı): yönetici dışında kapalı. */
    return null;
  }
});

/**
 * Yalnız MENÜ bağlantısı için: token'daki rol "admin" ise sorgusuz evet,
 * değilse tek birincil anahtar okuması. Sayfanın kendisi `getRiskViewer`
 * ile veritabanından doğrular (menüde görünmesi yetki değil).
 */
export const hasRiskMenu = cache(async function hasRiskMenu(userId: string, tokenRole: string | undefined): Promise<boolean> {
  if (tokenRole === "admin") return true;
  try {
    const [row] = await db.select({ userId: riskAccess.userId }).from(riskAccess).where(eq(riskAccess.userId, userId)).limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
});

/* --------------------------------------------------------------------------
   Erişim yönetimi (yönetici)
   -------------------------------------------------------------------------- */

export type AccessRow = { userId: string; username: string; grantedAt: Date };

export async function listRiskAccess(): Promise<{ ok: true; rows: AccessRow[] } | { ok: false }> {
  try {
    const rows = await db
      .select({ userId: riskAccess.userId, username: users.username, grantedAt: riskAccess.grantedAt })
      .from(riskAccess)
      .innerJoin(users, eq(users.id, riskAccess.userId))
      .orderBy(desc(riskAccess.grantedAt));
    return { ok: true, rows };
  } catch {
    return { ok: false };
  }
}

/* --------------------------------------------------------------------------
   Kurallar
   -------------------------------------------------------------------------- */

export type StoredRule = {
  id: string;
  label: string;
  tone: RuleTone;
  symbol: string | null;
  conditions: Condition[];
  enabled: boolean;
  active: boolean;
  lastSession: string | null;
};

const StoredConditions = z.array(ConditionSchema).min(1);
const toneOf = (raw: string): RuleTone => ((RULE_TONES as readonly string[]).includes(raw) ? (raw as RuleTone) : "hold");

/** Satırı doğrular; jsonb bozuksa kural atlanır (yanlış koşulla alarm üretmektense). */
export function parseRuleRow(row: typeof riskRules.$inferSelect): StoredRule | null {
  const conditions = StoredConditions.safeParse(row.conditions);
  if (!conditions.success) return null;
  return {
    id: row.id,
    label: row.label,
    tone: toneOf(row.tone),
    symbol: row.symbol,
    conditions: conditions.data,
    enabled: row.enabled,
    active: row.active,
    lastSession: row.lastSession,
  };
}

export async function listRules(userId: string): Promise<{ ok: true; rules: StoredRule[] } | { ok: false }> {
  try {
    const rows = await db.select().from(riskRules).where(eq(riskRules.userId, userId)).orderBy(riskRules.createdAt);
    return { ok: true, rules: rows.flatMap((row) => parseRuleRow(row) ?? []) };
  } catch {
    return { ok: false };
  }
}

export type StoredAlert = { id: string; session: string; message: string; symbols: string[]; label: string; tone: RuleTone; createdAt: Date };

export async function listAlerts(userId: string, limit = 12): Promise<{ ok: true; alerts: StoredAlert[] } | { ok: false }> {
  try {
    const rows = await db
      .select({
        id: riskAlerts.id,
        session: riskAlerts.session,
        message: riskAlerts.message,
        symbols: riskAlerts.symbols,
        createdAt: riskAlerts.createdAt,
        label: riskRules.label,
        tone: riskRules.tone,
      })
      .from(riskAlerts)
      .innerJoin(riskRules, eq(riskRules.id, riskAlerts.ruleId))
      .where(eq(riskAlerts.userId, userId))
      .orderBy(desc(riskAlerts.createdAt))
      .limit(limit);
    return { ok: true, alerts: rows.map((row) => ({ ...row, tone: toneOf(row.tone), symbols: Array.isArray(row.symbols) ? row.symbols : [] })) };
  } catch {
    return { ok: false };
  }
}

/** Cron: kuralı olan ve hâlâ erişimi süren kullanıcılar. Tablo yoksa null. */
export async function rulesByUser(): Promise<Map<string, StoredRule[]> | null> {
  try {
    const rows = await db.select().from(riskRules).where(eq(riskRules.enabled, true));
    const out = new Map<string, StoredRule[]>();
    for (const row of rows) {
      const rule = parseRuleRow(row);
      if (!rule) continue;
      const list = out.get(row.userId) ?? [];
      list.push(rule);
      out.set(row.userId, list);
    }
    return out;
  } catch {
    return null;
  }
}

/** Cron: değerlendirme sonucunu yazar. Yalnız sahibinin kuralları (`userId` koşulu). */
export async function markRules(userId: string, session: string, ids: { active: string[]; inactive: string[] }): Promise<void> {
  if (ids.active.length)
    await db.update(riskRules).set({ active: true, lastSession: session }).where(and(eq(riskRules.userId, userId), inArray(riskRules.id, ids.active)));
  if (ids.inactive.length)
    await db.update(riskRules).set({ active: false, lastSession: session }).where(and(eq(riskRules.userId, userId), inArray(riskRules.id, ids.inactive)));
}

/** Cron: uyarıyı yazar; aynı kural + seans varsa hiçbir şey yazmaz ve null döner. */
export async function recordAlert(input: { ruleId: string; userId: string; session: string; message: string; symbols: string[] }): Promise<string | null> {
  const [row] = await db
    .insert(riskAlerts)
    .values(input)
    .onConflictDoNothing({ target: [riskAlerts.ruleId, riskAlerts.session] })
    .returning({ id: riskAlerts.id });
  return row?.id ?? null;
}

export async function markDelivered(alertId: string, delivered: number): Promise<void> {
  await db.update(riskAlerts).set({ delivered }).where(eq(riskAlerts.id, alertId));
}
