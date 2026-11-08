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
        snapshot = {"tables": {
            "public.a": {"name": "a", "schema": "", "columns": {"id": {}, "ad": {}}},
            "public.b": {"name": "b", "schema": "", "columns": {"id": {}}},
        }}
        (self.root / "drizzle/meta/0001_snapshot.json").write_text(json.dumps(snapshot), encoding="utf-8")
        (self.root / "status.mjs").write_text(node_part(), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def run_status(self, rows, mode="check", accept="", columns=None, tables=None, app_state_max=None):
        fake = self.root / "node_modules/@neondatabase/serverless"
        fake.mkdir(parents=True, exist_ok=True)
        (fake / "package.json").write_text('{"name":"@neondatabase/serverless","type":"module","main":"index.js"}')
        (fake / "index.js").write_text(
            "const rows = " + json.dumps(rows) + ";\n"
            "const columns = " + json.dumps(columns or []) + ";\n"
            "const tables = " + json.dumps(tables or []) + ";\n"
            "const appStateMax = " + json.dumps(app_state_max) + ";\n"
            "export function neon() { const fn = (strings) => { const q = strings.join('');"
            " if (q.includes('to_regclass')) return Promise.resolve([{}]);"
            " if (q.includes('information_schema.tables')) return Promise.resolve(tables.map((t) => ({ table_name: t })));"
            " if (q.includes('information_schema')) return Promise.resolve(columns);"
            " return Promise.resolve(rows); };"
            " fn.query = (q, p) => { if (q.startsWith('drop') || q.startsWith('delete')) return { q, p };"
            " if (q.includes('max(updated_at)')) return Promise.resolve([{ m: appStateMax }]);"
            " return Promise.resolve([{ n: 7 }]); };"
            " fn.transaction = (qs) => { for (const x of qs) console.log('SQL', x.q, JSON.stringify(x.p || [])); return Promise.resolve([]); };"
            " return fn; }\n"
        )
        return subprocess.run(
            ["node", "status.mjs", mode, accept],
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

    def stray_rows(self):
        return [{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": "ab" * 32, "created_at": "1000.5"}]

    def test_kabul_yalniz_apply_ve_dogru_ozetle(self):
        self.assertEqual(self.run_status(self.stray_rows(), "apply", "abababababab").returncode, 0)
        self.assertEqual(self.run_status(self.stray_rows(), "apply", "cdcdcdcdcdcd").returncode, 3)
        self.assertEqual(self.run_status(self.stray_rows(), "check", "abababababab").returncode, 3)
        self.assertEqual(self.run_status(self.stray_rows(), "apply", "").returncode, 3)
        res = self.run_status(self.stray_rows(), "apply", "abababababab")
        self.assertIn("KABUL", res.stdout)
        self.assertIn("bekleyen: 0001_b", res.stdout)

    def test_diagnose_fazla_ve_eksik_semayi_bulur_ve_durmaz(self):
        cols = [
            {"table_name": "a", "column_name": "id"},
            {"table_name": "a", "column_name": "ad"},
            {"table_name": "a", "column_name": "fazla"},
            {"table_name": "yabanci", "column_name": "id"},
        ]
        res = self.run_status(self.stray_rows(), "diagnose", "", cols)
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("FAZLA SÜTUN: a.fazla", res.stdout)
        self.assertIn("FAZLA TABLO: yabanci", res.stdout)
        self.assertIn("EKSİK TABLO: b (bekleyen: 0001_b)", res.stdout)
        self.assertIn("şema farkı: 3", res.stdout)

    def test_diagnose_esit_sema(self):
        cols = [{"table_name": "a", "column_name": "id"}, {"table_name": "a", "column_name": "ad"}, {"table_name": "b", "column_name": "id"}]
        rows = [{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": self.sha("0001_b"), "created_at": "1001"}]
        res = self.run_status(rows, "diagnose", "", cols)
        self.assertIn("şema depoyla aynı", res.stdout)


    def clean_rows(self):
        return [{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": self.sha("0001_b"), "created_at": "1001"}, {"hash": "ab" * 32, "created_at": "1000.5"}]

    FOREIGN = ["a", "app_state", "app_state_history", "b", "memleket_scores", "oyz_rooms", "users_extra"]

    def test_cleanup_yalniz_kaliba_uyan_yabanci_tablolari_ve_satiri_siler(self):
        res = self.run_status(self.clean_rows(), "cleanup", "abababababab", tables=self.FOREIGN, app_state_max="2026-11-01T11:29:34.700Z")
        self.assertEqual(res.returncode, 0, res.stderr)
        for t in ["app_state", "app_state_history", "memleket_scores", "oyz_rooms"]:
            self.assertIn(f'SQL drop table "{t}"', res.stdout)
        self.assertNotIn('drop table "a"', res.stdout)
        self.assertNotIn("users_extra", res.stdout.replace("silinecek", ""))
        self.assertIn('SQL delete from drizzle.__drizzle_migrations where hash = $1 ["' + "ab" * 32 + '"]', res.stdout)
        self.assertIn("TEMİZLENDİ: 4 tablo, 1 kayıt satırı", res.stdout)

    def test_cleanup_ozetsiz_ya_da_yanlis_ozetle_durur(self):
        for accept in ["", "cdcdcdcdcdcd"]:
            res = self.run_status(self.clean_rows(), "cleanup", accept, tables=self.FOREIGN)
            self.assertEqual(res.returncode, 3, res.stdout)
            self.assertNotIn("SQL", res.stdout)

    def test_cleanup_oxxo_kopyadan_sonra_yazildiysa_durur(self):
        res = self.run_status(self.clean_rows(), "cleanup", "abababababab", tables=self.FOREIGN, app_state_max="2026-11-05T00:00:00Z")
        self.assertEqual(res.returncode, 3)
        self.assertIn("DUR: app_state kopyadan sonra", res.stdout)
        self.assertNotIn("SQL", res.stdout)

    def test_cleanup_depodaki_dosyanin_satirini_silmez(self):
        rows = [{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": self.sha("0001_b"), "created_at": "5000"}]
        res = self.run_status(rows, "cleanup", self.sha("0001_b")[:12], tables=self.FOREIGN)
        self.assertEqual(res.returncode, 3)
        self.assertNotIn("SQL", res.stdout)

    def test_cleanup_temizse_bir_sey_yapmaz(self):
        rows = [{"hash": self.sha("0000_a"), "created_at": "1000"}, {"hash": self.sha("0001_b"), "created_at": "1001"}]
        res = self.run_status(rows, "cleanup", "", tables=["a", "b"])
        self.assertEqual(res.returncode, 0, res.stderr)
        self.assertIn("temizlenecek bir şey yok", res.stdout)


if __name__ == "__main__":
    unittest.main()
