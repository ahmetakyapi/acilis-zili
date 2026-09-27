/* ==========================================================================
   Tematik listeler — `/tema` ve `/tema/[slug]`

   Neden depoda: bir temanın hangi şirketleri kapsadığı editoryal bir karar
   ve kod incelemesinden geçmeli (rehber ve sözlükle aynı gerekçe). Sayılar
   BURADA DEĞİL — fiyat, yüzde ve piyasa değeri sayfa açıldığında canlı
   sağlayıcıdan geliyor.

   İKİ DİL TEK NESNEDE ve ikisi de zorunlu alan: bir temaya İngilizce
   metin yazmayı unutmak derlemeyi kırar.

   SEMBOL KURALI: yalnızca sitenin `symbols` tablosunda duran, ABD'de işlem
   gören semboller (sayfası olan, kotasyonu gelen). Liste 28 Eylül 2026'da
   tabloya karşı denetlendi; tabloda olmayan tanınmış adlar (NVO, OKLO, SMR,
   RIVN, LCID, ZS…) bu yüzden listede YOK, unutulmuş değiller. Tablo
   genişlerse eklenebilirler. Sayfa yine de savunmalı: tabloda satırı
   olmayan sembol adsız ve piyasa değersiz, ama sembolüyle çizilir.

   KARŞILAŞTIRMA ÖLÇÜTÜ (`benchmark`) temanın bilinen bir ETF'i; bu ETF'ler
   sembol tablosunda değil, yalnızca kotasyonu okunuyor (ad buradan). Temayı
   birebir izleyen yaygın bir fon yoksa `null` — uydurma bir ölçüt,
   ölçütsüzlükten kötü.

   "UZUN TEMETTÜ GEÇMİŞİ" bir endeks üyeliği iddiası DEĞİL: listedeki
   şirketler temettüsünü on yıllardır kesintisiz artırmasıyla bilinen
   şirketler. S&P'nin "Dividend Aristocrats" üyeliği yılda bir yeniden
   belirleniyor ve burada doğrulanmadığı için o ad kullanılmıyor. 3M (MMM)
   2024'teki bölünmeden sonra temettüsünü düşürdüğü için listede yok.

   KATILIM UYUMLU listesi elle yazılmıyor: endeks üyeleri arasında
   `lib/compliance.ts` ön elemesini geçenler sayfa açıldığında seçiliyor
   (`lib/themes-data.ts`). Sembol dizisi bu yüzden `"katilim"` işareti.
   ========================================================================== */

import type { GuideSlug } from "@/content/guide/meta";

export type ThemeBenchmark = {
  symbol: string;
  name: string;
};

export type ThemeEntry = {
  slug: string;
  /** Elle seçilmiş liste ya da dinamik liste işareti. */
  symbols: readonly string[] | "katilim";
  benchmark: ThemeBenchmark | null;
  titleTr: string;
  titleEn: string;
  /** Kartta ve sayfa başında tek cümle. */
  dekTr: string;
  dekEn: string;
  /** "Neden bu şirketler" — kısa bir paragraf. */
  whyTr: string;
  whyEn: string;
  guides: readonly GuideSlug[];
};

export const THEMES = [
  {
    slug: "yapay-zeka",
    symbols: [
      "NVDA", "MSFT", "GOOGL", "META", "AMZN", "AVGO", "AMD", "TSM",
      "ORCL", "PLTR", "MU", "ANET", "DELL", "SMCI", "ALAB", "NOW",
    ],
    benchmark: null,
    titleTr: "Yapay Zekâ",
    titleEn: "Artificial Intelligence",
    dekTr: "Yapay zekâ modellerini eğiten ve çalıştıran çiplerden bulut altyapısına ve yazılıma uzanan zincir.",
    dekEn: "The chain from the chips that train and run AI models to the cloud infrastructure and software on top.",
    whyTr:
      "Liste, yapay zekâ harcamasının parasının aktığı üç halkadan seçildi: hızlandırıcı ve bellek üreten yarı iletken şirketleri (Nvidia, AMD, Broadcom, Micron, TSMC), bu çipleri veri merkezlerine kuran ve kiralayan bulut sağlayıcıları (Microsoft, Alphabet, Amazon, Oracle, Meta) ve sunucu, ağ ve yazılım tarafı (Dell, Super Micro, Arista, Astera Labs, Palantir, ServiceNow). Halkalar aynı talebe bağlı ama aynı anda hareket etmek zorunda değil: bulut şirketlerinin yatırım bütçesi bir halkanın geliri, ötekinin gideridir.",
    whyEn:
      "The list is drawn from the three links that AI spending flows through: the semiconductor makers of accelerators and memory (Nvidia, AMD, Broadcom, Micron, TSMC), the cloud providers that install and rent those chips (Microsoft, Alphabet, Amazon, Oracle, Meta), and the server, networking and software layer (Dell, Super Micro, Arista, Astera Labs, Palantir, ServiceNow). The links share the same demand but need not move together: a cloud company's capital budget is one link's revenue and another's expense.",
    guides: ["sektor-rotasyonu", "degerleme"],
  },
  {
    slug: "yari-iletkenler",
    symbols: [
      "NVDA", "AVGO", "AMD", "TSM", "ASML", "MU", "QCOM", "TXN", "ADI", "INTC",
      "AMAT", "LRCX", "KLAC", "MRVL", "ARM", "NXPI", "ON", "MCHP", "MPWR", "SKHY",
    ],
    benchmark: { symbol: "SMH", name: "VanEck Semiconductor ETF" },
    titleTr: "Yarı İletkenler",
    titleEn: "Semiconductors",
    dekTr: "Çip tasarlayanlar, üretenler ve üretim makinelerini yapanlar: döngüsel ve sermaye yoğun bir sektör.",
    dekEn: "The companies that design chips, make them and build the machines that make them: a cyclical, capital-heavy industry.",
    whyTr:
      "Sektör üç iş modeline ayrılıyor ve liste üçünü de taşıyor: kendi fabrikası olmadan tasarlayanlar (Nvidia, AMD, Broadcom, Qualcomm, Marvell, Arm), sözleşmeli ya da kendi adına üretenler (TSMC, Intel, Micron, SK hynix, Texas Instruments) ve üretim ekipmanı satanlar (ASML, Applied Materials, Lam Research, KLA). Otomotiv ve sanayi çiplerinin ağırlıklı olduğu NXP, onsemi, Microchip ve Analog Devices döngünün farklı bir evresinde hareket edebilir. ASML, TSMC ve SK hynix'in ana borsası ABD dışında; piyasa değeri bu yüzden boş kalıyor.",
    whyEn:
      "The industry splits into three business models and the list carries all three: fabless designers (Nvidia, AMD, Broadcom, Qualcomm, Marvell, Arm), manufacturers working on contract or on their own account (TSMC, Intel, Micron, SK hynix, Texas Instruments), and equipment suppliers (ASML, Applied Materials, Lam Research, KLA). NXP, onsemi, Microchip and Analog Devices lean on automotive and industrial chips and can sit at a different point of the cycle. ASML, TSMC and SK hynix have their primary listing outside the US, so their market cap is left blank.",
    guides: ["sektor-rotasyonu", "volatilite"],
  },
  {
    slug: "bulut-yazilim",
    symbols: [
      "MSFT", "AMZN", "GOOGL", "ORCL", "CRM", "NOW", "ADBE", "INTU",
      "SNOW", "DDOG", "MDB", "WDAY", "SHOP", "NET",
    ],
    benchmark: { symbol: "SKYY", name: "First Trust Cloud Computing ETF" },
    titleTr: "Bulut ve Yazılım",
    titleEn: "Cloud & Software",
    dekTr: "Altyapıyı kiralayan dev bulut sağlayıcıları ve abonelikle satılan kurumsal yazılım.",
    dekEn: "The hyperscalers that rent out infrastructure and the enterprise software sold by subscription.",
    whyTr:
      "İlk grup altyapıyı kiralıyor: Amazon Web Services, Microsoft Azure, Google Cloud ve Oracle Cloud. İkinci grup bu altyapının üstünde abonelikle yazılım satıyor: Salesforce, ServiceNow, Adobe, Intuit, Workday ve Shopify. Snowflake, Datadog, MongoDB ve Cloudflare kullanıma göre ücretlendiren veri ve altyapı yazılımı sunuyor; müşterinin bulut faturası büyüdükçe onların geliri de büyüyor. Abonelik gelirinin öngörülebilirliği bu şirketlerin değerlemesini genellikle kârdan çok gelir büyümesine bağlıyor.",
    whyEn:
      "The first group rents out infrastructure: Amazon Web Services, Microsoft Azure, Google Cloud and Oracle Cloud. The second sells subscription software on top of it: Salesforce, ServiceNow, Adobe, Intuit, Workday and Shopify. Snowflake, Datadog, MongoDB and Cloudflare sell data and infrastructure software priced on usage, so their revenue grows as customers' cloud bills grow. Because subscription revenue is predictable, these companies are usually valued more on revenue growth than on current profit.",
    guides: ["degerleme", "nakit-akisi"],
  },
  {
    slug: "siber-guvenlik",
    symbols: [
      "CRWD", "PANW", "FTNT", "NET", "OKTA", "GEN", "AKAM", "FFIV", "RBRK", "SAIL", "CSCO",
    ],
    benchmark: { symbol: "CIBR", name: "First Trust NASDAQ Cybersecurity ETF" },
    titleTr: "Siber Güvenlik",
    titleEn: "Cybersecurity",
    dekTr: "Uç nokta, ağ, kimlik ve veri koruması: şirketlerin kesmeye en son cesaret ettiği bütçe kalemi.",
    dekEn: "Endpoint, network, identity and data protection: the budget line companies are slowest to cut.",
    whyTr:
      "Liste güvenliğin katmanlarına göre seçildi: uç nokta koruması (CrowdStrike), güvenlik duvarı ve ağ güvenliği (Palo Alto Networks, Fortinet, Cisco, F5), ağ kenarı ve web trafiği (Cloudflare, Akamai), kimlik yönetimi (Okta, SailPoint), yedekleme ve veri kurtarma (Rubrik) ve tüketici güvenliği (Gen Digital). Güvenlik harcaması ekonomik yavaşlamada diğer bilişim kalemlerinden genellikle daha dirençli kalıyor, ama büyük bir ihlal ya da hatalı bir güncelleme tek bir şirketin hissesini sektörden bağımsız sarsabiliyor.",
    whyEn:
      "The list follows the layers of security: endpoint protection (CrowdStrike), firewalls and network security (Palo Alto Networks, Fortinet, Cisco, F5), the network edge and web traffic (Cloudflare, Akamai), identity management (Okta, SailPoint), backup and data recovery (Rubrik) and consumer security (Gen Digital). Security spending usually holds up better than other IT budgets in a slowdown, but a major breach or a faulty update can move a single stock regardless of the sector.",
    guides: ["cesitlendirme", "volatilite"],
  },
  {
    slug: "obezite-ilaclari",
    symbols: ["LLY", "AMGN", "PFE", "REGN", "ABBV", "MRK", "ALT", "WST"],
    benchmark: null,
    titleTr: "Obezite İlaçları (GLP-1)",
    titleEn: "Obesity Drugs (GLP-1)",
    dekTr: "GLP-1 sınıfı kilo verme ilaçlarını satanlar, geliştirenler ve üretim zincirine parça verenler.",
    dekEn: "Companies selling, developing or supplying the production chain for GLP-1 class weight-loss drugs.",
    whyTr:
      "Eli Lilly, tirzepatid (Mounjaro, Zepbound) ile pazarın iki büyük satıcısından biri; öteki Novo Nordisk sembol tablomuzda olmadığı için listede yok. Amgen (MariTide), Pfizer (Metsera satın alımı), AbbVie (amilin benzeri molekül lisansı), Merck (ağızdan alınan GLP-1 lisansı) ve Altimmune (pemvidutid) geliştirme aşamasındaki adaylarla temaya giriyor; Regeneron kilo verirken kas kaybını azaltmayı hedefleyen kombinasyonları deniyor. West Pharmaceutical enjeksiyon kalemlerinin bileşenlerini üretiyor. Geliştirme aşamasındaki bir ilacın klinik sonucu hisseyi tek günde sert oynatabilir.",
    whyEn:
      "Eli Lilly is one of the two large sellers in the market with tirzepatide (Mounjaro, Zepbound); the other, Novo Nordisk, is not in our symbol table and so is not listed. Amgen (MariTide), Pfizer (through its Metsera acquisition), AbbVie (a licensed amylin analogue), Merck (a licensed oral GLP-1) and Altimmune (pemvidutide) join through candidates still in development, and Regeneron is testing combinations meant to limit muscle loss during weight loss. West Pharmaceutical makes components for injection pens. A clinical readout for a drug in development can move a stock sharply in a single day.",
    guides: ["volatilite", "cesitlendirme"],
  },
  {
    slug: "nukleer-enerji",
    symbols: ["CEG", "VST", "NRG", "NEE", "CCJ", "GEV", "ETN", "VRT", "PWR", "HUBB", "BE"],
    benchmark: { symbol: "NLR", name: "VanEck Uranium and Nuclear ETF" },
    titleTr: "Nükleer ve Enerji Altyapısı",
    titleEn: "Nuclear & Power Infrastructure",
    dekTr: "Veri merkezlerinin elektrik talebini karşılayan üretici, yakıt tedarikçisi ve şebeke ekipmanı şirketleri.",
    dekEn: "The generators, fuel suppliers and grid-equipment makers meeting data centres' demand for electricity.",
    whyTr:
      "Üreticiler: Constellation Energy ABD'nin en büyük nükleer santral filosunu işletiyor; Vistra, NRG ve NextEra nükleer, doğal gaz ve yenilenebilir kapasite taşıyor. Yakıt: Cameco uranyum üretiyor (ana borsası Kanada olduğu için piyasa değeri boş). Ekipman ve kurulum: GE Vernova gaz türbini ve şebeke ekipmanı yapıyor ve küçük modüler reaktör geliştiriyor; Eaton, Hubbell ve Vertiv elektrik dağıtımı ve veri merkezi soğutması, Quanta şebeke inşaatı, Bloom Energy yerinde elektrik üreten yakıt pilleri satıyor. Ortak soru aynı: şebekeye bağlanmayı bekleyen talep ne kadar hızlı karşılanabilir.",
    whyEn:
      "Generators: Constellation Energy runs the largest nuclear fleet in the US; Vistra, NRG and NextEra own nuclear, natural gas and renewable capacity. Fuel: Cameco mines uranium (primary listing in Canada, so market cap is blank). Equipment and build-out: GE Vernova makes gas turbines and grid equipment and is developing a small modular reactor; Eaton, Hubbell and Vertiv supply power distribution and data centre cooling, Quanta builds grid infrastructure and Bloom Energy sells fuel cells that generate power on site. The shared question is how fast demand waiting for a grid connection can be met.",
    guides: ["sektor-rotasyonu", "faiz-tahvil"],
  },
  {
    slug: "elektrikli-araclar",
    symbols: ["TSLA", "GM", "F", "VFS", "APTV", "ON", "NXPI", "ALB", "CHPT"],
    benchmark: { symbol: "DRIV", name: "Global X Autonomous & Electric Vehicles ETF" },
    titleTr: "Elektrikli Araçlar",
    titleEn: "Electric Vehicles",
    dekTr: "Elektrikli araç üreticileri, araç içi çip ve elektrik sistemi tedarikçileri, batarya hammaddesi ve şarj ağı.",
    dekEn: "EV makers, suppliers of in-vehicle chips and electrical systems, battery materials and charging networks.",
    whyTr:
      "Üreticiler: Tesla yalnızca elektrikli araç satıyor; General Motors ve Ford elektrikli modelleri içten yanmalı araç işinin yanında yürütüyor; VinFast Vietnam merkezli (ana para birimi ABD doları olmadığı için piyasa değeri boş). Tedarik: onsemi ve NXP araç içi güç ve kontrol çipleri, Aptiv elektrik mimarisi ve yazılım, Albemarle batarya için lityum üretiyor. ChargePoint şarj istasyonu ağı işletiyor. Tedarikçilerin gelirinin önemli bir kısmı elektrikli olmayan araçlardan da geliyor; tema tek başına bu hisseleri açıklamıyor.",
    whyEn:
      "Makers: Tesla sells only electric vehicles; General Motors and Ford run EV lines alongside their combustion business; VinFast is based in Vietnam (its reporting currency is not the dollar, so market cap is blank). Suppliers: onsemi and NXP make in-vehicle power and control chips, Aptiv supplies electrical architecture and software, Albemarle produces lithium for batteries. ChargePoint runs a charging network. Much of the suppliers' revenue also comes from non-electric vehicles, so the theme alone does not explain these stocks.",
    guides: ["volatilite", "cesitlendirme"],
  },
  {
    slug: "uzay",
    symbols: ["SPCX", "RKLB", "ASTS", "SPCE", "LMT", "NOC", "LHX", "BA", "KTOS"],
    benchmark: { symbol: "UFO", name: "Procure Space ETF" },
    titleTr: "Uzay",
    titleEn: "Space",
    dekTr: "Fırlatma, uydu ve uzay araçları: yeni şirketlerle köklü savunma üreticileri yan yana.",
    dekEn: "Launch, satellites and spacecraft: young companies alongside established defence contractors.",
    whyTr:
      "Fırlatma ve uzay aracı: SpaceX (Haziran 2026'da halka arz oldu), Rocket Lab ve Virgin Galactic. Uydu hizmeti: AST SpaceMobile uzaydan doğrudan telefonlara bağlantı kurmayı hedefliyor. Köklü üreticiler: Lockheed Martin, Northrop Grumman, L3Harris ve Boeing uydu, roket motoru ve uzay aracı programları yürütüyor; Kratos uydu yer sistemleri sağlıyor. Köklü üreticilerde uzay gelirin küçük bir parçası, genç şirketlerde ise gelirin neredeyse tamamı; ikisi aynı haberlere çok farklı tepki verebilir.",
    whyEn:
      "Launch and spacecraft: SpaceX (listed in June 2026), Rocket Lab and Virgin Galactic. Satellite services: AST SpaceMobile aims to connect ordinary phones directly from space. Established contractors: Lockheed Martin, Northrop Grumman, L3Harris and Boeing run satellite, rocket-motor and spacecraft programmes; Kratos provides satellite ground systems. For the established contractors space is a small part of revenue, for the young companies it is nearly all of it; the two can react very differently to the same news.",
    guides: ["halka-arz", "volatilite"],
  },
  {
    slug: "uzun-temettu",
    symbols: [
      "KO", "PG", "JNJ", "PEP", "CL", "KMB", "EMR", "DOV", "PH", "GPC",
      "ITW", "ADP", "LOW", "TGT", "WMT", "MCD", "ABT", "SYY", "NUE", "CINF",
    ],
    benchmark: { symbol: "VIG", name: "Vanguard Dividend Appreciation ETF" },
    titleTr: "Uzun Temettü Geçmişi",
    titleEn: "Long Dividend Records",
    dekTr: "Temettüsünü on yıllardır her yıl artırmasıyla bilinen şirketler.",
    dekEn: "Companies known for raising their dividend every year for decades.",
    whyTr:
      "Listedeki şirketler temettülerini on yıllardır kesintisiz artırmasıyla tanınıyor: tüketim ürünleri (Coca-Cola, Procter & Gamble, PepsiCo, Colgate, Kimberly-Clark), sağlık (Johnson & Johnson, Abbott), sanayi (Emerson, Dover, Parker-Hannifin, Illinois Tool Works, Nucor), perakende (Walmart, Lowe's, Target, McDonald's) ve hizmet (ADP, Sysco, Genuine Parts, Cincinnati Financial). Uzun bir artış serisi geçmişi anlatır, geleceği garanti etmez: seriler kesilebiliyor. Bu bir endeks üyeliği listesi değil; kıyas için temettü büyütenleri izleyen bir fon kullanılıyor.",
    whyEn:
      "The companies here are known for raising their dividends without a break for decades: consumer staples (Coca-Cola, Procter & Gamble, PepsiCo, Colgate, Kimberly-Clark), health care (Johnson & Johnson, Abbott), industrials (Emerson, Dover, Parker-Hannifin, Illinois Tool Works, Nucor), retail (Walmart, Lowe's, Target, McDonald's) and services (ADP, Sysco, Genuine Parts, Cincinnati Financial). A long record of increases describes the past and guarantees nothing: streaks do end. This is not an index membership list; a fund that tracks dividend growers serves as the benchmark.",
    guides: ["temettu", "cesitlendirme"],
  },
  {
    slug: "katilim-uyumlu",
    symbols: "katilim",
    benchmark: null,
    titleTr: "Katılım Uyumlu",
    titleEn: "Shariah Screen",
    dekTr: "Endeks üyeleri arasından katılım ön elemesini geçen en büyük şirketler, her gün yeniden seçilir.",
    dekEn: "The largest index members that pass the Shariah pre-screen, reselected every day.",
    whyTr:
      "Bu liste elle seçilmiyor. S&P 500, Nasdaq 100 ve Dow Jones üyelerinden faaliyet alanı elenmeyenler piyasa değerine göre sıralanıyor, en büyüklerinin borç ve nakit oranları sitenin hisse sayfalarındaki katılım taramasıyla aynı kurala göre ölçülüyor ve ön elemeyi geçenler burada listeleniyor. Oranlar üç ayda bir yayımlanan bilançodan geldiği için liste çoğu gün aynı kalır; fiyat değiştikçe sınıra yakın bir şirket girip çıkabilir.",
    whyEn:
      "This list is not hand-picked. Members of the S&P 500, Nasdaq 100 and Dow Jones whose line of business is not excluded are ranked by market cap, the debt and cash ratios of the largest are measured with the same rule as the Shariah screen on our stock pages, and those that pass the pre-screen are listed here. The ratios come from quarterly balance sheets, so the list stays the same on most days; a company close to a threshold can move in or out as the price changes.",
    guides: ["degerleme", "cesitlendirme"],
  },
] as const satisfies readonly ThemeEntry[];

export type ThemeSlug = (typeof THEMES)[number]["slug"];

export const THEME_SLUGS: readonly ThemeSlug[] = THEMES.map((theme) => theme.slug);

export function themeBySlug(slug: string): ThemeEntry | null {
  return THEMES.find((theme) => theme.slug === slug) ?? null;
}

export function themeTitle(theme: ThemeEntry, locale: string): string {
  return locale === "en" ? theme.titleEn : theme.titleTr;
}

export function themeDek(theme: ThemeEntry, locale: string): string {
  return locale === "en" ? theme.dekEn : theme.dekTr;
}

export function themeWhy(theme: ThemeEntry, locale: string): string {
  return locale === "en" ? theme.whyEn : theme.whyTr;
}
