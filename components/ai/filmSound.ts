"use client";
import type { FilmCue } from "@/lib/ink/analysis-film";

/**
 * Bekleme filminin sesi: dosya yok, hepsi Web Audio ile sentezleniyor
 * (kalem, damla, mühür, sel, zil). "Ses filmin yarısıdır" (lemo-opuscar
 * DIRECTOR § 6) ama bir piyasa sitesinde kendiliğinden ses çalmak kabalık:
 * VARSAYILAN KAPALI, filmdeki düğmeyle açılır, tercih tarayıcıda kalır.
 *
 * Tarayıcı sesi ancak bir kullanıcı hareketiyle başlatır: tercih açıksa
 * "Analizi Başlat" tıklaması `primeFilmSound()` ile bağlamı orada açar.
 * Malzemeye uygun sesler (ink-wash: "never a metal whoosh"): kâğıt ve
 * mürekkep sesleri gürültüden, zil kısmi tonlardan.
 */
const PREF = "az-film-sound";
let audio: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

export function soundPreferred() {
  try { return localStorage.getItem(PREF) === "1"; } catch { return false; }
}
export function setSoundPreferred(on: boolean) {
  try { localStorage.setItem(PREF, on ? "1" : "0"); } catch { /* tercih saklanamadı: yalnız bu oturum */ }
}

/** Ses bağlamını bir kullanıcı hareketinin içinde açar (ya da sürdürür). */
export function primeFilmSound() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audio) {
    audio = new Ctor();
    const comp = audio.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = audio.createGain();
    master.gain.value = 0.55;
    master.connect(comp).connect(audio.destination);
    // Bir saniyelik beyaz gürültü, tohumlu (her açılışta aynı doku).
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
  }
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

export function muteFilmSound() {
  if (audio && audio.state === "running") void audio.suspend();
}

function env(g: GainNode, at: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function noiseBurst(at: number, o: { type: BiquadFilterType; freq: number; q?: number; peak: number; attack: number; decay: number; sweepTo?: number }) {
  if (!audio || !master || !noise) return;
  const src = audio.createBufferSource();
  src.buffer = noise; src.loop = true;
  const f = audio.createBiquadFilter();
  f.type = o.type; f.frequency.setValueAtTime(o.freq, at); f.Q.value = o.q ?? 0.8;
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, at + o.attack + o.decay);
  const g = audio.createGain();
  env(g, at, o.peak, o.attack, o.decay);
  src.connect(f).connect(g).connect(master);
  src.start(at, Math.random() * 0.5);
  src.stop(at + o.attack + o.decay + 0.05);
}

function tone(at: number, freq: number, o: { peak: number; attack?: number; decay: number; type?: OscillatorType; glideTo?: number }) {
  if (!audio || !master) return;
  const osc = audio.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(freq, at);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, at + o.decay);
  const g = audio.createGain();
  env(g, at, o.peak, o.attack ?? 0.004, o.decay);
  osc.connect(g).connect(master);
  osc.start(at);
  osc.stop(at + (o.attack ?? 0.004) + o.decay + 0.05);
}

/** Mürekkep damlası: kısa cam "tink" ve yumuşak ıslak vuruş. */
const tink = (at: number, freq: number, peak = 0.16) => {
  tone(at, freq, { peak, decay: 0.22 });
  tone(at, freq * 2.76, { peak: peak * 0.25, decay: 0.09 });
  noiseBurst(at, { type: "lowpass", freq: 700, peak: peak * 0.6, attack: 0.002, decay: 0.06 });
};
/** Ahşap ve kâğıt: mührün ya da damganın basılışı. */
const thump = (at: number, peak = 0.5) => {
  tone(at, 130, { peak, decay: 0.2, glideTo: 48 });
  noiseBurst(at, { type: "lowpass", freq: 1100, peak: peak * 0.35, attack: 0.002, decay: 0.05 });
  noiseBurst(at + 0.01, { type: "highpass", freq: 3500, peak: peak * 0.08, attack: 0.002, decay: 0.12 });
};

/** Kalemin kâğıttaki sesi: bant geçiren gürültü, kalemin "hızıyla" titreyen düzey. */
function pen(at: number, duration: number) {
  if (!audio || !master || !noise) return;
  const src = audio.createBufferSource();
  src.buffer = noise; src.loop = true;
  const f = audio.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 3600; f.Q.value = 0.7;
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, at);
  let seed = 3;
  for (let x = 0; x < duration; x += 0.035) {
    seed = (seed * 16807) % 2147483647;
    g.gain.linearRampToValueAtTime(0.012 + (seed / 2147483647) * 0.05, at + x);
  }
  g.gain.linearRampToValueAtTime(0.0001, at + duration + 0.05);
  src.connect(f).connect(g).connect(master);
  src.start(at); src.stop(at + duration + 0.1);
}

/** Zil: çan kısmi tonları (minör üçlü ve kusurlu üst tonlar), uzun sönüm. */
function bell(at: number) {
  const base = 784;
  ([[0.5, 0.1, 2.6], [1, 0.16, 2.2], [1.19, 0.08, 1.6], [1.56, 0.06, 1.3], [2, 0.07, 1.1], [2.51, 0.035, 0.8], [3.01, 0.025, 0.6]] as const)
    .forEach(([ratio, peak, decay]) => tone(at, base * ratio, { peak, decay, attack: 0.003 }));
}

export function playCue(cue: FilmCue) {
  if (!audio || audio.state !== "running") return;
  const at = audio.currentTime + 0.01;
  switch (cue.kind) {
    case "splash": tink(at, 1700, 0.18); noiseBurst(at, { type: "bandpass", freq: 1400, peak: 0.12, attack: 0.002, decay: 0.16 }); break;
    case "stamp": thump(at, 0.42); break;
    case "rise": noiseBurst(at, { type: "bandpass", freq: 600, q: 0.6, peak: 0.05, attack: 0.12, decay: 0.25, sweepTo: 2400 }); break;
    case "drop": tink(at, 2100); break;
    case "pen": pen(at, cue.duration); break;
    case "blot": tink(at, 1500, 0.1); break;
    case "floodIn": noiseBurst(at, { type: "lowpass", freq: 220, peak: 0.16, attack: 0.55, decay: 0.6, sweepTo: 1500 }); break;
    case "floodOut": noiseBurst(at, { type: "lowpass", freq: 1500, peak: 0.12, attack: 0.3, decay: 0.8, sweepTo: 200 }); break;
    case "type": for (let i = 0; i < 6; i++) noiseBurst(at + i * 0.07, { type: "highpass", freq: 4200, peak: 0.05, attack: 0.002, decay: 0.012 }); break;
    case "tink": tink(at, cue.tone === "up" ? 2400 : 1600, 0.1); break;
    case "hush": break;
    case "bell": bell(at); break;
    case "seal": thump(at, 0.55); break;
  }
}
