import hashlib
import json
import ssl
import subprocess
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import BytesIO
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from openpyxl import Workbook

from scripts.inflation_data import (
    InflationDataError,
    discover_latest_workbook,
    merge_months,
    parse_workbook,
)
from scripts.update_inflation import (
    create_rosstat_ssl_context,
    fetch_url,
    main,
    update_files,
)


MONTHS_RU = [
    "январь",
    "февраль",
    "март",
    "апрель",
    "май",
    "июнь",
    "июль",
    "август",
    "сентябрь",
    "октябрь",
    "ноябрь",
    "декабрь",
]


def workbook_bytes(year_values):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "01"
    sheet.append(["Индексы потребительских цен"])
    sheet.append([None, *year_values.keys()])
    sheet.append(["к концу предыдущего месяца"])
    for month_index, month in enumerate(MONTHS_RU):
        sheet.append(
            [month, *(values[month_index] for values in year_values.values())]
        )

    stream = BytesIO()
    workbook.save(stream)
    return stream.getvalue()


class FakeResponse:
    def __init__(self, content, final_url, content_length=None):
        self._stream = BytesIO(content)
        self._final_url = final_url
        self.headers = {}
        if content_length is not None:
            self.headers["Content-Length"] = str(content_length)

    def geturl(self):
        return self._final_url

    def read(self, size=-1):
        return self._stream.read(size)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False


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


class ParseWorkbookTests(unittest.TestCase):
    def test_parses_months_from_february_2003(self):
        values_2003 = [102.4, 101.63] + [100.0] * 10

        rows = parse_workbook(workbook_bytes({2003: values_2003}))

        self.assertTrue(rows)
        self.assertEqual(
            rows[0],
            {"period": "2003-02", "index_to_previous_month": 101.63},
        )
        self.assertEqual(rows[-1]["period"], "2003-12")

    def test_rejects_missing_sheet(self):
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


class MergeMonthsTests(unittest.TestCase):
    def test_appends_only_new_consecutive_months(self):
        existing = [
            {"period": "2025-05", "index_to_previous_month": 100.43},
            {"period": "2025-06", "index_to_previous_month": 100.20},
        ]
        official = existing + [
            {"period": "2025-07", "index_to_previous_month": 100.57}
        ]

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

    def test_rejects_missing_month(self):
        official = [
            {"period": "2025-06", "index_to_previous_month": 100.20},
            {"period": "2025-08", "index_to_previous_month": 99.60},
        ]

        with self.assertRaisesRegex(InflationDataError, "not consecutive"):
            merge_months([], official)


class UpdateFilesTests(unittest.TestCase):
    def test_writes_canonical_json_and_compatible_javascript(self):
        html = b'<a href="/storage/mediabank/ipc_mes_12-2003.xlsx">data</a>'
        xlsx = workbook_bytes({2003: [100.0] * 12})
        responses = {
            "https://rosstat.gov.ru/statistics/price": html,
            "https://rosstat.gov.ru/storage/mediabank/ipc_mes_12-2003.xlsx": xlsx,
        }

        with TemporaryDirectory() as directory:
            root = Path(directory)

            changed = update_files(
                root,
                fetch=lambda url: responses[url],
                retrieved_at="2026-06-30T12:00:00Z",
            )

            self.assertTrue((root / "data/inflation-monthly.json").is_file())
            self.assertTrue((root / "ipc_data.js").is_file())
            data = json.loads(
                (root / "data/inflation-monthly.json").read_text(encoding="utf-8")
            )
            source = (root / "ipc_data.js").read_text(encoding="utf-8")
            self.assertTrue(changed)
            self.assertEqual(data["source"]["agency"], "Rosstat")
            self.assertEqual(data["latest_period"], "2003-12")
            self.assertIn('ipc.name = "ИПЦ";', source)

    def test_does_not_rewrite_files_when_source_has_no_new_month(self):
        html = b'<a href="/storage/mediabank/ipc_mes_12-2003.xlsx">data</a>'
        xlsx = workbook_bytes({2003: [100.0] * 12})
        responses = {
            "https://rosstat.gov.ru/statistics/price": html,
            "https://rosstat.gov.ru/storage/mediabank/ipc_mes_12-2003.xlsx": xlsx,
        }

        with TemporaryDirectory() as directory:
            root = Path(directory)
            fetch = lambda url: responses[url]
            update_files(root, fetch=fetch, retrieved_at="2026-06-30T12:00:00Z")
            data_before = (root / "data/inflation-monthly.json").read_bytes()
            js_before = (root / "ipc_data.js").read_bytes()

            changed = update_files(
                root,
                fetch=fetch,
                retrieved_at="2026-07-01T12:00:00Z",
            )

            self.assertFalse(changed)
            self.assertEqual(
                (root / "data/inflation-monthly.json").read_bytes(), data_before
            )
            self.assertEqual((root / "ipc_data.js").read_bytes(), js_before)


class FetchUrlTests(unittest.TestCase):
    def test_bundled_sub_ca_has_expected_fingerprint(self):
        ca_path = (
            Path(__file__).resolve().parents[1]
            / "certs/russian-trusted-sub-ca-2024.pem"
        )

        self.assertTrue(ca_path.is_file())
        pem = ca_path.read_text(encoding="ascii")
        der = ssl.PEM_cert_to_DER_cert(pem)

        self.assertEqual(
            hashlib.sha256(der).hexdigest(),
            "2155785036c900dbb5f1bb2a1569c80c55595bd6bf94867a29bbddbc7d88a3f2",
        )

    def test_default_download_uses_bundled_verifying_context(self):
        response = FakeResponse(
            b"data", "https://rosstat.gov.ru/storage/data.xlsx", content_length=4
        )

        with patch(
            "scripts.update_inflation.urlopen", return_value=response
        ) as default_opener:
            content = fetch_url("https://rosstat.gov.ru/storage/data.xlsx")

        context = default_opener.call_args.kwargs.get("context")
        self.assertEqual(content, b"data")
        self.assertIsInstance(context, ssl.SSLContext)
        self.assertTrue(context.verify_mode == ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertTrue(context.verify_flags & ssl.VERIFY_X509_PARTIAL_CHAIN)

    def test_context_factory_requires_bundled_ca(self):
        context = create_rosstat_ssl_context()

        self.assertIsInstance(context, ssl.SSLContext)
        self.assertTrue(context.verify_flags & ssl.VERIFY_X509_PARTIAL_CHAIN)

    def test_reads_small_https_response_from_rosstat(self):
        response = FakeResponse(
            b"data", "https://rosstat.gov.ru/storage/data.xlsx", content_length=4
        )

        content = fetch_url(
            "https://rosstat.gov.ru/storage/data.xlsx",
            max_bytes=4,
            opener=lambda request, timeout: response,
        )

        self.assertEqual(content, b"data")

    def test_rejects_redirect_to_foreign_host(self):
        response = FakeResponse(b"data", "https://example.com/data.xlsx")

        with self.assertRaisesRegex(InflationDataError, "unexpected host"):
            fetch_url(
                "https://rosstat.gov.ru/storage/data.xlsx",
                opener=lambda request, timeout: response,
            )

    def test_rejects_response_larger_than_limit(self):
        response = FakeResponse(
            b"12345", "https://rosstat.gov.ru/storage/data.xlsx", content_length=5
        )

        with self.assertRaisesRegex(InflationDataError, "size limit"):
            fetch_url(
                "https://rosstat.gov.ru/storage/data.xlsx",
                max_bytes=4,
                opener=lambda request, timeout: response,
            )


class CommandLineTests(unittest.TestCase):
    def test_supports_documented_direct_script_invocation(self):
        root = Path(__file__).resolve().parents[1]

        result = subprocess.run(
            [sys.executable, "scripts/update_inflation.py", "--help"],
            cwd=root,
            text=True,
            capture_output=True,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Update the static Russian CPI series", result.stdout)

    def test_reports_successful_update(self):
        output = StringIO()
        with TemporaryDirectory() as directory, patch(
            "scripts.update_inflation.update_files", return_value=True
        ) as updater, redirect_stdout(output):
            exit_code = main(["--root", directory])

        self.assertEqual(exit_code, 0)
        updater.assert_called_once()
        self.assertIn("updated", output.getvalue().lower())

    def test_reports_source_error_without_traceback(self):
        output = StringIO()
        with patch(
            "scripts.update_inflation.update_files",
            side_effect=InflationDataError("broken source"),
        ), redirect_stderr(output):
            exit_code = main([])

        self.assertEqual(exit_code, 1)
        self.assertIn("broken source", output.getvalue())
        self.assertNotIn("Traceback", output.getvalue())


if __name__ == "__main__":
    unittest.main()
