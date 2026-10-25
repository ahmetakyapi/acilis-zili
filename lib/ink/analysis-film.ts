/**
 * Claude analizi beklerken oynayan mürekkep filmi — BİR HİSSENİN KISA FİLMİ.
 *
 * 25 EKİM, YENİDEN KURGU (sahibinin isteği: "grafikler çizilirken çok hızlı ve
 * zoom gibi çiziliyordu … kısa bir film gibi, bir konu üzerinden ilerleyerek,
 * güzel, sanatsal bir kısa film gibi ele alalım"). Ölçüm, ÖNCE (NVDA, 60 seans,
 * kutu 1036×518 ve telefonda 354×443; `openingTimes(4, true)`):
 *
 *   KALEM   60 seans 1,75 sn'de çiziliyordu: ortalama 34 seans/sn, eğrilik
 *           ağırlığı ve ease-in-out yüzünden tepede 174 seans/sn (telefonda 208).
 *   KAMERA  dalış 2,4 → 3,2 sn'de 1× → 2,49× (telefonda 2,02×), kalem 1,6×
 *           yakınlıkta başlayıp 4,2 → 5,6 sn'de 1×'e geri çekiliyordu: dünya
 *           ekranın önünden kayarken çizgi neredeyse okunmuyordu. "Zoom gibi"
 *           şikâyetinin karşılığı bu.
 *   ÖYKÜ    perdeler biçim değiştirerek bağlanıyordu (fiyat → ortalama → şerit →
 *           terazi), ama fiyat çizgisi II'de ortalamaya DÖNÜŞÜYORDU: okuyucu
 *           fiyatı kaybediyor, tek bir konu yerine dört gösteri izliyordu. IV'teki
 *           terazide kefelere düşen damlalar hiçbir veriye bağlı değildi.
 *
 * ŞİMDİ: tek konu, "bu hisse son 60 seansta nereden nereye geldi". Fiyat çizgisi
 * filmin omurgası ve hiç kaybolmaz; her perde ona tek bir katman ekler:
 *
 *   I   Fiyat ve Mumlar  (0 → 12 sn) Logo damgası, sembol, noktası damla olur;
 *                        damla ilk seansa süzülür ve kalem 60 seansı 5,5 sn'de
 *                        çizer (ortalama 11, tepe 18–20 seans/sn; önce 174–208). Mumlar
 *                        kalemin arkasında doğar; zirve, dip ve en sert gün kalem
 *                        oradan geçerken düşer; sonda son kapanış ve değişim.
 *   II  Göstergeler      (12 → 18 sn) Mumlar ve fiyat geri çekilir; 20 ve 50 günlük
 *                        ortalama aynı sakin hızla çizilir (GERÇEK pencereyle:
 *                        film 60 seansın öncesindeki 50 seansı da alır, ilk
 *                        seansların ortalaması yarım pencere değil). Ortalamalar
 *                        pencerede kesiştiyse son kesişme işaretlenir.
 *   III Haberler         (18 → 28 sn) Grafik üstte ince bir şeride katlanır (filmin
 *                        "yerli hamlesi": çizgi sayfanın başlığı olur), altına son
 *                        üç manşet kart kart yazılır.
 *   IV  Claude Tartıyor  (28 sn → sonuç) Grafik açılır; bir okuma halkası filmin
 *                        gösterdiği gerçekleri bir kez sırayla dolaşır (ilk seans,
 *                        zirve, dip, en sert gün, kesişme, son kapanış), künyeleri
 *                        birer birer geri gelir ve küçük zil gözüyle izler. Tur
 *                        bitince film DURAĞAN bir özet karesinde kalır.
 *   V   Perde            sonuç gelince: durgunluk, çizginin ucundan mavi sel, marka
 *                        karosunda zil çalar, "Rapor Hazır" ve sembollü mühür.
 *
 * NEDEN DÖNGÜ DEĞİL DURAĞAN SON KARE (25 Ekim kararı). Eski IV sonuca kadar
 * dönüyordu (saniyede bir damla, iki saniyede bir dev kelime). CLAUDE.md'nin
 * kuralı "sahne dönmez, bir kez oynar"; tek istisna `LoadingMark`. Analiz 40
 * saniyeyi aşarsa okuyucunun önünde dönen bir gösteri değil, okunabilecek bir
 * özet duruyor: hissenin bütün hikâyesi tek karede. "Sürüyor" bilgisini DOM'daki
 * açık uçlu çip çizgisi (gidip gelen parça) ve "Geçen 00:41" künyesi taşır. Kare
 * duruyorken tuval yeniden çizilmez (`renderFilm` → `idle`; AnalysisFilm) —
 * kaynama da durur ki kare gerçekten aynı olsun: telefonda CPU boşa yanmaz.
 *
 * KAMERA (25 Ekim): yakınlık en fazla 1,05×. Üç yumuşak hareket: açılışta logoya
 * %4'lük itiş, II'de grafiğe %3'lük eğilme, sonuç gelince %4,5'lik durgunluk itişi;
 * yay yok, yakınlık saniyede en fazla %12 değişir (test). Kalem çizerken kamera KIPIRDAMAZ: göz
 * kalemi izler, dünya kaymaz. Ölçü `cameraZoom` (testte tavan ve hız).
 *
 * YÖNLENDİRME (motion-film § 0, sekiz satır):
 *   GOAL    Bekleyen okuyucu hissenin son 60 seansını bir öykü gibi okusun: nereden
 *           nereye, ortalamalar ne diyor, son manşetler ne; sonra Claude'un neye
 *           baktığını görsün.
 *   OUTPUT  Sayfa içi Canvas 2D, kutu 16:8 (telefonda 4:5), DOM altyazı + künye.
 *   TIME    Perdeler ölçü başında (120 BPM, ölçü 2 sn): 0 · 12 · 18 · 28 sn.
 *   LOOK    Sitenin mavi marka dili (aşağıda); mumlar ve değişim yalnız `--up`/`--down`.
 *   MOTION  Kalem ~11 seans/sn (1036 px'lik grafikte uç ortalama 338 px/sn); yazı girişi
 *           ease-out-expo 0,6 sn, çıkışı 0,3 sn; kamera ≤ 1,05×; taşma yalnız tek
 *           küçük öğede (damla, logo damgası, zil, mühür).
 *   SHOTS   Planda tek kahraman: logo → sembol → damla → kalem → ortalamalar →
 *           kartlar → okuma halkası. Geçiş biçim değiştirme (katlanma) ya da sel.
 *   BANNED  hızlı dalış, kalemi izleyen kamera, fiyatın başka bir şeye dönüşmesi,
 *           veriye bağlı olmayan damla/kelime, glow, parçacık süsü, uydurma sayı.
 *   QA      Temas sayfası 390 ve 1280, iki tema; kare süresi; hareketi azaltana son kare.
 *
 * MAVİ MARKA DİLİ (21 Ekim, SAHİBİNİN YÖNÜ; bu bekleme filmleri için "mavi yok",
 * "kâğıt + mürekkep + pirinç" ve "degrade yalnız üç yerde" kurallarını geçersiz
 * kılar): film sitenin kendi kimliğiyle konuşur.
 *
 *   ZEMİN     tuval kendi zeminini boyar: `--premium-surface` üstüne sağ üstten
 *             `--primary-wash`, sol alttan `--primary-tint` radyal derinlik. Zemin
 *             degradesi; nesnelerin etrafında hale/ışıma YOK.
 *   ÇİZGİ     fiyat çizgisi kalın, marka degradeli (açıkta `--mark-gradient`in
 *             mavisi, koyuda `--display-gradient` — karonun gece mavisi ucu koyu
 *             zeminde kayboluyordu), altında `--primary` %20'den saydama inen alan.
 *   SEL       mavi bir DALGA, temanın KENDİ ton ailesinde (açık temada açık):
 *             gövde `--primary-faint` → `--primary-wash`, sırtında marka degradeli
 *             kurdele. İlk sürümde (11 Ekim) sel `--text-strong` ile doluyor, açık
 *             temada sayfanın ortasında koyu bir film açıyordu; sonra pirinç suyu
 *             denendi; 21 Ekim'den beri mavi. Kalan KURAL: sel temanın ailesinde.
 *   DEV YAZI  sembol ve "Rapor Hazır" `--display-gradient`.
 *   KARO      logo yoksa harfli karo, mühür ve perdenin zili MARKA KAROSU.
 *   YÖN       `--up`/`--down` yalnız mumlarda, en sert günde ve değişim künyesinde.
 * Renk sabiti TS'te yok: hepsi token, degradeler CSS dizesinden ayrıştırılır
 * (`filmPalette`, `parseGradients`). Ölçüldü: altyazı en kötü zeminde AA (test).
 *
 * KÜÇÜK ZİL (21 Ekim; motion-film `karakter.md`). Filmin tek karakteri sitenin
 * zili, minicik; V'teki büyük zilin kendisi. 25 Ekim'den beri yalnız IV'te: son
 * kapanışın altındaki taban çizgisinin arkasından başını çıkarır, okuma halkasını
 * gözüyle izler; sonuç gelince başını kaldırır ve selin içinde kaybolur, karoda
 * büyük zil olarak çalar. Boyu ~35–40 px, hareketi ortam düzeyinde.
 *
 * Mürekkep sahnelerinin kuralları (CLAUDE.md, lib/ink/scenes.ts): saf
 * `render(ctx, t)`, tohumlu ve belirli; renk temadan. Taşan eğri (`ease.back`,
 * sönen salınım) yalnız TEK KÜÇÜK öğede. Yazının girişi taşmaz.
 */
import { blot, brush, clamp, damped, ease, noise1, rng, segment, span, splatter, type InkPalette, type Point } from "./engine";
import { ringArcs, spark } from "./scenes";
import { BELL_BODY_PATH, BELL_CLAPPER, BELL_HANGER, BELL_LIP } from "@/components/brand/BellMark";

type Ctx = CanvasRenderingContext2D;
/** CSS degradesinin bir durağı: konum 0–1, renk CSS dizesi (token'dan). */
export type Stop = { at: number; color: string };
/** CSS `linear-gradient` katmanı: açı (CSS derecesi: 0 yukarı, 90 sağ) ve duraklar. */
export type Gradient = { angle: number; stops: Stop[] };
/**
 * Filmin paleti — HEPSİ token'dan (AnalysisFilm → readPalette). `ink` = `--text-strong`,
 * `paper` = sahnenin zemini (`--premium-surface`), `spark` = `--primary`.
 */
export type FilmPalette = InkPalette & {
  up: string; down: string; muted: string; font: string;
  /** Logo karosunun zemini (`--logo-plate`): sitedeki logo karolarıyla aynı, iki temada beyaz. */
  plate: string;
  /** Panel yüzeyi (`--premium-surface`): sahnenin zemini ve III'teki başlık kartları. */
  surface: string;
  /** `--primary`, `--primary-soft`, `--primary-ink` (ince yazıda okunan mavi). */
  primary: string; primarySoft: string; primaryInk: string;
  /** `--primary-wash`, `--primary-tint`, `--primary-faint`: yarı saydam; zeminin derinliği. */
  primaryWash: string; primaryTint: string; primaryFaint: string;
  /** Marka karosu (`--mark-gradient`): katmanlar alttan üste DEĞİL, CSS sırasıyla (ilki üstte, parlaklık). */
  mark: Gradient[];
  /** Karonun üstündeki çizim (`--mark-ink`, beyaz) ve iç kenarı (`--mark-edge`). */
  markInk: string; markEdge: string;
  /** Dev yazının mürekkebi (`--display-gradient`). */
  display: Gradient;
  /** Fiyat çizgisinin degradesi: açık temada marka karosunun mavisi, koyuda dev yazınınki (zeminde kaybolmasın). */
  line: Gradient;
  /** Selin iki tonu, OPAK: üstte `--primary-faint`, altta `--primary-wash` (zemin üstüne; bkz. `composite`). */
  wash: [string, string];
};
/** Filmin kelimeleri; hepsi sözlükten (`aiAnalysis.claude.film`). Biçimleyiciler sitenin (lib/utils). */
export type FilmText = {
  /** Sembol ve şirketin adı: açılışta logonun yanında dev harfle, altında küçük. */
  symbol: string; name: string; locale: string;
  last: string; first: string; high: string; low: string; ma20: string; ma50: string;
  strongest: string; cross: string; ready: string; noNews: string;
  /** Fiyat ("212,21 $") ve işaretli yüzde ("+%8,80"): ekrandaki sayılarla aynı biçim. */
  money: (v: number) => string; percent: (v: number) => string;
};
export type FilmData = {
  /** Çizilen pencere (son `FILM_SESSIONS` seans). */
  opens: number[]; closes: number[]; highs: number[]; lows: number[];
  /** Pencerenin ÖNCESİNDEKİ kapanışlar: yalnız ortalamaların gerçek penceresi için, çizilmez. */
  lead: number[];
  headlines: string[];
  /** Şirket logosu; yüklenmediyse ya da yoksa yerine harfli mürekkep karosu çizilir. */
  logo?: HTMLImageElement | null;
  /**
   * Açılış düğmesinin büzüldüğü damlanın yeri (tuval pikseli). Verilirse film o
   * damlayla açılır: damla bir yay çizerek ortaya uçar ve logonun halkasına
   * sıçrar — sayfadan filme kesmesiz geçiş (match cut).
   */
  origin?: Point | null;
};

/** Filmin çizdiği seans sayısı (son 3 ay). Sayfa bunun üstüne `MA_LEAD` seans daha yükler. */
export const FILM_SESSIONS = 60;
/** Ortalamaların gerçek penceresi için çizilen pencerenin ÖNCESİNDEN alınan seans (50 günlük için). */
export const MA_LEAD = 50;
/** III'te yazılan manşet sayısı: beşi 10 saniyede okunmuyordu (okuma kuralı aşağıda). */
export const FILM_HEADLINES = 3;

/** Vuruş ızgarası: 120 BPM → vuruş 0,5 sn, ölçü 2 sn. Perdeler ölçü başında değişir. */
export const BEAT = 0.5;
/**
 * Perdelerin başladığı an (sn). I uzun: açılış (logo, sembol, damla) ~5 sn, kalem
 * 5,5 sn, son kapanış künyesi okunacak kadar. IV sonuca kadar sürer (duruk özet).
 * Analiz genellikle 20–40 sn; 20 sn'de biten okuyucu I–II'yi ve III'ün başını görür.
 */
export const ACTS = [0, 12, 18, 28] as const;
/** Kalemin 60 seansı çizdiği süre (sn): ~11 seans/sn; göz ucu izleyebiliyor. Eski film 1,75 sn. */
export const PEN_S = 5.5;
/** Ortalamaların kalemi (sn): fiyattan biraz hızlı, çünkü pürüzsüz bir eğri. */
export const MA_PEN_S = 2.5;
/** Grafiğin III'te üst şeride katlandığı süre (perdeye göre başlangıç ve bitiş). */
const FOLD = [0.1, 1.4] as const;
/** III'te ilk manşetin başladığı an (perdeye göre): katlanma bitince. */
export const HEADLINE_AT = 1.5;
/** Manşetler arası (iki vuruş): okuyucu bir öncekinin başını okumuşken yenisi gelir. */
export const HEADLINE_STEP = 2 * BEAT;
/** Manşet kartlarının çekildiği an (IV'ün başına göre, öncesi): grafik açılmadan önce. */
export const CARDS_OUT = -0.25;
/** Bir manşetin daktilo süresi (sn): harf başına 18 ms, en fazla 1 sn. */
export const typeFor = (text: string) => Math.min(1, text.length * 0.018);
/**
 * Yazının asgari bekleme süresi (sn): harf sayısı ÷ 15 + 1,5 (boşluksuz; motion-film
 * SKILL § 0 — Türkçe kelime uzun olduğu için kelime değil harf).
 */
export const holdFor = (text: string) => text.replace(/\s+/g, "").length / 15 + 1.5;
/** IV'te okuma halkasının ilk gerçeğe vardığı an (perdeye göre): grafik açıldıktan sonra. */
export const READ_FROM = 1.8;
/** Halkanın bir gerçekten ötekine geçişi ve orada durması (sn). */
export const READ_MOVE = 0.7;
export const READ_STEP = 1.8;
/** Perde (V) süresi: durgunluk, sel, zil, dev yazı ve mühür. */
export const CURTAIN_S = 3.3;
/** Sonuç gelince sel hemen gelmez: kamera usulca yaklaşır (ink-wash: "stillness before action"). */
const HUSH = 0.35;
/** Kaynama hızı: çizgiler saniyede 12 kez yeniden çizilir (elle çizilmiş animasyon, "on twos"). */
const BOIL_FPS = 12;
/** Kamera yakınlığının tavanı (25 Ekim; önce 2,6×). */
export const ZOOM_MAX = 1.05;
/** Kalemin dönüşlerde yavaşlaması: 2,5'ti, keskin dönüşte kalem duruyor sonra fırlıyordu. */
const TURN_K = 0.3;
/** Kalemin zamanında seans sayısının payı (gerisi yol boyu); bkz. renderFilm → kalem. */
const SEG_EVEN = 0.7;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Önce geri, sonra ileri: hareketten önceki küçük ters hareket (anticipation). Bitişte taşma YOK. */
const backIn = (x: number) => 2.2 * x * x * x - 1.2 * x * x;
/** Yumuşak taşıma (ease-in-out-sine): tepe hızı ortalamanın 1,57 katı; damlanın yolculuğu. */
const inOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

/**
 * Kalemin zaman → yol kesri: SABİT HIZ, uçlarda `EDGE` kesrinde yumuşak kalkış ve
 * iniş (yamuk hız profili). Tepe hızı ortalamanın 1 / (1 − EDGE) katı (= 1,1).
 * Eski film ease-in-out-cubic kullanıyordu: tepe hızı ortalamanın 3 katı.
 */
export function penProgress(k: number, edge = 0.09) {
  const x = clamp(k), v = 1 / (1 - edge);
  if (x < edge) return (v * x * x) / (2 * edge);
  if (x > 1 - edge) { const r = 1 - x; return 1 - (v * r * r) / (2 * edge); }
  return v * (x - edge / 2);
}

/**
 * Geriye dönük gerçek ortalama: `all` = ön pencere + çizilen pencere. Çizilen her
 * seans için son `n` kapanışın ortalaması; yeterli geçmiş yoksa null (çizilmez).
 * Eski film pencere dolmadan "o ana kadarki ortalama"yı çiziyordu: ilk seansların
 * 50 günlüğü aslında 3–4 günlüktü.
 */
export function trailingAverage(all: number[], n: number, drawn: number) {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < all.length; i++) {
    sum += all[i];
    if (i >= n) sum -= all[i - n];
    if (i >= all.length - drawn) out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

/** Filmin anlattığı gerçekler — HEPSİ mumlardan; çizim, künye ve altyazı aynı kaynaktan. */
export type FilmStory = {
  n: number; first: number; last: number; change: number;
  iHi: number; iLo: number; hi: number; lo: number;
  /** En sert gün: kapanıştan kapanışa en büyük mutlak değişim (ilk seansın öncesi ön pencereden). */
  strongest: { i: number; pct: number } | null;
  ma20: (number | null)[]; ma50: (number | null)[];
  /** Pencerede 20 günlüğün 50 günlüğü SON kesişi (`i` kesişmeden sonraki seans). */
  cross: { i: number; up: boolean } | null;
  /** Son kapanış ortalamaların neresinde; ortalama yoksa null. */
  vs20: "above" | "below" | null; vs50: "above" | "below" | null;
};

export function filmStory(data: { opens?: number[]; closes: number[]; highs: number[]; lows: number[]; lead?: number[] }): FilmStory {
  const { closes, highs, lows } = data, lead = data.lead ?? [], n = closes.length;
  const all = [...lead, ...closes];
  const ma20 = trailingAverage(all, 20, n), ma50 = trailingAverage(all, 50, n);
  const hi = Math.max(...highs), lo = Math.min(...lows);
  let strongest: FilmStory["strongest"] = null;
  for (let i = 0; i < n; i++) {
    const prev = i ? closes[i - 1] : lead.at(-1);
    if (prev === undefined || !prev) continue;
    const pct = (closes[i] / prev - 1) * 100;
    if (!strongest || Math.abs(pct) > Math.abs(strongest.pct)) strongest = { i, pct };
  }
  let cross: FilmStory["cross"] = null;
  for (let i = 1; i < n; i++) {
    const a = ma20[i - 1], b = ma50[i - 1], c = ma20[i], d = ma50[i];
    if (a === null || b === null || c === null || d === null) continue;
    if (Math.sign(a - b) !== Math.sign(c - d) && c !== d) cross = { i, up: c > d };
  }
  const last = closes[n - 1];
  const side = (m: number | null | undefined) => m === null || m === undefined ? null : last >= m ? "above" as const : "below" as const;
  return {
    n, first: closes[0], last, change: (last / closes[0] - 1) * 100,
    iHi: highs.indexOf(hi), iLo: lows.indexOf(lo), hi, lo, strongest, ma20, ma50, cross,
    vs20: side(ma20[n - 1]), vs50: side(ma50[n - 1]),
  };
}

/** IV'te okuma halkasının dolaştığı gerçekler (sıra soldan sağa değil, öykünün sırası). */
export type FactKind = "first" | "high" | "low" | "strongest" | "cross" | "last";
export function readingOrder(story: FilmStory, narrow: boolean): FactKind[] {
  const out: FactKind[] = ["first"];
  // Telefonda zirve ve dip künyesi yok (grafik 318 px; künyeler birbirine biniyordu): halka onlara uğramaz.
  if (!narrow) out.push("high", "low");
  if (story.strongest) out.push("strongest");
  if (story.cross) out.push("cross");
  out.push("last");
  return out;
}
/** Okuma turunun bittiği, filmin duruk özete geçtiği an (mutlak sn). */
export const restAt = (facts: number) => ACTS[3] + READ_FROM + (facts - 1) * READ_STEP + READ_MOVE + 0.6;

/**
 * Kameranın yakınlığı (25 Ekim): üç yumuşak itiş, hiçbiri kalem çizerken değil.
 * `open` = açılış anları (`openingTimes`). Tavan `ZOOM_MAX`; test ölçer.
 */
export function cameraZoom(t: number, doneAt: number | null, open: { SYM_OUT: number; PEN_A: number }) {
  // Açılış: logoya %4'lük yavaş itiş; damla ilk seansa giderken bırakılır.
  const o = 0.04 * ease.inOut(span(t, 0, open.SYM_OUT)) * (1 - ease.inOutQuart(span(t, open.SYM_OUT, open.PEN_A)));
  // II: ortalamalar çizilirken grafiğe %3'lük eğilme; katlanmadan önce geri (%5'te sağ uçtaki
  // "20 Günlük" künyesi kadrajın dışına taşıyordu, 1280 ölçümü).
  const lean = 0.03 * ease.inOutQuart(span(t, ACTS[1] + 0.4, ACTS[1] + 3.4)) * (1 - ease.inOutQuart(span(t, ACTS[2] - 1.5, ACTS[2] + 0.4)));
  // Durgunluk: sonuç geldi, sel gelmeden %4,5 yaklaşır, sel ekranı kaplarken bırakır (ease-in-out-sine:
  // perde I–II'nin ortasında da gelebilir, kuartik eğri orada saniyede %13'lük bir sarsıntıydı).
  const hush = doneAt === null ? 0 : 0.045 * inOutSine(span(t - doneAt, 0, HUSH + 0.65)) * (1 - inOutSine(span(t - doneAt, HUSH + 0.55, HUSH + 1.3)));
  return Math.min(ZOOM_MAX, (1 + o) * (1 + lean) * (1 + hush));
}

/** Metni genişliğe sığdırır (sonuna …). */
function fit(ctx: Ctx, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + "…").width <= width) lo = mid; else hi = mid - 1; }
  return text.slice(0, lo).trimEnd() + "…";
}

/** Metni en fazla `max` satıra böler; sığmayan son satır … ile biter. */
function wrap(ctx: Ctx, text: string, width: number, max: number) {
  const words = text.split(/\s+/).filter(Boolean), out: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= width || !line) { line = next; continue; }
    if (out.length === max - 1) { out.push(fit(ctx, `${line} ${words.slice(i).join(" ")}`, width)); return out; }
    out.push(line); line = words[i];
  }
  if (line) out.push(fit(ctx, line, width));
  return out;
}

/* ----------------------------------------------------------------------- */
/* Renk: token'ları üst üste koyup opak tona indirmek                        */
/* ----------------------------------------------------------------------- */

type Rgba = [number, number, number, number];

/** CSS renginin `#rgb`, `#rrggbb(aa)`, `rgb(r g b / a)` ve `rgba(r, g, b, a)` biçimleri; tanımazsa null. */
export function parseColor(css: string): Rgba | null {
  const s = css.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (!fn) return null;
  const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const v = parts.map(x => x.endsWith("%") ? parseFloat(x) / 100 : parseFloat(x));
  if (v.slice(0, 3).some(Number.isNaN)) return null;
  return [v[0], v[1], v[2], parts.length > 3 && !Number.isNaN(v[3]) ? v[3] : 1];
}

/**
 * Paleti token'lardan kurar (21 Ekim, sahibinin mavi yönü). `read` bir CSS özel
 * özelliğinin hesaplanmış değerini verir (AnalysisFilm: getComputedStyle). Degradeler
 * dizeden ayrıştırılır (`parseGradients`); TS'te renk sabiti yok.
 *
 * Fiyat çizgisinin degradesi temaya göre seçilir: açık temada marka karosunun
 * mavisi (#5cc4ff → #0b3f86), koyu temada dev yazınınki (beyazdan gök mavisine) —
 * karonun gece mavisi ucu koyu zeminde kayboluyordu. Tema, `--page-bg`nin
 * parlaklığından okunur (ayrı bir bayrak taşımamak için).
 */
export function filmPalette(read: (name: string) => string, font: string): FilmPalette {
  const surface = read("--premium-surface"), primary = read("--primary");
  const wash = read("--primary-wash"), tint = read("--primary-tint"), faint = read("--primary-faint");
  const mark = parseGradients(read("--mark-gradient"));
  const fallback: Gradient = { angle: 112, stops: [{ at: 0, color: read("--text-strong") }, { at: 1, color: primary }] };
  const displayG = parseGradients(read("--display-gradient"))[0] ?? fallback;
  const dark = luminance(read("--page-bg")) < 0.2;
  return {
    ink: read("--text-strong"), spark: primary, paper: surface, surface,
    // Künyelerin soluk metni `--text-body`: `--text-muted` koyu temada mavi derinlikli
    // zeminde 4,06'ya iniyordu (künyeler sağ üstte, derinliğin en yoğun yerinde).
    up: read("--up"), down: read("--down"), muted: read("--text-body"), plate: read("--logo-plate"), font,
    primary, primarySoft: read("--primary-soft"), primaryInk: read("--primary-ink"),
    primaryWash: wash, primaryTint: tint, primaryFaint: faint,
    mark, markInk: read("--mark-ink"), markEdge: read("--mark-edge"),
    display: displayG,
    line: dark ? displayG : mark.at(-1) ?? displayG,
    // Selin iki tonu: üstte `--primary-faint`, altta (altyazının oturduğu yer) `--primary-wash`.
    wash: [composite(surface, faint), composite(surface, wash)],
  };
}

/** `r g b` + alfa: degrade durağı yarı saydam token'dan türetilirken (alan dolgusu, söndürme). */
export function withAlpha(css: string, alpha: number) {
  const c = parseColor(css);
  return c ? `rgb(${c[0]} ${c[1]} ${c[2]} / ${+(c[3] * alpha).toFixed(3)})` : css;
}

/** Göreli parlaklık (WCAG): tema kararı ve kontrast ölçüsü için. */
export function luminance(css: string) {
  const c = parseColor(css);
  if (!c) return 0;
  const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** Parantez dışındaki virgüllerden böler. */
function splitTop(s: string) {
  const out: string[] = []; let depth = 0, from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++; else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) { out.push(s.slice(from, i).trim()); from = i + 1; }
  }
  out.push(s.slice(from).trim());
  return out.filter(Boolean);
}

/**
 * CSS `linear-gradient(...)` dizesini (virgülle birden çok katman olabilir) katmanlara
 * ayırır. Konumu yazılmamış duraklar eşit aralanır (CSS gibi). Tanınmayan katman atlanır:
 * film degradesiz değil, ilk durağın düz rengiyle çizilir (bkz. `linear`).
 */
export function parseGradients(css: string): Gradient[] {
  const out: Gradient[] = [];
  const re = /linear-gradient\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1, i = m.index + m[0].length;
    const from = i;
    for (; i < css.length && depth > 0; i++) { if (css[i] === "(") depth++; else if (css[i] === ")") depth--; }
    const parts = splitTop(css.slice(from, i - 1));
    let angle = 180;
    const deg = /^(-?[\d.]+)deg$/.exec(parts[0] ?? "");
    if (deg) { angle = parseFloat(deg[1]); parts.shift(); } else if (parts[0]?.startsWith("to ")) {
      const dir: Record<string, number> = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };
      angle = dir[parts.shift()!] ?? 180;
    }
    const raw = parts.map(x => { const q = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(x)!; return { color: q[1].trim(), at: q[2] === undefined ? NaN : parseFloat(q[2]) / 100 }; })
      .filter(x => parseColor(x.color));
    if (raw.length < 2) continue;
    if (Number.isNaN(raw[0].at)) raw[0].at = 0;
    if (Number.isNaN(raw[raw.length - 1].at)) raw[raw.length - 1].at = 1;
    for (let k = 1; k < raw.length - 1; k++) if (Number.isNaN(raw[k].at)) {
      let j = k; while (Number.isNaN(raw[j].at)) j++;
      for (let q = k; q < j; q++) raw[q].at = raw[k - 1].at + ((raw[j].at - raw[k - 1].at) * (q - k + 1)) / (j - k + 1);
    }
    out.push({ angle, stops: raw });
  }
  return out;
}

/**
 * CSS açısıyla kutuya serilen tuval degradesi (CSS'in kuralı: degrade çizgisi kutunun
 * köşelerine değecek uzunlukta). Koordinatlar o anki dönüşümde (dünya ya da ekran).
 */
export function linear(ctx: Ctx, g: Gradient, x: number, y: number, w: number, h: number, alpha = 1) {
  const a = (g.angle * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy), cx = x + w / 2, cy = y + h / 2;
  const grad = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
  for (const st of g.stops) grad.addColorStop(clamp(st.at), alpha === 1 ? st.color : withAlpha(st.color, alpha));
  return grad;
}
/**
 * Motorun fırçası (`brush`, `blot`) rengi yalnız `fillStyle`a verir; tipi `string`.
 * Degradeyi oradan geçirmenin tek yolu bu daraltma — motor dosyası bu filmin değil.
 */
const paint = (g: CanvasGradient | string) => g as unknown as string;

/**
 * Katmanları alttan üste opak bir renge indirir: ilk katman zemin (opak sayılır),
 * gerisi alfasıyla üstüne biner. Selin tonu yarı saydam `--brass-wash`i tuvale
 * doğrudan basamaz: selin içine dünya ikinci kez çizildiği için altındaki çizgi
 * saydam selin içinden görünüp iki kat koyulaşıyordu. Tanınmayan katman atlanır.
 */
export function composite(...layers: string[]) {
  const base = parseColor(layers[0] ?? "");
  if (!base) return layers[0] ?? "";
  let [r, g, b] = base;
  for (const css of layers.slice(1)) {
    const c = parseColor(css);
    if (!c) continue;
    r = r + (c[0] - r) * c[3]; g = g + (c[1] - g) * c[3]; b = b + (c[2] - b) * c[3];
  }
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

/* ----------------------------------------------------------------------- */
/* Dev yazı                                                                  */
/* ----------------------------------------------------------------------- */

const DISPLAY = 850;
const display = (font: string, size: number) => `${DISPLAY} ${size}px ${font}`;

/** Genişliğe ve tavana göre dev yazının puntosu. */
function displaySize(ctx: Ctx, font: string, text: string, width: number, max: number) {
  ctx.font = display(font, 100);
  return Math.min(max, (width / (ctx.measureText(text).width || 1)) * 100);
}

/**
 * Kinetik kelime: harfler satırın maskesi içinden sırayla yükselir, çıkışta
 * aynı yoldan yukarı kaçar. Harf yerleri ön ekin ölçüsünden (kerning korunur).
 * Hızlı harfin arkasında iki soluk kopya: hareket bulanıklığının mürekkepteki
 * karşılığı ("smear"). Giriş `ease.out` — yazı hedefini aşmaz.
 *
 * Maske ascent'i 1,02em: Türkçe büyük harflerin imleri (İ, Ü, Ö, Ş'nin
 * çengeli aşağıda) kesilmesin; descent 0,3em (ğ, ş, ç).
 */
function kinetic(ctx: Ctx, text: string, o: {
  x: number; y: number; size: number; font: string; color: string; t: number;
  inAt: number; outAt?: number; align?: "left" | "center" | "right"; stagger?: number; alpha?: number;
  /** Dev yazının degradesi (`--display-gradient`): kelimenin SON yerine serilir, harfler içinden yükselir. */
  fill?: Gradient;
}) {
  // Giriş 0,6 sn ease-out-expo (yazı açılışı), çıkış 0,3 sn: girişin yarısı (sayilar.md).
  const stagger = o.stagger ?? 0.045, dur = 0.6, outDur = 0.3;
  if (o.t < o.inAt) return;
  const last = (text.length - 1) * stagger;
  if (o.outAt !== undefined && o.t > o.outAt + last + outDur) return;
  ctx.save();
  ctx.font = display(o.font, o.size);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const total = ctx.measureText(text).width;
  const x0 = o.align === "left" ? o.x : o.align === "right" ? o.x - total : o.x - total / 2;
  ctx.beginPath();
  ctx.rect(x0 - o.size * 0.2, o.y - o.size * 1.02, total + o.size * 0.4, o.size * 1.32);
  ctx.clip();
  ctx.fillStyle = o.fill ? linear(ctx, o.fill, x0, o.y - o.size * 0.78, total, o.size * 0.95) : o.color;
  const rise = o.size * 1.05;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") continue;
    const enter = span(o.t, o.inAt + i * stagger, o.inAt + i * stagger + dur);
    const leave = o.outAt === undefined ? 0 : span(o.t, o.outAt + i * stagger, o.outAt + i * stagger + outDur);
    // Çıkışta önce hafifçe aşağı çöker, sonra yukarı kaçar (anticipation): `backIn`.
    const pos = (k: number, l: number) => rise * (1 - ease.outExpo(k)) - rise * backIn(l);
    const dy = pos(enter, leave);
    // Hız: bir sonraki küçük adımdaki konum farkı. Durunca iz yok.
    const dt = 0.03;
    const v = pos(span(o.t + dt, o.inAt + i * stagger, o.inAt + i * stagger + dur), o.outAt === undefined ? 0 : span(o.t + dt, o.outAt + i * stagger, o.outAt + i * stagger + outDur)) - dy;
    const lx = x0 + ctx.measureText(text.slice(0, i)).width;
    const a = (o.alpha ?? 1) * (0.35 + 0.65 * ease.outExpo(enter));
    if (Math.abs(v) > o.size * 0.02) {
      for (const [k, ga] of [[2.2, 0.16], [1.1, 0.3]] as const) { ctx.globalAlpha = a * ga; ctx.fillText(ch, lx, o.y + dy - v * k); }
    }
    ctx.globalAlpha = a;
    ctx.fillText(ch, lx, o.y + dy);
  }
  ctx.restore();
  return { x0, width: total };
}

/**
 * Küçük künye: maskeden yükselen tek satır (Zirve, Dip, 20 Günlük…). Altında
 * kâğıt renginde bir hale: çizgi künyenin içinden geçtiğinde yazı okunur
 * kalır (haritacılığın yol adı tekniği). Selin içinde kâğıt = mürekkep.
 */
function tag(ctx: Ctx, text: string, x: number, y: number, k: number, o: { font: string; color: string; halo: string; size?: number; align?: CanvasTextAlign; alpha?: number }) {
  if (k <= 0) return;
  const size = o.size ?? 12;
  ctx.save();
  ctx.font = `700 ${size}px ${o.font}`;
  ctx.textAlign = o.align ?? "left";
  ctx.beginPath();
  ctx.rect(x - 400, y - size * 1.1, 800, size * 1.45);
  ctx.clip();
  ctx.globalAlpha = (o.alpha ?? 1) * ease.out(k);
  const ty = y + size * 1.1 * (1 - ease.out(k));
  ctx.strokeStyle = o.halo; ctx.lineWidth = 4; ctx.lineJoin = "round";
  ctx.strokeText(text, x, ty);
  ctx.fillStyle = o.color;
  ctx.fillText(text, x, ty);
  ctx.restore();
}

/* ----------------------------------------------------------------------- */
/* Şirket karosu, marka karosu                                               */
/* ----------------------------------------------------------------------- */

/**
 * Marka karosu (BellMark'ın karosu): köşe kenarın üçte biri, `--mark-gradient`
 * katmanları alttan üste (CSS'te ilk katman üstte: parlaklık), içte `--mark-edge`
 * kılı. Gölge YOK: tuvalde gölge bulanıklıktır, ekosistemde yok.
 */
function brandTile(ctx: Ctx, x: number, y: number, s: number, p: FilmPalette) {
  if (s < 4) return;
  ctx.beginPath();
  ctx.roundRect(x - s / 2, y - s / 2, s, s, s / 3);
  for (const layer of p.mark.slice().reverse()) { ctx.fillStyle = linear(ctx, layer, x - s / 2, y - s / 2, s, s); ctx.fill(); }
  if (!p.mark.length) { ctx.fillStyle = p.primary; ctx.fill(); }
  ctx.beginPath();
  ctx.roundRect(x - s / 2 + 0.75, y - s / 2 + 0.75, s - 1.5, s - 1.5, s / 3 - 0.75);
  ctx.strokeStyle = p.markEdge; ctx.lineWidth = 1.5; ctx.stroke();
}

/**
 * Logo karosu: sitenin LogoTile'ı gibi yuvarlatılmış kare, içinde logo.
 * Logo yoksa marka karosu üstünde beyaz iki harf. Karonun etrafındaki halka
 * fırçayla, marka degradesiyle çizilir.
 */
function logoTile(ctx: Ctx, p: FilmPalette, o: { x: number; y: number; size: number; scale: number; alpha: number; logo: HTMLImageElement | null | undefined; symbol: string }) {
  if (o.scale <= 0 || o.alpha <= 0) return;
  const s = o.size * o.scale, r = s * 0.24;
  ctx.save();
  ctx.globalAlpha = o.alpha;
  ctx.beginPath();
  ctx.roundRect(o.x - s / 2, o.y - s / 2, s, s, r);
  const ready = o.logo && o.logo.complete && o.logo.naturalWidth > 0;
  // Yolda olan logo (yavaş ağ) için harf basılmaz: karo boş ve beyaz bekler, logo inince
  // içine oturur. Harfli karo yalnız logosu olmayan ya da yüklenemeyen hissede
  // (`complete` ama genişlik 0). Yoksa damga "NV" basıp sonradan logoya dönüyordu.
  const pending = o.logo && !o.logo.complete;
  // Logolar çoğu şeffaf zeminli ve koyu: karo her temada beyaz, logo içinde nefes payıyla.
  // Logosu olmayan hissede harfli karo marka karosunun dilinde (mavi degrade, beyaz harf).
  if (ready || pending) { ctx.fillStyle = p.plate; ctx.fill(); } else brandTile(ctx, o.x, o.y, s, p);
  if (ready) {
    ctx.clip();
    const img = o.logo!, pad = s * 0.12, box = s - pad * 2;
    const k = Math.min(box / img.naturalWidth, box / img.naturalHeight);
    const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    ctx.drawImage(img, o.x - iw / 2, o.y - ih / 2, iw, ih);
  } else if (!pending) {
    ctx.fillStyle = p.markInk;
    ctx.font = `800 ${s * 0.36}px ${p.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(o.symbol.slice(0, 2), o.x, o.y + s * 0.02);
  }
  ctx.restore();
}

/* ----------------------------------------------------------------------- */
/* Kâğıt, damla, mühür                                                       */
/* ----------------------------------------------------------------------- */

/**
 * Kâğıdın lifleri: DÜNYAYA bağlı (kamerayla birlikte kayar, yaklaşınca
 * büyür) — sahne düz bir renk değil, üstüne çizilen bir kâğıt olur.
 * Tohumdan ve boyuttan; bir kez hesaplanır. Yakında belirgin, uzakta
 * neredeyse yok (lemo-opuscar one-line: "fibres that fade when zoomed out").
 */
const FIBRES = new Map<string, { x: number; y: number; dx: number; dy: number; a: number }[]>();
function fibres(ctx: Ctx, w: number, h: number, color: string, zoom: number, seed: number) {
  const key = `${Math.round(w)}x${Math.round(h)}:${seed}`;
  let list = FIBRES.get(key);
  if (!list) {
    const r = rng(seed);
    list = Array.from({ length: Math.round((w * h) / 1400) }, () => {
      const ang = r() * Math.PI, len = 3 + r() * 9;
      return { x: -w * 0.2 + r() * w * 1.4, y: -h * 0.2 + r() * h * 1.4, dx: Math.cos(ang) * len, dy: Math.sin(ang) * len, a: 0.3 + r() * 0.7 };
    });
    if (FIBRES.size > 8) FIBRES.clear();
    FIBRES.set(key, list);
  }
  // Yaklaşınca belirir ama çizik gibi okunmasın: kalınlık yakınlaşmayla büyümez.
  const k = clamp((zoom - 1) / 1.6) * 0.025 + 0.03;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7 / zoom;
  ctx.lineCap = "round";
  for (const f of list) {
    ctx.globalAlpha = k * f.a;
    ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.dx, f.y + f.dy); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Kalemin durduğu yerde kalan damla: yuvarlak değil, ucu yukarıda karnı
 * aşağı sarkan gözyaşı ("a round blot reads as a mole" — lemo-opuscar).
 * Kenarında koyu bir gelgit çizgisi: mürekkep kururken kenara çekilir.
 */
function teardrop(ctx: Ctx, x: number, y: number, r: number, o: { color: string; alpha?: number; boil?: number; seed: number }) {
  if (r <= 0.2) return;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.color;
  ctx.beginPath();
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Üstte sivrilir (sin^3 ile içeri çekilen yan), altta sarkar.
    const top = Math.max(0, -Math.sin(a));
    const rr = r * (1 + noise1(o.seed + (o.boil ?? 0) * 7919, (i % n) * 0.5) * 0.06);
    const px = x + Math.cos(a) * rr * (1 - top * 0.72);
    const py = y + Math.sin(a) * rr * (a > Math.PI ? 1.55 : 1.12) + r * 0.25;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = (o.alpha ?? 1) * 0.35;
  ctx.lineWidth = Math.max(0.6, r * 0.18);
  ctx.strokeStyle = o.color;
  ctx.stroke();
  ctx.restore();
}

/**
 * Mühür: küçük bir MARKA KAROSU, sembol beyaz (21 Ekim, sahibinin mavi yönü; eskiden
 * pirinç kare, sembol oyuk). Basılırken büyükten oturur, değdiği an yayvanlaşır ve
 * kenarından mavi zerreler sıçrar. Filmin açılışındaki logo damgasıyla kafiye
 * (ANIMATION_GUIDE § 7: "rhyme the ending with the opening").
 */
function seal(ctx: Ctx, p: FilmPalette, x: number, y: number, size: number, k: number, o: { text: string; seed: number }) {
  if (k <= 0) return;
  const land = span(k, 0, 0.42);
  const settle = k - 0.42;
  // Tek küçük öğe: değişte ezilip toparlanır (yaylı taşma burada serbest).
  const scale = land < 1 ? lerp(1.7, 1, ease.in(land)) : 1 + damped(settle, 2.6, 7) * -0.12;
  const squash = land < 1 ? 1 : 1 - damped(settle, 2.6, 7) * 0.18;
  const s = size * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06);
  ctx.scale(1 / squash, squash);
  ctx.globalAlpha = ease.out(span(k, 0, 0.2));
  brandTile(ctx, 0, 0, s, p);
  // Sembol kareye sığsın diye punto genişliğe göre.
  ctx.font = `850 ${s * 0.36}px ${p.font}`;
  const tw = ctx.measureText(o.text).width;
  ctx.font = `850 ${s * 0.36 * Math.min(1, (s * 0.72) / (tw || 1))}px ${p.font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = p.markInk;
  ctx.fillText(o.text, 0, s * 0.03);
  ctx.restore();
  if (settle > 0 && settle < 0.6) splatter(ctx, x + size * 0.5, y + size * 0.5, settle, { seed: o.seed + 5, count: 7, reach: size * 0.5, size: size * 0.035, color: p.primary, fade: 0.3 });
}

/* ----------------------------------------------------------------------- */
/* Zil — BellMark'ın çizimi                                                  */
/* ----------------------------------------------------------------------- */

/**
 * Zilin şekli `components/brand/BellMark.tsx`ten (tek kaynak; `lib/og.tsx` de oradan
 * okur): 256 birimlik kutuda askı, kubbe, ağız çubuğu, tokmak. Askının tepesi (128, 40),
 * ağzın altı y = 185, tokmağın altı 219. Salınım askıdan (128, 44); tokmak 1,35 kat
 * geriden gelir (tek gövde gibi dönse cansız duruyor — scenes.ts'teki zilin dersi).
 */
const HANG = { x: BELL_HANGER.x + BELL_HANGER.width / 2, y: BELL_HANGER.y };
const FOOT_Y = BELL_LIP.y + BELL_LIP.height;
let BODY: Path2D | null = null;
function bellBody() {
  if (!BODY) {
    BODY = new Path2D(BELL_BODY_PATH);
    BODY.roundRect(BELL_HANGER.x, BELL_HANGER.y, BELL_HANGER.width, BELL_HANGER.height, BELL_HANGER.rx);
    BODY.roundRect(BELL_LIP.x, BELL_LIP.y, BELL_LIP.width, BELL_LIP.height, BELL_LIP.rx);
  }
  return BODY;
}

type BellFace = { eyes: number; blink: number; lookX: number; lookY: number; color: string };

/**
 * Zil çizimi. `brand`: gövde marka karosunun degradesi (parlaklık dahil), yüz beyaz —
 * küçük zil. Değilse gövde beyaz (`--mark-ink`), yüz karonun en koyu mavisi — karonun
 * içindeki büyük zil. (x, y) askının tepesi, k birim ölçeği.
 */
function bellGlyph(ctx: Ctx, p: FilmPalette, o: { x: number; y: number; k: number; swing: number; brand: boolean; clapper: number; face: BellFace | null }) {
  ctx.save();
  ctx.translate(o.x, o.y); ctx.scale(o.k, o.k); ctx.translate(-HANG.x, -HANG.y);
  const pivot = { x: HANG.x, y: HANG.y + 4 };
  const swingAt = (r: number) => { ctx.translate(pivot.x, pivot.y); ctx.rotate(r); ctx.translate(-pivot.x, -pivot.y); };
  const deep = p.mark.at(-1)?.stops.at(-1)?.color ?? p.ink;
  if (o.clapper > 0) {
    ctx.save(); swingAt(o.swing * 1.35);
    ctx.beginPath(); ctx.arc(BELL_CLAPPER.cx, BELL_CLAPPER.cy, BELL_CLAPPER.r * ease.back(clamp(o.clapper)), 0, Math.PI * 2);
    ctx.fillStyle = o.brand ? deep : p.markInk; ctx.fill();
    ctx.restore();
  }
  swingAt(o.swing);
  const body = bellBody();
  if (o.brand) {
    for (const layer of p.mark.slice().reverse()) { ctx.fillStyle = linear(ctx, layer, BELL_LIP.x, HANG.y, BELL_LIP.width, FOOT_Y - HANG.y); ctx.fill(body); }
    if (!p.mark.length) { ctx.fillStyle = p.primary; ctx.fill(body); }
    ctx.strokeStyle = p.markEdge; ctx.lineWidth = 1.5 / o.k; ctx.stroke(body);
  } else { ctx.fillStyle = p.markInk; ctx.fill(body); }
  const f = o.face;
  if (f && f.eyes > 0) {
    ctx.fillStyle = f.color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(HANG.x + side * 18 + f.lookX * 7, 104 + f.lookY * 6, 9.5 * ease.back(clamp(f.eyes)), 9.5 * ease.back(clamp(f.eyes)) * Math.max(0.12, 1 - f.blink), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(HANG.x - 11 + f.lookX * 4, 128);
    ctx.quadraticCurveTo(HANG.x + f.lookX * 4, 139, HANG.x + 11 + f.lookX * 4, 128);
    ctx.strokeStyle = f.color; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.stroke();
  }
  ctx.restore();
}

/* ----------------------------------------------------------------------- */
/* Küçük zil                                                                 */
/* ----------------------------------------------------------------------- */

/** Küçük zilin bir anı. (x, y) askının tepesi; bakış -1…1 (sol/sağ, yukarı/aşağı); `squash` > 0 yayvanlaşır. */
type Buddy = {
  x: number; y: number; k: number; swing: number; eyes: number; blink: number;
  lookX: number; lookY: number; clapper: number; squash: number;
  /** Oturan zilin yaslanması (radyan), AYAĞINDAN: `swing` askıdan döner, yerdeki zilde ayak kayıyordu. */
  tilt: number;
  /** Bu y'nin üstü çizilmez: zil şeridin çizgisinin İÇİNDEN sarkar. */
  clipTop?: number;
  /** Bu y'nin altı çizilmez: zil taban çizgisinin ARKASINDAN başını çıkarır (IV, 25 Ekim). */
  clipBottom?: number;
};

/**
 * Küçük zil: BellMark'ın zili, gövdesi marka karosunun degradesiyle (parlaklık dahil),
 * yüzü beyaz. Ezilme ve yaslanma AYAĞINDAN (ağzın altı): yere basan şey ayağından ezilir.
 */
function littleBell(ctx: Ctx, p: FilmPalette, b: Buddy) {
  if (b.k <= 0.005) return;
  const foot = b.y + (FOOT_Y - HANG.y) * b.k;
  ctx.save();
  if (b.clipTop !== undefined) { ctx.beginPath(); ctx.rect(b.x - 200, b.clipTop, 400, 400); ctx.clip(); }
  if (b.clipBottom !== undefined) { ctx.beginPath(); ctx.rect(b.x - 200, b.clipBottom - 400, 400, 400); ctx.clip(); }
  ctx.translate(b.x, foot); ctx.rotate(b.tilt); ctx.scale(1 + b.squash, 1 - b.squash); ctx.translate(-b.x, -foot);
  bellGlyph(ctx, p, { x: b.x, y: b.y, k: b.k, swing: b.swing, brand: true, clapper: b.clapper, face: { eyes: b.eyes, blink: b.blink, lookX: b.lookX, lookY: b.lookY, color: p.markInk } });
  ctx.restore();
}

/** Göz kırpma: verilen anlarda ~0,14 sn kapanıp açılır (0 açık, 1 kapalı). */
/** Damganın değdiği an: kısa sıçrantı penceresi. */
const splatterOK = (d: number) => d > 0.8 && d < 1.4;
const blinkAt = (t: number, times: number[]) => times.reduce((m, at) => Math.max(m, Math.sin(Math.PI * span(t, at, at + 0.14))), 0);

/* ----------------------------------------------------------------------- */
/* Mürekkep seli                                                             */
/* ----------------------------------------------------------------------- */

/**
 * Selin kenarı: yavaşça dalgalanan daire. Dalga açının periyodik
 * fonksiyonu (üç sinüs): değer gürültüsü 0 ile 2π'nin buluştuğu yerde
 * kırık bırakıyordu, küçük selde de çiçek gibi çok yapraklı okunuyordu.
 */
function floodPath(ctx: Ctx, x: number, y: number, r: number, seed: number, t: number) {
  ctx.beginPath();
  const n = 96, jag = Math.min(0.07, 4 / Math.max(r, 1));
  const ph = [noise1(seed, 0.5), noise1(seed, 1.5), noise1(seed, 2.5)].map(v => v * Math.PI);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + jag * (0.55 * Math.sin(3 * a + ph[0] + t * 0.9) + 0.3 * Math.sin(5 * a + ph[1] - t * 0.6) + 0.15 * Math.sin(8 * a + ph[2] + t * 1.3));
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/**
 * Sahnenin zemini (21 Ekim, sahibinin mavi yönü): kâğıt değil, sitenin ışıklı mavi alanı.
 * `--premium-surface` üstüne sağ üstten `--primary-wash`, sol alttan `--primary-tint`
 * radyal derinlik — açık temada beyazdan buz mavisine, koyuda lacivertten maviye. Bu bir
 * ZEMİN degradesi; nesnelerin etrafında hale/ışıma değil (ekosistem yasağı o).
 */
function paintField(ctx: Ctx, p: FilmPalette, w: number, h: number) {
  ctx.fillStyle = p.surface;
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, r, color] of [[w * 0.9, -h * 0.2, Math.hypot(w, h) * 0.8, p.primaryWash], [w * 0.05, h * 1.1, Math.max(w, h) * 0.6, p.primaryTint]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * I. perdenin açılış anları — çizimin tek kaynağı. Açılış damlası (düğmeden gelen)
 * varsa her şey onun inişi kadar kayar. 25 Ekim: her adım yavaşladı (logo kayışı
 * 0,5 → 0,75 sn, sembol noktasıyla 1 sn durur, damla ilk seansa 1,5 sn'de süzülür)
 * ve kalem 1,75 sn yerine `PEN_S` (5,5 sn) çizer.
 */
export function openingTimes(symbolLength: number, hasOrigin: boolean) {
  // Vuruşlar ızgarada: her olay sekizliğe (yarım vuruş: 0,25 sn) oturur.
  const q = (x: number) => Math.round(x / (BEAT / 2)) * (BEAT / 2);
  const O = hasOrigin ? BEAT : 0;
  const SLIDE_A = 1.5 + O, SLIDE_B = 2.25 + O;
  const SYM_IN = 1.75 + O, DOT_AT = q(SYM_IN + symbolLength * 0.06 + 0.4), SYM_OUT = DOT_AT + 2 * BEAT;
  // Kalem son kapanış künyesi okunacak kadar erken biter (II'den bir ölçü önce en geç).
  const PEN_A = SYM_OUT + 3 * BEAT, PEN_B = Math.min(PEN_A + PEN_S, ACTS[1] - 2 * BEAT);
  return { O, SLIDE_A, SLIDE_B, SYM_IN, DOT_AT, SYM_OUT, PEN_A, PEN_B };
}

export type FilmFrame = { t: number; doneAt: number | null };
type Size = { w: number; h: number };

const narrowOf = (size: Size) => size.w < 560;

/** Sahnenin iskeleti: aynı ölçüler hem çizimde hem selin hesabında. */
function layout(size: Size) {
  const { w, h } = size;
  const narrow = narrowOf(size);
  const left = narrow ? 18 : 32, right = w - (narrow ? 18 : 32);
  // Alt pay altyazı + canlı künye + adlı perde çipleri kadar (11 Ekim, ölçüldü: altyazı bloğu
  // alttan 149 px masaüstünde, 150 telefonda); taban çizgisi (`bottom + 10`) bloğun üstünde.
  // Üst pay zirve künyesine ve IV'ün lejantına yer bırakır.
  const top = narrow ? 48 : 60, bottom = h - (narrow ? 180 : 172);
  return { w, h, narrow, left, right, top, bottom, cx: w / 2 };
}

/**
 * Perde seli (V): sonuç gelince durgunluktan sonra çizginin ucundan (ekran
 * koordinatı) yayılır. Sel temanın kendi tonunda (21 Ekim): altyazı rengini
 * çevirmez. 25 Ekim'e dek III'te de bir sel vardı; III artık katlanma.
 */
export function floodOf(frame: FilmFrame, size: Size, from: Point) {
  const { t, doneAt } = frame;
  if (doneAt === null || t - doneAt <= HUSH + 0.05) return null;
  const { w, h } = size;
  const R = Math.max(Math.hypot(from.x, from.y), Math.hypot(w - from.x, from.y), Math.hypot(from.x, h - from.y), Math.hypot(w - from.x, h - from.y)) * 1.06;
  const r = lerp(5, R, ease.in(span(t - doneAt, HUSH + 0.05, HUSH + 0.5)));
  return { ...from, r, R, full: r >= R };
}

/** Veriden türeyen gerçekler bir kez hesaplanır (veri nesnesi değişmedikçe). */
const STORIES = new WeakMap<FilmData, FilmStory>();
const storyOf = (data: FilmData) => { let s = STORIES.get(data); if (!s) { s = filmStory(data); STORIES.set(data, s); } return s; };

export type FilmResult = {
  /** Selin ekranın ne kadarını kapladığı (0–1). */
  flood: number;
  /** Kare DURUK: okuma turu bitti, sonuç bekleniyor. Oynatıcı yeniden çizmeyi bırakabilir. */
  idle: boolean;
};

/* ----------------------------------------------------------------------- */
/* Film                                                                      */
/* ----------------------------------------------------------------------- */

export function renderFilm(ctx: Ctx, frame: FilmFrame, pal: FilmPalette, data: FilmData, text: FilmText, size: Size, seed = 11): FilmResult {
  const { doneAt } = frame;
  const { w, h } = size;
  paintField(ctx, pal, w, h);
  const n = data.closes.length;
  if (n < 2) return { flood: 0, idle: true };
  const L = layout(size);
  const { narrow, left, right, top, bottom, cx } = L;
  const story = storyOf(data);
  const facts = readingOrder(story, narrow);
  const rest = restAt(facts.length);
  // Okuma turu bitince zaman durur: kare (kaynama dahil) birebir aynı kalır.
  const t = doneAt === null ? Math.min(frame.t, rest) : frame.t;
  const idle = doneAt === null && frame.t >= rest;
  const T = openingTimes(text.symbol.length, !!data.origin);
  const { O, SLIDE_A, SLIDE_B, SYM_IN, DOT_AT, SYM_OUT, PEN_A, PEN_B } = T;

  /* ---- Perdelerin ağırlıkları: her katman perdeden perdeye kendi değerine gevşer ---- */
  const toII = ease.inOut(span(t, ACTS[1], ACTS[1] + 0.8));
  const toIII = ease.inOut(span(t, ACTS[2], ACTS[2] + 0.8));
  const toIV = ease.inOut(span(t, ACTS[3] + 0.1, ACTS[3] + 1.3));
  const stage = (a: number, b: number, c: number, d: number) => lerp(lerp(lerp(a, b, toII), c, toIII), d, toIV);
  const curtain = doneAt === null ? 0 : span(t - doneAt, HUSH + 0.1, HUSH + 0.55);
  /** Kaynama karesi: çizgilerin kenarı saniyede 12 kez yeniden çizilir. */
  const bo = Math.floor(t * BOIL_FPS);

  /* ---- Grafiğin geometrisi; III'te üst şeride katlanır (yerli hamle) ---- */
  const fold = ease.inOutQuart(span(t, ACTS[2] + FOLD[0], ACTS[2] + FOLD[1])) * (1 - toIV);
  const band = narrow ? 64 : 92;
  const cBottom = lerp(bottom, top + band, fold);
  const maVals = [...story.ma20, ...story.ma50].filter((v): v is number => v !== null);
  const lo = Math.min(story.lo, ...maVals), hi = Math.max(story.hi, ...maVals);
  const yOf = (v: number) => cBottom - ((v - lo) / (hi - lo || 1)) * (cBottom - top);
  const xOf = (i: number) => left + (i / (n - 1)) * (right - left);
  const price: Point[] = data.closes.map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  const maLine = (vals: (number | null)[]) => vals.flatMap((v, i) => v === null ? [] : [{ x: xOf(i), y: yOf(v) }]);
  const ground = cBottom + 10;

  /* ---- I: şirket — logo, ad, sembol ve noktası ---- */
  const tileMax = narrow ? 64 : 104;
  const symSize = displaySize(ctx, pal.font, text.symbol + ".", (right - left) * 0.8 - tileMax * 1.3, narrow ? 104 : 176);
  const tile = Math.min(tileMax, symSize * 0.82), tileGap = tile * 0.3;
  ctx.font = display(pal.font, symSize);
  const symW = ctx.measureText(text.symbol).width;
  const groupW = tile + tileGap + symW + symSize * 0.26;
  const symY = (top + bottom) / 2 + symSize * 0.3;
  const symX0 = cx - groupW / 2 + tile + tileGap;
  const tileHome = { x: cx - groupW / 2 + tile / 2, y: symY - symSize * 0.36 };
  const dotHome = { x: symX0 + symW + symSize * 0.13, y: symY - symSize * 0.09 };
  const dotR = symSize * 0.085;
  const solo = { x: cx, y: (top + bottom) / 2 - (narrow ? 12 : 18) };

  /* ---- Kalem: zaman eğriliğe göre, basınç hıza göre ----
     Keskin dönüşte kalem biraz yavaşlar (zaman ağırlığı 1 + K·dönüş), basınç
     hızdan (yavaş = kalın). K 2,5'ten 0,3'e indi: kalem dönüşte durup düzlükte
     fırlıyordu. Ölçü (NVDA, 25 Ekim): tepe 18 seans/sn masaüstünde, 20 telefonda
     (önce 174 ve 208); kalemin ucu ortalama 338 px/sn (1036 px'lik grafik). */
  const segLen = price.map((q, i) => i ? Math.hypot(q.x - price[i - 1].x, q.y - price[i - 1].y) : 0);
  const turn = price.map((q, i) => {
    if (!i || i === n - 1) return 0;
    const a1 = Math.atan2(q.y - price[i - 1].y, q.x - price[i - 1].x), a2 = Math.atan2(price[i + 1].y - q.y, price[i + 1].x - q.x);
    return Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
  });
  const cumT: number[] = [0], cumA: number[] = [0];
  // Seansın süresi yarı yarıya seans sayısından ve yolun boyundan: yalnız yol boyu olunca düz
  // günler (telefonda seans başına 5 px) saniyede 73 seansla geçiyordu, dik günler sürünüyordu.
  const meanLen = (segLen.reduce((a, b) => a + b, 0) / (n - 1)) || 1;
  for (let i = 1; i < n; i++) { cumA.push(cumA[i - 1] + segLen[i]); cumT.push(cumT[i - 1] + (SEG_EVEN * meanLen + (1 - SEG_EVEN) * segLen[i]) * (1 + TURN_K * turn[i])); }
  const penAt = (k: number) => {
    const target = clamp(k) * cumT[n - 1];
    let i = 1;
    while (i < n - 1 && cumT[i] < target) i++;
    const f = clamp((target - cumT[i - 1]) / (cumT[i] - cumT[i - 1] || 1));
    return { arc: (cumA[i - 1] + f * segLen[i]) / (cumA[n - 1] || 1), idx: i - 1 + f };
  };
  const pen = span(t, PEN_A, PEN_B);
  const penNow = penAt(penProgress(pen));
  const pressure = turn.map((_, i) => {
    const tv = (turn[Math.max(0, i - 1)] + turn[i] * 2 + turn[Math.min(n - 1, i + 1)]) / 4;
    return 0.75 + 0.6 * Math.exp(-2.2 / (1 + 2.5 * tv));
  });
  const nibOf = (pts: Point[], idx: number) => {
    const i = Math.min(pts.length - 2, Math.floor(idx)), f = idx - i;
    return { x: lerp(pts[i].x, pts[i + 1].x, f), y: lerp(pts[i].y, pts[i + 1].y, f) };
  };
  /** Kalem bir seansa vardığında o seansa ait şey doğar (0 → 1, ~0,15 sn). */
  const bornAt = (i: number) => pen <= 0 ? 0 : clamp((penNow.idx - i + 0.6) / 1.6);

  /* ---- IV: okuma halkası ---- */
  const crossPt = story.cross ? { x: (xOf(story.cross.i - 1) + xOf(story.cross.i)) / 2, y: yOf(((story.ma20[story.cross.i - 1] ?? 0) + (story.ma20[story.cross.i] ?? 0)) / 2) } : null;
  const factPos = (k: FactKind): Point => {
    if (k === "first") return price[0];
    if (k === "high") return { x: xOf(story.iHi), y: yOf(story.hi) };
    if (k === "low") return { x: xOf(story.iLo), y: yOf(story.lo) };
    if (k === "strongest" && story.strongest) return price[story.strongest.i];
    if (k === "cross" && crossPt) return crossPt;
    return price[n - 1];
  };
  const arrive = (k: number) => ACTS[3] + READ_FROM + k * READ_STEP;
  /** Bir gerçeğin künyesi IV'te halka vardığında geri gelir ve kalır. */
  const factShown = (kind: FactKind) => { const k = facts.indexOf(kind); return k < 0 ? 0 : span(t, arrive(k) - 0.15, arrive(k) + 0.35); };
  const markerAt = (tt: number): Point => {
    let k = 0;
    while (k < facts.length - 1 && tt >= arrive(k + 1) - READ_MOVE) k++;
    const from = factPos(facts[Math.max(0, k - 1)]), to = factPos(facts[k]);
    const m = k === 0 ? 1 : ease.inOutQuart(span(tt, arrive(k) - READ_MOVE, arrive(k)));
    return { x: lerp(from.x, to.x, m), y: lerp(from.y, to.y, m) };
  };
  const marker = span(t, arrive(0) - 0.4, arrive(0)) * (1 - curtain);

  /* ---- Kamera: en fazla 1,05×, kalem çizerken kıpırdamaz ---- */
  const tip = pen >= 1 ? price[n - 1] : pen > 0 ? nibOf(price, penNow.idx) : solo;
  const z = cameraZoom(t, doneAt, T);
  const chartMid = { x: cx, y: (top + bottom) / 2 };
  const hushK = doneAt === null ? 0 : inOutSine(span(t - doneAt, 0, HUSH + 0.65));
  const base = t < PEN_A ? solo : chartMid;
  const focus = { x: lerp(base.x, tip.x, hushK), y: lerp(base.y, tip.y, hushK) };

  /* ---- Küçük zil (IV): taban çizgisinin arkasından başını çıkarır, halkayı izler ---- */
  const bs = narrow ? 0.19 : 0.23;
  const buddy: Buddy | null = (() => {
    const PEEK = ACTS[3] + 1.0;
    if (t < PEEK || curtain >= 1) return null;
    // Oturduğu yer: sağ yarıda çizginin en yüksekte geçtiği seans (altında en çok boşluk);
    // son kapanışın künyesine binmesin diye son 8 seans hariç.
    let best = Math.round(n * 0.55), room = -Infinity;
    for (let i = Math.round(n * 0.55); i < n - 8; i++) { const r = ground - price[i].y; if (r > room) { room = r; best = i; } }
    const scale = clamp((room - 10) / ((FOOT_Y - HANG.y) * bs), 0, 1);
    if (scale < 0.6) return null;
    const k = bs * scale, x = xOf(best);
    const seatY = ground - (FOOT_Y - HANG.y) * k;
    const peek = ease.out(span(t, PEEK, PEEK + 0.5));
    const eyeY = seatY + (104 - HANG.y) * k;
    // Bakış: halkanın son 0,2 sn'sinin ortalaması (göz önce gider ama sıçramaz).
    let lookX = 0, lookY = 0;
    for (let s = 0; s < 6; s++) {
      const m = markerAt(t - 0.2 + (s / 5) * 0.2);
      lookX += clamp((m.x - x) / (w * 0.35), -1, 1) / 6; lookY += clamp((m.y - eyeY) / (h * 0.25), -1, 1) / 6;
    }
    const pose: Buddy = { x, y: seatY + (FOOT_Y - HANG.y) * k * (1 - peek), k, swing: 0, eyes: span(t, PEEK + 0.3, PEEK + 0.5), blink: 0,
      lookX, lookY, clapper: 0, squash: 0, tilt: 0.06 * lookX * peek, clipBottom: ground };
    // İki kırpma, tur sürerken; duruk karede kırpma yok.
    pose.blink = blinkAt(t, [arrive(1) + 0.5, arrive(Math.min(3, facts.length - 1)) + 0.45]);
    if (doneAt !== null) {
      // Sonuç geldi: başını kaldırır; sel değince önce bir nefes şişer, sonra büzülüp kaybolur.
      const up = ease.out(span(t - doneAt, 0, 0.25));
      pose.lookY = lerp(pose.lookY, -1, up); pose.blink *= 1 - up;
      const kk = span(t - doneAt, HUSH + 0.15, HUSH + 0.5);
      pose.k = k * (kk < 0.3 ? 1 + 0.1 * ease.out(kk / 0.3) : 1.1 * (1 - ease.in((kk - 0.3) / 0.7)));
    }
    return pose;
  })();

  /* ---- Dünya: her şey; sel için ikinci kez, selin tonunda çizilir ---- */
  const world = (p: FilmPalette) => {
    ctx.save();
    ctx.translate(focus.x, focus.y); ctx.scale(z, z); ctx.translate(-focus.x, -focus.y);
    const brandLayer: Gradient = p.mark.at(-1) ?? { angle: 150, stops: [{ at: 0, color: p.primarySoft }, { at: 1, color: p.primary }] };
    const markRing = (x: number, y: number, r: number) => linear(ctx, brandLayer, x - r, y - r, r * 2, r * 2);
    const lineInk = paint(linear(ctx, { ...p.line, angle: 100 }, left, top, right - left, cBottom - top));
    const live = curtain < 1;
    const fade = 1 - curtain;
    const tagO = { font: p.font, halo: p.paper };
    const al = (x: number): CanvasTextAlign => x < left + 70 ? "left" : x > right - 70 ? "right" : "center";
    const circle = (c: Point, r: number) => { const out: Point[] = []; for (let i = 0; i <= 36; i++) { const a = -Math.PI / 2 + (i / 36) * Math.PI * 2.06; out.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); } return out; };

    fibres(ctx, w, h, p.primary, z, seed + 400);

    // Açılış damlası: düğmenin büzüldüğü yerden bir yayla ortaya uçar, değdiği an sıçrar.
    if (live && data.origin && t < O + 0.6) {
      const k = ease.in(span(t, 0, O));
      const from = data.origin, peak = Math.min(from.y, solo.y) - h * 0.18;
      const at = (q: number) => ({ x: lerp(from.x, solo.x, q), y: (1 - q) * (1 - q) * from.y + 2 * (1 - q) * q * peak + q * q * solo.y });
      if (t < O) {
        const a = at(k), b = at(Math.min(1, k + 0.02));
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
        blot(ctx, 0, 0, lerp(7, 9, k), { seed: seed + 310, color: p.primary, squash: lerp(1, 0.6, k), boil: bo });
        ctx.restore();
      } else splatter(ctx, solo.x, solo.y, t - O, { seed: seed + 311, count: 9, reach: tile * 0.9, size: 2.4, color: p.primary, fade: 0.25 });
    }
    // Logo: halka çizilir, karo damga gibi basılır (tek küçük öğe: hafif taşma serbest),
    // sonra sola, sembolün yanına kayar; çıkışta harflerle birlikte yukarı kaçar.
    if (live && t < SYM_OUT + 1.0) {
      const slide = ease.inOut(span(t, SLIDE_A, SLIDE_B));
      const lean = 8 * Math.sin(Math.PI * span(t, SLIDE_A - 0.25, SLIDE_A + 0.05));
      const tx = lerp(solo.x, tileHome.x, slide) + lean, ty = lerp(solo.y, tileHome.y, slide);
      const leave = ease.in(span(t, SYM_OUT - 0.05, SYM_OUT + 0.45));
      const rr = tile * 0.84, ly = ty - leave * tile * 1.4;
      brush(ctx, circle({ x: tx, y: ly }, rr), { width: narrow ? 3.5 : 4.5, progress: ease.inOut(span(t, 0.05 + O, 0.75 + O)), taper: 0.8, seed: seed + 300, boil: bo, color: paint(markRing(tx, ly, rr)), alpha: (1 - span(t, SLIDE_A, SLIDE_B)) * 0.95 });
      logoTile(ctx, p, { x: tx, y: ly, size: tile, scale: ease.back(span(t, 0.3 + O, 0.75 + O)), alpha: 1 - leave, logo: data.logo, symbol: text.symbol });
      if (text.name) {
        ctx.save();
        const ns = narrow ? 14 : 17;
        ctx.font = `650 ${ns}px ${p.font}`;
        const nm = fit(ctx, text.name, (right - left) * 0.9);
        const typed = span(t, 0.6 + O, 0.6 + O + Math.min(0.7, nm.length * 0.03));
        // Ad kaymaz, iki yerde görünür: halkanın altında söner, grubun altında yeniden yazılır.
        const out = span(t, SLIDE_A - 0.1, SLIDE_A + 0.15), back = span(t, SYM_IN + 0.4, SYM_IN + 0.7);
        ctx.textAlign = "center";
        ctx.fillStyle = p.muted;
        ctx.globalAlpha = ease.out(span(t, 0.55 + O, 0.75 + O)) * (1 - out);
        if (ctx.globalAlpha > 0) ctx.fillText(nm.slice(0, Math.round(nm.length * typed)), cx, solo.y + tile * 0.84 + ns * 1.9);
        ctx.globalAlpha = ease.out(back) * (1 - leave);
        if (ctx.globalAlpha > 0) ctx.fillText(nm.slice(0, Math.round(nm.length * back)), cx, symY + ns * 2.2 - leave * 30);
        ctx.restore();
      }
    }
    if (live && t < SYM_OUT + 1.2) kinetic(ctx, text.symbol, { x: symX0, y: symY, size: symSize, font: p.font, color: p.ink, fill: p.display, t, inAt: SYM_IN, outAt: SYM_OUT, align: "left", stagger: 0.06 });
    if (live && t >= DOT_AT && t < PEN_A + 0.2) {
      // Nokta damla olur: düşer, oturur, sonra yumuşak bir yayla ilk seansa süzülür
      // (kamera yerinde; eskiden kamera damlanın içine 2,5 kat dalıyordu).
      const fall = ease.in(span(t, DOT_AT, DOT_AT + 0.3));
      const land = t - DOT_AT - 0.3;
      const squash = fall < 1 ? 1.5 : 1 - damped(land, 2.2, 5) * 0.45;
      const travel = inOutSine(span(t, SYM_OUT + 0.2, PEN_A));
      const pos = { x: lerp(dotHome.x, price[0].x, travel), y: lerp(lerp(dotHome.y - symSize * 0.9, dotHome.y, fall), price[0].y, travel) - Math.sin(Math.PI * travel) * (narrow ? 36 : 56) };
      const r = lerp(dotR, 4.2, travel);
      blot(ctx, pos.x, pos.y, r, { seed: seed + 2, color: p.primary, squash: clamp(squash, 0.55, 1.6), boil: bo });
      if (land > 0 && land < 0.5) splatter(ctx, pos.x, pos.y + r, land, { seed: seed + 90, count: 6, reach: dotR * 1.4, size: dotR * 0.18, color: p.primary, up: true, fade: 0.2 });
    }

    // Taban çizgisi: kalem başlamadan çekilir, film boyunca kalır (katlanınca şeridin altı).
    const groundA = span(t, PEN_A - 0.6, PEN_A) * 0.3 * fade;
    if (groundA > 0) brush(ctx, segment({ x: left, y: ground }, { x: right, y: ground }, 20), { width: 1, taper: 0, seed: seed + 1, boil: bo, alpha: groundA, color: p.primarySoft });

    // Mumlar: kalem seansa varınca gövdesi ortasından açılır. Yön rengi anlam taşır (yükselen/düşen gün).
    const candleA = stage(0.5, 0.2, 0.16, 0.3) * fade;
    if (candleA > 0.01 && pen > 0) {
      const step = (right - left) / (n - 1), bw = clamp(step * 0.5, 1.4, 9);
      ctx.save();
      for (let i = 0; i < n; i++) {
        const born = bornAt(i);
        if (born <= 0) continue;
        const o = data.opens[i] ?? data.closes[i], c = data.closes[i];
        ctx.fillStyle = c >= o ? p.up : p.down;
        const x = xOf(i), yo = yOf(o), yc = yOf(c), mid = (yo + yc) / 2, g = ease.out(born);
        ctx.globalAlpha = candleA * 0.7 * g;
        const yh = yOf(data.highs[i]), yl = yOf(data.lows[i]);
        ctx.fillRect(x - 0.5, lerp(mid, yh, g), 1, (yl - yh) * g);
        ctx.globalAlpha = candleA * g;
        const hh = Math.max(1, Math.abs(yc - yo)) * g;
        ctx.fillRect(x - bw / 2, mid - hh / 2, bw, hh);
      }
      ctx.restore();
    }

    // Fiyat çizgisi: filmin omurgası, hiç kaybolmaz; II'de ortalamaların arkasına çekilir.
    const priceA = stage(1, 0.45, 0.95, 1) * fade;
    if (priceA > 0.01 && pen > 0) {
      const fillA = priceA * stage(1, 0.4, 0.5, 0.7);
      if (penNow.idx > 0.5) {
        const upto = Math.min(n - 1, penNow.idx), last = Math.floor(upto);
        const pts = price.slice(0, last + 1).concat(upto > last ? [nibOf(price, upto)] : []);
        const ceil = Math.min(...pts.map(q => q.y));
        const area = ctx.createLinearGradient(0, ceil, 0, ground);
        area.addColorStop(0, withAlpha(p.primary, 0.18)); area.addColorStop(1, withAlpha(p.primary, 0));
        ctx.save();
        ctx.globalAlpha = fillA; ctx.fillStyle = area;
        ctx.beginPath(); ctx.moveTo(pts[0].x, ground);
        for (const q of pts) ctx.lineTo(q.x, q.y);
        ctx.lineTo(pts[pts.length - 1].x, ground); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      brush(ctx, price, { width: narrow ? 3.2 : 3.8, progress: penNow.arc, taper: 0.5, wobble: 0.1, seed: seed + 3, boil: bo, pressure, alpha: priceA, color: lineInk });
      if (pen > 0 && pen < 1) {
        // Kalemin ucu: kalemin kendisi değil, kâğıda düşen düz GÖLGESİ ve ucunda mavi bir temas.
        const nib = nibOf(price, penNow.idx);
        const show = span(pen, 0, 0.04) * (1 - span(pen, 0.96, 1));
        ctx.save();
        ctx.globalAlpha = 0.1 * show; ctx.fillStyle = p.primary;
        ctx.beginPath(); ctx.moveTo(nib.x + 3, nib.y + 2); ctx.lineTo(nib.x + 88, nib.y - 52); ctx.lineTo(nib.x + 96, nib.y - 40); ctx.closePath(); ctx.fill();
        ctx.restore();
        blot(ctx, nib.x, nib.y, 4.2, { seed: seed + 4, color: p.primary, spread: 1, boil: bo });
      } else if (pen >= 1) {
        const end = price[n - 1];
        teardrop(ctx, end.x, end.y - 1, 4.8 * ease.out(span(t, PEN_B, PEN_B + 0.5)), { color: p.primary, alpha: priceA, seed: seed + 5, boil: bo });
      }
    }

    /* ---- I'in künyeleri: kalem geçerken düşer, II'de çekilir, IV'te halkayla döner ---- */
    const tagsI = (1 - span(t, ACTS[1] + 1.0, ACTS[1] + 1.6)) * fade;
    const showOf = (kind: FactKind, born: number) => Math.max(born * tagsI, factShown(kind) * fade);
    const end = price[n - 1];
    // Son kapanış bloğu (künye, fiyat, değişim): ucun üstünde; yer yoksa altında.
    const blockAbove = end.y - 62 > top - 10;
    const by = blockAbove ? end.y - 48 : end.y + 24;
    const nearEnd = (i: number) => i >= n - 9;
    {
      const k = span(t, PEN_A - 0.5, PEN_A);
      const p0 = price[0], above = p0.y - 34 > top - 14;
      tag(ctx, `${text.first} ${text.money(story.first)}`, p0.x, above ? p0.y - 12 : p0.y + 24, showOf("first", k), { ...tagO, color: p.muted, align: "left", size: narrow ? 11 : 12 });
    }
    if (!narrow) {
      const showHi = !(nearEnd(story.iHi) && blockAbove) && story.iHi > 6;
      const showLo = !(nearEnd(story.iLo) && !blockAbove) && story.iLo > 6;
      if (showHi) tag(ctx, `${text.high} ${text.money(story.hi)}`, xOf(story.iHi), yOf(story.hi) - 9, showOf("high", bornAt(story.iHi + 2)), { ...tagO, color: p.muted, align: al(xOf(story.iHi)) });
      if (showLo) tag(ctx, `${text.low} ${text.money(story.lo)}`, xOf(story.iLo), yOf(story.lo) + 21, showOf("low", bornAt(story.iLo + 2)), { ...tagO, color: p.muted, align: al(xOf(story.iLo)) });
    }
    if (story.strongest) {
      // En sert gün: o mumun etrafına halka, yanında yüzde (yön renginde).
      const s = story.strongest, c = price[s.i], tone = s.pct >= 0 ? p.up : p.down;
      const k = showOf("strongest", bornAt(s.i + 1.5));
      if (k > 0) {
        const r = narrow ? 9 : 12;
        brush(ctx, circle(c, r), { width: 2, progress: ease.inOut(k), taper: 0.6, seed: seed + 60, boil: bo, color: tone, alpha: Math.min(1, k * 1.4) });
        // Zirve/dip künyesiyle aynı yerdeyse karşı yana geçer.
        let up = s.pct >= 0;
        if (!narrow && up && Math.abs(s.i - story.iHi) < 6) up = false; else if (!narrow && !up && Math.abs(s.i - story.iLo) < 6) up = true;
        if (up && c.y - r - 22 < top - 12) up = false;
        const label = narrow ? text.percent(s.pct) : `${text.strongest} ${text.percent(s.pct)}`;
        tag(ctx, label, c.x, up ? c.y - r - 7 : c.y + r + 17, k, { ...tagO, color: tone, align: al(c.x), size: narrow ? 11 : 12 });
      }
    }
    {
      const k = showOf("last", span(t, PEN_B - 0.1, PEN_B + 0.4));
      const tone = story.change >= 0 ? p.up : p.down;
      tag(ctx, text.last, end.x - 12, by, k, { ...tagO, color: p.muted, size: 11, align: "right" });
      tag(ctx, text.money(story.last), end.x - 12, by + 18, showOf("last", span(t, PEN_B, PEN_B + 0.5)), { ...tagO, color: p.ink, size: narrow ? 14 : 16, align: "right" });
      tag(ctx, text.percent(story.change), end.x - 12, by + 35, showOf("last", span(t, PEN_B + 0.15, PEN_B + 0.65)), { ...tagO, color: tone, size: 12, align: "right" });
    }

    /* ---- II: ortalamalar (gerçek pencere), son kesişme ---- */
    const maA = stage(0, 1, 0.3, 0.7) * fade;
    const ma20 = maLine(story.ma20), ma50 = maLine(story.ma50);
    const MA20_AT = ACTS[1] + 0.6, MA50_AT = ACTS[1] + 1.9;
    if (maA > 0.01) {
      if (ma50.length > 1) brush(ctx, ma50, { width: 2.2, progress: penProgress(span(t, MA50_AT, MA50_AT + MA_PEN_S)), taper: 0.4, seed: seed + 7, boil: bo, alpha: maA, color: p.primarySoft });
      if (ma20.length > 1) brush(ctx, ma20, { width: 2.2, progress: penProgress(span(t, MA20_AT, MA20_AT + MA_PEN_S)), taper: 0.4, seed: seed + 8, boil: bo, alpha: maA, color: p.ink });
    }
    const tagsII = span(t, ACTS[1], ACTS[1] + 0.1) * (1 - span(t, ACTS[2] - 0.5, ACTS[2] - 0.1)) * fade;
    if (tagsII > 0 && ma20.length && ma50.length) {
      const e20 = ma20[ma20.length - 1], e50 = ma50[ma50.length - 1], under = e20.y >= e50.y;
      tag(ctx, text.ma20, e20.x - 14, e20.y + (under ? 22 : -10), span(t, MA20_AT + MA_PEN_S - 0.3, MA20_AT + MA_PEN_S + 0.2), { ...tagO, color: p.ink, align: "right", alpha: tagsII });
      tag(ctx, text.ma50, e50.x - 14, e50.y + (under ? -10 : 22), span(t, MA50_AT + MA_PEN_S - 0.3, MA50_AT + MA_PEN_S + 0.2), { ...tagO, color: p.primaryInk, align: "right", alpha: tagsII });
    }
    if (crossPt) {
      const k = Math.max(span(t, MA50_AT + MA_PEN_S + 0.2, MA50_AT + MA_PEN_S + 0.8) * tagsII, factShown("cross") * fade);
      if (k > 0) {
        const r = narrow ? 8 : 10;
        brush(ctx, circle(crossPt, r), { width: 2, progress: ease.inOut(k), taper: 0.6, seed: seed + 70, boil: bo, color: paint(markRing(crossPt.x, crossPt.y, r)), alpha: Math.min(1, k * 1.4) });
        const up = crossPt.y - r - 22 > top - 12;
        tag(ctx, text.cross, crossPt.x, up ? crossPt.y - r - 7 : crossPt.y + r + 17, k, { ...tagO, color: p.primaryInk, align: al(crossPt.x), size: narrow ? 11 : 12 });
      }
    }

    /* ---- III: manşetler, katlanan grafiğin altında kart kart ----
       Kart en fazla İKİ satır (25 Ekim, 390 ölçümü): tek satırda telefon manşeti ~40
       harfte kesiyordu ("Nvidia CEO'su Jensen Huang: AI ajanları toke…"), anlam gidiyordu. */
    const cardsA = span(t, ACTS[2] + HEADLINE_AT - 0.3, ACTS[2] + HEADLINE_AT) * (1 - ease.in(span(t, ACTS[3] + CARDS_OUT, ACTS[3] + CARDS_OUT + 0.35))) * fade;
    if (cardsA > 0) {
      const fs = narrow ? 12 : 14.5, lh = Math.round(fs * 1.3), pad = narrow ? 6 : 8, gap = narrow ? 6 : 10;
      const y0 = top + band + (narrow ? 14 : 26);
      ctx.save();
      ctx.font = `650 ${fs}px ${p.font}`;
      ctx.textBaseline = "middle";
      const list = data.headlines.slice(0, FILM_HEADLINES);
      if (!list.length) tag(ctx, text.noNews, left, y0 + lh, cardsA, { ...tagO, color: p.muted, size: 13 });
      let by = y0;
      list.forEach((title, k) => {
        const lines = wrap(ctx, title, Math.min(right - left - 40, 560), 2);
        const ch = lines.length * lh + pad * 2;
        const top0 = by;
        by += ch + gap;
        const start = ACTS[2] + HEADLINE_AT + k * HEADLINE_STEP;
        const card = ease.out(span(t, start - 0.2, start + 0.2));
        if (card <= 0) return;
        const bx = left - 12 * (1 - card);
        const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
        ctx.globalAlpha = cardsA * card * 0.96;
        ctx.fillStyle = p.surface;
        ctx.beginPath(); ctx.roundRect(bx, top0, tw + 34, ch, Math.min(ch / 2.6, 12)); ctx.fill();
        ctx.globalAlpha = cardsA * card;
        ctx.fillStyle = paint(linear(ctx, brandLayer, bx, top0, 4, ch));
        ctx.beginPath(); ctx.roundRect(bx + 8, top0 + 6, 3, ch - 12, 1.5); ctx.fill();
        const total = lines.reduce((a, l) => a + l.length, 0);
        const reveal = span(t, start, start + typeFor(lines.join(" ")));
        if (reveal <= 0) return;
        let left0 = Math.round(total * reveal);
        ctx.fillStyle = p.ink;
        lines.forEach((l, r) => {
          const shown = l.slice(0, Math.max(0, left0));
          left0 -= l.length;
          if (!shown) return;
          const ly = top0 + pad + lh * r + lh / 2 + 1;
          ctx.fillText(shown, bx + 20, ly);
          if (reveal < 1 && shown.length < l.length) blot(ctx, bx + 20 + ctx.measureText(shown).width + 5, ly - 1, 3, { seed: seed + 140 + k, color: p.primary, alpha: cardsA });
        });
      });
      ctx.restore();
    }

    /* ---- IV: lejant, okuma halkası, zil ---- */
    const legend = span(t, ACTS[3] + 1.0, ACTS[3] + 1.6) * fade;
    if (legend > 0 && ma20.length && ma50.length) {
      ctx.save();
      ctx.font = `700 ${narrow ? 11 : 12}px ${p.font}`;
      ctx.textBaseline = "middle";
      ctx.globalAlpha = legend;
      let x = left;
      const y = top - (narrow ? 26 : 32);
      for (const [label, color] of [[text.ma20, p.ink], [text.ma50, p.primarySoft]] as const) {
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y - 1.25, 16, 2.5, 1.25); ctx.fill();
        ctx.fillStyle = p.muted; ctx.fillText(label, x + 22, y + 0.5);
        x += 22 + ctx.measureText(label).width + 18;
      }
      ctx.restore();
    }
    if (marker > 0 && live) {
      const m = markerAt(t);
      // Varışta halka bir an büyükten oturur (tek küçük öğe).
      const k = facts.findIndex((_, i) => t < arrive(i) + 0.35 && t >= arrive(i) - 0.05);
      const pulse = k < 0 ? 1 : 1 + 0.35 * (1 - ease.out(span(t, arrive(k), arrive(k) + 0.35)));
      const r = (narrow ? 13 : 16) * pulse;
      ctx.save();
      ctx.globalAlpha = marker * 0.14; ctx.fillStyle = p.primary;
      ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      brush(ctx, circle(m, r), { width: 2.4, taper: 0.3, seed: seed + 80, boil: bo, color: paint(markRing(m.x, m.y, r)), alpha: marker });
    }
    if (buddy) littleBell(ctx, p, buddy);

    // V: perde — durgunluk, sel; selin içinde MARKA KAROSU damga gibi basılır, içindeki
    // beyaz zil çalar (gözleri açılır: küçük zil büyüdü); altında dev yazı ve mühür.
    // Son kare açılışla kafiyeli: açılışta logonun etrafına çekilen marka halkası bu kez
    // karonun etrafına çekilir, logo damgasının yerini sembollü mühür alır.
    if (doneAt !== null) {
      const d = t - doneAt - HUSH;
      const s = narrow ? 0.85 : 1.1;
      const readySize = displaySize(ctx, p.font, text.ready, (right - left) * (narrow ? 0.62 : 0.66), narrow ? 60 : 98);
      const sealSize = readySize * 0.95, gap = readySize * 0.32;
      ctx.font = display(p.font, readySize);
      const readyW = ctx.measureText(text.ready).width;
      const gx = cx - (readyW + gap + sealSize) / 2;
      const rr = 88 * s, TT = rr * 1.24;
      // Alçak sahnede (320 piksel) halka üstten kırpılıyordu: karo en az halkası kadar aşağıda.
      const by = Math.max((top + bottom) / 2 - readySize * 0.6, rr + 12);
      const ty = by + 78 * s + readySize * 0.95;
      brush(ctx, circle({ x: cx, y: by }, rr), { width: narrow ? 3.5 : 4.5, progress: ease.inOut(span(d, 1.0, 1.6)), taper: 0.8, seed: seed + 320, boil: bo, color: paint(markRing(cx, by, rr)) });
      const stamp = span(d, 0.4, 0.8);
      if (stamp > 0) {
        const ring1 = damped(Math.max(0, d - 1.05), 1.6, 2.2);
        ctx.save();
        ctx.translate(cx, by); ctx.rotate(ring1 * 0.05); ctx.scale(ease.back(stamp), ease.back(stamp));
        ctx.globalAlpha = ease.out(span(d, 0.4, 0.55));
        brandTile(ctx, 0, 0, TT, p);
        const k = TT / 278.26;
        bellGlyph(ctx, p, {
          x: 0, y: -TT / 2 + (HANG.y + 15.13) * k, k, swing: ring1 * 0.22, brand: false, clapper: span(d, 0.85, 1.0),
          face: { eyes: span(d, 1.05, 1.3), blink: blinkAt(d, [2.35]), lookX: 0, lookY: 0, color: p.mark.at(-1)?.stops.at(-1)?.color ?? p.ink },
        });
        ctx.restore();
        if (splatterOK(d)) splatter(ctx, cx, by + TT / 2, d - 0.8, { seed: seed + 340, count: 8, reach: TT * 0.5, size: 2.6, color: p.primary, up: true, fade: 0.3 });
      }
      ringArcs(ctx, { ...p, ink: p.primary }, cx, by - TT * 0.08, span(d, 1.1, 1.75), s * 1.35);
      spark(ctx, { ...p, spark: p.primarySoft }, cx + TT * 0.66, by - TT * 0.34, span(d, 1.1, 1.55), s, seed + 80);
      spark(ctx, { ...p, spark: p.primary }, cx - TT * 0.66, by - TT * 0.3, span(d, 1.3, 1.75), s * 0.8, seed + 81);
      kinetic(ctx, text.ready, { x: gx, y: ty, size: readySize, font: p.font, color: p.ink, fill: p.display, t: d, inAt: 1.15, stagger: 0.04, align: "left" });
      seal(ctx, p, gx + readyW + gap + sealSize / 2, ty - readySize * 0.36, sealSize, d - 1.95, { text: text.symbol, seed: seed + 330 });
    }
    ctx.restore();
  };

  // Selin kaynağı çizginin ucu, EKRANDA (kamera o an hafifçe yakın olabilir).
  const flood = floodOf({ t, doneAt }, size, { x: focus.x + (tip.x - focus.x) * z, y: focus.y + (tip.y - focus.y) * z });
  if (!flood?.full) world(pal);
  if (flood) {
    // Selin içinde paletin yalnız kâğıdı (künye halesi) değişir: selin üst tonu.
    const wet: FilmPalette = { ...pal, paper: pal.wash[0] };
    ctx.save();
    floodPath(ctx, flood.x, flood.y, flood.r, seed + 200, t);
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, pal.wash[0]); body.addColorStop(1, pal.wash[1]);
    ctx.fillStyle = body;
    ctx.fill();
    // Dalganın sırtı: marka karosunun degradesiyle kalın bir kurdele, içinde ikinci ince dalga.
    if (!flood.full) {
      const layer = pal.mark.at(-1);
      ctx.strokeStyle = layer ? linear(ctx, layer, flood.x - flood.r, flood.y - flood.r, flood.r * 2, flood.r * 2) : pal.primary;
      ctx.lineWidth = narrow ? 4 : 5.5;
      ctx.stroke();
      const inner = flood.r - (narrow ? 10 : 15);
      if (inner > 8) {
        ctx.save();
        floodPath(ctx, flood.x, flood.y, inner, seed + 201, t + 0.7);
        ctx.strokeStyle = pal.primaryFaint; ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      floodPath(ctx, flood.x, flood.y, flood.r, seed + 200, t);
    }
    ctx.clip();
    world(wet);
    ctx.restore();
  }
  return { flood: flood ? clamp(flood.r / flood.R) : 0, idle };
}
