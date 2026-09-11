import { cache } from "react";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { getStatus } from "@/lib/data";
import { addEtDays, todayEt, type MarketStatus } from "@/lib/market-hours";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import { technicalAnalyses, type TechnicalAnalysisRow } from "@/lib/schema";
import {
  SLOT_RANK,
  TECHNICAL_SLOTS,
  TECHNICAL_SYMBOLS,
  computeSnapshot,
  currentSlot,
  distancePct,
  isTechnicalSymbol,
  rsiZone,
  technicalHref,
  type TechnicalCopy,
  type TechnicalSlot,
  type TechnicalSnapshot,
} from "@/lib/technical";
import { verdictOf, type VerdictKey } from "@/lib/analysis";

/**
 * Teknik analizin veri katmanı — fotoğraf, yazma ve okuma.
 *
 * YAZMA YOLU TEK. Şema, fotoğraf ve upsert burada; `/api/teknik` yalnızca
 * gövdeyi buraya veriyor. İçerik yazma yolundaki kuralın aynısı
 * (`lib/content-write.ts`): iki giriş olursa iki doğrulama olur ve ikisi
 * zamanla ayrı düşer.
 */

function yutuldu(kaynak: string, error: unknown): void {
  const mesaj = error instanceof Error ? error.message : String(error);
  console.error(`[teknik] ${kaynak} okunamadı: ${mesaj}`);
}

/* --------------------------------------------------------------------------
   Fotoğraf
   -------------------------------------------------------------------------- */

export type SnapshotBatch = {
  bySymbol: Record<string, TechnicalSnapshot | null>;
  /** Kotasyonun kaynağı ve tazeliği — bağlam ucu rutine söylüyor. */
  quote: { source: string; stale: boolean; fetchedAt: string | null } | null;
};

/**
 * Sembollerin teknik fotoğrafı — tek bar isteği, tek kotasyon isteği.
 *
 * "1Y" günlük barlar ~254 seans getiriyor (ölçüm `hareketliOrtalama`
 * yorumunda): 200 günlük ortalamaya ve 52 haftalık banda yetiyor. On iki
 * sembol sağlayıcının tek isteğine sığıyor (`getBarsMulti` 20'ye kadar).
 * Barı hiç gelmeyen sembol `null` — göstergesi olmayan bir analiz
 * yazılmıyor.
 */
export async function getTechnicalSnapshots(
  symbols: readonly string[],
  status: MarketStatus,
): Promise<SnapshotBatch> {
  const list = [...new Set(symbols)];
  const [bars, quotes] = await Promise.all([
    getChartBarsMulti(list, "1Y", status),
    getQuotes(list, status),
  ]);
  /* BAYAT KOTASYON FOTOĞRAFA GİRMEZ. Sağlayıcı düşünce kotasyon veritabanı
     önbelleğinden geliyor (`stale: true`) ve saatler önceki bir fiyat
     işaretsiz olarak "analiz anındaki fiyat" oluyordu. Bayatsa hiç
     kullanılmıyor: fiyat null olur, sembol atlanır (bkz. computeSnapshot). */
  const quoteMap = quotes.ok && !quotes.stale ? quotes.data : {};
  const now = new Date();
  return {
    bySymbol: Object.fromEntries(
      list.map((symbol) => {
        const series = bars[symbol];
        return [
          symbol,
          series && series.length > 0
            ? computeSnapshot(series, quoteMap[symbol] ?? null, status, now)
            : null,
        ];
      }),
    ),
    quote: quotes.ok
      ? {
          source: quotes.source,
          stale: quotes.stale ?? false,
          fetchedAt: quotes.fetchedAt ? new Date(quotes.fetchedAt).toISOString() : null,
        }
      : null,
  };
}

/* --------------------------------------------------------------------------
   Giriş şeması
   -------------------------------------------------------------------------- */

/* HAM HTML REDDEDİLİYOR. Sayfa metni düz yazı olarak basıyor; bilanço
   analizinde `<a href>` yazan kayıtlarda etiketin kendisi ekranda
   görünüyordu. Burada ayıklamak yerine gönderimi geri çeviriyoruz ki rutin
   kendi çıktısını düzeltsin. */
const HTML_ETIKETI = /<\/?[a-z][^>]*>/i;

const prose = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !HTML_ETIKETI.test(value), {
      message: "ham HTML yazma — düz metin gönder",
    });

const CopySchema = z.object({
  headline: prose(60, 280),
  summary: prose(160, 1400),
  bull: prose(40, 500),
  bear: prose(40, 500),
  volume: prose(20, 400),
  watch: z.array(prose(8, 220)).min(1).max(4),
  entry_note: prose(3, 140).nullish(),
  stop_note: prose(3, 140).nullish(),
  targets_note: prose(3, 140).nullish(),
});

type CopyInput = z.infer<typeof CopySchema>;

const level = z.number().positive();

const ItemSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .refine(isTechnicalSymbol, {
        message: `liste dışı sembol — izin verilenler: ${TECHNICAL_SYMBOLS.join(", ")}`,
      }),
    stance: z.enum(["buy", "hold", "sell"]),
    entry_low: level.nullish(),
    entry_high: level.nullish(),
    stop: level.nullish(),
    targets: z.array(level).max(3).nullish(),
    /* BOŞ OLABİLİR. Fiyat bilançonun ardından bütün seviyelerin ötesine
       boşlukla geçtiğinde bağlamda fiyatın üstünde tek bir aday kalmıyor
       (tepe yok, r2 ve high52 aşağıda); `min(1)` rutini fiyatın altındaki bir
       sayıyı "direnç" diye yazmaya zorluyordu ve taraf denetimi onu haklı
       olarak reddedince hisse hiç yazılamıyordu. Aday yoksa dizi boş. */
    supports: z.array(level).max(4),
    resistances: z.array(level).max(4),
    copy: z.object({ tr: CopySchema, en: CopySchema.nullish() }),
  })
  .superRefine((item, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    /* Diziler tek tek boş olabilir (fiyat bir yönde bütün seviyelerin
       ötesine sıçradıysa) ama ikisi birden değil: seviyesiz bir plan yok. */
    if (item.supports.length + item.resistances.length === 0) {
      issue("supports", "destek ve direnç ikisi birden boş olamaz");
    }
    const low = item.entry_low ?? null;
    const high = item.entry_high ?? null;

    /* Kurallar sayfanın verdiği sözden geliyor: AL diyen bir kart "nereden
       alınır, nerede satılır, nerede vazgeçilir" üçlüsünü taşımak zorunda;
       biri eksik kalınca görüş, seviyesi olmayan bir slogana dönüyor. */
    if ((low === null) !== (high === null)) {
      issue(low === null ? "entry_low" : "entry_high", "entry_low ve entry_high birlikte verilir; tek seviyede ikisini aynı yaz.");
    }
    if (low !== null && high !== null && low > high) {
      issue("entry_low", "entry_low, entry_high'tan büyük olamaz.");
    }
    if (item.stance === "buy") {
      if (low === null) issue("entry_low", "AL görüşünde alım bölgesi zorunlu.");
      if (item.stop == null) issue("stop", "AL görüşünde stop zorunlu.");
      if (!item.targets?.length) issue("targets", "AL görüşünde en az bir hedef zorunlu.");
    }
    if (item.stance === "sell" && (low !== null || item.stop != null)) {
      issue("stance", "SAT görüşünde alım bölgesi ve stop verilmez; beklenecek bir alım bölgesi varsa görüş TUT'tur.");
    }
    if (item.stop != null && low !== null && item.stop >= low) {
      issue("stop", "stop alım bölgesinin ALTINDA olmalı.");
    }
    if (high !== null && item.targets?.some((target) => target <= high)) {
      issue("targets", "hedefler alım bölgesinin ÜSTÜNDE olmalı.");
    }
  });

type ItemInput = z.infer<typeof ItemSchema>;

const BatchSchema = z.object({
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD (ET)"),
  slot: z.enum(TECHNICAL_SLOTS),
  items: z.array(z.unknown()).min(1).max(TECHNICAL_SYMBOLS.length),
});

/** 400 yanıtında dönen beklenen gövde — rutin hatasını buradan düzeltir. */
export const TECHNICAL_INPUT_SHAPE = {
  session_date: "YYYY-MM-DD — bağlamdaki session.date_et",
  slot: "premarket | midsession — bağlamdaki session.slot",
  items: [
    {
      symbol: `${TECHNICAL_SYMBOLS.join(" | ")}`,
      stance: "buy | hold | sell",
      entry_low: "sayı — alım bölgesinin alt ucu (AL'da zorunlu, SAT'ta yok)",
      entry_high: "sayı — üst ucu; tek seviyede entry_low ile aynı",
      stop: "sayı — alım bölgesinin altında (AL'da zorunlu, SAT'ta yok)",
      targets: "[sayı] ≤3 — alım bölgesinin üstünde, yakından uzağa",
      supports: "[sayı] 0-4 — fiyatın ALTINDA (yarım ATR pay); altında aday yoksa []",
      resistances: "[sayı] 0-4 — fiyatın ÜSTÜNDE (yarım ATR pay); üstünde aday yoksa []",
      copy: {
        tr: "{headline 60-280, summary 160-1400, bull 40-500, bear 40-500, volume 20-400, watch [1-4], entry_note?, stop_note?, targets_note?}",
        en: "aynı biçim (isteğe bağlı; yoksa sayfa Türkçesini gösterir)",
      },
    },
  ],
} as const;

/* --------------------------------------------------------------------------
   Yazma
   -------------------------------------------------------------------------- */

/** Geçmiş seansa en fazla bu kadar gün geriye düzeltme yazılabilir. */
const CORRECTION_WINDOW_DAYS = 7;

/**
 * Seviyelerin fiyata göre makul bandı.
 *
 * BİRİM HATASINI YAKALIYOR. 219,56 dolarlık bir hisse için "21956" ya da
 * "2,1956" yazılan bir seviye biçimce geçerli bir sayı ve sayfada merdivenin
 * dışına fırlardı. Yarısı ile iki katı arası, en oynak isim için bile
 * (ONDS, SPCX) günlük analizde aşılmayacak kadar geniş.
 */
const LEVEL_BAND = { low: 0.5, high: 2 } as const;

export type ItemError = { index: number; symbol: string | null; issues: unknown };

export type BatchOutcome =
  | { ok: false; status: 400; error: string; detail?: unknown }
  | {
      ok: true;
      sessionDate: string;
      slot: TechnicalSlot;
      saved: { symbol: string; url: string }[];
      errors: ItemError[];
    };

function copyOf(input: CopyInput): TechnicalCopy {
  return {
    headline: input.headline,
    summary: input.summary,
    bull: input.bull,
    bear: input.bear,
    volume: input.volume,
    watch: input.watch,
    entryNote: input.entry_note ?? null,
    stopNote: input.stop_note ?? null,
    targetsNote: input.targets_note ?? null,
  };
}

function levelsOf(item: ItemInput): number[] {
  return [
    item.entry_low,
    item.entry_high,
    item.stop,
    ...(item.targets ?? []),
    ...item.supports,
    ...item.resistances,
  ].filter((value): value is number => typeof value === "number");
}

/**
 * Bir işlem gününün analizlerini yazar — gövde rutinden olduğu gibi.
 *
 * KISMİ BAŞARI BİLİNÇLİ. On iki sembolden biri doğrulamadan geçemedi diye
 * kalan on biri çöpe atılmıyor: geçenler yazılıyor, geçemeyenler hata
 * listesiyle dönüyor ve rutin yalnızca onları düzeltip yeniden gönderiyor.
 *
 * GEÇMİŞ SEANSA YENİ ANALİZ YAZILMAZ, yalnızca DÜZELTİLİR. Fotoğraf yazma
 * anında hesaplanıyor; dünün analizine bugünün göstergeleri eklenirse metin
 * ile sayılar farklı günleri anlatırdı. Geçmiş bir kayıt düzeltilirken
 * eski fotoğrafı korunuyor.
 *
 * AYNI KURAL GÜN İÇİNDE DE: yayının penceresi geçtiyse yeni kayıt yok. Kural
 * bir dönem yalnızca bağlam ucundaydı ve yazma ucu tarihe bakıyordu; kapanış
 * sonrası `?slot=premarket` ile koşan bir rutin "Açılış Öncesi · bugün"
 * kaydını BUGÜNÜN kapanışıyla hesaplanmış pivotlarla yazabiliyordu. Taze
 * fotoğraf artık yalnızca şu anki slota ya da henüz yazılmamış DAHA ERKEN
 * bir slota çekiliyor; gerisi var olan kaydın düzeltmesi.
 */
export async function saveTechnicalBatch(body: unknown): Promise<BatchOutcome> {
  const header = BatchSchema.safeParse(body);
  if (!header.success) {
    return { ok: false, status: 400, error: "invalid-body", detail: header.error.issues };
  }
  const { session_date: sessionDate, slot } = header.data;

  const today = todayEt();
  if (sessionDate > today || sessionDate < addEtDays(today, -CORRECTION_WINDOW_DAYS)) {
    return {
      ok: false,
      status: 400,
      error: "invalid-session-date",
      detail: `session_date ${addEtDays(today, -CORRECTION_WINDOW_DAYS)} ile ${today} arasında olmalı (ET).`,
    };
  }

  const errors: ItemError[] = [];
  const valid: { index: number; item: ItemInput }[] = [];
  const seen = new Set<string>();
  header.data.items.forEach((raw, index) => {
    const parsed = ItemSchema.safeParse(raw);
    const rawSymbol =
      raw && typeof raw === "object" && "symbol" in raw && typeof raw.symbol === "string"
        ? raw.symbol.toUpperCase()
        : null;
    if (!parsed.success) {
      errors.push({ index, symbol: rawSymbol, issues: parsed.error.issues });
      return;
    }
    if (seen.has(parsed.data.symbol)) {
      errors.push({ index, symbol: parsed.data.symbol, issues: "aynı sembol gövdede iki kez var" });
      return;
    }
    seen.add(parsed.data.symbol);
    valid.push({ index, item: parsed.data });
  });

  if (valid.length === 0) {
    return { ok: true, sessionDate, slot, saved: [], errors };
  }

  /* Fotoğraf: yayının penceresi açıksa taze hesaplanır, değilse var olan
     kayıttan alınır (düzeltme). Var olan kayıt bugün için de okunuyor:
     aynı slotun düzeltmesi fotoğrafı korumalı. */
  const symbols = valid.map(({ item }) => item.symbol);
  const isToday = sessionDate === today;
  const status = await getStatus();
  const live = isToday ? currentSlot(status) : null;
  if (isToday && !status.tradingToday) {
    return {
      ok: false,
      status: 400,
      error: "not-a-trading-day",
      detail: "bugün işlem günü değil; teknik analiz yazılmaz.",
    };
  }
  const windowOpen = live !== null && SLOT_RANK[slot] <= SLOT_RANK[live];
  const fresh = windowOpen ? (await getTechnicalSnapshots(symbols, status)).bySymbol : {};
  const kept = new Map(
    (
      await db
        .select({ symbol: technicalAnalyses.symbol, snapshot: technicalAnalyses.snapshot })
        .from(technicalAnalyses)
        .where(
          and(
            inArray(technicalAnalyses.symbol, symbols),
            eq(technicalAnalyses.sessionDate, sessionDate),
            eq(technicalAnalyses.slot, slot),
          ),
        )
    ).map((row) => [row.symbol, row.snapshot]),
  );

  const rows: (typeof technicalAnalyses.$inferInsert)[] = [];
  for (const { index, item } of valid) {
    /* Taze fotoğraf: şu anki slot her zaman; daha erken slot yalnızca o
       sembolün kaydı henüz yoksa (geç kalmış bir yayın). Aksi hâlde var olan
       kaydın fotoğrafı korunuyor. */
    const shoot = windowOpen && (slot === live || !kept.has(item.symbol));
    const snapshot = shoot ? fresh[item.symbol] : kept.get(item.symbol);
    if (!snapshot || snapshot.price === null) {
      errors.push({
        index,
        symbol: item.symbol,
        issues: shoot
          ? "bu sembolün fiyat verisi alınamadı; göstergesi olmayan analiz yazılmaz"
          : isToday
            ? "bu yayının penceresi geçti; yalnızca var olan kayıt düzeltilir (fotoğrafı korunur)"
            : "geçmiş seansa yeni analiz yazılamaz, yalnızca var olan düzeltilir",
      });
      continue;
    }
    const price = snapshot.price;
    const outside = levelsOf(item).filter(
      (value) => value < price * LEVEL_BAND.low || value > price * LEVEL_BAND.high,
    );
    if (outside.length > 0) {
      errors.push({
        index,
        symbol: item.symbol,
        issues: `seviye fiyatın (${price}) yarısı ile iki katı dışında: ${outside.join(", ")} — birim hatası mı?`,
      });
      continue;
    }
    /* SEVİYE DOĞRU TARAFTA MI. Prompt "destek fiyatın ALTINDA, direnç
       ÜSTÜNDE" diyor ama şema yalnızca stop < alım < hedef sırasına
       bakıyordu; fiyatın üstündeki bir "destek" merdivende canlı fiyatın
       üstünde "Destek" diye basılıyordu. Pay yarım günlük aralık: fiyat
       yazım sırasında birkaç sent oynamış olabilir. Hedef yalnızca alım
       bölgesi YOKKEN denetleniyor: geri çekilme bekleyen bir TUT planında
       hedef anlık fiyatın altında kalabilir. */
    /* Referans, seviyelerin SEÇİLDİĞİ andaki fiyat: düzeltmede var olan
       kaydın fotoğrafı, ilk yazımda taze fotoğraf. Düzeltme de taze fiyata
       göre denetlenseydi fiyat o arada bir desteğin altına inmişse yalnızca
       metni düzelten bir gönderim reddedilirdi. */
    const reference = kept.get(item.symbol) ?? snapshot;
    const referencePrice = reference.price ?? price;
    const tolerance = 0.5 * (reference.atr14 ?? referencePrice * 0.02);
    const wrongSide = [
      ...item.supports
        .filter((value) => value > referencePrice + tolerance)
        .map((value) => `destek ${value} fiyatın üstünde`),
      ...item.resistances
        .filter((value) => value < referencePrice - tolerance)
        .map((value) => `direnç ${value} fiyatın altında`),
      ...(item.entry_low === undefined || item.entry_low === null
        ? (item.targets ?? [])
            .filter((value) => value <= referencePrice - tolerance)
            .map((value) => `hedef ${value} fiyatın altında`)
        : []),
    ];
    if (wrongSide.length > 0) {
      errors.push({
        index,
        symbol: item.symbol,
        issues: `seviye fiyatın (${referencePrice}) yanlış tarafında: ${wrongSide.join("; ")} — o tarafta aday yoksa diziyi boş gönder`,
      });
      continue;
    }

    rows.push({
      symbol: item.symbol,
      sessionDate,
      slot,
      stance: item.stance,
      entryLow: item.entry_low ?? null,
      entryHigh: item.entry_high ?? null,
      stop: item.stop ?? null,
      targets: [...(item.targets ?? [])].sort((a, b) => a - b),
      /* Destek yakından uzağa (büyükten küçüğe), direnç yakından uzağa
         (küçükten büyüğe). Rutinin sırası değil fiyatın sırası. */
      supports: [...item.supports].sort((a, b) => b - a),
      resistances: [...item.resistances].sort((a, b) => a - b),
      copy: {
        tr: copyOf(item.copy.tr),
        en: item.copy.en ? copyOf(item.copy.en) : null,
      },
      snapshot,
      generatedBy: "claude",
    });
  }

  if (rows.length > 0) {
    /* TEK UPSERT. On iki satır tek gidiş-dönüşte; `excluded` yeni satırın
       değerleri. `published_at` güncellenmiyor — ilk yayın anı korunuyor,
       düzeltme yalnızca `updated_at`i ilerletiyor. */
    await db
      .insert(technicalAnalyses)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          technicalAnalyses.symbol,
          technicalAnalyses.sessionDate,
          technicalAnalyses.slot,
        ],
        set: {
          stance: sql`excluded.stance`,
          entryLow: sql`excluded.entry_low`,
          entryHigh: sql`excluded.entry_high`,
          stop: sql`excluded.stop`,
          targets: sql`excluded.targets`,
          supports: sql`excluded.supports`,
          resistances: sql`excluded.resistances`,
          copy: sql`excluded.copy`,
          snapshot: sql`excluded.snapshot`,
          generatedBy: sql`excluded.generated_by`,
          updatedAt: new Date(),
        },
      });
  }

  return {
    ok: true,
    sessionDate,
    slot,
    saved: rows.map((row) => ({ symbol: row.symbol, url: technicalHref(row.symbol) })),
    errors,
  };
}

/* --------------------------------------------------------------------------
   Okuma
   -------------------------------------------------------------------------- */

/**
 * Liste sayfası en fazla bu kadar eski analizi gösterir.
 *
 * ESKİ GÖRÜŞ BÜYÜK PUNTOYLA DURMAZ. Rutin birkaç gün koşmazsa kartlar
 * günlerce önceki AL/TUT/SAT'ı sayfanın en görünür yerinde göstermeye devam
 * ederdi; kart altındaki küçük tarih bunu kurtarmıyor (veri dürüstlüğü
 * kuralı 2). Beş gün: cuma yayını hafta sonu + pazartesi tatiliyle salı
 * açılışına kadar taşınıyor, fazlası boş duruma düşüyor. Detay sayfası
 * arşiv — orada tarih kapakta yazılı.
 */
const BOARD_WINDOW_DAYS = 5;

/**
 * "Önceki görüş" bu kadar geriye bakar — panonun penceresinden AYRI.
 *
 * İki rol tek pencereyi paylaşıyordu: beş günlük bayatlık kuralı hem "hangi
 * analiz panoda durur" hem "önceki görüş neydi" sorusunu cevaplıyordu. Rutin
 * bir hafta durup dönünce yeni kaydın öncesi pencerenin dışında kalıyor ve
 * "Ala Döndü" rozeti sessizce kayboluyordu; detay sayfası ise aynı soruyu
 * penceresiz son 24 kayıttan cevaplıyordu. Bayatlık kuralı yerinde, önceki
 * görüş üç haftalık geriye bakışla bulunuyor.
 */
const PREVIOUS_LOOKBACK_DAYS = 21;

type EditionRef = {
  id: string;
  symbol: string;
  sessionDate: string;
  slot: string;
  stance: string;
};

/** Yayın sırası anahtarı — tarih, sonra gün içi sıra. */
function editionKey(row: { sessionDate: string; slot: string }): string {
  const rank = SLOT_RANK[row.slot as TechnicalSlot] ?? 0;
  return `${row.sessionDate}:${rank}`;
}

function newestFirst<T extends { sessionDate: string; slot: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => editionKey(b).localeCompare(editionKey(a)));
}

export type TechnicalBoardEntry = {
  row: TechnicalAnalysisRow;
  /** Bir önceki analizin görüşü — "Ala Döndü" rozeti bundan türüyor. */
  previousStance: VerdictKey | null;
};

/**
 * Liste sayfası — her sembolün son analizi ve bir öncekinin görüşü.
 *
 * İKİ SORGU. Önce hafif bir dizin (kimlik, tarih, görüş) — son iki haftanın
 * yüz küsur satırı; sonra yalnızca en son on iki satırın tamamı. Tam
 * satırlar iki dilin metnini ve fotoğrafı taşıyor; hepsini çekip on ikisini
 * seçmek boşuna yüzlerce kilobayt olurdu.
 *
 * DEĞİŞİMİ SİTE TÜRETİYOR. "Ala Döndü" rutinin iddiası değil, iki kaydın
 * karşılaştırması: rutin yanılsa bile rozet yanılmıyor.
 */
export const getTechnicalBoard = cache(async function getTechnicalBoard(): Promise<
  TechnicalBoardEntry[]
> {
  try {
    const today = todayEt();
    const since = addEtDays(today, -PREVIOUS_LOOKBACK_DAYS);
    const fresh = addEtDays(today, -BOARD_WINDOW_DAYS);
    const index: EditionRef[] = await db
      .select({
        id: technicalAnalyses.id,
        symbol: technicalAnalyses.symbol,
        sessionDate: technicalAnalyses.sessionDate,
        slot: technicalAnalyses.slot,
        stance: technicalAnalyses.stance,
      })
      .from(technicalAnalyses)
      .where(gte(technicalAnalyses.sessionDate, since));

    const bySymbol = new Map<string, EditionRef[]>();
    for (const ref of index) {
      const list = bySymbol.get(ref.symbol) ?? [];
      list.push(ref);
      bySymbol.set(ref.symbol, list);
    }
    const heads = new Map<string, { id: string; previous: VerdictKey | null }>();
    for (const [symbol, list] of bySymbol) {
      const [latest, previous] = newestFirst(list);
      /* Bayatlık kuralı yalnızca panoda duracak kayda uygulanıyor. */
      if (latest && latest.sessionDate >= fresh) {
        heads.set(symbol, {
          id: latest.id,
          previous: previous ? verdictOf(previous.stance) : null,
        });
      }
    }
    if (heads.size === 0) return [];

    const rows = await db
      .select()
      .from(technicalAnalyses)
      .where(inArray(technicalAnalyses.id, [...heads.values()].map((head) => head.id)));
    const rowOf = new Map(rows.map((row) => [row.symbol, row]));

    return TECHNICAL_SYMBOLS.flatMap((symbol) => {
      const row = rowOf.get(symbol);
      return row ? [{ row, previousStance: heads.get(symbol)?.previous ?? null }] : [];
    });
  } catch (error) {
    yutuldu("getTechnicalBoard", error);
    return [];
  }
});

export type TechnicalHistoryRow = {
  sessionDate: string;
  slot: string;
  stance: string;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
};

export type TechnicalDetail = {
  row: TechnicalAnalysisRow;
  previousStance: VerdictKey | null;
  /** Son analizler, yeniden eskiye — ilk satır `row`un kendisi. */
  history: TechnicalHistoryRow[];
};

/** Detay sayfası — son analiz ve görüş geçmişi. */
export const getTechnicalDetail = cache(async function getTechnicalDetail(
  symbol: string,
): Promise<TechnicalDetail | null> {
  try {
    const refs = await db
      .select({
        id: technicalAnalyses.id,
        sessionDate: technicalAnalyses.sessionDate,
        slot: technicalAnalyses.slot,
        stance: technicalAnalyses.stance,
        entryLow: technicalAnalyses.entryLow,
        entryHigh: technicalAnalyses.entryHigh,
        stop: technicalAnalyses.stop,
      })
      .from(technicalAnalyses)
      .where(eq(technicalAnalyses.symbol, symbol))
      .orderBy(desc(technicalAnalyses.sessionDate))
      .limit(24);
    const ordered = newestFirst(refs);
    const latest = ordered[0];
    if (!latest) return null;

    const [row] = await db
      .select()
      .from(technicalAnalyses)
      .where(eq(technicalAnalyses.id, latest.id))
      .limit(1);
    if (!row) return null;

    return {
      row,
      previousStance: ordered[1] ? verdictOf(ordered[1].stance) : null,
      history: ordered.slice(0, 12).map((ref) => ({
        sessionDate: ref.sessionDate,
        slot: ref.slot,
        stance: ref.stance,
        entryLow: ref.entryLow,
        entryHigh: ref.entryHigh,
        stop: ref.stop,
      })),
    };
  } catch (error) {
    yutuldu("getTechnicalDetail", error);
    return null;
  }
});

/**
 * Rutinin "bir önceki analizi" — sembol başına en son kayıt, şu an yazılan
 * yayın HARİÇ. Aynı yayın ikinci kez koşarsa (düzeltme) kendi eski hâlini
 * "önceki" diye görmesin.
 */
export async function getPreviousEditions(
  symbols: readonly string[],
  exclude: { sessionDate: string; slot: TechnicalSlot } | null,
): Promise<Record<string, TechnicalAnalysisRow>> {
  try {
    /* İKİ AŞAMA, pano gibi: üç haftalık pencerede tam satırları çekmek iki
       dilin metni ve fotoğrafıyla yüzlerce satır demek. Önce hafif dizin,
       sonra her sembol için seçilen tek satır. */
    const since = addEtDays(todayEt(), -PREVIOUS_LOOKBACK_DAYS);
    const index = await db
      .select({
        id: technicalAnalyses.id,
        symbol: technicalAnalyses.symbol,
        sessionDate: technicalAnalyses.sessionDate,
        slot: technicalAnalyses.slot,
      })
      .from(technicalAnalyses)
      .where(
        and(
          inArray(technicalAnalyses.symbol, [...symbols]),
          gte(technicalAnalyses.sessionDate, since),
        ),
      );
    const picked = new Map<string, string>();
    for (const ref of newestFirst(index)) {
      if (exclude && ref.sessionDate === exclude.sessionDate && ref.slot === exclude.slot) {
        continue;
      }
      if (!picked.has(ref.symbol)) picked.set(ref.symbol, ref.id);
    }
    if (picked.size === 0) return {};
    const rows = await db
      .select()
      .from(technicalAnalyses)
      .where(inArray(technicalAnalyses.id, [...picked.values()]));
    return Object.fromEntries(rows.map((row) => [row.symbol, row]));
  } catch (error) {
    yutuldu("getPreviousEditions", error);
    return {};
  }
}

/* --------------------------------------------------------------------------
   API biçimi — alan adları POST gövdesiyle aynı, okunan paket geri
   gönderilebilsin
   -------------------------------------------------------------------------- */

const round2 = (value: number | null) =>
  value === null ? null : Math.round(value * 100) / 100;

export function snapshotForApi(snapshot: TechnicalSnapshot) {
  const { price } = snapshot;
  return {
    as_of: snapshot.asOf,
    last_session: snapshot.lastSession,
    sessions: snapshot.sessions,
    price,
    prev_close: snapshot.prevClose,
    change_pct: snapshot.changePct,
    sma20: snapshot.sma20,
    sma50: snapshot.sma50,
    sma100: snapshot.sma100,
    sma200: snapshot.sma200,
    dist_sma20_pct: round2(distancePct(price, snapshot.sma20)),
    dist_sma50_pct: round2(distancePct(price, snapshot.sma50)),
    dist_sma100_pct: round2(distancePct(price, snapshot.sma100)),
    dist_sma200_pct: round2(distancePct(price, snapshot.sma200)),
    ma_cross: snapshot.cross,
    rsi14: snapshot.rsi14,
    rsi_zone: rsiZone(snapshot.rsi14),
    macd: snapshot.macd && {
      macd: snapshot.macd.macd,
      signal: snapshot.macd.signal,
      histogram: snapshot.macd.histogram,
      cross_sessions: snapshot.macd.crossSessions,
    },
    atr14: snapshot.atr14,
    atr_pct:
      snapshot.atr14 !== null && price ? round2((snapshot.atr14 / price) * 100) : null,
    avg_volume20: snapshot.avgVolume20,
    last_volume: snapshot.lastVolume,
    relative_volume:
      snapshot.lastVolume !== null && snapshot.avgVolume20
        ? round2(snapshot.lastVolume / snapshot.avgVolume20)
        : null,
    today_volume: snapshot.todayVolume,
    high52: snapshot.high52,
    low52: snapshot.low52,
    dist_high52_pct: round2(distancePct(price, snapshot.high52)),
    pivots: snapshot.pivots,
    swing_highs: snapshot.swingHighs,
    swing_lows: snapshot.swingLows,
  };
}

function copyForApi(copy: TechnicalCopy) {
  return {
    headline: copy.headline,
    summary: copy.summary,
    bull: copy.bull,
    bear: copy.bear,
    volume: copy.volume,
    watch: copy.watch,
    entry_note: copy.entryNote ?? null,
    stop_note: copy.stopNote ?? null,
    targets_note: copy.targetsNote ?? null,
  };
}

/** Kayıt → POST gövdesindeki tek öğe (+ salt okunur fotoğraf). */
export function rowForApi(row: TechnicalAnalysisRow) {
  return {
    symbol: row.symbol,
    session_date: row.sessionDate,
    slot: row.slot,
    stance: row.stance,
    entry_low: row.entryLow,
    entry_high: row.entryHigh,
    stop: row.stop,
    targets: row.targets,
    supports: row.supports,
    resistances: row.resistances,
    copy: {
      tr: copyForApi(row.copy.tr),
      en: row.copy.en ? copyForApi(row.copy.en) : null,
    },
    snapshot: snapshotForApi(row.snapshot),
    updated_at: row.updatedAt,
  };
}
