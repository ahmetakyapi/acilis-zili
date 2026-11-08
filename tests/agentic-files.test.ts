import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Agentic dosyaların tazeliği (8 Kasım). CLAUDE.md, `.claude/rules/*.md` ve
 * `.claude/skills/*\/SKILL.md` kod tabanına dosya yoluyla atıf yapıyor;
 * dosya taşınınca ya da silinince kural sessizce eskiyor ve ajan var
 * olmayan bir yere bakıyor. Bu test CI'da (deploy.yml → npm test) koşar:
 * eskiyen atıf kırmızı test olarak hemen görünür.
 */
const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const ruleFiles = readdirSync(path.join(ROOT, ".claude/rules")).filter((f) => f.endsWith(".md")).map((f) => `.claude/rules/${f}`);
const skillFiles = readdirSync(path.join(ROOT, ".claude/skills"))
  .map((d) => `.claude/skills/${d}/SKILL.md`)
  .filter((f) => existsSync(path.join(ROOT, f)));
const docs = ["CLAUDE.md", ...ruleFiles, ...skillFiles];

/** Ters tırnak içindeki depo yolları: bilinen kök dizinle başlayan, joker ve yer tutucu içermeyenler. */
function referencedPaths(text: string): string[] {
  const roots = /^(app|components|lib|deploy|docs|content|tests|scripts|drizzle|public|\.github|\.claude)\//;
  const out = new Set<string>();
  for (const match of text.matchAll(/`([^`\s]+)`/g)) {
    let ref = match[1].replace(/[),.;:]+$/, "").split(" ")[0];
    ref = ref.replace(/^\.\//, "").split(/\s|→/)[0];
    if (!roots.test(ref) && !/^(CLAUDE|AGENTS|README)\.md$|^(proxy|auth|next\.config)\.ts$/.test(ref)) continue;
    if (/[*{}<>]|\.\.\.|\$/.test(ref)) continue;
    out.add(ref.replace(/\/$/, ""));
  }
  return [...out];
}

test("CLAUDE.md 200 satırın altında (Claude Code önerisi; uzun dosya uyumu düşürür)", () => {
  const lines = read("CLAUDE.md").split("\n").length;
  assert.ok(lines <= 200, `CLAUDE.md ${lines} satır; yalnız belirli dizinlere ait kuralı .claude/rules/'a, prosedürü skill'e taşı`);
});

for (const doc of docs) {
  test(`${doc}: atıf yapılan her dosya yolu var`, () => {
    const missing = referencedPaths(read(doc)).filter((ref) => !existsSync(path.join(ROOT, ref)));
    assert.deepEqual(missing, [], `${doc} var olmayan yollara atıf yapıyor: ${missing.join(", ")}`);
  });
}

/** Basit glob → RegExp (**, *, {a,b}); kural `paths:` kalıpları için yeterli. */
function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*" && glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
    else if (ch === "*") re += "[^/]*";
    else if (ch === "{") { const end = glob.indexOf("}", i); re += `(${glob.slice(i + 1, end).split(",").join("|")})`; i = end; }
    else re += ch.replace(/[.+?^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function listFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(path.join(ROOT, dir))) {
    if (["node_modules", ".next", ".git", "worktrees"].includes(name)) continue;
    const rel = dir === "." ? name : `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) listFiles(rel, acc);
    else acc.push(rel);
  }
  return acc;
}

test("her kural dosyasının paths: kalıpları en az bir dosyayla eşleşiyor", () => {
  const files = listFiles(".");
  for (const rule of ruleFiles) {
    const front = read(rule).match(/^---\n([\s\S]*?)\n---/);
    assert.ok(front, `${rule}: paths: frontmatter yok (kural her oturumda yüklenir; yol kapsamlı olmalı)`);
    const globs = [...front[1].matchAll(/-\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.ok(globs.length > 0, `${rule}: paths: listesi boş`);
    for (const glob of globs) {
      const re = globToRegExp(glob);
      assert.ok(files.some((f) => re.test(f)), `${rule}: "${glob}" hiçbir dosyayla eşleşmiyor (dosya taşındı mı?)`);
    }
  }
});

test("her skill'in name ve description frontmatter'ı var, name dizin adıyla aynı", () => {
  for (const skill of skillFiles) {
    const front = read(skill).match(/^---\n([\s\S]*?)\n---/);
    assert.ok(front, `${skill}: frontmatter yok`);
    const name = front[1].match(/^name:\s*(.+)$/m)?.[1].trim();
    assert.equal(name, skill.split("/")[2], `${skill}: name dizin adıyla aynı olmalı`);
    assert.match(front[1], /^description:\s*\S/m, `${skill}: description yok (otomatik çağrı onunla seçiliyor)`);
  }
});
