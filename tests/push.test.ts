import test from "node:test";
import assert from "node:assert/strict";
import { pushEndpointAllowed } from "../lib/push";

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
