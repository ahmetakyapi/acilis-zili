import test from "node:test";
import assert from "node:assert/strict";
import { defaultPushPref, isPushKind, PUSH_KINDS, resolvePushPrefs } from "../lib/push-prefs-model";

/** Push tür tercihleri — varsayılanlar (lib/push-prefs-model.ts). */

test("fiyat alarmı varsayılan AÇIK (eski davranış), herkes için", () => {
  assert.equal(defaultPushPref("price", "user"), true);
  assert.equal(defaultPushPref("price", "admin"), true);
  assert.equal(defaultPushPref("price", null), true);
});

test("haftalık özet varsayılan KAPALI, yalnız site sahibinde açık", () => {
  assert.equal(defaultPushPref("weekly", "user"), false);
  assert.equal(defaultPushPref("weekly", null), false);
  assert.equal(defaultPushPref("weekly", "admin"), true);
});

test("saklı satır varsayılanı ezer; bilinmeyen tür yok sayılır", () => {
  assert.deepEqual(resolvePushPrefs([], "user"), { price: true, weekly: false });
  assert.deepEqual(resolvePushPrefs([], "admin"), { price: true, weekly: true });
  assert.deepEqual(
    resolvePushPrefs(
      [
        { kind: "price", enabled: false },
        { kind: "weekly", enabled: true },
        { kind: "spam", enabled: true },
      ],
      "user",
    ),
    { price: false, weekly: true },
  );
  assert.deepEqual(resolvePushPrefs([{ kind: "weekly", enabled: false }], "admin"), { price: true, weekly: false });
});

test("tür listesi dışı değer reddedilir (eylem tarayıcıdan gelen türe güvenmez)", () => {
  assert.deepEqual([...PUSH_KINDS], ["price", "weekly"]);
  assert.ok(isPushKind("weekly"));
  assert.ok(!isPushKind("earnings"));
  assert.ok(!isPushKind(1));
  assert.ok(!isPushKind(undefined));
});
