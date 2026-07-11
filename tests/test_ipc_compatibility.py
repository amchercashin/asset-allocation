import hashlib
import json
import subprocess
import unittest
from pathlib import Path

from scripts.inflation_data import render_ipc_js


ROOT = Path(__file__).resolve().parents[1]
BASELINE_COUNT = 269
BASELINE_LAST_DATE = "2025-06-30"
BASELINE_SHA256 = "4429b514c9fcb24caa92d20dff0da72ef1f71a5fc5dabd80cc827609ed6d4e99"


def current_month_records():
    script = r'''
const fs = require("fs");
const vm = require("vm");
const code = fs.readFileSync("ipc_data.js", "utf8");
const monthly = vm.runInNewContext(`${code}\nmonthlyCPI`);
const rows = [];
if (Array.isArray(monthly)) {
  monthly.forEach(({period, value}) => {
    rows.push({period, index_to_previous_month: value});
  });
} else {
  for (const [year, values] of Object.entries(monthly)) {
    values.forEach((value, index) => {
      const month = String(index + 1).padStart(2, "0");
      const period = `${year}-${month}`;
      if (period >= "2003-02") {
        rows.push({period, index_to_previous_month: value});
      }
    });
  }
}
console.log(JSON.stringify(rows));
'''
    output = subprocess.check_output(
        ["node", "-e", script], cwd=ROOT, text=True
    )
    return json.loads(output)


def evaluate_series(source):
    script = r'''
const vm = require("vm");
let code = "";
process.stdin.on("data", chunk => code += chunk);
process.stdin.on("end", () => {
  const series = vm.runInNewContext(`${code}\n({x: ipc.x, y: ipc.y})`);
  console.log(JSON.stringify(series));
});
'''
    output = subprocess.run(
        ["node", "-e", script],
        input=source,
        cwd=ROOT,
        text=True,
        check=True,
        capture_output=True,
    ).stdout
    return json.loads(output)


class IpcCompatibilityTests(unittest.TestCase):
    def test_workflow_updates_validates_and_deploys_pages(self):
        workflow_path = ROOT / ".github/workflows/pages.yml"
        self.assertTrue(workflow_path.is_file())
        workflow = workflow_path.read_text(encoding="utf-8")

        for required in (
            "schedule:",
            '- cron: "17 4 * * *"',
            "workflow_dispatch:",
            "push:",
            "contents: write",
            "pages: write",
            "id-token: write",
            "python scripts/update_inflation.py",
            "python -m unittest discover -s tests -v",
            "actions/upload-pages-artifact",
            "actions/deploy-pages",
        ):
            with self.subTest(required=required):
                self.assertIn(required, workflow)

    def test_page_explains_automatic_rosstat_updates(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")

        self.assertIn("https://rosstat.gov.ru/statistics/price", html)
        self.assertIn("обновляется автоматически", html)
        self.assertNotIn("не обновляется автоматически", html)

    def test_renders_existing_plotly_trace_interface(self):
        source = render_ipc_js(current_month_records())

        self.assertIn("let ipc = {};", source)
        self.assertIn('ipc.name = "ИПЦ";', source)
        self.assertIn('ipc.type = "scatter";', source)

    def test_preserves_all_published_points_through_june_2025(self):
        source = render_ipc_js(current_month_records())
        self.assertTrue(source)

        series = evaluate_series(source)
        baseline = {
            "x": series["x"][:BASELINE_COUNT],
            "y": series["y"][:BASELINE_COUNT],
        }
        payload = json.dumps(baseline, separators=(",", ":")).encode()

        self.assertEqual(len(baseline["x"]), BASELINE_COUNT)
        self.assertEqual(baseline["x"][0], "2003-02-28")
        self.assertEqual(baseline["y"][0], 1)
        self.assertEqual(baseline["x"][-1], BASELINE_LAST_DATE)
        self.assertEqual(hashlib.sha256(payload).hexdigest(), BASELINE_SHA256)


if __name__ == "__main__":
    unittest.main()
