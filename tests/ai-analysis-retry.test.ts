import assert from "node:assert/strict";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";

import { failureKind, isTransient } from "../lib/ai-analysis-errors";

test("overload and connection errors are transient, timeouts and bad requests are not", () => {
  assert.equal(isTransient(Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error", message: "x" } }, "x", new Headers())), true);
  assert.equal(isTransient(Anthropic.APIError.generate(500, undefined, "x", new Headers())), true);
  assert.equal(isTransient(new Anthropic.APIConnectionError({ message: "reset" })), true);
  assert.equal(isTransient(new Anthropic.APIConnectionTimeoutError()), false);
  assert.equal(isTransient(Anthropic.APIError.generate(400, undefined, "x", new Headers())), false);
  assert.equal(isTransient(new Error("invalid-output")), false);
});

test("failure kind names the class, status and API error type without the message", () => {
  const overloaded = Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error", message: "secret" } }, "secret", new Headers());
  assert.ok(failureKind(overloaded).endsWith("529 overloaded_error"));
  assert.ok(!failureKind(overloaded).includes("secret"));
  assert.equal(failureKind(new Error("invalid-output")), "invalid-output");
});
