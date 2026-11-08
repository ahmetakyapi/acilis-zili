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
     dipnot hangisinin ne olduğunu söylüyor, metne dokunulmuyor. Yalnız
     GÜNLÜK kartta ve metin endeks yüzdesi andığında basılır (6 Kasım,
     inceleme; kural lib/brief-ledger.ts → `mentionsIndexPercent`). */
  fundNote:
    "Şerit, endeksleri izleyen fonların ({symbols}) asıl seans kapanışı; metindeki endeks yüzdesi kaynak ve saat farkıyla birkaç baz puan ayrışabilir.",
  /* "Günün Verileri" idi (6 Kasım, ilk tarama): kart bugünün tarihini
     taşırken altındaki faiz/VIX/kur seansın kapanışıydı ve "günün" sözü
     bugünü düşündürüyordu; aynı sırada bülten sabahı açıklanan veriler de
     duruyor (`briefReleases`), "seansın" da tam doğru olmazdı. */
  figuresLabel: "Öne Çıkan Veriler",
  /* Açıklanan verinin tabanı: "Beklenti 55 Bin". Sapma künyesi ("Beklentinin
     6 Bin Altında") burada değil: takvimin sözcükleri
     (`calendarVisuals.released`, `deviationVerdict`) — 6 Kasım'a kadar
     buradaki birebir kopyası kullanılıyordu (inceleme: iki kopya er geç
     ayrı düşer; EN'de "In Line With" zaten ayrı düşmüştü). */
  forecast: "Beklenti {value}",
  previous: "Önceki {value}",
  /* Ölçeğin künyesi. 8 Kasım'dan beri ekranda yazı olarak değil EKSEN
     olarak duruyor (−%4,1 · 0 · +%4,1, şeritlerin üstünde, aynı hatta —
     HomeLane.tsx → `LaneAxis`); bu cümle eksenin ekran okuyucu adı. */
  scale: "Ortak Ölçek ±{value}",
  /* Ekran okuyucu: "Türkiye, TUR, −%1,24". */
  rowAria: "{name}, {symbol}, {value}",
  /* Yükselenler / Düşenler grup başlığının sayacı: bu seansta işlem görüp
     o yöne gidenlerin TAMAMI (listede yalnız ilk üç–beşi var). */
  moversCount: "{n} Hisse",
  moversCountOne: "{n} Hisse",
};

export const homeDeskEn: typeof homeDeskTr = {
  byline: "Published {time}",
  bylineClaude: "Claude · Published {time}",
  fundNote:
    "The strip shows the regular-session close of the funds tracking the indices ({symbols}); an index figure in the text can differ by a few basis points due to source and timing.",
  figuresLabel: "Key Figures",
  forecast: "Forecast {value}",
  previous: "Previous {value}",
  scale: "Shared Scale ±{value}",
  rowAria: "{name}, {symbol}, {value}",
  moversCount: "{n} Stocks",
  moversCountOne: "{n} Stock",
};
