/**
 * Şirket iş tanımları — takip evrenindeki semboller için elle yazılmış,
 * iki dilli kısa açıklamalar. Finnhub'ın ücretsiz profili tanım içermez;
 * bu metinler şirketin NE İŞ yaptığını ve hangi alanları kapsadığını anlatır.
 * Piyasa verisi değildir — istikrarlı kurumsal bilgidir, elle güncellenir.
 */

export type SymbolDescription = { tr: string; en: string };

/**
 * Sembolün tanıtımı — önce bu dosyadaki uzun anlatım, yoksa endeks
 * kapsamını tamamlayan `descriptions-sp500.ts` kaydı. İkisi de yoksa null:
 * uydurma metin üretilmez.
 */
export async function describeSymbol(
  symbol: string,
  locale: string,
): Promise<string | null> {
  const own = SYMBOL_DESCRIPTIONS[symbol];
  if (own) return locale === "tr" ? own.tr : own.en;
  const { SP500_DESCRIPTIONS } = await import("./descriptions-sp500");
  const extra = SP500_DESCRIPTIONS[symbol];
  if (extra) return locale === "tr" ? extra.tr : extra.en;
  return null;
}

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

  // ---- Ülke fonları (dünya piyasaları) ----
  EWJ: {
    tr: "Japonya borsasının büyük ve orta ölçekli şirketlerini tutan iShares MSCI Japonya fonu — Toyota, Sony, Mitsubishi UFJ, Hitachi ve Keyence gibi isimler en ağır kalemler. Nikkei 225 ve TOPIX ile aynı piyasayı temsil eder. ABD borsasında dolar cinsinden işlem gördüğü için fiyatına hem Tokyo'daki hisse hareketi hem de yen/dolar kuru yansır.",
    en: "iShares MSCI Japan holds the large- and mid-cap names of the Japanese market — Toyota, Sony, Mitsubishi UFJ, Hitachi and Keyence are among the heaviest weights. It represents the same market as the Nikkei 225 and TOPIX. Because it trades in US dollars on a US exchange, its price reflects both Tokyo share moves and the yen/dollar rate.",
  },
  EWY: {
    tr: "Güney Kore borsasını izleyen iShares MSCI Güney Kore fonu — Samsung Electronics ve SK Hynix tek başlarına fonun büyük bölümünü oluşturur; Hyundai, Naver ve Kia diğer ağır isimlerdir. KOSPI ile aynı piyasadır ve bellek çipi (DRAM/NAND) döngüsüne çok duyarlıdır: Kore endeksi çoğu zaman küresel yarı iletken talebinin erken göstergesi sayılır.",
    en: "iShares MSCI South Korea tracks the Korean market — Samsung Electronics and SK Hynix alone make up a large share of the fund, with Hyundai, Naver and Kia among the other big weights. It is the same market as the KOSPI and is highly sensitive to the memory-chip (DRAM/NAND) cycle, which makes it an early read on global semiconductor demand.",
  },
  TUR: {
    tr: "Borsa İstanbul'un büyük şirketlerini tutan iShares MSCI Türkiye fonu — bankalar, holdingler, havacılık ve perakende ağırlıkta; BIST 100 ile aynı piyasadır. Dolar cinsinden işlem görür, bu yüzden getirisi TL'deki hisse hareketinden çok kur farkını da içerir: BIST 100 TL'de yükselirken TL değer kaybederse bu fon geride kalabilir.",
    en: "iShares MSCI Türkiye holds the large caps of Borsa İstanbul — banks, holding companies, aviation and retail carry the most weight; the same market as the BIST 100. It trades in dollars, so its return blends share moves in lira with the currency: if the BIST 100 rises in lira while the lira weakens, the fund can lag.",
  },
  MCHI: {
    tr: "Çin hisselerini kapsayan iShares MSCI Çin fonu — Tencent, Alibaba, Xiaomi, Meituan ve PDD en ağır isimler. Hong Kong'da işlem gören H-hisseleri ve ABD'de kote Çin şirketleri ile anakaradaki A-hisselerini bir arada tutar; internet ve tüketim tarafı, düzenleyici kararlara ve iç talep verilerine hızlı tepki verir.",
    en: "iShares MSCI China spans Chinese equities — Tencent, Alibaba, Xiaomi, Meituan and PDD are the heaviest names. It combines Hong Kong–listed H-shares and US-listed Chinese companies with mainland A-shares; the internet and consumer side reacts quickly to regulatory decisions and domestic demand data.",
  },
  EWG: {
    tr: "Almanya borsasını izleyen iShares MSCI Almanya fonu — SAP, Siemens, Allianz, Deutsche Telekom ve Munich Re en büyük kalemler; DAX ile aynı piyasadır. Alman endeksi ihracat ağırlıklı bir sanayi ekonomisini yansıtır: otomotiv, makine ve kimya kalemleri küresel büyüme ile enerji fiyatlarına duyarlıdır.",
    en: "iShares MSCI Germany tracks the German market — SAP, Siemens, Allianz, Deutsche Telekom and Munich Re are the largest holdings; the same market as the DAX. The German index reflects an export-heavy industrial economy: autos, machinery and chemicals move with global growth and energy prices.",
  },
  INDA: {
    tr: "Hindistan borsasının büyük şirketlerini tutan iShares MSCI Hindistan fonu — Reliance Industries, HDFC Bank, ICICI Bank, Infosys ve TCS ağırlıkta; Sensex ve Nifty 50 ile aynı piyasadır. Finans ve bilişim hizmetleri fonun omurgasını oluşturur; iç tüketim büyümesi bu endeksin ana hikâyesidir.",
    en: "iShares MSCI India holds the large caps of the Indian market — Reliance Industries, HDFC Bank, ICICI Bank, Infosys and TCS carry the most weight; the same market as the Sensex and Nifty 50. Financials and IT services form the fund's backbone, with domestic consumption growth the central story.",
  },

  // ---- Yapay zekâ ve yarı iletken ----
  SPCX: {
    tr: "Fırlatma araçları ve uydu internet şirketi — yeniden kullanılabilir Falcon roketleri, Starship programı ve Starlink uydu ağını kapsar. Haziran 2026'da halka açıldı; gelirinin büyük kısmı Starlink aboneliklerinden ve devlet fırlatma sözleşmelerinden gelir.",
    en: "Launch vehicle and satellite internet company — reusable Falcon rockets, the Starship program and the Starlink satellite network. Went public in June 2026; most revenue comes from Starlink subscriptions and government launch contracts.",
  },
  SKHY: {
    tr: "Güney Koreli bellek çipi üreticisi — DRAM ve NAND flash üretir; yapay zekâ hızlandırıcılarında kullanılan yüksek bant genişlikli bellekte (HBM) önde gelen tedarikçidir. Temmuz 2026'da Nasdaq'ta ADR olarak listelendi; asıl kotasyonu Kore borsasındadır.",
    en: "South Korean memory chipmaker — produces DRAM and NAND flash, and is a leading supplier of high-bandwidth memory (HBM) used in AI accelerators. Listed on Nasdaq as an ADR in July 2026; its primary listing remains in Korea.",
  },
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

  // ---- İlk 100 kapsaması: takip evreni dışındaki büyük şirketler ----
  HD: {
    tr: "ABD'nin en büyük yapı market zinciri Home Depot — ev geliştirme, inşaat malzemesi ve profesyonel müteahhit tedariki; konut piyasasının nabzı sayılır.",
    en: "Home Depot, the largest US home-improvement retailer — building materials and pro-contractor supply; read as a pulse of the housing market.",
  },
  PEP: {
    tr: "İçecek ve atıştırmalık devi PepsiCo — Pepsi'nin yanında Lay's, Doritos, Gatorade ve Quaker markalarıyla gıdanın geniş bir bölümünü kapsar.",
    en: "PepsiCo, the beverage and snacks giant — Pepsi plus Lay's, Doritos, Gatorade and Quaker span a broad slice of food.",
  },
  TMO: {
    tr: "Laboratuvar ekipmanı ve bilimsel cihaz lideri Thermo Fisher — ilaç geliştirme, tanı ve araştırma laboratuvarlarının ana tedarikçisi.",
    en: "Thermo Fisher, leader in lab equipment and scientific instruments — the key supplier to drug development, diagnostics and research labs.",
  },
  LIN: {
    tr: "Dünyanın en büyük endüstriyel gaz şirketi Linde — oksijen, azot, hidrojen üretimi; sanayi, sağlık ve temiz enerji projelerini besler.",
    en: "Linde, the world's largest industrial-gas company — oxygen, nitrogen and hydrogen feeding industry, healthcare and clean energy.",
  },
  ACN: {
    tr: "Küresel danışmanlık ve BT hizmetleri devi Accenture — dijital dönüşüm, bulut geçişi ve kurumsal yapay zekâ uygulamaları.",
    en: "Accenture, the global consulting and IT-services giant — digital transformation, cloud migration and enterprise AI adoption.",
  },
  CSCO: {
    tr: "Ağ donanımının köklü lideri Cisco — kurumsal ağ anahtarları, güvenlik ve Splunk ile gözlemlenebilirlik; yapay zekâ veri merkezi ağlarına genişliyor.",
    en: "Cisco, the veteran of networking — enterprise switching, security and observability with Splunk, expanding into AI data-center networks.",
  },
  WFC: {
    tr: "ABD'nin dört büyük bankasından Wells Fargo — bireysel ve ticari bankacılıkta geniş şube ağı; mortgage'ın köklü oyuncusu.",
    en: "Wells Fargo, one of the US big four banks — broad retail and commercial branch network, a longtime mortgage player.",
  },
  MCD: {
    tr: "Dünyanın en büyük restoran zinciri McDonald's — franchise ağırlıklı modeliyle gayrimenkul ve lisans geliri üretir.",
    en: "McDonald's, the world's largest restaurant chain — a franchise-heavy model generating real-estate and licensing income.",
  },
  ABT: {
    tr: "Sağlık ürünleri devi Abbott — tanı testleri, tıbbi cihazlar (FreeStyle Libre), beslenme ürünleri ve jenerik ilaçlar.",
    en: "Abbott, the healthcare products giant — diagnostics, medical devices (FreeStyle Libre), nutrition and branded generics.",
  },
  INTU: {
    tr: "Finansal yazılım şirketi Intuit — TurboTax (vergi), QuickBooks (KOBİ muhasebesi) ve Credit Karma ile bireysel finans.",
    en: "Intuit, the financial-software company — TurboTax, QuickBooks for small business, and Credit Karma in consumer finance.",
  },
  AXP: {
    tr: "American Express — premium kredi kartı ağı; kart ihraç eden, işlem işleyen ve üye kulübü işleten kapalı devre model.",
    en: "American Express — the premium card network; a closed-loop model issuing cards, processing payments and running membership perks.",
  },
  VZ: {
    tr: "ABD'nin en büyük telekom operatörlerinden Verizon — mobil ve fiber ağ; istikrarlı temettüsüyle bilinir.",
    en: "Verizon, one of the largest US telecom carriers — mobile and fiber networks, known for its steady dividend.",
  },
  MS: {
    tr: "Yatırım bankası Morgan Stanley — piyasa işlemleri ve halka arzların yanında E*Trade ile bireysel, dev varlık yönetimi koluyla kurumsal tasarruf.",
    en: "Morgan Stanley — trading and underwriting plus E*Trade retail broking and a giant wealth-management arm.",
  },
  PM: {
    tr: "Philip Morris International — Marlboro'nun ABD dışı hakları; IQOS ve ZYN ile dumansız ürünlere dönüşüyor.",
    en: "Philip Morris International — Marlboro outside the US, transitioning to smoke-free products with IQOS and ZYN.",
  },
  ISRG: {
    tr: "Cerrahi robotiğin öncüsü Intuitive Surgical — da Vinci robotlarıyla minimal invaziv cerrahinin standardını koyar; gelirin çoğu sarf malzemesinden.",
    en: "Intuitive Surgical, the surgical-robotics pioneer — da Vinci systems set the standard, with most revenue from instruments and accessories.",
  },
  NEE: {
    tr: "ABD'nin en büyük elektrik şirketi NextEra — Florida'da düzenlenmiş şebeke + ülkenin en büyük rüzgâr/güneş portföyü; veri merkezi talebinin ana tedarikçilerinden.",
    en: "NextEra, the largest US utility — a regulated Florida grid plus the country's biggest wind/solar fleet, a key supplier to data-center demand.",
  },
  RTX: {
    tr: "Savunma ve havacılık devi RTX — Patriot füze sistemleri (Raytheon), uçak motorları (Pratt & Whitney) ve haberleşme (Collins).",
    en: "RTX, the defense and aerospace giant — Patriot missiles (Raytheon), jet engines (Pratt & Whitney) and avionics (Collins).",
  },
  CMCSA: {
    tr: "Medya ve geniş bant devi Comcast — Xfinity internet, NBCUniversal stüdyoları, tema parkları ve Peacock yayın platformu.",
    en: "Comcast, the media and broadband giant — Xfinity internet, NBCUniversal studios, theme parks and the Peacock streaming service.",
  },
  T: {
    tr: "Telekom operatörü AT&T — medya maceralarını geride bırakıp mobil ve fiber ağa odaklandı; yüksek temettüyle bilinir.",
    en: "AT&T — refocused on mobile and fiber after exiting media, known for its high dividend.",
  },
  AMGN: {
    tr: "Biyoteknolojinin öncülerinden Amgen — kemik, onkoloji ve bağışıklık ilaçları; obezite programıyla yeni büyüme arıyor.",
    en: "Amgen, a biotech pioneer — bone, oncology and inflammation drugs, seeking new growth in obesity.",
  },
  HON: {
    tr: "Çeşitlendirilmiş sanayi devi Honeywell — havacılık sistemleri, bina otomasyonu, enerji teknolojileri ve endüstriyel yazılım.",
    en: "Honeywell, the diversified industrial — aerospace systems, building automation, energy tech and industrial software.",
  },
  PFE: {
    tr: "İlaç devi Pfizer — aşılar, onkoloji ve iç hastalıkları portföyü; COVID sonrası boru hattını onkolojiyle (Seagen) yeniliyor.",
    en: "Pfizer — vaccines, oncology and internal medicine; rebuilding its post-COVID pipeline around oncology (Seagen).",
  },
  UNP: {
    tr: "ABD'nin en büyük demiryolu şirketi Union Pacific — batı ABD'nin yük taşımacılığı omurgası; tahıl, kimyasal ve konteyner taşır.",
    en: "Union Pacific, the largest US railroad — the freight backbone of the western US, hauling grain, chemicals and containers.",
  },
  LOW: {
    tr: "İkinci büyük yapı market zinciri Lowe's — ev geliştirme perakendesinde Home Depot'nun ana rakibi.",
    en: "Lowe's, the second-largest home-improvement chain — Home Depot's main rival.",
  },
  BLK: {
    tr: "Dünyanın en büyük varlık yöneticisi BlackRock — iShares ETF'leri ve Aladdin risk platformuyla 10 trilyon doların üzerinde varlık yönetir.",
    en: "BlackRock, the world's largest asset manager — over $10T via iShares ETFs and the Aladdin risk platform.",
  },
  COP: {
    tr: "Bağımsız petrol üreticisi ConocoPhillips — kıta ABD şeyl havzaları, Alaska ve LNG projelerinde üretim odaklı model.",
    en: "ConocoPhillips, the independent oil producer — US shale, Alaska and LNG, a pure upstream model.",
  },
  SPGI: {
    tr: "S&P Global — kredi derecelendirme, S&P 500 dahil endeksler ve piyasa verisi/analitiği; finansın altyapı sağlayıcısı.",
    en: "S&P Global — credit ratings, indices including the S&P 500, and market data/analytics; financial infrastructure.",
  },
  BKNG: {
    tr: "Çevrimiçi seyahatin devi Booking Holdings — Booking.com, Priceline, Kayak ve OpenTable ile konaklamadan restorana rezervasyon.",
    en: "Booking Holdings, the online-travel giant — Booking.com, Priceline, Kayak and OpenTable from stays to dining.",
  },
  ETN: {
    tr: "Güç yönetimi şirketi Eaton — elektrik şebekeleri, veri merkezi güç altyapısı ve havacılık hidroliği; elektrifikasyon dalgasının ana oyuncusu.",
    en: "Eaton, the power-management company — grids, data-center power infrastructure and aerospace hydraulics; a key electrification play.",
  },
  SYK: {
    tr: "Tıbbi cihaz üreticisi Stryker — ortopedik implantlar, cerrahi ekipman ve Mako ameliyat robotları.",
    en: "Stryker, the medical-device maker — orthopedic implants, surgical equipment and Mako surgical robots.",
  },
  PGR: {
    tr: "Otomobil sigortasının teknoloji lideri Progressive — kullanım bazlı fiyatlama (Snapshot) ile en hızlı büyüyen büyük sigortacı.",
    en: "Progressive, the tech leader in auto insurance — usage-based pricing (Snapshot) drives the fastest growth among majors.",
  },
  ANET: {
    tr: "Veri merkezi ağlarının lideri Arista Networks — hyperscaler'ların ve yapay zekâ kümelerinin yüksek hızlı ethernet anahtarları.",
    en: "Arista Networks, the data-center networking leader — high-speed ethernet switching for hyperscalers and AI clusters.",
  },
  TJX: {
    tr: "İndirimli perakendenin devi TJX — TJ Maxx ve Marshalls ile marka ürünleri düşük fiyata satan 'define avı' modeli.",
    en: "TJX, the off-price retail giant — the treasure-hunt model of TJ Maxx and Marshalls selling brands at a discount.",
  },
  BSX: {
    tr: "Tıbbi cihaz şirketi Boston Scientific — kalp ritim cihazları, kateterler ve Watchman implantıyla kardiyolojide hızlı büyüyen oyuncu.",
    en: "Boston Scientific — cardiac rhythm devices, catheters and the Watchman implant; a fast grower in cardiology.",
  },
  LMT: {
    tr: "Dünyanın en büyük savunma şirketi Lockheed Martin — F-35 savaş uçağı, füze savunması ve uzay sistemleri.",
    en: "Lockheed Martin, the world's largest defense contractor — the F-35, missile defense and space systems.",
  },
  DHR: {
    tr: "Bilim ve teknoloji holdingi Danaher — biyoproses ekipmanları, yaşam bilimi araçları ve tanı sistemleri; ilaç üretiminin tedarikçisi.",
    en: "Danaher, the science and technology holding — bioprocessing, life-science tools and diagnostics supplying drug manufacturing.",
  },
  ADP: {
    tr: "Bordro ve İK hizmetlerinin devi ADP — ABD'de on milyonlarca çalışanın maaşını işler; istihdam verisinin de kaynağıdır (ADP raporu).",
    en: "ADP, the payroll and HR giant — processes pay for tens of millions of US workers and produces the ADP employment report.",
  },
  VRTX: {
    tr: "Biyoteknoloji şirketi Vertex — kistik fibrozis tedavilerinde tekel konumda; gen düzenleme (Casgevy) ve ağrı ilaçlarına genişliyor.",
    en: "Vertex, the biotech — a near-monopoly in cystic fibrosis, expanding into gene editing (Casgevy) and pain.",
  },
  C: {
    tr: "Küresel banka Citigroup — kurumsal bankacılık ve hazine hizmetlerinde güçlü; büyük bir yeniden yapılanmanın içinde.",
    en: "Citigroup, the global bank — strong in corporate banking and treasury services, amid a major restructuring.",
  },
  SCHW: {
    tr: "Aracı kurumların devi Charles Schwab — komisyonsuz alım satım, varlık yönetimi ve bankacılık; milyonlarca bireysel yatırımcının platformu.",
    en: "Charles Schwab, the brokerage giant — commission-free trading, wealth management and banking for millions of retail investors.",
  },
  MDT: {
    tr: "Dünyanın en büyük tıbbi cihaz üreticilerinden Medtronic — kalp pilleri, insülin pompaları ve cerrahi teknolojiler.",
    en: "Medtronic, among the largest medical-device makers — pacemakers, insulin pumps and surgical technologies.",
  },
  BX: {
    tr: "Alternatif varlık yönetiminin devi Blackstone — özel sermaye, gayrimenkul, kredi ve altyapı fonlarında 1 trilyon doları aşkın varlık.",
    en: "Blackstone, the alternative-assets giant — over $1T across private equity, real estate, credit and infrastructure.",
  },
  SBUX: {
    tr: "Dünyanın en büyük kahve zinciri Starbucks — mağaza ağı, sadakat programı ve Çin pazarı büyümenin ana eksenleri.",
    en: "Starbucks, the world's largest coffee chain — stores, the loyalty program and China are the growth axes.",
  },
  GILD: {
    tr: "Biyoteknoloji şirketi Gilead — HIV tedavilerinin lideri; onkoloji ve uzun etkili HIV korumasıyla (lenacapavir) büyüyor.",
    en: "Gilead, the biotech — leader in HIV therapy, growing in oncology and long-acting HIV prevention (lenacapavir).",
  },
  BMY: {
    tr: "İlaç şirketi Bristol Myers Squibb — onkoloji (Opdivo), kardiyoloji ve immünoloji; patent uçurumunu yeni ilaçlarla dengeliyor.",
    en: "Bristol Myers Squibb — oncology (Opdivo), cardiology and immunology, offsetting patent cliffs with new launches.",
  },
  DE: {
    tr: "Tarım makinelerinin devi John Deere — traktörler, hasat makineleri ve otonom tarım teknolojileri; hassas tarımın öncüsü.",
    en: "John Deere, the farm-machinery giant — tractors, harvesters and autonomous farming; the precision-agriculture pioneer.",
  },
  MO: {
    tr: "Altria — Marlboro'nun ABD hakları; sigara hacmi düşerken fiyatlama ve dumansız ürünlerle nakit üretir, yüksek temettü öder.",
    en: "Altria — Marlboro in the US; generates cash via pricing and smoke-free products as volumes decline, paying a high dividend.",
  },
  SO: {
    tr: "Güneydoğu ABD'nin elektrik şirketi Southern Company — düzenlenmiş şebekeler ve Vogtle nükleer santralleri; veri merkezi talebinden yararlanıyor.",
    en: "Southern Company, the Southeast US utility — regulated grids and the Vogtle nuclear units, benefiting from data-center demand.",
  },
  ICE: {
    tr: "Borsa işletmecisi Intercontinental Exchange — NYSE'nin sahibi; enerji vadeli işlemleri ve mortgage teknolojisi platformları.",
    en: "Intercontinental Exchange — owner of the NYSE; energy futures and mortgage-technology platforms.",
  },
  CME: {
    tr: "Dünyanın en büyük türev borsası CME Group — faiz, endeks, döviz ve emtia vadeli işlemleri; piyasa oynaklığından gelir üretir.",
    en: "CME Group, the world's largest derivatives exchange — rates, index, FX and commodity futures; volatility drives revenue.",
  },
  EQIX: {
    tr: "Veri merkezi GYO'su Equinix — şirketlerin ve bulutların birbirine bağlandığı 250+ veri merkezi; dijital altyapının kavşağı.",
    en: "Equinix, the data-center REIT — 250+ facilities where enterprises and clouds interconnect; the crossroads of digital infrastructure.",
  },
  SHW: {
    tr: "Boya devi Sherwin-Williams — Kuzey Amerika'nın en büyük boya üreticisi ve mağaza zinciri; konut ve sanayi döngüsünü izler.",
    en: "Sherwin-Williams, the paint giant — North America's largest coatings maker and store chain, tracking housing and industry.",
  },
  CDNS: {
    tr: "Çip tasarım yazılımı (EDA) lideri Cadence — Synopsys ile duopol; her modern çip bu araçlarla tasarlanır.",
    en: "Cadence, an EDA leader — a duopoly with Synopsys; every modern chip is designed with these tools.",
  },
  SNPS: {
    tr: "Çip tasarım yazılımının (EDA) diğer devi Synopsys — tasarım araçları ve IP blokları; Ansys ile simülasyona genişledi.",
    en: "Synopsys, the other EDA giant — design tools and IP blocks, expanded into simulation with Ansys.",
  },
  ZTS: {
    tr: "Hayvan sağlığının lideri Zoetis — evcil hayvan ve çiftlik hayvanı ilaçları ile aşıları; Pfizer'dan ayrılan istikrarlı büyüme hikâyesi.",
    en: "Zoetis, the animal-health leader — pet and livestock medicines and vaccines; a steady grower spun off from Pfizer.",
  },
};
