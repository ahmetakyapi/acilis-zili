import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Bağlantı tembel kurulur: DATABASE_URL yokken uygulama yine açılır,
 * sorgu atan her yer kendi hatasını yakalar ve ilgili kart "veri yok"
 * gösterir. Modül yükleme anında fırlatmak tüm sayfayı çökertirdi.
 */

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

/* SORGUYA SÜRE SINIRI (20 Ekim). HTTP sürücüsü her sorguyu sinyalsiz bir
   POST olarak atıyor; Neon bağlantıyı kabul edip durursa (bölgesel arıza,
   uyanamayan hesaplama) her çizim undici'nin ~300 sn'lik varsayılanına dek
   bekliyor ve tek süreçli VPS'te istekler üst üste yığılıyordu. Tasarımın
   geri kalanı ("kart veri yok der") sorgunun hızlı DÜŞTÜĞÜNÜ varsayıyor;
   sağlayıcı çağrılarındaki `withTimeout`un veritabanı karşılığı bu.
   `AbortSignal` burada güvenli: lib/providers/timeout.ts'teki çekince Next
   veri önbelleği içindi, bu istekler önbelleğe girmeyen POST. Sinyal her
   çağrıda YENİ (tek bir sinyal bir kez dolunca hep iptal kalırdı); süre
   cömert, çünkü tohumlama ve cron'un toplu yazımları da bu modülden geçiyor.
   Çağıranın kendi sinyali varsa o kazanır. */
const DB_TIMEOUT_MS = 25_000;
neonConfig.fetchFunction = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(DB_TIMEOUT_MS) });

function connect(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL tanımlı değil. .env.local dosyasına Neon bağlantı adresini ekle.",
    );
  }
  return drizzle(neon(url), { schema });
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    instance ??= connect();
    return Reflect.get(instance, prop, instance);
  },
});

export { schema };
