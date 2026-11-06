"""deploy/disk-guard.sh — derleme öncesi disk bekçisi (6 Kasım 2026, run 334).

`df` ve `npm` PATH'in başına konan sahte betiklerle taklit ediliyor: `df`
boş alanı bir dosyadan okuyor, `npm cache clean` o dosyadaki değeri
artırıyor. Böylece üç kademe (Turbopack önbelleği, npm önbelleği, dur)
gerçek diske dokunmadan sınanıyor.
"""

from pathlib import Path
import os
import subprocess
import tempfile
import time
import unittest

GUARD = Path(__file__).resolve().parents[2] / "deploy/disk-guard.sh"


def run_guard(root: Path, bin_dir: Path, command: str) -> subprocess.CompletedProcess:
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "MIN_FREE_MB": "4096"}
    return subprocess.run(
        ["bash", "-c", f'. "{GUARD}"; {command} "{root}"'],
        capture_output=True,
        text=True,
        env=env,
    )


class DiskGuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.root = base / "app"
        self.bin = base / "bin"
        self.bin.mkdir()
        self.free = base / "free"
        for name in ("a", "b"):
            cache = self.root / "releases" / name / ".next" / "cache"
            (cache / "turbopack").mkdir(parents=True)
            (cache / "turbopack" / "00000001.sst").write_text("x")
            (cache / "images").mkdir()
        (self.root / "shared" / "fetch-cache").mkdir(parents=True)
        df = self.bin / "df"
        df.write_text(
            "#!/usr/bin/env bash\n"
            f'echo "Filesystem 1M-blocks Used Available Capacity Mounted"\n'
            f'echo "/dev/sda1 50000 1 $(cat {self.free}) 1% /"\n'
        )
        npm = self.bin / "npm"
        npm.write_text(
            "#!/usr/bin/env bash\n"
            f'[[ "$1 $2" == "cache clean" ]] && echo $(( $(cat {self.free}) + 3000 )) > {self.free}\n'
        )
        df.chmod(0o755)
        npm.chmod(0o755)

    def tearDown(self):
        self.tmp.cleanup()

    def set_free(self, mb: int):
        self.free.write_text(str(mb))

    def test_removes_turbopack_cache_but_keeps_runtime_caches(self):
        self.set_free(10000)
        result = run_guard(self.root, self.bin, "ensure_build_space")
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in ("a", "b"):
            cache = self.root / "releases" / name / ".next" / "cache"
            self.assertFalse((cache / "turbopack").exists())
            self.assertTrue((cache / "images").is_dir())
        self.assertTrue((self.root / "shared" / "fetch-cache").is_dir())

    def test_cleans_npm_cache_when_still_short(self):
        self.set_free(2000)
        result = run_guard(self.root, self.bin, "ensure_build_space")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("npm önbelleği temizlendi", result.stdout)
        self.assertEqual(self.free.read_text().strip(), "5000")

    def test_stops_before_build_when_space_cannot_be_freed(self):
        self.set_free(100)
        result = run_guard(self.root, self.bin, "ensure_build_space")
        self.assertEqual(result.returncode, 1)
        self.assertIn("YER YETMİYOR", result.stderr)

    def test_missing_releases_dir_is_not_an_error(self):
        self.set_free(10000)
        empty = Path(self.tmp.name) / "bos"
        empty.mkdir()
        result = run_guard(empty, self.bin, "reclaim_build_cache")
        self.assertEqual(result.returncode, 0, result.stderr)


class FetchCachePruneTest(unittest.TestCase):
    """Sahte `df`, ortak önbellekten silinen her büyük kayıt için 1.000 MB
    boşalmış gibi davranır; budamanın sırası ve küçük kayıtların kaldığı
    böylece sınanır (6 Kasım, run 335: fetch-cache 34 GB)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.root = base / "app"
        self.cache = self.root / "shared" / "fetch-cache"
        self.cache.mkdir(parents=True)
        (self.root / "releases").mkdir()
        self.bin = base / "bin"
        self.bin.mkdir()
        self.base = base / "base"
        self.old_big = self.cache / "eski-buyuk"
        self.new_big = self.cache / "yeni-buyuk"
        self.note = self.cache / "claude-notu"
        for path, size in ((self.old_big, 200_000), (self.new_big, 200_000), (self.note, 8_000)):
            path.write_bytes(b"x" * size)
        two_hours_ago = time.time() - 7200
        for path in (self.old_big, self.note):
            os.utime(path, (two_hours_ago, two_hours_ago))
        df = self.bin / "df"
        df.write_text(
            "#!/usr/bin/env bash\n"
            f"gone=$(( 2 - $(find {self.cache} -type f -size +100k | wc -l) ))\n"
            'echo "Filesystem 1M-blocks Used Available Capacity Mounted"\n'
            f'echo "/dev/sda1 50000 1 $(( $(cat {self.base}) + gone * 1000 )) 1% /"\n'
        )
        npm = self.bin / "npm"
        npm.write_text(f'#!/usr/bin/env bash\n[[ "$1 $2" == "cache clean" ]] && echo $(( $(cat {self.base}) + 3000 )) > {self.base}\n')
        df.chmod(0o755)
        npm.chmod(0o755)

    def tearDown(self):
        self.tmp.cleanup()

    def test_recent_large_entries_survive_when_old_ones_suffice(self):
        self.base.write_text("3500")
        result = run_guard(self.root, self.bin, "ensure_build_space")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.old_big.exists())
        self.assertTrue(self.new_big.exists())
        self.assertTrue(self.note.exists())

    def test_prunes_all_large_entries_then_npm_but_keeps_small_notes(self):
        self.base.write_text("1500")
        result = run_guard(self.root, self.bin, "ensure_build_space")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.old_big.exists())
        self.assertFalse(self.new_big.exists())
        self.assertTrue(self.note.exists())
        self.assertIn("npm önbelleği temizlendi", result.stdout)


if __name__ == "__main__":
    unittest.main()
