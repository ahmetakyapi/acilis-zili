import test from "node:test";
import assert from "node:assert/strict";
import { birlestir } from "../lib/kurallar";

test("taslak işaretli dosya kuralları kapatır", () => {
  const result = birlestir([
    { file: "ortak.md", text: "# Ortak\n\nkural" },
    { file: "mercek.md", text: "<!-- durum: taslak -->\n# Mercek" },
  ]);
  assert.deepEqual(result, { ok: false, reason: "draft", files: ["mercek.md"] });
});

test("birleştirme sırayı korur ve sürüm içerikten türer", () => {
  const a = birlestir([
    { file: "ortak.md", text: "# Ortak\n" },
    { file: "gunluk.md", text: "# Günlük\n" },
  ]);
  const b = birlestir([
    { file: "ortak.md", text: "# Ortak\n" },
    { file: "gunluk.md", text: "# Günlük (değişti)\n" },
  ]);
  assert.ok(a.ok && b.ok);
  assert.equal(a.text, "# Ortak\n\n---\n\n# Günlük\n");
  assert.equal(a.version.length, 12);
  assert.notEqual(a.version, b.version);
});
