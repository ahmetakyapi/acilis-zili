/* ==========================================================================
   Küratörlü karşılaştırma çiftleri — `/karsilastir/[pair]`

   `/karsilastir?semboller=NVDA,AMD` her sembol çiftini zaten açıyor; bu
   dosya onun ÜSTÜNE, en çok aranan yirmi çift için kalıcı ve kendi
   künyesini taşıyan birer adres kuruyor. Sayfa aynı tahtayı çiziyor
   (`CompareBoard`), fark başlık ve kısa bir "neden bu ikisi" paragrafı.

   Slug ile sembol listesi ayrı tutuluyor, türetilmiyor: `brk.b` gibi
   noktalı bir sembol slug'da okunaksız olurdu ve sıra da editoryal
   (başlıkta hangi şirket önce anılıyorsa grafikte de ilk renk o).

   Sembol kuralı temalarla aynı: yalnızca sitenin sembol tablosunda duran
   semboller (28 Eylül 2026'da denetlendi). "meta-snap" gibi sık aranan
   çiftler SNAP tabloda olmadığı için yok. İki dil tek nesnede ve ikisi de
   zorunlu: çeviri unutulursa derleme kırılır.
   ========================================================================== */

import type { GuideSlug } from "@/content/guide/meta";

export type ComparePair = {
  slug: string;
  symbols: readonly string[];
  /** Başlıkta anılan adlar — marka adı, iki dilde aynı. */
  names: readonly string[];
  introTr: string;
  introEn: string;
  guides: readonly GuideSlug[];
};

export const COMPARE_PAIRS = [
  {
    slug: "spy-qqq",
    symbols: ["SPY", "QQQ"],
    names: ["SPY", "QQQ"],
    introTr:
      "SPY S&P 500'ü, QQQ Nasdaq 100'ü izliyor. İkincisi finans şirketlerini dışarıda bırakıyor ve teknolojiye çok daha ağırlıklı; iki fonun farkı büyük ölçüde teknoloji hisselerinin endeksin geri kalanından ne kadar ayrıştığını gösteriyor.",
    introEn:
      "SPY tracks the S&P 500 and QQQ the Nasdaq 100. The latter leaves out financial companies and is far more concentrated in technology, so the gap between the two largely shows how far tech stocks have pulled away from the rest of the index.",
    guides: ["endeks", "etf"],
  },
  {
    slug: "nvda-amd",
    symbols: ["NVDA", "AMD"],
    names: ["Nvidia", "AMD"],
    introTr:
      "İkisi de veri merkezi hızlandırıcısı ve grafik işlemcisi tasarlıyor, ikisi de üretimi TSMC'ye yaptırıyor. Nvidia yapay zekâ hızlandırıcılarında pazarın büyük bölümünü tutuyor; AMD aynı pazarda rakip ürünlerle ve sunucu işlemcileriyle büyüyor.",
    introEn:
      "Both design data-centre accelerators and graphics processors, and both have them made by TSMC. Nvidia holds most of the AI accelerator market; AMD is growing in the same market with rival products and with its server CPUs.",
    guides: ["degerleme", "volatilite"],
  },
  {
    slug: "aapl-msft",
    symbols: ["AAPL", "MSFT"],
    names: ["Apple", "Microsoft"],
    introTr:
      "Dünyanın en değerli şirketleri arasında yer alan iki teknoloji devi, iki farklı gelir modeli: Apple gelirinin çoğunu donanım satışından (başta iPhone) ve hizmetlerden, Microsoft ise kurumsal yazılım ve Azure bulut hizmetinden elde ediyor.",
    introEn:
      "Two of the world's most valuable companies with two different revenue models: Apple earns most of its revenue from hardware (the iPhone above all) and services, Microsoft from enterprise software and its Azure cloud.",
    guides: ["degerleme", "piyasa-degeri"],
  },
  {
    slug: "googl-msft",
    symbols: ["GOOGL", "MSFT"],
    names: ["Alphabet", "Microsoft"],
    introTr:
      "İkisi de bulutta (Google Cloud ve Azure) ve yapay zekâda doğrudan rakip. Alphabet'in gelirinin çoğu arama ve YouTube reklamından geliyor; Microsoft'un geliri ise kurumsal abonelik ağırlıklı, yani biri reklam döngüsüne, öteki şirket bütçelerine daha duyarlı.",
    introEn:
      "They compete head-on in cloud (Google Cloud and Azure) and in AI. Most of Alphabet's revenue comes from search and YouTube advertising, while Microsoft's is weighted to enterprise subscriptions, so one is more exposed to the ad cycle and the other to corporate budgets.",
    guides: ["degerleme", "sektor-rotasyonu"],
  },
  {
    slug: "meta-googl",
    symbols: ["META", "GOOGL"],
    names: ["Meta", "Alphabet"],
    introTr:
      "Dijital reklam pazarının iki büyük satıcısı. Meta gelirini Facebook, Instagram ve WhatsApp'taki reklamlardan, Alphabet arama ve YouTube reklamının yanında bulut hizmetinden elde ediyor; ikisi de yapay zekâ altyapısına büyük yatırım yapıyor.",
    introEn:
      "The two largest sellers of digital advertising. Meta earns its revenue from ads across Facebook, Instagram and WhatsApp; Alphabet from search and YouTube ads plus its cloud business. Both are investing heavily in AI infrastructure.",
    guides: ["degerleme", "nakit-akisi"],
  },
  {
    slug: "amzn-wmt",
    symbols: ["AMZN", "WMT"],
    names: ["Amazon", "Walmart"],
    introTr:
      "ABD perakendesinin iki devi, iki farklı başlangıç noktası: Amazon internetten mağazaya, Walmart mağazadan internete büyüdü. Amazon'un kârının büyük kısmı perakendeden değil AWS bulut hizmetinden geliyor; iki şirketin marjları bu yüzden çok farklı.",
    introEn:
      "The two giants of US retail from opposite starting points: Amazon grew from online into stores, Walmart from stores into online. A large share of Amazon's profit comes not from retail but from its AWS cloud, which is why the two companies' margins differ so much.",
    guides: ["bilanco", "degerleme"],
  },
  {
    slug: "cost-wmt",
    symbols: ["COST", "WMT"],
    names: ["Costco", "Walmart"],
    introTr:
      "İkisi de düşük fiyatla yüksek hacim satıyor. Costco kârının önemli bir kısmını üyelik ücretlerinden elde ediyor ve dar bir ürün yelpazesiyle çalışıyor; Walmart ise çok daha geniş bir mağaza ağına ve reklam ile internet satışı gibi yeni gelir kalemlerine dayanıyor.",
    introEn:
      "Both sell high volume at low prices. Costco earns a large part of its profit from membership fees and runs a narrow product range; Walmart relies on a far larger store network and on newer income such as advertising and online sales.",
    guides: ["degerleme", "bilanco"],
  },
  {
    slug: "ko-pep",
    symbols: ["KO", "PEP"],
    names: ["Coca-Cola", "PepsiCo"],
    introTr:
      "Yüz yılı aşkın rakipler, ama iş modelleri farklı: Coca-Cola neredeyse tamamen içecek şirketi ve şişelemeyi büyük ölçüde bağımsız ortaklara bırakıyor; PepsiCo'nun gelirinin önemli bir kısmı ise atıştırmalıklardan (Frito-Lay, Quaker) geliyor. İkisi de temettüsünü on yıllardır artırıyor.",
    introEn:
      "Rivals for over a century with different business models: Coca-Cola is almost purely a beverage company and leaves much of the bottling to independent partners, while a large share of PepsiCo's revenue comes from snacks (Frito-Lay, Quaker). Both have raised their dividend for decades.",
    guides: ["temettu", "degerleme"],
  },
  {
    slug: "v-ma",
    symbols: ["V", "MA"],
    names: ["Visa", "Mastercard"],
    introTr:
      "Kart ödeme ağlarının iki büyüğü. İkisi de kredi vermiyor, kredi riskini bankalar taşıyor; gelirleri ağlarından geçen işlem hacminden alınan küçük ücretler. İş modelleri o kadar benzer ki farkı çoğu zaman bölgesel ağırlık ve sınır ötesi işlem payı belirliyor.",
    introEn:
      "The two biggest card payment networks. Neither lends money; the banks carry the credit risk, and their revenue is small fees on the volume that passes through their networks. The models are so alike that the difference usually comes down to regional mix and the share of cross-border transactions.",
    guides: ["degerleme", "cesitlendirme"],
  },
  {
    slug: "jpm-bac",
    symbols: ["JPM", "BAC"],
    names: ["JPMorgan Chase", "Bank of America"],
    introTr:
      "ABD'nin en büyük iki bankası. İkisinin de gelirinde net faiz geliri büyük yer tutuyor, yani faiz patikası ikisini de etkiliyor; JPMorgan'ın yatırım bankacılığı ve işlem geliri daha ağırlıklı, Bank of America ise mevduat tabanına ve bireysel bankacılığa daha çok dayanıyor.",
    introEn:
      "The two largest US banks. Net interest income is a big part of both, so the path of rates matters to both; JPMorgan leans more on investment banking and trading, while Bank of America relies more on its deposit base and consumer banking.",
    guides: ["faiz-tahvil", "bilanco"],
  },
  {
    slug: "xom-cvx",
    symbols: ["XOM", "CVX"],
    names: ["ExxonMobil", "Chevron"],
    introTr:
      "ABD'nin iki büyük entegre petrol şirketi: aramadan üretime, rafineriden kimyasallara zincirin tamamında çalışıyorlar. Kârları petrol ve doğal gaz fiyatına bağlı; ikisi de nakit akışının önemli bir kısmını temettü ve hisse geri alımıyla hissedara dağıtıyor.",
    introEn:
      "The two large US integrated oil companies, working across the whole chain from exploration and production to refining and chemicals. Their profits follow oil and gas prices, and both return a large share of cash flow to shareholders through dividends and buybacks.",
    guides: ["temettu", "hisse-geri-alimi"],
  },
  {
    slug: "hd-low",
    symbols: ["HD", "LOW"],
    names: ["Home Depot", "Lowe's"],
    introTr:
      "Ev geliştirme perakendesinin iki büyüğü. Home Depot'nun satışlarında profesyonel müteahhitlerin payı daha yüksek; Lowe's daha çok bireysel müşteriye satıyor. İkisi de konut satışları ve mortgage faizine duyarlı.",
    introEn:
      "The two leaders in home-improvement retail. Professional contractors make up a larger share of Home Depot's sales, while Lowe's sells more to do-it-yourself customers. Both are sensitive to home sales and mortgage rates.",
    guides: ["faiz-tahvil", "temettu"],
  },
  {
    slug: "mcd-sbux",
    symbols: ["MCD", "SBUX"],
    names: ["McDonald's", "Starbucks"],
    introTr:
      "İkisi de küresel restoran zinciri ama gelir yapıları farklı: McDonald's restoranlarının büyük çoğunluğu franchise, yani gelirinin önemli kısmı kira ve lisans ücreti; Starbucks ise mağazalarının büyük kısmını kendisi işletiyor ve maliyetlerini doğrudan taşıyor.",
    introEn:
      "Both are global restaurant chains with different revenue structures: most McDonald's restaurants are franchised, so much of its revenue is rent and royalties, while Starbucks runs most of its stores itself and carries their costs directly.",
    guides: ["bilanco", "degerleme"],
  },
  {
    slug: "nflx-dis",
    symbols: ["NFLX", "DIS"],
    names: ["Netflix", "Disney"],
    introTr:
      "Yayın platformu yarışının iki cephesi. Netflix neredeyse tamamen abonelik ve reklam gelirine dayanıyor; Disney'in yayın hizmetlerinin yanında tema parkları, gemi turları ve spor kanalları da var, yani geliri çok daha çeşitli.",
    introEn:
      "Two fronts of the streaming race. Netflix relies almost entirely on subscription and advertising revenue; Disney also has theme parks, cruises and sports networks alongside its streaming services, so its revenue is far more diversified.",
    guides: ["degerleme", "cesitlendirme"],
  },
  {
    slug: "ups-fdx",
    symbols: ["UPS", "FDX"],
    names: ["UPS", "FedEx"],
    introTr:
      "ABD kargo ve lojistik pazarının iki büyüğü. İkisinin de hacmi ekonominin nabzını tutuyor: sanayi üretimi, perakende ve dış ticaret yavaşladığında taşınan paket azalıyor. Maliyet tarafında yakıt ve işçilik ikisini de benzer biçimde etkiliyor.",
    introEn:
      "The two leaders in US parcel delivery and logistics. Their volumes take the economy's pulse: when industrial output, retail and trade slow, fewer packages move. On the cost side, fuel and labour affect both in similar ways.",
    guides: ["sektor-rotasyonu", "bilanco"],
  },
  {
    slug: "crwd-panw",
    symbols: ["CRWD", "PANW"],
    names: ["CrowdStrike", "Palo Alto Networks"],
    introTr:
      "Siber güvenliğin iki büyük adı, iki farklı başlangıç: CrowdStrike uç nokta korumasıyla, Palo Alto Networks güvenlik duvarıyla büyüdü. Bugün ikisi de tek bir platformdan çok sayıda güvenlik ürünü satarak aynı müşterinin bütçesi için yarışıyor.",
    introEn:
      "Two big names in cybersecurity from different starting points: CrowdStrike grew from endpoint protection, Palo Alto Networks from firewalls. Today both sell many security products from a single platform and compete for the same customer budget.",
    guides: ["degerleme", "volatilite"],
  },
  {
    slug: "intc-amd",
    symbols: ["INTC", "AMD"],
    names: ["Intel", "AMD"],
    introTr:
      "Bilgisayar ve sunucu işlemcisinde on yıllardır süren rekabet. AMD fabrikasız çalışıyor ve üretimi TSMC'ye yaptırıyor; Intel ise hem kendi çiplerini tasarlıyor hem de kendi fabrikalarını işletiyor ve başka şirketlere üretim hizmeti sunmaya çalışıyor.",
    introEn:
      "A rivalry in PC and server processors that has run for decades. AMD is fabless and has its chips made by TSMC; Intel designs its own chips, runs its own fabs and is trying to sell manufacturing services to other companies.",
    guides: ["degerleme", "nakit-akisi"],
  },
  {
    slug: "tsm-intc",
    symbols: ["TSM", "INTC"],
    names: ["TSMC", "Intel"],
    introTr:
      "Çip üretiminin iki farklı modeli: TSMC yalnızca başkalarının tasarladığı çipleri üreten dünyanın en büyük sözleşmeli üreticisi; Intel ise kendi tasarımlarını kendi fabrikalarında üretiyor. TSMC'nin ana borsası Tayvan, ABD'de ADR olarak işlem görüyor; bazı ölçüleri bu yüzden Tayvan doları cinsinden.",
    introEn:
      "Two models of chip manufacturing: TSMC is the world's largest contract manufacturer and makes only chips others design, while Intel makes its own designs in its own fabs. TSMC's primary listing is in Taiwan and it trades in the US as an ADR, so some of its figures are in Taiwan dollars.",
    guides: ["kur-riski", "degerleme"],
  },
  {
    slug: "tsla-gm",
    symbols: ["TSLA", "GM"],
    names: ["Tesla", "General Motors"],
    introTr:
      "Otomotivin iki ucu: Tesla yalnızca elektrikli araç satıyor ve yazılım ile enerji depolama işleri de var; General Motors içten yanmalı araç satışlarıyla kâr ederken elektrikli modellerini büyütmeye çalışıyor. Piyasanın ikisine biçtiği değer farkı, satış adetleri arasındaki farktan çok daha büyük.",
    introEn:
      "Two ends of the car industry: Tesla sells only electric vehicles and also has software and energy-storage businesses, while General Motors earns its profit from combustion vehicles as it tries to grow its EV line. The gap between the values the market puts on them is far larger than the gap in unit sales.",
    guides: ["degerleme", "volatilite"],
  },
  {
    slug: "gs-ms",
    symbols: ["GS", "MS"],
    names: ["Goldman Sachs", "Morgan Stanley"],
    introTr:
      "Wall Street'in iki büyük yatırım bankası. Goldman Sachs'ın geliri işlem ve yatırım bankacılığına daha ağırlıklı; Morgan Stanley ise son yıllarda servet yönetimini büyüterek daha düzenli ücret gelirine yöneldi. Piyasa işlem hacmi ve birleşme-satın alma dalgaları ikisini de etkiliyor.",
    introEn:
      "Wall Street's two big investment banks. Goldman Sachs leans more on trading and investment banking; Morgan Stanley has shifted towards steadier fee income by growing its wealth-management business. Market trading volumes and merger waves affect both.",
    guides: ["bilanco", "volatilite"],
  },
] as const satisfies readonly ComparePair[];

export const COMPARE_PAIR_SLUGS: readonly string[] = COMPARE_PAIRS.map((pair) => pair.slug);

export function comparePairBySlug(slug: string): ComparePair | null {
  return COMPARE_PAIRS.find((pair) => pair.slug === slug) ?? null;
}
