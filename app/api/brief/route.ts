import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { dailyBriefs } from "@/lib/schema";
import { todayEt } from "@/lib/market-hours";
import { isLocale } from "@/lib/i18n/config";

/**
 * Günlük özet alım ucu.
 *
 * Kullanıcının KENDİ Claude'u (Claude Code cron'u, zamanlanmış ajan vb.)
 * her sabah /api/brief/context'ten veriyi çekip yazıyı yazar ve buraya
 * gönderir. Site sadece veritabanından okur — API anahtarı maliyeti yok.
 * Sunucu cron'u aynı güne kayıt VARSA dokunmaz; bu uçtan gelen yazı esastır.
 */

const BodySchema = z.object({
  headline: z.string().trim().min(1).max(200),
  body_md: z.string().trim().min(1).max(8000),
  locale: z.string().optional(),
  /** "YYYY-MM-DD" (ET). Boşsa bugünün ET tarihi. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /**
   * "daily" | "weekly". Haftalıkta `date` dönemin PAZARTESİsi olmalı —
   * /api/brief/context yanıtındaki `brief_date` alanı zaten onu veriyor.
   */
  period: z.enum(["daily", "weekly"]).optional(),
});

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      {
        error: "invalid-body",
        expected: {
          headline: "string (≤200)",
          body_md: "string (≤8000, markdown)",
          locale: "tr | en (opsiyonel, varsayılan tr)",
          date: "YYYY-MM-DD (opsiyonel, varsayılan bugünün ET tarihi)",
          period: "daily | weekly (opsiyonel, varsayılan daily)",
        },
      },
      { status: 400 },
    );
  }

  const locale = isLocale(parsed.locale) ? parsed.locale : "tr";
  const briefDate = parsed.date ?? todayEt();
  const period = parsed.period ?? "daily";

  await db
    .insert(dailyBriefs)
    .values({
      briefDate,
      locale,
      period,
      headline: parsed.headline,
      bodyMd: parsed.body_md,
      generatedBy: "claude",
    })
    .onConflictDoUpdate({
      target: [dailyBriefs.briefDate, dailyBriefs.locale, dailyBriefs.period],
      set: {
        headline: parsed.headline,
        bodyMd: parsed.body_md,
        generatedBy: "claude",
        generatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true, date: briefDate, locale, period });
}
