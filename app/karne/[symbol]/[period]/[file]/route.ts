import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { earningsAnalysisCards } from "@/lib/schema";
import { isLocale } from "@/lib/i18n/config";

/**
 * Bilanço karnesi görselini servis eder: `/karne/sndk/4c-fy2026/tr.png`
 *
 * `/api` ALTINDA DEĞİL, bilinçli olarak. `next.config.ts` bütün `/api/*`
 * yanıtlarına `no-store` basıyor — fiyatın eski kopyasının servis edilmesi
 * kabul edilemez olduğu için doğru bir kural, ama megabaytlık bir PNG'yi her
 * görüntülemede yeniden indirmek anlamsız. Burada kendi önbellek başlıkları
 * geçerli.
 *
 * Adres `.png` ile bitiyor çünkü analiz kaydındaki `card_image_url` alanı bir
 * dosya yolu bekliyor (`^/…\.(png|jpg|jpeg|webp)$`) ve `next/image` uzantıya
 * bakarak davranıyor. Dosya adının kendisi dili taşıyor: karne metin içerir,
 * Türkçesiyle İngilizcesi aynı görsel değildir.
 *
 * `?indir=1` ile Content-Disposition eklenir — "PNG İndir" düğmesi bunu
 * kullanır; aynı adres hem gömme hem indirme için çalışır.
 */

/** Karne düzeltilebiliyor, o yüzden `immutable` YOK: ETag ile doğrulanıyor. */
const CACHE = "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(
  request: Request,
  context: RouteContext<"/karne/[symbol]/[period]/[file]">,
) {
  const { symbol, period, file } = await context.params;

  /* Dosya adı "tr.png" — uzantıyı at, kalanı dil kodu. Tanınmayan bir dil
     geldiğinde 404 yerine Türkçeye düşmek yanlış görseli servis ederdi. */
  const localePart = file.replace(/\.(png|jpe?g|webp)$/i, "");
  if (!isLocale(localePart)) {
    return new Response("not found", { status: 404 });
  }

  let row;
  try {
    [row] = await db
      .select()
      .from(earningsAnalysisCards)
      .where(
        and(
          eq(earningsAnalysisCards.symbol, symbol.toUpperCase()),
          eq(earningsAnalysisCards.period, period),
          eq(earningsAnalysisCards.locale, localePart),
        ),
      )
      .limit(1);
  } catch {
    return new Response("unavailable", { status: 503 });
  }

  if (!row) return new Response("not found", { status: 404 });

  const etag = `"${row.updatedAt.getTime().toString(36)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": CACHE },
    });
  }

  const bytes = Buffer.from(row.dataBase64, "base64");
  const download = new URL(request.url).searchParams.get("indir") === "1";

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": CACHE,
      ETag: etag,
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${symbol.toLowerCase()}-${period}-karne.png"`,
          }
        : {}),
    },
  });
}
