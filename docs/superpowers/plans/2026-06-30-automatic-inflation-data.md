# Automatic Inflation Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically update the site's Russian monthly CPI series from Rosstat while preserving every published point and retaining a last-known-good static site on failures.

**Architecture:** A small Python library discovers and parses Rosstat's current XLSX, enforces append-only history, stores canonical monthly values in JSON, and deterministically regenerates the existing `ipc_data.js` interface. One GitHub Actions workflow runs the updater and tests, commits new data, and explicitly deploys GitHub Pages so a bot commit does not leave the public site stale.

**Tech Stack:** Python 3.12, `openpyxl` 3.1.x, standard-library `unittest`, JavaScript/Node syntax and compatibility checks, GitHub Actions, GitHub Pages.

---

## File map

- Create `requirements.txt`: pin the sole runtime/test dependency.
- Create `scripts/inflation_data.py`: pure discovery, parsing, validation, merge, and JS-rendering functions.
- Create `scripts/update_inflation.py`: network/CLI orchestration and atomic file writes.
- Create `data/inflation-monthly.json`: canonical accumulated Rosstat values and source metadata.
- Modify `ipc_data.js`: deterministic generated artifact with the unchanged global `ipc` interface.
- Create `tests/test_inflation_data.py`: unit and integration tests.
- Create `tests/test_ipc_compatibility.py`: exact historical fingerprint and JavaScript execution tests.
- Create `.github/workflows/pages.yml`: scheduled/manual update, validation, commit, and Pages deployment.
- Modify `index.html:92-93`: official source link and automatic-update explanation.
- Modify `README.md`: document source, local update/test commands, and failure policy.

### Task 1: Source-link discovery

**Files:**
- Create: `requirements.txt`
- Create: `scripts/__init__.py`
- Create: `scripts/inflation_data.py`
- Create: `tests/test_inflation_data.py`

- [ ] **Step 1: Add the dependency and failing discovery tests**

`requirements.txt`:

```text
openpyxl>=3.1,<4
```

Start `tests/test_inflation_data.py` with:

```python
import unittest

from scripts.inflation_data import InflationDataError, discover_latest_workbook


class DiscoverWorkbookTests(unittest.TestCase):
    def test_selects_latest_rosstat_monthly_workbook(self):
        html = b'''<a href="/storage/mediabank/ipc_mes_12-2025.xlsx">old</a>
                   <a href="/storage/mediabank/ipc_mes_05-2026.xlsx">new</a>'''
        self.assertEqual(
            discover_latest_workbook(html),
            "https://rosstat.gov.ru/storage/mediabank/ipc_mes_05-2026.xlsx",
        )

    def test_rejects_absolute_link_on_foreign_host(self):
        html = b'<a href="https://example.com/ipc_mes_06-2026.xlsx">bad</a>'
        with self.assertRaisesRegex(InflationDataError, "Rosstat workbook"):
            discover_latest_workbook(html)

    def test_rejects_missing_workbook_link(self):
        with self.assertRaisesRegex(InflationDataError, "Rosstat workbook"):
            discover_latest_workbook(b"<html></html>")
```

- [ ] **Step 2: Run the test and verify RED**

Run: `python3 -m unittest tests.test_inflation_data -v`

Expected: `ERROR` because `scripts.inflation_data` does not yet define the imported API.

- [ ] **Step 3: Implement strict link discovery**

In `scripts/inflation_data.py`, define:

```python
import re
from urllib.parse import urljoin, urlparse

LANDING_URL = "https://rosstat.gov.ru/statistics/price"
ALLOWED_HOST = "rosstat.gov.ru"
WORKBOOK_RE = re.compile(r"ipc_mes_(\d{2})-(\d{4})\.xlsx$", re.IGNORECASE)


class InflationDataError(RuntimeError):
    pass


def discover_latest_workbook(html: bytes) -> str:
    text = html.decode("utf-8", errors="replace")
    candidates = []
    for href in re.findall(r'href=["\']([^"\']+)["\']', text, re.IGNORECASE):
        url = urljoin(LANDING_URL, href)
        parsed = urlparse(url)
        match = WORKBOOK_RE.search(parsed.path)
        if parsed.scheme == "https" and parsed.hostname == ALLOWED_HOST and match:
            month, year = map(int, match.groups())
            if 1 <= month <= 12:
                candidates.append(((year, month), url))
    if not candidates:
        raise InflationDataError("Rosstat workbook link was not found")
    return max(candidates)[1]
```

- [ ] **Step 4: Run the discovery tests and verify GREEN**

Run: `python3 -m unittest tests.test_inflation_data -v`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt scripts/__init__.py scripts/inflation_data.py tests/test_inflation_data.py
git commit -m "test: define Rosstat workbook discovery"
```

### Task 2: Workbook parser

**Files:**
- Modify: `scripts/inflation_data.py`
- Modify: `tests/test_inflation_data.py`

- [ ] **Step 1: Add failing parser tests using a generated XLSX**

Add helpers and tests:

```python
from io import BytesIO
from openpyxl import Workbook

from scripts.inflation_data import parse_workbook

MONTHS_RU = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
]


def workbook_bytes(year_values):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "01"
    sheet.append(["Индексы потребительских цен"])
    sheet.append([None, *year_values.keys()])
    sheet.append(["к концу предыдущего месяца"])
    for month_index, month in enumerate(MONTHS_RU):
        sheet.append([month, *(values[month_index] for values in year_values.values())])
    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


class ParseWorkbookTests(unittest.TestCase):
    def test_parses_months_from_february_2003(self):
        values_2003 = [102.4, 101.63] + [100.0] * 10
        rows = parse_workbook(workbook_bytes({2003: values_2003}))
        self.assertEqual(rows[0], {"period": "2003-02", "index_to_previous_month": 101.63})
        self.assertEqual(rows[-1]["period"], "2003-12")

    def test_rejects_missing_sheet(self):
        data = workbook_bytes({2003: [100.0] * 12})
        workbook = Workbook()
        workbook.active.title = "wrong"
        stream = BytesIO()
        workbook.save(stream)
        with self.assertRaisesRegex(InflationDataError, "sheet 01"):
            parse_workbook(stream.getvalue())

    def test_rejects_value_outside_guard_range(self):
        values = [100.0] * 12
        values[5] = 121.0
        with self.assertRaisesRegex(InflationDataError, "outside 80..120"):
            parse_workbook(workbook_bytes({2003: values}))
```

- [ ] **Step 2: Run parser tests and verify RED**

Run: `python3 -m unittest tests.test_inflation_data.ParseWorkbookTests -v`

Expected: import or attribute failure for `parse_workbook`.

- [ ] **Step 3: Implement content-based workbook parsing**

Implement `parse_workbook(content: bytes) -> list[dict]` using `openpyxl.load_workbook(BytesIO(content), read_only=True, data_only=True)`. Locate the row containing integer years, then locate the unique rows named by the 12 Russian month names. Build chronological records beginning at `2003-02`; reject missing/duplicate months, non-numeric values, years with values after an empty month, and values outside inclusive `80..120`. Raise `InflationDataError` with the period and cause.

Use these module constants and helper signature:

```python
START_PERIOD = "2003-02"
MONTHS_RU = ("январь", "февраль", "март", "апрель", "май", "июнь",
             "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь")


def parse_workbook(content: bytes) -> list[dict]:
    """Return sorted {period, index_to_previous_month} records."""
```

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m unittest tests.test_inflation_data -v`

Expected: all discovery and parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/inflation_data.py tests/test_inflation_data.py
git commit -m "feat: parse Rosstat monthly CPI workbook"
```

### Task 3: Append-only validation and canonical JSON

**Files:**
- Modify: `scripts/inflation_data.py`
- Modify: `tests/test_inflation_data.py`

- [ ] **Step 1: Add failing merge tests**

```python
from scripts.inflation_data import merge_months


class MergeMonthsTests(unittest.TestCase):
    def test_appends_only_new_consecutive_months(self):
        existing = [
            {"period": "2025-05", "index_to_previous_month": 100.43},
            {"period": "2025-06", "index_to_previous_month": 100.20},
        ]
        official = existing + [{"period": "2025-07", "index_to_previous_month": 100.57}]
        merged, changed = merge_months(existing, official)
        self.assertTrue(changed)
        self.assertEqual(merged, official)

    def test_is_idempotent_without_new_months(self):
        rows = [{"period": "2025-06", "index_to_previous_month": 100.20}]
        merged, changed = merge_months(rows, list(rows))
        self.assertFalse(changed)
        self.assertEqual(merged, rows)

    def test_rejects_historical_revision(self):
        existing = [{"period": "2025-06", "index_to_previous_month": 100.20}]
        revised = [{"period": "2025-06", "index_to_previous_month": 100.21}]
        with self.assertRaisesRegex(InflationDataError, "historical value changed"):
            merge_months(existing, revised)

    def test_rejects_official_series_older_than_local(self):
        existing = [
            {"period": "2025-06", "index_to_previous_month": 100.20},
            {"period": "2025-07", "index_to_previous_month": 100.57},
        ]
        with self.assertRaisesRegex(InflationDataError, "older than local"):
            merge_months(existing, existing[:1])
```

- [ ] **Step 2: Run merge tests and verify RED**

Run: `python3 -m unittest tests.test_inflation_data.MergeMonthsTests -v`

Expected: import or attribute failure for `merge_months`.

- [ ] **Step 3: Implement exact overlap and continuity checks**

Define `next_period(period: str) -> str`, `validate_sequence(rows)`, and:

```python
def merge_months(existing: list[dict], official: list[dict]) -> tuple[list[dict], bool]:
    """Validate exact overlap and return append-only merged rows plus changed flag."""
```

Compare decimal source values exactly after normalizing them to two decimal places. Validate both series are strictly monthly. Reject a shorter official series and any changed overlapping period. Return the original list unchanged when no month is added.

- [ ] **Step 4: Run the complete unit suite and verify GREEN**

Run: `python3 -m unittest tests.test_inflation_data -v`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/inflation_data.py tests/test_inflation_data.py
git commit -m "feat: enforce append-only inflation history"
```

### Task 4: Deterministic `ipc_data.js` generation and historical fingerprint

**Files:**
- Modify: `scripts/inflation_data.py`
- Create: `tests/test_ipc_compatibility.py`

- [ ] **Step 1: Add failing renderer and compatibility tests**

Use the published baseline constants:

```python
BASELINE_COUNT = 269
BASELINE_LAST_PERIOD = "2025-06-30"
BASELINE_SHA256 = "4429b514c9fcb24caa92d20dff0da72ef1f71a5fc5dabd80cc827609ed6d4e99"
```

In `tests/test_ipc_compatibility.py`, extract the current source table with Node before calling the renderer:

```python
import hashlib
import json
import subprocess
from pathlib import Path

from scripts.inflation_data import render_ipc_js

ROOT = Path(__file__).resolve().parents[1]


def current_month_records():
    script = r'''const fs = require("fs"); const vm = require("vm");
const code = fs.readFileSync("ipc_data.js", "utf8");
const monthly = vm.runInNewContext(`${code}\nmonthlyCPI`);
const rows = [];
if (Array.isArray(monthly)) {
  monthly.forEach(({period, value}) => rows.push({period, index_to_previous_month: value}));
} else {
  for (const [year, values] of Object.entries(monthly)) {
    values.forEach((value, index) => {
      const month = String(index + 1).padStart(2, "0");
      if (`${year}-${month}` >= "2003-02") rows.push({period: `${year}-${month}`, index_to_previous_month: value});
    });
  }
}
console.log(JSON.stringify(rows));'''
    output = subprocess.check_output(["node", "-e", script], cwd=ROOT, text=True)
    return json.loads(output)


def evaluate_series(source):
    script = r'''const vm = require("vm"); let code = "";
process.stdin.on("data", chunk => code += chunk);
process.stdin.on("end", () => {
  const series = vm.runInNewContext(`${code}\n({x: ipc.x, y: ipc.y})`);
  console.log(JSON.stringify(series));
});'''
    output = subprocess.run(
        ["node", "-e", script], input=source, cwd=ROOT,
        text=True, check=True, capture_output=True,
    ).stdout
    return json.loads(output)
```

Call `render_ipc_js(current_month_records())`, evaluate it, slice the first 269 points, serialize compactly with `json.dumps({"x": x, "y": y}, separators=(",", ":"))`, and assert its SHA-256 equals `BASELINE_SHA256`. Also assert `ipc.x[0] == "2003-02-28"`, `ipc.y[0] == 1`, and the 269th date is `BASELINE_LAST_PERIOD`.

Add a renderer-format test asserting the result contains:

```javascript
let ipc = {};
ipc.name = "ИПЦ";
ipc.type = "scatter";
```

- [ ] **Step 2: Run compatibility tests and verify RED**

Run: `python3 -m unittest tests.test_ipc_compatibility -v`

Expected: import or attribute failure for `render_ipc_js`.

- [ ] **Step 3: Implement deterministic rendering**

Implement:

```python
def render_ipc_js(months: list[dict]) -> str:
    """Render grouped monthly CPI plus the existing global Plotly trace API."""
```

Emit records as a deterministic flat array of `{period, value}` objects so the first record remains February 2003 and cannot be mistaken for January. Reuse the existing JavaScript cumulative-product algorithm, compute the last day from each explicit period, apply `parseFloat(normalised.toFixed(10))`, and preserve all Plotly metadata. Do not change the global variable name or trace fields. End with a newline.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m unittest tests.test_ipc_compatibility -v`

Expected: the exact 269-point baseline fingerprint passes.

- [ ] **Step 5: Commit**

```bash
git add scripts/inflation_data.py tests/test_ipc_compatibility.py
git commit -m "feat: generate backward-compatible IPC trace"
```

### Task 5: Network updater and live canonical data

**Files:**
- Create: `scripts/update_inflation.py`
- Create: `data/inflation-monthly.json`
- Modify: `ipc_data.js`
- Modify: `tests/test_inflation_data.py`

- [ ] **Step 1: Add a failing CLI integration test with mocked downloads**

Test a callable API instead of spawning the network process:

```python
from pathlib import Path
from tempfile import TemporaryDirectory
from scripts.update_inflation import update_files


class UpdateFilesTests(unittest.TestCase):
    def test_writes_json_and_js_atomically(self):
        html = b'<a href="/storage/mediabank/ipc_mes_12-2003.xlsx">data</a>'
        xlsx = workbook_bytes({2003: [100.0] * 12})
        responses = {
            "https://rosstat.gov.ru/statistics/price": html,
            "https://rosstat.gov.ru/storage/mediabank/ipc_mes_12-2003.xlsx": xlsx,
        }
        with TemporaryDirectory() as directory:
            root = Path(directory)
            changed = update_files(root, fetch=lambda url: responses[url], retrieved_at="2026-06-30T12:00:00Z")
            self.assertTrue(changed)
            self.assertTrue((root / "data/inflation-monthly.json").is_file())
            self.assertIn('ipc.name = "ИПЦ"', (root / "ipc_data.js").read_text())
```

- [ ] **Step 2: Run the integration test and verify RED**

Run: `python3 -m unittest tests.test_inflation_data.UpdateFilesTests -v`

Expected: import failure because `scripts.update_inflation` does not exist.

- [ ] **Step 3: Implement the updater**

`scripts/update_inflation.py` must:

- expose `fetch_url(url, max_bytes=5_000_000) -> bytes` using `urllib.request`, a descriptive User-Agent, a 30-second timeout, HTTPS/final-host checks, and a hard size limit;
- expose `update_files(root: Path, fetch=fetch_url, retrieved_at=None) -> bool`;
- load existing JSON when present, otherwise bootstrap from the official workbook;
- call discovery, parsing, merge, and rendering functions;
- only replace JSON metadata when new months are appended;
- include agency, landing/file URLs, UTC retrieval time, XLSX SHA-256, and latest period;
- write JSON and JS via temporary sibling files followed by `Path.replace()`;
- avoid rewriting either file on an idempotent run;
- print the latest period and changed/unchanged status from `main()`;
- exit non-zero with a concise `InflationDataError` message.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m unittest discover -s tests -v`

Expected: all tests pass.

- [ ] **Step 5: Run the updater against live Rosstat data**

Run: `python3 scripts/update_inflation.py`

Expected: `data/inflation-monthly.json` and `ipc_data.js` are generated through `2026-05`, using the current official file URL and SHA-256.

- [ ] **Step 6: Run it again to prove idempotence**

Run: `git diff --exit-code data/inflation-monthly.json ipc_data.js` after a second `python3 scripts/update_inflation.py`.

Expected: second run reports unchanged and produces no diff.

- [ ] **Step 7: Commit**

```bash
git add scripts/update_inflation.py data/inflation-monthly.json ipc_data.js tests/test_inflation_data.py
git commit -m "feat: update inflation data from Rosstat"
```

### Task 6: Site copy and operator documentation

**Files:**
- Modify: `index.html:92-93`
- Modify: `README.md`

- [ ] **Step 1: Add a failing content assertion**

Add a test that reads `index.html` and asserts it contains the HTTPS Rosstat landing URL, `обновляется автоматически`, and no longer contains `не обновляется автоматически`.

- [ ] **Step 2: Run the content test and verify RED**

Run: `python3 -m unittest tests.test_ipc_compatibility -v`

Expected: failure on the old copy and old HTTP `gks.ru` link.

- [ ] **Step 3: Update copy and README**

Replace the IPC definition with an HTTPS link to `https://rosstat.gov.ru/statistics/price` and text stating that the monthly series is automatically updated from Rosstat while the last correct version is retained on source errors.

Add README sections with these exact operator commands:

```bash
python3 -m pip install -r requirements.txt
python3 scripts/update_inflation.py
python3 -m unittest discover -s tests -v
```

Document the canonical JSON, append-only revision policy, weekly/manual workflow, and public Pages URL.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `python3 -m unittest discover -s tests -v`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md tests/test_ipc_compatibility.py
git commit -m "docs: explain automatic Rosstat inflation updates"
```

### Task 7: Unified update and Pages workflow

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `tests/test_ipc_compatibility.py`

- [ ] **Step 1: Add a failing workflow-structure test**

Read `.github/workflows/pages.yml` as text and assert it contains `schedule`, `workflow_dispatch`, `push`, `contents: write`, `pages: write`, `id-token: write`, `python scripts/update_inflation.py`, `python -m unittest discover -s tests -v`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.

- [ ] **Step 2: Run the test and verify RED**

Run: `python3 -m unittest tests.test_ipc_compatibility -v`

Expected: `FileNotFoundError` for `.github/workflows/pages.yml`.

- [ ] **Step 3: Create the workflow**

Create one workflow named `Update inflation and deploy Pages` with:

```yaml
on:
  push:
    branches: [master]
  schedule:
    - cron: "17 4 * * 2"
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false
```

The build job checks out `master`, sets up Python 3.12, installs requirements, conditionally runs the updater for non-push events, runs unit and JS syntax tests, commits only `data/inflation-monthly.json` and `ipc_data.js` when changed, pushes to `master`, stages a static `_site` directory excluding `.git`, `.github`, `docs`, `scripts`, `tests`, `requirements.txt`, and `_site`, configures Pages, and uploads the artifact. A dependent deploy job uses the `github-pages` environment and `actions/deploy-pages`.

- [ ] **Step 4: Validate YAML and tests**

Run:

```bash
python3 -c 'import yaml; yaml.safe_load(open(".github/workflows/pages.yml"))'
python3 -m unittest discover -s tests -v
```

If PyYAML is unavailable locally, validate with Ruby's bundled YAML parser:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/pages.yml", aliases: true)'
```

Expected: YAML parses and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/pages.yml tests/test_ipc_compatibility.py
git commit -m "ci: automate inflation updates and Pages deploy"
```

### Task 8: Local end-to-end verification

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run the full automated suite from a clean state**

Run:

```bash
python3 -m unittest discover -s tests -v
find . -type f -name '*.js' -not -path './.git/*' -exec node --check {} \;
git diff --check
git status --short
```

Expected: all tests pass, every JavaScript file parses, no whitespace errors, and only intentional committed changes exist.

- [ ] **Step 2: Verify live source metadata**

Run a short Python check that asserts `latest_period == "2026-05"`, source agency is Rosstat, source URL uses HTTPS on `rosstat.gov.ru`, SHA-256 has 64 hexadecimal characters, and the month sequence is complete from `2003-02`.

Expected: all assertions pass.

- [ ] **Step 3: Serve and inspect locally in the in-app browser**

Run: `python3 -m http.server 8000 --bind 127.0.0.1`

Open `http://127.0.0.1:8000/` using the Browser plugin. Verify:

- no uncaught console errors;
- graph contains `MCFTRR`, `RGBITR`, and `ИПЦ` traces;
- IPC first date/value are `2003-02-28` and `1.0`;
- IPC latest date is `2026-05-31`;
- build/reset/log-scale controls remain functional;
- no browser request is sent to Rosstat.

- [ ] **Step 4: Commit any verification-only fixes**

Only if a defect was found, add a regression test first, make the minimal fix, rerun the suite, and commit with a message describing the defect. Otherwise create no empty commit.

### Task 9: Publish and verify production

**Files:**
- No new local files expected.

- [ ] **Step 1: Rebase on the latest remote state and rerun verification**

Run:

```bash
git fetch origin
git rebase origin/master
python3 -m unittest discover -s tests -v
git diff --check
```

Expected: clean rebase and all tests pass.

- [ ] **Step 2: Push the implementation to `master`**

Run: `git push origin HEAD:master`

Expected: fast-forward update succeeds without altering the dirty original working directory.

- [ ] **Step 3: Switch Pages to workflow deployment**

Run:

```bash
gh api --method PUT repos/amchercashin/asset-allocation/pages -f build_type=workflow
gh api repos/amchercashin/asset-allocation/pages
```

Expected: `build_type` is `workflow` and the public URL remains `https://amchercashin.github.io/asset-allocation/`.

- [ ] **Step 4: Trigger and watch the manual workflow**

Run:

```bash
gh workflow run pages.yml --ref master
gh run list --workflow pages.yml --limit 1
gh run watch <run-id> --exit-status
```

Expected: update/build and deploy jobs finish successfully.

- [ ] **Step 5: Verify the public site**

Open `https://amchercashin.github.io/asset-allocation/` with cache disabled. Repeat the local browser assertions, confirm `ipc_data.js` includes `2026-05`, inspect the network log to confirm no Rosstat request, and confirm the original `/Users/amchercashin/asset-allocation` status is unchanged.

- [ ] **Step 6: Completion audit**

Collect authoritative evidence for each design criterion: remote commit, successful Actions run, Pages API state, public browser behavior, source metadata, baseline fingerprint, full tests, and untouched original working tree. Do not claim completion until every item is proven.
