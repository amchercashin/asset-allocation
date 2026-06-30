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


if __name__ == "__main__":
    unittest.main()
