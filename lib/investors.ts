/**
 * Ünlü yatırımcılar — listenin TEK kaynağı (28 Eylül).
 *
 * Sayfalar, senkron, site haritası ve hisse sayfasının paneli buradan
 * okuyor. Saf modül: veritabanı ya da Next içe aktarmıyor, senkron betiği
 * (`scripts/sync-investors.ts`) de aynı listeyi kullanıyor.
 *
 * İKİ TÜR. `13f`: kurumsal yöneticinin çeyreklik SEC bildirimi — dönem
 * sonundaki uzun pozisyonlar, iki dönemin farkı alım/satım. `congress`:
 * Kongre üyesinin işlem bildirimi (PTR) — tekil işlemler, tutar ARALIK
 * olarak. İkisi aynı ekranda aynı dilde anlatılamaz; kartları da sayfaları
 * da ayrı.
 *
 * CIK SIRASI TERCİH SIRASI. Bir dönem için birden çok CIK asıl bildirim
 * vermişse listede ÖNCE gelen kazanır. Ackman'ın fonu 2026 2. çeyrekten
 * itibaren Pershing Square Inc. (2026053) adıyla bildiriyor; eski CIK
 * (1336528) o dönem için 13F-NT verdi ("pozisyonları başka yönetici
 * bildiriyor"). Yeni CIK geriye doğru dört dönem daha bildirmiş ama o
 * dosyalarda YALNIZCA şirketin kendi Howard Hughes payı var (tek satır,
 * ~0,6 Mr $; ölçüldü 28 Eylül) — fonun portföyü o dönemlerde eski CIK'te.
 * "Çakışan dönemde yeni CIK" kuralı Ackman'ı 2025 boyunca tek hisseli
 * gösterir ve 2026 2. çeyrekte on üç "yeni alım" uydururdu. Bu yüzden eski
 * CIK önde: yeni CIK yalnızca eski CIK'in asıl bildirim vermediği dönemde
 * (2026 2. çeyrek ve sonrası) okunuyor.
 */

export type InvestorKind = "13f" | "congress";

export type Investor = {
  slug: string;
  name: string;
  /** Kuruluşun adı — marka, çevrilmez. Kurum değilse `firmEn` İngilizcesi. */
  firm: string;
  firmEn?: string;
  kind: InvestorKind;
  /** Tercih sırasıyla. `congress` türünde boş. */
  ciks: readonly number[];
  /** Kongre bildirimlerindeki soyadı/ad (yalnızca `congress`). */
  house?: { last: string; first: string };
  /**
   * Durum: "closed" fon kapandı ve bir daha bildirim gelmeyecek. Ekran o
   * yatırımcıda "bu çeyrek aldı" gibi güncel bir dil kullanmıyor.
   */
  status?: "closed";
  tagline: { tr: string; en: string };
};

/* --------------------------------------------------------------------------
   Portreler — belgeli istisna (28 Eylül)

   CLAUDE.md "Fotoğraf yok" diyor ve gerekçesi TELİF: yazıların görseli
   metinden çiziliyor, hiçbir yerde başkasının görseli barındırılmıyor. Bu
   ekranda istisna var ve kuralın gerekçesini çiğnemiyor:

     - Yalnızca ÖZGÜR LİSANSLI dosyalar: Wikimedia Commons'ta kamu malı
       (ABD hükümeti eseri), CC0, CC BY ya da CC BY-SA. Lisans her dosyanın
       Commons sayfasında tek tek okundu (28 Eylül). "Adil kullanım" dosyası,
       haber ajansı ya da kurum sitesi görseli YOK.
     - YERELDE barındırılıyor (`public/investors/{slug}.webp`, kare, ≤ 480
       piksel); uzaktan bağlantı yok.
     - ATIF detay sayfasının künyesinde: "Fotoğraf: {yazar} · {lisans}",
       kaynak ve lisans bağlantılı. Dosya kırpılıp küçültüldü; BY ve BY-SA
       bunu belirtmeyi istiyor, künye "Kırpıldı" diyor. BY-SA dosyaların
       kırpılmış hâli de aynı lisansla.

   Özgür lisanslı fotoğrafı BULUNAMAYAN kişi için fotoğraf uydurulmuyor,
   üretilmiyor: baş harf karosu çiziliyor (components/investors/Portrait).
   Carl Icahn'ın Commons'taki tek portresi 1980'lerden, "kendi eseri" CC0
   beyanıyla yüklenmiş; kırk yıllık bir fotoğrafın yükleyenin eseri olduğu
   doğrulanamadığı için kullanılmadı.
   -------------------------------------------------------------------------- */

export type PortraitCredit = {
  /** `public/investors/` altındaki dosya. */
  src: string;
  author: string;
  /** "Kamu Malı" · "CC BY 2.0" … */
  license: string;
  /** Lisans metni; kamu malında dosyanın Commons sayfası. */
  licenseUrl: string;
  /** Dosyanın Commons sayfası. */
  source: string;
};

const PORTRAITS: Record<string, PortraitCredit> = {
  "warren-buffett": {
    src: "/investors/warren-buffett.webp",
    author: "USA International Trade Administration",
    license: "Public Domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/File:Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_(cropped).jpg",
    source: "https://commons.wikimedia.org/wiki/File:Warren_Buffett_at_the_2015_SelectUSA_Investment_Summit_(cropped).jpg",
  },
  "nancy-pelosi": {
    src: "/investors/nancy-pelosi.webp",
    author: "John Harrington · speaker.gov",
    license: "Public Domain",
    licenseUrl: "https://commons.wikimedia.org/wiki/File:Official_photo_of_Speaker_Nancy_Pelosi_in_2019.jpg",
    source: "https://commons.wikimedia.org/wiki/File:Official_photo_of_Speaker_Nancy_Pelosi_in_2019.jpg",
  },
  "bill-ackman": {
    src: "/investors/bill-ackman.webp",
    author: "Senate Democrats",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:Valeant_Pharmaceuticals%27_Business_Model_(headshot).jpg",
  },
  "david-tepper": {
    src: "/investors/david-tepper.webp",
    author: "Appaloosa Management",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:David_Tepper_01.jpg",
  },
  "cathie-wood": {
    src: "/investors/cathie-wood.webp",
    author: "Caroline Wood",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:Cathie_Wood_ARK_Invest_Photo.jpg",
  },
  "seth-klarman": {
    src: "/investors/seth-klarman.webp",
    author: "Maryland GovPics",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:Seth_Klarman_at_147th_Preakness_Stakes.jpg",
  },
  "ray-dalio": {
    src: "/investors/ray-dalio.webp",
    author: "Web Summit",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:Web_Summit_2018_-_Forum_-_Day_2,_November_7_HM1_7481_(44858045925).jpg",
  },
  "howard-marks": {
    src: "/investors/howard-marks.webp",
    author: "kellywritershouse",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:Howard_Marks_2.17.12_(cropped).jpg",
  },
};

export function investorPortrait(slug: string): PortraitCredit | null {
  return PORTRAITS[slug] ?? null;
}

/** Baş harf karosunun harfleri: "Stanley Druckenmiller" → "SD". */
export function investorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("tr-TR");
}

export const INVESTORS: readonly Investor[] = [
  {
    slug: "warren-buffett",
    name: "Warren Buffett",
    firm: "Berkshire Hathaway",
    kind: "13f",
    ciks: [1067983],
    tagline: {
      tr: "Onlarca yıldır az sayıda büyük şirketi uzun süre tutan değer yatırımının simgesi.",
      en: "The emblem of value investing, holding a few large companies for decades.",
    },
  },
  {
    slug: "nancy-pelosi",
    name: "Nancy Pelosi",
    firm: "ABD Temsilciler Meclisi",
    firmEn: "U.S. House of Representatives",
    kind: "congress",
    ciks: [],
    house: { last: "Pelosi", first: "Nancy" },
    tagline: {
      tr: "Eşi Paul Pelosi adına bildirilen büyük teknoloji alımları ve opsiyonlarıyla en çok izlenen Kongre üyesi.",
      en: "The most watched member of Congress, for large tech purchases and options reported on behalf of her husband Paul Pelosi.",
    },
  },
  {
    slug: "michael-burry",
    name: "Michael Burry",
    firm: "Scion Asset Management",
    kind: "13f",
    ciks: [1649339],
    status: "closed",
    tagline: {
      tr: "2008 konut krizini önceden gören, yoğun ve aykırı pozisyonlarıyla bilinen yönetici.",
      en: "The manager who foresaw the 2008 housing crash, known for concentrated contrarian bets.",
    },
  },
  {
    slug: "bill-ackman",
    name: "Bill Ackman",
    firm: "Pershing Square",
    kind: "13f",
    ciks: [1336528, 2026053],
    tagline: {
      tr: "Bir avuç şirkete yoğunlaşan, yönetime seslenmekten çekinmeyen aktivist yatırımcı.",
      en: "An activist investor who concentrates on a handful of companies and speaks up to management.",
    },
  },
  {
    slug: "stanley-druckenmiller",
    name: "Stanley Druckenmiller",
    firm: "Duquesne Family Office",
    kind: "13f",
    ciks: [1536411],
    tagline: {
      tr: "Makro görüşünü hisse seçimine çeviren, pozisyonlarını hızla değiştiren efsanevi yönetici.",
      en: "A legendary manager who turns macro views into stock picks and moves positions quickly.",
    },
  },
  {
    slug: "david-tepper",
    name: "David Tepper",
    firm: "Appaloosa",
    kind: "13f",
    ciks: [1656456],
    tagline: {
      tr: "Kriz dönemlerinde cesur alımlarıyla tanınan, büyük teknoloji ağırlıklı fon yöneticisi.",
      en: "A fund manager known for bold buying in crises, with a portfolio weighted to big tech.",
    },
  },
  {
    slug: "cathie-wood",
    name: "Cathie Wood",
    firm: "ARK Investment Management",
    kind: "13f",
    ciks: [1697748],
    tagline: {
      tr: "Yapay zekâ, genom ve otonom araç gibi yıkıcı yeniliklere odaklanan ETF'lerin yöneticisi.",
      en: "Runs ETFs focused on disruptive innovation such as AI, genomics and autonomous vehicles.",
    },
  },
  {
    slug: "seth-klarman",
    name: "Seth Klarman",
    firm: "Baupost Group",
    kind: "13f",
    ciks: [1061768],
    tagline: {
      tr: "Güvenlik marjı ilkesiyle bilinen, sabırlı ve nakit tutmaktan çekinmeyen değer yatırımcısı.",
      en: "A patient value investor known for the margin of safety and a willingness to hold cash.",
    },
  },
  {
    slug: "li-lu",
    name: "Li Lu",
    firm: "Himalaya Capital",
    kind: "13f",
    ciks: [1709323],
    tagline: {
      tr: "Charlie Munger'ın güvendiği, çok az hisseye yoğunlaşan uzun vadeli yatırımcı.",
      en: "A long-term investor trusted by Charlie Munger, concentrated in very few stocks.",
    },
  },
  {
    slug: "terry-smith",
    name: "Terry Smith",
    firm: "Fundsmith",
    kind: "13f",
    ciks: [1569205],
    tagline: {
      tr: "\"İyi şirketi al, fazla ödeme, hiçbir şey yapma\" ilkesiyle kalite hisselerini tutan İngiliz yönetici.",
      en: "A British manager holding quality stocks by the rule \"buy good companies, don't overpay, do nothing\".",
    },
  },
  {
    slug: "leopold-aschenbrenner",
    name: "Leopold Aschenbrenner",
    firm: "Situational Awareness LP",
    kind: "13f",
    ciks: [2045724],
    tagline: {
      tr: "Yapay zekânın enerji ve çip talebine yatırım yapan, OpenAI kökenli genç yönetici.",
      en: "A young former OpenAI researcher investing in the power and chip demand of AI.",
    },
  },
  {
    slug: "carl-icahn",
    name: "Carl Icahn",
    firm: "Icahn Enterprises",
    kind: "13f",
    ciks: [921669],
    tagline: {
      tr: "Yönetim kurullarına baskı kurmasıyla ünlü, aktivist yatırımın öncülerinden.",
      en: "A pioneer of activist investing, famous for pressuring corporate boards.",
    },
  },
  {
    slug: "ray-dalio",
    name: "Ray Dalio",
    firm: "Bridgewater Associates",
    kind: "13f",
    ciks: [1350694],
    tagline: {
      tr: "Dünyanın en büyük hedge fonunu kuran, yüzlerce hisseye yayılan makro yatırımcı.",
      en: "Founder of the world's largest hedge fund, a macro investor spread across hundreds of stocks.",
    },
  },
  {
    slug: "howard-marks",
    name: "Howard Marks",
    firm: "Oaktree Capital",
    kind: "13f",
    ciks: [949509],
    tagline: {
      tr: "Piyasa döngüleri üzerine notlarıyla bilinen, sıkıntılı borç ve fırsat yatırımcısı.",
      en: "A distressed-debt and opportunity investor known for his memos on market cycles.",
    },
  },
  {
    slug: "chase-coleman",
    name: "Chase Coleman",
    firm: "Tiger Global",
    kind: "13f",
    ciks: [1167483],
    tagline: {
      tr: "Büyüyen teknoloji ve internet şirketlerine yatırım yapan \"Tiger Cub\" yöneticisi.",
      en: "A \"Tiger Cub\" manager investing in growing technology and internet companies.",
    },
  },
  {
    slug: "philippe-laffont",
    name: "Philippe Laffont",
    firm: "Coatue",
    kind: "13f",
    ciks: [1135730],
    tagline: {
      tr: "Teknoloji ve yapay zekâ şirketlerine odaklanan, halka açık ve özel yatırım yapan fon.",
      en: "A fund focused on technology and AI companies, investing in both public and private markets.",
    },
  },
];

export function investorFirm(investor: Investor, locale: string): string {
  return locale === "en" && investor.firmEn ? investor.firmEn : investor.firm;
}

export const INVESTOR_SLUGS = INVESTORS.map((investor) => investor.slug);

export function investorBySlug(slug: string): Investor | null {
  return INVESTORS.find((investor) => investor.slug === slug) ?? null;
}

/**
 * SEC isteklerinin kimliği — başlıksız ve tarayıcı kimliğiyle SEC 403 döner;
 * kural "kurum adı + iletişim adresi" (ör. "AcilisZili research ad@alan.com").
 *
 * ORTAM DEĞİŞKENİNDE, KODDA DEĞİL: depo herkese açık ve iletişim adresi
 * kişisel bir e-posta. Tanımlı değilse senkron SEC'e hiç gitmiyor ve bunu
 * özetinde söylüyor; sayfalar tablodaki son veriyle çalışmaya devam ediyor.
 */
export function secUserAgent(): string | null {
  const value = process.env.SEC_USER_AGENT?.trim();
  return value ? value : null;
}

/** İlk doldurmada yatırımcı başına kaç çeyrek. Sonrasında yalnızca yeni dönem. */
export const INVESTOR_PERIODS = 8;
