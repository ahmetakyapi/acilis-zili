/**
 * ELLE YAZILAN TARİH — tarih seçicinin metin alanı için TEK kural. SAF
 * (sınama: tests/date-input.test.ts).
 *
 * Tarayıcının yerli `<input type="date">` penceresi stillenemiyor ve
 * gün/ay/yıl parçaları mavi bloklar hâlinde seçiliyordu (28 Eylül, ekran
 * görüntüsü). Yerine gelen seçici hem takvim hem YAZILABİLİR alan taşıyor:
 * yıllar önceki bir alış tarihini on iki kez "önceki ay"a basarak aramak
 * yerine okuyucu "14.03.2019" yazabiliyor.
 *
 * Biçim dile göre: TR "GG.AA.YYYY", EN "MM/DD/YYYY" (ABD okuyucusunun
 * alışkanlığı). Çözücü hoşgörülü: TR'de eğik çizgi ve tire de ayraç,
 * iki haneli yıl 2000'li yıllar, ISO ("2019-03-14") her iki dilde de
 * kabul. Takvimde olmayan gün (31.02) null döner — uydurulmaz, kaydırılmaz.
 *
 * Değer her yerde ISO "YYYY-AA-GG"; form alanlarına giden biçim değişmedi.
 */

export type DateLocale = "tr" | "en";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
/** İki haneli yılın yüzyılı — ekstre ve alış tarihleri 2000 sonrası. */
const CENTURY = 2000;
const MIN_YEAR = 1900;
const MAX_YEAR = 2999;
const TWO_DIGIT_YEAR = 2;

export function isIsoDay(value: string): boolean {
  const m = ISO.exec(value);
  return m !== null && build(+m[1], +m[2], +m[3]) === value;
}

function build(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Yazılan metin → ISO ya da null. Boş metin null (alan boş), bozuk metin
 * null — çağıran ikisini `text.trim() === ""` ile ayırıyor.
 */
export function parseDateInput(raw: string, locale: DateLocale): string | null {
  const text = raw.trim();
  if (text === "") return null;
  const iso = ISO.exec(text);
  if (iso) return build(+iso[1], +iso[2], +iso[3]);
  const parts = /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2}|\d{4})$/.exec(text);
  if (parts) {
    const a = +parts[1];
    const b = +parts[2];
    const y = parts[3].length === TWO_DIGIT_YEAR ? CENTURY + +parts[3] : +parts[3];
    return locale === "tr" ? build(y, b, a) : build(y, a, b);
  }
  /* Ayraçsız sekiz rakam: TR "14032019", EN "03142019". */
  const packed = /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  if (packed) {
    const a = +packed[1];
    const b = +packed[2];
    return locale === "tr" ? build(+packed[3], b, a) : build(+packed[3], a, b);
  }
  return null;
}

/** ISO → alanda duran metin: TR "14.03.2019", EN "03/14/2019". */
export function formatDateInput(iso: string, locale: DateLocale): string {
  const m = ISO.exec(iso);
  if (!m) return "";
  return locale === "tr" ? `${m[3]}.${m[2]}.${m[1]}` : `${m[2]}/${m[3]}/${m[1]}`;
}

/**
 * Yazarken ayraç ekleme: yalnızca rakam yazan okuyucuya "14032019" yerine
 * "14.03.2019" gösterilir. Okuyucu ayracı kendisi yazdıysa ya da metin
 * rakam dışında bir şey taşıyorsa DOKUNULMAZ (ISO yapıştırma, düzeltme).
 * Silerken çağrılmaz: ayraç geri gelip imleci kilitlemesin.
 */
export function maskDateInput(raw: string, locale: DateLocale): string {
  if (!/^\d{1,8}$/.test(raw)) return raw;
  const sep = locale === "tr" ? "." : "/";
  if (raw.length <= 2) return raw;
  if (raw.length <= 4) return `${raw.slice(0, 2)}${sep}${raw.slice(2)}`;
  return `${raw.slice(0, 2)}${sep}${raw.slice(2, 4)}${sep}${raw.slice(4)}`;
}

/**
 * Bir tuş vuruşundan sonra alanda duracak metin. Maske YALNIZCA önceki metin
 * de maskenin kendi çıktısıysa sürüyor: "28.09" + "2" → "28.09.2". Okuyucu
 * ayracı kendi koyduysa ("1.3.2019") ona dokunulmuyor — rakamları yeniden
 * dizmek onu "13.20.19" yapardı. Silme hiç maskelenmez.
 */
export function nextDateDraft(prev: string, raw: string, locale: DateLocale): string {
  if (raw.length < prev.length) return raw;
  const prevDigits = prev.replace(/\D/g, "");
  const prevMasked = maskDateInput(prevDigits, locale) === prev;
  const digits = raw.replace(/\D/g, "");
  const appendedDigit = raw.startsWith(prev) && /^\d+$/.test(raw.slice(prev.length));
  if (prevMasked && appendedDigit && digits.length <= 8) return maskDateInput(digits, locale);
  return raw;
}

/** Alanın yer tutucusu — biçimin kendisi, dilin harfleriyle. */
export function datePattern(locale: DateLocale): string {
  return locale === "tr" ? "GG.AA.YYYY" : "MM/DD/YYYY";
}

/* --------------------------------------------------------------------------
   Takvim aritmetiği — UTC öğlesinde, yaz saati bir günü kaydırmasın
   -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

export function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

export function utcToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addIsoDays(iso: string, n: number): string {
  return utcToIso(isoToUtc(iso) + n * DAY_MS);
}

/** Ay ekler; hedef ayda o gün yoksa ayın son gününe iner (31 Oca + 1 ay = 28/29 Şub). */
export function addIsoMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  return utcToIso(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last), 12));
}

/** Pazartesi = 0 … Pazar = 6. */
export function weekdayMon(iso: string): number {
  return (new Date(isoToUtc(iso)).getUTCDay() + 6) % 7;
}

/** Değeri [min, max] aralığına sıkıştırır; sınır yoksa olduğu gibi. */
export function clampIso(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}
