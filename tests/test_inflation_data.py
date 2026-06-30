import unittest
from io import BytesIO

from openpyxl import Workbook

from scripts.inflation_data import (
    InflationDataError,
    discover_latest_workbook,
    merge_months,
    parse_workbook,
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


if __name__ == "__main__":
    unittest.main()
