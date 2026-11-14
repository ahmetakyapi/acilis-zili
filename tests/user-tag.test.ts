import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { logReason, userCacheTag, userLogId } from "../lib/user-tag";

/**
 * Kişisel Claude notlarının etiketi ve günlük kimliği (lib/user-tag.ts).
 * İkinci yarı kaynağı okur: kişisel sonuç veren her önbellek etiketi
 * taşımalı ve hesap silme onu düşürmeli — yeni bir kişisel önbellek
 * etiketsiz girerse hesap silinince notu kalır.
 */

const ROOT = process.cwd();

test("etiket kimliği taşır, günlük kimliği taşımaz", () => {
  const id = "3f0c1c0e-7a52-4a53-9d5b-0d1a5e1f7a10";
  assert.equal(userCacheTag(id), `user:${id}`);
  assert.ok(userCacheTag(id).length <= 256, "Next etiketi 256 karakterde keser");
  assert.match(userLogId(id), /^[0-9a-f]{8}$/);
  assert.equal(userLogId(id), userLogId(id));
  assert.notEqual(userLogId(id), userLogId(`${id}x`));
  assert.ok(!id.includes(userLogId(id)));
});

test("günlüğe nedenin kodu yazılır, notun parçası ve sorgu yazılmaz", () => {
  assert.equal(logReason(new Error("ungrounded (12,5 %3 1.250)")), "ungrounded");
  assert.equal(logReason(new Error("advice (hisseyi satmalısın | kâr al)")), "advice");
  assert.equal(logReason(new Error("no-output")), "no-output");
  assert.equal(logReason(new Error("Failed query: select … params: 3f0c1c0e-7a52-4a53-9d5b-0d1a5e1f7a10")), "db");
  assert.equal(logReason(new Error("x".repeat(500))).length, 80);
  assert.equal(logReason("metin"), "?");
  assert.equal(logReason(new Error("")), "?");
});

function sources(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) return sources(rel);
    return rel.endsWith(".ts") ? [rel] : [];
  });
}

/** `unstable_cache(` çağrısının kapanan paranteze kadarki metni. */
function cacheCalls(source: string): string[] {
  const calls: string[] = [];
  for (let at = source.indexOf("unstable_cache("); at !== -1; at = source.indexOf("unstable_cache(", at + 1)) {
    let depth = 0;
    for (let i = at + "unstable_cache".length; i < source.length; i += 1) {
      if (source[i] === "(") depth += 1;
      else if (source[i] === ")" && (depth -= 1) === 0) {
        calls.push(source.slice(at, i + 1));
        break;
      }
    }
  }
  return calls;
}

test("anahtarında kullanıcı kimliği olan her önbellek `user:<kimlik>` etiketini taşır", () => {
  const personal: string[] = [];
  for (const file of sources("lib")) {
    for (const call of cacheCalls(readFileSync(path.join(ROOT, file), "utf8"))) {
      /* Kişisel önbellek: keyParts dizisinde `userId` geçer. */
      const keyParts = call.match(/\[\s*"[a-z0-9-]+-v\d+"[^\]]*\]/)?.[0] ?? "";
      if (!/\buserId\b/.test(keyParts)) continue;
      personal.push(file);
      assert.match(call, /tags: \[[^\]]*userCacheTag\(userId\)[^\]]*\]/, `${file}: kişisel önbellek etiketsiz`);
      /* Var olan etiket korunur: ilk öğe önbelleğin kendi etiketi. */
      assert.match(call, /tags: \["[a-z-]+", userCacheTag\(userId\)\]/, `${file}: önbelleğin kendi etiketi düşmüş`);
    }
  }
  assert.deepEqual(personal.sort(), [
    "lib/portfolio-advisor.ts",
    "lib/portfolio-analysis-note.ts",
    "lib/portfolio-earnings-desk.ts",
    "lib/portfolio-question.ts",
    "lib/portfolio-scan.ts",
    "lib/portfolio-weekly-note.ts",
    "lib/risk/note.ts",
    "lib/watchlist-note.ts",
    "lib/watchlist-today.ts",
  ]);
});

test("hesap silme etiketi düşürür", () => {
  const source = readFileSync(path.join(ROOT, "app/actions/auth.ts"), "utf8");
  const start = source.indexOf("export async function deleteAccountAction");
  const action = source.slice(start, source.indexOf("export async function", start + 1));
  const deleted = action.indexOf("db.delete(users)");
  const revalidated = action.indexOf("revalidateTag(userCacheTag(userId), { expire: 0 })");
  assert.ok(deleted !== -1 && revalidated > deleted, "etiket, hesap silindikten sonra düşürülmeli");
  assert.ok(revalidated < action.indexOf("signOut("), "signOut yönlendirir; sonrası çalışmaz");
});

test("kişisel not günlüğü kullanıcı kimliğini ve hata nesnesini basmaz", () => {
  const files = [
    "lib/portfolio-advisor.ts",
    "lib/portfolio-analysis-note.ts",
    "lib/portfolio-earnings-desk.ts",
    "lib/portfolio-question.ts",
    "lib/portfolio-scan.ts",
    "lib/portfolio-weekly-note.ts",
    "lib/risk/note.ts",
    "lib/watchlist-note.ts",
    "lib/watchlist-today.ts",
  ];
  for (const file of files) {
    const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n").filter((line) => line.includes("console."));
    assert.ok(lines.length > 0, `${file}: günlük satırı bekleniyordu`);
    for (const line of lines) {
      assert.ok(!line.includes("${userId}"), `${file}: ${line.trim()}`);
      assert.ok(!line.includes("error.message"), `${file}: ${line.trim()}`);
      assert.ok(!line.includes("missing.join"), `${file}: ${line.trim()}`);
      assert.ok(!/,\s*error\)/.test(line), `${file}: ${line.trim()}`);
    }
  }
});
