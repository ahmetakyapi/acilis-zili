import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROUTES = ["/", "/piyasalar", "/sirketler", "/bilancolar", "/bilancolar/analizler",
  "/takvim", "/makro", "/rehber", "/rehber/hedge", "/mercek", "/haberler", "/karsilastir",
  "/menu", "/giris", "/kayit", "/hisse/AAPL", "/bulten", "/kvkk", "/yok-boyle-bir-sayfa"];
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const out = [];
for (const r of ROUTES) {
  const p = await b.newPage();
  const errors = [];
  p.on("console", m => { if (m.type() === "error") errors.push(m.text().slice(0,120)); });
  p.on("pageerror", e => errors.push("PAGEERROR " + String(e).slice(0,120)));
  await p.setViewport({ width: 1280, height: 900 });
  let status = 0;
  try { const res = await p.goto("http://localhost:3000" + r, { waitUntil: "networkidle0", timeout: 60000 }); status = res.status(); }
  catch { await p.close(); out.push(`${r} → GİDİLEMEDİ`); continue; }
  await new Promise(x => setTimeout(x, 500));
  const a = await p.evaluate(() => {
    const res = { noLabel: [], badHeading: null, lowContrast: 0, emptyLinks: 0, langAttr: document.documentElement.lang, titleLen: document.title.length, metaDesc: !!document.querySelector('meta[name="description"]'), ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null, ogImg: !!document.querySelector('meta[property="og:image"]'), canonical: !!document.querySelector('link[rel="canonical"]') };
    for (const el of document.querySelectorAll("input, select, textarea")) {
      const id = el.id;
      const hasLabel = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest("label") || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || (el.type === "hidden");
      if (!hasLabel) res.noLabel.push(`${el.tagName}[${el.type||""}] name=${el.name||"?"}`);
    }
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(h => +h.tagName[1]);
    for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i-1] > 1) { res.badHeading = `h${hs[i-1]}→h${hs[i]}`; break; }
    for (const a of document.querySelectorAll("a[href]")) {
      const t = (a.textContent||"").trim() || a.getAttribute("aria-label") || a.getAttribute("title");
      if (!t && a.getBoundingClientRect().width > 0) res.emptyLinks++;
    }
    return res;
  });
  const issues = [];
  if (a.noLabel.length) issues.push(`ETİKETSİZ ALAN: ${a.noLabel.join(", ")}`);
  if (a.badHeading) issues.push(`başlık atlaması ${a.badHeading}`);
  if (a.emptyLinks) issues.push(`boş bağlantı ${a.emptyLinks}`);
  if (!a.metaDesc) issues.push("meta description YOK");
  if (!a.ogTitle) issues.push("og:title YOK");
  if (!a.ogImg) issues.push("og:image YOK");
  if (!a.canonical) issues.push("canonical YOK");
  if (a.titleLen > 60) issues.push(`title ${a.titleLen} karakter`);
  if (errors.length) issues.push(`KONSOL: ${errors.slice(0,2).join(" | ")}`);
  out.push(`${r.padEnd(24)} [${status}] ${issues.length ? issues.join(" · ") : "temiz"}`);
  await p.close();
}
console.log(out.join("\n"));
await b.close();
