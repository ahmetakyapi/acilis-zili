import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { sendToUser } from "@/lib/push";
import { getMarketDesk } from "@/lib/risk/data";
import { getExposure } from "@/lib/risk/exposure";
import { fill } from "@/lib/risk/format";
import { describeRule, evaluateRule, type ConditionLabels } from "@/lib/risk/rules";
import { markDelivered, markRules, recordAlert, riskViewerFor, rulesByUser, type StoredRule } from "@/lib/risk/store";
import { users } from "@/lib/schema";

/**
 * Risk Masası kuralları (25 Ekim) — `deploy/cron-risk.sh` günde iki kez
 * çağırır: kapanıştan sonra (21:40 UTC; bar ölçüleri o seansın) ve ertesi
 * sabah (11:15 UTC; FRED'in bir gün geciken serileri — VXN, VIX3M, kredi
 * farkı — o saatte gelmiş oluyor). İkisi de AYNI tamamlanmış seansı
 * değerlendirir (`expectedLastSession`); ikinci koşu yalnız ilk koşuda
 * okunamayan girdiler yüzünden tetiklenmeyen kuralı yakalar.
 *
 * BİLDİRİM YALNIZ DÖNÜŞTE. Kural son değerlendirmede tetikli değilken
 * tetiklendiyse (`active` yanlıştan doğruya) bir uyarı satırı yazılır ve
 * Web Push gider; koşul sürdükçe her gün yeniden gitmez. Aynı kural + seans
 * için ikinci satır açılamaz (benzersiz dizin), tekrar koşan cron ikinci
 * bildirim atmaz.
 *
 * YALNIZ PUSH, E-POSTA YOK (bilerek). Masa başka üyelere de açılabildiği
 * için posta yeni bir bildirim türü olurdu ve CLAUDE.md'nin kuralı onu
 * KVKK metni + şablon + tercih + çıkış kapsamıyla ister; ilk sürüm Web
 * Push'la (tercihi zaten cihazda) yetiniyor. Gelen kutusuna da yazılmıyor:
 * `notifications.kind` sözlüğü genişletilmedi, uyarılar masanın kendi
 * "Son Uyarılar" panelinde.
 *
 * VERİ DÜRÜSTLÜĞÜ. Barlar seans gününe ait değilse (`barsStale`) ya da
 * rejim hesaplanamadıysa hiçbir kural değerlendirilmez: eksik veri alarm
 * üretmez. Erişimi kapatılmış kullanıcının kuralları atlanır.
 *
 * Tablo yoksa (migration uygulanmadı) 200 `table-missing`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

let running = false;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (running) return NextResponse.json({ skipped: "running" });
  running = true;
  try {
    return await run();
  } finally {
    running = false;
  }
}

async function accountLocale(userId: string): Promise<Locale> {
  try {
    const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);
    return row && isLocale(row.locale) ? row.locale : "tr";
  } catch {
    return "tr";
  }
}

function messageFor(rule: StoredRule, symbols: string[], locale: Locale) {
  const t = getDictionary(locale).riskDesk;
  const loc = locale === "en" ? "en" : "tr";
  const conditions = describeRule(rule, t.conditions as ConditionLabels, { and: t.rules.and, all: t.rules.allPositions }, loc);
  return {
    title: fill(t.push.title, { label: rule.label }),
    body: symbols.length
      ? fill(t.push.bodySymbols, { symbols: symbols.join(", "), conditions })
      : fill(t.push.body, { conditions }),
  };
}

async function run(): Promise<NextResponse> {
  const byUser = await rulesByUser();
  if (!byUser) return NextResponse.json({ skipped: "table-missing" });
  if (byUser.size === 0) return NextResponse.json({ users: 0 });
  const desk = await getMarketDesk();
  if (desk.barsStale || !desk.today) return NextResponse.json({ skipped: "stale", session: desk.session });

  let evaluated = 0;
  let triggered = 0;
  let delivered = 0;
  for (const [userId, rules] of byUser) {
    const viewer = await riskViewerFor(userId);
    if (!viewer) continue;
    const exposure = await getExposure(userId, desk);
    const facts = exposure.ok && exposure.exposure ? exposure.exposure.facts : [];
    const locale = await accountLocale(userId);
    const active: string[] = [];
    const inactive: string[] = [];
    for (const rule of rules) {
      evaluated += 1;
      const outcome = evaluateRule(rule, desk.market, facts);
      if (!outcome.triggered) {
        inactive.push(rule.id);
        continue;
      }
      active.push(rule.id);
      if (rule.active) continue;
      triggered += 1;
      try {
        const text = messageFor(rule, outcome.symbols, locale);
        const alertId = await recordAlert({ ruleId: rule.id, userId, session: desk.session, message: text.body, symbols: outcome.symbols });
        if (!alertId) continue;
        const sent = await sendToUser(userId, (deviceLocale) => ({
          ...messageFor(rule, outcome.symbols, deviceLocale),
          url: withLocale("/risk", deviceLocale),
          tag: `risk-${rule.id}`,
        }));
        delivered += sent;
        await markDelivered(alertId, sent);
      } catch (error) {
        console.error(`[risk cron] ${rule.id}: ${error instanceof Error ? error.message : "?"}`);
      }
    }
    try {
      await markRules(userId, desk.session, { active, inactive });
    } catch (error) {
      console.error(`[risk cron] durum yazılamadı: ${error instanceof Error ? error.message : "?"}`);
    }
  }
  return NextResponse.json({ session: desk.session, evaluated, triggered, delivered });
}
