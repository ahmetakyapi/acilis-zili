import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { anonymousClient, memberClient } from "@/lib/claude-budget";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { readTextCapped } from "@/lib/read-body";
import { hasFilters, normalizeQuery, QUERY_MAX, translationQuery } from "@/lib/screen-query";
import { translateScreenQuery } from "@/lib/screen-query-ai";
import { insightsConfigured } from "@/lib/stock-insights";

/**
 * Düz cümleyle tarama (24 Ekim) — POST `{ q }`. Gerekçe lib/screen-query.ts,
 * çağrı ve önbellek lib/screen-query-ai.ts.
 *
 * Yanıt bir ADRES sorgusu: istemci `/tarama?…` adresine gider, sonuçları
 * tarayıcının kendisi süzer. Uç hisse listesi döndürmez.
 *
 * KAPILAR. Bot (kullanıcı ajanı) geri çevrilir. Oturumsuz okur IP başına
 * dakikada 3, günde 20 cümle — öteki not uçlarından sıkı: her yeni cümle
 * önbellekte olmayan bir çağrı ve bileşim sayısı sınırsız. Oturumlu okur
 * dakikada 6, günde 60. Sayaçlar önbellekteki cümleyi de sayar (uç ucuz
 * olsa da tekrar tekrar gönderilen cümle bir döngü işareti). Claude'a
 * giden çağrı ayrıca günlük bütçeden düşer (lib/claude-budget.ts): anonim
 * okur ortak anonim paydan, üye kendi sayacından. Pay doluysa ya da Claude
 * yanıt vermediyse `unavailable` — ekran elle süzgeçlerle çalışmaya devam
 * eder.
 *
 * SIRA (24 Ekim düzeltmesi): köken → bot → oran sınırı → gövde. Köken aynı
 * site olmalı (Bu Hisseye Sor ve analiz ucuyla aynı denetim): uç oturum
 * çereziyle üyenin Claude payını harcatabiliyor, başka bir site okurun
 * tarayıcısından bu isteği atmasın. Oran sınırı gövdeden ÖNCE: sınırı aşan
 * istemci gövdeyi hiç okutmaz. Gövde akış sırasında 2 KB'de kesilir
 * (lib/read-body.ts; `request.json()` gövdenin tamamını belleğe alıyordu).
 * Cümle tavanı 160 karakter (`QUERY_MAX`), JSON zarfıyla birlikte 2 KB
 * fazlasıyla yeter.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_BYTES = 2048;
const DAY_MS = 24 * 3600_000;
const ANON_PER_MINUTE = 3;
const ANON_PER_DAY = 20;
const MEMBER_PER_MINUTE = 6;
const MEMBER_PER_DAY = 60;

const Body = z.object({ q: z.string().max(QUERY_MAX * 2) });

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" });
  if (request.headers.get("origin") !== new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin) return respond({ ok: false, reason: "origin" }, 403);
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);

  const session = await auth();
  const userId = session?.user?.id;
  const allowed = userId
    ? rateLimit(`tarama-cumle:${userId}`, MEMBER_PER_MINUTE, 60_000).allowed &&
      rateLimit(`tarama-cumle-gun:${userId}`, MEMBER_PER_DAY, DAY_MS).allowed
    : rateLimit(clientKey(request, "tarama-cumle"), ANON_PER_MINUTE, 60_000).allowed &&
      rateLimit(clientKey(request, "tarama-cumle-gun"), ANON_PER_DAY, DAY_MS).allowed;
  if (!allowed) return respond({ ok: false, reason: "rate" }, 429);

  let q: string;
  try {
    const raw = await readTextCapped(request, MAX_BODY_BYTES);
    if (raw === null) return respond({ ok: false, reason: "bad-request" }, 400);
    const body = Body.safeParse(JSON.parse(raw));
    if (!body.success) return respond({ ok: false, reason: "bad-request" }, 400);
    q = body.data.q;
  } catch {
    return respond({ ok: false, reason: "bad-request" }, 400);
  }
  const sentence = normalizeQuery(q);
  if (!sentence) return respond({ ok: false, reason: "short" }, 400);

  const translation = await translateScreenQuery(sentence, userId ? memberClient(userId) : anonymousClient(request));
  if (!translation) return respond({ ok: false, reason: "unavailable" });
  return respond({
    ok: true,
    /* Ne süzgeç ne sıralama çıktıysa adres verilmez: okur değişmemiş bir
       taramaya gönderilmez, desteklenmeyen parçalar yine söylenir. */
    query: hasFilters(translation.filters) || translation.sort ? translationQuery(translation, q) : null,
    unsupported: translation.unsupported,
    dropped: translation.dropped,
  });
}
