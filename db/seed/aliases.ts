/**
 * Arama takma adları — insanların yazdığı ad ile şirketin resmî adı
 * tutmadığında köprü.
 *
 * NEDEN GEREKLİ: arama, sembol ve `symbols.name` alanında metin eşleşmesi
 * yapıyor. O ad sağlayıcıdan geliyor ve TİCARİ SİCİL ADI oluyor. Kullanıcı
 * ise markayı yazıyor. Somut örnek: "spacex" araması hiçbir şey bulmuyordu,
 * çünkü tablodaki ad "Space Exploration Technologies Corp" ve içinde
 * "spacex" dizisi hiç geçmiyor. Aynı boşluk Google → Alphabet, Facebook →
 * Meta, Windows → Microsoft için de vardı.
 *
 * NE DEĞİL: bu bir eşanlamlı sözlüğü ya da "ilgili şirketler" listesi değil.
 * Yalnızca aynı şirketi kastettiği tartışmasız olan adlar girer. "çip" →
 * NVDA gibi kategori eşlemeleri BURAYA GİRMEZ; onlar aramayı tahmin
 * yürütmeye çevirir ve kullanıcı aradığından başka bir şirkete gider.
 *
 * Ürün adları bilinçli olarak var: iPhone arayan Apple'ı kastediyor ve
 * bunu bilmek için Apple'ın resmî adını bilmesi gerekmiyor.
 *
 * Anahtarlar küçük harf ve boşluksuz yazılır; `normalize()` sorguyu aynı
 * biçime indirger, böylece "sk hynix", "SK-Hynix" ve "skhynix" aynı yere
 * düşer.
 */

export const SYMBOL_ALIASES: Record<string, string[]> = {
  // Resmî adı markadan tamamen farklı olanlar
  spacex: ["SPCX"],
  spaceexploration: ["SPCX"],
  starlink: ["SPCX"],
  starship: ["SPCX"],
  google: ["GOOGL", "GOOG"],
  youtube: ["GOOGL"],
  android: ["GOOGL"],
  gemini: ["GOOGL"],
  waymo: ["GOOGL"],
  facebook: ["META"],
  instagram: ["META"],
  whatsapp: ["META"],
  oculus: ["META"],
  snapchat: ["SNAP"],
  skhynix: ["SKHY"],
  hynix: ["SKHY"],

  // Ürünüyle bilinenler
  iphone: ["AAPL"],
  ipad: ["AAPL"],
  macbook: ["AAPL"],
  windows: ["MSFT"],
  xbox: ["MSFT"],
  azure: ["MSFT"],
  copilot: ["MSFT"],
  aws: ["AMZN"],
  playstation: ["SONY"],
  chatgpt: ["MSFT"],
  claude: ["AMZN", "GOOGL"],

  // Türkçe yazımlar ve yaygın kısaltmalar
  nvidya: ["NVDA"],
  envidia: ["NVDA"],
  tesla: ["TSLA"],
  netflix: ["NFLX"],
  amazon: ["AMZN"],
  apple: ["AAPL"],
  microsoft: ["MSFT"],
  meta: ["META"],
  coca: ["KO"],
  kokakola: ["KO"],
  cocacola: ["KO"],
  pepsi: ["PEP"],
  boeing: ["BA"],
  intel: ["INTC"],
  amd: ["AMD"],
  bekirsemikondaktor: ["TSM"],
  tsmc: ["TSM"],
  taiwansemi: ["TSM"],
  berkshire: ["BRK.B"],
  buffett: ["BRK.B"],
  visa: ["V"],
  mastercard: ["MA"],
  disney: ["DIS"],
  starbucks: ["SBUX"],
  mcdonalds: ["MCD"],
  nike: ["NKE"],
  walmart: ["WMT"],
  costco: ["COST"],
  uber: ["UBER"],
  airbnb: ["ABNB"],
  paypal: ["PYPL"],
  coinbase: ["COIN"],
  palantir: ["PLTR"],
  honeywell: ["HON", "HONA"],
  alphabet: ["GOOGL", "GOOG"],
};

/** Sorguyu takma ad anahtarlarıyla aynı biçime indirger. */
export function normalizeAlias(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();
}

/**
 * Sorgunun işaret ettiği semboller.
 *
 * Hem tam eşleşme hem ÖN EK eşleşmesi denenir: kullanıcı "spacex" yazana
 * kadar her harfte sonuç görmeli, "spac" da SPCX getirmeli. Ön ek eşleşmesi
 * en fazla birkaç anahtara denk geldiği için sonuç kalabalıklaşmıyor.
 */
export function aliasSymbols(query: string): string[] {
  const key = normalizeAlias(query);
  if (key.length < 2) return [];

  const exact = SYMBOL_ALIASES[key];
  if (exact) return exact;

  const hits = new Set<string>();
  for (const [alias, symbols] of Object.entries(SYMBOL_ALIASES)) {
    if (alias.startsWith(key)) for (const symbol of symbols) hits.add(symbol);
  }
  return [...hits];
}
