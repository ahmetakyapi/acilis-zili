import assert from "node:assert/strict";
import test from "node:test";
import { briefPreviewCut } from "../lib/brief";

const paragraph = "A complete paragraph about the market and the reasons behind today's changes. ";
const longTail = [paragraph.repeat(5), paragraph.repeat(5), paragraph.repeat(5)];

test("short list items do not prematurely end a reading preview", () => {
  const lines = [paragraph.repeat(4), paragraph.repeat(4), "- SK Hynix %8,1", "- Rohm %7,8", "- Samsung %5,3", paragraph.repeat(8), ...longTail];
  const cut = briefPreviewCut(lines);
  assert.equal(cut, 6);
  assert.ok(lines.slice(0, cut).includes("- Samsung %5,3"));
});

test("a list stays with its introduction even after the text threshold", () => {
  const lines = [paragraph.repeat(5), paragraph.repeat(5), paragraph.repeat(5), "The complete list follows:", "- First", "- Second", ...longTail];
  assert.equal(briefPreviewCut(lines), 6);
});

test("a section heading stays with its following paragraph", () => {
  for (const heading of ["## This Week", "**This Week**"]) {
    const lines = [paragraph.repeat(5), paragraph.repeat(5), paragraph.repeat(5), heading, paragraph.repeat(3), ...longTail];
    assert.equal(briefPreviewCut(lines), 5);
  }
});

test("short briefs and small remaining tails have no disclosure", () => {
  assert.equal(briefPreviewCut(["A short update.", "- One", "- Two"]), 3);
  const lines = [paragraph.repeat(5), paragraph.repeat(5), paragraph.repeat(5), paragraph.repeat(5), "One last note.", "A source note."];
  assert.equal(briefPreviewCut(lines), lines.length);
});

test("the requested longer preview still applies on quiet earnings days", () => {
  const lines = Array.from({ length: 12 }, () => paragraph.repeat(5));
  assert.equal(briefPreviewCut(lines, 8), 8);
});
