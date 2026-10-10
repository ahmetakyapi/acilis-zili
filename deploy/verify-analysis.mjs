/** Run on the VPS after loading /etc/acilis-zili.env; no credentials leave this process. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { encode } from "next-auth/jwt";

let phase = "configuration";
// Yalnız bizim ürettiğimiz durum kodu ve rotanın sabit hata kodları; sağlayıcı metni değil.
let detail = "";
const VERDICTS = new Set(["buy", "hold", "sell", "insufficient"]);
const isScore = (value) => Number.isInteger(value) && value >= 0 && value <= 100;
try {
  const symbol = (process.env.VERIFY_SYMBOL || "NVDA").toUpperCase();
  const horizon = process.env.VERIFY_HORIZON || "short";
  assert(/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol) && (horizon === "short" || horizon === "medium"));
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  assert(secret && process.env.DATABASE_URL && process.env.CLAUDE_ANALYSIS_API_KEY);
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  const base = "http://127.0.0.1:3000";
  const headers = { host: site.host, "x-forwarded-host": site.host, "x-forwarded-proto": site.protocol.slice(0, -1) };
  phase = "owner lookup";
  const sql = neon(process.env.DATABASE_URL);
  const [owner] = await sql`select id, username, role from users where username=${"ahmetakyapi"} and role=${"admin"}`;
  assert(owner);
  // Auth.js cookie prefix depends on the proxy URL configuration; both use their own salt.
  const cookies = await Promise.all(["authjs.session-token", "__Secure-authjs.session-token"].map(async name => {
    const value = await encode({ token: { sub: owner.id, name: owner.username, role: owner.role }, secret, salt: name, maxAge: 300 });
    return `${name}=${value}`;
  }));
  const authorized = { ...headers, cookie: cookies.join("; ") };
  phase = "private API permission";
  const access = await fetch(`${base}/api/ai/analysis?symbol=NVDA&locale=tr`, { headers: authorized });
  assert.equal(access.status, 200);
  const body = await access.json();
  assert.equal(body.remaining, null);
  assert.equal(body.dailyLimit, null);
  assert(!JSON.stringify(body).includes(process.env.CLAUDE_ANALYSIS_API_KEY));
  console.log("Owner unlimited permission and private history: passed.");
  phase = "unauthorized API and Origin rejection";
  assert.equal((await fetch(`${base}/api/ai/analysis`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/api/ai/analysis`, { method: "POST", headers: { ...authorized, origin: "https://untrusted.invalid", "content-type": "application/json" }, body: "{}" })).status, 403);
  console.log("Unauthenticated access and cross-origin generation: rejected.");
  phase = "page visibility";
  for (const path of ["/hisse-secimi/NVDA", "/teknik/nvda"]) {
    const paidPage = await fetch(`${base}${path}`, { headers: authorized });
    assert.equal(paidPage.status, 200);
    assert((await paidPage.text()).includes("data-ai-analysis"));
    const freePage = await fetch(`${base}${path}`, { headers });
    assert.equal(freePage.status, 200);
    assert(!(await freePage.text()).includes("data-ai-analysis"));
  }
  console.log("Both stock pages: authorized panel present, free pages unchanged.");
  if (process.env.VERIFY_PAID_ANALYSIS === "1") {
    phase = "paid Claude generation";
    const requestId = randomUUID();
    const startedAt = Date.now();
    const response = await fetch(`${base}/api/ai/analysis`, {
      method: "POST", headers: { ...authorized, origin: site.origin, "content-type": "application/json" },
      body: JSON.stringify({ requestId, symbol, horizon, locale: "tr" }),
      signal: AbortSignal.timeout(180_000),
    });
    const report = await response.json().catch(() => ({}));
    detail = `HTTP ${response.status}${typeof report.error === "string" ? ` · ${report.error}` : ""}`;
    assert.equal(response.status, 200);
    phase = "report validation";
    const { output, sources } = report.result;
    assert(VERDICTS.has(output.verdict) && isScore(output.overallScore) && isScore(output.technicalScore));
    assert(output.newsScore === null || isScore(output.newsScore));
    assert(output.summary && output.reasons.length && output.risks.length && output.invalidation);
    assert(["low", "medium", "high"].includes(output.confidence) && output.watch.length > 0 && output.takeaways.length > 0);
    // Tetik seviyesi ya null ya da raporun kendi seviyelerinden biri (snapLevel); grafik buna dayanıyor.
    assert(report.result.pricePath?.chart.length > 1 && typeof report.result.quotePrice === "number");
    // Haber olmayan gün de geçerli rapordur; ölçülen, atıfların kaynağa düşmesi.
    assert(output.news.every((n) => n.sourceIndex < sources.length));
    assert(sources.length > 0 || output.newsScore === null);
    assert(!JSON.stringify(report).includes(process.env.CLAUDE_ANALYSIS_API_KEY));
    phase = "usage record";
    const [row] = await sql`select status, model, input_tokens, output_tokens from ai_analysis_requests where id = ${requestId}::uuid`;
    assert.equal(row?.status, "completed");
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`Live Claude generation passed: ${symbol} · ${horizon} · ${row.model} · ${seconds} s.`);
    console.log(`Verdict ${output.verdict} · overall ${output.overallScore} · technical ${output.technicalScore} · news ${output.newsScore ?? "—"} · ${sources.length} sources, ${output.news.length} cited.`);
    console.log(`Confidence ${output.confidence} · bull trigger ${output.bullLevel ?? "—"} · bear trigger ${output.bearLevel ?? "—"} · ${output.watch.length} watch items.`);
    console.log(`Tokens: ${row.input_tokens} in / ${row.output_tokens} out (output includes thinking).`);
  } else console.log("Paid generation skipped; enable workflow input to test one real report.");
} catch {
  // Upstream exceptions can include request metadata; log only our static phase.
  console.error(`Analysis verification failed during: ${phase}${detail ? ` (${detail})` : ""}. Credentials were not logged.`);
  process.exitCode = 1;
}
