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

/* Adım kipi (24 Ekim) — `::: akis adim`, `::: oncesi adim`. Bayrak yalnız
   blok türünden hemen sonra ve tam `adim` sözcüğüyle açılıyor; eski bloklar
   `stepped` alanını hiç taşımıyor (şekilleri birebir aynı). */
test("adım kipi: akis ve oncesi bayrağı etiketten ayrılır", () => {
  const md = [
    "::: akis adim Bir Kararın Yolu",
    "Fed | faiz iner",
    "Tahvil | getiri düşer",
    ":::",
    "",
    "::: oncesi adim Piyasa Değeri",
    "52,5 Mr $ | 12 Haziran",
    "19 Mr $ | 29 Temmuz",
    ":::",
  ].join("\n");
  const [flow, shift] = parseBlocks(md, "tr");
  assert.equal(flow.kind, "flow");
  assert.equal(shift.kind, "shift");
  if (flow.kind !== "flow" || shift.kind !== "shift") return;
  assert.equal(flow.label, "Bir Kararın Yolu");
  assert.equal(flow.stepped, true);
  assert.equal(flow.items.length, 2);
  assert.equal(shift.label, "Piyasa Değeri");
  assert.equal(shift.stepped, true);
  assert.ok(shift.deltaPct !== null && Math.abs(shift.deltaPct + 63.8095) < 0.001);
});

test("adım kipi: bayraksız blok ve benzer etiket kipi açmaz", () => {
  const blocks = parseBlocks(
    [
      "::: akis Adım Adım Kriz",
      "A | 1",
      "B | 2",
      ":::",
      "::: akis Zincir adim",
      "A | 1",
      "B | 2",
      ":::",
      "::: oncesi Değer",
      "1 | a",
      "2 | b",
      ":::",
    ].join("\n"),
    "tr",
  );
  for (const block of blocks) assert.equal("stepped" in block, false, JSON.stringify(block));
  assert.equal(blocks[0].kind === "flow" && blocks[0].label, "Adım Adım Kriz");
  assert.equal(blocks[1].kind === "flow" && blocks[1].label, "Zincir adim");
});

test("adım kipi: tek halkalı akışta kip açılmaz, etiketsiz bayrak çalışır", () => {
  const [single, bare] = parseBlocks(
    ["::: akis adim Tek", "A | 1", ":::", "::: akis adim", "A | 1", "B | 2", ":::"].join("\n"),
    "tr",
  );
  assert.equal(single.kind === "flow" && "stepped" in single, false);
  assert.equal(bare.kind === "flow" && bare.stepped, true);
  assert.equal(bare.kind === "flow" && bare.label, "");
});

test("bar: tipografik eksi (U+2212) negatif okunur", () => {
  const [bars] = parseBlocks("::: bar Kayıp\nLam | −%11,64\nMeta | −6.98%\nSOX | +2\n:::", "tr");
  assert.equal(bars.kind, "bars");
  if (bars.kind !== "bars") return;
  assert.deepEqual(bars.items.map((item) => item.value), [-11.64, -6.98, 2]);
  assert.equal(bars.items[0].display, "−%11,64");
});

/* Nötr kip (25 Ekim) — `::: bar notr`: büyüklük, yön değil. Bayrak yalnız
   blok türünden hemen sonra ve tam `notr` sözcüğüyle. */
test("bar notr: bayrak etiketten ayıklanır, eski bloklar şeklini korur", () => {
  const [neutral, titled, plain] = parseBlocks(
    [
      "::: bar notr 100 $ Brüt Temettüden Yolda Kesilen",
      "ABD ETF | %30",
      "İrlanda ETF | %15",
      ":::",
      "::: bar Nötr Bölge",
      "A | 1",
      ":::",
      "::: bar Getiri",
      "A | %5",
      ":::",
    ].join("\n"),
    "tr",
  );
  assert.equal(neutral.kind === "bars" && neutral.neutral, true);
  assert.equal(neutral.kind === "bars" && neutral.label, "100 $ Brüt Temettüden Yolda Kesilen");
  assert.deepEqual(neutral.kind === "bars" && neutral.items.map((item) => item.value), [30, 15]);
  assert.equal("neutral" in titled, false);
  assert.equal(titled.kind === "bars" && titled.label, "Nötr Bölge");
  assert.equal("neutral" in plain || "unscaled" in plain, false);
});

/* Birimli değerler (25 Ekim) — gerekçe `barValues`. */
test("bar: aynı birimdeki değerler sayıya çevrilir, etiket yazıldığı gibi kalır", () => {
  const [en] = parseBlocks("::: bar Financings\nA | $2.3B\nB | $22B\nC | −$1.0B\n:::", "en");
  assert.equal(en.kind === "bars" && "unscaled" in en, false);
  assert.deepEqual(en.kind === "bars" && en.items.map((item) => item.value), [2.3, 22, -1]);
  assert.equal(en.kind === "bars" && en.items[0].display, "$2.3B");

  const [tr] = parseBlocks("::: bar İadeler\nA | 2.190 Mn $\nB | 986 Mn $\nC | ~300 Mn $\nD | 11,8 Mn $\n:::", "tr");
  assert.deepEqual(tr.kind === "bars" && tr.items.map((item) => item.value), [2190, 986, 300, 11.8]);

  /* Binlik ayıracı dile göre: İngilizcede virgül binlik. */
  const [enThousands] = parseBlocks("::: bar Refunds\nA | $2,190M\nB | $986M\n:::", "en");
  assert.deepEqual(enThousands.kind === "bars" && enThousands.items.map((item) => item.value), [2190, 986]);

  const [bp] = parseBlocks("::: bar Spreads\nA | 105 bp\nB | 118 bp\n:::", "en");
  assert.deepEqual(bp.kind === "bars" && bp.items.map((item) => item.value), [105, 118]);
});

test("bar: birim karışık, aralık ya da metin varsa ölçeksiz liste (değerler 0)", () => {
  const cases = [
    "::: bar Dip\nA | %7\nB | -%38\nC | -1,3 Mr $\n:::", // % ile Mr $
    "::: bar Fark\nA | 105 bp\nB | 20–30 bp\n:::", // aralık
    "::: bar Hareket\nA | +%27,1\nB | yatay\n:::", // metin
    "::: bar Oran\nA | %40+\nB | %25\n:::", // "%+" ile "%"
    "::: bar Kat\nA | 1.5 kat\nB | 1,9 kat\n:::", // tr'de bozuk gruplama
  ];
  for (const md of cases) {
    const [block] = parseBlocks(md, "tr");
    assert.equal(block.kind === "bars" && block.unscaled, true, md);
    assert.ok(block.kind === "bars" && block.items.every((item) => item.value === 0), md);
  }
});

test("bar: yalın sayı ve yüzde eskisi gibi okunur", () => {
  const [block] = parseBlocks("::: bar Getiri\nA | 12,5\nB | -%3\nC | 7%\n:::", "tr");
  assert.equal(block.kind === "bars" && "unscaled" in block, false);
  assert.deepEqual(block.kind === "bars" && block.items.map((item) => item.value), [12.5, -3, 7]);
});

test("bar: dilin binlik yazımı eski okumanın ölçek hatasını düzeltir", () => {
  /* cloudflare-karisik-amacli-tarayici-15-eylul: "4.580" 4,58 okunuyordu. */
  const [tr] = parseBlocks("::: bar Sayfa\nA | 4.580\nB | 848\nC | 1,5\n:::", "tr");
  assert.deepEqual(tr.kind === "bars" && tr.items.map((item) => item.value), [4580, 848, 1.5]);
  const [en] = parseBlocks("::: bar Pages\nA | 4,580\nB | 848\nC | 1.5\n:::", "en");
  assert.deepEqual(en.kind === "bars" && en.items.map((item) => item.value), [4580, 848, 1.5]);
  /* Dile uymayan yazım eskisi gibi: İngilizce yazıda "-28,6%". */
  const [mixed] = parseBlocks("::: bar Move\nA | -28,6%\nB | 4%\n:::", "en");
  assert.deepEqual(mixed.kind === "bars" && mixed.items.map((item) => item.value), [-28.6, 4]);
});
