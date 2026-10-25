import test from "node:test";
import assert from "node:assert/strict";
import { tileFeedsBell } from "../components/today/day-tile";

/* Son seans karosu (components/today/DaySeal.tsx): karo her seansta en
   yeni tamamlanmış seansı gösteriyor, zile şiddeti yalnız bitmiş seansın
   kendi karosu veriyor. */

const FRIDAY = "2026-10-23";
const MONDAY = "2026-10-26";

test("asıl seans ve ön seansta karo zile şiddet vermez (dünün seansı)", () => {
  assert.equal(tileFeedsBell({ session: "regular", sessionDate: MONDAY }, FRIDAY), false);
  assert.equal(tileFeedsBell({ session: "pre-market", sessionDate: MONDAY }, FRIDAY), false);
});

test("kapanıştan sonra o seansın karosu zile şiddet verir", () => {
  assert.equal(tileFeedsBell({ session: "after-hours", sessionDate: MONDAY }, MONDAY), true);
  assert.equal(tileFeedsBell({ session: "closed", sessionDate: FRIDAY }, FRIDAY), true);
});

test("poster henüz hazır değilken önceki seansın karosu şiddet vermez", () => {
  assert.equal(tileFeedsBell({ session: "after-hours", sessionDate: MONDAY }, FRIDAY), false);
});
