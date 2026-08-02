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
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
