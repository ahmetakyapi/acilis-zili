import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("set_analysis_key", Path(__file__).resolve().parents[2] / "deploy/set-analysis-key.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
FAKE_KEY = "sk-ant-" + "unit_test_value_" * 3

class AnalysisKeyTest(unittest.TestCase):
    def test_preserves_other_secrets_and_removes_duplicate_assignments(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('# settings\nDATABASE_URL="existing"\nCLAUDE_ANALYSIS_API_KEY="old"\nexport CLAUDE_ANALYSIS_API_KEY="duplicate"\nBRIEF_SECRET="keep-me"\n')
            helper.update_env(target, FAKE_KEY)
            content = target.read_text()
            self.assertIn('DATABASE_URL="existing"\n', content)
            self.assertIn('BRIEF_SECRET="keep-me"\n', content)
            self.assertEqual(content.count('CLAUDE_ANALYSIS_API_KEY='), 1)
            self.assertEqual(target.stat().st_mode & 0o777, 0o640)
            helper.update_env(target, FAKE_KEY)
            self.assertEqual(content, target.read_text())
            self.assertEqual(list(Path(folder).glob('.acilis-env-*')), [])

    def test_drops_only_the_retired_model_pin(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('CLAUDE_ANALYSIS_MODEL="claude-sonnet-4-6"\nCLAUDE_ANALYSIS_DISABLED="0"\n')
            helper.update_env(target, FAKE_KEY)
            self.assertNotIn('CLAUDE_ANALYSIS_MODEL', target.read_text())
            self.assertIn('CLAUDE_ANALYSIS_DISABLED="0"\n', target.read_text())
            target.write_text('CLAUDE_ANALYSIS_MODEL="claude-opus-5-5"\n')
            helper.update_env(target, FAKE_KEY)
            self.assertIn('CLAUDE_ANALYSIS_MODEL="claude-opus-5-5"\n', target.read_text())

    def test_rejects_injection_before_changing_file(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('BRIEF_SECRET="keep"\n')
            for value in [FAKE_KEY + '\nOTHER_KEY="bad"', '$(echo bad)', '']:
                with self.assertRaises(ValueError):
                    helper.update_env(target, value)
                self.assertEqual(target.read_text(), 'BRIEF_SECRET="keep"\n')

    def test_refuses_symlink_target(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "app.env"
            target.write_text('unchanged\n')
            link = Path(folder) / "linked.env"
            link.symlink_to(target)
            with self.assertRaises(ValueError):
                helper.update_env(link, FAKE_KEY)
            self.assertEqual(target.read_text(), 'unchanged\n')

if __name__ == '__main__':
    unittest.main()
