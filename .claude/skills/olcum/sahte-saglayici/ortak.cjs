/* Ortak yardımcılar: tohumlu rastgelelik, ET takvimi (tatil tablosu
   `db/seed/holidays.ts`ten okunur), işlem günü aritmetiği, seansın şu anki
   durumu. Saat `saat.cjs` ile kaydırılmış olabilir; hiçbir şey modül
   yüklenirken "bugün"ü sabitlemez. */
const fs = require("fs");
const path = require("path");

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
function rng(seed) { let s = Math.floor(hash(seed) * 2147483647) || 1; return () => ((s = (s * 48271) % 2147483647) / 2147483647); }
const uid = (group, i) => `00000000-0000-4000-8000-0000000${group}${String(i).padStart(4, "0")}`;
function oku(rel) {
  try { return fs.readFileSync(path.join(process.cwd(), rel), "utf8"); } catch { process.stderr.write(`[mock] okunamadı: ${rel} (sunucu depo kökünden mi açıldı?)\n`); return ""; }
}

/* ---- ET saati ---- */
const ET = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function et(at = new Date()) {
  const p = Object.fromEntries(ET.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
function etToUtc(date, hhmm = "00:00") {
  const [y, m, d] = date.split("-").map(Number); const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h + 5, mi);
  const got = et(new Date(guess));
  const delta = (got.date === date ? 0 : got.date < date ? -1440 : 1440) + got.min - (h * 60 + mi);
  return new Date(guess - delta * 60e3);
}
function addDays(date, n) { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
const dow = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

/* ---- Tatiller (tohumdan) ---- */
const HOLIDAYS = [...oku("db/seed/holidays.ts").matchAll(/\{ date: "([^"]+)", nameTr: "([^"]+)", nameEn: "([^"]+)", earlyCloseEt: (null|"[^"]+") \}/g)]
  .map((m, i) => ({ id: `h${i}`, date: m[1], name_tr: m[2], name_en: m[3], early_close_et: m[4] === "null" ? null : m[4].slice(1, -1) }));
const HOLIDAY = new Map(HOLIDAYS.map((h) => [h.date, h]));
const isTrading = (date) => dow(date) % 6 !== 0 && !(HOLIDAY.has(date) && HOLIDAY.get(date).early_close_et === null);
function prevTrading(date) { let d = addDays(date, -1); while (!isTrading(d)) d = addDays(d, -1); return d; }
function nextTrading(date) { let d = addDays(date, 1); while (!isTrading(d)) d = addDays(d, 1); return d; }
function tradingDaysBack(last, n) { const out = [last]; while (out.length < n) out.push(prevTrading(out[out.length - 1])); return out.reverse(); }

const today = () => et().date;
/** Takvim günü kaydırması (bugün = ET). */
const day = (n) => addDays(today(), n);
/** İşlem günü kaydırması: 0 = bugün işlem günüyse bugün, değilse sıradaki; -1 = bugünden ÖNCEKİ son işlem günü. */
function isGunu(n) {
  let d = today();
  if (n >= 0) { if (!isTrading(d)) d = nextTrading(d); for (let i = 0; i < n; i++) d = nextTrading(d); return d; }
  for (let i = 0; i < -n; i++) d = prevTrading(d);
  return d;
}

/**
 * Seansın şu anki hâli. `tradeDay` son işlemin ait olduğu seans, `tradeAt`
 * o işlemin anı (kapalıyken son seansın 19:59 ET'si: hafta sonunda "şimdi"
 * damgalı kotasyon olmaz), `barToday` bugünün gün barı var mı (açılıştan
 * önce sağlayıcının gün barı dünkü seanstır).
 */
function durum() {
  const now = new Date(); const { date, min } = et(now);
  const trading = isTrading(date);
  const live = trading && min >= 240 && min < 1200;
  const tradeDay = trading && min >= 240 ? date : prevTrading(date);
  const tradeAt = live ? now : etToUtc(tradeDay, "19:59");
  return { now, date, min, trading, live, tradeDay, tradeAt, barToday: trading && min >= 570 };
}

module.exports = { hash, rng, uid, oku, et, etToUtc, addDays, dow, HOLIDAYS, isTrading, prevTrading, nextTrading, tradingDaysBack, today, day, isGunu, durum };
