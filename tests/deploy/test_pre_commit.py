from pathlib import Path
import subprocess
import tempfile
import unittest

HOOK = Path(__file__).resolve().parents[2] / ".githooks/pre-commit"


def run(repo, *args):
    return subprocess.run(args, cwd=repo, capture_output=True, text=True)


class PreCommitTest(unittest.TestCase):
    def check(self, files):
        """Dosyaları stage'ler, kancayı koşar; (çıkış kodu, stderr)."""
        with tempfile.TemporaryDirectory() as repo:
            run(repo, "git", "init", "-q")
            for name, body in files.items():
                path = Path(repo) / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(body)
            run(repo, "git", "add", "-A")
            result = run(repo, "bash", str(HOOK))
            return result.returncode, result.stderr

    def test_clean_code_passes(self):
        self.assertEqual(self.check({"lib/a.ts": "export const a = 1;\n"})[0], 0)

    def test_temporary_marker_in_app_code_blocks(self):
        code, err = self.check({"components/x.tsx": 'const a = 1;\n<Card label="TMPTEST" />\n'})
        self.assertEqual(code, 1)
        self.assertIn("components/x.tsx:2", err)

    def test_console_log_allowed_in_scripts_but_not_lib(self):
        self.assertEqual(self.check({"scripts/s.mjs": "console.log(1);\n"})[0], 0)
        self.assertEqual(self.check({"lib/s.ts": "console.log(1);\n"})[0], 1)

    def test_secret_blocks_anywhere_but_example_env(self):
        key = "sk-ant-api03-" + "a" * 30
        self.assertEqual(self.check({"docs/x.md": f"anahtar {key}\n"})[0], 1)
        # Parça parça kuruluyor: tam hâli bu dosyada dursa kanca kendi testini durdurur.
        url = "postgresql://u:" + "supersecret1" + "@h/db"
        self.assertEqual(self.check({"x.ts": f"const u = '{url}';\n"})[0], 1)
        self.assertEqual(self.check({".env.example": "DATABASE_URL=\n"})[0], 0)


if __name__ == "__main__":
    unittest.main()
