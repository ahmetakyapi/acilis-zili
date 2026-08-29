import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import {
  BRIEF_INPUT_SHAPE,
  briefInputSchema,
  saveBrief,
} from "@/lib/content-write";

/**
 * Günlük özet alım ucu.
 *
 * Kullanıcının KENDİ Claude'u (Claude Code cron'u, zamanlanmış ajan vb.)
 * her sabah /api/brief/context'ten veriyi çekip yazıyı yazar ve buraya
 * gönderir. Site sadece veritabanından okur — API anahtarı maliyeti yok.
 * Sunucu cron'u aynı güne kayıt VARSA dokunmaz; bu uçtan gelen yazı esastır.
 *
 * DOĞRULAMA VE YAZMA BURADA DEĞİL, `lib/content-write.ts`te. Panel de aynı
 * şemayı çağırıyor: bülten iki girişten yazılabiliyor ama tek yoldan
 * geçiyor. Gerekçesi orada yazılı — haftalık kaydın pazartesiye çapalanması
 * ve künyenin kimde kalacağı dahil.
 */

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
    parsed = briefInputSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "invalid-body", expected: BRIEF_INPUT_SHAPE },
      { status: 400 },
    );
  }

  const { date, locale, period } = await saveBrief(parsed, "claude");
  return NextResponse.json({ ok: true, date, locale, period });
}
