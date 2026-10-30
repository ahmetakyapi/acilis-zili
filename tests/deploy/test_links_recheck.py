import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("links_recheck", Path(__file__).resolve().parents[2] / ".github/scripts/links-recheck.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

REPORT = """# Summary

## Errors per input

### Errors in https://aciliszili.com/mercek/a

* [404] <https://example.com/dead> (at 1:50678) | Rejected status code: 404 Not Found
* [ERROR] <https://finance.yahoo.com/ok> (at 1:66552) | HTTP/2 protocol error. Server may not support HTTP/2 properly

### Errors in https://aciliszili.com/mercek/b

* [ERROR] <https://finance.yahoo.com/ok> (at 1:100) | HTTP/2 protocol error. Server may not support HTTP/2 properly

[Full Github Actions output](https://github.com/x/y/actions/runs/1)
"""


class LinksRecheckTest(unittest.TestCase):
    def test_drops_links_that_open_on_retry(self):
        asked = []

        def status(url):
            asked.append(url)
            return {"https://example.com/dead": 404, "https://finance.yahoo.com/ok": 200}[url]

        remaining, body = helper.recheck(REPORT, status)
        self.assertEqual(remaining, 1)
        self.assertEqual(asked.count("https://finance.yahoo.com/ok"), 1)
        self.assertIn("### https://aciliszili.com/mercek/a", body)
        self.assertIn("* [404] <https://example.com/dead> | Rejected status code: 404 Not Found", body)
        self.assertNotIn("mercek/b", body)
        self.assertNotIn("yahoo", body.split("\n\n", 2)[2])
        self.assertTrue(body.rstrip().endswith("(https://github.com/x/y/actions/runs/1)"))

    def test_bot_wall_and_network_error(self):
        self.assertEqual(helper.recheck(REPORT, lambda url: 403)[0], 0)
        self.assertEqual(helper.recheck(REPORT, lambda url: 0)[0], 3)

    def test_empty_report(self):
        self.assertEqual(helper.recheck("", lambda url: 404)[0], 0)


if __name__ == "__main__":
    unittest.main()
