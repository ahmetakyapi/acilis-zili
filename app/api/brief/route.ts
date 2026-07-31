import { NextResponse } from "next/server";
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
});

function authorized(request: Request): boolean {
  const secret = process.env.BRIEF_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
        },
      },
      { status: 400 },
    );
  }

  const locale = isLocale(parsed.locale) ? parsed.locale : "tr";
  const briefDate = parsed.date ?? todayEt();

  await db
    .insert(dailyBriefs)
    .values({
      briefDate,
      locale,
      headline: parsed.headline,
      bodyMd: parsed.body_md,
      generatedBy: "claude",
    })
    .onConflictDoUpdate({
      target: [dailyBriefs.briefDate, dailyBriefs.locale],
      set: {
        headline: parsed.headline,
        bodyMd: parsed.body_md,
        generatedBy: "claude",
        generatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true, date: briefDate, locale });
}
