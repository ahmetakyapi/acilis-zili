import { clientKey, peekRateLimit, rateLimit, refundRateLimit } from "@/lib/rate-limit";

/**
 * CLAUDE ÇAĞRI BÜTÇESİ — hisse, karşılaştırma, haber, veri, portföy ve takip
 * notlarının ortak günlük tavanı. Her çağrı buradan hak alır
 * (lib/stock-insights.ts → callClaude). Tavan süreç belleğinde, UTC gece
 * yarısı sıfırlanır (`INSIGHT_DAILY_CAP`, varsayılan 150).
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
/* Genel sayacın, her kimlik türünün durduğu payı: anonim %80, üye %90,
   nöbet tavanın tamamı (yukarıda 2 ve 4). Kimlik başına sayaçtan ayrı:
   bunlar TOPLAMI sınırlar. */
const PUBLIC_SHARE = 0.8;
const MEMBER_SHARE = 0.9;
const DAY_MS = 24 * 3600_000;

export const dailyCap = () => {
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

let spent = { day: "", n: 0 };

/**
 * Günlük tavandan bir hak düşer; hak yoksa `ClaudeBudgetError`. `client`
 * isteğin bütçe kimliği: anonim uçta `anonymousClient` (günde
 * `CLIENT_DAILY_CALLS`, tavanın %80'i), oturumlu notta `memberClient` (günde
 * `MEMBER_DAILY_CALLS`, tavanın %90'ı). Kimliksiz çağrı nöbetten gelir ve
 * tavanın tamamını kullanabilir.
 */
export function takeCall(client?: string): void {
  const day = new Date().toISOString().slice(0, 10);
  if (spent.day !== day) spent = { day, n: 0 };
  const cap = dailyCap();
  const member = client?.startsWith(MEMBER) ?? false;
  const ceiling = !client ? cap : Math.floor(cap * (member ? MEMBER_SHARE : PUBLIC_SHARE));
  if (spent.n >= ceiling) throw new ClaudeBudgetError();
  if (client) {
    /* Önce bakılır, sonra alınır: `rateLimit` reddettiği denemeyi de
       sayıyor; sayaç tavanın üstüne şişerse `refundCall`ın geri verdiği hak
       açılmazdı. */
    const limit = member ? MEMBER_DAILY_CALLS : CLIENT_DAILY_CALLS;
    if (!peekRateLimit(client, limit).allowed) throw new ClaudeBudgetError();
    rateLimit(client, limit, DAY_MS);
  }
  spent.n += 1;
}

/**
 * Sunucunun reddettiği (429, 5xx) ve ücretlenmeyen çağrının hakkı geri
 * verilir — genel tavandan VE istemcinin günlük sayacından (20 Ekim). Yalnız
 * genel sayaç dönüyordu: kesintide 30 soğuk sayfa açan okur kendi payını
 * ücretlenmeyen 429/529'larla bitiriyor, API dönünce 24 saat notsuz
 * kalıyordu (aynı CGNAT IP'sini paylaşanlar da).
 */
export function refundCall(client?: string): void {
  if (spent.n > 0) spent.n -= 1;
  if (client) refundRateLimit(client);
}
