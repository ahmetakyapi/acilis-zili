import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { stories } from "./schema";
import { getBriefByDate, getEventsBetweenResult } from "./data";
import { ledgerKeys } from "./telegram";
import { loadSharedDayFlow } from "./day-flow-data";
import { eventFamily, type DayFlowSnapshot } from "./day-flow";
import { briefHref, briefSummary } from "./brief";
import { closeToClose } from "./brief-indices";
import { getChartBarsMulti } from "./providers";
import type { Bar } from "./providers/types";
import { etDateTimeToUtc, type MarketStatus } from "./market-hours";
import { absoluteUrl } from "./site";
import { getDictionary } from "./i18n";
import type { Locale } from "./i18n/config";
import { INDEX_LABELS } from "./weekly-digest";
import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";
import {
  CAPTION_LIMIT,
  MOVERS_PER_SIDE,
  firstParagraph,
  formatClose,
  formatMacro,
  formatPreOpen,
  formatStory,
  postSummary,
  type CalendarRow,
  type IndexClose,
  type Mover,
} from "./telegram-format";
import { FRESH_HOURS, MAJOR_MACRO, isFresh, postKey, type PostKind } from "./telegram-plan";

/**
 * TELEGRAM MESAJLARININ VERİSİ — sitenin VAR OLAN okumalarından (24 Ekim).
 *
 * Yeni bir veri yolu açılmadı; her mesaj, aynı bilgiyi sitede gösteren
 * okumanın kendisinden besleniyor ki kanal ile site aynı sayıyı söylesin
 * (CLAUDE.md "aynı sayı iki yerde duruyorsa aynı kaynaktan"):
 *   - takvim, bilanço pencereleri, makro gerçekleşen: Gün Akışı
 *     (`loadSharedDayFlow` — ana sayfanın şeridi, 30 sn'lik paylaşımlı not)
 *   - bülten: `getBriefByDate` + `briefSummary` (RSS ile aynı özet cümlesi)
 *   - kapanış: günlük barlar + `closeToClose` (bülten bağlamının ve pazar
 *     özetinin kapanıştan kapanışa tanımı)
 *   - Mercek: `stories` satırı
 *
 * YAZMA KATMANI (CLAUDE.md "Veri dürüstlüğü" 4). Kanala giden sayı geri
 * alınamaz; bayat veri hiç kullanılmaz. Barlar `allowCache: false` ile
 * okunur (güncel olmayan yanıt düşer, Neon önbelleğine inilmez) ve her
 * sembolün son barı ANLATILAN SEANSIN günü olmak zorunda — değilse o sembol
 * yok sayılır; endekslerin yarısı yoksa mesaj o koşuda gitmez.
 *
 * Her işlev ya gönderilecek mesajları ya da neden göndermediğini döner;
 * tekrar gönderimi defter önler (lib/telegram.ts).
 */

export type Outgoing = {
  kind: PostKind;
  key: string;
  html: string;
  summary: string;
  /** Bağlantı önizlemesinin adresi (bülten, Mercek). */
  preview?: string;
  /**
   * Görselli gönderim — altyazı `captionHtml`. TEMBEL: görsel adresi
   * sayfanın kendisinden çekiliyor (Mercek → `ogImageOf`); bu iş ancak mesaj
   * SAHİPLENİLDİKTEN sonra yapılır (route.ts → deliver), yoksa gitmiş
   * yazının sayfası her beş dakikada yeniden indirilirdi.
   */
  photo?: () => Promise<{ url: string; captionHtml: string } | null>;
};

export type Plan = { posts: Outgoing[]; skipped?: string };

const labelsOf = (locale: Locale) => getDictionary(locale).telegram;

/** Gün Akışı — okunamazsa null (çağıran boşluk iddia etmez). */
async function dayFlow(locale: Locale): Promise<DayFlowSnapshot | null> {
  try {
    return await loadSharedDayFlow(locale);
  } catch (error) {
    console.error(`[telegram] gün akışı okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/* ---- Açılış öncesi ---- */

export async function preOpenPost(locale: Locale, status: MarketStatus, final: boolean): Promise<Plan> {
  const t = labelsOf(locale);
  const date = status.etDate;
  const [briefRow, flow] = await Promise.all([getBriefByDate(date, locale), dayFlow(locale)]);
  /* Bülten YALNIZ kanalın dilindeyse: İngilizce kanala Türkçe özet düşmez.
     Bugünün bülteni yoksa son ana kadar beklenir (`final`). */
  const brief = briefRow && briefRow.locale === locale && briefRow.briefDate === date ? briefRow : null;
  if (!brief && !final) return { posts: [], skipped: "brief-wait" };
  if (!brief && !flow) return { posts: [], skipped: "no-data" };

  let calendar: CalendarRow[] | null = null;
  let calendarEmpty = false;
  if (flow && flow.dateEt === date) {
    calendar = flow.events
      .filter((event) => event.kind === "earnings" || event.importance !== "low")
      .map((event): CalendarRow =>
        event.kind === "earnings"
          ? {
              kind: "earnings",
              at: event.approx && event.scheduledAt ? new Date(event.scheduledAt) : null,
              /* Pencere adı akışın künyesinden ("Bilanço · Kapanış Sonrası"). */
              window: event.detail ?? t.earnings,
              symbols: (event.members ?? []).map((member) => member.symbol),
            }
          : { kind: "event", at: event.scheduledAt ? new Date(event.scheduledAt) : null, title: event.title },
      );
    /* "Takvim boş" ancak akış gerçekten boşsa: eşiğin altındaki bilançolar
       (`hiddenEarnings`) varken boş demek yanlış olurdu. */
    calendarEmpty = flow.events.length === 0 && flow.hiddenEarnings === 0;
  }

  const html = formatPreOpen(
    {
      locale,
      date,
      openAt: status.nextOpen,
      brief: brief
        ? { headline: brief.headline, summary: briefSummary(brief.bodyMd), url: absoluteUrl(briefHref(date, "daily"), locale) }
        : null,
      calendar,
      calendarEmpty,
      calendarUrl: absoluteUrl("/takvim", locale),
    },
    t,
  );
  return {
    posts: [
      {
        kind: "acilis",
        key: postKey("acilis", date, locale),
        html,
        summary: postSummary(html),
        preview: brief ? absoluteUrl(briefHref(date, "daily"), locale) : undefined,
      },
    ],
  };
}

/* ---- Kapanış ---- */

/** Hareket edenlerin evreni — ana sayfanın "Günün Hareketleri" ile aynı süzgeç. */
const MOVER_UNIVERSE = primaryOnly(ALL_MEMBERS).map((member) => member.symbol);
/**
 * Sıralama ancak evrenin bu payı okunabildiyse basılır: yarım evrenden
 * çıkan "en çok yükselenler" bir iddia ve eksik veriyle yanlış olur.
 */
const MOVERS_MIN_SHARE = 0.8;
/** Endekslerden en az bu kadarı seansın kapanışını taşımalı. */
const INDEX_MIN = 2;

/** Bar dizisinden SEANSIN kapanışı ve yüzdesi; son bar o seansa ait değilse null. */
function sessionMove(bars: readonly Bar[] | undefined, session: string) {
  if (!bars?.length) return null;
  const move = closeToClose(bars, session, session);
  if (move.price_date !== session || move.price === null || move.change_pct === null) return null;
  return { close: move.price, changePct: move.change_pct };
}

/**
 * GÜN BARI = SEANSIN KAPANIŞI, AKŞAM SEANSI DEĞİL (ölçüldü, 23 Ekim):
 * Alpaca SIP 1Day barı SPY için 759,97 kapattı, aynı günün 23:59 UTC
 * dakikası 761,11 idi (QQQ 704,40 / 704,88). Yani akşam seansında sorulan
 * gün barı ana seansın kapanışını veriyor; kotasyon (`getQuotes`) ise o
 * saatte akşam işlemini taşıyor — mesaj bu yüzden barlardan.
 */
export async function closePost(locale: Locale, status: MarketStatus): Promise<Plan> {
  const t = labelsOf(locale);
  const session = status.sessionDate;
  const key = postKey("kapanis", session, locale);
  /* Kapanış penceresi akşam seansının sonuna kadar açık; mesaj gittikten
     sonra her koşu ~520 sembolün barını önbelleksiz isterdi. Defterde
     varsa hiç hazırlanmaz. */
  if ((await ledgerKeys([key])).has(key)) return { posts: [], skipped: "already" };
  const indexSymbols = Object.keys(INDEX_LABELS);
  const [indexBars, universeBars, flow] = await Promise.all([
    getChartBarsMulti(indexSymbols, "1M", status, { allowCache: false }).catch((): Record<string, Bar[]> => ({})),
    getChartBarsMulti(MOVER_UNIVERSE, "1M", status, { allowCache: false }).catch((): Record<string, Bar[]> => ({})),
    dayFlow(locale),
  ]);

  const indices: IndexClose[] = indexSymbols.flatMap((symbol) => {
    const move = sessionMove(indexBars[symbol], session);
    return move ? [{ label: INDEX_LABELS[symbol] ?? symbol, symbol, ...move }] : [];
  });
  if (indices.length < INDEX_MIN) return { posts: [], skipped: "bars-not-ready" };

  const moves: Mover[] = MOVER_UNIVERSE.flatMap((symbol) => {
    const move = sessionMove(universeBars[symbol], session);
    return move ? [{ symbol, changePct: move.changePct }] : [];
  });
  const ranked = [...moves].sort((a, b) => b.changePct - a.changePct);
  const movers =
    moves.length >= MOVER_UNIVERSE.length * MOVERS_MIN_SHARE
      ? {
          up: ranked.filter((row) => row.changePct > 0).slice(0, MOVERS_PER_SIDE),
          down: ranked.filter((row) => row.changePct < 0).slice(-MOVERS_PER_SIDE).reverse(),
          universe: moves.length,
        }
      : null;

  /* Kapanış sonrası bilançolar: akışın "amc" penceresi (eşik üstü şirketler,
     piyasa değerine göre sıralı). Akış başka güne aitse basılmaz. */
  const afterClose =
    flow && flow.dateEt === session
      ? (flow.events.find((event) => event.id === "earnings-amc")?.members ?? []).map((member) => member.symbol)
      : [];

  const closeAt = etDateTimeToUtc(
    session,
    `${String(Math.floor(status.closeMinutes / 60)).padStart(2, "0")}:${String(status.closeMinutes % 60).padStart(2, "0")}`,
  );
  const html = formatClose(
    {
      locale,
      date: session,
      closeAt,
      indices,
      movers,
      afterClose,
      marketsUrl: absoluteUrl("/piyasalar", locale),
      earningsUrl: absoluteUrl("/bilancolar", locale),
    },
    t,
  );
  return { posts: [{ kind: "kapanis", key, html, summary: postSummary(html) }] };
}

/* ---- Mercek ---- */

/** Bir koşuda en çok bu kadar yazı — kanal birden dolmasın. */
const STORIES_PER_RUN = 2;
/**
 * Defterle süzülecek aday tavanı. Eskiden en eski 4 satır okunup ilk 2'si
 * seçiliyordu ve seçim defterden ÖNCE yapılıyordu: gitmiş iki eski yazı her
 * koşuda yeniden seçilip "duplicate" geçiyor, üçüncü yazı pencere dolana
 * (~6 saat) kadar bekliyordu. Şimdi pencerenin bütün adayları okunur,
 * defterdekiler atılır, SONRA ilk 2 alınır. Altı saatte bu tavanı aşan
 * yazı çıkmıyor (rutin günde birkaç yazı yazar); tavan yalnız güvence.
 */
const STORY_CANDIDATES = 40;

/** Sayfanın kendi paylaşım görseli: adres derlemede karılmış ek taşıyor
 *  (`opengraph-image-<ek>`), koddan kurulamıyor; sayfanın künyesinden okunur. */
async function ogImageOf(pageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(pageUrl, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!response.ok) return null;
    const html = await response.text();
    const match = /<meta property="og:image" content="([^"]+)"/.exec(html);
    return match ? match[1].replace(/&amp;/g, "&") : null;
  } catch {
    return null;
  }
}

export async function storyPosts(locale: Locale, now: Date): Promise<Plan> {
  const t = labelsOf(locale);
  let rows: { slug: string; title: string; dek: string; bodyMd: string; publishedAt: Date }[];
  try {
    rows = await db
      .select({ slug: stories.slug, title: stories.title, dek: stories.dek, bodyMd: stories.bodyMd, publishedAt: stories.publishedAt })
      .from(stories)
      /* Kanalın dilindeki satır: çevirisi gelmeyen yazı İngilizce kanala
         Türkçe gitmez; çeviri gelince (kendi `publishedAt`iyle) gider. */
      .where(and(eq(stories.locale, locale), gte(stories.publishedAt, new Date(now.getTime() - FRESH_HOURS * 3_600_000))))
      .orderBy(asc(stories.publishedAt))
      .limit(STORY_CANDIDATES);
  } catch (error) {
    console.error(`[telegram] mercek okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return { posts: [], skipped: "db" };
  }
  const fresh = rows.filter((story) => isFresh(story.publishedAt, now));
  const done = await ledgerKeys(fresh.map((story) => postKey("mercek", story.slug, locale)));
  const posts: Outgoing[] = [];
  for (const row of fresh.filter((story) => !done.has(postKey("mercek", story.slug, locale))).slice(0, STORIES_PER_RUN)) {
    const url = absoluteUrl(`/mercek/${row.slug}`, locale);
    const input = { title: row.title, lead: firstParagraph(row.bodyMd) || row.dek, url };
    const html = formatStory(input, t);
    posts.push({
      kind: "mercek",
      key: postKey("mercek", row.slug, locale),
      html,
      summary: postSummary(html),
      preview: url,
      photo: async () => {
        const photo = await ogImageOf(url);
        return photo ? { url: photo, captionHtml: formatStory(input, t, CAPTION_LIMIT) } : null;
      },
    });
  }
  return { posts };
}

/* ---- Makro veri ---- */

export async function macroPosts(locale: Locale, status: MarketStatus, now: Date): Promise<Plan> {
  const t = labelsOf(locale);
  const date = status.etDate;
  const rows = await getEventsBetweenResult(date, date);
  if (!rows.ok) return { posts: [], skipped: "db" };
  const majors = new Map(rows.rows.filter((row) => MAJOR_MACRO.has(eventFamily(row.slug))).map((row) => [row.id, row]));
  if (majors.size === 0) return { posts: [] };
  /* Gerçekleşen değer Gün Akışı'ndan: tabloya henüz yazılmadıysa akış onu
     FRED'in o günkü sürümünden okuyor (yazmadan) ve sitedeki biçimle
     veriyor — kanal ile şerit aynı sayıyı söyler. */
  const flow = await dayFlow(locale);
  if (!flow || flow.dateEt !== date) return { posts: [], skipped: "flow" };
  const posts: Outgoing[] = [];
  for (const event of flow.events) {
    const row = majors.get(event.id);
    if (!row || event.status !== "released" || !event.actual) continue;
    const at = event.scheduledAt ? new Date(event.scheduledAt) : null;
    if (!isFresh(at, now)) continue;
    const html = formatMacro(
      {
        locale,
        title: event.title,
        at,
        actual: event.actual,
        forecast: event.forecast,
        previous: event.previous,
        url: absoluteUrl("/takvim", locale),
      },
      t,
    );
    posts.push({ kind: "makro", key: postKey("makro", row.slug, locale), html, summary: postSummary(html) });
  }
  return { posts };
}
