/* ==========================================================================
   Aracı kurum karşılaştırması — veri katmanı (24 Ekim 2026)

   `/araci-kurumlar` sayfasının TEK kaynağı. Türkiye'den ABD hissesi
   alınabilen kurumların ABD tarifesi, hücre hücre ve her hücre kendi
   kaynağıyla.

   NEDEN DEPODA, VERİTABANINDA DEĞİL: rehberle aynı gerekçe
   (`content/guide/index.ts`). Bir ücretin yanlış yazılması bir fiyatın eski
   kalmasından pahalı; her değişiklik kod incelemesinden geçsin ve sürüm
   geçmişinde dursun.

   ÜÇ KURAL — sayfanın var olma sebebi tarafsızlık, kurallar onu koruyor:

   1. UYDURMA YOK. Kurumun kendi resmî sayfasında ya da tarife PDF'inde
      okunmayan hücre `unspecified` olur ve ekranda "Belirtilmemiş" yazar.
      Blog, forum, karşılaştırma sitesi kaynak sayılmadı; yalnızca resmî
      sayfayı bulmak için kullanıldı.
   2. HER HÜCRENİN KAYNAĞI VE DOĞRULAMA GÜNÜ VAR. Hücre `src` ile kurumun
      `sources` listesine bağlanıyor; doğrulama günü kaynakta (`checked`).
      Tarifenin kendi tarihi biliniyorsa ayrıca `docDate`.
   3. KAYNAKLAR ÇELİŞİYORSA ÇELİŞKİ GÖSTERİLİR, biri seçilmez (Yapı Kredi
      Yatırım: üç resmî sayfa üç ayrı ABD tarifesi veriyor). Senaryo hesabı
      o kurumu dışarıda bırakıyor ve nedenini söylüyor.

   Lisans durumu SPK'nın aracı kurum faaliyet izinleri listesinden
   (spk.gov.tr/faaliyet-izinleri/araci-kurumlar; sayfa listeyi
   /FaaliyetIzinleri/api/AraciKurumFaaliyetIzinleri ucundan yüklüyor, 24
   Ekim'de 70 kayıt). Interactive Brokers o listede yok.

   YÖNLENDİRME YOK: hiçbir bağlantı ortaklık (affiliate) kodu taşımaz;
   kaynak bağlantıları kurumun tarife sayfasına gider, hesap açma sayfasına
   değil. Sıra alfabetik değil, görevin verdiği sırayla da değil: yerli
   kurumlar (SPK listesindeki unvanla) önce, yabancı kurum sonda. Sıra bir
   sıralama değildir; sayfa bunu söylüyor.

   GÜNCELLEME: tarife değişince hücreyi ve kaynağın `checked` gününü birlikte
   değiştir. `BROKERS_CHECKED` sayfanın künyesindeki gün; bütün kaynaklar
   aynı gün yeniden okunmadıysa en eski `checked` gününü yaz.
   ========================================================================== */

export type Bi = { tr: string; en: string };

/** Kaynak: kurumun resmî sayfası ya da tarife belgesi. */
export type BrokerSource = {
  url: string;
  title: Bi;
  /** Sayfanın açılıp okunduğu gün ("YYYY-MM-DD"). */
  checked: string;
  /** Belgenin kendi tarihi ya da sürüm kodu, belgede yazıyorsa. */
  docDate?: string;
};

/**
 * Tablo hücresi.
 *
 * `value` kaynakta okunan bilgi, kısaltılmış ve Türkçeleştirilmiş; `note`
 * hücrenin altına düşen küçük açıklama (çelişki, kapsam, kanal).
 * `unspecified`: kurumun resmî kaynaklarında bulunamadı. Not ve kaynak
 * yine verilebilir: "W-8BEN belirtilmemiş ama temettüde %20 yazıyor".
 */
export type BrokerCell =
  | {
      kind: "value";
      value: Bi;
      note?: Bi;
      src: readonly string[];
      /**
       * Kaynak bu kalemin OLMADIĞINI açıkça yazıyorsa (kartta ✗). Bulunamayan
       * bilgi bu değil, o `unspecified`. 25 Ekim'de hiçbir hücre bunu
       * taşımıyor: okunan sayfaların hiçbiri "yok" demiyor, yalnız susuyor.
       */
      absent?: true;
      /** Not bir DÜRÜSTLÜK NOTU: çelişki, belirsiz birim, eksik oran (aşağıda `caveat`). */
      caveat?: true;
    }
  | { kind: "unspecified"; note?: Bi; src?: readonly string[]; caveat?: true };

/**
 * Senaryo hesabına giren komisyon modeli. Yalnızca tarifeden TEK ANLAMLI
 * çıkan modeller; çıkmıyorsa `none` ve nedeni.
 */
export type CommissionModel =
  | { kind: "flat"; usd: number }
  | { kind: "percent"; pct: number; minUsd: number }
  | { kind: "perShare"; usd: number; minUsd: number; maxPctOfTrade?: number }
  | { kind: "none"; reason: Bi };

/**
 * Yıllık maliyet hesabına giren SAKLAMA modeli (25 Ekim, kurum logoları
 * turu). Hücredeki (`cells.custody`) bilginin hesaplanabilir hâli; aynı
 * kaynaktan, aynı değerle — çelişmemesi testte (tests/broker-board.test.ts).
 *
 * `free`: kaynak ABD hissesinde saklama ücreti olmadığını AÇIKÇA yazıyor.
 * `unknown`: kaynakta bulunamadı; hesap bu kurumda saklamayı SIFIR saymaz,
 * "belirtilmemiş" diye işaretler. `floorEurMonth`: oranın yanında avro
 * cinsinden aylık asgari var; sayfa kur varsaymadığı için hesaba girmiyor,
 * ekranda ayrıca yazıyor.
 */
export type CustodyModel =
  | { kind: "free" }
  | { kind: "pctYear"; pct: number; floorEurMonth?: number }
  | { kind: "pctMonth"; pct: number }
  | { kind: "unknown" };

export const BROKER_COLUMNS = [
  "commission",
  "minimum",
  "custody",
  "fractional",
  "data",
  "w8ben",
  "options",
  "license",
] as const;

export type BrokerColumn = (typeof BROKER_COLUMNS)[number];

export type Broker = {
  id: string;
  name: string;
  /** SPK listesindeki unvan ya da kurumun yasal adı. */
  legalName: string;
  /** Kanal ya da ürün adı (TradeMaster International, InfoX...). */
  channel?: Bi;
  /** Yurt dışında emri yürüten ya da altyapı sağlayan kurum — resmî sayfada yazıyorsa. */
  counterparty?: { value: Bi; src: readonly string[] };
  domestic: boolean;
  /**
   * Lisans durumunun rozet için özeti (25 Ekim, kart görünümü). Kaynağı
   * `cells.license` ile aynı: SPK faaliyet izinleri listesi. "Geniş" ve
   * "Kısmi" SPK'nın kendi sınıfları; yabancı kurum listede yok. Hücre metni
   * ile çelişmemesi testte (tests/broker-cards.test.ts).
   */
  licence: "full" | "partial" | "foreign";
  cells: Record<BrokerColumn, BrokerCell>;
  commission: CommissionModel;
  custodyModel: CustodyModel;
  sources: Record<string, BrokerSource>;
};

/** Sayfa künyesindeki doğrulama günü — en eski `checked`. */
export const BROKERS_CHECKED = "2026-10-24";

const CHECKED = BROKERS_CHECKED;

const SPK_LIST: BrokerSource = {
  url: "https://spk.gov.tr/faaliyet-izinleri/araci-kurumlar",
  title: { tr: "SPK, Aracı Kurum Faaliyet İzinleri", en: "CMB, brokerage licence register" },
  checked: CHECKED,
};

const v = (tr: string, en: string, src: readonly string[], note?: Bi): BrokerCell => ({
  kind: "value",
  value: { tr, en },
  src,
  ...(note ? { note } : {}),
});

/**
 * Notu bir DÜRÜSTLÜK NOTU olan hücre (25 Ekim, telefon kartı): kaynaklar
 * çelişiyor, tarifenin birimi belirsiz, oran yok ya da hesabın hangi
 * şirkette açıldığı yazmıyor. Telefonda notlar kartın içinde katlı; bu
 * işaretli bir not varsa katlama düğmesinin yanında "Not Var" görünüyor —
 * okur katlının içinde değeri değiştiren bir uyarı olduğunu bilsin.
 */
const caveat = (cell: BrokerCell): BrokerCell => ({ ...cell, caveat: true });

const none = (note?: Bi, src?: readonly string[]): BrokerCell => ({
  kind: "unspecified",
  ...(note ? { note } : {}),
  ...(src ? { src } : {}),
});

const GENIS = (src = ["spk"]) =>
  v("Geniş Yetkili Aracı Kurum", "Full-scope broker (CMB)", src);

export const BROKERS: readonly Broker[] = [
  /* ---- Midas ------------------------------------------------------------ */
  {
    id: "midas",
    name: "Midas",
    legalName: "Midas Menkul Değerler A.Ş.",
    domestic: true,
    licence: "partial",
    counterparty: {
      value: { tr: "Alpaca Securities LLC", en: "Alpaca Securities LLC" },
      src: ["owner"],
    },
    commission: { kind: "flat", usd: 1.5 },
    custodyModel: { kind: "free" },
    sources: {
      fees: {
        url: "https://www.getmidas.com/ucretler/",
        title: { tr: "Midas, Ücretler", en: "Midas, fees" },
        checked: CHECKED,
      },
      fractional: {
        url: "https://www.getmidas.com/destek/amerikan-borsasi/alim-satim-islemleri-ve-emirler/tutar-veya-adet-ile-parca-hisse-alim-satimi-nasil-yapilir",
        title: { tr: "Midas Destek, Parça Hisse Alım Satımı", en: "Midas help, fractional trading" },
        checked: CHECKED,
      },
      dividend: {
        url: "https://www.getmidas.com/destek/amerikan-borsasi/temettu/temettu-nedir",
        title: { tr: "Midas Destek, Temettü Nedir", en: "Midas help, dividends" },
        checked: CHECKED,
      },
      owner: {
        url: "https://www.getmidas.com/destek/midas-hakkinda/midas-sirketi/midasta-aldigim-hisselerin-sahibi-ben-miyim",
        title: { tr: "Midas Destek, Hisselerin Sahibi Kim", en: "Midas help, who owns the shares" },
        checked: CHECKED,
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: v("İşlem başına sabit 1,5 $", "Flat $1.50 per trade", ["fees"], {
        tr: "Fiyatı 1 $ altındaki hissede 300 adet üstüne adet başına 0,005 $ eklenir.",
        en: "Stocks under $1: $0.005 per share above 300 shares.",
      }),
      minimum: v("Ayrı asgari yok; ücret sabit", "No separate minimum; fee is flat", ["fees"]),
      custody: v("Hesap işletimi ücretsiz", "No account fee", ["fees"], {
        tr: "ADR'de hisse başına 0,01-0,03 $ dönemsel ücret.",
        en: "ADRs: $0.01-0.03 per share, periodic.",
      }),
      fractional: v("Var", "Yes", ["fractional"], {
        tr: "Tutarla emir her hissede geçerli değil.",
        en: "Not available on every stock.",
      }),
      data: v("Ücretsiz", "Free", ["fees"]),
      w8ben: none(
        {
          tr: "Destek sayfası temettüde %20 kesinti yazıyor.",
          en: "Help page states 20% dividend withholding.",
        },
        ["dividend"],
      ),
      options: v("Var; kontrat başına 1,50 $", "Yes; $1.50 per contract", ["fees"], {
        tr: "Ayda 500 kontrat üstünde 0,25 $ ya da 0,50 $.",
        en: "Above 500 contracts a month: $0.25 or $0.50.",
      }),
      license: v("Kısmi Yetkili Aracı Kurum", "Partial-scope broker (CMB)", ["spk"]),
    },
  },

  /* ---- İş Yatırım -------------------------------------------------------- */
  {
    id: "is-yatirim",
    name: "İş Yatırım",
    legalName: "İş Yatırım Menkul Değerler A.Ş.",
    channel: { tr: "TradeMaster International", en: "TradeMaster International" },
    domestic: true,
    licence: "full",
    commission: { kind: "percent", pct: 0.25, minUsd: 1 },
    custodyModel: { kind: "pctMonth", pct: 0.0042 },
    sources: {
      tariff: {
        url: "https://trademaster.com.tr/media/nwjheyia/yurtdisi-islemler-komisyon-masraf-tablosu.pdf",
        title: { tr: "TradeMaster, Yurt Dışı Komisyon ve Masraf Tablosu", en: "TradeMaster, international fee table" },
        checked: CHECKED,
        docDate: "2026-09-11",
      },
      deck: {
        url: "https://trademaster.com.tr/media/cbyhirzz/tmi-sunum.pdf",
        title: { tr: "TradeMaster International Sunumu", en: "TradeMaster International deck" },
        checked: CHECKED,
      },
      annex: {
        url: "https://www.isyatirim.com.tr/tr-tr/destek/Documents/pdf/komisyon-ve-masraf-tarifesi.pdf",
        title: { tr: "İş Yatırım, Komisyon ve Masraf Tarifesi (Ek-8)", en: "İş Yatırım, fee schedule (annex 8)" },
        checked: CHECKED,
        docDate: "KMT-28082026-20",
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: v("%0,25", "0.25%", ["tariff", "annex"], {
        tr: "Seans dışı emirde adet başına 0,5 sent ek; satışta SEC ücreti.",
        en: "Extended hours: +0.5¢ per share; SEC fee on sales.",
      }),
      minimum: v("1 $", "$1", ["tariff"]),
      custody: v("Aylık yüzbinde 4,2", "0.0042% a month", ["tariff"], {
        tr: "TL'ye çevrilmiş değer üzerinden. ADR'de 6 ayda bir hisse başına 0,03 $.",
        en: "On the lira value. ADRs: $0.03 per share every 6 months.",
      }),
      fractional: none(),
      data: none(
        { tr: "Abonelik ücretleri platformun içinde gösteriliyor.", en: "Subscription prices are shown inside the platform." },
        ["deck"],
      ),
      w8ben: none(),
      options: v("Var; sözleşme başına 5 $", "Yes; $5 per contract", ["tariff"]),
      license: GENIS(),
    },
  },

  /* ---- Garanti BBVA Yatırım ---------------------------------------------- */
  {
    id: "garanti-bbva-yatirim",
    name: "Garanti BBVA Yatırım",
    legalName: "Garanti Yatırım Menkul Kıymetler A.Ş.",
    domestic: true,
    licence: "full",
    commission: { kind: "percent", pct: 0.3, minUsd: 0 },
    custodyModel: { kind: "pctYear", pct: 0.06 },
    sources: {
      fees: {
        url: "https://www.garantibbvayatirim.com.tr/tr/ucret-ve-komisyonlar",
        title: { tr: "Garanti BBVA Yatırım, Ücret ve Komisyonlar", en: "Garanti BBVA Yatırım, fees" },
        checked: CHECKED,
      },
      product: {
        url: "https://www.garantibbvayatirim.com.tr/urunlerimiz/yurt-disi-hisse-pay-senedi",
        title: { tr: "Garanti BBVA Yatırım, Yurt Dışı Hisse", en: "Garanti BBVA Yatırım, foreign stocks" },
        checked: CHECKED,
      },
      data: {
        url: "https://www.garantibbvayatirim.com.tr/duyurular/170225",
        title: { tr: "Garanti BBVA Yatırım Duyurusu, ABD Anlık Veri", en: "Garanti BBVA Yatırım notice, US real-time data" },
        checked: CHECKED,
        docDate: "2025-02-17",
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: v("Binde 3 (BSMV dahil)", "0.3% (tax included)", ["fees"], {
        tr: "Piyasa öncesi emirde adet başına 0,005 $ ek; satışta SEC ücreti.",
        en: "Pre-market: +$0.005 per share; SEC fee on sales.",
      }),
      minimum: v("0 $", "$0", ["fees", "product"]),
      custody: v("Yıllık onbinde 6", "0.06% a year", ["fees"], {
        tr: "ADR'de hisse başına 0,01-0,05 $, yılda 1-4 kez. Döviz çevirme binde 5.",
        en: "ADRs: $0.01-0.05 per share, 1-4 times a year. FX conversion 0.5%.",
      }),
      fractional: none(),
      data: v("ABD borsaları toplam 1 $", "US exchanges $1 in total", ["data"], {
        tr: "Ödeme dönemi duyuruda yazmıyor.",
        en: "Billing period not stated in the notice.",
      }),
      w8ben: none(),
      options: none({ tr: "Tarifede yurt dışı vadeli işlem var, opsiyon yok.", en: "Fee table lists futures, not options." }, ["fees"]),
      license: GENIS(),
    },
  },

  /* ---- Yapı Kredi Yatırım ------------------------------------------------ */
  {
    id: "yapi-kredi-yatirim",
    name: "Yapı Kredi Yatırım",
    legalName: "Yapı Kredi Yatırım Menkul Değerler A.Ş.",
    domestic: true,
    licence: "full",
    commission: {
      kind: "none",
      reason: {
        tr: "Üç resmî sayfa üç ayrı ABD tarifesi veriyor; hangisinin geçerli olduğu kurumdan teyit edilmeli.",
        en: "Three official pages give three different US fee schedules; confirm with the broker which applies.",
      },
    },
    custodyModel: { kind: "unknown" },
    sources: {
      fees: {
        url: "https://www.ykyatirim.com.tr/urunler/hisse-senedi/komisyon-ve-ucretler",
        title: { tr: "Yapı Kredi Yatırım, Komisyon ve Ücretler", en: "Yapı Kredi Yatırım, fees" },
        checked: CHECKED,
      },
      form: {
        url: "https://www.ykyatirim.com.tr/media/xzyf4qve/yurtdisi-islemler-urun-bilgi-formu.pdf",
        title: { tr: "Yapı Kredi Yatırım, Yurt Dışı İşlemler Ürün Bilgi Formu (Örnek)", en: "Yapı Kredi Yatırım, product information form (sample)" },
        checked: CHECKED,
        docDate: "2025-03",
      },
      bank: {
        url: "https://www.yapikredi.com.tr/bireysel-bankacilik/yatirim-urunleri/hisse-senetleri/yurt-disi-hisse-senetleri",
        title: { tr: "Yapı Kredi Bankası, Yurt Dışı Hisse Senetleri", en: "Yapı Kredi Bank, foreign stocks" },
        checked: CHECKED,
      },
      product: {
        url: "https://www.ykyatirim.com.tr/urunler/yurt-disi-hisse-senedi",
        title: { tr: "Yapı Kredi Yatırım, Yurt Dışı Hisse Senedi", en: "Yapı Kredi Yatırım, foreign stocks" },
        checked: CHECKED,
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: caveat(v("Kaynaklar çelişiyor", "Sources disagree", ["fees", "bank", "form"], {
        tr: "Binde 5 (ücret sayfası) · %0,25 (banka sayfası, Yapı Kredi Mobil) · %1 ya da adet başına 0,30 $ (örnek ürün formu).",
        en: "0.5% (fee page) · 0.25% (bank page, mobile app) · 1% or $0.30 per share (sample form).",
      })),
      minimum: caveat(v("Kaynaklar çelişiyor", "Sources disagree", ["fees", "bank", "form"], {
        tr: "12 $ · 0,5 $ · 30 $, aynı sırayla.",
        en: "$12 · $0.50 · $30, same order.",
      })),
      custody: none(
        {
          tr: "Ürün formu: ADR'de yurt dışı kurumun belirlediği saklama masrafı kesilebilir.",
          en: "Product form: ADR custody fees set by the foreign broker may apply.",
        },
        ["form"],
      ),
      fractional: v("Var (Parçalı)", "Yes", ["product"], {
        tr: "Yüksek fiyatlı hisselerde, 0,50 $'dan başlayan komisyonla.",
        en: "On high-priced stocks, commission from $0.50.",
      }),
      data: v("Aylık 1 $", "$1 a month", ["product", "bank"]),
      w8ben: none(
        {
          tr: "Banka SSS'si ABD temettüsünde %30 kesinti yazıyor.",
          en: "Bank FAQ states 30% US dividend withholding.",
        },
        ["bank"],
      ),
      options: v("Ürün formunda var", "In the product form", ["form"], {
        tr: "Kontrat başına 30 $ + borsa payı; ürün sayfasında opsiyon yok.",
        en: "$30 per contract + exchange fee; not on the product page.",
      }),
      license: GENIS(),
    },
  },

  /* ---- QNB Invest -------------------------------------------------------- */
  {
    id: "qnb-invest",
    name: "QNB Invest",
    legalName: "QNB Yatırım Menkul Değerler A.Ş.",
    domestic: true,
    licence: "full",
    commission: { kind: "percent", pct: 0.2, minUsd: 25 },
    custodyModel: { kind: "pctYear", pct: 0.06, floorEurMonth: 6 },
    sources: {
      faq: {
        url: "https://www.qnbinvest.com.tr/yurt-disi-yatirim-islemleri",
        title: { tr: "QNB Invest, Yurt Dışı Yatırım İşlemleri", en: "QNB Invest, international trading" },
        checked: CHECKED,
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: v("%0,2", "0.2%", ["faq"], {
        tr: "Teminattan farklı para biriminde işlemde %0,5 dönüşüm ücreti.",
        en: "0.5% conversion fee when trading in a currency other than the collateral.",
      }),
      minimum: v("25 $", "$25", ["faq"], {
        tr: "12.500 $ altındaki işlemlerde.",
        en: "On trades under $12,500.",
      }),
      custody: v("Yıllık %0,06", "0.06% a year", ["faq"], {
        tr: "Aylık en az 6 €. ADR'de hisse başına 0,01-0,05 $.",
        en: "At least €6 a month. ADRs: $0.01-0.05 per share.",
      }),
      fractional: none(),
      data: v("Ücretli abonelik", "Paid subscription", ["faq"], {
        tr: "Veri gecikmeli; canlı verinin tutarı belirtilmemiş.",
        en: "Data is delayed; real-time price not stated.",
      }),
      w8ben: none(),
      options: none(),
      license: GENIS(),
    },
  },

  /* ---- Gedik Yatırım ----------------------------------------------------- */
  {
    id: "gedik",
    name: "Gedik Yatırım",
    legalName: "Gedik Yatırım Menkul Değerler A.Ş.",
    domestic: true,
    licence: "full",
    counterparty: {
      value: { tr: "GTN; altyapıda Saxo Bank", en: "GTN; Saxo Bank infrastructure" },
      src: ["product"],
    },
    /* "0,05 CENT" Mİ, "0,05 $" MI: tarife "lot adedi başına 0,05 cent"
       yazıyor ama aynı paragraftaki iki bilgi yalnızca 0,05 $ ile tutarlı:
       "1 ile 20 adet ... 1 USD" (20 × 0,05 = 1) ve "30 x 0,05 = 1,5 USD".
       Hesap bu iki bilgiyle yapılıyor; hücre çelişkiyi ayrıca söylüyor. */
    commission: { kind: "perShare", usd: 0.05, minUsd: 1 },
    custodyModel: { kind: "free" },
    sources: {
      tariff: {
        url: "https://cdn.gedik.com/media/media/o1modse2/ydb-komisyon.pdf",
        title: { tr: "Gedik Yatırım, Yurt Dışı Borsalar Komisyon Bilgileri", en: "Gedik Yatırım, international commissions" },
        checked: CHECKED,
      },
      policy: {
        url: "https://gedik.com/ucretlendirme-politikasi",
        title: { tr: "Gedik Yatırım, Ücretlendirme Politikası", en: "Gedik Yatırım, pricing policy" },
        checked: CHECKED,
        docDate: "2026-01-01",
      },
      product: {
        url: "https://gedik.com/urunler/uluslararasi-piyasalar/yurt-disi-borsalar",
        title: { tr: "Gedik Yatırım, Yurt Dışı Borsalar", en: "Gedik Yatırım, international markets" },
        checked: CHECKED,
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: caveat(v("Adet başına 0,05 $", "$0.05 per share", ["tariff", "policy"], {
        tr: "Tarife birimi \"0,05 cent\" yazıyor; örnek hesap 0,05 $ ile yapılmış. Üstüne %5 BSMV.",
        en: "The table says \"0.05 cent\"; its worked example uses $0.05. Plus 5% BSMV tax.",
      })),
      minimum: v("1 $", "$1", ["tariff"], {
        tr: "1-20 adet arası işlemde.",
        en: "For 1-20 shares.",
      }),
      custody: v("ABD hisselerinde yok", "None on US stocks", ["tariff"], {
        tr: "ADR'de adet başına 0,03 $; depo bankası alıyor.",
        en: "ADRs: $0.03 per share, taken by the depositary bank.",
      }),
      fractional: none(),
      data: v("Aylık 1 $'dan başlıyor", "From $1 a month", ["product"], {
        tr: "Ücretsiz veri 15 dakika gecikmeli.",
        en: "Free data is 15 minutes delayed.",
      }),
      w8ben: none(),
      options: v("Var; kontrat başına 5 $ + borsa payı", "Yes; $5 per contract + exchange fee", ["tariff", "product"], {
        tr: "Yalnız call ve put alımı, marjinsiz.",
        en: "Buying calls and puts only, no margin.",
      }),
      license: GENIS(),
    },
  },

  /* ---- İnfo Yatırım ------------------------------------------------------ */
  {
    id: "info-yatirim",
    name: "İnfo Yatırım",
    legalName: "İnfo Yatırım Menkul Değerler A.Ş.",
    channel: { tr: "InfoX ve InfoGlobe", en: "InfoX and InfoGlobe" },
    domestic: true,
    licence: "full",
    commission: {
      kind: "none",
      reason: {
        tr: "Tarife yalnız asgari tutarları veriyor ve uygulananın daha yüksek olabileceğini yazıyor.",
        en: "The fee table only lists minimums and says the applied fee may be higher.",
      },
    },
    custodyModel: { kind: "unknown" },
    sources: {
      tariff: {
        url: "https://cdn.infoyatirim.com/Content/UploadedFile/infoglobe-infox-ucretvekomisyonlar.pdf",
        title: { tr: "İnfo Yatırım, InfoGlobe ve InfoX Ücret ve Komisyonlar", en: "İnfo Yatırım, InfoGlobe and InfoX fees" },
        checked: CHECKED,
      },
      infox: {
        url: "https://infoyatirim.com/islem-platformlari/infox",
        title: { tr: "İnfo Yatırım, InfoX", en: "İnfo Yatırım, InfoX" },
        checked: CHECKED,
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: caveat(v("InfoGlobe: adet başına 0,03 $", "InfoGlobe: $0.03 per share", ["tariff"], {
        tr: "InfoX için oran yok, yalnız asgari tutar var.",
        en: "No rate given for InfoX, only a minimum.",
      })),
      minimum: caveat(v("InfoX 1,5 $ · InfoGlobe 10 $", "InfoX $1.50 · InfoGlobe $10", ["tariff"], {
        tr: "Tarife bunları asgari diye veriyor; uygulanan daha yüksek olabilir.",
        en: "Listed as minimums; the applied fee may be higher.",
      })),
      custody: none(
        {
          tr: "Yurt dışı aracının masrafları komisyona dahil değil.",
          en: "Foreign broker charges are not included.",
        },
        ["tariff"],
      ),
      fractional: none(),
      data: v("InfoX: ücretsiz canlı veri", "InfoX: free real-time data", ["infox"], {
        tr: "InfoGlobe'da yurt dışı aracının veri ücreti müşteriye yansıyor.",
        en: "InfoGlobe passes on the foreign broker's data fees.",
      }),
      w8ben: none(),
      options: v("InfoGlobe: kontrat başına 8 $", "InfoGlobe: $8 per contract", ["tariff"]),
      license: GENIS(),
    },
  },

  /* ---- Interactive Brokers ------------------------------------------------ */
  {
    id: "interactive-brokers",
    name: "Interactive Brokers",
    legalName: "Interactive Brokers",
    channel: { tr: "IBKR Pro", en: "IBKR Pro" },
    domestic: false,
    licence: "foreign",
    /* Fixed fiyatlama: adet başına 0,005 $, en az 1 $, en çok işlem
       tutarının %1'i. Tiered daha ucuz olabilir ama üstüne borsa ve takas
       ücretleri biniyor ve tutarları aylık hacme bağlı — tek anlamlı hesap
       Fixed'le yapılabiliyor. Fixed'e yalnız düzenleyici ücretler ekleniyor;
       onlar da senaryoda yok (satışta doğuyorlar, senaryo alım). */
    commission: { kind: "perShare", usd: 0.005, minUsd: 1, maxPctOfTrade: 1 },
    custodyModel: { kind: "unknown" },
    sources: {
      stocks: {
        url: "https://www.interactivebrokers.com/en/pricing/commissions-stocks.php",
        title: { tr: "IBKR, Hisse Komisyonları", en: "IBKR, stock commissions" },
        checked: CHECKED,
      },
      data: {
        url: "https://www.interactivebrokers.com/en/pricing/market-data-pricing.php",
        title: { tr: "IBKR, Piyasa Verisi Ücretleri", en: "IBKR, market data pricing" },
        checked: CHECKED,
      },
      other: {
        url: "https://www.interactivebrokers.com/en/pricing/other-fees.php",
        title: { tr: "IBKR, Diğer Ücretler", en: "IBKR, other fees" },
        checked: CHECKED,
      },
      options: {
        url: "https://www.interactivebrokers.com/en/pricing/commissions-options.php",
        title: { tr: "IBKR, Opsiyon Komisyonları", en: "IBKR, option commissions" },
        checked: CHECKED,
      },
      tax: {
        url: "https://www.interactivebrokers.com/en/support/tax-nonus-initial.php",
        title: { tr: "IBKR, ABD Dışındaki Müşteriler için Vergi", en: "IBKR, tax for non-US persons" },
        checked: CHECKED,
      },
      spk: SPK_LIST,
    },
    cells: {
      commission: v("Fixed: adet başına 0,005 $", "Fixed: $0.005 per share", ["stocks"], {
        tr: "En çok işlem tutarının %1'i. Tiered: 0,0035 $'dan başlayan kademe + borsa ücretleri.",
        en: "Capped at 1% of trade value. Tiered: from $0.0035 plus exchange fees.",
      }),
      minimum: v("Fixed 1 $ · Tiered 0,35 $", "Fixed $1 · Tiered $0.35", ["stocks"]),
      custody: none(
        {
          tr: "Ayrı saklama ücreti bulunamadı. ADR'de hisse başına 0,05 $ yansıtılıyor.",
          en: "No separate custody fee found. ADRs: $0.05 per share passed through.",
        },
        ["other"],
      ),
      fractional: v("Var", "Yes", ["stocks"], {
        tr: "Aynı komisyon; asgari 0,01 $.",
        en: "Same commission; $0.01 minimum.",
      }),
      data: v("Cboe One ve IEX ücretsiz", "Cboe One and IEX free", ["data"], {
        tr: "Konsolide veri borsa ağı başına aylık 1,50 $.",
        en: "Consolidated data $1.50 a month per network.",
      }),
      w8ben: v("Var", "Yes", ["tax"], {
        tr: "Form üç yılda bir yenileniyor; sayfada Türkiye oranı yazmıyor.",
        en: "Renewed every three years; the page does not list Türkiye's rate.",
      }),
      options: v("Var; kontrat başına 0,65 $'dan", "Yes; from $0.65 per contract", ["options"], {
        tr: "Asgari 1 $.",
        en: "Minimum $1.",
      }),
      license: caveat(v("SPK listesinde yok", "Not on the CMB register", ["spk", "stocks"], {
        tr: "ABD'de SEC ve FINRA, İrlanda'da Merkez Bankası denetiminde şirketleri var. Türkiye'deki hesabın hangi şirkette açıldığı belirtilmemiş.",
        en: "Group entities are regulated by the SEC and FINRA (US) and the Central Bank of Ireland. The entity for Türkiye residents is not stated.",
      })),
    },
  },
];

/* ==========================================================================
   Senaryo: tek bir alımın komisyonu

   Karşılaştırılan büyüklük tek: aynı alımda tarifeye göre ödenen komisyon.
   Kur farkı, saklama, BSMV ve borsa ücretleri BİLEREK dışarıda — kurumların
   çoğu onları ya yazmıyor ya farklı biçimde yazıyor; dahil etmek, eksik
   bilgiyi bir sayıyla doldurmak olurdu. Sayfa bunu senaryonun altında
   söylüyor.

   Adet başına ücret alan kurumlar için bir hisse fiyatı gerekiyor; varsayım
   `SCENARIO_SHARE_PRICE`. Fiyat değişirse o kurumların sonucu değişir,
   yüzdelik kurumlarınki değişmez — sayfa bunu da söylüyor.
   ========================================================================== */

export const SCENARIO_TRADES_USD = [1_000, 10_000] as const;
export const SCENARIO_SHARE_PRICE = 100;

/** Sent yuvarlaması: tarife sentten küçük birim yazmıyor. */
const CENTS = 100;

/**
 * Bir alımın komisyonu, dolar. Hesaplanamıyorsa null.
 * `shares` = tutar ÷ fiyat; kesirli çıkarsa yukarı yuvarlanmaz, hesap
 * oransal yapılır (senaryoda tam sayı çıkıyor).
 */
export function commissionFor(
  model: CommissionModel,
  tradeUsd: number,
  sharePriceUsd: number = SCENARIO_SHARE_PRICE,
): number | null {
  if (!(tradeUsd > 0) || !(sharePriceUsd > 0)) return null;
  let fee: number;
  switch (model.kind) {
    case "flat":
      fee = model.usd;
      break;
    case "percent":
      fee = Math.max((tradeUsd * model.pct) / 100, model.minUsd);
      break;
    case "perShare": {
      const shares = tradeUsd / sharePriceUsd;
      fee = Math.max(shares * model.usd, model.minUsd);
      if (model.maxPctOfTrade !== undefined) {
        fee = Math.min(fee, (tradeUsd * model.maxPctOfTrade) / 100);
      }
      break;
    }
    case "none":
      return null;
  }
  return Math.round(fee * CENTS) / CENTS;
}

export type ScenarioRow = {
  broker: Broker;
  /** `SCENARIO_TRADES_USD` sırasıyla; hesaplanamıyorsa null. */
  fees: (number | null)[];
};

export function scenarioRows(brokers: readonly Broker[] = BROKERS): ScenarioRow[] {
  return brokers.map((broker) => ({
    broker,
    fees: SCENARIO_TRADES_USD.map((trade) => commissionFor(broker.commission, trade)),
  }));
}

/** Bir hücrenin kaynak numaraları — kurumun kaynak listesindeki sırayla, 1'den. */
export function sourceNumbers(broker: Broker, ids: readonly string[]): number[] {
  const order = Object.keys(broker.sources);
  return ids.map((id) => order.indexOf(id) + 1).filter((n) => n > 0);
}

/** Hücrelerin işaret ettiği ama tanımlı olmayan kaynaklar — sınamada boş kalmalı. */
export function danglingSources(brokers: readonly Broker[] = BROKERS): string[] {
  const out: string[] = [];
  for (const broker of brokers) {
    const ids = new Set(Object.keys(broker.sources));
    const refs = [
      ...Object.values(broker.cells).flatMap((cell) => cell.src ?? []),
      ...(broker.counterparty?.src ?? []),
    ];
    for (const ref of refs) if (!ids.has(ref)) out.push(`${broker.id}:${ref}`);
  }
  return out;
}
