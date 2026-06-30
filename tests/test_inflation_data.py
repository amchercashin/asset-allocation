import unittest
from io import BytesIO

from openpyxl import Workbook

from scripts.inflation_data import (
    InflationDataError,
    discover_latest_workbook,
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


if __name__ == "__main__":
    unittest.main()
