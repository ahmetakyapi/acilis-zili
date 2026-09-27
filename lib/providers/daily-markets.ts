import { todayEt } from "@/lib/market-hours";
import { getSeries, type SeriesRequest } from "./fred";
import { fail, ok, responseDate, type MacroObservation, type MacroSeriesData, type ProviderResult } from "./types";
import { withTimeout } from "./timeout";

const CBOE_URL = "https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv";
const TREASURY_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml";
const TENORS: Record<string, string> = { DGS2: "BC_2YEAR", DGS5: "BC_5YEAR", DGS10: "BC_10YEAR", DGS30: "BC_30YEAR" };
const YIELD_TAGS = ["yield-2y", "yield-5y", "yield-10y", "yield-30y"].map(slug => `macro:${slug}`);

function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
function sorted(points: MacroObservation[], asOf: string) {
  const unique = new Map(points.filter(p => validDate(p.date) && p.date <= asOf && Number.isFinite(p.value)).map(p => [p.date, p]));
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function parseVixCsv(text: string, asOf: string): MacroObservation[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift()?.replace(/^\uFEFF/, "").split(",").map(s => s.trim().toUpperCase()) ?? [];
  const dateIndex = headers.indexOf("DATE"), closeIndex = headers.indexOf("CLOSE");
  if (dateIndex < 0 || closeIndex < 0) return [];
  return sorted(lines.flatMap(line => {
    const cells = line.split(",");
    const match = cells[dateIndex]?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const raw = cells[closeIndex]?.trim();
    if (!match || !raw || !Number.isFinite(Number(raw)) || Number(raw) <= 0) return [];
    return [{ date: `${match[3]}-${match[1]}-${match[2]}`, value: Number(raw) }];
  }), asOf);
}
export function parseTreasuryXml(text: string, seriesId: string, asOf: string): MacroObservation[] {
  const tenor = TENORS[seriesId];
  if (!tenor) return [];
  return sorted([...text.matchAll(/<entry\b[^>]*>[\s\S]*?<\/entry>/g)].flatMap(([entry]) => {
    const date = entry.match(/<d:NEW_DATE\b[^>]*>([^<]+)<\/d:NEW_DATE>/)?.[1]?.slice(0, 10);
    const match = entry.match(new RegExp(`<d:${tenor}\\b([^>]*)>([^<]*)<\\/d:${tenor}>`));
    const raw = match?.[2]?.trim();
    if (!date || !raw || /m:null=["']true["']/.test(match?.[1] ?? "") || !Number.isFinite(Number(raw))) return [];
    return [{ date, value: Number(raw) }];
  }), asOf);
}
export function dailySourceLabel(source: string) {
  return source === "cboe" ? "Cboe" : source === "treasury" ? "U.S. Treasury" : "FRED";
}

/** Doğrudan yayımlanan kapanış ile FRED'in tarihlerini karşılaştırır.
 * Seviyeler veya önceki kapanışlar iki sağlayıcı arasında karıştırılmaz. */
export async function getDailyMarketSeries(definition: SeriesRequest, limit = 2, options: { forceRefresh?: boolean } = {}): Promise<ProviderResult<MacroSeriesData>> {
  const isVix = definition.seriesId === "VIXCLS";
  if (!isVix && !TENORS[definition.seriesId]) return getSeries(definition, limit, options);
  const source = isVix ? "cboe" : "treasury";
  const asOf = todayEt();
  const read = async (): Promise<ProviderResult<MacroSeriesData>> => {
    try {
      const fetchText = async (url: string) => {
        const res = await withTimeout(fetch(url, options.forceRefresh
          ? { cache: "no-store" }
          : { next: { revalidate: 3600, tags: isVix ? ["macro:vix"] : YIELD_TAGS } }));
        if (!res.ok) throw new Error("source-unavailable");
        return { text: await res.text(), at: responseDate(res) };
      };
      const year = Number(asOf.slice(0, 4));
      const url = (y: number) => `${TREASURY_URL}?data=daily_treasury_yield_curve&field_tdr_date_value=${y}`;
      const response = await fetchText(isVix ? CBOE_URL : url(year));
      let points = isVix ? parseVixCsv(response.text, asOf) : parseTreasuryXml(response.text, definition.seriesId, asOf);
      // Ocak başında önceki kapanış önceki yılın dosyasında kalabilir.
      if (!isVix && points.length < Math.max(2, limit)) {
        const previous = await fetchText(url(year - 1));
        points = sorted([...parseTreasuryXml(previous.text, definition.seriesId, asOf), ...points], asOf);
      }
      if (points.length < 2) return fail(source, "empty", "İki geçerli kapanış bulunamadı");
      const last = points.at(-1)!;
      return ok({ seriesId: definition.seriesId, latestValue: last.value, prevValue: points.at(-2)!.value, periodLabel: last.date.slice(0, 7), observations: points.slice(-limit) }, source, { fetchedAt: response.at });
    } catch {
      return fail(source, "network", "Günlük kapanış kaynağına ulaşılamadı");
    }
  };
  const [direct, fred] = await Promise.all([read(), getSeries(definition, limit, options)]);
  if (!direct.ok) return fred;
  if (!fred.ok) return direct;
  return (fred.data.observations.at(-1)?.date ?? "") > (direct.data.observations.at(-1)?.date ?? "") ? fred : direct;
}
