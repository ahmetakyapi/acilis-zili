import puppeteer from "puppeteer-core";
const OUT = "/private/tmp/claude-501/-Users-ahmet-Desktop-Projects-personal-projects-acilis-zili/71cc5d80-864f-44df-837f-5a21ad566e84/scratchpad";
async function main() {
  const [url, name] = process.argv.slice(2);
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new", args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 700));
  const box = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h3")].find((n) => n.textContent.includes("Çeyreklik Gelir") || n.textContent.includes("Quarterly Revenue"));
    const row = h.closest("section").parentElement;
    const r = row.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  });
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: box.x - 6, y: box.y - 6, width: box.w + 12, height: box.h + 12 }, captureBeyondViewport: true });
  console.log(name, JSON.stringify(box));
  await browser.close();
}
main().then(() => process.exit(0));
