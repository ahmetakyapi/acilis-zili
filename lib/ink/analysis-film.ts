/**
 * Claude analizi beklerken oynayan mürekkep filmi — TEK ÇİZGİNİN, KESİLMEYEN
 * PLANI.
 *
 * Bekleme 20–30 saniye. İlk sürüm (11 Ekim) beş perdeyi biçim değiştirerek
 * bağlıyordu ama kamera sabit, yazı küçüktü: çizim ekranın ortasında olup
 * bitiyor, göz bir şeye "girmiyordu". Bu sürüm hareket tasarımının üç aracını
 * ekliyor (prompt-motion.com derlemesindeki iyi örneklerin ortak paydası):
 *
 *   KAMERA    sahne bir dünya; yakınlaşır, kalemi izler, geri çekilir.
 *   DEV YAZI  her perdenin bir kelimesi çerçeveyi doldurur; harfler maskenin
 *             içinden sırayla yükselir, hızlıyken arkalarında iz bırakır.
 *   MÜREKKEP  ton geçişi, süs değil: çizginin ucundan dökülen sel ekranı
 *   SELİ      kaplar, haberler mürekkeple onun üstüne yazılır; sonra sel geri
 *             çekilip TEK BİR DAMLAYA döner ve o damla terazinin mili olur. Sel
 *             çizimin altında değil, ÖNÜNDE: aynı dünya ikinci kez, selin
 *             tonunda kâğıtla, selin içine kırpılarak çizilir.
 *
 *             21 Ekim — SEL ARTIK TERS PALET DEĞİL. İlk sürümde sel `--text-strong`
 *             ile doluyor, başlıklar kâğıt rengiyle yazılıyordu: açık temada
 *             sayfanın ortasında koyu temalı bir film, koyu temada bembeyaz bir
 *             ekran (sahibinin itirazı: "light temada dark temalı video serisi
 *             olmasın"). Sel şimdi temanın KENDİ ton ailesinde: `--page-bg` üstüne
 *             `--brass-wash` (açıkta krem, koyuda ılık sepya — kâğıda dökülen
 *             pirinç suyu). Yazı her yerde mürekkep; selin kenarında pirinç bir
 *             gelgit çizgisi (sulu boyanın kururken kenara çektiği pigment)
 *             sınırı okutur. Ölçüldü: altyazının en zayıf metni (`--text-muted`)
 *             sel üstünde açıkta 4,59, koyuda 5,21 — AA tutuyor, altyazının renk
 *             çevirmesine (`data-inverted`) gerek kalmadı. `--premium-surface`
 *             tabanı da denendi: koyuda pirinçle lacivert birbirini söndürüp
 *             düz gri bir ekran veriyordu (#2d2e2d). Aynı gün bu ton da aşağıdaki
 *             mavi yönle değişti; renk değil KURAL kaldı: sel temanın ailesinde.
 *
 * MAVİ MARKA DİLİ (21 Ekim, aynı gün; SAHİBİNİN YÖNÜ, bu bekleme filmleri için
 * "mavi yok", "kâğıt + mürekkep + pirinç" ve "degrade yalnız üç yerde" kurallarını
 * geçersiz kılar): "Light temadaki videoyu çok daha görsel, bizim mavi gradient
 * tema tarzında, siteye uygun bir görsellikle ele al; dark modu da öyle." Kâğıt +
 * pirinç filmi doğru ama sitenin geri kalanından kopuk, "eski bir defter" gibi
 * duruyordu; bekleme filmi sitenin kendi kimliğiyle konuşmalı. Değişen yalnız GÖRÜNÜŞ,
 * kurgu aynı (perdeler, kamera, sel koreografisi, okuma süreleri):
 *
 *   ZEMİN     tuval kendi zeminini boyar: `--premium-surface` üstüne sağ üstten
 *             `--primary-wash`, sol alttan `--primary-tint` radyal derinlik (açıkta
 *             beyazdan buz mavisine, koyuda lacivertten maviye). Zemin degradesi;
 *             nesnelerin etrafında hale/ışıma YOK (o yasak duruyor).
 *   ÇİZGİ     fiyat çizgisi kalın, marka degradeli (açıkta `--mark-gradient`in
 *             mavisi, koyuda `--display-gradient` — karonun gece mavisi ucu koyu
 *             zeminde kayboluyordu), altında `--primary` %20'den saydama inen alan.
 *   SEL       mavi bir DALGA: gövde `--primary-faint` → `--primary-wash` (üstten
 *             alta, ikisi de zemine opak indirilmiş), sırtında marka degradeli
 *             kalın kurdele ve içinde ikinci ince dalga. Açık temada sel AÇIK kalır
 *             (lacivert ekran değil); başlıklar `--text-strong`, sitenin panel
 *             dilinde beyaz kartların içinde, solda mavi künye çubuğu.
 *   DEV YAZI  "NVDA", "Manşetler", dönen kelimeler, "Rapor Hazır" `--display-gradient`.
 *   KARO      logo yoksa harfli karo, mühür ve perdenin zili MARKA KAROSU
 *             (BellMark: degrade + parlaklık + `--mark-edge`, beyaz çizim).
 *   ZİL       küçük zil BellMark'ın çizimi, gövdesi karonun degradesi, yüzü beyaz;
 *             perdede karonun içindeki beyaz zilin gözleri açılır (o büyüdü).
 *   YÖN       `--up`/`--down` yalnız kefelere düşen damlalarda ve künyelerinde.
 * Renk sabiti TS'te yok: hepsi token, degradeler CSS dizesinden ayrıştırılır
 * (`filmPalette`, `parseGradients`). Ölçüldü: altyazı en kötü zeminde AA (test).
 *
 *   I   Fiyat       şirketin logosu marka halkasının (21 Ekim'e dek pirinç) içinde damga gibi
 *                   basılır, adı altına yazılır; logo sola kayar, sembol
 *                   yanında dev harflerle oturur, sonundaki nokta mürekkep
 *                   damlası olur; kamera damlaya girer, damla kalemin ucu olup
 *                   son 60 kapanışı çizer, kamera kalemi izleyip geri çekilir.
 *   II  Göstergeler aynı çizgi 20 günlük ortalamaya gevşer, 50 günlük açık maviyle
 *                   iner, köşede RSI kadranı; çizginin ucundan sel başlar.
 *   III Haberler    selin içinde "Manşetler" kelimesi; çizgi beş şeride
 *                   bölünür, başlıklar mürekkeple daktilo edilir. Son şeridin
 *                   altından küçük ZİL sarkar (filmin seyircisi, aşağıda), daktilonun
 *                   başını gözüyle izler. Sel terazinin miline çekilir.
 *   IV  Tartı       şeritler kola toplanır, zil ipinden bırakıp terazinin
 *                   ayağına zıplar; terazi çizilir, kefelere olumlu ve olumsuz
 *                   damlalar düşer (kefe her damlada hafifçe çöküp toparlanır);
 *                   zil sallanan kolu gözüyle izler. Tepede dev kelimeler döner
 *                   ("Riskler", "Fırsatlar"…). Sonuç gelene kadar sürer.
 *   V   Perde       zil başını mile kaldırır; milden ikinci sel, içinde marka
 *                   karosu damga gibi basılır, içindeki zil çalar; altında dev
 *                   "Rapor Hazır" ve sembollü mühür.
 *
 * KÜÇÜK ZİL (21 Ekim; motion-film `karakter.md`, "neden, sonra tepki"). Kısa
 * filmin tatlı ayrıntısı TEK bir karakter: sitenin zili, minicik. Yeni bir
 * maskot değil — V'teki büyük zilin kendisi; III'te ortaya çıkar, IV'te izler,
 * V'te büyüyüp çalar (açılış/kapanış kafiyesine bir üçüncü ayak). Kurallar:
 * planda ikincil (kahraman başlık ya da terazi), boyu ~35–40 px, hareketi ortam
 * düzeyinde; taşan eğri yalnız onda (tek küçük öğe). Çizimi BellMark'tan (tek
 * kaynak), yüzü burada: beyaz gözler ölçeğe göre iri (çizgi film oranı) —
 * scenes.ts'in `drawBell` gözleri 0,3 ölçekte 1 piksele iniyor, kırpma görünmüyordu.
 * Göz önce gider, beden sonra: bakış 0,25 sn ease-out, kırpma ~0,12 sn.
 *
 * YÖNLENDİRME (12 Ekim; motion-film skill'i § 0, "sıfat değil sayı" — Florence,
 * "Opus 5.5 Motion Lab"). Film bu sekiz satırla yeniden kuruldu:
 *
 *   GOAL    Bekleyen okuyucu, Claude'un hissenin hangi verisini tarttığını
 *           görsün ve beklemenin boş olmadığını hissetsin.
 *   OUTPUT  Sayfa içi Canvas 2D, kutu 16:8 (telefonda 4:5), DOM altyazı + künye.
 *   TIME    120 BPM: vuruş 0,5 sn, ölçü 2 sn. Perdeler ölçü başında: 0 · 6 · 12 ·
 *           22 sn; IV sonuca kadar döner (ölçüde bir dev kelime, iki vuruşta bir damla).
 *   LOOK    Kâğıt + mürekkep + tek vurgu pirinç; yön renkleri yalnız tartının
 *           damlalarında. Tek font (sitenin), dev yazı 850. → 21 Ekim'den beri
 *           sitenin mavi marka dili (yukarıda); yön renkleri kuralı aynı.
 *   MOTION  Yazı girişi ease-out-expo 0,6 sn, çıkışı ease-in 0,3 sn (girişin
 *           yarısı); kamera ease-in-out-quart; taşma yalnız tek küçük öğede
 *           (damla, kadran iğnesi, mühür, zil); harfler arası 1 kare (~30–45 ms).
 *   SHOTS   Her planda tek kahraman: I logo → sembol → damla → kalem; II
 *           ortalamalar → kadran; III "Manşetler" → başlıklar (her biri kelime
 *           başına 0,3 + 0,5 sn okunacak kadar durur); IV terazi → dönen kelime.
 *           Geçiş her zaman biçim değiştirme ya da sel; kesme yok.
 *   BANNED  glow, parçacık süsü, mor degrade (mavi 21 Ekim'de serbest), her şeyin aynı anda girmesi,
 *           okunurken kayan yazı, sayı uydurmak (künye çizimle aynı veriden).
 *   QA      Her perdenin son karesi + soğan kabuğu (yazı girişi) + temas sayfası,
 *           iki tema, 390 ve 1280.
 *
 * Mürekkep sahnelerinin kuralları (CLAUDE.md, lib/ink/scenes.ts): saf
 * `render(ctx, t)`, tohumlu ve belirli; renk temadan (21 Ekim'den beri mavi
 * marka token'ları; yön renkleri yalnız tartının damlalarında, anlam taşıdıkları
 * için). Taşan eğri (`ease.back`, sönen salınım) yalnız TEK KÜÇÜK öğede:
 * damla, kadran iğnesi, zil. Yazının girişi taşmaz. IV. perde sonuç gelene
 * kadar döner: bu bir yükleme göstergesi ("ringing" istisnasıyla aynı
 * gerekçe), sonuç gelince kalkar.
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
/** Filmin kelimeleri; hepsi sözlükten (`aiAnalysis.claude.film`). */
export type FilmText = {
  /** Sembol ve şirketin adı: açılışta logonun yanında dev harfle, altında küçük. */
  symbol: string; name: string; locale: string;
  last: string; high: string; low: string; ma20: string; ma50: string; news: string;
  positive: string; negative: string; ready: string;
  /** IV. perdede dönen dev kelimeler. */
  weighing: string[];
};
export type FilmData = {
  closes: number[]; highs: number[]; lows: number[]; headlines: string[]; rsi: number | null;
  /** Şirket logosu; yüklenmediyse ya da yoksa yerine harfli mürekkep karosu çizilir. */
  logo?: HTMLImageElement | null;
  /**
   * Açılış düğmesinin büzüldüğü damlanın yeri (tuval pikseli). Verilirse film o
   * damlayla açılır: damla bir yay çizerek ortaya uçar ve logonun halkasına
   * sıçrar — sayfadan filme kesmesiz geçiş (match cut).
   */
  origin?: Point | null;
};

/**
 * Perdelerin başladığı an (sn). Süreleri "okumalar" belirliyor (ClaudeAnimationBase,
 * ANIMATION_GUIDE § 4: "fast actions, slow meanings"): her perdenin son okumasından
 * sonra bir nefeslik bekleme var. I damla + logo + sembol + kalem; III en uzun —
 * başlıklar yazıldıktan sonra okunacak kadar dursun. Bekleme 20–40 sn; IV sonuca
 * kadar sürer.
 */
/** Vuruş ızgarası: 120 BPM → vuruş 0,5 sn, ölçü 2 sn. Perdeler ölçü başında değişir. */
export const BEAT = 0.5;
export const ACTS = [0, 6, 12, 22] as const;
/**
 * III'te başlıkların başladığı an (perdeye göre) ve aralarındaki kademe: bir ölçü
 * sonra, birer vuruş arayla. İki vuruş sonraydı ve ilk başlık "Manşetler" kelimesi
 * daha çıkarken yazılıyordu: planda iki kahraman (temas sayfası, 12 Ekim). III bu
 * yüzden 10 sn: beş başlık ~30 kelime, kelime başına 0,3 sn okunur.
 */
export const HEADLINE_AT = 4 * BEAT;
/**
 * 21 Ekim: başlıklar vuruşta değil SEKİZLİKTE (yarım vuruş) iner ve sel 0,25 sn
 * geç çekilir. Okuma kuralı kelimeden harfe geçti (aşağıda); 55 harflik bir
 * başlık vuruş kademesiyle 4 sn kalıyordu, 5,2 sn gerekiyor.
 */
export const HEADLINE_STEP = BEAT / 2;
/** Selin III sonunda mile çekilmeye başladığı an (perdeye göre, IV'ten önce). */
export const FLOOD_OUT = -0.75;
/**
 * Yazının asgari bekleme süresi (sn): harf sayısı ÷ 15 + 1,5 (boşluksuz; motion-film
 * SKILL § 0 — Türkçe kelime uzun olduğu için kelime değil harf). 12 Ekim sürümü
 * kelime başına 0,3 + 0,5 sayıyordu ve uzun Türkçe kelimede kısa kalıyordu.
 */
export const holdFor = (text: string) => text.replace(/\s+/g, "").length / 15 + 1.5;
/** IV'te ilk damlanın düştüğü an (perdeye göre); iniş bir vuruşa oturur (+0,55 düşüş = 3,0). */
const DROP_FROM = 2.45;
/** Perde (V) süresi: durgunluk, sel, zil, dev yazı ve mühür. */
export const CURTAIN_S = 3.3;
/** Sonuç gelince sel hemen gelmez: kol durulur, kamera usulca yaklaşır (ink-wash: "stillness before action"). */
const HUSH = 0.35;
/** Kaynama hızı: çizgiler saniyede 12 kez yeniden çizilir (elle çizilmiş animasyon, "on twos"). */
const BOIL_FPS = 12;
const STRIPS = 5;
/** Kolun salınımı iki ölçü: ortam hareketi yavaş ve hiç durmaz. */
const SWAY_PERIOD = 4;
const SWAY = 0.075;
/** İki vuruşta bir damla. */
const DROP_EVERY = 2 * BEAT;
/** IV'te her dev kelime bir ölçü — "her 1,5–2 saniyede yeni bir fikir", ölçüde değişir. */
const WORD_EVERY = 4 * BEAT;
/** IV'te ilk dev kelimenin geldiği an (perdeye göre): kefeler oturduktan sonra, bir vuruşta. */
const WORD_FROM = 3;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Önce geri, sonra ileri: hareketten önceki küçük ters hareket (anticipation). Bitişte taşma YOK. */
const backIn = (x: number) => 2.2 * x * x * x - 1.2 * x * x;
const mix = (a: Point[], b: Point[], k: number) => a.map((p, i) => ({ x: lerp(p.x, b[i].x, k), y: lerp(p.y, b[i].y, k) }));

/** Pencere dolmadan da tanımlı ortalama: ilk seanslarda o ana kadarki ortalama (biçim dönüşümü kopmasın). */
function movingAverage(values: number[], n: number) {
  let sum = 0;
  return values.map((v, i) => { sum += v; if (i >= n) sum -= values[i - n]; return sum / Math.min(i + 1, n); });
}

/** Metni genişliğe sığdırır (sonuna …). */
function fit(ctx: Ctx, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + "…").width <= width) lo = mid; else hi = mid - 1; }
  return text.slice(0, lo).trimEnd() + "…";
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
const BELL_H = BELL_CLAPPER.cy + BELL_CLAPPER.r - HANG.y;
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
 * I. perdenin anları — çizimin tek kaynağı. Açılış damlası
 * (düğmeden gelen) varsa her şey onun inişi kadar kayar.
 */
export function openingTimes(symbolLength: number, hasOrigin: boolean) {
  // Vuruşlar ızgarada: her olay sekizliğe (çeyrek vuruş değil, yarım vuruş: 0,25 sn) oturur.
  const q = (x: number) => Math.round(x / (BEAT / 2)) * (BEAT / 2);
  const O = hasOrigin ? BEAT : 0;
  const SLIDE_A = 0.75 + O, SLIDE_B = 1.25 + O;
  const SYM_IN = 2 * BEAT + O, DOT_AT = q(SYM_IN + symbolLength * 0.06 + 0.3), SYM_OUT = DOT_AT + BEAT;
  // Kalem 2 vuruş sonra başlar, 4 vuruş sürer; uzun sembolde kısalır: son kapanış künyesi II'den önce okunsun.
  const PEN_A = SYM_OUT + 2 * BEAT, PEN_B = Math.min(PEN_A + 4 * BEAT, ACTS[1] - 1.5 * BEAT);
  return { O, SLIDE_A, SLIDE_B, SYM_IN, DOT_AT, SYM_OUT, PEN_A, PEN_B };
}

export type FilmFrame = { t: number; doneAt: number | null };
type Size = { w: number; h: number };

const narrowOf = (size: Size) => size.w < 560;

/** Sahnenin iskeleti: aynı ölçüler hem çizimde hem selin hesabında. */
function layout(size: Size, n: number) {
  const { w, h } = size;
  const narrow = narrowOf(size);
  const left = narrow ? 18 : 32, right = w - (narrow ? 18 : 32);
  // Alttaki pay altyazının bloğu (numara + başlık + cümle + ilerleme): 1280'de 118 piksel
  // taban çizgisini altyazının içinden geçiriyordu.
  // Üst pay zirve künyesine yer bırakır (eskiden ses düğmesinin altıydı; düğme 12 Ekim'de kalktı).
  // Alt pay altyazı + canlı künye + adlı perde çipleri kadar (11 Ekim, ölçüldü: altyazı bloğu
  // alttan 149 px masaüstünde, 150 telefonda); taban çizgisi (`bottom + 10`) bloğun ~12 px üstünde.
  const top = narrow ? 64 : 66, bottom = h - (narrow ? 180 : 172);
  const cx = w / 2, beamY = top + (bottom - top) * 0.45, half = Math.min(220, (right - left) * 0.36);
  return { w, h, narrow, left, right, top, bottom, cx, beamY, half, n };
}

/**
 * Sel nerede, ne kadar (ekran koordinatı). II sonunda çizginin ucundan
 * yayılır, III sonunda terazinin miline çekilir; perdede milden yeniden.
 * Sel artık temanın kendi tonunda (21 Ekim): altyazı rengini çevirmez, dönüş
 * değeri yalnız ölçü (selin kapladığı pay) olarak kalıyor.
 */
export function floodOf(frame: FilmFrame, size: Size, end: Point | null) {
  const { t, doneAt } = frame;
  const L = layout(size, 2);
  const reach = (x: number, y: number) => Math.max(Math.hypot(x, y), Math.hypot(L.w - x, y), Math.hypot(x, L.h - y), Math.hypot(L.w - x, L.h - y)) * 1.06;
  const pivot = { x: L.cx, y: L.beamY };
  if (doneAt !== null) {
    const R = reach(pivot.x, pivot.y);
    const r = lerp(5, R, ease.in(span(t - doneAt, HUSH + 0.05, HUSH + 0.5)));
    if (t - doneAt > HUSH + 0.05) return { ...pivot, r, R, full: r >= R };
  }
  const from = end ?? { x: L.right, y: (L.top + L.bottom) / 2 };
  const grow = span(t, ACTS[2] - 2 * BEAT, ACTS[2] - BEAT / 2);
  const shrink = span(t, ACTS[3] + FLOOD_OUT, ACTS[3] + 0.2);
  if (grow <= 0 || shrink >= 1) return null;
  if (shrink <= 0) {
    const R = reach(from.x, from.y);
    const r = lerp(4, R, ease.in(grow));
    return { ...from, r, R, full: r >= R };
  }
  // Çekilirken merkez de mile kayar: sel, kenarından değil kendi içine çöker.
  const k = ease.inOut(shrink);
  const c = { x: lerp(from.x, pivot.x, k), y: lerp(from.y, pivot.y, k) };
  const R = reach(c.x, c.y);
  return { ...c, r: lerp(reach(from.x, from.y), 5, k), R, full: k <= 0 };
}

/* ----------------------------------------------------------------------- */
/* Kamera                                                                    */
/* ----------------------------------------------------------------------- */

type Cam = { x: number; y: number; z: number };

/* ----------------------------------------------------------------------- */
/* Film                                                                      */
/* ----------------------------------------------------------------------- */

export function renderFilm(ctx: Ctx, frame: FilmFrame, pal: FilmPalette, data: FilmData, text: FilmText, size: Size, seed = 11) {
  const { t, doneAt } = frame;
  const { w, h } = size;
  paintField(ctx, pal, w, h);
  const n = data.closes.length;
  if (n < 2) return 0;
  const L = layout(size, n);
  const { narrow, left, right, top, bottom, cx, beamY, half } = L;
  const lo = Math.min(...data.lows), hi = Math.max(...data.highs);
  const yOf = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
  const xOf = (i: number) => left + (i / (n - 1)) * (right - left);

  const price: Point[] = data.closes.map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  const ma20: Point[] = movingAverage(data.closes, 20).map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  const ma50: Point[] = movingAverage(data.closes, 50).map((c, i) => ({ x: xOf(i), y: yOf(c) }));
  // III: çizgi beş şeride bölünür — her parça kendi şeridinin yatay hattına.
  const stripGap = (bottom - top) / (STRIPS + 0.4);
  const stripY = (k: number) => top + stripGap * (k + 0.7);
  // Şerit sırası yılan gibi (soldan sağa, sağdan sola): komşu şeritler AYNI yanda
  // buluşur; tek çizgi düz sırayla bölününce şeritler arasında boydan boya çapraz
  // bağlar kalıyordu (1280 ölçümü).
  const stripOf = (i: number) => Math.min(STRIPS - 1, Math.floor((i / n) * STRIPS));
  const strips: Point[] = price.map((_, i) => {
    const k = stripOf(i);
    const local = clamp((i - (k * n) / STRIPS) / (n / STRIPS - 1 || 1));
    const u = k % 2 ? 1 - local : local;
    return { x: lerp(left + 24, right - 24, u), y: stripY(k) };
  });
  // IV: hepsi tek kola toplanır.
  // Sonuç gelince kol durulur: durgunluk (HUSH), sonra sel.
  const sway = doneAt === null ? 1 : 1 - ease.out(span(t - doneAt, 0, HUSH + 0.3));
  const angleAt = (tt: number) => SWAY * Math.sin((2 * Math.PI * (tt - ACTS[3] - 1.6)) / SWAY_PERIOD) * span(tt, ACTS[3] + 1.4, ACTS[3] + 2.4) * sway;
  const angle = angleAt(t);
  const beam: Point[] = price.map((_, i) => {
    const u = i / (n - 1) * 2 - 1;
    return { x: cx + u * half * Math.cos(angle), y: beamY + u * half * Math.sin(angle) };
  });

  // Çizginin o anki biçimi: fiyat → ortalama → şeritler → kol.
  const toMa = ease.inOut(span(t, ACTS[1] + 0.1, ACTS[1] + 1.8));
  const toStrips = ease.inOut(span(t, ACTS[2] + 0.5, ACTS[2] + 1.7));
  const toBeam = ease.inOut(span(t, ACTS[3] + 0.1, ACTS[3] + 1.5));
  let line = mix(price, ma20, toMa);
  line = mix(line, strips, toStrips);
  line = mix(line, beam, toBeam);
  const curtain = doneAt === null ? 0 : span(t - doneAt, HUSH + 0.1, HUSH + 0.55);
  /** Kaynama karesi: çizgilerin kenarı saniyede 12 kez yeniden çizilir. */
  const bo = Math.floor(t * BOIL_FPS);

  /* ---- III: başlık satırları ve daktilonun başı (küçük zilin gözü onu izler) ---- */
  const headFont = `650 ${narrow ? 12.5 : 14.5}px ${pal.font}`;
  ctx.save();
  ctx.font = headFont;
  const headlines = data.headlines.slice(0, STRIPS).map((title, k) => {
    const line = fit(ctx, title, right - left - 48);
    const start = ACTS[2] + HEADLINE_AT + k * HEADLINE_STEP;
    return { line, start, end: start + Math.min(1.0, line.length * 0.018), width: ctx.measureText(line).width };
  });
  ctx.restore();
  /** En son başlayan, hâlâ yazılan satırın başı (yaklaşık: genişlikle orantılı); yoksa null. */
  const headAt = (tt: number): Point | null => {
    for (let k = headlines.length - 1; k >= 0; k--) {
      const r = span(tt, headlines[k].start, headlines[k].end);
      if (r > 0 && r < 1) return { x: left + 24 + headlines[k].width * r, y: stripY(k) - 13 };
    }
    return null;
  };

  /* ---- I: şirket — logo, ad, sembol ve noktası ----
     Önce logo tek başına ortada, etrafına fırçayla halka çekilir; adı altına
     yazılır. Sonra logo sola kayar, sembol harfleri yanında maskeden yükselir,
     noktası düşer. Grup: [logo] [SEMBOL.] — genişliğe birlikte sığdırılır. */
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
  const { O, SLIDE_A, SLIDE_B, SYM_IN, DOT_AT, SYM_OUT, PEN_A, PEN_B } = openingTimes(text.symbol.length, !!data.origin);

  /* ---- Kalem: zaman eğriliğe göre, basınç hıza göre ----
     Kalem her seansa eşit süre ayırmaz: keskin dönüşlerde yavaşlar (zaman ağırlığı
     1 + K·dönüş), düzlükte hızlanır. Basınç hızdan: yavaş = kalın, hızlı = ince
     (lemo-opuscar one-line: 0,66 + 0,8·e^(−v/v0)). Dönüşlerde mürekkep birikir. */
  const segLen = price.map((q, i) => i ? Math.hypot(q.x - price[i - 1].x, q.y - price[i - 1].y) : 0);
  const turn = price.map((q, i) => {
    if (!i || i === n - 1) return 0;
    const a1 = Math.atan2(q.y - price[i - 1].y, q.x - price[i - 1].x), a2 = Math.atan2(price[i + 1].y - q.y, price[i + 1].x - q.x);
    return Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
  });
  const TURN_K = 2.5;
  const cumT: number[] = [0], cumA: number[] = [0];
  for (let i = 1; i < n; i++) { cumA.push(cumA[i - 1] + segLen[i]); cumT.push(cumT[i - 1] + segLen[i] * (1 + TURN_K * turn[i])); }
  /** Kalemin zaman kesrinden (0–1) yay kesri ve nokta sırası (kesirli). */
  const penAt = (k: number) => {
    const target = clamp(k) * cumT[n - 1];
    let i = 1;
    while (i < n - 1 && cumT[i] < target) i++;
    const f = clamp((target - cumT[i - 1]) / (cumT[i] - cumT[i - 1] || 1));
    return { arc: (cumA[i - 1] + f * segLen[i]) / (cumA[n - 1] || 1), idx: i - 1 + f };
  };
  const pen = span(t, PEN_A, PEN_B);
  const penNow = penAt(ease.inOut(pen));
  const pressure = turn.map((_, i) => {
    const tv = (turn[Math.max(0, i - 1)] + turn[i] * 2 + turn[Math.min(n - 1, i + 1)]) / 4;
    return 0.7 + 0.75 * Math.exp(-2.2 / (1 + TURN_K * tv));
  });
  /** Kalemin ucu (kesirli sıradan), kameranın izlediği nokta için. */
  const nibOf = (pts: Point[], idx: number) => {
    const i = Math.min(n - 2, Math.floor(idx)), f = idx - i;
    return { x: lerp(pts[i].x, pts[i + 1].x, f), y: lerp(pts[i].y, pts[i + 1].y, f) };
  };

  /* ---- Kamera ---- */
  const center = { x: w / 2, y: h / 2 };
  const zMax = narrow ? 2.1 : 2.6;
  const cam: Cam = (() => {
    // Damlaya giriş, kalemle birlikte koşu, geri çekiliş.
    // Kamera en yumuşak eğriyi alır (ease-in-out-quart); nesneler daha keskinini.
    const into = ease.inOutQuart(span(t, SYM_OUT - 0.1, SYM_OUT + 0.7));
    const back = ease.inOutQuart(span(t, PEN_A + 0.7, PEN_B + 0.35));
    let z = lerp(1, zMax, into);
    // Damla kalemin başına giderken kamera açılır: 2,6 kat yakınlıkta damla saniyede
    // ~2000 ekran pikseli gidiyor, hiçbir takip yetişmiyor ve kadrajdan çıkıyordu
    // (640 ölçümü). Yarı yakınlıkta yol okunur, kalem oradan başlar.
    z = lerp(z, narrow ? 1.35 : 1.6, ease.inOutQuart(span(t, SYM_OUT + 0.25, PEN_A + 0.1)));
    z = lerp(z, 1, back);
    // Dalıştan önce kamera bir nefes geri çekilir (anticipation), sonra damlaya girer.
    z *= 1 - 0.04 * Math.sin(Math.PI * span(t, SYM_OUT - 0.5, SYM_OUT - 0.05));
    // I'in açılışında kamera ölü durmaz: logoya doğru yavaş bir itiş.
    z *= 1 + 0.035 * ease.inOut(span(t, 0, SYM_OUT)) * (1 - into);
    /** Kalemin ya da damlanın o anki yeri; y'de ortalama: fiyatın günlük titremesi kamerayı sarsmasın. */
    const nibAt = (tt: number) => {
      if (tt < PEN_A) {
        // Damlanın kendi yolu (yayı dahil): kamera kesirli bir yerden değil, gördüğün damladan.
        const tr = ease.inOut(span(tt, SYM_OUT + 0.3, PEN_A));
        return { x: lerp(dotHome.x, price[0].x, tr), y: lerp(dotHome.y, ma20[0].y, tr) - Math.sin(Math.PI * tr) * 40 };
      }
      const at = penAt(ease.inOut(span(tt, PEN_A, PEN_B))).idx;
      return { x: nibOf(price, at).x, y: nibOf(ma20, at).y };
    };
    // Kamera ucu biraz geriden ve biraz önden izler: kalemde −0,45…+0,25 sn ortalaması
    // (lemo-opuscar one-line: "lag and anticipation"). Kilitli takip mekanik duruyordu;
    // +0,4 sn ileri bakış, damla kalemin başına uçarken kamerayı önden kaçırıp damlayı
    // kadrajdan çıkarıyordu (640 ölçümü, 3,4–3,6 sn boş kare).
    let follow = { x: 0, y: 0 };
    // Damla uçarken pencere dar: hızlı nesnede geniş ortalama geride kalıyor.
    const lag = t < PEN_A ? 0.12 : 0.45, lead = t < PEN_A ? 0.08 : 0.25;
    for (let k = 0; k < 8; k++) { const q = nibAt(t - lag + (k / 7) * (lag + lead)); follow = { x: follow.x + q.x / 8, y: follow.y + q.y / 8 }; }
    // Yakınken ekranın dışını göstermesin: merkez, görünür yarı-genişlik kadar içeride.
    const hw = w / 2 / z, hh = h / 2 / z;
    const clampX = (x: number) => clamp(x, Math.min(hw, w / 2), Math.max(w - hw, w / 2));
    const clampY = (y: number) => clamp(y, Math.min(hh, h / 2), Math.max(h - hh, h / 2));
    let x = lerp(center.x, clampX(follow.x), into), y = lerp(center.y, clampY(follow.y), into);
    x = lerp(x, center.x, back); y = lerp(y, center.y, back);
    // II: grafiğin sağına, ortalamaların buluştuğu yere hafif itiş; sel öncesi geri.
    const push = ease.inOutQuart(span(t, ACTS[1] + 0.6, ACTS[1] + 3.2)) * (1 - ease.inOutQuart(span(t, ACTS[2] - 1.3, ACTS[2] - 0.4)));
    z *= 1 + 0.1 * push; x = lerp(x, lerp(center.x, right - (right - left) * 0.3, 0.5), push); y = lerp(y, center.y, push);
    // III: sel içinde yavaş bir süzülme.
    const drift = span(t, ACTS[2], ACTS[3]) * (1 - span(t, ACTS[3] - 1, ACTS[3]));
    z *= 1 + 0.035 * Math.sin(Math.PI * drift);
    // IV: nefes — sabit kadraj ölü durur, sallanan kola eşlik eder.
    const breath = span(t, ACTS[3] + 1.5, ACTS[3] + 3) * (doneAt === null ? 1 : 1 - span(t - doneAt, 0, 0.5));
    z *= 1 + 0.025 * breath * Math.sin((2 * Math.PI * (t - ACTS[3])) / (16 * BEAT));
    // Durgunluk: sonuç geldi, sel gelmeden kamera mile doğru usulca yaklaşır.
    if (doneAt !== null) {
      const hush = ease.inOutQuart(span(t - doneAt, 0, HUSH + 0.45)) * (1 - span(t - doneAt, HUSH + 0.55, HUSH + 1.1));
      z *= 1 + 0.05 * hush; x = lerp(x, cx, hush * 0.5); y = lerp(y, beamY, hush * 0.3);
    }
    return { x, y, z };
  })();

  /* ---- Küçük zil: III'te son şeridin altından sarkar, IV'te terazinin ayağında oturur ----
     Zaman çizelgesi (perdeye göre): III +2,6 sn ipten sarkar ve sallanır; gözü daktilonun
     başında (satır bitince başa dönen göz: okuma sıçraması), yazı bitince seyirciye
     bakar; sel çekilirken mile bakar. IV +0,05'te, şeritler kola dönmeden ipi bırakır (önce ters yöne kısa bir
     savrulma: hazırlık), yayla terazinin ayağına zıplar, ağzı yere değince yayvanlaşıp
     toparlanır; sonra sallanan kolun aşağıdaki kefesini gözüyle izler, her damlada
     başını hafifçe sallar, arada göz kırpar. Sonuç gelince başını mile kaldırır. */
  const buddy: Buddy | null = (() => {
    // Birim ölçeği: BellMark'ın 256'lık kutusundan; zil masaüstünde ~41, telefonda ~34 px boy.
    const bs = narrow ? 0.19 : 0.23;
    const lineY = stripY(STRIPS - 1);
    // (x, y) askının tepesi: zil şeridin çizgisinden sarkar.
    const hang = { x: right - (narrow ? 40 : 64), y: lineY };
    // Telefonda yer yok: kol yarısı ~100 px, zil tabanın yanında "Olumsuz" künyesine
    // değiyordu (390 ölçümü, 24,4 sn). Orada terazinin A ayaklarının ARASINA oturur —
    // ayakların altta ±26 px açıklığına 29 px'lik ağız sığıyor; korunaklı bir köşe.
    const seat = { x: narrow ? cx : cx + 44 + 36, y: bottom - (FOOT_Y - HANG.y) * bs };
    const PEEK = ACTS[2] + HEADLINE_AT + 0.6, LET_GO = ACTS[3] + 0.05, LAND = LET_GO + 0.7;
    if (t < PEEK || curtain >= 1) return null;
    const eyeY = (t < LET_GO ? hang.y : seat.y) + (104 - HANG.y) * bs;
    const toward = (q: Point, from: Point, rx: number, ry: number) => ({ x: clamp((q.x - from.x) / rx, -1, 1), y: clamp((q.y - eyeY) / ry, -1, 1) });
    /** Bakışın hedefi tt anında; asıl bakış bunun son 0,2 sn ortalaması (göz önce gider ama sıçramaz). */
    const target = (tt: number) => {
      if (tt < LET_GO - 0.35) {
        const head = headAt(tt);
        if (head) return toward(head, hang, w * 0.45, h * 0.35);
        if (tt > ACTS[3] + FLOOD_OUT - 0.1) return toward({ x: cx, y: beamY }, hang, w * 0.3, h * 0.3);
        return { x: 0, y: 0 };
      }
      if (tt < LAND) return { x: -1, y: 0.6 };
      // Önce çizilen teraziye, sonra kolun aşağı inen ucuna.
      const watch = span(tt, LAND + 1.0, LAND + 1.6);
      const low = (clamp(angleAt(tt) / SWAY, -1, 1) + 1) / 2;
      return { x: lerp(seat.x > cx ? -1 : 0, lerp(-1, seat.x > cx ? 0.7 : 1, low), watch), y: lerp(-0.5, -0.8, watch) };
    };
    let lookX = 0, lookY = 0;
    for (let k = 0; k < 6; k++) { const q = target(t - 0.2 + (k / 5) * 0.2); lookX += q.x / 6; lookY += q.y / 6; }
    const pose: Buddy = { x: hang.x, y: hang.y, k: bs, swing: 0, eyes: 1, blink: 0, lookX, lookY, clapper: 1, squash: 0, tilt: 0 };
    if (t < LET_GO) {
      // İpten sarkış: yalnız ağız aşağı iner (taşmasız), salınım sonra gelir.
      const peek = ease.out(span(t, PEEK, PEEK + 0.45));
      pose.y = hang.y - BELL_H * bs * (1 - peek);
      if (peek < 1) pose.clipTop = lineY + 0.5;
      pose.swing = damped(t - PEEK - 0.3, 1.0, 1.7) * 0.2 + 0.035 * Math.sin((2 * Math.PI * (t - PEEK)) / (8 * BEAT)) * span(t, PEEK + 1, PEEK + 2)
        - 0.16 * Math.sin(Math.PI * span(t, LET_GO - 0.4, LET_GO));
      pose.eyes = span(t, PEEK + 0.3, PEEK + 0.5);
      pose.blink = blinkAt(t, [PEEK + 1.4, PEEK + 3.9, PEEK + 4.12, ACTS[3] - 1.7]);
    } else if (t < LAND) {
      // Zıplayış: yatayda sabit hız, dikeyde yerçekimi kavisi; havada boyuna uzar, tokmağını toplar.
      const k = span(t, LET_GO, LAND);
      pose.x = lerp(hang.x, seat.x, k);
      pose.y = lerp(hang.y, seat.y, k) - (narrow ? 30 : 42) * 4 * k * (1 - k);
      pose.squash = -0.12 * Math.sin(Math.PI * k);
      pose.swing = -0.2 * Math.sin(Math.PI * k);
      pose.clapper = 1 - span(k, 0.2, 0.6);
    } else {
      pose.x = seat.x; pose.y = seat.y; pose.clapper = 0;
      // İniş: ağız yere değince yayvanlaşır, toparlanır; sonra her damlada (vuruşta) küçük bir baş sallama.
      const step = DROP_EVERY / 2, first = ACTS[3] + DROP_FROM + 0.55;
      const thud = t > first ? first + Math.floor((t - first) / step) * step : Infinity;
      pose.squash = damped(t - LAND, 2.2, 5) * 0.22 + damped(t - thud, 2.4, 8) * 0.045;
      // Baktığı yana gövdesiyle yaslanır, bakışın 0,2 sn gerisinden (göz önce, beden sonra).
      pose.tilt = 0.07 * target(t - 0.2).x * span(t, LAND + 0.4, LAND + 1.2);
      const T0 = LAND + 1.8, every = 3.1, i = Math.floor((t - T0) / every), at = T0 + i * every;
      pose.blink = t > T0 ? blinkAt(t, i % 3 === 1 ? [at, at + 0.22] : [at]) : 0;
    }
    if (doneAt !== null) {
      // Sonuç geldi: başını mile kaldırır; sel değince önce bir nefes şişer, sonra büzülüp kaybolur.
      const up = ease.out(span(t - doneAt, 0, 0.25));
      const spindle = toward({ x: cx, y: beamY }, { x: pose.x, y: eyeY }, w * 0.2, h * 0.2);
      pose.lookX = lerp(pose.lookX, spindle.x, up); pose.lookY = lerp(pose.lookY, -1, up);
      pose.tilt = lerp(pose.tilt, -0.06, up); pose.blink *= 1 - up;
      const k = span(t - doneAt, HUSH + 0.15, HUSH + 0.5);
      pose.k = bs * (k < 0.3 ? 1 + 0.1 * ease.out(k / 0.3) : 1.1 * (1 - ease.in((k - 0.3) / 0.7)));
    }
    return pose;
  })();

  /* ---- Dünya: her şey; sel için ikinci kez, selin tonunda kâğıtla çizilir ---- */
  const world = (p: FilmPalette) => {
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    // Marka karosunun degrade katmanı (parlaklıksız, son katman): halka, kadran, kart çubuğu.
    const brandLayer: Gradient = p.mark.at(-1) ?? { angle: 150, stops: [{ at: 0, color: p.primarySoft }, { at: 1, color: p.primary }] };
    const markRing = (x: number, y: number, r: number) => linear(ctx, brandLayer, x - r, y - r, r * 2, r * 2);
    // Fiyat çizgisi soldan sağa açılır: degrade grafiğin kutusuna, yataya yakın (100°).
    const lineInk = paint(linear(ctx, { ...p.line, angle: 100 }, left, top, right - left, bottom - top));

    // Kâğıdın lifleri dünyaya bağlı: kamera yaklaşınca belirir, kayınca kâğıt da kayar.
    fibres(ctx, w, h, p.primary, cam.z, seed + 400);
    // Perde selinin altında kalan her şey çizilmez (zil ve yazı dışında).
    const live = curtain < 1;
    // Açılış damlası: düğmenin büzüldüğü yerden bir yayla ortaya uçar (hızlandıkça
    // gidiş yönünde uzar), değdiği an yayvanlaşıp sıçrar ve halka oradan çizilir.
    if (live && data.origin && t < O + 0.6) {
      const k = ease.in(span(t, 0, O));
      const from = data.origin, peak = Math.min(from.y, solo.y) - h * 0.18;
      const at = (q: number) => ({ x: lerp(from.x, solo.x, q), y: (1 - q) * (1 - q) * from.y + 2 * (1 - q) * q * peak + q * q * solo.y });
      if (t < O) {
        const a = at(k), b = at(Math.min(1, k + 0.02));
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
        blot(ctx, 0, 0, lerp(7, 9, k), { seed: seed + 310, color: p.primary, squash: lerp(1, 0.6, k), boil: bo });
        ctx.restore();
      } else {
        splatter(ctx, solo.x, solo.y, t - O, { seed: seed + 311, count: 9, reach: tile * 0.9, size: 2.4, color: p.primary, fade: 0.25 });
      }
    }
    // Logo: halka çizilir, karo damga gibi basılır (tek küçük öğe: hafif taşma serbest),
    // sonra sola, sembolün yanına kayar; çıkışta harflerle birlikte yukarı kaçar.
    if (live && t < SYM_OUT + 1.0) {
      const slide = ease.inOut(span(t, SLIDE_A, SLIDE_B));
      // Sola kaymadan önce bir parmak sağa yaslanır (anticipation).
      const lean = 8 * Math.sin(Math.PI * span(t, SLIDE_A - 0.2, SLIDE_A + 0.05));
      const tx = lerp(solo.x, tileHome.x, slide) + lean, ty = lerp(solo.y, tileHome.y, slide);
      const leave = ease.in(span(t, SYM_OUT - 0.05, SYM_OUT + 0.45));
      const ring: Point[] = [];
      const rr = tile * 0.84;
      for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + (i / 40) * Math.PI * 2.08; ring.push({ x: tx + Math.cos(a) * rr, y: ty - leave * tile * 1.4 + Math.sin(a) * rr }); }
      const ringK = span(t, 0.05 + O, 0.6 + O);
      brush(ctx, ring, { width: narrow ? 3.5 : 4.5, progress: ease.inOut(ringK), taper: 0.8, seed: seed + 300, boil: bo, color: paint(markRing(tx, ty - leave * tile * 1.4, rr)), alpha: (1 - span(t, SLIDE_A, SLIDE_B)) * 0.95 });
      logoTile(ctx, p, {
        x: tx, y: ty - leave * tile * 1.4, size: tile, scale: ease.back(span(t, 0.25 + O, 0.62 + O)), alpha: 1 - leave,
        logo: data.logo, symbol: text.symbol,
      });
      // Şirketin adı: tek başınayken logonun altında daktilo, sonra grubun altına iner.
      if (text.name) {
        ctx.save();
        const ns = narrow ? 14 : 17;
        ctx.font = `650 ${ns}px ${p.font}`;
        const nm = fit(ctx, text.name, (right - left) * 0.9);
        const typed = span(t, 0.45 + O, 0.45 + O + Math.min(0.6, nm.length * 0.025));
        // Ad kaymaz, iki yerde görünür: halkanın altında söner, grubun altında yeniden
        // yazılır. Kayarken sembolün harflerinin içinden geçiyordu (1280 ölçümü).
        const out = span(t, SLIDE_A - 0.1, SLIDE_A + 0.15), back = span(t, SYM_IN + 0.35, SYM_IN + 0.6);
        ctx.textAlign = "center";
        ctx.fillStyle = p.muted;
        ctx.globalAlpha = ease.out(span(t, 0.4 + O, 0.6 + O)) * (1 - out);
        if (ctx.globalAlpha > 0) ctx.fillText(nm.slice(0, Math.round(nm.length * typed)), cx, solo.y + tile * 0.84 + ns * 1.9);
        ctx.globalAlpha = ease.out(back) * (1 - leave);
        if (ctx.globalAlpha > 0) ctx.fillText(nm.slice(0, Math.round(nm.length * back)), cx, symY + ns * 2.2 - leave * 30);
        ctx.restore();
      }
    }
    // Sembol: harfler maskeden yükselir, nokta düşer; sonra harfler yukarı kaçar.
    if (live && t < SYM_OUT + 1.2) kinetic(ctx, text.symbol, { x: symX0, y: symY, size: symSize, font: p.font, color: p.ink, fill: p.display, t, inAt: SYM_IN, outAt: SYM_OUT, align: "left", stagger: 0.06 });
    if (live && t >= DOT_AT && t < PEN_A + 0.2) {
      // Damla: düşer (dikey uzar), oturur (yayvanlaşır), toparlanır — taşma yalnız bu tek küçük öğede.
      const fall = ease.in(span(t, DOT_AT, DOT_AT + 0.28));
      const land = t - DOT_AT - 0.28;
      const squash = fall < 1 ? 1.5 : 1 - damped(land, 2.2, 5) * 0.45;
      const travel = ease.inOut(span(t, SYM_OUT + 0.3, PEN_A));
      const pos = { x: lerp(dotHome.x, price[0].x, travel), y: lerp(lerp(dotHome.y - symSize * 0.9, dotHome.y, fall), ma20[0].y, travel) - Math.sin(Math.PI * travel) * 40 };
      const r = lerp(dotR, 3.6, ease.inOut(span(t, SYM_OUT + 0.3, PEN_A)));
      blot(ctx, pos.x, pos.y, r, { seed: seed + 2, color: p.primary, squash: clamp(squash, 0.55, 1.6), boil: bo });
      if (land > 0 && land < 0.5) splatter(ctx, pos.x, pos.y + r, land, { seed: seed + 90, count: 6, reach: dotR * 1.4, size: dotR * 0.18, color: p.primary, up: true, fade: 0.2 });
    }

    // Zemin: silik kurşun kalem taban çizgisi (I–II).
    const groundAlpha = (1 - toStrips) * span(t, PEN_A - 0.2, PEN_A + 0.4) * 0.3;
    if (live && groundAlpha > 0) brush(ctx, segment({ x: left, y: bottom + 10 }, { x: right, y: bottom + 10 }, 20), { width: 1, taper: 0, seed: seed + 1, boil: bo, alpha: groundAlpha, color: p.primarySoft });

    // I: tepe-dip çentikleri, kalem geçtikçe.
    const tickAlpha = (1 - toMa) * 0.32;
    if (live && tickAlpha > 0 && pen > 0) for (let i = 0; i < n; i++) {
      // Çentik, kalem o seansa vardığında düşer (kalemin eğrilik ağırlıklı zamanıyla).
      const born = clamp((penNow.idx - i + 1) / 2.5);
      if (born <= 0) continue;
      brush(ctx, segment({ x: xOf(i), y: yOf(data.highs[i]) }, { x: xOf(i), y: yOf(data.lows[i]) }, 4), {
        width: 1.6, progress: ease.out(born), taper: 0.4, seed: seed + 100 + i, boil: bo, alpha: tickAlpha, color: p.primarySoft,
      });
    }
    // I sonu: zirve ve dip künyeleri, son kapanış.
    const marks = (1 - toMa);
    if (live && marks > 0 && t > PEN_B - 0.6) {
      const fmt = (v: number) => v.toLocaleString(text.locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
      const iHi = data.highs.indexOf(hi), iLo = data.lows.indexOf(lo);
      const al = (x: number): CanvasTextAlign => x < left + 60 ? "left" : x > right - 60 ? "right" : "center";
      tag(ctx, `${text.high} ${fmt(hi)}`, xOf(iHi), yOf(hi) - 8, span(t, PEN_B - 0.5, PEN_B), { font: p.font, halo: p.paper, color: p.muted, align: al(xOf(iHi)), alpha: marks });
      tag(ctx, `${text.low} ${fmt(lo)}`, xOf(iLo), yOf(lo) + 20, span(t, PEN_B - 0.3, PEN_B + 0.2), { font: p.font, halo: p.paper, color: p.muted, align: al(xOf(iLo)), alpha: marks });
      const end = price[n - 1];
      // Zirve son seanslardaysa künyesi ucun üstünde: son kapanış alta iner (640 ölçümünde üst üste biniyordu).
      const below = iHi >= n - 12;
      const ly = below ? end.y + 36 : end.y - 10;
      tag(ctx, text.last, end.x - 12, ly - 16, span(t, PEN_B, PEN_B + 0.4), { font: p.font, halo: p.paper, color: p.muted, size: 11, align: "right", alpha: marks });
      tag(ctx, fmt(data.closes[n - 1]), end.x - 12, ly, span(t, PEN_B + 0.1, PEN_B + 0.5), { font: p.font, halo: p.paper, color: p.ink, size: 15, align: "right", alpha: marks });
    }

    // II: 50 günlük ortalama açık maviyle (21 Ekim'e dek pirinç), künyeler, RSI kadranı. Dev kelime gelmeden çekilirler.
    const fadeII = 1 - span(t, ACTS[2] - 0.7, ACTS[2] - 0.15);
    const brassK = span(t, ACTS[1] + 1.4, ACTS[1] + 3.2);
    if (live && brassK > 0 && fadeII > 0) brush(ctx, ma50, { width: 2.4, progress: ease.inOut(brassK), taper: 0.6, seed: seed + 7, alpha: fadeII * 0.85, color: p.primarySoft });
    if (live && fadeII > 0) {
      const a = fadeII;
      tag(ctx, text.ma20, ma20[n - 1].x, ma20[n - 1].y + (ma20[n - 1].y >= ma50[n - 1].y ? 22 : -10), span(t, ACTS[1] + 1.2, ACTS[1] + 1.7), { font: p.font, halo: p.paper, color: p.ink, align: "right", alpha: a });
      tag(ctx, text.ma50, ma50[n - 1].x, ma50[n - 1].y + (ma20[n - 1].y >= ma50[n - 1].y ? -10 : 22), span(t, ACTS[1] + 2.9, ACTS[1] + 3.4), { font: p.font, halo: p.paper, color: p.primaryInk, align: "right", alpha: a });
    }
    const dial = span(t, ACTS[1] + 2.2, ACTS[1] + 3.4) * fadeII;
    if (live && dial > 0 && data.rsi !== null) {
      // Kadran sağda, ortalamaların ucunun KARŞI yarısında: uçtaki künyelerle çakışmasın.
      const r = narrow ? 26 : 32, dx = right - r - 4, dy = ma20[n - 1].y < (top + bottom) / 2 ? bottom - 16 : top + r - 6;
      const arc: Point[] = [];
      for (let i = 0; i <= 24; i++) { const ang = Math.PI + (i / 24) * Math.PI; arc.push({ x: dx + Math.cos(ang) * r, y: dy + Math.sin(ang) * r }); }
      brush(ctx, arc, { width: 3, progress: ease.out(dial), taper: 0.5, seed: seed + 9, alpha: fadeII, color: paint(markRing(dx, dy, r)) });
      const settle = span(t, ACTS[1] + 2.8, ACTS[1] + 4.4);
      const needle = Math.PI + (data.rsi / 100) * Math.PI * ease.out(settle) + damped(settle * 1.6, 1.2, 3) * 0.25;
      brush(ctx, segment({ x: dx, y: dy }, { x: dx + Math.cos(needle) * (r - 6), y: dy + Math.sin(needle) * (r - 6) }, 6), {
        width: 2.4, progress: ease.out(span(t, ACTS[1] + 2.6, ACTS[1] + 3)), taper: 0.3, seed: seed + 10, alpha: fadeII, color: p.ink,
      });
      blot(ctx, dx, dy, 3.4, { seed: seed + 11, spread: dial, color: p.primary, alpha: fadeII });
      tag(ctx, `RSI ${Math.round(data.rsi)}`, dx, dy + 18, span(t, ACTS[1] + 3.4, ACTS[1] + 3.9), { font: p.font, halo: p.paper, color: p.muted, size: 11, align: "center", alpha: fadeII });
    }

    // Ana çizgi (I–IV).
    // Dev "Manşetler" kelimesi ekrandayken çizgi gölgeye çekilir, şeritler otururken geri gelir.
    const dip = span(t, ACTS[2] - 0.6, ACTS[2] - 0.1) - span(t, ACTS[2] + 1.1, ACTS[2] + 1.7);
    const lineAlpha = (1 - curtain) * (1 - dip);
    if (lineAlpha > 0.01 && pen > 0) {
      // III'ten itibaren şeritler AYRI fırça darbeleri: aradaki dönüş yolu soluyor.
      // Parçalar uçlarda birer nokta paylaşıyor; I–II'de tek çizgi gibi okunur.
      const splitK = toStrips * (1 - toBeam);
      if (splitK <= 0) {
        // Çizginin altı: yukarıda `--primary` %18'den aşağıda saydama inen alan; kalemle birlikte
        // dolar, ortalamaya gevşerken çizgiyle aynı biçimi alır, şeritlere bölünürken söner.
        const fillA = lineAlpha * (1 - toStrips) * (1 - toMa * 0.35);
        if (fillA > 0.01 && penNow.idx > 0.5) {
          const upto = Math.min(n - 1, penNow.idx), last = Math.floor(upto);
          const pts = line.slice(0, last + 1).concat(upto > last ? [nibOf(line, upto)] : []);
          const floor = bottom + 10, ceil = Math.min(...pts.map(q => q.y));
          const area = ctx.createLinearGradient(0, ceil, 0, floor);
          area.addColorStop(0, withAlpha(p.primary, 0.2)); area.addColorStop(1, withAlpha(p.primary, 0));
          ctx.save();
          ctx.globalAlpha = fillA;
          ctx.fillStyle = area;
          ctx.beginPath(); ctx.moveTo(pts[0].x, floor);
          for (const q of pts) ctx.lineTo(q.x, q.y);
          ctx.lineTo(pts[pts.length - 1].x, floor); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        // Basınç I'de kalemin hızından; ortalamaya gevşerken düzleşir (ortalama "hesaplanır", çizilmez).
        const pr = toMa >= 1 ? undefined : pressure.map(v => lerp(v, 1, toMa));
        brush(ctx, line, { width: lerp(3.8, 4.4, toBeam), progress: penNow.arc, taper: 0.7, wobble: 0.12, seed: seed + 3, boil: bo, pressure: pr, alpha: lineAlpha, color: lineInk });
        // Birikme: kalemin yavaşladığı keskin dönüşlerde mürekkep göllenir.
        if (toMa < 1) for (let i = 1; i < n - 1; i++) {
          if (turn[i] < 0.75 || penNow.idx < i) continue;
          blot(ctx, line[i].x, line[i].y, 1.9 * pressure[i], { seed: seed + 500 + i, color: lineInk, alpha: lineAlpha * (1 - toMa) * 0.9, spread: clamp((penNow.idx - i) * 2), boil: bo });
        }
      } else {
        // Her şerit YALNIZ kendi noktalarını çizer; komşuya giden dönüş ayrı darbe ve
        // şeritler oturdukça söner. Ortak uç noktası bırakılınca yılan sırası şeritleri
        // dikey kenarlarla kutuya çeviriyordu (640 ölçümü).
        for (let k = 0; k < STRIPS; k++) {
          const a = Math.ceil((k * n) / STRIPS), b = Math.min(n, Math.ceil(((k + 1) * n) / STRIPS));
          brush(ctx, line.slice(a, b), { width: 3.2, taper: 0.7 * splitK, wobble: 0.12, seed: seed + 3 + k, boil: bo, alpha: lineAlpha, color: lineInk });
          if (k < STRIPS - 1 && splitK < 1) brush(ctx, line.slice(b - 2, b + 2), { width: 3.2, taper: 0, seed: seed + 50 + k, boil: bo, alpha: lineAlpha * (1 - splitK), color: lineInk });
        }
      }
      // Kalemin ucu: kalemin kendisi çizilmez, yalnız kâğıda düşen GÖLGESİ (ışık sol
      // üstten, kalem sağ üste uzanır) ve ucunda mavi bir temas (21 Ekim'e dek pirinç). Gölge düz, bulanık değil.
      if (pen > 0 && pen < 1) {
        const nib = nibOf(line, penNow.idx);
        const show = span(pen, 0, 0.06) * (1 - span(pen, 0.94, 1));
        ctx.save();
        ctx.globalAlpha = 0.1 * show;
        ctx.fillStyle = p.primary;
        ctx.beginPath();
        ctx.moveTo(nib.x + 3, nib.y + 2);
        ctx.lineTo(nib.x + 88, nib.y - 52);
        ctx.lineTo(nib.x + 96, nib.y - 40);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        blot(ctx, nib.x, nib.y, 4.2, { seed: seed + 4, color: p.primary, spread: 1, boil: bo });
      } else if (pen >= 1 && toStrips < 1) {
        // Kalem kalktı: ucunda yuvarlak değil, sarkan bir damla kalır.
        const end = line[n - 1];
        teardrop(ctx, end.x, end.y - 1, 4.8 * ease.out(span(t, PEN_B, PEN_B + 0.5)), { color: p.primary, alpha: 1 - toStrips, seed: seed + 5, boil: bo });
      }
    }

    // III: dev kelime, sonra şeritlerin üstüne başlıklar.
    if (live && t > ACTS[2] - 0.6 && t < ACTS[2] + 2.5) {
      const s = displaySize(ctx, p.font, text.news, (right - left) * 0.86, narrow ? 84 : 150);
      kinetic(ctx, text.news, { x: cx, y: (top + bottom) / 2 + s * 0.36, size: s, font: p.font, color: p.ink, fill: p.display, t, inAt: ACTS[2] - 0.15, outAt: ACTS[2] + 1.1, stagger: 0.04 });
    }
    // Kola dönüşte başlıklar biçimden ÖNCE çekilir: yazının üstünden çizgi geçmesin.
    const writing = toStrips * (1 - span(t, ACTS[3] - 0.1, ACTS[3] + 0.45)) * (1 - curtain);
    if (writing > 0) {
      ctx.save();
      ctx.font = headFont;
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = p.ink;
      const fs = narrow ? 12.5 : 14.5, ch = fs * 1.62;
      headlines.forEach(({ line, start, end, width }, k) => {
        // Kart, yazıdan bir sekizlik önce: sitenin panel dilinde (zemin `--premium-surface`,
        // solda mavi künye çubuğu). Giriş ease-out, taşmasız; soldan 12 px kayar.
        const card = ease.out(span(t, start - 0.2, start + 0.15));
        if (card <= 0) return;
        const by = stripY(k) - 9 - fs * 0.36 - ch / 2, bx = left + 6 - 12 * (1 - card);
        ctx.globalAlpha = writing * card * 0.94;
        ctx.fillStyle = p.surface;
        ctx.beginPath(); ctx.roundRect(bx, by, width + 32, ch, ch / 2.6); ctx.fill();
        ctx.globalAlpha = writing * card;
        ctx.fillStyle = paint(linear(ctx, brandLayer, bx, by, 4, ch));
        ctx.beginPath(); ctx.roundRect(bx + 7, by + 5, 3, ch - 10, 1.5); ctx.fill();
        const reveal = span(t, start, end);
        if (reveal <= 0) return;
        const shown = line.slice(0, Math.round(line.length * reveal));
        ctx.fillStyle = p.ink;
        ctx.fillText(shown, left + 24, stripY(k) - 9);
        // Daktilonun başı: yazarken mavi bir damla.
        if (reveal < 1) blot(ctx, left + 24 + ctx.measureText(shown).width + 5, stripY(k) - 13, 3, { seed: seed + 140 + k, color: p.primary, alpha: writing });
      });
      ctx.restore();
    }

    // IV: terazi.
    const scale = span(t, ACTS[3] + 0.9, ACTS[3] + 1.8) * (1 - curtain);
    // Mil: selin son damlası; terazi çizilmeden önce de orada.
    if (t >= ACTS[3] + 0.2) blot(ctx, cx, beamY, 5.5, { seed: seed + 23, color: p.primary, alpha: 1 - curtain, boil: bo });
    if (scale > 0) {
      brush(ctx, [{ x: cx, y: beamY }, { x: cx - 3, y: lerp(beamY, bottom, 0.5) }, { x: cx - 26, y: bottom }], { width: 3.2, progress: ease.out(scale), taper: 0.4, seed: seed + 20, boil: bo, alpha: 1 - curtain, color: p.primary });
      brush(ctx, [{ x: cx, y: beamY }, { x: cx + 3, y: lerp(beamY, bottom, 0.5) }, { x: cx + 26, y: bottom }], { width: 3.2, progress: ease.out(scale), taper: 0.4, seed: seed + 21, boil: bo, alpha: 1 - curtain, color: p.primary });
      brush(ctx, segment({ x: cx - 44, y: bottom }, { x: cx + 44, y: bottom }, 12), { width: 3.4, progress: ease.out(scale), taper: 0.5, seed: seed + 22, boil: bo, alpha: 1 - curtain, color: p.primary });
      const pans = span(t, ACTS[3] + 1.4, ACTS[3] + 2.3);
      const drop = narrow ? 44 : 58, panW = narrow ? 30 : 38;
      // Kefeler kolu GECİKMEYLE izler (follow-through): kol dönerken ipler sarkaç gibi
      // geride kalır. Kolun açısal hızı kapalı biçimde, kaymadan (saf t fonksiyonu).
      const dAngle = SWAY * Math.cos((2 * Math.PI * (t - ACTS[3] - 1.6)) / SWAY_PERIOD) * (2 * Math.PI / SWAY_PERIOD) * span(t, ACTS[3] + 1.4, ACTS[3] + 2.4) * sway;
      for (const [side, tone] of [[-1, p.up], [1, p.down]] as const) {
        const end0 = beam[side < 0 ? 0 : n - 1];
        const lagX = -dAngle * half * 0.22 * side;
        const end = { x: end0.x + lagX, y: end0.y };
        // Damla değince kefe hafifçe çöker ve sönen bir salınımla toparlanır (ikincil
        // hareket): ağırlık yazıyla değil kefenin tepkisiyle okunur. Son iki çarpma yeter.
        const since = t - (ACTS[3] + DROP_FROM) - (side < 0 ? 0 : DROP_EVERY / 2);
        const count = since > 0 ? Math.floor(since / DROP_EVERY) + 1 : 0;
        let dip = 0;
        for (let d = Math.max(0, count - 2); d < count; d++) dip += damped(since - d * DROP_EVERY - 0.55, 2.2, 5.5);
        const panY = end.y + drop + dip * (narrow ? 2.6 : 3.4) * (1 - curtain);
        brush(ctx, segment(end0, { x: end.x, y: panY }, 8), { width: 1.5, progress: ease.out(pans), taper: 0, seed: seed + 30 + side, boil: bo, alpha: 0.8 * (1 - curtain), color: p.primarySoft });
        const bowl: Point[] = [];
        for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); bowl.push({ x: end.x - Math.cos(a) * panW, y: panY + Math.sin(a) * 11 }); }
        brush(ctx, bowl, { width: 3, progress: ease.out(pans), taper: 0.5, seed: seed + 32 + side, boil: bo, alpha: 1 - curtain, color: p.primary });
        // Damlalar: kefeye düşer, dibinde birikir; yedinciden sonra gelenler yığına çarpıp dağılır.
        for (let d = Math.max(0, count - 8); d < count; d++) {
          const local = since - d * DROP_EVERY;
          const rests = d < 7;
          const slot = rests ? d : 6;
          const restX = end.x + ((slot % 4) - 1.5) * (panW / 3), restY = panY + 4 - Math.floor(slot / 4) * 6 - (rests ? 0 : 6);
          const fall = ease.in(clamp(local / 0.55));
          if (!rests && fall >= 1 && local > 0.95) continue;
          const y = lerp(beamY - 70, restY, fall);
          // Düşerken uzar, çarpınca yayvanlaşır.
          // Kefede boncuk gibi durur (0,25 ezilmeyle çizgiye dönüyordu: kefede "şerit" okunuyordu).
          const sq = fall < 1 ? lerp(1, 1.45, fall) : 0.72;
          if (rests || fall < 1) blot(ctx, restX, y, 4.2, { seed: seed + 40 + d * 3 + side, color: tone, squash: sq, alpha: 1 - curtain, boil: bo });
          if (local > 0.55 && local < 0.95) splatter(ctx, restX, restY, local - 0.55, { seed: seed + 60 + (d % 9), count: rests ? 4 : 6, reach: rests ? 9 : 13, size: 1.2, color: tone, up: true, fade: 0.25 });
        }
        const lab = span(t, ACTS[3] + 2.2, ACTS[3] + 2.8) * (1 - curtain);
        tag(ctx, side < 0 ? text.positive : text.negative, end.x, panY + 34, lab, { font: p.font, halo: p.paper, color: tone, size: narrow ? 13 : 15, align: "center" });
      }
      // Dönen dev kelimeler: tartının ne yaptığını tek kelimeyle söyler, her ~2 sn yenisi.
      const since = t - (ACTS[3] + WORD_FROM);
      if (since > 0 && text.weighing.length && doneAt === null) {
        const slot = Math.floor(since / WORD_EVERY);
        const word = text.weighing[slot % text.weighing.length];
        // Kolun üstündeki bantta, kefelerin ipleri arasında: düşen damlalarla kesişmez.
        const band = beamY - top - 22;
        const s = displaySize(ctx, p.font, word, Math.max(120, half * 2 - (narrow ? 80 : 120)), Math.min(narrow ? 36 : 56, band * 0.8));
        const at = ACTS[3] + WORD_FROM + slot * WORD_EVERY;
        // Çıkış bir sonraki kelime ölçüde girmeden biter (çıkış 0,3 sn + kademe).
        kinetic(ctx, word, { x: cx, y: top + band / 2 + s * 0.36, size: s, font: p.font, color: p.ink, fill: p.display, t, inAt: at, outAt: at + WORD_EVERY - 0.45, stagger: 0.028 });
      }
    }

    // Küçük zil (III–V; dosya başı "KÜÇÜK ZİL"). Selin altında kalınca büzülüp kaybolur:
    // V'te büyüyüp çalan zil o.
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
      const rr = 88 * s, T = rr * 1.24;
      // Alçak sahnede (320 piksel) halka üstten kırpılıyordu: karo en az halkası kadar aşağıda.
      const by = Math.max((top + bottom) / 2 - readySize * 0.6, rr + 12);
      const ty = by + 78 * s + readySize * 0.95;
      const ring: Point[] = [];
      for (let i = 0; i <= 44; i++) { const a = -Math.PI / 2 + (i / 44) * Math.PI * 2.06; ring.push({ x: cx + Math.cos(a) * rr, y: by + Math.sin(a) * rr }); }
      brush(ctx, ring, { width: narrow ? 3.5 : 4.5, progress: ease.inOut(span(d, 1.0, 1.6)), taper: 0.8, seed: seed + 320, boil: bo, color: paint(markRing(cx, by, rr)) });
      // Karo: damga gibi iner (tek küçük öğe: taşma serbest); vuruşta hafifçe sarsılır.
      const stamp = span(d, 0.4, 0.8);
      if (stamp > 0) {
        const ring1 = damped(Math.max(0, d - 1.05), 1.6, 2.2);
        ctx.save();
        ctx.translate(cx, by); ctx.rotate(ring1 * 0.05); ctx.scale(ease.back(stamp), ease.back(stamp));
        ctx.globalAlpha = ease.out(span(d, 0.4, 0.55));
        brandTile(ctx, 0, 0, T, p);
        const k = T / 278.26;
        bellGlyph(ctx, p, {
          x: 0, y: -T / 2 + (HANG.y + 15.13) * k, k, swing: ring1 * 0.22, brand: false, clapper: span(d, 0.85, 1.0),
          face: { eyes: span(d, 1.05, 1.3), blink: blinkAt(d, [2.35]), lookX: 0, lookY: 0, color: p.mark.at(-1)?.stops.at(-1)?.color ?? p.ink },
        });
        ctx.restore();
        if (splatterOK(d)) splatter(ctx, cx, by + T / 2, d - 0.8, { seed: seed + 340, count: 8, reach: T * 0.5, size: 2.6, color: p.primary, up: true, fade: 0.3 });
      }
      ringArcs(ctx, { ...p, ink: p.primary }, cx, by - T * 0.08, span(d, 1.1, 1.75), s * 1.35);
      spark(ctx, { ...p, spark: p.primarySoft }, cx + T * 0.66, by - T * 0.34, span(d, 1.1, 1.55), s, seed + 80);
      spark(ctx, { ...p, spark: p.primary }, cx - T * 0.66, by - T * 0.3, span(d, 1.3, 1.75), s * 0.8, seed + 81);
      kinetic(ctx, text.ready, { x: gx, y: ty, size: readySize, font: p.font, color: p.ink, fill: p.display, t: d, inAt: 1.15, stagger: 0.04, align: "left" });
      seal(ctx, p, gx + readyW + gap + sealSize / 2, ty - readySize * 0.36, sealSize, d - 1.95, { text: text.symbol, seed: seed + 330 });
    }
    ctx.restore();
  };

  // Selin kaynağı çizginin ucu, EKRANDA: kamera o an hâlâ itişten dönüyor olabilir.
  const tail = ma20[n - 1];
  const flood = floodOf(frame, size, { x: (tail.x - cam.x) * cam.z + w / 2, y: (tail.y - cam.y) * cam.z + h / 2 });
  if (!flood?.full) world(pal);
  if (flood) {
    // Selin içinde paletin yalnız kâğıdı (künye halesi) değişir: selin üst tonu.
    const wet: FilmPalette = { ...pal, paper: pal.wash[0] };
    const narrowNow = narrowOf(size);
    ctx.save();
    floodPath(ctx, flood.x, flood.y, flood.r, seed + 200, t);
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, pal.wash[0]); body.addColorStop(1, pal.wash[1]);
    ctx.fillStyle = body;
    ctx.fill();
    // Dalganın sırtı: marka karosunun degradesiyle kalın bir kurdele, içinde ikinci, ince
    // bir dalga (`--primary-faint`): sel bir mavi dalga olarak süpürür, düz bir daire değil.
    if (!flood.full) {
      const layer = pal.mark.at(-1);
      ctx.strokeStyle = layer ? linear(ctx, layer, flood.x - flood.r, flood.y - flood.r, flood.r * 2, flood.r * 2) : pal.primary;
      ctx.lineWidth = narrowNow ? 4 : 5.5;
      ctx.stroke();
      const inner = flood.r - (narrowNow ? 10 : 15);
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
  // Selin ekranın ne kadarını kapladığı (0–1): ölçü; altyazı artık buna bakmıyor.
  return flood ? clamp(flood.r / flood.R) : 0;
}
