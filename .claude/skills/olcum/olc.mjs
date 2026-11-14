#!/usr/bin/env node
/**
 * ORTAK ÖLÇÜM BETİĞİ: rota × genişlik × tema için TEK TABLO.
 *
 *   NODE_PATH=$(npm root -g) node .claude/skills/olcum/olc.mjs \
 *     <taban-adres> ad=/rota [ad=/rota ...] [--ayrinti]
 *
 *   ... olc.mjs http://localhost:3110 ana=/ hisse=/hisse/NVDA --ayrinti
 *   GENISLIKLER=390,1440 TEMALAR=dark ... olc.mjs https://aciliszili.com ana=/
 *
 * Yalnız OKUR: tıklamaz, form göndermez, giriş yapmaz.
 *
 * NEDEN VAR (14 Kasım): yedi ajan aynı gün yedi ayrı `.tmp-*.mjs` yazdı;
 * her biri başka şeyi ölçtü ve 500 dönen sayfa "boy=1095" diye temiz geçti.
 * Ekrana özgü soru (iki ölçünün taban hizası, bir kolonun dibi) için geçici
 * betik yine yazılır; GENEL sağlık soruları buradan sorulur.
 *
 * SÜTUNLAR
 *   http     200 dışı = HATA; satır ölçülmez, çıkış kodu 1. 200 dönüp h1 taşımayan
 *            sayfa da HATA'dır (hata sınırı, "Biraz Yavaşla" kota ekranı, boş kabuk)
 *   boy      sayfa yüksekliği (piksel)
 *   yatay    scrollWidth − innerWidth; > 0 ise çıkış kodu 1
 *   taşan↔   ebeveyn kutusundan YATAY taşan öğe (ebeveyn taşmayı gösteriyorsa; kaydırıcı,
 *            gizli taşma, mutlak konum, dönüşüm ve eksi kenar boşluğu sayılmaz)
 *   taşan↕   aynısının dikeyi; satır yüksekliği oyunları da buraya düşer, önce ↔ okunur
 *   kırpık   kutusu metni kesen öğe (`sr-only`, üç nokta ve satır sınırı hariç)
 *   <12      12 pikselden küçük metin taşıyan öğe · svg: SVG metni (ekrandaki boyu)
 *   <44      44 pikselden küçük dokunma hedefi (yalnız ≤ 480 genişlikte;
 *            `elementFromPoint` ile yoklanır, `::after` ile büyütülen hedef sayılmaz;
 *            cümle içi bağlantı hariç)
 *   tablo    tablo kaplarında en büyük scrollWidth − clientWidth (yatay kayan tablo)
 *   h1       sayfadaki h1 sayısı (1 olmalı)
 *   konsol   konsol hatası + yakalanmamış istisna + 4xx/5xx dönen ya da düşen kaynak
 *   anim↓    `prefers-reduced-motion: reduce` altında ÇALIŞAN animasyon (0 olmalı)
 *   anim     hareket açıkken getAnimations() · ∞: sonsuz döngü (yalnız ilk tema)
 *
 * ORTAM
 *   GENISLIKLER  varsayılan 1440,1024,768,390,360 (yükseklik: 1440x900 gibi verilebilir)
 *   TEMALAR      varsayılan light,dark
 *   MOCK_NOW     sunucu `sahte-saglayici.cjs` ile bu ana kaydırıldıysa AYNI değer:
 *                tarayıcı saati de o ana sabitlenir (yoksa hydration uyarısı çıkar)
 *   ESZAMAN      aynı anda açık sekme (varsayılan 3)
 *   HAREKET=0    hareket açık sayımını atla (rota başına bir yeniden yükleme kazanır)
 *
 * Çıkış kodu: HTTP hatası, gezinme hatası ya da yatay taşma varsa 1.
 */
import { createRequire } from "module";
import { readFileSync } from "fs";

const { chromium } = createRequire(import.meta.url)("playwright");
const args = process.argv.slice(2);
const detail = args.includes("--ayrinti");
const [base, ...pairs] = args.filter((a) => !a.startsWith("--"));
if (!base || pairs.length === 0 || pairs.some((p) => !p.includes("="))) {
  console.error("kullanım: olc.mjs <taban-adres> ad=/rota [ad=/rota ...] [--ayrinti]");
  process.exit(2);
}
const routes = pairs.map((pair) => { const at = pair.indexOf("="); return [pair.slice(0, at), pair.slice(at + 1)]; });
const SIZES = (process.env.GENISLIKLER ?? "1440,1024,768,390,360").split(",").map((s) => { const [w, h] = s.split("x").map(Number); return [w, h || (w <= 480 ? 844 : w <= 800 ? 1024 : 900)]; });
const THEMES = (process.env.TEMALAR ?? "light,dark").split(",");
const POOL = Math.max(1, Number(process.env.ESZAMAN) || 3);
const MOTION = process.env.HAREKET !== "0";
const SHOWN = 5;
const RUN = 1 + Math.floor(Math.random() * 250);
const ORIGIN = new URL(base).origin;
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(new URL(base).hostname);
const TILE = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#8a8f98"/></svg>';

/** Tarayıcı saati: sunucunun kaydırılmış saati akıyor; yerelde tam anı `.next/mock-saat.json` verir. */
function mockTime() {
  if (!process.env.MOCK_NOW) return null;
  const at = Date.parse(process.env.MOCK_NOW);
  if (!Number.isFinite(at)) { console.error(`MOCK_NOW okunamadı: ${process.env.MOCK_NOW}`); process.exit(2); }
  try {
    const mark = JSON.parse(readFileSync(".next/mock-saat.json", "utf8"));
    if (mark.now && Date.parse(mark.now) === at) return () => at + (Date.now() - mark.baslangic);
  } catch {}
  return () => at;
}
const clockNow = mockTime();

/* Sayfanın içinde koşar: bütün ölçüler tek geçişte. */
function measure({ shown, touch }) {
  const TOL = 1;
  const describe = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((c) => "." + c).join("") : "";
    const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls.slice(0, 48)}${text ? ` "${text}"` : ""}`;
  };
  const srOnly = (el, cs) => /\bsr-only\b/.test(typeof el.className === "string" ? el.className : "") || (cs.position === "absolute" && el.offsetWidth <= 1 && el.offsetHeight <= 1) || cs.clipPath === "inset(50%)";
  const ownText = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true; return false; };
  const list = () => ({ n: 0, items: [] });
  const hit = (bucket, el, note) => { bucket.n++; if (bucket.items.length < shown) bucket.items.push(`${describe(el)} → ${note}`); };
  const out = { overflowing: list(), overflowingY: list(), clipped: list(), small: list(), svgSmall: list(), tap: list(), tables: { n: 0, max: 0, items: [] } };
  const vw = document.documentElement.clientWidth;

  for (const el of document.body.querySelectorAll("*")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") {
      /* SVG metni: yazı boyu × çizimin ekrandaki ölçeği. */
      if (/^(text|tspan)$/i.test(el.tagName) && ownText(el)) {
        const m = el.getScreenCTM(); const size = parseFloat(getComputedStyle(el).fontSize) * (m ? Math.hypot(m.a, m.b) : 1);
        const r = el.getBoundingClientRect();
        if (r.width > 0 && size < 12 - 0.05 && getComputedStyle(el).visibility !== "hidden") hit(out.svgSmall, el, `${size.toFixed(1)} px`);
      }
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || srOnly(el, cs)) continue;
    /* Yazı boyu 0 = bilinçli gizlenmiş metin (yalnız ekran okuyucu): küçük ya da kırpık sayılmaz. */
    const text = ownText(el) && parseFloat(cs.fontSize) >= 1;

    if (text && parseFloat(cs.fontSize) < 12 - 0.05 && parseFloat(cs.opacity) > 0) hit(out.small, el, `${parseFloat(cs.fontSize).toFixed(1)} px`);

    if (text) {
      const cutX = el.scrollWidth - el.clientWidth > TOL && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== "ellipsis";
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
      const cutY = el.scrollHeight - el.clientHeight > TOL + 1 && /hidden|clip/.test(cs.overflowY) && !clamp && cs.textOverflow !== "ellipsis";
      if (cutX) hit(out.clipped, el, `yatay ${el.scrollWidth - el.clientWidth} px`);
      else if (cutY) hit(out.clipped, el, `dikey ${el.scrollHeight - el.clientHeight} px`);
    }

    const parent = el.parentElement;
    if (parent && parent !== document.body && !/absolute|fixed|sticky/.test(cs.position) && !/^(inline|contents|table-)/.test(cs.display)) {
      const ps = getComputedStyle(parent); const pr = parent.getBoundingClientRect();
      if (pr.width > 0 && pr.height > 0 && !/^(inline|contents)$/.test(ps.display) && cs.transform === "none") {
        const dx = Math.max(r.right - pr.right, pr.left - r.left); const dy = Math.max(r.bottom - pr.bottom, pr.top - r.top);
        /* Eksi kenar boşluğu bilinçli taşmadır (dokunma hedefini büyüten `-my-2` gibi). */
        const neg = (...sides) => sides.some((side) => parseFloat(cs[side]) < 0);
        if (dx > TOL && ps.overflowX === "visible" && !neg("marginLeft", "marginRight")) hit(out.overflowing, el, `${dx.toFixed(1)} px (ebeveyn ${describe(parent).split(" ")[0]})`);
        else if (dy > TOL && ps.overflowY === "visible" && !neg("marginTop", "marginBottom")) hit(out.overflowingY, el, `${dy.toFixed(1)} px (ebeveyn ${describe(parent).split(" ")[0]})`);
      }
    }
  }

  /* Tablo kapları: tablonun en yakın yatay kaydırıcısı (yoksa ebeveyni). */
  const boxes = new Set();
  for (const table of document.querySelectorAll("table")) {
    let box = table.parentElement;
    for (let p = table.parentElement; p && p !== document.body; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowX)) { box = p; break; }
    if (box && box.clientWidth > 0) boxes.add(box);
  }
  for (const box of boxes) { const d = box.scrollWidth - box.clientWidth; if (d > TOL) { out.tables.n++; out.tables.max = Math.max(out.tables.max, d); if (out.tables.items.length < shown) out.tables.items.push(`${describe(box).split(" ")[0]} → ${d} px kayıyor (kap ${box.clientWidth}, içerik ${box.scrollWidth})`); } }

  /* Dokunma hedefi: kutu küçükse merkezin 21,5 piksel çevresi yoklanır;
     dört yön de öğeye (ya da içine) düşüyorsa hedef `::after` ile büyütülmüştür. */
  if (touch) {
    const targets = document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="link"], [role="switch"], [role="checkbox"], [role="menuitem"]');
    for (const el of targets) {
      const cs = getComputedStyle(el);
      let r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || cs.visibility === "hidden" || cs.pointerEvents === "none" || el.disabled || srOnly(el, cs)) continue;
      if (r.width >= 44 - 0.5 && r.height >= 44 - 0.5) continue;
      /* Cümle içi bağlantı muaf (WCAG 2.5.8): satırın içinde, yanında metin var. */
      if (el.tagName === "A" && cs.display === "inline" && el.parentElement && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 1)) continue;
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const owns = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const at = document.elementFromPoint(x, y); return !!at && (at === el || el.contains(at) || (at.tagName === "LABEL" && at.control === el) || (el.labels && [...el.labels].some((l) => l.contains(at)))); };
      if (!owns(cx, cy)) continue; // üstü örtülü (açılmamış menü, başka katman): dokunulamaz, ölçülmez
      const wide = r.width >= 44 - 0.5 || (owns(cx - 21.5, cy) && owns(cx + 21.5, cy));
      const tall = r.height >= 44 - 0.5 || (owns(cx, cy - 21.5) && owns(cx, cy + 21.5));
      if (!wide || !tall) hit(out.tap, el, `${Math.round(r.width)}×${Math.round(r.height)}${!wide && !tall ? "" : !wide ? " (yatayda < 44)" : " (dikeyde < 44)"}`);
    }
    scrollTo({ top: 0, behavior: "instant" });
  }

  return {
    height: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - vw,
    h1: document.querySelectorAll("h1").length,
    lead: ((document.querySelector("main") ?? document.body).innerText || "").replace(/\s+/g, " ").trim().slice(0, 70),
    /* Geçişler sayılmaz: ölçümün kendi kaydırması tetikler (ilerleme çubuğu, menü rengi). */
    running: document.getAnimations().filter((a) => a.playState === "running" && !(a instanceof CSSTransition)).map((a) => { const t = a.effect && a.effect.target; return `${t ? describe(t).split(" ")[0] : "?"} → ${a.animationName || a.transitionProperty || a.id || "animasyon"}`; }),
    ...out,
  };
}

async function settle(page, theme) {
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); // akışlı ya da yoklayan sayfa hiç susmaz: beklemeyi kes, ölç
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await page.evaluate(async () => { // tembel görseller: sayfayı bir kez gez, başa dön
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 80)); }
    scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(250);
}

const browser = await chromium.launch();
const jobs = [];
SIZES.forEach(([width, height], si) => THEMES.forEach((theme, ti) => jobs.push({ width, height, theme, order: si * 100 + ti, motion: MOTION && ti === 0 })));
const rows = [];

async function run({ width, height, theme, order, motion }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", hasTouch: width <= 480 });
  await context.addCookies([{ name: "az-theme", value: theme, url: base }]);
  /* Yerel sunucuda dış görsel (sahte haberin görsel adresi) gerçek ağa
     gitmez: gri bir karoyla yanıtlanır, kutusu yine ölçülür. */
  if (LOCAL) await context.route((url) => url.origin !== ORIGIN, (route) => (route.request().resourceType() === "image" ? route.fulfill({ contentType: "image/svg+xml", body: TILE }) : route.abort()));
  const page = await context.newPage();
  let errors = [];
  /* Düşen kaynak ADRESİYLE yazılır ("Failed to load resource" hangi kaynak demiyor).
     `/api/ai/` 403'ü başsız tarayıcıya kapalı bot kapısıdır, hata değil (`scripts/smoke.mjs`). */
  page.on("console", (msg) => { if (msg.type() === "error" && !msg.text().startsWith("Failed to load resource")) errors.push(msg.text().replace(/\s+/g, " ").slice(0, 160)); });
  page.on("response", (response) => { const u = new URL(response.url()); if (response.status() >= 400 && !(response.status() === 403 && u.pathname.startsWith("/api/ai/"))) errors.push(`${response.status()} ${u.origin === ORIGIN ? "" : u.host}${u.pathname}${u.search.slice(0, 40)}`); });
  page.on("requestfailed", (request) => { const why = request.failure()?.errorText ?? ""; if (!/ERR_ABORTED/.test(why) && !(LOCAL && new URL(request.url()).origin !== ORIGIN)) errors.push(`istek düştü: ${request.url().slice(0, 100)} ${why}`); });
  page.on("pageerror", (error) => errors.push(`istisna: ${String(error).slice(0, 160)}`));
  for (const [index, [name, route]] of routes.entries()) {
    const row = { name, width, theme, order: order + index * 10000 };
    errors = [];
    try {
      if (clockNow) await page.clock.setFixedTime(clockNow());
      /* Yerelde her gezinme ayrı "adres"ten gelir: site IP başına kota tutar
         (`lib/rate-limit.ts`) ve art arda açılan hisse sayfaları 200 koduyla
         "Biraz Yavaşla" ekranını döndürüp temiz ölçülüyordu (14 Kasım). */
      if (LOCAL) await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${RUN}.${(order + index) % 250}.${1 + ((order * 7 + index * 13) % 250)}` });
      const response = await page.goto(base + route, { waitUntil: "load", timeout: 60_000 });
      row.http = response ? response.status() : 0;
      if (row.http !== 200) { row.fail = `HTTP ${row.http}`; rows.push(row); continue; }
      await settle(page, theme);
      Object.assign(row, await page.evaluate(measure, { shown: SHOWN, touch: width <= 480 }));
      row.console = [...errors];
      /* 200 dönen ama içeriği olmayan sayfa (hata sınırı, kota ekranı, boş kabuk) temiz satır sayılmaz. */
      if (row.h1 === 0) { row.fail = `içerik yok (h1 = 0, boy ${row.height}): "${row.lead}"`; rows.push(row); continue; }
      if (motion) {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.reload({ waitUntil: "load", timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(400);
        row.motion = await page.evaluate(() => { const all = document.getAnimations(); return { all: all.length, infinite: all.filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length }; });
        await page.emulateMedia({ reducedMotion: "reduce" });
      }
    } catch (error) {
      row.fail = String(error).replace(/\s+/g, " ").slice(0, 120);
    }
    rows.push(row);
    process.stderr.write(".");
  }
  await context.close();
}
const queue = [...jobs];
await Promise.all(Array.from({ length: Math.min(POOL, queue.length) }, async () => { while (queue.length) await run(queue.shift()); }));
await browser.close();
process.stderr.write("\n");

rows.sort((a, b) => a.order - b.order);
const cols = ["rota", "gen", "tema", "http", "boy", "yatay", "taşan↔", "taşan↕", "kırpık", "<12", "svg<12", "<44", "tablo", "h1", "konsol", "anim↓", "anim"];
const table = rows.map((r) => r.fail
  ? [r.name, r.width, r.theme, r.http ?? "-", `HATA ${r.fail}`]
  : [r.name, r.width, r.theme, r.http, r.height, r.overflowX, r.overflowing.n, r.overflowingY.n, r.clipped.n, r.small.n, r.svgSmall.n, r.width <= 480 ? r.tap.n : "-", r.tables.n ? r.tables.max : 0, r.h1, r.console.length, r.running.length, r.motion ? `${r.motion.all}${r.motion.infinite ? ` ∞${r.motion.infinite}` : ""}` : "-"]);
const widths = cols.map((c, i) => Math.max(c.length, ...table.filter((t) => t.length === cols.length).map((t) => String(t[i]).length)));
const line = (cells) => cells.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : i < widths.length ? String(c).padStart(widths[i]) : String(c))).join("  ");
console.log(line(cols));
for (const [i, cells] of table.entries()) {
  console.log(line(cells));
  const r = rows[i];
  if (!detail || r.fail) continue;
  const show = (label, items) => items.slice(0, SHOWN).forEach((item) => console.log(`    ${label}: ${item}`));
  show("taşan↔", r.overflowing.items); show("taşan↕", r.overflowingY.items); show("kırpık", r.clipped.items); show("<12", r.small.items); show("svg<12", r.svgSmall.items); show("<44", r.tap.items); show("tablo", r.tables.items); show("konsol", r.console); show("anim↓", r.running);
}
const failed = rows.filter((r) => r.fail);
const overflow = rows.filter((r) => !r.fail && r.overflowX > 0);
console.log(`\n${rows.length} ölçüm · HATA ${failed.length} · yatay taşma ${overflow.length}${clockNow ? ` · tarayıcı saati ${new Date(clockNow()).toISOString()}` : ""}`);
for (const r of failed) console.log(`HATA  ${r.name} ${r.width} ${r.theme}: ${r.fail}`);
for (const r of overflow) console.log(`TAŞMA ${r.name} ${r.width} ${r.theme}: ${r.overflowX} px`);
process.exit(failed.length || overflow.length ? 1 : 0);
