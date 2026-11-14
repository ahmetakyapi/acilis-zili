import { databaseSpendStore, isMissingTable, type SpendStore } from "@/lib/claude-spend-store";
import { clientKey, peekRateLimit, rateLimit, refundRateLimit } from "@/lib/rate-limit";

/**
 * CLAUDE ÇAĞRI BÜTÇESİ — hisse, karşılaştırma, haber, veri, portföy ve takip
 * notlarının ortak günlük tavanı. Her çağrı buradan hak alır
 * (lib/stock-insights.ts → callClaude). GENEL sayaç veritabanında
 * (`claude_spend`, aşağıda "KALICI SAYAÇ"), kimlik başına sayaçlar süreç
 * belleğinde; pencere UTC günü (`INSIGHT_DAILY_CAP`, varsayılan 150).
 *
 * KİM NE KADAR HARCAR (20 Ekim). Tavan yalnız MALİYETİ sınırlıyordu, ERİŞİMİ
 * değil: anonim uçlar (hisse, haber, veri ve karşılaştırma notu) oturum
 * istemiyor ve önbellekte olmayan her hedef — bilinen her sembol, her haber
 * kimliği, 2–4 sembolün her bileşimi — bir çağrı. Sıradan bir tarayıcı
 * ajanıyla dönen tek istemci 150 hakkı birkaç dakikada bitirip günün geri
 * kalanında nöbetin ısıttıkları ve üyenin portföy notu dahil bütün notları
 * kapatabiliyordu. Dört set:
 *
 * 1. İstemci başına günde `CLIENT_DAILY_CALLS`. Yalnız önbellek ISKASI
 *    sayılır: hak `unstable_cache`in geri çağrısında, Claude'a gerçekten
 *    gidilirken alınır; önbellekteki notu okuyan hiç saymaz. 30: sabah bir
 *    düzine soğuk hisse sayfası açan okur sığar, mobil CGNAT'ta aynı IP'yi
 *    paylaşan birkaç okura da pay kalır; 10 dar kalırdı.
 * 2. Anonim uçlar tavanın en çok %80'ini harcar; kalan beşte bir nöbetin
 *    ısıtmalarına ve oturum isteyen notlara (portföy, takip postası) kalır.
 * 3. Oturumlu okurun da günlük sayacı var: üye başına `MEMBER_DAILY_CALLS`
 *    (`memberClient`; 20 Ekim). Portföy notu kimliksiz çağırıyordu, yani
 *    tavanın TAMAMINI kullanabiliyordu: notun anahtarı pozisyonların parmak
 *    izi, adedi her istekte değiştiren ücretsiz bir hesap uç sınırıyla
 *    (dakikada 6) kalan hakları yarım saatte bitirip nöbetin payını da
 *    yiyordu. Üye günde 15'ten fazlasını harcayamaz: not okur + seans +
 *    parmak izi + dil başına bir kez yazılır; iki dil ve birkaç pozisyon
 *    değişikliği sığar.
 * 4. Üyelerin TOPLAMI da tavanlı: genel sayaç %90'a varınca üye yolu durur
 *    (`MEMBER_SHARE`; 20 Ekim). Üye sayacı tek hesabı sınırlıyordu,
 *    hesapları değil: kayıt açık, on ücretsiz hesap × 15 tavanın tamamı
 *    ediyordu ve üye yolu %100'e kadar harcayabildiği için nöbetin
 *    ısıtmalarına hak kalmıyordu ("kalan beşte bir" hem nöbete hem üyeye
 *    ayrılmış, ikisi arasında sınır yoktu). Beşte bir ikiye bölünür: anonim
 *    %80'de durur; üye ondan sonraki onda biri de kullanabilir (anonim akın
 *    portföy notunu kapatmasın); son onda bir YALNIZ nöbetin — varsayılan
 *    tavanda 15 hak. Isıtılan notlar önbellekte kalır, nöbetin sonraki
 *    koşuları yalnız yeni çıkanı yazar; soğuk günün ilk koşusu
 *    (05:35 UTC, deploy/cron-install.sh) sayacın gece yarısı sıfırlandığı
 *    sakin saatlere düşer.
 *
 * Varsayılan tavanda tek istemci artık en çok beşte birini (anonim) ya da
 * onda birini (üye) yiyebiliyor, tamamını değil; üyeler birlikte de son
 * onda bire dokunamıyor. Kimliksiz çağıran yalnız nöbet (ısıtmalar, takip
 * postası). Sunucunun reddettiği çağrıda İKİ sayaç da geri verilir
 * (`refundCall`).
 *
 * RET FIRLATIR, null DÖNMEZ: `callClaude` önbelleğin geri çağrısında koşuyor;
 * null dönseydi `unstable_cache` onu NOT diye saklardı (hisse notunda 36
 * saat, haber notunda 30 gün) ve bir istemcinin reddi notu herkese
 * kapatırdı. `ClaudeBudgetError` başarısızlık hafızasına da yazılmaz
 * (lib/stock-insights.ts → rememberedOnce): pay dolunca not bozuk değildir,
 * sonraki okur ya da nöbet yazabilir. Uçuştaki çağrıya katılan da reddi
 * devralmaz, kendi kimliğiyle yeniden dener (`remembered`, `getNewsBriefing`).
 */

export const CLIENT_DAILY_CALLS = 30;
export const MEMBER_DAILY_CALLS = 15;
/* SİTE SAHİBİNİN PAYI (11 Kasım). Sahibin günlük Claude işi üyeninkinin
   birkaç katı: tarama + Kişisel Plan, günlük ve aylık danışman, Bilanço
   Masası ve danışmanla soru-cevap sohbeti ("beraber soru cevap
   ilerleyelim"). Üye payı (15) sohbeti birkaç soruda bitiriyordu. Sahip
   kimliği (`ownerClient`) üye önekini taşır, yani genel tavanın üye payında
   (%90) durur; yalnız kendi günlük sayacı geniş. Yalnız `getAdmin` ile
   doğrulanmış oturumda kullanılır (lib/portfolio-question.ts,
   lib/portfolio-advisor.ts). */
export const OWNER_DAILY_CALLS = 60;
/* Genel sayacın, her kimlik türünün durduğu payı: anonim %80, üye %90,
   nöbet tavanın tamamı (yukarıda 2 ve 4). Kimlik başına sayaçtan ayrı:
   bunlar TOPLAMI sınırlar. */
const PUBLIC_SHARE = 0.8;
const MEMBER_SHARE = 0.9;
const DAY_MS = 24 * 3600_000;

const dailyCap = () => {
  const raw = Number(process.env.INSIGHT_DAILY_CAP);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 150;
};

export class ClaudeBudgetError extends Error {
  constructor() {
    super("budget");
  }
}

/** Anonim uçtaki isteğin bütçe kimliği — dört uç TEK payı paylaşır. */
export const anonymousClient = (request: Request) => clientKey(request, "claude");

/* Üye kimliğinin öneki — anonim anahtar `claude:` ile başlar, karışmaz.
   İki kurucu da bu dosyada; payı anahtarın türü belirler (`takeCall`). */
const MEMBER = "claude-member:";

/** Oturumlu okurun bütçe kimliği (portföy notu) — kendi günlük sayacı; üyeler birlikte tavanın %90'ında durur. */
export const memberClient = (userId: string) => `${MEMBER}${userId}`;

const OWNER = `${MEMBER}owner:`;
/** Site sahibinin bütçe kimliği — çağıran `getAdmin` ile doğrulamış olmalı. */
export const ownerClient = (userId: string) => `${OWNER}${userId}`;

/**
 * YALNIZ ÖNBELLEK (24 Ekim, sayfanın içindeki Claude). Takip listesi notu ve
 * hisse sorusu, hissenin VAR OLAN Claude notlarını (hareket, bilanço,
 * önizleme) girdi olarak kullanır ama onları yazdırmaz: önbellekte yoksa
 * not yok sayılır. Notların önbellek anahtarı geri çağrının metni olduğu
 * için (lib/stock-insights.ts) aynı geri çağrı bu kimlikle çağrılır;
 * `takeCall` burada hak vermeden reddeder, ret null'a döner ve hafızaya
 * yazılmaz (`remembered`). Böylece bir okurun sorusu yirmi hissenin notunu
 * birden yazdırıp bütçeyi bitiremez.
 */
export const CACHE_ONLY = "claude-cache-only";

/**
 * KALICI SAYAÇ (14 Kasım güvenlik denetimi). Genel sayaç süreç
 * belleğindeydi: her deploy ve her yeniden başlatma sıfırlıyordu, yani
 * "günlük tavan" fiilen "süreç ömrü başına tavan"dı (günde birkaç deploy
 * tavanı katlıyor; mavi-yeşil geçişte iki süreç ayrı ayrı sayıyordu).
 *
 * KARAR VERİTABANINDA, TEK DEYİMDE (`lib/claude-spend-store.ts`): `reserve`
 * hakkı koşullu artışla alır, satır dönmezse tavan dolmuştur. Böylece kaç
 * süreç birlikte yaşarsa yaşasın toplam, tavanı (ve %80 / %90 paylarını)
 * AŞAMAZ; bellekteki `spent.n` yalnız son görülen toplamın kopyasıdır.
 * Eşzamanlı `takeCall` yerinde duruyor (yalnız bellek; testler ve
 * veritabanı olmayan ortam), üretimdeki TEK çağıran `callClaude` zaten
 * async olduğu için `reserveCall`a geçti.
 *
 * VERİTABANI ÇAĞRIYI ENGELLEMEZ. Tablo yoksa (migration deploy'da
 * uygulanmaz, kod önce inebilir), sorgu düşerse ya da `STORE_TIMEOUT_MS`
 * içinde dönmezse karar bugünkü bellek sayacına düşer ve depo bir süre hiç
 * denenmez (`trip`): kesintide her Claude çağrısı ayrıca bir zaman aşımı
 * beklemesin. Tablo eksikliği SESSİZ, öteki hatalar günlüğe yazılır. O
 * arada bellekte sayılan haklar (`unsynced`) depo dönünce koşulsuz işlenir;
 * sayaç gerçeği söyler.
 *
 * AŞIM HESABI (iki süreç, tavan T). Depo sağlıklıyken aşım 0. Depo
 * yokken her süreç kendi belleğiyle sayar: belleği son görülen toplamdan
 * (n₀) başladığı için ikisi birlikte en çok 2·(T − n₀) hak verir, yani
 * tavanın üstüne en çok T − n₀; kesinti sırasında AÇILAN süreç n₀ = 0
 * görür ve en çok T ekler (14 Kasım öncesinin her zamanki davranışı, artık
 * yalnız kesinti süresince). Zaman aşımına uğrayıp sonradan yine de yazılan
 * artış iki kez sayılır: hata temkinli tarafta.
 *
 * DOLU BELLEK KISA DEVRE YAPAR, AMA SÜRESİZ DEĞİL. Tavan dolunca her ret
 * için veritabanına gidilmez; `RESYNC_MS` sonra bir çağrı yine sorar, çünkü
 * öteki sürecin iadesi (`release`) yer açmış olabilir.
 */
const STORE_TIMEOUT_MS = 4_000;
const RESYNC_MS = 60_000;
const TRIP_ERROR_MS = 60_000;
const TRIP_MISSING_MS = 5 * 60_000;

/** Alınan hakkın makbuzu — iade aynı güne ve aynı sayaca gider (`releaseCall`). */
export type CallTicket = { day: string; durable: boolean };

type BudgetOptions = {
  /** Kalıcı sayaç; `null` ise bütçe yalnız bellekte sayar. */
  store: SpendStore | null;
  now?: () => number;
  log?: (message: string) => void;
  timeoutMs?: number;
};

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Bir sürecin bütçesi. Dışa açık olmasının nedeni test: iki "süreç" aynı
 * sahte depoyu paylaşan iki örnektir (`tests/claude-budget-store.test.ts`).
 * Kimlik başına sayaçlar `lib/rate-limit.ts`in süreç belleğinde ve örnekler
 * arasında ortak.
 */
export function createClaudeBudget(options: BudgetOptions) {
  const now = options.now ?? Date.now;
  const log = options.log ?? ((message: string) => console.error(message));
  const timeoutMs = options.timeoutMs ?? STORE_TIMEOUT_MS;
  const store = options.store;

  /* `n`: bilinen genel toplam. `unsynced`: depo yokken bellekte verilen,
     depoya henüz işlenmemiş haklar. `syncedAt`: deponun son yanıtı. */
  let spent = { day: "", n: 0, unsynced: 0, syncedAt: 0 };
  let skipUntil = 0;

  const today = () => {
    const day = new Date(now()).toISOString().slice(0, 10);
    if (spent.day !== day) spent = { day, n: 0, unsynced: 0, syncedAt: 0 };
    return day;
  };

  const ceilingOf = (client?: string) => {
    const cap = dailyCap();
    const member = client?.startsWith(MEMBER) ?? false;
    return !client ? cap : Math.floor(cap * (member ? MEMBER_SHARE : PUBLIC_SHARE));
  };

  /** Kimliğin kendi günlük sayacından alır; pay yoksa fırlatır. */
  const takeIdentity = (client?: string) => {
    if (!client) return;
    /* Önce bakılır, sonra alınır: `rateLimit` reddettiği denemeyi de
       sayıyor; sayaç tavanın üstüne şişerse `refundCall`ın geri verdiği hak
       açılmazdı. */
    const member = client.startsWith(MEMBER);
    const limit = client.startsWith(OWNER) ? OWNER_DAILY_CALLS : member ? MEMBER_DAILY_CALLS : CLIENT_DAILY_CALLS;
    if (!peekRateLimit(client, limit).allowed) throw new ClaudeBudgetError();
    rateLimit(client, limit, DAY_MS);
  };

  /** Yalnız bellek: 14 Kasım öncesinin davranışı. Depo varsa hak sonradan işlenmek üzere sayılır. */
  function take(client?: string): string {
    if (client === CACHE_ONLY) throw new ClaudeBudgetError();
    const day = today();
    if (spent.n >= ceilingOf(client)) throw new ClaudeBudgetError();
    takeIdentity(client);
    spent.n += 1;
    if (store) spent.unsynced += 1;
    return day;
  }

  function refund(client?: string): void {
    if (spent.n > 0) spent.n -= 1;
    if (spent.unsynced > 0) spent.unsynced -= 1;
    if (client) refundRateLimit(client);
  }

  /** Depo bir süre denenmez; tablo eksikliği sessiz, öteki hata günlüğe. */
  function trip(error: unknown, what: string): void {
    if (isMissingTable(error)) {
      skipUntil = now() + TRIP_MISSING_MS;
      return;
    }
    skipUntil = now() + TRIP_ERROR_MS;
    const reason = error instanceof Error ? error.message.slice(0, 200) : "?";
    log(`[claude bütçesi] kalıcı sayaç ${what}, bellek sayacına düşüldü: ${reason}`);
  }

  async function reserve(client?: string): Promise<CallTicket> {
    if (client === CACHE_ONLY) throw new ClaudeBudgetError();
    if (!store || now() < skipUntil) return { day: take(client), durable: false };

    const day = today();
    const ceiling = ceilingOf(client);
    /* Tavanı sıfır olan çağıran depoya gitmez: günün ilk çağrısı satırı
       `n = 1` ile AÇAR, koşul yalnız var olan satırı sınar. */
    if (ceiling <= 0) throw new ClaudeBudgetError();
    if (spent.n >= ceiling && now() - spent.syncedAt < RESYNC_MS) throw new ClaudeBudgetError();
    /* Kimlik sayacı beklemeden ÖNCE alınır: aynı kimliğin eşzamanlı iki
       çağrısı ikisi de "pay var" görüp birlikte geçemesin. */
    takeIdentity(client);

    /* Bellekte kalan haklar: önce sıfırlanır, sonra yazılır — eşzamanlı iki
       çağrı aynı hakları iki kez işlemesin; yazılamazsa geri konur. */
    const pending = spent.unsynced;
    spent.unsynced = 0;
    let total: number | null;
    try {
      if (pending > 0) {
        await withTimeout(store.add(day, pending), timeoutMs).catch((error: unknown) => {
          if (spent.day === day) spent.unsynced += pending;
          throw error;
        });
      }
      total = await withTimeout(store.take(day, ceiling), timeoutMs);
    } catch (error) {
      trip(error, "yazılamadı");
      /* Karar belleğe düşer; kimlik sayacı yukarıda alındı. */
      if (spent.day === day) {
        if (spent.n >= ceiling) {
          if (client) refundRateLimit(client);
          throw new ClaudeBudgetError();
        }
        spent.n += 1;
        spent.unsynced += 1;
      }
      return { day, durable: false };
    }

    if (spent.day === day) spent.syncedAt = now();
    if (total === null) {
      if (client) refundRateLimit(client);
      if (spent.day === day) spent.n = Math.max(spent.n, ceiling);
      throw new ClaudeBudgetError();
    }
    if (spent.day === day) spent.n = total;
    return { day, durable: true };
  }

  async function release(client: string | undefined, ticket: CallTicket): Promise<void> {
    if (client) refundRateLimit(client);
    if (spent.day === ticket.day) {
      if (spent.n > 0) spent.n -= 1;
      /* Belleğe düşmüş hak depoya hiç yazılmadı: bekleyenlerden düşer. */
      if (!ticket.durable && spent.unsynced > 0) spent.unsynced -= 1;
    }
    if (!ticket.durable || !store || now() < skipUntil) return;
    try {
      await withTimeout(store.refund(ticket.day), timeoutMs);
    } catch (error) {
      trip(error, "iadesi yazılamadı");
    }
  }

  return { take, refund, reserve, release };
}

const budget = createClaudeBudget({ store: databaseSpendStore() });

/**
 * Günlük tavandan bir hak düşer; hak yoksa `ClaudeBudgetError`. `client`
 * isteğin bütçe kimliği: anonim uçta `anonymousClient` (günde
 * `CLIENT_DAILY_CALLS`, tavanın %80'i), oturumlu notta `memberClient` (günde
 * `MEMBER_DAILY_CALLS`, tavanın %90'ı). Kimliksiz çağrı nöbetten gelir ve
 * tavanın tamamını kullanabilir.
 *
 * Genel sayacı veritabanında sayar; makbuzu iadeye (`releaseCall`) verilir.
 */
export const reserveCall = (client?: string): Promise<CallTicket> => budget.reserve(client);

/**
 * Sunucunun reddettiği (429, 5xx) ve ücretlenmeyen çağrının hakkı geri
 * verilir — genel tavandan VE istemcinin günlük sayacından (20 Ekim). Yalnız
 * genel sayaç dönüyordu: kesintide 30 soğuk sayfa açan okur kendi payını
 * ücretlenmeyen 429/529'larla bitiriyor, API dönünce 24 saat notsuz
 * kalıyordu (aynı CGNAT IP'sini paylaşanlar da).
 */
export const releaseCall = (client: string | undefined, ticket: CallTicket): Promise<void> => budget.release(client, ticket);

/**
 * `reserveCall`ın YALNIZ BELLEKTE sayan eşzamanlı hâli (14 Kasım'a dek tek
 * yol). Üretimde çağıranı kalmadı; `CACHE_ONLY` reddini ve pay kurallarını
 * sınayan testler ile veritabanı olmayan ortam için duruyor.
 */
export function takeCall(client?: string): void {
  budget.take(client);
}

/** `takeCall`ın iadesi — yalnız bellek. */
export function refundCall(client?: string): void {
  budget.refund(client);
}
