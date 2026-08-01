/**
 * S&P 500 ve Nasdaq-100'ün geri kalan üyeleri için şirket tanıtımları.
 *
 * `descriptions.ts` en çok takip edilen isimleri daha uzun anlatır; bu dosya
 * kapsamı endekslerin TAMAMINA genişletir. Her kayıt o şirkete özeldir —
 * sektör şablonu değildir. İki dilde, ne iş yaptığını ve hangi alanda öne
 * çıktığını söyler.
 */

import type { SymbolDescription } from "./descriptions";

export const SP500_DESCRIPTIONS: Record<string, SymbolDescription> = {
  A: {
    tr: "Agilent Technologies — laboratuvar analiz cihazları üreticisi; kromatografi ve kütle spektrometresi sistemleriyle ilaç, kimya ve gıda laboratuvarlarının ölçüm altyapısını kurar.",
    en: "Agilent Technologies makes laboratory analysis instruments — chromatography and mass spectrometry systems used by pharma, chemical and food labs.",
  },
  ABNB: {
    tr: "Airbnb — konaklama paylaşım platformu; ev sahiplerini gezginlerle buluşturur, her rezervasyondan komisyon alır. Otel zinciri sahibi değildir, pazar yeri işletir.",
    en: "Airbnb runs the home-sharing marketplace, connecting hosts with travellers and taking a fee per booking rather than owning property.",
  },
  ACGL: {
    tr: "Arch Capital Group — sigorta ve reasürans şirketi; mülk, kaza ve mortgage sigortası branşlarında risk üstlenir.",
    en: "Arch Capital Group underwrites insurance and reinsurance across property, casualty and mortgage lines.",
  },
  ADM: {
    tr: "Archer Daniels Midland — tarım ürünleri devi; mısır, soya ve buğdayı işleyip gıda, yem ve biyoyakıt girdisine dönüştürür, dünya çapında ticaretini yapar.",
    en: "Archer Daniels Midland processes corn, soy and wheat into food, feed and biofuel inputs, trading crops worldwide.",
  },
  ADSK: {
    tr: "Autodesk — tasarım yazılımının standardı; AutoCAD ile mimarlık ve mühendislik çizimi, Revit ile yapı bilgi modellemesi, Fusion ile ürün tasarımı.",
    en: "Autodesk sets the standard in design software — AutoCAD for drafting, Revit for building information modelling and Fusion for product design.",
  },
  AEE: {
    tr: "Ameren — Missouri ve Illinois'de elektrik ve doğalgaz dağıtan düzenlenmiş altyapı şirketi.",
    en: "Ameren is a regulated utility delivering electricity and natural gas across Missouri and Illinois.",
  },
  AEP: {
    tr: "American Electric Power — ABD'nin en büyük elektrik iletim ağlarından birini işletir; 11 eyalette milyonlarca aboneye ulaşır.",
    en: "American Electric Power runs one of the largest US transmission networks, serving millions of customers across 11 states.",
  },
  AES: {
    tr: "AES Corporation — küresel elektrik üreticisi; kömürden yenilenebilire geçişi hızlandırıyor, veri merkezlerine yeşil enerji anlaşmaları yapıyor.",
    en: "AES Corporation generates power globally, shifting from coal to renewables and signing clean-energy deals with data centers.",
  },
  AFL: {
    tr: "Aflac — tamamlayıcı sağlık ve kaza sigortası şirketi; gelirinin büyük kısmını Japonya pazarından elde eder.",
    en: "Aflac sells supplemental health and accident insurance, earning much of its revenue in Japan.",
  },
  AIG: {
    tr: "American International Group — küresel ticari sigorta şirketi; büyük şirketlerin mülk, sorumluluk ve özel risklerini sigortalar.",
    en: "American International Group underwrites commercial insurance, covering property, liability and specialty risks for large corporates.",
  },
  AIZ: {
    tr: "Assurant — niş sigorta şirketi; cihaz koruma planları, konut kiracı sigortası ve araç servis sözleşmelerinde uzmanlaşmıştır.",
    en: "Assurant specializes in niche insurance — device protection plans, renters coverage and vehicle service contracts.",
  },
  AJG: {
    tr: "Arthur J. Gallagher — sigorta brokerliği ve risk danışmanlığı; şirketlere poliçe aracılığı yapıp komisyon geliri elde eder.",
    en: "Arthur J. Gallagher brokers insurance and advises on risk, earning commissions rather than underwriting.",
  },
  AKAM: {
    tr: "Akamai Technologies — internetin dağıtım katmanı; içerik dağıtım ağı (CDN), siber güvenlik ve uç bilişim hizmetleri sunar.",
    en: "Akamai Technologies operates a content delivery network plus cybersecurity and edge computing services.",
  },
  ALAB: {
    tr: "Astera Labs — yapay zekâ sunucularının veri yollarını hızlandıran bağlantı çipleri tasarlar; GPU ve CPU'lar arası iletişimin darboğazını çözer.",
    en: "Astera Labs designs connectivity silicon that speeds the data paths inside AI servers, easing GPU-to-CPU bottlenecks.",
  },
  ALB: {
    tr: "Albemarle — dünyanın en büyük lityum üreticilerinden; elektrikli araç bataryalarının ana hammaddesini sağlar.",
    en: "Albemarle is among the world's largest lithium producers, supplying the key raw material for EV batteries.",
  },
  ALGN: {
    tr: "Align Technology — Invisalign şeffaf diş teli sistemini üretir; dijital ağız tarayıcılarıyla ortodontiyi dönüştürdü.",
    en: "Align Technology makes the Invisalign clear aligner system and the digital scanners that reshaped orthodontics.",
  },
  ALL: {
    tr: "Allstate — ABD'nin en büyük araç ve konut sigortacılarından; doğrudan satış ve acente ağıyla çalışır.",
    en: "Allstate is one of the largest US auto and home insurers, selling through both agents and direct channels.",
  },
  ALLE: {
    tr: "Allegion — kapı kilidi ve giriş güvenliği üreticisi; mekanik kilitlerden elektronik erişim kontrolüne geçişi yönetiyor.",
    en: "Allegion makes locks and entrance security, moving from mechanical hardware to electronic access control.",
  },
  ALNY: {
    tr: "Alnylam Pharmaceuticals — RNA susturma (RNAi) teknolojisinin öncüsü; genetik hastalıkların kaynağındaki hatalı proteini üretimden önce durdurur.",
    en: "Alnylam pioneered RNA interference therapy, silencing faulty proteins at the genetic source before they are made.",
  },
  AMCR: {
    tr: "Amcor — küresel ambalaj üreticisi; gıda, içecek ve ilaç sektörüne esnek ve sert ambalaj çözümleri sağlar.",
    en: "Amcor supplies flexible and rigid packaging to the food, beverage and pharmaceutical industries worldwide.",
  },
  AME: {
    tr: "Ametek — elektronik cihaz ve elektromekanik ekipman üreticisi; havacılıktan sağlığa niş sanayi ölçüm sistemleri yapar.",
    en: "Ametek builds electronic instruments and electromechanical equipment for niche industrial applications from aerospace to healthcare.",
  },
  AMP: {
    tr: "Ameriprise Financial — varlık yönetimi ve finansal danışmanlık şirketi; bireysel yatırımcılara emeklilik planlaması sunar.",
    en: "Ameriprise Financial manages assets and provides financial advice, focused on retirement planning for individuals.",
  },
  AMT: {
    tr: "American Tower — dünyanın en büyük baz istasyonu GYO'su; kuleleri operatörlere uzun vadeli kiralar, 5G yayılımından gelir üretir.",
    en: "American Tower is the largest cell-tower REIT, leasing sites to carriers on long contracts and benefiting from 5G rollout.",
  },
  AON: {
    tr: "Aon — küresel sigorta brokerliği ve risk danışmanlığı; şirketlerin risk, emeklilik ve sağlık programlarını yönetir.",
    en: "Aon brokers insurance and advises on risk, retirement and health programmes for corporations worldwide.",
  },
  AOS: {
    tr: "A. O. Smith — su ısıtıcısı ve su arıtma sistemleri üreticisi; Kuzey Amerika ve Çin pazarlarında güçlü.",
    en: "A. O. Smith makes water heaters and water treatment systems, strong in North America and China.",
  },
  APA: {
    tr: "APA Corporation — bağımsız petrol ve doğalgaz üreticisi; ABD Permian havzası, Mısır ve Kuzey Denizi'nde üretim yapar.",
    en: "APA Corporation is an independent oil and gas producer with operations in the Permian, Egypt and the North Sea.",
  },
  APD: {
    tr: "Air Products — endüstriyel gaz devi; oksijen, azot ve özellikle hidrojen projeleriyle temiz enerji dönüşümünün tedarikçisi.",
    en: "Air Products supplies industrial gases — oxygen, nitrogen and notably hydrogen projects for the clean-energy transition.",
  },
  APH: {
    tr: "Amphenol — konektör ve sensör üreticisi; veri merkezi, otomotiv ve savunma sistemlerinin elektriksel bağlantılarını sağlar.",
    en: "Amphenol makes connectors and sensors that carry signals inside data centers, vehicles and defense systems.",
  },
  APO: {
    tr: "Apollo Global Management — alternatif varlık yöneticisi; özel kredi, özel sermaye ve emeklilik/sigorta (Athene) kolu ile çalışır.",
    en: "Apollo Global Management runs private credit, private equity and the Athene retirement services business.",
  },
  APP: {
    tr: "AppLovin — mobil reklam ve uygulama büyütme platformu; yapay zekâ destekli reklam motoruyla oyun ve e-ticaret uygulamalarına kullanıcı kazandırır.",
    en: "AppLovin runs an AI-driven mobile advertising platform that acquires users for gaming and e-commerce apps.",
  },
  APTV: {
    tr: "Aptiv — otomotiv teknoloji tedarikçisi; araç elektrik mimarisi, sensörler ve otonom sürüş yazılımı sağlar.",
    en: "Aptiv supplies automotive technology — vehicle electrical architecture, sensors and autonomous driving software.",
  },
  ARE: {
    tr: "Alexandria Real Estate — yaşam bilimleri GYO'su; biyoteknoloji ve ilaç şirketlerine laboratuvar kampüsleri kiralar.",
    en: "Alexandria Real Estate is a life-science REIT leasing laboratory campuses to biotech and pharma tenants.",
  },
  ARES: {
    tr: "Ares Management — alternatif varlık yöneticisi; özel kredi alanında sektörün en büyüklerinden, gayrimenkul ve özel sermaye fonları yönetir.",
    en: "Ares Management is a leading alternative asset manager, especially in private credit, plus real estate and private equity.",
  },
  ATO: {
    tr: "Atmos Energy — ABD'nin en büyük saf doğalgaz dağıtım şirketi; ağırlıklı Teksas olmak üzere sekiz eyalette hizmet verir.",
    en: "Atmos Energy is the largest pure-play US natural gas distributor, serving eight states led by Texas.",
  },
  AVB: {
    tr: "AvalonBay Communities — konut GYO'su; ABD'nin yüksek gelirli metropollerinde lüks apartman portföyü işletir.",
    en: "AvalonBay Communities is an apartment REIT operating upscale rental communities in high-income US metros.",
  },
  AVY: {
    tr: "Avery Dennison — etiket ve yapışkan malzeme üreticisi; perakende etiketleri ve RFID izleme çözümlerinde lider.",
    en: "Avery Dennison makes labels and adhesive materials, leading in retail tags and RFID tracking.",
  },
  AWK: {
    tr: "American Water Works — ABD'nin en büyük halka açık su hizmetleri şirketi; su temini ve atık su altyapısını düzenlenmiş tarifelerle işletir.",
    en: "American Water Works is the largest publicly traded US water utility, running supply and wastewater systems on regulated tariffs.",
  },
  AXON: {
    tr: "Axon Enterprise — polis teknolojisi şirketi; Taser cihazları, vücut kameraları ve delil yönetimi bulut yazılımı üretir.",
    en: "Axon Enterprise builds public-safety technology — Tasers, body cameras and the cloud software managing that evidence.",
  },
  AZO: {
    tr: "AutoZone — yedek parça perakendecisi; araç sahiplerine ve tamircilere parça satar, agresif hisse geri alımlarıyla bilinir.",
    en: "AutoZone retails auto parts to drivers and repair shops, known for aggressive share buybacks.",
  },
  BALL: {
    tr: "Ball Corporation — dünyanın en büyük alüminyum içecek kutusu üreticisi; sürdürülebilir ambalaja geçişten yararlanıyor.",
    en: "Ball Corporation is the world's largest maker of aluminium beverage cans, benefiting from the shift to recyclable packaging.",
  },
  BAX: {
    tr: "Baxter International — hastane tedarik şirketi; damar içi sıvılar, infüzyon pompaları ve diyaliz sistemleri üretir.",
    en: "Baxter International supplies hospitals with IV fluids, infusion pumps and dialysis systems.",
  },
  BBY: {
    tr: "Best Buy — ABD'nin en büyük elektronik perakendecisi; mağaza ağının yanında kurulum ve teknik destek hizmeti (Geek Squad) sunar.",
    en: "Best Buy is the largest US electronics retailer, pairing stores with installation and tech support through Geek Squad.",
  },
  BDX: {
    tr: "Becton Dickinson — tıbbi teknoloji devi; enjektör, kateter ve laboratuvar tanı sistemlerinde dünya lideri.",
    en: "Becton Dickinson is a medical technology leader in syringes, catheters and laboratory diagnostic systems.",
  },
  BEN: {
    tr: "Franklin Resources — Franklin Templeton markasıyla küresel varlık yönetimi yapar; yatırım fonları ve ETF'ler sunar.",
    en: "Franklin Resources manages assets globally under the Franklin Templeton brand across funds and ETFs.",
  },
  "BF.B": {
    tr: "Brown-Forman — Jack Daniel's viskisinin sahibi; damıtılmış içki ve tekila markalarıyla küresel pazarda satış yapar.",
    en: "Brown-Forman owns Jack Daniel's and a portfolio of spirits and tequila brands sold worldwide.",
  },
  BG: {
    tr: "Bunge Global — tarımsal emtia işleyicisi; yağlı tohumları işleyip yemeklik yağ ve hayvan yemine dönüştürür, küresel ticaretini yapar.",
    en: "Bunge Global processes oilseeds into cooking oils and animal feed and trades agricultural commodities worldwide.",
  },
  BIIB: {
    tr: "Biogen — nörolojik hastalıklara odaklı biyoteknoloji şirketi; multipl skleroz tedavileri ve Alzheimer programlarıyla bilinir.",
    en: "Biogen is a biotech focused on neurological disease, known for multiple sclerosis therapies and Alzheimer's programmes.",
  },
  BKR: {
    tr: "Baker Hughes — petrol sahası ekipman ve hizmet şirketi; sondaj teknolojisinin yanında LNG türbinleri ve endüstriyel enerji çözümleri sunar.",
    en: "Baker Hughes supplies oilfield equipment and services plus LNG turbines and industrial energy technology.",
  },
  BLDR: {
    tr: "Builders FirstSource — ABD'nin en büyük yapı malzemesi tedarikçisi; müteahhitlere kereste, çatı makası ve hazır yapı bileşenleri sağlar.",
    en: "Builders FirstSource is the largest US supplier of building materials, providing lumber, trusses and prefabricated components to contractors.",
  },
  BNY: {
    tr: "BNY Mellon — dünyanın en büyük saklama bankası; kurumsal yatırımcıların varlıklarını muhafaza eder ve işlemlerini takas eder.",
    en: "BNY Mellon is the world's largest custody bank, safekeeping institutional assets and settling their trades.",
  },
  BR: {
    tr: "Broadridge Financial Solutions — yatırım sektörünün arka ofisi; hissedar iletişimi, oy toplama ve işlem sonrası süreçleri yürütür.",
    en: "Broadridge runs the investment industry's back office — shareholder communications, proxy voting and post-trade processing.",
  },
  BRO: {
    tr: "Brown & Brown — sigorta brokerliği şirketi; küçük ve orta ölçekli işletmelere poliçe aracılığı yapar.",
    en: "Brown & Brown brokers insurance, focused on small and mid-sized business clients.",
  },
  BXP: {
    tr: "BXP — ofis GYO'su; Boston, New York ve San Francisco gibi merkezlerde birinci sınıf ofis kuleleri işletir.",
    en: "BXP is an office REIT operating premier towers in Boston, New York and San Francisco.",
  },
  CAH: {
    tr: "Cardinal Health — ilaç ve tıbbi malzeme dağıtıcısı; eczane ve hastanelere tedarik zinciri hizmeti verir.",
    en: "Cardinal Health distributes drugs and medical supplies, running the supply chain for pharmacies and hospitals.",
  },
  CARR: {
    tr: "Carrier Global — iklimlendirme devi; klima, ısı pompası ve soğutma sistemleri üretir, binaların enerji verimliliğine odaklanır.",
    en: "Carrier Global makes air conditioning, heat pumps and refrigeration systems, focused on building energy efficiency.",
  },
  CASY: {
    tr: "Casey's General Stores — ABD'nin kırsal bölgelerinde akaryakıt istasyonu ve market zinciri işletir; hazır pizzasıyla tanınır.",
    en: "Casey's General Stores runs fuel stations and convenience shops across rural America, known for its prepared pizza.",
  },
  CB: {
    tr: "Chubb — dünyanın en büyük ticari mülk ve kaza sigortacılarından; yüksek net değerli bireylere de özel sigorta sunar.",
    en: "Chubb is among the largest commercial property and casualty insurers, also serving high-net-worth individuals.",
  },
  CBOE: {
    tr: "Cboe Global Markets — opsiyon borsası işletmecisi; VIX oynaklık endeksinin sahibi ve endeks opsiyonlarının merkezi.",
    en: "Cboe Global Markets operates options exchanges, owns the VIX volatility index and hosts index options trading.",
  },
  CBRE: {
    tr: "CBRE Group — dünyanın en büyük ticari gayrimenkul hizmet şirketi; kiralama aracılığı, değerleme ve tesis yönetimi yapar.",
    en: "CBRE Group is the largest commercial real estate services firm, handling leasing, valuation and facilities management.",
  },
  CCEP: {
    tr: "Coca-Cola Europacific Partners — Coca-Cola'nın Avrupa, Avustralya ve Endonezya'daki şişeleyicisi; üretim ve dağıtımı üstlenir.",
    en: "Coca-Cola Europacific Partners bottles and distributes Coca-Cola products across Europe, Australia and Indonesia.",
  },
  CCI: {
    tr: "Crown Castle — baz istasyonu ve fiber altyapı GYO'su; kuleleri ve şehir içi küçük hücreleri operatörlere kiralar.",
    en: "Crown Castle is a tower and fiber REIT leasing cell sites and urban small cells to carriers.",
  },
  CCL: {
    tr: "Carnival Corporation — dünyanın en büyük kruvaziyer şirketi; Carnival, Princess ve AIDA gibi markalarla gemi filosu işletir.",
    en: "Carnival Corporation is the world's largest cruise operator, sailing brands including Carnival, Princess and AIDA.",
  },
  CDW: {
    tr: "CDW Corporation — teknoloji çözüm sağlayıcısı; kurumlara ve kamuya donanım, yazılım ve BT hizmeti tedarik eder.",
    en: "CDW Corporation supplies hardware, software and IT services to businesses, government and education.",
  },
  CEG: {
    tr: "Constellation Energy — ABD'nin en büyük nükleer santral filosunun sahibi; karbonsuz elektriği veri merkezlerine uzun vadeli anlaşmalarla satar.",
    en: "Constellation Energy owns the largest US nuclear fleet, selling carbon-free power to data centers on long-term deals.",
  },
  CF: {
    tr: "CF Industries — azotlu gübre üreticisi; amonyak ve üre üretiminde doğalgaz maliyeti belirleyicidir, temiz amonyak projeleri yürütür.",
    en: "CF Industries makes nitrogen fertilizer; its ammonia and urea economics hinge on natural gas, with clean-ammonia projects underway.",
  },
  CFG: {
    tr: "Citizens Financial Group — ABD'nin kuzeydoğusunda faaliyet gösteren bölgesel banka; bireysel ve ticari bankacılık yapar.",
    en: "Citizens Financial Group is a regional bank across the US Northeast, serving retail and commercial customers.",
  },
  CHD: {
    tr: "Church & Dwight — ev ve kişisel bakım ürünleri üreticisi; Arm & Hammer karbonat markası ve vitamin/prezervatif markalarıyla bilinir.",
    en: "Church & Dwight makes household and personal care products, known for Arm & Hammer plus vitamin and condom brands.",
  },
  CHRW: {
    tr: "C.H. Robinson — üçüncü taraf lojistik şirketi; kendi kamyonu olmadan yük ile nakliyeciyi eşleştirir, komisyon geliri elde eder.",
    en: "C.H. Robinson is a third-party logistics broker matching freight with carriers without owning trucks.",
  },
  CHTR: {
    tr: "Charter Communications — Spectrum markasıyla kablolu internet ve televizyon sunar; ABD'nin en büyük geniş bant sağlayıcılarından.",
    en: "Charter Communications provides cable broadband and TV under the Spectrum brand, among the largest US providers.",
  },
  CI: {
    tr: "Cigna — sağlık hizmetleri şirketi; sigorta planlarının yanında Evernorth eczane fayda yönetimi koluyla ilaç tedarik zincirini yönetir.",
    en: "Cigna runs health plans plus Evernorth, its pharmacy benefit arm managing the drug supply chain.",
  },
  CIEN: {
    tr: "Ciena — optik ağ ekipmanı üreticisi; veri merkezleri ve telekom operatörleri arasındaki yüksek kapasiteli fiber bağlantıları kurar.",
    en: "Ciena builds optical networking gear carrying high-capacity fiber links between data centers and carriers.",
  },
  CINF: {
    tr: "Cincinnati Financial — bağımsız acenteler üzerinden ticari ve bireysel sigorta satan hasar-kaza sigortacısı.",
    en: "Cincinnati Financial writes commercial and personal property-casualty insurance through independent agents.",
  },
  CL: {
    tr: "Colgate-Palmolive — diş macunu ve ev bakım devi; Colgate, Palmolive ve Hill's evcil hayvan maması markalarını yönetir.",
    en: "Colgate-Palmolive makes toothpaste and home care products, plus Hill's pet nutrition.",
  },
  CLX: {
    tr: "Clorox — temizlik ve ev bakım ürünleri üreticisi; çamaşır suyu, Burt's Bees ve Brita markalarını kapsar.",
    en: "Clorox makes cleaning and household products spanning bleach, Burt's Bees and Brita.",
  },
  CMG: {
    tr: "Chipotle Mexican Grill — hızlı-gündelik restoran zinciri; franchise vermeden kendi mağazalarını işleterek büyür.",
    en: "Chipotle Mexican Grill is a fast-casual chain that grows by operating its own restaurants rather than franchising.",
  },
  CMI: {
    tr: "Cummins — dizel ve doğalgaz motoru üreticisi; kamyon motorlarının yanında jeneratör ve hidrojen teknolojileri geliştirir.",
    en: "Cummins makes diesel and gas engines for trucks plus generators and hydrogen power technology.",
  },
  CMS: {
    tr: "CMS Energy — Michigan'ın elektrik ve doğalgaz dağıtım şirketi; düzenlenmiş tarifelerle çalışır.",
    en: "CMS Energy is Michigan's regulated electricity and natural gas utility.",
  },
  CNC: {
    tr: "Centene Corporation — devlet destekli sağlık sigortası uzmanı; Medicaid ve Medicare planlarında ABD'nin en büyük sağlayıcılarından.",
    en: "Centene specializes in government-sponsored health plans, among the largest US providers of Medicaid and Medicare coverage.",
  },
  CNP: {
    tr: "CenterPoint Energy — Teksas ve Ohio'da elektrik ile doğalgaz dağıtan altyapı şirketi.",
    en: "CenterPoint Energy distributes electricity and natural gas across Texas and Ohio.",
  },
  COF: {
    tr: "Capital One — kredi kartı odaklı banka; veri analitiği temelli risk modelleriyle büyüdü, Discover satın alımıyla kendi ödeme ağına sahip oldu.",
    en: "Capital One is a credit-card-led bank built on data-driven underwriting, gaining its own payment network via Discover.",
  },
  COHR: {
    tr: "Coherent Corp. — optik bileşen ve lazer üreticisi; yapay zekâ veri merkezlerinin fiber bağlantı modüllerini sağlar.",
    en: "Coherent Corp. makes optical components and lasers, supplying the fiber transceivers inside AI data centers.",
  },
  COO: {
    tr: "Cooper Companies — kontakt lens üreticisi (CooperVision) ve kadın sağlığı tıbbi cihazları (CooperSurgical) şirketi.",
    en: "Cooper Companies makes contact lenses through CooperVision and women's health devices through CooperSurgical.",
  },
  COR: {
    tr: "Cencora — ilaç dağıtım devi (eski adıyla AmerisourceBergen); eczane ve hastanelere reçeteli ilaç tedarik eder.",
    en: "Cencora, formerly AmerisourceBergen, distributes prescription drugs to pharmacies and hospitals.",
  },
  CPAY: {
    tr: "Corpay — kurumsal ödeme şirketi; filo yakıt kartları, seyahat ödemeleri ve şirketler arası ödeme çözümleri sunar.",
    en: "Corpay handles corporate payments — fleet fuel cards, travel payments and business-to-business transfers.",
  },
  CPRT: {
    tr: "Copart — hasarlı araç açık artırma platformu; sigorta şirketlerinin pert araçlarını çevrimiçi ihaleyle alıcılara satar.",
    en: "Copart runs online salvage vehicle auctions, selling insurers' written-off cars to buyers worldwide.",
  },
  CPT: {
    tr: "Camden Property Trust — konut GYO'su; ABD'nin güney ve güneybatısındaki büyüyen şehirlerde apartman portföyü işletir.",
    en: "Camden Property Trust is an apartment REIT concentrated in fast-growing southern and southwestern US cities.",
  },
  CRH: {
    tr: "CRH — dünyanın en büyük yapı malzemesi şirketi; çimento, agrega ve asfalt üretip altyapı projelerine tedarik eder.",
    en: "CRH is the world's largest building materials group, supplying cement, aggregates and asphalt to infrastructure projects.",
  },
  CRL: {
    tr: "Charles River Laboratories — ilaç geliştirmenin erken aşama hizmet sağlayıcısı; preklinik testler ve laboratuvar modelleri sunar.",
    en: "Charles River Laboratories provides early-stage drug development services, from preclinical testing to research models.",
  },
  CRWV: {
    tr: "CoreWeave — yapay zekâ bulut altyapısı sağlayıcısı; GPU kümelerini model eğiten şirketlere kiralar.",
    en: "CoreWeave provides AI cloud infrastructure, renting GPU clusters to companies training models.",
  },
  CSGP: {
    tr: "CoStar Group — ticari gayrimenkul veri platformu; kiralama analitiği ve Homes.com ile konut ilan pazarında da yer alır.",
    en: "CoStar Group runs the commercial real estate data platform plus the Homes.com residential listings marketplace.",
  },
  CSX: {
    tr: "CSX Corporation — doğu ABD'nin demiryolu şirketi; kömür, kimyasal ve konteyner taşımacılığı yapar.",
    en: "CSX Corporation is the eastern US railroad hauling coal, chemicals and intermodal containers.",
  },
  CTAS: {
    tr: "Cintas — işyeri üniforma kiralama ve tesis hizmetleri şirketi; ilk yardım, güvenlik ve temizlik programları yönetir.",
    en: "Cintas rents workplace uniforms and provides facility services including first aid, safety and cleaning programmes.",
  },
  CTSH: {
    tr: "Cognizant — BT hizmet şirketi; kurumlara yazılım geliştirme, sistem entegrasyonu ve dijital dönüşüm danışmanlığı verir.",
    en: "Cognizant provides IT services — software development, systems integration and digital transformation consulting.",
  },
  CTVA: {
    tr: "Corteva — tarım bilimi şirketi; tohum genetiği ve bitki koruma ürünleriyle çiftçilerin verimini artırır.",
    en: "Corteva is an agriscience company improving farm yields through seed genetics and crop protection.",
  },
  CVNA: {
    tr: "Carvana — çevrimiçi ikinci el araç satıcısı; araç otomatlarıyla tanınır, aracı kapıya teslim eder.",
    en: "Carvana sells used cars online, known for its car vending machines and home delivery.",
  },
  CVS: {
    tr: "CVS Health — eczane zinciri, sağlık sigortası (Aetna) ve eczane fayda yönetimini tek çatıda birleştirir.",
    en: "CVS Health combines its pharmacy chain with Aetna health insurance and pharmacy benefit management.",
  },
  D: {
    tr: "Dominion Energy — Virginia merkezli elektrik şirketi; veri merkezi yoğunluğunun en yüksek olduğu bölgenin enerji tedarikçisi.",
    en: "Dominion Energy is the Virginia-based utility powering the region with the densest data-center cluster in the world.",
  },
  DAL: {
    tr: "Delta Air Lines — ABD'nin en büyük havayollarından; premium kabin ve sadakat programı gelirleriyle öne çıkar.",
    en: "Delta Air Lines is a major US carrier, distinguished by premium cabin and loyalty programme revenue.",
  },
  DASH: {
    tr: "DoorDash — yemek ve market teslimat platformu; ABD'nin en büyük teslimat ağını işletir, perakende teslimata genişliyor.",
    en: "DoorDash runs the largest US delivery network for restaurants and groceries, expanding into retail delivery.",
  },
  DD: {
    tr: "DuPont — özel kimyasallar şirketi; elektronik malzemeleri, su arıtma ve koruyucu malzemeler (Kevlar) üretir.",
    en: "DuPont makes specialty materials — electronics chemicals, water filtration and protective materials such as Kevlar.",
  },
  DECK: {
    tr: "Deckers Brands — ayakkabı şirketi; UGG botları ve HOKA koşu ayakkabısı markalarının sahibi.",
    en: "Deckers Brands owns the UGG boot and HOKA running shoe brands.",
  },
  DELL: {
    tr: "Dell Technologies — bilgisayar ve sunucu üreticisi; yapay zekâ sunucusu satışlarıyla kurumsal altyapıda büyüyor.",
    en: "Dell Technologies makes PCs and servers, growing in enterprise infrastructure through AI server sales.",
  },
  DG: {
    tr: "Dollar General — küçük yerleşimlere yayılmış indirim marketi zinciri; düşük gelirli hanelerin temel ihtiyaçlarını hedefler.",
    en: "Dollar General runs discount stores across small-town America, targeting essentials for lower-income households.",
  },
  DGX: {
    tr: "Quest Diagnostics — ABD'nin en büyük tıbbi laboratuvar zincirlerinden; kan tahlili ve tanı testleri yapar.",
    en: "Quest Diagnostics is among the largest US clinical laboratory networks, running blood work and diagnostic testing.",
  },
  DHI: {
    tr: "D. R. Horton — ABD'nin en büyük konut inşaatçısı; giriş seviyesi konut segmentinde hacim lideri.",
    en: "D. R. Horton is the largest US homebuilder, leading by volume in entry-level housing.",
  },
  DLR: {
    tr: "Digital Realty — veri merkezi GYO'su; bulut sağlayıcılara ve kurumlara dünya çapında tesis kiralar.",
    en: "Digital Realty is a data-center REIT leasing facilities to cloud providers and enterprises worldwide.",
  },
  DLTR: {
    tr: "Dollar Tree — sabit düşük fiyatlı indirim marketi zinciri; ağırlıklı olarak tüketim malzemesi ve sezonluk ürün satar.",
    en: "Dollar Tree runs fixed-low-price discount stores focused on consumables and seasonal goods.",
  },
  DOC: {
    tr: "Healthpeak Properties — sağlık GYO'su; laboratuvar binaları, tıp merkezleri ve yaşlı bakım tesisleri portföyü yönetir.",
    en: "Healthpeak Properties is a healthcare REIT holding lab buildings, medical offices and senior housing.",
  },
  DOV: {
    tr: "Dover Corporation — çeşitlendirilmiş sanayi üreticisi; pompa, ambalaj ekipmanı ve soğutma sistemleri yapar.",
    en: "Dover Corporation is a diversified manufacturer of pumps, packaging equipment and refrigeration systems.",
  },
  DOW: {
    tr: "Dow Inc. — temel kimyasal üreticisi; plastik hammaddesi, silikon ve endüstriyel kimyasallar üretir.",
    en: "Dow Inc. produces commodity chemicals including plastics feedstock, silicones and industrial chemicals.",
  },
  DPZ: {
    tr: "Domino's Pizza — dünyanın en büyük pizza zinciri; franchise modeli ve dijital sipariş altyapısıyla büyür.",
    en: "Domino's Pizza is the world's largest pizza chain, built on franchising and digital ordering.",
  },
  DRI: {
    tr: "Darden Restaurants — restoran grubu; Olive Garden ve LongHorn Steakhouse gibi tam servis zincirleri işletir.",
    en: "Darden Restaurants operates full-service chains including Olive Garden and LongHorn Steakhouse.",
  },
  DTE: {
    tr: "DTE Energy — Michigan'ın elektrik ve doğalgaz altyapı şirketi.",
    en: "DTE Energy is Michigan's electricity and natural gas utility.",
  },
  DUK: {
    tr: "Duke Energy — ABD'nin en büyük elektrik şirketlerinden; güneydoğu eyaletlerinde düzenlenmiş şebekeler işletir.",
    en: "Duke Energy is among the largest US utilities, running regulated grids across the Southeast.",
  },
  DVA: {
    tr: "DaVita — diyaliz merkezi zinciri; böbrek yetmezliği hastalarına düzenli tedavi hizmeti verir.",
    en: "DaVita operates dialysis centers providing regular treatment for patients with kidney failure.",
  },
  DVN: {
    tr: "Devon Energy — şeyl odaklı petrol ve doğalgaz üreticisi; ağırlıklı olarak Permian havzasında üretim yapar.",
    en: "Devon Energy is a shale-focused oil and gas producer concentrated in the Permian basin.",
  },
  DXCM: {
    tr: "Dexcom — sürekli glikoz ölçüm cihazları üreticisi; diyabet hastalarının kan şekerini iğnesiz takip etmesini sağlar.",
    en: "Dexcom makes continuous glucose monitors letting people with diabetes track blood sugar without finger sticks.",
  },
  EA: {
    tr: "Electronic Arts — video oyunu yayıncısı; FC (FIFA) futbol serisi, Madden ve Apex Legends ile canlı hizmet gelirleri üretir.",
    en: "Electronic Arts publishes video games, generating live-service revenue from the FC football series, Madden and Apex Legends.",
  },
  EBAY: {
    tr: "eBay — çevrimiçi pazar yeri; envanter tutmadan alıcı ve satıcıyı buluşturur, ikinci el ve koleksiyon ürünlerde güçlü.",
    en: "eBay runs an online marketplace connecting buyers and sellers without holding inventory, strong in resale and collectibles.",
  },
  ECHO: {
    tr: "EchoStar — uydu iletişim ve mobil şebeke şirketi; Boost Mobile ile kablosuz hizmet, uydu bağlantısıyla kurumsal çözümler sunar.",
    en: "EchoStar provides satellite communications and wireless service through Boost Mobile.",
  },
  ECL: {
    tr: "Ecolab — hijyen ve su arıtma şirketi; restoran, hastane ve fabrikalara temizlik kimyasalları ile su yönetimi çözümleri satar.",
    en: "Ecolab sells hygiene and water treatment solutions to restaurants, hospitals and factories.",
  },
  ED: {
    tr: "Consolidated Edison — New York'un elektrik, doğalgaz ve buhar dağıtım şirketi.",
    en: "Consolidated Edison delivers electricity, gas and steam across New York City.",
  },
  EFX: {
    tr: "Equifax — kredi bürosu; tüketici kredi geçmişi verisini toplar ve bankalara risk skoru olarak satar.",
    en: "Equifax is a credit bureau collecting consumer credit histories and selling risk scores to lenders.",
  },
  EG: {
    tr: "Everest Group — reasürans şirketi; sigorta şirketlerinin büyük risklerini devralır.",
    en: "Everest Group is a reinsurer assuming large risks from primary insurance companies.",
  },
  EIX: {
    tr: "Edison International — Güney Kaliforniya'nın elektrik dağıtım şirketi; orman yangını riski ve şebeke güçlendirme yatırımlarıyla gündemde.",
    en: "Edison International is Southern California's electric utility, defined by wildfire risk and grid hardening investment.",
  },
  EL: {
    tr: "Estée Lauder — lüks kozmetik şirketi; MAC, Clinique ve La Mer gibi markalarla cilt bakımı ve makyaj satar.",
    en: "Estée Lauder sells prestige beauty through brands including MAC, Clinique and La Mer.",
  },
  ELV: {
    tr: "Elevance Health — ABD'nin en büyük sağlık sigortacılarından; Blue Cross Blue Shield lisansıyla planlar sunar.",
    en: "Elevance Health is a major US health insurer operating Blue Cross Blue Shield plans.",
  },
  EME: {
    tr: "Emcor Group — mekanik ve elektrik taahhüt şirketi; veri merkezi ve sanayi tesislerinin tesisat altyapısını kurar.",
    en: "Emcor Group is a mechanical and electrical contractor building the systems inside data centers and industrial plants.",
  },
  EMR: {
    tr: "Emerson Electric — endüstriyel otomasyon şirketi; süreç kontrol sistemleri ve fabrika yazılımlarıyla üretim tesislerini yönetir.",
    en: "Emerson Electric supplies industrial automation — process control systems and software running production plants.",
  },
  EOG: {
    tr: "EOG Resources — ABD'nin en verimli şeyl petrolü üreticilerinden; düşük maliyetli üretim disipliniyle bilinir.",
    en: "EOG Resources is among the most efficient US shale oil producers, known for low-cost drilling discipline.",
  },
  EQR: {
    tr: "Equity Residential — konut GYO'su; büyük şehirlerin merkezlerinde kiralık apartman portföyü işletir.",
    en: "Equity Residential is an apartment REIT with rental portfolios in dense urban centers.",
  },
  EQT: {
    tr: "EQT Corporation — ABD'nin en büyük doğalgaz üreticisi; Appalachia'daki Marcellus şeyl sahasında üretim yapar.",
    en: "EQT Corporation is the largest US natural gas producer, operating in the Appalachian Marcellus shale.",
  },
  ERIE: {
    tr: "Erie Indemnity — Erie Insurance grubunun yönetim şirketi; acente ağı üzerinden araç ve konut sigortası satar.",
    en: "Erie Indemnity manages the Erie Insurance group, selling auto and home policies through agents.",
  },
  ES: {
    tr: "Eversource Energy — New England bölgesinin elektrik ve doğalgaz dağıtım şirketi.",
    en: "Eversource Energy is New England's electricity and natural gas utility.",
  },
  ESS: {
    tr: "Essex Property Trust — Batı Yakası konut GYO'su; Kaliforniya ve Seattle'ın teknoloji merkezlerinde apartman işletir.",
    en: "Essex Property Trust is a West Coast apartment REIT concentrated in California and Seattle tech hubs.",
  },
  ETR: {
    tr: "Entergy — Louisiana ve çevresinde elektrik dağıtan şirket; sanayi ve veri merkezi yükünün arttığı bölgede faaliyet gösterir.",
    en: "Entergy delivers electricity across Louisiana and neighbouring states, where industrial and data-center load is rising.",
  },
  EVRG: {
    tr: "Evergy — Kansas ve Missouri'nin elektrik dağıtım şirketi.",
    en: "Evergy is the electric utility serving Kansas and Missouri.",
  },
  EW: {
    tr: "Edwards Lifesciences — kalp kapakçığı teknolojisinin lideri; açık ameliyat gerektirmeyen TAVR kapakçık sistemlerini geliştirdi.",
    en: "Edwards Lifesciences leads in heart valve technology, pioneering TAVR valves implanted without open surgery.",
  },
  EXC: {
    tr: "Exelon — ABD'nin en büyük elektrik dağıtım şirketlerinden; Chicago, Philadelphia ve Baltimore şebekelerini işletir.",
    en: "Exelon is among the largest US electricity distributors, running grids in Chicago, Philadelphia and Baltimore.",
  },
  EXE: {
    tr: "Expand Energy — ABD'nin en büyük doğalgaz üreticilerinden; Chesapeake ve Southwestern birleşmesinden doğdu.",
    en: "Expand Energy is a leading US natural gas producer formed by the Chesapeake and Southwestern merger.",
  },
  EXPD: {
    tr: "Expeditors International — küresel nakliye komisyoncusu; hava ve deniz yükü için taşıma kapasitesi ayarlar, gümrükleme yapar.",
    en: "Expeditors International is a global freight forwarder booking air and ocean capacity and handling customs.",
  },
  EXPE: {
    tr: "Expedia Group — çevrimiçi seyahat platformu; Expedia, Hotels.com ve Vrbo markalarıyla konaklama rezervasyonu yapar.",
    en: "Expedia Group runs online travel booking through Expedia, Hotels.com and Vrbo.",
  },
  EXR: {
    tr: "Extra Space Storage — ABD'nin en büyük bireysel depolama GYO'su; taşınma ve yer sıkıntısı talebinden beslenir.",
    en: "Extra Space Storage is the largest US self-storage REIT, driven by moving and space-constraint demand.",
  },
  F: {
    tr: "Ford Motor Company — otomobil üreticisi; F-150 kamyonet serisi kârın omurgasıdır, ticari araç ve elektrikli modellere yatırım yapar.",
    en: "Ford Motor Company builds vehicles, with the F-150 truck franchise anchoring profits alongside commercial and electric models.",
  },
  FANG: {
    tr: "Diamondback Energy — Permian havzasına odaklı şeyl petrolü üreticisi; düşük maliyetli üretimiyle bilinir.",
    en: "Diamondback Energy is a Permian-focused shale oil producer known for low-cost operations.",
  },
  FAST: {
    tr: "Fastenal — sanayi malzemesi dağıtıcısı; fabrikalara cıvata, kesici takım ve bakım malzemesi tedarik eder, tesis içi otomat sistemleri kurar.",
    en: "Fastenal distributes industrial supplies — fasteners, cutting tools and maintenance goods — including on-site vending systems.",
  },
  FCX: {
    tr: "Freeport-McMoRan — dünyanın en büyük halka açık bakır üreticilerinden; Endonezya'daki Grasberg madeniyle altın da çıkarır.",
    en: "Freeport-McMoRan is among the largest listed copper producers, also mining gold at Indonesia's Grasberg.",
  },
  FDS: {
    tr: "FactSet — finansal veri ve analiz platformu; portföy yöneticileri ve analistlere piyasa verisi terminali sunar.",
    en: "FactSet provides a financial data and analytics platform used by portfolio managers and analysts.",
  },
  FDX: {
    tr: "FedEx — küresel ekspres kargo şirketi; hava filosu ve kara ağıyla paket teslimatı yapar, e-ticaretin lojistik omurgasıdır.",
    en: "FedEx runs global express shipping with an air fleet and ground network underpinning e-commerce logistics.",
  },
  FDXF: {
    tr: "FedEx Freight — FedEx'in karayolu parsiyel yük (LTL) taşımacılığı birimi; sanayi yüklerini taşır.",
    en: "FedEx Freight is the less-than-truckload arm of FedEx, hauling industrial shipments by road.",
  },
  FE: {
    tr: "FirstEnergy — Ohio, Pennsylvania ve çevresinde elektrik dağıtan şirket.",
    en: "FirstEnergy distributes electricity across Ohio, Pennsylvania and neighbouring states.",
  },
  FER: {
    tr: "Ferrovial — altyapı şirketi; otoyol imtiyazları ve havalimanı işletmeciliği yapar, ücretli yol gelirleriyle çalışır.",
    en: "Ferrovial develops infrastructure, holding toll road concessions and airport stakes.",
  },
  FFIV: {
    tr: "F5, Inc. — uygulama teslim ve güvenlik şirketi; web trafiğini dengeler, uygulamaları saldırılara karşı korur.",
    en: "F5, Inc. delivers and secures applications, balancing web traffic and defending apps against attacks.",
  },
  FICO: {
    tr: "Fair Isaac — FICO kredi skorunun sahibi; ABD'de kredi kararlarının standart ölçütünü üretir ve karar yazılımı satar.",
    en: "Fair Isaac owns the FICO credit score, the standard measure behind US lending decisions, plus decision software.",
  },
  FIS: {
    tr: "Fidelity National Information Services — bankacılık teknolojisi sağlayıcısı; bankaların çekirdek işlem sistemlerini işletir.",
    en: "Fidelity National Information Services runs core banking technology and payment processing for financial institutions.",
  },
  FISV: {
    tr: "Fiserv — ödeme ve bankacılık teknolojisi devi; Clover satış noktası terminalleriyle küçük işletmelere ulaşır.",
    en: "Fiserv provides payments and banking technology, reaching small businesses through Clover point-of-sale terminals.",
  },
  FITB: {
    tr: "Fifth Third Bancorp — Ortabatı ABD'de faaliyet gösteren bölgesel banka.",
    en: "Fifth Third Bancorp is a regional bank serving the US Midwest.",
  },
  FIX: {
    tr: "Comfort Systems USA — mekanik taahhüt şirketi; veri merkezi ve fabrikaların iklimlendirme ve tesisat sistemlerini kurar.",
    en: "Comfort Systems USA is a mechanical contractor installing HVAC and plumbing systems in data centers and plants.",
  },
  FLEX: {
    tr: "Flex Ltd. — sözleşmeli elektronik üreticisi; markalar adına cihaz üretir, veri merkezi güç sistemlerinde büyüyor.",
    en: "Flex Ltd. manufactures electronics under contract for brands, growing in data-center power systems.",
  },
  FOX: {
    tr: "Fox Corporation — medya şirketi; Fox News, spor yayıncılığı ve yerel televizyon kanallarını işletir (B sınıfı hisse).",
    en: "Fox Corporation operates Fox News, sports broadcasting and local television stations (class B shares).",
  },
  FOXA: {
    tr: "Fox Corporation — medya şirketi; Fox News, spor yayıncılığı ve yerel televizyon kanallarını işletir (A sınıfı hisse).",
    en: "Fox Corporation operates Fox News, sports broadcasting and local television stations (class A shares).",
  },
  FRT: {
    tr: "Federal Realty — perakende GYO'su; varlıklı banliyölerde açık hava alışveriş merkezleri işletir.",
    en: "Federal Realty is a retail REIT operating open-air shopping centers in affluent suburbs.",
  },
  FSLR: {
    tr: "First Solar — ABD'nin en büyük güneş paneli üreticisi; ince film teknolojisiyle Çinli rakiplerinden ayrışır.",
    en: "First Solar is the largest US solar panel maker, differentiated by thin-film technology.",
  },
  FTNT: {
    tr: "Fortinet — siber güvenlik şirketi; ağ güvenlik duvarları ve kendi güvenlik çipleriyle donanım tarafında güçlü.",
    en: "Fortinet is a cybersecurity company strong in network firewalls, built on its own security processors.",
  },
  FTV: {
    tr: "Fortive — sanayi teknoloji şirketi; ölçüm cihazları, saha hizmet yazılımı ve sağlık sterilizasyon ürünleri üretir.",
    en: "Fortive makes industrial technology — measurement instruments, field service software and healthcare sterilization.",
  },
  GD: {
    tr: "General Dynamics — savunma sanayi şirketi; denizaltı, zırhlı araç ve Gulfstream iş jetleri üretir.",
    en: "General Dynamics builds submarines, armoured vehicles and Gulfstream business jets.",
  },
  GDDY: {
    tr: "GoDaddy — alan adı kayıt ve web barındırma şirketi; küçük işletmelerin çevrimiçi varlığını kurar.",
    en: "GoDaddy registers domains and hosts websites, helping small businesses build an online presence.",
  },
  GEHC: {
    tr: "GE HealthCare — tıbbi görüntüleme devi; MR, BT ve ultrason cihazlarıyla hastanelerin teşhis altyapısını kurar.",
    en: "GE HealthCare makes medical imaging equipment — MRI, CT and ultrasound systems for hospital diagnostics.",
  },
  GEN: {
    tr: "Gen Digital — tüketici siber güvenlik şirketi; Norton, Avast ve LifeLock markalarıyla kişisel koruma yazılımı satar.",
    en: "Gen Digital sells consumer cybersecurity through Norton, Avast and LifeLock.",
  },
  GEV: {
    tr: "GE Vernova — enerji ekipmanı şirketi; gaz türbinleri, rüzgâr türbinleri ve şebeke teknolojileri üretir; elektrik talebi artışının tedarikçisi.",
    en: "GE Vernova makes gas turbines, wind turbines and grid technology, supplying the surge in electricity demand.",
  },
  GIS: {
    tr: "General Mills — paketli gıda şirketi; Cheerios, Häagen-Dazs ve Blue Buffalo evcil hayvan maması markalarını yönetir.",
    en: "General Mills makes packaged foods including Cheerios, Häagen-Dazs and Blue Buffalo pet food.",
  },
  GL: {
    tr: "Globe Life — hayat ve tamamlayıcı sağlık sigortası şirketi; orta gelirli hanelere doğrudan satış yapar.",
    en: "Globe Life sells life and supplemental health insurance directly to middle-income households.",
  },
  GLW: {
    tr: "Corning — özel cam ve malzeme bilimi şirketi; telefon ekranı camı (Gorilla Glass) ve optik fiber üretir.",
    en: "Corning makes specialty glass and materials — Gorilla Glass for phone screens and optical fiber.",
  },
  GM: {
    tr: "General Motors — otomobil üreticisi; Chevrolet, GMC ve Cadillac markalarını yönetir, elektrikli araç ve Cruise otonom birimine yatırım yapar.",
    en: "General Motors builds Chevrolet, GMC and Cadillac vehicles while investing in EVs and the Cruise autonomous unit.",
  },
  GNRC: {
    tr: "Generac — jeneratör üreticisi; ev ve iş yeri yedek güç sistemleri yapar, şebeke kesintilerinden talep görür.",
    en: "Generac makes backup power generators for homes and businesses, with demand driven by grid outages.",
  },
  GOOG: {
    tr: "Alphabet — Google'ın çatı şirketi; arama, YouTube, Android, bulut ve Gemini yapay zekâ modellerini kapsar (C sınıfı, oy hakkı yok).",
    en: "Alphabet is Google's parent — search, YouTube, Android, cloud and Gemini AI (class C shares, no voting rights).",
  },
  GPC: {
    tr: "Genuine Parts Company — otomotiv ve sanayi yedek parça dağıtıcısı; NAPA markasıyla tamirci ağına parça sağlar.",
    en: "Genuine Parts Company distributes automotive and industrial parts, supplying repair shops through NAPA.",
  },
  GPN: {
    tr: "Global Payments — ödeme işleme şirketi; işletmelerin kart tahsilatlarını yürütür.",
    en: "Global Payments processes card transactions for merchants.",
  },
  GRMN: {
    tr: "Garmin — GPS ve giyilebilir cihaz üreticisi; havacılık, denizcilik ve spor saat pazarlarında güçlü.",
    en: "Garmin makes GPS devices and wearables, strong in aviation, marine and fitness watches.",
  },
  GWW: {
    tr: "W. W. Grainger — sanayi bakım malzemeleri dağıtıcısı; fabrikalara ve tesislere yüz binlerce kalem ürün tedarik eder.",
    en: "W. W. Grainger distributes maintenance and operating supplies, stocking hundreds of thousands of items for facilities.",
  },
  HAL: {
    tr: "Halliburton — petrol sahası hizmet şirketi; hidrolik kırılma (fracking) ve kuyu tamamlama hizmetlerinde lider.",
    en: "Halliburton is an oilfield services leader in hydraulic fracturing and well completion.",
  },
  HAS: {
    tr: "Hasbro — oyuncak ve oyun şirketi; Monopoly, Transformers ve Magic: The Gathering markalarının sahibi.",
    en: "Hasbro makes toys and games including Monopoly, Transformers and Magic: The Gathering.",
  },
  HBAN: {
    tr: "Huntington Bancshares — Ortabatı ABD'de faaliyet gösteren bölgesel banka.",
    en: "Huntington Bancshares is a regional bank operating across the US Midwest.",
  },
  HCA: {
    tr: "HCA Healthcare — ABD'nin en büyük özel hastane zinciri; yüzlerce hastane ve ayakta tedavi merkezi işletir.",
    en: "HCA Healthcare is the largest US private hospital operator, running hundreds of hospitals and outpatient centers.",
  },
  HIG: {
    tr: "The Hartford — ticari ve bireysel sigorta şirketi; küçük işletme sigortasında güçlü konumda.",
    en: "The Hartford writes commercial and personal insurance, strong in small-business coverage.",
  },
  HII: {
    tr: "Huntington Ingalls — ABD'nin en büyük askeri gemi inşa şirketi; uçak gemisi ve denizaltı üretir.",
    en: "Huntington Ingalls is the largest US military shipbuilder, constructing aircraft carriers and submarines.",
  },
  HLT: {
    tr: "Hilton Worldwide — otel zinciri; oteli sahiplenmek yerine markasını ve yönetimini lisanslayarak büyür.",
    en: "Hilton Worldwide grows by franchising and managing hotels rather than owning the real estate.",
  },
  HONA: {
    tr: "Honeywell Aerospace — uçak aviyonik sistemleri, motorları ve kokpit teknolojileri üreticisi.",
    en: "Honeywell Aerospace makes aircraft avionics, engines and cockpit technology.",
  },
  HOOD: {
    tr: "Robinhood Markets — komisyonsuz yatırım platformu; bireysel yatırımcılara hisse, opsiyon ve kripto işlemi sunar.",
    en: "Robinhood Markets offers commission-free trading in stocks, options and crypto for retail investors.",
  },
  HPE: {
    tr: "Hewlett Packard Enterprise — kurumsal sunucu ve ağ ekipmanı üreticisi; yapay zekâ sunucuları ve Juniper ile ağ işine ağırlık veriyor.",
    en: "Hewlett Packard Enterprise sells enterprise servers and networking, leaning into AI systems and the Juniper acquisition.",
  },
  HPQ: {
    tr: "HP Inc. — kişisel bilgisayar ve yazıcı üreticisi; kurumsal ve tüketici pazarına donanım satar.",
    en: "HP Inc. makes personal computers and printers for consumer and enterprise markets.",
  },
  HRL: {
    tr: "Hormel Foods — paketli et ve gıda üreticisi; SPAM, Planters ve Skippy markalarının sahibi.",
    en: "Hormel Foods makes packaged meat and food brands including SPAM, Planters and Skippy.",
  },
  HSIC: {
    tr: "Henry Schein — diş hekimliği ve tıbbi malzeme dağıtıcısı; kliniklere ekipman ve sarf malzemesi tedarik eder.",
    en: "Henry Schein distributes dental and medical supplies and equipment to practices.",
  },
  HST: {
    tr: "Host Hotels & Resorts — otel GYO'su; lüks ve üst segment otel mülklerinin sahibidir, işletmeyi Marriott gibi zincirlere bırakır.",
    en: "Host Hotels & Resorts owns luxury and upper-upscale hotel properties operated by chains such as Marriott.",
  },
  HSY: {
    tr: "The Hershey Company — çikolata ve şekerleme üreticisi; ABD çikolata pazarının lideri, kakao maliyetlerine duyarlı.",
    en: "The Hershey Company leads the US chocolate market, with earnings sensitive to cocoa costs.",
  },
  HUBB: {
    tr: "Hubbell — elektrik altyapı ürünleri üreticisi; şebeke bileşenleri ve endüstriyel elektrik ekipmanı yapar.",
    en: "Hubbell manufactures electrical infrastructure — grid components and industrial electrical equipment.",
  },
  HUM: {
    tr: "Humana — sağlık sigortası şirketi; Medicare Advantage planlarında ABD'nin en büyük sağlayıcılarından.",
    en: "Humana is a health insurer and one of the largest US providers of Medicare Advantage plans.",
  },
  HWM: {
    tr: "Howmet Aerospace — havacılık için hassas döküm parça üreticisi; jet motoru türbin kanatları ve bağlantı elemanları yapar.",
    en: "Howmet Aerospace makes precision castings for aviation — jet engine turbine blades and fasteners.",
  },
  IBKR: {
    tr: "Interactive Brokers — profesyonel yatırımcılara yönelik aracı kurum; düşük maliyetli küresel piyasa erişimi sunar.",
    en: "Interactive Brokers is a brokerage for professional investors offering low-cost access to global markets.",
  },
  IDXX: {
    tr: "Idexx Laboratories — veteriner tanı şirketi; hayvan kliniklerine kan analiz cihazları ve test kitleri sağlar.",
    en: "Idexx Laboratories provides veterinary diagnostics — analyzers and test kits for animal clinics.",
  },
  IEX: {
    tr: "IDEX Corporation — hassas akışkan sistemleri üreticisi; pompa, dozajlama ekipmanı ve itfaiye kurtarma araçları yapar.",
    en: "IDEX Corporation makes precision fluid systems — pumps, dispensing equipment and fire rescue tools.",
  },
  IFF: {
    tr: "International Flavors & Fragrances — aroma ve koku üreticisi; gıda tadı, parfüm esansı ve enzim çözümleri geliştirir.",
    en: "International Flavors & Fragrances develops food tastes, perfume essences and enzyme solutions.",
  },
  INCY: {
    tr: "Incyte — onkoloji odaklı biyoteknoloji şirketi; kan kanseri ilacı Jakafi başta olmak üzere hedefe yönelik tedaviler geliştirir.",
    en: "Incyte is an oncology-focused biotech built around Jakafi for blood cancers and other targeted therapies.",
  },
  INVH: {
    tr: "Invitation Homes — müstakil kiralık konut GYO'su; ABD'nin büyüyen banliyölerinde on binlerce evi kiraya verir.",
    en: "Invitation Homes is a single-family rental REIT leasing tens of thousands of houses across growing US suburbs.",
  },
  IP: {
    tr: "International Paper — oluklu mukavva ve ambalaj kağıdı üreticisi; e-ticaret kutularının hammaddesini sağlar.",
    en: "International Paper makes corrugated packaging and containerboard, the raw material behind e-commerce boxes.",
  },
  IQV: {
    tr: "IQVIA — ilaç sektörünün veri ve klinik araştırma şirketi; ilaç şirketleri adına klinik denemeleri yürütür ve reçete verisi analiz eder.",
    en: "IQVIA runs clinical trials for drugmakers and analyzes prescription data across the pharmaceutical industry.",
  },
  IR: {
    tr: "Ingersoll Rand — endüstriyel kompresör ve pompa üreticisi; fabrikaların basınçlı hava ve akışkan sistemlerini kurar.",
    en: "Ingersoll Rand makes industrial compressors and pumps powering factory air and fluid systems.",
  },
  IRM: {
    tr: "Iron Mountain — belge saklama ve veri merkezi GYO'su; fiziksel arşivden dijital altyapıya geçiş yapıyor.",
    en: "Iron Mountain is a records storage and data-center REIT, shifting from physical archives to digital infrastructure.",
  },
  IT: {
    tr: "Gartner — teknoloji araştırma ve danışmanlık şirketi; kurumlara BT satın alma kararlarında abonelikli analiz satar.",
    en: "Gartner sells subscription research and advisory that guides enterprise technology purchasing decisions.",
  },
  ITW: {
    tr: "Illinois Tool Works — çeşitlendirilmiş sanayi üreticisi; kaynak ekipmanı, otomotiv parçası ve gıda servis makineleri yapar.",
    en: "Illinois Tool Works is a diversified manufacturer of welding equipment, automotive components and food service machinery.",
  },
  IVZ: {
    tr: "Invesco — varlık yönetim şirketi; QQQ dahil geniş bir ETF ailesi ve yatırım fonları yönetir.",
    en: "Invesco manages funds and a broad ETF family including QQQ.",
  },
  J: {
    tr: "Jacobs Solutions — mühendislik ve danışmanlık şirketi; altyapı, su ve savunma projelerinin tasarımını yapar.",
    en: "Jacobs Solutions provides engineering and consulting for infrastructure, water and defense projects.",
  },
  JBHT: {
    tr: "J.B. Hunt — karayolu ve intermodal taşımacılık şirketi; demiryolu ile kamyonu birleştiren konteyner taşımacılığında lider.",
    en: "J.B. Hunt is a trucking and intermodal carrier, leading in container freight that combines rail with road.",
  },
  JBL: {
    tr: "Jabil — sözleşmeli üretim şirketi; sağlık cihazından veri merkezi donanımına kadar markalar adına elektronik üretir.",
    en: "Jabil manufactures electronics under contract, from medical devices to data-center hardware.",
  },
  JCI: {
    tr: "Johnson Controls — bina teknolojileri şirketi; iklimlendirme, yangın güvenliği ve akıllı bina otomasyonu sağlar.",
    en: "Johnson Controls supplies building technology — HVAC, fire safety and smart building automation.",
  },
  JKHY: {
    tr: "Jack Henry & Associates — bankacılık yazılımı sağlayıcısı; bölgesel banka ve kredi birliklerinin çekirdek sistemlerini işletir.",
    en: "Jack Henry & Associates runs core banking software for community banks and credit unions.",
  },
  KDP: {
    tr: "Keurig Dr Pepper — içecek şirketi; Keurig kahve kapsül sistemi ile Dr Pepper ve Snapple gazlı içecek markalarını birleştirir.",
    en: "Keurig Dr Pepper combines the Keurig coffee pod system with Dr Pepper and Snapple beverage brands.",
  },
  KEY: {
    tr: "KeyCorp — Ohio merkezli bölgesel banka; bireysel ve ticari bankacılık hizmeti verir.",
    en: "KeyCorp is an Ohio-based regional bank serving retail and commercial customers.",
  },
  KEYS: {
    tr: "Keysight Technologies — elektronik test ve ölçüm cihazları üreticisi; 5G, yarı iletken ve otomotiv ar-ge laboratuvarlarına ekipman sağlar.",
    en: "Keysight Technologies makes electronic test and measurement instruments for 5G, semiconductor and automotive R&D.",
  },
  KHC: {
    tr: "Kraft Heinz — paketli gıda devi; ketçap, peynir ve hazır gıda markalarıyla süpermarket raflarında yer alır.",
    en: "Kraft Heinz is a packaged food giant spanning ketchup, cheese and prepared meal brands.",
  },
  KIM: {
    tr: "Kimco Realty — perakende GYO'su; market destekli açık hava alışveriş merkezleri işletir.",
    en: "Kimco Realty is a retail REIT operating grocery-anchored open-air shopping centers.",
  },
  KKR: {
    tr: "KKR & Co. — özel sermaye devi; şirket satın alımları, altyapı ve kredi fonları yönetir, sigorta koluyla kalıcı sermaye tutar.",
    en: "KKR & Co. is a private equity giant managing buyouts, infrastructure and credit funds, with insurance providing permanent capital.",
  },
  KMB: {
    tr: "Kimberly-Clark — kişisel bakım kağıt ürünleri üreticisi; Huggies bebek bezi ve Kleenex mendil markalarının sahibi.",
    en: "Kimberly-Clark makes personal care paper products including Huggies diapers and Kleenex tissues.",
  },
  KMI: {
    tr: "Kinder Morgan — ABD'nin en büyük doğalgaz boru hattı ağlarından birini işletir; geliri taşıma tarifelerinden gelir.",
    en: "Kinder Morgan operates one of the largest US natural gas pipeline networks, earning fee-based transport revenue.",
  },
  KR: {
    tr: "Kroger — ABD'nin en büyük süpermarket zincirlerinden; kendi markalı ürünler ve mağaza içi eczanelerle çalışır.",
    en: "Kroger is among the largest US grocery chains, with private-label products and in-store pharmacies.",
  },
  KVUE: {
    tr: "Kenvue — Johnson & Johnson'dan ayrılan tüketici sağlığı şirketi; Tylenol, Band-Aid ve Listerine markalarını yönetir.",
    en: "Kenvue, spun off from Johnson & Johnson, owns consumer health brands including Tylenol, Band-Aid and Listerine.",
  },
  L: {
    tr: "Loews Corporation — holding şirketi; CNA sigorta, boru hattı ve otel işletmelerini tek çatıda toplar.",
    en: "Loews Corporation is a holding company spanning CNA insurance, pipelines and hotels.",
  },
  LDOS: {
    tr: "Leidos — savunma ve devlet teknoloji yüklenicisi; istihbarat sistemleri, siber güvenlik ve havalimanı tarama çözümleri sunar.",
    en: "Leidos is a defense and government technology contractor providing intelligence systems, cybersecurity and airport screening.",
  },
  LEN: {
    tr: "Lennar — ABD'nin en büyük konut inşaatçılarından; giriş ve orta segment konut üretir.",
    en: "Lennar is among the largest US homebuilders, focused on entry and mid-level housing.",
  },
  LH: {
    tr: "Labcorp — tıbbi laboratuvar zinciri; rutin tahlil ve ileri genetik testleri yapar, ilaç şirketlerine araştırma hizmeti verir.",
    en: "Labcorp runs clinical laboratories for routine and advanced genetic testing, plus drug development services.",
  },
  LHX: {
    tr: "L3Harris — savunma teknolojisi şirketi; askeri haberleşme sistemleri, elektronik harp ve uzay sensörleri üretir.",
    en: "L3Harris builds defense technology — military communications, electronic warfare and space sensors.",
  },
  LII: {
    tr: "Lennox International — iklimlendirme üreticisi; konut ve ticari binalar için klima ve ısıtma sistemleri yapar.",
    en: "Lennox International makes heating and cooling systems for homes and commercial buildings.",
  },
  LITE: {
    tr: "Lumentum — optik bileşen üreticisi; veri merkezlerinin fiber alıcı-vericilerini ve endüstriyel lazerleri sağlar.",
    en: "Lumentum makes optical components — data-center transceivers and industrial lasers.",
  },
  LNT: {
    tr: "Alliant Energy — Iowa ve Wisconsin'in elektrik ve doğalgaz dağıtım şirketi.",
    en: "Alliant Energy is the electricity and gas utility serving Iowa and Wisconsin.",
  },
  LULU: {
    tr: "Lululemon Athletica — spor giyim markası; yoga ve atletik giyimde premium konumlanır.",
    en: "Lululemon Athletica is a premium athletic apparel brand rooted in yoga and activewear.",
  },
  LUV: {
    tr: "Southwest Airlines — ABD'nin en büyük iç hat havayolu; tek tip uçak filosu ve düşük maliyet modeliyle bilinir.",
    en: "Southwest Airlines is the largest US domestic carrier, known for a single-aircraft-type fleet and low-cost model.",
  },
  LVS: {
    tr: "Las Vegas Sands — kumarhane ve tatil köyü işletmecisi; geliri ağırlıklı Macau ve Singapur'daki entegre tesislerden gelir.",
    en: "Las Vegas Sands operates casino resorts, earning mainly from integrated properties in Macau and Singapore.",
  },
  LYB: {
    tr: "LyondellBasell — plastik ve kimyasal üreticisi; polietilen ve polipropilen üretiminde dünya ölçeğinde oyuncu.",
    en: "LyondellBasell produces plastics and chemicals at world scale, notably polyethylene and polypropylene.",
  },
  LYV: {
    tr: "Live Nation Entertainment — canlı etkinlik devi; konser organizasyonu, mekân işletmeciliği ve Ticketmaster bilet platformunu birleştirir.",
    en: "Live Nation Entertainment combines concert promotion, venue operations and the Ticketmaster ticketing platform.",
  },
  MAA: {
    tr: "Mid-America Apartment Communities — konut GYO'su; ABD'nin güneydoğu ve güneybatısındaki büyüyen şehirlerde apartman işletir.",
    en: "Mid-America Apartment Communities is an apartment REIT across fast-growing southeastern and southwestern US cities.",
  },
  MAR: {
    tr: "Marriott International — dünyanın en büyük otel şirketi; Ritz-Carlton'dan Courtyard'a 30'dan fazla markayı franchise modeliyle yönetir.",
    en: "Marriott International is the largest hotel company, franchising over 30 brands from Ritz-Carlton to Courtyard.",
  },
  MAS: {
    tr: "Masco — yapı ürünleri üreticisi; Behr boya ve Delta banyo armatürü markalarının sahibi.",
    en: "Masco makes building products including Behr paint and Delta plumbing fixtures.",
  },
  MCHP: {
    tr: "Microchip Technology — mikrodenetleyici üreticisi; otomotiv, sanayi ve gömülü sistemlerin kontrol çiplerini sağlar.",
    en: "Microchip Technology makes microcontrollers powering automotive, industrial and embedded systems.",
  },
  MCK: {
    tr: "McKesson — ABD'nin en büyük ilaç dağıtım şirketi; eczane ve hastanelere reçeteli ilaç lojistiği sağlar.",
    en: "McKesson is the largest US pharmaceutical distributor, handling prescription drug logistics for pharmacies and hospitals.",
  },
  MCO: {
    tr: "Moody's Corporation — kredi derecelendirme kuruluşu; tahvil ihraççılarını notlandırır, risk analitiği satar.",
    en: "Moody's Corporation rates bond issuers and sells risk analytics.",
  },
  MDLZ: {
    tr: "Mondelez International — atıştırmalık devi; Oreo, Cadbury ve Milka markalarıyla bisküvi ve çikolata satar.",
    en: "Mondelez International sells biscuits and chocolate through Oreo, Cadbury and Milka.",
  },
  MELI: {
    tr: "MercadoLibre — Latin Amerika'nın en büyük e-ticaret ve fintech platformu; pazar yeri, ödeme (Mercado Pago) ve lojistiği birleştirir.",
    en: "MercadoLibre is Latin America's largest e-commerce and fintech platform, combining marketplace, Mercado Pago payments and logistics.",
  },
  MET: {
    tr: "MetLife — hayat ve grup sigortası şirketi; işveren üzerinden çalışanlara sağlanan yan haklar pazarında lider.",
    en: "MetLife is a life and group insurer leading in employer-provided employee benefits.",
  },
  MGM: {
    tr: "MGM Resorts — kumarhane ve otel işletmecisi; Las Vegas Strip'in en büyük tesis sahiplerinden.",
    en: "MGM Resorts operates casinos and hotels, among the largest property owners on the Las Vegas Strip.",
  },
  MKC: {
    tr: "McCormick & Company — baharat ve tatlandırıcı üreticisi; ev tüketimi ve endüstriyel gıda müşterilerine satış yapar.",
    en: "McCormick & Company makes spices and flavorings for both consumers and industrial food customers.",
  },
  MLM: {
    tr: "Martin Marietta Materials — agrega üreticisi; yol ve altyapı inşaatı için kırma taş, kum ve çakıl sağlar.",
    en: "Martin Marietta Materials supplies aggregates — crushed stone, sand and gravel for road and infrastructure construction.",
  },
  MMM: {
    tr: "3M — çeşitlendirilmiş sanayi şirketi; yapışkan bant, güvenlik ekipmanı ve endüstriyel malzemelerde binlerce ürün üretir.",
    en: "3M is a diversified manufacturer producing thousands of products across adhesives, safety equipment and industrial materials.",
  },
  MNST: {
    tr: "Monster Beverage — enerji içeceği üreticisi; Coca-Cola dağıtım ağı üzerinden küresel pazara ulaşır.",
    en: "Monster Beverage makes energy drinks distributed globally through the Coca-Cola network.",
  },
  MOS: {
    tr: "Mosaic Company — fosfat ve potas gübre üreticisi; tarımsal verimliliğin temel girdisini sağlar.",
    en: "Mosaic Company produces phosphate and potash fertilizer, a core input for crop yields.",
  },
  MPC: {
    tr: "Marathon Petroleum — ABD'nin en büyük rafinaj şirketi; ham petrolü akaryakıta çevirir, Speedway sonrası perakende ortaklıkları sürdürür.",
    en: "Marathon Petroleum is the largest US refiner, converting crude into fuels with continuing retail partnerships.",
  },
  MPWR: {
    tr: "Monolithic Power Systems — güç yönetim çipleri üreticisi; yapay zekâ sunucularının işlemcilerine gerilim düzenleyen silikon sağlar.",
    en: "Monolithic Power Systems makes power management chips, supplying voltage regulation for AI server processors.",
  },
  MRNA: {
    tr: "Moderna — mRNA teknolojisinin öncüsü; COVID aşısından sonra kanser ve solunum yolu aşı programlarına odaklandı.",
    en: "Moderna pioneered mRNA vaccines, now focused on cancer and respiratory vaccine programmes after COVID.",
  },
  MRSH: {
    tr: "Marsh McLennan — dünyanın en büyük sigorta brokerliği ve danışmanlık grubu; Marsh, Mercer ve Oliver Wyman markalarını kapsar.",
    en: "Marsh McLennan is the largest insurance brokerage and advisory group, spanning Marsh, Mercer and Oliver Wyman.",
  },
  MSCI: {
    tr: "MSCI — endeks sağlayıcısı; dünya borsalarında trilyonlarca dolarlık fonun izlediği endeksleri üretir ve lisanslar.",
    en: "MSCI builds and licenses the indices that trillions of dollars in funds track worldwide.",
  },
  MSI: {
    tr: "Motorola Solutions — kamu güvenliği haberleşme şirketi; polis ve itfaiye telsiz sistemleri, video güvenlik ve komuta merkezi yazılımı sağlar.",
    en: "Motorola Solutions supplies public safety communications — police and fire radio systems, video security and command software.",
  },
  MSTR: {
    tr: "Strategy (MicroStrategy) — iş zekâsı yazılım şirketi; bilançosunda büyük miktarda bitcoin tutmasıyla kripto vekili haline geldi.",
    en: "Strategy, formerly MicroStrategy, sells business intelligence software but is traded largely as a bitcoin proxy given its treasury holdings.",
  },
  MTB: {
    tr: "M&T Bank — ABD'nin kuzeydoğusunda faaliyet gösteren bölgesel banka; ticari gayrimenkul kredilerinde güçlü.",
    en: "M&T Bank is a Northeast US regional bank, strong in commercial real estate lending.",
  },
  MTD: {
    tr: "Mettler Toledo — hassas tartı ve laboratuvar cihazı üreticisi; ilaç ve gıda üretiminde kalite kontrol ekipmanı sağlar.",
    en: "Mettler Toledo makes precision balances and lab instruments used for quality control in pharma and food production.",
  },
  NBIS: {
    tr: "Nebius Group — yapay zekâ bulut altyapısı şirketi; Avrupa'da GPU kümeleri kurup model eğitimi kapasitesi kiralar.",
    en: "Nebius Group builds AI cloud infrastructure, renting GPU cluster capacity for model training in Europe.",
  },
  NCLH: {
    tr: "Norwegian Cruise Line — kruvaziyer şirketi; serbest yemek ve program anlayışıyla konumlanan gemi filosu işletir.",
    en: "Norwegian Cruise Line operates cruise ships positioned around flexible dining and scheduling.",
  },
  NDAQ: {
    tr: "Nasdaq, Inc. — borsa işletmecisi; Nasdaq borsasının yanında piyasa teknolojisi ve finansal suç önleme yazılımı satar.",
    en: "Nasdaq, Inc. runs the Nasdaq exchange plus market technology and financial crime prevention software.",
  },
  NDSN: {
    tr: "Nordson Corporation — hassas dozajlama ekipmanı üreticisi; yapıştırıcı ve kaplama uygulama sistemleri yapar.",
    en: "Nordson Corporation makes precision dispensing equipment for adhesives and coatings.",
  },
  NEM: {
    tr: "Newmont — dünyanın en büyük altın madencisi; beş kıtada altın ve bakır çıkarır.",
    en: "Newmont is the world's largest gold miner, extracting gold and copper across five continents.",
  },
  NI: {
    tr: "NiSource — Indiana ve çevresinde doğalgaz ve elektrik dağıtan altyapı şirketi.",
    en: "NiSource distributes natural gas and electricity across Indiana and neighbouring states.",
  },
  NKE: {
    tr: "Nike — dünyanın en büyük spor giyim ve ayakkabı markası; sporcu sponsorlukları ve doğrudan satış kanallarıyla büyür.",
    en: "Nike is the world's largest athletic footwear and apparel brand, growing through athlete endorsements and direct sales.",
  },
  NOC: {
    tr: "Northrop Grumman — savunma yüklenicisi; B-21 bombardıman uçağı, nükleer füze modernizasyonu ve uzay sistemleri programlarını yürütür.",
    en: "Northrop Grumman is a defense contractor running the B-21 bomber, nuclear missile modernization and space programmes.",
  },
  NRG: {
    tr: "NRG Energy — serbest piyasada elektrik üretip perakende satan şirket; Teksas pazarında güçlü konumda.",
    en: "NRG Energy generates and retails power in competitive markets, with a strong Texas position.",
  },
  NSC: {
    tr: "Norfolk Southern — doğu ABD demiryolu şirketi; sanayi yükü ve konteyner taşımacılığı yapar.",
    en: "Norfolk Southern is an eastern US railroad hauling industrial freight and intermodal containers.",
  },
  NTAP: {
    tr: "NetApp — kurumsal veri depolama şirketi; şirketlerin verisini şirket içi ve bulut ortamlar arasında yönetir.",
    en: "NetApp provides enterprise data storage, managing information across on-premise and cloud environments.",
  },
  NTRS: {
    tr: "Northern Trust — saklama bankası ve varlık yöneticisi; kurumsal yatırımcılar ve varlıklı ailelere hizmet verir.",
    en: "Northern Trust is a custody bank and asset manager serving institutions and wealthy families.",
  },
  NUE: {
    tr: "Nucor — ABD'nin en büyük çelik üreticisi; hurda eriten elektrikli ark ocaklarıyla düşük maliyetli üretim yapar.",
    en: "Nucor is the largest US steelmaker, using scrap-fed electric arc furnaces for low-cost production.",
  },
  NVR: {
    tr: "NVR, Inc. — konut inşaatçısı; arsa satın almak yerine opsiyonla çalışarak sermaye riskini düşük tutar.",
    en: "NVR, Inc. builds homes while optioning land rather than buying it, keeping capital risk low.",
  },
  NWS: {
    tr: "News Corp — medya şirketi; Wall Street Journal, The Times ve HarperCollins yayıncılığını yönetir (B sınıfı hisse).",
    en: "News Corp owns The Wall Street Journal, The Times and HarperCollins (class B shares).",
  },
  NWSA: {
    tr: "News Corp — medya şirketi; Wall Street Journal, The Times ve HarperCollins yayıncılığını yönetir (A sınıfı hisse).",
    en: "News Corp owns The Wall Street Journal, The Times and HarperCollins (class A shares).",
  },
  NXPI: {
    tr: "NXP Semiconductors — otomotiv çipi lideri; araç güvenlik sistemleri, temassız ödeme ve endüstriyel kontrol çipleri üretir.",
    en: "NXP Semiconductors leads in automotive chips, plus contactless payment and industrial control silicon.",
  },
  O: {
    tr: "Realty Income — perakende GYO'su; tek kiracılı mağazaları uzun vadeli kiralar, aylık temettü ödemesiyle bilinir.",
    en: "Realty Income is a retail REIT leasing single-tenant stores on long contracts, known for paying monthly dividends.",
  },
  ODFL: {
    tr: "Old Dominion Freight Line — parsiyel yük taşımacılığı şirketi; sektörün en verimli terminal ağını işletir.",
    en: "Old Dominion Freight Line is a less-than-truckload carrier running the industry's most efficient terminal network.",
  },
  OKE: {
    tr: "Oneok — doğalgaz ve sıvı gaz boru hattı şirketi; toplama, işleme ve taşıma altyapısı işletir.",
    en: "Oneok operates natural gas and NGL pipelines covering gathering, processing and transport.",
  },
  OMC: {
    tr: "Omnicom Group — küresel reklam ajansı grubu; markalar için kampanya üretir ve medya satın alması yapar.",
    en: "Omnicom Group is a global advertising holding company creating campaigns and buying media for brands.",
  },
  ON: {
    tr: "ON Semiconductor — güç yarı iletkeni üreticisi; elektrikli araçlar ve endüstriyel sistemler için silisyum karbür çipler yapar.",
    en: "ON Semiconductor makes power chips, including silicon carbide for electric vehicles and industrial systems.",
  },
  ORLY: {
    tr: "O'Reilly Automotive — yedek parça perakendecisi; profesyonel tamircilere hızlı teslimat ağıyla öne çıkar.",
    en: "O'Reilly Automotive retails auto parts, distinguished by fast delivery to professional repair shops.",
  },
  OTIS: {
    tr: "Otis Worldwide — dünyanın en büyük asansör üreticisi; geliri ağırlıklı olarak bakım sözleşmelerinden gelir.",
    en: "Otis Worldwide is the largest elevator maker, with most profit coming from service contracts.",
  },
  OXY: {
    tr: "Occidental Petroleum — petrol üreticisi; Permian havzasında güçlü, karbon yakalama projeleriyle öne çıkıyor.",
    en: "Occidental Petroleum produces oil with a strong Permian position and notable carbon capture projects.",
  },
  PAYX: {
    tr: "Paychex — küçük işletmelere bordro ve insan kaynakları hizmeti sağlar.",
    en: "Paychex provides payroll and human resources services to small businesses.",
  },
  PCAR: {
    tr: "PACCAR — ağır kamyon üreticisi; Kenworth, Peterbilt ve DAF markalarıyla ticari araç satar.",
    en: "PACCAR builds heavy trucks under the Kenworth, Peterbilt and DAF brands.",
  },
  PCG: {
    tr: "PG&E Corporation — Kaliforniya'nın elektrik ve doğalgaz şirketi; orman yangını sorumluluğu ve şebeke yenileme yatırımları gündeminde.",
    en: "PG&E Corporation is California's electricity and gas utility, shaped by wildfire liability and grid modernization.",
  },
  PDD: {
    tr: "PDD Holdings — Pinduoduo ve Temu platformlarının sahibi; düşük fiyatlı e-ticarette Çin ve küresel pazarda büyüyor.",
    en: "PDD Holdings owns Pinduoduo and Temu, growing in low-price e-commerce in China and globally.",
  },
  PEG: {
    tr: "Public Service Enterprise Group — New Jersey'nin elektrik ve doğalgaz şirketi; nükleer santral filosuna sahip.",
    en: "Public Service Enterprise Group is New Jersey's utility, also operating a nuclear fleet.",
  },
  PFG: {
    tr: "Principal Financial Group — emeklilik ve varlık yönetimi şirketi; işveren destekli emeklilik planları yönetir.",
    en: "Principal Financial Group manages retirement plans and assets for employers and individuals.",
  },
  PH: {
    tr: "Parker Hannifin — hareket ve kontrol teknolojisi şirketi; hidrolik, pnömatik ve havacılık akışkan sistemleri üretir.",
    en: "Parker Hannifin makes motion and control technology — hydraulics, pneumatics and aerospace fluid systems.",
  },
  PHM: {
    tr: "PulteGroup — konut inşaatçısı; ilk ev alıcısından emeklilik konutuna kadar farklı segmentlere üretim yapar.",
    en: "PulteGroup builds homes across segments from first-time buyers to active adult communities.",
  },
  PKG: {
    tr: "Packaging Corporation of America — oluklu mukavva kutu üreticisi; ABD'nin üçüncü büyük ambalaj şirketi.",
    en: "Packaging Corporation of America makes corrugated boxes, the third-largest US containerboard producer.",
  },
  PLD: {
    tr: "Prologis — dünyanın en büyük lojistik GYO'su; e-ticaret ve tedarik zinciri için depo ağı kiralar.",
    en: "Prologis is the world's largest logistics REIT, leasing warehouses for e-commerce and supply chains.",
  },
  PNC: {
    tr: "PNC Financial Services — ABD'nin büyük bölgesel bankalarından; bireysel, ticari ve varlık yönetimi hizmeti verir.",
    en: "PNC Financial Services is a large US regional bank spanning retail, commercial and wealth management.",
  },
  PNR: {
    tr: "Pentair — su teknolojisi şirketi; havuz ekipmanı, su arıtma ve filtreleme sistemleri üretir.",
    en: "Pentair makes water technology — pool equipment, treatment and filtration systems.",
  },
  PNW: {
    tr: "Pinnacle West Capital — Arizona'nın elektrik dağıtım şirketi; Palo Verde nükleer santralinin ortağı.",
    en: "Pinnacle West Capital is Arizona's electric utility and a partner in the Palo Verde nuclear plant.",
  },
  PPG: {
    tr: "PPG Industries — boya ve kaplama üreticisi; otomotiv, havacılık ve mimari boyalarda küresel oyuncu.",
    en: "PPG Industries makes paints and coatings for automotive, aerospace and architectural markets.",
  },
  PPL: {
    tr: "PPL Corporation — Pennsylvania ve Kentucky'de elektrik dağıtan altyapı şirketi.",
    en: "PPL Corporation delivers electricity across Pennsylvania and Kentucky.",
  },
  PRU: {
    tr: "Prudential Financial — hayat sigortası ve emeklilik şirketi; kurumsal emeklilik risk transferinde güçlü.",
    en: "Prudential Financial provides life insurance and retirement products, strong in pension risk transfer.",
  },
  PSA: {
    tr: "Public Storage — ABD'nin en büyük bireysel depolama GYO'su; binlerce tesisle kiralık depo alanı sunar.",
    en: "Public Storage is the largest US self-storage REIT with thousands of facilities.",
  },
  PSKY: {
    tr: "Paramount Skydance — medya ve stüdyo şirketi; film yapımı, CBS yayıncılığı ve Paramount+ platformunu birleştirir.",
    en: "Paramount Skydance combines film production, CBS broadcasting and the Paramount+ streaming service.",
  },
  PSX: {
    tr: "Phillips 66 — rafinaj ve midstream şirketi; akaryakıt üretiminin yanında boru hattı ve kimyasal ortaklıkları yürütür.",
    en: "Phillips 66 refines fuels and runs midstream pipelines plus chemical joint ventures.",
  },
  PTC: {
    tr: "PTC Inc. — mühendislik yazılımı şirketi; bilgisayar destekli tasarım (CAD) ve ürün yaşam döngüsü yönetimi sunar.",
    en: "PTC Inc. makes engineering software for computer-aided design and product lifecycle management.",
  },
  PWR: {
    tr: "Quanta Services — elektrik altyapısı taahhüt şirketi; iletim hatları, şebeke güçlendirme ve yenilenebilir bağlantı projeleri kurar.",
    en: "Quanta Services builds electric infrastructure — transmission lines, grid hardening and renewable interconnection.",
  },
  PYPL: {
    tr: "PayPal — dijital ödeme platformu; çevrimiçi alışverişte ödeme geçidi, Venmo ile kişiden kişiye para transferi sağlar.",
    en: "PayPal is a digital payments platform providing online checkout and peer-to-peer transfers through Venmo.",
  },
  Q: {
    tr: "Qnity Electronics — yarı iletken üretim malzemeleri şirketi; çip fabrikalarına ileri teknoloji kimyasal ve malzeme sağlar.",
    en: "Qnity Electronics supplies advanced materials and chemicals to semiconductor fabrication plants.",
  },
  RCL: {
    tr: "Royal Caribbean Group — kruvaziyer şirketi; dünyanın en büyük yolcu gemilerini işletir, özel ada destinasyonlarıyla öne çıkar.",
    en: "Royal Caribbean Group operates the world's largest cruise ships and private island destinations.",
  },
  REG: {
    tr: "Regency Centers — perakende GYO'su; market destekli mahalle alışveriş merkezleri işletir.",
    en: "Regency Centers is a retail REIT running grocery-anchored neighbourhood shopping centers.",
  },
  REGN: {
    tr: "Regeneron Pharmaceuticals — biyoteknoloji şirketi; göz hastalığı ilacı Eylea ve alerji/onkoloji tedavileriyle bilinir.",
    en: "Regeneron Pharmaceuticals is a biotech known for the eye drug Eylea plus allergy and oncology therapies.",
  },
  RF: {
    tr: "Regions Financial — ABD'nin güneyinde faaliyet gösteren bölgesel banka.",
    en: "Regions Financial is a regional bank across the US South.",
  },
  RJF: {
    tr: "Raymond James Financial — yatırım bankası ve aracı kurum; bağımsız finansal danışman ağıyla varlık yönetimi yapar.",
    en: "Raymond James Financial is an investment bank and brokerage with a large independent advisor network.",
  },
  RKLB: {
    tr: "Rocket Lab — küçük uydu fırlatma şirketi; Electron roketiyle yörüngeye yük taşır, Neutron ile daha büyük fırlatmalara hazırlanıyor.",
    en: "Rocket Lab launches small satellites with its Electron rocket and is developing the larger Neutron vehicle.",
  },
  RL: {
    tr: "Ralph Lauren — lüks moda markası; giyim, aksesuar ve ev tekstilinde Amerikan klasik tarzını temsil eder.",
    en: "Ralph Lauren is a luxury fashion brand spanning apparel, accessories and home, defined by American classic style.",
  },
  RMD: {
    tr: "ResMed — uyku apnesi cihazları üreticisi; CPAP makineleri ve solunum destek sistemleri yapar.",
    en: "ResMed makes sleep apnea devices including CPAP machines and respiratory support systems.",
  },
  ROK: {
    tr: "Rockwell Automation — fabrika otomasyonu şirketi; endüstriyel kontrol sistemleri ve üretim yazılımı sağlar.",
    en: "Rockwell Automation supplies factory automation — industrial control systems and manufacturing software.",
  },
  ROL: {
    tr: "Rollins — haşere kontrol şirketi; Orkin markasıyla konut ve iş yerlerine düzenli ilaçlama hizmeti verir.",
    en: "Rollins provides pest control through the Orkin brand on recurring service contracts.",
  },
  ROP: {
    tr: "Roper Technologies — yazılım ve ölçüm teknolojisi holdingi; niş pazarlarda lider konumdaki yazılım şirketlerini satın alıp yönetir.",
    en: "Roper Technologies acquires and runs software and measurement businesses that lead niche markets.",
  },
  ROST: {
    tr: "Ross Stores — indirimli giyim perakendecisi; marka ürünleri düşük fiyata satan mağaza zinciri işletir.",
    en: "Ross Stores is an off-price apparel retailer selling branded goods at a discount.",
  },
  RSG: {
    tr: "Republic Services — atık yönetimi şirketi; çöp toplama, geri dönüşüm ve düzenli depolama tesisleri işletir.",
    en: "Republic Services handles waste collection, recycling and landfill operations.",
  },
  RVTY: {
    tr: "Revvity — yaşam bilimleri ve tanı şirketi; yenidoğan taraması ve araştırma reaktifleri sağlar.",
    en: "Revvity provides life science and diagnostics products including newborn screening and research reagents.",
  },
  SBAC: {
    tr: "SBA Communications — baz istasyonu GYO'su; kule sitelerini mobil operatörlere kiralar.",
    en: "SBA Communications is a tower REIT leasing cell sites to wireless carriers.",
  },
  SHOP: {
    tr: "Shopify — e-ticaret altyapı platformu; işletmelere kendi çevrimiçi mağazasını kurma, ödeme ve lojistik araçları sunar.",
    en: "Shopify provides e-commerce infrastructure, letting merchants run their own storefronts with payments and logistics tools.",
  },
  SJM: {
    tr: "J.M. Smucker — paketli gıda şirketi; reçel, Folgers kahve ve evcil hayvan atıştırmalıkları üretir.",
    en: "J.M. Smucker makes packaged foods including jams, Folgers coffee and pet snacks.",
  },
  SLB: {
    tr: "SLB (Schlumberger) — dünyanın en büyük petrol sahası hizmet şirketi; rezervuar analizi, sondaj ve üretim teknolojileri sağlar.",
    en: "SLB is the largest oilfield services company, providing reservoir analysis, drilling and production technology.",
  },
  SNA: {
    tr: "Snap-on — profesyonel el aleti üreticisi; tamirhanelere alet ve teşhis cihazı satar, kendi finansman kolunu işletir.",
    en: "Snap-on makes professional tools and diagnostics for repair shops, with its own financing arm.",
  },
  SNDK: {
    tr: "SanDisk — flash bellek üreticisi; Western Digital'den ayrılan NAND ve SSD işini yürütür.",
    en: "SanDisk makes flash memory, running the NAND and SSD business spun off from Western Digital.",
  },
  SOLV: {
    tr: "Solventum — 3M'den ayrılan sağlık teknolojisi şirketi; yara bakımı, cerrahi ürünler ve sağlık yazılımı sağlar.",
    en: "Solventum, spun off from 3M, provides wound care, surgical products and health information systems.",
  },
  SPG: {
    tr: "Simon Property Group — ABD'nin en büyük alışveriş merkezi GYO'su; premium outlet ve kapalı AVM portföyü işletir.",
    en: "Simon Property Group is the largest US mall REIT, operating premium outlets and enclosed centers.",
  },
  SRE: {
    tr: "Sempra — Kaliforniya ve Teksas'ta elektrik/doğalgaz dağıtan altyapı şirketi; LNG ihracat terminalleri geliştiriyor.",
    en: "Sempra is a utility in California and Texas, also developing LNG export terminals.",
  },
  STE: {
    tr: "Steris — sterilizasyon şirketi; hastane ekipmanı ve tıbbi cihazların mikroptan arındırılması için sistem ve hizmet sağlar.",
    en: "Steris provides sterilization systems and services for hospital equipment and medical devices.",
  },
  STLD: {
    tr: "Steel Dynamics — elektrikli ark ocağıyla çalışan çelik üreticisi; hurda geri dönüşümü ve alüminyum yatırımlarıyla genişliyor.",
    en: "Steel Dynamics makes steel in electric arc furnaces, expanding into scrap recycling and aluminium.",
  },
  STT: {
    tr: "State Street — saklama bankası ve varlık yöneticisi; SPDR ETF ailesinin (SPY dahil) kurucusu.",
    en: "State Street is a custody bank and asset manager, creator of the SPDR ETF family including SPY.",
  },
  STX: {
    tr: "Seagate Technology — sabit disk üreticisi; veri merkezlerinin yüksek kapasiteli depolama ihtiyacını karşılar.",
    en: "Seagate Technology makes hard drives, supplying high-capacity storage for data centers.",
  },
  STZ: {
    tr: "Constellation Brands — içecek şirketi; ABD'de Corona ve Modelo biralarının dağıtım hakkına sahip, şarap ve içki markaları da yönetir.",
    en: "Constellation Brands holds US rights to Corona and Modelo beers alongside wine and spirits brands.",
  },
  SW: {
    tr: "Smurfit Westrock — küresel ambalaj devi; oluklu mukavva ve kağıt ambalaj üretiminde dünya ölçeğinde faaliyet gösterir.",
    en: "Smurfit Westrock is a global packaging group producing corrugated and paper-based packaging at scale.",
  },
  SWK: {
    tr: "Stanley Black & Decker — el aleti ve elektrikli alet üreticisi; DeWalt ve Craftsman markalarının sahibi.",
    en: "Stanley Black & Decker makes hand and power tools including DeWalt and Craftsman.",
  },
  SWKS: {
    tr: "Skyworks Solutions — kablosuz çip üreticisi; akıllı telefonların radyo frekans (RF) bileşenlerini sağlar.",
    en: "Skyworks Solutions makes wireless chips, supplying radio frequency components for smartphones.",
  },
  SYF: {
    tr: "Synchrony Financial — mağaza markalı kredi kartı şirketi; perakendecilerle ortak kart programları yürütür.",
    en: "Synchrony Financial issues store-branded credit cards in partnership with retailers.",
  },
  SYY: {
    tr: "Sysco — dünyanın en büyük gıda dağıtım şirketi; restoranlara ve kurumsal mutfaklara ürün tedarik eder.",
    en: "Sysco is the world's largest foodservice distributor, supplying restaurants and institutional kitchens.",
  },
  TAP: {
    tr: "Molson Coors — bira üreticisi; Coors Light, Miller Lite ve Blue Moon markalarını yönetir.",
    en: "Molson Coors brews Coors Light, Miller Lite and Blue Moon.",
  },
  TDG: {
    tr: "TransDigm Group — havacılık yedek parça üreticisi; tekel konumundaki özel parçalarla yüksek marjlı satış sonrası pazarına odaklanır.",
    en: "TransDigm Group makes proprietary aerospace components, focused on the high-margin aftermarket.",
  },
  TDY: {
    tr: "Teledyne Technologies — dijital görüntüleme ve ölçüm şirketi; uzay, savunma ve endüstriyel sensörler üretir.",
    en: "Teledyne Technologies makes digital imaging and instrumentation for space, defense and industrial sensing.",
  },
  TECH: {
    tr: "Bio-Techne — yaşam bilimleri reaktif şirketi; protein, antikor ve hücre terapisi araçları sağlar.",
    en: "Bio-Techne supplies life science reagents — proteins, antibodies and cell therapy tools.",
  },
  TEL: {
    tr: "TE Connectivity — konektör ve sensör üreticisi; otomotiv, sanayi ve veri iletişimi bağlantı sistemleri yapar.",
    en: "TE Connectivity makes connectors and sensors for automotive, industrial and data communication systems.",
  },
  TER: {
    tr: "Teradyne — yarı iletken test ekipmanı üreticisi; üretilen çiplerin doğru çalıştığını denetleyen sistemler ile endüstriyel robotlar yapar.",
    en: "Teradyne makes semiconductor test equipment that verifies chips work, plus industrial robots.",
  },
  TFC: {
    tr: "Truist Financial — BB&T ve SunTrust birleşmesinden doğan büyük bölgesel banka; ABD'nin güneydoğusunda güçlü.",
    en: "Truist Financial, formed by the BB&T and SunTrust merger, is a large regional bank strong in the Southeast.",
  },
  TGT: {
    tr: "Target Corporation — büyük mağaza zinciri; giyim ve ev ürünlerinde kendi markalarıyla farklılaşır.",
    en: "Target Corporation is a big-box retailer differentiated by its own apparel and home brands.",
  },
  TKO: {
    tr: "TKO Group — canlı spor eğlence şirketi; UFC ve WWE markalarını yönetir, yayın hakkı gelirleriyle çalışır.",
    en: "TKO Group runs UFC and WWE, monetizing live sports entertainment through media rights.",
  },
  TMUS: {
    tr: "T-Mobile US — mobil operatör; Sprint birleşmesi sonrası 5G kapsama alanında liderlik iddiasıyla abone kazanıyor.",
    en: "T-Mobile US is a mobile carrier gaining subscribers on 5G coverage leadership after the Sprint merger.",
  },
  TPL: {
    tr: "Texas Pacific Land — Permian havzasında geniş arazi sahibi; petrol üretmez, arazi kirası ve telif geliri elde eder.",
    en: "Texas Pacific Land owns vast Permian acreage, earning royalties and land leases rather than drilling itself.",
  },
  TPR: {
    tr: "Tapestry — lüks aksesuar grubu; Coach ve Kate Spade markalarıyla çanta ve deri ürün satar.",
    en: "Tapestry is a luxury accessories group selling handbags and leather goods through Coach and Kate Spade.",
  },
  TRGP: {
    tr: "Targa Resources — doğalgaz toplama ve işleme şirketi; Permian havzasının sıvı gaz altyapısını işletir.",
    en: "Targa Resources gathers and processes natural gas, running NGL infrastructure across the Permian.",
  },
  TRI: {
    tr: "Thomson Reuters — profesyonel bilgi şirketi; hukuk (Westlaw), vergi ve haber ajansı hizmetleri sunar.",
    en: "Thomson Reuters provides professional information — Westlaw legal research, tax software and the news agency.",
  },
  TRMB: {
    tr: "Trimble — hassas konumlandırma teknolojisi şirketi; inşaat, tarım ve lojistikte GPS tabanlı yazılım ve donanım sağlar.",
    en: "Trimble makes precision positioning technology — GPS-based hardware and software for construction, agriculture and logistics.",
  },
  TROW: {
    tr: "T. Rowe Price — aktif yatırım fonu yöneticisi; emeklilik planları ve yatırım fonlarıyla bilinir.",
    en: "T. Rowe Price is an active fund manager known for mutual funds and retirement plans.",
  },
  TRV: {
    tr: "Travelers — ticari ve bireysel hasar-kaza sigortacısı; Dow Jones endeksindeki tek saf sigorta şirketi.",
    en: "Travelers writes commercial and personal property-casualty insurance and is the Dow's pure-play insurer.",
  },
  TSCO: {
    tr: "Tractor Supply — kırsal yaşam perakendecisi; çiftlik malzemesi, hayvan yemi ve bahçe ürünleri satar.",
    en: "Tractor Supply is a rural lifestyle retailer selling farm supplies, animal feed and garden products.",
  },
  TSN: {
    tr: "Tyson Foods — ABD'nin en büyük et üreticilerinden; tavuk, sığır ve domuz işleme tesisleri işletir.",
    en: "Tyson Foods is among the largest US meat producers, processing chicken, beef and pork.",
  },
  TT: {
    tr: "Trane Technologies — iklimlendirme şirketi; ticari binalar ve soğuk zincir için verimli ısıtma-soğutma sistemleri üretir.",
    en: "Trane Technologies makes efficient heating and cooling systems for commercial buildings and cold chains.",
  },
  TTD: {
    tr: "The Trade Desk — dijital reklam alım platformu; reklamverenlerin bağımsız internette otomatik reklam satın almasını sağlar.",
    en: "The Trade Desk runs a demand-side platform letting advertisers buy programmatic ads across the open internet.",
  },
  TTWO: {
    tr: "Take-Two Interactive — oyun yayıncısı; Grand Theft Auto ve NBA 2K serilerinin sahibi.",
    en: "Take-Two Interactive publishes games including the Grand Theft Auto and NBA 2K franchises.",
  },
  TXT: {
    tr: "Textron — havacılık ve savunma şirketi; Cessna iş jetleri, Bell helikopterleri ve askeri araçlar üretir.",
    en: "Textron builds Cessna business jets, Bell helicopters and military vehicles.",
  },
  TYL: {
    tr: "Tyler Technologies — kamu sektörü yazılım şirketi; belediye ve mahkemelerin kayıt, tahsilat ve adalet sistemlerini işletir.",
    en: "Tyler Technologies makes public sector software running municipal records, billing and court systems.",
  },
  UAL: {
    tr: "United Airlines — ABD'nin en büyük havayollarından; uluslararası uzun menzil ağıyla öne çıkar.",
    en: "United Airlines is a major US carrier distinguished by its long-haul international network.",
  },
  UDR: {
    tr: "UDR — konut GYO'su; ABD genelinde kiralık apartman toplulukları işletir.",
    en: "UDR is an apartment REIT operating rental communities across the US.",
  },
  UHS: {
    tr: "Universal Health Services — hastane işletmecisi; genel hastanelerin yanında psikiyatri ve davranışsal sağlık merkezleri yönetir.",
    en: "Universal Health Services operates acute care hospitals plus behavioural health facilities.",
  },
  ULTA: {
    tr: "Ulta Beauty — kozmetik perakendecisi; lüks ve uygun fiyatlı güzellik markalarını aynı mağazada satar, kuaför hizmeti sunar.",
    en: "Ulta Beauty retails prestige and mass beauty brands side by side, with in-store salons.",
  },
  UPS: {
    tr: "United Parcel Service — küresel kargo şirketi; kara ve hava ağıyla paket teslimatı yapar, e-ticaret hacmine duyarlıdır.",
    en: "United Parcel Service delivers parcels through a global ground and air network tied to e-commerce volume.",
  },
  URI: {
    tr: "United Rentals — ABD'nin en büyük ekipman kiralama şirketi; inşaat ve sanayi projelerine iş makinesi kiralar.",
    en: "United Rentals is the largest US equipment rental company, serving construction and industrial projects.",
  },
  USB: {
    tr: "U.S. Bancorp — ABD'nin büyük bankalarından; bireysel bankacılık ve ödeme işleme hizmetleriyle çalışır.",
    en: "U.S. Bancorp is a large US bank spanning retail banking and payment processing.",
  },
  VEEV: {
    tr: "Veeva Systems — ilaç sektörüne özel bulut yazılımı; klinik denemeler ve satış süreçlerini tek platformda yönetir.",
    en: "Veeva Systems provides cloud software built for pharma, managing clinical trials and commercial operations.",
  },
  VICI: {
    tr: "Vici Properties — eğlence GYO'su; Caesars ve MGM gibi kumarhane tesislerinin mülkiyetini tutar, işletmecilere kiralar.",
    en: "Vici Properties is an experiential REIT owning casino properties leased to operators such as Caesars and MGM.",
  },
  VLO: {
    tr: "Valero Energy — ABD'nin en büyük bağımsız rafinericilerinden; akaryakıt ve yenilenebilir dizel üretir.",
    en: "Valero Energy is among the largest independent US refiners, producing fuels and renewable diesel.",
  },
  VLTO: {
    tr: "Veralto — Danaher'dan ayrılan su kalitesi ve ürün izlenebilirliği şirketi; su analizi ve ambalaj kodlama çözümleri sunar.",
    en: "Veralto, spun off from Danaher, provides water quality analysis and product identification technology.",
  },
  VMC: {
    tr: "Vulcan Materials — ABD'nin en büyük agrega üreticisi; yol ve altyapı inşaatına kırma taş ve kum sağlar.",
    en: "Vulcan Materials is the largest US aggregates producer, supplying crushed stone and sand for infrastructure.",
  },
  VRSK: {
    tr: "Verisk Analytics — sigorta sektörü veri ve analitik şirketi; risk modelleme ve hasar tahmini araçları satar.",
    en: "Verisk Analytics sells data and analytics to insurers, including risk modelling and claims estimation.",
  },
  VRSN: {
    tr: "Verisign — internet alan adı altyapısı şirketi; .com ve .net uzantılarının kayıt otoritesini işletir.",
    en: "Verisign operates the registry for .com and .net domains, core internet infrastructure.",
  },
  VRT: {
    tr: "Vertiv — veri merkezi altyapı şirketi; güç yönetimi ve sıvı soğutma sistemleriyle yapay zekâ sunucularının ısı sorununu çözer.",
    en: "Vertiv supplies data-center infrastructure — power management and liquid cooling that handle AI server heat.",
  },
  VST: {
    tr: "Vistra Corp — bağımsız elektrik üreticisi; nükleer ve gaz santralleriyle serbest piyasada elektrik satar.",
    en: "Vistra Corp is an independent power producer selling electricity from nuclear and gas plants in competitive markets.",
  },
  VTR: {
    tr: "Ventas — sağlık GYO'su; yaşlı bakım tesisleri, tıp merkezleri ve araştırma binaları portföyü yönetir.",
    en: "Ventas is a healthcare REIT holding senior housing, medical offices and research buildings.",
  },
  VTRS: {
    tr: "Viatris — jenerik ve markalı ilaç üreticisi; Mylan ile Pfizer'ın Upjohn biriminin birleşmesinden doğdu.",
    en: "Viatris makes generic and branded medicines, formed from Mylan and Pfizer's Upjohn unit.",
  },
  WAB: {
    tr: "Wabtec — demiryolu teknolojisi şirketi; lokomotif üretir, fren sistemleri ve dijital demiryolu çözümleri sağlar.",
    en: "Wabtec makes locomotives, braking systems and digital rail technology.",
  },
  WAT: {
    tr: "Waters Corporation — analitik laboratuvar cihazı üreticisi; sıvı kromatografi ve kütle spektrometresi sistemlerinde uzman.",
    en: "Waters Corporation makes analytical instruments, specializing in liquid chromatography and mass spectrometry.",
  },
  WBD: {
    tr: "Warner Bros. Discovery — medya şirketi; Warner stüdyoları, HBO Max ve Discovery kanallarını birleştirir.",
    en: "Warner Bros. Discovery combines the Warner studios, HBO Max and Discovery networks.",
  },
  WDAY: {
    tr: "Workday — kurumsal bulut yazılımı; insan kaynakları ve finans yönetimini tek platformda toplar.",
    en: "Workday provides cloud software unifying human resources and financial management.",
  },
  WDC: {
    tr: "Western Digital — veri depolama şirketi; sabit disk üretimine odaklandı, flash işini SanDisk olarak ayırdı.",
    en: "Western Digital focuses on hard disk drives after spinning off its flash business as SanDisk.",
  },
  WEC: {
    tr: "WEC Energy Group — Wisconsin ve çevresinde elektrik ile doğalgaz dağıtan altyapı şirketi.",
    en: "WEC Energy Group delivers electricity and natural gas across Wisconsin and neighbouring states.",
  },
  WELL: {
    tr: "Welltower — dünyanın en büyük sağlık GYO'larından; yaşlı bakım ve tıbbi bina portföyü yönetir.",
    en: "Welltower is among the largest healthcare REITs, holding senior housing and medical buildings.",
  },
  WM: {
    tr: "Waste Management — ABD'nin en büyük atık şirketi; çöp toplama, geri dönüşüm ve depolama sahalarından metan enerjisi üretir.",
    en: "Waste Management is the largest US waste company, handling collection, recycling and landfill gas energy.",
  },
  WMB: {
    tr: "Williams Companies — doğalgaz boru hattı şirketi; ABD'nin en büyük gaz iletim hattı Transco'yu işletir.",
    en: "Williams Companies operates natural gas pipelines including Transco, the largest US gas transmission system.",
  },
  WRB: {
    tr: "W. R. Berkley — ticari sigorta şirketi; özel risk ve niş branşlarda poliçe yazar.",
    en: "W. R. Berkley writes commercial insurance focused on specialty and niche risks.",
  },
  WSM: {
    tr: "Williams-Sonoma — ev eşyası perakendecisi; Pottery Barn ve West Elm markalarıyla mobilya ve mutfak ürünleri satar.",
    en: "Williams-Sonoma retails home furnishings through Pottery Barn and West Elm.",
  },
  WST: {
    tr: "West Pharmaceutical Services — ilaç ambalaj bileşeni üreticisi; enjeksiyonluk ilaçların tıpa ve şırınga sistemlerini yapar.",
    en: "West Pharmaceutical Services makes drug packaging components — stoppers and syringe systems for injectables.",
  },
  WTW: {
    tr: "Willis Towers Watson — sigorta brokerliği ve danışmanlık şirketi; risk yönetimi ve çalışan yan hakları programları kurar.",
    en: "Willis Towers Watson brokers insurance and advises on risk management and employee benefits.",
  },
  WY: {
    tr: "Weyerhaeuser — orman arazisi GYO'su; kereste üretir ve ABD'nin en büyük özel orman portföyünü yönetir.",
    en: "Weyerhaeuser is a timber REIT producing wood products and managing the largest private US forest holdings.",
  },
  WYNN: {
    tr: "Wynn Resorts — lüks kumarhane ve tatil köyü işletmecisi; Las Vegas ve Macau'da üst segment tesisler yönetir.",
    en: "Wynn Resorts operates luxury casino resorts in Las Vegas and Macau.",
  },
  XEL: {
    tr: "Xcel Energy — Ortabatı ve dağlık eyaletlerde elektrik dağıtan şirket; rüzgâr enerjisi kapasitesinde öncü.",
    en: "Xcel Energy delivers electricity across the Midwest and Mountain states, a leader in wind capacity.",
  },
  XYL: {
    tr: "Xylem — su teknolojisi şirketi; su pompaları, arıtma sistemleri ve akıllı sayaç altyapısı sağlar.",
    en: "Xylem provides water technology — pumps, treatment systems and smart metering infrastructure.",
  },
  XYZ: {
    tr: "Block, Inc. — fintech şirketi; Square satış noktası terminalleri ve Cash App mobil ödeme uygulamasını işletir.",
    en: "Block, Inc. runs Square point-of-sale terminals and the Cash App mobile payments platform.",
  },
  YUM: {
    tr: "Yum! Brands — restoran grubu; KFC, Pizza Hut ve Taco Bell markalarını franchise modeliyle dünya çapında işletir.",
    en: "Yum! Brands franchises KFC, Pizza Hut and Taco Bell worldwide.",
  },
  ZBH: {
    tr: "Zimmer Biomet — ortopedik implant üreticisi; diz ve kalça protezlerinde dünya lideri.",
    en: "Zimmer Biomet makes orthopedic implants and leads in knee and hip replacements.",
  },
  ZBRA: {
    tr: "Zebra Technologies — barkod ve mobil bilgisayar üreticisi; depo, perakende ve sağlıkta envanter takip sistemleri sağlar.",
    en: "Zebra Technologies makes barcode scanners and mobile computers for inventory tracking in warehouses, retail and healthcare.",
  },
};
