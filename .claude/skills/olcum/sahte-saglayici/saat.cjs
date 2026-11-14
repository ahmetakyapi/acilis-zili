/* SAAT (14 Kasım): `MOCK_NOW=<ISO an>` sunucunun saatini o ana KAYDIRIR;
   saat akmaya devam eder (dondurulmuş `Date.now()` süre ölçen döngüleri
   kilitler). Giriş dosyası bunu HER ŞEYDEN ÖNCE yükler: öteki modüllerin
   "bugün"ü kaydırılmış saatten okunur.

   - `Date` bir Proxy: `new Date()` ve `Date.now()` kayar; argümanlı kurucu,
     `Date.UTC/parse`, `instanceof` ve prototip gerçek kalır.
   - `next` üst süreç + işçi süreç olarak koşar; başlangıç anı ortam
     değişkeniyle çocuklara geçer ki hepsi AYNI farkı kullansın.
   - Üst süreç `.next/mock-saat.json` yazar: `olc.mjs` tarayıcı saatini
     sunucunun şu anki (akmış) anına oradan sabitler.
   - ÖNBELLEK: `unstable_cache` kayıtları diske yazılır ve yeniden başlatmada
     yaşar. Sahte veri ya da saat değişince eski kayıt "taze" görünür (boş
     tatil tablosu bir gün yaşıyordu). Üst süreç bu yüzden her açılışta veri
     önbelleğini, saat DEĞİŞTİYSE `.next/dev`i de siler (gerekçe SKILL.md →
     Dersler). `MOCK_ONBELLEK=koru` silmeyi kapatır (önbellek davranışının
     kendisini incelerken).
   - Kaymayan: argümansız `Intl.DateTimeFormat().format()` ve
     `performance.now()`; uygulama tarihleri hep `Date` üzerinden kurar. */
const fs = require("fs");
const path = require("path");
const Real = Date;
const hedef = process.env.MOCK_NOW ? Real.parse(process.env.MOCK_NOW) : NaN;
if (process.env.MOCK_NOW && !Number.isFinite(hedef)) {
  process.stderr.write(`[mock-saat] MOCK_NOW okunamadı: "${process.env.MOCK_NOW}" (örnek: 2026-11-13T18:00:00Z)\n`);
  process.exit(2);
}
const ust = !process.env.MOCK_SAAT_BASLANGIC;
if (ust) process.env.MOCK_SAAT_BASLANGIC = String(Real.now());
const baslangic = Number(process.env.MOCK_SAAT_BASLANGIC);
const fark = Number.isFinite(hedef) ? hedef - baslangic : 0;

if (fark !== 0) {
  const simdi = () => Real.now() + fark;
  globalThis.Date = new Proxy(Real, {
    construct: (target, args, newTarget) => Reflect.construct(target, args.length === 0 ? [simdi()] : args, newTarget),
    apply: () => new Real(simdi()).toString(),
    get: (target, key) => (key === "now" ? simdi : Reflect.get(target, key)),
  });
}

if (ust) {
  const kok = path.join(process.cwd(), ".next");
  const isaret = path.join(kok, "mock-saat.json");
  const sil = (yol) => { try { fs.rmSync(path.join(kok, yol), { recursive: true, force: true }); } catch {} };
  let onceki = null;
  try { onceki = JSON.parse(fs.readFileSync(isaret, "utf8")).now; } catch {}
  const now = Number.isFinite(hedef) ? new Real(hedef).toISOString() : null;
  if (fs.existsSync(kok) && process.env.MOCK_ONBELLEK !== "koru") {
    sil("cache/fetch-cache");
    sil("dev/cache/fetch-cache");
    if (onceki !== now && fs.existsSync(path.join(kok, "dev"))) {
      sil("dev");
      process.stderr.write("[mock-saat] saat değişti: .next/dev silindi\n");
    }
    try { fs.writeFileSync(isaret, JSON.stringify({ now, baslangic })); } catch {}
  }
  if (now) process.stderr.write(`[mock-saat] sunucu saati ${now} anından akıyor\n`);
}
module.exports = { Real, fark };
