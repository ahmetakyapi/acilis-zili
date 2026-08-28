"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { watchlistItems, watchlists } from "@/lib/schema";
import { isValidSymbol } from "@/lib/utils";

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
   liste, listede birkaç düzine sembol. Sınıra dayanan kullanıcı sessizce
   dönmüyor; arayüz zaten sunucu eyleminden sonra sayfayı tazeliyor ve
   eklenmeyen öğe görünmediği için durum kendini belli ediyor.
   -------------------------------------------------------------------------- */
const MAX_LISTS = 20;
const MAX_ITEMS_PER_LIST = 200;

export async function createWatchlist(formData: FormData) {
  const userId = await requireUserIdOrRedirect();

  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  const color = String(formData.get("color") ?? "primary");
  if (!name) return;

  /* Sayım ve sıra tek sorguda: ikisi de aynı satır kümesinden çıkıyor,
     ayrı istek atmak Neon'da ikinci bir HTTP gidiş-dönüşü demek. */
  const [{ maxOrder, total }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${watchlists.sortOrder}), -1)`,
      total: sql<number>`count(*)::int`,
    })
    .from(watchlists)
    .where(eq(watchlists.userId, userId));

  if (total >= MAX_LISTS) return;

  await db.insert(watchlists).values({
    userId,
    name,
    color: (LIST_COLORS as readonly string[]).includes(color) ? color : "primary",
    sortOrder: maxOrder + 1,
  });

  revalidatePath("/favoriler");
}

export async function renameWatchlist(formData: FormData) {
  const userId = await requireUserIdOrRedirect();

  const listId = String(formData.get("listId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 40);
  if (!listId || !name) return;

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
}

export async function deleteWatchlist(formData: FormData) {
  const userId = await requireUserIdOrRedirect();

  const listId = String(formData.get("listId") ?? "");
  if (!listId) return;

  // ON DELETE CASCADE list öğelerini de siler.
  await db
    .delete(watchlists)
    .where(and(eq(watchlists.id, listId), eq(watchlists.userId, userId)));

  revalidatePath("/favoriler");
}

export async function addSymbolToList(formData: FormData) {
  const userId = await requireUserIdOrRedirect();

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

  if (total >= MAX_ITEMS_PER_LIST) return;

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

  revalidatePath("/favoriler");
  revalidatePath(`/hisse/${symbol}`);

  return { ok: inserted.length > 0, duplicate: inserted.length === 0 };
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

export async function removeSymbolFromList(formData: FormData) {
  const userId = await requireUserIdOrRedirect();

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

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
}

/** Hisse sayfasındaki yıldız — ilk listeye ekler / tüm listelerden çıkarır. */
export async function toggleSymbolFavorite(formData: FormData) {
  /* Sembol oturumdan ÖNCE okunuyor: oturumu düşen kullanıcı girişten sonra
     /favoriler'e değil kalp'e bastığı hisse sayfasına dönsün. */
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  if (!isValidSymbol(symbol)) return;

  const userId = await requireUserIdOrRedirect(`/hisse/${symbol}`);

  const existing = await db
    .select({ itemId: watchlistItems.id })
    .from(watchlistItems)
    .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
    .where(and(eq(watchlists.userId, userId), eq(watchlistItems.symbol, symbol)));

  if (existing.length > 0) {
    /* TEK İSTEK. Silme bir dönem döngüdeydi ve her öğe için ayrı bir
       neon-http gidiş dönüşü açıyordu; aynı sembol birden çok listede
       olabildiği için sayı birden büyük olabiliyor. `inArray` hepsini tek
       ifadede siliyor — dosyanın kendi `inArray` içe aktarımı zaten var. */
    await db.delete(watchlistItems).where(
      inArray(
        watchlistItems.id,
        existing.map((row) => row.itemId),
      ),
    );
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
        .values({ userId, name: "Takip listem", sortOrder: 0 })
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
    if (total >= MAX_ITEMS_PER_LIST) return;

    await db
      .insert(watchlistItems)
      .values({ watchlistId: list.id, symbol })
      .onConflictDoNothing();
  }

  revalidatePath(`/hisse/${symbol}`);
  revalidatePath("/favoriler");
}
