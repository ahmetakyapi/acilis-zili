"""Mavi-yeşil deploy (11 Kasım) — deploy/bluegreen-setup.sh ve cron betikleri.

Sunucuya dokunan adımlar (systemctl, visudo, caddy) burada koşmaz; sınanan
iki saf parça:
  1. Caddyfile'ın yerinde dönüşümü (`caddy_block`): tek upstream'li blok iki
     upstream'e ve sağlık yoklamasına döner, alan adı ve bloğun geri kalanı
     (transport) aynen kalır.
  2. Cron betiklerinin canlı portu okuması: dosya yoksa 3000, varsa içindeki
     port.
"""

from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SETUP = ROOT / "deploy/bluegreen-setup.sh"

CADDY = """x.com {
\tencode zstd gzip
\treverse_proxy 127.0.0.1:3000 {
\t\ttransport http {
\t\t\tresponse_header_timeout 180s
\t\t}
\t}
}
"""


def function_source(name: str) -> str:
    text = SETUP.read_text()
    match = re.search(rf"^{name}\(\) \{{\n.*?^\}}\n", text, re.S | re.M)
    assert match, f"{name} bulunamadı"
    return match.group(0)


class CaddyBlockTest(unittest.TestCase):
    def transform(self, extra: str) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            caddyfile = Path(tmp) / "Caddyfile"
            caddyfile.write_text(CADDY)
            script = Path(tmp) / "run.sh"
            script.write_text(f"set -euo pipefail\nCADDYFILE={caddyfile}\n{function_source('caddy_block')}caddy_block '{extra}'\n")
            subprocess.run(["bash", str(script)], check=True)
            return caddyfile.read_text()

    def test_iki_upstream_ve_yoklama(self):
        out = self.transform(r"$1\thealth_passes 2\n$1\thealth_fails 1\n")
        self.assertIn("reverse_proxy 127.0.0.1:3000 127.0.0.1:3001 {", out)
        for line in ("lb_policy first", "lb_try_duration 15s", "health_uri /api/health/live", "health_passes 2", "health_fails 1"):
            self.assertIn(line, out)
        # Alan adı ve transport bloğu korunur, girinti bloğun içinde.
        self.assertTrue(out.startswith("x.com {\n\tencode zstd gzip\n"))
        self.assertIn("\t\tresponse_header_timeout 180s", out)
        self.assertIn("\n\t\tlb_policy first\n", out)

    def test_eski_caddy_icin_ek_satirlar_olmadan(self):
        out = self.transform("")
        self.assertIn("health_uri /api/health/live", out)
        self.assertNotIn("health_passes", out)

    def test_depodaki_caddyfile_iki_upstreamli(self):
        text = (ROOT / "deploy/Caddyfile").read_text()
        self.assertIn("reverse_proxy 127.0.0.1:3000 127.0.0.1:3001 {", text)
        self.assertIn("health_uri /api/health/live", text)


class CronPortTest(unittest.TestCase):
    def snippet(self) -> str:
        text = (ROOT / "deploy/cron-alerts.sh").read_text()
        lines = [l for l in text.splitlines() if l.startswith("APP_PORT=")]
        self.assertEqual(len(lines), 2)
        return "\n".join(lines)

    def port_for(self, content: str | None) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            active = Path(tmp) / "active-port"
            if content is not None:
                active.write_text(content)
            code = self.snippet().replace("/srv/acilis-zili/shared/active-port", str(active)) + '\necho "$APP_PORT"\n'
            out = subprocess.run(["bash", "-c", code], capture_output=True, text=True, check=True)
            self.assertEqual(out.stderr, "", "dosya yokken hata basılmamalı")
            return out.stdout.strip()

    def test_dosya_yoksa_3000(self):
        self.assertEqual(self.port_for(None), "3000")

    def test_dosyadaki_port(self):
        self.assertEqual(self.port_for("3001\n"), "3001")

    def test_butun_cron_betikleri_canli_portu_okur(self):
        for script in sorted((ROOT / "deploy").glob("cron-*.sh")):
            text = script.read_text()
            if "127.0.0.1:" in text:
                self.assertNotIn("127.0.0.1:3000", text, script.name)
                self.assertIn("127.0.0.1:${APP_PORT}", text, script.name)


if __name__ == "__main__":
    unittest.main()
