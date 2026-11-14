import { sql, type SQL } from "drizzle-orm";

/**
 * Portföy yazımlarının YARIŞA DAYANIKLI deyimleri ve saf kararları
 * (14 Kasım güvenlik denetimi). Eylemler `app/actions/portfolio.ts`te; bu
 * modül veritabanına dokunmaz: deyimleri KURAR, sonucu YORUMLAR. Kararlar
 * `tests/portfolio-write.test.ts`te sınanıyor.
 *
 * NEDEN HAM SQL. Neon'un HTTP sürücüsünde etkileşimli işlem yok
 * (`db.transaction` fırlatır); tek araç `db.batch`: deyimler tek işlemde
 * koşar ama aralarında kod çalışmaz. "Oku, karar ver, yaz" bu yüzden iki
 * sekme arasında yarışıyordu. Çözüm kararı deyimin İÇİNE almak: koşullu
 * güncelleme, onun döndürdüğü satırdan besleme ve işlemi geri sardıran bir
 * bekçi. Bunlar veri değiştiren CTE ister; Drizzle'ın kurucusu yerine
 * `sql` şablonu daha okunur. Sütun adları `lib/schema.ts`tekilerle aynı
 * olmak zorunda (`portfolio_positions`, `portfolio_sales`).
 */

/* --------------------------------------------------------------------------
   Satır tavanı

   `count(*)` okuyup sonra eklemek atomik değildi: iki istek birlikte 199
   okuyup ikisi de ekliyordu. Koşulu `insert … select … where (sayım) + n <=
   tavan` ile deyimin içine almak pencereyi daraltır ama KAPATMAZ: READ
   COMMITTED'da iki deyim de ötekinin henüz işlenmemiş satırını görmez. Bu
   yüzden batch önce hesaba özel danışma kilidini alır
   (`pg_advisory_xact_lock`, işlem bitince kendiliğinden bırakılır): aynı
   hesabın ikinci eklemesi ilki bitene dek bekler, sonraki deyimi taze
   görüntüyle sayar. Kilit yalnız portföy eklemelerini sıraya sokar;
   `users` satırına dokunmaz, başka yazımı bekletmez.
   -------------------------------------------------------------------------- */

export type PositionValues = {
  /** Yalnız geri almada: silinen satır AYNI kimlikle döner. */
  id?: string;
  symbol: string;
  quantity: string;
  costUsd: string;
  boughtAt: string;
  note: string | null;
};

/** Hesabın portföy eklemelerini işlem boyunca sıraya sokar. */
export const positionLockSql = (userId: string): SQL =>
  sql`select pg_advisory_xact_lock(hashtextextended(${`portfolio:${userId}`}, 0))`;

/** Kilit alındıktan sonraki satır sayısı — reddin NEDENİNİ söylemek için. */
export const positionCountSql = (userId: string): SQL =>
  sql`select count(*)::int as total from portfolio_positions where user_id = ${userId}::uuid`;

/**
 * Satırları YA HEP YA HİÇ ekler: hesabın satır sayısı eklenenlerle birlikte
 * `max`ı aşacaksa hiçbiri yazılmaz. Kimliği verilen satır (geri alma) başka
 * bir satırla çakışırsa sessizce atlanır.
 */
export function insertPositionsSql(userId: string, rows: readonly PositionValues[], max: number): SQL {
  const values = sql.join(
    rows.map(
      (row) =>
        sql`(${row.id ? sql`${row.id}::uuid` : sql`gen_random_uuid()`}, ${row.symbol}::text, ${row.quantity}::numeric, ${row.costUsd}::numeric, ${row.boughtAt}::date, ${row.note}::text)`,
    ),
    sql`, `,
  );
  return sql`insert into portfolio_positions (id, user_id, symbol, quantity, cost_usd, bought_at, note)
select v.id, ${userId}::uuid, v.symbol, v.quantity, v.cost_usd, v.bought_at, v.note
from (values ${values}) as v(id, symbol, quantity, cost_usd, bought_at, note)
where (select count(*) from portfolio_positions where user_id = ${userId}::uuid) + ${rows.length}::int <= ${max}::int
on conflict (id) do nothing
returning id`;
}

export type InsertOutcome = { kind: "saved"; ids: string[] } | { kind: "limit" } | { kind: "conflict" };

/**
 * Eklemenin sonucu: satır döndüyse yazıldı; dönmediyse neden sayımdan
 * okunur (ikisi aynı kilidin altında, yani aynı görüntü). Tavan dolu
 * değilken hiç satır dönmemesi kimlik çakışmasıdır.
 */
export function insertOutcome(ids: readonly string[], before: number, adding: number, max: number): InsertOutcome {
  if (ids.length > 0) return { kind: "saved", ids: [...ids] };
  return before + adding > max ? { kind: "limit" } : { kind: "conflict" };
}

/* --------------------------------------------------------------------------
   Satış

   İki sekmeden aynı parti aynı anda satılınca iki satış da kaydoluyor, adet
   eksiye iniyor ve eksi satır okumada sessizce atlanıyordu. Her adım artık
   TEK deyim: parti KOŞULLU değişir ve satış satırı O DEYİMİN döndürdüğü
   partiden yazılır — koşul tutmadıysa kayıt da yazılmaz. İkinci sekmenin
   deyimi ilkinin satır kilidinde bekler, sonra koşulu partinin SON hâline
   karşı sınar.

   - Kısmi düşüm: `quantity > adet`. Eşitlik bilerek dışarıda: parti sıfıra
     inmez, yani ileride eklenecek `CHECK (quantity > 0)` kısıtıyla da
     çalışır.
   - Tükenen parti: `quantity = adet` ise SİLİNİR. Adet okunandan farklıysa
     (araya giren geri alma eklemiş, başka sekme düşmüş) silinmez; koşulsuz
     silmek eklenen adedi de götürürdü.

   Çok partili satışta adımların bir kısmı tutup bir kısmı tutmayabilir;
   yarım satış kalmasın diye batch'in sonunda bir BEKÇİ var: yazılan parça
   sayısı plandaki adım sayısı değilse sıfıra böler, hata bütün işlemi geri
   sarar (`db.batch` Neon'da tek işlem). Ham SQL'de `raise` yok; sıfıra
   bölme (22012) parametre alabilen tek taşınabilir "vazgeç". Eylem o
   zaman partileri yeniden okur ve okura elde kalan adedi söyler.
   -------------------------------------------------------------------------- */

/** Bekçinin fırlattığı Postgres kodu: `division_by_zero`. */
const SALE_GUARD_CODE = "22012";

export type SaleStepInput = { lotId: string; take: number; exhausted: boolean };
export type SaleStep = { lotId: string; take: string; exhausted: boolean };

/**
 * Planın adımlarını deyime girecek adetlere çevirir. Tükenen partide adet
 * satırın KENDİ metnidir: `numeric(20,8)` çift duyarlıklı sayıya sığmayabilir
 * (on yedi haneden sonrası yuvarlanır) ve silme koşulu tam eşitlik ister.
 */
export function saleSteps(steps: readonly SaleStepInput[], storedQuantity: ReadonlyMap<string, string>): SaleStep[] {
  return steps.map((step) => ({
    lotId: step.lotId,
    take: step.exhausted ? (storedQuantity.get(step.lotId) ?? String(step.take)) : String(step.take),
    exhausted: step.exhausted,
  }));
}

type SaleContext = { userId: string; saleId: string; symbol: string; priceUsd: string; soldAt: string };

/** Partiyi koşullu düşer ya da siler; satış parçasını o deyimin döndürdüğü satırdan yazar. */
export function saleStepSql(context: SaleContext, step: SaleStep): SQL {
  const owned = sql`id = ${step.lotId}::uuid and user_id = ${context.userId}::uuid and symbol = ${context.symbol}::text and bought_at <= ${context.soldAt}::date`;
  const lot = step.exhausted
    ? sql`delete from portfolio_positions
  where ${owned} and quantity = ${step.take}::numeric(20,8)`
    : sql`update portfolio_positions
  set quantity = quantity - ${step.take}::numeric(20,8)
  where ${owned} and quantity > ${step.take}::numeric(20,8)`;
  return sql`with lot as (
  ${lot}
  returning user_id, symbol, cost_usd, bought_at, note
)
insert into portfolio_sales (user_id, sale_id, symbol, quantity, price_usd, sold_at, cost_usd, bought_at, note)
select user_id, ${context.saleId}::uuid, symbol, ${step.take}::numeric(20,8), ${context.priceUsd}::numeric, ${context.soldAt}::date, cost_usd, bought_at, note
from lot`;
}

/** Yazılan parça sayısı beklenen değilse sıfıra böler: işlem geri sarılır. */
export const saleGuardSql = (userId: string, saleId: string, expected: number): SQL =>
  sql`select 1 / (case when (select count(*) from portfolio_sales where sale_id = ${saleId}::uuid and user_id = ${userId}::uuid) = ${expected}::int then 1 else 0 end) as ok`;

/** Satışın bütün deyimleri, batch sırasıyla: adımlar, sonra bekçi. */
export function saleStatements(context: SaleContext, steps: readonly SaleStep[]): SQL[] {
  return [...steps.map((step) => saleStepSql(context, step)), saleGuardSql(context.userId, context.saleId, steps.length)];
}

/** Bekçi mi durdurdu (yetersiz adet) yoksa başka bir hata mı — sürücü hatayı `cause` içine sarabilir. */
export function isSaleGuardError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth += 1) {
    if ("code" in current && current.code === SALE_GUARD_CODE) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

/** `db.execute`in batch içindeki sonucundan satırlar; biçim beklenen değilse boş. */
export function rowsOf(result: unknown): Record<string, unknown>[] {
  if (typeof result === "object" && result !== null && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as Record<string, unknown>[];
  }
  return [];
}
