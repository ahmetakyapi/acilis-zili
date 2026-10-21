import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** İş akışlarının sertleştirme sözleri (20 Ekim taraması) — gerekçeler deploy.yml'de. */

const DIR = join(__dirname, "..", ".github", "workflows");
const FILES = readdirSync(DIR).filter((name) => name.endsWith(".yml"));
const read = (name: string) => readFileSync(join(DIR, name), "utf8");

test("her eylem commit'e sabit, yanında okunur sürüm", () => {
  assert.ok(FILES.length > 0);
  for (const name of FILES) {
    for (const line of read(name).split("\n").filter((l) => /^\s*-?\s*uses:/.test(l))) {
      assert.match(line, /uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, `${name}: ${line.trim()}`);
    }
  }
});

test("her işin zaman aşımı var", () => {
  for (const name of FILES) {
    const text = read(name);
    const jobs = text.match(/^ {4}runs-on:/gm)?.length ?? 0;
    const timeouts = text.match(/^ {4}timeout-minutes: \d+$/gm)?.length ?? 0;
    assert.equal(timeouts, jobs, name);
  }
});

test("üye adresi günlüğe düşecek yoldan geçmiyor", () => {
  // `env:`e ya da komut dizesine giren `${{ }}` değeri günlük başlığında açık basılır.
  for (const name of FILES) assert.doesNotMatch(read(name), /\$\{\{\s*(github\.event\.)?inputs\.email\s*\}\}/, name);
  const mail = read("test-mail.yml");
  assert.match(mail, /jq -r '\.inputs\.email \/\/ empty' "\$GITHUB_EVENT_PATH"/);
  assert.ok(mail.indexOf("::add-mask::$ADDRESS") > mail.indexOf('{ echo "geçersiz adres"; exit 1; }'));
});

test("deploy'da anahtar eşitlemesi servisi yeniden başlatmıyor", () => {
  const steps = read("deploy.yml").split(/\n(?= {6}- )/);
  for (const script of ["sync-analysis-key.sh", "sync-app-env.sh"]) {
    const step = steps.find((s) => s.includes(`bash deploy/${script}`));
    assert.ok(step, script);
    assert.match(step, /RESTART: "0"/, script);
  }
});

test("doğrulama betiği root'la değil uygulama kullanıcısıyla koşuyor", () => {
  const text = read("verify-analysis.yml");
  assert.doesNotMatch(text, /sudo -n bash/);
  assert.match(text, /sudo -n -u acilis -H bash -c/);
});
