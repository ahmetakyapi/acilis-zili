import assert from "node:assert/strict";
import { test } from "node:test";
import {
  POST_STATUSES,
  POST_TRANSITIONS,
  statusesAccepting,
  transition,
  type PostEvent,
  type PostStatus,
} from "../lib/user-posts";

/* Topluluk yazısının geçiş tablosu (lib/user-posts.ts). Eylemler
   (app/actions/user-posts.ts, moderation.ts) okudukları durumu koşul yapıp
   tablodaki hedefe yazar; tablo burada harfiyen sabitleniyor. */

const EVENTS: PostEvent[] = ["save", "submit", "withdraw", "approve", "reject"];

test("tam tablo: her durum × olay", () => {
  const expected: Record<PostStatus, Record<PostEvent, PostStatus | null>> = {
    draft: { save: "draft", submit: "pending", withdraw: null, approve: null, reject: null },
    pending: { save: "pending", submit: null, withdraw: "draft", approve: "published", reject: "rejected" },
    published: { save: "pending", submit: null, withdraw: null, approve: null, reject: null },
    rejected: { save: "draft", submit: "pending", withdraw: null, approve: null, reject: null },
  };
  for (const status of POST_STATUSES) {
    for (const event of EVENTS) {
      assert.equal(transition(status, event), expected[status][event], `${status} × ${event}`);
    }
  }
});

test("kaydet her durumda tanımlı: düzenleme hiçbir durumda reddedilmez", () => {
  for (const status of POST_STATUSES) assert.notEqual(transition(status, "save"), null, status);
});

test("yayına giden tek yol onay; yayından çıkan düzenleme kuyruğa döner", () => {
  for (const status of POST_STATUSES) {
    for (const event of EVENTS) {
      if (transition(status, event) === "published") assert.deepEqual([status, event], ["pending", "approve"]);
    }
  }
  assert.equal(transition("published", "save"), "pending");
});

test("koşullu yazma kümeleri tablodan türer", () => {
  assert.deepEqual(statusesAccepting("submit"), ["draft", "rejected"]);
  assert.deepEqual(statusesAccepting("withdraw"), ["pending"]);
  assert.deepEqual(statusesAccepting("approve"), ["pending"]);
  assert.deepEqual(statusesAccepting("reject"), ["pending"]);
  assert.deepEqual(statusesAccepting("save"), [...POST_STATUSES]);
});

test("tablodaki her hedef geçerli bir durum", () => {
  for (const row of Object.values(POST_TRANSITIONS)) {
    for (const target of Object.values(row)) assert.ok(POST_STATUSES.includes(target!), String(target));
  }
});
