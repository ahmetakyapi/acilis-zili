import type { Locale } from "@/lib/i18n/config";

/* ==========================================================================
   Sektör sözlüğü

   Finnhub şirket profillerinde GICS ALT sektörü döner: "Semiconductor
   Materials & Equipment", "Multi-Family Residential REITs" gibi 148 ayrı
   değer. İkisi de sorun çıkarıyordu — hepsi İngilizce, ve 148 kategori bir
   filtre şeridine sığmıyor (yatayda sonsuza kadar kayan bir çip dizisi).

   Çözüm iki katmanlı:
     1. GRUP — şeritte 14 üst başlık durur, filtre bunlar üzerinden çalışır.
     2. ETİKET — tablodaki "Sektör" sütunu alt sektörün Türkçesini yazar.

   Sözlükte olmayan bir alt sektör gelirse (sağlayıcı yeni bir ad kullanırsa)
   şirket "Diğer" grubunda toplanır ve etiket olarak ham ad görünür; hiçbir
   şey kaybolmaz.
   ========================================================================== */

export type SectorGroup = {
  /** URL'de `?sektor=` değeri olarak görünür. */
  key: string;
  labelTr: string;
  labelEn: string;
  /** Sağlayıcıdan geldiği hâliyle GICS alt sektör adları. */
  industries: readonly string[];
};

/** Şerit sırası: takip edilen evrenin ağırlık merkezi önde. */
export const SECTOR_GROUPS: readonly SectorGroup[] = [
  {
    key: "teknoloji",
    labelTr: "Teknoloji",
    labelEn: "Technology",
    industries: [
      "Technology",
      "Application Software",
      "Systems Software",
      "Internet Services & Infrastructure",
      "IT Consulting & Other Services",
      "Data Processing & Outsourced Services",
      "Technology Hardware, Storage & Peripherals",
      "Communications Equipment",
      "Electronic Equipment & Instruments",
      "Electronic Components",
      "Electronic Manufacturing Services",
      "Technology Distributors",
      "Consumer Electronics",
    ],
  },
  {
    key: "yari-iletken",
    labelTr: "Yarı İletken",
    labelEn: "Semiconductors",
    industries: ["Semiconductors", "Semiconductor Materials & Equipment"],
  },
  {
    key: "saglik",
    labelTr: "Sağlık",
    labelEn: "Health Care",
    industries: [
      "Biotechnology",
      "Pharmaceuticals",
      "Health Care",
      "Health Care Equipment",
      "Health Care Services",
      "Health Care Distributors",
      "Health Care Supplies",
      "Health Care Facilities",
      "Health Care Technology",
      "Managed Health Care",
      "Life Sciences Tools & Services",
    ],
  },
  {
    key: "finans",
    labelTr: "Finans",
    labelEn: "Financials",
    industries: [
      "Financial Services",
      "Banking",
      "Diversified Banks",
      "Regional Banks",
      "Asset Management & Custody Banks",
      "Investment Banking & Brokerage",
      "Financial Exchanges & Data",
      "Transaction & Payment Processing Services",
      "Consumer Finance",
      "Property & Casualty Insurance",
      "Life & Health Insurance",
      "Multi-line Insurance",
      "Insurance Brokers",
      "Reinsurance",
      "Multi-Sector Holdings",
    ],
  },
  {
    key: "sanayi",
    labelTr: "Sanayi",
    labelEn: "Industrials",
    industries: [
      "Aerospace & Defense",
      "Industrial Machinery & Supplies & Components",
      "Building Products",
      "Construction & Engineering",
      "Construction",
      "Construction Machinery & Heavy Transportation Equipment",
      "Agricultural & Farm Machinery",
      "Electrical Components & Equipment",
      "Heavy Electrical Equipment",
      "Electrical Equipment",
      "Industrial Conglomerates",
      "Trading Companies & Distributors",
      "Distributors",
      "Environmental & Facilities Services",
      "Commercial Services & Supplies",
      "Diversified Support Services",
      "Professional Services",
      "Research & Consulting Services",
      "Human Resource & Employment Services",
    ],
  },
  {
    key: "enerji",
    labelTr: "Enerji",
    labelEn: "Energy",
    industries: [
      "Energy",
      "Integrated Oil & Gas",
      "Oil & Gas Exploration & Production",
      "Oil & Gas Refining & Marketing",
      "Oil & Gas Storage & Transportation",
      "Oil & Gas Equipment & Services",
    ],
  },
  {
    key: "medya",
    labelTr: "Medya ve İletişim",
    labelEn: "Media & Telecom",
    industries: [
      "Media",
      "Broadcasting",
      "Publishing",
      "Advertising",
      "Cable & Satellite",
      "Movies & Entertainment",
      "Interactive Media & Services",
      "Interactive Home Entertainment",
      "Integrated Telecommunication Services",
      "Wireless Telecommunication Services",
      "Telecommunication",
    ],
  },
  {
    key: "tuketim",
    labelTr: "Tüketim",
    labelEn: "Consumer",
    industries: [
      "Broadline Retail",
      "Other Specialty Retail",
      "Apparel Retail",
      "Home Improvement Retail",
      "Homefurnishing Retail",
      "Computer & Electronics Retail",
      "Automotive Retail",
      "Retail",
      "Restaurants",
      "Hotels, Restaurants & Leisure",
      "Hotels, Resorts & Cruise Lines",
      "Casinos & Gaming",
      "Leisure Products",
      "Specialized Consumer Services",
      "Apparel, Accessories & Luxury Goods",
      "Footwear",
      "Automobile Manufacturers",
      "Automotive Parts & Equipment",
      "Auto Components",
      "Homebuilding",
    ],
  },
  {
    key: "temel-tuketim",
    labelTr: "Temel Tüketim",
    labelEn: "Consumer Staples",
    industries: [
      "Packaged Foods & Meats",
      "Food Retail",
      "Food Distributors",
      "Consumer Staples Merchandise Retail",
      "Agricultural Products & Services",
      "Soft Drinks & Non-alcoholic Beverages",
      "Distillers & Vintners",
      "Brewers",
      "Tobacco",
      "Household Products",
      "Personal Care Products",
      "Consumer products",
    ],
  },
  {
    key: "kamu-hizmetleri",
    labelTr: "Kamu Hizmetleri",
    labelEn: "Utilities",
    industries: [
      "Utilities",
      "Electric Utilities",
      "Multi-Utilities",
      "Gas Utilities",
      "Water Utilities",
      "Independent Power Producers & Energy Traders",
    ],
  },
  {
    key: "hammadde",
    labelTr: "Hammadde",
    labelEn: "Materials",
    industries: [
      "Chemicals",
      "Specialty Chemicals",
      "Commodity Chemicals",
      "Industrial Gases",
      "Fertilizers & Agricultural Chemicals",
      "Metals & Mining",
      "Steel",
      "Copper",
      "Gold",
      "Paper & Plastic Packaging Products & Materials",
      "Metal, Glass & Plastic Containers",
      "Construction Materials",
    ],
  },
  {
    key: "gayrimenkul",
    labelTr: "Gayrimenkul",
    labelEn: "Real Estate",
    industries: [
      "Real Estate",
      "Real Estate Services",
      "Retail REITs",
      "Office REITs",
      "Industrial REITs",
      "Health Care REITs",
      "Hotel & Resort REITs",
      "Multi-Family Residential REITs",
      "Single-Family Residential REITs",
      "Data Center REITs",
      "Self-Storage REITs",
      "Telecom Tower REITs",
      "Timber REITs",
      "Other Specialized REITs",
    ],
  },
  {
    key: "ulastirma",
    labelTr: "Ulaştırma",
    labelEn: "Transport",
    industries: [
      "Air Freight & Logistics",
      "Passenger Airlines",
      "Rail Transportation",
      "Cargo Ground Transportation",
      "Passenger Ground Transportation",
      "Marine",
    ],
  },
  {
    key: "diger",
    labelTr: "Diğer",
    labelEn: "Other",
    industries: ["N/A"],
  },
];

/** Sözlükte yeri olmayan her alt sektörün düştüğü grup. */
const FALLBACK_GROUP = SECTOR_GROUPS[SECTOR_GROUPS.length - 1];

const GROUP_BY_INDUSTRY = new Map<string, SectorGroup>();
for (const group of SECTOR_GROUPS) {
  for (const industry of group.industries) {
    GROUP_BY_INDUSTRY.set(industry.toLowerCase(), group);
  }
}

const GROUP_BY_KEY = new Map(SECTOR_GROUPS.map((group) => [group.key, group]));

export function sectorGroupOf(industry: string | null | undefined): SectorGroup {
  if (!industry) return FALLBACK_GROUP;
  return GROUP_BY_INDUSTRY.get(industry.toLowerCase()) ?? FALLBACK_GROUP;
}

export function sectorGroupByKey(key: string | null | undefined) {
  return key ? (GROUP_BY_KEY.get(key) ?? null) : null;
}

export function sectorGroupLabel(group: SectorGroup, locale: Locale): string {
  return locale === "tr" ? group.labelTr : group.labelEn;
}

/* --------------------------------------------------------------------------
   Alt sektör etiketleri — tablodaki "Sektör" sütunu
   -------------------------------------------------------------------------- */

const INDUSTRY_TR: Record<string, string> = {
  // Teknoloji
  Technology: "Teknoloji",
  "Application Software": "Uygulama Yazılımı",
  "Systems Software": "Sistem Yazılımı",
  "Internet Services & Infrastructure": "İnternet Hizmetleri ve Altyapısı",
  "IT Consulting & Other Services": "BT Danışmanlığı ve Hizmetleri",
  "Data Processing & Outsourced Services": "Veri İşleme ve Dış Kaynak",
  "Technology Hardware, Storage & Peripherals":
    "Donanım, Depolama ve Çevre Birimleri",
  "Communications Equipment": "İletişim Ekipmanları",
  "Electronic Equipment & Instruments": "Elektronik Ekipman ve Cihazlar",
  "Electronic Components": "Elektronik Bileşenler",
  "Electronic Manufacturing Services": "Elektronik Üretim Hizmetleri",
  "Technology Distributors": "Teknoloji Distribütörleri",
  "Consumer Electronics": "Tüketici Elektroniği",

  // Yarı iletken
  Semiconductors: "Yarı İletkenler",
  "Semiconductor Materials & Equipment": "Yarı İletken Malzeme ve Ekipmanları",

  // Sağlık
  Biotechnology: "Biyoteknoloji",
  Pharmaceuticals: "İlaç",
  "Health Care": "Sağlık",
  "Health Care Equipment": "Tıbbi Cihazlar",
  "Health Care Services": "Sağlık Hizmetleri",
  "Health Care Distributors": "Sağlık Ürünleri Dağıtımı",
  "Health Care Supplies": "Tıbbi Sarf Malzemeleri",
  "Health Care Facilities": "Sağlık Tesisleri",
  "Health Care Technology": "Sağlık Teknolojisi",
  "Managed Health Care": "Sağlık Sigortası ve Yönetimi",
  "Life Sciences Tools & Services": "Yaşam Bilimleri Araç ve Hizmetleri",

  // Finans
  "Financial Services": "Finansal Hizmetler",
  Banking: "Bankacılık",
  "Diversified Banks": "Mevduat Bankaları",
  "Regional Banks": "Bölgesel Bankalar",
  "Asset Management & Custody Banks": "Varlık Yönetimi ve Saklama",
  "Investment Banking & Brokerage": "Yatırım Bankacılığı ve Aracılık",
  "Financial Exchanges & Data": "Borsalar ve Finansal Veri",
  "Transaction & Payment Processing Services": "Ödeme Sistemleri",
  "Consumer Finance": "Tüketici Finansmanı",
  "Property & Casualty Insurance": "Hasar ve Sorumluluk Sigortası",
  "Life & Health Insurance": "Hayat ve Sağlık Sigortası",
  "Multi-line Insurance": "Karma Sigortacılık",
  "Insurance Brokers": "Sigorta Aracılığı",
  Reinsurance: "Reasürans",
  "Multi-Sector Holdings": "Çok Sektörlü Holding",

  // Sanayi
  "Aerospace & Defense": "Havacılık ve Savunma",
  "Industrial Machinery & Supplies & Components":
    "Sanayi Makineleri ve Bileşenleri",
  "Building Products": "Yapı Ürünleri",
  "Construction & Engineering": "İnşaat ve Mühendislik",
  Construction: "İnşaat",
  "Construction Machinery & Heavy Transportation Equipment":
    "İş Makineleri ve Ağır Vasıta",
  "Agricultural & Farm Machinery": "Tarım Makineleri",
  "Electrical Components & Equipment": "Elektrik Bileşen ve Ekipmanları",
  "Heavy Electrical Equipment": "Ağır Elektrik Ekipmanları",
  "Electrical Equipment": "Elektrik Ekipmanları",
  "Industrial Conglomerates": "Sanayi Holdingleri",
  "Trading Companies & Distributors": "Ticaret ve Dağıtım",
  Distributors: "Dağıtım",
  "Environmental & Facilities Services": "Çevre ve Tesis Hizmetleri",
  "Commercial Services & Supplies": "Ticari Hizmet ve Malzemeler",
  "Diversified Support Services": "Destek Hizmetleri",
  "Professional Services": "Profesyonel Hizmetler",
  "Research & Consulting Services": "Araştırma ve Danışmanlık",
  "Human Resource & Employment Services": "İnsan Kaynakları Hizmetleri",

  // Enerji
  Energy: "Enerji",
  "Integrated Oil & Gas": "Entegre Petrol ve Gaz",
  "Oil & Gas Exploration & Production": "Petrol ve Gaz Arama-Üretim",
  "Oil & Gas Refining & Marketing": "Rafineri ve Akaryakıt",
  "Oil & Gas Storage & Transportation": "Petrol ve Gaz Taşıma-Depolama",
  "Oil & Gas Equipment & Services": "Petrol ve Gaz Ekipman ve Hizmetleri",

  // Medya ve iletişim
  Media: "Medya",
  Broadcasting: "Yayıncılık",
  Publishing: "Basılı Yayıncılık",
  Advertising: "Reklamcılık",
  "Cable & Satellite": "Kablo ve Uydu Yayını",
  "Movies & Entertainment": "Sinema ve Eğlence",
  "Interactive Media & Services": "İnteraktif Medya ve Hizmetler",
  "Interactive Home Entertainment": "Dijital Oyun ve Eğlence",
  "Integrated Telecommunication Services": "Entegre Telekomünikasyon",
  "Wireless Telecommunication Services": "Mobil Telekomünikasyon",
  Telecommunication: "Telekomünikasyon",

  // Tüketim
  "Broadline Retail": "Genel Perakende",
  "Other Specialty Retail": "Diğer Uzman Perakende",
  "Apparel Retail": "Giyim Perakendesi",
  "Home Improvement Retail": "Yapı Market",
  "Homefurnishing Retail": "Ev Mobilyası Perakendesi",
  "Computer & Electronics Retail": "Bilgisayar ve Elektronik Perakendesi",
  "Automotive Retail": "Otomotiv Perakendesi",
  Retail: "Perakende",
  Restaurants: "Restoran",
  "Hotels, Restaurants & Leisure": "Otel, Restoran ve Eğlence",
  "Hotels, Resorts & Cruise Lines": "Otel, Tatil Köyü ve Kruvaziyer",
  "Casinos & Gaming": "Kumarhane ve Bahis",
  "Leisure Products": "Eğlence Ürünleri",
  "Specialized Consumer Services": "Uzman Tüketici Hizmetleri",
  "Apparel, Accessories & Luxury Goods": "Giyim, Aksesuar ve Lüks Tüketim",
  Footwear: "Ayakkabı",
  "Automobile Manufacturers": "Otomobil Üreticileri",
  "Automotive Parts & Equipment": "Otomotiv Parça ve Ekipmanları",
  "Auto Components": "Otomotiv Yan Sanayi",
  Homebuilding: "Konut İnşaatı",

  // Temel tüketim
  "Packaged Foods & Meats": "Paketli Gıda ve Et Ürünleri",
  "Food Retail": "Gıda Perakendesi",
  "Food Distributors": "Gıda Dağıtımı",
  "Consumer Staples Merchandise Retail": "Temel Tüketim Perakendesi",
  "Agricultural Products & Services": "Tarım Ürünleri ve Hizmetleri",
  "Soft Drinks & Non-alcoholic Beverages": "Alkolsüz İçecekler",
  "Distillers & Vintners": "Distile İçki ve Şarap",
  Brewers: "Bira",
  Tobacco: "Tütün",
  "Household Products": "Ev Bakım Ürünleri",
  "Personal Care Products": "Kişisel Bakım Ürünleri",
  "Consumer products": "Tüketim Ürünleri",

  // Kamu hizmetleri
  Utilities: "Kamu Hizmetleri",
  "Electric Utilities": "Elektrik Dağıtımı",
  "Multi-Utilities": "Çok Hizmetli Altyapı",
  "Gas Utilities": "Doğal Gaz Dağıtımı",
  "Water Utilities": "Su Hizmetleri",
  "Independent Power Producers & Energy Traders":
    "Bağımsız Elektrik Üreticileri",

  // Hammadde
  Chemicals: "Kimya",
  "Specialty Chemicals": "Özel Kimyasallar",
  "Commodity Chemicals": "Temel Kimyasallar",
  "Industrial Gases": "Endüstriyel Gazlar",
  "Fertilizers & Agricultural Chemicals": "Gübre ve Tarım Kimyasalları",
  "Metals & Mining": "Metal ve Madencilik",
  Steel: "Çelik",
  Copper: "Bakır",
  Gold: "Altın",
  "Paper & Plastic Packaging Products & Materials": "Kâğıt ve Plastik Ambalaj",
  "Metal, Glass & Plastic Containers": "Metal, Cam ve Plastik Ambalaj",
  "Construction Materials": "Yapı Malzemeleri",

  // Gayrimenkul
  "Real Estate": "Gayrimenkul",
  "Real Estate Services": "Gayrimenkul Hizmetleri",
  "Retail REITs": "Perakende GYO",
  "Office REITs": "Ofis GYO",
  "Industrial REITs": "Sanayi GYO",
  "Health Care REITs": "Sağlık GYO",
  "Hotel & Resort REITs": "Otel GYO",
  "Multi-Family Residential REITs": "Çok Konutlu Konut GYO",
  "Single-Family Residential REITs": "Müstakil Konut GYO",
  "Data Center REITs": "Veri Merkezi GYO",
  "Self-Storage REITs": "Depolama GYO",
  "Telecom Tower REITs": "Telekom Kulesi GYO",
  "Timber REITs": "Orman Arazisi GYO",
  "Other Specialized REITs": "Diğer Uzman GYO",

  // Ulaştırma
  "Air Freight & Logistics": "Hava Kargo ve Lojistik",
  "Passenger Airlines": "Havayolu Taşımacılığı",
  "Rail Transportation": "Demiryolu Taşımacılığı",
  "Cargo Ground Transportation": "Karayolu Kargo",
  "Passenger Ground Transportation": "Karayolu Yolcu Taşımacılığı",
  Marine: "Deniz Taşımacılığı",

  "N/A": "Belirtilmemiş",
};

/** Alt sektörün ekranda yazılacak adı — TR'de sözlükten, EN'de ham ad. */
export function industryLabel(
  industry: string | null | undefined,
  locale: Locale,
): string | null {
  if (!industry) return null;
  if (locale !== "tr") return industry;
  return INDUSTRY_TR[industry] ?? industry;
}
