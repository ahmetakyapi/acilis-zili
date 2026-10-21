import test from "node:test";
import assert from "node:assert/strict";
import {
  headingIds,
  INLINE_PATTERN,
  isTableDivider,
  legacyHeadingIds,
  LINK_PATTERN,
  parseBlocks,
  type Block,
} from "../components/article/parse-blocks";

/* Yazı gövdesi ayrıştırıcısı (components/article/parse-blocks.ts).

   İlerleme garantisi: `#`, `>` ya da ayraçsız `|` ile başlayan ama başlık,
   alıntı ya da tablo olmayan satır dış döngüyü sonsuza kilitliyordu (20
   Ekim). Gerileme olursa bu dosya askıda kalır ve bellek bitince çöker —
   o da başarısızlıktır. */

const para = (text: string): Block => ({ kind: "paragraph", text });

test("blok başlatıcıyla başlayan ama blok olmayan satır paragraf olur", () => {
  const cases: [string, Block[]][] = [
    ["#", [para("#")]],
    ["##", [para("##")]],
    ["#### Alt", [para("#### Alt")]],
    ["#1 sırada", [para("#1 sırada")]],
    [">alıntı", [para(">alıntı")]],
    ["| a | b |", [para("| a | b |")]],
    ["|", [para("|")]],
    ["Metin\n| a |", [para("Metin"), para("| a |")]],
    [
      "> a\n>\n> b",
      [
        { kind: "quote", lines: ["a"] },
        para(">"),
        { kind: "quote", lines: ["b"] },
      ],
    ],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(parseBlocks(input, "tr"), expected, JSON.stringify(input));
  }
});

test("olağan başlık, paragraf ve tablo değişmedi", () => {
  const md = [
    "## Başlık",
    "",
    "İlk satır",
    "ikinci satır",
    "### Alt Başlık",
    "| Şirket | Pay |",
    "|---|:---:|",
    "| NVDA | 27 |",
    "| AMD | 12 |",
  ].join("\n");
  assert.deepEqual(parseBlocks(md, "tr"), [
    { kind: "heading", level: 2, text: "Başlık" },
    para("İlk satır ikinci satır"),
    { kind: "heading", level: 3, text: "Alt Başlık" },
    {
      kind: "table",
      head: ["Şirket", "Pay"],
      rows: [
        ["NVDA", "27"],
        ["AMD", "12"],
      ],
    },
  ]);
});

test("paragraf sonraki satırdaki blok başlatıcıda kesilir", () => {
  assert.deepEqual(parseBlocks("Metin\n## Başlık", "tr"), [
    para("Metin"),
    { kind: "heading", level: 2, text: "Başlık" },
  ]);
});

test("kalıtılan anahtar kutu türü sayılmaz, ozet'e iner", () => {
  assert.deepEqual(parseBlocks("::: constructor\nsatır\n:::", "tr"), [
    {
      kind: "callout",
      tone: "ozet",
      label: "Özet",
      lines: [{ term: null, text: "satır" }],
    },
  ]);
  const [proto] = parseBlocks("::: __proto__ Not\nsatır\n:::", "en");
  assert.equal(proto.kind === "callout" && proto.tone, "ozet");
  assert.equal(proto.kind === "callout" && proto.label, "Not");
  const [summary] = parseBlocks("::: ozet\nsatır\n:::", "en");
  assert.equal(summary.kind === "callout" && summary.label, "Summary");
});

/* Eski düzenli ifade — doğrusal denetimin kâhini. */
const oldDivider = (line: string) =>
  /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");

test("tablo ayracı denetimi eskisiyle aynı ve doğrusal", () => {
  const alphabet = ["|", "-", ":", " ", "\t", "x"];
  const walk = (prefix: string, depth: number) => {
    assert.equal(isTableDivider(prefix), oldDivider(prefix), JSON.stringify(prefix));
    if (depth === 0) return;
    for (const ch of alphabet) walk(prefix + ch, depth - 1);
  };
  walk("", 5);

  const started = performance.now();
  assert.equal(isTableDivider("|".repeat(39_000) + "x"), false);
  // Eski ifade bu satırda ~3 sn sürüyordu.
  assert.ok(performance.now() - started < 250);
});

test("bağlantı etiketi ve adresi sınırlı", () => {
  const link = (label: number, href: number) =>
    `[${"a".repeat(label)}](/${"b".repeat(href - 1)})`;
  const matches = (text: string) => (text.match(INLINE_PATTERN) ?? []).length;

  assert.equal(matches(`önce ${link(300, 2048)} sonra`), 1);
  assert.ok(LINK_PATTERN.test(link(300, 2048)));
  assert.equal(matches(link(301, 10)), 0);
  assert.equal(matches(link(10, 2049)), 0);
  assert.equal(LINK_PATTERN.test(link(301, 10)), false);
  assert.equal(matches("[Bilançolar](/bilancolar) ve **kalın**"), 2);
});

/* Eski tekilleştirme — her kopyada eki 2'den arıyordu. */
function oldIds(blocks: readonly Block[]): (string | null)[] {
  const used = new Set<string>();
  return blocks.map((block) => {
    if (block.kind !== "heading") return null;
    const base = headingIds([block])[0];
    if (!base) return null;
    let id = base;
    for (let copy = 2; used.has(id); copy += 1) id = `${base}-${copy}`;
    used.add(id);
    return id;
  });
}

test("başlık kimlikleri eskisiyle aynı, kopyalar doğrusal", () => {
  const heading = (text: string): Block => ({ kind: "heading", level: 2, text });
  assert.deepEqual(
    headingIds(["a", "a", "a 2", "a", "a 3", "a"].map(heading)),
    ["b-a", "b-a-2", "b-a-2-2", "b-a-3", "b-a-3-2", "b-a-4"],
  );

  /* Tohumlu rastgele diziler: çakışan kökler ("a 2" ile ikinci "a"). */
  const words = ["a", "a 2", "a 2 2", "a 3", "b", "b a 2", "%"];
  let seed = 7;
  const next = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed;
  };
  for (let round = 0; round < 2_000; round += 1) {
    const blocks = Array.from({ length: 1 + (next() % 12) }, () =>
      heading(words[next() % words.length]),
    );
    assert.deepEqual(headingIds(blocks), oldIds(blocks), JSON.stringify(blocks));
  }

  const many = Array.from({ length: 8_000 }, () => heading("a"));
  const started = performance.now();
  const ids = headingIds(many);
  // Eski tekilleştirme burada çağrı başına ~2 sn sürüyordu.
  assert.ok(performance.now() - started < 250);
  assert.equal(ids[7_999], "b-a-8000");
  assert.deepEqual(legacyHeadingIds(many, ids), legacyHeadingIds(many));
});
