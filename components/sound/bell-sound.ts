/**
 * ZİL SESİ (24 Ekim) — Web Audio ile sentezlenen kısa, yumuşak bir tını.
 *
 * Dosya yok: ses birkaç osilatörden kuruluyor, indirilecek bir şey yok.
 * Tercih ve ses bağlamı bu modülde; düğme `BellSoundToggle.tsx`, çalan yer
 * `HeroBell` (zile basınca ve `az:bell-rang` olayında).
 *
 * KURALLAR — sesin bir sitede rahatsız etmemesi için:
 *   1. VARSAYILAN KAPALI. Tercih yalnızca bu tarayıcıda (`localStorage`):
 *      oturumsuz okuyucu da açabiliyor, hesaba bağlamak bir sunucu yazması
 *      ve tablo demekti; tercih bir kolaylık, kaybolursa ses sadece kapalı
 *      kalıyor. Erişim her yerde try/catch (gizli pencere, kapalı depolama).
 *   2. AYAR KAPALIYKEN HİÇBİR `AudioContext` KURULMUYOR. Bağlam ancak ayar
 *      açıkken ve bir KULLANICI ETKİLEŞİMİNİN içinde kuruluyor (`prime`);
 *      ayar kapanınca kapatılıp bırakılıyor.
 *   3. KENDİLİĞİNDEN ÇALMA YALNIZ AÇILMIŞ BAĞLAMLA. Sayaç sıfırlanınca
 *      (`az:bell-rang`) ses ancak bu sayfada daha önce bir etkileşimle
 *      açılmış ve çalışan (`running`) bir bağlam varsa çıkıyor; tarayıcının
 *      otomatik oynatma kuralını zorlamıyoruz, ona uyuyoruz.
 *   4. `prefers-reduced-motion` sesi etkilemiyor: o tercih hareket için.
 *   5. BAĞLAM BOŞTA SES DONANIMINI TUTMAZ (25 Ekim). Modül tekili ilk
 *      sürümde hiç kapanmıyor, askıya da alınmıyordu: sekme arka planda
 *      dururken bile çalışır (`running`) kalıyordu. Şimdi sayfa gizlenince
 *      `suspend()`, geri gelince (ayar hâlâ açıksa) `resume()`; ayar başka
 *      sekmede kapansa da (`storage` olayı) `close()` ve tekil bırakılıyor.
 *
 * Modül `"use client"` değil (bileşen yok) ama yalnız istemcide çağrılıyor;
 * `window`a her erişim fonksiyonların içinde.
 */

export const BELL_SOUND_KEY = "az-bell-sound";
const BELL_SOUND_ON = "on";
/** Aynı sekmedeki öteki anahtarlar (Ayarlar + hesap menüsü) eşlensin diye. */
const CHANGE_EVENT = "az:bell-sound-change";

export function readBellSound(): boolean {
  try {
    return window.localStorage.getItem(BELL_SOUND_KEY) === BELL_SOUND_ON;
  } catch {
    return false;
  }
}

export function subscribeBellSound(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === BELL_SOUND_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

let context: AudioContext | null = null;
let lifecycleBound = false;

function releaseContext() {
  if (!context) return;
  void context.close().catch(() => undefined);
  context = null;
}

/** Bağlamın yaşam döngüsü — yalnız bağlam ilk kurulduğunda bağlanıyor;
 *  ayar hiç açılmamış okuyucuda dinleyici de yok. */
function bindLifecycle() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.hidden) {
      if (context.state === "running") void context.suspend().catch(() => undefined);
    } else if (context.state === "suspended" && readBellSound()) {
      /* Sayfada daha önce etkileşim olduğu için tarayıcı izin veriyor;
         vermezse bir sonraki dokunuş `primeBellSound` ile açıyor. */
      void context.resume().catch(() => undefined);
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === BELL_SOUND_KEY && !readBellSound()) releaseContext();
  });
}

type AudioContextCtor = typeof AudioContext;

function audioCtor(): AudioContextCtor | null {
  const scope = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/**
 * Tercihi yazar. Açılış bir tıklamanın içinde geliyor: bağlam orada kurulur
 * ve kısa bir örnek tını çalınır (okuyucu neyi açtığını duysun). Kapanışta
 * bağlam kapatılır.
 */
export function writeBellSound(on: boolean) {
  try {
    if (on) window.localStorage.setItem(BELL_SOUND_KEY, BELL_SOUND_ON);
    else window.localStorage.removeItem(BELL_SOUND_KEY);
  } catch {
    // Depolama kapalıysa tercih bu sayfa açıkken bile tutulamıyor; ses kapalı kalır.
  }
  if (!on) releaseContext();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Bir KULLANICI ETKİLEŞİMİNİN içinden çağrılır: ayar açıksa bağlamı kurar
 * ya da askıdan alır. Ayar kapalıysa hiçbir şey kurmaz.
 */
export function primeBellSound(): AudioContext | null {
  if (!readBellSound()) return null;
  if (!context) {
    const Ctor = audioCtor();
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
    bindLifecycle();
  }
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

/* ---- Tını ---------------------------------------------------------------
   Küçük bir el zili: temel frekans ve uyumsuz (tam katı olmayan) üst
   kısmîler, her biri kendi hızıyla sönüyor — yüksekler önce, temel en son.
   Oranlar bilerek tam kat değil (2,32 · 3,06 · 4,41): tam katlar düz bir
   org sesi verir, metal çanın tınısı uyumsuz kısmîlerden gelir. Değerler
   bir kayıttan ölçülmedi, seçildi.
   Ses düzeyi düşük tutuldu (tepe 0,12): sitede bir tıklamanın karşılığı,
   bir alarm değil. */
const BELL_FUNDAMENTAL_HZ = 784;
const BELL_PARTIALS = [
  { ratio: 1, gain: 1, decay: 1.4 },
  { ratio: 2.32, gain: 0.42, decay: 0.8 },
  { ratio: 3.06, gain: 0.2, decay: 0.45 },
  { ratio: 4.41, gain: 0.08, decay: 0.25 },
] as const;
const BELL_PEAK = 0.12;
const BELL_ATTACK_S = 0.006;
/** Şiddet (0…1) tepe düzeyine en fazla bu kadar ekliyor — abartısız. */
const BELL_ENERGY_GAIN = 0.25;
/**
 * Vuruş anları (sn) — `heroTap` sahnesinin kıvılcımlarıyla AYNI an
 * (lib/ink/scenes.ts: sağ vuruş 0,42, sol vuruş 0,74). Ses tokmağın
 * değdiği karede çıkıyor; ikinci vuruş biraz daha hafif ve bir tık pes
 * (zil geri salınırken eteğin öbür yanına değiyor).
 */
const STRIKES = [
  { at: 0.42, level: 1, detune: 1 },
  { at: 0.74, level: 0.7, detune: 0.985 },
] as const;

function strike(audio: AudioContext, when: number, level: number, detune: number) {
  const master = audio.createGain();
  master.gain.value = 1;
  master.connect(audio.destination);
  for (const partial of BELL_PARTIALS) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = BELL_FUNDAMENTAL_HZ * partial.ratio * detune;
    const env = audio.createGain();
    const peak = level * partial.gain;
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(peak, when + BELL_ATTACK_S);
    /* Üstel sönüm sıfıra inemez; sondaki çok küçük değer duyulmuyor. */
    env.gain.exponentialRampToValueAtTime(0.0001, when + partial.decay);
    osc.connect(env);
    env.connect(master);
    osc.start(when);
    osc.stop(when + partial.decay + 0.05);
  }
}

/**
 * Zili çalar. `gesture` doğruysa çağrı bir tıklamanın içinden geliyor ve
 * bağlam gerekirse kurulur; değilse (sayaç sıfırlandı) yalnız çalışan bir
 * bağlam varsa çalar. Ayar kapalıysa hiçbir şey olmaz.
 */
export function playBellSound({ gesture, energy = 0, offset = true }: { gesture: boolean; energy?: number; offset?: boolean }) {
  if (!readBellSound()) return;
  const audio = gesture ? primeBellSound() : context;
  if (!audio || (!gesture && audio.state !== "running")) return;
  const level = BELL_PEAK * (1 + BELL_ENERGY_GAIN * Math.min(1, Math.max(0, energy)));
  const now = audio.currentTime;
  /* `offset` kapalıyken (Ayarlar'daki örnek tını) ilk vuruş hemen. */
  const shift = offset ? 0 : -STRIKES[0].at;
  for (const hit of STRIKES) strike(audio, now + hit.at + shift, level * hit.level, hit.detune);
}
