/**
 * Canlılık ucu — `GET /api/health/live` (11 Kasım, mavi-yeşil deploy).
 *
 * Kime: yalnız Caddy'nin aktif sağlık yoklaması (deploy/Caddyfile →
 * `health_uri`, iki saniyede bir, iki portun ikisine de). Soru "bu süreç
 * istek kabul ediyor mu": veritabanına, sağlayıcıya, oturuma dokunmaz ve
 * sınırlanmaz. Kardeşi `/api/health` (lib/health.ts) bir DURUM raporu —
 * yedi veritabanı sorgusu ve IP başına dakikada 30 — iki saniyelik
 * yoklamaya uygun değil, veritabanı kesintisinde de iki portu birden
 * "ölü" ilan edip siteyi kapatırdı.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
}
