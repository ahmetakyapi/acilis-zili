import puppeteer from "puppeteer-core";
const ROUTES = ["/bilancolar/sndk/4c-fy2026","/bilancolar/anet/2c-2026","/bilancolar/mrk/2c-2026","/bilancolar/analizler","/bilancolar","/","/piyasalar","/karsilastir"];
const WIDTHS = [390, 768, 1024, 1280, 1440];
async function main() {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  let bad = 0;
  for (const route of ROUTES) for (const w of WIDTHS) {
    await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
    await page.goto("http://localhost:3000" + route, { waitUntil: "networkidle0", timeout: 60000 });
    const r = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    if (r.s > r.c) { console.log("OVERFLOW", route, w, JSON.stringify(r)); bad++; }
  }
  console.log(bad === 0 ? "no overflow" : `${bad} overflow`);
  await browser.close();
}
main().then(() => process.exit(0));
