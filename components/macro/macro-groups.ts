/**
 * /makro grupları: sekme çubuğu ve küçük çoklu ızgaranın sırası.
 *
 * "use client" DEĞİL: sunucu sayfası da (ızgara sırası, seri başına grup)
 * istemci sahnesi de (sekmeler) buradan okuyor; istemci modülünden dışa
 * aktarılan değer sunucuya gerçek değer olarak gelmez (CLAUDE.md).
 *
 * Gruplar MACRO_SERIES'in kendi mantığından: enflasyon, iş gücü, politika,
 * sonra ikinci halkanın büyüme ve resesyon sinyalleri. M2 para arzı
 * politikanın yanına düştü (Fed'in bilanço kanalı); perakende, Sahm ve
 * 10Y-3A "Büyüme ve Risk" başlığında. Listede olmayan yeni bir seri son
 * gruba düşer ki sekmede hiç görünmez kalmasın.
 */
export const MACRO_GROUPS = [
  { key: "inflation", series: ["CPIAUCSL", "CPILFESL", "PCEPILFE"] },
  { key: "labor", series: ["UNRATE", "PAYEMS", "ICSA"] },
  { key: "policy", series: ["FEDFUNDS", "M2SL"] },
  { key: "growth", series: ["RSAFS", "SAHMREALTIME", "T10Y3M"] },
] as const;

export type MacroGroupKey = (typeof MACRO_GROUPS)[number]["key"];

const FALLBACK_GROUP: MacroGroupKey = "growth";
/** Grup içi sıra bu sayıdan küçük kalır; sıralama anahtarı grup × bu + sıra. */
const GROUP_STRIDE = 100;

export function groupOf(seriesId: string): MacroGroupKey {
  return MACRO_GROUPS.find((group) => (group.series as readonly string[]).includes(seriesId))?.key ?? FALLBACK_GROUP;
}

/** Grup sırası, sonra grubun kendi sırası; listede olmayan grubun sonuna. */
export function groupRank(seriesId: string): number {
  const groupIndex = MACRO_GROUPS.findIndex((group) => group.key === groupOf(seriesId));
  const within = (MACRO_GROUPS[groupIndex].series as readonly string[]).indexOf(seriesId);
  return groupIndex * GROUP_STRIDE + (within < 0 ? GROUP_STRIDE - 1 : within);
}
