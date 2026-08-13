/**
 * Adla seçilmiş şirketler — piyasa değeri eşiğinin dışında kalan takip listesi.
 *
 * NEDEN VAR: bu sitedeki her sıralama piyasa değerine bakıyor ve o ölçü tek
 * başına yanlış cevap veriyor. Yapay zekâ, uzay ve enerji altyapısının inşa
 * katmanındaki şirketler eşiklerin belirgin altında (CRWV 49, NBIS 49, RKLB 48,
 * BE 64, ASTS 27, SHAZ 1,7 milyar $) ama çeyrekleri o eşiğin üstündeki pek çok
 * şirketinkinden daha çok konuşuluyor. Eşiği bunları yakalayacak kadar indirmek
 * yüzlerce sıradan şirketi de içeri alırdı; ADLA SAYMAK hem dar hem dürüst.
 *
 * SEMBOLE BAKAR, PROFİLE DEĞİL. Liste `symbols` tablosunu sorgulamıyor: yeni
 * bir şirketin profili sağlayıcıdan günler sonra gelebiliyor ve o boşlukta
 * eleniyordu. ONDS tam olarak böyle kayboldu — bilanço takviminde kaydı vardı
 * ama piyasa değeri null olduğu için takvimin kapalı bölümüne düşüyordu.
 *
 * ÜÇ YERDEN OKUNUR, TEK YERDE DURUR:
 *   1. Bilanço takvimi (components/earnings/EarningsCalendar.tsx) — bu
 *      şirketler görünür katmanda, kapalı listede değil.
 *   2. Gün şeridi (app/(app)/page.tsx) — 50 milyar dolarlık eşiği atlar.
 *   3. Analiz rutini (app/api/analiz/context/route.ts) — aday havuzuna
 *      eşiksiz girer; rutin talimatı docs/claude-rutinler.md § 4'te.
 *   Ayrıca günlük cron (app/api/cron/daily/route.ts) profillerini öncelikli
 *   tazeliyor ki liste hiç eksik künyeyle çalışmasın.
 *
 * LİSTEYE EKLERKEN: buraya bir satır yeter, üç ekran birden onu tanır.
 * Şirketin `symbols` tablosunda kaydı olması gerekmez — cron ilk koşumda
 * profili çeker. `db/seed/symbols.ts` içindeki POPULAR_SYMBOLS'a da eklemek
 * yalnızca temiz bir kurulumda aramada anında çıkması içindir, şart değil.
 */
export const SPOTLIGHT_SYMBOLS: readonly string[] = [
  "CRWV", // CoreWeave — yapay zekâ bulut altyapısı
  "NBIS", // Nebius Group — yapay zekâ bulut altyapısı
  "BE", // Bloom Energy — veri merkezi güç üretimi
  "RKLB", // Rocket Lab — fırlatma ve uzay sistemleri
  "ASTS", // AST SpaceMobile — uydudan doğrudan telefon bağlantısı
  "ONDS", // Ondas Holdings — insansız sistemler ve özel ağlar
  "SHAZ", // SharonAI Holdings — yapay zekâ hesaplama
] as const;

const SPOTLIGHT_SET: ReadonlySet<string> = new Set(SPOTLIGHT_SYMBOLS);

/** Sembol adla seçilmiş evrende mi. */
export function isSpotlight(symbol: string): boolean {
  return SPOTLIGHT_SET.has(symbol);
}
