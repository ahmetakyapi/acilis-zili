/**
 * `homeDesk` ad alanı — ana sayfanın bülten kartı, Dünya Piyasaları ve
 * Günün Hareketleri panellerinin ölçü katmanı (6 Kasım görsel tur).
 * Sözlüğün parçası (tr.ts / en.ts bunu `homeDesk` anahtarına koyuyor),
 * ayrı dosyada: paralel geliştirilen paketler sözlüğün ortasına anahtar
 * serpiştirmesin (bkz. brief-ledger.ts).
 */

export const homeDeskTr = {
  /* Bülten kartının imzası — başlığın ALTINDA (üst künye yok, 9 Ekim).
     {time} İstanbul saati. */
  byline: "{time} Yayımlandı",
  bylineClaude: "Claude · {time} Yayımlandı",
  /* Endeks şeridinin dipnotu. Şerit SPY, QQQ, DIA ve IWM'in gün barından
     (`getBriefLedger`, Alpaca); rutinin metni endeksin kendisini ya da
     yazıldığı anın kotasyonunu anabiliyor (6 Kasım: metinde "S&P 500
     %4,36", şeritte SPY −%4,41). İkisi de doğru, kaynakları farklı —
     dipnot hangisinin ne olduğunu söylüyor, metne dokunulmuyor. */
  fundNote:
    "Şerit, endeksleri izleyen fonların ({symbols}) asıl seans kapanışı; metindeki endeks yüzdesi kaynak ve saat farkıyla birkaç baz puan ayrışabilir.",
  figuresLabel: "Günün Verileri",
  /* Açıklanan verinin künyesi: "Beklenti 55 Bin". */
  forecast: "Beklenti {value}",
  previous: "Önceki {value}",
  aboveForecast: "Beklentinin {diff} Üstünde",
  belowForecast: "Beklentinin {diff} Altında",
  inlineForecast: "Beklentiyle Aynı",
  abovePrevious: "Öncekinin {diff} Üstünde",
  belowPrevious: "Öncekinin {diff} Altında",
  inlinePrevious: "Öncekiyle Aynı",
  unitPoint: "Puan",
  unitThousand: "Bin",
  /* Ölçeğin künyesi — panel başlığının sağında. */
  scale: "Ortak Ölçek ±{value}",
  /* Ekran okuyucu: "Türkiye, TUR, −%1,24". */
  rowAria: "{name}, {symbol}, {value}",
};

export const homeDeskEn: typeof homeDeskTr = {
  byline: "Published {time}",
  bylineClaude: "Claude · Published {time}",
  fundNote:
    "The strip shows the regular-session close of the funds tracking the indices ({symbols}); an index figure in the text can differ by a few basis points due to source and timing.",
  figuresLabel: "Today's Data",
  forecast: "Forecast {value}",
  previous: "Previous {value}",
  aboveForecast: "{diff} Above Forecast",
  belowForecast: "{diff} Below Forecast",
  inlineForecast: "In Line With Forecast",
  abovePrevious: "{diff} Above Previous",
  belowPrevious: "{diff} Below Previous",
  inlinePrevious: "Same as Previous",
  unitPoint: "pp",
  unitThousand: "K",
  scale: "Shared Scale ±{value}",
  rowAria: "{name}, {symbol}, {value}",
};
