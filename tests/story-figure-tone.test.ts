import test from "node:test";
import assert from "node:assert/strict";
import { figureTone } from "../components/stories/figure-tone";

/* Kapak rakamının yönü (components/stories/figure-tone.ts): renk ve ikon
   yalnız yazarın yazdığı işaretten gelir; işaretsiz büyüklük nötrdür. */

test("eksi işareti aşağı yön", () => {
  assert.equal(figureTone("−%42,9"), "down");
  assert.equal(figureTone("-%42,9"), "down");
  assert.equal(figureTone("%−5"), "down");
  assert.equal(figureTone("-3,2 Mr $"), "down");
  assert.equal(figureTone("▼ %4"), "down");
});

test("artı işareti yukarı yön", () => {
  assert.equal(figureTone("+%12,53"), "up");
  assert.equal(figureTone("%+2,30"), "up");
  assert.equal(figureTone("▲ 1,2 puan"), "up");
  assert.equal(figureTone("~+%3"), "up");
});

test("işaretsiz büyüklük ve yaklaşık değer nötr", () => {
  assert.equal(figureTone("9,6 Mr $"), "flat");
  assert.equal(figureTone("352,3 Mr $"), "flat");
  assert.equal(figureTone("~2 Mr $"), "flat");
  assert.equal(figureTone("27.122,09"), "flat");
  assert.equal(figureTone("730 bin"), "flat");
  assert.equal(figureTone("Participation"), "flat");
});

test("tire ancak sayıdan önceyse eksidir", () => {
  assert.equal(figureTone("10-K"), "flat");
  assert.equal(figureTone("-yüksek"), "flat");
});

test("işaretli sıfır yönsüz", () => {
  assert.equal(figureTone("+%0"), "flat");
  assert.equal(figureTone("−0,00"), "flat");
});
