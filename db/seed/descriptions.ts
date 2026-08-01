/**
 * Şirket iş tanımları — takip evrenindeki semboller için elle yazılmış,
 * iki dilli kısa açıklamalar. Finnhub'ın ücretsiz profili tanım içermez;
 * bu metinler şirketin NE İŞ yaptığını ve hangi alanları kapsadığını anlatır.
 * Piyasa verisi değildir — istikrarlı kurumsal bilgidir, elle güncellenir.
 */

export type SymbolDescription = { tr: string; en: string };

export const SYMBOL_DESCRIPTIONS: Record<string, SymbolDescription> = {
  // ---- Endeks fonları ----
  QQQ: {
    tr: "Nasdaq 100 endeksini izleyen borsa yatırım fonu — Nasdaq'ta işlem gören, finans dışı en büyük 100 şirketi (ağırlıklı teknoloji) tek üründe toplar.",
    en: "Exchange-traded fund tracking the Nasdaq 100 — the 100 largest non-financial companies on Nasdaq, heavily weighted toward technology.",
  },
  SPY: {
    tr: "S&P 500 endeksini izleyen, dünyanın en çok işlem gören borsa yatırım fonu — ABD'nin en büyük 500 şirketine tek üründe erişim sağlar.",
    en: "The world's most traded ETF, tracking the S&P 500 — exposure to the 500 largest US companies in a single product.",
  },
  DIA: {
    tr: "Dow Jones Industrial Average endeksini izleyen borsa yatırım fonu — 30 köklü ABD sanayi ve hizmet devini kapsar.",
    en: "ETF tracking the Dow Jones Industrial Average — 30 established US industrial and service giants.",
  },
  IWM: {
    tr: "Russell 2000 endeksini izleyen borsa yatırım fonu — ABD'nin küçük ölçekli 2.000 şirketini temsil eder; iç ekonominin nabzı sayılır.",
    en: "ETF tracking the Russell 2000 — about 2,000 US small-cap companies, widely read as a pulse of the domestic economy.",
  },

  // ---- Yapay zekâ ve yarı iletken ----
  NVDA: {
    tr: "Yapay zekâ hızlandırıcıları ve grafik işlemcilerinde (GPU) dünya lideri. Veri merkezi çipleri, oyun ekran kartları, otomotiv ve robotik platformları ile CUDA yazılım ekosistemini kapsar.",
    en: "World leader in AI accelerators and graphics processors (GPUs). Spans data-center chips, gaming graphics cards, automotive and robotics platforms, and the CUDA software ecosystem.",
  },
  AMD: {
    tr: "İşlemci (CPU) ve grafik çipi (GPU) tasarımcısı — sunucu tarafında EPYC, kişisel bilgisayarda Ryzen, yapay zekâ hızlandırmada Instinct serileriyle Intel ve NVIDIA'ya rakip.",
    en: "Designer of CPUs and GPUs — EPYC in servers, Ryzen in PCs and Instinct in AI acceleration, competing with Intel and NVIDIA.",
  },
  AVGO: {
    tr: "Ağ, kablosuz iletişim ve depolama çipleri üreten yarı iletken devi; VMware satın alımıyla altyapı yazılımına da genişledi. Hyperscaler'lar için özel yapay zekâ çipleri (XPU) tasarlar.",
    en: "Semiconductor giant in networking, wireless and storage chips; expanded into infrastructure software with VMware. Designs custom AI chips (XPUs) for hyperscalers.",
  },
  TSM: {
    tr: "Dünyanın en büyük sözleşmeli çip üreticisi (dökümhane). Apple'dan NVIDIA'ya sektörün en gelişmiş çiplerini üretir; küresel yarı iletken tedarik zincirinin merkezidir.",
    en: "The world's largest contract chipmaker (foundry). Manufactures the industry's most advanced chips for Apple, NVIDIA and others — the heart of the global semiconductor supply chain.",
  },
  MU: {
    tr: "Bellek çipi üreticisi — DRAM ve NAND'ın yanı sıra yapay zekâ sunucularının kritik parçası olan yüksek bant genişlikli bellek (HBM) üretir.",
    en: "Memory chipmaker — DRAM and NAND, plus high-bandwidth memory (HBM), a critical component of AI servers.",
  },
  INTC: {
    tr: "Köklü işlemci üreticisi — PC ve sunucu CPU'ları üretir, dökümhane işine (Intel Foundry) açılarak sözleşmeli üretimde TSMC'ye rakip olmaya çalışıyor.",
    en: "Veteran processor maker — PC and server CPUs, now building a foundry business to challenge TSMC in contract manufacturing.",
  },
  QCOM: {
    tr: "Mobil çip ve kablosuz teknoloji lideri — Snapdragon işlemciler, modem çipleri ve geniş 5G patent portföyü; otomotiv ve PC pazarlarına genişliyor.",
    en: "Leader in mobile chips and wireless technology — Snapdragon processors, modem chips and a broad 5G patent portfolio, expanding into automotive and PCs.",
  },
  ARM: {
    tr: "Çip mimarisi tasarımcısı — dünyadaki akıllı telefonların neredeyse tamamı Arm mimarisiyle çalışır. Tasarımlarını NVIDIA, Apple ve Qualcomm gibi şirketlere lisanslar.",
    en: "Chip architecture designer — nearly every smartphone runs on Arm designs, licensed to NVIDIA, Apple, Qualcomm and others.",
  },
  MRVL: {
    tr: "Veri altyapısı çipleri tasarlar — yapay zekâ veri merkezleri için özel silikon, optik bağlantı ve ağ çipleri ana büyüme alanı.",
    en: "Designs data-infrastructure chips — custom silicon for AI data centers, optical interconnect and networking are the main growth areas.",
  },
  SMCI: {
    tr: "Yapay zekâ sunucuları üreticisi — NVIDIA GPU'ları etrafında hızlı yapılandırılan sunucu ve sıvı soğutmalı veri merkezi sistemleri kurar.",
    en: "AI server maker — builds rapidly configured servers and liquid-cooled data-center systems around NVIDIA GPUs.",
  },
  ASML: {
    tr: "Gelişmiş çip üretiminin tek anahtarı: EUV litografi makinelerinin dünyadaki tek üreticisi. TSMC, Samsung ve Intel'in en modern fabrikaları ASML'siz çalışamaz.",
    en: "The sole maker of EUV lithography machines — the single key to advanced chipmaking. TSMC, Samsung and Intel's leading-edge fabs cannot run without ASML.",
  },
  LRCX: {
    tr: "Çip üretim ekipmanı üreticisi — plazma aşındırma (etch) ve ince film kaplama (deposition) makinelerinde lider; bellek üreticilerinin ana tedarikçisi.",
    en: "Chip-fab equipment maker — leader in plasma etch and thin-film deposition, a key supplier to memory manufacturers.",
  },
  AMAT: {
    tr: "Dünyanın en geniş ürün gamına sahip çip üretim ekipmanı şirketi — kaplama, aşındırma, iyon implantasyonu ve denetim makineleriyle fabrikaların her aşamasında bulunur.",
    en: "The broadest portfolio in chip-fab equipment — deposition, etch, ion implant and inspection tools present at every stage of the fab.",
  },
  KLAC: {
    tr: "Çip üretiminde süreç kontrolü ve hata denetimi lideri — üretim hattındaki nanometre ölçekli kusurları bulan ölçüm ve denetim sistemleri yapar.",
    en: "Leader in process control and defect inspection for chipmaking — metrology systems that find nanometer-scale flaws on the line.",
  },
  TXN: {
    tr: "Analog ve gömülü çiplerin devi — sanayi, otomotiv ve elektronikte kullanılan on binlerce çeşit güç yönetimi ve sinyal işleme çipi üretir.",
    en: "Giant of analog and embedded chips — tens of thousands of power-management and signal-processing parts for industrial, automotive and electronics markets.",
  },
  ADI: {
    tr: "Yüksek performanslı analog çip üreticisi — sensörden dijitale sinyal dönüşümünde lider; sanayi, otomotiv, haberleşme ve sağlık cihazlarını kapsar.",
    en: "High-performance analog chipmaker — leader in sensor-to-digital signal conversion across industrial, automotive, communications and healthcare.",
  },

  // ---- Mega cap teknoloji ----
  AAPL: {
    tr: "iPhone, Mac, iPad, Watch ve hizmetler (App Store, iCloud, Apple Music) ekosistemi. Kendi çiplerini (M ve A serisi) tasarlar; dünyanın en değerli tüketici teknolojisi markası.",
    en: "The iPhone, Mac, iPad, Watch and services ecosystem (App Store, iCloud, Apple Music). Designs its own M- and A-series chips; the world's most valuable consumer-tech brand.",
  },
  MSFT: {
    tr: "Windows, Office ve Azure bulutunun sahibi; OpenAI ortaklığı ve Copilot ürünleriyle kurumsal yapay zekânın merkezinde. Oyun (Xbox, Activision) ve LinkedIn'i de kapsar.",
    en: "Owner of Windows, Office and the Azure cloud; central to enterprise AI through the OpenAI partnership and Copilot. Also spans gaming (Xbox, Activision) and LinkedIn.",
  },
  GOOGL: {
    tr: "Google arama, YouTube, Android ve Chrome'un çatı şirketi Alphabet. Google Cloud, Gemini yapay zekâ modelleri, kendi TPU çipleri ve Waymo sürücüsüz araç birimini kapsar.",
    en: "Alphabet, parent of Google Search, YouTube, Android and Chrome. Spans Google Cloud, Gemini AI models, in-house TPU chips and the Waymo self-driving unit.",
  },
  AMZN: {
    tr: "E-ticaretin ve bulut bilişimin (AWS) lideri. Reklamcılık, Prime video/lojistik ağı ve kendi yapay zekâ çipleri (Trainium) ile perakendeden altyapıya uzanır.",
    en: "Leader in e-commerce and cloud computing (AWS). Stretches from retail to infrastructure with advertising, the Prime video/logistics network and in-house AI chips (Trainium).",
  },
  META: {
    tr: "Facebook, Instagram, WhatsApp ve Messenger'ın sahibi — geliri dijital reklamdan gelir. Llama açık yapay zekâ modelleri ve Quest gözlükleriyle metaverse/AI yatırımları sürer.",
    en: "Owner of Facebook, Instagram, WhatsApp and Messenger — revenue driven by digital ads. Invests in Llama open AI models and Quest headsets.",
  },
  TSLA: {
    tr: "Elektrikli araç öncüsü — Model serisi araçlar, enerji depolama (Megapack), şarj ağı ve otonom sürüş (FSD, robotaksi) ile Optimus insansı robot programını kapsar.",
    en: "Electric-vehicle pioneer — Model lineup, energy storage (Megapack), the charging network, autonomous driving (FSD, robotaxi) and the Optimus humanoid program.",
  },
  NFLX: {
    tr: "Dünyanın en büyük abonelikli video platformu — kendi dizi/film prodüksiyonu, reklamlı abonelik katmanı ve canlı yayın/oyun alanlarına genişleme.",
    en: "The world's largest subscription video platform — original productions, an ad-supported tier and expansion into live events and games.",
  },

  // ---- Yazılım ve bulut ----
  PLTR: {
    tr: "Devlet ve şirketler için veri analitiği platformları (Gotham, Foundry) kurar; yapay zekâ operasyon platformu AIP ile savunma ve kurumsal yapay zekâda büyür.",
    en: "Builds data-analytics platforms (Gotham, Foundry) for governments and enterprises; growing in defense and enterprise AI with its AIP platform.",
  },
  SNOW: {
    tr: "Bulut veri ambarı platformu — şirketlerin verilerini tek çatıda toplayıp analiz ve yapay zekâ uygulamalarına açar; kullandıkça öde modeliyle çalışır.",
    en: "Cloud data platform — consolidates enterprise data for analytics and AI applications, on a consumption-based model.",
  },
  CRM: {
    tr: "Müşteri ilişkileri yönetimi (CRM) yazılımının lideri Salesforce — satış, servis ve pazarlama bulutları ile Agentforce yapay zekâ ajanlarını kapsar; Slack'in sahibi.",
    en: "Salesforce, the CRM leader — sales, service and marketing clouds plus Agentforce AI agents; owner of Slack.",
  },
  NOW: {
    tr: "ServiceNow — şirket içi iş akışlarını (BT, İK, müşteri servisi) tek platformda otomatikleştirir; kurumsal yapay zekâ ajanlarında hızlı büyüyen oyuncu.",
    en: "ServiceNow — automates enterprise workflows (IT, HR, customer service) on one platform; a fast mover in enterprise AI agents.",
  },
  ORCL: {
    tr: "Kurumsal veritabanının devi — Oracle Database ve iş uygulamalarının yanında OCI bulutuyla yapay zekâ eğitim altyapısında (Stargate dahil) büyük oyuncu haline geldi.",
    en: "The enterprise-database giant — Oracle Database and business apps, now a major player in AI training infrastructure through OCI (including Stargate).",
  },
  IBM: {
    tr: "Kurumsal BT'nin köklü ismi — hibrit bulut (Red Hat), danışmanlık, watsonx yapay zekâ platformu ve kuantum bilişim araştırmalarını kapsar.",
    en: "The veteran of enterprise IT — hybrid cloud (Red Hat), consulting, the watsonx AI platform and quantum-computing research.",
  },
  ADBE: {
    tr: "Yaratıcı yazılımın standardı — Photoshop, Illustrator, Premiere ve PDF/e-imza (Acrobat) ürünleri; Firefly üretken yapay zekâsıyla içerik üretimini dönüştürüyor.",
    en: "The standard in creative software — Photoshop, Illustrator, Premiere and Acrobat, transforming content creation with Firefly generative AI.",
  },
  PANW: {
    tr: "Siber güvenliğin en büyük platform şirketi — ağ güvenliği duvarları, bulut güvenliği (Prisma) ve güvenlik operasyonları (Cortex) tek çatıda.",
    en: "The largest cybersecurity platform company — network firewalls, cloud security (Prisma) and security operations (Cortex) under one roof.",
  },
  CRWD: {
    tr: "Uç nokta güvenliğinin lideri CrowdStrike — Falcon platformu cihazları, kimlikleri ve bulut iş yüklerini yapay zekâ destekli tek ajanla korur.",
    en: "CrowdStrike, the endpoint-security leader — the Falcon platform protects devices, identities and cloud workloads with a single AI-driven agent.",
  },
  DDOG: {
    tr: "Bulut izleme ve gözlemlenebilirlik platformu — şirketlerin sunucu, uygulama ve log verilerini tek ekranda izleyip sorunları erken yakalamasını sağlar.",
    en: "Cloud monitoring and observability platform — lets companies watch servers, apps and logs in one place and catch issues early.",
  },
  MDB: {
    tr: "Modern uygulamaların veritabanı MongoDB — doküman tabanlı esnek veri modeli ve Atlas bulut servisi; yapay zekâ uygulamalarında vektör arama ile büyüyor.",
    en: "MongoDB, the database for modern apps — flexible document model and the Atlas cloud service, growing in AI apps via vector search.",
  },
  NET: {
    tr: "İnternetin altyapı katmanı Cloudflare — web sitelerini hızlandırır ve korur; içerik dağıtımı, güvenlik ve uç bilişim (Workers) hizmetlerini kapsar.",
    en: "Cloudflare, an infrastructure layer of the internet — speeds up and protects websites; spans CDN, security and edge computing (Workers).",
  },

  // ---- Finans ----
  JPM: {
    tr: "ABD'nin en büyük bankası — yatırım bankacılığı, ticari bankacılık, varlık yönetimi ve tüketici finansmanını (Chase) kapsayan tam hizmet finans devi.",
    en: "The largest US bank — a full-service giant spanning investment banking, commercial banking, asset management and consumer finance (Chase).",
  },
  BAC: {
    tr: "ABD'nin ikinci büyük bankası Bank of America — geniş şube ağıyla tüketici bankacılığı, Merrill ile varlık yönetimi ve küresel piyasa işlemleri.",
    en: "Bank of America, the second-largest US bank — consumer banking at scale, wealth management via Merrill and global markets.",
  },
  GS: {
    tr: "Wall Street'in simge yatırım bankası Goldman Sachs — birleşme-satın alma danışmanlığı, halka arzlar, piyasa işlemleri ve varlık yönetimi.",
    en: "Goldman Sachs, Wall Street's flagship investment bank — M&A advisory, IPOs, trading and asset management.",
  },
  V: {
    tr: "Dünyanın en büyük ödeme ağı — kart işlemlerini bankalar arasında yönlendirir; her işlemden küçük pay alan, sermaye-hafif küresel altyapı.",
    en: "The world's largest payments network — routes card transactions between banks; a capital-light global infrastructure earning a small cut per transaction.",
  },
  MA: {
    tr: "Visa'nın ana rakibi küresel ödeme ağı Mastercard — kart işlem altyapısının yanında dolandırıcılık önleme ve veri servisleri sunar.",
    en: "Mastercard, the global payments network rivaling Visa — transaction rails plus fraud-prevention and data services.",
  },
  "BRK.B": {
    tr: "Warren Buffett'ın holding şirketi Berkshire Hathaway — sigorta (GEICO), demiryolu (BNSF), enerji ve dev hisse portföyünü (Apple dahil) tek çatıda toplar.",
    en: "Warren Buffett's Berkshire Hathaway — insurance (GEICO), railroads (BNSF), energy and a giant equity portfolio (including Apple) under one roof.",
  },
  COIN: {
    tr: "ABD'nin en büyük kripto borsası Coinbase — alım satım, saklama (kurumsal custody), staking ve USDC ekosisteminden gelir üretir.",
    en: "Coinbase, the largest US crypto exchange — revenue from trading, institutional custody, staking and the USDC ecosystem.",
  },

  // ---- Sağlık ----
  LLY: {
    tr: "Dünyanın en değerli ilaç şirketi Eli Lilly — obezite/diyabet ilaçları (Zepbound, Mounjaro) büyümenin motoru; onkoloji ve Alzheimer tedavilerini kapsar.",
    en: "Eli Lilly, the world's most valuable pharma — obesity/diabetes drugs (Zepbound, Mounjaro) drive growth; also oncology and Alzheimer's.",
  },
  UNH: {
    tr: "ABD'nin en büyük sağlık sigortacısı UnitedHealth — sigorta (UnitedHealthcare) ve sağlık hizmetleri/veri analitiği (Optum) kollarıyla sektörün iki yanını kapsar.",
    en: "UnitedHealth, the largest US health insurer — spans both sides of the industry via insurance (UnitedHealthcare) and care/analytics (Optum).",
  },
  JNJ: {
    tr: "İlaç ve tıbbi cihaz devi Johnson & Johnson — onkoloji ve bağışıklık ilaçları ile cerrahi/ortopedi cihazlarını kapsar; tüketici ürünleri Kenvue olarak ayrıldı.",
    en: "Johnson & Johnson, pharma and medical-device giant — oncology and immunology drugs plus surgical/orthopedic devices; consumer brands spun off as Kenvue.",
  },
  MRK: {
    tr: "İlaç devi Merck — kanser immünoterapisinin en çok satan ilacı Keytruda'nın sahibi; aşılar ve hayvan sağlığını da kapsar.",
    en: "Pharma giant Merck — owner of Keytruda, the top-selling cancer immunotherapy; also vaccines and animal health.",
  },
  ABBV: {
    tr: "İlaç şirketi AbbVie — bağışıklık ilaçları (Skyrizi, Rinvoq), estetik (Botox) ve nörobilim portföyüyle Humira sonrası dönüşümünü tamamladı.",
    en: "AbbVie — immunology drugs (Skyrizi, Rinvoq), aesthetics (Botox) and neuroscience, having completed its post-Humira transition.",
  },

  // ---- Tüketici ve perakende ----
  WMT: {
    tr: "Dünyanın en büyük perakendecisi Walmart — mağaza ağının üzerine hızla büyüyen e-ticaret, reklam ve pazar yeri gelirleri ekleniyor.",
    en: "Walmart, the world's largest retailer — fast-growing e-commerce, advertising and marketplace revenue on top of the store network.",
  },
  COST: {
    tr: "Üyelik tabanlı toptan perakendeci Costco — düşük marj, yüksek hacim ve üyelik gelirine dayalı sadakat modeliyle istikrarlı büyür.",
    en: "Costco, the membership warehouse retailer — steady growth on low margins, high volume and membership-fee loyalty.",
  },
  PG: {
    tr: "Günlük tüketim devi Procter & Gamble — Tide, Pampers, Gillette gibi markalarla ev bakımı, kişisel bakım ve hijyen kategorilerini kapsar.",
    en: "Procter & Gamble, the consumer-staples giant — home care, personal care and hygiene with brands like Tide, Pampers and Gillette.",
  },
  KO: {
    tr: "Dünyanın en büyük alkolsüz içecek şirketi Coca-Cola — gazlı içeceklerin yanında su, kahve, spor içecekleri ve şişeleme ortaklıkları ağı.",
    en: "Coca-Cola, the world's largest non-alcoholic beverage company — sodas plus water, coffee, sports drinks and a bottling partner network.",
  },
  DIS: {
    tr: "Eğlence devi Disney — film stüdyoları (Marvel, Pixar, Star Wars), tema parkları, ESPN ve Disney+ yayın platformunu kapsar.",
    en: "Disney, the entertainment giant — film studios (Marvel, Pixar, Star Wars), theme parks, ESPN and the Disney+ streaming platform.",
  },

  // ---- Enerji ve sanayi ----
  XOM: {
    tr: "ABD'nin en büyük petrol şirketi ExxonMobil — arama-üretimden rafinaj ve kimyasallara uzanır; Permian havzası ve Guyana ana büyüme alanları.",
    en: "ExxonMobil, the largest US oil company — from upstream to refining and chemicals; the Permian basin and Guyana drive growth.",
  },
  CVX: {
    tr: "Petrol ve doğalgaz devi Chevron — küresel üretim portföyü, rafinaj ve büyüyen düşük karbon yatırımlarını kapsar.",
    en: "Chevron, the oil and gas major — a global production portfolio, refining and growing low-carbon investments.",
  },
  CAT: {
    tr: "İş makinelerinin küresel lideri Caterpillar — inşaat ve maden ekipmanları, motorlar ve veri merkezleri için yedek güç sistemleri üretir.",
    en: "Caterpillar, the global leader in heavy machinery — construction and mining equipment, engines and backup power for data centers.",
  },
  BA: {
    tr: "Uçak üreticisi Boeing — ticari uçaklar (737, 787), savunma ve uzay sistemleri; Airbus ile küresel duopolün ABD kanadı.",
    en: "Boeing, the aircraft maker — commercial jets (737, 787), defense and space; the US half of the global duopoly with Airbus.",
  },
  GE: {
    tr: "GE Aerospace — dünyanın en büyük uçak motoru üreticisi; ticari ve askerî jet motorları ile bakım-servis ağını kapsar.",
    en: "GE Aerospace — the world's largest jet-engine maker, spanning commercial and military engines plus the service network.",
  },
  UBER: {
    tr: "Yolculuk ve teslimat platformu Uber — araç çağırma, Uber Eats ve lojistik (Freight); otonom araç ortaklıklarıyla robotaksi ağlarına açılıyor.",
    en: "Uber, the mobility and delivery platform — ride-hailing, Uber Eats and Freight; opening to robotaxi networks through AV partnerships.",
  },
};
