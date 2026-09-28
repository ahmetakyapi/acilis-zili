#!/usr/bin/env node
/**
 * Duman testi — `npm run smoke` (28 Eylül).
 *
 * Çalışan bir kopyaya (`BASE_URL`, varsayılan http://localhost:3000) başsız
 * Chrome ile gidip ana rotaları iki dilde ve iki genişlikte (390, 1280)
 * açar; her birinde üç şeyi sorar:
 *
 *   1. HTTP kodu doğru mu — sayfalar 200, olmayan bir adres 404. 404'ün
 *      200 dönmesi (yumuşak 404) arama motoruna boş bir sayfa dizinletir.
 *   2. Konsolda hata var mı — hidrasyon uyuşmazlığı ve istemci hataları
 *      ekranda hiçbir şey göstermeden burada görünüyor.
 *   3. Yatay taşma var mı — CLAUDE.md "Yatay taşma düzenli kontrol edilir";
 *      `.tmp-*.mjs` geçici betiklerinin kalıcı hâli.
 *
 * YAZMA AKIŞI YALNIZCA `SMOKE_ALLOW_WRITES=1` İLE: kayıt → çıkış → giriş →
 * favori ekle/çıkar → hesabı sil. Veritabanına gerçek bir hesap yazıyor ve
 * siliyor; üretime karşı kazara koşmasın diye varsayılan kapalı. Hesap her
 * koşumda yeni ve rastgele adlı, akış yarıda kalırsa adı çıktıda yazıyor ki
 * elle silinebilsin.
 *
 * Ortam:
 *   BASE_URL            hedef kök adres
 *   CHROME_PATH         Chrome/Chromium yürütülebiliri (yoksa bilinen yerler denenir)
 *   SMOKE_CONCURRENCY   aynı anda açık sekme (varsayılan 3)
 *   SMOKE_ALLOW_WRITES  1 → yazma akışını da koş
 *   SMOKE_DEGRADED_OK   1 → veritabanısız koşum (CI): kendi `/api/` uçlarımızın
 *                       502 ve 503'ü hata sayılmaz — sözleşmeleri bu, veri
 *                       yokken 503 + "veri alınamadı" (ör. app/api/day-flow/
 *                       route.ts), sağlayıcı düşünce 502 (app/api/chart).
 *                       İlk CI koşumu (28 Eylül) hisse sayfalarında grafiğin
 *                       502'siyle düştü: yerel denemede anahtarlar boştu ama
 *                       veritabanı vardı ve barlar önbellekten geliyordu, yani
 *                       502 hiç oluşmamıştı.
 *
 * Çıkış kodu: bir kontrol bile düşerse 1.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import puppeteer from "puppeteer-core";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const CONCURRENCY = Math.max(1, Number(process.env.SMOKE_CONCURRENCY) || 3);
const ALLOW_WRITES = process.env.SMOKE_ALLOW_WRITES === "1";
const DEGRADED_OK = process.env.SMOKE_DEGRADED_OK === "1";
/** Veritabanısız koşumda kendi veri uçlarımızın "kaynak yok" cevapları. */
const DEGRADED_STATUSES = new Set([502, 503]);
const WIDTHS = [390, 1280];
const VIEWPORT_HEIGHT = 900;
const NAV_TIMEOUT_MS = 60_000;
/* Ağ sustuktan sonra istemci bileşenlerinin oturması için kısa bekleme:
   hidrasyon hataları ve geç yerleşen taşmalar bu pencerede çıkıyor. */
const SETTLE_MS = 800;
/* Alt piksel yuvarlaması taşma sayılmasın. */
const OVERFLOW_TOLERANCE_PX = 1;

/** Sayfa rotaları — TR ve `/en` önekiyle ikişer kez açılıyor. */
const ROUTES = [
  "/",
  "/piyasalar",
  "/sirketler",
  "/hisse/NVDA",
  "/karsilastir?semboller=NVDA,AMD",
  "/makro",
  "/takvim",
  "/haberler",
  "/bilancolar",
  "/bilancolar/analizler",
  "/teknik",
  "/mercek",
  "/rehber",
  "/bulten",
  "/giris",
  "/kayit",
  /* 28 Eylül ekranları. `/hisse/JPM` teknik analiz listesinde OLMAYAN bir
     sembol: Teknik Fotoğraf ve temettü paneli yalnızca orada çiziliyor. */
  "/hisse/JPM",
  "/takvim?tur=temettu",
  "/bilancolar/hafta",
  "/karsilastir/nvda-amd",
  "/tema",
  "/tema/yapay-zeka",
  "/yatirimcilar",
  "/yatirimcilar/warren-buffett",
  "/yatirimcilar/nancy-pelosi",
  "/yatirimcilar/michael-burry",
  "/sozluk",
  "/sozluk/fk",
  "/vergi",
  "/hakkinda",
  "/portfoy",
];
const NOT_FOUND_ROUTE = "/bu-sayfa-yok-duman-testi";

/**
 * Hata sayılmayan konsol satırları — her biri bir gerekçeyle:
 *   · 404 sayfasının kendi belgesi "Failed to load resource: 404" basıyor;
 *     beklenen kod zaten ayrıca sınanıyor.
 *   · Haber görselleri onlarca dış CDN'den geliyor (components/news/
 *     NewsImage.tsx) ve biri düşünce bileşen yer tutucuya dönüyor; o
 *     sitenin değil kaynağın arızası. Yalnızca BAŞKA köke ait kaynak
 *     hataları susturuluyor, kendi kökümüzün 404/500'ü hata sayılıyor.
 *   · `SMOKE_DEGRADED_OK=1` ile kendi `/api/` uçlarımızın 502 ve 503'ü
 *     (yukarıda). Sayfanın kendisi HTTP 200 dönmek ve konsola başka hata
 *     yazmamak zorunda; istisna yalnızca veri ucunun "kaynak yok" cevabı.
 *
 * Konsol satırı kaynağın adresini ancak `location().url`de taşıyor; bu
 * ayrım için yanıtın kendisi de izleniyor (`degradedUrls`).
 *
 * KARAR SAYFA OTURDUKTAN SONRA (28 Eylül). Satırlar geldikleri an
 * eleniyordu ve Chrome "Failed to load resource" satırını çoğu zaman o
 * isteğin `response` olayından ÖNCE basıyor: adres henüz `degradedUrls`te
 * olmadığı için kendi `/api/` ucumuzun sözleşmeli 502'si hata sayılıyor,
 * koşum rastgele düşüyordu (28 Eylül'de dört kez, her seferinde başka bir
 * sayfada; aynı sayfa öteki genişlikte geçiyordu). Artık satırlar adresiyle
 * toplanıyor, eleme sayfa oturunca yapılıyor.
 */
function ignorable(message, url, expectNotFound, degradedUrls) {
  if (!message.startsWith("Failed to load resource") || !url) return false;
  try {
    const parsed = new URL(url);
    if (expectNotFound && parsed.pathname.endsWith(NOT_FOUND_ROUTE)) return true;
    if (degradedUrls.has(url)) return true;
    return parsed.origin !== new URL(BASE_URL).origin;
  } catch {
    return false;
  }
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((path) => fs.existsSync(path));
  if (!found) {
    console.error("Chrome bulunamadı. CHROME_PATH ile yolunu ver.");
    process.exit(2);
  }
  return found;
}

/** Bir sayfayı açar, üç kontrolü yapar; sonuç nesnesi döner. */
async function checkPage(browser, path, width) {
  const expectNotFound = path.endsWith(NOT_FOUND_ROUTE);
  /* HER SAYFA TEMİZ BİR BAĞLAMDA. `/en` açılınca dil çerezi yazılıyor ve
     aynı bağlamda açılan sonraki Türkçe sayfa İngilizce istek atıyordu
     (ölçüldü: `/`nin gün akışı `?locale=en` soruyordu) — iki dili sınayan
     bir test tek dili iki kez sınamış olurdu. */
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  const degradedUrls = new Set();
  const origin = new URL(BASE_URL).origin;
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (DEGRADED_OK && DEGRADED_STATUSES.has(response.status()) && url.origin === origin && url.pathname.startsWith("/api/")) {
      degradedUrls.add(response.url());
    }
  });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    consoleErrors.push({ text: msg.text(), url: msg.location()?.url });
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error).slice(0, 200)}`));
  await page.setViewport({ width, height: VIEWPORT_HEIGHT });

  const result = { path, width, status: 0, errors, overflow: 0, ok: false, note: "" };
  try {
    const response = await page.goto(BASE_URL + path, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    result.status = response?.status() ?? 0;
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    result.overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
  } catch (error) {
    result.note = String(error).slice(0, 160);
  } finally {
    await context.close();
  }
  for (const { text, url } of consoleErrors) {
    if (!ignorable(text, url, expectNotFound, degradedUrls)) {
      /* Adres de yazılıyor: düşen bir koşumun günlüğü hangi kaynağın
         düştüğünü söylemiyordu, teşhis tahmine kalıyordu. */
      errors.push(`${text.slice(0, 160)}${url ? ` · ${url.slice(0, 120)}` : ""}`);
    }
  }
  const statusOk = expectNotFound ? result.status === 404 : result.status === 200;
  result.ok = statusOk && errors.length === 0 && result.overflow <= OVERFLOW_TOLERANCE_PX && !result.note;
  return result;
}

async function runPool(tasks, size) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const task = tasks[next++];
      const result = await task();
      results.push(result);
      const mark = result.ok ? "ok  " : "FAIL";
      const detail = [
        `HTTP ${result.status}`,
        result.overflow > OVERFLOW_TOLERANCE_PX ? `taşma ${result.overflow}px` : null,
        result.errors.length ? `${result.errors.length} konsol hatası` : null,
        result.note || null,
      ]
        .filter(Boolean)
        .join(" · ");
      console.log(`${mark} ${String(result.width).padStart(4)}  ${result.path}  ${detail}`);
      if (result.retried) console.log(`       tekrar: ${result.retried}`);
      for (const line of result.ok ? [] : result.errors) console.log(`       ${line}`);
    }
  }
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

/* --------------------------------------------------------------------------
   Yazma akışı — yalnızca SMOKE_ALLOW_WRITES=1
   -------------------------------------------------------------------------- */

async function fillAndSubmit(page, fields) {
  for (const [name, value] of Object.entries(fields)) {
    await page.type(`input[name="${name}"]`, value);
  }
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS }),
    page.click('form button[type="submit"]'),
  ]);
}

async function pressedState(page) {
  return page.$eval('main form button[type="submit"][aria-pressed]', (el) => el.getAttribute("aria-pressed"));
}

async function writeFlow(browser) {
  const suffix = crypto.randomBytes(4).toString("hex");
  const username = `duman${suffix}`;
  const email = `duman-${suffix}@example.com`;
  /* Kullanıcı adını ve e-postanın yerel kısmını İÇERMEYEN şifre — kayıt
     formu içerenleri zayıf sayıp reddediyor (app/actions/auth.ts). */
  const password = `Zil-${crypto.randomBytes(6).toString("hex")}!`;
  const steps = [];
  const step = (name, ok, detail = "") => {
    steps.push({ name, ok });
    console.log(`${ok ? "ok  " : "FAIL"} yazma  ${name}${detail ? `  ${detail}` : ""}`);
    if (!ok) throw new Error(name);
  };

  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width: 1280, height: VIEWPORT_HEIGHT });
  console.log(`\nYazma akışı: ${username} (yarıda kalırsa bu hesabı elle sil)`);
  try {
    await page.goto(`${BASE_URL}/kayit`, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    await fillAndSubmit(page, { username, email, password, passwordConfirm: password });
    step("kayıt", !new URL(page.url()).pathname.startsWith("/kayit"), new URL(page.url()).pathname);

    /* Kayıt oturumu kendisi açıyor; girişi ayrıca sınamak için çerezler
       temizlenip giriş formundan yeniden giriliyor. */
    const cookies = await page.cookies();
    await page.deleteCookie(...cookies);
    await page.goto(`${BASE_URL}/giris`, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    await fillAndSubmit(page, { username, password });
    step("giriş", !new URL(page.url()).pathname.startsWith("/giris"), new URL(page.url()).pathname);

    await page.goto(`${BASE_URL}/hisse/NVDA`, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    const before = await pressedState(page);
    await page.click('main form button[type="submit"][aria-pressed]');
    await page.waitForFunction(
      (prev) => document.querySelector('main form button[type="submit"][aria-pressed]')?.getAttribute("aria-pressed") !== prev,
      { timeout: NAV_TIMEOUT_MS },
      before,
    );
    step("favori ekle", (await pressedState(page)) === "true");
    await page.reload({ waitUntil: "networkidle2" });
    step("favori kalıcı", (await pressedState(page)) === "true");
    await page.click('main form button[type="submit"][aria-pressed]');
    await page.waitForFunction(
      () => document.querySelector('main form button[type="submit"][aria-pressed]')?.getAttribute("aria-pressed") === "false",
      { timeout: NAV_TIMEOUT_MS },
    );
    await page.reload({ waitUntil: "networkidle2" });
    step("favori çıkar", (await pressedState(page)) === "false");

    await page.goto(`${BASE_URL}/ayarlar`, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    /* Silme formu bir düğmenin arkasında; düğme metni Türkçe rotada. */
    const opened = await page.evaluate(() => {
      const button = [...document.querySelectorAll("main button")].find((el) => el.textContent?.trim() === "Hesabımı Sil");
      button?.click();
      return Boolean(button);
    });
    step("silme formu", opened);
    await page.waitForSelector('input[name="confirm"]');
    await page.type('input[name="confirm"]', username);
    await page.type('input[name="password"]', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS }),
      page.$eval('input[name="confirm"]', (input) => input.form?.requestSubmit()),
    ]);
    await page.goto(`${BASE_URL}/ayarlar`, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    step("hesap silindi", new URL(page.url()).pathname.startsWith("/giris"), new URL(page.url()).pathname);
  } catch (error) {
    if (!steps.some((s) => !s.ok)) step(`beklenmeyen hata: ${String(error).slice(0, 120)}`, false);
  } finally {
    await context.close();
  }
  return steps;
}

/* -------------------------------------------------------------------------- */

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true });
let failed = 0;
try {
  console.log(`Duman testi: ${BASE_URL} · ${WIDTHS.join(" / ")} · ${CONCURRENCY} sekme\n`);
  const paths = [...ROUTES, NOT_FOUND_ROUTE].flatMap((route) => [
    route,
    route === "/" ? "/en" : `/en${route}`,
  ]);
  /* BİR KEZ YENİDEN DENE (28 Eylül). Koşum CI'da anahtarsız ve dış
     kaynaklara bağlı; tek bir anlık 502 bütün koşumu düşürüp bildirim
     gönderiyordu. Düşen sayfa bir kez daha açılıyor ve ancak İKİNCİ kez de
     düşerse hata sayılıyor: kalıcı bir hata (kırık sayfa, taşma, hidrasyon
     hatası) iki denemede de düşer ve yine yakalanır. İlk denemenin hatası
     günlükte "tekrar" notuyla kalıyor, gizlenmiyor. */
  const checkTwice = async (path, width) => {
    const first = await checkPage(browser, path, width);
    if (first.ok) return first;
    const second = await checkPage(browser, path, width);
    if (second.ok) {
      second.note = "";
      second.retried = `ilk deneme düştü: ${[...first.errors, first.note].filter(Boolean).join(" | ").slice(0, 200)}`;
    }
    return second;
  };
  const tasks = paths.flatMap((path) => WIDTHS.map((width) => () => checkTwice(path, width)));
  const results = await runPool(tasks, CONCURRENCY);
  failed += results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} sayfa kontrolü geçti.`);

  if (ALLOW_WRITES) {
    const steps = await writeFlow(browser).catch(() => [{ ok: false }]);
    failed += steps.filter((s) => !s.ok).length;
  } else {
    console.log("Yazma akışı atlandı (SMOKE_ALLOW_WRITES=1 ile açılır).");
  }
} finally {
  await browser.close();
}
process.exit(failed > 0 ? 1 : 0);
