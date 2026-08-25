import type { ChartRange } from "@/lib/providers/types";
import { isValidSymbol } from "@/lib/utils";

/**
 * Karşılaştırma ekranının ORTAK SÖZLEŞMESİ.
 *
 * NEDEN AYRI BİR DOSYA: aralık listesi, sembol sınırı ve adres biçimi artık
 * ÜÇ yerden okunuyor — sunucu sayfası (`app/(app)/karsilastir/page.tsx`),
 * aralığı istemcide değiştiren bileşen (`components/markets/CompareLive.tsx`)
 * ve toplu bar ucu (`app/api/karsilastir/route.ts`). Üçü ayrı listeler
 * tutsaydı er geç birbirinden ayrı düşerlerdi ve bu depoda o hata bir kez
 * yaşandı: doğrulama `CHART_RANGES`e (sekiz aralık), denetim beş düğmeye
 * bakıyordu, adrese `?aralik=1D` yazan biri hiçbir düğmenin seçili
 * görünmediği bir ekran alıyordu.
 *
 * Dosya `"use client"` DEĞİL ve olmamalı: istemci modülünden dışa aktarılan
 * bir değer sunucu bileşenine gerçek değer olarak gelmiyor (gerekçesi
 * `lib/chart-series.ts` başında). Buradaki her şey iki tarafta da çalışır.
 */

/** Dört sembol sınırı keyfi değil: beşinci sütun mobilde tabloyu okunmaz
 *  yapıyor ve normalize grafikte renkler ayırt edilemez hâle geliyor. */
export const MAX_COMPARE_SYMBOLS = 4;

/**
 * Grafik aralıkları — `CHART_RANGES`in tamamı DEĞİL.
 *
 * `1D` ve `1W` dakikalık bar döndürüyor; dört sembol o çözünürlükte üst üste
 * çizilince normalize eğri okunmaz bir gürültüye dönüyor.
 */
export const COMPARE_RANGES = [
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
] as const satisfies readonly ChartRange[];

export type CompareRange = (typeof COMPARE_RANGES)[number];

export const DEFAULT_COMPARE_RANGE: CompareRange = "6M";

export function isCompareRange(value: unknown): value is CompareRange {
  return (
    typeof value === "string" &&
    (COMPARE_RANGES as readonly string[]).includes(value)
  );
}

/**
 * Normalize grafiğe ve dönem getirisine giden seri.
 *
 * Bar'ın tamamı taşınmıyor: açılış/en yüksek/en düşük/hacim bu ekranda hiç
 * okunmuyor ve aralık değiştikçe ağdan geçen yükü dört katına çıkarıyordu.
 */
export type CompareSeries = {
  symbol: string;
  /** Kapanış dizisi; en az iki nokta. */
  closes: number[];
  /** Bar zamanları (unix saniye) — ortak takvim ekseni ve kapsam künyesi. */
  times: number[];
};

/**
 * Adresteki sembol listesi — alınanlar ve DÜŞENLER.
 *
 * Düşenler ayrı dönüyor çünkü ekran onları söylemek zorunda: paylaşılan bir
 * bağlantıda beş sembol varsa beşincisi sessizce yok oluyordu ve okuyucu
 * "bağlantı bozuk" sanıyordu.
 *
 * Dizi biçimi de kurtarılıyor: `?semboller=A&semboller=B` Next tarafından
 * dizi olarak geliyor ve eski `typeof raw !== "string"` koşulu onu boş
 * ekrana düşürüyordu.
 */
export function parseCompareSymbols(raw: string | string[] | undefined): {
  kept: string[];
  dropped: string[];
} {
  const metin = Array.isArray(raw) ? raw.join(",") : raw;
  if (typeof metin !== "string") return { kept: [], dropped: [] };
  const parcalar = metin
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
  const gecerli = [...new Set(parcalar.filter((entry) => isValidSymbol(entry)))];
  const gecersiz = [...new Set(parcalar.filter((entry) => !isValidSymbol(entry)))];
  return {
    kept: gecerli.slice(0, MAX_COMPARE_SYMBOLS),
    dropped: [...gecersiz, ...gecerli.slice(MAX_COMPARE_SYMBOLS)],
  };
}

/**
 * Ekranın adresi.
 *
 * Virgül HAM yazılıyor. `URLSearchParams` onu `%2C`ye çeviriyor ama hisse
 * sayfasındaki karşılaştır bağlantısı ham virgül üretiyor: aynı içerik iki
 * ayrı adreste yaşıyor, önbellek iki kez doluyor ve paylaşılan bağlantılar
 * birbirine benzemiyordu.
 */
export function compareHref(
  list: readonly string[],
  range: CompareRange = DEFAULT_COMPARE_RANGE,
): string {
  if (list.length === 0) return "/karsilastir";
  const ek = range !== DEFAULT_COMPARE_RANGE ? `&aralik=${range}` : "";
  return `/karsilastir?semboller=${list.join(",")}${ek}`;
}

/**
 * Serinin dönem getirisi (%) — İLK bardan sonuncuya.
 *
 * TEK YERDE, çünkü aynı sayı üç yüzeyde okunuyor: sembol şeridi, grafiğin
 * altındaki künye ve tablodaki "Dönem Getirisi" satırı. Deponun kuralı
 * "aynı sayı iki yerde duruyorsa aynı kaynaktan gelmeli" — kaynak burası.
 */
export function periodChangePct(series: CompareSeries | undefined): number | null {
  const closes = series?.closes;
  if (!closes || closes.length < 2) return null;
  const base = closes[0];
  if (!base) return null;
  return ((closes[closes.length - 1] - base) / base) * 100;
}

/**
 * Seri seçilen aralığın tamamını kapsamıyorsa kapsadığı GERÇEK aralık.
 * Kapsıyorsa null — o zaman söylenecek fazladan bir şey yok.
 *
 * KISA SERİ KENDİ DÖNEMİNİ SÖYLER. Getiri serinin ilk barından hesaplanıyor;
 * sonradan listelenen bir hissede bu, seçilen aralığın tamamı değil. 5Y
 * seçiliyken SPCX satırında "− %14,90" yazıyordu ve okuyucu bunu beş yıllık
 * kayıp sanıyordu — oysa şirketin elimizdeki ilk barı 8 Haziran 2026, yani
 * gösterilen şey on haftalık getiri.
 *
 * Ek kullanılmıyor ("2026'dan beri" gibi): Türkçede ek yılın okunuşuna göre
 * değişiyor (2026'DAN ama 2025'TEN) ve tek bir kalıp ikisini birden doğru
 * yazamıyor. Tarih aralığı hem eksiz hem daha çok şey söylüyor.
 */
export function coverageNote(
  series: readonly CompareSeries[],
  symbol: string,
  locale: string,
): string | null {
  const entry = series.find((item) => item.symbol === symbol);
  const ts = entry?.times;
  if (!ts || ts.length < 2) return null;

  let enErken = Infinity;
  for (const item of series) {
    const ilk = item.times?.[0];
    if (typeof ilk === "number" && ilk < enErken) enErken = ilk;
  }
  if (!Number.isFinite(enErken)) return null;

  const kapsam = ts[ts.length - 1] - ts[0] || 1;
  // Tam kapsayan serilerde künye basılmıyor; eşik seri başlangıcının ortak
  // başlangıca oranı.
  if (ts[0] - enErken < kapsam * 0.02) return null;

  /* SAAT DİLİMİ ŞART. Bu fonksiyon eskiden yalnızca sunucu bileşeninde
     koşuyordu ve üretimde sunucunun dilimi UTC'ydi; artık aralık istemcide
     değiştiği için AYNI dize hem sunucuda hem tarayıcıda üretiliyor. Diliminde
     bar damgası 04:00Z olan günlük bir bar, UTC−7'deki okuyucuda BİR ÖNCEKİ
     güne kayıyor: sunucu "8 Haz 2026" basıyor, hidrasyon "7 Haz 2026" diyor —
     hem metin uyuşmazlığı hem yanlış işlem günü. Aynı ders `PriceChart`ta da
     yazılı: bar tarihleri açıkça UTC okunur. */
  const bicim = (unix: number) =>
    new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(unix * 1000));
  return `${bicim(ts[0])} — ${bicim(ts[ts.length - 1])}`;
}
