/**
 * Nasdaq-100 bileşen listesini resmî kaynaktan tazeler.
 *
 * NEDEN VAR: `db/seed/indices.ts` elle bakılan tek büyük veri parçasıydı ve
 * bir kez gerçekten bayatladı — SPCX 7 Temmuz 2026'da endekse girdi, dosya
 * 1 Ağustos damgalı olmasına rağmen içermiyordu ve /piyasalar bileşenleri
 * eksik gösterdi.
 *
 * NEDEN SADECE NASDAQ-100: üç endeksin ücretsiz kaynakları test edildi.
 *   Nasdaq-100 → api.nasdaq.com            saf JSON, bağımlılık gerektirmiyor
 *   S&P 500    → State Street SPY holdings .xlsx, çözümleyici gerektirir
 *   Dow 30     → State Street DIA holdings .xlsx, çözümleyici gerektirir
 *   Finnhub    → /index/constituents       ücretsiz katmanda 403
 *   Wikipedia  → API açık ama GERİDE       (SPCX'i haftalarca göstermedi)
 * Bozulan endeks Nasdaq-100'dü ve tek bağımlılıksız kaynak da o. S&P ve Dow
 * çok daha yavaş değişiyor; onlar elle kalmaya devam ediyor.
 *
 * GICS TAKSONOMİSİ KORUNUR: Nasdaq yanıtında bir `sector` alanı var ama o
 * Nasdaq'ın kendi sınıflandırması, bu dosyadaki `sector`/`sub` ise GICS.
 * İkisini karıştırmak sektör gruplarını sessizce bozardı. Bu yüzden:
 *   - Listede KALAN üyelerin GICS bilgisi olduğu gibi korunur.
 *   - YENİ üyenin GICS'i S&P 500 listesinden aranır (NDX üyelerinin çoğu
 *     orada da var); bulunamazsa boş bırakılır — uydurulmaz. Arayüz o
 *     durumda sağlayıcının sektör alanına düşer.
 *
 * Çalıştırma:
 *   npx tsx scripts/sync-indices.ts           → yalnızca rapor (varsayılan)
 *   npx tsx scripts/sync-indices.ts --write   → indices.ts'i günceller
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NDX_MEMBERS, SPX_MEMBERS, type IndexMember } from "../db/seed/indices";

const NDX_URL = "https://api.nasdaq.com/api/quote/list-type/nasdaq100";

/** Nasdaq'ın ucu tarayıcı dışı isteklere kapalı; başlıklar şart. */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Accept: "application/json",
};

const INDICES_PATH = join(process.cwd(), "db/seed/indices.ts");

type NasdaqRow = { symbol?: string; companyName?: string };

/**
 * "Apple Inc. Common Stock" → "Apple Inc."
 * Nasdaq şirket adına menkul kıymet türünü ekliyor; listede okunacak olan
 * şirketin adı, kotasyonun türü değil.
 */
function cleanName(raw: string): string {
  return (
    raw
      /* Menkul kıymet türü ekleri. Sınıf harfi KORUNUR ("Class C"), çünkü
         çok sınıflı şirketlerde iki satırı ayıran tek şey o — silinirse
         GOOGL ile GOOG listede aynı isimle görünür. */
      .replace(
        /\s+(Common|Capital|Ordinary)\s+(Stock|Shares?)\b.*$/i,
        "",
      )
      .replace(/\s+American\s+Depositary\s+Shares?\b.*$/i, "")
      .replace(/\s*\(.*?\)\s*$/, "")
      .trim()
  );
}

async function fetchNdx(): Promise<{ symbol: string; name: string }[]> {
  const res = await fetch(NDX_URL, { headers: HEADERS });
  if (!res.ok) throw new Error(`Nasdaq ${res.status}`);

  const payload = (await res.json()) as {
    data?: { data?: { rows?: NasdaqRow[] } };
  };
  const rows = payload?.data?.data?.rows ?? [];

  const list = rows
    .filter((row): row is Required<NasdaqRow> =>
      Boolean(row.symbol && row.companyName),
    )
    .map((row) => ({
      symbol: row.symbol.trim().toUpperCase(),
      name: cleanName(row.companyName),
    }));

  /* Sağlam olalım: yanıt beklenmedik biçimde küçükse dosyayı EZMEYELİM.
     Endeks 100 üyeli (hızlı girişlerde biraz fazlası olabilir); 90'ın altı
     bir veri sorunudur, meşru bir değişiklik değil. */
  if (list.length < 90) {
    throw new Error(
      `yalnızca ${list.length} bileşen döndü — yanıt şüpheli, dosyaya dokunulmadı`,
    );
  }
  return list;
}

/** Yeni üyenin GICS bilgisi için S&P 500 listesine bak. */
function gicsFor(symbol: string): Pick<IndexMember, "sector" | "sub"> {
  const found = SPX_MEMBERS.find((member) => member.symbol === symbol);
  return { sector: found?.sector, sub: found?.sub };
}

function renderMember(member: IndexMember): string {
  const parts = [
    `symbol: ${JSON.stringify(member.symbol)}`,
    `name: ${JSON.stringify(member.name)}`,
  ];
  if (member.sector) parts.push(`sector: ${JSON.stringify(member.sector)}`);
  if (member.sub) parts.push(`sub: ${JSON.stringify(member.sub)}`);
  return `  { ${parts.join(", ")} },`;
}

async function main() {
  const write = process.argv.includes("--write");
  const live = await fetchNdx();

  const liveSymbols = new Set(live.map((row) => row.symbol));
  const currentSymbols = new Set(NDX_MEMBERS.map((member) => member.symbol));

  const added = live.filter((row) => !currentSymbols.has(row.symbol));
  const removed = NDX_MEMBERS.filter(
    (member) => !liveSymbols.has(member.symbol),
  );

  console.log(`Nasdaq-100 — canlı: ${live.length}, dosyada: ${NDX_MEMBERS.length}`);

  if (added.length === 0 && removed.length === 0) {
    console.log("Fark yok, dosya güncel.");
    return;
  }

  for (const row of added) {
    const gics = gicsFor(row.symbol);
    const note = gics.sector ? "" : "  (GICS bulunamadı, boş bırakılacak)";
    console.log(`  + ${row.symbol.padEnd(6)} ${row.name}${note}`);
  }
  for (const member of removed) {
    console.log(`  - ${member.symbol.padEnd(6)} ${member.name}`);
  }

  if (!write) {
    console.log("\nRapor modu. Uygulamak için: --write");
    return;
  }

  // Kalanların GICS bilgisi korunur, yenilere S&P'den bakılır.
  const byMembership: IndexMember[] = live.map((row) => {
    const existing = NDX_MEMBERS.find(
      (member) => member.symbol === row.symbol,
    );
    if (existing) return existing;
    return { symbol: row.symbol, name: row.name, ...gicsFor(row.symbol) };
  });
  byMembership.sort((a, b) => a.symbol.localeCompare(b.symbol));

  const source = readFileSync(INDICES_PATH, "utf8");
  const startMarker = "export const NDX_MEMBERS: IndexMember[] = [";
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error("NDX_MEMBERS bloğu bulunamadı");
  const end = source.indexOf("\n];", start);
  if (end === -1) throw new Error("NDX_MEMBERS bloğunun sonu bulunamadı");

  const today = new Date().toISOString().slice(0, 10);
  const block =
    `${startMarker}\n` +
    `  /* Bu liste \`npx tsx scripts/sync-indices.ts --write\` ile üretildi.\n` +
    `     Kaynak: api.nasdaq.com · son senkron: ${today}\n` +
    `     Elle düzenlenebilir ama betik bir daha koştuğunda üzerine yazar;\n` +
    `     kalıcı düzeltmeler betiğe girmeli. Üye sayısı 100'ü aşabilir:\n` +
    `     Nasdaq'ın hızlı giriş kuralı buna izin veriyor. */\n` +
    byMembership.map(renderMember).join("\n");

  writeFileSync(INDICES_PATH, source.slice(0, start) + block + source.slice(end));
  console.log(`\nYazıldı: ${byMembership.length} üye → db/seed/indices.ts`);
  console.log(
    "INDEX_COMPOSITION_DATE elle güncellenir — S&P ve Dow hâlâ elle bakılıyor.",
  );
}

main().catch((error) => {
  console.error("HATA:", error instanceof Error ? error.message : error);
  process.exit(1);
});
