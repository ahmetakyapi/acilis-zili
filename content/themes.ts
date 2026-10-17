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

   BAŞLIK VE AÇIKLAMA (17 Ekim, sahibinin isteği: "daha güzel, daha
   anlamlı"): başlık temanın neden izlendiğini söyler ("Yapay Zekâ
   Zinciri", "Temettüsünü Her Yıl Artıranlar"); açıklama jargonsuz tek
   cümle — "uç nokta" gibi sektör terimi yerine korunan şeyin kendisi.
   Slug'lar değişmedi, bağlantılar aynı.

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
      "ORCL", "PLTR", "MU", "SNDK", "ANET", "DELL", "SMCI", "ALAB", "NOW",
    ],
    benchmark: null,
    titleTr: "Yapay Zekâ Zinciri",
    titleEn: "The AI Supply Chain",
    dekTr: "Çipten buluta, sunucudan yazılıma: yapay zekâya yapılan yatırımın parasının aktığı şirketler.",
    dekEn: "From chips to cloud, servers to software: the companies that AI spending flows through.",
    whyTr:
      "Liste, yapay zekâ harcamasının parasının aktığı üç halkadan seçildi: hızlandırıcı, bellek ve veri merkezi depolaması üreten yarı iletken şirketleri (Nvidia, AMD, Broadcom, Micron, SanDisk, TSMC), bu çipleri veri merkezlerine kuran ve kiralayan bulut sağlayıcıları (Microsoft, Alphabet, Amazon, Oracle, Meta) ve sunucu, ağ ve yazılım tarafı (Dell, Super Micro, Arista, Astera Labs, Palantir, ServiceNow). Halkalar aynı talebe bağlı ama aynı anda hareket etmek zorunda değil: bulut şirketlerinin yatırım bütçesi bir halkanın geliri, ötekinin gideridir.",
    whyEn:
      "The list is drawn from the three links that AI spending flows through: the semiconductor makers of accelerators, memory and data-center storage (Nvidia, AMD, Broadcom, Micron, SanDisk, TSMC), the cloud providers that install and rent those chips (Microsoft, Alphabet, Amazon, Oracle, Meta), and the server, networking and software layer (Dell, Super Micro, Arista, Astera Labs, Palantir, ServiceNow). The links share the same demand but need not move together: a cloud company's capital budget is one link's revenue and another's expense.",
    guides: ["sektor-rotasyonu", "degerleme"],
  },
  {
    slug: "yari-iletkenler",
    symbols: [
      "NVDA", "AVGO", "AMD", "TSM", "ASML", "MU", "QCOM", "TXN", "ADI", "INTC",
      "AMAT", "LRCX", "KLAC", "MRVL", "ARM", "NXPI", "ON", "MCHP", "MPWR", "SKHY",
      /* SanDisk (28 Eylül, sahibinin isteği): Western Digital'den 2025'te
         ayrılan NAND flash üreticisi; endeks tohumunda GICS alt sektörü
         zaten "Semiconductors" ve Micron ile SK hynix'in bellek ayağının
         yanında duruyor. */
      "SNDK",
    ],
    benchmark: { symbol: "SMH", name: "VanEck Semiconductor ETF" },
    titleTr: "Yarı İletkenler",
    titleEn: "Semiconductors",
    dekTr: "Çipi tasarlayan, üreten ve üretim makinesini yapan şirketler: teknolojinin en döngüsel, en sermaye yoğun halkası.",
    dekEn: "The companies that design chips, make them and build the machines that make them: tech's most cyclical, capital-heavy link.",
    whyTr:
      "Sektör üç iş modeline ayrılıyor ve liste üçünü de taşıyor: kendi fabrikası olmadan tasarlayanlar (Nvidia, AMD, Broadcom, Qualcomm, Marvell, Arm), sözleşmeli ya da kendi adına üretenler (TSMC, Intel, Micron, SK hynix, SanDisk, Texas Instruments) ve üretim ekipmanı satanlar (ASML, Applied Materials, Lam Research, KLA). Otomotiv ve sanayi çiplerinin ağırlıklı olduğu NXP, onsemi, Microchip ve Analog Devices döngünün farklı bir evresinde hareket edebilir. ASML, TSMC ve SK hynix'in ana borsası ABD dışında; piyasa değeri bu yüzden boş kalıyor.",
    whyEn:
      "The industry splits into three business models and the list carries all three: fabless designers (Nvidia, AMD, Broadcom, Qualcomm, Marvell, Arm), manufacturers working on contract or on their own account (TSMC, Intel, Micron, SK hynix, SanDisk, Texas Instruments), and equipment suppliers (ASML, Applied Materials, Lam Research, KLA). NXP, onsemi, Microchip and Analog Devices lean on automotive and industrial chips and can sit at a different point of the cycle. ASML, TSMC and SK hynix have their primary listing outside the US, so their market cap is left blank.",
    guides: ["sektor-rotasyonu", "volatilite"],
  },
  {
    slug: "bulut-yazilim",
    symbols: [
      "MSFT", "AMZN", "GOOGL", "ORCL", "CRM", "NOW", "ADBE", "INTU",
      "SNOW", "DDOG", "MDB", "WDAY", "SHOP", "NET",
    ],
    benchmark: { symbol: "SKYY", name: "First Trust Cloud Computing ETF" },
    titleTr: "Bulut ve Abonelik Yazılımı",
    titleEn: "Cloud and Subscription Software",
    dekTr: "Sunucu kiralayan bulut devleri ve şirketlere abonelikle yazılım satanlar: geliri her ay yenilenen işler.",
    dekEn: "The cloud giants that rent out servers and the companies selling software by subscription: revenue that renews every month.",
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
    dekTr: "Bilgisayarları, ağları, kullanıcı hesaplarını ve verileri saldırılara karşı koruyan şirketler: ekonomi yavaşlasa da kolay kısılmayan bir harcama.",
    dekEn: "The companies that protect computers, networks, user accounts and data from attacks: spending that rarely gets cut, even in a slowdown.",
    whyTr:
      "Liste güvenliğin katmanlarına göre seçildi: uç nokta koruması (CrowdStrike), güvenlik duvarı ve ağ güvenliği (Palo Alto Networks, Fortinet, Cisco, F5), ağ kenarı ve web trafiği (Cloudflare, Akamai), kimlik yönetimi (Okta, SailPoint), yedekleme ve veri kurtarma (Rubrik) ve tüketici güvenliği (Gen Digital). Güvenlik harcaması ekonomik yavaşlamada diğer bilişim kalemlerinden genellikle daha dirençli kalıyor, ama büyük bir ihlal ya da hatalı bir güncelleme tek bir şirketin hissesini sektörden bağımsız sarsabiliyor.",
    whyEn:
      "The list follows the layers of security: endpoint protection (CrowdStrike), firewalls and network security (Palo Alto Networks, Fortinet, Cisco, F5), the network edge and web traffic (Cloudflare, Akamai), identity management (Okta, SailPoint), backup and data recovery (Rubrik) and consumer security (Gen Digital). Security spending usually holds up better than other IT budgets in a slowdown, but a major breach or a faulty update can move a single stock regardless of the sector.",
    guides: ["cesitlendirme", "volatilite"],
  },
  {
    slug: "obezite-ilaclari",
    /* Üye kararı (28 Eylül, sahibinin sorusu: "obezite ilaçları mı, sağlık
       şirketleri mi?"): liste bir dönem Regeneron, AbbVie ve Merck'i de
       taşıyordu. Üçünün de obezite bağı lisansla alınmış ERKEN aşama bir aday
       (Regeneron ve Merck'te Hansoh'tan GLP-1, AbbVie'de Gubra'dan amilin
       benzeri) ve hisselerini oynatan işler başka yerde (Dupixent, Eylea;
       Skyrizi, Humira; Keytruda). Temanın medyanı böylece büyük ilaç
       şirketlerinin ortalamasını anlatıyor, ad ise dar bir tema vaat ediyordu.
       Ad genişletilmedi (yerleşik bir yatırım teması: "GLP-1 / obezite"), üye
       daraltıldı: obezite ya satışın ana kalemi (Lilly, West'in kalem
       bileşenleri) ya da faz 3'te değerlemeyi taşıyan bir program (Amgen
       MariTide, Pfizer'in yaklaşık 10 milyar dolarlık Metsera alımı) ya da
       şirketin tek işi (Altimmune). Viking, Hims & Hers ve Novo Nordisk
       sembol tablosunda yok; tablo genişlerse ilk adaylar onlar. */
    symbols: ["LLY", "AMGN", "PFE", "ALT", "WST"],
    benchmark: null,
    titleTr: "Kilo Verme İlaçları (GLP-1)",
    titleEn: "Weight-Loss Drugs (GLP-1)",
    dekTr: "Mounjaro ve Zepbound gibi kilo verdiren iğneleri satan, yenisini geliştiren ve kalemini üreten şirketler.",
    dekEn: "The companies selling weight-loss injections such as Mounjaro and Zepbound, developing the next ones and making the pens.",
    whyTr:
      "Eli Lilly, tirzepatid (Mounjaro, Zepbound) ile pazarın iki büyük satıcısından biri ve listede obezitenin gelirin ana kalemi olduğu tek büyük şirket; öteki satıcı Novo Nordisk sembol tablomuzda olmadığı için listede yok. Amgen (MariTide) ve Pfizer (Metsera satın alımıyla gelen adaylar) son aşama klinik denemelerdeki programlarla temaya giriyor; ikisinin de bugünkü geliri başka ilaçlardan geliyor, hisselerini obeziteye bağlayan beklenti. Altimmune'un (pemvidutid) tek işi bu. West Pharmaceutical enjeksiyon kalemlerinin bileşenlerini üretiyor. Obezite adayı yalnızca erken aşamada, lisansla alınmış büyük ilaç şirketleri (Regeneron, AbbVie, Merck) listede değil: hisseleri başka ilaçlarla hareket ediyor. Geliştirme aşamasındaki bir ilacın klinik sonucu hisseyi tek günde sert oynatabilir.",
    whyEn:
      "Eli Lilly is one of the two large sellers in the market with tirzepatide (Mounjaro, Zepbound) and the only large company here for which obesity is a main source of revenue; the other seller, Novo Nordisk, is not in our symbol table and so is not listed. Amgen (MariTide) and Pfizer (candidates from its Metsera acquisition) join through programmes in late-stage trials; both earn today's revenue from other drugs, and what ties their stocks to obesity is expectation. Altimmune (pemvidutide) does nothing else. West Pharmaceutical makes components for injection pens. Large drugmakers whose only obesity candidate is an early-stage licence (Regeneron, AbbVie, Merck) are left out: their stocks move with other drugs. A clinical readout for a drug in development can move a stock sharply in a single day.",
    guides: ["volatilite", "cesitlendirme"],
  },
  {
    slug: "nukleer-enerji",
    symbols: ["CEG", "VST", "NRG", "NEE", "CCJ", "GEV", "ETN", "VRT", "PWR", "HUBB", "BE"],
    /* NLR (VanEck Uranium and Nuclear) yalnızca nükleer tarafı izliyor; tema
       28 Eylül'de adıyla birlikte elektrik üreticileri ve şebeke ekipmanını
       da kapsadığını söylüyor. Üstteki kural: birebir izleyen yaygın fon
       yoksa ölçüt yok. */
    benchmark: null,
    /* Ad (17 Ekim): "Veri Merkezlerinin Elektriği" — sahibinin isteği,
       başlık temanın ne olduğunu değil NEDEN izlendiğini söylesin; listenin
       ortak sorusu veri merkezi elektrik talebi. Nükleer açıklamada.
       Ad (28 Eylül): "Nükleer ve Enerji Altyapısı" idi. On bir üyenin
       yalnızca üçünün işi nükleer (Constellation, Cameco, GE Vernova'nın
       reaktör programı); kalanı elektrik üreticisi ya da şebeke ve güç
       ekipmanı. "Enerji" Türkçede petrol ve doğal gazı da çağırıyor, listede
       ikisi de yok. Slug bağlantılar için aynı kaldı. */
    titleTr: "Veri Merkezlerinin Elektriği",
    titleEn: "Powering the Data Centres",
    dekTr: "Yapay zekâyla hızla artan elektrik ihtiyacını karşılayan nükleer ve doğal gaz santralleri, uranyum ve şebeke ekipmanı şirketleri.",
    dekEn: "The nuclear and gas generators, uranium miners and grid-equipment makers meeting the fast-growing power demand from AI.",
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
    dekTr: "Elektrikli otomobil üreticileri ve onlara çip, elektrik sistemi, batarya hammaddesi ve şarj ağı sağlayan şirketler.",
    dekEn: "Electric car makers and the companies supplying their chips, electrical systems, battery materials and charging networks.",
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
    titleTr: "Uzay Ekonomisi",
    titleEn: "The Space Economy",
    dekTr: "Roket fırlatan, uydu kuran ve uzay aracı üreten şirketler: genç girişimlerle köklü savunma devleri yan yana.",
    dekEn: "The companies launching rockets, building satellites and making spacecraft: young start-ups alongside established defence giants.",
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
    titleTr: "Temettüsünü Her Yıl Artıranlar",
    titleEn: "Steady Dividend Raisers",
    dekTr: "Kâr payını on yıllardır her yıl artırmasıyla bilinen, çoğu günlük hayattan tanıdık şirketler.",
    dekEn: "Companies known for raising their dividend every year for decades, most of them household names.",
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
    /* AD VE AÇIKLAMA (28 Eylül). Ad Türkiye'deki yerleşik terim (katılım
       bankacılığı, Katılım Endeksi) olarak kalıyor: "Faizsiz Yatırıma
       Uygun" denendi, sahibi beğenmedi. Terimin ne demek olduğunu açıklama
       cümlesi söylüyor: faizsiz finans, ne elendiği ve bunun bir sertifika
       değil oran taraması olduğu. */
    titleTr: "Katılım Uyumlu",
    titleEn: "Shariah-Compliant",
    dekTr: "Faizsiz finans (katılım) ön elemesini geçen büyük ABD şirketleri: işi uygun, borcu ve faizli nakdi sınırın altında. Liste her gün yeniden seçilir; sertifika değildir.",
    dekEn: "The largest index companies that pass an Islamic finance pre-screen: permissible business, debt and interest-bearing cash under the limits. Reselected daily; not a certification.",
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
