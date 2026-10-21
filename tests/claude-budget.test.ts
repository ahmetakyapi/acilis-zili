import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_DAILY_CALLS, ClaudeBudgetError, MEMBER_DAILY_CALLS, memberClient, refundCall, takeCall } from "../lib/claude-budget";

/**
 * Claude çağrı bütçesi (lib/claude-budget.ts): tek anonim istemci günlük
 * tavanı bitiremez, oturumlu notların payı kalır; üyeler birlikte de nöbetin
 * son onda birine dokunamaz. Sayaç modül düzeyinde — testler SIRAYLA aynı
 * günün sayacını paylaşır.
 */

test("bir istemci kendi payını aşınca reddedilir, öteki istemci etkilenmez", () => {
  process.env.INSIGHT_DAILY_CAP = "100";
  for (let i = 0; i < CLIENT_DAILY_CALLS; i += 1) takeCall("claude:203.0.113.7");
  assert.throws(() => takeCall("claude:203.0.113.7"), ClaudeBudgetError);
  assert.doesNotThrow(() => takeCall("claude:198.51.100.9"));
});

test("anonim uçlar tavanın %80'inde durur, nöbet kalan beşte biri kullanır", () => {
  process.env.INSIGHT_DAILY_CAP = "40";
  /* Önceki test 31 hak harcadı; anonim tavan 32. */
  assert.doesNotThrow(() => takeCall("claude:192.0.2.1"));
  assert.throws(() => takeCall("claude:192.0.2.2"), ClaudeBudgetError);
  for (let i = 0; i < 8; i += 1) takeCall();
  assert.throws(() => takeCall(), ClaudeBudgetError);
});

test("ücretlenmeyen çağrının hakkı geri verilir", () => {
  refundCall();
  assert.doesNotThrow(() => takeCall());
  assert.throws(() => takeCall(), ClaudeBudgetError);
});

test("geri verme istemcinin günlük sayacını da açar", () => {
  process.env.INSIGHT_DAILY_CAP = "1000";
  const client = "claude:203.0.113.50";
  for (let i = 0; i < CLIENT_DAILY_CALLS; i += 1) takeCall(client);
  /* Reddedilen denemeler sayacı şişirmez — yoksa geri verilen hak açılmazdı. */
  assert.throws(() => takeCall(client), ClaudeBudgetError);
  assert.throws(() => takeCall(client), ClaudeBudgetError);
  refundCall(client);
  assert.doesNotThrow(() => takeCall(client));
  assert.throws(() => takeCall(client), ClaudeBudgetError);
});

test("üye kendi günlük sayacıyla sınırlı, anonimin %80'inde durmaz", () => {
  process.env.INSIGHT_DAILY_CAP = "1000";
  const member = memberClient("user-1");
  for (let i = 0; i < MEMBER_DAILY_CALLS; i += 1) takeCall(member);
  assert.throws(() => takeCall(member), ClaudeBudgetError);
  assert.doesNotThrow(() => takeCall(memberClient("user-2")));
  /* Şimdiye dek 40 + 30 + 16 = 86 hak: anonim tavan 80'de, üye 90'a kadar. */
  process.env.INSIGHT_DAILY_CAP = "100";
  assert.throws(() => takeCall("claude:198.51.100.77"), ClaudeBudgetError);
  assert.doesNotThrow(() => takeCall(memberClient("user-3")));
});

test("üyeler birlikte %90'da durur, son onda bir yalnız nöbetin", () => {
  process.env.INSIGHT_DAILY_CAP = "100";
  /* Önceki test 87 hak harcadı. Her biri kendi sayacının çok altında kalan
     yeni hesaplar da toplamda 90'ı geçemez (kayıt açık). */
  for (let i = 0; i < 3; i += 1) takeCall(memberClient(`fresh-${i}`));
  assert.throws(() => takeCall(memberClient("fresh-3")), ClaudeBudgetError);
  /* Toplam tavanın reddi üyenin kendi sayacına yazılmaz: tavan yükselince açılır. */
  process.env.INSIGHT_DAILY_CAP = "1000";
  for (let i = 0; i < MEMBER_DAILY_CALLS; i += 1) takeCall(memberClient("fresh-3"));
  assert.throws(() => takeCall(memberClient("fresh-3")), ClaudeBudgetError);
  /* Toplam 105, tavan 110: üye 99'da, anonim 88'de durmuş; kalan beş hak nöbetin. */
  process.env.INSIGHT_DAILY_CAP = "110";
  assert.throws(() => takeCall(memberClient("fresh-4")), ClaudeBudgetError);
  assert.throws(() => takeCall("claude:198.51.100.78"), ClaudeBudgetError);
  for (let i = 0; i < 5; i += 1) takeCall();
  assert.throws(() => takeCall(), ClaudeBudgetError);
});
