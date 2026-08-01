/**
 * Endeks üyelerinin şirket profillerini Finnhub'dan çekip `symbols` tablosuna
 * yazar — piyasa değeri, sektör, logo ve hisse sayısı buradan gelir.
 *
 * Finnhub ücretsiz katmanı dakikada 60 istek kabul eder; bu yüzden istekler
 * saniyede bir atılır. Yaklaşık 540 sembol ≈ 9-10 dakika sürer.
 *
 * Çalıştırma:  npx tsx scripts/sync-profiles.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../lib/db";
import { symbols as symbolsTable } from "../lib/schema";
import { ALL_MEMBERS } from "../db/seed/indices";
import { sql } from "drizzle-orm";

type RawProfile = {
  name?: string;
  exchange?: string;
  finnhubIndustry?: string;
  logo?: string;
  country?: string;
  currency?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  ipo?: string;
  weburl?: string;
};

const KEY = process.env.FINNHUB_API_KEY;
if (!KEY) throw new Error("FINNHUB_API_KEY yok");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchProfile(symbol: string): Promise<RawProfile | null> {
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${KEY}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url);
    if (res.status === 429) {
      await sleep(5000);
      continue;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as RawProfile;
    return data?.name ? data : null;
  }
  return null;
}

async function main() {
  const members = ALL_MEMBERS;
  console.log(`${members.length} sembol işlenecek`);

  const batch: (typeof symbolsTable.$inferInsert)[] = [];
  let done = 0;
  let failed = 0;

  for (const member of members) {
    const profile = await fetchProfile(member.symbol);
    done += 1;

    if (profile) {
      batch.push({
        symbol: member.symbol,
        name: profile.name ?? member.name,
        exchange: profile.exchange ?? null,
        sector: member.sector ?? null,
        industry: member.sub ?? profile.finnhubIndustry ?? null,
        logoUrl: profile.logo || null,
        country: profile.country ?? null,
        currency: profile.currency ?? "USD",
        // Finnhub piyasa değerini MİLYON cinsinden ve yerel para biriminde verir.
        marketCap:
          typeof profile.marketCapitalization === "number"
            ? profile.marketCapitalization * 1e6
            : null,
        shareOutstanding:
          typeof profile.shareOutstanding === "number"
            ? profile.shareOutstanding * 1e6
            : null,
        ipoDate: profile.ipo || null,
        weburl: profile.weburl || null,
        updatedAt: new Date(),
      });
    } else {
      failed += 1;
    }

    // 50'lik paketler halinde yaz — bağlantı başına tek gidiş.
    if (batch.length >= 50) {
      await flush(batch);
      batch.length = 0;
      console.log(`  ${done}/${members.length} (başarısız: ${failed})`);
    }

    await sleep(1050);
  }

  if (batch.length > 0) await flush(batch);
  console.log(`bitti — ${done} sembol, ${failed} başarısız`);
}

async function flush(rows: (typeof symbolsTable.$inferInsert)[]) {
  if (rows.length === 0) return;
  await db
    .insert(symbolsTable)
    .values(rows)
    .onConflictDoUpdate({
      target: symbolsTable.symbol,
      set: {
        name: sql`excluded.name`,
        exchange: sql`excluded.exchange`,
        sector: sql`excluded.sector`,
        industry: sql`excluded.industry`,
        logoUrl: sql`excluded.logo_url`,
        country: sql`excluded.country`,
        currency: sql`excluded.currency`,
        marketCap: sql`excluded.market_cap`,
        shareOutstanding: sql`excluded.share_outstanding`,
        ipoDate: sql`excluded.ipo_date`,
        weburl: sql`excluded.weburl`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
