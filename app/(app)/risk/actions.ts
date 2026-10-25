"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { isBot } from "@/lib/analytics";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { rateLimit } from "@/lib/rate-limit";
import { getMarketDesk } from "@/lib/risk/data";
import { getExposure } from "@/lib/risk/exposure";
import { getDeskNote, noteInput, type NoteResult } from "@/lib/risk/note";
import { evaluateRule, MAX_RULES, RuleInputSchema } from "@/lib/risk/rules";
import { getRiskViewer, listRules } from "@/lib/risk/store";
import { riskRules } from "@/lib/schema";

/**
 * Risk Masası eylemleri. HER EYLEM HERKESE AÇIK BİR POST UCUDUR: oturum
 * (`getRiskViewer` → auth() + veritabanından rol ya da `risk_access`
 * satırı), zod ve sahiplik (her yazma ve silme `user_id = oturumdaki
 * kullanıcı` koşuluyla; başkasının kural kimliği hiçbir satıra dokunmaz).
 * Erişimi olmayan istek sayfanın 404'üyle aynı sessizlikte döner: eylem
 * masanın varlığını söyleyen bir hata metni vermez.
 */

export type RuleActionState = { ok: boolean; message: string };
const DENIED: RuleActionState = { ok: false, message: "" };

const Id = z.uuid();

function tableMissing(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "42P01";
}

export async function createRiskRule(_state: RuleActionState, form: FormData): Promise<RuleActionState> {
  const viewer = await getRiskViewer();
  if (!viewer) return DENIED;
  const { t } = await getI18n();
  const m = t.riskDesk.rules.messages;
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("rule") ?? ""));
  } catch {
    return { ok: false, message: m.invalid };
  }
  const parsed = RuleInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: m.invalid };
  const rule = parsed.data;
  try {
    const [{ value: existing } = { value: 0 }] = await db.select({ value: count() }).from(riskRules).where(eq(riskRules.userId, viewer.userId));
    if (existing >= MAX_RULES) return { ok: false, message: m.limit };
    await db.insert(riskRules).values({
      userId: viewer.userId,
      label: rule.label,
      tone: rule.tone,
      symbol: rule.symbol,
      conditions: rule.conditions,
    });
  } catch (error) {
    return { ok: false, message: tableMissing(error) ? m.unavailable : m.failed };
  }
  revalidatePath("/risk");
  return { ok: true, message: m.saved };
}

export async function deleteRiskRule(form: FormData): Promise<void> {
  const viewer = await getRiskViewer();
  if (!viewer) return;
  const id = Id.safeParse(form.get("id"));
  if (!id.success) return;
  try {
    await db.delete(riskRules).where(and(eq(riskRules.id, id.data), eq(riskRules.userId, viewer.userId)));
  } catch {
    return;
  }
  revalidatePath("/risk");
}

export async function toggleRiskRule(form: FormData): Promise<void> {
  const viewer = await getRiskViewer();
  if (!viewer) return;
  const input = z.object({ id: Id, enabled: z.enum(["1", "0"]) }).safeParse({ id: form.get("id"), enabled: form.get("enabled") });
  if (!input.success) return;
  try {
    await db
      .update(riskRules)
      .set({ enabled: input.data.enabled === "1", ...(input.data.enabled === "0" ? { active: false } : {}) })
      .where(and(eq(riskRules.id, input.data.id), eq(riskRules.userId, viewer.userId)));
  } catch {
    return;
  }
  revalidatePath("/risk");
}

export type NoteActionResult = NoteResult | { ok: false; reason: "rate" | "denied" };

/** "Masayı Yorumla": erişim + bot reddi + kişi başı hız sınırı; önbellek ve bütçe lib/risk/note.ts'te. */
export async function interpretRiskDesk(): Promise<NoteActionResult> {
  const viewer = await getRiskViewer();
  if (!viewer) return { ok: false, reason: "denied" };
  const ua = (await headers()).get("user-agent") ?? "";
  if (isBot(ua)) return { ok: false, reason: "denied" };
  if (!rateLimit(`risk-note:${viewer.userId}`, 4, 60_000).allowed) return { ok: false, reason: "rate" };
  const { t, locale } = await getI18n();
  const loc = locale === "en" ? "en" : "tr";
  const desk = await getMarketDesk();
  const [exposure, rules] = await Promise.all([getExposure(viewer.userId, desk), listRules(viewer.userId)]);
  const exp = exposure.ok ? exposure.exposure : null;
  const triggered = rules.ok
    ? rules.rules.flatMap((rule) => {
        if (!rule.enabled) return [];
        const outcome = evaluateRule(rule, desk.market, exp?.facts ?? []);
        return outcome.triggered ? [{ rule, symbols: outcome.symbols }] : [];
      })
    : [];
  return getDeskNote(viewer.userId, noteInput(desk, exp, triggered, t.riskDesk, loc), desk.session, loc);
}
