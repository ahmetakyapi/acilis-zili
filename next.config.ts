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
  /**
   * Görsel optimizasyonu — dönüşüm sayısı için ayarlandı.
   *
   * Sitedeki TEK görsel kaynağı şirket logoları: 671 sembol, hepsi
   * `static2.finnhub.io`, hepsi 1000×1000 PNG ve 30-83 KB. Vercel ücretsiz
   * kotası bir ayda doldu (3.748 dönüşüm) ve sebebi ölçüldü.
   *
   * `unoptimized` ÇÖZÜM DEĞİL, ilk akla gelen o olsa da: Vercel'in belgesi
   * "10 KB altındaki görselleri optimize etme" diyor ama bizimkiler 30-83 KB
   * ve ekranda 22-64 piksellik yuvalarda duruyor. Optimizasyonu kapatmak,
   * 26 piksellik bir hücreye 60 KB'lık bir PNG yollamak demek — telefonda
   * altmış logolu bir listede 3,6 MB.
   *
   * İki gerçek sebep vardı:
   *
   * 1) ÖNBELLEK ÖMRÜ. Finnhub logoları `cache-control: no-store` ile
   *    yayınlıyor; Next bunu `Math.max(minimumCacheTTL, üstKaynak)` ile
   *    tabanlıyor, yani ömrü belirleyen tek şey bizim değerimiz. Varsayılan
   *    4 saat: aynı logo ayda 180 kez yeniden dönüştürülüyordu. Logolar
   *    yıllarca değişmiyor — 31 güne çekildi.
   *
   * 2) GENİŞLİK SAYISI. Çağrı yerleri 16'dan 64'e onbir ayrı `width`
   *    kullanıyor ve Next her biri için 1x + 2x istiyor; varsayılan
   *    `imageSizes` ile bu 32, 48, 64, 96, 128 olmak üzere BEŞ ayrı
   *    genişliğe çıkıyordu. Her (logo × genişlik) çifti ayrı bir dönüşüm.
   *    Liste ikiye indirildi: artık hangi `width` yazılırsa yazılsın yalnızca
   *    64 ve 128 üretilebiliyor. 64 tek kat ekranları, 128 retinada en büyük
   *    yuvayı (64 piksel) karşılıyor.
   *
   *    Kural çağrı yerlerinde değil BURADA duruyor, bilerek: on altı ayrı
   *    dosyadaki `width` değerlerini hizalamak bir kereliğine çözerdi,
   *    liste ise yarın yazılacak on yedinciyi de bağlıyor.
   *
   * Beklenen sonuç: dönüşüm sayısı trafikle değil KATALOG BÜYÜKLÜĞÜYLE
   * sınırlanıyor — 671 logo × 2 genişlik = ayda en çok 1.342, üstelik
   * bunun için bütün katalogun görüntülenmiş olması gerekiyor.
   *
   * `formats` ve `qualities` varsayılanda bırakıldı: ikisi de zaten TEK
   * değer taşıyor (`image/webp`, 75) ve Vercel'in "birden fazlaysa birini
   * kaldır" önerisi bizde karşılıksız.
   */
  images: {
    remotePatterns: [
      // Finnhub şirket logoları
      { protocol: "https", hostname: "static2.finnhub.io" },
      { protocol: "https", hostname: "static.finnhub.io" },
    ],
    /* 31 gün. Logo değişirse (şirket markasını yeniler) bir aya kadar eski
       hâli görünür — kabul edilebilir, çünkü alternatifi her dört saatte bir
       yeniden dönüştürmek. */
    minimumCacheTTL: 2678400,
    imageSizes: [64, 128],
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;
