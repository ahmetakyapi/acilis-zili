import test from "node:test";
import assert from "node:assert/strict";
import { readTextCapped } from "../lib/read-body";

/* Gövde tavanı (lib/read-body.ts, 20 Ekim). Parçalı ya da HTTP/2 gövdesi
   `Content-Length` taşımıyor; 15 Ekim kalıbı başlığı 0 okuyup gövdenin
   tamamını belleğe aldıktan sonra uzunluk soruyordu. Tavan okurken
   sayılmalı ve aşıldığı an akış bırakılmalı. */

const streamed = (body: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) =>
  new Request("https://site.test/api/olcum", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit);

test("Content-Length tavanı aşıyorsa gövde hiç okunmuyor", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(10));
      controller.close();
    },
  });
  const request = streamed(body, { "content-length": "999999" });
  assert.equal(await readTextCapped(request, 4096), null);
  assert.equal(request.bodyUsed, false);
});

test("uzunluksuz sonsuz gövde tavanda kesiliyor ve akış iptal ediliyor", async () => {
  let pulled = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  assert.equal(await readTextCapped(streamed(body), 4096), null);
  /* 4 KB tavan, 1 KB parça: beşinci parçada durur (akışın tampon payıyla). */
  assert.ok(pulled < 10, `okunan parça: ${pulled}`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelled, true);
});

test("tavanın altındaki gövde, parça sınırında bölünen UTF-8 harfle birlikte okunuyor", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ path: "/hisse/ŞİŞE" }));
  const cut = bytes.indexOf(0xc5) + 1; // "Ş"nin iki baytının arasından böl
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, cut));
      controller.enqueue(bytes.slice(cut));
      controller.close();
    },
  });
  assert.equal(await readTextCapped(streamed(body), 4096), '{"path":"/hisse/ŞİŞE"}');
});

test("tam tavan kadar gövde kabul ediliyor, bir bayt fazlası değil", async () => {
  const exact = new Request("https://site.test/x", { method: "POST", body: "a".repeat(16) });
  assert.equal(await readTextCapped(exact, 16), "a".repeat(16));
  const over = new Request("https://site.test/x", { method: "POST", body: "a".repeat(17) });
  assert.equal(await readTextCapped(over, 16), null);
});

test("gövdesiz istek boş metin", async () => {
  assert.equal(await readTextCapped(new Request("https://site.test/x", { method: "POST" }), 16), "");
});
