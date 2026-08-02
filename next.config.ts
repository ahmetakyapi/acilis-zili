import type { NextConfig } from "next";

/**
 * Güvenlik başlıkları.
 *
 * Hiçbiri yoktu. Buradakiler "kırılma riski sıfıra yakın, faydası somut"
 * kümesi — tam bir CSP bilinçli olarak dışarıda: Next'in satır içi
 * önyükleme script'i ve satır içi stiller `unsafe-inline` gerektiriyor, o da
 * CSP'nin XSS'e karşı faydasının büyük kısmını götürüyor. Nonce tabanlı
 * doğru bir CSP ayrı bir iş; yarım yapılmış hâli yanlış bir güvenlik hissi
 * verir.
 *
 * frame-ancestors CSP olarak da veriliyor çünkü X-Frame-Options'ın aksine
 * modern tarayıcılarda önceliği var; ikisi birlikte duruyor, eski
 * tarayıcılar hâlâ X-Frame-Options okuyor.
 */
const SECURITY_HEADERS = [
  // Tıklama hırsızlığı: site başka bir sayfanın içine gömülemez.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Tarayıcı içerik türünü tahmin etmesin — MIME karışıklığı saldırısı.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Dış bağlantılara tam adres sızmasın; site içinde tam yol kalsın.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kullanılmayan güçlü API'ler kapalı: site hiçbirini istemiyor.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Bir yıl boyunca yalnızca HTTPS. Vercel zaten yönlendiriyor; bu, ilk
  // isteğin de şifreli olmasını garantiler.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        // API yanıtları hiçbir katmanda önbelleğe alınmasın: fiyatın ya da
        // yetkili bir ucun eski kopyasının servis edilmesi kabul edilemez.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
  // Ana dizinde başka bir lockfile var; kökü açıkça bu projeye sabitle.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Finnhub şirket logoları
      { protocol: "https", hostname: "static2.finnhub.io" },
      { protocol: "https", hostname: "static.finnhub.io" },
    ],
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
