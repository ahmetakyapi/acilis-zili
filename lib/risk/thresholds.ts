/**
 * RİSK MASASI — EŞİKLER TEK DOSYADA (25 Ekim).
 *
 * Rejim skoru, geriye dönük test ve hazır kurallar bu sabitleri okur; ekran
 * da eşiği buradan yazar ("eşik 25"). Bir eşik değişirse geçmiş şerit, test
 * tablosu ve kural metni birlikte değişir, ayrı düşmez.
 *
 * NEDEN BU SAYILAR. Hiçbiri optimize edilmedi (geriye dönük testte en iyi
 * sonucu veren eşiği seçmek, testi kendi kendine doğrulayan bir döngüye
 * çevirirdi). Her biri piyasa pratiğinde yaygın kullanılan ya da sitenin
 * başka ekranında zaten kullanılan bir sınır:
 *
 *  - VIX düzeyi 20 / 30: lib/vix.ts bantlarıyla aynı ("normal"in tavanı 20,
 *    "korku" 30). Ana sayfa ve piyasalar ekranı VIX'i bu bantlarla okuyor;
 *    masa başka bir sınır kullanırsa aynı VIX iki ekranda iki ayrı yargı
 *    taşırdı.
 *  - VIX'in beş günlük değişimi %15 / %30: oynaklık endeksinin kısa sürede
 *    sıçraması, düzeyden önce gelen işarettir; %30'luk haftalık sıçrama
 *    Cboe'nin VIX geçmişinde satış dalgalarının başında tipik büyüklük.
 *  - VIX / VIX3M 0,90 / 1,00: vade eğrisi normalde yukarı eğimli (30 günlük
 *    beklenti 3 aylıktan düşük, oran 1'in altında). Oranın 1'i geçmesi
 *    ("ters eğri") piyasanın yakın vadeye uzak vadeden fazla oynaklık
 *    fiyatladığı anlamına gelir; 0,90 üstü eğrinin düzleştiği bölge.
 *  - VXN / VIX oranı: düzey değil, son bir yıldaki DİLİMİ. Nasdaq-100
 *    oynaklığı yapısal olarak S&P 500'ünkinden yüksek; sabit bir oran eşiği
 *    yazmak dayanaksız olurdu. %80 / %95'lik dilim, teknoloji tarafındaki
 *    oynaklık priminin kendi geçmişine göre olağandışı açıldığını söyler.
 *  - Trend (SPY): 100 ve 200 günlük ortalama TEK girdide. Fiyat ikisinin de
 *    üstündeyse 0, yalnız 100'ün altındaysa 1 (erken uyarı), 200'ün de
 *    altındaysa 2. 100 GO'yu AYRI bir girdi yapmadık: iki ortalama aynı
 *    fiyat serisinden geliyor ve çoğu zaman birlikte kesiliyor; ikisini
 *    ayrı saymak trendi skora iki kez yazardı. Tek girdi içinde basamak
 *    olarak durması 100 GO'nun erken uyarısını korur, ağırlığı ikilemez.
 *  - Genişlik (%>200 GO) 60 / 40: S&P 500 üyelerinin yarısı ortalama
 *    çizgisi; %60 üstü geniş katılım, %40 altı yükselişin dar bir gruba
 *    sıkıştığı ya da satışın yayıldığı bölge.
 *  - Kredi farkı (ICE BofA ABD yüksek getirili, opsiyon düzeltmeli) 20
 *    işlem günlük değişimi +0,25 / +0,75 puan: kredi piyasası hisseden
 *    önce gerilebilir. Düzey yerine DEĞİŞİM: farkın yapısal düzeyi on
 *    yıllar içinde kayıyor, bir aylık hızlı açılma ise her dönemde aynı
 *    şeyi söylüyor. 25 / 75 baz puan kaba bir bant; testteki "Kredi Farkı
 *    20 Günde +0,50 Puan" satırı yakın eşiğin geçmişini gösteriyor.
 */

/** Her girdinin puanı: 0 sakin, 1 gergin, 2 stres. */
export const MAX_POINTS = 2;

export const VIX_LEVEL = { tense: 20, stress: 30 } as const;
export const VIX_CHANGE_5D_PCT = { tense: 15, stress: 30 } as const;
export const VIX_CHANGE_DAYS = 5;
export const TERM_RATIO = { tense: 0.9, stress: 1 } as const;
export const VXN_RATIO_PCTILE = { tense: 80, stress: 95 } as const;
/** VXN/VIX diliminin penceresi (işlem günü) ve dilim için en az gözlem. */
export const VXN_RATIO_WINDOW = 252;
export const VXN_RATIO_MIN_HISTORY = 126;
export const BREADTH_ABOVE_200 = { tense: 60, stress: 40 } as const;
/** Kredi farkı değişimi, yüzde PUANI (0,75 = 75 baz puan). */
export const CREDIT_CHANGE_PTS = { tense: 0.25, stress: 0.75 } as const;
export const CREDIT_CHANGE_DAYS = 20;

/**
 * Rejim: puanların, okunabilen girdilerin en yüksek puanına oranı.
 * Oran 0,25'in altındaysa Risk Açık, 0,50 ve üstündeyse Risk Kapalı. Altı
 * girdinin üçü "gergin" (3/14 = 0,21) hâlâ Risk Açık; dördü gergin ya da
 * ikisi stres (4/14 = 0,29) Temkinli; yedi puan (yarı) Risk Kapalı.
 */
export const REGIME_SHARE = { cautious: 0.25, riskOff: 0.5 } as const;
/** Skorun basılması için okunabilen en az girdi. */
export const MIN_COMPONENTS = 4;

/** FRED/Cboe gözleminin bir işlem gününe "o günün değeri" sayılması için en çok yaşı (takvim günü). */
export const MAX_OBSERVATION_LAG_DAYS = 4;

/** Geriye dönük test: "doğru alarm" = sonraki 20 işlem gününde kapanışlardan biri ≥ %5 aşağıda. */
export const HIT_DRAWDOWN_PCT = 5;
export const FORWARD_SHORT = 5;
export const FORWARD_LONG = 20;
/** Aynı sinyal bu kadar işlem günü içinde yeniden sayılmaz (kümelenen tetiklemeler tek olay). */
export const SIGNAL_COOLDOWN = 10;

/** Hazır sinyallerin eşikleri (geriye dönük test + kural kurucunun ön ayarları). */
export const SIGNAL_VIX_ABOVE = 25;
export const SIGNAL_VOL_PCTILE = 90;
export const SIGNAL_CREDIT_WIDENING_PTS = 0.5;

/** Oynaklık tahmini (RiskMetrics EWMA). */
export const EWMA_LAMBDA = 0.94;
export const FORECAST_HORIZON = 10;
/** %90'lık iki yanlı bant için normal dağılım çarpanı. */
export const BAND_Z = 1.645;

/** Ölçü pencereleri. */
export const ATR_PERIOD = 14;
export const VOL_SHORT = 10;
export const VOL_LONG = 20;
export const MA_WINDOWS = [50, 100, 200] as const;
export type MaWindow = (typeof MA_WINDOWS)[number];
export const PERCENTILE_WINDOW = 252;
export const BETA_WINDOW = 252;
