import type { MetadataRoute } from "next";

/**
 * Web uygulaması künyesi — telefona "ana ekrana ekle" ile kurulduğunda
 * kullanılır. Zaten `appleWebApp` ayarı vardı ama Android tarafı bu dosya
 * olmadan uygulama gibi açılmıyordu; adres çubuğu kalıyordu.
 *
 * `display: standalone` + `theme_color` ikilisi, kurulu hâlde sistem
 * çubuğunun sayfa zeminiyle aynı renkte olmasını sağlıyor.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Açılış Zili — ABD Piyasa Takibi",
    short_name: "Açılış Zili",
    description:
      "ABD borsalarında bugün ne var: ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin tek ekranda.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f9fb",
    theme_color: "#f7f9fb",
    lang: "tr",
    dir: "ltr",
    categories: ["finance", "news", "business"],
    /* PNG'ler ŞART. Burada yalnızca `icon.svg` ve apple ikonu duruyordu ve
       Chrome'un kurulum ölçütü karşılanmıyordu: en az 192 ve 512 boyutunda
       PNG arıyor, ikisi de yoksa "ana ekrana ekle" istemi hiç çıkmıyor,
       elle eklendiğinde de sistem kendi ürettiği bulanık bir kopyayı
       kullanıyordu.

       MASKELİ AYRI GİRDİ. Android ikonu kendi şekliyle kırpıyor (daire,
       kare, damla — üreticiye göre değişiyor) ve güvenli alan yalnızca
       ortadaki %80'lik daire. Yuvarlatılmış karo gönderilirse köşeler
       kırpılıp kenarda saydam bir ısırık kalıyor; maskeli sürüm tam taşma
       degrade ve zil bir kademe küçük.

       Dosyalar `npm run build:favicon` ile üretiliyor, kaynak icon.svg. */
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
