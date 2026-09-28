/**
 * Ünlü yatırımcılar — ilk doldurma ve elle senkron.
 *
 * Günlük cron aynı işi bütçeyle yapıyor (dosya ve OpenFIGI isteği tavanı);
 * bu betik bütçesiz: her yatırımcının son sekiz çeyreği, Pelosi'nin geçen
 * ve bu yılki bildirimleri ve bütün CUSIP'ler. Anahtarsız OpenFIGI dakikada
 * 25 istek (istek başına 10 CUSIP) verdiği için ilk koşum on-on beş dakika
 * sürebilir; sonraki koşumlar yalnızca yenileri çeker.
 *
 * Çalıştırma:  npx tsx scripts/sync-investors.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  /* `lib/db` bağlantıyı ilk sorguda kuruyor; ortam yukarıda yüklendi. */
  const { syncInvestors } = await import("../lib/investor-sync");
  const year = new Date().getUTCFullYear();
  const started = Date.now();
  const result = await syncInvestors({
    houseYears: [year - 1, year],
    log: (message) => process.stdout.write(`${message}\n`),
  });
  process.stdout.write(`\n${result.summary}\n${Math.round((Date.now() - started) / 1000)} sn\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
