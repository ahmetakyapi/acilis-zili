import puppeteer from "puppeteer-core";
const ROUTES = ["/", "/piyasalar", "/sirketler", "/bilancolar", "/bilancolar/analizler",
                "/bilancolar/sndk/4c-fy2026", "/makro", "/mercek", "/rehber", "/takvim", "/haberler"];
async function main() {
  const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
  const page = await b.newPage();
  let bad = 0;
  for (const r0 of ROUTES) for (const w of [360, 390, 768, 1024, 1280, 1440]) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000" + r0, { waitUntil: "networkidle0", timeout: 90000 });
    const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    if (r.s > r.c) { console.log("OVERFLOW", r0, w, JSON.stringify(r)); bad++; }
  }
  console.log(bad === 0 ? "yatay tasma yok" : `${bad} tasma`);
  await b.close();
}
main().then(() => process.exit(0));
