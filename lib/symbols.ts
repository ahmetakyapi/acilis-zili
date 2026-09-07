/** Known share-class aliases only. A preferred share/warrant suffix is not
 * automatically a common-share class; unknown identifiers stay unchanged. */
const CLASS_SYMBOLS = ["BRK.A", "BRK.B", "BF.A", "BF.B", "LEN.B", "UHAL.B"];
const ALIASES = new Map(CLASS_SYMBOLS.flatMap(symbol => [
  [symbol.replace(".", "-"), symbol],
  [symbol.replace(".", "/"), symbol],
]));

export function canonicalSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  return ALIASES.get(normalized) ?? normalized;
}
