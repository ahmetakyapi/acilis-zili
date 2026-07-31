import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Bağlantı tembel kurulur: DATABASE_URL yokken uygulama yine açılır,
 * sorgu atan her yer kendi hatasını yakalar ve ilgili kart "veri yok"
 * gösterir. Modül yükleme anında fırlatmak tüm sayfayı çökertirdi.
 */

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | null = null;

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

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export { schema };
