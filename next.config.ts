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
/** Çerçeve dışındaki güvenlik başlıkları — gömülü parçalar da taşıyor. */
const BASE_SECURITY_HEADERS = [
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

const SECURITY_HEADERS = [
  // Tıklama hırsızlığı: site başka bir sayfanın içine gömülemez.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  ...BASE_SECURITY_HEADERS,
];

/**
 * GÖMÜLÜ PARÇALAR (`/gomulu/*`) — çerçeve yasağının TEK istisnası.
 *
 * Geri sayım ve haftanın bilançoları başka sitelere `<iframe>` ile
 * konabilsin diye var; `frame-ancestors 'none'` onları her yerde boş bir
 * kutuya çeviriyordu. Yasak GEVŞETİLMİYOR, bu yollarda DEĞİŞTİRİLİYOR:
 *
 * - Tıklama hırsızlığının riski, çerçevenin içinde okuyucunun farkında
 *   olmadan tetikleyebileceği bir EYLEM olması (hesap silme, takip
 *   listesine ekleme, form gönderme). Bu sayfalarda hiçbiri yok: oturum
 *   okunmuyor, form yok, sunucu eylemi yok; tek etkileşim yeni sekmede
 *   açılan bir kaynak bağlantısı. Çerçevelenecek bir yetki yok.
 * - Üçüncü taraf çerçevede çerezler zaten gitmiyor (SameSite=Lax), yani
 *   parça giriş yapmış okuyucunun oturumuyla da çizilemiyor.
 * - `X-Frame-Options` bu yollarda HİÇ gönderilmiyor: başlığın "her yere
 *   izin ver" değeri yok, DENY kalırsa CSP'yi tanımayan eski tarayıcılar
 *   parçayı yine boş gösterirdi. Modern tarayıcılar CSP'nin
 *   `frame-ancestors *` değerini okuyor.
 *
 * Sitenin geri kalanı DENY'de kalıyor: istisna yol düzeyinde ve genel
 * kuralın kaynak deseni bu yolları dışarıda bırakıyor (aşağıda). İki
 * kuralın aynı başlığı yazıp birbirini ezmesine güvenilmedi: Next'te
 * sonraki kural kazanıyor ama sıra değişirse sessizce açık kalırdı.
 */
const EMBED_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors *" },
  ...BASE_SECURITY_HEADERS,
];

/** `/gomulu` ve `/en/gomulu` DIŞINDAKİ her yol (kök `/` dahil). */
const NOT_EMBED_SOURCE = "/:path((?!gomulu(?:/|$)|en/gomulu(?:/|$)).*)";
const EMBED_SOURCES = ["/gomulu/:path*", "/en/gomulu/:path*"];

/**
 * DİZİNE GİRMEYECEK YOLLAR — başlıkla, sayfanın künyesinden BAĞIMSIZ.
 *
 * Kişisel ekranlar (`/favoriler`, `/ayarlar`, gelecek `/portfoy`) ve
 * panel künyelerinde zaten `noindex` taşıyor; ama künye sayfa dosyasının
 * içinde ve yeni bir rota onu unutabiliyor. `X-Robots-Tag` aynı sözü yol
 * düzeyinde veriyor: `/portfoy` başka bir iş paketiyle gelecek ve o gün
 * burada zaten kapalı olacak. Gömülü parçalar da burada: başka sitelerin
 * içinde çizilen kısa kutular, kendi başına bir arama sonucu değil.
 *
 * `robots.txt`e YAZILMIYOR — gerekçesi `app/robots.ts` başında: `Disallow`
 * taramayı engeller ve arama motoru bu başlığı hiç okuyamaz.
 */
const NOINDEX_PATHS = ["/gomulu", "/portfoy", "/favoriler", "/ayarlar", "/admin"];
const NOINDEX_SOURCES = NOINDEX_PATHS.flatMap((path) => [
  path,
  `${path}/:path*`,
  `/en${path}`,
  `/en${path}/:path*`,
]);

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: NOT_EMBED_SOURCE, headers: SECURITY_HEADERS },
      ...EMBED_SOURCES.map((source) => ({ source, headers: EMBED_HEADERS })),
      ...NOINDEX_SOURCES.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
        // API yanıtları hiçbir katmanda önbelleğe alınmasın: fiyatın ya da
        // yetkili bir ucun eski kopyasının servis edilmesi kabul edilemez.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
      {
        /* LOGOLAR TARAYICIDA KALIR.
           `public/` altındaki her dosya Next'in varsayılanıyla
           `public, max-age=0` dönüyordu: 1,4 KB'lık bir logo bile HER
           gezinmede yeniden isteniyor. Endeks bileşenleri tablosunda altmış
           logo var, yani sayfa her açıldığında altmış koşullu istek — ve
           telefonda (5G, yüksek gecikme, tembel yükleme) bunların bir kısmı
           düşüyor. Düşen istek ekranda kırık görsel simgesi olarak duruyor;
           okuyucunun gördüğü "bazı şirketlerin logosu yok" oluyor
           (ölçüldü: dosyalar 200 dönüyor, bayt bayt doğru).

           Dosyalar içerik adresli DEĞİL (`/logos/NVDA.webp` sabit bir ad),
           o yüzden `immutable` değil bir haftalık tazelik + bir aylık
           `stale-while-revalidate`: logo değişirse (`npm run build:logos`)
           okuyucu en geç bir hafta içinde yenisini alır, o zamana kadar da
           hiçbir istek atmaz. Logolar yılda birkaç kez değişiyor, bir
           haftalık gecikme bedeli yok. */
        source: "/logos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=2592000",
          },
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
    /* İYİLEŞTİRİCİ TAMAMEN KAPALI.
       Yukarıdaki ayarlar (31 günlük önbellek, iki genişlik) dönüşüm sayısını
       düşürüyordu ama kotaya bağlı kalmaya devam ediyordu — ve kota dolunca
       iyileştirici HTTP 402 döndü, büyük şirketlerin logoları ekranda kırık
       göründü. Kapalıyken `next/image` düz bir `<img>` basıyor; hiçbir kod
       yolu bir daha dönüşüm faturalayamaz.

       Boyut küçültme kaybolmuyor, YERE DEĞİŞTİRDİ: logolar `public/logos/`
       altında 128 piksellik webp olarak duruyor (ortalama 1,4 KB) ve
       `scripts/build-logos.mjs` tarafından bir kez üretiliyor. */
    unoptimized: true,
    /* Manifeste girmemiş yeni bir sembolün logosu hâlâ kaynaktan gelebilir;
       `unoptimized` ile proxy'lenmiyor ama izin listesi yerinde kalsın. */
    remotePatterns: [
      { protocol: "https", hostname: "static2.finnhub.io" },
      { protocol: "https", hostname: "static.finnhub.io" },
    ],
  },
  experimental: {
    turbopackFileSystemCacheForDev: true,
    /* Yirmi yedi dosya ikonları `@phosphor-icons/react/dist/ssr` barrel'ından
       çekiyor ve o giriş noktası binden fazla ikonu tek tek yeniden dışa
       aktarıyor. Üretim demeti ağaç sarsmayla temizleniyor (paket
       `sideEffects: false` taşıyor) ama her derlemede ve her dev sayfa
       açılışında bu modül grafiği çözümleniyordu. Next'in varsayılan
       listesinde lucide ve heroicons var, Phosphor yok. Çağrı yerlerinde
       değişiklik gerekmiyor; derleyici tek tek alt yollara çeviriyor. */
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
