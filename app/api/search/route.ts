import { NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories, symbols } from "@/lib/schema";
import { searchSymbols } from "@/lib/providers/finnhub";
import { aliasSymbols } from "@/db/seed/aliases";
import { guideArticles } from "@/content/guide";
import { getLocale } from "@/lib/i18n";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export type SearchHit = {
  symbol: string;
  name: string;
  industry?: string | null;
};

/**
 * Yazı sonucu — rehber ya da mercek.
 *
 * Arama yalnızca sembol buluyordu. Otuz bir rehber yazısı ve bütün mercek
 * arşivi paletten ERİŞİLEMEZDİ: "hedge" yazan biri, iki gün önce yayımlanan
 * yazıyı bulamıyor, elle /rehber'e gidip listeyi taramak zorunda kalıyordu.
 * Sembol arayan da yazı arayan da aynı kutuyu açıyor; ayıran şey ne yazdığı.
 */
export type WritingHit = {
  kind: "rehber" | "mercek";
  slug: string;
  title: string;
  dek: string;
};

export type SearchResponse = {
  hits: SearchHit[];
  writings: WritingHit[];
  error?: string;
};

/** Yazı sonuçları listeyi boğmasın — sembol hâlâ paletin ana işi. */
const MAX_WRITINGS = 4;

/**
 * Türkçe duyarsız karşılaştırma.
 *
 * `toLowerCase()` Türkçede "İ" harfini "i̇" (i + birleşen nokta) yapıyor ve
 * "İSTİHDAM" araması "istihdam" başlığını bulamıyordu. Locale'li küçültme
 * doğru sonucu veriyor; ayrıca aksanlı harfler normalize ediliyor ki
 * "enflasyon" araması "Enflasyon"u da "ENFLASYON"u da bulsun.
 */
function fold(value: string): string {
  return (
    value
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      /* NOKTASIZ "ı" NOKTALIYA KATLANIR — bu satır olmadan arama İngilizce
         başlıkları kaçırıyordu. Türkçe küçültme "I" harfini "ı" yapıyor:
         "Index" → "ındex" olurken kullanıcının yazdığı "index" olduğu gibi
         kalıyor ve eşleşme kırılıyordu. Aynı şey "IWM", "IBM", "INTC" gibi
         sembollerde de oluyordu. İkisini de "i"ye indirince hem "İSTİHDAM"
         hem "index" doğru buluyor. */
      .replace(/ı/g, "i")
  );
}

/**
 * Sembol arama.
 * Önce yerel tablo (anında, sağlayıcı kotası harcamaz), sonuç azsa Finnhub
 * ile genişletilir.
 */
/* Sitedeki tek yetkisiz uç ve hem veritabanına hem Finnhub'a gidiyor —
   yani kotayı harcayan yüzey burası. Dakikada 40 istek, tuşa basarak arayan
   bir insanın çok üstünde; kazara kurulmuş bir döngünün çok altında. */
const SEARCH_LIMIT = 40;
const SEARCH_WINDOW_MS = 60_000;

/** Sağlayıcıya giden en uzun sorgu — daha uzunu anlamlı sonuç üretmiyor. */
const MAX_QUERY_LENGTH = 64;

export async function GET(request: Request) {
  const limited = rateLimit(
    clientKey(request, "search"),
    SEARCH_LIMIT,
    SEARCH_WINDOW_MS,
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { hits: [], writings: [], error: "rate-limited" } satisfies SearchResponse,
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const query = (new URL(request.url).searchParams.get("q")?.trim() ?? "").slice(
    0,
    MAX_QUERY_LENGTH,
  );

  if (query.length < 1) {
    return NextResponse.json({ hits: [], writings: [] } satisfies SearchResponse);
  }

  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  /* Marka adı ↔ resmî ad köprüsü.

     Arama yalnızca sembolde ve `symbols.name` alanında metin eşleşmesi
     yapıyordu; o ad ise sağlayıcıdan gelen TİCARİ SİCİL ADI. "spacex"
     araması hiçbir şey bulmuyordu çünkü tablodaki ad "Space Exploration
     Technologies Corp" ve içinde o dizi hiç geçmiyor. Aynı boşluk
     Google→Alphabet, Facebook→Meta için de vardı. Eşleme
     db/seed/aliases.ts içinde ve elle bakılıyor. */
  const aliased = aliasSymbols(query);

  /* JOKER KARAKTERLER KAÇIRILIYOR. Sorgu `%${query}%` desenine ham
     gömülüyordu; `%`, `_` ve `\` kaçırılmıyordu. Drizzle parametreleştirdiği
     için SQL enjeksiyonu yok ama iki somut sonuç vardı: `q=%` bütün katalogla
     eşleşip alakasız sonuç döndürüyor, ve `%_%_%_...` gibi bir desen
     Postgres'in LIKE eşleyicisinde geri izlemeyi tetikleyip her istekte
     boşuna işlemci yakıyordu — uç yetkisiz ve dakikada kırk istek serbest. */
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);

  try {
    const pattern = `%${escaped}%`;
    const matches = [
      ilike(symbols.symbol, pattern),
      ilike(symbols.name, pattern),
      ...(aliased.length > 0 ? [inArray(symbols.symbol, aliased)] : []),
    ];

    const local = await db
      .select({
        symbol: symbols.symbol,
        name: symbols.name,
        industry: symbols.industry,
      })
      .from(symbols)
      .where(or(...matches))
      /* Sıra: takma ad eşleşmesi → sembol ön eki → gerisi. Takma ad en
         kesin sinyal ("spacex" yazan SPCX istiyor, tahmin yok); sembolle
         başlayanlar ondan sonra gelir. */
      .orderBy(
        sql`case
              when ${aliased.length > 0 ? inArray(symbols.symbol, aliased) : sql`false`} then 0
              when ${symbols.symbol} ilike ${escaped + "%"} then 1
              else 2
            end`,
      )
      .limit(8);

    for (const row of local) {
      seen.add(row.symbol);
      hits.push(row);
    }
  } catch {
    // Veritabanı yoksa arama yine de sağlayıcı üzerinden çalışsın.
  }

  if (hits.length < 6 && query.length >= 2) {
    const remote = await searchSymbols(query);
    if (remote.ok) {
      for (const item of remote.data) {
        if (seen.has(item.symbol) || hits.length >= 10) continue;
        seen.add(item.symbol);
        hits.push({ symbol: item.symbol, name: item.description });
      }
    }
  }

  /* ---- Yazılar ----
     Rehber depoda ve durağan: eşleşme bellekte yapılıyor, sorgu yok. Mercek
     veritabanında ve büyüyor: başlık ile giriş cümlesinde `ilike`. İkisi de
     sembol aramasından SONRA çalışıyor ve yanıtı geciktirmiyor — paralel
     değil çünkü rehber zaten senkron, mercek tek bir indeksli sorgu. */
  const locale = await getLocale();
  const needle = fold(query);
  const writings: WritingHit[] = [];

  if (query.length >= 2) {
    for (const article of guideArticles(locale)) {
      if (writings.length >= MAX_WRITINGS) break;
      if (fold(article.title).includes(needle) || fold(article.dek).includes(needle)) {
        writings.push({
          kind: "rehber",
          slug: article.slug,
          title: article.title,
          dek: article.dek,
        });
      }
    }

    if (writings.length < MAX_WRITINGS) {
      try {
        const pattern = `%${escaped}%`;
        const rows = await db
          .select({ slug: stories.slug, title: stories.title, dek: stories.dek })
          .from(stories)
          .where(
            and(
              eq(stories.locale, locale),
              or(ilike(stories.title, pattern), ilike(stories.dek, pattern)),
            ),
          )
          .orderBy(desc(stories.eventDate))
          .limit(MAX_WRITINGS - writings.length);
        for (const row of rows) {
          writings.push({
            kind: "mercek",
            slug: row.slug,
            title: row.title,
            dek: row.dek ?? "",
          });
        }
      } catch {
        // Veritabanı yoksa arama sembol tarafıyla çalışmaya devam eder.
      }
    }
  }

  return NextResponse.json({ hits, writings } satisfies SearchResponse);
}
