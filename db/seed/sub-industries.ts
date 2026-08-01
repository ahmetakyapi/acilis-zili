/**
 * GICS alt sektörlerinin Türkçe karşılıkları.
 *
 * Şirketin ne iş yaptığını `descriptions.ts` ve `descriptions-sp500.ts`
 * anlatır — her şirket kendi metnine sahiptir. Burası yalnızca sınıflandırma
 * etiketinin Türkçesini verir ("Semiconductors" → "Yarı İletkenler").
 */

export type SubIndustryInfo = {
  /** Alt sektörün Türkçe adı. */
  tr: string;
};

export const SUB_INDUSTRIES: Record<string, SubIndustryInfo> = {
  Advertising: {
    tr: "Reklamcılık",
  },
  "Aerospace & Defense": {
    tr: "Havacılık ve Savunma",
  },
  "Agricultural & Farm Machinery": {
    tr: "Tarım Makineleri",
  },
  "Agricultural Products & Services": {
    tr: "Tarım Ürünleri ve Hizmetleri",
  },
  "Air Freight & Logistics": {
    tr: "Hava Kargo ve Lojistik",
  },
  "Apparel Retail": {
    tr: "Giyim Perakendesi",
  },
  "Apparel, Accessories & Luxury Goods": {
    tr: "Giyim ve Lüks Ürünler",
  },
  "Application Software": {
    tr: "Uygulama Yazılımı",
  },
  "Asset Management & Custody Banks": {
    tr: "Varlık Yönetimi ve Saklama",
  },
  "Automobile Manufacturers": {
    tr: "Otomobil Üreticileri",
  },
  "Automotive Parts & Equipment": {
    tr: "Otomotiv Yan Sanayi",
  },
  "Automotive Retail": {
    tr: "Otomotiv Perakendesi",
  },
  Biotechnology: {
    tr: "Biyoteknoloji",
  },
  Brewers: {
    tr: "Bira Üreticileri",
  },
  Broadcasting: {
    tr: "Yayıncılık",
  },
  "Broadline Retail": {
    tr: "Çok Kategorili Perakende",
  },
  "Building Products": {
    tr: "Yapı Ürünleri",
  },
  "Cable & Satellite": {
    tr: "Kablo ve Uydu",
  },
  "Cargo Ground Transportation": {
    tr: "Karayolu Yük Taşımacılığı",
  },
  "Casinos & Gaming": {
    tr: "Kumarhane ve Bahis",
  },
  "Commodity Chemicals": {
    tr: "Temel Kimyasallar",
  },
  "Communications Equipment": {
    tr: "Haberleşme Ekipmanları",
  },
  "Computer & Electronics Retail": {
    tr: "Elektronik Perakendesi",
  },
  "Construction & Engineering": {
    tr: "İnşaat ve Mühendislik",
  },
  "Construction Machinery & Heavy Transportation Equipment": {
    tr: "İş Makineleri ve Ağır Taşıt",
  },
  "Construction Materials": {
    tr: "İnşaat Malzemeleri",
  },
  "Consumer Electronics": {
    tr: "Tüketici Elektroniği",
  },
  "Consumer Finance": {
    tr: "Tüketici Finansmanı",
  },
  "Consumer Staples Merchandise Retail": {
    tr: "Temel Tüketim Perakendesi",
  },
  Copper: {
    tr: "Bakır Madenciliği",
  },
  "Data Center REITs": {
    tr: "Veri Merkezi GYO",
  },
  "Data Processing & Outsourced Services": {
    tr: "Veri İşleme ve Dış Kaynak Hizmetleri",
  },
  "Distillers & Vintners": {
    tr: "Alkollü İçki Üreticileri",
  },
  Distributors: {
    tr: "Dağıtıcılar",
  },
  "Diversified Banks": {
    tr: "Evrensel Bankalar",
  },
  "Diversified Support Services": {
    tr: "Çeşitli Destek Hizmetleri",
  },
  "Electric Utilities": {
    tr: "Elektrik Dağıtımı",
  },
  "Electrical Components & Equipment": {
    tr: "Elektrik Ekipmanları",
  },
  "Electronic Components": {
    tr: "Elektronik Bileşenler",
  },
  "Electronic Equipment & Instruments": {
    tr: "Elektronik Cihaz ve Ölçüm",
  },
  "Electronic Manufacturing Services": {
    tr: "Sözleşmeli Elektronik Üretim",
  },
  "Environmental & Facilities Services": {
    tr: "Çevre ve Tesis Hizmetleri",
  },
  "Fertilizers & Agricultural Chemicals": {
    tr: "Gübre ve Tarım Kimyasalları",
  },
  "Financial Exchanges & Data": {
    tr: "Borsalar ve Finansal Veri",
  },
  "Food Distributors": {
    tr: "Gıda Dağıtımı",
  },
  "Food Retail": {
    tr: "Gıda Perakendesi",
  },
  Footwear: {
    tr: "Ayakkabı",
  },
  "Gas Utilities": {
    tr: "Doğalgaz Dağıtımı",
  },
  Gold: {
    tr: "Altın Madenciliği",
  },
  "Health Care Distributors": {
    tr: "Sağlık Ürünleri Dağıtımı",
  },
  "Health Care Equipment": {
    tr: "Tıbbi Cihazlar",
  },
  "Health Care Facilities": {
    tr: "Sağlık Tesisleri",
  },
  "Health Care REITs": {
    tr: "Sağlık GYO",
  },
  "Health Care Services": {
    tr: "Sağlık Hizmetleri",
  },
  "Health Care Supplies": {
    tr: "Sağlık Sarf Malzemeleri",
  },
  "Health Care Technology": {
    tr: "Sağlık Teknolojisi",
  },
  "Heavy Electrical Equipment": {
    tr: "Ağır Elektrik Ekipmanları",
  },
  "Home Improvement Retail": {
    tr: "Yapı Market Perakendesi",
  },
  Homebuilding: {
    tr: "Konut İnşaatı",
  },
  "Homefurnishing Retail": {
    tr: "Ev Eşyası Perakendesi",
  },
  "Hotel & Resort REITs": {
    tr: "Otel GYO",
  },
  "Hotels, Resorts & Cruise Lines": {
    tr: "Otel, Tatil ve Kruvaziyer",
  },
  "Household Products": {
    tr: "Ev Bakım Ürünleri",
  },
  "Human Resource & Employment Services": {
    tr: "İnsan Kaynakları Hizmetleri",
  },
  "IT Consulting & Other Services": {
    tr: "BT Danışmanlığı",
  },
  "Independent Power Producers & Energy Traders": {
    tr: "Bağımsız Elektrik Üreticileri",
  },
  "Industrial Conglomerates": {
    tr: "Sanayi Holdingleri",
  },
  "Industrial Gases": {
    tr: "Endüstriyel Gazlar",
  },
  "Industrial Machinery & Supplies & Components": {
    tr: "Sanayi Makineleri",
  },
  "Industrial REITs": {
    tr: "Lojistik GYO",
  },
  "Insurance Brokers": {
    tr: "Sigorta Aracılığı",
  },
  "Integrated Oil & Gas": {
    tr: "Entegre Petrol ve Gaz",
  },
  "Integrated Telecommunication Services": {
    tr: "Entegre Telekom",
  },
  "Interactive Home Entertainment": {
    tr: "Video Oyunları",
  },
  "Interactive Media & Services": {
    tr: "Dijital Medya ve Platformlar",
  },
  "Internet Services & Infrastructure": {
    tr: "İnternet Altyapısı",
  },
  "Investment Banking & Brokerage": {
    tr: "Yatırım Bankacılığı ve Aracılık",
  },
  "Leisure Products": {
    tr: "Eğlence ve Spor Ürünleri",
  },
  "Life & Health Insurance": {
    tr: "Hayat ve Sağlık Sigortası",
  },
  "Life Sciences Tools & Services": {
    tr: "Yaşam Bilimleri Araçları",
  },
  "Managed Health Care": {
    tr: "Sağlık Sigortası Yönetimi",
  },
  "Metal, Glass & Plastic Containers": {
    tr: "Ambalaj Kapları",
  },
  "Movies & Entertainment": {
    tr: "Sinema ve Eğlence",
  },
  "Multi-Family Residential REITs": {
    tr: "Konut GYO",
  },
  "Multi-Sector Holdings": {
    tr: "Çok Sektörlü Holding",
  },
  "Multi-Utilities": {
    tr: "Çoklu Altyapı Hizmetleri",
  },
  "Multi-line Insurance": {
    tr: "Karma Sigorta",
  },
  "Office REITs": {
    tr: "Ofis GYO",
  },
  "Oil & Gas Equipment & Services": {
    tr: "Petrol Ekipman ve Hizmetleri",
  },
  "Oil & Gas Exploration & Production": {
    tr: "Petrol Arama ve Üretim",
  },
  "Oil & Gas Refining & Marketing": {
    tr: "Rafinaj ve Pazarlama",
  },
  "Oil & Gas Storage & Transportation": {
    tr: "Boru Hattı ve Depolama",
  },
  "Other Specialized REITs": {
    tr: "Özel Amaçlı GYO",
  },
  "Other Specialty Retail": {
    tr: "Özel Perakende",
  },
  "Packaged Foods & Meats": {
    tr: "Paketli Gıda",
  },
  "Paper & Plastic Packaging Products & Materials": {
    tr: "Kağıt ve Plastik Ambalaj",
  },
  "Passenger Airlines": {
    tr: "Havayolları",
  },
  "Passenger Ground Transportation": {
    tr: "Kara Yolcu Taşımacılığı",
  },
  "Personal Care Products": {
    tr: "Kişisel Bakım",
  },
  Pharmaceuticals: {
    tr: "İlaç",
  },
  "Property & Casualty Insurance": {
    tr: "Hasar ve Kaza Sigortası",
  },
  Publishing: {
    tr: "Yayıncılık",
  },
  "Rail Transportation": {
    tr: "Demiryolu Taşımacılığı",
  },
  "Real Estate Services": {
    tr: "Gayrimenkul Hizmetleri",
  },
  "Regional Banks": {
    tr: "Bölgesel Bankalar",
  },
  Reinsurance: {
    tr: "Reasürans",
  },
  "Research & Consulting Services": {
    tr: "Araştırma ve Danışmanlık",
  },
  Restaurants: {
    tr: "Restoran Zincirleri",
  },
  "Retail REITs": {
    tr: "Perakende GYO",
  },
  "Self-Storage REITs": {
    tr: "Depolama GYO",
  },
  "Semiconductor Materials & Equipment": {
    tr: "Yarı İletken Ekipman ve Malzeme",
  },
  Semiconductors: {
    tr: "Yarı İletkenler",
  },
  "Single-Family Residential REITs": {
    tr: "Müstakil Konut GYO",
  },
  "Soft Drinks & Non-alcoholic Beverages": {
    tr: "Alkolsüz İçecekler",
  },
  "Specialized Consumer Services": {
    tr: "Özel Tüketici Hizmetleri",
  },
  "Specialty Chemicals": {
    tr: "Özel Kimyasallar",
  },
  Steel: {
    tr: "Çelik",
  },
  "Systems Software": {
    tr: "Sistem Yazılımı",
  },
  "Technology Distributors": {
    tr: "Teknoloji Dağıtımı",
  },
  "Technology Hardware, Storage & Peripherals": {
    tr: "Bilgisayar Donanımı ve Depolama",
  },
  "Telecom Tower REITs": {
    tr: "Baz İstasyonu GYO",
  },
  "Timber REITs": {
    tr: "Orman GYO",
  },
  Tobacco: {
    tr: "Tütün",
  },
  "Trading Companies & Distributors": {
    tr: "Sanayi Ticaret ve Dağıtım",
  },
  "Transaction & Payment Processing Services": {
    tr: "Ödeme Sistemleri",
  },
  "Water Utilities": {
    tr: "Su Hizmetleri",
  },
  "Wireless Telecommunication Services": {
    tr: "Mobil Telekom",
  },
};

/** Alt sektörün Türkçe/İngilizce adı — bulunamazsa orijinal ad döner. */
export function subIndustryName(sub: string, locale: string): string {
  const info = SUB_INDUSTRIES[sub];
  if (!info) return sub;
  return locale === "tr" ? info.tr : sub;
}

