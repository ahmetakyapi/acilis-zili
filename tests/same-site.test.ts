import test from "node:test";
import assert from "node:assert/strict";
import { sameSite } from "../lib/same-site";

/* Site kapısı (lib/same-site.ts). Üretimde `next start -H 127.0.0.1 -p 3000`
   Caddy'nin arkasında: `request.url` iç adresi taşıyor. `Sec-Fetch-Site`
   göndermeyen eski tarayıcının `Origin` yedeği ona karşılaştırılıyordu ve
   hiç eşleşmiyordu (20 Ekim). */

const behindProxy = (headers: Record<string, string>) =>
  new Request("https://127.0.0.1:3000/api/olcum", { method: "POST", headers });

test("eski tarayıcı: Origin tarayıcının gördüğü adla eşleşiyor", () => {
  assert.equal(
    sameSite(behindProxy({ origin: "https://aciliszili.com", "x-forwarded-host": "aciliszili.com" })),
    true,
  );
  assert.equal(sameSite(behindProxy({ origin: "https://aciliszili.com", host: "aciliszili.com" })), true);
});

test("başka sitenin Origin'i düşüyor", () => {
  assert.equal(
    sameSite(behindProxy({ origin: "https://kotu.example", "x-forwarded-host": "aciliszili.com" })),
    false,
  );
  assert.equal(sameSite(behindProxy({ origin: "null", host: "aciliszili.com" })), false);
});

test("Sec-Fetch-Site varsa karar onun", () => {
  assert.equal(sameSite(behindProxy({ "sec-fetch-site": "same-origin" })), true);
  assert.equal(sameSite(behindProxy({ "sec-fetch-site": "cross-site", origin: "https://aciliszili.com", host: "aciliszili.com" })), false);
});

test("başlıkların ikisi de yoksa geçiyor (sendBeacon bazı ortamlarda Origin göndermiyor)", () => {
  assert.equal(sameSite(behindProxy({})), true);
});
