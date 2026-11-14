/* Ölçüm aracı: sağlayıcı çağrılarını (Finnhub, Alpaca, Neon HTTP,
   Hazine/Cboe/FRED) sahte ama biçimi doğru veriyle yanıtlar; bilinmeyen dış
   adres engellenir, canlı veritabanına ulaşılamaz. NODE_OPTIONS=--require
   ile yüklenir, uygulama koduna dokunmaz. Kullanım ve senaryo tablosu:
   `.claude/skills/olcum/SKILL.md` → "Gerçek Sayfa, Sahte Sağlayıcı".

   ORTAK DOSYA (14 Kasım): yedi ajan aynı gün bu dosyanın yedi yamalı
   kopyasını scratchpad'e yazdı ve birleşik hâlde `/teknik-analiz/NVDA` 500
   döndü. Eksik veri burada, `sahte-saglayici/` altındaki modülde tamamlanır:
     saat.cjs      MOCK_NOW ile sunucu saati (İLK yüklenir)
     ortak.cjs     ET takvimi, tatiller, işlem günü aritmetiği
     piyasa.cjs    Finnhub / Alpaca / Hazine / Cboe / FRED yanıtları
     tablolar.cjs  veritabanı satırları (içerik, takvim, bilanço, semboller)
     teknik.cjs    teknik analiz yayınları ve fotoğrafları
     sorgu.cjs     SELECT ayrıştırıcı: WHERE, ORDER BY, LIMIT */
require("./sahte-saglayici/saat.cjs");
const { yanit, json } = require("./sahte-saglayici/piyasa.cjs");
const { neon } = require("./sahte-saglayici/sorgu.cjs");

const realFetch = globalThis.fetch;
const seen = new Set();
globalThis.fetch = async function mockFetch(input, init) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let u;
  try { u = new URL(url); } catch { return realFetch(input, init); }
  if (u.hostname === "127.0.0.1" || u.hostname === "localhost") return realFetch(input, init);
  try {
    if (u.hostname.endsWith("mockdb.test")) {
      const raw = init && init.body ? String(init.body) : typeof input === "object" && input.text ? await input.clone().text() : "{}";
      return json(neon(JSON.parse(raw)));
    }
    const known = yanit(u);
    if (known) return known;
  } catch (error) {
    /* Sahte verinin kendi hatası sessiz kalmaz ve ASLA gerçek ağa düşmez. */
    process.stderr.write(`[mock-fetch] HATA ${u.hostname}${u.pathname}: ${error && error.stack ? error.stack : error}\n`);
    return json({ error: "mock" }, 500);
  }
  if (!seen.has(u.hostname)) { seen.add(u.hostname); process.stderr.write(`[mock-fetch] engellendi: ${u.hostname}${u.pathname}\n`); }
  return json({}, 503);
};
