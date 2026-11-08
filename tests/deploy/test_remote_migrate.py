"""deploy/remote-migrate.sh — migration durum raporu ve güvenlik durdurması (8 Kasım 2026).

Betiğin gömülü Node bölümü (`status`) sahte bir `@neondatabase/serverless`
modülüyle koşturuluyor: `neon()` sabit kayıt satırları döndürüyor. Böylece
kayıt ile depo listesinin karşılaştırması, eşleşmeyen satırın teşhisi
(içerik özeti hangi dosyaya uyuyor) ve çıkış kodları gerçek veritabanına
dokunmadan sınanıyor. İş akışının `check`i kod 2/3'ü uyarıya çevirir
(.github/workflows/migrate.yml); burada yalnız betiğin kendi kodları.
"""

from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "deploy/remote-migrate.sh"


def node_part() -> str:
    text = SCRIPT.read_text(encoding="utf-8")
    return re.search(r"<<'JS'\n(.*?)\nJS\n", text, re.S).group(1)


class RemoteMigrateStatusTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "drizzle/meta").mkdir(parents=True)
        self.files = {"0000_a": "create table a();", "0001_b": "create table b();"}
        entries = []
        for idx, (tag, sql) in enumerate(self.files.items()):
            (self.root / f"drizzle/{tag}.sql").write_text(sql, encoding="utf-8")
            entries.append({"idx": idx, "tag": tag, "when": 1000 + idx})
        (self.root / "drizzle/meta/_journal.json").write_text(json.dumps({"entries": entries}), encoding="utf-8")
        (self.root / "status.mjs").write_text(node_part(), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def run_status(self, rows):
        fake = self.root / "node_modules/@neondatabase/serverless"
        fake.mkdir(parents=True, exist_ok=True)
        (fake / "package.json").write_text('{"name":"@neondatabase/serverless","type":"module","main":"index.js"}')
        (fake / "index.js").write_text(
            "const rows = " + json.dumps(rows) + ";\n"
            "export function neon() { return (strings) => strings.join('').includes('to_regclass')"
            " ? Promise.resolve([{}]) : Promise.resolve(rows); }\n"
        )
        return subprocess.run(
            ["node", "status.mjs", "check"],
            cwd=self.root,
            capture_output=True,
            text=True,
            env={**os.environ, "DATABASE_URL": "postgres://sahte"},
        )

    def sha(self, tag):
        return hashlib.sha256(self.files[tag].encode()).hexdigest()

    def test_kayit_depoyla_esit_bekleyen_yok(self):
        res = self.run_status([{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": self.sha("0001_b"), "created_at": "1001"}])
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("bekleyen: yok", res.stdout)
        self.assertNotIn("eşleşmeyen kayıt", res.stdout)

    def test_bekleyen_sondaysa_durmaz(self):
        res = self.run_status([{"hash": self.sha("0000_a"), "created_at": "1000"}])
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("bekleyen: 0001_b", res.stdout)

    def test_depoda_olmayan_kayit_teshis_ve_kod_3(self):
        res = self.run_status([{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": "f" * 64, "created_at": "1000.5"}])
        self.assertEqual(res.returncode, 3, res.stderr)
        self.assertIn("içerik depodaki hiçbir dosyaya uymuyor", res.stdout)
        self.assertIn("DUR: kayıttaki son migration depoda yok", res.stdout)

    def test_ayni_icerik_baska_damgayla_adiyla_soylenir(self):
        res = self.run_status([{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": self.sha("0001_b"), "created_at": "999999"}])
        self.assertEqual(res.returncode, 3, res.stderr)
        self.assertIn("içerik 0001_b ile AYNI", res.stdout)


if __name__ == "__main__":
    unittest.main()
