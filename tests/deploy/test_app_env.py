import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("set_app_env", Path(__file__).resolve().parents[2] / "deploy/set-app-env.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
FROM = "Açılış Zili <bildirim@aciliszili.com>"

class AppEnvTest(unittest.TestCase):
    def test_updates_only_given_keys_and_keeps_others(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('DATABASE_URL="keep"\nEMAIL_FROM="old <hesap@aciliszili.com>"\nexport EMAIL_FROM="dup"\nVAPID_PRIVATE_KEY="keep-vapid"\n')
            self.assertEqual(helper.update_env(target, {"EMAIL_FROM": FROM}), ["EMAIL_FROM"])
            content = target.read_text()
            self.assertIn('DATABASE_URL="keep"\n', content)
            self.assertIn('VAPID_PRIVATE_KEY="keep-vapid"\n', content)
            self.assertEqual(content.count("EMAIL_FROM="), 1)
            self.assertIn(f'EMAIL_FROM="{FROM}"\n', content)
            self.assertEqual(target.stat().st_mode & 0o777, 0o640)
            self.assertEqual(list(Path(folder).glob(".acilis-env-*")), [])

    def test_appends_missing_key(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('A="1"\n')
            helper.update_env(target, {"VAPID_SUBJECT": "mailto:kisi@example.com"})
            self.assertEqual(target.read_text(), 'A="1"\nVAPID_SUBJECT="mailto:kisi@example.com"\n')

    def test_rejects_injection_and_unknown_names_without_touching_file(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('BRIEF_SECRET="keep"\n')
            bad = [
                {"EMAIL_FROM": FROM + '\nBRIEF_SECRET="x"'},
                {"EMAIL_FROM": 'a"b <x@aciliszili.com>'},
                {"EMAIL_FROM": "$(id) <x@aciliszili.com>"},
                {"BRIEF_SECRET": "x"},
                {"EMAIL_FROM": FROM, "DATABASE_URL": "x"},
                {},
            ]
            for values in bad:
                with self.assertRaises(ValueError):
                    helper.update_env(target, values)
                self.assertEqual(target.read_text(), 'BRIEF_SECRET="keep"\n')

    def test_site_indexable_accepts_only_true_or_false(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('SITE_INDEXABLE=false\n')
            helper.update_env(target, {"SITE_INDEXABLE": "true"})
            self.assertEqual(target.read_text(), 'SITE_INDEXABLE="true"\n')
            for value in ["yes", "true\nX=1", "TRUE"]:
                with self.assertRaises(ValueError):
                    helper.update_env(target, {"SITE_INDEXABLE": value})

    def test_telegram_values(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text("")
            helper.update_env(target, {
                "TELEGRAM_BOT_TOKEN": "123456789:AAH" + "x" * 32,
                "TELEGRAM_CHANNEL_ID": "@aciliszili",
                "TELEGRAM_CHANNEL_ID_EN": "-1001234567890",
                "NEXT_PUBLIC_TELEGRAM_URL": "https://t.me/aciliszili",
            })
            self.assertIn('TELEGRAM_CHANNEL_ID="@aciliszili"\n', target.read_text())
            for values in [
                {"TELEGRAM_CHANNEL_ID": "@a b"},
                {"TELEGRAM_CHANNEL_ID": "@aciliszili\nX=1"},
                {"NEXT_PUBLIC_TELEGRAM_URL": "https://evil.example/aciliszili"},
                {"TELEGRAM_BOT_TOKEN": "notatoken"},
            ]:
                with self.assertRaises(ValueError):
                    helper.update_env(target, values)

    def test_refuses_symlink_target(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text("unchanged\n")
            link = Path(folder) / "linked.env"
            link.symlink_to(target)
            with self.assertRaises(ValueError):
                helper.update_env(link, {"EMAIL_FROM": FROM})
            self.assertEqual(target.read_text(), "unchanged\n")

if __name__ == "__main__":
    unittest.main()
