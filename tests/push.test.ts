import test from "node:test";
import assert from "node:assert/strict";
import { createECDH } from "node:crypto";
import { deliverPush, isPublicAddress, pushEndpointAllowed, pushKeysValid, pushSubscriptionSchema } from "../lib/push";

/* Push uç adresi doğrulaması (lib/push.ts → pushEndpointAllowed). Uç adres
   okuyucudan geliyor; sunucu ona POST atıyor. Gerçek servisler hep alan adı
   kullanıyor, IP-literal ve localhost yalnız sunucuyu kendi iç ağına
   yöneltmeye yarar. */

test("gerçek push servisleri kabul edilir", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://web.push.apple.com/QGv",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
    "https://ntfy.example.org/up123", // UnifiedPush dağıtıcısı
  ]) {
    assert.equal(pushEndpointAllowed(endpoint), true, endpoint);
  }
});

test("iç ağa yönelten uç adresler reddedilir", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/x",
    "https://127.0.0.1/x",
    "https://10.0.0.5/x",
    "https://169.254.169.254/latest",
    "https://[::1]/x",
    "https://localhost/x",
    "https://app.localhost/x",
    "https://intranet/x",
    "https://push.example.com:8443/x",
    "https://user:pass@push.example.com/x",
    "not a url",
  ]) {
    assert.equal(pushEndpointAllowed(endpoint), false, endpoint);
  }
});

/* Anahtar doğrulaması (lib/push.ts → pushKeysValid, 20 Ekim). web-push
   65 baytlık eğri üstü nokta ve ≥16 baytlık `auth` istemezse EŞZAMANLI
   fırlatıyordu; bozuk anahtarlı tek satır alarm taramasını yarıda
   kesiyordu. Şema böyle satırı hiç kaydetmez, teslim onu 410 sayar. */

const goodKey = () => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return ecdh.getPublicKey().toString("base64url");
};
const goodAuth = Buffer.alloc(16, 7).toString("base64url");
const offCurve = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url");

test("geçerli anahtar kabul, kısa/eğri dışı/kısa auth ret", () => {
  assert.equal(pushKeysValid(goodKey(), goodAuth), true);
  assert.equal(pushKeysValid(`${goodKey()}=`, goodAuth), true, "dolgulu base64url");
  assert.equal(pushKeysValid("AAAA", goodAuth), false);
  assert.equal(pushKeysValid(offCurve, goodAuth), false);
  assert.equal(pushKeysValid(goodKey(), "AAAA"), false);
});

test("şema bozuk anahtarlı aboneliği kaydettirmez", () => {
  const endpoint = "https://push.example.com/a";
  assert.equal(pushSubscriptionSchema.safeParse({ endpoint, keys: { p256dh: goodKey(), auth: goodAuth } }).success, true);
  assert.equal(pushSubscriptionSchema.safeParse({ endpoint, keys: { p256dh: "AAAA", auth: goodAuth } }).success, false);
});

test("bozuk anahtarlı satır teslimde fırlatmaz, ölü (410) sayılır", async () => {
  const status = await deliverPush({ endpoint: "https://push.example.com/a", keys: { p256dh: offCurve, auth: goodAuth } }, "{}");
  assert.equal(status, 410);
});

/* Alan adı üzerinden iç ağa istek (14 Kasım güvenlik denetimi): metin
   denetimini geçen bir ad özel adrese çözülebilir; teslimden önce çözülen
   adres de denetlenir. */
test("özel, döngü ve bağlantı-yerel adresler genel sayılmaz", () => {
  for (const address of [
    "10.0.0.5", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1",
    "::ffff:10.0.0.5", "::ffff:127.0.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("genel adresler kabul edilir", () => {
  for (const address of ["142.250.74.10", "172.15.0.1", "172.32.0.1", "100.63.0.1", "2a00:1450:4001:81b::200a", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});
