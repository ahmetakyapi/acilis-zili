import { parsePosterDate, type DayPoster } from "@/lib/day-poster";
import { getDayPoster, getPosterArchive, getPosterSceneStocks } from "@/lib/day-poster-data";
import { swarmDomain, swarmLayout, swarmSvg, type SwarmInk } from "@/lib/day-poster-scene";
import { todayEt } from "@/lib/market-hours";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * GÜNÜN POSTERİ — arşiv kartının minyatürü, `/gun/2026-10-23/minyatur/acik`
 * (25 Ekim). Sahnenin durağan küçük kopyası: aynı yerleşim
 * (`lib/day-poster-scene.ts`, `mini` düzeni), metinsiz SVG.
 *
 * NEDEN AYRI ADRES, SAYFAYA GÖMÜLÜ DEĞİL: arşivde 29 kart var ve her
 * sahne ~500 nokta; gömülü SVG sayfanın HTML'ine ~15.000 `circle` koyardı.
 * `img` + `loading="lazy"` ile kart ekrana yaklaşınca, önbellekli tek
 * dosya iniyor. Veri arşivin kendi önbelleğinden (`getPosterArchive`: bir
 * tur, otuz seans); arşivde yoksa günün posterinden.
 *
 * TEMA ADRESTE (`/acik`, `/koyu`; sorgu dizesi değil, `next/image` yerel
 * adreste sorguyu ayrıca yapılandırma istiyor): `img` içindeki SVG sayfanın
 * CSS değişkenlerini okuyamıyor; kart iki dosyayı da basıp temaya göre birini
 * gösteriyor (`PosterArchive.module.css`). Renkler globals.css'teki
 * `--up`, `--down`, `--flat`, `--line-strong`, `--line-soft` token'larının
 * iki temadaki değerleri — tek kopya burası.
 */

const INK: Record<"light" | "dark", SwarmInk> = {
  light: { up: "#0c7350", down: "#c01a3d", flat: "#586a7c", zero: "rgb(16 32 52 / 0.17)", lane: "rgb(16 32 52 / 0.06)" },
  dark: { up: "#3ddc97", down: "#ff5c7a", flat: "#8497a9", zero: "rgb(255 255 255 / 0.2)", lane: "rgb(255 255 255 / 0.07)" },
};

/** Geçmiş bir seansın minyatürü değişmiyor: bir gün. */
const CACHE_SECONDS = 86_400;
/** Oran sınırı: arşiv sayfası bir açılışta en çok ~60 dosya istiyor (iki
 *  tema, tembel); kardeşi `gorsel`den bol. */
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

async function posterFor(date: string): Promise<DayPoster | "error" | null> {
  const archive = await getPosterArchive();
  const fromArchive = archive.state === "ok" ? archive.posters.find((poster) => poster.date === date) : undefined;
  if (fromArchive) return fromArchive;
  const read = await getDayPoster(date);
  if (read.state === "error") return "error";
  return read.state === "ok" ? read.poster : null;
}

export async function GET(request: Request, context: RouteContext<"/gun/[tarih]/minyatur/[tema]">) {
  const gate = rateLimit(clientKey(request, "gun-minyatur"), RATE_LIMIT, RATE_WINDOW_MS);
  if (!gate.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }
  const { tarih, tema } = await context.params;
  const date = parsePosterDate(tarih, todayEt());
  if (!date || (tema !== "acik" && tema !== "koyu")) return new Response("Not Found", { status: 404 });
  const poster = await posterFor(date);
  if (poster === "error") return new Response(null, { status: 503 });
  if (!poster) return new Response("Not Found", { status: 404 });

  const theme = tema === "koyu" ? "dark" : "light";
  const { stocks } = await getPosterSceneStocks(poster);
  const layout = swarmLayout({
    stocks,
    sectorOrder: poster.sectors.map((move) => move.symbol),
    mode: "mini",
    domain: swarmDomain(stocks.map((stock) => stock.change)),
  });
  return new Response(swarmSvg(layout, stocks, INK[theme]), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
