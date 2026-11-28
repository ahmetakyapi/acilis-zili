import assert from "node:assert/strict";
import test from "node:test";
import { isChunkLoadError } from "../lib/error-report";

/* Eski sürüm parçası hatası tek seferlik yenilemeyle karşılanır (lib/error-report.ts). */

test("parça yükleme hataları tanınır, başka hatalar değil", () => {
  assert.equal(isChunkLoadError("Failed to load chunk /_next/static/chunks/0jnm2cdhe_lcp.css from module 73493"), true);
  assert.equal(isChunkLoadError("ChunkLoadError: Loading chunk 123 failed."), true);
  assert.equal(isChunkLoadError("Loading CSS chunk 45 failed"), true);
  assert.equal(isChunkLoadError("Cannot read properties of undefined"), false);
});
