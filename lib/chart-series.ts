/**
 * Karşılaştırma serilerinin renk ve çizgi deseni.
 *
 * NEDEN AYRI BİR DOSYA: bu sabitler `components/markets/CompareChart.tsx`
 * içinde duruyordu ve o dosya `"use client"` ile başlıyor. Bir istemci
 * modülünden dışa aktarılan DEĞER, sunucu bileşeninden import edildiğinde
 * gerçek değer olarak gelmiyor — Next onu bir istemci referansına çeviriyor.
 * Sonuç sessizdi: karşılaştırma ekranındaki renk anahtarı `style={{
 * background: SERIES_COLORS[i] }}` yazıyor, React `undefined` görüp `style`
 * özniteliğini hiç basmıyor ve şerit görünmez bir çubuk oluyordu. Hata ne
 * derlemede ne çalışma zamanında konuşuyor.
 *
 * Aynı ders `lib/chart-labels.ts` dosyasının başında da yazılı; orada
 * fonksiyon, burada sabit.
 *
 * RENKLER YÖN RENKLERİNDEN AYRI: üçüncü ve dördüncü seri bir zamanlar
 * `--up` ve `--down` idi ve bu üründe o iki renk yalnızca "yükseldi" ve
 * "düştü" demek. Dördü de grafik ailesinden (`--chart-a..d`).
 *
 * RENK TEK TAŞIYICI DEĞİL: üçüncü ve dördüncü seri kesikli çiziliyor, yani
 * renk körlüğünde ve tek renkli baskıda da ayrışıyorlar.
 */
export const SERIES_COLORS = [
  "var(--chart-a)",
  "var(--chart-b)",
  "var(--chart-c)",
  "var(--chart-d)",
] as const;

export const SERIES_DASH: (string | undefined)[] = [
  undefined,
  undefined,
  "6 3",
  "2 3",
];

/** Sembolün rengi — dizinin SIRASINDAN değil sembolün kendisinden.
 *
 * Grafik serisi barı gelmeyen sembolü eliyor; indise bakan bir eşleme o
 * durumda şeritteki bütün renkleri kaydırıyor ve anahtar yanlış sembolü
 * gösteriyordu. */
export function seriesColorOf(symbols: readonly string[], symbol: string) {
  const at = symbols.indexOf(symbol);
  return SERIES_COLORS[(at < 0 ? 0 : at) % SERIES_COLORS.length];
}
