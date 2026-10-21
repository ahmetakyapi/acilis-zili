"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { watchlistItems, watchlists } from "@/lib/schema";
import { isValidSymbol } from "@/lib/utils";
import { getLocale } from "@/lib/i18n";

/**
 * Takip listesi işlemleri.
 * Her eylem oturumu kendisi doğrular — proxy yalnızca ön elemedir.
 */

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Oturumu olmayan kullanıcıyı GİRİŞE gönderir.
 *
 * Yedi eylemin hepsi `if (!userId) return;` ile başlıyordu ve hiçbiri durum
 * döndürmüyordu: başka bir sekmede çıkış yapmış ya da oturumu süresi dolmuş
 * biri /favoriler'de kalırsa liste açma, sembol ekleme, silme ve sıralama
 * düğmelerinin hepsi tıklamayı yutuyordu. Hata yok, yönlendirme yok, tazeleme
 * sonrası ekran aynı — kullanıcı düğmenin bozuk olduğunu sanıyordu.
 *
 * `redirect` bir server action içinden çalışıyor ve `devam` parametresiyle
 * kullanıcı giriş sonrası aynı ekrana dönüyor (bkz. safeRedirectTarget).
 *
 * SÜRÜKLE-BIRAK SIRALAMASI HARİÇ: o eylem bir gezinme değil, sürükleme
 * bittiğinde arka planda çalışan bir yazma. Ortasında yönlendirme atmak
 * kullanıcının elindeki listeyi kaybettirirdi; orada sessiz dönüş doğru.
 */
async function requireUserIdOrRedirect(back = "/favoriler"): Promise<string> {
  const userId = await requireUserId();
  if (!userId) redirect(`/giris?devam=${encodeURIComponent(back)}`);
  return userId;
}

const LIST_COLORS = ["primary", "brass", "up", "down", "flat"] as const;

/**
 * Bir listede en fazla kaç öğe sıralanabilir.
 *
 * Sıra bilgisi İSTEMCİDEN geliyor ve istemciden gelen her şey gibi güvenilmez.
 * Sınır yokken `orderedIds` içinde aynı geçerli kimliği yüz bin kez göndermek
 * yüz bin ayrı UPDATE'i `Promise.all` ile aynı anda Neon'a yolluyordu: tek bir
 * server action çağrısı veritabanını ve fonksiyon bütçesini bitiriyordu. Kimlik
 * doğrulanmış bir kullanıcı gerekiyor ama bu, kendi hesabıyla siteyi
 * durdurabilmesi anlamına gelmemeli.
 *
 * 200 gerçek kullanımın çok üstünde: en kalabalık liste bir avuç sembol.
 */
const MAX_REORDER_ITEMS = 200;

/* --------------------------------------------------------------------------
   Yazma tavanları

   Liste açma ve sembol ekleme yalnızca oturumu ve biçimi doğruluyordu; kaç
   liste ya da listede kaç sembol olabileceğine dair bir tavan yoktu. Giriş
   yapmış tek bir hesap döngüyle yüz binlerce satır yazıp hem Neon
   depolamasını hem `/favoriler` sayfasının çizim süresini şişirebilirdi —
   üstelik `MAX_REORDER_ITEMS` tavanının anlamı da kalmıyordu, çünkü listeye
   sınırsız öğe konabildiği sürece 200'lük sıralama tavanı yalnızca tek
   çağrıyı sınırlıyordu.

   Sayılar gerçek kullanımın çok üstünde: en kalabalık kullanım bir avuç
   liste, listede birkaç düzine sembol. Sınıra dayanan kullanıcı sessiz
   kalmıyor: eylem sonuç döndürüyor (`reason: "full"`, `full: true`; oran
   kovasında `limit`) ve pano `listsFull` / `listFull` / `actionFailed`,
   kalp `heartFull` sözlük iletisini gösteriyor. Tavan yolunda tazeleme
   yok; arayüz de 20 Ekim'den beri başarı yollarında `router.refresh()`
   çağırmıyor — sayfayı eylemin kendi `revalidatePath`i yeniden çizdiriyor.
   -------------------------------------------------------------------------- */
const MAX_LISTS = 20;
const MAX_ITEMS_PER_LIST = 200;

/* ORAN KOVASI (20 Ekim). Alarm, portföy, avatar, gönderi ve bildirim
   eylemlerinin hepsi kullanıcı başına bir kova taşıyordu; bu dosyanın sekiz
   eylemi taşımıyordu. Tavanlar satır SAYISINI sınırlıyor, çağrı sayısını
   değil: döngüyle sınırsız ad/not yazmak ya da kalbi açıp kapamak (her biri
   bir tazeleme) mümkündü. Ad, not, ekleme, silme ve kalp tek kovada —
   60/dk, art arda sembol ekleyen gerçek okuyucuya bol.

   SIRALAMANIN KOVASI AYRI (20 Ekim). Dokunmatikte sıralamanın pratik yolu
   Yukarı/Aşağı oklarıydı ve her dokunuş bir eylem çağrısıydı: 45. satırı
   başa almak 44 çağrı. Ortak kovada bir listeyi düzenleyen okuyucu
   dakikada 60'ı geçiyor, her dokunuş `{ ok: false }` alıyor ve pano sırayı
   sessizce geri sarıyordu; ekleme/silme hakkını da sıralama yiyordu. Oklar
   artık istemcide toplanıyor (WatchlistBoard → `nudge`, dokunuş dizisi son
   dokunuştan 600 ms sonra TEK çağrı) ve sıralamanın kendi kovası var.
   Kovasız bırakılmıyor: her çağrı `/favoriler`i tazeliyor.

   GENİŞ DEĞİL (20 Ekim). Bu kova bir dönem 240/dk'ydı — her dokunuş ayrı
   çağrıyken gereken pay. Toplama gelince o pay boşa kaldı ama tazeleme
   tavanını büyütüyordu: hesap başına dakikada 60 + 240 = 300 tazeleme,
   ortak kovanın beş katı. 60/dk saniyede bir kayıt demek; dokunuş dizisi
   ancak 600 ms duraklamayla kapanıyor, sürükleme de bırakmada tek çağrı,
   yani gerçek düzenleme bunun çok altında kalıyor. Tavan şimdi 60 + 60. */
function overLimit(userId: string): boolean {
  return !rateLimit(`watchlist:${userId}`, 60, 60_000).allowed;
}

function reorderOverLimit(userId: string): boolean {
  return !rateLimit(`watchlist-reorder:${userId}`, 60, 60_000).allowed;
}

/**
 * Bir sembolün takip durumu değişince yapılan tazeleme: YALNIZ `/favoriler`.
 *
 * SEMBOL SAYFALARI TAZELENMİYOR (20 Ekim). Kalp `/hisse/X`, `/teknik/x` ve
 * `/hisse-secimi/X`'i de tazeliyordu. Her `revalidatePath` o sayfanın
 * okuduğu bütün `fetch`/`unstable_cache` girdilerini bir sonraki çizimde
 * ıskalatıyor: kalbi döngüyle açıp kapamak (kovayla bile hesap başına
 * dakikada 60 kez) en işlek hisse sayfalarını her çizimde sağlayıcıya
 * yeniden gönderiyordu (Finnhub ücretsiz katmanı dakikada 60 çağrı).
 * Doğruluğa katkısı da yoktu: bu sayfalar dinamik (kök yerleşim
 * `headers()` okuyor) ve kalbin durumu her istekte veritabanından okunuyor;
 * eylemdeki HERHANGİ bir `revalidatePath` bulunulan sayfayı eylemin
 * yanıtında zaten yeniden çiziyor (Next 16.3: yol eşleşmesine bakılmıyor,
 * `revalidate.js` → "TODO: only revalidate if the path matches"; bu
 * değişirse kalbin sayfalarında `refresh()` gerekir). Sembol sayfası
 * tazelemesi kalkınca uydurma sembolün im tablosunu (`tagsManifest`)
 * büyütmesi ve onu kesen `isKnownSymbol` sorgusu da kalktı. Tazeleme
 * yalnız gerçek değişimde; mükerrerde ve tavanda yok. Alarmlarda aynı
 * karar: `app/actions/alerts.ts` → `revalidate`.
 */
function revalidateFavorites() {
  revalidatePath("/favoriler");
}

export async function createWatchlist(formData: FormData) {
  const userId = await requireUserIdOrRedirect();
  if (overLimit(userId)) return { ok: false as const, reason: "limit" as const };

  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const color = String(formData.get("color") ?? "primary");
  /* SONUÇ DÖNÜYOR (9 Ekim). Boş ad ve 20 liste tavanı çıplak `return`
     ediyordu; form kapanıp başarılı gibi görünüyor, liste hiç gelmiyordu. */
  if (!name) return { ok: false as const, reason: "empty" as const };

  /* Sayım ve sıra tek sorguda: ikisi de aynı satır kümesinden çıkıyor,
     ayrı istek atmak Neon'da ikinci bir HTTP gidiş-dönüşü demek. */
  const [{ maxOrder, total }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${watchlists.sortOrder}), -1)`,
      total: sql<number>`count(*)::int`,
    })
    .from(watchlists)
    .where(eq(watchlists.userId, userId));

  if (total >= MAX_LISTS) return { ok: false as const, reason: "full" as const };

  await db.insert(watchlists).values({
    userId,
    name,
    color: (LIST_COLORS as readonly string[]).includes(color) ? color : "primary",
    sortOrder: maxOrder + 1,
  });

  revalidatePath("/favoriler");
  return { ok: true as const };
}

export async function renameWatchlist(formData: FormData) {
  const userId = await requireUserIdOrRedirect();
  if (overLimit(userId)) return { ok: false as const, reason: "limit" as const };

  const listId = String(formData.get("listId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!listId) return { ok: false as const, reason: "invalid" as const };
  if (!name) return { ok: false as const, reason: "empty" as const };

  /* RENK DE BURADA. Eylem yalnızca adı güncelliyordu ve rengi değiştirmenin
     tek yolu listeyi silip yeniden kurmaktı — yani sembolleri kaybetmek.
     Alan gelmezse mevcut renk korunuyor. */
  const color = String(formData.get("color") ?? "");
  const validColor = (LIST_COLORS as readonly string[]).includes(color)
    ? color
    : null;

  await db
    .update(watchlists)
    .set(validColor ? { name, color: validColor } : { name })
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)));

  revalidatePath("/favoriler");
  return { ok: true as const };
}

/* `{ ok }` DÖNÜYOR (20 Ekim): istemci artık `router.refresh()` çağırmıyor
   (eylemin tazelemesi güncel ağacı zaten getiriyor), yani tazelemesiz
   dönüşü — kova, boş kimlik — ayırt edebilmesi gerekiyor; yoksa onay
   "bekliyor" hâlinde kalırdı. */
export async function deleteWatchlist(formData: FormData): Promise<{ ok: boolean }> {
  const userId = await requireUserIdOrRedirect();
  if (overLimit(userId)) return { ok: false };

  const listId = String(formData.get("listId") ?? "");
  if (!listId) return { ok: false };

  // ON DELETE CASCADE list öğelerini de siler.
  await db
    .delete(watchlists)
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)));

  revalidatePath("/favoriler");
  return { ok: true };
}

export async function addSymbolToList(formData: FormData) {
  const userId = await requireUserIdOrRedirect();
  if (overLimit(userId)) return { ok: false, duplicate: false, full: false };

  const listId = String(formData.get("listId") ?? "");
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!listId || !isValidSymbol(symbol)) return;

  // Liste gerçekten bu kullanıcının mı?
  const [list] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)))
    .limit(1);
  if (!list) return;

  const [{ maxOrder, total }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${watchlistItems.sortOrder}), -1)`,
      total: sql<number>`count(*)::int`,
    })
    .from(watchlistItems)
    .where(eq(watchlistItems.watchlistId, listId));

  /* TAVAN DA SESSİZ DEĞİL (8 Ekim). Çıplak `return` istemcide BAŞARI
     sayılıyordu: kutu kapanıyor, sayfa tazeleniyor, sembol listede yok —
     okuyucu ne olduğunu anlayamıyordu. */
  if (total >= MAX_ITEMS_PER_LIST) return { ok: false, duplicate: false, full: true };

  /* MÜKERRER EKLEME SESSİZ DEĞİL. `onConflictDoNothing()` ile bitiyordu:
     aynı sembolü ikinci kez ekleyen kullanıcıya hiçbir şey söylenmiyor, kutu
     kapanıyor, liste aynı kalıyordu — okuyucu işlemin başarısız mı olduğunu
     yoksa zaten ekli mi olduğunu ayırt edemiyordu. Sözlükte bu durum için
     yazılmış `alreadyInList` anahtarı da hiçbir yerde çizilmiyordu. */
  const inserted = await db
    .insert(watchlistItems)
    .values({ watchlistId: listId, symbol, sortOrder: maxOrder + 1 })
    .onConflictDoNothing()
    .returning({ id: watchlistItems.id });

  /* Mükerrerde hiçbir şey değişmedi: tazeleme yok (20 Ekim). */
  if (inserted.length > 0) revalidateFavorites();

  return { ok: inserted.length > 0, duplicate: inserted.length === 0, full: false };
}

/**
 * Sürükle-bırak sonrası kalıcı sıra. Yalnızca kullanıcının kendi listesi ve
 * o listeye ait öğe kimlikleri işlenir; listede olmayan id sessizce atlanır.
 */
/**
 * Sıralamayı yazar ve BAŞARIYI BİLDİRİR.
 *
 * Eskiden `void` dönüyordu ve çağıran taraf sonucu hiç göremiyordu. Sorun
 * yalnızca sessizlik değildi: aşağıdaki erken dönüşlerin hiçbiri FIRLATMIYOR
 * (oturum düşmesi, listenin başkasına ait olması, sınır aşımı, geçersiz
 * kimlikler). Yani istemci `.catch()` yazsa bile hiçbir şey yakalayamazdı —
 * söz reddedilmiyor ki. Sürükleme ekranda kalıyor, veritabanı eski sırada
 * duruyor ve yalan sıra tam sayfa yenilemeye kadar görünüyordu.
 *
 * `{ ok }` sözleşmesi `addSymbolToList`te zaten kurulu; ikisi aynı kalıpta.
 */
export async function reorderWatchlistItems(
  listId: string,
  orderedIds: string[],
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (!userId || !listId || !Array.isArray(orderedIds)) return { ok: false };
  if (reorderOverLimit(userId)) return { ok: false };
  /* Sınırı AŞAN İSTEK KIRPILMAZ, HİÇ İŞLENMEZ. Kırpmak, gönderenin niyetini
     tahmin etmek olurdu: gerçek bir sürükle-bırak asla bu boyda olmaz, yani
     bu istek ya bozuk ya kasıtlı. İkisinde de doğru cevap dokunmamak. */
  if (orderedIds.length === 0 || orderedIds.length > MAX_REORDER_ITEMS) {
    return { ok: false };
  }

  const [list] = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)))
    .limit(1);
  if (!list) return { ok: false };

  const rows = await db
    .select({ id: watchlistItems.id })
    .from(watchlistItems)
    .where(eq(watchlistItems.watchlistId, listId));
  const valid = new Set(rows.map((row) => row.id));

  /* Tekilleştirme sıradan ÖNCE: aynı kimlik iki kez gelirse ikinci geçişi
     birincinin sırasını eziyor ve sonuç, gönderilen sıradan farklı çıkıyordu. */
  const ordered = [...new Set(orderedIds)].filter((id) => valid.has(id));
  if (ordered.length === 0) return { ok: false };

  /* TEK SORGU. Öğe başına bir UPDATE, on beş sembollük bir listede on beş
     ayrı HTTP gidiş-dönüşü demekti (Neon serverless sürücüsü her sorguyu
     ayrı istek olarak yolluyor). `CASE WHEN` ile hepsi tek turda yazılıyor. */
  const cases = sql.join(
    ordered.map((id, index) => sql`when ${watchlistItems.id} = ${id} then ${index}`),
    sql` `,
  );
  await db
    .update(watchlistItems)
    .set({ sortOrder: sql`case ${cases} else ${watchlistItems.sortOrder} end` })
    .where(
      and(
        eq(watchlistItems.watchlistId, listId),
        inArray(watchlistItems.id, ordered),
      ),
    );

  revalidatePath("/favoriler");
  return { ok: true };
}

/* `{ ok }` DÖNÜYOR (20 Ekim) — gerekçe `deleteWatchlist`: tazelemesiz dönüşte
   satır "siliniyor" tonunda kalmasın. */
export async function removeSymbolFromList(formData: FormData): Promise<{ ok: boolean }> {
  const userId = await requireUserIdOrRedirect();
  if (overLimit(userId)) return { ok: false };

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { ok: false };

  // Öğenin sahibi doğrulanarak silinir.
  await db.delete(watchlistItems).where(
    and(
      eq(watchlistItems.id, itemId),
      sql`${watchlistItems.watchlistId} in (
        select ${watchlists.id} from ${watchlists}
        where ${watchlists.userId} = ${userId}
      )`,
    ),
  );

  revalidatePath("/favoriler");
  return { ok: true };
}

/**
 * Favori notu (9 Ekim). `watchlist_items.note` sütunu baştan beri vardı,
 * hesap silme uyarısı "notların da silinir" diyordu ama notu yazmanın ya da
 * görmenin hiçbir yolu yoktu. Boş not sütunu boşaltıyor. Sahiplik silmeyle
 * aynı alt sorguyla doğrulanıyor.
 */
const MAX_NOTE_LENGTH = 200;

export async function setWatchlistNote(formData: FormData): Promise<{ ok: boolean }> {
  const userId = await requireUserIdOrRedirect();
  if (overLimit(userId)) return { ok: false };
  const itemId = String(formData.get("itemId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_NOTE_LENGTH);
  if (!itemId) return { ok: false };
  try {
    await db
      .update(watchlistItems)
      .set({ note: note || null })
      .where(
        and(
          eq(watchlistItems.id, itemId),
          sql`${watchlistItems.watchlistId} in (
            select ${watchlists.id} from ${watchlists}
            where ${watchlists.userId} = ${userId}
          )`,
        ),
      );
  } catch {
    return { ok: false };
  }
  revalidatePath("/favoriler");
  return { ok: true };
}

/** Hisse sayfasındaki yıldız — ilk listeye ekler / tüm listelerden çıkarır. */
export async function toggleSymbolFavorite(formData: FormData) {
  /* Sembol oturumdan ÖNCE okunuyor: oturumu düşen kullanıcı girişten sonra
     /favoriler'e değil kalp'e bastığı hisse sayfasına dönsün. */
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) return;

  const userId = await requireUserIdOrRedirect(`/hisse/${symbol}`);
  /* Kovada sessiz dönüş: tazeleme olmadığı için iyimser kalp kendiliğinden
     geri sarılıyor (FavoriteToggle). */
  if (overLimit(userId)) return;

  const existing = await db
    .select({ itemId: watchlistItems.id })
    .from(watchlistItems)
    .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
    .where(and(eq(watchlists.userId, userId), eq(watchlistItems.symbol, symbol)));

  /* Satır gerçekten eklendi ya da silindi mi — yalnız o zaman tazeleme
     (20 Ekim, `revalidateFavorites`). */
  let changed: boolean;
  if (existing.length > 0) {
    /* TEK İSTEK. Silme bir dönem döngüdeydi ve her öğe için ayrı bir
       neon-http gidiş dönüşü açıyordu; aynı sembol birden çok listede
       olabildiği için sayı birden büyük olabiliyor. `inArray` hepsini tek
       ifadede siliyor — dosyanın kendi `inArray` içe aktarımı zaten var. */
    const deleted = await db
      .delete(watchlistItems)
      .where(
        inArray(
          watchlistItems.id,
          existing.map((row) => row.itemId),
        ),
      )
      .returning({ id: watchlistItems.id });
    changed = deleted.length > 0;
  } else {
    let [list] = await db
      .select({ id: watchlists.id })
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(watchlists.sortOrder)
      .limit(1);

    if (!list) {
      [list] = await db
        .insert(watchlists)
        /* Ad okuyucunun dilinde — kayıt da aynısını yapıyor
           (app/actions/auth.ts). Burada sabit Türkçeydi: bütün listelerini
           silmiş EN okuyucu kalbe basınca "Takip listem" adlı bir liste
           alıyordu. */
        .values({ userId, name: (await getLocale()) === "tr" ? "Takip listem" : "My watchlist", sortOrder: 0 })
        .returning({ id: watchlists.id });
    }

    /* TAVAN BU KAPIDA DA GEÇERLİ. `MAX_ITEMS_PER_LIST` yalnızca
       `addSymbolToList` içinde uygulanıyordu; kalp düğmesi buradan geçiyor
       ve hiç sayım yapmadan INSERT ediyordu. Tavanın kendi gerekçe yorumu
       tehdidi birebir bu senaryo olarak tarif ediyor — "giriş yapmış tek bir
       hesap döngüyle yüz binlerce satır yazabilir" — yani ikinci kapının
       açık olması bilinçli bir istisna değil, korunmak istenen tehdidin ta
       kendisiydi. Aynı desen, aynı sessiz dönüş. */
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(watchlistItems)
      .where(eq(watchlistItems.watchlistId, list.id));
    /* Dolu liste kalbi sessizce geri çeviriyordu: kalp dolup boşalıyor,
       okuyucu neden olduğunu görmüyordu. Artık sonuç dönüyor (FavoriteToggle). */
    if (total >= MAX_ITEMS_PER_LIST) return { full: true as const };

    const inserted = await db
      .insert(watchlistItems)
      .values({ watchlistId: list.id, symbol })
      .onConflictDoNothing()
      .returning({ id: watchlistItems.id });
    changed = inserted.length > 0;
  }

  if (changed) revalidateFavorites();
}

/** Düz `<form action>` için (sunucu bileşeni, sonucu okuyamıyor): bilanço
 *  raporunun kapağındaki "Takibe Al" düğmesi. */
export async function toggleSymbolFavoriteForm(formData: FormData): Promise<void> {
  await toggleSymbolFavorite(formData);
}
