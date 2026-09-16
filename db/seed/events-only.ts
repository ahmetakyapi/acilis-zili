import { config } from "dotenv";

config({ path: ".env.local" });

import { reportCoverage, seedEconomicEvents } from "./economic-step";

/**
 * YALNIZ EKONOMİK TAKVİM — `npm run db:seed:events`.
 *
 * Tam seed beş tabloya yazıyor ve beşincisi `stories`: orada bir mercek
 * yazısının gövdesi seed sürümüyle değiştiriliyor, üstelik sürüm fotoğrafı
 * alınmadan. Takvimi tazelemek için o riski almak gerekmiyor; bu giriş
 * yalnızca `economic_events` tablosuna dokunuyor.
 *
 * Tam seed hâlâ yerinde (`npm run db:seed`) — bu onun yerine geçmiyor,
 * dar bir kapı açıyor.
 */
async function main() {
  console.log("Ekonomik takvim güncelleniyor… (yalnızca economic_events)\n");
  const count = await seedEconomicEvents();
  console.log(`  ekonomik olaylar   ${count} kayıt`);
  reportCoverage();
  console.log("\nBitti. Başka hiçbir tabloya dokunulmadı.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nBaşarısız:", error);
    process.exit(1);
  });
