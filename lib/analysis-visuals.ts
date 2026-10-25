/**
 * Bilanço karnesinin görsel katmanı — saf mantık (25 Ekim görsel zirve).
 *
 * Sayfa ve analiz listesi buradan okuyor; hiçbir fonksiyon veri UYDURMAZ.
 * Çizilen her sayı kaydın kendisinde ya yapısal alan (`eps_surprise_pct`,
 * `reaction_pct`) ya da rutinin yazdığı künye metni ("Beklenti 63,4 Mr $")
 * olarak duruyor; okunamayan ya da eksik alan `null` döner ve çağıran o
 * görseli HİÇ basmaz (CLAUDE.md "Veri dürüstlüğü" 1-2).
 *
 * "use client" DEĞİL: sunucu bileşenleri de, istemci tablosu da okuyor.
 */

/* ---------------------------------------------------------------------------
   Para künyesi okuyucu

   Kapaktaki öncü ölçülerin değeri ve notu SERBEST METİN ("64,60 Mr $",
   "$64.60B"; not "Beklenti 63,4 Mr $ · %1,9 Aştı"). Beklenti çizgisi için
   iki sayıyı aynı birime çevirmek gerekiyor. Okuyucu yalnızca iki kalıbı
   tanıyor; başka bir yazım `null` ve çizgi basılmıyor.
   --------------------------------------------------------------------------- */

const TR_SCALE: Record<string, number> = { Bin: 1e3, Mn: 1e6, Mr: 1e9, T: 1e12 };
const EN_SCALE: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };

/** Kayan nokta artığı temizlenir: 64,6 × 1e9 = 64599999999,99999 olmasın. */
const scaled = (value: number, scale: number) => Number((value * scale).toPrecision(12));

/** "64,60 Mr $" · "−2,12 Mr $" · "3,83 $" · "$64.60B" · "−$2.12B" → dolar. */
export function parseMoneyFigure(text: string | null | undefined): number | null {
  if (!text) return null;
  const clean = text.replace(/ | /g, " ").trim();
  /* Türkçe: ondalık virgül, binlik nokta, birim sayının arkasında. */
  const tr = /^([−-])?\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?\s*(Bin|Mn|Mr|T)?\s*\$$/.exec(clean);
  if (tr) {
    const whole = tr[2].replace(/\./g, "");
    const value = scaled(Number(`${whole}.${tr[3] ?? "0"}`), tr[4] ? TR_SCALE[tr[4]] : 1);
    return Number.isFinite(value) ? (tr[1] ? -value : value) : null;
  }
  /* İngilizce: ondalık nokta, binlik virgül, simge önde, birim bitişik. */
  const en = /^([−-])?\s*\$(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?\s*([KMBT])?$/.exec(clean);
  if (en) {
    const whole = en[2].replace(/,/g, "");
    const value = scaled(Number(`${whole}.${en[3] ?? "0"}`), en[4] ? EN_SCALE[en[4]] : 1);
    return Number.isFinite(value) ? (en[1] ? -value : value) : null;
  }
  return null;
}

/** Künyedeki açık beklenti sayısı — yalnızca "Beklenti 63,4 Mr $" / "Estimate $63.4B". */
export function expectedFromNote(note: string | null | undefined): { text: string; value: number } | null {
  if (!note) return null;
  const clean = note.replace(/ | /g, " ");
  const match =
    /Beklenti\s+([−-]?\d[\d.,]*\s*(?:Bin|Mn|Mr|T)?\s*\$)/.exec(clean) ??
    /(?:Estimate|Expected|Consensus)\s+([−-]?\$\d[\d.,]*[KMBT]?)/i.exec(clean);
  if (!match) return null;
  const value = parseMoneyFigure(match[1]);
  return value === null ? null : { text: match[1].trim(), value };
}

export type ExpectationReading = {
  actual: number;
  expected: number;
  /** Gerçekleşenin beklentiden sapması, yüzde. */
  diffPct: number;
  outcome: "beat" | "miss" | "inline";
  /** 0-1 arası konumlar — ortak eksende beklenti çentiği ve gerçekleşen nokta. */
  expectedAt: number;
  actualAt: number;
};

/** Yuvarlamanın altında kalan fark "uyumlu" sayılır (rutinin "Uyumlu ✓" künyesi). */
const INLINE_PCT = 0.05;
/** Eksen iki işaretin farkının bu katı kadar dışarı açılır — işaretler kenara yapışmasın. */
const AXIS_PAD = 0.75;
/** Fark çok küçükse eksen en az bu oran kadar (beklentinin yüzdesi) açılır. */
const MIN_SPAN_RATIO = 0.01;

/**
 * Bir öncü ölçünün beklenti karnesi. Değer ve beklenti AYNI kalıpta
 * okunamıyorsa ya da beklenti sıfır/eksiyse `null`: bölünecek bir taban
 * yok, çizgi yalan söylerdi.
 */
export function expectationReading(
  value: string | null | undefined,
  note: string | null | undefined,
): ExpectationReading | null {
  const actual = parseMoneyFigure(value);
  const expected = expectedFromNote(note);
  if (actual === null || expected === null || expected.value <= 0) return null;
  const diffPct = ((actual - expected.value) / expected.value) * 100;
  const outcome = Math.abs(diffPct) < INLINE_PCT ? "inline" : diffPct > 0 ? "beat" : "miss";
  const gap = Math.abs(actual - expected.value);
  const span = Math.max(gap, Math.abs(expected.value) * MIN_SPAN_RATIO);
  const lo = Math.min(actual, expected.value) - span * AXIS_PAD;
  const hi = Math.max(actual, expected.value) + span * AXIS_PAD;
  const at = (v: number) => (v - lo) / (hi - lo);
  return { actual, expected: expected.value, diffPct, outcome, expectedAt: at(expected.value), actualAt: at(actual) };
}

/* ---------------------------------------------------------------------------
   Tepedeki tek cümle

   Şablon + veri. Yalnızca kayıtta olan üç yapısal alan: yıllık gelir
   büyümesi, HBK sürprizi, ilk tepki. Hiçbiri yoksa cümle yok.
   --------------------------------------------------------------------------- */

export type LedeTemplates = {
  revenueUp: string;
  revenueDown: string;
  epsBeat: string;
  epsMiss: string;
  epsInline: string;
  reactionUp: string;
  reactionDown: string;
  reactionFlat: string;
};

export function reportLede(
  figures: { revenueYoyPct: number | null; epsSurprisePct: number | null; reactionPct: number | null },
  templates: LedeTemplates,
  formatPct: (value: number) => string,
  locale: string,
): string | null {
  const fill = (template: string, value: number) => template.replace("{pct}", formatPct(Math.abs(value)));
  const facts: string[] = [];
  const { revenueYoyPct: rev, epsSurprisePct: eps, reactionPct: react } = figures;
  if (rev !== null && Number.isFinite(rev)) facts.push(fill(rev >= 0 ? templates.revenueUp : templates.revenueDown, rev));
  if (eps !== null && Number.isFinite(eps)) {
    facts.push(
      Math.abs(eps) < INLINE_PCT
        ? templates.epsInline
        : fill(eps > 0 ? templates.epsBeat : templates.epsMiss, eps),
    );
  }
  const reaction =
    react !== null && Number.isFinite(react)
      ? Math.abs(react) < INLINE_PCT
        ? templates.reactionFlat
        : fill(react > 0 ? templates.reactionUp : templates.reactionDown, react)
      : null;
  if (facts.length === 0 && reaction === null) return null;
  const head = facts.join(", ");
  const sentence = head && reaction ? `${head}; ${reaction}` : head || (reaction as string);
  /* Yalnız ilk harf büyür; `capitalize` değil, dile göre (i → İ). */
  return `${sentence.charAt(0).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}${sentence.slice(1)}.`;
}

/* ---------------------------------------------------------------------------
   Madde başlığı

   Güçlü yön / risk maddeleri tek cümle. Rutin bir kısmını "baş; açıklama"
   kalıbında yazıyor — o zaman baş kısa başlık olur, kalan açıklama. Kalıp
   yoksa başlık UYDURULMAZ: madde tek parça kalır.
   --------------------------------------------------------------------------- */

const LEAD_MIN = 8;
const LEAD_MAX = 96;

export function splitPoint(text: string): { lead: string | null; rest: string } {
  const trimmed = text.trim();
  for (const sep of ["; ", ": "]) {
    const at = trimmed.indexOf(sep);
    if (at >= LEAD_MIN && at <= LEAD_MAX && at + sep.length < trimmed.length) {
      const rest = trimmed.slice(at + sep.length).trim();
      return { lead: trimmed.slice(0, at).trim(), rest: rest.charAt(0).toLocaleUpperCase("tr-TR") + rest.slice(1) };
    }
  }
  return { lead: null, rest: trimmed };
}

/* ---------------------------------------------------------------------------
   Kaynak künyesi
   --------------------------------------------------------------------------- */

/** "https://www.investor.atmeta.com/x" → "investor.atmeta.com"; okunamazsa `null`. */
export function sourceHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------------
   Analiz listesi — ortak tepki ölçeği

   Kartlardaki tepki şeritleri AYNI ölçekte okunmalı: her kart kendi
   maksimumuna göre çizilse %1,8 ile %18 aynı boyda görünürdü. Ölçek
   listedeki en büyük mutlak tepkiyi kapsayan yuvarlak adım.
   --------------------------------------------------------------------------- */

const SCALE_STEP = 5;
const SCALE_MIN = 5;

export function reactionScale(values: readonly (number | null | undefined)[]): number {
  const max = Math.max(0, ...values.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).map(Math.abs));
  return Math.max(SCALE_MIN, Math.ceil(max / SCALE_STEP) * SCALE_STEP);
}

/** Şeridin −1…1 oranı (ölçek dışına taşan tepki uçta durur). */
export function reactionRatio(value: number, scale: number): number {
  if (!Number.isFinite(value) || scale <= 0) return 0;
  return Math.max(-1, Math.min(1, value / scale));
}
