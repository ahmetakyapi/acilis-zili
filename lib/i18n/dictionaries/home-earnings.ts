/**
 * `homeEarnings` ad alanı — ana sayfanın "Bugün Bilanço Açıklayanlar"
 * paneli (11 Kasım: akışla bölüşüm ve geniş düzen). Gerekçe
 * `components/today/home/EarningsToday.tsx` ve `lib/earnings-today-split.ts`.
 * Ayrı dosyada: paralel paketler sözlüğün ortasına anahtar serpiştirmesin.
 */

export const homeEarningsTr = {
  /* Geniş düzende piyasa değeri sütununun künyesi. */
  marketCap: "Piyasa Değeri",
  /* Panelin dibindeki künye: akışta duran, sonucu bekleyen bilançolar
     burada tekrar edilmiyor; semboller önde, bu söz ardında. */
  inFlow: "Saati ve Beklentisiyle Bugünün Akışı'nda",
  /* Künyenin ekran okuyucu cümlesi. {list} semboller. */
  inFlowAria: "{list}: saati ve beklentisiyle Bugünün Akışı'nda",
};

export const homeEarningsEn: typeof homeEarningsTr = {
  marketCap: "Market Cap",
  inFlow: "With Times and Estimates in Today's Flow",
  inFlowAria: "{list}: with times and estimates in Today's Flow",
};
