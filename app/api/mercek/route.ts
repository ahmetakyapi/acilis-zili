import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { z } from "zod";
import { db } from "@/lib/db";
import { stories } from "@/lib/schema";
import { todayEt } from "@/lib/market-hours";
import { isLocale } from "@/lib/i18n/config";

/**
 * Mercek yazısı alım ucu.
 *
 * Günlük bültendeki köprünün aynısı: kullanıcının kendi Claude rutini
 * (claude.ai zamanlanmış görev) akşam gün içinde yaşananları tarar, anlatmaya
 * değer bir olay varsa yazıyı yazıp buraya gönderir. Sitede API anahtarı
 * tutulmaz, model maliyeti sunucuya binmez.
 *
 * Aynı `slug` ikinci kez gelirse üzerine yazılır — bir dosya düzeltilebilir.
 * Yeni bir olay için yeni bir slug kullanılır.
 */

const SourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500).optional(),
});

const BodySchema = z.object({
  /** URL'de görünen kimlik: küçük harf, tire. "leopold-tasfiyesi" gibi. */
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "yalnızca küçük harf, rakam ve tire"),
  title: z.string().trim().min(1).max(160),
  /** Başlığın altındaki tek cümlelik giriş. */
  dek: z.string().trim().min(1).max(400),
  body_md: z.string().trim().min(200).max(40000),
  /** Olayın yaşandığı gün (ET). Boşsa bugün. */
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  locale: z.string().optional(),
  symbols: z.array(z.string().trim().min(1).max(12)).max(12).optional(),
  sources: z.array(SourceSchema).max(20).optional(),
});

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

/** Ortalama okuma hızıyla dakika — listede künye olarak görünür. */
function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(markdown.trim().split(/\s+/).length / 200));
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid-body",
        detail: error instanceof z.ZodError ? error.issues : undefined,
        expected: {
          slug: "kebab-case (3-80)",
          title: "string (≤160)",
          dek: "string (≤400) — tek cümlelik giriş",
          body_md: "markdown (200-40000)",
          event_date: "YYYY-MM-DD (opsiyonel, varsayılan bugün ET)",
          locale: "tr | en (opsiyonel, varsayılan tr)",
          symbols: "['NVDA', 'MU'] (opsiyonel)",
          sources: "[{ label, url }] (opsiyonel)",
        },
      },
      { status: 400 },
    );
  }

  const locale = isLocale(parsed.locale) ? parsed.locale : "tr";
  const eventDate = parsed.event_date ?? todayEt();
  const values = {
    slug: parsed.slug,
    locale,
    title: parsed.title,
    dek: parsed.dek,
    bodyMd: parsed.body_md,
    eventDate,
    symbols: parsed.symbols?.map((symbol) => symbol.toUpperCase()) ?? null,
    sources: parsed.sources ?? null,
    readMinutes: readingMinutes(parsed.body_md),
    generatedBy: "claude",
  };

  await db
    .insert(stories)
    .values(values)
    .onConflictDoUpdate({
      target: [stories.slug, stories.locale],
      set: { ...values, updatedAt: new Date() },
    });

  return NextResponse.json({
    ok: true,
    slug: parsed.slug,
    locale,
    event_date: eventDate,
    url: `/mercek/${parsed.slug}`,
  });
}
