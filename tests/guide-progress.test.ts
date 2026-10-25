import assert from "node:assert/strict";
import test from "node:test";
import { guideArticles, GUIDE_SLUGS, GUIDE_TOPICS } from "../content/guide";
import { chapterTone } from "../components/guide/chapter-tone";
import { levelRange, nextUnread, parseReadList, READ_LIST_CAP, topicProgress, withRead } from "../lib/guide-progress";
import { guideVisualsEn, guideVisualsTr } from "../lib/i18n/dictionaries/guide-visuals";

test("bozuk ya da eski depo hiç okunmamış sayılır", () => {
  assert.deepEqual(parseReadList(null), []);
  assert.deepEqual(parseReadList(""), []);
  assert.deepEqual(parseReadList("{"), []);
  assert.deepEqual(parseReadList('{"a":1}'), []);
  assert.deepEqual(parseReadList('["hisse-senedi", 3, "", null, "hisse-senedi"]'), ["hisse-senedi"]);
});

test("müfredatta olmayan ad atılır, liste tavanlı", () => {
  const known = new Set<string>(GUIDE_SLUGS);
  assert.deepEqual(parseReadList('["hisse-senedi","yok-boyle-yazi"]', known), ["hisse-senedi"]);
  const many = JSON.stringify(Array.from({ length: READ_LIST_CAP + 50 }, (_, i) => `y${i}`));
  assert.equal(parseReadList(many).length, READ_LIST_CAP);
});

test("withRead zaten okunanı yeniden yazmaz", () => {
  const list = ["a"];
  assert.equal(withRead(list, "a"), list);
  assert.deepEqual(withRead(list, "b"), ["a", "b"]);
});

test("konu ilerlemesi müfredat sırasıyla ve toplamı yazı sayısı", () => {
  const articles = guideArticles("tr");
  const read = new Set([articles[0]!.slug, articles[1]!.slug]);
  const progress = topicProgress(articles, read);
  assert.equal(progress[0]!.topic, articles[0]!.topic);
  assert.equal(progress.reduce((sum, entry) => sum + entry.total, 0), articles.length);
  assert.equal(progress.reduce((sum, entry) => sum + entry.read, 0), 2);
});

test("sıradaki okunmamış: başlamamışsa ve bitirmişse yok", () => {
  const articles = guideArticles("tr");
  assert.equal(nextUnread(articles, new Set()), null);
  assert.equal(nextUnread(articles, new Set([articles[0]!.slug]))?.slug, articles[1]!.slug);
  assert.equal(nextUnread(articles, new Set(articles.map((a) => a.slug))), null);
});

test("ad alanı iki dilde aynı anahtarlar, uzun tire yok", () => {
  assert.deepEqual(Object.keys(guideVisualsEn).sort(), Object.keys(guideVisualsTr).sort());
  for (const value of [...Object.values(guideVisualsTr), ...Object.values(guideVisualsEn)]) {
    assert.ok(!/[—–]/.test(value), value);
  }
});

test("seviye aralığı kolaydan zora sıra numarasıyla; tanınmayan seviye atılır", () => {
  const order = ["temel", "orta", "ileri"];
  assert.deepEqual(levelRange(["temel", "orta"], order), [0, 1]);
  assert.deepEqual(levelRange(["ileri", "orta"], order), [1, 2]);
  assert.deepEqual(levelRange(["orta"], order), [1, 1]);
  assert.equal(levelRange([], order), null);
  assert.equal(levelRange(["uzman"], order), null);
});

test("her bölümün kendi tonu ve ikonu var; dört ton birbirinden ayrı", () => {
  const tones = GUIDE_TOPICS.map((topic) => chapterTone(topic.key));
  assert.equal(new Set(tones).size, GUIDE_TOPICS.length);
  for (const tone of tones) assert.match(tone, /^var\(--(chart-[acd]|share-1)\)$/);
  // Pirinç (`--chart-b`) "TUT" görüşüyle karışır; bölüm tonu olamaz.
  assert.ok(!tones.includes("var(--chart-b)"));
  assert.equal(chapterTone("yok-boyle-bolum"), "var(--primary-soft)");
});
