#!/usr/bin/env node
/**
 * Görsel tur için ekran görüntüsü: rota × genişlik × tema, DİLİMLİ.
 *
 *   NODE_PATH=$(npm root -g) node .claude/skills/gorsel-tur/cek.mjs \
 *     <taban-adres> <çıktı-dizini> ad=/rota [ad=/rota ...]
 *
 *   ... cek.mjs https://aciliszili.com /tmp/once ana=/ hisse=/hisse/NVDA
 *   ... cek.mjs http://localhost:3101 /tmp/sonra ana=/tmp-onizleme-ana
 *
 * Yalnız OKUR: tıklamaz, form göndermez, giriş yapmaz.
 *
 * NEDEN DİLİM (10 Kasım): tam sayfa görüntüsü 7–14 bin piksel; model onu
 * küçültülmüş görür ve 12 piksellik künyeyi okuyamaz. 1800 piksellik
 * dilimler gerçek ölçekte okunur.
 * NEDEN ÖNCE KAYDIRMA: `loading="lazy"` görseller tam sayfa çekimde boş
 * karo kalır; ilk turda logolar "eksik" sanıldı, kusur değildi.
 * NEDEN reducedMotion: başsız Chrome çalışan CSS animasyonunu başa sarılmış
 * karede yakalar (`.claude/rules/arayuz.md` → Düzen).
 */
import { createRequire } from "module";
import { mkdirSync } from "fs";

const { chromium } = createRequire(import.meta.url)("playwright");
const [base, out, ...pairs] = process.argv.slice(2);
if (!base || !out || pairs.length === 0) {
  console.error("kullanım: cek.mjs <taban-adres> <çıktı-dizini> ad=/rota [ad=/rota ...]");
  process.exit(2);
}
const routes = pairs.map((pair) => {
  const at = pair.indexOf("=");
  return [pair.slice(0, at), pair.slice(at + 1)];
});
const SIZES = (process.env.GENISLIKLER ?? "1440x900,390x844").split(",").map((s) => s.split("x").map(Number));
const THEMES = (process.env.TEMALAR ?? "light,dark").split(",");
const SLICE = Number(process.env.DILIM ?? 1800);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
let failed = 0;
for (const [width, height] of SIZES) {
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await context.addCookies([{ name: "az-theme", value: theme, url: base }]);
    const page = await context.newPage();
    for (const [name, route] of routes) {
      try {
        const response = await page.goto(base + route, { waitUntil: "networkidle", timeout: 60_000 });
        await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
        // Tembel görseller: sayfayı bir kez baştan sona gez, başa dön.
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
            scrollTo({ top: y, behavior: "instant" });
            await new Promise((r) => setTimeout(r, 120));
          }
          scrollTo({ top: 0, behavior: "instant" });
        });
        await page.waitForLoadState("networkidle").catch(() => {});
        const { total, overflow } = await page.evaluate(() => ({
          total: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth - innerWidth,
        }));
        let index = 0;
        for (let y = 0; y < total; y += SLICE) {
          await page.screenshot({
            path: `${out}/${name}-${width}-${theme}-${index++}.png`,
            fullPage: true,
            clip: { x: 0, y, width, height: Math.min(SLICE, total - y) },
          });
        }
        console.log(`${name} ${width} ${theme} http=${response?.status()} boy=${total} yatayTasma=${overflow} dilim=${index}`);
        if (overflow > 0) failed++;
      } catch (error) {
        failed++;
        console.log(`${name} ${width} ${theme} HATA ${String(error).slice(0, 140)}`);
      }
    }
    await context.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
