import test from "node:test";
import assert from "node:assert/strict";

import { checkBearer } from "../lib/api-auth";

/**
 * Yetki isteyen uçların tek kapısı. Dosyanın karar yorumundaki iki söz
 * tutuluyor: üretimde anahtar yoksa uç AÇIK KALMAZ (503), anahtar varsa
 * yalnız tam eşleşen belirteç geçer.
 */

const SECRET = "dogru-anahtar-0123456789";

/** `NODE_ENV`i yalnız `fn` süresince değiştirir; sonra eski değeri (yokluğu dahil) geri koyar. */
function withNodeEnv<T>(value: string | undefined, fn: () => T): T {
  const env = process.env as Record<string, string | undefined>;
  const had = Object.prototype.hasOwnProperty.call(env, "NODE_ENV");
  const before = env.NODE_ENV;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
  try {
    return fn();
  } finally {
    if (had) env.NODE_ENV = before;
    else delete env.NODE_ENV;
  }
}

function request(authorization?: string): Request {
  return new Request("https://aciliszili.com/api/cron/daily", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

const UNAUTHORIZED = { ok: false, status: 401, error: "unauthorized" };
const NOT_CONFIGURED = { ok: false, status: 503, error: "secret-not-configured" };

test("yardımcı: NODE_ENV test bitince eski değerine döner", () => {
  const before = process.env.NODE_ENV;
  withNodeEnv("production", () => assert.equal(process.env.NODE_ENV, "production"));
  assert.equal(process.env.NODE_ENV, before);
  assert.throws(() => withNodeEnv("production", () => { throw new Error("x"); }));
  assert.equal(process.env.NODE_ENV, before, "fırlatan gövdeden sonra da");
});

/* ---- Anahtar tanımsız ---- */

test("anahtar yok, geliştirme: uç açık", () => {
  withNodeEnv("development", () => {
    assert.deepEqual(checkBearer(request(), undefined), { ok: true });
    assert.deepEqual(checkBearer(request("Bearer herhangi"), undefined), { ok: true });
  });
});

test("anahtar yok, NODE_ENV test ya da tanımsız: üretim sayılmaz, açık", () => {
  withNodeEnv("test", () => assert.deepEqual(checkBearer(request(), undefined), { ok: true }));
  withNodeEnv(undefined, () => assert.deepEqual(checkBearer(request(), undefined), { ok: true }));
});

test("anahtar yok, üretim: 503 — sessiz açık kapı değil görünür hata", () => {
  withNodeEnv("production", () => {
    assert.deepEqual(checkBearer(request(), undefined), NOT_CONFIGURED);
  });
});

test("anahtar yok, üretim: başlık ne olursa olsun 503", () => {
  withNodeEnv("production", () => {
    assert.deepEqual(checkBearer(request("Bearer herhangi"), undefined), NOT_CONFIGURED);
    assert.deepEqual(checkBearer(request("Bearer undefined"), undefined), NOT_CONFIGURED);
    assert.deepEqual(checkBearer(request("Bearer "), undefined), NOT_CONFIGURED);
  });
});

test("boş dize anahtar tanımsız sayılır: üretimde 503, geliştirmede açık", () => {
  withNodeEnv("production", () => {
    assert.deepEqual(checkBearer(request(), ""), NOT_CONFIGURED);
    /* `Bearer ` + "" eşleşmesi kapıyı açmamalı. */
    assert.deepEqual(checkBearer(request("Bearer "), ""), NOT_CONFIGURED);
  });
  withNodeEnv("development", () => assert.deepEqual(checkBearer(request(), ""), { ok: true }));
});

/* ---- Anahtar tanımlı ---- */

for (const env of ["production", "development", "test", undefined]) {
  const label = env ?? "tanımsız";

  test(`anahtar var (${label}): başlık yok → 401`, () => {
    withNodeEnv(env, () => assert.deepEqual(checkBearer(request(), SECRET), UNAUTHORIZED));
  });

  test(`anahtar var (${label}): yanlış anahtar → 401`, () => {
    withNodeEnv(env, () => {
      assert.deepEqual(checkBearer(request("Bearer yanlis-anahtar-0123456789"), SECRET), UNAUTHORIZED);
    });
  });

  test(`anahtar var (${label}): doğru anahtar → geçer`, () => {
    withNodeEnv(env, () => {
      assert.deepEqual(checkBearer(request(`Bearer ${SECRET}`), SECRET), { ok: true });
    });
  });
}

test("geliştirme rahatlığı yalnız anahtar YOKKEN: anahtar varsa geliştirmede de başlık şart", () => {
  withNodeEnv("development", () => {
    assert.equal(checkBearer(request(), SECRET).ok, false);
  });
});

test("şema Bearer değilse 401: çıplak anahtar, Basic, boş başlık", () => {
  assert.deepEqual(checkBearer(request(SECRET), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(`Basic ${SECRET}`), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(`Token ${SECRET}`), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(""), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(`Bearer${SECRET}`), SECRET), UNAUTHORIZED);
});

test("belirteç boşsa 401", () => {
  assert.deepEqual(checkBearer(request("Bearer"), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request("Bearer "), SECRET), UNAUTHORIZED);
});

test("kısmi eşleşme geçmez: ön ek, son ek, fazladan karakter", () => {
  assert.deepEqual(checkBearer(request(`Bearer ${SECRET.slice(0, -1)}`), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(`Bearer ${SECRET.slice(1)}`), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(`Bearer ${SECRET}x`), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(`Bearer x${SECRET}`), SECRET), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request(`Bearer ${SECRET} ${SECRET}`), SECRET), UNAUTHORIZED);
});

test("aynı uzunlukta tek karakter farkı geçmez (başta, ortada, sonda)", () => {
  for (const at of [0, Math.floor(SECRET.length / 2), SECRET.length - 1]) {
    const wrong = `${SECRET.slice(0, at)}#${SECRET.slice(at + 1)}`;
    assert.equal(wrong.length, SECRET.length);
    assert.deepEqual(checkBearer(request(`Bearer ${wrong}`), SECRET), UNAUTHORIZED, `konum ${at}`);
  }
});

test("büyük/küçük harf farkı geçmez", () => {
  assert.deepEqual(checkBearer(request(`Bearer ${SECRET.toUpperCase()}`), SECRET), UNAUTHORIZED);
});

test("belirteçten önce fazladan boşluk geçmez", () => {
  assert.deepEqual(checkBearer(request(`Bearer  ${SECRET}`), SECRET), UNAUTHORIZED);
});

test("bayt uzunluğu farklı belirteç fırlatmaz, 401 döner", () => {
  /* `timingSafeEqual` eşit olmayan tamponlarda FIRLATIR; karakter sayısı
     aynı, bayt sayısı farklı girdi (é = 2 bayt) 500'e değil 401'e gitmeli. */
  assert.deepEqual(checkBearer(request("Bearer é"), "e"), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request("Bearer é"), "ab"), UNAUTHORIZED);
  assert.deepEqual(checkBearer(request("Bearer e"), "é"), UNAUTHORIZED);
});

test("ASCII dışı anahtar tam eşleşince geçer", () => {
  assert.deepEqual(checkBearer(request("Bearer café"), "café"), { ok: true });
});

test("başlık adı büyük/küçük harfe duyarsız okunur", () => {
  const upper = new Request("https://aciliszili.com/api/cron/daily", {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  assert.deepEqual(checkBearer(upper, SECRET), { ok: true });
});

test("anahtar adresteki sorgudan okunmaz", () => {
  const viaQuery = new Request(`https://aciliszili.com/api/cron/daily?secret=${SECRET}&authorization=Bearer%20${SECRET}`);
  assert.deepEqual(checkBearer(viaQuery, SECRET), UNAUTHORIZED);
});
